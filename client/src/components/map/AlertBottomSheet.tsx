import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { PanGestureHandler, State as GestureState } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Contribution } from '../../hooks/useContributions';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOTTOM_SHEET_MAX_HEIGHT = SCREEN_HEIGHT * 0.6;
const BOTTOM_SHEET_MIN_HEIGHT = 0;

// Marker configuration for styling
const MARKER_CONFIG: Record<string, {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> = {
  security: { color: '#D32F2F', icon: 'shield-outline', label: 'Security' },
  danger_zone: { color: '#D32F2F', icon: 'warning-outline', label: 'Danger Zone' },
  traffic: { color: '#FF9800', icon: 'car-sport-outline', label: 'Traffic' },
  hazard: { color: '#FF5722', icon: 'alert-circle-outline', label: 'Hazard' },
  construction: { color: '#FFC107', icon: 'construct-outline', label: 'Construction' },
  bus_stop: { color: '#2196F3', icon: 'bus-outline', label: 'Bus Stop' },
  taxi_stand: { color: '#9C27B0', icon: 'car-outline', label: 'Taxi Stand' },
  other: { color: '#607D8B', icon: 'help-circle-outline', label: 'Other' },
};

interface AlertBottomSheetProps {
  /** The contribution to display */
  contribution: Contribution | null;
  /** Whether the sheet is visible */
  visible: boolean;
  /** Close the sheet */
  onClose: () => void;
  /** User's current vote on this contribution */
  userVote: 'CONFIRM' | 'DISMISS' | null;
  /** Vote on the contribution */
  onVote: (contributionId: string, voteType: 'CONFIRM' | 'DISMISS') => Promise<boolean>;
  /** Distance from user (optional) */
  distance?: number;
}

/**
 * AlertBottomSheet Component
 * 
 * Displays contribution details with voting buttons when a map marker is tapped.
 * Features:
 * - "Still there? ✅ Yes" and "All clear? ❌ No" voting buttons
 * - Verified badge for 5+ confirms
 * - Visual feedback for user's existing vote
 * - Image preview if available
 * - Trust score indicator
 */
export const AlertBottomSheet: React.FC<AlertBottomSheetProps> = ({
  contribution,
  visible,
  onClose,
  userVote,
  onVote,
  distance,
}) => {
  const { theme } = useAppTheme();
  const translateY = useRef(new Animated.Value(BOTTOM_SHEET_MAX_HEIGHT)).current;
  const [isVoting, setIsVoting] = useState(false);
  const [currentVote, setCurrentVote] = useState<'CONFIRM' | 'DISMISS' | null>(null);

  // Update currentVote when userVote changes
  useEffect(() => {
    setCurrentVote(userVote);
  }, [userVote]);

  // Animate sheet visibility
  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : BOTTOM_SHEET_MAX_HEIGHT,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  }, [visible, translateY]);

  const onGestureEvent = ({ nativeEvent }: any) => {
    if (nativeEvent.translationY > 0) {
      translateY.setValue(nativeEvent.translationY);
    }
  };

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.oldState === GestureState.ACTIVE) {
      if (nativeEvent.translationY > 100) {
        onClose();
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    }
  };

  // Handle vote
  const handleVote = async (voteType: 'CONFIRM' | 'DISMISS') => {
    if (!contribution || isVoting) return;

    setIsVoting(true);
    try {
      const success = await onVote(contribution.id, voteType);
      if (success) {
        // Update local state
        setCurrentVote(currentVote === voteType ? null : voteType);
      }
    } finally {
      setIsVoting(false);
    }
  };

  if (!contribution) return null;

  const config = MARKER_CONFIG[contribution.type] || MARKER_CONFIG.other;
  const isVerified = contribution.verified || (contribution.confirm_count >= 5);
  const trustLevel = contribution.reporter_trust_score >= 1.5 ? 'high' : 
                     contribution.reporter_trust_score >= 0.8 ? 'medium' : 'low';

  // Format relative time
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
        },
      ]}
    >
      {/* Handle */}
      <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
        <Animated.View style={styles.handleContainer}>
          <View style={[styles.handle, { backgroundColor: theme.BORDER }]} />
        </Animated.View>
      </PanGestureHandler>

      {/* Content */}
      <View style={[styles.content, { backgroundColor: theme.SURFACE }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.typeIcon, { backgroundColor: `${config.color}20` }]}>
            <Ionicons name={config.icon} size={28} color={config.color} />
          </View>
          <View style={styles.headerText}>
            <View style={styles.titleRow}>
              <Text style={[styles.typeLabel, { color: config.color }]}>
                {config.label.toUpperCase()}
              </Text>
              {isVerified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
            <Text style={[styles.title, { color: theme.TEXT }]} numberOfLines={2}>
              {contribution.title}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        {contribution.description && (
          <Text style={[styles.description, { color: theme.TEXT_SECONDARY }]}>
            {contribution.description}
          </Text>
        )}

        {/* Image */}
        {contribution.image_url && (
          <Image
            source={{ uri: contribution.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        )}

        {/* Meta Info */}
        <View style={styles.metaContainer}>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={16} color={theme.TEXT_SECONDARY} />
            <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>
              {formatRelativeTime(contribution.created_at)}
            </Text>
          </View>
          {distance !== undefined && (
            <View style={styles.metaItem}>
              <Ionicons name="location-outline" size={16} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]}>
                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`} away
              </Text>
            </View>
          )}
          {contribution.address && (
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={16} color={theme.TEXT_SECONDARY} />
              <Text style={[styles.metaText, { color: theme.TEXT_SECONDARY }]} numberOfLines={1}>
                {contribution.address}
              </Text>
            </View>
          )}
        </View>

        {/* Vote Stats */}
        <View style={[styles.statsContainer, { backgroundColor: theme.CHIP_BACKGROUND }]}>
          <View style={styles.statItem}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={[styles.statNumber, { color: theme.TEXT }]}>
              {contribution.confirm_count || contribution.confirms || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.TEXT_SECONDARY }]}>
              Confirms
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="close-circle" size={20} color="#F44336" />
            <Text style={[styles.statNumber, { color: theme.TEXT }]}>
              {contribution.dismiss_count || contribution.dismisses || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.TEXT_SECONDARY }]}>
              Dismisses
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons 
              name={trustLevel === 'high' ? 'star' : trustLevel === 'medium' ? 'star-half' : 'star-outline'} 
              size={20} 
              color={trustLevel === 'high' ? '#FFD700' : trustLevel === 'medium' ? '#FFA500' : '#999'}
            />
            <Text style={[styles.statNumber, { color: theme.TEXT }]}>
              {(contribution.reporter_trust_score || 1).toFixed(1)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.TEXT_SECONDARY }]}>
              Trust
            </Text>
          </View>
        </View>

        {/* Voting Buttons */}
        <View style={styles.votingContainer}>
          <Text style={[styles.votingPrompt, { color: theme.TEXT }]}>
            Is this issue still there?
          </Text>
          <View style={styles.votingButtons}>
            {/* Confirm Button */}
            <TouchableOpacity
              style={[
                styles.voteButton,
                styles.confirmButton,
                currentVote === 'CONFIRM' && styles.voteButtonActive,
                currentVote === 'DISMISS' && styles.voteButtonDisabled,
              ]}
              onPress={() => handleVote('CONFIRM')}
              disabled={isVoting}
            >
              {isVoting && currentVote !== 'DISMISS' ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <>
                  <Ionicons
                    name={currentVote === 'CONFIRM' ? 'checkmark-circle' : 'checkmark-circle-outline'}
                    size={24}
                    color={currentVote === 'DISMISS' ? '#999' : '#4CAF50'}
                  />
                  <Text style={[
                    styles.voteButtonText,
                    { color: currentVote === 'DISMISS' ? '#999' : '#4CAF50' }
                  ]}>
                    Still there ✅
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Dismiss Button */}
            <TouchableOpacity
              style={[
                styles.voteButton,
                styles.dismissButton,
                currentVote === 'DISMISS' && styles.voteButtonActive,
                currentVote === 'CONFIRM' && styles.voteButtonDisabled,
              ]}
              onPress={() => handleVote('DISMISS')}
              disabled={isVoting}
            >
              {isVoting && currentVote !== 'CONFIRM' ? (
                <ActivityIndicator size="small" color="#F44336" />
              ) : (
                <>
                  <Ionicons
                    name={currentVote === 'DISMISS' ? 'close-circle' : 'close-circle-outline'}
                    size={24}
                    color={currentVote === 'CONFIRM' ? '#999' : '#F44336'}
                  />
                  <Text style={[
                    styles.voteButtonText,
                    { color: currentVote === 'CONFIRM' ? '#999' : '#F44336' }
                  ]}>
                    All clear ❌
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {currentVote && (
            <Text style={[styles.votedHint, { color: theme.TEXT_SECONDARY }]}>
              Tap again to remove your vote
            </Text>
          )}
        </View>

        {/* Danger Zone Warning */}
        {['security', 'danger_zone'].includes(contribution.type) && (
          <View style={styles.dangerWarning}>
            <Ionicons name="warning" size={18} color="#D32F2F" />
            <Text style={styles.dangerText}>
              ⚠️ 500m danger zone marked on map. Exercise caution in this area.
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: BOTTOM_SHEET_MAX_HEIGHT,
    zIndex: 1000,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.MD,
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.MD,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
    marginLeft: 4,
  },
  title: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '600',
    lineHeight: 24,
  },
  closeButton: {
    padding: 8,
    marginLeft: SPACING.SM,
  },
  description: {
    fontSize: FONT_SIZES.BODY,
    lineHeight: 22,
    marginBottom: SPACING.MD,
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.MD,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: SPACING.MD,
    gap: SPACING.MD,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: FONT_SIZES.SMALL,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    marginBottom: SPACING.MD,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E0E0E0',
  },
  votingContainer: {
    marginBottom: SPACING.MD,
  },
  votingPrompt: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
    marginBottom: SPACING.SM,
    textAlign: 'center',
  },
  votingButtons: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    borderWidth: 2,
    gap: 8,
  },
  confirmButton: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  dismissButton: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
  },
  voteButtonActive: {
    borderWidth: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  voteButtonDisabled: {
    opacity: 0.5,
    borderColor: '#CCC',
  },
  voteButtonText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  votedHint: {
    fontSize: FONT_SIZES.SMALL,
    textAlign: 'center',
    marginTop: SPACING.SM,
    fontStyle: 'italic',
  },
  dangerWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    padding: SPACING.MD,
    borderRadius: BORDER_RADIUS.MEDIUM,
    gap: SPACING.SM,
  },
  dangerText: {
    flex: 1,
    fontSize: FONT_SIZES.SMALL,
    color: '#D32F2F',
    fontWeight: '500',
  },
});

export default AlertBottomSheet;
