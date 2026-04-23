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

export type TransportMode = 'walk' | 'keke' | 'okada' | 'danfo' | 'brt' | 'ferry' | 'rail';

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

export interface SmartRouteResult {
  origin: Location;
  destination: Location;
  options: RouteOption[];
  recommendedOptionId: string;
  comparison: {
    priceDifference: number;
    priceDifferencePercent: number;
    timeDifference: number;
    shouldLetUserChoose: boolean;
    comparisonText: string;
  };
  computedAt: Date;
}

export interface SmartRoutePreferences {
  preferredFirstLegMode?: TransportMode;
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
  walk:  5,
  keke:  22,
  okada: 30,
  danfo: 18,   // Lagos traffic is brutal
  brt:   28,   // dedicated lanes
  ferry: 25,
  rail:  60,   // Blue/Red Line speed
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

    case 'ferry':
      return distKm <= 10
        ? { min: 1000, max: 1500 }
        : { min: 1500, max: 2500 };
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
    ferry: 'boat-outline',
    rail:  'train-outline',
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
// INFRASTRUCTURE DATA
// All coordinates verified against known Lagos landmarks
// ─────────────────────────────────────────────────────────────

interface Stop extends Location {
  corridor?: 'brt' | 'blue_line' | 'red_line' | 'ferry' | 'danfo_hub';
  lineIndex?: number; // position along corridor for BRT/rail routing
}

// BRT Corridor: Ikorodu → TBS (Primero Transport)
// Ordered south→north so lineIndex increases northward
const BRT_STOPS: Stop[] = [
  { name: 'TBS Terminal',        latitude: 6.4531, longitude: 3.3898, type: 'brt_terminal', corridor: 'brt', lineIndex: 0  },
  { name: 'CMS',                 latitude: 6.4555, longitude: 3.3938, type: 'brt_stop',     corridor: 'brt', lineIndex: 1  },
  { name: 'National Theatre',    latitude: 6.4934, longitude: 3.3681, type: 'brt_stop',     corridor: 'brt', lineIndex: 2  },
  { name: 'Costain',             latitude: 6.4960, longitude: 3.3553, type: 'brt_stop',     corridor: 'brt', lineIndex: 3  },
  { name: 'Ojuelegba',           latitude: 6.5110, longitude: 3.3614, type: 'brt_stop',     corridor: 'brt', lineIndex: 4  },
  { name: 'Yaba BRT',            latitude: 6.5158, longitude: 3.3674, type: 'brt_stop',     corridor: 'brt', lineIndex: 5  },
  { name: 'Fadeyi',              latitude: 6.5390, longitude: 3.3593, type: 'brt_stop',     corridor: 'brt', lineIndex: 6  },
  { name: 'Anthony',             latitude: 6.5620, longitude: 3.3598, type: 'brt_stop',     corridor: 'brt', lineIndex: 7  },
  { name: 'Maryland BRT',        latitude: 6.5710, longitude: 3.3602, type: 'brt_stop',     corridor: 'brt', lineIndex: 8  },
  { name: 'Gbagada',             latitude: 6.5745, longitude: 3.3890, type: 'brt_stop',     corridor: 'brt', lineIndex: 9  },
  { name: 'Ojota',               latitude: 6.6043, longitude: 3.3819, type: 'brt_stop',     corridor: 'brt', lineIndex: 10 },
  { name: 'Ketu',                latitude: 6.6065, longitude: 3.3876, type: 'brt_stop',     corridor: 'brt', lineIndex: 11 },
  { name: 'Mile 12',             latitude: 6.6212, longitude: 3.3836, type: 'brt_stop',     corridor: 'brt', lineIndex: 12 },
  { name: 'Ikorodu Terminal',    latitude: 6.6176, longitude: 3.5027, type: 'brt_terminal', corridor: 'brt', lineIndex: 13 },
];

// Blue Line Rail: Mile 2 ↔ Marina (operational Sep 2023)
const BLUE_LINE_STOPS: Stop[] = [
  { name: 'Marina Rail',         latitude: 6.4541, longitude: 3.3944, type: 'rail_station', corridor: 'blue_line', lineIndex: 0 },
  { name: 'National Theatre Rail',latitude: 6.4902, longitude: 3.3681, type: 'rail_station', corridor: 'blue_line', lineIndex: 1 },
  { name: 'Orile Iganmu',        latitude: 6.4902, longitude: 3.3481, type: 'rail_station', corridor: 'blue_line', lineIndex: 2 },
  { name: 'Suru-Alaba',          latitude: 6.4740, longitude: 3.3313, type: 'rail_station', corridor: 'blue_line', lineIndex: 3 },
  { name: 'Mile 2 Rail',         latitude: 6.4648, longitude: 3.3117, type: 'rail_station', corridor: 'blue_line', lineIndex: 4 },
];

// Red Line Rail: Oyingbo ↔ Agbado (operational Oct 2024)
const RED_LINE_STOPS: Stop[] = [
  { name: 'Oyingbo',             latitude: 6.4823, longitude: 3.3879, type: 'rail_station', corridor: 'red_line', lineIndex: 0 },
  { name: 'Yaba Rail',           latitude: 6.5196, longitude: 3.3703, type: 'rail_station', corridor: 'red_line', lineIndex: 1 },
  { name: 'Mushin Rail',         latitude: 6.5293, longitude: 3.3542, type: 'rail_station', corridor: 'red_line', lineIndex: 2 },
  { name: 'Oshodi Rail',         latitude: 6.5508, longitude: 3.3451, type: 'rail_station', corridor: 'red_line', lineIndex: 3 },
  { name: 'MMIA Domestic',       latitude: 6.5770, longitude: 3.3198, type: 'rail_station', corridor: 'red_line', lineIndex: 4 },
  { name: 'Ikeja Rail',          latitude: 6.5954, longitude: 3.3383, type: 'rail_station', corridor: 'red_line', lineIndex: 5 },
  { name: 'Agege Rail',          latitude: 6.6219, longitude: 3.3090, type: 'rail_station', corridor: 'red_line', lineIndex: 6 },
  { name: 'Iju',                 latitude: 6.6345, longitude: 3.2761, type: 'rail_station', corridor: 'red_line', lineIndex: 7 },
  { name: 'Agbado',              latitude: 6.6516, longitude: 3.2477, type: 'rail_station', corridor: 'red_line', lineIndex: 8 },
];

// LagFerry terminals (LAGFERRY + Metro Ferry, 2024)
const FERRY_TERMINALS: Stop[] = [
  { name: 'Marina Ferry',        latitude: 6.4542, longitude: 3.3944, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Five Cowries (Falomo)', latitude: 6.4508, longitude: 3.4259, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Ebute-Ero Jetty',     latitude: 6.4566, longitude: 3.3794, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Ipakodo (Ikorodu)',   latitude: 6.6094, longitude: 3.5038, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Mile 2 Ferry',        latitude: 6.4648, longitude: 3.3117, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Liverpool Apapa',     latitude: 6.4434, longitude: 3.3611, type: 'ferry_terminal', corridor: 'ferry' },
  { name: 'Badore Jetty',        latitude: 6.4432, longitude: 3.5690, type: 'ferry_terminal', corridor: 'ferry' },
];

// Ferry route pairs (which terminals are directly connected)
const FERRY_ROUTES: Array<[string, string]> = [
  ['Ipakodo (Ikorodu)', 'Five Cowries (Falomo)'],
  ['Ipakodo (Ikorodu)', 'Ebute-Ero Jetty'],
  ['Ipakodo (Ikorodu)', 'Marina Ferry'],
  ['Mile 2 Ferry',      'Liverpool Apapa'],
  ['Mile 2 Ferry',      'Marina Ferry'],
  ['Ebute-Ero Jetty',   'Marina Ferry'],
  ['Five Cowries (Falomo)', 'Marina Ferry'],
  ['Badore Jetty',      'Marina Ferry'],
];

// Major danfo hubs and interchange stops
const DANFO_HUBS: Stop[] = [
  { name: 'Oshodi',             latitude: 6.5520, longitude: 3.3430, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Ikeja Along',        latitude: 6.5869, longitude: 3.3348, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Allen Junction',     latitude: 6.5964, longitude: 3.3506, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Maryland',           latitude: 6.5710, longitude: 3.3602, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Ojuelegba',          latitude: 6.5110, longitude: 3.3614, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Yaba',               latitude: 6.5158, longitude: 3.3674, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Surulere',           latitude: 6.5050, longitude: 3.3500, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Mushin',             latitude: 6.5293, longitude: 3.3542, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Obalende',           latitude: 6.4508, longitude: 3.4201, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Lagos Island',       latitude: 6.4562, longitude: 3.3941, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Idumota',            latitude: 6.4563, longitude: 3.3875, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Victoria Island',    latitude: 6.4285, longitude: 3.4230, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Lekki Phase 1',      latitude: 6.4346, longitude: 3.4714, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Chevron',            latitude: 6.4305, longitude: 3.4505, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'VGC',                latitude: 6.4432, longitude: 3.4692, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ajah',               latitude: 6.4698, longitude: 3.5732, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Sangotedo',          latitude: 6.4390, longitude: 3.5023, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Abraham Adesanya',   latitude: 6.4558, longitude: 3.5231, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ojodu Berger',       latitude: 6.6453, longitude: 3.3558, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Ikorodu',            latitude: 6.6176, longitude: 3.5027, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Agbara',             latitude: 6.4899, longitude: 3.1261, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Festac',             latitude: 6.4660, longitude: 3.2830, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Mile 2',             latitude: 6.4648, longitude: 3.3117, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Apapa',              latitude: 6.4434, longitude: 3.3611, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Egbeda',             latitude: 6.5652, longitude: 3.2638, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Agege',              latitude: 6.6219, longitude: 3.3090, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Ikoyi',              latitude: 6.4579, longitude: 3.4355, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Computer Village',   latitude: 6.5892, longitude: 3.3333, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ikeja GRA',          latitude: 6.6000, longitude: 3.3500, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Jibowu',             latitude: 6.5519, longitude: 3.3839, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Bariga',             latitude: 6.5400, longitude: 3.3930, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ketu',               latitude: 6.6065, longitude: 3.3876, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Mile 12',            latitude: 6.6212, longitude: 3.3836, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Ojota',              latitude: 6.6043, longitude: 3.3819, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Gbagada',            latitude: 6.5745, longitude: 3.3890, type: 'major_hub', corridor: 'danfo_hub' },
  { name: 'Orile',              latitude: 6.4902, longitude: 3.3481, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ogba',               latitude: 6.6096, longitude: 3.3340, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Berger',             latitude: 6.6453, longitude: 3.3558, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Isolo',              latitude: 6.5280, longitude: 3.3038, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Ejigbo',             latitude: 6.5310, longitude: 3.2884, type: 'bus_stop',  corridor: 'danfo_hub' },
  { name: 'Jakande',            latitude: 6.4432, longitude: 3.4692, type: 'bus_stop',  corridor: 'danfo_hub' },
];

// Combined pool for nearest-stop searches
const ALL_STOPS: Stop[] = [
  ...BRT_STOPS,
  ...BLUE_LINE_STOPS,
  ...RED_LINE_STOPS,
  ...FERRY_TERMINALS,
  ...DANFO_HUBS,
];

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
    case 'ferry': return `Board ferry at ${from} jetty, disembark at ${to}`;
    case 'rail':  return `Board train at ${from} station, alight at ${to}`;
  }
}

function lagosPidginInstruction(mode: TransportMode, from: string, to: string): string {
  switch (mode) {
    case 'walk':  return `Waka from ${from} reach ${to}`;
    case 'keke':  return `Enter keke for ${from}, tell am make e drop you ${to}`;
    case 'okada': return `Carry okada from ${from} go ${to}`;
    case 'danfo': return `Enter danfo for ${from} side, tell conductor "${to}!"`;
    case 'brt':   return `Enter BRT for ${from} busstop, come down for ${to}`;
    case 'ferry': return `Enter boat for ${from} jetty, commot for ${to}`;
    case 'rail':  return `Enter train for ${from} station, come down for ${to}`;
  }
}

// ─────────────────────────────────────────────────────────────
// CONNECTOR MODE SELECTION
// First/last mile mode — walk, keke, or okada
// ─────────────────────────────────────────────────────────────

function connectorMode(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  distKm: number,
  preferred?: TransportMode
): TransportMode {
  if (distKm <= 0.4) return 'walk';

  const okadaOk = isOkadaAllowed(fromLat, fromLng, toLat, toLng);

  if (preferred === 'keke'  && distKm <= 5.0) return 'keke';
  if (preferred === 'okada' && distKm <= 6.0 && okadaOk) return 'okada';
  if (preferred === 'walk'  && distKm <= 0.4) return 'walk';

  if (distKm <= 5.0) return 'keke';
  if (okadaOk && distKm <= 8.0) return 'okada';
  return 'keke'; // keke for anything longer if okada banned
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

/** Build a BRT route along the Ikorodu–TBS corridor */
function buildBRTRoute(
  origin: Location,
  destination: Location,
  pref?: TransportMode
): RouteOption | null {
  const entryStop = nearestStop(origin.latitude, origin.longitude, BRT_STOPS);
  const exitStop  = nearestStop(destination.latitude, destination.longitude, BRT_STOPS, entryStop ? [entryStop.name] : []);
  if (!entryStop || !exitStop) return null;

  // Only use BRT if it travels meaningfully in the right direction
  const brtDist = calculateDistance(entryStop.latitude, entryStop.longitude, exitStop.latitude, exitStop.longitude);
  if (brtDist < 3) return null;

  const walkToEntry  = calculateDistance(origin.latitude, origin.longitude, entryStop.latitude, entryStop.longitude);
  const walkFromExit = calculateDistance(exitStop.latitude, exitStop.longitude, destination.latitude, destination.longitude);

  // Don't suggest BRT if the feeder legs are too long relative to the BRT leg
  if (walkToEntry > 4 || walkFromExit > 4) return null;

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

/** Build a ferry route if there's a viable terminal pair */
function buildFerryRoute(
  origin: Location,
  destination: Location,
  pref?: TransportMode
): RouteOption | null {
  const originTerminal = nearestStop(origin.latitude, origin.longitude, FERRY_TERMINALS);
  const destTerminal   = nearestStop(destination.latitude, destination.longitude, FERRY_TERMINALS);
  if (!originTerminal || !destTerminal) return null;
  if (originTerminal.name === destTerminal.name) return null;

  // Check if there's a direct ferry route between these terminals
  const hasRoute = FERRY_ROUTES.some(
    ([a, b]) =>
      (a === originTerminal.name && b === destTerminal.name) ||
      (b === originTerminal.name && a === destTerminal.name)
  );
  if (!hasRoute) return null;

  const walkToTerminal  = calculateDistance(origin.latitude, origin.longitude, originTerminal.latitude, originTerminal.longitude);
  const walkFromTerminal = calculateDistance(destTerminal.latitude, destTerminal.longitude, destination.latitude, destination.longitude);

  // Ferry only worth it if it saves real distance
  const ferryDist = calculateDistance(originTerminal.latitude, originTerminal.longitude, destTerminal.latitude, destTerminal.longitude);
  if (ferryDist < 2) return null;
  if (walkToTerminal > 5 || walkFromTerminal > 5) return null;

  const legs: RouteLeg[] = [];

  if (walkToTerminal >= 0.05) {
    const mode = connectorMode(origin.latitude, origin.longitude, originTerminal.latitude, originTerminal.longitude, walkToTerminal, pref);
    legs.push(buildLeg(mode, origin, originTerminal));
  }

  legs.push(buildLeg('ferry', originTerminal, destTerminal));

  if (walkFromTerminal >= 0.05) {
    const mode = connectorMode(destTerminal.latitude, destTerminal.longitude, destination.latitude, destination.longitude, walkFromTerminal);
    legs.push(buildLeg(mode, destTerminal, destination));
  }

  return assembleOption(uid(), 'segmented', 'Ferry Route', `Via ${originTerminal.name} → ${destTerminal.name}`, legs, ['Ferry', 'Scenic']);
}

/** Build a danfo multimodal route via major hubs */
function buildDanfoRoute(
  origin: Location,
  destination: Location,
  pref?: TransportMode
): RouteOption {
  const legs: RouteLeg[] = [];
  const totalDist = calculateDistance(origin.latitude, origin.longitude, destination.latitude, destination.longitude);

  // For short trips, go direct
  if (totalDist <= 2.5) {
    const mode = connectorMode(origin.latitude, origin.longitude, destination.latitude, destination.longitude, totalDist, pref);
    legs.push(buildLeg(mode, origin, destination));
    return assembleOption(uid(), 'direct', 'Direct', `${mode === 'walk' ? 'Walk' : mode === 'keke' ? 'Keke' : 'Okada'} direct`, legs, ['Short Trip']);
  }

  // Find nearest hub to origin
  const firstHub = nearestStop(origin.latitude, origin.longitude, DANFO_HUBS);

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
  if (hubToHubDist > 12) {
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
    const mode = connectorMode(lastHub.latitude, lastHub.longitude, destination.latitude, destination.longitude, distFromLast);
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

  // 1. Try Blue Line (Marina ↔ Mile 2)
  const blueRoute = buildRailRoute(origin, destination, BLUE_LINE_STOPS, 'Blue Line', pref);
  if (blueRoute) options.push(blueRoute);

  // 2. Try Red Line (Oyingbo ↔ Agbado)
  const redRoute = buildRailRoute(origin, destination, RED_LINE_STOPS, 'Red Line', pref);
  if (redRoute) options.push(redRoute);

  // 3. Try BRT (Ikorodu ↔ TBS corridor)
  const brtRoute = buildBRTRoute(origin, destination, pref);
  if (brtRoute) options.push(brtRoute);

  // 4. Try Ferry
  const ferryRoute = buildFerryRoute(origin, destination, pref);
  if (ferryRoute) options.push(ferryRoute);

  // 5. Always add danfo route
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

  // Pick recommended: prefer rail/BRT if available (faster, more reliable)
  let recommended =
    finalOptions.find(o => o.tags.includes('Rail')) ??
    finalOptions.find(o => o.tags.includes('BRT')) ??
    finalOptions.find(o => o.isFastest) ??
    finalOptions[0];

  recommended.isRecommended = true;
  recommended.recommendationReason = pickRecommendationReason(recommended);

  // Sort: recommended first, then by price
  finalOptions.sort((a, b) => {
    if (a.isRecommended) return -1;
    if (b.isRecommended) return 1;
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
    computedAt: new Date(),
  };
}

function pickRecommendationReason(opt: RouteOption): string {
  if (opt.tags.includes('Rail'))  return 'Fastest option — train avoids Lagos traffic';
  if (opt.tags.includes('BRT'))   return 'BRT runs on dedicated lanes — more reliable in traffic';
  if (opt.tags.includes('Ferry')) return 'Waterway avoids road traffic completely';
  if (opt.isFastest)              return 'Quickest route for this trip';
  return 'Best balance of speed and cost for Lagos';
}
