import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import MapLibreGL from '@maplibre/maplibre-react-native';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, LocationData } from '../../services/locationService';
import reportService, { Report as ReportItem, ReportType } from '../../services/reportService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES, MAPTILER_DARK_STYLE } from '../../utils/constants';
import { WW } from '../../theme/colors';
import { WakaWaySpinner } from '../WakaWaySpinner';

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

const LAGOS_CENTER: [number, number] = [3.3792, 6.5244]; // [lng, lat]
const LAGOS_ZOOM = 13;

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
  useAppTheme();
  const cameraRef = useRef<MapLibreGL.Camera>(null);

  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [mapError, setMapError]         = useState(false);
  const [reports, setReports]           = useState<ReportItem[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    (async () => {
      await loadUserLocation();
      await loadReports();
      setLoading(false);
    })();

    const interval = setInterval(async () => {
      setReports(await reportService.cleanupExpired());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  // Fit camera to route polyline when it changes
  useEffect(() => {
    if (!routePolyline || routePolyline.length < 2 || !cameraRef.current) return;
    const lngs = routePolyline.map(c => c.longitude);
    const lats  = routePolyline.map(c => c.latitude);
    cameraRef.current.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      [60, 60, 320, 60],
      500,
    );
  }, [routePolyline]);

  const loadUserLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setUserLocation(loc);
        cameraRef.current?.setCamera({
          centerCoordinate: [loc.coords.longitude, loc.coords.latitude],
          zoomLevel: 15,
          animationDuration: 800,
          animationMode: 'easeTo',
        });
      }
    } catch {}
  };

  const loadReports = async () => {
    try { setReports(await reportService.getReports(true)); } catch {}
  };

  const handleCenterUserLocation = () => {
    if (userLocation) {
      cameraRef.current?.setCamera({
        centerCoordinate: [userLocation.coords.longitude, userLocation.coords.latitude],
        zoomLevel: 15,
        animationDuration: 800,
        animationMode: 'easeTo',
      });
    } else {
      loadUserLocation();
    }
  };

  const handleCreateReport = async (type: ReportType) => {
    try {
      setSubmitting(true);
      const loc  = userLocation?.coords ?? { latitude: 6.5244, longitude: 3.3792 };
      const newR = await reportService.addReport({ latitude: loc.latitude, longitude: loc.longitude, type });
      setReports(p => [...p, newR]);
    } catch {}
    finally { setSubmitting(false); setShowReportMenu(false); }
  };

  const handleConfirm = async (id: string) => {
    await reportService.confirmReport(id); loadReports(); setSelectedReport(null);
  };
  const handleDismiss = async (id: string) => {
    await reportService.dismissReport(id); loadReports(); setSelectedReport(null);
  };

  const initialCenter: [number, number] = initialRegion
    ? [initialRegion.longitude, initialRegion.latitude]
    : LAGOS_CENTER;

  // Build GeoJSON for route polyline
  const routeGeoJson: GeoJSON.Feature<GeoJSON.LineString> | null =
    routePolyline && routePolyline.length >= 2
      ? {
          type:     'Feature',
          properties: {},
          geometry: {
            type:        'LineString',
            coordinates: routePolyline.map(c => [c.longitude, c.latitude]),
          },
        }
      : null;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: WW.bg }, style]}>
        <WakaWaySpinner size={72} label="LOADING MAP" />
      </View>
    );
  }

  if (mapError) {
    return (
      <View style={[styles.container, { backgroundColor: WW.bg }, style]}>
        <Ionicons name="map-outline" size={40} color={WW.textMuted} />
        <Text style={[styles.loadingText, { color: WW.textMuted, marginTop: 12 }]}>
          Map unavailable
        </Text>
        <Text style={{ color: WW.textMuted, fontSize: 12, textAlign: 'center', paddingHorizontal: 32, marginTop: 4 }}>
          Check EXPO_PUBLIC_MAPTILER_KEY in your .env file
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <MapLibreGL.MapView
        style={styles.map}
        styleURL={MAPTILER_DARK_STYLE}
        onDidFailLoadingMap={() => setMapError(true)}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
      >
        <MapLibreGL.Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: initialCenter, zoomLevel: LAGOS_ZOOM }}
        />

        {showUserLocation && <MapLibreGL.UserLocation visible />}

        {/* Route polyline */}
        {routeGeoJson && (
          <MapLibreGL.ShapeSource id="route-source" shape={routeGeoJson}>
            <MapLibreGL.LineLayer
              id="route-line"
              style={{ lineColor: WW.green, lineWidth: 5, lineCap: 'round', lineJoin: 'round' }}
            />
          </MapLibreGL.ShapeSource>
        )}

        {/* Custom markers */}
        {markers.map(m => (
          <MapLibreGL.PointAnnotation
            key={m.id}
            id={`marker-${m.id}`}
            coordinate={[m.coordinate.longitude, m.coordinate.latitude]}
            onSelected={() => onMarkerPress?.(m)}
          >
            <View style={[styles.customMarker, { backgroundColor: WW.orange }]}>
              <Ionicons name="location" size={16} color={WW.danfoText} />
            </View>
          </MapLibreGL.PointAnnotation>
        ))}

        {/* Report markers */}
        {reports.map(r => {
          const markerColor = r.type === 'Security' ? WW.error : r.type === 'Traffic' ? WW.warning : WW.stripe;
          const markerIcon  = r.type === 'Security' ? 'shield-half-outline' : r.type === 'Traffic' ? 'car-outline' : 'warning-outline';
          return (
            <MapLibreGL.PointAnnotation
              key={r.id}
              id={`report-${r.id}`}
              coordinate={[r.longitude, r.latitude]}
              onSelected={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
            >
              <View style={[styles.reportMarker, { backgroundColor: markerColor }]}>
                <Ionicons name={markerIcon as any} size={14} color="#fff" />
              </View>
            </MapLibreGL.PointAnnotation>
          );
        })}
      </MapLibreGL.MapView>

      {/* Report callout */}
      {selectedReport && (
        <View style={[styles.callout, { backgroundColor: WW.bgElevated }]}>
          <Text style={[styles.calloutTitle, { color: WW.text }]}>{selectedReport.type} Alert</Text>
          <Text style={[styles.calloutMeta, { color: WW.textSub }]}>
            {new Date(selectedReport.createdAt).toLocaleString()}
          </Text>
          <Text style={[styles.calloutMeta, { color: WW.textSub }]}>
            Confirms: {selectedReport.confirms} · Dismisses: {selectedReport.dismisses}
          </Text>
          <View style={styles.calloutActions}>
            <TouchableOpacity style={[styles.calloutBtn, { backgroundColor: WW.orange }]} onPress={() => handleConfirm(selectedReport.id)}>
              <Text style={[styles.calloutBtnText, { color: WW.danfoText }]}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.calloutBtn, { backgroundColor: WW.bgSurface }]} onPress={() => handleDismiss(selectedReport.id)}>
              <Text style={[styles.calloutBtnText, { color: WW.text }]}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Center button */}
      {showUserLocation && !hideCenterButton && (
        <TouchableOpacity style={[styles.centerButton, { backgroundColor: WW.bgElevated }]} onPress={handleCenterUserLocation}>
          <Ionicons name="locate" size={20} color={WW.orange} />
        </TouchableOpacity>
      )}

      {/* Report FAB */}
      <View style={styles.reportContainer} pointerEvents="box-none">
        {showReportMenu ? (
          <View style={[styles.reportMenu, { backgroundColor: WW.bgElevated }]}>
            {([
              { type: 'Traffic',  icon: 'car-outline',         color: WW.warning },
              { type: 'Hazard',   icon: 'warning-outline',     color: WW.stripe  },
              { type: 'Security', icon: 'shield-half-outline', color: WW.error   },
            ] as const).map(item => (
              <TouchableOpacity key={item.type} style={styles.reportItem} onPress={() => handleCreateReport(item.type as any)} disabled={submitting}>
                <Ionicons name={item.icon} size={18} color={item.color} />
                <Text style={[styles.reportItemText, { color: WW.text }]}>{item.type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.reportItem, styles.reportCancelItem]} onPress={() => setShowReportMenu(false)}>
              <Ionicons name="close" size={16} color={WW.textSub} />
              <Text style={[styles.reportItemText, { color: WW.textSub }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.reportButton, { backgroundColor: WW.orange }]} onPress={() => setShowReportMenu(true)}>
            <Ionicons name="alert-circle-outline" size={16} color={WW.danfoText} />
            <Text style={[styles.reportButtonText, { color: WW.danfoText }]}>Report</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map:        { flex: 1, width: '100%', height: '100%' },
  loadingText:{ marginTop: 12, fontSize: FONT_SIZES.BODY },

  customMarker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  reportMarker: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },
  callout: {
    position: 'absolute', bottom: 140,
    left: SPACING.MD, right: SPACING.MD,
    borderRadius: 14, padding: SPACING.MD,
    borderWidth: 1, borderColor: WW.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 12, elevation: 10,
  },
  calloutTitle: { fontSize: FONT_SIZES.BODY, fontWeight: '700', marginBottom: 4 },
  calloutMeta:  { fontSize: FONT_SIZES.SMALL, marginBottom: 2 },
  calloutActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  calloutBtn:   { flex: 1, padding: 9, borderRadius: 9, alignItems: 'center' },
  calloutBtnText:{ fontWeight: '600', fontSize: FONT_SIZES.SMALL },

  centerButton: {
    position: 'absolute', bottom: SPACING.LG, right: SPACING.MD,
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: WW.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
  reportContainer: { position: 'absolute', left: SPACING.MD, bottom: SPACING.LG, alignItems: 'center' },
  reportButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, height: 44, borderRadius: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  reportButtonText: { fontWeight: '700', fontSize: 14 },
  reportMenu: {
    paddingVertical: 4, paddingHorizontal: 4,
    borderRadius: 14, minWidth: 160,
    borderWidth: 1, borderColor: WW.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  reportItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10 },
  reportItemText: { fontSize: 15, fontWeight: '500' },
  reportCancelItem: { marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: WW.divider },
});

export default WakaWayMapView;
