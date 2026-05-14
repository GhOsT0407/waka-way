import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import type { RouteOption, RouteLeg } from '../services/smartRoutingService';

const ADVANCE_THRESHOLD_M = 80;

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
  const { theme } = useAppTheme();
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

  const currentLeg = legs[currentLegIndex];
  const nextLeg = legs[currentLegIndex + 1];
  const remainingMins = legs
    .slice(currentLegIndex)
    .reduce((sum, l) => sum + l.durationMins, 0);

  // Pulsing dot animation
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

  // Start GPS watch
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
      : `${LEG_COLORS[legs[i].mode] ?? theme.PRIMARY}${i === currentLegIndex ? '' : '88'}`;

  return (
    <View style={styles.container}>
      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsCompass
        initialRegion={{
          latitude: legs[0]?.from.latitude ?? 6.5244,
          longitude: legs[0]?.from.longitude ?? 3.3792,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* Colored polyline per leg */}
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

        {/* Waypoint markers */}
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

        {/* Animated user dot */}
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

      {/* ── Top area: back + instruction ── */}
      <View style={[styles.topArea, { paddingTop: insets.top + SPACING.SM }]}>
        <TouchableOpacity style={styles.backBtn} onPress={endJourney}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>

        {!arrived && currentLeg && (
          <View
            style={[
              styles.instructionCard,
              { backgroundColor: LEG_COLORS[currentLeg.mode] ?? theme.PRIMARY },
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

      {/* ── Arrived overlay ── */}
      {arrived && (
        <View style={styles.arrivedOverlay}>
          <View style={[styles.arrivedCard, { backgroundColor: theme.CARD_BACKGROUND }]}>
            <Ionicons name="checkmark-circle" size={64} color={theme.PRIMARY} />
            <Text style={[styles.arrivedTitle, { color: theme.TEXT }]}>You've arrived!</Text>
            <Text style={[styles.arrivedSub, { color: theme.TEXT_SECONDARY }]}>
              {destinationName}
            </Text>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: theme.PRIMARY }]}
              onPress={endJourney}
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Bottom bar ── */}
      {!arrived && (
        <View
          style={[
            styles.bottomBar,
            { backgroundColor: theme.CARD_BACKGROUND, paddingBottom: insets.bottom + SPACING.SM },
          ]}
        >
          <View style={styles.bottomLeft}>
            <Text style={[styles.bottomDest, { color: theme.TEXT }]} numberOfLines={1}>
              {destinationName}
            </Text>
            <Text style={[styles.bottomTime, { color: theme.TEXT_SECONDARY }]}>
              ~{remainingMins} min remaining
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.endBtn, { borderColor: theme.ERROR }]}
            onPress={endJourney}
          >
            <Text style={[styles.endBtnText, { color: theme.ERROR }]}>End journey</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topArea: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.MD,
    gap: SPACING.SM,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    alignSelf: 'flex-start',
  },
  instructionCard: {
    borderRadius: BORDER_RADIUS.LARGE,
    padding: SPACING.MD,
    gap: SPACING.XS,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.SM },
  modeIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
  },
  instructionText: { color: '#fff', fontSize: FONT_SIZES.BODY_LARGE, fontWeight: '700', flex: 1 },
  instructionMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: FONT_SIZES.CAPTION },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  nextText: { color: 'rgba(255,255,255,0.7)', fontSize: FONT_SIZES.CAPTION, flex: 1 },
  waypointDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#999', borderWidth: 2, borderColor: '#fff',
  },
  waypointCurrent: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF6B00' },
  waypointFinal: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#D32F2F' },
  userOuter: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  userPulse: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(25,118,210,0.3)',
  },
  userDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#1976D2', borderWidth: 3, borderColor: '#fff',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    borderTopLeftRadius: BORDER_RADIUS.XL,
    borderTopRightRadius: BORDER_RADIUS.XL,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 10 },
      android: { elevation: 14 },
    }),
  },
  bottomLeft: { flex: 1, marginRight: SPACING.MD },
  bottomDest: { fontSize: FONT_SIZES.BODY_LARGE, fontWeight: '700' },
  bottomTime: { fontSize: FONT_SIZES.CAPTION, marginTop: 2 },
  endBtn: {
    borderWidth: 1.5, borderRadius: BORDER_RADIUS.MEDIUM,
    paddingHorizontal: SPACING.MD, paddingVertical: SPACING.SM,
  },
  endBtnText: { fontWeight: '700', fontSize: FONT_SIZES.BODY },
  arrivedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
    padding: SPACING.LG,
  },
  arrivedCard: {
    width: '100%', borderRadius: BORDER_RADIUS.XL,
    padding: SPACING.XL, alignItems: 'center', gap: SPACING.MD,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 12 },
    }),
  },
  arrivedTitle: { fontSize: FONT_SIZES.HEADING_1, fontWeight: '800' },
  arrivedSub: { fontSize: FONT_SIZES.BODY, textAlign: 'center' },
  doneBtn: {
    paddingHorizontal: SPACING.XXL, paddingVertical: SPACING.MD,
    borderRadius: BORDER_RADIUS.ROUND, marginTop: SPACING.SM,
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZES.BODY_LARGE },
});
