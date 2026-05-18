import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface Props {
  onPress?: () => void;
}

export default function ShareLocationButton({ onPress }: Props) {
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
        <Ionicons name="share-outline" size={20} color={Colors.blue} />
        <Text style={styles.label}>Share My Location</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 8 },
  button: {
    height: 52,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { color: Colors.blue, fontSize: Typography.lg, fontWeight: Typography.semibold },
});
