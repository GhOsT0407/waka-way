import { calculateSmartRoute, type SmartRouteResult } from './smartRoutingService';
import { avoidPointsFrom, type LiveAlert } from '../hooks/useLiveAlerts';
import { PREF_KEYS, getFlag } from '../utils/prefs';
import type { LatLng } from '../utils/geo';

/**
 * The one door into the routing engine. Gathers what the engine cannot
 * know on its own — the rider's "new to this area" answer, whether okada
 * is welcome, and the live reports worth routing around — and asks for a
 * plan. It never substitutes a made-up route: if the engine fails, the
 * caller hears about it and tells the rider the truth.
 */

export interface PlanRequest {
  origin: LatLng;
  /** Set when the rider typed a start ("Ikeja to Lekki"); otherwise the GPS fix. */
  originName?: string;
  destination: LatLng;
  destinationName: string;
  /** Live reports already on hand (Home's banner has them); optional. */
  alerts?: LiveAlert[];
  departAt?: Date;
}

export async function planJourney(req: PlanRequest): Promise<SmartRouteResult> {
  const [newcomer, okadaOk] = await Promise.all([getFlag(PREF_KEYS.newcomer), getFlag(PREF_KEYS.okadaOk)]);
  const result = calculateSmartRoute(
    req.origin.latitude, req.origin.longitude, req.originName || 'Your location',
    req.destination.latitude, req.destination.longitude, req.destinationName || 'Destination',
    {
      newcomer,
      preferredFirstLegMode: okadaOk ? 'okada' : undefined,
      avoidPoints: avoidPointsFrom(req.alerts ?? []),
      departAt: req.departAt,
    },
  );
  if (!result.options.length) throw new Error('No route could be planned for this trip');
  return result;
}
