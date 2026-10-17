import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { Space, HIT } from '../../theme/spacing';
import { GOOGLE_MAPS_DARK_STYLE, GOOGLE_MAPS_LIGHT_STYLE } from '../../utils/constants';

// The map behind Home. It draws where you are and, when asked, a line and
// some pins — nothing else. Reports live on the Live tab and the Report tab;
// this map no longer files or votes on anything.

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface WakaWayMapViewProps {
  initialRegion?: Region;
  /** Re-centres the camera when it changes (e.g. once the GPS fix lands). */
  centerOn?: { latitude: number; longitude: number } | null;
  markers?: Array<{
    id: string;
    coordinate: { latitude: number; longitude: number };
    title?: string;
    description?: string;
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
  centerOn,
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

  useEffect(() => {
    if (!centerOn || !mapRef.current) return;
    mapRef.current.animateToRegion({ ...centerOn, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
  }, [centerOn?.latitude, centerOn?.longitude]);

  useEffect(() => {
    if (!routePolyline || routePolyline.length < 2 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(routePolyline, {
      edgePadding: { top: 60, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }, [routePolyline]);

  const recenter = () => {
    if (!centerOn) return;
    mapRef.current?.animateToRegion({ ...centerOn, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 800);
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={initialRegion ?? LAGOS_REGION}
        onRegionChangeComplete={onRegionChange}
        customMapStyle={isDark ? GOOGLE_MAPS_DARK_STYLE as any : GOOGLE_MAPS_LIGHT_STYLE as any}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {routePolyline && routePolyline.length >= 2 && (
          <Polyline coordinates={routePolyline} strokeColor={WW.green} strokeWidth={5} lineCap="round" lineJoin="round" />
        )}
        {markers.map((m) => (
          <Marker key={m.id} coordinate={m.coordinate} title={m.title} description={m.description} onPress={() => onMarkerPress?.(m)}>
            <View style={[styles.marker, { backgroundColor: WW.orange, borderColor: WW.bgSurface }]}>
              <Ionicons name="location" size={16} color={WW.danfoText} />
            </View>
          </Marker>
        ))}
      </MapView>

      {showUserLocation && !hideCenterButton && (
        <TouchableOpacity
          style={[styles.centerButton, { backgroundColor: WW.bgElevated, borderColor: WW.border }]}
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Centre the map on me"
        >
          <Ionicons name="locate" size={20} color={WW.orange} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map:       { flex: 1, width: '100%', height: '100%' },
  marker: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
  centerButton: {
    position: 'absolute', bottom: Space.xl, right: Space.lg,
    width: HIT, height: HIT, borderRadius: HIT / 2,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5,
  },
});

export default WakaWayMapView;
