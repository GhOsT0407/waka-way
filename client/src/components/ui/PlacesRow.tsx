import React, { useRef } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface PlaceItem {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  iconColor: string;
  bgColor: string;
}

const PLACES: PlaceItem[] = [
  { id: 'work',  label: 'Work',          sublabel: 'Add',    icon: 'briefcase', iconColor: '#fff',      bgColor: Colors.workBlue  },
  { id: 'home',  label: 'Home',          sublabel: 'Set',    icon: 'home',      iconColor: '#fff',      bgColor: Colors.homeGreen },
  { id: 'saved', label: 'Nearby',        sublabel: 'Stops',  icon: 'bus',       iconColor: '#fff',      bgColor: Colors.savedGray },
  { id: 'add',   label: 'Add',           sublabel: '',       icon: 'add',       iconColor: Colors.blue, bgColor: Colors.addDark   },
];

function PlaceButton({ item, onPress }: { item: PlaceItem; onPress?: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const cfg   = { damping: 20, stiffness: 400, useNativeDriver: true };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.itemWrapper}
        onPressIn={() => Animated.spring(scale, { toValue: 0.92, ...cfg }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1.0,  ...cfg }).start()}
        onPress={onPress}
        activeOpacity={1}
        accessibilityLabel={item.label}
        accessibilityRole="button"
      >
        <View style={[styles.circle, { backgroundColor: item.bgColor }]}>
          <Ionicons name={item.icon as any} size={24} color={item.iconColor} />
        </View>
        <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        {!!item.sublabel && (
          <Text style={[styles.sublabel, item.sublabel === 'Add' && styles.sublabelBlue]}>
            {item.sublabel}
          </Text>
        )}
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
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Places</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PLACES.map((item) => (
          <PlaceButton key={item.id} item={item} onPress={() => onItemPress?.(item.id)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section:      { paddingHorizontal: 16, marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.xl, fontWeight: Typography.bold, marginRight: 4 },
  row:          { gap: 16, paddingRight: 8 },
  itemWrapper:  { alignItems: 'center', width: 68 },
  circle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  label:        { color: Colors.textPrimary, fontSize: Typography.sm, fontWeight: Typography.medium, textAlign: 'center' },
  sublabel:     { color: Colors.textSecondary, fontSize: 11, marginTop: 2, textAlign: 'center' },
  sublabelBlue: { color: Colors.blue },
});
