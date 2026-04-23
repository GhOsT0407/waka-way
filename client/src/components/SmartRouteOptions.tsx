/**
 * Smart Route Options Component
 * 
 * Displays route options with:
 * - Visual journey breakdown (leg by leg)
 * - Price comparison
 * - Recommendations
 * - User choice when prices are similar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RouteOption, RouteLeg, SmartRouteResult } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';

interface SmartRouteOptionsProps {
  routeResult: SmartRouteResult;
  onSelectOption: (option: RouteOption) => void;
  onStartJourney: (option: RouteOption) => void;
}

// Individual leg display
const LegItem: React.FC<{ leg: RouteLeg; isLast: boolean; theme: any }> = ({ leg, isLast, theme }) => {
  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'walk': return '#4CAF50';
      case 'keke': return '#FF9800';
      case 'okada': return '#F44336';
      case 'danfo': return '#2196F3';
      case 'brt': return '#9C27B0';
      case 'ferry': return '#00BCD4';
      case 'rail': return '#E91E63';
      default: return '#757575';
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'walk': return 'Walk';
      case 'keke': return 'Keke';
      case 'okada': return 'Okada';
      case 'danfo': return 'Danfo';
      case 'brt': return 'BRT';
      case 'ferry': return 'Ferry';
      case 'rail': return 'Train';
      default: return mode;
    }
  };

  const formatPrice = (min: number, max: number) => {
    if (min === 0) return 'Free';
    if (min === max) return `₦${min.toLocaleString()}`;
    return `₦${min.toLocaleString()} - ₦${max.toLocaleString()}`;
  };

  return (
    <View style={styles.legContainer}>
      {/* Timeline dot and line */}
      <View style={styles.timeline}>
        <View style={[styles.timelineDot, { backgroundColor: getModeColor(leg.mode) }]}>
          <Ionicons 
            name={leg.icon as any} 
            size={12} 
            color="white" 
          />
        </View>
        {!isLast && <View style={[styles.timelineLine, { backgroundColor: getModeColor(leg.mode) }]} />}
      </View>

      {/* Leg content */}
      <View style={styles.legContent}>
        <View style={styles.legHeader}>
          <View style={[styles.modeBadge, { backgroundColor: getModeColor(leg.mode) + '20' }]}>
            <Text style={[styles.modeBadgeText, { color: getModeColor(leg.mode) }]}>
              {getModeLabel(leg.mode)}
            </Text>
          </View>
          {leg.priceMax > 0 && (
            <Text style={[styles.legPrice, { color: theme.TEXT }]}>
              {formatPrice(leg.priceMin, leg.priceMax)}
            </Text>
          )}
        </View>

        <Text style={[styles.legInstruction, { color: theme.TEXT }]}>
          {leg.instruction}
        </Text>

        <View style={styles.legMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={12} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>
              {leg.durationMins} min
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={12} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>
              {leg.distanceKm.toFixed(1)} km
            </Text>
          </View>
        </View>

        {/* Local instruction (Pidgin) */}
        <Text style={[styles.localInstruction, { color: theme.TEXT_SECONDARY }]}>
          💡 {leg.localInstruction}
        </Text>
      </View>
    </View>
  );
};

// Route option card
const RouteOptionCard: React.FC<{
  option: RouteOption;
  isSelected: boolean;
  onSelect: () => void;
  onStartJourney: () => void;
  theme: any;
}> = ({ option, isSelected, onSelect, onStartJourney, theme }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[
        styles.optionCard,
        { 
          backgroundColor: theme.CARD_BACKGROUND,
          borderColor: isSelected ? theme.PRIMARY : theme.BORDER,
          borderWidth: isSelected ? 2 : 1,
        }
      ]}
      onPress={() => {
        onSelect();
        setExpanded(!expanded);
      }}
      activeOpacity={0.8}
    >
      {/* Option Header */}
      <View style={styles.optionHeader}>
        <View style={styles.optionTitleRow}>
          <Text style={[styles.optionName, { color: theme.TEXT }]}>
            {option.name}
          </Text>
          {option.isRecommended && (
            <View style={[styles.recommendedBadge, { backgroundColor: theme.PRIMARY }]}>
              <Ionicons name="star" size={10} color="white" />
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        <View style={styles.tagsRow}>
          {option.tags.map((tag, index) => (
            <View 
              key={index} 
              style={[
                styles.tag, 
                { 
                  backgroundColor: tag === 'Cheapest' ? '#E8F5E9' : 
                                  tag === 'Fastest' ? '#E3F2FD' : '#F5F5F5'
                }
              ]}
            >
              <Text style={[
                styles.tagText,
                {
                  color: tag === 'Cheapest' ? '#2E7D32' : 
                         tag === 'Fastest' ? '#1976D2' : '#757575'
                }
              ]}>
                {tag}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Price and Duration Summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Ionicons name="cash-outline" size={18} color={theme.PRIMARY} />
          <Text style={[styles.summaryValue, { color: theme.TEXT }]}>
            {option.priceFormatted}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="time-outline" size={18} color={theme.TEXT_SECONDARY} />
          <Text style={[styles.summaryValue, { color: theme.TEXT }]}>
            {option.totalDurationMins} min
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Ionicons name="navigate-outline" size={18} color={theme.TEXT_SECONDARY} />
          <Text style={[styles.summaryValue, { color: theme.TEXT }]}>
            {option.totalDistanceKm.toFixed(1)} km
          </Text>
        </View>
      </View>

      {/* Recommendation reason */}
      {option.recommendationReason && (
        <View style={[styles.reasonBanner, { backgroundColor: theme.PRIMARY + '10' }]}>
          <Ionicons name="bulb-outline" size={14} color={theme.PRIMARY} />
          <Text style={[styles.reasonText, { color: theme.PRIMARY }]}>
            {option.recommendationReason}
          </Text>
        </View>
      )}

      {/* Expand/Collapse Button */}
      <TouchableOpacity 
        style={styles.expandButton}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={[styles.expandText, { color: theme.PRIMARY }]}>
          {expanded ? 'Hide details' : `View ${option.legs.length} steps`}
        </Text>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color={theme.PRIMARY} 
        />
      </TouchableOpacity>

      {/* Expanded Legs */}
      {expanded && (
        <View style={styles.legsContainer}>
          {option.legs.map((leg, index) => (
            <LegItem 
              key={leg.id} 
              leg={leg} 
              isLast={index === option.legs.length - 1}
              theme={theme}
            />
          ))}
        </View>
      )}

      {/* Start Journey Button (when selected) */}
      {isSelected && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: theme.PRIMARY }]}
          onPress={onStartJourney}
        >
          <Text style={styles.startButtonText}>Start Journey</Text>
          <Ionicons name="navigate" size={18} color="white" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

// Main component
export const SmartRouteOptions: React.FC<SmartRouteOptionsProps> = ({
  routeResult,
  onSelectOption,
  onStartJourney,
}) => {
  const { theme } = useAppTheme();
  const [selectedOptionId, setSelectedOptionId] = useState<string>(
    routeResult.recommendedOptionId
  );

  const handleSelect = (option: RouteOption) => {
    setSelectedOptionId(option.id);
    onSelectOption(option);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.routeInfo}>
          <Text style={[styles.routeLabel, { color: theme.TEXT_SECONDARY }]}>
            Route Options
          </Text>
          <View style={styles.routeDestination}>
            <Text style={[styles.originText, { color: theme.TEXT }]}>
              {routeResult.origin.name}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.destText, { color: theme.TEXT }]}>
              {routeResult.destination.name}
            </Text>
          </View>
        </View>
      </View>

      {/* Comparison Banner */}
      {routeResult.comparison.comparisonText && (
        <View style={[styles.comparisonBanner, { backgroundColor: theme.PRIMARY + '15' }]}>
          <Ionicons 
            name={routeResult.comparison.shouldLetUserChoose ? 'swap-horizontal' : 'bulb'} 
            size={18} 
            color={theme.PRIMARY} 
          />
          <Text style={[styles.comparisonText, { color: theme.PRIMARY }]}>
            {routeResult.comparison.comparisonText}
          </Text>
        </View>
      )}

      {/* Options List - Use View instead of ScrollView to avoid nested scroll issues */}
      <View style={styles.optionsList}>
        {routeResult.options.map((option) => (
          <RouteOptionCard
            key={option.id}
            option={option}
            isSelected={selectedOptionId === option.id}
            onSelect={() => handleSelect(option)}
            onStartJourney={() => onStartJourney(option)}
            theme={theme}
          />
        ))}

        {/* Footer spacing */}
        <View style={{ height: 100 }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Don't use flex: 1 here - let content determine height
  },
  header: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
  },
  routeInfo: {
    gap: 4,
  },
  routeLabel: {
    fontSize: FONT_SIZES.SMALL,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  routeDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    flexWrap: 'wrap',
  },
  originText: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
  },
  destText: {
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '600',
  },
  comparisonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginHorizontal: SPACING.MD,
    marginBottom: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  comparisonText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '500',
    flex: 1,
  },
  optionsList: {
    // Don't use flex: 1 - let content determine height
    paddingHorizontal: SPACING.MD,
  },
  optionCard: {
    borderRadius: BORDER_RADIUS.LARGE,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
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
  optionHeader: {
    marginBottom: SPACING.SM,
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.XS,
  },
  optionName: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '700',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.ROUND,
  },
  recommendedText: {
    color: 'white',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.XS,
  },
  tag: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  tagText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.SM,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: SPACING.SM,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  reasonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
    marginTop: SPACING.SM,
  },
  reasonText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
    flex: 1,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.SM,
    marginTop: SPACING.SM,
  },
  expandText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '500',
  },
  legsContainer: {
    marginTop: SPACING.MD,
    paddingTop: SPACING.MD,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  legContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.MD,
  },
  timeline: {
    alignItems: 'center',
    width: 32,
    marginRight: SPACING.SM,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -SPACING.MD,
  },
  legContent: {
    flex: 1,
    paddingBottom: SPACING.SM,
  },
  legHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modeBadge: {
    paddingHorizontal: SPACING.SM,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  modeBadgeText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  legPrice: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
  },
  legInstruction: {
    fontSize: FONT_SIZES.BODY,
    marginBottom: 4,
  },
  legMeta: {
    flexDirection: 'row',
    gap: SPACING.MD,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FONT_SIZES.SMALL,
  },
  localInstruction: {
    fontSize: FONT_SIZES.SMALL,
    fontStyle: 'italic',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.MD,
    borderRadius: BORDER_RADIUS.LARGE,
    marginTop: SPACING.MD,
  },
  startButtonText: {
    color: 'white',
    fontSize: FONT_SIZES.BODY_LARGE,
    fontWeight: '700',
  },
});
