import React, { useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, Modal, Animated, Easing, Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius } from '../theme/spacing';
import type { TransportMode } from '../services/smartRoutingService';

// "What transport dey near you?" (WakaWay Mobile canvas) — the one question
// between picking a destination and seeing routes. A 3-up grid of the modes
// a rider can start with; the last-used one is outlined in danfo yellow and
// wears a "Last used" tag.

interface Option {
  mode: TransportMode;
  label: string;
  pidgin: string;
  short: string;
  color: (WW: WWColors) => string;
  onColor: (WW: WWColors) => string;
}

const OPTIONS: Option[] = [
  { mode: 'keke',  label: 'Keke',  pidgin: 'Enter keke',  short: 'KK',  color: (W) => W.keke,  onColor: (W) => W.kekeText },
  { mode: 'danfo', label: 'Danfo', pidgin: 'Enter bus',   short: 'DNF', color: (W) => W.danfo, onColor: (W) => W.danfoText },
  { mode: 'okada', label: 'Okada', pidgin: 'Enter okada', short: 'OKD', color: (W) => W.okada, onColor: (W) => W.okadaText },
  { mode: 'brt',   label: 'BRT',   pidgin: 'Enter BRT',   short: 'BRT', color: (W) => W.brt,   onColor: (W) => W.brtText },
  { mode: 'walk',  label: 'Walk',  pidgin: 'Waka',        short: 'WK',  color: (W) => W.bgElevated, onColor: (W) => W.textSub },
];

interface Props {
  visible: boolean;
  savedPreference?: TransportMode | null;
  onSelect: (mode: TransportMode) => void;
  onDismiss: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const EASE = Easing.bezier(0.32, 0.72, 0, 1);

export default function TransportModeSelector({ visible, savedPreference, onSelect, onDismiss }: Props) {
  const { WW } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const slide = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const scrim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: visible ? 0 : SCREEN_HEIGHT, duration: visible ? 500 : 260, easing: visible ? EASE : Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: visible ? 1 : 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [visible, slide, scrim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[s.scrim, { opacity: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Cancel" />
      </Animated.View>

      <Animated.View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, Space.lg) + Space.md, transform: [{ translateY: slide }] }]}>
        <View style={s.handle} />
        <Text style={s.title}>What transport dey near you?</Text>
        <Text style={s.sub}>Wetin dey available where you dey stand</Text>

        <View style={s.grid}>
          {OPTIONS.map((o) => {
            const last = savedPreference === o.mode;
            const bg = o.color(WW);
            const isWalk = o.mode === 'walk';
            return (
              <Pressable
                key={o.mode}
                onPress={() => onSelect(o.mode)}
                accessibilityRole="button"
                accessibilityLabel={`${o.label}${last ? ', last used' : ''}`}
                style={({ pressed }) => [s.tile, last && s.tileLast, pressed && s.pressed]}
              >
                <View style={[s.badge, { backgroundColor: isWalk ? WW.bgElevated : bg + '2E' }]}>
                  <Text style={[s.badgeText, { color: isWalk ? WW.textSub : bg }]}>{o.short}</Text>
                </View>
                <Text style={s.label}>{o.label}</Text>
                <Text style={s.pidgin}>{o.pidgin}</Text>
                {last && (
                  <View style={[s.tag, { backgroundColor: isWalk ? WW.textSub : bg }]}>
                    <Text style={[s.tagText, { color: isWalk ? WW.bg : o.onColor(WW) }]}>Last used</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onDismiss} style={({ pressed }) => [s.cancel, pressed && s.pressed]} accessibilityRole="button">
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: WW.scrim },
    sheet: {
      position: 'absolute', left: 0, right: 0, bottom: 0,
      backgroundColor: WW.bgSurface,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: Space.lg, paddingTop: Space.md,
      shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 44, shadowOffset: { width: 0, height: -18 },
      elevation: 16,
    },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: WW.border, alignSelf: 'center', marginBottom: 18 },
    title: { fontFamily: Fonts.extrabold, fontSize: Typography.xl, color: WW.text, letterSpacing: Tracking.tight / 2, marginBottom: 4 },
    sub:   { fontFamily: Fonts.regular, fontSize: Typography.md, lineHeight: Typography.md * 1.35, color: WW.textSub, marginBottom: 18 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Space.sm },
    tile: {
      width: '31%', flexGrow: 1,
      alignItems: 'center', gap: 8,
      paddingVertical: 14, paddingHorizontal: 8,
      borderRadius: Radius.lg, borderWidth: 1.5, borderColor: WW.border,
      backgroundColor: WW.bgSurface,
    },
    tileLast: { borderColor: WW.orange },
    badge: { width: 50, height: 50, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: Fonts.extrabold, fontSize: Typography.md },
    label:  { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    pidgin: { fontFamily: Fonts.regular, fontSize: Typography.xs, color: WW.textSub },
    tag: { position: 'absolute', top: -7, right: -4, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },
    tagText: { fontFamily: Fonts.bold, fontSize: 9 },

    cancel: { paddingVertical: 14, alignItems: 'center' },
    cancelText: { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.textSub },
    pressed: { opacity: 0.8 },
  });
}
