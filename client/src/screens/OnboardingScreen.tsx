import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WW_DARK, type WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius } from '../theme/spacing';

export const ONBOARDING_DONE_KEY = '@waka_onboarding_done';

// Onboarding (WakaWay Mobile canvas): three dark slides, a yellow rule, the
// title at 42/800, one line of body, a progress line and one yellow CTA.
// Dark in both themes -- it reads WW_DARK directly, like Navigation.

const SLIDES = [
  { title: 'Lagos in your pocket', body: 'Danfo, keke, okada, BRT — one route, end to end.', cta: 'Continue' },
  { title: 'See the fare first',   body: 'Real prices before you board, peak hours included.', cta: 'Continue' },
  { title: 'Works with no data',   body: 'The routes live on your phone. No network, still waka.', cta: 'Start' },
];

const EASE = Easing.bezier(0.32, 0.72, 0, 1);

interface Props { onDone: () => void }

export default function OnboardingScreen({ onDone }: Props) {
  const insets = useSafeAreaInsets();
  const WW = WW_DARK;
  const s = useMemo(() => makeStyles(WW), [WW]);
  const [index, setIndex] = useState(0);
  const rise = useRef(new Animated.Value(1)).current;
  const progress = useRef(new Animated.Value(1 / SLIDES.length)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    rise.setValue(0);
    Animated.parallel([
      Animated.timing(rise, { toValue: 1, duration: 420, easing: EASE, useNativeDriver: true }),
      Animated.timing(progress, { toValue: (index + 1) / SLIDES.length, duration: 500, easing: EASE, useNativeDriver: false }),
    ]).start();
  }, [index, rise, progress]);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(onDone);
  };

  const next = () => (index >= SLIDES.length - 1 ? finish() : setIndex(index + 1));
  const slide = SLIDES[index];

  return (
    <Animated.View style={[s.root, { opacity: fade, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, Space.lg) + 34 }]}>
      <StatusBar style="light" />

      <View style={s.topRow}>
        <Text style={s.count}>{String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</Text>
        <Pressable onPress={finish} hitSlop={8} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <Animated.View style={[s.body, {
        opacity: rise,
        transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }]}>
        <View style={s.rule} />
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.copy}>{slide.body}</Text>
      </Animated.View>

      <View style={s.bottomRow}>
        <View style={s.track}>
          <Animated.View style={[s.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </View>
        <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [s.cta, pressed && { backgroundColor: WW.orangeGlow }]}>
          <Text style={s.ctaText}>{slide.cta}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: WW.bg, paddingHorizontal: 32 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    count: { fontFamily: Fonts.extrabold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted },
    skip: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textMuted, padding: 8 },

    body: { flex: 1, justifyContent: 'center', gap: 20, paddingBottom: 40 },
    rule: { width: 46, height: 8, borderRadius: Radius.pill, backgroundColor: WW.orange },
    title: {
      fontFamily: Fonts.extrabold, fontSize: 42, lineHeight: 43,
      color: WW.text, letterSpacing: -1.4, maxWidth: 300,
    },
    copy: { fontFamily: Fonts.regular, fontSize: Typography.lg, lineHeight: Typography.lg * 1.5, color: WW.textSub, maxWidth: 280 },

    bottomRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    track: { flex: 1, height: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(242,241,237,0.14)', overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: WW.orange, borderRadius: Radius.pill },
    cta: {
      paddingVertical: 15, paddingHorizontal: 26, borderRadius: Radius.pill,
      backgroundColor: WW.orange,
    },
    ctaText: { fontFamily: Fonts.extrabold, fontSize: Typography.md, color: WW.textOnOrange },
  });
}
