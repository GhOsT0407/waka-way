import { CORRIDORS, STOP_BY_ID, type GraphStop } from '../data/lagosRoutes';
import type { RouteLeg } from './smartRoutingService';
import type { LatLng } from '../utils/geo';

/**
 * Where a leg goes on the map, from the corridor data itself. Road-following
 * geometry from a directions API is nicer; this is what we always have, and
 * a stop-to-stop chain is honest about what the app actually knows.
 */

/** The corridor stops this leg rides through, in order, boarding stop first. */
export function legStops(leg: RouteLeg): GraphStop[] {
  if (!leg.corridorId || !leg.fromStopId || !leg.toStopId) return [];
  const corridor = CORRIDORS.find((c) => c.id === leg.corridorId);
  if (!corridor) return [];
  const a = corridor.stops.indexOf(leg.fromStopId);
  const b = corridor.stops.indexOf(leg.toStopId);
  if (a < 0 || b < 0) return [];
  const ids = a <= b ? corridor.stops.slice(a, b + 1) : corridor.stops.slice(b, a + 1).reverse();
  return ids.map((id) => STOP_BY_ID[id]).filter(Boolean);
}

/** Straight lines between the stops the leg passes — the fallback polyline. */
export function legFallbackGeometry(leg: RouteLeg): LatLng[] {
  const stops = legStops(leg);
  if (stops.length >= 2) return stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude }));
  return [
    { latitude: leg.from.latitude, longitude: leg.from.longitude },
    { latitude: leg.to.latitude, longitude: leg.to.longitude },
  ];
}
