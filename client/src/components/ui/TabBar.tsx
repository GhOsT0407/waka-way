import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Fonts, Typography, Tracking } from '../../theme/typography';
import { Space, HIT } from '../../theme/spacing';

// Bottom tab bar — Home · Live · Report · You (WakaWay Mobile canvas, 1a).
//
// Sits on translucent material over whatever is behind it (the live map on
// Home), which is why it blurs rather than paints. The active tab's glyph
// sits in a danfo-yellow tile; the label colour is textMuted, which clears
// 4.5:1 on both grounds. Every item is 88×48 with hitSlop up to 44pt.

type IconPair = { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap };

const ICONS: Record<string, IconPair> = {
  Home:   { active: 'home',            inactive: 'home-outline' },
  Live:   { active: 'radio',           inactive: 'radio-outline' },
  Report: { active: 'megaphone',       inactive: 'megaphone-outline' },
  You:    { active: 'person',          inactive: 'person-outline' },
};

const LABELS: Record<string, string> = {
  Home: 'Home',
  Live: 'Live',
  Report: 'Report',
  You: 'You',
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const { WW, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const s = useMemo(() => makeStyles(WW), [WW]);

  // Android's BlurView is costlier and less consistent than iOS's; a solid
  // frosted colour there keeps the material idea without the frame cost.
  const Material = Platform.OS === 'ios' ? BlurView : View;
  const materialProps = Platform.OS === 'ios'
    ? { intensity: 40, tint: isDark ? 'dark' : 'light' } as const
    : {};

  return (
    <Material {...materialProps} style={[s.bar, { paddingBottom: Math.max(insets.bottom, Space.sm) }]}>
      <View style={s.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const icon = ICONS[route.name] ?? ICONS.Home;
          const label = LABELS[route.name] ?? route.name;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => [s.item, pressed && s.itemPressed]}
            >
              <View style={[s.glyph, focused && s.glyphActive]}>
                <Ionicons
                  name={focused ? icon.active : icon.inactive}
                  size={18}
                  color={focused ? WW.textOnOrange : WW.textMuted}
                />
              </View>
              <Text style={[s.label, focused ? s.labelActive : s.labelInactive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Material>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    bar: {
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : WW.frosted,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: WW.border,
      paddingTop: Space.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      alignItems: 'flex-start',
    },
    item: {
      width: 88,
      minHeight: HIT + 4,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    itemPressed: { opacity: 0.6 },
    glyph: {
      width: 28, height: 24, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    glyphActive: { backgroundColor: WW.orange },
    label: { fontSize: Typography.xs, letterSpacing: Tracking.none },
    labelActive:   { fontFamily: Fonts.bold, color: WW.text },
    labelInactive: { fontFamily: Fonts.semibold, color: WW.textMuted },
  });
}
