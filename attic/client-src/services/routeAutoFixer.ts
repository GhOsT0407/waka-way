/**
 * Route Auto-Fixer
 * 
 * Takes a route's legs and automatically fixes invalid ones:
 * - Blocks okada in banned Lagos zones
 * - Checks Lagos-specific no-walk rules
 * - Validates transport mode vs distance/position
 * - Replaces invalid modes with practical fallbacks
 * - Removes useless 0km walk legs
 */

import { RouteLeg, TransportMode, isValidLeg } from './routeValidator';
import { isOkadaAllowed } from './lagosRouteRules';

/**
 * Pick a fallback transport mode based on distance and position.
 * Respects okada banned zones.
 */
function getFallbackMode(leg: RouteLeg, isFirstLeg: boolean): TransportMode {
  if (isFirstLeg) {
    if (leg.distanceKm <= 1.0 && isOkadaAllowed(leg.from, leg.to)) return 'okada';
    if (leg.distanceKm <= 5.0) return 'keke';
  }
  return 'danfo';
}

/**
 * Validate and auto-fix a route's legs.
 * 
 * - Blocks okada in banned zones (downgrades to keke)
 * - Checks Lagos connection rules (no walking Lekki Phase 1 → VI, etc.)
 * - Validates each leg against transport distance/position rules
 * - Replaces invalid modes with practical fallbacks
 * - Removes 0km walk legs entirely
 * 
 * @returns A new array of fixed legs (does not mutate the input)
 */
export function validateRoute(legs: RouteLeg[]): RouteLeg[] {
  return legs
    .map((leg, index) => {
      const isFirstLeg = index === 0;

      // 1. Block Okada in banned zones — downgrade immediately
      if (leg.mode === 'okada' && !isOkadaAllowed(leg.from, leg.to)) {
        return { ...leg, mode: 'keke' as TransportMode };
      }

      // 2. Check general transport rules
      if (!isValidLeg(leg, isFirstLeg)) {
        const fallback = getFallbackMode(leg, isFirstLeg);
        return { ...leg, mode: fallback };
      }

      return leg;
    })
    .filter((leg) => {
      // Remove 0km walk legs entirely
      const isUselessWalk = leg.mode === 'walk' && leg.distanceKm === 0;
      return !isUselessWalk;
    });
}
