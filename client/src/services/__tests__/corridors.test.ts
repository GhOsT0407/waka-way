// Golden trips for the corridor graph: a bus leg must follow a real line,
// and the stops it names must be the ones a Lagosian would name.

import { calculateSmartRoute, RouteOption } from '../smartRoutingService';
import { CORRIDORS, GRAPH_STOPS, STOP_BY_ID } from '../../data/lagosRoutes';
import { searchGraph } from '../routeGraph';

const P = {
  sabo:       { lat: 6.5244, lng: 3.3792, name: 'Sabo, Yaba' },
  ojuelegba:  { lat: 6.5075, lng: 3.3640, name: 'Ojuelegba' },
  ikeja:      { lat: 6.5965, lng: 3.3480, name: 'Ikeja' },
  cms:        { lat: 6.4555, lng: 3.3938, name: 'CMS' },
  gbagada:    { lat: 6.5540, lng: 3.3890, name: 'Gbagada' },
  lekki1:     { lat: 6.4370, lng: 3.4560, name: 'Lekki Phase 1' },
  ajah:       { lat: 6.4675, lng: 3.5701, name: 'Ajah' },
  festac:     { lat: 6.4700, lng: 3.2860, name: 'Festac' },
  ikotun:     { lat: 6.5480, lng: 3.2678, name: 'Ikotun' },
  ikorodu:    { lat: 6.6194, lng: 3.5105, name: 'Ikorodu' },
  berger:     { lat: 6.6440, lng: 3.3640, name: 'Ojodu Berger' },
  epe:        { lat: 6.5850, lng: 3.9750, name: 'Epe' },
  badagry:    { lat: 6.4150, lng: 2.8850, name: 'Badagry' },
};
type Pt = { lat: number; lng: number; name: string };
// A fixed weekday off-peak departure, as modeMix.test.ts does. Without one the
// suite planned at whatever time it ran, so a morning-rush run could pick the
// rush-hour BRT and fail a midday expectation.
const TUE_1100 = new Date(2026, 8, 22, 11, 0);
const route = (a: Pt, b: Pt) => calculateSmartRoute(a.lat, a.lng, a.name, b.lat, b.lng, b.name, { departAt: TUE_1100 });
const rec = (r: ReturnType<typeof route>): RouteOption => r.options.find((o) => o.id === r.recommendedOptionId)!;
const stopNames = (o: RouteOption) => o.legs.flatMap((l) => [l.from.name, ...(l.viaStops ?? []), l.to.name]);
const busLegs = (o: RouteOption) => o.legs.filter((l) => l.mode === 'danfo' || l.mode === 'brt' || l.mode === 'rail');

describe('corridor data integrity', () => {
  it('every corridor stop exists and every stop sits inside Lagos', () => {
    for (const c of CORRIDORS) for (const id of c.stops) expect(STOP_BY_ID[id]).toBeDefined();
    for (const s of GRAPH_STOPS) {
      expect(s.latitude).toBeGreaterThan(6.35); expect(s.latitude).toBeLessThan(6.75);
      expect(s.longitude).toBeGreaterThan(2.70); expect(s.longitude).toBeLessThan(4.05);
    }
  });

  it('consecutive stops are never more than 22 km apart (Third Mainland 10.8, Ibeju → Epe 13.1, Badagry → Seme 17.6, Ikorodu → Agbowa 21)', () => {
    const km = (a: string, b: string) => {
      const A = STOP_BY_ID[a], B = STOP_BY_ID[b];
      const t = (x: number) => (x * Math.PI) / 180;
      const h = Math.sin(t(B.latitude - A.latitude) / 2) ** 2 + Math.cos(t(A.latitude)) * Math.cos(t(B.latitude)) * Math.sin(t(B.longitude - A.longitude) / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(h));
    };
    for (const c of CORRIDORS) for (let i = 0; i < c.stops.length - 1; i++) {
      expect(km(c.stops[i], c.stops[i + 1])).toBeLessThan(22);
    }
  });

  it('the Ikorodu Road BRT runs south in the right order', () => {
    const brt = CORRIDORS.find((c) => c.id === 'brt_ikorodu_tbs')!;
    const idx = (id: string) => brt.stops.indexOf(id);
    expect(idx('ketu')).toBeLessThan(idx('ojota'));
    expect(idx('ojota')).toBeLessThan(idx('maryland'));
    expect(idx('maryland')).toBeLessThan(idx('anthony'));
    expect(idx('anthony')).toBeLessThan(idx('fadeyi'));
    expect(idx('fadeyi')).toBeLessThan(idx('ojuelegba'));
    expect(idx('ojuelegba')).toBeLessThan(idx('cms'));
    expect(brt.stops).not.toContain('gbagada');
    expect(brt.stops).not.toContain('yaba');
  });
});

describe('bus legs follow real corridors', () => {
  it('every bus leg names a corridor and its stops are on that corridor', () => {
    const trips = [route(P.sabo, P.gbagada), route(P.ikeja, P.cms), route(P.festac, P.ikeja), route(P.ikotun, P.lekki1), route(P.ikorodu, P.cms)];
    for (const t of trips) for (const o of t.options) for (const l of busLegs(o)) {
      if (o.tags.includes('Unverified')) continue;
      expect(l.corridorName).toBeTruthy();
      const c = CORRIDORS.find((x) => x.name === l.corridorName)!;
      const names = c.stops.map((id) => STOP_BY_ID[id].name);
      expect(names).toContain(l.from.name);
      expect(names).toContain(l.to.name);
    }
  });

  it('a bus leg is never drawn between two stops that no corridor connects', () => {
    // Every recommended bus leg's stop pair must be reachable along one corridor.
    const trips = [route(P.sabo, P.gbagada), route(P.lekki1, P.gbagada), route(P.festac, P.ikeja), route(P.cms, P.ajah)];
    for (const t of trips) for (const l of busLegs(rec(t))) {
      const c = CORRIDORS.find((x) => x.name === l.corridorName)!;
      const a = c.stops.findIndex((id) => STOP_BY_ID[id].name === l.from.name);
      const b = c.stops.findIndex((id) => STOP_BY_ID[id].name === l.to.name);
      expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeGreaterThanOrEqual(0);
      expect(Math.abs(a - b)).toBe(l.stopsSpanned);
    }
  });
});

describe('Gbagada, the trip that exposed the bug', () => {
  it('from Yaba goes via Bariga or Anthony/Oworonshoki — never Berger or Jibowu', () => {
    for (const o of route(P.sabo, P.gbagada).options) {
      const names = stopNames(o).join(' | ');
      expect(names).not.toMatch(/Berger|Jibowu/);
    }
    const names = route(P.sabo, P.gbagada).options.flatMap(stopNames).join(' | ');
    expect(names).toMatch(/Bariga|Anthony|Gbagada/);
  });

  it('from Ikeja rides to Anthony then Gbagada — never through CMS or Berger', () => {
    const o = rec(route(P.ikeja, P.gbagada));
    const names = stopNames(o).join(' | ');
    expect(names).toMatch(/Anthony|Maryland/);
    expect(names).not.toMatch(/CMS|Berger|Jibowu/);
  });

  it('from the Island comes over Third Mainland via Oworonshoki, or by BRT to Anthony', () => {
    const o = rec(route(P.lekki1, P.gbagada));
    expect(stopNames(o).join(' | ')).toMatch(/Oworonshoki|Anthony/);
  });
});

describe('well-known trips', () => {
  it('Ojuelegba → CMS is one bus down Western Avenue', () => {
    const o = rec(route(P.ojuelegba, P.cms));
    expect(busLegs(o)).toHaveLength(1);
    expect(o.legs.some((l) => l.mode === 'keke')).toBe(false);
  });

  it('Festac → Ikeja goes through Mile 2 and Oshodi', () => {
    expect(stopNames(rec(route(P.festac, P.ikeja))).join(' | ')).toMatch(/Mile 2.*Oshodi/);
  });

  it('Ikotun → Lekki goes through Oshodi and reaches the Island by bus', () => {
    const names = stopNames(rec(route(P.ikotun, P.lekki1))).join(' | ');
    expect(names).toMatch(/Oshodi/);
    expect(names).toMatch(/CMS|Obalende/);
  });

  it('Ikorodu → CMS is the BRT or Ikorodu Road, not a chain of tiny hops', () => {
    const o = rec(route(P.ikorodu, P.cms));
    expect(busLegs(o).length).toBeLessThanOrEqual(2);
    for (const l of busLegs(o)) expect(l.distanceKm).toBeGreaterThan(5);
  });

  it('Ajah → Epe rides the Lekki-Epe expressway', () => {
    expect(stopNames(rec(route(P.ajah, P.epe))).join(' | ')).toMatch(/Sangotedo|Awoyaya|Eleko/);
  });

  it('Badagry → CMS comes through Mile 2', () => {
    expect(stopNames(rec(route(P.badagry, P.cms))).join(' | ')).toMatch(/Mile 2/);
  });
});

describe('when the network does not reach', () => {
  it('says so instead of inventing a bus', () => {
    const r = calculateSmartRoute(6.7300, 3.2650, 'Rock Canaan, Ota road', P.cms.lat, P.cms.lng, 'CMS');
    // Real lines, reached by at most a short hop to a stop we know — or no
    // route at all. Never one made-up bus for the whole trip, which is what
    // the old "Ask at the park" card amounted to on screen.
    for (const o of r.options) {
      const lines = busLegs(o).filter((l) => l.corridorName);
      const guessed = busLegs(o).filter((l) => !l.corridorName);
      expect(lines.length).toBeGreaterThan(0);
      expect(guessed.length).toBeLessThanOrEqual(2);
      for (const l of guessed) expect(l.distanceKm).toBeLessThanOrEqual(13);
    }
  });

  it('a start far outside the network gets no route, not a guess', () => {
    const r = calculateSmartRoute(6.9, 3.9, 'Far away', P.cms.lat, P.cms.lng, 'CMS');
    expect(r.options).toHaveLength(0);
  });

  it('the raw graph returns nothing for a point far outside the network', () => {
    expect(searchGraph({ latitude: 6.9, longitude: 3.9 }, { latitude: P.cms.lat, longitude: P.cms.lng })).toHaveLength(0);
  });
});

describe('keke feeders', () => {
  const ogba = { lat: 6.6325, lng: 3.3417, name: 'Ogba' };
  it('Ojota → Ogba is a bus to Berger and a keke onward, not a second bus', () => {
    const ojota = { lat: 6.5880, lng: 3.3860, name: 'Ojota' };
    const o = rec(route(ojota, ogba));
    expect(stopNames(o).join(' | ')).toMatch(/Berger/);
    const last = o.legs[o.legs.length - 1];
    expect(last.mode).toBe('keke');
    expect(last.mayBeUnavailable).toBeFalsy();
  });
  it('Ikeja → Ogba stays on the Ikeja side, no Berger', () => {
    const o = rec(route(P.ikeja, ogba));
    expect(stopNames(o).join(' | ')).not.toMatch(/Berger/);
  });
});
