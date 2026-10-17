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
  /** Multiplier on ride minutes per mode; < 1 favours the mode, > 1 discourages it. */
  modeWeights?: Partial<Record<TransportMode, number>>;
  /** When the trip starts. Gates operating hours and sets the traffic factor. Default: now. */
  at?: Date;
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

// In-traffic averages, km/h.
// BRT has a dedicated lane on most of its length and a boarding queue
// instead of a scramble: faster and steadier than a danfo on the same road.
// (smartRoutingService.SPEEDS only times first/last-mile connectors, which are
// never BRT, so its brt figure does not have to match this one.)
const SPEED: Partial<Record<TransportMode, number>> = { danfo: 14, brt: 26, rail: 60, keke: 18, walk: 4.5 };

// Minutes: waiting for the first bus, and changing to another one.
// The BRT waits longer than a danfo: you buy or tap a ticket, join a queue,
// and at the big terminals the bus fills before it leaves. That is why a
// danfo still wins a one- or two-stop hop down the same road.
const FIRST_WAIT = { danfo: 5, brt: 10, rail: 8, keke: 2, okada: 2 } as Record<string, number>;
const CHANGE_WAIT = { danfo: 8, brt: 10, rail: 8, keke: 3, okada: 2 } as Record<string, number>;

/**
 * Minutes spent waiting to board a vehicle — the first one of the trip, or a
 * change. Exported so the times a rider is shown include the same waits the
 * search reasoned with, instead of ride minutes alone.
 */
export function boardingWaitMins(mode: TransportMode, first: boolean): number {
  return (first ? FIRST_WAIT[mode] ?? 5 : CHANGE_WAIT[mode] ?? 8);
}

/**
 * What a ride costs the search, in naira.
 *
 * The search used to minimise minutes alone, which let it send a rider 31 km
 * across Lagos to save a notional minute: fare never entered the arithmetic,
 * so a five-vehicle chain looked free. These are the fares the search reasons
 * with, not the fares the rider is shown — displayed fares still come from
 * corridorFare() and calcPrice(). Boarding is charged once per vehicle, which
 * is how Lagos actually works, then distance on top.
 *
 * Calibrated against calcPrice's bands: 3 km danfo lands at ₦275 against a
 * ₦200–300 band, 8 km at ₦400 against ₦300–500, 15 km BRT at ₦675 against
 * ₦570–680.
 */
const BOARD_FARE: Partial<Record<TransportMode, number>> = { danfo: 200, brt: 450, rail: 200, keke: 200, okada: 200, walk: 0 };
const FARE_PER_KM: Partial<Record<TransportMode, number>> = { danfo: 25, brt: 15, rail: 25, keke: 100, okada: 200, walk: 0 };

/**
 * How many minutes of travel a rider will trade for one naira saved.
 *
 * 0.05 makes ₦200 worth about ten minutes — the same weighting the WakaWay
 * demo engine uses (`W.fare = 1/20`), and the trade most Lagos commuters
 * visibly make when they pick a danfo over the BRT queue.
 */
const MINUTES_PER_NAIRA = 0.05;

/**
 * How much of the road's go-slow a mode actually sits in.
 *
 * Rail sits in none of it. The BRT runs a dedicated lane for most of its
 * length and only meets mixed traffic at junctions and the ends — so it
 * catches a fraction of the rush hour, not all of it. It used to take the
 * full 1.4× like a danfo, which threw away the one advantage the lane exists
 * for and had the engine recommending a 163-minute danfo down Ikorodu Road
 * at 7:30 instead of the BRT beside it.
 */
const TRAFFIC_EXPOSURE: Partial<Record<TransportMode, number>> = { rail: 0, brt: 0.35 };
export function trafficFor(mode: TransportMode, traffic: number): number {
  return 1 + (traffic - 1) * (TRAFFIC_EXPOSURE[mode] ?? 1);
}

/** Naira for one first/last-mile connector hop; under a kilometre is walked. */
function connectorFare(km: number): number {
  if (km <= 1.0) return 0;
  return (BOARD_FARE.keke ?? 200) + km * (FARE_PER_KM.keke ?? 100);
}

// ─── Adjacency (built once) ──────────────────────────────────────────────────
interface Edge { to: string; corridor: Corridor; km: number; minutes: number; walk?: boolean }
const ADJ: Record<string, Edge[]> = {};
// Sentinel corridor for on-foot links between stops; never rendered as a leg.
export const WALK_LINK: Corridor = { id: '__walk__', mode: 'walk', name: 'walk', stops: [], confidence: 'verified' };
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
// Any two stops within 450 m are one place on foot: Oshodi park and Oshodi
// station, Ojuelegba and the BRT shelter under the bridge.
const LINK_KM = 0.45;
for (let i = 0; i < GRAPH_STOPS.length; i++) {
  for (let j = i + 1; j < GRAPH_STOPS.length; j++) {
    const a = GRAPH_STOPS[i], b = GRAPH_STOPS[j];
    const km = haversineKm(a, b);
    if (km > LINK_KM) continue;
    const minutes = (km / SPEED.walk!) * 60 + 1;
    (ADJ[a.id] ??= []).push({ to: b.id, corridor: WALK_LINK, km, minutes, walk: true });
    (ADJ[b.id] ??= []).push({ to: a.id, corridor: WALK_LINK, km, minutes, walk: true });
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
/**
 * `corridor` is the vehicle the rider is sitting on: null at the origin, a
 * corridor id while riding, and WALKED after crossing to a neighbouring stop
 * on foot. WALKED matches no real corridor, so boarding from it is correctly
 * priced as a change rather than a first boarding.
 */
const WALKED = '__walked__';
const key = (s: State) => `${s.stop}|${s.corridor ?? ''}`;

interface Prev { state: State; edge?: Edge }

function dijkstra(
  origin: LatLng, dest: LatLng,
  transferPenalty: number,
  opts: Required<GraphSearchOptions>,
): GraphPath | null {
  const excluded = new Set(opts.excludeModes);
  const hour = opts.at.getHours() + opts.at.getMinutes() / 60;
  const inHours = (c: Corridor) => !c.hours || (hour >= c.hours[0] && hour <= c.hours[1]);
  const traffic = trafficFactor(opts.at);
  const usable = (c: Corridor) => !excluded.has(c.mode) && (!c.timetabled || opts.allowTimetabled)
    && !(opts.excludeUnverified && c.confidence === 'likely') && inHours(c);

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

  // The first mile pays its fare the same as the last. Leaving it out let the
  // search reach three kilometres down the road on a guessed bus hop for free,
  // instead of boarding the real corridor at the rider's own stop.
  for (const a of access) {
    push({ stop: a.stop.id, corridor: null }, opts.accessMinutes(origin, a.stop, a.km) + connectorFare(a.km) * MINUTES_PER_NAIRA);
  }

  let best: { state: State; d: number } | null = null;
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => a.d - b.d);
    const cur = open.shift()!;
    if (closed.has(cur.k)) continue;
    closed.add(cur.k);

    // Reaching the destination from this stop (only after riding something).
    // The last mile costs money as well as minutes, and leaving the fare out
    // was why the search would ride a stop past the rider's destination and
    // send them back on a keke: two more minutes looked free.
    if (cur.s.corridor && egressKm.has(cur.s.stop)) {
      const km = egressKm.get(cur.s.stop)!;
      const total = cur.d
        + opts.accessMinutes(STOP_BY_ID[cur.s.stop], dest, km)
        + connectorFare(km) * MINUTES_PER_NAIRA;
      if (!best || total < best.d) best = { state: cur.s, d: total };
    }
    if (best && cur.d > best.d) break;

    for (const e of ADJ[cur.s.stop] ?? []) {
      if (e.walk) {
        // On foot to a neighbouring stop: allowed only after riding something,
        // since the origin already attaches to every stop in reach. The WALKED
        // marker keeps that distinct from standing at the origin — otherwise
        // the next ride pays a 5-minute first wait instead of a change, and
        // walking 400 m becomes a cheap way to dodge the transfer penalty.
        if (!cur.s.corridor) continue;
        push({ stop: e.to, corridor: WALKED }, cur.d + e.minutes, { state: cur.s, edge: e });
        continue;
      }
      if (!usable(e.corridor)) continue;
      const weight = opts.modeWeights[e.corridor.mode] ?? 1;
      const slow = trafficFor(e.corridor.mode, traffic);
      const boarding = cur.s.corridor !== e.corridor.id;
      // Fare is charged in equivalent minutes: boarding once per vehicle,
      // then distance. This is what stops a long ride looking free.
      const fare = (boarding ? BOARD_FARE[e.corridor.mode] ?? 200 : 0)
        + e.km * (FARE_PER_KM[e.corridor.mode] ?? 25);
      let d = cur.d + e.minutes * weight * slow + fare * MINUTES_PER_NAIRA;
      if (cur.s.corridor === null) d += FIRST_WAIT[e.corridor.mode] ?? 5;
      else if (boarding) d += (CHANGE_WAIT[e.corridor.mode] ?? 8) + transferPenalty;
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
    if (e.walk) { at = e.to; continue; }
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
  // Weighted minutes steer the search; the figure reported is the honest one.
  for (const l of legs) l.minutes *= trafficFor(l.mode, traffic);
  const ride = legs.reduce((m, l) => m + l.minutes, 0);
  const waits = legs.reduce((m, l, i) => m + (i === 0 ? (FIRST_WAIT[l.mode] ?? 5) : (CHANGE_WAIT[l.mode] ?? 8)), 0);
  const endsMin = opts.accessMinutes(origin, board, haversineKm(origin, board)) + opts.accessMinutes(alight, dest, haversineKm(alight, dest));
  return {
    legs, board, alight,
    accessKm: haversineKm(origin, board),
    egressKm: haversineKm(alight, dest),
    minutes: Math.round(ride + waits + endsMin),
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
    modeWeights: options.modeWeights ?? {},
    at: options.at ?? new Date(),
  };
  // Each pass asks a different question, so a rider sees genuinely different
  // ways: the fastest thing; the fastest on confirmed lines; the BRT/rail way
  // when one exists (the formal modes are steadier, and a danfo running the
  // same road would otherwise hide them); fewest changes; danfo only.
  type Variant = { penalty: number; exclude: TransportMode[]; verifiedOnly?: boolean; weights?: Partial<Record<TransportMode, number>> };
  // Every change of vehicle costs a real penalty now. At zero — which five of
  // these six used to carry — the search would chain five danfos to shave a
  // minute, because only the change-wait pushed back. A change is worse than
  // its wait: you lose your seat, you re-negotiate the fare, and you may not
  // get on the first bus that comes.
  const variants: Variant[] = [
    { penalty: 10, exclude: [] },
    { penalty: 10, exclude: [], verifiedOnly: true },
    { penalty: 10, exclude: ['danfo', 'keke'] },                      // formal transit only
    { penalty: 10, exclude: [], weights: { brt: 0.6, rail: 0.5 } },   // prefer the lane / the train
    { penalty: 30, exclude: [] },                                     // fewest changes
    { penalty: 10, exclude: ['brt', 'rail'] },
  ];
  const out: GraphPath[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    const p = dijkstra(origin, dest, v.penalty, {
      ...opts,
      excludeModes: [...opts.excludeModes, ...v.exclude],
      excludeUnverified: opts.excludeUnverified || !!v.verifiedOnly,
      modeWeights: { ...opts.modeWeights, ...(v.weights ?? {}) },
    });
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
    const p = Math.max(200, Math.round((c.fullFare * Math.max(0.3, frac)) / 10) * 10);
    return { min: p, max: p };
  }
  if (c.mode === 'rail') {
    const full = c.fullFare ?? 750;
    if (c.id === 'rail_red') return stopsSpanned <= 2 ? { min: 500, max: 500 } : stopsSpanned <= 5 ? { min: 1000, max: 1000 } : { min: full, max: full };
    return stopsSpanned <= 1 ? { min: 200, max: 250 } : stopsSpanned <= 3 ? { min: 400, max: 500 } : { min: full, max: full };
  }
  return null;
}

/**
 * How much slower the roads are than the corridor's base speed right now.
 * Lagos peaks are long: 06:30–10:00 and 16:00–20:30 on weekdays, a softer
 * Saturday evening, and roads are clear after midnight.
 */
export function trafficFactor(d = new Date()): number {
  const day = d.getDay();
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 5.5 || h >= 22) return 0.8;
  if (day === 0) return 0.9;
  if (day === 6) return h >= 16 && h < 20 ? 1.15 : 1.0;
  if ((h >= 6.5 && h < 10) || (h >= 16 && h < 20.5)) return 1.4;
  return 1.0;
}

/** Red Line runs 9 weekday trips in two windows; only offer it when one is coming up. */
export function redLineRunningAt(d = new Date()): boolean {
  const day = d.getDay();
  if (day === 0 || day === 6) return false;
  const mins = d.getHours() * 60 + d.getMinutes();
  return (mins >= 5 * 60 + 30 && mins <= 9 * 60 + 30) || (mins >= 16 * 60 + 30 && mins <= 20 * 60 + 30);
}
