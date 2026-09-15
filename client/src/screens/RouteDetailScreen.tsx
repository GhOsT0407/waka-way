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
import { StatusBar } from 'expo-status-bar';
import { WakaWayMapView } from '../components/map/MapView';
import { RouteStepCard } from '../components/RouteStepCard';
import { FareEstimateCard } from '../components/FareEstimateCard';
import { SmartRouteOptions } from '../components/SmartRouteOptions';
import { Fonts, Typography } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import { getRoute } from '../services/api';
import type { TransportMode } from '../types/routing';
import { SmartRouteResult, RouteOption } from '../services/smartRoutingService';
import { addRouteHistory, saveRoute, deleteSavedRoute, getSavedRoutes } from '../services/supabaseDataService';
import FareDisputeModal from '../components/FareDisputeModal';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bottom sheet snap points
const SNAP_POINTS = {
    COLLAPSED: SCREEN_HEIGHT * 0.25,  // Show 25% of sheet (minimal peek for map view)
    HALF: SCREEN_HEIGHT * 0.5,        // Show 50% of sheet
    EXPANDED: SCREEN_HEIGHT * 0.85,   // Show 85% of sheet (almost full, leave room for status bar)
};

export default function RouteDetailScreen({ route, navigation }: any) {
    const { WW, isDark } = useAppTheme();
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

    // Fare dispute
    const [disputeVisible, setDisputeVisible] = useState(false);

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
            console.error('Error loading route', e);
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
        } catch {}
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
        } catch {}
    };

    const handleTransportModeSelect = (mode: TransportMode) => {
        setSelectedTransportMode(mode);
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
                />

                {/* Back — 44pt frosted circle; the map is the header now */}
                <SafeAreaView style={styles.safeAreaProps} edges={['top']}>
                    <View style={styles.mapHeaderRow}>
                        <TouchableOpacity
                            style={[styles.backButton, { backgroundColor: WW.frosted }]}
                            onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
                            accessibilityRole="button"
                            accessibilityLabel="Back"
                        >
                            <Ionicons name="chevron-back" size={22} color={WW.text} />
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </View>

            {/* Draggable Bottom Sheet */}
            <Animated.View 
                style={[
                    styles.bottomSheet,
                    {
                        backgroundColor: WW.frosted,
                        borderColor: WW.border,
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
                            <View style={[styles.dragHandle, { backgroundColor: WW.borderStrong }]} />
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
                                        <Text style={[styles.routeTitle, { color: WW.text }]}>{activeRoute.origin || 'Origin'}</Text>
                                        <Ionicons name="arrow-forward" size={16} color={WW.text} style={{ marginHorizontal: 8 }} />
                                        <Text style={[styles.routeTitle, { color: WW.text }]}>{activeRoute.destination || 'Destination'}</Text>
                                    </View>
                                    <View style={[styles.ratingContainer, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                                        <Ionicons name="star" size={14} color="#F59E0B" />
                                        <Text style={[styles.ratingText, { color: WW.text }]}>{activeRoute.rating}</Text>
                                    </View>
                                </View>

                                <View style={[styles.statsRow, { backgroundColor: WW.bgSurface }]}>
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statLabel, { color: WW.textSub }]}>Duration</Text>
                                        <Text style={[styles.statValue, { color: WW.text }]}>{activeRoute.total_duration_mins} min</Text>
                                    </View>
                                    <View style={[styles.divider, { backgroundColor: WW.border }]} />
                                    <View style={styles.statItem}>
                                        <Text style={[styles.statLabel, { color: WW.textSub }]}>Distance</Text>
                                        <Text style={[styles.statValue, { color: WW.text }]}>{activeRoute.total_distance_km} km</Text>
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
                                            <Text style={[styles.tagText, { color: WW.green }]}>Fastest</Text>
                                        </View>
                                    )}
                                    {activeRoute.is_cheapest && (
                                        <View style={[styles.tag, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                                            <Text style={[styles.tagText, { color: '#60A5FA' }]}>Cheapest</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            <View style={[styles.sectionDivider, { backgroundColor: WW.border }]} />

                            {/* Steps List */}
                            <View style={styles.stepsContainer}>
                                <Text style={[styles.stepsTitle, { color: WW.text }]}>Directions</Text>
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

            {/* Bottom action bar — save · fare check · Start */}
            <View style={[styles.fabContainer, { backgroundColor: WW.frosted, borderTopColor: WW.border }]}>
                <TouchableOpacity
                    style={[styles.iconFab, { backgroundColor: WW.bgElevated }]}
                    onPress={saveJourney}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? 'Unsave route' : 'Save route'}
                >
                    <Ionicons name={isSaved ? 'heart' : 'heart-outline'} size={20} color={isSaved ? WW.error : WW.textSub} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.iconFab, { backgroundColor: WW.greenDim }]}
                    onPress={() => setDisputeVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Check correct fare"
                >
                    <Ionicons name="shield-checkmark-outline" size={20} color={WW.green} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.fab, { backgroundColor: WW.text }]}
                    onPress={() => startJourney()}
                    accessibilityRole="button"
                    accessibilityLabel="Start journey"
                >
                    <Text style={[styles.fabText, { color: WW.bg }]}>Start</Text>
                </TouchableOpacity>
            </View>
        {/* Fare Dispute Modal */}
        <FareDisputeModal
            visible={disputeVisible}
            onClose={() => setDisputeVisible(false)}
            origin={smartRoute?.origin.name ?? activeRoute?.origin ?? 'Origin'}
            destination={smartRoute?.destination.name ?? activeRoute?.destination ?? 'Destination'}
            legs={
                (selectedOption ?? smartRoute?.options.find((o) => o.id === smartRoute?.recommendedOptionId) ?? smartRoute?.options[0])?.legs ?? []
            }
            totalMin={
                (selectedOption ?? smartRoute?.options.find((o) => o.id === smartRoute?.recommendedOptionId) ?? smartRoute?.options[0])?.totalPriceMin ?? activeRoute?.total_fare ?? 0
            }
            totalMax={
                (selectedOption ?? smartRoute?.options.find((o) => o.id === smartRoute?.recommendedOptionId) ?? smartRoute?.options[0])?.totalPriceMax ?? activeRoute?.total_fare ?? 0
            }
        />
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
        width: HIT,
        height: HIT,
        borderRadius: Radius.pill,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#14161A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8 },
            android: { elevation: 3 },
        }),
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
        paddingHorizontal: Space.lg,
        paddingTop: Space.md,
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
    iconFab: {
        width: 52,
        height: 52,
        borderRadius: Radius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    fab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: Radius.lg,
    },
    fabText: {
        fontFamily: Fonts.bold,
        fontSize: Typography.lg,
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderLeftWidth: StyleSheet.hairlineWidth,
        borderRightWidth: StyleSheet.hairlineWidth,
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
        height: 5,
        borderRadius: Radius.pill,
    },
    sheetContent: {
        flex: 1,
    },
    sheetContentContainer: {
        paddingBottom: 120,
    },
});
