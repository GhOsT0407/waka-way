import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentLocation, LocationData } from '../../services/locationService';
import reportService, { Report as ReportItem, ReportType } from '../../services/reportService';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, FONT_SIZES, GOOGLE_MAPS_DARK_STYLE, GOOGLE_MAPS_LIGHT_STYLE } from '../../utils/constants';
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

const LAGOS_REGION: Region = {
  latitude: 6.5244,
  longitude: 3.3792,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

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
  const { WW, isDark } = useAppTheme();
  const mapRef = useRef<MapView>(null);

  const [userLocation, setUserLocation] = useState<LocationData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [reports, setReports]           = useState<ReportItem[]>([]);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [submitting, setSubmitting]     = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);

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
    if (!routePolyline || routePolyline.length < 2 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(routePolyline, {
      edgePadding: { top: 60, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }, [routePolyline]);

  const loadUserLocation = async () => {
    try {
      const loc = await getCurrentLocation();
      if (loc) {
        setUserLocation(loc);
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 800);
      }
    } catch {}
  };

  const loadReports = async () => {
    try { setReports(await reportService.getReports(true)); } catch {}
  };

  const handleCenterUserLocation = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);
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

  const region: Region = initialRegion ?? LAGOS_REGION;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: WW.bg }, style]}>
        <WakaWaySpinner size={72} label="LOADING MAP" />
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
        onRegionChangeComplete={onRegionChange}
        customMapStyle={isDark ? GOOGLE_MAPS_DARK_STYLE as any : GOOGLE_MAPS_LIGHT_STYLE as any}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Route polyline */}
        {routePolyline && routePolyline.length >= 2 && (
          <Polyline
            coordinates={routePolyline}
            strokeColor={WW.green}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Custom markers */}
        {markers.map(m => (
          <Marker
            key={m.id}
            coordinate={m.coordinate}
            title={m.title}
            description={m.description}
            onPress={() => onMarkerPress?.(m)}
          >
            <View style={[styles.customMarker, { backgroundColor: WW.orange }]}>
              <Ionicons name="location" size={16} color={WW.danfoText} />
            </View>
          </Marker>
        ))}

        {/* Report markers */}
        {reports.map(r => {
          const markerColor = r.type === 'Security' ? WW.error : r.type === 'Traffic' ? WW.warning : WW.stripe;
          const markerIcon  = r.type === 'Security' ? 'shield-half-outline' : r.type === 'Traffic' ? 'car-outline' : 'warning-outline';
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.latitude, longitude: r.longitude }}
              onPress={() => setSelectedReport(selectedReport?.id === r.id ? null : r)}
            >
              <View style={[styles.reportMarker, { backgroundColor: markerColor }]}>
                <Ionicons name={markerIcon as any} size={14} color="#fff" />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Report callout */}
      {selectedReport && (
        <View style={[styles.callout, { backgroundColor: WW.bgElevated, borderColor: WW.border }]}>
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
        <TouchableOpacity style={[styles.centerButton, { backgroundColor: WW.bgElevated, borderColor: WW.border }]} onPress={handleCenterUserLocation}>
          <Ionicons name="locate" size={20} color={WW.orange} />
        </TouchableOpacity>
      )}

      {/* Report FAB */}
      <View style={styles.reportContainer} pointerEvents="box-none">
        {showReportMenu ? (
          <View style={[styles.reportMenu, { backgroundColor: WW.bgElevated, borderColor: WW.border }]}>
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
            <TouchableOpacity style={[styles.reportItem, styles.reportCancelItem, { borderTopColor: WW.divider }]} onPress={() => setShowReportMenu(false)}>
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  reportItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10 },
  reportItemText: { fontSize: 15, fontWeight: '500' },
  reportCancelItem: { marginTop: 2, borderTopWidth: StyleSheet.hairlineWidth },
});

export default WakaWayMapView;
