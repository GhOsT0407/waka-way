import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Region, PROVIDER_GOOGLE, Polyline, Circle, Callout } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { getCurrentLocation, LocationData } from '../../services/locationService';
import reportService, { Report as ReportItem, ReportType } from '../../services/reportService';

import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface WakaWayMapViewProps {
  initialRegion?: Region;
  markers?: Array<{
    id: string;
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
    icon?: string;
  }>;
  routePolyline?: Array<{ latitude: number; longitude: number }>;
  directions?: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    apikey: string;
  };
  onMarkerPress?: (marker: any) => void;
  onRegionChange?: (region: Region) => void;
  showUserLocation?: boolean;
  hideCenterButton?: boolean;
  style?: any;
}

// Default region for Lagos, Nigeria
const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'poi.park', elementType: 'labels.text.stroke', stylers: [{ color: '#1b1b1b' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

// Custom map style for green theme - desaturated with green accents
const GREEN_MAP_STYLE = [
  {
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f5f5f5"
      },
      {
        "saturation": -30
      }
    ]
  },
  {
    "elementType": "labels.icon",
    "stylers": [
      {
        "visibility": "off"
      }
    ]
  },
  {
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "elementType": "labels.text.stroke",
    "stylers": [
      {
        "color": "#f5f5f5"
      }
    ]
  },
  {
    "featureType": "administrative.land_parcel",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#bdbdbd"
      }
    ]
  },
  {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#f0f0f0"
      },
      {
        "saturation": -40
      },
      {
        "lightness": 10
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      },
      {
        "saturation": -20
      }
    ]
  },
  {
    "featureType": "poi",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      },
      {
        "saturation": -30
      }
    ]
  },
  {
    "featureType": "poi.park",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#ffffff"
      }
    ]
  },
  {
    "featureType": "road.arterial",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#757575"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#dadada"
      }
    ]
  },
  {
    "featureType": "road.highway",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#616161"
      }
    ]
  },
  {
    "featureType": "road.local",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  },
  {
    "featureType": "transit.line",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#e5e5e5"
      }
    ]
  },
  {
    "featureType": "transit.station",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#eeeeee"
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      {
        "color": "#d0d0d0"
      },
      {
        "saturation": -50
      },
      {
        "lightness": 5
      }
    ]
  },
  {
    "featureType": "water",
    "elementType": "labels.text.fill",
    "stylers": [
      {
        "color": "#9e9e9e"
      }
    ]
  }
];

export const WakaWayMapView: React.FC<WakaWayMapViewProps> = ({
  initialRegion,
  markers = [],
  routePolyline,
  directions,
  onMarkerPress,
  onRegionChange,
  showUserLocation = true,
  hideCenterButton = false,
  style,
}) => {
  const { theme, isDark } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const hasAppliedInitialUserCenter = useRef(false);
  const lastPolylineFitKey = useRef<string | null>(null);
  const lastDirectionsFitKey = useRef<string | null>(null);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>(initialRegion || DEFAULT_REGION);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pulsing location dot animation
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    loadUserLocation();
    loadReports();
    const cleanupInterval = setInterval(async () => {
      const refreshed = await reportService.cleanupExpired();
      setReports(refreshed);
    }, 60 * 1000); // cleanup every minute

    return () => clearInterval(cleanupInterval);
  }, []);

  const loadReports = async () => {
    try {
      const rs = await reportService.getReports(true);
      setReports(rs);
    } catch (err) {
      console.warn('Failed to load reports', err);
    }
  };

  useEffect(() => {
    if (routePolyline && routePolyline.length > 0) {
      const polylineKey = JSON.stringify(routePolyline);
      if (lastPolylineFitKey.current === polylineKey) {
        return;
      }

      lastPolylineFitKey.current = polylineKey;

      // Auto-zoom to fit the route
      mapRef.current?.fitToCoordinates(routePolyline, {
        edgePadding: { top: 50, right: 50, bottom: 300, left: 50 },
        animated: true,
      });
    }
  }, [routePolyline]);

  const loadUserLocation = async () => {
    try {
      setLoading(true);
      const location = await getCurrentLocation();

      if (location) {
        setUserLocation(location);

        // Center map on user location
        const newRegion: Region = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };

        setRegion(newRegion);

        // Only auto-center once and only when no explicit initial region is provided.
        if (!initialRegion && !hasAppliedInitialUserCenter.current) {
          hasAppliedInitialUserCenter.current = true;
          mapRef.current?.animateToRegion(newRegion, 1000);
        }
      } else {
        setError('Location not available. Using default location.');
      }
    } catch (err) {
      console.error('Error loading location:', err);
      setError('Failed to load location');
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (newRegion: Region) => {
    setRegion(newRegion);
    onRegionChange?.(newRegion);
  };

  const handleCenterUserLocation = () => {
    if (userLocation) {
      const newRegion: Region = {
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      mapRef.current?.animateToRegion(newRegion, 1000);
    } else {
      loadUserLocation();
    }
  };

  const handleCreateReport = async (type: ReportType) => {
    try {
      setSubmitting(true);
      const coords = region || DEFAULT_REGION;
      const newR = await reportService.addReport({
        latitude: coords.latitude,
        longitude: coords.longitude,
        type,
      });
      setReports((p) => [...p, newR]);
    } catch (err) {
      console.warn('create report error', err);
    } finally {
      setSubmitting(false);
      setShowReportMenu(false);
    }
  };

  const handleConfirm = async (id: string) => {
    await reportService.confirmReport(id);
    loadReports();
  };

  const handleDismiss = async (id: string) => {
    await reportService.dismissReport(id);
    loadReports();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.BACKGROUND }, style]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.BACKGROUND }]}>
          <ActivityIndicator size="large" color={theme.PRIMARY} />
          <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>Loading map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.BACKGROUND }, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        mapType="standard"
        loadingEnabled={true}
        customMapStyle={isDark ? DARK_MAP_STYLE : GREEN_MAP_STYLE}
      >
        {/* Route Polyline */}
        {routePolyline && routePolyline.length > 0 && (
          <Polyline
            coordinates={routePolyline}
            strokeWidth={5}
            strokeColor={theme.PRIMARY}
          />
        )}

        {/* Directions - only use Google Directions API if a real API key is provided */}
        {directions && directions.apikey && 
         !directions.apikey.includes('YOUR_') && 
         !directions.apikey.includes('ACTUAL') && 
         !directions.apikey.includes('HERE') &&
         directions.apikey.length > 20 && (
          <MapViewDirections
            origin={directions.origin}
            destination={directions.destination}
            apikey={directions.apikey}
            strokeWidth={5}
            strokeColor={theme.PRIMARY}
            onReady={(result) => {
              if (result.coordinates && result.coordinates.length > 0) {
                const directionsFitKey = JSON.stringify({
                  origin: directions.origin,
                  destination: directions.destination,
                });

                if (lastDirectionsFitKey.current === directionsFitKey) {
                  return;
                }

                lastDirectionsFitKey.current = directionsFitKey;

                // Fit to coordinates
                mapRef.current?.fitToCoordinates(result.coordinates, {
                  edgePadding: { top: 50, right: 50, bottom: 300, left: 50 },
                  animated: true,
                });
              }
            }}
            onError={(errorMessage) => {
              console.error('Directions error:', errorMessage);
            }}
          />
        )}

        {/* Pulsing user location dot */}
        {userLocation && showUserLocation && (
          <Marker
            coordinate={userLocation.coords}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Your Location"
            description={userLocation.address || 'Current location'}
          >
            <View style={styles.locationDotContainer}>
              <Animated.View style={[
                styles.locationDotRing,
                {
                  backgroundColor: theme.PRIMARY + '40',
                  transform: [{
                    scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }),
                  }],
                  opacity: pulseAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.7, 0.3, 0] }),
                },
              ]} />
              <View style={styles.locationDotOuter}>
                <View style={[styles.locationDotInner, { backgroundColor: theme.PRIMARY }]} />
              </View>
            </View>
          </Marker>
        )}

        {/* Custom markers */}
        {markers.map((marker) => (
          <Marker
            key={marker.id}
            coordinate={marker.coordinate}
            title={marker.title}
            description={marker.description}
            onPress={() => onMarkerPress?.(marker)}
            pinColor={marker.icon ? undefined : theme.ACCENT}
          />
        ))}

        {/* Reports from users */}
        {reports.map((r) => {
          const markerColor = r.type === 'Security' ? '#FF453A' : r.type === 'Traffic' ? '#FF9F0A' : '#FFD60A';
          const markerIcon  = r.type === 'Security' ? 'shield-half-outline' : r.type === 'Traffic' ? 'car-outline' : 'warning-outline';
          return (
            <React.Fragment key={r.id}>
              <Marker coordinate={{ latitude: r.latitude, longitude: r.longitude }}>
                <View style={[styles.reportMarker, { backgroundColor: markerColor }]}>
                  <Ionicons name={markerIcon as any} size={16} color="#FFFFFF" />
                </View>
                <Callout onPress={() => {}} tooltip={false}>
                  <View style={{ width: 220, padding: 10 }}>
                    <Text style={{ fontWeight: '700', marginBottom: 4, fontSize: 15 }}>{r.type} Alert</Text>
                    <Text style={{ marginBottom: 6, color: theme.TEXT_SECONDARY, fontSize: 13 }}>
                      {new Date(r.createdAt).toLocaleString()}
                    </Text>
                    <Text style={{ marginBottom: 8, fontSize: 13 }}>
                      Confirms: {r.confirms} · Dismisses: {r.dismisses}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => handleConfirm(r.id)}
                        style={{ flex: 1, padding: 8, backgroundColor: theme.PRIMARY, borderRadius: 8, alignItems: 'center' }}
                      >
                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Confirm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDismiss(r.id)}
                        style={{ flex: 1, padding: 8, backgroundColor: theme.SURFACE, borderRadius: 8, alignItems: 'center' }}
                      >
                        <Text style={{ fontWeight: '600', fontSize: 13, color: theme.TEXT }}>Dismiss</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Callout>
              </Marker>

              {r.type === 'Security' && (
                <Circle
                  center={{ latitude: r.latitude, longitude: r.longitude }}
                  radius={150}
                  fillColor="rgba(255,69,58,0.12)"
                  strokeColor="rgba(255,69,58,0.5)"
                />
              )}
            </React.Fragment>
          );
        })}
      </MapView>

      {/* Center user location button — hidden when parent provides its own controls */}
      {showUserLocation && !hideCenterButton && (
        <TouchableOpacity
          style={[styles.centerButton, { backgroundColor: theme.CARD_BACKGROUND }]}
          onPress={handleCenterUserLocation}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={20} color={theme.PRIMARY} />
        </TouchableOpacity>
      )}

      {/* Floating Report button + menu */}
      <View style={styles.reportContainer} pointerEvents="box-none">
        {showReportMenu ? (
          <View style={[styles.reportMenu, { backgroundColor: theme.CARD_BACKGROUND }]}>
            {([
              { type: 'Traffic',  icon: 'car-outline',          color: '#FF9F0A' },
              { type: 'Hazard',   icon: 'warning-outline',      color: '#FFD60A' },
              { type: 'Security', icon: 'shield-half-outline',  color: '#FF453A' },
            ] as const).map((item) => (
              <TouchableOpacity
                key={item.type}
                style={styles.reportItem}
                onPress={() => handleCreateReport(item.type as any)}
                disabled={submitting}
              >
                <Ionicons name={item.icon} size={18} color={item.color} />
                <Text style={[styles.reportItemText, { color: theme.TEXT }]}>{item.type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.reportItem, styles.reportCancelItem]} onPress={() => setShowReportMenu(false)}>
              <Ionicons name="close" size={16} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.reportItemText, { color: theme.TEXT_SECONDARY }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.reportButton, { backgroundColor: theme.PRIMARY }]}
            onPress={() => setShowReportMenu(true)}
          >
            <Ionicons name="alert-circle-outline" size={16} color="#fff" />
            <Text style={styles.reportButtonText}>Report</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Error message */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.CARD_BACKGROUND, borderLeftColor: theme.WARNING }]}>
          <Text style={[styles.errorText, { color: theme.TEXT }]}>{error}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  loadingText: {
    fontSize: FONT_SIZES.BODY,
  },
  centerButton: {
    position: 'absolute',
    bottom: SPACING.LG,
    right: SPACING.MD,
    width: 44,
    height: 44,
    borderRadius: BORDER_RADIUS.ROUND,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  errorContainer: {
    position: 'absolute',
    top: SPACING.MD,
    left: SPACING.MD,
    right: SPACING.MD,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
    borderLeftWidth: 3,
  },
  errorText: {
    fontSize: FONT_SIZES.CAPTION,
  },
  reportContainer: {
    position: 'absolute',
    left: SPACING.MD,
    bottom: SPACING.LG,
    alignItems: 'center',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  reportButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  reportMenu: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 14,
    minWidth: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  reportItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  reportItemText: {
    fontSize: 15,
    fontWeight: '500',
  },
  reportCancelItem: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  // ── Pulsing location dot ──────────────────────────────────────────────────────
  locationDotContainer: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationDotRing: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  locationDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  locationDotInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  reportMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
});

