import React, { useRef, useMemo } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface PlaceItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
}

const makePlaces = (WW: WWColors): PlaceItem[] => [
  { id: 'home',  label: 'Home',   icon: 'home',      iconColor: '#fff', bgColor: WW.keke },
  { id: 'work',  label: 'Work',   icon: 'briefcase', iconColor: '#fff', bgColor: WW.brt  },
  { id: 'saved', label: 'Nearby', icon: 'bus',        iconColor: '#fff', bgColor: WW.textSub },
  { id: 'add',   label: 'Add',    icon: 'add',        iconColor: WW.orange, bgColor: WW.bgElevated },
];

function PlaceButton({ item, onPress }: { item: PlaceItem; onPress?: () => void }) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const scale = useRef(new Animated.Value(1)).current;
  const cfg   = { damping: 22, stiffness: 420, useNativeDriver: true };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.itemWrapper}
        onPressIn={() => Animated.spring(scale, { toValue: 0.9, ...cfg }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1.0, ...cfg }).start()}
        onPress={onPress}
        activeOpacity={1}
        accessibilityLabel={item.label}
        accessibilityRole="button"
      >
        <View style={[styles.circle, { backgroundColor: item.bgColor }]}>
          <Ionicons name={item.icon} size={20} color={item.iconColor} />
        </View>
        <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

interface Props {
  onItemPress?: (id: string) => void;
}

export default function PlacesRow({ onItemPress }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const PLACES = useMemo(() => makePlaces(WW), [WW]);
  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {PLACES.map((item) => (
          <PlaceButton key={item.id} item={item} onPress={() => onItemPress?.(item.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  section: { marginBottom: 12 },
  row:     { gap: 10, paddingHorizontal: 16, paddingRight: 16 },
  itemWrapper: { alignItems: 'center', width: 64 },
  circle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  label: {
    color: WW.text,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
}
