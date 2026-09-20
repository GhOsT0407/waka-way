import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useContributions, Contribution } from '../../hooks/useContributions';
import { AlertBottomSheet } from './AlertBottomSheet';
import { configureProximityNotifications, calculateDistance } from '../../services/proximityAlertService';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Fonts, Typography, Tracking } from '../../theme/typography';
import { Space, Radius, HIT } from '../../theme/spacing';
import { kindMeta, freshnessOf } from '../../utils/reportKinds';
import { GOOGLE_MAPS_DARK_STYLE, GOOGLE_MAPS_LIGHT_STYLE } from '../../utils/constants';

// The Live map (WakaWay Mobile canvas): community reports as glyph pins on
// the map, a "LIVE · N reports near you" pill up top, and the report sheet
// when a pin is tapped. Kinds, colours and glyphs come from utils/reportKinds
// so a pin here matches its chip on Report and its row in Notifications.

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

// Kinds that mean "avoid this area" get a radius so the danger reads at a glance.
const RADIUS_M: Partial<Record<string, number>> = { security: 500, danger_zone: 300, hazard: 200 };

interface CommunityMapViewProps {
  initialRegion?: Region;
  enableProximityAlerts?: boolean;
  proximityRadius?: number;
  filterTypes?: string[];
  style?: any;
  /** Rendered inside the top pill's row, before the pill (e.g. a back button). */
  leading?: React.ReactNode;
}

export const CommunityMapView: React.FC<CommunityMapViewProps> = ({
  initialRegion,
  enableProximityAlerts = true,
  proximityRadius = 2,
  filterTypes,
  style,
  leading,
}) => {
  const { WW, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contribution | null>(null);

  const { alerts, loading: alertsLoading, vote, getUserVote, refetch } = useContributions({
    userLocation,
    enableProximityAlerts,
    proximityRadius,
    filterTypes,
    onNewContribution: () => {},
    onProximityAlert: () => {},
  });

  useEffect(() => {
    (async () => {
      if (enableProximityAlerts) await configureProximityNotifications();
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 1000);
        }
      } catch {}
      setLoading(false);
    })();
  }, [enableProximityAlerts]);

  const recenter = useCallback(() => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 800);
  }, [userLocation]);

  const distanceTo = useCallback((c: Contribution): number | undefined => {
    if (!userLocation) return undefined;
    return calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude);
  }, [userLocation]);

  if (loading) {
    return (
      <View style={[s.container, s.center, style]}>
        <ActivityIndicator size="large" color={WW.orange} />
      </View>
    );
  }

  const live = alerts.filter((a) => a.status !== 'rejected' && a.status !== 'expired');

  return (
    <View style={[s.container, style]}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion ?? DEFAULT_REGION}
        customMapStyle={isDark ? (GOOGLE_MAPS_DARK_STYLE as any) : (GOOGLE_MAPS_LIGHT_STYLE as any)}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onPress={() => setSelected(null)}
      >
        {live.map((c) => {
          const meta = kindMeta(c.type);
          const color = meta.color(WW);
          const radius = RADIUS_M[c.type];
          const fresh = freshnessOf(c);
          // Green ring = riders confirmed it; yellow = one fresh voice; a faded
          // pin = old, probably over. The validation doc's traffic light.
          const ring = fresh === 'verified' ? WW.green : fresh === 'reported' ? WW.warning : WW.bg;
          return (
            <React.Fragment key={c.id}>
              {!!radius && (
                <Circle
                  center={{ latitude: c.latitude, longitude: c.longitude }}
                  radius={radius}
                  fillColor={`${color}22`}
                  strokeColor={color}
                  strokeWidth={1}
                />
              )}
              <Marker
                coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                onPress={() => setSelected(c)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[s.pin, { backgroundColor: color, borderColor: ring, opacity: fresh === 'stale' ? 0.55 : 1 }]}>
                  <Text style={[s.pinGlyph, { color: meta.onColor(WW) }]}>{meta.glyph}</Text>
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Top row — optional leading control + the LIVE pill */}
      <View style={[s.topRow, { top: insets.top + Space.xs }]} pointerEvents="box-none">
        {leading}
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.liveText} numberOfLines={1}>
            {live.length === 0
              ? 'QUIET · NO REPORTS NEAR YOU IN THE LAST FEW HOURS'
              : `LIVE · ${live.length} ${live.length === 1 ? 'REPORT' : 'REPORTS'} NEAR YOU`}
          </Text>
          {alertsLoading && <ActivityIndicator size="small" color={WW.textMuted} />}
        </View>
      </View>

      <View style={s.controls}>
        <TouchableOpacity style={s.control} onPress={recenter} accessibilityRole="button" accessibilityLabel="Recenter on my location">
          <Ionicons name="navigate" size={20} color={WW.text} />
        </TouchableOpacity>
        <TouchableOpacity style={s.control} onPress={refetch} disabled={alertsLoading} accessibilityRole="button" accessibilityLabel="Refresh reports">
          <Ionicons name="refresh" size={20} color={WW.text} />
        </TouchableOpacity>
      </View>

      <AlertBottomSheet
        contribution={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        userVote={selected ? getUserVote(selected.id) : null}
        onVote={vote}
        distance={selected ? distanceTo(selected) : undefined}
      />
    </View>
  );
};

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: WW.bg },
    center: { alignItems: 'center', justifyContent: 'center' },

    pin: {
      width: 34, height: 34, borderRadius: Radius.pill,
      borderWidth: 2.5,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    pinGlyph: { fontFamily: Fonts.extrabold, fontSize: 13, marginTop: -1 },

    topRow: {
      position: 'absolute', left: Space.lg, right: Space.lg,
      flexDirection: 'row', alignItems: 'center', gap: Space.md,
    },
    livePill: {
      flex: 1, height: HIT, borderRadius: Radius.pill,
      backgroundColor: WW.frosted, borderWidth: 1, borderColor: WW.border,
      flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Space.lg,
    },
    liveDot: { width: 8, height: 8, borderRadius: Radius.pill, backgroundColor: WW.greenGlow },
    liveText: { flex: 1, fontFamily: Fonts.bold, fontSize: Typography.sm, letterSpacing: 0.4, color: WW.text },

    controls: { position: 'absolute', right: Space.lg, bottom: Space.xl, gap: Space.sm },
    control: {
      width: HIT, height: HIT, borderRadius: Radius.pill,
      backgroundColor: WW.frosted, borderWidth: 1, borderColor: WW.border,
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
  });
}

export default CommunityMapView;
