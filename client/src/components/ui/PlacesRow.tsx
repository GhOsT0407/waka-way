import React, { useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface PlaceItem {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bgColor: string;
}

const PLACES: PlaceItem[] = [
  { id: 'home',  label: 'Home',   icon: 'home',      iconColor: '#fff', bgColor: Colors.homeGreen },
  { id: 'work',  label: 'Work',   icon: 'briefcase', iconColor: '#fff', bgColor: Colors.workBlue  },
  { id: 'saved', label: 'Nearby', icon: 'bus',        iconColor: '#fff', bgColor: Colors.savedGray },
  { id: 'add',   label: 'Add',    icon: 'add',        iconColor: Colors.blue, bgColor: Colors.addDark },
];

function PlaceButton({ item, onPress }: { item: PlaceItem; onPress?: () => void }) {
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

const styles = StyleSheet.create({
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
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
});
