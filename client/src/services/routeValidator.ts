/**
 * Route Validator
 *
 * Transport mode rules and leg validation for Lagos routing.
 */

import type { TransportMode } from '../types/routing';

export type { TransportMode };

/** Distance and position constraints per transport mode */
const TRANSPORT_RULES: Partial<Record<TransportMode, { minKm: number; maxKm: number; firstLegOnly: boolean }>> = {
  walk:  { minKm: 0.0, maxKm: 0.5,  firstLegOnly: false },
  keke:  { minKm: 0.5, maxKm: 5.0,  firstLegOnly: true  },
  okada: { minKm: 0.5, maxKm: 8.0,  firstLegOnly: true  },
  danfo: { minKm: 3.0, maxKm: 50.0, firstLegOnly: false },
  brt:   { minKm: 5.0, maxKm: 60.0, firstLegOnly: false },
};

export interface RouteLeg {
  mode: TransportMode;
  distanceKm: number;
  durationMin: number;
  from: string;
  to: string;
  cost?: { min: number; max: number };
}

/**
 * Validate a single route leg against transport rules.
 * Checks that the mode is appropriate for the distance and leg position.
 */
export function isValidLeg(leg: RouteLeg, isFirstLeg: boolean): boolean {
  const rule = TRANSPORT_RULES[leg.mode];
  if (!rule) return false;

  const withinDistance = leg.distanceKm >= rule.minKm && leg.distanceKm <= rule.maxKm;
  const firstLegCheck = rule.firstLegOnly ? isFirstLeg : true;

  return withinDistance && firstLegCheck;
}
