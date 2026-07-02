import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Contribution } from '../../hooks/useRealtimeContributions';

const MARKER_CONFIG: Record<string, {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  showCircle: boolean;
  circleRadius: number;
  priority: number;
}> = {
  security:    { color: '#D32F2F', icon: 'shield-outline',       showCircle: true,  circleRadius: 500, priority: 5 },
  danger_zone: { color: '#D32F2F', icon: 'warning-outline',      showCircle: true,  circleRadius: 300, priority: 5 },
  traffic:     { color: '#FF9800', icon: 'car-sport-outline',    showCircle: false, circleRadius: 0,   priority: 4 },
  hazard:      { color: '#FF5722', icon: 'alert-circle-outline', showCircle: true,  circleRadius: 200, priority: 4 },
  construction:{ color: '#FFC107', icon: 'construct-outline',    showCircle: false, circleRadius: 0,   priority: 3 },
  bus_stop:    { color: '#2196F3', icon: 'bus-outline',          showCircle: false, circleRadius: 0,   priority: 2 },
  taxi_stand:  { color: '#9C27B0', icon: 'car-outline',          showCircle: false, circleRadius: 0,   priority: 2 },
  other:       { color: '#607D8B', icon: 'help-circle-outline',  showCircle: false, circleRadius: 0,   priority: 1 },
};

interface AlertMarkersProps {
  contributions: Contribution[];
  onMarkerPress?: (contribution: Contribution) => void;
  filterTypes?: string[];
}

export const AlertMarkers: React.FC<AlertMarkersProps> = ({
  contributions,
  onMarkerPress,
  filterTypes,
}) => {
  const filtered = filterTypes
    ? contributions.filter(c => filterTypes.includes(c.type))
    : contributions;

  const sorted = [...filtered].sort((a, b) => {
    const pa = MARKER_CONFIG[a.type]?.priority ?? 0;
    const pb = MARKER_CONFIG[b.type]?.priority ?? 0;
    return pa - pb;
  });

  return (
    <>
      {sorted.map((contribution) => {
        const config = MARKER_CONFIG[contribution.type] ?? MARKER_CONFIG.other;

        return (
          <React.Fragment key={contribution.id}>
            {config.showCircle && (
              <Circle
                center={{ latitude: contribution.latitude, longitude: contribution.longitude }}
                radius={config.circleRadius}
                fillColor={`${config.color}33`}
                strokeColor={config.color}
                strokeWidth={1}
              />
            )}

            <Marker
              coordinate={{ latitude: contribution.latitude, longitude: contribution.longitude }}
              onPress={() => onMarkerPress?.(contribution)}
            >
              <View style={styles.markerWrapper}>
                <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                  <Ionicons name={config.icon} size={18} color="#FFFFFF" />
                </View>
                <View style={[styles.markerTip, { borderTopColor: config.color }]} />
              </View>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

export const TrafficMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['traffic']} />
);

export const SecurityMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['security', 'danger_zone']} />
);

export const HazardMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['hazard', 'construction']} />
);

export const TransportMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['bus_stop', 'taxi_stand']} />
);

const styles = StyleSheet.create({
  markerWrapper:   { alignItems: 'center' },
  markerContainer: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  markerTip: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'center', marginTop: -2,
  },
});

export default AlertMarkers;
