/**
 * WakaWay Smart Routing Service
 *
 * Lagos multimodal routing over real corridors (data/lagosRoutes.ts):
 *   - BRT: Ikorodu – TBS and Oshodi – Abule-Egba (LAMATA)
 *   - Rail: Blue Line Mile 2 – Marina; Red Line Agbado – Oyingbo (timetabled)
 *   - LAMATA standard routes and ~40 danfo corridors, each an ordered list of real stops
 *   - Walk / keke / okada for first and last mile (decisions/0011)
 *
 * A bus leg can only exist along a corridor; the engine no longer draws a
 * "danfo" between two hubs no bus connects. Trips the network doesn't reach
 * get an honest "ask at the park" option instead of an invented line.
 *
 * Every leg carries what a friend would add to the map: the conductor's
 * call, the stops you'll hear on the way, where to stand, and how sure we
 * are of the fare. Every option says how hard the journey is.
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

/** Where a fare figure comes from — shown to the rider, never hidden. */
export type FareSource = 'table' | 'band' | 'free';

export interface RouteLeg {
  id: string;
  mode: TransportMode;
  from: Location;
  to: Location;
  distanceKm: number;
  durationMins: number;
  priceMin: number;
  priceMax: number;
  /** 'table' = LAMATA published fare; 'band' = rider-reported range for the distance. */
  fareSource: FareSource;
  instruction: string;
  localInstruction: string;
  icon: string;
  /** Keke inside a restricted LGA: inner streets only, may not be there. */
  mayBeUnavailable?: boolean;
  /** For bus/rail legs: the corridor ridden and how many stops it spans. */
  corridorId?: string;
  corridorName?: string;
  stopsSpanned?: number;
  /** Intermediate stop names, in order, for "via …" captions. */
  viaStops?: string[];
  /** What the conductor shouts for this bus — "Oshodi Oshodi!" (danfo only). */
  conductorCall?: string;
  /** Where the vehicle is heading — what to look for on the windscreen / ask for. */
  terminalName?: string;
  confidence?: 'verified' | 'local' | 'likely';
  /** Corridor stop ids at each end, for structured reports. */
  fromStopId?: string;
  toStopId?: string;
  /** Local knowledge, when the data has it. */
  landmark?: string;         // what the boarding place looks like
  boardAt?: string;          // where to stand for this direction
  alightLandmark?: string;   // what the get-down place looks like
}

export type Complexity = 'easy' | 'moderate' | 'complex';

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
  /** Vehicle changes: rides minus one, never below zero. */
  transfers: number;
  /** Minutes waiting to board, already inside totalDurationMins. */
  waitMins?: number;
  walkMins: number;
  walkKm: number;
  complexity: Complexity;
  /** Why it is rated that way, in the rider's words: "1 change of vehicle", "14 min walking". */
  complexityReasons: string[];
  isCheapest: boolean;
  isFastest: boolean;
  /** Fewest vehicle changes (then least walking) among the options. */
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
  /** 'okada' = the rider prefers okada for the first/last mile wherever it is legal. */
  preferredFirstLegMode?: TransportMode;
  /**
   * When an okada may be suggested, always only where it is legal.
   * 'when-needed' (default): when walking is too far and no keke can do the
   * hop — otherwise the answer is a guessed bus. 'prefer': wherever legal.
   * 'never': not at all.
   */
  okada?: OkadaPolicy;
  /** Live community reports to route around (security, danger zones, closures). */
  avoidPoints?: AvoidPoint[];
  /**
   * "New to this area": trade a few minutes and a little money for fewer
   * changes of vehicle. The recommendation moves, the options do not.
   */
  newcomer?: boolean;
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

// km/h, in-traffic averages for first/last-mile legs. Corridor legs take
// their minutes from the graph (routeGraph.SPEED), which knows about the
// BRT lane and the time of day.
const SPEEDS: Record<TransportMode, number> = {
  walk:  4.5,
  keke:  18,
  okada: 25,
  danfo: 14,
  brt:   20,
  rail:  60,
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
      if (distKm <= 25) return { min: 600, max: 900 };
      // Past the longest banded hop the table used to go flat, so the 70 km
      // Ajah → Epe run was quoted ₦800 — about a third of what it costs. The
      // rate below settles at roughly ₦18–28/km, which is where the long
      // inter-town runs sit. Extrapolated, not observed: riders should
      // correct it, and fareSource stays 'band' so the app says so.
      return {
        min: Math.round((300 + distKm * 18) / 50) * 50,
        max: Math.round((400 + distKm * 28) / 50) * 50,
      };

    case 'brt':
      if (distKm <= 5)  return { min: 450, max: 570 };
      if (distKm <= 15) return { min: 570, max: 680 };
      return               { min: 680, max: 1080 };

    case 'rail':
      if (distKm <= 5)  return { min: 200, max: 500 };
      if (distKm <= 15) return { min: 500, max: 1000 };
      return               { min: 1000, max: 1500 };

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
  };
  return map[mode];
}

/** The word a Lagosian uses for the vehicle. */
export function vehicleWord(mode: TransportMode): string {
  switch (mode) {
    case 'danfo': return 'danfo';
    case 'brt':   return 'BRT';
    case 'rail':  return 'train';
    case 'keke':  return 'keke';
    case 'okada': return 'okada';
    default:      return 'walk';
  }
}

// ─────────────────────────────────────────────────────────────
// INFRASTRUCTURE DATA  (imported from centralised data file)
// ─────────────────────────────────────────────────────────────

import { GRAPH_STOPS, GraphStop } from '../data/lagosRoutes';
import { isKekeRestricted, isOkadaBanned } from './lagosZones';
import { searchGraph, corridorFare, redLineRunningAt, boardingWaitMins, trafficFactor, trafficFor, GraphLeg, GraphPath } from './routeGraph';

interface Stop { name: string; latitude: number; longitude: number }

// The graph's stops double as the "nearest stop" pool: they are the ones
// whose coordinates were checked, and the ones a bus actually serves.
const ALL_STOPS: Stop[] = GRAPH_STOPS.map((g) => ({ name: g.name, latitude: g.latitude, longitude: g.longitude }));

function nearestStop(lat: number, lng: number, pool: Stop[]): Stop | null {
  let best: Stop | null = null;
  let bestDist = Infinity;
  for (const s of pool) {
    const d = calculateDistance(lat, lng, s.latitude, s.longitude);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────
// LEG BUILDER
// ─────────────────────────────────────────────────────────────

// Streets do not run straight: the same 1.25 the corridor graph uses. First-
// and last-mile legs used to be timed and priced as the crow flies, which
// made every keke and every walk about a quarter shorter than the ride.
const CONNECTOR_ROAD_FACTOR = 1.25;

function buildLeg(mode: TransportMode, from: Location, to: Location, mayBeUnavailable?: boolean, traffic = 1): RouteLeg {
  const distanceKm = Math.round(
    calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude) * CONNECTOR_ROAD_FACTOR * 100
  ) / 100;
  const durationMins = Math.max(1, Math.ceil((distanceKm / SPEEDS[mode]) * 60 * trafficFor(mode, traffic)));
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
    fareSource: mode === 'walk' ? 'free' : 'band',
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
    case 'brt':   return `Enter BRT at ${from}, get down at ${to}`;
    case 'rail':  return `Board the train at ${from} station, get down at ${to}`;
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
    default:      return `Travel from ${from} to ${to}`;
  }
}

// ─────────────────────────────────────────────────────────────
// TRIP CLASSIFICATION
// ─────────────────────────────────────────────────────────────

export type TripBand = 'micro' | 'short' | 'medium' | 'long';

export function classifyTrip(distKm: number): TripBand {
  if (distKm < 2)  return 'micro';   // Walk / Keke — around the area
  if (distKm < 8)  return 'short';   // Keke / Danfo local
  if (distKm < 25) return 'medium';  // Danfo hubs + BRT corridor
  return 'long';                      // All modes: Rail, BRT, Ferry, Danfo
}

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

export type OkadaPolicy = 'when-needed' | 'prefer' | 'never';

/** How the rider wants the first and last mile handled. */
interface ConnectorPrefs { preferred?: TransportMode; okada: OkadaPolicy }

function connectorMode(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  distKm: number,
  prefs: ConnectorPrefs = { okada: 'when-needed' }
): ConnectorChoice {
  if (distKm <= WALK_MAX) return { mode: 'walk' };

  const hop = { fromLat, fromLng, toLat, toLng };
  const kekeOk  = !isKekeRestricted(hop);
  const okadaOk = !isOkadaBanned(hop);
  const policy: OkadaPolicy = prefs.preferred === 'okada' ? 'prefer' : prefs.okada;

  // Legality first, always: never an okada where it is impounded on sight.
  if (policy === 'prefer' && okadaOk && distKm <= OKADA_MAX) return { mode: 'okada' };

  if (kekeOk && distKm <= KEKE_MAX) return { mode: 'keke' };

  if (!kekeOk && distKm <= WALK_MAX_NO_KEKE) return { mode: 'walk' };

  // Okada when it is needed: too far to walk and no keke for this hop (it is
  // restricted here, or the gap is past a keke's range). The only other
  // answer is guessing that some bus covers it. This used to require the
  // rider to have switched okada on, so outside the ban zones the app sent
  // people to look for a bus that may not exist, or nothing but danfo.
  if (policy !== 'never' && okadaOk && distKm <= OKADA_MAX) return { mode: 'okada' };

  if (!kekeOk && distKm <= KEKE_LAST_MILE) return { mode: 'keke', mayBeUnavailable: true };

  // Too far to walk, keke unavailable or too far: a bus hop — but between
  // two arbitrary points there may be no bus that does exactly this, so it
  // is flagged, and a corridor route will always be preferred over it.
  return { mode: 'danfo', mayBeUnavailable: true };
}

/** Build the first/last-mile leg between two points, choosing the mode. */
function buildConnector(from: Location, to: Location, prefs?: ConnectorPrefs, traffic = 1): RouteLeg {
  const distKm = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
  const c = connectorMode(from.latitude, from.longitude, to.latitude, to.longitude, distKm, prefs);
  return buildLeg(c.mode, from, to, c.mayBeUnavailable, traffic);
}

// ─────────────────────────────────────────────────────────────
// ROUTE OPTION BUILDERS
// ─────────────────────────────────────────────────────────────

const isRide = (l: RouteLeg) => l.mode !== 'walk';

/**
 * How hard this journey is for someone who has never made it. A green
 * journey is one vehicle and a short walk; red is anything with two
 * changes, a long walk, or a line we have not confirmed.
 */
function rateComplexity(legs: RouteLeg[], tags: string[]): { complexity: Complexity; reasons: string[] } {
  const rides = legs.filter(isRide);
  const transfers = Math.max(0, rides.length - 1);
  const walkMins = legs.filter((l) => l.mode === 'walk').reduce((m, l) => m + l.durationMins, 0);
  const unconfirmed = tags.includes('Unverified') || legs.some((l) => l.confidence === 'likely');
  const shaky = legs.some((l) => l.mayBeUnavailable);
  const reasons: string[] = [];

  if (rides.length === 1) reasons.push('One vehicle, no changes');
  if (transfers === 1) reasons.push('1 change of vehicle');
  if (transfers >= 2) reasons.push(`${transfers} changes of vehicle`);
  if (walkMins >= 8) reasons.push(`${walkMins} min walking`);
  if (unconfirmed) reasons.push('A line we never confirm');
  if (shaky) reasons.push(legs.some((l) => l.mayBeUnavailable && l.mode === 'keke') ? 'Keke may not be there' : 'No fixed bus for one hop');
  if (rides.length === 0) reasons.push('Just a walk');

  let complexity: Complexity = 'moderate';
  if (transfers >= 2 || walkMins > 25 || unconfirmed || shaky) complexity = 'complex';
  else if (transfers === 0 && walkMins <= 12) complexity = 'easy';
  return { complexity, reasons };
}

function assembleOption(
  id: string,
  type: 'direct' | 'segmented',
  name: string,
  description: string,
  legs: RouteLeg[],
  tags: string[]
): RouteOption {
  const totalDistanceKm   = Math.round(legs.reduce((s, l) => s + l.distanceKm,   0) * 100) / 100;
  // Door-to-door means the waiting too. Summing ride minutes alone told a
  // rider "4 min" for a BRT hop they would queue ten minutes to board, and
  // made a three-vehicle trip look better than it is: each vehicle is a wait.
  const waitMins = legs.filter(isRide).reduce((m, l, i) => m + boardingWaitMins(l.mode, i === 0), 0);
  const totalDurationMins = legs.reduce((s, l) => s + l.durationMins, 0) + waitMins;
  const totalPriceMin     = legs.reduce((s, l) => s + l.priceMin,     0);
  const totalPriceMax     = legs.reduce((s, l) => s + l.priceMax,     0);
  const walkLegs          = legs.filter((l) => l.mode === 'walk');
  const { complexity, reasons } = rateComplexity(legs, tags);
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
    transfers: Math.max(0, legs.filter(isRide).length - 1),
    waitMins,
    walkMins: walkLegs.reduce((m, l) => m + l.durationMins, 0),
    walkKm: Math.round(walkLegs.reduce((m, l) => m + l.distanceKm, 0) * 100) / 100,
    complexity,
    complexityReasons: reasons,
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
  const table = corridorFare(gl.corridor, stopsSpanned);
  const price = table ?? calcPrice(distanceKm, gl.mode);
  const leg = buildLeg(gl.mode, from, to);
  const call = conductorCall(gl);
  const vehicle = vehicleWord(gl.mode);
  const stopsNote = stopsSpanned > 1 ? ` (${stopsSpanned} stops)` : '';
  // The instruction is what a friend would tell you, not a label: where to
  // stand, which bus to look for, what to tell the conductor. BRT is a
  // ticketed queue, not a scramble — nobody shouts, you join the line.
  let instruction: string;
  let localInstruction: string;
  switch (gl.mode) {
    case 'rail':
      instruction = `At ${from.name} station, board the ${gl.corridor.name} toward ${gl.terminal.name}. Get down at ${to.name}${stopsNote}.`;
      localInstruction = `For ${from.name} station, enter ${gl.corridor.name} wey dey go ${gl.terminal.name}. Come down for ${to.name}.`;
      break;
    case 'brt':
      instruction = `At ${from.name}, join the BRT queue for buses toward ${gl.terminal.name}. Get down at ${to.name}${stopsNote}.`;
      localInstruction = `For ${from.name}, enter the BRT queue wey dey go ${gl.terminal.name}. Come down for ${to.name}.`;
      break;
    case 'keke':
      instruction = `At ${from.name}, enter a keke going to ${to.name}.`;
      localInstruction = `For ${from.name}, enter keke wey dey go ${to.name}.`;
      break;
    default:
      instruction = `At ${from.name}, enter the ${vehicle} calling "${call}". Tell the conductor you're dropping at ${to.name}${stopsNote}.`;
      localInstruction = `For ${from.name}, enter ${vehicle} wey dey shout "${call}!". Tell conductor say you go drop for ${to.name}.`;
  }
  const boardAt = gl.from.boardAt?.[gl.terminal.id] ?? gl.from.boardAt?.[gl.to.id] ?? gl.from.boardAt?.['*'];
  return {
    ...leg,
    distanceKm,
    durationMins: Math.max(1, Math.ceil(gl.minutes)),
    priceMin: price.min,
    priceMax: price.max,
    fareSource: table ? 'table' : 'band',
    instruction,
    localInstruction,
    corridorId: gl.corridor.id,
    corridorName: gl.corridor.name,
    stopsSpanned,
    viaStops: gl.via.map((v) => v.name),
    conductorCall: gl.mode === 'danfo' ? call : undefined,
    terminalName: gl.terminal.name,
    confidence: gl.corridor.confidence,
    fromStopId: gl.from.id,
    toStopId: gl.to.id,
    ...(gl.from.landmark ? { landmark: gl.from.landmark } : {}),
    ...(boardAt ? { boardAt } : {}),
    ...(gl.to.landmark ? { alightLandmark: gl.to.landmark } : {}),
  };
}

/**
 * "Oshodi Oshodi" — the corridor's own call for that terminal, else the
 * Lagos default of a name said twice. On a long line the conductor calls
 * the big park the bus passes through as much as the far end, so when the
 * rider gets down at an interchange that is the call to listen for.
 */
function conductorCall(gl: GraphLeg): string {
  const explicit = gl.corridor.calls?.[gl.terminal.id];
  if (explicit) return explicit;
  const stop = gl.to.interchange ? gl.to : gl.terminal;
  const short = stop.name.replace(/\s*\(.*\)$/, '').replace(/ Garage$| Terminal$| Station$/i, '');
  return `${short} ${short}`;
}

function optionNameFor(path: GraphPath): { name: string; tags: string[] } {
  const modes = new Set(path.legs.map((l) => l.mode));
  if (modes.has('rail')) return { name: path.legs.find((l) => l.mode === 'rail')!.corridor.name, tags: ['Rail'] };
  if (modes.has('brt'))  return { name: 'BRT', tags: ['BRT'] };
  const busChanges = path.legs.filter((l) => l.mode !== 'keke').length - 1;
  const lead = modes.has('danfo') ? 'Danfo' : 'Keke';
  return { name: busChanges <= 0 ? lead : `${lead} · ${busChanges} change${busChanges > 1 ? 's' : ''}`, tags: ['Budget'] };
}

// What a first/last-mile gap costs, by the same rules that will build the
// leg: walking is free of fuss, a keke needs finding, a bus hop needs waiting.
function accessMinutes(pref?: ConnectorPrefs, traffic = 1) {
  return (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }, km: number): number => {
    const c = connectorMode(from.latitude, from.longitude, to.latitude, to.longitude, km, pref);
    const ride = ((km * CONNECTOR_ROAD_FACTOR) / SPEEDS[c.mode]) * 60 * trafficFor(c.mode, traffic);
    const fuss = c.mode === 'walk' ? 0 : c.mode === 'danfo' ? 18 : c.mayBeUnavailable ? 12 : 8;
    return ride + fuss;
  };
}

/** Every itinerary the corridor graph can find, as priced options. */
function buildGraphOptions(
  origin: Location, destination: Location, pref?: ConnectorPrefs, at: Date = new Date(),
  /** How far a first/last-mile connector may reach, km. An okada goes further than a keke. */
  reachKm?: number,
  /** Widened search only: the first-mile ride may itself be the whole trip. */
  arriveOnFirstMile = false,
): RouteOption[] {
  const traffic = trafficFactor(at);
  const paths = searchGraph(origin, destination, {
    allowTimetabled: redLineRunningAt(at), accessMinutes: accessMinutes(pref, traffic), at,
    ...(reachKm ? { reachKm } : {}),
    arriveOnFirstMile,
  });
  return paths.map((path) => {
    const legs: RouteLeg[] = [];
    const board = toLocation(path.board), alight = toLocation(path.alight);
    if (path.accessKm >= 0.05) legs.push(buildConnector(origin, board, pref, traffic));
    path.legs.forEach((gl, i) => {
      const prev = path.legs[i - 1];
      // Two stops at the same spot (the danfo park and the station beside it)
      // are one place: a "walk 0 m" step only reads as a mistake.
      const apart = prev ? calculateDistance(prev.to.latitude, prev.to.longitude, gl.from.latitude, gl.from.longitude) : 0;
      if (prev && prev.to.id !== gl.from.id && apart >= 0.04) {
        // Alighted at one stop, boarding at the one beside it: say so.
        const walk = buildLeg('walk', toLocation(prev.to), toLocation(gl.from));
        if (gl.from.landmark) walk.alightLandmark = gl.from.landmark;
        legs.push(walk);
      }
      legs.push(buildCorridorLeg(gl));
    });
    if (path.egressKm >= 0.05) legs.push(buildConnector(alight, destination, pref, traffic));
    // A trip that is only the first-mile ride is named for that vehicle.
    const firstMile = legs[0];
    const { name, tags } = path.legs.length
      ? optionNameFor(path)
      : { name: firstMile?.mode === 'okada' ? 'Okada' : firstMile?.mode === 'keke' ? 'Keke' : 'Bus', tags: ['Budget'] };
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
/**
 * A short trip the network does not reach: one keke, okada or walk, which
 * really does go door to door. Anything longer gets no route at all — this
 * used to print one imaginary danfo for the whole trip ("ask at the nearest
 * park for a bus toward Computer Village", 17.7 km, with a fare and a
 * conductor script), which read as a real bus.
 */
function buildUnknownRoute(origin: Location, destination: Location, pref?: ConnectorPrefs): RouteOption | null {
  const totalDist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);
  if (totalDist > OKADA_MAX) return null;
  const leg = buildConnector(origin, destination, pref);
  return assembleOption(uid(), 'direct', 'Direct', `${leg.mode === 'walk' ? 'Walk' : 'Ride'} direct`, [leg], ['Short Trip']);
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

  const pref: ConnectorPrefs = {
    preferred: preferences?.preferredFirstLegMode,
    okada: preferences?.okada ?? 'when-needed',
  };
  const options: RouteOption[] = [];

  // Nearest stop to each endpoint, exposed so the UI can say "Nearest stop: X — 5 min walk".
  const toStopInfo = (stop: Stop | null, fromLat: number, fromLng: number): NearestStopInfo | undefined => {
    if (!stop) return undefined;
    const distanceKm = calculateDistance(fromLat, fromLng, stop.latitude, stop.longitude);
    return { name: stop.name, distanceKm: Math.round(distanceKm * 100) / 100, walkMins: Math.max(1, Math.ceil((distanceKm / SPEEDS.walk) * 60)) };
  };
  const originNearestStop = toStopInfo(nearestStop(originLat, originLng, ALL_STOPS), originLat, originLng);
  const destinationNearestStop = toStopInfo(nearestStop(destLat, destLng, ALL_STOPS), destLat, destLng);

  const totalDist = calculateDistance(originLat, originLng, destLat, destLng);
  const tripBand  = classifyTrip(totalDist);

  // Short trips are a walk or one keke where legal (decisions/0011); anything
  // longer rides a corridor. If the network doesn't reach, say so.
  // A short trip can also be one okada where keke cannot go but okada may;
  // it is offered as an option and the ranking decides whether it leads.
  const tripHop = { fromLat: originLat, fromLng: originLng, toLat: destLat, toLng: destLng };
  const directLimit = !isKekeRestricted(tripHop) ? KEKE_MAX
    : pref.okada !== 'never' && !isOkadaBanned(tripHop) ? OKADA_MAX
    : KEKE_LAST_MILE;
  if (totalDist <= directLimit) {
    const leg = buildConnector(origin, destination, pref, trafficFactor(preferences?.departAt ?? new Date()));
    const label = leg.mode === 'walk' ? 'Walk' : leg.mode === 'okada' ? 'Okada' : leg.mode === 'danfo' ? 'Bus' : 'Keke';
    // Named for the vehicle, so "keke all the way" reads as a choice beside the bus.
    const name = label === 'Walk' ? 'Walk it' : `${label} all the way`;
    options.push(assembleOption(uid(), 'direct', name, `${label} direct`, [leg], ['Short Trip']));
  }
  if (totalDist > WALK_MAX) {
    const at = preferences?.departAt ?? new Date();
    let graph = buildGraphOptions(origin, destination, pref, at);
    // Off the network at one end: reach further before giving up. The first
    // or last mile becomes a keke, okada or bus hop to the nearest stop we
    // actually know — a short, named guess — and the rest rides real lines.
    // About half of Lagos is more than 3 km from any stop we have, and every
    // such trip used to get one invented bus for the whole journey.
    for (const reach of [6, 10]) {
      if (graph.length) break;
      graph = buildGraphOptions(origin, destination, pref, at, reach, true);
      for (const o of graph) o.tags.push('Far from known stops');
    }
    options.push(...graph);
  }
  if (options.length === 0) {
    const short = buildUnknownRoute(origin, destination, pref);
    if (short) options.push(short);
  }
  // Nothing connects: say so. An empty answer reaches the rider as "we no
  // sabi this road yet", which is true; a made-up bus is not.
  if (options.length === 0) {
    return {
      origin, destination, tripBand, originNearestStop, destinationNearestStop,
      options: [], recommendedOptionId: '',
      comparison: { priceDifference: 0, priceDifferencePercent: 0, timeDifference: 0, shouldLetUserChoose: false, comparisonText: '' },
      computedAt: new Date().toISOString(),
    };
  }

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
  const modeSig = (o: RouteOption) => o.legs.filter(isRide).map(l => l.mode).join('>');
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

  // The bike, offered where it is legal and worth it. Under Lagos law okada
  // is banned everywhere keke is restricted (and in four more LGAs), so it is
  // never the only way through — but in outer Lagos it beats the go-slow, and
  // a rider should see that choice rather than danfo after danfo. It is an
  // extra option, not a replacement; the ranking below charges it for the
  // risk, so it only leads when it clearly saves time.
  if (pref.okada !== 'never' && pref.preferred !== 'okada' && totalDist > WALK_MAX && finalOptions.length) {
    // An okada's real use is reaching past the slow feeder: up to 6 km to the
    // expressway or the BRT, where a keke would crawl.
    const byOkada = buildGraphOptions(origin, destination, { preferred: 'okada', okada: 'prefer' }, preferences?.departAt ?? new Date(), OKADA_MAX)
      .filter((o) => o.legs.some((l) => l.mode === 'okada'))
      .sort((a, b) => a.totalDurationMins - b.totalDurationMins)[0];
    const fastestSoFar = Math.min(...finalOptions.map((o) => o.totalDurationMins));
    if (byOkada && fastestSoFar - byOkada.totalDurationMins >= 5) {
      byOkada.name = 'Faster by okada';
      byOkada.tags.push('Okada');
      finalOptions.push(byOkada);
    }
  }

  // Roles. Every option gets its true flags; an option can be all three.
  // Simplest = fewest vehicles, then least walking, then quickest.
  const cheapest = finalOptions.reduce((a, b) => b.totalPriceMax < a.totalPriceMax ? b : a);
  const fastest  = finalOptions.reduce((a, b) => b.totalDurationMins < a.totalDurationMins ? b : a);
  const simplest = finalOptions.reduce((a, b) => {
    if (b.transfers !== a.transfers) return b.transfers < a.transfers ? b : a;
    if (b.walkMins !== a.walkMins)   return b.walkMins < a.walkMins ? b : a;
    return b.totalDurationMins < a.totalDurationMins ? b : a;
  });
  for (const opt of finalOptions) {
    opt.isCheapest = opt.id === cheapest.id;
    opt.isFastest  = opt.id === fastest.id;
    opt.isSimplest = opt.id === simplest.id;
    if (opt.isCheapest) opt.tags.push('Cheapest');
    if (opt.isFastest && !opt.isCheapest) opt.tags.push('Fastest');
    if (opt.isSimplest && finalOptions.length > 1 && !opt.isCheapest && !opt.isFastest) opt.tags.push('Simplest');
  }

  // ── Incident avoidance reranking ──────────────────────────────────────
  // Live community reports the caller wants avoided (security, closures):
  // demote options whose legs pass through those regions.
  const avoidPoints = preferences?.avoidPoints ?? [];
  const affectedByIncident = new Set<string>();

  if (avoidPoints.length > 0) {
    for (const opt of finalOptions) {
      const hit = opt.legs.some((leg) =>
        avoidPoints.some((ap) => {
          const distFrom = calculateDistance(leg.from.latitude, leg.from.longitude, ap.latitude, ap.longitude);
          const distTo   = calculateDistance(leg.to.latitude,   leg.to.longitude,   ap.latitude, ap.longitude);
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
  // Doubt is a cost, not a veto.
  //
  // This used to filter the candidates down to the "solid" ones — nothing
  // unverified, no keke that might not be there — and recommend the fastest
  // of whatever survived. One possibly-absent last-mile keke could therefore
  // bury a route that was 82 minutes faster and ₦1,060 cheaper, which is how
  // the app came to recommend plainly worse journeys on 8.5% of sampled trips.
  //
  // Instead every option is scored in one currency, equivalent minutes, the
  // way the graph search now scores edges: time, plus fare at the rate a
  // Lagos rider actually trades it, plus what each change really costs, plus
  // a penalty for what we are not sure about. The best score wins, so a pick
  // can no longer lose to something that beats it on every axis.
  const MINUTES_PER_NAIRA = 0.05;             // ₦200 ≈ 10 minutes
  // A line we have not confirmed may not be running at all — the Badagry-
  // expressway BRT is 'likely' for exactly that reason — and if it is not,
  // the rider is stranded and has to find another way back. At 25 that line
  // beat the Mile 2 → Oshodi danfos for ₦480 and eight minutes. An hour's
  // worth means doubt only wins when the confirmed way is far worse (it
  // still does for Allen → Epe, 82 minutes and ₦1,060 better).
  const UNVERIFIED_PENALTY = 60;
  const MAYBE_GONE_PENALTY = 12;              // per leg that may not be running
  // A ride leg with no corridor behind it is the engine guessing that some
  // bus covers this gap. A keke or okada will in fact go anywhere, so only a
  // guessed *bus* is charged: it is the least trustworthy thing we can print,
  // below a confirmed corridor and below an unverified line.
  const ADHOC_BUS_PENALTY = 20;
  const INCIDENT_PENALTY = 60;                // reported trouble on the way
  const FORMAL_BONUS = 8;                     // a queue beats a scramble
  // Per okada leg, unless the rider asked for okada: the crash risk, the rain,
  // the fare you settle on the roadside. Enough that it leads only when it
  // genuinely saves time.
  const OKADA_PENALTY = preferences?.preferredFirstLegMode === 'okada' ? 0 : 10;
  // Someone new to the area will spend minutes and naira to change less often.
  const changePenalty = preferences?.newcomer ? 25 : 10;

  const score = (o: RouteOption): number =>
    o.totalDurationMins
    + o.totalPriceMax * MINUTES_PER_NAIRA
    + o.transfers * changePenalty
    + (o.tags.includes('Unverified') ? UNVERIFIED_PENALTY : 0)
    // One doubt per leg: a guessed bus is usually also flagged as maybe-gone,
    // and charging both counted the same uncertainty twice.
    + o.legs.reduce((sum, l) => sum + Math.max(
        l.mayBeUnavailable ? MAYBE_GONE_PENALTY : 0,
        !l.corridorId && (l.mode === 'danfo' || l.mode === 'brt' || l.mode === 'rail') ? ADHOC_BUS_PENALTY : 0,
      ), 0)
    + (affectedByIncident.has(o.id) ? INCIDENT_PENALTY : 0)
    + o.legs.filter((l) => l.mode === 'okada').length * OKADA_PENALTY
    - (o.legs.some((l) => l.mode === 'brt' || l.mode === 'rail') ? FORMAL_BONUS : 0);

  let recommended = finalOptions.reduce((a, b) => (score(b) < score(a) ? b : a));
  let reason: string | undefined;
  if (preferences?.newcomer && recommended.transfers <= 1) {
    reason = recommended.transfers === 0
      ? 'One vehicle, no changes — easiest for a first time'
      : 'Fewer changes — easier for a first time';
  }

  recommended.isRecommended = true;
  recommended.recommendationReason = reason
    ?? (affectedByIncident.size > 0 && !affectedByIncident.has(recommended.id)
      ? 'Avoids reported trouble on the other way'
      : pickRecommendationReason(recommended));

  if (affectedByIncident.size > 0 && !affectedByIncident.has(recommended.id)) {
    if (!recommended.tags.includes('Incident-free')) recommended.tags.push('Incident-free');
  }
  for (const o of finalOptions) if (affectedByIncident.has(o.id) && !o.tags.includes('Reported trouble')) o.tags.push('Reported trouble');

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
  if (opt.transfers === 0 && opt.isFastest) return 'One vehicle and the quickest way';
  if (opt.isFastest && opt.isCheapest) return 'Fastest and cheapest for this trip';
  if (opt.isFastest)             return 'Quickest route for this trip';
  if (opt.isCheapest)            return 'Cheapest, and only a few minutes longer';
  if (opt.transfers === 0)       return 'One vehicle, no changes';
  return 'Best balance of speed and cost for Lagos';
}
