import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useNearbyAlerts,
  confirmContribution,
  Contribution,
} from '../hooks/useRealtimeContributions';
import { useAppTheme } from '../context/ThemeContext';
import type { WW_DARK as WWShape } from '../theme/colors';
import { Fonts } from '../theme/typography';

type WW = typeof WWShape;

// ─── Type config ──────────────────────────────────────────────────────────────
function getTypeCfg(type: string, WW: WW) {
  const cfg: Record<string, { emoji: string; color: string; bg: string; label: string }> = {
    traffic:      { emoji: '🚦', color: WW.danfo,  bg: 'rgba(245,197,24,0.12)', label: 'Traffic'  },
    security:     { emoji: '🛡️', color: WW.okada,  bg: 'rgba(239,68,68,0.10)',  label: 'Security' },
    hazard:       { emoji: '⚠️', color: '#F97316', bg: 'rgba(249,115,22,0.10)', label: 'Hazard'   },
    danger_zone:  { emoji: '🚨', color: WW.okada,  bg: 'rgba(239,68,68,0.10)',  label: 'Danger'   },
    construction: { emoji: '🚧', color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', label: 'Works'    },
  };
  return cfg[type] ?? { emoji: 'ℹ️', color: WW.brt, bg: 'rgba(37,99,235,0.10)', label: 'Alert' };
}

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── Single alert card ────────────────────────────────────────────────────────
const AlertCard = ({
  item,
  WW,
  onConfirm,
}: {
  item: Contribution;
  WW: WW;
  onConfirm: (id: string) => void;
}) => {
  const cfg = getTypeCfg(item.type, WW);
  const ac = makeAcStyles(WW);
  const [localConfirmed, setLocalConfirmed] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleConfirm = () => {
    if (localConfirmed) return;
    setLocalConfirmed(true);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.35, duration: 90,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 160, useNativeDriver: true }),
    ]).start();
    onConfirm(item.id);
  };

  const confirmCount = (item.confirms || 0) + (localConfirmed ? 1 : 0);

  return (
    <View style={[ac.wrap, { borderColor: cfg.color + '35' }]}>
      {/* Left color tag */}
      <View style={[ac.leftTag, { backgroundColor: cfg.color }]} />

      {/* Type badge */}
      <View style={[ac.badge, { backgroundColor: cfg.bg }]}>
        <Text style={ac.emoji}>{cfg.emoji}</Text>
        <Text style={[ac.typeText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
      </View>

      {/* Title */}
      <Text style={ac.title} numberOfLines={2}>{item.title}</Text>

      {/* Footer: time + thumbs up */}
      <View style={ac.footer}>
        <Text style={ac.age}>{timeAgo(item.created_at)}</Text>
        <TouchableOpacity
          style={ac.thumbRow}
          onPress={handleConfirm}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <Ionicons
              name={localConfirmed ? 'checkmark-circle' : 'thumbs-up-outline'}
              size={11}
              color={localConfirmed ? WW.green : WW.textMuted}
            />
          </Animated.View>
          <Text style={[ac.count, localConfirmed && { color: WW.green }]}>
            {confirmCount}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

function makeAcStyles(WW: WW) {
  return StyleSheet.create({
    wrap: {
      width: 132,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: WW.bgSurface,
      overflow: 'hidden',
      paddingBottom: 10,
    },
    leftTag: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 3,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginLeft: 10,
      marginTop: 10,
      marginRight: 10,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    emoji:    { fontSize: 10 },
    typeText: { fontSize: 9, fontFamily: Fonts.bold, letterSpacing: 0.5 },
    title:    {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: WW.text,
      lineHeight: 17,
      marginHorizontal: 10,
      marginTop: 8,
      flex: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 10,
      marginTop: 8,
    },
    age:      { fontSize: 10, fontFamily: Fonts.regular, color: WW.textMuted },
    thumbRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    count:    { fontSize: 10, fontFamily: Fonts.semibold, color: WW.textMuted },
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
interface LiveAlertsFeedProps {
  onSeeAll: () => void;
}

export default function LiveAlertsFeed({ onSeeAll }: LiveAlertsFeedProps) {
  const { WW } = useAppTheme();
  const s = makeStyles(WW);
  const { contributions, loading } = useNearbyAlerts();
  const liveDotAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotAnim, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(liveDotAnim, { toValue: 1,    duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const activeAlerts = contributions
    .filter((c) => c.status !== 'rejected')
    .slice(0, 10);

  return (
    <View style={s.wrap}>
      {/* Section header */}
      <View style={s.header}>
        <View style={s.liveBadge}>
          <Animated.View style={[s.liveDot, { opacity: liveDotAnim }]} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
        <Text style={s.sectionTitle}>COMMUNITY ALERTS</Text>
        <TouchableOpacity
          onPress={onSeeAll}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={s.seeAll}>SEE ALL →</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.loadingRow}>
          <ActivityIndicator size="small" color={WW.textMuted} />
          <Text style={s.loadingText}>Checking Lagos roads…</Text>
        </View>
      ) : activeAlerts.length === 0 ? (
        <View style={s.emptyRow}>
          <Ionicons name="checkmark-circle-outline" size={14} color={WW.green} />
          <Text style={s.emptyText}>All clear on Lagos roads right now</Text>
        </View>
      ) : (
        <FlatList
          data={activeAlerts}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <AlertCard item={item} WW={WW} onConfirm={confirmContribution} />
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.list}
          decelerationRate="fast"
          snapToInterval={142}
          snapToAlignment="start"
        />
      )}
    </View>
  );
}

function makeStyles(WW: WW) {
  return StyleSheet.create({
    wrap: {
      paddingTop: 4,
      paddingBottom: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      marginBottom: 10,
      gap: 8,
    },
    liveBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: WW.okada,
    },
    liveText: {
      fontSize: 9,
      fontFamily: Fonts.bold,
      color: WW.okada,
      letterSpacing: 1,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 10,
      fontFamily: Fonts.bold,
      color: WW.textMuted,
      letterSpacing: 1.2,
    },
    seeAll: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
      color: WW.green,
      letterSpacing: 0.5,
    },
    list: {
      paddingHorizontal: 16,
      gap: 10,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    loadingText: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      color: WW.textMuted,
    },
    emptyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    emptyText: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      color: WW.textMuted,
    },
  });
}
