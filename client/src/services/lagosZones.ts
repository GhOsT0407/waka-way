/**
 * Lagos restriction zones — is a keke or okada hop legal here?
 *
 * Point-in-polygon against the LGA rings in data/lagosZones.ts. A hop is
 * checked at both ends and its midpoint, so a leg that starts and ends
 * outside a banned LGA but cuts through one is still caught.
 *
 * Ban lists (see wakaway/Routes Data Research.md):
 *   keke + okada, six LGAs, since 1 Feb 2020 — Apapa, Lagos Mainland,
 *     Surulere, Ikeja, Eti-Osa, Lagos Island
 *   okada only, four more since 1 Sep 2022 — Kosofe, Oshodi-Isolo,
 *     Shomolu, Mushin
 */

import { RESTRICTED_LGAS, Zone } from '../data/lagosZones';

function inRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    const crosses = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** The restricted LGA containing a point, or null if it is in none of them. */
export function zoneAt(lat: number, lng: number): Zone | null {
  for (const z of RESTRICTED_LGAS) {
    if (inRing(lat, lng, z.ring)) return z;
  }
  return null;
}

type Hop = { fromLat: number; fromLng: number; toLat: number; toLng: number };

function samples({ fromLat, fromLng, toLat, toLng }: Hop): [number, number][] {
  return [
    [fromLat, fromLng],
    [(fromLat + toLat) / 2, (fromLng + toLng) / 2],
    [toLat, toLng],
  ];
}

/** True if any part of the hop lies in an LGA where keke is banned from major roads. */
export function isKekeRestricted(hop: Hop): boolean {
  return samples(hop).some(([la, ln]) => zoneAt(la, ln)?.kekeRestricted ?? false);
}

/** True if any part of the hop lies in an LGA where okada is totally banned. */
export function isOkadaBanned(hop: Hop): boolean {
  return samples(hop).some(([la, ln]) => zoneAt(la, ln)?.okadaBanned ?? false);
}
