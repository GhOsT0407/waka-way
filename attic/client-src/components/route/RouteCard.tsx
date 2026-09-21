import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { RouteSuggestion } from '../../types/route.types';
import { formatTime, formatFare, formatDistance, getTransportEmoji } from '../../utils/formatters';

import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface RouteCardProps {
  suggestion: RouteSuggestion;
  onPress: () => void;
  isSelected?: boolean;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  suggestion,
  onPress,
  isSelected = false,
}) => {
  const { WW } = useAppTheme();
  const { total_time_minutes, total_distance_km, total_fare_ngn, transport_modes, steps } = suggestion;

  // Create transport modes display
  const transportDisplay = steps
    .map((step) => getTransportEmoji(step.transport_mode))
    .join(' → ');

  return (
    <TouchableOpacity
      style={[
        styles.card,
        { backgroundColor: WW.bgSurface },
        isSelected && [
          styles.cardSelected,
          { borderColor: WW.orange, shadowColor: WW.orange }
        ]
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={[styles.transportModes, { color: WW.text }]}>{transportDisplay}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>⏱️</Text>
          <Text style={[styles.detailText, { color: WW.text }]}>{formatTime(total_time_minutes)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>💰</Text>
          <Text style={[styles.detailText, { color: WW.text }]}>{formatFare(total_fare_ngn)}</Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <Text style={[styles.detailText, { color: WW.text }]}>{formatDistance(total_distance_km)}</Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: WW.border }]}>
        <Text style={[styles.stepsCount, { color: WW.textSub }]}>{steps.length} step{steps.length !== 1 ? 's' : ''}</Text>
        <Text style={[styles.viewDetails, { color: WW.orange }]}>View Details →</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
  },
  cardSelected: {
    borderWidth: 2,
    shadowOpacity: 0.2,
  },
  header: {
    marginBottom: SPACING.SM,
  },
  transportModes: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.SM,
    gap: SPACING.MD,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  detailIcon: {
    fontSize: FONT_SIZES.BODY,
  },
  detailText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.XS,
    paddingTop: SPACING.SM,
    borderTopWidth: 1,
  },
  stepsCount: {
    fontSize: FONT_SIZES.CAPTION,
  },
  viewDetails: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
});

