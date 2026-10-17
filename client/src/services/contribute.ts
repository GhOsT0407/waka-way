import { supabase } from '../lib/supabase';
import type { RouteLeg, RouteOption, SmartRouteResult } from './smartRoutingService';
import type { ReportKind } from '../utils/reportKinds';

/**
 * Every answer a rider gives after a trip lands here as a row the next
 * rider can benefit from: keyed to the corridor, the stops and the fare,
 * not buried in a sentence. Confirmations (fare_paid, route_ok) never show
 * as pins — get_active_contributions leaves them out — they roll up through
 * corridor_signals into the fare and trouble lines on the route screen.
 */

/** How long each kind stays on the Live map before it is just history. */
export const EXPIRY_HOURS: Partial<Record<ReportKind, number>> = {
  traffic: 3, hazard: 6, construction: 24, security: 6, danger_zone: 12,
  fare_change: 24 * 7, route_down: 24 * 3, stop_moved: 24 * 7, new_route: 24 * 30,
};

export function expiresAt(kind: ReportKind): string | null {
  const h = EXPIRY_HOURS[kind];
  return h ? new Date(Date.now() + h * 3_600_000).toISOString() : null;
}

export const tripKey = (r: SmartRouteResult) => `${r.origin.name} > ${r.destination.name}`.toLowerCase();

const rides = (o: RouteOption) => o.legs.filter((l) => l.mode !== 'walk');

/** Who is reporting — RLS needs a session, and the row should say whose it is. */
async function reporterId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/** "Yes, e work" — one row per ride so every corridor the rider used gets the credit. */
export async function confirmRouteWorked(result: SmartRouteResult, option: RouteOption): Promise<boolean> {
  const user_id = await reporterId();
  if (!user_id) return false;
  const rows = rides(option).map((leg) => ({
    user_id,
    type: 'route_ok',
    title: `Route worked · ${leg.from.name} → ${leg.to.name}`,
    latitude: leg.to.latitude,
    longitude: leg.to.longitude,
    corridor_id: leg.corridorId ?? null,
    stop_id: leg.toStopId ?? null,
    leg_from: leg.fromStopId ?? null,
    leg_to: leg.toStopId ?? null,
    mode: leg.mode,
    trip_key: tripKey(result),
    status: 'approved',
    expires_at: new Date().toISOString(),
  }));
  if (!rows.length) return true;
  const { error } = await supabase.from('contributions').insert(rows);
  return !error;
}

/** "How much did you pay?" — the amount, on the corridor, from where to where. */
export async function reportFarePaid(result: SmartRouteResult, leg: RouteLeg, amount: number): Promise<boolean> {
  const user_id = await reporterId();
  if (!user_id) return false;
  const { error } = await supabase.from('contributions').insert({
    user_id,
    type: 'fare_paid',
    title: `Paid ₦${amount} · ${leg.from.name} → ${leg.to.name}`,
    latitude: leg.from.latitude,
    longitude: leg.from.longitude,
    corridor_id: leg.corridorId ?? null,
    stop_id: leg.fromStopId ?? null,
    leg_from: leg.fromStopId ?? null,
    leg_to: leg.toStopId ?? null,
    mode: leg.mode,
    fare_ngn: Math.round(amount),
    trip_key: tripKey(result),
    status: 'approved',
    expires_at: new Date().toISOString(),
  });
  return !error;
}

/** Fare chips around the estimate, rounded the way conductors round. */
export function fareChoices(leg: RouteLeg): number[] {
  const mid = Math.round(((leg.priceMin + leg.priceMax) / 2) / 50) * 50;
  const set = new Set<number>([leg.priceMin, mid, leg.priceMax, leg.priceMax + 100, leg.priceMax + 200].map((v) => Math.max(50, Math.round(v / 50) * 50)));
  return [...set].sort((a, b) => a - b).slice(0, 5);
}
