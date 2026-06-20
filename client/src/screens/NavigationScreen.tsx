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
import MapLibreGL from '@maplibre/maplibre-react-native';
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
import { fetchAllLegGeometries, LatLng } from '../services/directionsService';
import { MAPTILER_DARK_STYLE } from '../utils/constants';
import { WW } from '../theme/colors';

const ADVANCE_THRESHOLD_M = 80;
const PEEK_HEIGHT = 72;
const NAV_ZOOM   = 17;
const NAV_PITCH  = 50;

const SPRING = { tension: 100, friction: 20, useNativeDriver: true } as const;

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

let _smoothedHeading = 0;
function smoothHeading(raw: number): number {
  let diff = raw - _smoothedHeading;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  _smoothedHeading = (_smoothedHeading + 0.25 * diff + 360) % 360;
  return _smoothedHeading;
}

function turnIcon(instruction: string): { name: string; color: string } {
  const t = instruction.toLowerCase();
  if (t.includes('turn left') || t.includes('go left') || t.includes('left at'))
    return { name: 'arrow-back',    color: '#22C55E' };
  if (t.includes('turn right') || t.includes('go right') || t.includes('right at'))
    return { name: 'arrow-forward', color: '#22C55E' };
  if (t.includes('u-turn'))
    return { name: 'return-down-back', color: '#FBBF24' };
  if (t.includes('board') || t.includes('take') || t.includes('enter'))
    return { name: 'arrow-up',      color: '#60A5FA' };
  if (t.includes('exit') || t.includes('alight') || t.includes('get off') || t.includes('owa'))
    return { name: 'exit',          color: '#F97316' };
  return { name: 'arrow-up',        color: '#22C55E' };
}

function formatETA(remainingMins: number): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + remainingMins);
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

type Coord = { latitude: number; longitude: number };

export default function NavigationScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { option, destinationName } = route.params as {
    option: RouteOption;
    destinationName: string;
  };

  const legs: RouteLeg[] = option.legs;
  const cameraRef = useRef<MapLibreGL.Camera>(null);
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
  const [speedKmh, setSpeedKmh]     = useState<number>(0);
  const [isTracking, setIsTracking] = useState(true);
  const [navMode, setNavMode]           = useState<'overview' | 'tracking'>('overview');
  const [legGeometries, setLegGeometries] = useState<(LatLng[] | null)[]>([]);
  const [geometriesLoaded, setGeometriesLoaded] = useState(false);

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

  // Fetch road-following geometry from OpenRouteService
  useEffect(() => {
    (async () => {
      const geometries = await fetchAllLegGeometries(
        legs.map(leg => ({
          from: { latitude: leg.from.latitude, longitude: leg.from.longitude },
          to:   { latitude: leg.to.latitude,   longitude: leg.to.longitude },
          mode: leg.mode,
        }))
      );
      setLegGeometries(geometries);
      setGeometriesLoaded(true);

      // Fit camera to full route once geometry is ready
      const allCoords = geometries.flatMap(g => g ?? []);
      if (allCoords.length > 1 && cameraRef.current) {
        const lngs = allCoords.map(c => c.longitude);
        const lats  = allCoords.map(c => c.latitude);
        cameraRef.current.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          [80, 80, 260, 80],
          500,
        );
      }

      setTimeout(() => setNavMode('tracking'), 3000);
    })();
  }, []);

  // Poll for incidents on remaining legs every 90 seconds
  useEffect(() => {
    const checkIncidents = async () => {
      const remainingLegs = activeLegRef.current.legs.slice(currentLegRef.current);
      if (remainingLegs.length === 0) return;
      const all      = await getActiveIncidents();
      const onRoute  = getIncidentsOnRoute(remainingLegs, all);
      const decision = getRerouteDecision(onRoute);
      setLiveIncidents(onRoute);
      setLiveDecision(decision);
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
        destinationName,
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
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 8, timeInterval: 2000 },
        (loc) => {
          const coord: Coord = {
            latitude:  loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setUserCoords(coord);

          const rawSpeed = loc.coords.speed ?? 0;
          setSpeedKmh(rawSpeed > 0 ? Math.round(rawSpeed * 3.6) : 0);

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

          if (isTracking && navMode === 'tracking') {
            const rawBearing = loc.coords.heading ?? 0;
            const heading    = rawBearing >= 0 ? smoothHeading(rawBearing) : _smoothedHeading;
            cameraRef.current?.setCamera({
              centerCoordinate: [coord.longitude, coord.latitude],
              zoomLevel:        NAV_ZOOM,
              heading,
              pitch:            NAV_PITCH,
              animationDuration: 800,
              animationMode:    'easeTo',
            });
          }
        },
      );
    })();

    return () => locationSubRef.current?.remove();
  }, []);

  const endJourney = () => {
    locationSubRef.current?.remove();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
    }
  };

  const legColor = (i: number) =>
    i < currentLegIndex
      ? '#bbb'
      : `${LEG_COLORS[legs[i].mode] ?? Colors.blue}${i === currentLegIndex ? '' : '88'}`;

  return (
    <View style={styles.container}>
      {/* Full-screen MapLibre map */}
      <MapLibreGL.MapView
        style={StyleSheet.absoluteFill}
        styleURL={MAPTILER_DARK_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled
        onPress={() => { collapseSheet(); setIsTracking(false); }}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [legs[0]?.from.longitude ?? 3.3792, legs[0]?.from.latitude ?? 6.5244],
            zoomLevel: 13,
          }}
        />

        {/* Route polylines — rendered after ORS responds */}
        {geometriesLoaded && legs.map((leg, i) => {
          const coords = legGeometries[i];
          if (!coords || coords.length < 2) return null;
          const isCurrent = i === currentLegIndex;
          const isPast    = i < currentLegIndex;
          const color     = isPast ? '#555555' : (LEG_COLORS[leg.mode] ?? Colors.blue);

          const geoJson: GeoJSON.Feature<GeoJSON.LineString> = {
            type:       'Feature',
            properties: {},
            geometry:   {
              type:        'LineString',
              coordinates: coords.map(c => [c.longitude, c.latitude]),
            },
          };

          return (
            <React.Fragment key={`route-${i}`}>
              {/* White casing for the active leg */}
              {isCurrent && (
                <MapLibreGL.ShapeSource id={`route-casing-src-${i}`} shape={geoJson}>
                  <MapLibreGL.LineLayer
                    id={`route-casing-${i}`}
                    style={{ lineColor: '#FFFFFF', lineWidth: 12, lineCap: 'round', lineJoin: 'round' }}
                  />
                </MapLibreGL.ShapeSource>
              )}
              <MapLibreGL.ShapeSource id={`route-src-${i}`} shape={geoJson}>
                <MapLibreGL.LineLayer
                  id={`route-line-${i}`}
                  style={{
                    lineColor: color,
                    lineWidth: isCurrent ? 7 : 4,
                    lineCap:   'round',
                    lineJoin:  'round',
                  }}
                />
              </MapLibreGL.ShapeSource>
            </React.Fragment>
          );
        })}

        {/* Waypoint dots */}
        {legs.map((leg, i) => {
          const isCurrent = i === currentLegIndex;
          const isFinal   = i === legs.length - 1;
          return (
            <MapLibreGL.PointAnnotation
              key={`wp-${i}`}
              id={`wp-${i}`}
              coordinate={[leg.to.longitude, leg.to.latitude]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[
                styles.waypointDot,
                isFinal   && styles.waypointFinal,
                isCurrent && !isFinal && styles.waypointCurrent,
              ]} />
            </MapLibreGL.PointAnnotation>
          );
        })}

        {/* User location dot */}
        {userCoords && (
          <MapLibreGL.PointAnnotation
            id="user-loc"
            coordinate={[userCoords.longitude, userCoords.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userOuter}>
              <View style={styles.userPulseStatic} />
              <View style={styles.userDot} />
            </View>
          </MapLibreGL.PointAnnotation>
        )}
      </MapLibreGL.MapView>

      {/* Route loading indicator */}
      {!geometriesLoaded && (
        <View style={styles.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.routeLoadingText}>Loading road route…</Text>
        </View>
      )}

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
          <View style={styles.instructionCard}>
            <View style={styles.instructionTop}>
              <View style={[styles.turnArrow, { backgroundColor: LEG_COLORS[currentLeg.mode] ?? Colors.blue }]}>
                <Ionicons name={turnIcon(currentLeg.instruction).name as any} size={26} color="#fff" />
              </View>
              <View style={styles.distBlock}>
                {distanceToNext != null && (
                  <Text style={styles.distText}>{formatDist(distanceToNext)}</Text>
                )}
                <Text style={styles.instructionText} numberOfLines={2}>
                  {currentLeg.instruction}
                </Text>
              </View>
            </View>

            {nextLeg && (
              <View style={styles.nextRow}>
                <Ionicons name={turnIcon(nextLeg.instruction).name as any} size={13} color="rgba(255,255,255,0.6)" />
                <Text style={styles.nextText} numberOfLines={1}>
                  Then: {nextLeg.instruction}
                </Text>
                <Text style={styles.nextStep}>
                  Step {currentLegIndex + 2}/{legs.length}
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
          <View {...sheetPan.panHandlers} style={styles.dragHandleArea}>
            <View style={styles.dragPill} />
          </View>

          <View style={styles.bottomContent}>
            <View style={styles.speedPill}>
              <Text style={styles.speedNum}>{speedKmh}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>

            <View style={styles.bottomLeft}>
              <Text style={styles.bottomDest} numberOfLines={1}>{destinationName}</Text>
              <Text style={styles.bottomTime}>
                {remainingMins} min · ETA {formatETA(remainingMins)}
              </Text>
            </View>

            <View style={styles.bottomActions}>
              {(!isTracking || navMode === 'overview') && (
                <TouchableOpacity
                  style={styles.recenterBtn}
                  onPress={() => { setIsTracking(true); setNavMode('tracking'); }}
                >
                  <Ionicons name="navigate" size={18} color="#fff" />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.endBtn} onPress={endJourney}>
                <Text style={styles.endBtnText}>End</Text>
              </TouchableOpacity>
            </View>
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
    borderRadius: 20,
    backgroundColor: 'rgba(15,17,23,0.96)',
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 14 },
      android: { elevation: 12 },
    }),
  },
  instructionTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  turnArrow: {
    width: 56, height: 56, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  distBlock: { flex: 1, gap: 2 },
  distText: { color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  instructionText: { color: 'rgba(255,255,255,0.85)', fontSize: Typography.md, fontWeight: '500', flex: 1 },
  nextRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  nextText: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.sm, flex: 1 },
  nextStep: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },

  waypointDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#999', borderWidth: 2, borderColor: '#fff',
  },
  waypointCurrent: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B00' },
  waypointFinal:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444' },

  userOuter: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  userPulseStatic: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.blueLight, opacity: 0.45,
  },
  userDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.blue, borderWidth: 3, borderColor: '#fff',
  },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.sheetBg,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: Colors.border,
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 4, gap: 12,
  },
  speedPill: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  speedNum: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 22 },
  speedUnit: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '600' },
  bottomLeft: { flex: 1 },
  bottomDest: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  bottomTime: { fontSize: Typography.sm, marginTop: 2, color: Colors.textSecondary },
  bottomActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recenterBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.blue,
    justifyContent: 'center', alignItems: 'center',
  },
  endBtn: {
    borderWidth: 1.5, borderRadius: 10, borderColor: '#EF4444',
    paddingHorizontal: 14, paddingVertical: 8,
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

  routeLoadingBadge: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  routeLoadingText: { color: '#fff', fontSize: 13, fontWeight: '500' },

  incidentBanner: {
    position: 'absolute', left: 12, right: 12,
    borderRadius: 12, borderLeftWidth: 4,
    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
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
