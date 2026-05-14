/**
 * Smart Router
 * 
 * High-level routing utility that combines:
 * - Location detection (GPS/WiFi/Cell)
 * - Online/offline awareness
 * - Smart route calculation with Lagos-specific rules
 * - Route auto-fixing (validates legs, blocks okada in banned zones, etc.)
 * 
 * This is the main entry point for getting a route from the user's
 * current (possibly hidden/inaccurate) location to a destination.
 */

import { DetectedLocation, LocationAccuracy } from './locationDetector';
import { isOnline } from './locationDetector';
import { calculateSmartRoute, RouteLeg, SmartRouteResult } from '../services/smartRoutingService';
import { validateRoute } from '../services/routeAutoFixer';
import { RouteLeg as ValidatorLeg } from '../services/routeValidator';

export interface SmartRouterResult {
  /** The validated/fixed route legs */
  legs: RouteLeg[];
  /** Full smart route result (all options, recommended, etc.) */
  smartRoute: SmartRouteResult;
  /** Whether the route was computed offline */
  isOffline: boolean;
  /** How the user's location was detected */
  locationSource: LocationAccuracy;
  /** Warning message if location accuracy is low */
  warning?: string;
}

function toValidatorLeg(leg: RouteLeg): ValidatorLeg {
  return {
    mode: leg.mode,
    distanceKm: leg.distanceKm,
    durationMin: leg.durationMins,
    from: leg.from.name,
    to: leg.to.name,
    cost: { min: leg.priceMin, max: leg.priceMax },
  };
}

function applyValidatedMode(original: RouteLeg, validated: ValidatorLeg): RouteLeg {
  const newMode = validated.mode;
  if (newMode === original.mode) return original;
  return {
    ...original,
    mode: newMode,
    instruction: original.instruction.replace(
      /^(Walk|Keke|Okada|Danfo|BRT|Ferry)/i,
      newMode.charAt(0).toUpperCase() + newMode.slice(1)
    ),
  };
}

/**
 * Get a route from the user's detected location to a destination.
 * 
 * Handles:
 * - Accuracy warnings (cell tower location = imprecise)
 * - Offline fallback (uses local route computation)
 * - Auto-validation of all legs (okada bans, walk limits, etc.)
 * 
 * @param destLat - Destination latitude
 * @param destLng - Destination longitude
 * @param userLocation - The detected user location from locationDetector
 * @param destName - Optional destination name
 */
export async function getRouteFromHiddenLocation(
  destLat: number,
  destLng: number,
  userLocation: DetectedLocation,
  destName?: string,
): Promise<SmartRouterResult> {
  // Check connectivity
  const online = await isOnline();

  // Generate warning for low-accuracy locations
  let warning: string | undefined;
  if (userLocation.source === 'CELL') {
    warning = 'Your location is approximate (cell tower). Route start point may be off by a few hundred meters.';
  } else if (userLocation.accuracy > 50) {
    warning = `Location accuracy is ${Math.round(userLocation.accuracy)}m. Route may not be exact.`;
  }

  // Compute the smart route (works fully offline — all local computation)
  const smartRoute = calculateSmartRoute(
    userLocation.latitude,
    userLocation.longitude,
    'Your Location',
    destLat,
    destLng,
    destName || 'Destination',
  );

  // Get the recommended route option's legs
  const recommended = smartRoute.options.find(o => o.isRecommended) ?? smartRoute.options[0];
  
  if (!recommended) {
    return {
      legs: [],
      smartRoute,
      isOffline: !online,
      locationSource: userLocation.source,
      warning: warning ?? 'No route found for this trip.',
    };
  }

  // Validate and auto-fix legs through the route validator
  const validatorLegs = recommended.legs.map(toValidatorLeg);
  const fixedLegs = validateRoute(validatorLegs);

  // Map fixes back to the original legs
  const finalLegs = recommended.legs
    .map((originalLeg, i) => {
      const fixedLeg = fixedLegs.find(
        fl => fl.from === originalLeg.from.name && fl.to === originalLeg.to.name
      );
      if (!fixedLeg) return null; // Leg was removed (e.g., 0km walk)
      return applyValidatedMode(originalLeg, fixedLeg);
    })
    .filter((leg): leg is RouteLeg => leg !== null);

  return {
    legs: finalLegs,
    smartRoute,
    isOffline: !online,
    locationSource: userLocation.source,
    warning,
  };
}
