import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Platform,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { WakaWayMapView } from '../components/map/MapView';
import { RouteStepCard } from '../components/RouteStepCard';
import { FareEstimateCard } from '../components/FareEstimateCard';
import { SmartRouteOptions } from '../components/SmartRouteOptions';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES, GOOGLE_MAPS_API_KEY } from '../utils/constants';
import { getRoute } from '../services/api';
import type { TransportMode } from '../types/routing';
import { SmartRouteResult, RouteOption } from '../services/smartRoutingService';
import { addRouteHistory, saveRoute, deleteSavedRoute, getSavedRoutes } from '../services/supabaseDataService';
import {
  getActiveIncidents,
  getIncidentsOnRoute,
  getRerouteDecision,
  incidentSummaryText,
  incidentColor,
  ScoredIncident,
  RerouteDecision,
} from '../services/incidentService';
import { searchRoutes } from '../services/api';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet snap points
const SNAP_POINTS = {
    COLLAPSED: SCREEN_HEIGHT * 0.25,  // Show 25% of sheet (minimal peek for map view)
    HALF: SCREEN_HEIGHT * 0.5,        // Show 50% of sheet
    EXPANDED: SCREEN_HEIGHT * 0.85,   // Show 85% of sheet (almost full, leave room for status bar)
};

export default function RouteDetailScreen({ route, navigation }: any) {
    const { theme, isDark } = useAppTheme();
    const { user } = useAuth();
    const { routeId, routeData, smartRouteData } = route.params || {};
    const [activeRoute, setActiveRoute] = useState<any>(routeData || null);
    const [smartRoute, setSmartRoute] = useState<SmartRouteResult | null>(smartRouteData || null);
    const [selectedOption, setSelectedOption] = useState<RouteOption | null>(null);
    const [isSaved, setIsSaved] = useState(false);
    const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
    const [showSmartOptions, setShowSmartOptions] = useState(true);
    const [selectedTransportMode, setSelectedTransportMode] = useState<TransportMode | undefined>(undefined);
    const [isRaining, setIsRaining] = useState(false);
    const [isFuelScarce, setIsFuelScarce] = useState(false);
    const [canScroll, setCanScroll] = useState(false);

    // Incident intelligence
    const [routeIncidents, setRouteIncidents]   = useState<ScoredIncident[]>([]);
    const [rerouteDecision, setRerouteDecision] = useState<RerouteDecision>('none');
    const [incidentDismissed, setIncidentDismissed] = useState(false);
    const [reroutingActive, setReroutingActive] = useState(false);

    // Bottom sheet animation
    const sheetHeight = useRef(new Animated.Value(SNAP_POINTS.COLLAPSED)).current;
    const currentSnapPoint = useRef(SNAP_POINTS.COLLAPSED);
    const scrollRef = useRef<ScrollView>(null);

    const dragBaseRef = useRef(SNAP_POINTS.COLLAPSED);

    const snapTo = (target: number) => {
        currentSnapPoint.current = target;
        setCanScroll(target === SNAP_POINTS.EXPANDED);
        Animated.spring(sheetHeight, {
            toValue: target,
            friction: 8,
            tension: 50,
            useNativeDriver: false,
        }).start();
    };

    const onSheetGestureEvent = ({ nativeEvent }: any) => {
        const next = Math.max(
            SNAP_POINTS.COLLAPSED,
            Math.min(SNAP_POINTS.EXPANDED, dragBaseRef.current - nativeEvent.translationY)
        );
        sheetHeight.setValue(next);
    };

    const onSheetHandlerStateChange = ({ nativeEvent }: any) => {
        if (nativeEvent.state === GestureState.BEGAN) {
            sheetHeight.stopAnimation();
            dragBaseRef.current = currentSnapPoint.current;
        }
        if (nativeEvent.oldState === GestureState.ACTIVE) {
            const vy  = nativeEvent.velocityY;
            const cur = dragBaseRef.current - nativeEvent.translationY;
            if (vy < -500) {
                snapTo(SNAP_POINTS.EXPANDED);
            } else if (vy > 500) {
                snapTo(SNAP_POINTS.COLLAPSED);
            } else {
                const pts = [SNAP_POINTS.COLLAPSED, SNAP_POINTS.HALF, SNAP_POINTS.EXPANDED];
                snapTo(pts.reduce((a, b) => Math.abs(cur - a) < Math.abs(cur - b) ? a : b));
            }
        }
    };

    useEffect(() => {
        if (!activeRoute && routeId) {
            loadRoute(routeId);
        } else if (activeRoute) {
            checkIfSaved();
            checkRouteIncidents();
            // Start in COLLAPSED so the map is visible; user swipes up to expand
            Animated.spring(sheetHeight, {
                toValue: SNAP_POINTS.COLLAPSED,
                friction: 8,
                tension: 50,
                useNativeDriver: false,
            }).start();
            currentSnapPoint.current = SNAP_POINTS.COLLAPSED;
            setCanScroll(false);
        }
    }, [routeId, activeRoute]);

    const checkRouteIncidents = async () => {
        const option =
            smartRoute?.options.find((o) => o.id === smartRoute.recommendedOptionId) ??
            smartRoute?.options[0];
        if (!option) return;
        const all = await getActiveIncidents();
        const onRoute = getIncidentsOnRoute(option.legs, all);
        setRouteIncidents(onRoute);
        setRerouteDecision(getRerouteDecision(onRoute));
    };

    const handleReroute = async () => {
        const option =
            smartRoute?.options.find((o) => o.id === smartRoute.recommendedOptionId) ??
            smartRoute?.options[0];
        if (!option || routeIncidents.length === 0) return;
        setReroutingActive(true);
        try {
            const avoidPoints = routeIncidents.map((i) => ({
                latitude:  i.latitude,
                longitude: i.longitude,
                radiusKm:  i.avoidRadiusKm,
            }));
            const result = await searchRoutes({
                origin:      activeRoute.origin_coords,
                destination: activeRoute.destination_coords,
                destinationName: activeRoute.destination,
                avoidPoints,
            });
            if (result?.smartRoute) {
                setSmartRoute(result.smartRoute);
                setActiveRoute((prev: any) => ({ ...prev, ...result.legacyRoute }));
                setRouteIncidents([]);
                setRerouteDecision('none');
                setIncidentDismissed(false);
            }
        } catch {}
        setReroutingActive(false);
    };

    // Expand sheet to full height
    const expandSheet = () => {
        currentSnapPoint.current = SNAP_POINTS.EXPANDED;
        setCanScroll(true);
        Animated.spring(sheetHeight, {
            toValue: SNAP_POINTS.EXPANDED,
            friction: 8,
            tension: 50,
            useNativeDriver: false,
        }).start();
    };

    // Collapse sheet to minimum
    const collapseSheet = () => {
        currentSnapPoint.current = SNAP_POINTS.COLLAPSED;
        setCanScroll(false);
        Animated.spring(sheetHeight, {
            toValue: SNAP_POINTS.COLLAPSED,
            friction: 8,
            tension: 50,
            useNativeDriver: false,
        }).start();
    };

    const loadRoute = async (id: number) => {
        try {
            const data = await getRoute(id);
            setActiveRoute(data);
        } catch (e) {
            console.log('Error loading route', e);
        }
    };

    const checkIfSaved = async () => {
        if (!user) return;
        try {
            const saved = await getSavedRoutes(user.id);
            const match = saved.find(
                (s) =>
                    s.origin_name === (activeRoute?.origin ?? smartRoute?.origin.name) &&
                    s.destination_name === (activeRoute?.destination ?? smartRoute?.destination.name)
            );
            if (match) { setIsSaved(true); setSavedRouteId(match.id); }
        } catch (e) {
            console.log('checkIfSaved error', e);
        }
    };

    const saveJourney = async () => {
        if (!user || !activeRoute) return;
        try {
            if (!isSaved) {
                const saved = await saveRoute(user.id, activeRoute, smartRoute, selectedOption);
                if (saved) { setIsSaved(true); setSavedRouteId(saved.id); }
            } else if (savedRouteId) {
                await deleteSavedRoute(savedRouteId);
                setIsSaved(false);
                setSavedRouteId(null);
            }
        } catch (e) {
            console.log('saveJourney error', e);
        }
    };

    const handleTransportModeSelect = (mode: TransportMode, priceRange: any) => {
        setSelectedTransportMode(mode);
        // In a real app, you might want to update the route with the selected mode and price
        console.log(`Selected ${mode} with estimated fare: ${priceRange.formatted}`);
    };

    const applyRouteOptionToActiveRoute = (option: RouteOption) => {
        setSelectedOption(option);
        setActiveRoute((prev: any) => ({
            ...prev,
            total_duration_mins: option.totalDurationMins,
            total_distance_km: option.totalDistanceKm,
            total_fare: option.totalPriceMax,
            segments: option.legs.map((leg, index) => ({
                id: index + 1,
                mode: leg.mode.toUpperCase(),
                instruction: leg.instruction,
                duration_mins: leg.durationMins,
                distance_km: leg.distanceKm,
                fare: leg.priceMax,
                from_stop: leg.from.name,
                to_stop: leg.to.name,
            })),
        }));
    };

    const startJourney = async (option?: RouteOption) => {
        const optionToStart = option
            || selectedOption
            || smartRoute?.options.find((o) => o.id === smartRoute.recommendedOptionId)
            || smartRoute?.options[0]
            || null;

        if (optionToStart) {
            applyRouteOptionToActiveRoute(optionToStart);
        }

        // Auto-save to route history
        if (user && activeRoute) {
            addRouteHistory(user.id, activeRoute, smartRoute, optionToStart).catch(() => {});
        }

        if (optionToStart) {
            navigation.navigate('Navigation', {
                option: optionToStart,
                destinationName: smartRoute?.destination.name ?? activeRoute?.destination ?? 'Destination',
            });
        }
    };

    if (!activeRoute) {
        return (
            <View style={styles.loadingContainer}>
                <Text>Loading route...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style={isDark ? 'light' : 'dark'} />

            {/* Full Screen Map */}
            <View style={styles.mapContainer}>
                <WakaWayMapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={{
                        latitude: activeRoute.origin_coords?.latitude ?? 6.5244,
                        longitude: activeRoute.origin_coords?.longitude ?? 3.3792,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    markers={[
                        { id: 'origin', coordinate: activeRoute.origin_coords, title: 'Start', icon: 'location' },
                        { id: 'destination', coordinate: activeRoute.destination_coords, title: 'Destination', icon: 'flag' }
                    ]}
                    routePolyline={
                        activeRoute.origin_coords && activeRoute.destination_coords
                            ? [activeRoute.origin_coords, activeRoute.destination_coords]
                            : undefined
                    }
                    directions={{
                        origin: activeRoute.origin_coords,
                        destination: activeRoute.destination_coords,
                        apikey: GOOGLE_MAPS_API_KEY,
                    }}
                />

                {/* Header Gradient */}
                <LinearGradient
                    colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0.15)', 'transparent']}
                    style={styles.headerGradient}
                />

                {/* Back Button + Destination label */}
                <SafeAreaView style={styles.safeAreaProps}>
                    <View style={styles.mapHeaderRow}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
                        >
                            <Ionicons name="chevron-back" size={22} color="white" />
                        </TouchableOpacity>
                        {(smartRoute?.destination.name || activeRoute?.destination) ? (
                            <View style={styles.destinationPill}>
                                <Ionicons name="location" size={13} color="#22C55E" />
                                <Text style={styles.destinationPillText} numberOfLines={1}>
                                    {smartRoute?.destination.name ?? activeRoute?.destination}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </SafeAreaView>
            </View>

            {/* Draggable Bottom Sheet */}
            <Animated.View 
                style={[
                    styles.bottomSheet,
                    { 
                        backgroundColor: theme.CARD_BACKGROUND,
                        height: sheetHeight,
                    }
                ]}
            >
                {/* Drag Handle */}
                <PanGestureHandler onGestureEvent={onSheetGestureEvent} onHandlerStateChange={onSheetHandlerStateChange}>
                    <Animated.View style={styles.dragHandleArea}>
                        <TouchableOpacity
                            onPress={() => {
                                if (currentSnapPoint.current === SNAP_POINTS.EXPANDED) {
                                    collapseSheet();
                                } else {
                                    expandSheet();
                                }
                            }}
                            activeOpacity={1}
                            style={styles.dragHandleTouchArea}
                        >
                            <View style={[styles.dragHandle, { backgroundColor: 'rgba(255,255,255,0.2)' }]} />
                        </TouchableOpacity>
                    </Animated.View>
                </PanGestureHandler>

                {/* Content area — pan gesture active only when not fullscreen */}
                <PanGestureHandler
                    enabled={!canScroll}
                    onHandlerStateChange={({ nativeEvent }) => {
                        if (nativeEvent.oldState === GestureState.ACTIVE) {
                            snapTo(SNAP_POINTS.EXPANDED);
                        }
                    }}
                >
                <Animated.View style={{ flex: 1 }}>
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.sheetContentContainer}
                        showsVerticalScrollIndicator={canScroll}
                        scrollEnabled={canScroll}
                        bounces={canScroll}
                        nestedScrollEnabled={true}
                    >
                    {/* ── Incident alert banner ───────────────────────── */}
                    {rerouteDecision !== 'none' && !incidentDismissed && (
                        <View style={[
                            styles.incidentBanner,
                            { borderLeftColor: incidentColor(rerouteDecision), backgroundColor: incidentColor(rerouteDecision) + '18' },
                        ]}>
                            <View style={styles.incidentBannerLeft}>
                                <Text style={[styles.incidentIcon]}>
                                    {rerouteDecision === 'auto' ? '🚨' : rerouteDecision === 'suggest' ? '⚠️' : 'ℹ️'}
                                </Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.incidentTitle, { color: incidentColor(rerouteDecision) }]}>
                                        {rerouteDecision === 'auto'    ? 'Heavy traffic on your route'   :
                                         rerouteDecision === 'suggest' ? 'Congestion reported ahead'     :
                                         'Minor incident near your route'}
                                    </Text>
                                    <Text style={styles.incidentSub} numberOfLines={2}>
                                        {incidentSummaryText(routeIncidents)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.incidentActions}>
                                {(rerouteDecision === 'auto' || rerouteDecision === 'suggest') && (
                                    <TouchableOpacity
                                        style={[styles.rerouteBtn, { backgroundColor: incidentColor(rerouteDecision) }]}
                                        onPress={handleReroute}
                                        disabled={reroutingActive}
                                    >
                                        {reroutingActive
                                            ? <ActivityIndicator size="small" color="#fff" />
                                            : <Text style={styles.rerouteBtnText}>Reroute</Text>
                                        }
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setIncidentDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Ionicons name="close" size={18} color={theme.TEXT_SECONDARY} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Smart Route Options - Show multiple route choices */}
                    {smartRoute && showSmartOptions ? (
                        <SmartRouteOptions
                            routeResult={smartRoute}
                            onSelectOption={(option) => {
                                applyRouteOptionToActiveRoute(option);
                            }}
                            onStartJourney={(option) => {
                                startJourney(option);
                            }}
                        />
                    ) : (
                        <>
                            {/* Legacy Summary Header */}
                            <View style={styles.summaryContainer}>
                                <View style={styles.routeHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                                        <Text style={[styles.routeTitle, { color: theme.TEXT }]}>{activeRoute.origin || 'Origin'}</Text>
                                        <Ionicons name="arrow-forward" size={16} color={theme.TEXT} style={{ marginHorizontal: 8 }} />
                                        <Text style={[styles.routeTitle, { color: theme.TEXT }]}>{activeRoute.destination || 'Destination'}</Text>
                                    </View>
                                    <View style={[styles.ratingContainer, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                                        <Ionicons name="star" size={14} color="#F59E0B" />
                                        <Text style={[styles.ratingText, { color: theme.TEXT }]}>{activeRoute.rating}</Text>
                                    </View>
                                </View>

                                <View style={[styles.statsRow, { backgroundColor: theme.SURFACE }]}>
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statLabel, { color: theme.TEXT_SECONDARY }]}>Duration</Text>
                                        <Text style={[styles.statValue, { color: theme.TEXT }]}>{activeRoute.total_duration_mins} min</Text>
                                    </View>
                                    <View style={[styles.divider, { backgroundColor: theme.BORDER }]} />
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statLabel, { color: theme.TEXT_SECONDARY }]}>Distance</Text>
                                        <Text style={[styles.statValue, { color: theme.TEXT }]}>{activeRoute.total_distance_km} km</Text>
                                    </View>
                                </View>

                                {/* Fare Estimates */}
                                <FareEstimateCard
                                    distanceInKm={activeRoute.total_distance_km}
                                    isRaining={isRaining}
                                    isFuelScarce={isFuelScarce}
                                    onModeSelect={handleTransportModeSelect}
                                    selectedMode={selectedTransportMode}
                                />

                                {/* Tags */}
                                <View style={styles.tagsRow}>
                                    {activeRoute.is_fastest && (
                                        <View style={[styles.tag, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                                            <Text style={[styles.tagText, { color: theme.SUCCESS }]}>Fastest</Text>
                                        </View>
                                    )}
                                    {activeRoute.is_cheapest && (
                                        <View style={[styles.tag, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                                            <Text style={[styles.tagText, { color: '#60A5FA' }]}>Cheapest</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.sectionDivider, { backgroundColor: theme.BORDER }]} />

                            {/* Steps List */}
                            <View style={styles.stepsContainer}>
                                <Text style={[styles.stepsTitle, { color: theme.TEXT }]}>Directions</Text>
                                {activeRoute.segments?.map((step: any, index: number) => (
                                    <RouteStepCard
                                        key={step.id}
                                        step={step}
                                        isLast={index === activeRoute.segments.length - 1}
                                    />
                                ))}
                            </View>
                        </>
                    )}

                    {/* Spacer for safe area */}
                    <View style={{ height: 100 }} />
                    </ScrollView>
                </Animated.View>
                </PanGestureHandler>
            </Animated.View>

            {/* Bottom action bar — hide Start Journey when SmartRouteOptions shows its own */}
            {!(smartRoute && showSmartOptions) && (
                <View style={[styles.fabContainer, { backgroundColor: theme.CARD_BACKGROUND, borderTopColor: theme.BORDER }]}>
                    <TouchableOpacity
                        style={[styles.saveFab, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.BORDER }]}
                        onPress={saveJourney}
                        accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}
                    >
                        <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={22} color={isSaved ? '#EF4444' : theme.TEXT_SECONDARY} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.fab, { backgroundColor: theme.PRIMARY }]}
                        onPress={() => startJourney()}
                    >
                        <Ionicons name="navigate" size={18} color="#fff" />
                        <Text style={styles.fabText}>Start Journey</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mapHeader: {
        height: '35%',
        width: '100%',
        position: 'relative',
    },
    headerGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    safeAreaProps: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 36 : 6,
        left: 0,
        right: 0,
    },
    mapHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        gap: 12,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    destinationPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxWidth: 240,
    },
    destinationPillText: {
        color: '#F1F5F9',
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: -0.2,
    },
    detailsSheet: {
        flex: 1,
        borderTopLeftRadius: BORDER_RADIUS.XL,
        borderTopRightRadius: BORDER_RADIUS.XL,
        marginTop: -20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: { elevation: 10 },
        }),
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: SPACING.SM,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
    },
    handleText: {
        fontSize: FONT_SIZES.SMALL,
        fontWeight: '500',
        marginTop: 4,
    },
    contentContainer: {
        paddingHorizontal: SPACING.LG,
    },
    mapContainer: {
        flex: 1,
    },
    swipeIndicator: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    swipeText: {
        fontSize: FONT_SIZES.SMALL,
        fontWeight: '600',
        marginTop: 4,
    },
    directionsSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: BORDER_RADIUS.XL,
        borderTopRightRadius: BORDER_RADIUS.XL,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: { elevation: 10 },
        }),
    },
    directionsSheetExpanded: {
        top: '35%',
    },
    directionsSheetCollapsed: {
        top: 0,
        height: 120, // Just show the handle area when collapsed
    },
    summaryContainer: {
        marginTop: SPACING.SM,
    },
    routeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: SPACING.MD,
    },
    routeTitle: {
        fontSize: FONT_SIZES.HEADING_3,
        fontWeight: '700',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    ratingText: {
        fontSize: FONT_SIZES.CAPTION,
        fontWeight: '700',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.MD,
        borderRadius: BORDER_RADIUS.LARGE,
    },
    statItem: {
        alignItems: 'center',
    },
    statLabel: {
        fontSize: FONT_SIZES.CAPTION,
        marginBottom: 4,
    },
    statValue: {
        fontSize: FONT_SIZES.BODY_LARGE,
        fontWeight: '700',
    },
    divider: {
        width: 1,
        height: 24,
    },
    tagsRow: {
        flexDirection: 'row',
        gap: SPACING.SM,
        marginTop: SPACING.MD,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    tagText: {
        fontSize: FONT_SIZES.SMALL,
        fontWeight: '600',
    },
    sectionDivider: {
        height: 1,
        marginVertical: SPACING.LG,
    },
    stepsContainer: {
        marginBottom: SPACING.LG,
    },
    stepsTitle: {
        fontSize: FONT_SIZES.HEADING_3,
        fontWeight: '700',
        marginBottom: SPACING.MD,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: Platform.OS === 'ios' ? 32 : 18,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    saveFab: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        flexShrink: 0,
    },
    fab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 50,
        borderRadius: 25,
        ...Platform.select({
            ios: {
                shadowColor: '#22C55E',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.35,
                shadowRadius: 10,
            },
            android: { elevation: 6 },
        }),
    },
    fabText: {
        fontWeight: '700',
        fontSize: 16,
        color: '#fff',
        letterSpacing: -0.2,
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.07)',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -6 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
            },
            android: { elevation: 20 },
        }),
    },
    dragHandleArea: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 4,
    },
    dragHandleTouchArea: {
        alignItems: 'center',
        paddingHorizontal: 48,
        paddingVertical: 8,
    },
    dragHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    sheetContent: {
        flex: 1,
    },
    sheetContentContainer: {
        paddingBottom: 120,
    },

    // Incident banner
    incidentBanner: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 12,
        borderLeftWidth: 4,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
    },
    incidentBannerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    incidentIcon:  { fontSize: 20, marginTop: 1 },
    incidentTitle: { fontSize: 13, fontWeight: '700', marginBottom: 3 },
    incidentSub:   { fontSize: 12, color: '#94A3B8', lineHeight: 16 },
    incidentActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    rerouteBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        minWidth: 70,
        alignItems: 'center',
    },
    rerouteBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
