import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteOption, RouteLeg, SmartRouteResult, TransportMode } from '../services/smartRoutingService';
import { useAppTheme } from '../context/ThemeContext';
import type { WWColors } from '../theme/colors';
import { Fonts, Typography, Tracking } from '../theme/typography';
import { Space, Radius } from '../theme/spacing';

// Route options for one search, as the redesign canvas draws them:
//
//   header card   the selected option -- lead-mode badge, the minutes figure
//                 at 28/800, fare + arrival under it, state + distance right
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
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export const SmartRouteOptions: React.FC<SmartRouteOptionsProps> = ({ routeResult, onSelectOption }) => {
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

  return (
    <View style={s.wrap}>
      {/* ── Header card — the selected option ─────────────────────────────── */}
      <View style={s.headerCard} accessibilityRole="summary">
        <View style={[s.badgeLg, { backgroundColor: lead.bg }]}>
          <Text style={[s.badgeLgText, { color: lead.text }]}>{lead.label.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.headerMins}>{selected.totalDurationMins} min</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            {selected.priceFormatted} · arrive {formatArrival(selected.totalDurationMins)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {status && <Text style={[s.status, { color: status.color }]}>{status.text}</Text>}
          <Text style={s.headerKm}>{formatKm(selected.totalDistanceKm)}</Text>
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
  ].filter(Boolean).join(' · ');

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
        {!!leg.localInstruction && (
          <Text style={s.legLocal} numberOfLines={2}>{leg.localInstruction}</Text>
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
    headerMins: {
      fontFamily: Fonts.extrabold, fontSize: Typography.xxl, lineHeight: Typography.xxl * 1.1,
      color: WW.text, letterSpacing: Tracking.tight,
    },
    headerSub: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textSub, marginTop: 2 },
    headerKm:  { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },
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

    // timeline
    timeline: { paddingTop: Space.lg + 2 },
    legRow:   { flexDirection: 'row', gap: 14 },
    rail:     { width: 44, alignItems: 'center' },
    legBody:  { flex: 1, paddingBottom: Space.xl - 4, minWidth: 0 },
    legTitle: { fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, lineHeight: Typography.lg * 1.35 },
    legSub:   { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textMuted, marginTop: 3 },
    legLocal: { fontFamily: Fonts.medium, fontSize: Typography.sm, color: WW.textSub, marginTop: 6, lineHeight: Typography.sm * 1.4 },

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
