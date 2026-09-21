// The explanation layer: every option says how hard it is and why, every
// journey reads as numbered steps a newcomer can follow, fares say how much
// to trust them, and live reports attach to the leg they touch.

import { calculateSmartRoute, RouteOption, RouteLeg } from '../smartRoutingService';
import { journeySteps, explainJourney } from '../explainJourney';
import { fareTrust, routeTrouble, optionFare, CorridorSignal } from '../signals';
import { alertsAlongRoute, avoidPointsFrom, LiveAlert } from '../../hooks/useLiveAlerts';

// The pure helpers under test never touch the network; keep Supabase out of the suite.
jest.mock('../../lib/supabase', () => ({ supabase: { rpc: jest.fn(), from: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

const P = {
  ikorodu:  { lat: 6.6194, lng: 3.5105, name: 'Ikorodu' },
  cms:      { lat: 6.4555, lng: 3.3938, name: 'CMS' },
  obalende: { lat: 6.4496, lng: 3.4074, name: 'Obalende' },
  lekki1:   { lat: 6.4370, lng: 3.4560, name: 'Lekki Phase 1' },
  ojota:    { lat: 6.5880, lng: 3.3860, name: 'Ojota' },
  ogba:     { lat: 6.6325, lng: 3.3417, name: 'Ogba' },
  festac:   { lat: 6.4650, lng: 3.2830, name: 'Festac' },
  ikeja:    { lat: 6.5965, lng: 3.3480, name: 'Ikeja' },
};
type Pt = { lat: number; lng: number; name: string };
const TUE_1100 = new Date(2026, 8, 22, 11, 0);
const route = (a: Pt, b: Pt, extra: object = {}) =>
  calculateSmartRoute(a.lat, a.lng, a.name, b.lat, b.lng, b.name, { departAt: TUE_1100, ...extra });
const rec = (r: ReturnType<typeof route>): RouteOption => r.options.find((o) => o.id === r.recommendedOptionId)!;
const rides = (o: RouteOption) => o.legs.filter((l) => l.mode !== 'walk');
// Option ids are per call; compare journeys by what they ride.
const sig = (o: RouteOption) => o.legs.map((l) => `${l.mode}:${l.from.name}>${l.to.name}`).join('|');

describe('every option is rated and every role is assigned', () => {
  const trips: [Pt, Pt][] = [[P.ikorodu, P.cms], [P.ojota, P.ogba], [P.festac, P.ikeja], [P.obalende, P.lekki1]];
  it.each(trips)('%o → %o', (a, b) => {
    const r = route(a, b);
    for (const o of r.options) {
      expect(['easy', 'moderate', 'complex']).toContain(o.complexity);
      expect(o.transfers).toBe(Math.max(0, rides(o).length - 1));
      expect(o.complexityReasons.length).toBeGreaterThan(0);
      expect(o.walkMins).toBe(o.legs.filter((l) => l.mode === 'walk').reduce((m, l) => m + l.durationMins, 0));
    }
    expect(r.options.filter((o) => o.isCheapest)).toHaveLength(1);
    expect(r.options.filter((o) => o.isFastest)).toHaveLength(1);
    expect(r.options.filter((o) => o.isSimplest)).toHaveLength(1);
    expect(rec(r).recommendationReason).toBeTruthy();
  });

  it('one vehicle and a short walk is easy; two changes is complex', () => {
    const easy = route(P.ikorodu, P.cms).options.find((o) => o.transfers === 0 && o.walkMins <= 12);
    expect(easy?.complexity).toBe('easy');
    const complex = route(P.festac, P.ikeja).options.find((o) => o.transfers >= 2);
    if (complex) expect(complex.complexity).toBe('complex');
  });
});

describe('a newcomer is steered toward fewer changes, never more', () => {
  const trips: [Pt, Pt][] = [[P.ikorodu, P.cms], [P.ojota, P.ogba], [P.festac, P.ikeja], [P.obalende, P.lekki1], [P.ikeja, P.lekki1]];
  it.each(trips)('%o → %o', (a, b) => {
    const local = rec(route(a, b));
    const newcomer = rec(route(a, b, { newcomer: true }));
    expect(newcomer.transfers).toBeLessThanOrEqual(local.transfers);
    if (sig(newcomer) !== sig(local)) {
      expect(newcomer.recommendationReason).toMatch(/first time/);
      expect(newcomer.totalDurationMins - local.totalDurationMins).toBeLessThanOrEqual(15);
    }
  });
});

describe('legs carry what a friend would add', () => {
  it('a danfo corridor leg has a call, a terminal and stop ids; BRT has no conductor', () => {
    const r = route(P.ikorodu, P.cms);
    const brt = r.options.flatMap((o) => o.legs).find((l) => l.mode === 'brt')!;
    expect(brt.conductorCall).toBeUndefined();
    expect(brt.terminalName).toBeTruthy();
    expect(brt.fromStopId).toBeTruthy();
    expect(brt.corridorId).toBe('brt_ikorodu_tbs');
    expect(brt.fareSource).toBe('table');
    expect(brt.instruction).toMatch(/queue/i);
    const danfo = r.options.flatMap((o) => o.legs).find((l) => l.mode === 'danfo' && l.corridorId);
    if (danfo) {
      expect(danfo.conductorCall).toMatch(/\w+ \w+/);
      expect(danfo.instruction).toMatch(/Tell the conductor/);
    }
  });

  it('boarding at Obalende for Lekki says where to stand and what the place looks like', () => {
    const r = route(P.obalende, P.lekki1);
    const leg = r.options.flatMap((o) => o.legs).find((l) => l.fromStopId === 'obalende' && l.mode !== 'walk')!;
    expect(leg).toBeTruthy();
    expect(leg.landmark).toMatch(/Obalende bridge/);
    expect(leg.boardAt).toMatch(/Falomo end/);
  });

  it('never offers uber or bolt', () => {
    for (const [a, b] of [[P.ikorodu, P.cms], [P.festac, P.ikeja]] as [Pt, Pt][]) {
      const modes = new Set(route(a, b).options.flatMap((o) => o.legs.map((l) => l.mode)));
      expect(modes.has('uber' as any)).toBe(false);
      expect(modes.has('bolt' as any)).toBe(false);
    }
  });
});

describe('journeySteps: walk, board, get down, arrive', () => {
  it('reads top to bottom with one action per step', () => {
    const o = rec(route(P.ikorodu, P.cms));
    const steps = journeySteps(o);
    expect(steps[0].n).toBe(1);
    expect(steps[steps.length - 1].kind).toBe('arrive');
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toContain('board');
    expect(kinds).toContain('alight');
    const board = steps.find((s) => s.kind === 'board')!;
    expect(board.title).toMatch(/^(Take|Join|Ask)/);
    expect(board.fare!.max).toBeGreaterThan(0);
    const alight = steps.find((s) => s.kind === 'alight')!;
    expect(alight.title).toMatch(/^Get down at /);
    // board and alight always come as a pair, in that order
    kinds.forEach((k, i) => { if (k === 'board') expect(kinds[i + 1]).toBe('alight'); });
  });

  it('a change of vehicle is said at the stop where it happens', () => {
    const withChange = route(P.ojota, P.ogba).options.find((o) => o.transfers >= 1)!;
    const steps = journeySteps(withChange);
    const changeStep = steps.find((s) => s.kind === 'alight' && s.note?.startsWith('Change here'));
    expect(changeStep).toBeTruthy();
  });

  it('the share text is the same story, numbered, signed', () => {
    const o = rec(route(P.ikorodu, P.cms));
    const text = explainJourney(o, 'Ikorodu', 'CMS');
    expect(text.startsWith('Ikorodu → CMS')).toBe(true);
    expect(text).toMatch(/\n1\. /);
    expect(text).toMatch(/no change of vehicle|change/);
    expect(text.trim().endsWith('— WakaWay')).toBe(true);
  });
});

describe('fare trust says which kind of number you are looking at', () => {
  const leg = (over: Partial<RouteLeg>): RouteLeg => ({
    id: 'x', mode: 'danfo', from: { latitude: 0, longitude: 0, name: 'A' }, to: { latitude: 0, longitude: 0, name: 'B' },
    distanceKm: 5, durationMins: 20, priceMin: 300, priceMax: 500, fareSource: 'band', instruction: '', localInstruction: '', icon: '',
    corridorId: 'c1', ...over,
  });
  const sig = (over: Partial<CorridorSignal>): CorridorSignal => ({
    corridor_id: 'c1', fare_reports: 0, fare_low: null, fare_median: null, fare_high: null, last_fare_at: null,
    ok_count: 0, down_count: 0, last_down_at: null, ...over,
  });
  const now = new Date().toISOString();

  it('three or more recent reports make it verified and replace the estimate', () => {
    const t = fareTrust(leg({}), sig({ fare_reports: 14, fare_low: 500, fare_median: 600, fare_high: 700, last_fare_at: now }));
    expect(t.state).toBe('verified');
    expect(t.min).toBe(500); expect(t.max).toBe(700);
    expect(t.label).toMatch(/14 riders/);
  });
  it('one report is only reported', () => {
    expect(fareTrust(leg({}), sig({ fare_reports: 1, fare_low: 400, fare_median: 400, fare_high: 400, last_fare_at: now })).state).toBe('reported');
  });
  it('old reports do not count', () => {
    const old = new Date(Date.now() - 20 * 86_400_000).toISOString();
    expect(fareTrust(leg({}), sig({ fare_reports: 9, fare_low: 400, fare_median: 400, fare_high: 400, last_fare_at: old })).state).toBe('estimate');
  });
  it('a LAMATA table fare is labelled as one; a distance band is an estimate', () => {
    expect(fareTrust(leg({ fareSource: 'table' })).state).toBe('table');
    expect(fareTrust(leg({})).state).toBe('estimate');
  });
  it('riders saying a line is down becomes a warning', () => {
    expect(routeTrouble(sig({ down_count: 3, last_down_at: now }))).toMatch(/3 riders/);
    expect(routeTrouble(sig({ down_count: 1, last_down_at: now }))).toBeUndefined();
  });
  it('the option fare is the sum of its legs with reports folded in', () => {
    const o = rec(route(P.ikorodu, P.cms));
    const f = optionFare(o, {});
    expect(f.min).toBe(o.totalPriceMin);
    expect(f.max).toBe(o.totalPriceMax);
  });
});

describe('live reports attach to the leg they touch', () => {
  const alert = (over: Partial<LiveAlert>): LiveAlert => ({
    id: 'a', user_id: null, type: 'traffic', title: 'Go-slow at Ojota', description: null,
    latitude: 6.5880, longitude: 3.3860, address: null, status: 'pending', confirms: 0, dismisses: 0,
    confirm_count: 3, dismiss_count: 0, verified: false, ai_score: null, ai_category: null, ai_sentiment: null,
    image_url: null, reporter_trust_score: 1, created_at: new Date().toISOString(), expires_at: null, ...over,
  });
  it('traffic at Ojota lands on the Ikorodu Road leg; trouble in Badagry does not', () => {
    const o = route(P.ikorodu, P.cms).options.find((o) => o.legs.some((l) => l.mode === 'brt'))!;
    const hits = alertsAlongRoute([alert({}), alert({ id: 'b', latitude: 6.4150, longitude: 2.8800 })], o);
    expect(hits).toHaveLength(1);
    expect(o.legs[hits[0].legIndex].mode).toBe('brt');
  });
  it('only danger becomes an avoid point; traffic does not reroute', () => {
    const pts = avoidPointsFrom([alert({}), alert({ id: 'c', type: 'security' })]);
    expect(pts).toHaveLength(1);
    expect(pts[0].radiusKm).toBe(0.5);
  });
});
