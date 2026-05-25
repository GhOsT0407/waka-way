import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../utils/constants';
import type { TransportMode } from '../services/smartRoutingService';

interface Option {
  mode: TransportMode;
  label: string;
  pidgin: string;
  icon: string;
  color: string;
  description: string;
}

const OPTIONS: Option[] = [
  { mode: 'keke',  label: 'Keke',  pidgin: 'Enter Keke',  icon: 'car-outline',      color: '#FF9800', description: 'Tricycle / Keke NAPEP' },
  { mode: 'danfo', label: 'Danfo', pidgin: 'Enter Bus',   icon: 'bus-outline',      color: '#2196F3', description: 'Yellow bus / Danfo' },
  { mode: 'okada', label: 'Okada', pidgin: 'Enter Okada', icon: 'bicycle-outline',  color: '#9C27B0', description: 'Motorbike / Okada' },
  { mode: 'brt',   label: 'BRT',   pidgin: 'Enter BRT',   icon: 'bus',              color: '#22C55E', description: 'BRT / LAGBUS' },
  { mode: 'walk',  label: 'Walk',  pidgin: 'Waka',        icon: 'walk-outline',     color: '#607D8B', description: 'On foot' },
];

interface TransportModeSelectorProps {
  visible: boolean;
  savedPreference?: TransportMode | null;
  onSelect: (mode: TransportMode) => void;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function TransportModeSelector({
  visible,
  savedPreference,
  onSelect,
  onDismiss,
}: TransportModeSelectorProps) {
  const { theme } = useAppTheme();
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSelect = (mode: TransportMode) => {
    onSelect(mode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onDismiss}
      />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: theme.CARD_BACKGROUND, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: theme.BORDER }]} />

        <Text style={[styles.title, { color: theme.TEXT }]}>
          What transport dey near you?
        </Text>
        <Text style={[styles.subtitle, { color: theme.TEXT_SECONDARY }]}>
          Select what's available at your starting point
        </Text>

        <View style={styles.grid}>
          {OPTIONS.map((opt) => {
            const isSaved = savedPreference === opt.mode;
            return (
              <TouchableOpacity
                key={opt.mode}
                style={[
                  styles.option,
                  { backgroundColor: theme.SURFACE, borderColor: isSaved ? opt.color : theme.BORDER },
                  isSaved && styles.optionSaved,
                ]}
                onPress={() => handleSelect(opt.mode)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: opt.color + '22' }]}>
                  <Ionicons name={opt.icon as any} size={28} color={opt.color} />
                </View>
                <Text style={[styles.optionLabel, { color: theme.TEXT }]}>{opt.label}</Text>
                <Text style={[styles.optionPidgin, { color: theme.TEXT_SECONDARY }]}>{opt.pidgin}</Text>
                {isSaved && (
                  <View style={[styles.savedBadge, { backgroundColor: opt.color }]}>
                    <Text style={styles.savedBadgeText}>Last used</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.cancelBtn} onPress={onDismiss}>
          <Text style={[styles.cancelText, { color: theme.TEXT_SECONDARY }]}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: SPACING.LG,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: SPACING.MD,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.35, shadowRadius: 18 },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: SPACING.LG,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  title: {
    fontSize: FONT_SIZES.HEADING_3,
    fontWeight: '800',
    marginBottom: SPACING.XS,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FONT_SIZES.BODY,
    marginBottom: SPACING.LG,
    lineHeight: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.LG,
  },
  option: {
    width: '28%',
    flex: 1,
    minWidth: 90,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: SPACING.SM,
    borderRadius: 16,
    borderWidth: 1.5,
    position: 'relative',
  },
  optionSaved: {
    borderWidth: 2,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  optionLabel: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '700',
    textAlign: 'center',
  },
  optionPidgin: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  savedBadge: {
    position: 'absolute',
    top: -7,
    right: -7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  savedBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.MD,
  },
  cancelText: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
});
