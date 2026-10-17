/**
 * Places service — two-layer search:
 * 1. Instant local Lagos landmark database (zero network, always works)
 * 2. Maptiler Geocoding API for everything else (free tier: 100k/month)
 *
 * Required env var: EXPO_PUBLIC_MAPTILER_KEY
 */

import { MAPTILER_KEY } from '../utils/constants';
import { GRAPH_STOPS } from '../data/lagosRoutes';

export interface PlacePrediction {
  placeId: string;
  name: string;
  address: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// ─── Local Lagos POI database ─────────────────────────────────────────────────
interface LocalPOI {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  latitude: number;
  longitude: number;
  type: string;
}

const LAGOS_POIS: LocalPOI[] = [
  // Airports
  { id: 'l-mma',  name: 'Murtala Muhammed Airport',  aliases: ['mma', 'lagos airport', 'murtala', 'domestic airport', 'international airport'], address: 'Airport Road, Ikeja', latitude: 6.5774, longitude: 3.3216, type: 'airport' },
  { id: 'l-mma2', name: 'MMA2 Terminal',              aliases: ['mma2', 'mm2', 'international terminal'], address: 'Ikeja, Lagos', latitude: 6.5800, longitude: 3.3234, type: 'airport' },
  // Malls & Shopping
  { id: 'l-ikeja-mall',   name: 'Ikeja City Mall',           aliases: ['icm', 'ikeja mall', 'city mall'], address: 'Obafemi Awolowo Way, Ikeja', latitude: 6.6059, longitude: 3.3490, type: 'mall' },
  { id: 'l-palms',        name: 'The Palms Shopping Mall',    aliases: ['palms mall', 'the palms', 'palms lekki'], address: 'Bisway Street, Lekki Phase 1', latitude: 6.4351, longitude: 3.4697, type: 'mall' },
  { id: 'l-maryland-mall',name: 'Maryland Mall',              aliases: ['maryland shopping', 'maryland centre'], address: 'Maryland, Lagos', latitude: 6.5652, longitude: 3.3574, type: 'mall' },
  { id: 'l-arena',        name: 'The Arena Mall',             aliases: ['oshodi mall', 'arena oshodi'], address: 'International Airport Road, Oshodi', latitude: 6.5580, longitude: 3.3467, type: 'mall' },
  { id: 'l-balogun',      name: 'Balogun Market',             aliases: ['balogun', 'balogun lagos island'], address: 'Balogun, Lagos Island', latitude: 6.4544, longitude: 3.3947, type: 'market' },
  { id: 'l-oshodi-mkt',   name: 'Oshodi Market',              aliases: ['oshodi'], address: 'Oshodi, Lagos', latitude: 6.5569, longitude: 3.3484, type: 'market' },
  { id: 'l-tejuosho',     name: 'Tejuosho Ultra-Modern Market',aliases: ['tejuosho market', 'yaba market'], address: 'Ojuelegba Road, Surulere', latitude: 6.5011, longitude: 3.3688, type: 'market' },
  { id: 'l-tradefair',    name: 'Trade Fair Complex',         aliases: ['trade fair', 'badagry expressway market'], address: 'Lagos-Badagry Expressway, Ojo', latitude: 6.4742, longitude: 3.2499, type: 'market' },
  { id: 'l-computer-village', name: 'Computer Village',       aliases: ['ikeja computer village', 'computer village ikeja'], address: 'Otigba Street, Ikeja', latitude: 6.6026, longitude: 3.3512, type: 'market' },
  // Hotels
  { id: 'l-eko-hotel',    name: 'Eko Hotel & Suites',         aliases: ['eko hotel', 'eko suites'], address: 'Adetokunbo Ademola, Victoria Island', latitude: 6.4256, longitude: 3.4243, type: 'hotel' },
  { id: 'l-transcorp',    name: 'Transcorp Hilton Lagos',      aliases: ['transcorp', 'hilton lagos'], address: 'Kofo Abayomi, Victoria Island', latitude: 6.4315, longitude: 3.4200, type: 'hotel' },
  { id: 'l-federal-palace',name:'Federal Palace Hotel',        aliases: ['federal palace'], address: 'Ahmadu Bello Way, Victoria Island', latitude: 6.4418, longitude: 3.4101, type: 'hotel' },
  { id: 'l-sheraton',     name: 'Sheraton Lagos Hotel',        aliases: ['sheraton', 'sheraton ikeja'], address: 'Mobolaji Bank Anthony Way, Ikeja', latitude: 6.5994, longitude: 3.3437, type: 'hotel' },
  // Hospitals
  { id: 'l-luth',         name: 'Lagos University Teaching Hospital', aliases: ['luth', 'lagos teaching hospital'], address: 'Ishaga Road, Mushin', latitude: 6.5072, longitude: 3.3517, type: 'hospital' },
  { id: 'l-lagos-island-gh',name:'Lagos Island General Hospital',   aliases: ['island general hospital', 'lagos island hospital'], address: 'Custom Street, Lagos Island', latitude: 6.4557, longitude: 3.3965, type: 'hospital' },
  { id: 'l-reddington',   name: 'Reddington Hospital',         aliases: ['reddington', 'reddington vi'], address: 'Victoria Island, Lagos', latitude: 6.4273, longitude: 3.4206, type: 'hospital' },
  // Universities
  { id: 'l-unilag',       name: 'University of Lagos',         aliases: ['unilag', 'unilag akoka'], address: 'University Road, Akoka, Yaba', latitude: 6.5158, longitude: 3.3901, type: 'university' },
  { id: 'l-lasu',         name: 'Lagos State University',      aliases: ['lasu', 'lasu ojo'], address: 'Badagry Expressway, Ojo', latitude: 6.4738, longitude: 3.1861, type: 'university' },
  { id: 'l-yaba-tech',    name: 'Yaba College of Technology',  aliases: ['yabatech', 'yaba college', 'yaba tech'], address: 'Herbert Macaulay Way, Yaba', latitude: 6.5101, longitude: 3.3750, type: 'university' },
  // Government & Landmarks
  { id: 'l-tbs',          name: 'Tafawa Balewa Square',        aliases: ['tbs', 'racecourse'], address: 'Lagos Island, Lagos', latitude: 6.4511, longitude: 3.3954, type: 'landmark' },
  { id: 'l-lag-secretariat',name:'Lagos State Secretariat',    aliases: ['secretariat', 'alausa secretariat', 'alausa'], address: 'Alausa, Ikeja', latitude: 6.5945, longitude: 3.3384, type: 'government' },
  { id: 'l-nff',          name: 'National Arts Theatre',       aliases: ['national theatre', 'arts theatre', 'iganmu theatre'], address: 'Iganmu, Lagos', latitude: 6.4880, longitude: 3.3662, type: 'landmark' },
  { id: 'l-apapa-port',   name: 'Apapa Port',                  aliases: ['apapa', 'lagos port', 'tin can island'], address: 'Apapa, Lagos', latitude: 6.4487, longitude: 3.3641, type: 'port' },
  // Popular Areas & Bus Stops
  { id: 'l-vi',           name: 'Victoria Island',             aliases: ['vi', 'v.i'], address: 'Victoria Island, Lagos', latitude: 6.4318, longitude: 3.4163, type: 'area' },
  { id: 'l-lekki-1',      name: 'Lekki Phase 1',               aliases: ['lekki 1', 'lekki phase one'], address: 'Lekki Phase 1, Lagos', latitude: 6.4353, longitude: 3.4700, type: 'area' },
  { id: 'l-ikoyi',        name: 'Ikoyi',                       aliases: ['ikoyi lagos', 'old ikoyi'], address: 'Ikoyi, Lagos', latitude: 6.4579, longitude: 3.3674, type: 'area' },
  { id: 'l-surulere',     name: 'Surulere',                    aliases: ['surulere lagos'], address: 'Surulere, Lagos', latitude: 6.4914, longitude: 3.3587, type: 'area' },
  { id: 'l-yaba',         name: 'Yaba',                        aliases: ['yaba lagos'], address: 'Yaba, Lagos', latitude: 6.5101, longitude: 3.3869, type: 'area' },
  { id: 'l-ikeja',        name: 'Ikeja',                       aliases: ['ikeja lagos', 'ikeja gra'], address: 'Ikeja, Lagos', latitude: 6.5954, longitude: 3.3378, type: 'area' },
  { id: 'l-ajah',         name: 'Ajah',                        aliases: ['ajah lagos', 'abraham adesanya'], address: 'Ajah, Lagos', latitude: 6.4734, longitude: 3.5862, type: 'area' },
  { id: 'l-festac',       name: 'FESTAC Town',                 aliases: ['festac', 'festac town'], address: 'FESTAC Town, Amuwo-Odofin', latitude: 6.4652, longitude: 3.2825, type: 'area' },
  { id: 'l-berger',       name: 'Berger Bus Stop',             aliases: ['berger', 'ojodu berger'], address: 'Ojodu, Lagos', latitude: 6.6369, longitude: 3.3544, type: 'bus_stop' },
  { id: 'l-cms',          name: 'CMS',                         aliases: ['cms lagos', 'church mission'], address: 'CMS, Lagos Island', latitude: 6.4538, longitude: 3.3939, type: 'bus_stop' },
  { id: 'l-ojuelegba',    name: 'Ojuelegba',                   aliases: ['ojuelegba bustop', 'ojuelegba bridge'], address: 'Ojuelegba, Surulere', latitude: 6.5025, longitude: 3.3719, type: 'bus_stop' },
  { id: 'l-ojota',        name: 'Ojota',                       aliases: ['ojota bus stop'], address: 'Ojota, Lagos', latitude: 6.5822, longitude: 3.3797, type: 'area' },
  { id: 'l-mile2',        name: 'Mile 2',                      aliases: ['mile 2', 'mile two'], address: 'Mile 2, Ajeromi-Ifelodun', latitude: 6.4666, longitude: 3.3010, type: 'bus_terminal' },
  { id: 'l-jibowu',       name: 'Jibowu',                      aliases: ['jibowu', 'jibowu bustop', 'fadeyi'], address: 'Jibowu, Yaba', latitude: 6.5180, longitude: 3.3737, type: 'bus_stop' },
  { id: 'l-mile12',       name: 'Mile 12 Market',              aliases: ['mile 12', 'mile twelve', 'ketu mile 12'], address: 'Mile 12, Kosofe', latitude: 6.6016, longitude: 3.3864, type: 'market' },
  // Stadiums & Recreation
  { id: 'l-national-stadium',name:'National Stadium Surulere', aliases: ['national stadium', 'surulere stadium'], address: 'National Stadium Road, Surulere', latitude: 6.4904, longitude: 3.3629, type: 'stadium' },
  { id: 'l-lekki-conservation',name:'Lekki Conservation Centre',aliases:['lekki conservation','lcc','canopy walkway'], address: 'Lekki-Epe Expressway, Lekki', latitude: 6.4475, longitude: 3.5381, type: 'park' },
  { id: 'l-banana-island', name: 'Banana Island',              aliases: ['banana island ikoyi'], address: 'Banana Island, Ikoyi', latitude: 6.4700, longitude: 3.4250, type: 'area' },
];

// Pre-populate coordinate cache from local POIs
const coordCache = new Map<string, { lat: number; lon: number; name: string; address: string }>();
LAGOS_POIS.forEach(poi => {
  coordCache.set(poi.id, { lat: poi.latitude, lon: poi.longitude, name: poi.name, address: poi.address });
});

// ─── Matching ─────────────────────────────────────────────────────────────────
//
// Lagos place names arrive misspelt ("beger"), shortened ("cms") or with the
// bus-stop words around them, and the geocoder knows almost none of the bus
// stops — it answers "berger" with the centroid of Lagos, which sits on CMS.
// That is how every search used to start or end at CMS. So every name the
// app knows (the landmarks above and the routing engine's own stops) is
// matched here first, tolerant of a typo or two, and a remote result only
// survives if it actually resembles what was typed.

const norm = (s: string) =>
  s.toLowerCase().replace(/[().,'’\-/&]/g, ' ').replace(/\s+/g, ' ').trim();

// Words that describe a place rather than name it. "allen roundabout" must
// match on "allen", not merely on "roundabout" — the geocoder's answer to it
// was Thompson Roundabout in Eti-Osa.
const GENERIC = new Set([
  'bus', 'stop', 'busstop', 'bustop', 'park', 'garage', 'junction', 'roundabout',
  'road', 'rd', 'street', 'st', 'station', 'terminal', 'market', 'lagos', 'the',
  'under', 'bridge', 'gate', 'area', 'by', 'at', 'near',
]);

/** Edit distance with transpositions ("bregre"), capped: anything past 2 is "far". */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const d: number[][] = [];
  for (let i = 0; i <= a.length; i++) d.push([i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** How many typos a word of this length may carry and still be the same word. */
const typoAllowance = (len: number) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** 0–1: how well one typed word matches one word of a place name. */
function wordMatch(typed: string, word: string): number {
  if (typed === word) return 1;
  if (typed.length >= 3 && word.startsWith(typed)) return 0.85;
  const allow = typoAllowance(Math.max(typed.length, word.length));
  if (!allow) return 0;
  const d = editDistance(typed, word);
  return d === 1 ? 0.7 : d === 2 && allow >= 2 ? 0.55 : 0;
}

/**
 * 0–100: how well a typed query names a place. Every naming word typed has
 * to be found in the place — one strong word is not enough — so "allen
 * roundabout" cannot become any roundabout at all.
 */
export function placeNameScore(query: string, candidate: string): number {
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.startsWith(q + ' ')) return 90;
  const qWords = q.split(' ');
  const cWords = c.split(' ');
  const naming = qWords.filter((w) => !GENERIC.has(w));
  const required = naming.length ? naming : qWords;
  let total = 0;
  for (const w of required) {
    let best = 0;
    for (const cw of cWords) best = Math.max(best, wordMatch(w, cw));
    // Written as one word: "ojoduberger", "mile2".
    best = Math.max(best, wordMatch(w, cWords.join('')) * 0.95);
    if (best === 0) return 0;
    total += best;
  }
  return Math.round((80 * total) / required.length);
}

// ─── Local index: landmarks + every stop the routing engine knows ─────────────

interface IndexedPlace {
  id: string;
  name: string;
  aliases: string[];
  address: string;
  latitude: number;
  longitude: number;
  type: string;
}

// A transit stop is what a rider means by a bare area name — "ikeja" is the
// bus stop under the bridge, not Ikeja City Mall — so on a tie it wins.
const TYPE_BONUS: Record<string, number> = { transit_stop: 6, bus_stop: 4, bus_terminal: 4, area: 2 };

function stopAliases(name: string): string[] {
  // "Ikeja (Under Bridge)" is also just "Ikeja"; "Gbagada (Ifako)" is also "Ifako".
  const m = name.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? [m[1], m[2]] : [];
}

const STOP_PLACES: IndexedPlace[] = GRAPH_STOPS.map((s) => ({
    id: `g:${s.id}`,
    name: s.name,
    aliases: stopAliases(s.name),
    address: s.landmark ?? 'Bus stop, Lagos',
    latitude: s.latitude,
    longitude: s.longitude,
    type: 'transit_stop',
}));

const kmBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const t = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(t(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(t(a.latitude)) * Math.cos(t(b.latitude)) * Math.sin(t(b.longitude - a.longitude) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

// Where the engine has a checked stop, a landmark entry of the same name is a
// duplicate with older coordinates — "Berger Bus Stop" sat 1.4 km west of the
// Ojodu Berger stop the routes actually use. The stop supersedes it.
// The stop inherits the landmark's other names, so "vi" still finds Victoria
// Island once the landmark has gone.
// The best-named match wins, then the nearest: "Ikeja" belongs to Ikeja
// (Under Bridge), not to the first stop that merely starts with "Ikeja".
function supersededBy(poi: IndexedPlace): IndexedPlace | undefined {
  let best: { stop: IndexedPlace; score: number; km: number } | undefined;
  for (const s of STOP_PLACES) {
    const km = kmBetween(poi, s);
    if (km >= 2.0) continue;
    let score = 0;
    for (const n of [poi.name, ...poi.aliases]) {
      for (const sn of [s.name, ...stopAliases(s.name)]) score = Math.max(score, placeNameScore(n, sn));
    }
    if (score < 90) continue;
    if (!best || score > best.score || (score === best.score && km < best.km)) best = { stop: s, score, km };
  }
  return best?.stop;
}

const keptPois: IndexedPlace[] = [];
for (const poi of LAGOS_POIS) {
  const stop = supersededBy(poi);
  if (stop) stop.aliases.push(poi.name, ...poi.aliases);
  else keptPois.push(poi);
}

const LOCAL_INDEX: IndexedPlace[] = [...keptPois, ...STOP_PLACES];

// Stops resolve instantly through getPlaceDetails, the same as landmarks.
LOCAL_INDEX.forEach((p) => {
  if (!coordCache.has(p.id)) coordCache.set(p.id, { lat: p.latitude, lon: p.longitude, name: p.name, address: p.address });
});

const MIN_SCORE = 40;

function searchLocal(query: string): PlacePrediction[] {
  if (!norm(query)) return [];

  const scored = LOCAL_INDEX
    .map((p) => {
      const base = Math.max(placeNameScore(query, p.name), ...p.aliases.map((a) => placeNameScore(query, a)));
      return { p, base, score: base ? base + (TYPE_BONUS[p.type] ?? 0) : 0 };
    })
    .filter((x) => x.base >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  // A landmark and the stop beside it are one answer, not two.
  const kept: typeof scored = [];
  for (const x of scored) {
    if (kept.some((k) => kmBetween(k.p, x.p) < 0.3)) continue;
    kept.push(x);
    if (kept.length === 5) break;
  }

  return kept.map(({ p }) => ({ placeId: p.id, name: p.name, address: p.address, types: [p.type] }));
}

// ─── Maptiler Geocoding API ───────────────────────────────────────────────────

// Lagos bounding box: minLng, minLat, maxLng, maxLat
const LAGOS_BBOX = '2.6,6.0,4.5,6.9';

// Cache coordinates from Maptiler results so getPlaceDetails works without a 2nd call
const maptilerCache = new Map<string, PlaceDetails>();

/** Why the last remote search returned nothing, so the UI can say so. */
export type SearchProblem = 'no_key' | 'offline' | 'rejected' | null;
export let lastSearchProblem: SearchProblem = null;

async function searchMaptiler(query: string): Promise<PlacePrediction[]> {
  if (!MAPTILER_KEY) { lastSearchProblem = 'no_key'; return []; }

  try {
    const url =
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query + ' Lagos Nigeria')}.json` +
      `?key=${MAPTILER_KEY}` +
      `&bbox=${LAGOS_BBOX}` +
      `&language=en` +
      `&limit=5`;

    const res  = await fetch(url);
    if (!res.ok) { lastSearchProblem = 'rejected'; return []; }
    const json = await res.json();
    lastSearchProblem = null;

    // The geocoder pads a miss with the city itself ("Lagos", whose centre is
    // CMS), the state, and streets that merely contain "Lagos". None of those
    // is the place asked for, and starting a route at CMS is worse than
    // saying we could not find it.
    const COARSE = new Set(['country', 'region', 'subregion', 'county']);
    const relevant = (json.features ?? []).filter((f: any) =>
      !(f.place_type ?? []).some((t: string) => COARSE.has(t))
      && norm(f.text ?? '') !== 'lagos'
      && placeNameScore(query, f.text ?? '') >= MIN_SCORE);

    return relevant.map((f: any) => {
      const placeId   = `mt:${f.id}`;
      const [lng, lat] = f.geometry?.coordinates ?? [0, 0];

      maptilerCache.set(placeId, {
        placeId,
        name:      f.text ?? f.place_name ?? '',
        address:   f.place_name ?? f.text ?? '',
        latitude:  lat,
        longitude: lng,
      });

      return {
        placeId,
        name:    f.text ?? f.place_name ?? '',
        address: f.place_name ?? '',
        types:   f.place_type ?? [],
      };
    });
  } catch {
    // fetch itself threw: DNS / no route / TLS — the device can't reach the API.
    lastSearchProblem = 'offline';
    return [];
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim()) return [];

  const local = searchLocal(query);

  // Run Maptiler Geocoding in parallel — if it fails, local results still show
  const remote = await searchMaptiler(query).catch(() => [] as PlacePrediction[]);

  // Local results first, then Google results not already in local list
  const localNames = new Set(local.map(p => p.name.toLowerCase()));
  const merged = [
    ...local,
    ...remote.filter(r => !localNames.has(r.name.toLowerCase())),
  ];

  return merged.slice(0, 8);
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  // Local POIs — instantly from cache
  const cached = coordCache.get(placeId);
  if (cached) {
    return {
      placeId,
      name:      cached.name,
      address:   cached.address,
      latitude:  cached.lat,
      longitude: cached.lon,
    };
  }

  // Maptiler result (coordinates cached during search)
  return maptilerCache.get(placeId) ?? null;
}

export function isWithinLagos(lat: number, lng: number): boolean {
  return lat >= 6.2 && lat <= 6.8 && lng >= 3.0 && lng <= 4.1;
}
