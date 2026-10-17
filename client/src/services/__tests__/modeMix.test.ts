// The complaint that started this file: "every destination only uses danfo".
// These trips have a BRT, a train or a keke as the real answer, and the
// engine must both OFFER it and, where it is the better ride, RECOMMEND it.

import { calculateSmartRoute, RouteOption } from '../smartRoutingService';
import { trafficFactor } from '../routeGraph';

const P = {
  ikorodu:  { lat: 6.6194, lng: 3.5105, name: 'Ikorodu' },
  ketu:     { lat: 6.5981, lng: 3.3868, name: 'Ketu' },
  cms:      { lat: 6.4555, lng: 3.3938, name: 'CMS' },
  mile2:    { lat: 6.4599, lng: 3.3117, name: 'Mile 2' },
  oshodi:   { lat: 6.5560, lng: 3.3400, name: 'Oshodi' },
  abuleEgba:{ lat: 6.6400, lng: 3.2820, name: 'Abule-Egba' },
  ojuelegba:{ lat: 6.5075, lng: 3.3640, name: 'Ojuelegba' },
  ojota:    { lat: 6.5880, lng: 3.3860, name: 'Ojota' },
  ogba:     { lat: 6.6325, lng: 3.3417, name: 'Ogba' },
};
type Pt = { lat: number; lng: number; name: string };
// A weekday off-peak departure so the assertions don't depend on when the suite runs.
const TUE_1100 = new Date(2026, 8, 22, 11, 0);
const route = (a: Pt, b: Pt, at: Date = TUE_1100) =>
  calculateSmartRoute(a.lat, a.lng, a.name, b.lat, b.lng, b.name, { departAt: at });
const rec = (r: ReturnType<typeof route>): RouteOption => r.options.find((o) => o.id === r.recommendedOptionId)!;
const modesOf = (r: ReturnType<typeof route>) => new Set(r.options.flatMap((o) => o.legs.map((l) => l.mode)));
const rides = (o: RouteOption) => o.legs.filter((l) => l.mode !== 'walk').map((l) => l.mode);

describe('the BRT is offered and recommended along its own lane', () => {
  it('Ikorodu → CMS: BRT recommended, danfo offered as the cheaper alternative', () => {
    const r = route(P.ikorodu, P.cms);
    expect(modesOf(r).has('brt')).toBe(true);
    expect(modesOf(r).has('danfo')).toBe(true);
    expect(rides(rec(r))).toEqual(['brt']);
  });
  it('Ketu → CMS: BRT recommended', () => {
    expect(rides(rec(route(P.ketu, P.cms)))).toEqual(['brt']);
  });
  it('Oshodi → Abule-Egba: the Oshodi–Abule-Egba BRT, one ride', () => {
    expect(rides(rec(route(P.oshodi, P.abuleEgba)))).toEqual(['brt']);
  });
  it('Ojuelegba → Ikorodu: BRT beats changing danfos at Jibowu', () => {
    expect(rides(rec(route(P.ojuelegba, P.ikorodu)))).toEqual(['brt']);
  });
});

describe('the Blue Line is a real option', () => {
  it('Mile 2 → CMS offers the train and recommends it', () => {
    const r = route(P.mile2, P.cms);
    expect(modesOf(r).has('rail')).toBe(true);
    expect(rides(rec(r))[0]).toBe('rail');
  });
});

describe('keke is the answer where it is the answer', () => {
  it('Ojota → Ogba: bus to Berger, keke onward', () => {
    expect(rides(rec(route(P.ojota, P.ogba)))).toEqual(['danfo', 'keke']);
  });
});

describe('the clock', () => {
  it('no BRT at 01:00 — it stops at 22:00', () => {
    const night = new Date(2026, 8, 22, 1, 0);
    expect(modesOf(route(P.ikorodu, P.cms, night)).has('brt')).toBe(false);
    expect(rides(rec(route(P.ikorodu, P.cms, night)))).toEqual(['danfo']);
  });
  it('weekday peak is 40 % slower than off-peak; after midnight is faster', () => {
    expect(trafficFactor(new Date(2026, 8, 22, 8, 0))).toBe(1.4);
    expect(trafficFactor(new Date(2026, 8, 22, 13, 0))).toBe(1.0);
    expect(trafficFactor(new Date(2026, 8, 22, 1, 0))).toBe(0.8);
    expect(trafficFactor(new Date(2026, 8, 20, 13, 0))).toBe(0.9); // Sunday
  });
  it('peak hour lengthens a danfo trip but not the train leg', () => {
    const off = rec(route(P.ketu, P.cms));
    const peak = rec(route(P.ketu, P.cms, new Date(2026, 8, 22, 8, 0)));
    expect(peak.totalDurationMins).toBeGreaterThan(off.totalDurationMins);
    const railOff = route(P.mile2, P.cms).options.find((o) => o.legs.some((l) => l.mode === 'rail'))!;
    const railPeak = route(P.mile2, P.cms, new Date(2026, 8, 22, 8, 0)).options.find((o) => o.legs.some((l) => l.mode === 'rail'))!;
    const railLeg = (o: RouteOption) => o.legs.find((l) => l.mode === 'rail')!.durationMins;
    expect(railLeg(railPeak)).toBe(railLeg(railOff));
  });
});

describe('choice, not a single answer', () => {
  it('a trip along a BRT corridor gets at least two genuinely different options', () => {
    for (const [a, b] of [[P.ikorodu, P.cms], [P.ketu, P.cms], [P.oshodi, P.abuleEgba]] as [Pt, Pt][]) {
      const r = route(a, b);
      expect(r.options.length).toBeGreaterThanOrEqual(2);
      const sigs = new Set(r.options.map((o) => rides(o).join('>')));
      expect(sigs.size).toBeGreaterThanOrEqual(2);
    }
  });
});
