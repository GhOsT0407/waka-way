import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useContributions, Contribution } from '../../hooks/useContributions';
import { AlertBottomSheet } from './AlertBottomSheet';
import { configureProximityNotifications, calculateDistance } from '../../services/proximityAlertService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES, GOOGLE_MAPS_DARK_STYLE, GOOGLE_MAPS_LIGHT_STYLE } from '../../utils/constants';

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

const MARKER_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; circleRadius: number }> = {
  security:    { color: '#D32F2F', icon: 'shield-outline',       circleRadius: 500 },
  danger_zone: { color: '#D32F2F', icon: 'warning-outline',      circleRadius: 300 },
  traffic:     { color: '#FF9800', icon: 'car-sport-outline',    circleRadius: 0   },
  hazard:      { color: '#FF5722', icon: 'alert-circle-outline', circleRadius: 200 },
  construction:{ color: '#FFC107', icon: 'construct-outline',    circleRadius: 0   },
  bus_stop:    { color: '#2563EB', icon: 'bus-outline',          circleRadius: 0   },
  taxi_stand:  { color: '#9C27B0', icon: 'car-outline',          circleRadius: 0   },
  other:       { color: '#607D8B', icon: 'help-circle-outline',  circleRadius: 0   },
};

interface CommunityMapViewProps {
  initialRegion?: Region;
  enableProximityAlerts?: boolean;
  proximityRadius?: number;
  filterTypes?: string[];
  style?: any;
}

export const CommunityMapView: React.FC<CommunityMapViewProps> = ({
  initialRegion,
  enableProximityAlerts = true,
  proximityRadius = 2,
  filterTypes,
  style,
}) => {
  const { WW, isDark } = useAppTheme();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showBottomSheet, setShowBottomSheet]           = useState(false);

  const { alerts, loading: alertsLoading, vote, getUserVote, refetch } = useContributions({
    userLocation,
    enableProximityAlerts,
    proximityRadius,
    filterTypes,
    onNewContribution: () => {},
    onProximityAlert:  () => {},
  });

  useEffect(() => {
    (async () => {
      if (enableProximityAlerts) await configureProximityNotifications();
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc    = await Location.getCurrentPositionAsync({});
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          }, 1000);
        }
      } catch {}
      setLoading(false);
    })();
  }, [enableProximityAlerts]);

  const handleMarkerPress = useCallback((contribution: Contribution) => {
    setSelectedContribution(contribution);
    setShowBottomSheet(true);
  }, []);

  const handleCloseBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setSelectedContribution(null);
  }, []);

  const handleCenterUser = useCallback(() => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }, 800);
  }, [userLocation]);

  const getDistance = useCallback((c: Contribution): number | undefined => {
    if (!userLocation) return undefined;
    return calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude);
  }, [userLocation]);

  const region: Region = initialRegion ?? DEFAULT_REGION;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: WW.bg }, style]}>
        <ActivityIndicator size="large" color={WW.orange} />
        <Text style={[styles.loadingText, { color: WW.textSub }]}>Loading community map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        customMapStyle={isDark ? GOOGLE_MAPS_DARK_STYLE as any : GOOGLE_MAPS_LIGHT_STYLE as any}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {alerts.map((contribution) => {
          const config    = MARKER_CONFIG[contribution.type] ?? MARKER_CONFIG.other;
          const isVerified = contribution.verified || (contribution.confirm_count >= 5);

          return (
            <React.Fragment key={contribution.id}>
              {/* Danger zone radius circle */}
              {config.circleRadius > 0 && (
                <Circle
                  center={{ latitude: contribution.latitude, longitude: contribution.longitude }}
                  radius={config.circleRadius}
                  fillColor={`${config.color}20`}
                  strokeColor={config.color}
                  strokeWidth={1}
                />
              )}

              <Marker
                coordinate={{ latitude: contribution.latitude, longitude: contribution.longitude }}
                onPress={() => handleMarkerPress(contribution)}
              >
                <View style={styles.markerWrapper}>
                  <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon} size={16} color="#FFFFFF" />
                    {isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={8} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={[styles.markerTip, { borderTopColor: config.color }]} />
                </View>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Floating controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, { backgroundColor: WW.bgElevated, borderColor: WW.border }]} onPress={handleCenterUser}>
          <Ionicons name="locate" size={22} color={WW.orange} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, { backgroundColor: WW.bgElevated, borderColor: WW.border }]} onPress={refetch} disabled={alertsLoading}>
          {alertsLoading
            ? <ActivityIndicator size="small" color={WW.orange} />
            : <Ionicons name="refresh" size={22} color={WW.orange} />}
        </TouchableOpacity>
      </View>

      {alerts.length > 0 && (
        <View style={[styles.alertBadge, { backgroundColor: WW.orange }]}>
          <Ionicons name="warning" size={13} color={WW.danfoText} />
          <Text style={[styles.alertBadgeText, { color: WW.danfoText }]}>
            {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      <AlertBottomSheet
        contribution={selectedContribution}
        visible={showBottomSheet}
        onClose={handleCloseBottomSheet}
        userVote={selectedContribution ? getUserVote(selectedContribution.id) : null}
        onVote={vote}
        distance={selectedContribution ? getDistance(selectedContribution) : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container:        { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText:      { marginTop: SPACING.MD, fontSize: FONT_SIZES.BODY },
  map:              { width: '100%', height: '100%' },

  markerWrapper:    { alignItems: 'center' },
  markerContainer: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  verifiedBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#5DBB63',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFFFF',
  },
  markerTip: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },

  controls: {
    position: 'absolute', right: SPACING.MD, bottom: 100, gap: SPACING.SM,
  },
  controlButton: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },

  alertBadge: {
    position: 'absolute', top: SPACING.LG, left: SPACING.MD, right: SPACING.MD,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.SM, paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM, gap: SPACING.XS,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  alertBadgeText: { fontSize: FONT_SIZES.SMALL, fontWeight: '600' },
});

export default CommunityMapView;
