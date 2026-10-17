import type { RouteOption, RouteLeg, FareSource, TransportMode } from './smartRoutingService';
import { vehicleWord } from './smartRoutingService';

/**
 * The journey as a friend would tell it: numbered steps, one thing to do
 * per step. The route screen, Wakaway Mode and the share text all read
 * from here, so what the rider reads, follows and forwards is one story.
 */

export type StepKind = 'walk' | 'board' | 'alight' | 'arrive';

export interface JourneyStep {
  kind: StepKind;
  /** 1-based, as printed: ① ② ③ */
  n: number;
  legIndex: number;
  mode: TransportMode;
  title: string;
  /** Time / distance / stop count, one line. */
  detail?: string;
  /** What the place looks like. */
  lookFor?: string;
  /** Where to stand for this direction. */
  boardAt?: string;
  /** What to tell the conductor / driver. */
  say?: string;
  /** What the conductor shouts. */
  listenFor?: string;
  fare?: { min: number; max: number; source: FareSource };
  /** For alight steps: stops to ride and the stop before yours. */
  stops?: number;
  after?: string;
  /** Caveats in the app's own voice. */
  note?: string;
}

const isRide = (l: RouteLeg) => l.mode !== 'walk';

function meters(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function caveat(leg: RouteLeg): string | undefined {
  if (leg.confidence === 'likely' && leg.mayBeUnavailable) return 'No confirmed line here — ask at the park, and tell us what you find';
  if (leg.confidence === 'likely') return 'We never confirm this line well — ask at the park, and tell us if e no correct';
  if (leg.mayBeUnavailable && leg.mode === 'keke') return 'Keke no dey always run for here — check at the junction, or waka';
  if (leg.mayBeUnavailable && leg.mode === 'danfo') return `No fixed bus for this hop — ask for any bus or keke wey dey go ${leg.to.name}`;
  if (leg.mode === 'okada') return 'Agree the price before you climb, and ask for the helmet';
  return undefined;
}

export function journeySteps(option: RouteOption): JourneyStep[] {
  const steps: JourneyStep[] = [];
  const legs = option.legs;
  let n = 0;
  const push = (s: Omit<JourneyStep, 'n'>) => steps.push({ ...s, n: ++n });

  legs.forEach((leg, i) => {
    const last = i === legs.length - 1;
    const next = legs[i + 1];

    if (leg.mode === 'walk') {
      push({
        kind: 'walk', legIndex: i, mode: 'walk',
        title: last ? `Walk the last ${leg.durationMins} min to ${leg.to.name}` : `Walk to ${leg.to.name}`,
        detail: `${leg.durationMins} min · ${meters(leg.distanceKm)}`,
        lookFor: leg.alightLandmark,
      });
      return;
    }

    // ── Board ──────────────────────────────────────────────────────────
    const fare = { min: leg.priceMin, max: leg.priceMax, source: leg.fareSource };
    let title: string;
    let say: string | undefined;
    let listenFor: string | undefined;
    let note = caveat(leg);
    switch (leg.mode) {
      case 'brt':
        title = `Join the BRT queue toward ${leg.terminalName ?? leg.to.name}`;
        note = note ?? 'Pay at the shelter — cash or Cowry card. No conductor, no haggling.';
        break;
      case 'rail':
        title = `Take the ${leg.corridorName ?? 'train'} toward ${leg.terminalName ?? leg.to.name}`;
        note = note ?? 'Buy your ticket or tap your Cowry card at the station gate.';
        break;
      case 'keke':
        title = `Take a keke to ${leg.to.name}`;
        say = `"${leg.to.name}"`;
        break;
      case 'okada':
        title = `Take an okada to ${leg.to.name}`;
        say = `"${leg.to.name}" — agree the fare before you sit`;
        break;
      default:
        if (leg.corridorId) {
          title = `Take the danfo toward ${leg.terminalName ?? leg.to.name}`;
          listenFor = leg.conductorCall;
          say = `"${leg.to.name}"`;
        } else if (leg.mayBeUnavailable && leg.confidence === 'likely') {
          title = `Ask at the nearest park for a bus toward ${leg.to.name}`;
        } else {
          title = `Ask for any bus going to ${leg.to.name}`;
          say = `"${leg.to.name}"`;
        }
    }
    push({
      kind: 'board', legIndex: i, mode: leg.mode,
      title,
      detail: `${leg.durationMins} min · ${meters(leg.distanceKm)}${leg.stopsSpanned && leg.stopsSpanned > 1 ? ` · ${leg.stopsSpanned} stops` : ''}`,
      lookFor: leg.landmark,
      boardAt: leg.boardAt,
      say, listenFor, fare, note,
    });

    // ── Get down ───────────────────────────────────────────────────────
    const stops = leg.stopsSpanned ?? 0;
    const after = leg.viaStops && leg.viaStops.length ? leg.viaStops[leg.viaStops.length - 1] : undefined;
    const nextRide = next && isRide(next) ? next : undefined;
    push({
      kind: 'alight', legIndex: i, mode: leg.mode,
      title: `Get down at ${leg.to.name}`,
      detail: stops > 1 ? `${stops} stops${after ? ` · the one after ${after}` : ''}` : (leg.corridorId ? 'The next stop' : undefined),
      lookFor: leg.alightLandmark,
      stops: stops || undefined,
      after,
      note: nextRide
        ? `Change here for the ${vehicleWord(nextRide.mode)} toward ${nextRide.terminalName ?? nextRide.to.name}`
        : undefined,
      say: leg.mode === 'danfo' || leg.mode === 'keke' ? `"O wa!" when ${leg.to.name} is next` : undefined,
    });
  });

  // ── Arrive ───────────────────────────────────────────────────────────
  const lastLeg = legs[legs.length - 1];
  push({
    kind: 'arrive', legIndex: legs.length - 1, mode: lastLeg?.mode ?? 'walk',
    title: 'You are there',
    detail: lastLeg && isRide(lastLeg) ? `${lastLeg.to.name} is your stop` : undefined,
  });
  return steps;
}

function fareText(f?: { min: number; max: number }): string {
  if (!f || f.max <= 0) return '';
  return f.min === f.max ? ` (₦${f.max.toLocaleString()})` : ` (₦${f.min.toLocaleString()}–₦${f.max.toLocaleString()})`;
}

/**
 * The trip as a message you could send a friend — what riders forward on
 * WhatsApp. Same steps as the screen, so nothing gets lost in the retelling.
 */
export function explainJourney(option: RouteOption, originName: string, destName: string): string {
  const lines: string[] = [];
  lines.push(`${originName} → ${destName}`);
  lines.push(`${option.priceFormatted} · about ${option.totalDurationMins} min · ${option.transfers === 0 ? 'no change of vehicle' : `${option.transfers} change${option.transfers > 1 ? 's' : ''}`}`);
  lines.push('');
  for (const s of journeySteps(option)) {
    if (s.kind === 'arrive') continue;
    lines.push(`${s.n}. ${s.title}${fareText(s.fare)}`);
    if (s.boardAt) lines.push(`   ${s.boardAt}`);
    else if (s.lookFor) lines.push(`   ${s.lookFor}`);
    if (s.listenFor) lines.push(`   Listen for "${s.listenFor}!"`);
    if (s.say && s.kind === 'board') lines.push(`   Tell them: ${s.say}`);
    if (s.kind === 'alight' && s.detail) lines.push(`   ${s.detail}`);
    if (s.note) lines.push(`   ${s.note}`);
  }
  lines.push('');
  lines.push('— WakaWay');
  return lines.join('\n');
}
