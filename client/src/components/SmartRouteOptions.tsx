import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteOption, RouteLeg, SmartRouteResult, TransportMode } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius } from '../theme/spacing';

// Route options for one search, as the redesign canvas draws them:
//
//   header card   the selected option -- lead-mode badge, the fare at 32/800
//                 (it counts up when the option changes -- morph 4), minutes
//                 beside it, arrival + distance under, state right
//   other ways    the remaining options as compact rows (only when >1)
//   timeline      the selected option's legs on a 44pt rail; mode colour
//                 carries the rail, state colour stays semantic
//
// The Start action lives in the screen's bottom bar, not here.
// Each leg keeps the engine's pidgin localInstruction as its caption -- the
// canvas dropped it, but it is the app's own voice and it costs one line.

interface SmartRouteOptionsProps {
  routeResult: SmartRouteResult;
  onSelectOption: (option: RouteOption) => void;
  /** Kept for API compatibility; the screen's bottom bar owns Start now. */
  onStartJourney?: (option: RouteOption) => void;
  /** Shown when the network doesn't reach: the rider can add the line they know. */
  onAddRoute?: () => void;
}

// ─── Mode presentation ────────────────────────────────────────────────────────
type ModeCfg = { bg: string; text: string; label: string; short: string };

function modeCfg(WW: WWColors, mode: TransportMode | string): ModeCfg {
  switch (mode) {
    case 'danfo': return { bg: WW.danfo, text: WW.danfoText, label: 'Danfo', short: 'DNF' };
    case 'brt':   return { bg: WW.brt,   text: WW.brtText,   label: 'BRT',   short: 'BRT' };
    case 'keke':  return { bg: WW.keke,  text: WW.kekeText,  label: 'Keke',  short: 'KK' };
    case 'okada': return { bg: WW.okada, text: WW.okadaText, label: 'Okada', short: 'OKD' };
    case 'ferry': return { bg: WW.ferry, text: WW.ferryText, label: 'Ferry', short: 'FRY' };
    case 'walk':  return { bg: WW.walk,  text: WW.walkText,  label: 'Walk',  short: '' };
    default:      return { bg: WW.bgElevated, text: WW.text, label: String(mode), short: String(mode).slice(0, 3).toUpperCase() };
  }
}

// The mode that names an option: its first non-walk leg.
function leadMode(option: RouteOption): TransportMode | 'walk' {
  return option.legs.find((l) => l.mode !== 'walk')?.mode ?? 'walk';
}

function formatArrival(minsFromNow: number): string {
  const t = new Date(Date.now() + minsFromNow * 60_000);
  const h = t.getHours();
  const m = t.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// One label per option, semantic colour: state green for the good news,
// muted for the neutral fact.
function statusFor(option: RouteOption, WW: WWColors): { text: string; color: string } | null {
  if (option.isRecommended) return { text: 'Recommended', color: WW.green };
  if (option.isFastest)     return { text: 'Fastest',     color: WW.green };
  if (option.isCheapest)    return { text: 'Cheapest',    color: WW.textMuted };
  if (option.isSimplest)    return { text: 'Simplest',    color: WW.textMuted };
  return null;
}

// The fare figure counts from the old value to the new one and lifts a
// touch while it does -- the canvas's morph 4.
function useFareTween(target: number): { shown: number; lift: Animated.Value } {
  const [shown, setShown] = useState(target);
  const lift = useRef(new Animated.Value(0)).current;
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const from = shown;
    if (from === target) return;
    const t0 = Date.now();
    Animated.sequence([
      Animated.timing(lift, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(lift, { toValue: 0, duration: 260, easing: Easing.bezier(0.32, 0.72, 0, 1), useNativeDriver: true }),
    ]).start();
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / 460);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(from + (target - from) * e));
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return { shown, lift };
}

// ─── Component ────────────────────────────────────────────────────────────────
export const SmartRouteOptions: React.FC<SmartRouteOptionsProps> = ({ routeResult, onSelectOption, onAddRoute }) => {
  const { WW } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);

  const { options, recommendedOptionId, destination } = routeResult;
  const [selectedId, setSelectedId] = useState<string>(
    options.find((o) => o.id === recommendedOptionId)?.id ?? options[0]?.id,
  );
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const others = options.filter((o) => o.id !== selected?.id);

  if (!selected) return null;

  const select = (o: RouteOption) => {
    setSelectedId(o.id);
    onSelectOption(o);
  };

  const lead = modeCfg(WW, leadMode(selected));
  const status = statusFor(selected, WW);
  const fare = useFareTween(selected.totalPriceMax);
  const fareStyle = {
    transform: [
      { translateY: fare.lift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
      { scale: fare.lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
    ],
  };

  return (
    <View style={s.wrap}>
      {/* ── Header card — the selected option ─────────────────────────────── */}
      <View style={s.headerCard} accessibilityRole="summary">
        <View style={[s.badgeLg, { backgroundColor: lead.bg }]}>
          <Text style={[s.badgeLgText, { color: lead.text }]}>{lead.label.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.headerFigures}>
            <Animated.Text style={[s.headerFare, fareStyle]}>₦{fare.shown.toLocaleString()}</Animated.Text>
            <Text style={s.headerMins}>{selected.totalDurationMins} min</Text>
          </View>
          <Text style={s.headerSub} numberOfLines={1}>
            arrive {formatArrival(selected.totalDurationMins)} · {formatKm(selected.totalDistanceKm)}
            {selected.totalPriceMin !== selected.totalPriceMax ? ` · from ₦${selected.totalPriceMin.toLocaleString()}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {status && <Text style={[s.status, { color: status.color }]}>{status.text}</Text>}
        </View>
      </View>

      {/* ── Other ways ────────────────────────────────────────────────────── */}
      {others.length > 0 && (
        <View style={s.othersWrap}>
          <Text style={s.eyebrow}>Other ways · {others.length}</Text>
          <View style={{ gap: Space.sm }}>
            {others.map((o) => {
              const cfg = modeCfg(WW, leadMode(o));
              const st = statusFor(o, WW);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => select(o)}
                  accessibilityRole="button"
                  accessibilityLabel={`${o.totalDurationMins} minutes, ${o.priceFormatted}, ${o.description}`}
                  style={({ pressed }) => [s.row, pressed && s.rowPressed]}
                >
                  <View style={[s.badgeSm, { backgroundColor: cfg.bg }]}>
                    <Text style={[s.badgeSmText, { color: cfg.text }]}>{cfg.label.toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.rowTitle}>{o.totalDurationMins} min · {o.priceFormatted}</Text>
                    <Text style={s.rowSub} numberOfLines={1}>{o.description}</Text>
                  </View>
                  {st && <Text style={[s.status, { color: st.color }]}>{st.text}</Text>}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Coverage gap — say so, and ask for the line (Àjàlá's move) ─────── */}
      {selected.tags.includes('Unverified') && onAddRoute && (
        <View style={s.gapCard}>
          <Text style={s.gapTitle}>We never map this road well yet</Text>
          <Text style={s.gapBody}>If you know the bus wey dey go here, add am so the next person no go ask.</Text>
          <Pressable onPress={onAddRoute} accessibilityRole="button" style={({ pressed }) => [s.gapBtn, pressed && { opacity: 0.8 }]}>
            <Text style={s.gapBtnText}>Add this route</Text>
          </Pressable>
        </View>
      )}

      {/* ── Timeline — the selected option's legs on a rail ───────────────── */}
      <View style={s.timeline}>
        {selected.legs.map((leg, i) => (
          <LegRow key={leg.id ?? i} leg={leg} index={i} WW={WW} s={s} />
        ))}
        {/* destination node */}
        <View style={s.legRow}>
          <View style={s.rail}>
            <View style={s.nodeEnd} />
          </View>
          <View style={[s.legBody, { paddingBottom: 0 }]}>
            <Text style={s.legTitle} numberOfLines={2}>{destination.name}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// ─── Leg row ──────────────────────────────────────────────────────────────────
const LegRow: React.FC<{
  leg: RouteLeg;
  index: number;
  WW: WWColors;
  s: ReturnType<typeof makeStyles>;
}> = ({ leg, index, WW, s }) => {
  const cfg = modeCfg(WW, leg.mode);
  const isWalk = leg.mode === 'walk';
  const price = leg.priceMax > 0
    ? (leg.priceMin === leg.priceMax ? `₦${leg.priceMax}` : `₦${leg.priceMin}–₦${leg.priceMax}`)
    : null;
  const sub = [
    `${leg.durationMins} min`,
    formatKm(leg.distanceKm),
    price,
    leg.stopsSpanned && leg.stopsSpanned > 1 ? `${leg.stopsSpanned} stops` : null,
  ].filter(Boolean).join(' · ');
  // "via Stadium, Iponri, Costain" — the stops a rider will hear the conductor
  // call, so they can tell the bus is the right one. Capped so long corridors
  // don't turn the card into a list.
  const via = leg.viaStops && leg.viaStops.length
    ? `via ${leg.viaStops.slice(0, 4).join(', ')}${leg.viaStops.length > 4 ? ` +${leg.viaStops.length - 4}` : ''}`
    : null;

  return (
    <View style={s.legRow}>
      <View style={s.rail}>
        {index === 0 || isWalk ? (
          <View style={s.nodeRing} />
        ) : (
          <View style={[s.nodeMode, { backgroundColor: cfg.bg }]}>
            <Text style={[s.nodeModeText, { color: cfg.text }]}>{cfg.short}</Text>
          </View>
        )}
        {isWalk
          ? <View style={s.railDashed} />
          : <View style={[s.railSolid, { backgroundColor: cfg.bg }]} />}
      </View>
      <View style={s.legBody}>
        <Text style={s.legTitle} numberOfLines={2}>
          {isWalk ? `Walk to ${leg.to.name}` : `${cfg.label} · ${leg.from.name} → ${leg.to.name}`}
        </Text>
        <Text style={s.legSub} numberOfLines={1}>{sub}</Text>
        {!!leg.conductorCall && (
          <View style={s.callRow}>
            <Ionicons name="megaphone-outline" size={13} color={WW.textSub} />
            <Text style={s.callText} numberOfLines={1}>Listen for “{leg.conductorCall}!”</Text>
          </View>
        )}
        {!!via && <Text style={s.legVia} numberOfLines={2}>{via}</Text>}
        {!!leg.localInstruction && (
          <Text style={s.legLocal} numberOfLines={3}>{leg.localInstruction}</Text>
        )}
        {leg.mayBeUnavailable && leg.mode === 'keke' && (
          <Text style={s.legNote} numberOfLines={2}>
            Keke no dey always run for here — check at the junction, or waka
          </Text>
        )}
        {leg.mayBeUnavailable && leg.mode === 'danfo' && (
          <Text style={s.legNote} numberOfLines={2}>
            No fixed bus for this hop — ask for any bus or keke wey dey go {leg.to.name}
          </Text>
        )}
        {leg.confidence === 'likely' && (
          <Text style={s.legNote} numberOfLines={2}>
            We never confirm this line well — ask at the park, and tell us if e no correct
          </Text>
        )}
      </View>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: Space.lg, paddingTop: Space.md },

    // header card
    headerCard: {
      borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface,
      padding: Space.lg,
      flexDirection: 'row', alignItems: 'center', gap: Space.md,
      shadowColor: '#14161A', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    badgeLg: {
      width: 44, height: 44, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    badgeLgText: { fontFamily: Fonts.extrabold, fontSize: 11, letterSpacing: Tracking.tight / 2 },
    headerFigures: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    headerFare: {
      fontFamily: Fonts.extrabold, fontSize: 32, lineHeight: 36,
      color: WW.text, letterSpacing: -1,
    },
    headerMins: { fontFamily: Fonts.semibold, fontSize: Typography.md, color: WW.textSub },
    headerSub:  { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 4 },
    status:    { fontFamily: Fonts.bold, fontSize: Typography.sm },

    // other ways
    othersWrap: { marginTop: Space.lg },
    eyebrow: {
      fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow,
      textTransform: 'uppercase', color: WW.textMuted, marginBottom: Space.sm,
    },
    row: {
      minHeight: 68,
      borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface,
      paddingHorizontal: 14, paddingVertical: Space.md,
      flexDirection: 'row', alignItems: 'center', gap: Space.md,
    },
    rowPressed: { opacity: 0.8 },
    badgeSm: {
      width: 40, height: 40, borderRadius: Radius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    badgeSmText: { fontFamily: Fonts.extrabold, fontSize: 10, letterSpacing: Tracking.tight / 2 },
    rowTitle: { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text },
    rowSub:   { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },

    // coverage gap
    gapCard: {
      marginTop: Space.lg, padding: Space.lg, borderRadius: Radius.lg,
      backgroundColor: WW.warningDim, gap: 6,
    },
    gapTitle: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    gapBody:  { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub, lineHeight: Typography.sm * 1.45 },
    gapBtn: {
      alignSelf: 'flex-start', marginTop: 6, paddingVertical: 10, paddingHorizontal: 16,
      borderRadius: Radius.pill, backgroundColor: WW.orange,
    },
    gapBtnText: { fontFamily: Fonts.extrabold, fontSize: Typography.sm, color: WW.textOnOrange },

    // timeline
    timeline: { paddingTop: Space.lg + 2 },
    legRow:   { flexDirection: 'row', gap: 14 },
    rail:     { width: 44, alignItems: 'center' },
    legBody:  { flex: 1, paddingBottom: Space.xl - 4, minWidth: 0 },
    legTitle: { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, lineHeight: Typography.lg * 1.35 },
    legSub:   { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textMuted, marginTop: 3 },
    legVia:   { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 3, lineHeight: Typography.sm * 1.4 },
    callRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    callText: { fontFamily: Fonts.bold, fontSize: Typography.sm, color: WW.textSub },
    legLocal: { fontFamily: Fonts.medium, fontSize: Typography.sm, color: WW.textSub, marginTop: 6, lineHeight: Typography.sm * 1.4 },
    legNote:  { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.warningText, marginTop: 4, lineHeight: Typography.sm * 1.4 },

    nodeRing: {
      width: 12, height: 12, borderRadius: Radius.pill,
      borderWidth: 3, borderColor: WW.text, backgroundColor: WW.bgSurface,
      marginTop: 4,
    },
    nodeMode: {
      width: 26, height: 26, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
    },
    nodeModeText: { fontFamily: Fonts.extrabold, fontSize: 9 },
    nodeEnd: { width: 14, height: 14, borderRadius: Radius.pill, backgroundColor: WW.text, marginTop: 4 },
    railSolid: { flex: 1, width: 4, borderRadius: Radius.pill, minHeight: 34, marginTop: 4 },
    railDashed: {
      flex: 1, width: 0, minHeight: 34, marginTop: 4,
      borderWidth: 1.5, borderStyle: 'dashed', borderColor: WW.text, borderRadius: 1,
    },
  });
}

export default SmartRouteOptions;
