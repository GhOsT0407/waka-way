import React, { useRef, useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface Props {
  onPress?: () => void;
}

export default function ShareLocationButton({ onPress }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const scale = useRef(new Animated.Value(1)).current;
  const cfg   = { damping: 20, stiffness: 400, useNativeDriver: true };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <TouchableOpacity
        style={styles.button}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, ...cfg }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1.0,  ...cfg }).start()}
        onPress={onPress}
        activeOpacity={1}
        accessibilityLabel="Share My Location"
        accessibilityRole="button"
      >
        <Ionicons name="share-outline" size={20} color={WW.orange} />
        <Text style={styles.label}>Share My Location</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 8 },
  button: {
    height: 52,
    backgroundColor: WW.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WW.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { color: WW.orange, fontSize: Typography.lg, fontWeight: Typography.semibold },
});
}
