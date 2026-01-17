import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Marker, Circle, Callout } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Contribution } from '../../hooks/useRealtimeContributions';

// Marker configuration for each contribution type
const MARKER_CONFIG: Record<string, {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  showCircle: boolean;
  circleRadius: number; // in meters
  circleColor: string;
  priority: number; // for sorting (higher = more important)
}> = {
  security: {
    color: '#D32F2F', // Red
    icon: 'shield-outline',
    showCircle: true,
    circleRadius: 500, // 500m danger zone
    circleColor: 'rgba(211, 47, 47, 0.2)', // Translucent red
    priority: 5,
  },
  danger_zone: {
    color: '#D32F2F', // Red
    icon: 'warning-outline',
    showCircle: true,
    circleRadius: 300, // 300m danger zone
    circleColor: 'rgba(211, 47, 47, 0.25)',
    priority: 5,
  },
  traffic: {
    color: '#FF9800', // Orange
    icon: 'car-sport-outline',
    showCircle: false,
    circleRadius: 0,
    circleColor: '',
    priority: 4,
  },
  hazard: {
    color: '#FF5722', // Deep Orange
    icon: 'alert-circle-outline',
    showCircle: true,
    circleRadius: 200, // 200m hazard zone
    circleColor: 'rgba(255, 87, 34, 0.2)',
    priority: 4,
  },
  construction: {
    color: '#FFC107', // Amber
    icon: 'construct-outline',
    showCircle: false,
    circleRadius: 0,
    circleColor: '',
    priority: 3,
  },
  bus_stop: {
    color: '#2196F3', // Blue
    icon: 'bus-outline',
    showCircle: false,
    circleRadius: 0,
    circleColor: '',
    priority: 2,
  },
  taxi_stand: {
    color: '#9C27B0', // Purple
    icon: 'car-outline',
    showCircle: false,
    circleRadius: 0,
    circleColor: '',
    priority: 2,
  },
  other: {
    color: '#607D8B', // Blue Grey
    icon: 'help-circle-outline',
    showCircle: false,
    circleRadius: 0,
    circleColor: '',
    priority: 1,
  },
};

interface AlertMarkersProps {
  /** Array of contributions to display on the map */
  contributions: Contribution[];
  /** Callback when a marker is pressed */
  onMarkerPress?: (contribution: Contribution) => void;
  /** Whether to show info callouts on markers */
  showCallouts?: boolean;
  /** Filter to only show certain types */
  filterTypes?: string[];
}

/**
 * AlertMarkers Component
 * 
 * Renders contribution alerts on the map with type-specific styling:
 * - TRAFFIC: Orange marker
 * - SECURITY: Red marker with 500m translucent danger circle
 * - HAZARD: Deep orange marker with 200m zone
 * - CONSTRUCTION: Amber marker
 * - BUS_STOP: Blue marker
 * - TAXI_STAND: Purple marker
 * 
 * @example
 * ```tsx
 * <MapView>
 *   <AlertMarkers
 *     contributions={contributions}
 *     onMarkerPress={(c) => setSelectedAlert(c)}
 *   />
 * </MapView>
 * ```
 */
export const AlertMarkers: React.FC<AlertMarkersProps> = ({
  contributions,
  onMarkerPress,
  showCallouts = true,
  filterTypes,
}) => {
  // Filter contributions if filterTypes is specified
  const filteredContributions = filterTypes
    ? contributions.filter((c) => filterTypes.includes(c.type))
    : contributions;

  // Sort by priority (higher priority markers rendered on top)
  const sortedContributions = [...filteredContributions].sort((a, b) => {
    const priorityA = MARKER_CONFIG[a.type]?.priority || 0;
    const priorityB = MARKER_CONFIG[b.type]?.priority || 0;
    return priorityA - priorityB;
  });

  // Format relative time for callout
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      {sortedContributions.map((contribution) => {
        const config = MARKER_CONFIG[contribution.type] || MARKER_CONFIG.other;

        return (
          <React.Fragment key={contribution.id}>
            {/* Danger Zone Circle (for security/hazard types) */}
            {config.showCircle && (
              <Circle
                center={{
                  latitude: contribution.latitude,
                  longitude: contribution.longitude,
                }}
                radius={config.circleRadius}
                fillColor={config.circleColor}
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
              onPress={() => onMarkerPress?.(contribution)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              {/* Custom Marker View */}
              <View style={[styles.markerContainer, { backgroundColor: config.color }]}>
                <Ionicons name={config.icon} size={18} color="#FFFFFF" />
              </View>
              <View style={[styles.markerTip, { borderTopColor: config.color }]} />

              {/* Callout with contribution details */}
              {showCallouts && (
                <Callout tooltip onPress={() => onMarkerPress?.(contribution)}>
                  <View style={styles.calloutContainer}>
                    <View style={styles.calloutHeader}>
                      <View style={[styles.calloutTypeIcon, { backgroundColor: `${config.color}20` }]}>
                        <Ionicons name={config.icon} size={16} color={config.color} />
                      </View>
                      <Text style={[styles.calloutType, { color: config.color }]}>
                        {contribution.type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.calloutTitle} numberOfLines={2}>
                      {contribution.title}
                    </Text>

                    {contribution.description && (
                      <Text style={styles.calloutDescription} numberOfLines={2}>
                        {contribution.description}
                      </Text>
                    )}

                    {/* Image preview if available */}
                    {contribution.image_url && (
                      <Image
                        source={{ uri: contribution.image_url }}
                        style={styles.calloutImage}
                        resizeMode="cover"
                      />
                    )}

                    <View style={styles.calloutMeta}>
                      <Text style={styles.calloutTime}>
                        {formatRelativeTime(contribution.created_at)}
                      </Text>
                      <View style={styles.calloutStats}>
                        <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                        <Text style={styles.calloutStatText}>{contribution.confirms}</Text>
                        <Ionicons name="close-circle" size={14} color="#F44336" />
                        <Text style={styles.calloutStatText}>{contribution.dismisses}</Text>
                      </View>
                    </View>

                    {/* Danger zone warning for security/hazard */}
                    {config.showCircle && (
                      <View style={styles.dangerWarning}>
                        <Ionicons name="warning" size={14} color="#D32F2F" />
                        <Text style={styles.dangerText}>
                          {config.circleRadius}m danger zone
                        </Text>
                      </View>
                    )}
                  </View>
                </Callout>
              )}
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};

/**
 * TrafficMarkers - Convenience component for traffic alerts only
 */
export const TrafficMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['traffic']} />
);

/**
 * SecurityMarkers - Convenience component for security/danger alerts only
 */
export const SecurityMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['security', 'danger_zone']} />
);

/**
 * HazardMarkers - Convenience component for hazard/construction alerts only
 */
export const HazardMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['hazard', 'construction']} />
);

/**
 * TransportMarkers - Convenience component for bus/taxi stops only
 */
export const TransportMarkers: React.FC<Omit<AlertMarkersProps, 'filterTypes'>> = (props) => (
  <AlertMarkers {...props} filterTypes={['bus_stop', 'taxi_stand']} />
);

const styles = StyleSheet.create({
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
  markerTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    alignSelf: 'center',
    marginTop: -2,
  },
  calloutContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  calloutTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  calloutType: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  calloutDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 8,
  },
  calloutImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  calloutMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calloutTime: {
    fontSize: 12,
    color: '#999999',
  },
  calloutStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calloutStatText: {
    fontSize: 12,
    color: '#666666',
    marginRight: 8,
  },
  dangerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  dangerText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '600',
  },
});

export default AlertMarkers;
