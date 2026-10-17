// Routing accuracy — the defects found by auditing 589 sampled trips, pinned
// so they cannot come back quietly.
//
// The engine used to minimise minutes alone. Fare never entered the search,
// five of six search passes charged nothing for changing vehicle, doubt about
// a line vetoed whole options instead of costing them, the BRT sat in the full
// rush-hour go-slow despite its lane, and the times shown left out waiting.
// Each block below is one of those.

import { calculateSmartRoute, RouteOption } from '../smartRoutingService';
import { STOP_BY_ID, GRAPH_STOPS } from '../../data/lagosRoutes';
import { haversineKm } from '../routeGraph';

type Stop = (typeof GRAPH_STOPS)[number];

// Weekday times in local time, the way the other suites build them.
const FRI_0730 = new Date(2026, 9, 16, 7, 30);
const FRI_1200 = new Date(2026, 9, 16, 12, 0);

const route = (a: Stop, b: Stop, at: Date) =>
  calculateSmartRoute(a.latitude, a.longitude, a.name, b.latitude, b.longitude, b.name, { departAt: at });
const rec = (r: ReturnType<typeof route>): RouteOption => r.options.find((o) => o.id === r.recommendedOptionId)!;
const stop = (id: string) => {
  const s = STOP_BY_ID[id];
  if (!s) throw new Error(`no stop ${id}`);
  return s;
};
const uses = (o: RouteOption, mode: string) => o.legs.some((l) => l.mode === mode);

/** Anything we are not sure of: an unconfirmed line, a leg that may not run, a guessed bus. */
const doubtful = (o: RouteOption) =>
  o.tags.includes('Unverified')
  || o.legs.some((l) => l.mayBeUnavailable || (!l.corridorId && (l.mode === 'danfo' || l.mode === 'brt' || l.mode === 'rail')));
const formal = (o: RouteOption) => uses(o, 'brt') || uses(o, 'rail');

describe('the recommendation is never beaten outright by another option we offer', () => {
  // Deterministic sample so a failure names the same trips every run.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const pairs: [Stop, Stop][] = [];
  while (pairs.length < 150) {
    const a = GRAPH_STOPS[Math.floor(rnd() * GRAPH_STOPS.length)];
    const b = GRAPH_STOPS[Math.floor(rnd() * GRAPH_STOPS.length)];
    if (a.id !== b.id && haversineKm(a, b) >= 1.5) pairs.push([a, b]);
  }

  it.each([['midday', FRI_1200], ['morning rush', FRI_0730]])('%s', (_label, at) => {
    const beaten: string[] = [];
    for (const [a, b] of pairs) {
      const r = route(a, b, at);
      if (!r.options.length) continue;
      const o = rec(r);
      // "Beaten" = cheaper, faster and no more changes, with nothing about it
      // we doubt, and not merely trading away the BRT/rail preference.
      const better = r.options.find((alt) => alt.id !== o.id
        && alt.totalPriceMax < o.totalPriceMax
        && alt.totalDurationMins < o.totalDurationMins
        && alt.transfers <= o.transfers
        && !doubtful(alt)
        && (formal(alt) || !formal(o)));
      if (better) beaten.push(`${a.name} -> ${b.name}: ${o.name} lost to ${better.name}`);
    }
    expect(beaten).toEqual([]);
  });
});

describe('the BRT lane counts in the rush hour', () => {
  it('Ikorodu → Obalende at 7:30 rides the BRT, not a danfo down the same road', () => {
    const o = rec(route(stop('ikorodu'), stop('obalende'), FRI_0730));
    expect(uses(o, 'brt')).toBe(true);
  });

  it('Oshodi → CMS at 7:30 changes to the BRT rather than sitting in a danfo the whole way', () => {
    const o = rec(route(stop('oshodi'), stop('cms'), FRI_0730));
    expect(uses(o, 'brt')).toBe(true);
    expect(o.totalDurationMins).toBeLessThan(100);
  });
});

describe('a short hop is a danfo, not a BRT queue', () => {
  it('Ketu → Ojota (one stop) is the danfo', () => {
    const o = rec(route(stop('ketu'), stop('ojota'), FRI_1200));
    expect(uses(o, 'brt')).toBe(false);
    expect(uses(o, 'danfo')).toBe(true);
  });
});

describe('times include waiting to board', () => {
  it.each([
    ['ikorodu', 'obalende'],
    ['oshodi', 'cms'],
    ['ketu', 'ojota'],
  ])('%s → %s', (a, b) => {
    for (const o of route(stop(a), stop(b), FRI_1200).options) {
      const rides = o.legs.filter((l) => l.mode !== 'walk').length;
      const legMins = o.legs.reduce((m, l) => m + l.durationMins, 0);
      expect(o.waitMins ?? 0).toBeGreaterThanOrEqual(rides > 0 ? 2 : 0);
      expect(o.totalDurationMins).toBe(legMins + (o.waitMins ?? 0));
    }
  });
});

describe('a long danfo run is not priced like a short one', () => {
  it('no danfo leg over 40 km is quoted at the old flat ₦800 ceiling', () => {
    const o = rec(route(stop('epe'), stop('ajah'), FRI_1200));
    const long = o.legs.filter((l) => l.mode === 'danfo' && l.fareSource === 'band' && l.distanceKm > 40);
    for (const l of long) expect(l.priceMax).toBeGreaterThan(1000);
  });
});

describe('no pointless round trips', () => {
  // From a rider's report (17 Oct 2026): starting north of Berger on the
  // expressway side, going to Ojodu Berger, the app sent them by bus to
  // Berger and then on a keke from Berger to Ogba and straight back to
  // Berger — "once you get to ojodu berger you dont need to enter keke again".
  it('a trip that arrives at Berger ends at Berger', () => {
    const r = calculateSmartRoute(6.704, 3.405, 'Your location', 6.644, 3.364, 'Ojodu Berger', { departAt: FRI_0730 });
    const o = rec(r);
    const rides = o.legs.filter((l) => l.mode !== 'walk');
    expect(rides).toHaveLength(1);
    expect(rides[0].to.name).toBe('Ojodu Berger');
    expect(uses(o, 'keke')).toBe(false);
  });

  it('no ride anywhere ends at the stop it started from', () => {
    let seed = 99;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const bad: string[] = [];
    for (let i = 0; i < 120; i++) {
      const s = GRAPH_STOPS[Math.floor(rnd() * GRAPH_STOPS.length)];
      const t = GRAPH_STOPS[Math.floor(rnd() * GRAPH_STOPS.length)];
      // Half the starts are off the network, where the widened search runs.
      const off = i % 2 ? 0 : 4 + rnd() * 5, th = rnd() * 6.28;
      const a = { latitude: s.latitude + (off / 111) * Math.cos(th), longitude: s.longitude + (off / 110) * Math.sin(th) };
      if (haversineKm(a, t) < 1.5) continue;
      const r = calculateSmartRoute(a.latitude, a.longitude, 'A', t.latitude, t.longitude, t.name, { departAt: FRI_1200 });
      for (const o of r.options) {
        for (const l of o.legs) {
          if (l.mode !== 'walk' && l.fromStopId && l.fromStopId === l.toStopId) bad.push(`${l.mode} ${l.from.name} -> ${l.to.name} on ${l.corridorId}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('changing vehicle costs something', () => {
  it('Iyana-Ipaja → Obalende takes the one LAMATA bus that runs it, not a chain', () => {
    const o = rec(route(stop('iyana_ipaja'), stop('obalende'), FRI_0730));
    expect(o.transfers).toBe(0);
  });
});
