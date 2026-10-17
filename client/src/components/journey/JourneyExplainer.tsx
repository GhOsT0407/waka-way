import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteOption, SmartRouteResult, TransportMode, Complexity } from '../../services/smartRoutingService';
import { journeySteps, type JourneyStep } from '../../services/explainJourney';
import { fareTrust, optionFare, routeTrouble, type SignalMap, type TrustState } from '../../services/signals';
import { trafficFactor } from '../../services/routeGraph';
import type { LiveAlert } from '../../hooks/useLiveAlerts';
import { kindMeta, timeAgo, freshnessOf } from '../../utils/reportKinds';
import { useAppTheme } from '../../context/ThemeContext';
import type { WWColors } from '../../theme/colors';
import { Fonts, Typography, Tracking } from '../../theme/typography';
import { Space, Radius } from '../../theme/spacing';

// Explain My Journey. The rider reads, top to bottom: what it costs and
// how long (as a range, never a single made-up number), how hard it is,
// why we picked it, what to expect, anything happening on the road right
// now — then the journey as numbered steps: walk here, take this, tell the
// conductor that, get down there. A map is not needed to follow it.

export interface RouteAlert { alert: LiveAlert; legIndex: number; km: number }

interface Props {
  routeResult: SmartRouteResult;
  signals: SignalMap;
  alerts: RouteAlert[];
  newcomer: boolean;
  selectedId: string;
  onSelectOption: (option: RouteOption) => void;
  onAddRoute?: () => void;
  /** "Still happening?" — CONFIRM or DISMISS. Returns false if the vote did not land. */
  onVoteAlert?: (alertId: string, vote: 'CONFIRM' | 'DISMISS') => Promise<boolean>;
}

// ─── Presentation helpers ────────────────────────────────────────────────────
export function modeCfg(WW: WWColors, mode: TransportMode | string): { bg: string; text: string; label: string } {
  switch (mode) {
    case 'danfo': return { bg: WW.danfo, text: WW.danfoText, label: 'Danfo' };
    case 'brt':   return { bg: WW.brt,   text: WW.brtText,   label: 'BRT' };
    case 'rail':  return { bg: WW.rail,  text: WW.railText,  label: 'Train' };
    case 'keke':  return { bg: WW.keke,  text: WW.kekeText,  label: 'Keke' };
    case 'okada': return { bg: WW.okada, text: WW.okadaText, label: 'Okada' };
    default:      return { bg: WW.walk,  text: WW.walkText,  label: 'Walk' };
  }
}

export function fareRange(min: number, max: number): string {
  if (max <= 0) return 'Free';
  if (min === max) return `₦${max.toLocaleString()}`;
  return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
}

export function minutes(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

function arrival(minsFromNow: number): string {
  const t = new Date(Date.now() + minsFromNow * 60_000);
  return `${t.getHours()}:${t.getMinutes().toString().padStart(2, '0')}`;
}

function complexityCfg(WW: WWColors, c: Complexity): { dot: string; label: string } {
  if (c === 'easy') return { dot: WW.green, label: 'Easy' };
  if (c === 'moderate') return { dot: WW.warning, label: 'Moderate' };
  return { dot: WW.error, label: 'Complex' };
}

function trustCfg(WW: WWColors, s: TrustState): { dot: string; word: string } {
  if (s === 'verified') return { dot: WW.green, word: 'Riders confirmed' };
  if (s === 'reported') return { dot: WW.warning, word: 'Reported' };
  if (s === 'table') return { dot: WW.brt, word: 'Published fare' };
  return { dot: WW.textMuted, word: 'Estimate' };
}

function roles(o: RouteOption): string[] {
  const r: string[] = [];
  if (o.isRecommended) r.push('Recommended');
  if (o.isSimplest) r.push('Simplest');
  if (o.isCheapest) r.push('Cheapest');
  if (o.isFastest) r.push('Fastest');
  return r;
}

function trafficLine(): string {
  const f = trafficFactor(new Date());
  if (f >= 1.3) return 'Peak hour — expect go-slow on the road legs';
  if (f > 1.0) return 'Traffic building';
  if (f < 1.0) return 'Roads should be clear at this hour';
  return 'Traffic moderate for this time of day';
}

function paymentLine(o: RouteOption): string {
  const modes = new Set(o.legs.map((l) => l.mode));
  const cash = ['danfo', 'keke', 'okada'].some((m) => modes.has(m as TransportMode));
  const card = modes.has('brt') || modes.has('rail');
  if (cash && card) return 'Cash for the danfo / keke · ticket or Cowry card for BRT / train';
  if (card) return 'Ticket or Cowry card at the shelter — no cash haggling';
  return 'Cash — have small notes ready';
}

// ─── Component ───────────────────────────────────────────────────────────────
export const JourneyExplainer: React.FC<Props> = ({ routeResult, signals, alerts, newcomer, selectedId, onSelectOption, onAddRoute, onVoteAlert }) => {
  const { WW } = useAppTheme();
  const s = useMemo(() => makeStyles(WW), [WW]);
  const { options, destination } = routeResult;
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const [voted, setVoted] = useState<Record<string, 'CONFIRM' | 'DISMISS'>>({});

  if (!selected) return null;

  const fare = optionFare(selected, signals);
  const trust = trustCfg(WW, fare.state);
  const cx = complexityCfg(WW, selected.complexity);
  const steps = journeySteps(selected);
  const vehicles = [...new Set(selected.legs.filter((l) => l.mode !== 'walk').map((l) => modeCfg(WW, l.mode).label))];

  const vote = async (id: string, v: 'CONFIRM' | 'DISMISS') => {
    if (!onVoteAlert) return;
    const ok = await onVoteAlert(id, v);
    if (ok) setVoted((m) => ({ ...m, [id]: v }));
  };

  return (
    <View style={s.wrap}>
      {/* ── The answer: cost, time, difficulty, why ─────────────────────── */}
      <View style={s.headerCard} accessibilityRole="summary">
        <View style={s.headerRow}>
          <Text style={s.fare} numberOfLines={1} adjustsFontSizeToFit>{fareRange(fare.min, fare.max)}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.mins}>{minutes(selected.totalDurationMins)}</Text>
            <Text style={s.arrive}>arrive about {arrival(selected.totalDurationMins)}</Text>
          </View>
        </View>
        <View style={s.chipRow}>
          <View style={s.chip}><View style={[s.dot, { backgroundColor: cx.dot }]} /><Text style={s.chipText}>{cx.label}</Text></View>
          <View style={s.chip}><Text style={s.chipText}>{selected.transfers === 0 ? 'No change of vehicle' : `${selected.transfers} change${selected.transfers > 1 ? 's' : ''}`}</Text></View>
          {selected.walkMins > 0 && <View style={s.chip}><Text style={s.chipText}>{selected.walkMins} min walking</Text></View>}
        </View>
        {!!selected.recommendationReason && selected.isRecommended && (
          <Text style={s.reason}>{selected.recommendationReason}</Text>
        )}
        <View style={s.trustRow}>
          <View style={[s.dot, { backgroundColor: trust.dot }]} />
          <Text style={s.trustText} numberOfLines={2}>
            {fare.state === 'verified' ? `${trust.word} · ${fare.riders} riders paid this recently`
              : fare.state === 'reported' ? `${trust.word} · ${fare.riders} rider${fare.riders === 1 ? '' : 's'} told us what they paid`
              : fare.state === 'table' ? `${trust.word} (LAMATA)`
              : `${trust.word} from the distance — the exact fare depends on the conductor`}
          </Text>
        </View>
      </View>

      {/* ── Other ways: same trip, different trade-offs ──────────────────── */}
      {options.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.optionsRow}>
          {options.map((o) => {
            const f = optionFare(o, signals);
            const on = o.id === selected.id;
            const c = complexityCfg(WW, o.complexity);
            return (
              <Pressable
                key={o.id}
                onPress={() => onSelectOption(o)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${roles(o).join(', ') || o.name}: ${fareRange(f.min, f.max)}, ${minutes(o.totalDurationMins)}, ${o.transfers} changes`}
                style={[s.optionCard, on && s.optionCardOn]}
              >
                <Text style={[s.optionRole, on && { color: WW.text }]} numberOfLines={1}>{roles(o)[0] ?? o.name}</Text>
                <Text style={[s.optionFare, on && { color: WW.text }]} numberOfLines={1}>{fareRange(f.min, f.max)}</Text>
                <Text style={s.optionSub} numberOfLines={1}>{minutes(o.totalDurationMins)} · {o.transfers === 0 ? 'no change' : `${o.transfers} change${o.transfers > 1 ? 's' : ''}`}</Text>
                <View style={s.optionModes}>
                  <View style={[s.dot, { backgroundColor: c.dot }]} />
                  <Text style={s.optionSub} numberOfLines={1}>{[...new Set(o.legs.filter((l) => l.mode !== 'walk').map((l) => modeCfg(WW, l.mode).label))].join(' → ') || 'Walk'}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* ── Coverage gap — say so, and ask for the line ───────────────────── */}
      {selected.tags.includes('Unverified') && onAddRoute && (
        <View style={s.gapCard}>
          <Text style={s.gapTitle}>We never map this road well yet</Text>
          <Text style={s.gapBody}>If you know the bus wey dey go here, add am so the next person no go ask.</Text>
          <Pressable onPress={onAddRoute} accessibilityRole="button" style={({ pressed }) => [s.gapBtn, pressed && { opacity: 0.8 }]}>
            <Text style={s.gapBtnText}>Add this route</Text>
          </Pressable>
        </View>
      )}

      {/* ── Right now on this route ──────────────────────────────────────── */}
      {alerts.length > 0 && (
        <View style={s.section}>
          <Text style={s.eyebrow}>RIGHT NOW ON THIS ROUTE</Text>
          {alerts.map(({ alert, legIndex }) => {
            const meta = kindMeta(alert.type);
            const fresh = freshnessOf(alert);
            const ring = fresh === 'verified' ? WW.green : fresh === 'reported' ? WW.warning : WW.textMuted;
            const leg = selected.legs[legIndex];
            const mine = voted[alert.id];
            return (
              <View key={alert.id} style={s.alertCard}>
                <View style={s.alertHead}>
                  <View style={[s.alertGlyph, { backgroundColor: meta.color(WW) }]}><Text style={{ color: meta.onColor(WW), fontFamily: Fonts.extrabold }}>{meta.glyph}</Text></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.alertTitle} numberOfLines={2}>{alert.title}</Text>
                    <Text style={s.alertMeta} numberOfLines={1}>
                      {meta.label} · {timeAgo(alert.created_at)} · {alert.confirm_count > 0 ? `${alert.confirm_count} confirmed` : 'not yet confirmed'}
                    </Text>
                    {!!leg && <Text style={s.alertMeta} numberOfLines={1}>Near {leg.from.name} → {leg.to.name}</Text>}
                  </View>
                  <View style={[s.dot, { backgroundColor: ring, marginTop: 6 }]} />
                </View>
                {!!onVoteAlert && (
                  <View style={s.alertVote}>
                    <Text style={s.alertAsk}>Still happening?</Text>
                    <Pressable onPress={() => vote(alert.id, 'CONFIRM')} accessibilityRole="button" accessibilityLabel="Yes, still happening" style={[s.voteBtn, mine === 'CONFIRM' && s.voteBtnOn]}>
                      <Text style={[s.voteText, mine === 'CONFIRM' && s.voteTextOn]}>Yes</Text>
                    </Pressable>
                    <Pressable onPress={() => vote(alert.id, 'DISMISS')} accessibilityRole="button" accessibilityLabel="No, it has cleared" style={[s.voteBtn, mine === 'DISMISS' && s.voteBtnOn]}>
                      <Text style={[s.voteText, mine === 'DISMISS' && s.voteTextOn]}>No</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── What to expect ───────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.eyebrow}>WHAT TO EXPECT</Text>
        <View style={s.expectGrid}>
          <Expect s={s} label="Walking" value={selected.walkMins ? `${selected.walkMins} min` : 'None'} />
          <Expect s={s} label="Transport" value={vehicles.join(' → ') || 'On foot'} />
          <Expect s={s} label="Changes" value={String(selected.transfers)} />
          <Expect s={s} label="Fare" value={fareRange(fare.min, fare.max)} />
        </View>
        <Text style={s.expectLine}>{paymentLine(selected)}</Text>
        <Text style={s.expectLine}>{trafficLine()}</Text>
        {selected.complexityReasons.length > 0 && (
          <Text style={s.expectLine}>{cx.label} because: {selected.complexityReasons.join(' · ').toLowerCase()}</Text>
        )}
      </View>

      {/* ── The journey ──────────────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.eyebrow}>YOUR JOURNEY</Text>
        {steps.map((step) => (
          <StepRow key={`${step.kind}-${step.n}`} step={step} option={selected} signals={signals} newcomer={newcomer} WW={WW} s={s} />
        ))}
        <Text style={s.destName}>{destination.name}</Text>
      </View>
    </View>
  );
};

const Expect: React.FC<{ s: ReturnType<typeof makeStyles>; label: string; value: string }> = ({ s, label, value }) => (
  <View style={s.expectCell}>
    <Text style={s.expectLabel}>{label}</Text>
    <Text style={s.expectValue} numberOfLines={2}>{value}</Text>
  </View>
);

// ─── One step ────────────────────────────────────────────────────────────────
const StepRow: React.FC<{
  step: JourneyStep;
  option: RouteOption;
  signals: SignalMap;
  newcomer: boolean;
  WW: WWColors;
  s: ReturnType<typeof makeStyles>;
}> = ({ step, option, signals, newcomer, WW, s }) => {
  const leg = option.legs[step.legIndex];
  const cfg = modeCfg(WW, step.mode);
  const isBoard = step.kind === 'board';
  const trust = isBoard && leg ? fareTrust(leg, leg.corridorId ? signals[leg.corridorId] : undefined) : null;
  const trouble = isBoard && leg?.corridorId ? routeTrouble(signals[leg.corridorId]) : undefined;
  const tint = isBoard ? cfg.bg : step.kind === 'arrive' ? WW.green : WW.bgElevated;
  const tintText = isBoard ? cfg.text : step.kind === 'arrive' ? WW.textOnGreen : WW.text;

  return (
    <View style={s.step}>
      <View style={s.stepRail}>
        <View style={[s.stepNum, { backgroundColor: tint }]}>
          <Text style={[s.stepNumText, { color: tintText }]}>{step.kind === 'arrive' ? '✓' : step.n}</Text>
        </View>
        <View style={[s.stepLine, step.kind === 'arrive' && { opacity: 0 }]} />
      </View>
      <View style={s.stepBody}>
        <View style={s.stepTitleRow}>
          <Text style={s.stepTitle}>{step.title}</Text>
          {isBoard && trust && trust.max > 0 && (
            <Text style={s.stepFare}>{fareRange(trust.min, trust.max)}</Text>
          )}
        </View>
        {!!step.detail && <Text style={s.stepDetail}>{step.detail}</Text>}
        {!!step.boardAt && <Line s={s} icon="locate-outline" text={step.boardAt} />}
        {!!step.lookFor && <Line s={s} icon="eye-outline" text={step.lookFor} />}
        {!!step.listenFor && <Line s={s} icon="megaphone-outline" text={`Listen for "${step.listenFor}!"`} strong />}
        {!!step.say && isBoard && <Line s={s} icon="chatbubble-ellipses-outline" text={`Tell the conductor: ${step.say}`} strong />}
        {!!step.say && step.kind === 'alight' && <Line s={s} icon="chatbubble-ellipses-outline" text={`Say ${step.say}`} />}
        {isBoard && newcomer && leg?.corridorId && leg.mode === 'danfo' && (
          <Line s={s} icon="information-circle-outline" text={`You don't have to enter the first bus you see — wait for one calling "${step.listenFor ?? leg.terminalName}".`} />
        )}
        {isBoard && newcomer && leg?.mode === 'brt' && (
          <Line s={s} icon="information-circle-outline" text="Buses come every few minutes; join the queue at the shelter and check the destination board on the front." />
        )}
        {isBoard && trust && trust.max > 0 && (
          <View style={s.trustRowSm}>
            <View style={[s.dotSm, { backgroundColor: trustCfg(WW, trust.state).dot }]} />
            <Text style={s.trustSm} numberOfLines={2}>{trust.label}</Text>
          </View>
        )}
        {!!trouble && <Line s={s} icon="warning-outline" text={trouble} warn />}
        {!!step.note && <Line s={s} icon={step.kind === 'alight' ? 'swap-horizontal-outline' : 'alert-circle-outline'} text={step.note} warn={step.kind === 'board' && (leg?.mayBeUnavailable || leg?.confidence === 'likely')} />}
      </View>
    </View>
  );
};

const Line: React.FC<{ s: ReturnType<typeof makeStyles>; icon: any; text: string; strong?: boolean; warn?: boolean }> = ({ s, icon, text, strong, warn }) => {
  const { WW } = useAppTheme();
  return (
    <View style={s.line}>
      <Ionicons name={icon} size={14} color={warn ? WW.warningText : strong ? WW.text : WW.textSub} style={{ marginTop: 2 }} />
      <Text style={[s.lineText, strong && s.lineStrong, warn && s.lineWarn]}>{text}</Text>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
function makeStyles(WW: WWColors) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: Space.lg, paddingTop: Space.md, gap: Space.lg },

    headerCard: {
      borderRadius: Radius.lg, backgroundColor: WW.bgSurface, padding: Space.lg, gap: Space.sm,
      borderWidth: 1, borderColor: WW.border,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Space.md },
    fare: { flex: 1, fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 34, color: WW.text, letterSpacing: -0.5 },
    mins: { fontFamily: Fonts.bold, fontSize: Typography.xl, color: WW.text },
    arrive: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 10, height: 28, borderRadius: Radius.pill, backgroundColor: WW.bgElevated,
    },
    chipText: { fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.text },
    dot: { width: 8, height: 8, borderRadius: Radius.pill },
    dotSm: { width: 6, height: 6, borderRadius: Radius.pill },
    reason: { fontFamily: Fonts.medium, fontSize: Typography.md, color: WW.textSub, lineHeight: Typography.md * 1.4 },
    trustRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    trustText: { flex: 1, fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub },

    optionsRow: { gap: Space.sm, paddingRight: Space.lg },
    optionCard: {
      width: 156, padding: Space.md, borderRadius: Radius.lg,
      backgroundColor: WW.bgSurface, borderWidth: 1.5, borderColor: WW.border, gap: 2,
    },
    optionCardOn: { borderColor: WW.orange, backgroundColor: WW.orangeDim },
    optionRole: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, textTransform: 'uppercase', color: WW.textMuted },
    optionFare: { fontFamily: Fonts.extrabold, fontSize: Typography.lg, color: WW.textSub, marginTop: 2 },
    optionSub: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted },
    optionModes: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },

    gapCard: { padding: Space.lg, borderRadius: Radius.lg, backgroundColor: WW.warningDim, gap: 6 },
    gapTitle: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    gapBody:  { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub, lineHeight: Typography.sm * 1.45 },
    gapBtn: { alignSelf: 'flex-start', marginTop: 6, paddingVertical: 10, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: WW.orange },
    gapBtnText: { fontFamily: Fonts.extrabold, fontSize: Typography.sm, color: WW.textOnOrange },

    section: { gap: Space.sm },
    eyebrow: { fontFamily: Fonts.bold, fontSize: Typography.xs, letterSpacing: Tracking.eyebrow, color: WW.textMuted, marginBottom: 2 },

    alertCard: { borderRadius: Radius.lg, backgroundColor: WW.bgSurface, borderWidth: 1, borderColor: WW.border, padding: Space.md, gap: Space.sm },
    alertHead: { flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' },
    alertGlyph: { width: 32, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    alertTitle: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text },
    alertMeta: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textMuted, marginTop: 2 },
    alertVote: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
    alertAsk: { flex: 1, fontFamily: Fonts.semibold, fontSize: Typography.sm, color: WW.textSub },
    voteBtn: { minWidth: 56, height: 36, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: WW.borderStrong, alignItems: 'center', justifyContent: 'center' },
    voteBtnOn: { backgroundColor: WW.text, borderColor: WW.text },
    voteText: { fontFamily: Fonts.bold, fontSize: Typography.sm, color: WW.text },
    voteTextOn: { color: WW.bg },

    expectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
    expectCell: { minWidth: '45%', flex: 1, padding: Space.md, borderRadius: Radius.md, backgroundColor: WW.bgSurface, borderWidth: 1, borderColor: WW.border },
    expectLabel: { fontFamily: Fonts.medium, fontSize: Typography.xs, color: WW.textMuted, letterSpacing: 0.3 },
    expectValue: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text, marginTop: 2 },
    expectLine: { fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub, lineHeight: Typography.sm * 1.45 },

    step: { flexDirection: 'row', gap: Space.md },
    stepRail: { width: 32, alignItems: 'center' },
    stepNum: { width: 32, height: 32, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
    stepNumText: { fontFamily: Fonts.extrabold, fontSize: Typography.md },
    stepLine: { flex: 1, width: 2, backgroundColor: WW.border, marginVertical: 4, minHeight: 20 },
    stepBody: { flex: 1, minWidth: 0, paddingBottom: Space.lg, gap: 5 },
    stepTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Space.sm },
    stepTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: Typography.lg, color: WW.text, lineHeight: Typography.lg * 1.3 },
    stepFare: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.text, marginTop: 2 },
    stepDetail: { fontFamily: Fonts.regular, fontSize: Typography.md, color: WW.textMuted },
    line: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    lineText: { flex: 1, fontFamily: Fonts.regular, fontSize: Typography.sm, color: WW.textSub, lineHeight: Typography.sm * 1.45 },
    lineStrong: { fontFamily: Fonts.semibold, color: WW.text },
    lineWarn: { fontFamily: Fonts.semibold, color: WW.warningText },
    trustRowSm: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    trustSm: { flex: 1, fontFamily: Fonts.regular, fontSize: Typography.xs, color: WW.textMuted },
    destName: { fontFamily: Fonts.bold, fontSize: Typography.md, color: WW.textSub, marginLeft: 32 + Space.md },
  });
}

export default JourneyExplainer;
