import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT_SIZES, SPACING } from '../../utils/constants';

interface Props {
  isOnline: boolean;
}

export function OfflineBanner({ isOnline }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-60)).current;
  const wasOffline = useRef(false);
  const [showOnline, setShowOnline] = React.useState(false);

  useEffect(() => {
    if (!isOnline) {
      // Slide in offline banner
      wasOffline.current = true;
      setShowOnline(false);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start();
    } else if (wasOffline.current) {
      // Briefly show "back online" then hide
      setShowOnline(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(translateY, {
            toValue: -60,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowOnline(false);
            wasOffline.current = false;
          });
        }, 2000);
      });
    }
  }, [isOnline]);

  if (isOnline && !showOnline && !wasOffline.current) return null;

  const bgColor = showOnline ? '#2E7D32' : '#B71C1C';
  const icon = showOnline ? 'wifi' : 'wifi-outline';
  const message = showOnline ? 'Back online' : 'No internet connection — using offline routes';

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: bgColor, paddingTop: insets.top + 4, transform: [{ translateY }] },
      ]}
    >
      <Ionicons name={icon as any} size={16} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    paddingBottom: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: FONT_SIZES.SMALL,
    fontWeight: '600',
  },
});
