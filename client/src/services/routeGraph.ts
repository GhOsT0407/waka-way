/**
 * Corridor graph search — a bus leg exists only along a real corridor.
 *
 * Nodes are (stop, corridor) states so a change of bus is an explicit,
 * priced event; edges are consecutive stops on a corridor. Origin and
 * destination attach to every stop within reach through a first/last-mile
 * connector. Dijkstra on minutes, run with a few different transfer
 * penalties to surface genuinely different itineraries (fewest changes vs
 * fastest vs no-BRT), which the engine then prices and ranks.
 */

import { CORRIDORS, GRAPH_STOPS, STOP_BY_ID, Corridor, GraphStop } from '../data/lagosRoutes';
import type { TransportMode } from '../types/routing';

export interface LatLng { latitude: number; longitude: number }

export interface GraphLeg {
  corridor: Corridor;
  mode: TransportMode;
  from: GraphStop;
  to: GraphStop;
  via: GraphStop[];        // intermediate stops, in order
  distanceKm: number;      // along the corridor, not as the crow flies
  minutes: number;
  /** The corridor's end stop in the direction of travel — what the conductor calls. */
  terminal: GraphStop;
}

export interface GraphPath {
  legs: GraphLeg[];
  board: GraphStop;
  alight: GraphStop;
  accessKm: number;        // origin → board, straight line
  egressKm: number;        // alight → destination, straight line
  minutes: number;         // whole trip including access/egress estimates
  transfers: number;
}

export interface GraphSearchOptions {
  /** Corridors that need a timetable (Red Line) are only offered when this is true. */
  allowTimetabled?: boolean;
  /** Skip these modes entirely (e.g. no BRT for a cheaper alternative). */
  excludeModes?: TransportMode[];
  /** Only ride corridors marked verified/local — no 'likely' ones. */
  excludeUnverified?: boolean;
  /** Furthest a rider is attached to the network at either end, km. */
  reachKm?: number;
  /**
   * Minutes for the first/last-mile gap between a point and a stop. The
   * engine supplies this so the graph weighs walking vs keke with the same
   * legality rules the produced legs follow; default is walk-or-keke.
   */
  accessMinutes?: (from: LatLng, to: LatLng, km: number) => number;
}

// ─── Geometry ────────────────────────────────────────────────────────────────
const R = 6371;
export function haversineKm(a: LatLng, b: LatLng): number {
  const t = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(t(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(t(a.latitude)) * Math.cos(t(b.latitude)) * Math.sin(t(b.longitude - a.longitude) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Lagos roads don't run straight; a corridor hop is ~25 % longer than the chord.
const ROAD_FACTOR = 1.25;

// In-traffic averages, km/h (same numbers as smartRoutingService.SPEEDS).
const SPEED: Partial<Record<TransportMode, number>> = { danfo: 14, brt: 20, rail: 60, keke: 18, walk: 4.5 };

// Minutes: waiting for the first bus, and changing to another one.
const FIRST_WAIT = { danfo: 5, brt: 6, rail: 8, keke: 2 } as Record<string, number>;
const CHANGE_WAIT = { danfo: 8, brt: 7, rail: 8, keke: 3 } as Record<string, number>;

// ─── Adjacency (built once) ──────────────────────────────────────────────────
interface Edge { to: string; corridor: Corridor; km: number; minutes: number }
const ADJ: Record<string, Edge[]> = {};
for (const c of CORRIDORS) {
  const speed = c.speedKmh ?? SPEED[c.mode] ?? 14;
  for (let i = 0; i < c.stops.length - 1; i++) {
    const a = STOP_BY_ID[c.stops[i]], b = STOP_BY_ID[c.stops[i + 1]];
    const km = c.hops?.[i] ?? haversineKm(a, b) * ROAD_FACTOR;
    const minutes = (km / speed) * 60;
    (ADJ[a.id] ??= []).push({ to: b.id, corridor: c, km, minutes });
    (ADJ[b.id] ??= []).push({ to: a.id, corridor: c, km, minutes });
  }
}

/** Default first/last-mile cost: walk it if short, keke (plus finding one) otherwise. */
function defaultAccessMinutes(_from: LatLng, _to: LatLng, km: number): number {
  return km <= 1.0 ? (km / SPEED.walk!) * 60 : 8 + (km / SPEED.keke!) * 60;
}

/** Stops within reach of a point, nearest first. */
export function stopsNear(p: LatLng, reachKm: number, max = 6): { stop: GraphStop; km: number }[] {
  return GRAPH_STOPS
    .map((stop) => ({ stop, km: haversineKm(p, stop) }))
    .filter((x) => x.km <= reachKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, max);
}

// ─── Dijkstra ────────────────────────────────────────────────────────────────
interface State { stop: string; corridor: string | null }
const key = (s: State) => `${s.stop}|${s.corridor ?? ''}`;

interface Prev { state: State; edge?: Edge }

function dijkstra(
  origin: LatLng, dest: LatLng,
  transferPenalty: number,
  opts: Required<GraphSearchOptions>,
): GraphPath | null {
  const excluded = new Set(opts.excludeModes);
  const usable = (c: Corridor) => !excluded.has(c.mode) && (!c.timetabled || opts.allowTimetabled)
    && !(opts.excludeUnverified && c.confidence === 'likely');

  const dist = new Map<string, number>();
  const prev = new Map<string, Prev>();
  // Tiny graph (≈ 120 stops × few corridors) — a sorted array is fine.
  const open: { k: string; s: State; d: number }[] = [];
  const push = (s: State, d: number, from?: Prev) => {
    const k = key(s);
    if (d >= (dist.get(k) ?? Infinity)) return;
    dist.set(k, d);
    if (from) prev.set(k, from);
    open.push({ k, s, d });
  };

  const access = stopsNear(origin, opts.reachKm);
  const egress = stopsNear(dest, opts.reachKm);
  if (!access.length || !egress.length) return null;
  const egressKm = new Map(egress.map((e) => [e.stop.id, e.km]));

  for (const a of access) push({ stop: a.stop.id, corridor: null }, opts.accessMinutes(origin, a.stop, a.km));

  let best: { state: State; d: number } | null = null;
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => a.d - b.d);
    const cur = open.shift()!;
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);

    // Reaching the destination from this stop (only after riding something).
    if (cur.s.corridor && egressKm.has(cur.s.stop)) {
      const total = cur.d + opts.accessMinutes(STOP_BY_ID[cur.s.stop], dest, egressKm.get(cur.s.stop)!);
      if (!best || total < best.d) best = { state: cur.s, d: total };
    }
    if (best && cur.d > best.d) break;

    for (const e of ADJ[cur.s.stop] ?? []) {
      if (!usable(e.corridor)) continue;
      let d = cur.d + e.minutes;
      if (cur.s.corridor === null) d += FIRST_WAIT[e.corridor.mode] ?? 5;
      else if (cur.s.corridor !== e.corridor.id) d += (CHANGE_WAIT[e.corridor.mode] ?? 8) + transferPenalty;
      push({ stop: e.to, corridor: e.corridor.id }, d, { state: cur.s, edge: e });
    }
  }
  if (!best) return null;

  // Walk back, then collapse same-corridor runs into legs.
  const chain: { state: State; edge?: Edge }[] = [];
  let k = key(best.state);
  let node: State = best.state;
  while (prev.has(k)) {
    const p = prev.get(k)!;
    chain.unshift({ state: node, edge: p.edge });
    node = p.state; k = key(node);
  }
  const boardId = node.stop;
  const legs: GraphLeg[] = [];
  let leg: GraphLeg | null = null;
  let at = boardId;
  for (const step of chain) {
    const e = step.edge!;
    if (!leg || leg.corridor.id !== e.corridor.id) {
      if (leg) legs.push(leg);
      const forward = e.corridor.stops.indexOf(e.to) > e.corridor.stops.indexOf(at);
      const terminal = STOP_BY_ID[forward ? e.corridor.stops[e.corridor.stops.length - 1] : e.corridor.stops[0]];
      leg = { corridor: e.corridor, mode: e.corridor.mode, from: STOP_BY_ID[at], to: STOP_BY_ID[e.to], via: [], distanceKm: e.km, minutes: e.minutes, terminal };
    } else {
      leg.via.push(leg.to);
      leg.to = STOP_BY_ID[e.to];
      leg.distanceKm += e.km;
      leg.minutes += e.minutes;
    }
    at = e.to;
  }
  if (leg) legs.push(leg);
  if (!legs.length) return null;

  const board = STOP_BY_ID[boardId];
  const alight = STOP_BY_ID[best.state.stop];
  return {
    legs, board, alight,
    accessKm: haversineKm(origin, board),
    egressKm: haversineKm(alight, dest),
    minutes: Math.round(best.d),
    transfers: legs.length - 1,
  };
}

/** Up to three distinct itineraries between two points, or none if the network doesn't reach. */
export function searchGraph(origin: LatLng, dest: LatLng, options: GraphSearchOptions = {}): GraphPath[] {
  const opts: Required<GraphSearchOptions> = {
    allowTimetabled: options.allowTimetabled ?? false,
    excludeModes: options.excludeModes ?? [],
    reachKm: options.reachKm ?? 3.0,
    accessMinutes: options.accessMinutes ?? defaultAccessMinutes,
    excludeUnverified: options.excludeUnverified ?? false,
  };
  const variants: [number, TransportMode[], boolean][] = [
    [0, [], false],             // fastest
    [0, [], true],              // fastest on confirmed lines only
    [20, [], false],            // fewest changes
    [0, ['brt', 'rail'], false], // danfo only (usually cheapest)
  ];
  const out: GraphPath[] = [];
  const seen = new Set<string>();
  for (const [penalty, exclude, verifiedOnly] of variants) {
    const p = dijkstra(origin, dest, penalty, { ...opts, excludeModes: [...opts.excludeModes, ...exclude], excludeUnverified: opts.excludeUnverified || verifiedOnly });
    if (!p) continue;
    const sig = p.legs.map((l) => `${l.corridor.id}:${l.from.id}>${l.to.id}`).join('|');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(p);
  }
  return out;
}

/**
 * Fare for riding `stopsSpanned` stops on a corridor. BRT and rail follow
 * the LAMATA 2 Mar 2026 table (short hops from ₦450/₦200 up to the full-line
 * fare); danfo is settled per leg by the engine's distance bands.
 */
export function corridorFare(c: Corridor, stopsSpanned: number): { min: number; max: number } | null {
  const n = c.stops.length - 1;
  const frac = Math.max(0, Math.min(1, stopsSpanned / n));
  if (c.mode === 'brt') {
    const full = c.fullFare ?? 960;
    if (frac <= 0.2) return { min: 450, max: 450 };
    if (frac <= 0.45) return { min: 570, max: 570 };
    if (frac <= 0.75) return { min: 680, max: 680 };
    return { min: full, max: full };
  }
  // LAMATA standard routes publish a full-line fare; a partial ride is a
  // share of it, never below a third (the boarding minimum).
  if (c.mode === 'danfo' && c.fullFare) {
    const p = Math.round((c.fullFare * Math.max(0.35, frac)) / 10) * 10;
    return { min: p, max: p };
  }
  if (c.mode === 'rail') {
    const full = c.fullFare ?? 750;
    if (c.id === 'rail_red') return stopsSpanned <= 2 ? { min: 500, max: 500 } : stopsSpanned <= 5 ? { min: 1000, max: 1000 } : { min: full, max: full };
    return stopsSpanned <= 1 ? { min: 200, max: 250 } : stopsSpanned <= 3 ? { min: 400, max: 500 } : { min: full, max: full };
  }
  return null;
}

/** Red Line runs 9 weekday trips in two windows; only offer it when one is coming up. */
export function redLineRunningAt(d = new Date()): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const mins = d.getHours() * 60 + d.getMinutes();
  return (mins >= 5 * 60 + 30 && mins <= 9 * 60 + 30) || (mins >= 16 * 60 + 30 && mins <= 20 * 60 + 30);
}
