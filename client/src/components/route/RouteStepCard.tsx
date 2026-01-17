import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { RouteStep } from '../../types/route.types';
import { formatTime, formatDistance, formatFare, formatInstruction, getTransportEmoji } from '../../utils/formatters';

import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

interface RouteStepCardProps {
  step: RouteStep;
  onShowOnMap?: () => void;
}

export const RouteStepCard: React.FC<RouteStepCardProps> = ({
  step,
  onShowOnMap,
}) => {
  const { theme } = useAppTheme();
  const {
    sequence,
    transport_mode,
    instruction,
    distance_km,
    duration_minutes,
    fare_ngn,
  } = step;

  const formattedInstruction = formatInstruction({
    transport_mode,
    instruction,
    route_number: step.route_number,
  });

  return (
    <View style={styles.container}>
      <View style={styles.stepHeader}>
        <View style={[styles.stepNumber, { backgroundColor: getStepColor(transport_mode, theme) }]}>
          <Text style={styles.stepNumberText}>{sequence}</Text>
        </View>
        <View style={styles.stepContent}>
          <Text style={styles.instruction}>{formattedInstruction}</Text>

          <View style={styles.details}>
            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>⏱️</Text>
              <Text style={styles.detailText}>{formatTime(duration_minutes)}</Text>
            </View>

            <View style={styles.detailItem}>
              <Text style={styles.detailIcon}>📍</Text>
              <Text style={styles.detailText}>{formatDistance(distance_km)}</Text>
            </View>

            {fare_ngn > 0 && (
              <View style={styles.detailItem}>
                <Text style={styles.detailIcon}>💰</Text>
                <Text style={styles.detailText}>{formatFare(fare_ngn)}</Text>
              </View>
            )}
          </View>

          {onShowOnMap && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={onShowOnMap}
              activeOpacity={0.7}
            >
              <Text style={styles.mapButtonText}>📍 Show on Map</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const getStepColor = (transportMode: string, theme: any): string => {
  const colorMap: Record<string, string> = {
    bus: '#3498DB',
    keke: '#FFA726',
    okada: '#E67E22',
    walk: '#95A5A6',
    // fallback using theme if needed, or just let call site handle it.
    // However, the original code used theme.PRIMARY as default.
  };
  return colorMap[transportMode] || theme.PRIMARY;
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.MD,
  },
  stepHeader: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: BORDER_RADIUS.ROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
    borderRadius: BORDER_RADIUS.MEDIUM,
    padding: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  instruction: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
    marginBottom: SPACING.SM,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
  },
  detailIcon: {
    fontSize: FONT_SIZES.BODY,
  },
  detailText: {
    fontSize: FONT_SIZES.BODY,
  },
  mapButton: {
    marginTop: SPACING.XS,
    paddingVertical: SPACING.XS,
  },
  mapButtonText: {
    fontSize: FONT_SIZES.CAPTION,
    fontWeight: '600',
  },
});

