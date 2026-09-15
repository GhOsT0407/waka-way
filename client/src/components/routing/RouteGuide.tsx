/**
 * WakaWay Route Guide Component
 * 
 * Displays multimodal route with:
 * - Step-by-step instructions
 * - Lagos-specific terminology
 * - Live progress tracking
 * - "Owa!" nudge alerts
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';
import { MultimodalRoute, GuideStep, ArrivalNudge } from '../../types/routing';
import { FormattedGuide } from '../../services/guideGenerator';

const { width } = Dimensions.get('window');

// ============================================================
// TYPES
// ============================================================

interface RouteGuideProps {
  route: MultimodalRoute;
  formattedGuide: FormattedGuide;
  currentLegIndex: number;
  distanceToNext: number;
  latestNudge: ArrivalNudge | null;
  progress: number;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onStopNavigation: () => void;
  onClose: () => void;
}

// ============================================================
// NUDGE BANNER COMPONENT
// ============================================================

const NudgeBanner: React.FC<{ nudge: ArrivalNudge }> = ({ nudge }) => {
  const { WW } = useAppTheme();
  const animatedValue = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(5000),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [nudge]);
  
  const backgroundColor = nudge.type === 'arrived' 
    ? '#22C55E' 
    : nudge.type === 'approaching' && nudge.distance_meters <= 150
      ? '#F44336'
      : '#FF9800';
  
  return (
    <Animated.View
      style={[
        styles.nudgeBanner,
        { 
          backgroundColor,
          opacity: animatedValue,
          transform: [{
            translateY: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0],
            }),
          }],
        },
      ]}
    >
      <Ionicons 
        name={nudge.type === 'arrived' ? 'checkmark-circle' : 'alert-circle'} 
        size={24} 
        color="#FFFFFF" 
      />
      <Text style={styles.nudgeText}>{nudge.message}</Text>
    </Animated.View>
  );
};

// ============================================================
// STEP CARD COMPONENT
// ============================================================

interface StepCardProps {
  step: GuideStep;
  isActive: boolean;
  isCompleted: boolean;
  distanceToNext?: number;
}

const StepCard: React.FC<StepCardProps> = ({ 
  step, 
  isActive, 
  isCompleted,
  distanceToNext,
}) => {
  const { WW } = useAppTheme();
  
  const getModeColor = () => {
    switch (step.mode) {
      case 'walk': return '#607D8B';
      case 'keke': return '#9C27B0';
      case 'okada': return '#FF5722';
      case 'danfo': return '#FFC107';
      case 'brt': return '#2196F3';
      case 'rail': return '#E91E63';
      default: return WW.orange;
    }
  };
  
  return (
    <View
      style={[
        styles.stepCard,
        { 
          backgroundColor: WW.bgSurface,
          borderColor: isActive ? getModeColor() : WW.border,
          borderWidth: isActive ? 2 : 1,
          opacity: isCompleted ? 0.6 : 1,
        },
      ]}
    >
      {/* Step number & icon */}
      <View style={styles.stepHeader}>
        <View style={[styles.stepNumber, { backgroundColor: getModeColor() }]}>
          {isCompleted ? (
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          ) : (
            <Text style={styles.stepNumberText}>{step.step_number}</Text>
          )}
        </View>
        
        <View style={[styles.modeIcon, { backgroundColor: `${getModeColor()}20` }]}>
          <Ionicons name={step.icon as any} size={20} color={getModeColor()} />
        </View>
        
        <View style={styles.stepHeaderText}>
          <Text style={[styles.stepTitle, { color: WW.text }]}>
            {step.title}
          </Text>
          <Text style={[styles.stepDuration, { color: WW.textSub }]}>
            {step.duration_text}
          </Text>
        </View>
        
        <Text style={[styles.stepPrice, { color: getModeColor() }]}>
          {step.price_text}
        </Text>
      </View>
      
      {/* Description */}
      <Text style={[styles.stepDescription, { color: WW.textSub }]}>
        {step.description}
      </Text>
      
      {/* Active leg distance indicator */}
      {isActive && distanceToNext !== undefined && (
        <View style={[styles.distanceIndicator, { backgroundColor: `${getModeColor()}15` }]}>
          <Ionicons name="navigate" size={16} color={getModeColor()} />
          <Text style={[styles.distanceText, { color: getModeColor() }]}>
            {distanceToNext < 1000 
              ? `${Math.round(distanceToNext)}m to ${step.location.name || 'next stop'}`
              : `${(distanceToNext / 1000).toFixed(1)}km to ${step.location.name || 'next stop'}`
            }
          </Text>
        </View>
      )}
      
      {/* Nudge/Tip */}
      {step.nudge && !isCompleted && (
        <View style={[styles.nudgeBox, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
          <Ionicons name="bulb-outline" size={16} color="#F57C00" />
          <Text style={styles.nudgeBoxText}>{step.nudge}</Text>
        </View>
      )}
    </View>
  );
};

// ============================================================
// MAIN COMPONENT
// ============================================================

export const RouteGuide: React.FC<RouteGuideProps> = ({
  route,
  formattedGuide,
  currentLegIndex,
  distanceToNext,
  latestNudge,
  progress,
  isNavigating,
  onStartNavigation,
  onStopNavigation,
  onClose,
}) => {
  const { WW } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  
  // Auto-scroll to active step
  useEffect(() => {
    if (scrollRef.current && currentLegIndex > 0) {
      scrollRef.current.scrollTo({
        y: currentLegIndex * 180, // Approximate step height
        animated: true,
      });
    }
  }, [currentLegIndex]);
  
  return (
    <View style={[styles.container, { backgroundColor: WW.bg }]}>
      {/* Nudge Banner */}
      {latestNudge && <NudgeBanner nudge={latestNudge} />}
      
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: WW.border }]}>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={WW.text} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: WW.text }]}>
            {formattedGuide.header.destination}
          </Text>
          <Text style={[styles.headerSubtitle, { color: WW.textSub }]}>
            {formattedGuide.header.duration} â€¢ {formattedGuide.header.price}
          </Text>
        </View>
        
        {formattedGuide.header.isNight && (
          <View style={[styles.nightBadge, { backgroundColor: '#1A237E' }]}>
            <Ionicons name="moon" size={12} color="#FFFFFF" />
            <Text style={styles.nightBadgeText}>Night</Text>
          </View>
        )}
      </View>
      
      {/* Progress Bar */}
      {isNavigating && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: WW.border }]}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  backgroundColor: WW.orange,
                  width: `${progress}%`,
                }
              ]} 
            />
          </View>
          <Text style={[styles.progressText, { color: WW.textSub }]}>
            {Math.round(progress)}% complete
          </Text>
        </View>
      )}
      
      {/* Warnings */}
      {formattedGuide.warnings.length > 0 && (
        <View style={[styles.warningsContainer, { backgroundColor: 'rgba(248,113,113,0.1)' }]}>
          {formattedGuide.warnings.map((warning, index) => (
            <View key={index} style={styles.warningItem}>
              <Ionicons name="warning" size={16} color="#F87171" />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Pivot Message */}
      {formattedGuide.pivotMessage && (
        <View style={[styles.pivotMessage, { backgroundColor: 'rgba(96,165,250,0.12)' }]}>
          <Ionicons name="information-circle" size={18} color="#60A5FA" />
          <Text style={styles.pivotText}>{formattedGuide.pivotMessage}</Text>
        </View>
      )}
      
      {/* Steps */}
      <ScrollView 
        ref={scrollRef}
        style={styles.stepsContainer}
        contentContainerStyle={styles.stepsContent}
        showsVerticalScrollIndicator={false}
      >
        {formattedGuide.steps.map((step, index) => (
          <React.Fragment key={step.step_number}>
            <StepCard
              step={step}
              isActive={index === currentLegIndex}
              isCompleted={index < currentLegIndex}
              distanceToNext={index === currentLegIndex ? distanceToNext : undefined}
            />
            
            {/* Connector line */}
            {index < formattedGuide.steps.length - 1 && (
              <View style={styles.connectorLine}>
                <View 
                  style={[
                    styles.connectorDot,
                    { 
                      backgroundColor: index < currentLegIndex 
                        ? WW.orange 
                        : WW.border 
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.connectorBar,
                    { 
                      backgroundColor: index < currentLegIndex 
                        ? WW.orange 
                        : WW.border 
                    }
                  ]} 
                />
                <View 
                  style={[
                    styles.connectorDot,
                    { 
                      backgroundColor: index < currentLegIndex 
                        ? WW.orange 
                        : WW.border 
                    }
                  ]} 
                />
              </View>
            )}
          </React.Fragment>
        ))}
        
        {/* Arrival nudge reminder */}
        <View style={[styles.arrivalReminder, { backgroundColor: WW.bgSurface }]}>
          <Ionicons name="megaphone-outline" size={20} color={WW.orange} />
          <Text style={[styles.arrivalReminderText, { color: WW.text }]}>
            {formattedGuide.arrivalNudge}
          </Text>
        </View>
      </ScrollView>
      
      {/* Navigation Button */}
      <View style={[styles.footer, { borderTopColor: WW.border }]}>
        {isNavigating ? (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: '#F44336' }]}
            onPress={onStopNavigation}
          >
            <Ionicons name="stop" size={20} color="#FFFFFF" />
            <Text style={styles.navButtonText}>End Navigation</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, { backgroundColor: WW.orange }]}
            onPress={onStartNavigation}
          >
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
            <Text style={styles.navButtonText}>Start Navigation</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nudgeBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    gap: SPACING.SM,
    zIndex: 100,
  },
  nudgeText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
    borderBottomWidth: 1,
    gap: SPACING.MD,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.SMALL,
    marginTop: 2,
  },
  nightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  nightBadgeText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  progressContainer: {
    padding: SPACING.MD,
    paddingBottom: SPACING.SM,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: FONT_SIZES.SMALL,
    marginTop: 4,
    textAlign: 'right',
  },
  warningsContainer: {
    margin: SPACING.MD,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.XS,
    marginBottom: 4,
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZES.SMALL,
    color: '#F87171',
  },
  pivotMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.SM,
    margin: SPACING.MD,
    marginTop: 0,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  pivotText: {
    flex: 1,
    fontSize: FONT_SIZES.SMALL,
    color: '#60A5FA',
  },
  stepsContainer: {
    flex: 1,
  },
  stepsContent: {
    padding: SPACING.MD,
    paddingBottom: 100,
  },
  stepCard: {
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.SM,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
  },
  modeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeaderText: {
    flex: 1,
  },
  stepTitle: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  stepDuration: {
    fontSize: FONT_SIZES.SMALL,
  },
  stepPrice: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
  },
  stepDescription: {
    fontSize: FONT_SIZES.SMALL,
    lineHeight: 20,
    marginBottom: SPACING.SM,
  },
  distanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.XS,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
    marginBottom: SPACING.SM,
  },
  distanceText: {
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
  nudgeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.XS,
    padding: SPACING.SM,
    borderRadius: BORDER_RADIUS.SMALL,
  },
  nudgeBoxText: {
    flex: 1,
    fontSize: FONT_SIZES.SMALL,
    color: '#F57C00',
  },
  connectorLine: {
    alignItems: 'center',
    marginVertical: SPACING.XS,
  },
  connectorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectorBar: {
    width: 2,
    height: 16,
  },
  arrivalReminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginTop: SPACING.MD,
  },
  arrivalReminderText: {
    flex: 1,
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.MD,
    borderTopWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
  },
  navButtonText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
  },
});

export default RouteGuide;
