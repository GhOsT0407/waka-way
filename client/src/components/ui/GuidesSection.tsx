import React, { useRef, useMemo } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

interface Props {
  favoritesCount?: number;
  onFavoritesPress?: () => void;
}

function FavoritesCard({ count, onPress }: { count: number; onPress?: () => void }) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  const scale = useRef(new Animated.Value(1)).current;
  const cfg   = { damping: 20, stiffness: 400, useNativeDriver: true };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.card}
        onPressIn={() => Animated.spring(scale, { toValue: 0.95, ...cfg }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1.0,  ...cfg }).start()}
        onPress={onPress}
        activeOpacity={1}
        accessibilityLabel={`Favourites, ${count} places`}
        accessibilityRole="button"
      >
        <View style={styles.iconArea}>
          <Ionicons name="star" size={52} color={WW.danfo} />
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardTitle}>Favourites</Text>
          <Text style={styles.cardCount}>{count} {count === 1 ? 'place' : 'places'}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function GuidesSection({ favoritesCount = 0, onFavoritesPress }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.header} onPress={onFavoritesPress} activeOpacity={0.7} accessibilityRole="button">
        <Text style={styles.sectionTitle}>Your Guides</Text>
        <Ionicons name="chevron-forward" size={16} color={WW.textSub} />
      </TouchableOpacity>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <FavoritesCard count={favoritesCount} onPress={onFavoritesPress} />
      </ScrollView>
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  section:       { paddingHorizontal: 16, marginBottom: 16 },
  header:        { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle:  { color: WW.text, fontSize: Typography.xl, fontWeight: Typography.bold, marginRight: 4 },
  scrollContent: { gap: 12, paddingRight: 8 },
  card: {
    width: 160, height: 160, borderRadius: 16,
    overflow: 'hidden', borderWidth: 1, borderColor: WW.border,
    backgroundColor: WW.bgElevated,
  },
  iconArea:   { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2D2010' },
  cardFooter: { paddingHorizontal: 12, paddingVertical: 10 },
  cardTitle:  { color: WW.text, fontSize: 15, fontWeight: Typography.bold },
  cardCount:  { color: WW.textSub, fontSize: Typography.sm, marginTop: 2 },
});
}
