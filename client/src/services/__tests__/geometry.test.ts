// The map line for a leg: road shapes between consecutive stops (ADR 0015),
// a straight line wherever no shape was kept, and always meeting the stops.

import { legGeometry, decodePolyline } from '../routeGeometry';
import { CORRIDOR_SHAPES } from '../../data/corridorShapes';
import { CORRIDORS, STOP_BY_ID } from '../../data/lagosRoutes';
import { haversineKm } from '../routeGraph';
import { distanceToSegmentKm } from '../../utils/geo';
import type { RouteLeg } from '../smartRoutingService';

const leg = (corridorId: string, fromStopId: string, toStopId: string): RouteLeg => {
  const a = STOP_BY_ID[fromStopId], b = STOP_BY_ID[toStopId];
  return {
    mode: CORRIDORS.find((c) => c.id === corridorId)!.mode,
    corridorId, fromStopId, toStopId,
    from: { latitude: a.latitude, longitude: a.longitude, name: a.name },
    to: { latitude: b.latitude, longitude: b.longitude, name: b.name },
  } as RouteLeg;
};

describe('decodePolyline', () => {
  it('reads Google’s reference example', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      { latitude: 38.5, longitude: -120.2 },
      { latitude: 40.7, longitude: -120.95 },
      { latitude: 43.252, longitude: -126.453 },
    ]);
  });
});

describe('corridor shapes', () => {
  const hops = new Set(CORRIDORS.flatMap((c) => c.stops.slice(1).map((s, i) => `${c.stops[i]}>${s}`)));

  it.each(Object.keys(CORRIDOR_SHAPES))('%s joins two consecutive stops and stays near them', (key) => {
    expect(hops.has(key)).toBe(true);
    const [from, to] = key.split('>').map((id) => STOP_BY_ID[id]);
    const pts = decodePolyline(CORRIDOR_SHAPES[key]);
    // Starts and ends on the stops themselves (to the encoding's ~1 m).
    expect(haversineKm(pts[0], from)).toBeLessThan(0.005);
    expect(haversineKm(pts[pts.length - 1], to)).toBeLessThan(0.005);
    // No wild detour: nothing strays further from both stops than the hop is long, plus a margin.
    const span = haversineKm(from, to);
    for (const p of pts) expect(Math.min(haversineKm(p, from), haversineKm(p, to))).toBeLessThan(span + 1);
  });
});

describe('legGeometry', () => {
  it('follows the road between stops rather than a straight chain', () => {
    const l = leg('brt_ikorodu_tbs', 'ikorodu', 'mile12');
    const pts = legGeometry(l);
    const stops = CORRIDORS.find((c) => c.id === 'brt_ikorodu_tbs')!.stops;
    expect(pts.length).toBeGreaterThan(stops.indexOf('mile12') + 1);
    expect(haversineKm(pts[0], STOP_BY_ID.ikorodu)).toBeLessThan(0.005);
    expect(haversineKm(pts[pts.length - 1], STOP_BY_ID.mile12)).toBeLessThan(0.005);
  });

  it('draws a leg ridden against the stored direction along the same road', () => {
    const there = legGeometry(leg('brt_ikorodu_tbs', 'ikorodu', 'mile12'));
    const back = legGeometry(leg('brt_ikorodu_tbs', 'mile12', 'ikorodu'));
    expect(haversineKm(back[0], STOP_BY_ID.mile12)).toBeLessThan(0.005);
    expect(haversineKm(back[back.length - 1], STOP_BY_ID.ikorodu)).toBeLessThan(0.005);
    // Spur trimming works from the direction of travel, so the two may differ
    // by a few metres where a stop sits off the road — never by a street.
    const offLine = (p: { latitude: number; longitude: number }, line: typeof there) =>
      Math.min(...line.slice(1).map((q, i) => distanceToSegmentKm(p, line[i], q)));
    for (const p of back) expect(offLine(p, there)).toBeLessThan(0.04);
  });

  it('keeps every stop on the line, spurs trimmed or not', () => {
    for (const c of CORRIDORS) {
      const [a, b] = [c.stops[0], c.stops[c.stops.length - 1]];
      const pts = legGeometry(leg(c.id, a, b));
      for (const id of c.stops) {
        const d = Math.min(...pts.slice(1).map((q, i) => distanceToSegmentKm(STOP_BY_ID[id], pts[i], q)));
        expect(d).toBeLessThan(0.065);
      }
    }
  });

  it('passes through every stop it rides', () => {
    const pts = legGeometry(leg('rail_red', 'rail_agbado', 'rail_oyingbo'));
    for (const id of CORRIDORS.find((c) => c.id === 'rail_red')!.stops) {
      const nearest = Math.min(...pts.map((p) => haversineKm(p, STOP_BY_ID[id])));
      expect(nearest).toBeLessThan(0.005);
    }
  });

  it('falls back to the leg’s two ends when it has no corridor', () => {
    const walk = { mode: 'walk', from: { latitude: 6.5, longitude: 3.3 }, to: { latitude: 6.51, longitude: 3.31 } } as RouteLeg;
    expect(legGeometry(walk)).toEqual([{ latitude: 6.5, longitude: 3.3 }, { latitude: 6.51, longitude: 3.31 }]);
  });
});
