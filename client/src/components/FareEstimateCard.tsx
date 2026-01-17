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
import { TransportMode, TransportPricingEngine, PriceRange } from '../services/pricingEngine';
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
  const getModeDetails = (mode: TransportMode) => {
    switch (mode) {
      case TransportMode.DANFO:
        return {
          icon: 'bus',
          name: 'Danfo (Bus)',
          description: 'Reliable for longer trips',
          color: '#2E7D32'
        };
      case TransportMode.KEKE:
        return {
          icon: 'bicycle',
          name: 'Keke (Tricycle)',
          description: 'Flexible for short trips',
          color: '#2E7D32'
        };
      case TransportMode.OKADA:
        return {
          icon: 'bicycle-outline',
          name: 'Okada (Bike)',
          description: 'Fastest for urgent trips',
          color: '#2E7D32'
        };
    }
  };

  const details = getModeDetails(mode);

  return (
    <TouchableOpacity
      style={[
        styles.transportOption,
        isSelected && styles.selectedOption
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={details.icon as any}
            size={24}
            color={details.color}
          />
        </View>

        <View style={styles.detailsContainer}>
          <Text style={[styles.modeName, { color: '#1C1B1F' }]}>
            {details.name}
          </Text>
          <Text style={styles.modeDescription}>
            {details.description}
          </Text>
        </View>

        <View style={styles.priceContainer}>
          <Text style={[styles.priceRange, { color: '#1C1B1F' }]}>
            {priceRange.formatted}
          </Text>
          <Text style={styles.priceNote}>
            Estimated fare
          </Text>
        </View>
      </View>

      {isSelected && (
        <LinearGradient
          colors={['#2E7D32', '#4CAF50']}
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
        <Ionicons name="cash" size={20} color="#2E7D32" />
        <Text style={styles.headerTitle}>Fare Estimates</Text>
        <Text style={styles.headerSubtitle}>
          {distanceInKm.toFixed(1)}km trip • {isPeakHour ? 'Peak hours' : 'Normal hours'}
          {isRaining && ' • Rain'}
          {isFuelScarce && ' • Fuel scarcity'}
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        <TransportOption
          mode={TransportMode.DANFO}
          priceRange={prices[TransportMode.DANFO]}
          isSelected={selectedMode === TransportMode.DANFO}
          onPress={() => handleModeSelect(TransportMode.DANFO)}
        />

        <TransportOption
          mode={TransportMode.KEKE}
          priceRange={prices[TransportMode.KEKE]}
          isSelected={selectedMode === TransportMode.KEKE}
          onPress={() => handleModeSelect(TransportMode.KEKE)}
        />

        <TransportOption
          mode={TransportMode.OKADA}
          priceRange={prices[TransportMode.OKADA]}
          isSelected={selectedMode === TransportMode.OKADA}
          onPress={() => handleModeSelect(TransportMode.OKADA)}
        />
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
    backgroundColor: 'white',
    borderRadius: BORDER_RADIUS.LARGE,
    padding: SPACING.MD,
    margin: SPACING.MD,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    paddingBottom: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: 'bold',
    color: '#1C1B1F',
    marginLeft: SPACING.SM,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SMALL,
    color: '#666',
    position: 'absolute',
    top: 24,
    left: 30,
  },
  optionsContainer: {
    gap: SPACING.SM,
  },
  transportOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedOption: {
    borderColor: '#2E7D32',
    backgroundColor: '#F1F8E9',
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
    backgroundColor: '#E8F5E9',
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
  },
  modeDescription: {
    fontSize: FONT_SIZES.SMALL,
    color: '#666',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceRange: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: 'bold',
  },
  priceNote: {
    fontSize: FONT_SIZES.CAPTION,
    color: '#666',
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
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  footerText: {
    fontSize: FONT_SIZES.SMALL,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});