import { haversineKm, type LatLng } from '../services/routeGraph';

export { haversineKm };
export type { LatLng };

export function haversineM(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000;
}

export function formatMeters(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Straight-line distance from a point to a segment, km — good enough to say "near this leg". */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const ax = a.longitude, ay = a.latitude, bx = b.longitude, by = b.latitude, px = p.longitude, py = p.latitude;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return haversineKm(p, { latitude: ay + t * dy, longitude: ax + t * dx });
}
