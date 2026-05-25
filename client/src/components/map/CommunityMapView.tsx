import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useContributions, Contribution } from '../../hooks/useContributions';
import { AlertBottomSheet } from './AlertBottomSheet';
import {
  configureProximityNotifications,
  calculateDistance,
} from '../../services/proximityAlertService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';
import { initMapbox, toLngLat, circlePolygon } from '../../utils/mapboxInit';

initMapbox();

// Legacy Region type — kept for API compat with callers
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const DEFAULT_CENTER: [number, number] = [3.3792, 6.5244]; // Lagos [lng, lat]
const DEFAULT_ZOOM = 12;

const MARKER_CONFIG: Record<string, {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  showCircle: boolean;
  circleRadius: number;
}> = {
  security:     { color: '#D32F2F', icon: 'shield-outline',       showCircle: true,  circleRadius: 500 },
  danger_zone:  { color: '#D32F2F', icon: 'warning-outline',      showCircle: true,  circleRadius: 300 },
  traffic:      { color: '#FF9800', icon: 'car-sport-outline',    showCircle: false, circleRadius: 0 },
  hazard:       { color: '#FF5722', icon: 'alert-circle-outline', showCircle: true,  circleRadius: 200 },
  construction: { color: '#FFC107', icon: 'construct-outline',    showCircle: false, circleRadius: 0 },
  bus_stop:     { color: '#2196F3', icon: 'bus-outline',          showCircle: false, circleRadius: 0 },
  taxi_stand:   { color: '#9C27B0', icon: 'car-outline',          showCircle: false, circleRadius: 0 },
  other:        { color: '#607D8B', icon: 'help-circle-outline',  showCircle: false, circleRadius: 0 },
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
  const { theme } = useAppTheme();
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showBottomSheet, setShowBottomSheet]           = useState(false);

  const { alerts, loading: alertsLoading, vote, getUserVote, refetch } = useContributions({
    userLocation,
    enableProximityAlerts,
    proximityRadius,
    filterTypes,
    onNewContribution: (c) => { console.log('🆕 New alert received:', c.title); },
    onProximityAlert:  (c, d) => { console.log(`🚨 Proximity alert: ${c.title} is ${d.toFixed(2)}km away`); },
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
          cameraRef.current?.setCamera({
            centerCoordinate: toLngLat(coords.latitude, coords.longitude),
            zoomLevel: 14,
            animationDuration: 1000,
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
      centerCoordinate: toLngLat(userLocation.latitude, userLocation.longitude),
      zoomLevel: 14,
      animationDuration: 1000,
    });
  }, [userLocation]);

  const getDistance = useCallback((c: Contribution): number | undefined => {
    if (!userLocation) return undefined;
    return calculateDistance(userLocation.latitude, userLocation.longitude, c.latitude, c.longitude);
  }, [userLocation]);

  const initCoord: [number, number] = initialRegion
    ? toLngLat(initialRegion.latitude, initialRegion.longitude)
    : DEFAULT_CENTER;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={theme.PRIMARY} />
        <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>Loading community map...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapboxGL.MapView
        style={styles.map}
        styleURL={MapboxGL.StyleURL.Dark}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: initCoord, zoomLevel: DEFAULT_ZOOM }}
        />

        <MapboxGL.UserLocation visible androidRenderMode="normal" />

        {alerts.map((contribution) => {
          const config    = MARKER_CONFIG[contribution.type] || MARKER_CONFIG.other;
          const isVerified = contribution.verified || (contribution.confirm_count >= 5);

          return (
            <React.Fragment key={contribution.id}>
              {config.showCircle && (
                <MapboxGL.ShapeSource
                  id={`circle-${contribution.id}`}
                  shape={circlePolygon(contribution.longitude, contribution.latitude, config.circleRadius)}
                >
                  <MapboxGL.FillLayer
                    id={`fill-${contribution.id}`}
                    style={{ fillColor: `${config.color}20`, fillOutlineColor: config.color }}
                  />
                </MapboxGL.ShapeSource>
              )}

              <MapboxGL.MarkerView coordinate={toLngLat(contribution.latitude, contribution.longitude)}>
                <TouchableOpacity
                  style={styles.markerWrapper}
                  onPress={() => handleMarkerPress(contribution)}
                >
                  <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon} size={18} color="#FFFFFF" />
                    {isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={[styles.markerTip, { borderTopColor: config.color }]} />
                </TouchableOpacity>
              </MapboxGL.MarkerView>
            </React.Fragment>
          );
        })}
      </MapboxGL.MapView>

      {/* Floating controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.SURFACE }]}
          onPress={handleCenterUser}
        >
          <Ionicons name="locate" size={24} color={theme.PRIMARY} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.SURFACE }]}
          onPress={refetch}
          disabled={alertsLoading}
        >
          {alertsLoading
            ? <ActivityIndicator size="small" color={theme.PRIMARY} />
            : <Ionicons name="refresh" size={24} color={theme.PRIMARY} />}
        </TouchableOpacity>
      </View>

      {alerts.length > 0 && (
        <View style={[styles.alertBadge, { backgroundColor: theme.PRIMARY }]}>
          <Ionicons name="warning" size={14} color="#FFFFFF" />
          <Text style={styles.alertBadgeText}>
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

  markerWrapper: { alignItems: 'center' },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  verifiedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },

  controls: {
    position: 'absolute',
    right: SPACING.MD,
    bottom: 100,
    gap: SPACING.SM,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  alertBadge: {
    position: 'absolute',
    top: SPACING.LG,
    left: SPACING.MD,
    right: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    gap: SPACING.XS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
});

export default CommunityMapView;
