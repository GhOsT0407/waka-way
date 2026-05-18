import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Colors } from '../../theme/colors';

export default function LocationDot() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.spring(pulse, { toValue: 1.18, damping: 10, stiffness: 100, useNativeDriver: true }),
        Animated.spring(pulse, { toValue: 1.0,  damping: 10, stiffness: 100, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.wrapper}>
      <View style={styles.ring}>
        <Animated.View style={[styles.dot, { transform: [{ scale: pulse }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  ring: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 8,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.blue,
  },
});
