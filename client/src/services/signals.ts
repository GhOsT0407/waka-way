import { supabase } from '../lib/supabase';
import type { RouteLeg, RouteOption } from './smartRoutingService';

/**
 * What riders have said about a corridor lately, and how to say it back.
 * Fares in the engine are estimates or LAMATA tables; when enough riders
 * have reported what they actually paid, that wins — and the rider is told
 * which of the two they are looking at.
 */

export interface CorridorSignal {
  corridor_id: string;
  fare_reports: number;
  fare_low: number | null;
  fare_median: number | null;
  fare_high: number | null;
  last_fare_at: string | null;
  ok_count: number;
  down_count: number;
  last_down_at: string | null;
}

export type SignalMap = Record<string, CorridorSignal>;

const DAY = 86_400_000;

export async function fetchCorridorSignals(corridorIds: string[]): Promise<SignalMap> {
  const ids = [...new Set(corridorIds.filter(Boolean))];
  if (!ids.length) return {};
  const { data, error } = await supabase.rpc('corridor_signals', { p_corridor_ids: ids });
  if (error || !data) return {};
  const out: SignalMap = {};
  for (const row of data as CorridorSignal[]) out[row.corridor_id] = row;
  return out;
}

export type TrustState = 'verified' | 'reported' | 'table' | 'estimate';

export interface FareTrust {
  state: TrustState;
  /** One line under the fare: "14 riders paid ₦500–₦700 this week". */
  label: string;
  /** The range to show, when riders' reports replace the estimate. */
  min: number;
  max: number;
}

function ageDays(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / DAY : Infinity;
}

/** How much to trust the fare on one leg, given what riders reported. */
export function fareTrust(leg: RouteLeg, sig?: CorridorSignal): FareTrust {
  if (leg.mode === 'walk') return { state: 'table', label: 'Free', min: 0, max: 0 };
  const recent = sig && sig.fare_reports > 0 && ageDays(sig.last_fare_at) <= 7 && sig.fare_low != null && sig.fare_high != null;
  if (recent && sig!.fare_reports >= 3) {
    return {
      state: 'verified',
      label: `${sig!.fare_reports} riders paid ₦${sig!.fare_low}–₦${sig!.fare_high} this week`,
      min: sig!.fare_low!, max: sig!.fare_high!,
    };
  }
  if (recent) {
    const n = sig!.fare_reports;
    return {
      state: 'reported',
      label: `${n} rider${n === 1 ? '' : 's'} paid about ₦${sig!.fare_median} recently`,
      min: Math.min(leg.priceMin, sig!.fare_low!), max: Math.max(leg.priceMax, sig!.fare_high!),
    };
  }
  if (leg.fareSource === 'table') return { state: 'table', label: 'LAMATA published fare', min: leg.priceMin, max: leg.priceMax };
  return { state: 'estimate', label: 'Estimate for the distance — tell us what you pay', min: leg.priceMin, max: leg.priceMax };
}

/** The whole option's fare, with rider reports folded in where they exist. */
export function optionFare(option: RouteOption, signals: SignalMap): { min: number; max: number; state: TrustState; riders: number } {
  let min = 0, max = 0, riders = 0;
  let sawEstimate = false, sawReported = false;
  const rides = option.legs.filter((l) => l.mode !== 'walk');
  let verifiedRides = 0;
  for (const leg of option.legs) {
    const sig = leg.corridorId ? signals[leg.corridorId] : undefined;
    const t = fareTrust(leg, sig);
    min += t.min; max += t.max;
    if (t.state === 'verified' || t.state === 'reported') riders += sig?.fare_reports ?? 0;
    if (t.state === 'verified') verifiedRides++;
    if (t.state === 'estimate') sawEstimate = true;
    if (t.state === 'reported') sawReported = true;
  }
  let state: TrustState = 'table';
  if (rides.length > 0 && verifiedRides === rides.length) state = 'verified';
  else if (sawReported) state = 'reported';
  else if (sawEstimate) state = 'estimate';
  return { min, max, state, riders };
}

/** Riders saying a line is not running — worth a warning on the route. */
export function routeTrouble(sig?: CorridorSignal): string | undefined {
  if (!sig || sig.down_count < 2 || ageDays(sig.last_down_at) > 3) return undefined;
  return `${sig.down_count} riders said this line no dey work in the last few days`;
}
