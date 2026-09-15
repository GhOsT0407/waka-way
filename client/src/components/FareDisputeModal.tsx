import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Share,
  Platform,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import type { WW_DARK as WWShape } from '../theme/colors';
import { Fonts } from '../theme/typography';
import type { RouteLeg } from '../services/smartRoutingService';

type WW = typeof WWShape;

// ─── Mode display config ──────────────────────────────────────────────────────
function getMdCfg(mode: string, WW: WW): { icon: keyof typeof Ionicons.glyphMap; label: string; color: string } {
  const cfg: Record<string, { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }> = {
    danfo:  { icon: 'bus-outline',     label: 'Danfo',  color: WW.danfo  },
    brt:    { icon: 'train-outline',   label: 'BRT',    color: WW.brt    },
    keke:   { icon: 'car-outline',     label: 'Keke',   color: WW.keke   },
    okada:  { icon: 'bicycle-outline', label: 'Okada',  color: WW.okada  },
    ferry:  { icon: 'boat-outline',    label: 'Ferry',  color: WW.ferry  },
    rail:   { icon: 'train-outline',   label: 'Train',  color: '#7C3AED' },
    walk:   { icon: 'walk-outline',    label: 'Walk',   color: WW.textMuted },
  };
  return cfg[mode] ?? { icon: 'navigate-outline' as const, label: mode, color: WW.textSub };
}

function formatFare(min: number, max: number): string {
  if (min === 0 && max === 0) return 'Free';
  if (min === max) return `₦${min.toLocaleString()}`;
  return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface FareDisputeModalProps {
  visible: boolean;
  onClose: () => void;
  origin: string;
  destination: string;
  legs: RouteLeg[];
  totalMin: number;
  totalMax: number;
}

export default function FareDisputeModal({
  visible,
  onClose,
  origin,
  destination,
  legs,
  totalMin,
  totalMax,
}: FareDisputeModalProps) {
  const { WW } = useAppTheme();
  const s = makeStyles(WW);

  // Only transit legs matter for a fare dispute (walk is always free)
  const transitLegs = legs.filter((l) => l.mode !== 'walk');

  const handleShare = async () => {
    const breakdown = transitLegs
      .map((l) => {
        const cfg = getMdCfg(l.mode, WW);
        return `• ${cfg.label}: ${formatFare(l.priceMin, l.priceMax)}`;
      })
      .join('\n');

    const message = [
      '✅ WakaWay Correct Fare',
      `${origin} → ${destination}`,
      `Total: ${formatFare(totalMin, totalMax)}`,
      '',
      'Breakdown:',
      breakdown,
      '',
      'Get WakaWay for verified Lagos fares',
    ].join('\n');

    try {
      await Share.share(
        { message, title: 'WakaWay Correct Fare' },
        { dialogTitle: 'Share fare info' }
      );
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={s.safe}>
        <View style={s.container}>

          {/* ── Close button ───────────────────────────────────────────── */}
          <View style={s.topBar}>
            <TouchableOpacity
              onPress={onClose}
              style={s.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={WW.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={s.scroll}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Shield icon ─────────────────────────────────────────── */}
            <View style={s.shieldWrap}>
              <Ionicons name="shield-checkmark" size={40} color={WW.green} />
            </View>

            {/* ── Label ───────────────────────────────────────────────── */}
            <Text style={s.label}>CORRECT FARE</Text>
            <Text style={s.route}>{origin} → {destination}</Text>

            {/* ── Fare hero ───────────────────────────────────────────── */}
            <View style={s.fareHero}>
              <Text style={s.fareMin}>₦{totalMin.toLocaleString()}</Text>
              {totalMin !== totalMax && (
                <Text style={s.fareMax}>– ₦{totalMax.toLocaleString()}</Text>
              )}
            </View>

            {/* ── Divider ─────────────────────────────────────────────── */}
            <View style={s.divider} />

            {/* ── Breakdown ───────────────────────────────────────────── */}
            {transitLegs.length > 0 && (
              <>
                <Text style={s.breakdownTitle}>BREAKDOWN</Text>
                <View style={s.legsWrap}>
                  {transitLegs.map((leg, i) => {
                    const cfg = getMdCfg(leg.mode, WW);
                    return (
                      <View
                        key={leg.id}
                        style={[s.legRow, i < transitLegs.length - 1 && s.legRowBorder]}
                      >
                        <View style={[s.legIconWrap, { backgroundColor: cfg.color + '22' }]}>
                          <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                        </View>
                        <Text style={s.legMode}>{cfg.label}</Text>
                        <Text style={s.legFrom} numberOfLines={1}>
                          {leg.from.name} → {leg.to.name}
                        </Text>
                        <Text style={[s.legFare, { color: cfg.color }]}>
                          {formatFare(leg.priceMin, leg.priceMax)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}

            {/* ── Divider ─────────────────────────────────────────────── */}
            <View style={s.divider} />

            {/* ── Instruction ─────────────────────────────────────────── */}
            <View style={s.instructionWrap}>
              <View style={s.instructionIcon}>
                <Ionicons name="information-circle" size={16} color={WW.brt} />
              </View>
              <Text style={s.instruction}>
                Show this screen to your conductor if you are being overcharged.
                These are the standard fares for this route in Lagos.
              </Text>
            </View>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <View style={s.actions}>
              <TouchableOpacity
                style={s.shareBtn}
                onPress={handleShare}
                activeOpacity={0.82}
              >
                <Ionicons name="share-social-outline" size={16} color={WW.bg} />
                <Text style={s.shareBtnText}>Share Fare Info</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.closeLink}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={s.closeLinkText}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* ── Footer branding ─────────────────────────────────────────── */}
          <View style={s.footer}>
            <Ionicons name="shield-checkmark-outline" size={11} color={WW.green} />
            <Text style={s.footerText}>
              waka<Text style={[s.footerText, { color: WW.danfo }]}>WAY</Text>
              {' '}· Verified Lagos Fares
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function makeStyles(WW: WW) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: WW.bg,
    },
    container: {
      flex: 1,
      backgroundColor: WW.bg,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'android' ? 16 : 8,
      paddingBottom: 4,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: WW.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      paddingHorizontal: 24,
      paddingBottom: 24,
      alignItems: 'center',
    },
    shieldWrap: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(93,187,99,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
      marginTop: 12,
    },
    label: {
      fontFamily: Fonts.bold,
      fontSize: 11,
      letterSpacing: 3,
      color: WW.textMuted,
      marginBottom: 8,
    },
    route: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: WW.text,
      textAlign: 'center',
      marginBottom: 24,
    },
    fareHero: {
      alignItems: 'center',
      marginBottom: 32,
    },
    fareMin: {
      fontFamily: Fonts.extrabold,
      fontSize: 52,
      color: WW.danfo,
      letterSpacing: -2,
      lineHeight: 58,
    },
    fareMax: {
      fontFamily: Fonts.semibold,
      fontSize: 22,
      color: WW.textSub,
      marginTop: 4,
    },
    divider: {
      width: '100%',
      height: StyleSheet.hairlineWidth,
      backgroundColor: WW.border,
      marginVertical: 20,
    },
    breakdownTitle: {
      fontFamily: Fonts.bold,
      fontSize: 10,
      letterSpacing: 2,
      color: WW.textMuted,
      alignSelf: 'flex-start',
      marginBottom: 12,
    },
    legsWrap: {
      width: '100%',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: WW.border,
      overflow: 'hidden',
    },
    legRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      backgroundColor: WW.bgSurface,
    },
    legRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: WW.border,
    },
    legIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    legMode: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      color: WW.text,
      width: 48,
      flexShrink: 0,
    },
    legFrom: {
      flex: 1,
      fontFamily: Fonts.regular,
      fontSize: 11,
      color: WW.textMuted,
    },
    legFare: {
      fontFamily: Fonts.bold,
      fontSize: 13,
      flexShrink: 0,
    },
    instructionWrap: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: 'rgba(37,99,235,0.08)',
      borderRadius: 10,
      padding: 14,
      width: '100%',
    },
    instructionIcon: {
      marginTop: 1,
      flexShrink: 0,
    },
    instruction: {
      flex: 1,
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: WW.textSub,
      lineHeight: 19,
    },
    actions: {
      width: '100%',
      gap: 10,
      marginTop: 24,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: WW.green,
      borderRadius: 14,
      paddingVertical: 15,
    },
    shareBtnText: {
      fontFamily: Fonts.bold,
      fontSize: 15,
      color: WW.bg,
      letterSpacing: -0.2,
    },
    closeLink: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    closeLinkText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: WW.textMuted,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingBottom: Platform.OS === 'ios' ? 0 : 16,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: WW.border,
    },
    footerText: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      color: WW.textMuted,
      letterSpacing: 0.3,
    },
  });
}
