import { CORRIDORS, STOP_BY_ID, type GraphStop } from '../data/lagosRoutes';
import { CORRIDOR_SHAPES } from '../data/corridorShapes';
import type { RouteLeg } from './smartRoutingService';
import { haversineKm, distanceToSegmentKm, type LatLng } from '../utils/geo';

/**
 * Where a leg goes on the map, from the corridor data itself. A directions
 * API would draw a car's road between the leg's ends, not the danfo's, and
 * would need the rider's position sent to a third party (ADR 0014). Instead
 * each hop between two consecutive stops has its road (or track) shape
 * fetched once, ahead of time, and shipped as data (ADR 0015) — so the line
 * follows the corridor stop by stop and nothing leaves the device.
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

/** An encoded polyline (Google's format, precision 5) as points. */
export function decodePolyline(str: string): LatLng[] {
  const out: LatLng[] = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (let which = 0; which < 2; which++) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lng += d;
    }
    out.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return out;
}

const decoded = new Map<string, LatLng[]>();

/** The road between two consecutive stops, in travel order; just the two stops when none was fetched. */
function hopShape(a: GraphStop, b: GraphStop): LatLng[] {
  const key = `${a.id}>${b.id}`;
  if (!decoded.has(key)) {
    const forward = CORRIDOR_SHAPES[key];
    const backward = CORRIDOR_SHAPES[`${b.id}>${a.id}`];
    decoded.set(key,
      forward ? decodePolyline(forward)
        : backward ? decodePolyline(backward).reverse()
          : [{ latitude: a.latitude, longitude: a.longitude }, { latitude: b.latitude, longitude: b.longitude }]);
  }
  return decoded.get(key)!;
}

/**
 * How far back from a stop a retraced stretch is looked for (a car can run a
 * kilometre or two up an expressway to the next turn-round), and how close
 * counts as the same road.
 */
const SPUR_KM = 2.5;
const SAME_ROAD_KM = 0.04;
/** Shorter than this, a retrace is too small to see; the line keeps touching the stop. */
const VISIBLE_SPUR_KM = 0.03;
/** After a cut, the stop must still sit this close to the line. */
const STOP_ON_LINE_KM = 0.06;

/**
 * Two hops joined at the stop where one ends and the next begins. A stop
 * pinned a little off the road makes the first hop run in to the pin and the
 * next run back out the same way — a spur poking out of the line. Where the
 * next hop retraces the last one, the line is cut back to the point the two
 * share. A cut that would leave the stop's dot off the line is worse than
 * the spur, so only cuts that still pass the stop are taken.
 */
function joinAtStop(line: LatLng[], hop: LatLng[]): LatLng[] {
  const stop = hop[0];
  let back = 0;
  // Walk back from the stop; keep the furthest point the next hop also
  // passes a short way out of the stop.
  let cut: { i: number; j: number } | null = null;
  for (let i = line.length - 2; i >= 0; i--) {
    back += haversineKm(line[i], line[i + 1]);
    if (back > SPUR_KM) break;
    if (back < VISIBLE_SPUR_KM) continue;
    let ahead = 0;
    for (let j = 1; j < hop.length; j++) {
      ahead += haversineKm(hop[j - 1], hop[j]);
      if (ahead > SPUR_KM) break;
      if (distanceToSegmentKm(line[i], hop[j - 1], hop[j]) < SAME_ROAD_KM) {
        if (distanceToSegmentKm(stop, line[i], hop[j]) <= STOP_ON_LINE_KM) cut = { i, j };
        break;
      }
    }
  }
  return cut ? [...line.slice(0, cut.i + 1), ...hop.slice(cut.j)] : [...line, ...hop.slice(1)];
}

/**
 * The same spur where a leg ends: the road runs past the stop and loops back
 * to the pin. Cut at the closest pass to the stop, then a short step onto it.
 */
function trimEnd(line: LatLng[]): LatLng[] {
  const stop = line[line.length - 1];
  let back = 0;
  let cut = -1, closest = STOP_ON_LINE_KM;
  for (let i = line.length - 2; i > 0; i--) {
    back += haversineKm(line[i], line[i + 1]);
    if (back > SPUR_KM) break;
    if (back < VISIBLE_SPUR_KM) continue;
    const d = distanceToSegmentKm(stop, line[i - 1], line[i]);
    if (d < closest) { closest = d; cut = i; }
  }
  return cut < 0 ? line : [...line.slice(0, cut), closestOnSegment(stop, line[cut - 1], line[cut]), stop];
}

/** The point of segment a–b nearest p (flat-earth; fine over a city block). */
function closestOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const dx = b.longitude - a.longitude, dy = b.latitude - a.latitude;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) / len2));
  return { latitude: a.latitude + t * dy, longitude: a.longitude + t * dx };
}

const trimBothEnds = (line: LatLng[]) => trimEnd(trimEnd(line).reverse()).reverse();

/** The road the leg rides, stop by stop; the leg's two ends when it has no corridor. */
export function legGeometry(leg: RouteLeg): LatLng[] {
  const stops = legStops(leg);
  if (stops.length >= 2) {
    let line = hopShape(stops[0], stops[1]);
    for (let i = 1; i < stops.length - 1; i++) line = joinAtStop(line, hopShape(stops[i], stops[i + 1]));
    return trimBothEnds(line);
  }
  return [
    { latitude: leg.from.latitude, longitude: leg.from.longitude },
    { latitude: leg.to.latitude, longitude: leg.to.longitude },
  ];
}
