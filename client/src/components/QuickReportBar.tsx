import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addReport } from '../services/reportService';
import { WW } from '../theme/colors';
import { Fonts } from '../theme/typography';

// ─── Report categories ────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'Traffic',
    emoji: '🚦',
    label: 'Go-slow',
    color: WW.danfo,
    bg: 'rgba(245,197,24,0.12)',
    description: 'Heavy traffic reported',
  },
  {
    key: 'Hazard',
    emoji: '⚠️',
    label: 'Hazard',
    color: '#F97316',
    bg: 'rgba(249,115,22,0.10)',
    description: 'Road hazard reported',
  },
  {
    key: 'Security',
    emoji: '🛡️',
    label: 'Security',
    color: WW.okada,
    bg: 'rgba(239,68,68,0.10)',
    description: 'Security alert reported',
  },
  {
    key: 'Security',
    emoji: '🚨',
    label: 'One-chance',
    color: '#C026D3',
    bg: 'rgba(192,38,211,0.10)',
    description: 'One-chance robbery reported',
    extraDescription: 'one-chance robbery',
  },
] as const;

type ReportType = 'Traffic' | 'Hazard' | 'Security';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ message, color }: { message: string; color: string }) => {
  const opAnim = useRef(new Animated.Value(0)).current;
  const yAnim  = useRef(new Animated.Value(8)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(yAnim,  { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.timing(yAnim,  { toValue: -6, duration: 280, useNativeDriver: true }),
        ]).start();
      }, 1800);
    });
  }, []);

  return (
    <Animated.View
      style={[toast.wrap, { borderColor: color + '50', opacity: opAnim, transform: [{ translateY: yAnim }] }]}
      pointerEvents="none"
    >
      <Ionicons name="checkmark-circle" size={14} color={color} />
      <Text style={toast.text}>{message}</Text>
    </Animated.View>
  );
};

const toast = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: -36,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: WW.bgElevated,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    zIndex: 99,
  },
  text: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    color: WW.text,
  },
});

// ─── ReportTile ───────────────────────────────────────────────────────────────
const ReportTile = ({
  cat,
  userCoords,
  onReported,
}: {
  cat: typeof CATEGORIES[number];
  userCoords: { latitude: number; longitude: number };
  onReported: (msg: string, color: string) => void;
}) => {
  const [busy, setBusy] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 80,  useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1,    duration: 180, useNativeDriver: true }),
    ]).start();

    try {
      const desc = 'extraDescription' in cat
        ? `${cat.extraDescription} at this location`
        : `${cat.description} at this location`;

      await addReport({
        type: cat.key as ReportType,
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        description: desc,
      });
      onReported(`${cat.emoji} ${cat.description}`, cat.color);
    } catch {
      onReported('Report sent', WW.green);
    }

    setTimeout(() => setBusy(false), 3000);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[tile.wrap, { backgroundColor: busy ? cat.color + '20' : WW.bgSurface, borderColor: busy ? cat.color + '60' : WW.border }]}
        onPress={handlePress}
        activeOpacity={0.75}
      >
        <View style={[tile.iconWrap, { backgroundColor: cat.bg }]}>
          <Text style={tile.emoji}>{cat.emoji}</Text>
        </View>
        <Text style={[tile.label, busy && { color: cat.color }]}>{cat.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const tile = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    // Map-overlay frosted look
    backgroundColor: 'rgba(8,13,11,0.72)',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 14 },
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 9,
    color: 'rgba(240,245,242,0.80)',
    textAlign: 'center',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────
interface QuickReportBarProps {
  userCoords: { latitude: number; longitude: number };
}

export default function QuickReportBar({ userCoords }: QuickReportBarProps) {
  const [toastMsg, setToastMsg] = useState<{ msg: string; color: string } | null>(null);

  const showToast = (msg: string, color: string) => {
    setToastMsg({ msg, color });
    setTimeout(() => setToastMsg(null), 2400);
  };

  return (
    <View style={s.wrap}>
      {/* Toast */}
      {toastMsg && <Toast message={toastMsg.msg} color={toastMsg.color} />}

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>QUICK REPORT</Text>
        <Text style={s.sub}>Tap to alert your area instantly</Text>
      </View>

      {/* Tiles */}
      <View style={s.tiles}>
        {CATEGORIES.map((cat, i) => (
          <ReportTile
            key={i}
            cat={cat}
            userCoords={userCoords}
            onReported={showToast}
          />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: 'rgba(240,245,242,0.50)',
  },
  sub: {
    fontFamily: Fonts.regular,
    fontSize: 9,
    color: 'rgba(240,245,242,0.35)',
  },
  tiles: {
    flexDirection: 'row',
    gap: 7,
  },
});
