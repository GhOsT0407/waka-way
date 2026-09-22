import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Contribution } from './useContributions';
import type { RouteOption, AvoidPoint } from '../services/smartRoutingService';
import { haversineKm, distanceToSegmentKm, type LatLng } from '../utils/geo';
import { legGeometry } from '../services/routeGeometry';

/**
 * Live community reports, light enough for a banner and a route card.
 * The Live map keeps its own richer hook (votes, proximity pushes); this
 * one just answers "what is going on near here / along this route?".
 */

export type LiveAlert = Contribution;

/** Kinds that mean "something is wrong on the road", as opposed to fare/route data. */
export const TROUBLE_KINDS = ['traffic', 'security', 'danger_zone', 'hazard', 'construction', 'route_down', 'stop_moved'];

/** How far a report reaches, km — how close a route has to pass to be affected. */
const REACH_KM: Record<string, number> = {
  security: 0.5, danger_zone: 0.3, hazard: 0.2, construction: 0.2, traffic: 0.4, route_down: 0.4, stop_moved: 0.3,
};

interface Options {
  near?: LatLng | null;
  radiusKm?: number;
  kinds?: string[];
  /** Subscribe to inserts/updates. Off by default; the banner refetches on focus instead. */
  realtime?: boolean;
}

export function useLiveAlerts({ near, radiusKm, kinds, realtime = false }: Options = {}) {
  const [alerts, setAlerts] = useState<LiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const kindsKey = kinds?.join(',') ?? '';
  const nearKey = near ? `${near.latitude.toFixed(3)},${near.longitude.toFixed(3)}` : '';
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const { data, error: err } = await supabase.rpc('get_active_contributions');
      if (err) throw err;
      let rows = (data ?? []) as LiveAlert[];
      if (kinds && kinds.length) rows = rows.filter((r) => kinds.includes(r.type));
      if (near && radiusKm) rows = rows.filter((r) => haversineKm(near, r) <= radiusKm);
      if (mounted.current) { setAlerts(rows); setError(null); }
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? 'Could not load reports');
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey, nearKey, radiusKm]);

  useEffect(() => {
    mounted.current = true;
    refetch();
    return () => { mounted.current = false; };
  }, [refetch]);

  useEffect(() => {
    if (!realtime) return;
    const channel = supabase
      .channel('live-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contributions' }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [realtime, refetch]);

  return { alerts, loading, error, refetch };
}

/** Reports close enough to any leg of this option to matter, with the leg they touch. */
export function alertsAlongRoute(alerts: LiveAlert[], option: RouteOption): { alert: LiveAlert; legIndex: number; km: number }[] {
  const out: { alert: LiveAlert; legIndex: number; km: number }[] = [];
  for (const a of alerts) {
    if (!TROUBLE_KINDS.includes(a.type)) continue;
    const reach = REACH_KM[a.type] ?? 0.3;
    let best: { legIndex: number; km: number } | null = null;
    option.legs.forEach((leg, i) => {
      // A bus leg follows its corridor, not the chord between its ends —
      // measure against the stop chain so a report at Ojota lands on the
      // Ikorodu Road leg it actually sits on.
      const pts = legGeometry(leg);
      let km = Infinity;
      for (let k = 0; k < pts.length - 1; k++) km = Math.min(km, distanceToSegmentKm(a, pts[k], pts[k + 1]));
      if (km <= reach && (!best || km < best.km)) best = { legIndex: i, km };
    });
    if (best) out.push({ alert: a, ...(best as { legIndex: number; km: number }) });
  }
  return out;
}

/** Reports the planner should route around: things you don't want to walk or ride into. */
export function avoidPointsFrom(alerts: LiveAlert[]): AvoidPoint[] {
  return alerts
    .filter((a) => ['security', 'danger_zone', 'hazard', 'construction'].includes(a.type))
    .map((a) => ({ latitude: a.latitude, longitude: a.longitude, radiusKm: REACH_KM[a.type] ?? 0.3 }));
}

/** "Still happening?" — through the RPC, which checks auth and keeps one vote per rider. */
export async function voteOnAlert(alertId: string, vote: 'CONFIRM' | 'DISMISS'): Promise<boolean> {
  const { data, error } = await supabase.rpc('vote_on_contribution', { p_contribution_id: alertId, p_vote_type: vote });
  if (error) return false;
  return !(data && (data as any).success === false);
}
