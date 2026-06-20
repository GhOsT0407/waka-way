/**
 * Places service — two-layer search:
 * 1. Instant local Lagos landmark database (zero network, always works)
 * 2. Maptiler Geocoding API for everything else (free tier: 100k/month)
 *
 * Required env var: EXPO_PUBLIC_MAPTILER_KEY
 */

import { MAPTILER_KEY } from '../utils/constants';

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

// ─── Local fuzzy search ───────────────────────────────────────────────────────

function searchLocal(query: string): PlacePrediction[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return LAGOS_POIS
    .map(poi => {
      const nameStart  = poi.name.toLowerCase().startsWith(q);
      const nameMatch  = poi.name.toLowerCase().includes(q);
      const aliasMatch = poi.aliases.some(a => a.includes(q));
      const score      = nameStart ? 3 : nameMatch ? 2 : aliasMatch ? 1 : 0;
      return { poi, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ poi }) => ({
      placeId: poi.id,
      name:    poi.name,
      address: poi.address,
      types:   [poi.type],
    }));
}

// ─── Maptiler Geocoding API ───────────────────────────────────────────────────

// Lagos bounding box: minLng, minLat, maxLng, maxLat
const LAGOS_BBOX = '2.6,6.0,4.5,6.9';

// Cache coordinates from Maptiler results so getPlaceDetails works without a 2nd call
const maptilerCache = new Map<string, PlaceDetails>();

async function searchMaptiler(query: string): Promise<PlacePrediction[]> {
  if (!MAPTILER_KEY) return [];

  try {
    const url =
      `https://api.maptiler.com/geocoding/${encodeURIComponent(query + ' Lagos Nigeria')}.json` +
      `?key=${MAPTILER_KEY}` +
      `&bbox=${LAGOS_BBOX}` +
      `&language=en` +
      `&limit=5`;

    const res  = await fetch(url);
    const json = await res.json();

    return (json.features ?? []).map((f: any) => {
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
