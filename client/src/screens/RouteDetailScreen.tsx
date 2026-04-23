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
    Alert,
    PanResponder,
} from 'react-native';
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
import { TransportMode } from '../services/pricingEngine';
import { SmartRouteResult, RouteOption } from '../services/smartRoutingService';
import { addRouteHistory, saveRoute, deleteSavedRoute, getSavedRoutes } from '../services/supabaseDataService';

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

    // Bottom sheet animation
    const sheetHeight = useRef(new Animated.Value(SNAP_POINTS.COLLAPSED)).current;
    const currentSnapPoint = useRef(SNAP_POINTS.COLLAPSED);
    const scrollRef = useRef<ScrollView>(null);

    // Pan responder for dragging the sheet
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gestureState) => {
                // Only respond to vertical gestures
                return Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
            },
            onPanResponderGrant: () => {
                // Stop any ongoing animation
                sheetHeight.stopAnimation();
            },
            onPanResponderMove: (_, gestureState) => {
                // Calculate new height based on drag
                const newHeight = currentSnapPoint.current - gestureState.dy;
                // Clamp between collapsed and expanded
                const clampedHeight = Math.max(
                    SNAP_POINTS.COLLAPSED,
                    Math.min(SNAP_POINTS.EXPANDED, newHeight)
                );
                sheetHeight.setValue(clampedHeight);
            },
            onPanResponderRelease: (_, gestureState) => {
                const velocity = gestureState.vy;
                const currentHeight = currentSnapPoint.current - gestureState.dy;
                
                let targetSnap: number;
                
                // Determine target based on velocity and position
                if (velocity < -0.5) {
                    // Fast swipe up - expand
                    targetSnap = SNAP_POINTS.EXPANDED;
                } else if (velocity > 0.5) {
                    // Fast swipe down - collapse
                    targetSnap = SNAP_POINTS.COLLAPSED;
                } else {
                    // Snap to nearest point
                    const distances = [
                        { point: SNAP_POINTS.COLLAPSED, dist: Math.abs(currentHeight - SNAP_POINTS.COLLAPSED) },
                        { point: SNAP_POINTS.HALF, dist: Math.abs(currentHeight - SNAP_POINTS.HALF) },
                        { point: SNAP_POINTS.EXPANDED, dist: Math.abs(currentHeight - SNAP_POINTS.EXPANDED) },
                    ];
                    targetSnap = distances.reduce((a, b) => a.dist < b.dist ? a : b).point;
                }
                
                currentSnapPoint.current = targetSnap;
                setCanScroll(targetSnap === SNAP_POINTS.EXPANDED);
                
                Animated.spring(sheetHeight, {
                    toValue: targetSnap,
                    friction: 8,
                    tension: 50,
                    useNativeDriver: false,
                }).start();
            },
        })
    ).current;

    useEffect(() => {
        if (!activeRoute && routeId) {
            loadRoute(routeId);
        } else if (activeRoute) {
            checkIfSaved();
            // Start at EXPANDED so user can see all content
            Animated.spring(sheetHeight, {
                toValue: SNAP_POINTS.EXPANDED,
                friction: 8,
                tension: 50,
                useNativeDriver: false,
            }).start();
            currentSnapPoint.current = SNAP_POINTS.EXPANDED;
            setCanScroll(true);
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

        setShowSmartOptions(false);
        expandSheet();

        // Auto-save to route history
        if (user && activeRoute) {
            addRouteHistory(user.id, activeRoute, smartRoute, optionToStart).catch(() => {});
        }

        Alert.alert(
            'Journey Started! 🚌',
            'Step-by-step directions are now active. Follow the route below.',
            [{ text: 'OK' }]
        );
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
                    colors={['rgba(0,0,0,0.5)', 'transparent']}
                    style={styles.headerGradient}
                />

                {/* Back Button */}
                <SafeAreaView style={styles.safeAreaProps}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
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
                {/* Drag Handle - Tap to expand/collapse */}
                <TouchableOpacity 
                    onPress={() => {
                        if (currentSnapPoint.current === SNAP_POINTS.EXPANDED) {
                            collapseSheet();
                        } else {
                            expandSheet();
                        }
                    }}
                    activeOpacity={0.8}
                >
                    <View {...panResponder.panHandlers} style={styles.dragHandleArea}>
                        <View style={[styles.dragHandle, { backgroundColor: theme.BORDER }]} />
                        <Text style={[styles.dragHint, { color: theme.TEXT_SECONDARY }]}>
                            {canScroll ? 'Tap to minimize' : 'Tap or swipe up for more'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Scrollable Content - Use flex:1 to fill remaining space */}
                <View style={{ flex: 1 }}>
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.sheetContentContainer}
                        showsVerticalScrollIndicator={true}
                        scrollEnabled={true}
                        bounces={true}
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
                                        <Text style={[styles.routeTitle, { color: theme.TEXT }]}>{activeRoute.origin || 'Origin'}</Text>
                                        <Ionicons name="arrow-forward" size={16} color={theme.TEXT} style={{ marginHorizontal: 8 }} />
                                        <Text style={[styles.routeTitle, { color: theme.TEXT }]}>{activeRoute.destination || 'Destination'}</Text>
                                    </View>
                                    <View style={styles.ratingContainer}>
                                        <Ionicons name="star" size={14} color={theme.ACCENT} />
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
                                        <View style={[styles.tag, { backgroundColor: '#E8F5E9' }]}>
                                            <Text style={[styles.tagText, { color: theme.SUCCESS }]}>Fastest</Text>
                                        </View>
                                    )}
                                    {activeRoute.is_cheapest && (
                                        <View style={[styles.tag, { backgroundColor: '#E3F2FD' }]}>
                                            <Text style={[styles.tagText, { color: theme.INFO }]}>Cheapest</Text>
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
                </View>
            </Animated.View>

            {/* FABs */}
            <View style={styles.fabContainer}>
                <TouchableOpacity style={[styles.saveFab, { backgroundColor: theme.CARD_BACKGROUND }]} onPress={saveJourney}>
                    <Ionicons name={isSaved ? "heart" : "heart-outline"} size={24} color={isSaved ? theme.ERROR : theme.TEXT} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.fab, { backgroundColor: theme.PRIMARY }]} onPress={() => startJourney()}>
                    <Text style={[styles.fabText, { color: theme.CARD_BACKGROUND }]}>Start Journey</Text>
                    <Ionicons name="navigate" size={20} color={theme.CARD_BACKGROUND} />
                </TouchableOpacity>
            </View>
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
        top: Platform.OS === 'android' ? 40 : 10,
        left: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.MD,
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
        backgroundColor: '#FFF8E1',
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
        bottom: 30,
        right: 20,
        alignItems: 'flex-end',
        gap: SPACING.MD,
    },
    saveFab: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 6 },
        }),
    },
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.SM,
        paddingHorizontal: SPACING.XL,
        paddingVertical: SPACING.MD,
        borderRadius: 30,
        ...Platform.select({
            ios: {
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: { elevation: 6 },
        }),
    },
    fabText: {
        fontWeight: '700',
        fontSize: FONT_SIZES.BODY_LARGE,
    },
    bottomSheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        borderTopLeftRadius: BORDER_RADIUS.XL,
        borderTopRightRadius: BORDER_RADIUS.XL,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: { elevation: 16 },
        }),
    },
    dragHandleArea: {
        alignItems: 'center',
        paddingVertical: SPACING.MD,
        paddingHorizontal: SPACING.LG,
    },
    dragHandle: {
        width: 40,
        height: 5,
        borderRadius: 3,
    },
    dragHint: {
        fontSize: FONT_SIZES.SMALL,
        marginTop: SPACING.XS,
    },
    sheetContent: {
        flex: 1,
    },
    sheetContentContainer: {
        paddingBottom: 120,
    },
});
