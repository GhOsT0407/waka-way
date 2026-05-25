/**
 * WakaWay Smart Routing Service
 *
 * Accurate Lagos multimodal routing using real infrastructure:
 *   - BRT: Ikorodu ↔ TBS/CMS corridor (Primero Transport)
 *   - Blue Line Rail: Mile 2 ↔ Marina (operational since Sep 2023)
 *   - Red Line Rail: Agbado ↔ Oyingbo (operational since Oct 2024)
 *   - LagFerry waterway routes
 *   - Danfo/Keke/Okada for local and feeder trips
 *
 * Sources: LAMATA, LagFerry, Primero TSL, Wikipedia Lagos Rail Mass Transit
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

const SPEEDS: Record<TransportMode, number> = {
  walk:  4,
  keke:  22,
  okada: 30,
  danfo: 14,
  brt:   28,
  rail:  60,
  uber:  35,
  bolt:  35,
};

// 2025 Lagos transport pricing
function calcPrice(distKm: number, mode: TransportMode): { min: number; max: number } {
  switch (mode) {
    case 'walk':  return { min: 0, max: 0 };

    case 'keke':
      return distKm <= 1.5
        ? { min: 300,  max: 500  }
        : { min: 400,  max: 800  };

    case 'okada':
      return distKm <= 2
        ? { min: 500,  max: 800  }
        : { min: 700,  max: 1500 };

    case 'danfo':
      if (distKm <= 3)  return { min: 200, max: 400 };
      if (distKm <= 8)  return { min: 300, max: 500 };
      if (distKm <= 15) return { min: 400, max: 700 };
      return               { min: 500, max: 900 };

    case 'brt':
      if (distKm <= 5)  return { min: 300, max: 400 };
      if (distKm <= 15) return { min: 400, max: 600 };
      return               { min: 600, max: 800 };

    case 'rail':
      if (distKm <= 5)  return { min: 300, max: 400 };
      if (distKm <= 15) return { min: 400, max: 600 };
      return               { min: 500, max: 700 };

    case 'uber':
    case 'bolt':
      return distKm <= 5
        ? { min: 1500, max: 2500 }
        : { min: 2000, max: 4000 };

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
// OKADA BAN ZONES (Lagos State policy)
// Banned LGAs: Ikeja, Lagos Island, Lagos Mainland, Eti-Osa,
// Apapa, Surulere, Mushin, Oshodi-Isolo, Kosofe, Somolu
// ─────────────────────────────────────────────────────────────

// Polygon-based check: okada banned if point is inside the core metro bbox
// We approximate by banning okada for coordinates within Lagos metro core
function isOkadaBannedLocation(lat: number, lng: number): boolean {
  // Rough bounding box covering all banned LGAs:
  // Lagos Island, Victoria Island, Ikoyi, Lekki, Surulere,
  // Yaba, Mushin, Oshodi, Ikeja, Maryland, Ketu, Ojota, Apapa
  const bannedZones: Array<[number, number, number, number]> = [
    // [minLat, maxLat, minLng, maxLng]
    [6.410, 6.650, 3.280, 3.620], // Core metro (covers all banned LGAs)
  ];
  return bannedZones.some(
    ([minLat, maxLat, minLng, maxLng]) =>
      lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
  );
}

// Okada allowed only in far outskirts: Ikorodu rural, Epe, Badagry, Alimosho rural
function isOkadaAllowed(fromLat: number, fromLng: number, toLat: number, toLng: number): boolean {
  return !isOkadaBannedLocation(fromLat, fromLng) && !isOkadaBannedLocation(toLat, toLng);
}

// ─────────────────────────────────────────────────────────────
// INFRASTRUCTURE DATA  (imported from centralised data file)
// ─────────────────────────────────────────────────────────────

import {
  Stop,
  BRT_IKORODU_STOPS,
  BRT_ABULE_EGBA_STOPS,
  BLUE_LINE_STOPS,
  RED_LINE_STOPS,
  DANFO_HUBS,
  ALL_STOPS,
} from '../data/lagosStops';

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

function stopsAlongCorridor(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  pool: Stop[],
  exclude: string[],
  max: number
): Stop[] {
  const total = calculateDistance(fromLat, fromLng, toLat, toLng);
  return pool
    .filter(s => !exclude.includes(s.name))
    .map(s => {
      const dA = calculateDistance(fromLat, fromLng, s.latitude, s.longitude);
      const dB = calculateDistance(s.latitude, s.longitude, toLat, toLng);
      return { s, dA, dB, ratio: (dA + dB) / total };
    })
    .filter(x => x.ratio < 1.35 && x.dA < total && x.dB < total)
    .sort((a, b) => a.dA - b.dA)
    .slice(0, max)
    .map(x => x.s);
}

// ─────────────────────────────────────────────────────────────
// LEG BUILDER
// ─────────────────────────────────────────────────────────────

function buildLeg(mode: TransportMode, from: Location, to: Location): RouteLeg {
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
  };
}

function lagosInstruction(mode: TransportMode, from: string, to: string): string {
  switch (mode) {
    case 'walk':  return `Walk from ${from} to ${to}`;
    case 'keke':  return `Take Keke NAPEP from ${from} — tell driver "${to}"`;
    case 'okada': return `Board Okada at ${from}, ride to ${to}`;
    case 'danfo': return `Board Danfo at ${from} heading ${to}`;
    case 'brt':   return `Enter BRT at ${from}, alight at ${to}`;
    case 'rail':  return `Board train at ${from} station, alight at ${to}`;
    case 'uber':
    case 'bolt':  return `Take ${mode === 'uber' ? 'Uber' : 'Bolt'} from ${from} to ${to}`;
    default:      return `Travel from ${from} to ${to}`;
  }
}

function lagosPidginInstruction(mode: TransportMode, from: string, to: string): string {
  switch (mode) {
    case 'walk':  return `Waka from ${from} reach ${to}`;
    case 'keke':  return `Enter keke for ${from}, tell am make e drop you ${to}`;
    case 'okada': return `Carry okada from ${from} go ${to}`;
    case 'danfo': return `Enter danfo for ${from} side, tell conductor "${to}!"`;
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
// CONNECTOR MODE SELECTION
// First/last mile mode — walk, keke, okada, or danfo for very long legs
// ─────────────────────────────────────────────────────────────

function connectorMode(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  distKm: number,
  preferred?: TransportMode
): TransportMode {
  if (distKm <= 0.2) return 'walk';

  const okadaOk = isOkadaAllowed(fromLat, fromLng, toLat, toLng);

  if (preferred === 'keke'  && distKm <= 5.0) return 'keke';
  if (preferred === 'okada' && distKm <= 6.0 && okadaOk) return 'okada';

  // Very long feeder legs (> 8km) — use danfo rather than keke for the connector
  if (distKm > 8) return 'danfo';

  if (distKm <= 5.0) return 'keke';
  if (okadaOk && distKm <= 8.0) return 'okada';
  return 'keke';
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
    isCheapest: false, isFastest: false, isRecommended: false,
    tags: [...tags],
  };
}

/** Build a route along a rail line (Blue or Red) */
function buildRailRoute(
  origin: Location,
  destination: Location,
  line: Stop[],
  lineName: string,
  pref?: TransportMode
): RouteOption | null {
  // Find nearest entry/exit stations
  const entryStation = nearestStop(origin.latitude, origin.longitude, line);
  const exitStation  = nearestStop(destination.latitude, destination.longitude, line, entryStation ? [entryStation.name] : []);
  if (!entryStation || !exitStation) return null;
  if (entryStation.name === exitStation.name) return null;

  const walkToEntry = calculateDistance(origin.latitude, origin.longitude, entryStation.latitude, entryStation.longitude);
  const walkFromExit = calculateDistance(exitStation.latitude, exitStation.longitude, destination.latitude, destination.longitude);

  // Only suggest rail if it genuinely helps (not if you need to walk farther than the rail leg)
  const railDist = calculateDistance(entryStation.latitude, entryStation.longitude, exitStation.latitude, exitStation.longitude);
  if (railDist < 1.5) return null;
  if (walkToEntry > railDist * 1.2 || walkFromExit > railDist * 1.2) return null;

  const legs: RouteLeg[] = [];

  if (walkToEntry >= 0.05) {
    const mode = connectorMode(origin.latitude, origin.longitude, entryStation.latitude, entryStation.longitude, walkToEntry, pref);
    legs.push(buildLeg(mode, origin, entryStation));
  }

  legs.push(buildLeg('rail', entryStation, exitStation));

  if (walkFromExit >= 0.05) {
    const mode = connectorMode(exitStation.latitude, exitStation.longitude, destination.latitude, destination.longitude, walkFromExit);
    legs.push(buildLeg(mode, exitStation, destination));
  }

  return assembleOption(uid(), 'segmented', `${lineName} Train`, `Via ${entryStation.name} → ${exitStation.name}`, legs, ['Rail', 'Fast']);
}

/** Build a BRT route — tries each physical corridor independently to prevent impossible cross-corridor routes */
function buildBRTRoute(
  origin: Location,
  destination: Location,
  pref?: TransportMode
): RouteOption | null {
  for (const corridorStops of [BRT_IKORODU_STOPS, BRT_ABULE_EGBA_STOPS]) {
    const entryStop = nearestStop(origin.latitude, origin.longitude, corridorStops);
    const exitStop  = nearestStop(destination.latitude, destination.longitude, corridorStops, entryStop ? [entryStop.name] : []);
    if (!entryStop || !exitStop) continue;

    const brtDist = calculateDistance(entryStop.latitude, entryStop.longitude, exitStop.latitude, exitStop.longitude);
    if (brtDist < 3) continue;

    const walkToEntry  = calculateDistance(origin.latitude, origin.longitude, entryStop.latitude, entryStop.longitude);
    const walkFromExit = calculateDistance(exitStop.latitude, exitStop.longitude, destination.latitude, destination.longitude);
    if (walkToEntry > 4 || walkFromExit > 4) continue;

    const legs: RouteLeg[] = [];

    if (walkToEntry >= 0.05) {
      const mode = connectorMode(origin.latitude, origin.longitude, entryStop.latitude, entryStop.longitude, walkToEntry, pref);
      legs.push(buildLeg(mode, origin, entryStop));
    }

    legs.push(buildLeg('brt', entryStop, exitStop));

    if (walkFromExit >= 0.05) {
      const mode = connectorMode(exitStop.latitude, exitStop.longitude, destination.latitude, destination.longitude, walkFromExit);
      legs.push(buildLeg(mode, exitStop, destination));
    }

    return assembleOption(uid(), 'segmented', 'BRT (Express)', `Via ${entryStop.name} → ${exitStop.name}`, legs, ['BRT', 'Faster']);
  }
  return null;
}

/** Build a danfo multimodal route via major hubs */
function buildDanfoRoute(
  origin: Location,
  destination: Location,
  pref?: TransportMode
): RouteOption {
  const legs: RouteLeg[] = [];
  const totalDist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

  // Only go direct for genuinely walkable trips — anything longer gets a stop anchor
  if (totalDist <= 0.8) {
    const mode = connectorMode(origin.latitude, origin.longitude, destination.latitude, destination.longitude, totalDist, pref);
    legs.push(buildLeg(mode, origin, destination));
    return assembleOption(uid(), 'direct', 'Direct', `${mode === 'walk' ? 'Walk' : 'Keke'} direct`, legs, ['Short Trip']);
  }

  // Snap origin to the nearest stop in ALL_STOPS first, then fall back to DANFO_HUBS.
  // This mirrors Lara's "find your nearest bus stop" approach — a user standing next to
  // a BRT terminal shouldn't be routed to a danfo hub 2km away.
  const firstHubRaw =
    nearestStop(origin.latitude, origin.longitude, ALL_STOPS) ??
    nearestStop(origin.latitude, origin.longitude, DANFO_HUBS);

  // Prefer danfo-specific hubs for the main trunk, but use the closest ALL_STOPS entry
  // as the boarding anchor if it's genuinely closer (saves the user from a long first mile).
  const nearestDanfoHub = nearestStop(origin.latitude, origin.longitude, DANFO_HUBS);
  const firstHub = (() => {
    if (!firstHubRaw) return nearestDanfoHub;
    if (!nearestDanfoHub) return firstHubRaw;
    const dAll   = calculateDistance(origin.latitude, origin.longitude, firstHubRaw.latitude, firstHubRaw.longitude);
    const dDanfo = calculateDistance(origin.latitude, origin.longitude, nearestDanfoHub.latitude, nearestDanfoHub.longitude);
    // Use the ALL_STOPS anchor only if it's meaningfully closer (saves ≥300m)
    return dAll < dDanfo - 0.3 ? firstHubRaw : nearestDanfoHub;
  })();

  // Find nearest hub to destination (different from first)
  const lastHub = firstHub
    ? nearestStop(destination.latitude, destination.longitude, DANFO_HUBS, [firstHub.name])
    : nearestStop(destination.latitude, destination.longitude, DANFO_HUBS);

  if (!firstHub || !lastHub) {
    // Fallback: single danfo leg
    const mode = totalDist <= 0.5 ? 'walk' : 'danfo';
    legs.push(buildLeg(mode, origin, destination));
    return assembleOption(uid(), 'direct', 'Danfo Direct', 'Direct danfo', legs, ['Budget']);
  }

  const distToFirst = calculateDistance(origin.latitude, origin.longitude, firstHub.latitude, firstHub.longitude);
  const distFromLast = calculateDistance(lastHub.latitude, lastHub.longitude, destination.latitude, destination.longitude);
  const hubToHubDist = calculateDistance(firstHub.latitude, firstHub.longitude, lastHub.latitude, lastHub.longitude);

  // First mile
  if (distToFirst >= 0.05) {
    const mode = connectorMode(origin.latitude, origin.longitude, firstHub.latitude, firstHub.longitude, distToFirst, pref);
    legs.push(buildLeg(mode, origin, firstHub));
  }

  // Hub-to-hub: if long, find intermediate stops
  if (hubToHubDist > 6) {
    const intermediates = stopsAlongCorridor(
      firstHub.latitude, firstHub.longitude,
      lastHub.latitude, lastHub.longitude,
      DANFO_HUBS,
      [firstHub.name, lastHub.name],
      2
    );
    const chain = [firstHub, ...intermediates, lastHub];
    for (let i = 0; i < chain.length - 1; i++) {
      const from = chain[i], to = chain[i + 1];
      const d = calculateDistance(from.latitude, from.longitude, to.latitude, to.longitude);
      if (d < 0.1) continue;
      legs.push(buildLeg('danfo', from, to));
    }
  } else if (hubToHubDist >= 0.05) {
    legs.push(buildLeg('danfo', firstHub, lastHub));
  }

  // Last mile
  if (distFromLast >= 0.05) {
    const mode = connectorMode(lastHub.latitude, lastHub.longitude, destination.latitude, destination.longitude, distFromLast, pref);
    legs.push(buildLeg(mode, lastHub, destination));
  }

  if (legs.length === 0) {
    legs.push(buildLeg('danfo', origin, destination));
  }

  const keyStops = [firstHub.name, lastHub.name].join(' → ');
  return assembleOption(uid(), 'segmented', 'Danfo Route', `Via ${keyStops}`, legs, ['Budget', 'Popular']);
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

  // BRT — internal guard rejects if corridor doesn't help (brtDist < 3km or feeder > 4km)
  const brtRoute = buildBRTRoute(origin, destination, pref);
  if (brtRoute) options.push(brtRoute);

  // Danfo/Keke — always included; buildDanfoRoute handles micro trips internally
  const danfoRoute = buildDanfoRoute(origin, destination, pref);
  options.push(danfoRoute);

  // Remove near-duplicate routes (same legs count & similar price)
  const deduped: RouteOption[] = [];
  for (const opt of options) {
    const isDup = deduped.some(
      d =>
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

  // Pick recommended: prefer unaffected BRT > unaffected fastest > unaffected first > any
  let recommended =
    finalOptions.find(o => !affectedByIncident.has(o.id) && o.tags.includes('BRT')) ??
    finalOptions.find(o => !affectedByIncident.has(o.id) && o.isFastest) ??
    finalOptions.find(o => !affectedByIncident.has(o.id)) ??
    finalOptions.find(o => o.tags.includes('BRT')) ??
    finalOptions.find(o => o.isFastest) ??
    finalOptions[0];

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
  if (opt.tags.includes('BRT')) return 'BRT runs on dedicated lanes — more reliable in traffic';
  if (opt.isFastest)            return 'Quickest route for this trip';
  return 'Best balance of speed and cost for Lagos';
}
