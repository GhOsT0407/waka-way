import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { Contribution } from '../../hooks/useContributions';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Fonts, Typography, Tracking } from '../../theme/typography';
import { Space, Radius } from '../../theme/spacing';
import { kindMeta, timeAgo, freshnessOf, freshnessLabel } from '../../utils/reportKinds';
import { Sheet, SheetView, SheetRef } from '../ui/Sheet';

// One report, as the Live map's sheet (WakaWay Mobile canvas): kind · age,
// the title at 22/800, the body, then the two votes — "Still dey happen"
// confirms, "Don clear" dismisses. Both go through the vote RPC (0010).

interface AlertBottomSheetProps {
  contribution: Contribution | null;
  visible: boolean;
  onClose: () => void;
  userVote: 'CONFIRM' | 'DISMISS' | null;
  onVote: (contributionId: string, voteType: 'CONFIRM' | 'DISMISS') => Promise<boolean>;
  distance?: number;
}

export const AlertBottomSheet: React.FC<AlertBottomSheetProps> = ({
  contribution, visible, onClose, userVote, onVote, distance,
}) => {
  const { WW } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const ref = useRef<SheetRef>(null);
  const [voting, setVoting] = useState<'CONFIRM' | 'DISMISS' | null>(null);
  const [vote, setVote] = useState(userVote);

  useEffect(() => setVote(userVote), [userVote, contribution?.id]);
  useEffect(() => {
    if (visible && contribution) ref.current?.snapToIndex(0);
    else ref.current?.close();
  }, [visible, contribution]);

  if (!contribution) return null;
  const meta = kindMeta(contribution.type);
  const color = meta.color(WW);

  const cast = async (type: 'CONFIRM' | 'DISMISS') => {
    if (voting) return;
    setVoting(type);
    const ok = await onVote(contribution.id, type);
    if (ok) setVote(type);
    setVoting(null);
  };

  const confirms = contribution.confirm_count ?? contribution.confirms ?? 0;
  const dismisses = contribution.dismiss_count ?? contribution.dismisses ?? 0;
  const fresh = freshnessOf(contribution);
  const freshColor = fresh === 'verified' ? WW.green : fresh === 'reported' ? WW.warning : WW.textMuted;

  return (
    <Sheet
      ref={ref}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      onClose={onClose}
    >
      <SheetView style={s.body}>
        <View style={s.kindRow}>
          <View style={[s.kindDot, { backgroundColor: color }]} />
          <Text style={s.kind}>
            {meta.label.toUpperCase()} · {timeAgo(contribution.created_at).toUpperCase()}
            {distance != null ? ` · ${distance < 1 ? `${Math.round(distance * 1000)} M` : `${distance.toFixed(1)} KM`} AWAY` : ''}
          </Text>
        </View>
        <View style={[s.freshPill, { backgroundColor: freshColor + '22' }]}>
          <View style={[s.kindDot, { backgroundColor: freshColor }]} />
          <Text style={[s.freshText, { color: fresh === 'stale' ? WW.textMuted : fresh === 'verified' ? WW.green : WW.warningText }]}>
            {freshnessLabel(fresh, confirms)}
          </Text>
        </View>

        <Text style={s.title}>{contribution.title}</Text>
        {!!contribution.description && <Text style={s.desc}>{contribution.description}</Text>}
        {!!contribution.image_url && (
          <Image source={{ uri: contribution.image_url }} style={s.image} resizeMode="cover" />
        )}

        <Text style={s.tally}>
          {confirms} say e still dey · {dismisses} say e don clear
        </Text>

        <View style={s.actions}>
          <Pressable
            onPress={() => cast('CONFIRM')}
            disabled={!!voting}
            accessibilityRole="button"
            accessibilityState={{ selected: vote === 'CONFIRM' }}
            style={({ pressed }) => [s.confirm, vote === 'CONFIRM' && s.confirmActive, pressed && s.pressed]}
          >
            {voting === 'CONFIRM'
              ? <ActivityIndicator color={WW.textOnOrange} />
              : <Text style={s.confirmText}>{vote === 'CONFIRM' ? 'You said e still dey' : 'Still dey happen'}</Text>}
          </Pressable>
          <Pressable
            onPress={() => cast('DISMISS')}
            disabled={!!voting}
            accessibilityRole="button"
            accessibilityState={{ selected: vote === 'DISMISS' }}
            style={({ pressed }) => [s.dismiss, vote === 'DISMISS' && s.dismissActive, pressed && s.pressed]}
          >
            {voting === 'DISMISS'
              ? <ActivityIndicator color={WW.text} />
              : <Text style={s.dismissText}>Don clear</Text>}
          </Pressable>
        </View>
      </SheetView>
    </Sheet>
  );
};

function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    body: { paddingHorizontal: Space.lg, paddingBottom: Space.xxl + Space.lg, paddingTop: Space.xs },
    kindRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    kindDot: { width: 8, height: 8, borderRadius: Radius.pill },
    kind: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted },
    freshPill: {
      alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.pill, marginBottom: 10,
    },
    freshText: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow },
    title: {
      fontFamily: Fonts.extrabold, fontSize: Typography.xl, lineHeight: Typography.xl * 1.2,
      color: WW.text, letterSpacing: Tracking.tight / 2,
    },
    desc: { fontFamily: Fonts.regular, fontSize: Typography.md, lineHeight: Typography.md * 1.45, color: WW.textSub, marginTop: Space.sm },
    image: { width: '100%', height: 160, borderRadius: Radius.lg, marginTop: Space.md, backgroundColor: WW.bgElevated },
    tally: { fontFamily: Fonts.medium, fontSize: Typography.sm, color: WW.textMuted, marginTop: Space.md },
    actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
    confirm: {
      flex: 1, minHeight: 50, paddingHorizontal: 14,
      borderRadius: Radius.pill, backgroundColor: WW.orange,
      alignItems: 'center', justifyContent: 'center',
    },
    confirmActive: { backgroundColor: WW.orangeGlow },
    confirmText: { fontFamily: Fonts.extrabold, fontSize: Typography.md, color: WW.textOnOrange },
    dismiss: {
      minHeight: 50, paddingHorizontal: 20,
      borderRadius: Radius.pill, borderWidth: 1, borderColor: WW.border,
      alignItems: 'center', justifyContent: 'center',
    },
    dismissActive: { borderColor: WW.text, backgroundColor: WW.bgElevated },
    dismissText: { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.text },
    pressed: { opacity: 0.8 },
  });
}

export default AlertBottomSheet;
