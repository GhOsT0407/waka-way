import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WW_DARK, type WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius, HIT } from '../theme/spacing';
import type { RouteOption, RouteLeg } from '../services/smartRoutingService';
import { fetchAllLegGeometries, LatLng } from '../services/directionsService';
import { GOOGLE_MAPS_DARK_STYLE } from '../utils/constants';

const ADVANCE_THRESHOLD_M = 80;
const NAV_ZOOM   = 17;
const NAV_PITCH  = 50;

// Polyline / badge colour per leg, from the mode tokens. Walk is drawn in the
// light ink so it reads as "you, on foot" against the dark map.
function legColor(WW: WWColors, mode: string): string {
  switch (mode) {
    case 'danfo': return WW.danfo;
    case 'brt':   return WW.brt;
    case 'keke':  return WW.keke;
    case 'okada': return WW.okada;
    case 'ferry': return WW.ferry;
    case 'walk':  return WW.textSub;
    default:      return WW.orange;
  }
}
function legTextColor(WW: WWColors, mode: string): string {
  switch (mode) {
    case 'danfo': return WW.danfoText;
    case 'brt':   return WW.brtText;
    case 'keke':  return WW.kekeText;
    case 'okada': return WW.okadaText;
    case 'ferry': return WW.ferryText;
    case 'walk':  return WW.bg;
    default:      return WW.textOnOrange;
  }
}

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
  // Navigation is dark in both themes -- one loud colour, the route, on a dark
  // canvas (see the redesign canvas). It reads the dark palette directly.
  const WW = WW_DARK;
  const styles = useMemo(() => makeStyles(WW), [WW]);
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
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [userCoords, setUserCoords] = useState<Coord | null>(null);
  const [distanceToNext, setDistanceToNext] = useState<number | null>(null);
  const [arrived, setArrived] = useState(false);
  const [speedKmh, setSpeedKmh]     = useState<number>(0);
  const [isTracking, setIsTracking] = useState(true);
  const [navMode, setNavMode]           = useState<'overview' | 'tracking'>('overview');
  const [legGeometries, setLegGeometries] = useState<(LatLng[] | null)[]>([]);
  const [geometriesLoaded, setGeometriesLoaded] = useState(false);

  const currentLeg = legs[currentLegIndex];
  const nextLeg = legs[currentLegIndex + 1];
  const remainingMins = legs
    .slice(currentLegIndex)
    .reduce((sum, l) => sum + l.durationMins, 0);
  const remainingKm = legs
    .slice(currentLegIndex)
    .reduce((sum, l) => sum + (l.distanceKm ?? 0), 0);

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
      if (allCoords.length > 1 && mapRef.current) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 80, right: 80, bottom: 260, left: 80 },
          animated: true,
        });
      }

      setTimeout(() => setNavMode('tracking'), 3000);
    })();
  }, []);

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
            mapRef.current?.animateCamera({
              center: { latitude: coord.latitude, longitude: coord.longitude },
              zoom:   NAV_ZOOM,
              heading,
              pitch:  NAV_PITCH,
            }, { duration: 800 });
          }
        },
      );
    })();

    return () => locationSubRef.current?.remove();
  }, []);

  const advanceLeg = () => {
    const idx = currentLegRef.current;
    if (idx >= legs.length - 1) {
      setArrived(true);
      locationSubRef.current?.remove();
    } else {
      currentLegRef.current = idx + 1;
      setCurrentLegIndex(idx + 1);
    }
  };

  // The validation doc's one question after every trip. "Something wrong"
  // opens Report with the trip filled in so the fix takes two taps.
  const askIfItWorked = (after: () => void) => {
    const lead = legs.find((l) => l.mode !== 'walk');
    const toReport = (kind: 'route_down' | 'fare_change' | 'stop_moved') => {
      navigation.navigate('Main', {
        screen: 'Report',
        params: {
          kind,
          origin: legs[0]?.from.name,
          destination: destinationName,
          mode: lead?.mode,
          fare: option.totalPriceMax,
        },
      });
    };
    Alert.alert(
      'Did the route work?',
      'Your answer fixes the map for the next person.',
      [
        { text: 'Yes, e work', onPress: after },
        { text: 'Wrong bus / stop', onPress: () => toReport('route_down') },
        { text: 'Fare was different', onPress: () => toReport('fare_change') },
      ],
    );
  };

  const endJourney = () => {
    locationSubRef.current?.remove();
    // Ending a journey returns to the tabs, not to the route-options sheet
    // that was underneath -- after arriving there is nothing to pick from.
    if (navigation.canGoBack()) {
      navigation.popToTop();
    } else {
      navigation.navigate('Main' as never);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full-screen Google map */}
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        customMapStyle={GOOGLE_MAPS_DARK_STYLE as any}
        showsCompass
        initialRegion={{
          latitude: legs[0]?.from.latitude ?? 6.5244,
          longitude: legs[0]?.from.longitude ?? 3.3792,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        onPress={() => setIsTracking(false)}
      >
        {/* Route polylines — rendered after ORS responds */}
        {geometriesLoaded && legs.map((leg, i) => {
          const coords = legGeometries[i];
          if (!coords || coords.length < 2) return null;
          const isCurrent = i === currentLegIndex;
          const isPast    = i < currentLegIndex;
          const color     = isPast ? '#555555' : (legColor(WW, leg.mode));

          return (
            <React.Fragment key={`route-${i}`}>
              {/* White casing for the active leg */}
              {isCurrent && (
                <Polyline
                  coordinates={coords}
                  strokeColor="#FFFFFF"
                  strokeWidth={12}
                  lineCap="round"
                  lineJoin="round"
                />
              )}
              <Polyline
                coordinates={coords}
                strokeColor={color}
                strokeWidth={isCurrent ? 7 : 4}
                lineCap="round"
                lineJoin="round"
              />
            </React.Fragment>
          );
        })}

        {/* Waypoint dots */}
        {legs.map((leg, i) => {
          const isCurrent = i === currentLegIndex;
          const isFinal   = i === legs.length - 1;
          return (
            <Marker
              key={`wp-${i}`}
              coordinate={{ latitude: leg.to.latitude, longitude: leg.to.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[
                styles.waypointDot,
                isFinal   && styles.waypointFinal,
                isCurrent && !isFinal && styles.waypointCurrent,
              ]} />
            </Marker>
          );
        })}

        {/* User location dot */}
        {userCoords && (
          <Marker
            coordinate={{ latitude: userCoords.latitude, longitude: userCoords.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userOuter}>
              <View style={styles.userPulseStatic} />
              <View style={styles.userDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Route loading indicator */}
      {!geometriesLoaded && (
        <View style={styles.routeLoadingBadge}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.routeLoadingText}>Loading road route…</Text>
        </View>
      )}

      {/* Top: back · maneuver banner · next-step strip */}
      <View style={[styles.topArea, { paddingTop: insets.top + Space.xs }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={endJourney}
          accessibilityRole="button"
          accessibilityLabel="End navigation"
        >
          <Ionicons name="arrow-back" size={20} color={WW.text} />
        </TouchableOpacity>

        {!arrived && currentLeg && (
          <View style={styles.bannerWrap}>
            <View style={styles.banner}>
              <View style={[styles.turnArrow, { backgroundColor: legColor(WW, currentLeg.mode) }]}>
                <Ionicons
                  name={turnIcon(currentLeg.instruction).name as any}
                  size={26}
                  color={legTextColor(WW, currentLeg.mode)}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                {distanceToNext != null && (
                  <Text style={styles.distText}>{formatDist(distanceToNext)}</Text>
                )}
                <Text style={styles.instructionText} numberOfLines={2}>
                  {currentLeg.localInstruction || currentLeg.instruction}
                </Text>
              </View>
            </View>

            {nextLeg && (
              <View style={styles.nextStrip}>
                <Text style={styles.nextEyebrow}>Then</Text>
                <Text style={styles.nextText} numberOfLines={1}>{nextLeg.localInstruction || nextLeg.instruction}</Text>
                <Text style={styles.nextStep}>{currentLegIndex + 2}/{legs.length}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Arrived — the one dot, grown into a check (morph 6) */}
      {arrived && (
        <View style={styles.arrivedOverlay}>
          <View style={styles.arrivedDot}>
            <Ionicons name="checkmark" size={38} color={WW.textOnOrange} />
          </View>
          <Text style={styles.arrivedTitle}>You done reach!</Text>
          <Text style={styles.arrivedSub}>{destinationName}</Text>
          <Pressable onPress={() => askIfItWorked(endJourney)} accessibilityRole="button" style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* Action bar — ETA · remaining · next · End (morph 5: the tab bar, as a pill) */}
      {!arrived && (
        <View style={[styles.actionBar, { bottom: insets.bottom + 26 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.etaText}>{formatETA(remainingMins)}</Text>
            <Text style={styles.remainingText} numberOfLines={1}>
              {remainingMins} min · {remainingKm.toFixed(1)} km left{speedKmh > 0 ? ` · ${speedKmh} km/h` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => { setIsTracking(true); setNavMode('tracking'); }}
            accessibilityRole="button"
            accessibilityLabel="Recenter on my location"
            style={({ pressed }) => [styles.roundAction, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="navigate" size={18} color={WW.textOnOrange} />
          </Pressable>
          <Pressable
            onPress={advanceLeg}
            accessibilityRole="button"
            accessibilityLabel="Next step"
            style={({ pressed }) => [styles.roundAction, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="arrow-forward" size={18} color={WW.textOnOrange} />
          </Pressable>
          <Pressable
            onPress={() => askIfItWorked(endJourney)}
            accessibilityRole="button"
            accessibilityLabel="End journey"
            style={({ pressed }) => [styles.endBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.endBtnText}>End</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: WW.bg },
  topArea: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    gap: 8,
  },
  backBtn: {
    width: HIT, height: HIT, borderRadius: Radius.pill,
    backgroundColor: WW.frosted,
    borderWidth: StyleSheet.hairlineWidth, borderColor: WW.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerWrap: { marginTop: Space.sm },
  banner: {
    borderRadius: Radius.xl,
    backgroundColor: WW.frosted,
    borderWidth: StyleSheet.hairlineWidth, borderColor: WW.borderStrong,
    padding: Space.lg,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 40, shadowOffset: { width: 0, height: 16 },
    elevation: 10,
  },
  instructionTop: { display: 'none' },
  turnArrow: {
    width: HIT, height: HIT, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  distBlock: { flex: 1 },
  distText: {
    fontFamily: Fonts.extrabold, fontSize: Typography.hero, lineHeight: Typography.hero,
    color: WW.text, letterSpacing: Tracking.tight,
  },
  instructionText: {
    fontFamily: Fonts.regular, fontSize: Typography.lg, lineHeight: Typography.lg * 1.3,
    color: WW.textSub, marginTop: 4,
  },
  nextStrip: {
    marginHorizontal: Space.md,
    borderBottomLeftRadius: Radius.lg, borderBottomRightRadius: Radius.lg,
    // A step down from the banner's material -- dark-only screen, so a literal is fine.
    backgroundColor: 'rgba(20,22,26,0.62)',
    paddingHorizontal: Space.lg, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  nextEyebrow: {
    fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow,
    textTransform: 'uppercase', color: WW.textMuted,
  },
  nextText: { flex: 1, fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textSub },
  nextStep: { fontFamily: Fonts.medium, fontSize: Typography.sm, color: WW.textMuted },

  waypointDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#999', borderWidth: 2, borderColor: '#fff',
  },
  waypointCurrent: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B00' },
  waypointFinal:   { width: 22, height: 22, borderRadius: 11, backgroundColor: '#EF4444' },

  userOuter: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  userPulseStatic: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: WW.orangeDim, opacity: 0.45,
  },
  userDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: WW.orange, borderWidth: 3, borderColor: '#fff',
  },

  actionBar: {
    position: 'absolute', left: 14, right: 14, height: 72,
    borderRadius: Radius.pill, backgroundColor: WW.orange,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 22, paddingRight: 8,
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 40, shadowOffset: { width: 0, height: 16 },
    elevation: 14,
  },
  etaText: {
    fontFamily: Fonts.extrabold, fontSize: Typography.xl, lineHeight: Typography.xl,
    color: WW.textOnOrange, letterSpacing: Tracking.tight / 2,
  },
  remainingText: { fontFamily: Fonts.semibold, fontSize: 12, color: 'rgba(26,18,0,0.72)', marginTop: 3 },
  roundAction: {
    width: 48, height: 48, borderRadius: Radius.pill,
    backgroundColor: 'rgba(26,18,0,0.10)',
    alignItems: 'center', justifyContent: 'center',
  },
  endBtn: {
    height: 48, paddingHorizontal: 22, borderRadius: Radius.pill,
    backgroundColor: WW.textOnOrange,
    alignItems: 'center', justifyContent: 'center',
  },
  endBtnText: { fontFamily: Fonts.extrabold, fontSize: Typography.md, color: WW.orange },

  arrivedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20,22,26,0.86)',
    justifyContent: 'center', alignItems: 'center',
    padding: 32, gap: 8,
  },
  arrivedDot: {
    width: 72, height: 72, borderRadius: Radius.pill, backgroundColor: WW.orange,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: WW.orange, shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 10 },
  },
  arrivedTitle: {
    fontFamily: Fonts.extrabold, fontSize: 32, lineHeight: 34,
    color: WW.text, letterSpacing: -0.8, textAlign: 'center',
  },
  arrivedSub: { fontFamily: Fonts.regular, fontSize: Typography.lg, color: WW.textSub, textAlign: 'center' },
  doneBtn: {
    marginTop: 22, paddingHorizontal: 34, height: 52, borderRadius: Radius.pill,
    backgroundColor: WW.orange, alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontFamily: Fonts.extrabold, fontSize: Typography.md, color: WW.textOnOrange },

  routeLoadingBadge: {
    position: 'absolute', bottom: 130, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  routeLoadingText: { color: '#fff', fontSize: 13, fontWeight: '500' },
});
}
