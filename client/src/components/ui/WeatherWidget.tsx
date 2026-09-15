import React, { useRef, useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

const ICON_MAP = { sunny: 'sunny', cloudy: 'cloudy', rainy: 'rainy' } as const;

interface Props {
  temp: number;
  condition?: 'sunny' | 'cloudy' | 'rainy';
}

export default function WeatherWidget({ temp, condition = 'cloudy' }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const scale = useRef(new Animated.Value(1)).current;
  const cfg   = { damping: 20, stiffness: 400, useNativeDriver: true };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPressIn={() => Animated.spring(scale, { toValue: 0.96, ...cfg }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1.0, ...cfg }).start()}
        activeOpacity={1}
        accessibilityLabel={`Current weather: ${temp} degrees, ${condition}`}
        accessibilityRole="button"
        style={styles.inner}
      >
        <Ionicons name={ICON_MAP[condition] as any} size={18} color={WW.text} style={{ marginRight: 4 }} />
        <Text style={styles.temp}>{temp}°</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderColor: WW.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  temp: {
    color: WW.text,
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    letterSpacing: -0.3,
  },
});
}
