/**
 * WakaWay Smart Routing Service
 *
 * Lagos multimodal routing over real corridors (data/lagosRoutes.ts):
 *   - BRT: Ikorodu – TBS and Oshodi – Abule-Egba (LAMATA)
 *   - Rail: Blue Line Mile 2 – Marina; Red Line Agbado – Oyingbo (timetabled)
 *   - ~30 danfo corridors, each an ordered list of real stops
 *   - Walk / keke / okada for first and last mile (decisions/0011)
 *
 * A bus leg can only exist along a corridor; the engine no longer draws a
 * "danfo" between two hubs no bus connects. Trips the network doesn't reach
 * get an honest "ask at the park" option instead of an invented line.
 *
 * Sources: wakaway/Routes Data Research.md
 */

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

import type { TransportMode } from '../types/routing';
export type { TransportMode };

export interface Location {
  latitude: number;
  longitude: number;
  name: string;
  type?: string;
}

export interface RouteLeg {
  id: string;
  mode: TransportMode;
  from: Location;
  to: Location;
  distanceKm: number;
  durationMins: number;
  priceMin: number;
  priceMax: number;
  instruction: string;
  localInstruction: string;
  icon: string;
  /** Keke inside a restricted LGA: inner streets only, may not be there. */
  mayBeUnavailable?: boolean;
  /** For bus/rail legs: the corridor ridden and how many stops it spans. */
  corridorName?: string;
  stopsSpanned?: number;
  /** Intermediate stop names, in order, for "via …" captions. */
  viaStops?: string[];
  /** What the conductor shouts for this bus — "Oshodi Oshodi!" */
  conductorCall?: string;
  confidence?: 'verified' | 'local' | 'likely';
}

export interface RouteOption {
  id: string;
  type: 'direct' | 'segmented';
  name: string;
  description: string;
  legs: RouteLeg[];
  totalDistanceKm: number;
  totalDurationMins: number;
  totalPriceMin: number;
  totalPriceMax: number;
  priceFormatted: string;
  isCheapest: boolean;
  isFastest: boolean;
  /** Fewest changes of vehicle among the options. */
  isSimplest: boolean;
  isRecommended: boolean;
  recommendationReason?: string;
  tags: string[];
}

export interface NearestStopInfo {
  name: string;
  distanceKm: number;
  walkMins: number;
}

export interface SmartRouteResult {
  origin: Location;
  destination: Location;
  tripBand: TripBand;
  originNearestStop?: NearestStopInfo;
  destinationNearestStop?: NearestStopInfo;
  options: RouteOption[];
  recommendedOptionId: string;
  comparison: {
    priceDifference: number;
    priceDifferencePercent: number;
    timeDifference: number;
    shouldLetUserChoose: boolean;
    comparisonText: string;
  };
  computedAt: string;
}

export interface AvoidPoint {
  latitude:  number;
  longitude: number;
  radiusKm:  number;
}

export interface SmartRoutePreferences {
  /** When the trip starts; gates BRT/rail hours and the traffic factor. Default: now. */
  departAt?: Date;
  preferredFirstLegMode?: TransportMode;
  avoidPoints?: AvoidPoint[];
}

// ─────────────────────────────────────────────────────────────
// HAVERSINE
// ─────────────────────────────────────────────────────────────

export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function uid(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

// km/h, in-traffic averages. BRT's 28 was the dedicated-lane design speed;
// 20 is what the Ikorodu corridor actually does across a day.
const SPEEDS: Record<TransportMode, number> = {
  walk:  4.5,
  keke:  18,
  okada: 25,
  danfo: 14,
  brt:   20,
  rail:  60,
  uber:  35,
  bolt:  35,
};

// Fare bands, April 2026 (wakaway/Routes Data Research.md). BRT and rail
// bands bracket the LAMATA table of 2 Mar 2026; a per-route lookup is the
// next step. Danfo is what riders report, not an official figure.
function calcPrice(distKm: number, mode: TransportMode): { min: number; max: number } {
  switch (mode) {
    case 'walk':  return { min: 0, max: 0 };

    case 'keke':
      if (distKm < 1)  return { min: 200, max: 300 };
      if (distKm <= 3) return { min: 300, max: 500 };
      return              { min: 500, max: 800 };

    case 'okada':
      if (distKm < 0.5)  return { min: 200, max: 300 };
      if (distKm <= 1.5) return { min: 300, max: 500 };
      if (distKm <= 3)   return { min: 500, max: 800 };
      return                { min: 800, max: 1200 };

    case 'danfo':
      if (distKm <= 3)  return { min: 200, max: 300 };
      if (distKm <= 8)  return { min: 300, max: 500 };
      if (distKm <= 15) return { min: 400, max: 600 };
      return               { min: 500, max: 800 };

    case 'brt':
      if (distKm <= 5)  return { min: 450, max: 570 };
      if (distKm <= 15) return { min: 570, max: 680 };
      return               { min: 680, max: 1080 };

    case 'rail':
      if (distKm <= 5)  return { min: 200, max: 500 };
      if (distKm <= 15) return { min: 500, max: 1000 };
      return               { min: 1000, max: 1500 };

    case 'uber':
    case 'bolt':
      return distKm <= 5
        ? { min: 2500, max: 4000 }
        : { min: 4000, max: 8000 };

    default:
      return { min: 0, max: 0 };
  }
}

export function formatPrice(min: number, max: number): string {
  if (min === 0 && max === 0) return 'Free';
  if (min === max) return `₦${min.toLocaleString()}`;
  return `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
}

function modeIcon(mode: TransportMode): string {
  const map: Record<TransportMode, string> = {
    walk:  'walk-outline',
    keke:  'car-outline',
    okada: 'bicycle-outline',
    danfo: 'bus-outline',
    brt:   'bus',
    rail:  'train-outline',
    uber:  'car-sport-outline',
    bolt:  'car-sport-outline',
  };
  return map[mode];
}

// ─────────────────────────────────────────────────────────────
// INFRASTRUCTURE DATA  (imported from centralised data file)
// ─────────────────────────────────────────────────────────────

import { Stop } from '../data/lagosStops';
import { GRAPH_STOPS, GraphStop } from '../data/lagosRoutes';
import { isKekeRestricted, isOkadaBanned } from './lagosZones';
import { searchGraph, corridorFare, redLineRunningAt, GraphLeg, GraphPath } from './routeGraph';

// The graph's stops double as the "nearest stop" pool: they are the ones
// whose coordinates were checked, and the ones a bus actually serves.
const ALL_STOPS: Stop[] = GRAPH_STOPS.map((g) => ({ name: g.name, latitude: g.latitude, longitude: g.longitude }));

// ─────────────────────────────────────────────────────────────
// STOP SEARCH HELPERS
// ─────────────────────────────────────────────────────────────

function nearestStop(lat: number, lng: number, pool: Stop[], excludeNames: string[] = []): Stop | null {
  let best: Stop | null = null;
  let bestDist = Infinity;
  for (const s of pool) {
    if (excludeNames.includes(s.name)) continue;
    const d = calculateDistance(lat, lng, s.latitude, s.longitude);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

export function findNearestBusStop(lat: number, lng: number): Stop | null {
  return nearestStop(lat, lng, ALL_STOPS);
}

// ─────────────────────────────────────────────────────────────
// LEG BUILDER
// ─────────────────────────────────────────────────────────────

function buildLeg(mode: TransportMode, from: Location, to: Location, mayBeUnavailable?: boolean): RouteLeg {
  const distanceKm = Math.round(
    calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude) * 100
  ) / 100;
  const durationMins = Math.max(1, Math.ceil((distanceKm / SPEEDS[mode]) * 60));
  const price = calcPrice(distanceKm, mode);

  const instruction = lagosInstruction(mode, from.name, to.name);
  const localInstruction = lagosPidginInstruction(mode, from.name, to.name);

  return {
    id: uid(),
    mode,
    from,
    to,
    distanceKm,
    durationMins,
    priceMin: price.min,
    priceMax: price.max,
    instruction,
    localInstruction,
    icon: modeIcon(mode),
    ...(mayBeUnavailable ? { mayBeUnavailable: true } : {}),
  };
}

function lagosInstruction(mode: TransportMode, from: string, to: string): string {
  switch (mode) {
    case 'walk':  return `Walk to ${to}`;
    case 'keke':  return `At ${from}, enter a keke going to ${to}.`;
    case 'okada': return `At ${from}, take an okada to ${to}.`;
    case 'danfo': return `At ${from}, ask for any bus going to ${to}.`;
    case 'brt':   return `Enter BRT at ${from}, alight at ${to}`;
    case 'rail':  return `Board train at ${from} station, alight at ${to}`;
    case 'uber':
    case 'bolt':  return `Take ${mode === 'uber' ? 'Uber' : 'Bolt'} from ${from} to ${to}`;
    default:      return `Travel from ${from} to ${to}`;
  }
}

function lagosPidginInstruction(mode: TransportMode, from: string, to: string): string {
  switch (mode) {
    case 'walk':  return `Waka go ${to}`;
    case 'keke':  return `For ${from}, enter keke wey dey go ${to}, tell am make e drop you there`;
    case 'okada': return `For ${from}, carry okada go ${to}`;
    case 'danfo': return `For ${from}, ask for any bus wey dey go ${to} side`;
    case 'brt':   return `Enter BRT for ${from} busstop, come down for ${to}`;
    case 'rail':  return `Enter train for ${from} station, come down for ${to}`;
    case 'uber':
    case 'bolt':  return `Call ${mode === 'uber' ? 'Uber' : 'Bolt'} from ${from} go ${to}`;
    default:      return `Travel from ${from} to ${to}`;
  }
}

// ─────────────────────────────────────────────────────────────
// TRIP CLASSIFICATION
// Gates which route builders run based on straight-line distance.
// Prevents a 1.5km trip from attempting Rail/BRT lookups.
// ─────────────────────────────────────────────────────────────

export type TripBand = 'micro' | 'short' | 'medium' | 'long';

export function classifyTrip(distKm: number): TripBand {
  if (distKm < 2)  return 'micro';   // Walk / Keke — around the area
  if (distKm < 8)  return 'short';   // Keke / Danfo local
  if (distKm < 25) return 'medium';  // Danfo hubs + BRT corridor
  return 'long';                      // All modes: Rail, BRT, Ferry, Danfo
}

// Human-readable label shown in the UI
export const TRIP_BAND_LABEL: Record<TripBand, string> = {
  micro:  'Short walk nearby',
  short:  'Local trip',
  medium: 'Cross-area trip',
  long:   'Long-distance trip',
};

// ─────────────────────────────────────────────────────────────
// CONNECTOR MODE SELECTION — decisions/0011
// First/last mile: walk, keke, okada, or a short bus hop. Legality
// comes from the LGA polygons; the mode from distance within what is
// legal. Rider preference never overrides legality.
// ─────────────────────────────────────────────────────────────

const WALK_MAX          = 1.0;  // ≈ 13 min — Lagosians walk this to a stop
const WALK_MAX_NO_KEKE  = 1.2;  // stretch when keke is restricted
const KEKE_LAST_MILE    = 1.5;  // inner-street keke inside a restricted LGA
const KEKE_MAX          = 4.0;
const OKADA_MAX         = 6.0;

interface ConnectorChoice { mode: TransportMode; mayBeUnavailable?: boolean }

function connectorMode(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  distKm: number,
  preferred?: TransportMode
): ConnectorChoice {
  if (distKm <= WALK_MAX) return { mode: 'walk' };

  const hop = { fromLat, fromLng, toLat, toLng };
  const kekeOk  = !isKekeRestricted(hop);
  const okadaOk = !isOkadaBanned(hop);

  // Okada only when asked for, and only where it is not impounded on sight.
  if (preferred === 'okada' && okadaOk && distKm <= OKADA_MAX) return { mode: 'okada' };

  if (kekeOk && distKm <= KEKE_MAX) return { mode: 'keke' };

  if (!kekeOk) {
    if (distKm <= WALK_MAX_NO_KEKE) return { mode: 'walk' };
    if (distKm <= KEKE_LAST_MILE)   return { mode: 'keke', mayBeUnavailable: true };
  }

  // Too far to walk, keke unavailable or too far: a bus hop — but between
  // two arbitrary points there may be no bus that does exactly this, so it
  // is flagged, and a corridor route will always be preferred over it.
  return { mode: 'danfo', mayBeUnavailable: true };
}

/** Build the first/last-mile leg between two points, choosing the mode. */
function buildConnector(from: Location, to: Location, preferred?: TransportMode): RouteLeg {
  const distKm = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  const c = connectorMode(from.latitude, from.longitude, to.latitude, to.longitude, distKm, preferred);
  return buildLeg(c.mode, from, to, c.mayBeUnavailable);
}

// ─────────────────────────────────────────────────────────────
// ROUTE OPTION BUILDERS
// ─────────────────────────────────────────────────────────────

function assembleOption(
  id: string,
  type: 'direct' | 'segmented',
  name: string,
  description: string,
  legs: RouteLeg[],
  tags: string[]
): RouteOption {
  const totalDistanceKm   = Math.round(legs.reduce((s, l) => s + l.distanceKm,   0) * 100) / 100;
  const totalDurationMins = legs.reduce((s, l) => s + l.durationMins, 0);
  const totalPriceMin     = legs.reduce((s, l) => s + l.priceMin,     0);
  const totalPriceMax     = legs.reduce((s, l) => s + l.priceMax,     0);
  return {
    id,
    type,
    name,
    description,
    legs,
    totalDistanceKm,
    totalDurationMins,
    totalPriceMin,
    totalPriceMax,
    priceFormatted: formatPrice(totalPriceMin, totalPriceMax),
    isCheapest: false, isFastest: false, isSimplest: false, isRecommended: false,
    tags: [...tags],
  };
}

const toLocation = (g: GraphStop): Location => ({ latitude: g.latitude, longitude: g.longitude, name: g.name });

/** One bus/rail leg along a corridor: real distance, stop count, table fare. */
function buildCorridorLeg(gl: GraphLeg): RouteLeg {
  const from = toLocation(gl.from), to = toLocation(gl.to);
  const distanceKm = Math.round(gl.distanceKm * 100) / 100;
  const stopsSpanned = gl.via.length + 1;
  const price = corridorFare(gl.corridor, stopsSpanned) ?? calcPrice(distanceKm, gl.mode);
  const leg = buildLeg(gl.mode, from, to);
  const call = conductorCall(gl);
  const vehicle = gl.mode === 'brt' ? 'BRT' : gl.mode === 'rail' ? 'train' : gl.mode === 'keke' ? 'keke' : 'danfo';
  const stopsNote = stopsSpanned > 1 ? ` (${stopsSpanned} stops)` : '';
  // The instruction is what a friend would tell you, not a label: where to
  // stand, which bus to look for, what to tell the conductor.
  const instruction = gl.mode === 'rail'
    ? `At ${from.name}, board the ${gl.corridor.name} toward ${gl.terminal.name}. Get off at ${to.name}${stopsNote}.`
    : gl.mode === 'keke'
      ? `At ${from.name}, enter a keke going to ${to.name}.`
      : `At ${from.name}, enter the ${vehicle} calling "${call}". Tell the conductor you're dropping at ${to.name}${stopsNote}.`;
  const localInstruction = gl.mode === 'rail'
    ? `For ${from.name} station, enter ${gl.corridor.name} wey dey go ${gl.terminal.name}. Come down for ${to.name}.`
    : gl.mode === 'keke'
      ? `For ${from.name}, enter keke wey dey go ${to.name}.`
      : `For ${from.name}, enter ${vehicle} wey dey shout "${call}!". Tell conductor say you go drop for ${to.name}.`;
  return {
    ...leg,
    distanceKm,
    durationMins: Math.max(1, Math.ceil(gl.minutes)),
    priceMin: price.min,
    priceMax: price.max,
    instruction,
    localInstruction,
    corridorName: gl.corridor.name,
    stopsSpanned,
    viaStops: gl.via.map((v) => v.name),
    conductorCall: gl.mode === 'rail' || gl.mode === 'keke' ? undefined : call,
    confidence: gl.corridor.confidence,
  };
}

/** "Oshodi Oshodi" — the corridor's own call for that terminal, else the Lagos default of the name said twice. */
function conductorCall(gl: GraphLeg): string {
  const explicit = gl.corridor.calls?.[gl.terminal.id];
  if (explicit) return explicit;
  const short = gl.terminal.name.replace(/\s*\(.*\)$/, '').replace(/ Garage$| Terminal$| Station$/i, '');
  return `${short} ${short}`;
}

function optionNameFor(path: GraphPath): { name: string; tags: string[] } {
  const modes = new Set(path.legs.map((l) => l.mode));
  if (modes.has('rail')) return { name: path.legs.find((l) => l.mode === 'rail')!.corridor.name, tags: ['Rail', 'Fast'] };
  if (modes.has('brt'))  return { name: 'BRT', tags: ['BRT'] };
  const busChanges = path.legs.filter((l) => l.mode !== 'keke').length - 1;
  const lead = modes.has('danfo') ? 'Danfo' : 'Keke';
  return { name: busChanges <= 0 ? lead : `${lead} · ${busChanges} change${busChanges > 1 ? 's' : ''}`, tags: ['Budget'] };
}

// What a first/last-mile gap costs, by the same rules that will build the
// leg: walking is free of fuss, a keke needs finding, a bus hop needs waiting.
function accessMinutes(pref?: TransportMode) {
  return (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, km: number): number => {
    const c = connectorMode(from.latitude, from.longitude, to.latitude, to.longitude, km, pref);
    const ride = (km / SPEEDS[c.mode]) * 60;
    const fuss = c.mode === 'walk' ? 0 : c.mode === 'danfo' ? 18 : c.mayBeUnavailable ? 12 : 8;
    return ride + fuss;
  };
}

/** Every itinerary the corridor graph can find, as priced options. */
function buildGraphOptions(origin: Location, destination: Location, pref?: TransportMode, at: Date = new Date()): RouteOption[] {
  const paths = searchGraph(origin, destination, { allowTimetabled: redLineRunningAt(at), accessMinutes: accessMinutes(pref), at });
  return paths.map((path) => {
    const legs: RouteLeg[] = [];
    const board = toLocation(path.board), alight = toLocation(path.alight);
    if (path.accessKm >= 0.05) legs.push(buildConnector(origin, board, pref));
    path.legs.forEach((gl, i) => {
      const prev = path.legs[i - 1];
      if (prev && prev.to.id !== gl.from.id) {
        // Alighted at one stop, boarding at the one beside it: say so.
        legs.push(buildLeg('walk', toLocation(prev.to), toLocation(gl.from)));
      }
      legs.push(buildCorridorLeg(gl));
    });
    if (path.egressKm >= 0.05) legs.push(buildConnector(alight, destination, pref));
    const { name, tags } = optionNameFor(path);
    const lowest = path.legs.reduce((c, l) => (l.corridor.confidence === 'likely' ? 'likely' : c), 'local' as string);
    if (lowest === 'likely') tags.push('Unverified');
    const via = path.legs.map((l) => l.to.name);
    return assembleOption(uid(), 'segmented', name, `Via ${[path.board.name, ...via].join(' → ')}`, legs, tags);
  });
}

/**
 * Nothing in the corridor data reaches one end of this trip. Say so, with the
 * nearest known park, rather than draw a line no bus follows.
 */
function buildUnknownRoute(origin: Location, destination: Location, pref?: TransportMode): RouteOption {
  const totalDist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  if (totalDist <= OKADA_MAX) {
    const leg = buildConnector(origin, destination, pref);
    return assembleOption(uid(), 'direct', 'Direct', `${leg.mode === 'walk' ? 'Walk' : 'Ride'} direct`, [leg], ['Short Trip']);
  }
  const leg = buildLeg('danfo', origin, destination, true);
  leg.instruction = `Ask at the nearest park for a bus toward ${destination.name}`;
  leg.localInstruction = `Go the nearest park, ask conductor wey dey go ${destination.name} side`;
  leg.confidence = 'likely';
  return assembleOption(uid(), 'direct', 'Ask at the park', 'No known bus line for this trip yet', [leg], ['Unverified']);
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────

export function calculateSmartRoute(
  originLat: number,
  originLng: number,
  originName: string,
  destLat: number,
  destLng: number,
  destName: string,
  preferences?: SmartRoutePreferences
): SmartRouteResult {
  const origin:      Location = { latitude: originLat, longitude: originLng, name: originName || 'Your Location' };
  const destination: Location = { latitude: destLat,   longitude: destLng,   name: destName   || 'Destination'   };

  const pref = preferences?.preferredFirstLegMode;
  const options: RouteOption[] = [];

  // Pre-compute nearest stop to each endpoint across all stop types.
  // Exposed in the result so the UI can show "Nearest stop: X — 5 min walk".
  const _originStop = nearestStop(originLat, originLng, ALL_STOPS);
  const _destStop   = nearestStop(destLat, destLng, ALL_STOPS);

  const toStopInfo = (stop: Stop | null, fromLat: number, fromLng: number): NearestStopInfo | undefined => {
    if (!stop) return undefined;
    const distanceKm = calculateDistance(fromLat, fromLng, stop.latitude, stop.longitude);
    return { name: stop.name, distanceKm: Math.round(distanceKm * 100) / 100, walkMins: Math.max(1, Math.ceil((distanceKm / SPEEDS.walk) * 60)) };
  };

  const originNearestStop = toStopInfo(_originStop, originLat, originLng);
  const destinationNearestStop = toStopInfo(_destStop, destLat, destLng);

  // Classify the trip so we only run builders that make sense for the distance.
  // A 1.5km trip should never attempt a rail lookup; a 40km trip should always try rail.
  const totalDist = calculateDistance(originLat, originLng, destLat, destLng);
  const tripBand  = classifyTrip(totalDist);

  // Short trips are a walk or one keke where legal (decisions/0011); anything
  // longer rides a corridor. If the network doesn't reach, say so.
  const directLimit = isKekeRestricted({
    fromLat: originLat, fromLng: originLng, toLat: destLat, toLng: destLng,
  }) ? KEKE_LAST_MILE : KEKE_MAX;
  if (totalDist <= directLimit) {
    const leg = buildConnector(origin, destination, pref);
    const label = leg.mode === 'walk' ? 'Walk' : leg.mode === 'okada' ? 'Okada' : leg.mode === 'danfo' ? 'Bus' : 'Keke';
    options.push(assembleOption(uid(), 'direct', 'Direct', `${label} direct`, [leg], ['Short Trip']));
  }
  if (totalDist > WALK_MAX) options.push(...buildGraphOptions(origin, destination, pref, preferences?.departAt ?? new Date()));
  if (options.length === 0) options.push(buildUnknownRoute(origin, destination, pref));

  // Remove near-duplicate routes (same legs count & similar price). Confirmed
  // options go first so a confirmed line is never dropped as a duplicate of
  // a 'likely' one, and an option with an ad-hoc connector never shadows one
  // built entirely from corridors.
  const rank = (o: RouteOption) =>
    (o.tags.includes('Unverified') ? 2 : 0) + (o.legs.some(l => l.mayBeUnavailable) ? 1 : 0);
  options.sort((a, b) => rank(a) - rank(b));
  // Two options are the same choice only if they ride the same kinds of
  // vehicle in the same order. BRT and danfo down the same road at similar
  // time and fare are two real choices, not one.
  const modeSig = (o: RouteOption) => o.legs.filter(l => l.mode !== 'walk').map(l => l.mode).join('>');
  const deduped: RouteOption[] = [];
  for (const opt of options) {
    const isDup = deduped.some(
      d =>
        modeSig(d) === modeSig(opt) &&
        d.legs.length === opt.legs.length &&
        Math.abs(d.totalPriceMin - opt.totalPriceMin) < 100 &&
        Math.abs(d.totalDurationMins - opt.totalDurationMins) < 5
    );
    if (!isDup) deduped.push(opt);
  }

  // Limit to 3 most useful options
  const finalOptions = deduped.slice(0, 3);

  // Tag cheapest and fastest
  const cheapest = finalOptions.reduce((a, b) => a.totalPriceMax < b.totalPriceMax ? a : b);
  const fastest  = finalOptions.reduce((a, b) => a.totalDurationMins < b.totalDurationMins ? a : b);

  for (const opt of finalOptions) {
    opt.isCheapest = opt.id === cheapest.id;
    opt.isFastest  = opt.id === fastest.id;
    if (opt.isCheapest) opt.tags.push('Cheapest');
    if (opt.isFastest && opt.id !== cheapest.id) opt.tags.push('Fastest');
  }
  // Simplest = fewest vehicle changes, when that is a different option from
  // the fastest and cheapest (otherwise the label adds nothing).
  const rides = (o: RouteOption) => o.legs.filter(l => l.mode !== 'walk').length;
  const simplest = finalOptions.reduce((a, b) => rides(a) <= rides(b) ? a : b);
  if (finalOptions.length > 1 && simplest.id !== cheapest.id && simplest.id !== fastest.id) {
    simplest.isSimplest = true;
    simplest.tags.push('Simplest');
  }

  // ── Incident avoidance reranking ──────────────────────────────────────
  // If the caller supplied avoidPoints (from community incident reports),
  // demote options whose legs pass through those regions.
  const avoidPoints = preferences?.avoidPoints ?? [];
  const affectedByIncident = new Set<string>();

  if (avoidPoints.length > 0) {
    for (const opt of finalOptions) {
      const hit = opt.legs.some((leg) =>
        avoidPoints.some((ap) => {
          const distFrom = calculateDistance(leg.from.latitude, leg.from.longitude, ap.latitude, ap.longitude);
          const distTo   = calculateDistance(leg.to.latitude,   leg.to.longitude,   ap.latitude, ap.longitude);
          // Point-to-segment approximation: check endpoints + midpoint
          const midLat = (leg.from.latitude  + leg.to.latitude)  / 2;
          const midLng = (leg.from.longitude + leg.to.longitude) / 2;
          const distMid = calculateDistance(midLat, midLng, ap.latitude, ap.longitude);
          return Math.min(distFrom, distTo, distMid) <= ap.radiusKm;
        })
      );
      if (hit) affectedByIncident.add(opt.id);
    }
  }

  // Pick recommended: unaffected and verified first; among those, the fastest
  // unless a cheaper one is within 10 min of it (Lagosians trade minutes for naira).
  // Confirmed corridors beat an ad-hoc connector, which beats an unconfirmed line.
  const solid = (o: RouteOption) => !o.tags.includes('Unverified') && !o.legs.some(l => l.mayBeUnavailable);
  const confirmed = (o: RouteOption) => !o.tags.includes('Unverified');
  const clean = finalOptions.filter(o => !affectedByIncident.has(o.id) && solid(o));
  const pool = clean.length ? clean
    : finalOptions.filter(solid).length ? finalOptions.filter(solid)
    : finalOptions.filter(confirmed).length ? finalOptions.filter(confirmed)
    : finalOptions;
  const fastestIn = pool.reduce((a, b) => a.totalDurationMins <= b.totalDurationMins ? a : b);
  const cheapestIn = pool.reduce((a, b) => a.totalPriceMax <= b.totalPriceMax ? a : b);
  let recommended = (cheapestIn !== fastestIn && cheapestIn.totalDurationMins - fastestIn.totalDurationMins <= 10
    && cheapestIn.totalPriceMax < fastestIn.totalPriceMax) ? cheapestIn : fastestIn;
  // A BRT or train within 10 min and ₦150 of the pick is the steadier ride —
  // no conductor haggling, no "one chance", a queue instead of a scramble.
  const formal = pool.find(o => o.legs.some(l => l.mode === 'brt' || l.mode === 'rail')
    && o.totalDurationMins - recommended.totalDurationMins <= 10
    && o.totalPriceMax - recommended.totalPriceMax <= 150);
  if (formal && !recommended.legs.some(l => l.mode === 'brt' || l.mode === 'rail')) recommended = formal;

  recommended.isRecommended = true;
  recommended.recommendationReason = affectedByIncident.has(recommended.id)
    ? pickRecommendationReason(recommended)
    : affectedByIncident.size > 0
      ? 'Avoids reported incidents on your route'
      : pickRecommendationReason(recommended);

  if (affectedByIncident.size > 0 && !affectedByIncident.has(recommended.id)) {
    if (!recommended.tags.includes('Incident-free')) recommended.tags.push('Incident-free');
  }

  // Sort: recommended first, then clean options, then by price
  finalOptions.sort((a, b) => {
    if (a.isRecommended) return -1;
    if (b.isRecommended) return 1;
    const aAffected = affectedByIncident.has(a.id) ? 1 : 0;
    const bAffected = affectedByIncident.has(b.id) ? 1 : 0;
    if (aAffected !== bAffected) return aAffected - bAffected;
    return a.totalPriceMin - b.totalPriceMin;
  });

  const priceDiff  = finalOptions.length > 1 ? Math.abs(finalOptions[0].totalPriceMax - finalOptions[1].totalPriceMax) : 0;
  const pricePct   = finalOptions.length > 1 && finalOptions[1].totalPriceMax > 0
    ? Math.round((priceDiff / finalOptions[1].totalPriceMax) * 100) : 0;
  const timeDiff   = finalOptions.length > 1 ? Math.abs(finalOptions[0].totalDurationMins - finalOptions[1].totalDurationMins) : 0;
  const shouldChoose = pricePct <= 15 && finalOptions.length > 1;

  return {
    origin,
    destination,
    tripBand,
    originNearestStop,
    destinationNearestStop,
    options: finalOptions,
    recommendedOptionId: recommended.id,
    comparison: {
      priceDifference:        priceDiff,
      priceDifferencePercent: pricePct,
      timeDifference:         timeDiff,
      shouldLetUserChoose:    shouldChoose,
      comparisonText: shouldChoose
        ? `Similar price (${pricePct}% difference). Pick what suits you!`
        : (recommended.recommendationReason ?? ''),
    },
    computedAt: new Date().toISOString(),
  };
}

function pickRecommendationReason(opt: RouteOption): string {
  if (opt.tags.includes('Rail')) return 'The train skips the traffic entirely';
  if (opt.tags.includes('BRT'))  return 'BRT runs on its own lane — steadier in traffic';
  if (opt.isFastest && opt.isCheapest) return 'Fastest and cheapest for this trip';
  if (opt.isFastest)             return 'Quickest route for this trip';
  if (opt.isCheapest)            return 'Cheapest, and only a few minutes longer';
  return 'Best balance of speed and cost for Lagos';
}
