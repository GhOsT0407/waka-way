import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../context/ThemeContext';
import { SPACING, BORDER_RADIUS, FONT_SIZES } from '../../utils/constants';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

const TOAST_CONFIG: Record<ToastType, { icon: keyof typeof Ionicons.glyphMap; colors: { bg: string; border: string; icon: string } }> = {
  success: {
    icon: 'checkmark-circle',
    colors: { bg: 'rgba(34,197,94,0.12)',  border: '#22C55E', icon: '#4ADE80' },
  },
  error: {
    icon: 'alert-circle',
    colors: { bg: 'rgba(239,68,68,0.12)',   border: '#EF4444', icon: '#F87171' },
  },
  warning: {
    icon: 'warning',
    colors: { bg: 'rgba(245,158,11,0.12)',  border: '#F59E0B', icon: '#FCD34D' },
  },
  info: {
    icon: 'information-circle',
    colors: { bg: 'rgba(34,197,94,0.12)',   border: '#22C55E', icon: '#4ADE80' },
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const config = TOAST_CONFIG[toast.type];

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      dismiss();
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(toast.id);
    });
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + SPACING.SM,
          transform: [{ translateY }],
          opacity,
          backgroundColor: config.colors.bg,
          borderLeftColor: config.colors.border,
          shadowColor: config.colors.border,
        },
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={24} color={config.colors.icon} />
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.title, { color: config.colors.icon }]}>
          {toast.title}
        </Text>
        {toast.message && (
          <Text style={[styles.message, { color: '#94A3B8' }]} numberOfLines={2}>
            {toast.message}
          </Text>
        )}
      </View>

      <TouchableOpacity onPress={dismiss} style={styles.closeButton}>
        <Ionicons name="close" size={20} color="#64748B" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: SPACING.MD,
    right: SPACING.MD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.MD,
    borderRadius: BORDER_RADIUS.LARGE,
    borderLeftWidth: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  iconContainer: {
    marginRight: SPACING.SM,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZES.BODY,
    fontWeight: '600',
  },
  message: {
    fontSize: FONT_SIZES.SMALL,
    marginTop: 2,
    lineHeight: 18,
  },
  closeButton: {
    padding: SPACING.XS,
    marginLeft: SPACING.SM,
  },
});

export default Toast;
