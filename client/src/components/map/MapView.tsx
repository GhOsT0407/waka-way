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
import MapboxGL from '@rnmapbox/maps';
import { getCurrentLocation, LocationData } from '../../services/locationService';
import reportService, { Report as ReportItem, ReportType } from '../../services/reportService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';
import { initMapbox, toLngLat, boundsFromCoords, circlePolygon } from '../../utils/mapboxInit';

initMapbox();

// Legacy Region type — kept for API compat with callers
export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

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
  onMarkerPress?: (marker: any) => void;
  onRegionChange?: (region: Region) => void;
  showUserLocation?: boolean;
  hideCenterButton?: boolean;
  style?: any;
}

const LAGOS: [number, number] = [3.3792, 6.5244];
const DEFAULT_ZOOM = 12;

export const WakaWayMapView: React.FC<WakaWayMapViewProps> = ({
  initialRegion,
  markers = [],
  routePolyline,
  onMarkerPress,
  onRegionChange,
  showUserLocation = true,
  hideCenterButton = false,
  style,
}) => {
  const { theme } = useAppTheme();
  const cameraRef = useRef<MapboxGL.Camera>(null);

  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [reports, setReports]           = useState<ReportItem[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    (async () => {
      await loadUserLocation();
      await loadReports();
      setLoading(false);
    })();

    const interval = setInterval(async () => {
      const refreshed = await reportService.cleanupExpired();
      setReports(refreshed);
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  // Fit camera to route polyline when it changes
  useEffect(() => {
    if (!routePolyline || routePolyline.length < 2) return;
    const lngLats = routePolyline.map(p => toLngLat(p.latitude, p.longitude));
    const { ne, sw } = boundsFromCoords(lngLats);
    cameraRef.current?.fitBounds(ne, sw, [60, 60, 320, 60], 800);
  }, [routePolyline]);

  const loadUserLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setUserLocation(loc);
        cameraRef.current?.setCamera({
          centerCoordinate: toLngLat(loc.coords.latitude, loc.coords.longitude),
          zoomLevel: 14,
          animationDuration: 1000,
        });
      }
    } catch {
      // fall back to Lagos default
    }
  };

  const loadReports = async () => {
    try {
      const rs = await reportService.getReports(true);
      setReports(rs);
    } catch {}
  };

  const handleCenterUserLocation = () => {
    if (userLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: toLngLat(userLocation.coords.latitude, userLocation.coords.longitude),
        zoomLevel: 14,
        animationDuration: 800,
      });
    } else {
      loadUserLocation();
    }
  };

  const handleCreateReport = async (type: ReportType) => {
    try {
      setSubmitting(true);
      const loc = userLocation?.coords ?? { latitude: 6.5244, longitude: 3.3792 };
      const newR = await reportService.addReport({
        latitude: loc.latitude,
        longitude: loc.longitude,
        type,
      });
      setReports(p => [...p, newR]);
    } catch {}
    finally {
      setSubmitting(false);
      setShowReportMenu(false);
    }
  };

  const handleConfirm = async (id: string) => {
    await reportService.confirmReport(id);
    loadReports();
    setSelectedReport(null);
  };

  const handleDismiss = async (id: string) => {
    await reportService.dismissReport(id);
    loadReports();
    setSelectedReport(null);
  };

  // Build route GeoJSON
  const routeGeoJSON: GeoJSON.Feature<GeoJSON.LineString> | null =
    routePolyline && routePolyline.length >= 2
      ? {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: routePolyline.map(p => toLngLat(p.latitude, p.longitude)),
          },
          properties: {},
        }
      : null;

  const initCoord = initialRegion
    ? toLngLat(initialRegion.latitude, initialRegion.longitude)
    : LAGOS;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.BACKGROUND }, style]}>
        <ActivityIndicator size="large" color={theme.PRIMARY} />
        <Text style={[styles.loadingText, { color: theme.TEXT_SECONDARY }]}>Loading map…</Text>
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

        {showUserLocation && <MapboxGL.UserLocation visible androidRenderMode="normal" />}

        {/* Route polyline */}
        {routeGeoJSON && (
          <MapboxGL.ShapeSource id="routeSource" shape={routeGeoJSON}>
            <MapboxGL.LineLayer
              id="routeLayer"
              style={{
                lineColor: '#22C55E',
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </MapboxGL.ShapeSource>
        )}

        {/* Custom markers */}
        {markers.map(m => (
          <MapboxGL.MarkerView
            key={m.id}
            coordinate={toLngLat(m.coordinate.latitude, m.coordinate.longitude)}
          >
            <TouchableOpacity
              style={[styles.customMarker, { backgroundColor: theme.PRIMARY }]}
              onPress={() => onMarkerPress?.(m)}
            >
              <Ionicons name="location" size={16} color="#fff" />
            </TouchableOpacity>
          </MapboxGL.MarkerView>
        ))}

        {/* Report markers + danger-zone circles */}
        {reports.map(r => {
          const markerColor = r.type === 'Security' ? '#FF453A' : r.type === 'Traffic' ? '#FF9F0A' : '#FFD60A';
          const markerIcon  = r.type === 'Security' ? 'shield-half-outline' : r.type === 'Traffic' ? 'car-outline' : 'warning-outline';
          const isSelected  = selectedReport?.id === r.id;

          return (
            <React.Fragment key={r.id}>
              {r.type === 'Security' && (
                <MapboxGL.ShapeSource
                  id={`circle-${r.id}`}
                  shape={circlePolygon(r.longitude, r.latitude, 150)}
                >
                  <MapboxGL.FillLayer
                    id={`fill-${r.id}`}
                    style={{ fillColor: 'rgba(255,69,58,0.12)', fillOutlineColor: 'rgba(255,69,58,0.5)' }}
                  />
                </MapboxGL.ShapeSource>
              )}
              <MapboxGL.MarkerView coordinate={toLngLat(r.latitude, r.longitude)}>
                <TouchableOpacity
                  style={[styles.reportMarker, { backgroundColor: markerColor }]}
                  onPress={() => setSelectedReport(isSelected ? null : r)}
                >
                  <Ionicons name={markerIcon as any} size={16} color="#fff" />
                </TouchableOpacity>
              </MapboxGL.MarkerView>
            </React.Fragment>
          );
        })}
      </MapboxGL.MapView>

      {/* Report callout popup */}
      {selectedReport && (
        <View style={[styles.callout, { backgroundColor: theme.CARD_BACKGROUND }]}>
          <Text style={[styles.calloutTitle, { color: theme.TEXT }]}>
            {selectedReport.type} Alert
          </Text>
          <Text style={[styles.calloutMeta, { color: theme.TEXT_SECONDARY }]}>
            {new Date(selectedReport.createdAt).toLocaleString()}
          </Text>
          <Text style={[styles.calloutMeta, { color: theme.TEXT_SECONDARY }]}>
            Confirms: {selectedReport.confirms} · Dismisses: {selectedReport.dismisses}
          </Text>
          <View style={styles.calloutActions}>
            <TouchableOpacity
              style={[styles.calloutBtn, { backgroundColor: theme.PRIMARY }]}
              onPress={() => handleConfirm(selectedReport.id)}
            >
              <Text style={styles.calloutBtnText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.calloutBtn, { backgroundColor: theme.SURFACE }]}
              onPress={() => handleDismiss(selectedReport.id)}
            >
              <Text style={[styles.calloutBtnText, { color: theme.TEXT }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Center button */}
      {showUserLocation && !hideCenterButton && (
        <TouchableOpacity
          style={[styles.centerButton, { backgroundColor: theme.CARD_BACKGROUND }]}
          onPress={handleCenterUserLocation}
          activeOpacity={0.7}
        >
          <Ionicons name="locate" size={20} color={theme.PRIMARY} />
        </TouchableOpacity>
      )}

      {/* Report FAB */}
      <View style={styles.reportContainer} pointerEvents="box-none">
        {showReportMenu ? (
          <View style={[styles.reportMenu, { backgroundColor: theme.CARD_BACKGROUND }]}>
            {([
              { type: 'Traffic',  icon: 'car-outline',         color: '#FF9F0A' },
              { type: 'Hazard',   icon: 'warning-outline',     color: '#FFD60A' },
              { type: 'Security', icon: 'shield-half-outline', color: '#FF453A' },
            ] as const).map(item => (
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
            <TouchableOpacity
              style={[styles.reportItem, styles.reportCancelItem]}
              onPress={() => setShowReportMenu(false)}
            >
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1, width: '100%', height: '100%' },
  loadingText: { marginTop: 12, fontSize: FONT_SIZES.BODY },

  customMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  reportMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  callout: {
    position: 'absolute',
    bottom: 140,
    left: SPACING.MD,
    right: SPACING.MD,
    borderRadius: 14,
    padding: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  calloutTitle: { fontSize: FONT_SIZES.BODY, fontWeight: '700', marginBottom: 4 },
  calloutMeta:  { fontSize: FONT_SIZES.SMALL, marginBottom: 2 },
  calloutActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  calloutBtn: {
    flex: 1,
    padding: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  calloutBtnText: { color: '#fff', fontWeight: '600', fontSize: FONT_SIZES.SMALL },

  centerButton: {
    position: 'absolute',
    bottom: SPACING.LG,
    right: SPACING.MD,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
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
  reportButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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
  reportItemText: { fontSize: 15, fontWeight: '500' },
  reportCancelItem: {
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
});
