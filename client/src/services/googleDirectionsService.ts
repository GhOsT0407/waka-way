import { GOOGLE_MAPS_API_KEY } from '../utils/constants';

// ─── Types ────────────────────────────────────────────────────

export type TravelMode = 'walking' | 'driving' | 'transit';

export interface DirectionsStep {
  instruction: string;        // HTML-stripped human instruction
  distanceM: number;          // metres
  durationSec: number;        // seconds
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  travelMode: TravelMode;
  transitLine?: string;       // e.g. "Ikorodu–TBS BRT"
  transitDeparture?: string;  // stop name
  transitArrival?: string;    // stop name
}

export interface DirectionsResult {
  polyline: string;           // encoded polyline for the full route
  steps: DirectionsStep[];
  totalDistanceM: number;
  totalDurationSec: number;
  waypointOrder?: number[];   // if optimise_waypoints was used
}

// ─── Helper ───────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function extractStep(raw: any, mode: TravelMode): DirectionsStep {
  const transit = raw.transit_details;
  return {
    instruction:      stripHtml(raw.html_instructions ?? ''),
    distanceM:        raw.distance?.value ?? 0,
    durationSec:      raw.duration?.value ?? 0,
    startLat:         raw.start_location?.lat ?? 0,
    startLng:         raw.start_location?.lng ?? 0,
    endLat:           raw.end_location?.lat ?? 0,
    endLng:           raw.end_location?.lng ?? 0,
    travelMode:       (raw.travel_mode?.toLowerCase() as TravelMode) ?? mode,
    transitLine:      transit?.line?.short_name ?? transit?.line?.name,
    transitDeparture: transit?.departure_stop?.name,
    transitArrival:   transit?.arrival_stop?.name,
  };
}

// ─── Core fetch ───────────────────────────────────────────────

async function fetchDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: TravelMode,
  alternatives = false,
): Promise<DirectionsResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API key not set');
    return null;
  }

  const params = new URLSearchParams({
    origin:       `${originLat},${originLng}`,
    destination:  `${destLat},${destLng}`,
    mode,
    region:       'ng',
    language:     'en',
    alternatives: String(alternatives),
    key:          GOOGLE_MAPS_API_KEY,
  });

  try {
    const res  = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const json = await res.json();

    if (json.status !== 'OK') {
      console.warn('Directions API:', json.status, json.error_message ?? '');
      return null;
    }

    const leg = json.routes[0]?.legs[0];
    if (!leg) return null;

    const steps: DirectionsStep[] = [];
    for (const raw of leg.steps ?? []) {
      // Transit steps may contain sub-steps
      if (raw.travel_mode === 'TRANSIT' && raw.steps?.length) {
        for (const sub of raw.steps) steps.push(extractStep(sub, 'transit'));
      } else {
        steps.push(extractStep(raw, mode));
      }
    }

    return {
      polyline:       json.routes[0].overview_polyline?.points ?? '',
      steps,
      totalDistanceM: leg.distance?.value ?? 0,
      totalDurationSec: leg.duration?.value ?? 0,
    };
  } catch (err) {
    console.error('Directions API fetch error:', err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────

/** Real walking polyline + turn-by-turn for a first/last mile leg. */
export function getWalkingDirections(
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
): Promise<DirectionsResult | null> {
  return fetchDirections(originLat, originLng, destLat, destLng, 'walking');
}

/** Driving distance/duration — useful for Uber/Bolt fare estimates. */
export function getDrivingDirections(
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
): Promise<DirectionsResult | null> {
  return fetchDirections(originLat, originLng, destLat, destLng, 'driving');
}

/**
 * Transit directions — Google's Lagos transit coverage is limited to
 * some BRT stops. Returns null when no transit data is available,
 * so always fall back to WakaWay's own routing in that case.
 */
export function getTransitDirections(
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
): Promise<DirectionsResult | null> {
  return fetchDirections(originLat, originLng, destLat, destLng, 'transit');
}

/**
 * Get an accurate road distance in km between two points.
 * More realistic than Haversine for pricing — accounts for Lagos road layout.
 */
export async function getRoadDistanceKm(
  originLat: number, originLng: number,
  destLat: number,   destLng: number,
): Promise<number | null> {
  const result = await getDrivingDirections(originLat, originLng, destLat, destLng);
  if (!result) return null;
  return Math.round((result.totalDistanceM / 1000) * 100) / 100;
}
