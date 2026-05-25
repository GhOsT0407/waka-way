import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TransportMode, TransportPricingEngine, PriceRange, FARE_MODES } from '../services/pricingEngine';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

interface FareEstimateCardProps {
  distanceInKm: number;
  isRaining?: boolean;
  isFuelScarce?: boolean;
  onModeSelect?: (mode: TransportMode, priceRange: PriceRange) => void;
  selectedMode?: TransportMode;
}

interface TransportOptionProps {
  mode: TransportMode;
  priceRange: PriceRange;
  isSelected: boolean;
  onPress: () => void;
}

const TransportOption: React.FC<TransportOptionProps> = ({
  mode,
  priceRange,
  isSelected,
  onPress
}) => {
  const getModeDetails = (m: TransportMode) => {
    switch (m) {
      case 'danfo':  return { icon: 'bus',             name: 'Danfo (Bus)',     description: 'Reliable for longer trips',  color: '#22C55E' };
      case 'keke':   return { icon: 'bicycle',         name: 'Keke (Tricycle)', description: 'Flexible for short trips',   color: '#22C55E' };
      case 'okada':  return { icon: 'bicycle-outline', name: 'Okada (Bike)',    description: 'Fastest for urgent trips',   color: '#22C55E' };
      default:       return { icon: 'car-outline',     name: m,                 description: '',                           color: '#22C55E' };
    }
  };

  const details = getModeDetails(mode);

  return (
    <TouchableOpacity
      style={[styles.transportOption, isSelected && styles.selectedOption]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <View style={styles.iconContainer}>
          <Ionicons name={details.icon as any} size={24} color={details.color} />
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.modeName}>{details.name}</Text>
          <Text style={styles.modeDescription}>{details.description}</Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.priceRange}>{priceRange.formatted}</Text>
          <Text style={styles.priceNote}>Estimated fare</Text>
        </View>
      </View>

      {isSelected && (
        <LinearGradient
          colors={['#16A34A', '#22C55E']}
          style={styles.selectionIndicator}
        >
          <Ionicons name="checkmark" size={16} color="white" />
        </LinearGradient>
      )}
    </TouchableOpacity>
  );
};

export const FareEstimateCard: React.FC<FareEstimateCardProps> = ({
  distanceInKm,
  isRaining = false,
  isFuelScarce = false,
  onModeSelect,
  selectedMode
}) => {
  const prices = TransportPricingEngine.getAllModePrices(distanceInKm, isRaining, isFuelScarce);

  const handleModeSelect = (mode: TransportMode) => {
    if (onModeSelect) {
      onModeSelect(mode, prices[mode]);
    }
  };

  const isPeakHour = TransportPricingEngine.isPeakHour();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="cash" size={20} color="#22C55E" />
        <Text style={styles.headerTitle}>Fare Estimates</Text>
        <Text style={styles.headerSubtitle}>
          {distanceInKm.toFixed(1)}km trip • {isPeakHour ? 'Peak hours' : 'Normal hours'}
          {isRaining && ' • Rain'}
          {isFuelScarce && ' • Fuel scarcity'}
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        {FARE_MODES.map((mode) => (
          <TransportOption
            key={mode}
            mode={mode}
            priceRange={prices[mode]}
            isSelected={selectedMode === mode}
            onPress={() => handleModeSelect(mode)}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Prices may vary based on exact route and conductor discretion
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C2333',
    borderRadius: BORDER_RADIUS.LARGE,
    padding: SPACING.MD,
    margin: SPACING.MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    paddingBottom: SPACING.SM,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: 'bold',
    color: '#F1F5F9',
    marginLeft: SPACING.SM,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SMALL,
    color: '#94A3B8',
    position: 'absolute',
    top: 24,
    left: 30,
  },
  optionsContainer: {
    gap: SPACING.SM,
  },
  transportOption: {
    backgroundColor: '#243044',
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedOption: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(34,197,94,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
  },
  detailsContainer: {
    flex: 1,
  },
  modeName: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
    marginBottom: 2,
    color: '#F1F5F9',
  },
  modeDescription: {
    fontSize: FONT_SIZES.SMALL,
    color: '#94A3B8',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceRange: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: 'bold',
    color: '#F1F5F9',
  },
  priceNote: {
    fontSize: FONT_SIZES.CAPTION,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectionIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: SPACING.MD,
    paddingTop: SPACING.SM,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  footerText: {
    fontSize: FONT_SIZES.SMALL,
    color: '#64748B',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
