import { GOOGLE_MAPS_API_KEY } from '../utils/constants';

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

// Lagos bounding box for biasing results
const LAGOS_LOCATION = '6.5244,3.3792';
const LAGOS_RADIUS   = 50000; // 50 km

export async function searchPlaces(query: string): Promise<PlacePrediction[]> {
  if (!query.trim() || !GOOGLE_MAPS_API_KEY) return [];

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(query + ' Lagos Nigeria')}` +
      `&location=${LAGOS_LOCATION}` +
      `&radius=${LAGOS_RADIUS}` +
      `&strictbounds=false` +
      `&components=country:ng` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      console.warn('Places API error:', json.status);
      return [];
    }

    return (json.predictions ?? []).map((p: any) => ({
      placeId: p.place_id,
      name:    p.structured_formatting?.main_text    ?? p.description,
      address: p.structured_formatting?.secondary_text ?? '',
      types:   p.types ?? [],
    }));
  } catch (err) {
    console.warn('searchPlaces error:', err);
    return [];
  }
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  if (!placeId || !GOOGLE_MAPS_API_KEY) return null;

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${placeId}` +
      `&fields=place_id,name,formatted_address,geometry` +
      `&key=${GOOGLE_MAPS_API_KEY}`;

    const res  = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' || !json.result) return null;

    const r = json.result;
    return {
      placeId:   r.place_id,
      name:      r.name,
      address:   r.formatted_address,
      latitude:  r.geometry.location.lat,
      longitude: r.geometry.location.lng,
    };
  } catch (err) {
    console.warn('getPlaceDetails error:', err);
    return null;
  }
}

// Validate that coordinates are within Lagos
export function isWithinLagos(lat: number, lng: number): boolean {
  return lat >= 6.2 && lat <= 6.8 && lng >= 3.0 && lng <= 4.1;
}
