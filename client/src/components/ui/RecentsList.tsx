import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Typography } from '../../theme/typography';

export interface RecentItem {
  id: string;
  name: string;
  location: string;
}

interface Props {
  items: RecentItem[];
  onItemPress?: (item: RecentItem) => void;
}

export default function RecentsList({ items, onItemPress }: Props) {
  const { WW } = useAppTheme();
  const styles = useMemo(() => makeStyles(WW), [WW]);
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.header} activeOpacity={0.7} accessibilityRole="button">
        <Text style={styles.sectionTitle}>Recents</Text>
        <Ionicons name="chevron-forward" size={16} color={WW.textSub} />
      </TouchableOpacity>

      <View style={styles.card}>
        {items.map((item, index) => (
          <React.Fragment key={item.id}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => onItemPress?.(item)}
              activeOpacity={0.7}
              accessibilityLabel={`${item.name}, ${item.location}`}
              accessibilityRole="button"
            >
              <View style={styles.iconCircle}>
                <Ionicons name="time-outline" size={20} color={WW.textSub} />
              </View>
              <View style={styles.textGroup}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.location} numberOfLines={1}>{item.location}</Text>
              </View>
              <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button">
                <Ionicons name="ellipsis-horizontal" size={20} color={WW.textSub} />
              </TouchableOpacity>
            </TouchableOpacity>
            {index < items.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
  section:      { paddingHorizontal: 16, marginBottom: 8 },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: WW.text, fontSize: Typography.xl, fontWeight: Typography.bold, marginRight: 4 },
  card: {
    backgroundColor: WW.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WW.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    minHeight: 56, gap: 12,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: WW.bgSurface,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  textGroup: { flex: 1 },
  name:      { color: WW.text, fontSize: Typography.lg, fontWeight: Typography.medium },
  location:  { color: WW.textSub, fontSize: Typography.md, marginTop: 2 },
  divider:   { height: 1, backgroundColor: WW.divider, marginLeft: 66 },
});
}
