import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useContributions, Contribution } from '../../hooks/useContributions';
import { AlertBottomSheet } from './AlertBottomSheet';
import { configureProximityNotifications, calculateDistance } from '../../services/proximityAlertService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES, MAPTILER_DARK_STYLE } from '../../utils/constants';
import { circlePolygon } from '../../utils/mapboxInit';
import { WW } from '../../theme/colors';

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244]; // Lagos [lng, lat]

const MARKER_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap; circleRadius: number }> = {
  security:    { color: '#D32F2F', icon: 'shield-outline',       circleRadius: 500 },
  danger_zone: { color: '#D32F2F', icon: 'warning-outline',      circleRadius: 300 },
  traffic:     { color: '#FF9800', icon: 'car-sport-outline',    circleRadius: 0   },
  hazard:      { color: '#FF5722', icon: 'alert-circle-outline', circleRadius: 200 },
  construction:{ color: '#FFC107', icon: 'construct-outline',    circleRadius: 0   },
  bus_stop:    { color: WW.brt,    icon: 'bus-outline',          circleRadius: 0   },
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
  useAppTheme();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

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
          cameraRef.current?.setCamera({
            centerCoordinate: [coords.longitude, coords.latitude],
            zoomLevel: 14,
            animationDuration: 1000,
            animationMode: 'flyTo',
          });
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
    cameraRef.current?.setCamera({
      centerCoordinate: [userLocation.longitude, userLocation.latitude],
      zoomLevel: 14,
      animationDuration: 800,
      animationMode: 'easeTo',
    });
  }, [userLocation]);

  const getDistance = useCallback((c: Contribution): number | undefined => {
    if (!userLocation) return undefined;
    return calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude);
  }, [userLocation]);

  const initialCenter: [number, number] = initialRegion
    ? [initialRegion.longitude, initialRegion.latitude]
    : DEFAULT_CENTER;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={WW.orange} />
        <Text style={[styles.loadingText, { color: WW.textSub }]}>Loading community map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={MAPTILER_DARK_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: 13 }}
        />

        <MapLibreGL.UserLocation visible />

        {alerts.map((contribution) => {
          const config    = MARKER_CONFIG[contribution.type] ?? MARKER_CONFIG.other;
          const isVerified = contribution.verified || (contribution.confirm_count >= 5);

          return (
            <React.Fragment key={contribution.id}>
              {/* Danger zone radius polygon */}
              {config.circleRadius > 0 && (
                <MapLibreGL.ShapeSource
                  id={`circle-src-${contribution.id}`}
                  shape={circlePolygon(contribution.latitude, contribution.longitude, config.circleRadius)}
                >
                  <MapLibreGL.FillLayer
                    id={`circle-fill-${contribution.id}`}
                    style={{
                      fillColor:         `${config.color}20`,
                      fillOutlineColor:  config.color,
                    }}
                  />
                </MapLibreGL.ShapeSource>
              )}

              <MapLibreGL.PointAnnotation
                id={`contrib-${contribution.id}`}
                coordinate={[contribution.longitude, contribution.latitude]}
                onSelected={() => handleMarkerPress(contribution)}
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
              </MapLibreGL.PointAnnotation>
            </React.Fragment>
          );
        })}
      </MapLibreGL.MapView>

      {/* Floating controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={[styles.controlButton, { backgroundColor: WW.bgElevated }]} onPress={handleCenterUser}>
          <Ionicons name="locate" size={22} color={WW.orange} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, { backgroundColor: WW.bgElevated }]} onPress={refetch} disabled={alertsLoading}>
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
  loadingContainer: { justifyContent: 'center', alignItems: 'center', backgroundColor: WW.bg },
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
    backgroundColor: WW.green,
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
    borderWidth: 1, borderColor: WW.border,
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
