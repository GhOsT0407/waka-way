/**
 * Lagos Connection Rules
 * 
 * Prevents impractical walking directions between locations
 * that are too far apart or have no pedestrian-friendly routes.
 * 
 * Example: Walking from Lekki Phase 1 to Victoria Island is not practical
 * even though they appear close on a map — you'd need to take a bus/danfo.
 */

import { TransportMode } from './routeValidator';

/** Locations where walking to certain destinations is NOT practical */
const NO_WALK_CONNECTIONS: Record<string, string[]> = {
  'Lekki Phase 1':   ['Victoria Island', 'Lagos Island', 'Ikoyi', 'CMS'],
  'Victoria Island':  ['Lekki Phase 1', 'Lagos Island', 'Ajah Under Bridge'],
  'Ojodu Berger':    ['Ikeja', 'Maryland', 'Ikeja Along', 'Allen Junction'],
  'Mile 2':          ['Lagos Island', 'CMS', 'Oshodi'],
  'Oshodi':          ['Mushin', 'Ikeja', 'Ikeja Along', 'Mile 2'],
  'CMS':             ['Lekki Phase 1', 'Ajah Under Bridge', 'Mile 2'],
  'Obalende':        ['Lekki Phase 1', 'Ajah Under Bridge'],
  'Yaba':            ['Ikeja', 'Ojodu Berger', 'Lekki Phase 1'],
  'Maryland':        ['Ojodu Berger', 'Lekki Phase 1', 'Ajah Under Bridge'],
  'Ajah Under Bridge': ['Victoria Island', 'CMS', 'Obalende', 'Yaba'],
  'Ikoyi':           ['Lekki Phase 1', 'Ajah Under Bridge', 'Yaba'],
  'Costain':         ['Ikeja', 'Ojodu Berger', 'Lekki Phase 1'],
  'Ikeja Along':     ['Lekki Phase 1', 'Victoria Island', 'CMS', 'Oshodi'],
  'Sangotedo':       ['Victoria Island', 'CMS', 'Yaba', 'Ikeja'],
};

/** When walking is blocked, force this specific mode between two locations */
const FORCED_MODE_CONNECTIONS: Record<string, Record<string, TransportMode>> = {
  'Lekki Phase 1': {
    'Victoria Island': TransportMode.DANFO,
    'Lagos Island':    TransportMode.DANFO,
    'Ikoyi':           TransportMode.DANFO,
    'CMS':             TransportMode.DANFO,
  },
  'Ojodu Berger': {
    'Ikeja':           TransportMode.DANFO,
    'Maryland':        TransportMode.DANFO,
    'Ikeja Along':     TransportMode.DANFO,
  },
  'Oshodi': {
    'Ikeja':           TransportMode.DANFO,
    'Ikeja Along':     TransportMode.DANFO,
  },
};

/**
 * Check if walking between two named locations is practical in Lagos.
 * 
 * @returns isValid: true if walking is fine, false if not (with a suggested mode)
 */
export function validateLagosConnection(from: string, to: string): {
  isValid: boolean;
  suggestedMode?: TransportMode;
} {
  // Check from → to
  const noWalkTargets = NO_WALK_CONNECTIONS[from];
  if (noWalkTargets?.includes(to)) {
    const suggestedMode = FORCED_MODE_CONNECTIONS[from]?.[to] ?? TransportMode.DANFO;
    return { isValid: false, suggestedMode };
  }

  // Check reverse direction (to → from)
  const reverseTargets = NO_WALK_CONNECTIONS[to];
  if (reverseTargets?.includes(from)) {
    const suggestedMode = FORCED_MODE_CONNECTIONS[to]?.[from] ?? TransportMode.DANFO;
    return { isValid: false, suggestedMode };
  }

  return { isValid: true };
}

/**
 * Map the enum TransportMode to the lowercase smartRoutingService mode string.
 */
export function toSmartRouteMode(mode: TransportMode): 'walk' | 'keke' | 'okada' | 'danfo' | 'brt' | 'ferry' {
  switch (mode) {
    case TransportMode.WALK:  return 'walk';
    case TransportMode.KEKE:  return 'keke';
    case TransportMode.OKADA: return 'okada';
    case TransportMode.DANFO: return 'danfo';
    case TransportMode.BRT:   return 'brt';
    case TransportMode.FERRY: return 'ferry';
    default:                  return 'danfo';
  }
}

// ============================================================
// OKADA BAN ZONES
// ============================================================

/**
 * Zones where Okada (motorcycle taxis) are banned or restricted.
 * Lagos State banned okada in many LGAs effective 2020/2024.
 * See: Lagos State Okada & Keke Ban policy.
 */
const OKADA_BANNED_ZONES: string[] = [
  // Lagos Island & surrounds
  'Lagos Island',
  'Victoria Island',
  'Ikoyi',
  'CMS',
  'Obalende',
  'Lekki Phase 1',
  // Mainland major areas
  'Ikeja',
  'Ikeja Along',
  'Ikeja GRA',
  'Allen Junction',
  'Maryland',
  'Oshodi',
  'Surulere',
  'Apapa',
  'Costain',
  'Eko Bridge',
  // Lekki-Epe corridor
  'Chevron',
  'VGC',
  'Ajah Under Bridge',
];

/**
 * Check if Okada is allowed between two locations.
 * Returns false if either location is in an okada-banned zone.
 */
export function isOkadaAllowed(from: string, to: string): boolean {
  const fromBanned = OKADA_BANNED_ZONES.some(
    zone => from.toLowerCase().includes(zone.toLowerCase()) || zone.toLowerCase().includes(from.toLowerCase())
  );
  const toBanned = OKADA_BANNED_ZONES.some(
    zone => to.toLowerCase().includes(zone.toLowerCase()) || zone.toLowerCase().includes(to.toLowerCase())
  );
  return !fromBanned && !toBanned;
}
