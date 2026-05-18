import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { Typography } from '../theme/typography';
import type { RouteOption, RouteLeg } from '../services/smartRoutingService';
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

const ADVANCE_THRESHOLD_M = 80;
const PEEK_HEIGHT = 72;

// Critically damped spring — no bounce, smooth deceleration
const SPRING = { tension: 100, friction: 20, useNativeDriver: true } as const;

const DARK_MAP_STYLE = [
  { elementType: 'geometry',           stylers: [{ color: '#0f172a' }] },
  { elementType: 'labels.icon',        stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#94a3b8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
  { featureType: 'road',               elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
  { featureType: 'road.arterial',      elementType: 'geometry', stylers: [{ color: '#243044' }] },
  { featureType: 'road.highway',       elementType: 'geometry', stylers: [{ color: '#334155' }] },
  { featureType: 'water',              elementType: 'geometry', stylers: [{ color: '#0c1322' }] },
  { featureType: 'poi',                stylers: [{ visibility: 'off' }] },
  { featureType: 'transit',            stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative',     elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
];

const LEG_COLORS: Record<string, string> = {
  walk:  '#29B6F6',
  keke:  '#FFA726',
  okada: '#FF7043',
  danfo: '#FFCA28',
  brt:   '#26A69A',
  ferry: '#1E88E5',
  rail:  '#AB47BC',
  uber:  '#1C1C1C',
  bolt:  '#34C759',
};

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

function modeIcon(mode?: string): any {
  const icons: Record<string, string> = {
    walk: 'walk', keke: 'car', okada: 'bicycle',
    danfo: 'bus', brt: 'bus', ferry: 'boat', rail: 'train',
  };
  return icons[mode ?? ''] ?? 'navigate';
}

type Coord = { latitude: number; longitude: number };

export default function NavigationScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { option, destinationName } = route.params as {
    option: RouteOption;
    destinationName: string;
  };

  const legs: RouteLeg[] = option.legs;
  const mapRef = useRef<MapView>(null);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const currentLegRef = useRef(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sheetY = useRef(new Animated.Value(0)).current;
  const sheetHeightRef = useRef(200);
  const gestureStartY = useRef(0);

  const expandSheet = (velocity = 0) => {
    Animated.spring(sheetY, { toValue: 0, velocity, ...SPRING }).start();
  };

  const collapseSheet = (velocity = 0) => {
    Animated.spring(sheetY, {
      toValue: sheetHeightRef.current - PEEK_HEIGHT,
      velocity,
      ...SPRING,
    }).start();
  };

  const sheetPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        gestureStartY.current = (sheetY as any)._value;
      },
      onPanResponderMove: (_, g) => {
        const maxY = sheetHeightRef.current - PEEK_HEIGHT;
        sheetY.setValue(Math.max(0, Math.min(maxY, gestureStartY.current + g.dy)));
      },
      onPanResponderRelease: (_, g) => {
        const maxY = sheetHeightRef.current - PEEK_HEIGHT;
        const current = (sheetY as any)._value;
        // Pass gesture velocity into the spring so it continues from finger speed
        if (g.vy < -0.3 || g.dy < -30) {
          expandSheet(g.vy * 1000);
        } else if (g.vy > 0.3 || g.dy > 30) {
          collapseSheet(g.vy * 1000);
        } else {
          current < maxY / 2 ? expandSheet() : collapseSheet();
        }
      },
    })
  ).current;

  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<Coord | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);

  // Live incident intelligence
  const [liveIncidents, setLiveIncidents]       = useState<ScoredIncident[]>([]);
  const [liveDecision, setLiveDecision]         = useState<RerouteDecision>('none');
  const [incidentDismissed, setIncidentDismissed] = useState(false);
  const [reroutingLive, setReroutingLive]       = useState(false);
  const [activeLeg, setActiveLeg]               = useState(option);
  const activeLegRef = useRef(option);
  const incidentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentLeg = legs[currentLegIndex];
  const nextLeg = legs[currentLegIndex + 1];
  const remainingMins = legs
    .slice(currentLegIndex)
    .reduce((sum, l) => sum + l.durationMins, 0);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Poll for incidents on remaining legs every 90 seconds
  useEffect(() => {
    const checkIncidents = async () => {
      const remainingLegs = activeLegRef.current.legs.slice(currentLegRef.current);
      if (remainingLegs.length === 0) return;
      const all     = await getActiveIncidents();
      const onRoute = getIncidentsOnRoute(remainingLegs, all);
      const decision = getRerouteDecision(onRoute);
      setLiveIncidents(onRoute);
      setLiveDecision(decision);
      // Auto-reroute without asking for high-confidence incidents
      if (decision === 'auto' && !incidentDismissed) {
        doLiveReroute(onRoute);
      }
    };

    checkIncidents();
    incidentPollRef.current = setInterval(checkIncidents, 90_000);
    return () => {
      if (incidentPollRef.current) clearInterval(incidentPollRef.current);
    };
  }, []);

  const doLiveReroute = async (incidents: ScoredIncident[]) => {
    if (reroutingLive || incidents.length === 0) return;
    setReroutingLive(true);
    try {
      const firstLeg  = activeLegRef.current.legs[0];
      const lastLeg   = activeLegRef.current.legs[activeLegRef.current.legs.length - 1];
      const avoidPoints = incidents.map((i) => ({
        latitude:  i.latitude,
        longitude: i.longitude,
        radiusKm:  i.avoidRadiusKm,
      }));
      const result = await searchRoutes({
        origin:          { latitude: firstLeg.from.latitude,  longitude: firstLeg.from.longitude },
        destination:     { latitude: lastLeg.to.latitude,     longitude: lastLeg.to.longitude },
        destinationName: destinationName,
        avoidPoints,
      });
      if (result?.smartRoute) {
        const newOption =
          result.smartRoute.options.find((o) => o.id === result.smartRoute.recommendedOptionId) ??
          result.smartRoute.options[0];
        if (newOption) {
          activeLegRef.current = newOption;
          setActiveLeg(newOption);
          setLiveIncidents([]);
          setLiveDecision('none');
          setIncidentDismissed(false);
        }
      }
    } catch {}
    setReroutingLive(false);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      locationSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 5000 },
        (loc) => {
          const coord: Coord = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserCoords(coord);

          const legIdx = currentLegRef.current;
          const leg = legs[legIdx];
          if (!leg) return;

          const dist = haversineMeters(
            coord.latitude, coord.longitude,
            leg.to.latitude, leg.to.longitude,
          );
          setDistanceToNext(dist);

          if (dist < ADVANCE_THRESHOLD_M) {
            if (legIdx >= legs.length - 1) {
              setArrived(true);
              locationSubRef.current?.remove();
            } else {
              currentLegRef.current = legIdx + 1;
              setCurrentLegIndex(legIdx + 1);
            }
          }

          mapRef.current?.animateToRegion(
            { ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 },
            600,
          );
        },
      );
    })();

    return () => locationSubRef.current?.remove();
  }, []);

  const endJourney = () => {
    locationSubRef.current?.remove();
    navigation.goBack();
  };

  const legColor = (i: number) =>
    i < currentLegIndex
      ? '#bbb'
      : `${LEG_COLORS[legs[i].mode] ?? Colors.blue}${i === currentLegIndex ? '' : '88'}`;

  return (
    <View style={styles.container}>
      {/* Full-screen dark map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        onPress={() => collapseSheet()}
        initialRegion={{
          latitude: legs[0]?.from.latitude ?? 6.5244,
          longitude: legs[0]?.from.longitude ?? 3.3792,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {legs.map((leg, i) => (
          <Polyline
            key={i}
            coordinates={[
              { latitude: leg.from.latitude, longitude: leg.from.longitude },
              { latitude: leg.to.latitude, longitude: leg.to.longitude },
            ]}
            strokeWidth={i === currentLegIndex ? 7 : 4}
            strokeColor={legColor(i)}
          />
        ))}

        {legs.map((leg, i) => {
          const isCurrent = i === currentLegIndex;
          const isFinal = i === legs.length - 1;
          return (
            <Marker
              key={`wp-${i}`}
              coordinate={{ latitude: leg.to.latitude, longitude: leg.to.longitude }}
              title={leg.to.name}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View
                style={[
                  styles.waypointDot,
                  isFinal && styles.waypointFinal,
                  isCurrent && !isFinal && styles.waypointCurrent,
                ]}
              />
            </Marker>
          );
        })}

        {userCoords && (
          <Marker coordinate={userCoords} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.userOuter}>
              <Animated.View
                style={[styles.userPulse, { transform: [{ scale: pulseAnim }] }]}
              />
              <View style={styles.userDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Live incident banner */}
      {liveDecision !== 'none' && !incidentDismissed && (
        <View style={[
          styles.incidentBanner,
          { top: insets.top + 8, borderLeftColor: incidentColor(liveDecision), backgroundColor: incidentColor(liveDecision) + '22' },
        ]}>
          <Text style={styles.incidentBannerIcon}>
            {liveDecision === 'auto' ? '🚨' : liveDecision === 'suggest' ? '⚠️' : 'ℹ️'}
          </Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.incidentBannerTitle, { color: incidentColor(liveDecision) }]}>
              {liveDecision === 'auto' ? 'Rerouting around traffic...' :
               liveDecision === 'suggest' ? 'Congestion ahead' : 'Incident near route'}
            </Text>
            <Text style={styles.incidentBannerSub} numberOfLines={1}>
              {incidentSummaryText(liveIncidents)}
            </Text>
          </View>
          {liveDecision === 'suggest' && (
            <TouchableOpacity
              style={[styles.incidentRerouteBtn, { backgroundColor: incidentColor(liveDecision) }]}
              onPress={() => doLiveReroute(liveIncidents)}
              disabled={reroutingLive}
            >
              {reroutingLive
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.incidentRerouteTxt}>Avoid</Text>}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setIncidentDismissed(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Top: back button + instruction card */}
      <View style={[styles.topArea, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={endJourney}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {!arrived && currentLeg && (
          <View
            style={[
              styles.instructionCard,
              { backgroundColor: LEG_COLORS[currentLeg.mode] ?? Colors.blue },
            ]}
          >
            <View style={styles.instructionRow}>
              <View style={styles.modeIcon}>
                <Ionicons name={modeIcon(currentLeg.mode)} size={22} color="#fff" />
              </View>
              <Text style={styles.instructionText} numberOfLines={2}>
                {currentLeg.instruction}
              </Text>
            </View>

            <View style={styles.instructionMeta}>
              {distanceToNext != null && (
                <Text style={styles.metaText}>{formatDist(distanceToNext)} to next stop</Text>
              )}
              <Text style={styles.metaText}>
                Step {currentLegIndex + 1} / {legs.length}
              </Text>
            </View>

            {nextLeg && (
              <View style={styles.nextRow}>
                <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.nextText} numberOfLines={1}>
                  Then: {nextLeg.instruction}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Arrived overlay */}
      {arrived && (
        <View style={styles.arrivedOverlay}>
          <View style={styles.arrivedCard}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.blue} />
            <Text style={styles.arrivedTitle}>You've arrived!</Text>
            <Text style={styles.arrivedSub}>{destinationName}</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={endJourney}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bottom sheet */}
      {!arrived && (
        <Animated.View
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 8,
              transform: [{ translateY: sheetY }],
            },
          ]}
          onLayout={(e) => { sheetHeightRef.current = e.nativeEvent.layout.height; }}
        >
          {/* Drag handle */}
          <View {...sheetPan.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragPill} />
          </View>

          <View style={styles.bottomContent}>
            <View style={styles.bottomLeft}>
              <Text style={styles.bottomDest} numberOfLines={1}>{destinationName}</Text>
              <Text style={styles.bottomTime}>~{remainingMins} min remaining</Text>
            </View>
            <TouchableOpacity style={styles.endBtn} onPress={endJourney}>
              <Text style={styles.endBtnText}>End journey</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.mapBackground },
  topArea: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.border,
  },
  instructionCard: {
    borderRadius: 16,
    padding: 16,
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 8 },
    }),
  },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modeIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  instructionText: { color: '#fff', fontSize: Typography.lg, fontWeight: Typography.bold, flex: 1 },
  instructionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.sm },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  nextText: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.sm, flex: 1 },
  waypointDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#999', borderWidth: 2, borderColor: '#fff',
  },
  waypointCurrent: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B00' },
  waypointFinal: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444' },
  userOuter: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  userPulse: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.blueLight,
  },
  userDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.blue, borderWidth: 3, borderColor: '#fff',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.sheetBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 14 },
    }),
  },
  dragHandleArea: {
    width: '100%', paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  dragPill: { width: 36, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  bottomContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 4,
  },
  bottomLeft: { flex: 1, marginRight: 16 },
  bottomDest: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  bottomTime: { fontSize: Typography.sm, marginTop: 2, color: Colors.textSecondary },
  endBtn: {
    borderWidth: 1.5, borderRadius: 10, borderColor: '#EF4444',
    paddingHorizontal: 16, paddingVertical: 8,
  },
  endBtnText: { fontWeight: Typography.bold, fontSize: Typography.md, color: '#EF4444' },
  arrivedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.scrim,
    justifyContent: 'center', alignItems: 'center',
    padding: 24,
  },
  arrivedCard: {
    width: '100%', borderRadius: 20,
    backgroundColor: Colors.sheetBg,
    borderWidth: 1, borderColor: Colors.border,
    padding: 32, alignItems: 'center', gap: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  arrivedTitle: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  arrivedSub: { fontSize: Typography.lg, textAlign: 'center', color: Colors.textSecondary },
  doneBtn: {
    paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 30, marginTop: 8, backgroundColor: Colors.blue,
  },
  doneBtnText: { color: '#fff', fontWeight: Typography.bold, fontSize: Typography.lg },

  // Live incident banner (floats over map, below status bar)
  incidentBanner: {
    position: 'absolute',
    left: 12, right: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
      android: { elevation: 10 },
    }),
  },
  incidentBannerIcon:  { fontSize: 18 },
  incidentBannerTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  incidentBannerSub:   { fontSize: 11, color: Colors.textSecondary },
  incidentRerouteBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, minWidth: 54, alignItems: 'center' },
  incidentRerouteTxt:  { color: '#fff', fontSize: 12, fontWeight: '700' },
});
