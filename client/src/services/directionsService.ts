/**
 * OpenRouteService — road-following geometry for each route leg.
 * Free tier: 2,000 requests/day. Sign up at openrouteservice.org
 * Required env var: EXPO_PUBLIC_ORS_API_KEY
 */

import { ORS_API_KEY } from '../utils/constants';

const BASE = 'https://api.openrouteservice.org/v2/directions';

function orsProfile(mode: string): string {
  return mode === 'walk' ? 'foot-walking' : 'driving-car';
}

export interface LatLng { latitude: number; longitude: number; }

export async function fetchLegGeometry(
  fromLat: number, fromLng: number,
  toLat:   number, toLng:   number,
  mode:    string,
): Promise<LatLng[] | null> {
  if (!ORS_API_KEY) {
    console.warn('EXPO_PUBLIC_ORS_API_KEY is not set — road-following geometry unavailable');
    return null;
  }

  try {
    const res = await fetch(`${BASE}/${orsProfile(mode)}`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json, application/geo+json',
        'Authorization': ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [[fromLng, fromLat], [toLng, toLat]],
      }),
    });

    if (!res.ok) {
      console.warn('ORS Directions error:', res.status);
      return null;
    }

    const json = await res.json();
    const coords: [number, number][] = json.features?.[0]?.geometry?.coordinates;
    if (!coords?.length) return null;

    // ORS returns [lng, lat] pairs — convert to {latitude, longitude}
    return coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
  } catch (err) {
    console.warn('fetchLegGeometry error:', err);
    return null;
  }
}

export async function fetchAllLegGeometries(
  legs: Array<{
    from: { latitude: number; longitude: number };
    to:   { latitude: number; longitude: number };
    mode: string;
  }>
): Promise<(LatLng[] | null)[]> {
  return Promise.all(
    legs.map(leg =>
      fetchLegGeometry(
        leg.from.latitude, leg.from.longitude,
        leg.to.latitude,   leg.to.longitude,
        leg.mode,
      )
    )
  );
}
