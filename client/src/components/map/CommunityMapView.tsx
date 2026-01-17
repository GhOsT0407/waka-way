import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE, Circle, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useContributions, Contribution } from '../../hooks/useContributions';
import { AlertBottomSheet } from './AlertBottomSheet';
import { 
  configureProximityNotifications, 
  calculateDistance,
  formatDistance,
} from '../../services/proximityAlertService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

const { width, height } = Dimensions.get('window');

// Default region for Lagos, Nigeria
const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

// Marker configuration
const MARKER_CONFIG: Record<string, {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  showCircle: boolean;
  circleRadius: number;
}> = {
  security: { color: '#D32F2F', icon: 'shield-outline', showCircle: true, circleRadius: 500 },
  danger_zone: { color: '#D32F2F', icon: 'warning-outline', showCircle: true, circleRadius: 300 },
  traffic: { color: '#FF9800', icon: 'car-sport-outline', showCircle: false, circleRadius: 0 },
  hazard: { color: '#FF5722', icon: 'alert-circle-outline', showCircle: true, circleRadius: 200 },
  construction: { color: '#FFC107', icon: 'construct-outline', showCircle: false, circleRadius: 0 },
  bus_stop: { color: '#2196F3', icon: 'bus-outline', showCircle: false, circleRadius: 0 },
  taxi_stand: { color: '#9C27B0', icon: 'car-outline', showCircle: false, circleRadius: 0 },
  other: { color: '#607D8B', icon: 'help-circle-outline', showCircle: false, circleRadius: 0 },
};

interface CommunityMapViewProps {
  /** Initial map region */
  initialRegion?: Region;
  /** Enable proximity alerts */
  enableProximityAlerts?: boolean;
  /** Proximity alert radius in km */
  proximityRadius?: number;
  /** Filter by contribution types */
  filterTypes?: string[];
  /** Custom style */
  style?: any;
}

/**
 * CommunityMapView Component
 * 
 * The "Community Awareness" map that displays all user-submitted contributions
 * with real-time updates, voting, and proximity alerts.
 * 
 * Features:
 * - Real-time contribution updates via Supabase
 * - Traffic: Orange markers
 * - Security: Red markers with 500m danger zone circles
 * - Verified badge for 5+ confirms
 * - Voting bottom sheet
 * - Proximity alerts with vibration and notifications
 * 
 * @example
 * ```tsx
 * <CommunityMapView
 *   enableProximityAlerts={true}
 *   proximityRadius={2}
 *   filterTypes={['traffic', 'security', 'hazard']}
 * />
 * ```
 */
export const CommunityMapView: React.FC<CommunityMapViewProps> = ({
  initialRegion,
  enableProximityAlerts = true,
  proximityRadius = 2,
  filterTypes,
  style,
}) => {
  const { theme } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  
  // State
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>(initialRegion || DEFAULT_REGION);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Use contributions hook with real-time updates
  const {
    alerts,
    loading: alertsLoading,
    vote,
    getUserVote,
    refetch,
  } = useContributions({
    userLocation,
    enableProximityAlerts,
    proximityRadius,
    filterTypes,
    onNewContribution: (contribution) => {
      console.log('🆕 New alert received:', contribution.title);
    },
    onProximityAlert: (contribution, distance) => {
      console.log(`🚨 Proximity alert: ${contribution.title} is ${distance.toFixed(2)}km away`);
    },
  });

  // Initialize location and notifications
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);

      // Configure notifications
      if (enableProximityAlerts) {
        await configureProximityNotifications();
      }

      // Get user location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          const coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(coords);

          // Center map on user location
          const newRegion: Region = {
            ...coords,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          };
          setRegion(newRegion);
          mapRef.current?.animateToRegion(newRegion, 1000);
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }

      setLoading(false);
    };

    initialize();
  }, [enableProximityAlerts]);

  // Handle marker press
  const handleMarkerPress = useCallback((contribution: Contribution) => {
    setSelectedContribution(contribution);
    setShowBottomSheet(true);
  }, []);

  // Close bottom sheet
  const handleCloseBottomSheet = useCallback(() => {
    setShowBottomSheet(false);
    setSelectedContribution(null);
  }, []);

  // Center on user location
  const handleCenterUser = useCallback(() => {
    if (userLocation) {
      const newRegion: Region = {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      mapRef.current?.animateToRegion(newRegion, 1000);
    }
  }, [userLocation]);

  // Calculate distance from user to contribution
  const getDistance = useCallback((contribution: Contribution): number | undefined => {
    if (!userLocation) return undefined;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      contribution.latitude,
      contribution.longitude
    );
  }, [userLocation]);

  // Render loading state
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer, style]}>
        <ActivityIndicator size="large" color={theme.PRIMARY} />
        <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>
          Loading community map...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={true}
        showsMyLocationButton={false}
        onRegionChangeComplete={setRegion}
      >
        {/* Render contribution markers */}
        {alerts.map((contribution) => {
          const config = MARKER_CONFIG[contribution.type] || MARKER_CONFIG.other;
          const isVerified = contribution.verified || (contribution.confirm_count >= 5);

          return (
            <React.Fragment key={contribution.id}>
              {/* Danger Zone Circle */}
              {config.showCircle && (
                <Circle
                  center={{
                    latitude: contribution.latitude,
                    longitude: contribution.longitude,
                  }}
                  radius={config.circleRadius}
                  fillColor={`${config.color}20`}
                  strokeColor={config.color}
                  strokeWidth={2}
                />
              )}

              {/* Marker */}
              <Marker
                coordinate={{
                  latitude: contribution.latitude,
                  longitude: contribution.longitude,
                }}
                onPress={() => handleMarkerPress(contribution)}
                tracksViewChanges={false}
              >
                {/* Custom Marker */}
                <View style={styles.markerWrapper}>
                  <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                    <Ionicons name={config.icon} size={18} color="#FFFFFF" />
                    {isVerified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={[styles.markerTip, { borderTopColor: config.color }]} />
                </View>

                {/* Callout */}
                <Callout tooltip onPress={() => handleMarkerPress(contribution)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutTitle} numberOfLines={1}>
                      {contribution.title}
                    </Text>
                    <Text style={styles.calloutMeta}>
                      {isVerified && '✓ Verified • '}
                      Tap for details
                    </Text>
                  </View>
                </Callout>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Floating Controls */}
      <View style={styles.controls}>
        {/* Center on user button */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.SURFACE }]}
          onPress={handleCenterUser}
        >
          <Ionicons name="locate" size={24} color={theme.PRIMARY} />
        </TouchableOpacity>

        {/* Refresh button */}
        <TouchableOpacity
          style={[styles.controlButton, { backgroundColor: theme.SURFACE }]}
          onPress={refetch}
          disabled={alertsLoading}
        >
          {alertsLoading ? (
            <ActivityIndicator size="small" color={theme.PRIMARY} />
          ) : (
            <Ionicons name="refresh" size={24} color={theme.PRIMARY} />
          )}
        </TouchableOpacity>
      </View>

      {/* Alert count badge */}
      {alerts.length > 0 && (
        <View style={[styles.alertBadge, { backgroundColor: theme.PRIMARY }]}>
          <Ionicons name="warning" size={14} color="#FFFFFF" />
          <Text style={styles.alertBadgeText}>
            {alerts.length} active alert{alerts.length > 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Bottom Sheet */}
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.MD,
    fontSize: FONT_SIZES.BODY,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerWrapper: {
    alignItems: 'center',
  },
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
    backgroundColor: '#4CAF50',
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
  callout: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: SPACING.SM,
    minWidth: 150,
    maxWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  calloutTitle: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  calloutMeta: {
    fontSize: FONT_SIZES.SMALL,
    color: '#666666',
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
