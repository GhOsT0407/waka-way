/**
 * Incident Intelligence Service
 *
 * Turns community contributions into route-aware traffic signals.
 *
 * Flow:
 *  1. Fetch active community reports from Supabase (last 2 hours)
 *  2. Spatially cluster nearby reports → confidence score
 *  3. Check whether any cluster intersects a given set of route legs
 *  4. Decide whether to auto-reroute, suggest, or just inform
 *  5. Rank route options so unaffected options surface first
 */

import { supabase } from '../lib/supabase';
import { calculateDistance } from './smartRoutingService';
import type { RouteLeg, RouteOption } from './smartRoutingService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentConfidence = 'low' | 'medium' | 'high';
export type RerouteDecision    = 'auto' | 'suggest' | 'info' | 'none';

export interface ScoredIncident {
  id:            string;
  type:          string;
  title:         string;
  latitude:      number;
  longitude:     number;
  address:       string;
  reportCount:   number;
  confidence:    IncidentConfidence;
  minutesAgo:    number;
  avoidRadiusKm: number;
}

interface RawContribution {
  id:         string;
  type:       string;
  title:      string;
  latitude:   number;
  longitude:  number;
  address:    string;
  status:     string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_WINDOW_HOURS   = 2;
const CLUSTER_RADIUS_KM     = 0.3;   // Reports within 300 m belong to the same cluster
const ROUTE_INTERCEPT_KM    = 0.4;   // Incident within 400 m of a leg segment = on route
const HIGH_CONFIDENCE_COUNT = 5;     // 5+ clustered reports → high
const MED_CONFIDENCE_COUNT  = 3;     // 3–4 reports → medium
const HIGH_AUTO_WINDOW_MINS = 30;    // Must be within 30 mins for auto-reroute
const AVOID_RADIUS_KM       = 0.6;   // Routing engine avoidance radius per incident

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getActiveIncidents(): Promise<ScoredIncident[]> {
  try {
    const cutoff = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('contributions')
      .select('id, type, title, latitude, longitude, address, status, created_at')
      .in('status', ['approved', 'high-priority', 'pending'])
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return clusterAndScore(data as RawContribution[]);
  } catch {
    return [];
  }
}

// ─── Clustering ───────────────────────────────────────────────────────────────
// Group nearby reports into clusters. Each cluster becomes one ScoredIncident
// with a report count equal to the cluster size.

function clusterAndScore(raw: RawContribution[]): ScoredIncident[] {
  const used = new Set<string>();
  const scored: ScoredIncident[] = [];

  for (const anchor of raw) {
    if (used.has(anchor.id)) continue;
    used.add(anchor.id);

    // Gather all other reports within CLUSTER_RADIUS_KM
    const cluster = raw.filter((r) => {
      if (used.has(r.id)) return false;
      const dist = calculateDistance(anchor.latitude, anchor.longitude, r.latitude, r.longitude);
      return dist <= CLUSTER_RADIUS_KM;
    });

    cluster.forEach((r) => used.add(r.id));
    const reportCount = 1 + cluster.length;

    const minutesAgo = Math.floor(
      (Date.now() - new Date(anchor.created_at).getTime()) / 60000
    );

    const confidence = scoreConfidence(reportCount, minutesAgo);

    scored.push({
      id:            anchor.id,
      type:          anchor.type,
      title:         anchor.title || typeLabel(anchor.type),
      latitude:      anchor.latitude,
      longitude:     anchor.longitude,
      address:       anchor.address,
      reportCount,
      confidence,
      minutesAgo,
      avoidRadiusKm: AVOID_RADIUS_KM,
    });
  }

  return scored;
}

function scoreConfidence(count: number, minutesAgo: number): IncidentConfidence {
  if (count >= HIGH_CONFIDENCE_COUNT && minutesAgo <= HIGH_AUTO_WINDOW_MINS) return 'high';
  if (count >= MED_CONFIDENCE_COUNT) return 'medium';
  return 'low';
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    bus_stop:     'Bus Stop',
    taxi_stand:   'Taxi Stand',
    danger_zone:  'Danger Zone',
    construction: 'Road Works',
    traffic:      'Heavy Traffic',
    security:     'Security Alert',
    hazard:       'Road Hazard',
    other:        'Incident',
  };
  return labels[type] ?? 'Incident';
}

// ─── Geometric intersection ───────────────────────────────────────────────────

/**
 * Minimum distance (km) from a point P to a line segment A–B.
 * Uses the standard perpendicular projection formula.
 */
function ptSegDistKm(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number
): number {
  const ABx = bx - ax, ABy = by - ay;
  const len2 = ABx * ABx + ABy * ABy;

  if (len2 === 0) return calculateDistance(px, py, ax, ay);

  // Project P onto AB, clamp to [0, 1]
  let t = ((px - ax) * ABx + (py - ay) * ABy) / len2;
  t = Math.max(0, Math.min(1, t));

  return calculateDistance(px, py, ax + t * ABx, ay + t * ABy);
}

/**
 * Returns true if the incident lies within radiusKm of ANY segment in legs.
 */
export function isIncidentOnRoute(
  incident: ScoredIncident,
  legs: RouteLeg[],
  radiusKm = ROUTE_INTERCEPT_KM
): boolean {
  return legs.some((leg) =>
    ptSegDistKm(
      incident.latitude, incident.longitude,
      leg.from.latitude, leg.from.longitude,
      leg.to.latitude,   leg.to.longitude
    ) <= radiusKm
  );
}

/**
 * Returns the subset of scored incidents that lie on the given route.
 */
export function getIncidentsOnRoute(
  legs: RouteLeg[],
  incidents: ScoredIncident[],
  radiusKm = ROUTE_INTERCEPT_KM
): ScoredIncident[] {
  return incidents.filter((inc) => isIncidentOnRoute(inc, legs, radiusKm));
}

// ─── Decision ─────────────────────────────────────────────────────────────────

/**
 * Given the incidents that lie on a specific route, decide what action to take.
 *
 * 'auto'    → high-confidence incident: reroute automatically
 * 'suggest' → medium-confidence: offer reroute to user
 * 'info'    → low-confidence: show a warning only
 * 'none'    → nothing on this route
 */
export function getRerouteDecision(incidents: ScoredIncident[]): RerouteDecision {
  if (incidents.length === 0) return 'none';
  if (incidents.some((i) => i.confidence === 'high'))   return 'auto';
  if (incidents.some((i) => i.confidence === 'medium')) return 'suggest';
  return 'info';
}

// ─── Route ranking ────────────────────────────────────────────────────────────

export interface RankedRouteResult {
  options:     RouteOption[];
  affectedIds: string[];   // IDs of options that pass through incidents
}

/**
 * Re-ranks route options so that options avoiding incidents float to the top.
 * The original recommendation logic is preserved within each group.
 */
export function rankRoutesByIncidents(
  options:   RouteOption[],
  incidents: ScoredIncident[]
): RankedRouteResult {
  if (incidents.length === 0) return { options, affectedIds: [] };

  const affectedIds: string[] = [];

  const scored = options.map((opt) => {
    const onRoute = getIncidentsOnRoute(opt.legs, incidents);
    const affected = onRoute.length > 0;
    if (affected) affectedIds.push(opt.id);
    const incidentPenalty = onRoute.reduce((sum, i) => sum + i.reportCount * 5, 0);
    return { opt, affected, incidentPenalty };
  });

  // Sort: clean routes first (preserving original order within each group)
  scored.sort((a, b) => {
    if (a.affected !== b.affected) return a.affected ? 1 : -1;
    return a.incidentPenalty - b.incidentPenalty;
  });

  // Update recommended flag: first unaffected option becomes recommended
  const reranked = scored.map((s) => s.opt);
  const firstClean = reranked.find((o) => !affectedIds.includes(o.id));
  if (firstClean) {
    reranked.forEach((o) => { o.isRecommended = false; });
    firstClean.isRecommended = true;
    firstClean.recommendationReason = 'Avoids reported incidents on your route';
    if (!firstClean.tags.includes('Incident-free')) {
      firstClean.tags.push('Incident-free');
    }
  }

  return { options: reranked, affectedIds };
}

// ─── Summary text helpers ─────────────────────────────────────────────────────

export function incidentSummaryText(incidents: ScoredIncident[]): string {
  if (incidents.length === 0) return '';
  const high = incidents.filter((i) => i.confidence === 'high');
  const count = incidents.reduce((s, i) => s + i.reportCount, 0);

  if (high.length > 0) {
    return `${count} people reported ${high[0].title.toLowerCase()} on your route`;
  }
  if (incidents.length === 1) {
    return `${count} ${count === 1 ? 'report' : 'reports'} of ${incidents[0].title.toLowerCase()} near your route`;
  }
  return `${incidents.length} incidents reported along your route`;
}

export function incidentColor(decision: RerouteDecision): string {
  switch (decision) {
    case 'auto':    return '#EF4444';
    case 'suggest': return '#F97316';
    case 'info':    return '#F59E0B';
    default:        return '#64748B';
  }
}
