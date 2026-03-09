import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
} from 'react-native';
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
  style?: any;
}

// Default region for Lagos, Nigeria
const DEFAULT_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

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
  style,
}) => {
  const { theme } = useAppTheme();
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState<Region>(initialRegion || DEFAULT_REGION);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

        // Animate to user location
        mapRef.current?.animateToRegion(newRegion, 1000);
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
        region={region}
        onRegionChangeComplete={handleRegionChange}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        mapType="standard"
        loadingEnabled={true}
        customMapStyle={GREEN_MAP_STYLE}
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

        {/* User location marker */}
        {userLocation && showUserLocation && (
          <Marker
            coordinate={userLocation.coords}
            title="Your Location"
            description={userLocation.address || 'Current location'}
            pinColor={theme.PRIMARY}
          />
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
        {reports.map((r) => (
          <React.Fragment key={r.id}>
            <Marker coordinate={{ latitude: r.latitude, longitude: r.longitude }}>
              <View style={{ padding: 6, backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#ddd' }}>
                <Text style={{ fontSize: 18 }}>{r.type === 'Security' ? '🔴' : r.type === 'Traffic' ? '🚗' : '⚠️'}</Text>
              </View>
              <Callout onPress={() => {}} tooltip={false}>
                <View style={{ width: 220, padding: 8 }}>
                  <Text style={{ fontWeight: '700', marginBottom: 4 }}>{r.type} Alert</Text>
                  <Text style={{ marginBottom: 6, color: theme.TEXT_SECONDARY }}>{new Date(r.createdAt).toLocaleString()}</Text>
                  <Text style={{ marginBottom: 6 }}>Confirms: {r.confirms} · Dismisses: {r.dismisses}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <TouchableOpacity onPress={() => handleConfirm(r.id)} style={{ padding: 8, backgroundColor: theme.PRIMARY, borderRadius: 6 }}>
                      <Text style={{ color: '#fff' }}>Confirm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDismiss(r.id)} style={{ padding: 8, backgroundColor: '#bbb', borderRadius: 6 }}>
                      <Text>Dismiss</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Callout>
            </Marker>

            {/* Security circle */}
            {r.type === 'Security' && (
              <Circle
                center={{ latitude: r.latitude, longitude: r.longitude }}
                radius={150}
                fillColor={'rgba(255,0,0,0.15)'}
                strokeColor={'rgba(255,0,0,0.6)'}
              />
            )}
          </React.Fragment>
        ))}
      </MapView>

      {/* Center user location button */}
      {showUserLocation && (
        <TouchableOpacity
          style={[styles.centerButton, { backgroundColor: theme.CARD_BACKGROUND }]}
          onPress={handleCenterUserLocation}
          activeOpacity={0.7}
        >
          <Text style={styles.centerButtonIcon}>📍</Text>
        </TouchableOpacity>
      )}

      {/* Floating Report button + menu */}
      <View style={styles.reportContainer} pointerEvents="box-none">
        {showReportMenu ? (
          <View style={[styles.reportMenu, { backgroundColor: theme.CARD_BACKGROUND }]}>
            <TouchableOpacity style={styles.reportItem} onPress={() => handleCreateReport('Traffic')} disabled={submitting}>
              <Text>🚗 Traffic</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportItem} onPress={() => handleCreateReport('Hazard')} disabled={submitting}>
              <Text>⚠️ Hazard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportItem} onPress={() => handleCreateReport('Security')} disabled={submitting}>
              <Text>🔴 Security</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.reportItem, { backgroundColor: 'transparent' }]} onPress={() => setShowReportMenu(false)}>
              <Text style={{ color: theme.TEXT_SECONDARY }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.reportButton, { backgroundColor: theme.PRIMARY }]} onPress={() => setShowReportMenu(true)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Report</Text>
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
    borderRadius: BORDER_RADIUS.MEDIUM,
    overflow: 'hidden',
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
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.ROUND,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  centerButtonIcon: {
    fontSize: FONT_SIZES.HEADING_2,
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
    width: 88,
    height: 48,
    borderRadius: BORDER_RADIUS.MEDIUM,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  reportMenu: {
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
  },
  reportItem: {
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
  },
});

