// Golden trips for the walk / keke / okada / bus decision (decisions/0011).
// Each trip is a real Lagos pair; the assertions are about the *mode* of each
// leg, not the corridor — that is the next piece of work.

import { calculateSmartRoute, RouteLeg, RouteOption } from '../smartRoutingService';
import { zoneAt, isKekeRestricted, isOkadaBanned } from '../lagosZones';

// Real places. Coordinates from the stop dataset or OSM.
const P = {
  falomo:         { lat: 6.4430, lng: 3.4260, name: 'Falomo, Ikoyi' },
  ekoHotel:       { lat: 6.4281, lng: 3.4219, name: 'Eko Hotel, VI' },
  lekkiPhase1:    { lat: 6.4478, lng: 3.4723, name: 'Lekki Phase 1' },
  ajah:           { lat: 6.4698, lng: 3.5852, name: 'Ajah' },
  ojuelegba:      { lat: 6.5025, lng: 3.3719, name: 'Ojuelegba' },
  ojuelegba500m:  { lat: 6.5060, lng: 3.3745, name: 'Ojuelegba, 500 m off' },
  ikejaGRA:       { lat: 6.5833, lng: 3.3500, name: 'Ikeja GRA' },
  computerVillage:{ lat: 6.5937, lng: 3.3416, name: 'Computer Village' },
  yaba:           { lat: 6.5095, lng: 3.3711, name: 'Yaba' },
  cms:            { lat: 6.4555, lng: 3.3938, name: 'CMS' },
  ikoroduGarage:  { lat: 6.6194, lng: 3.5105, name: 'Ikorodu Garage' },
  ikorodu2km:     { lat: 6.6330, lng: 3.5200, name: 'Ikorodu, 2 km out' },
  ikorodu5km:     { lat: 6.6600, lng: 3.5300, name: 'Ikorodu, 5 km out' },
  festac:         { lat: 6.4650, lng: 3.2830, name: 'Festac' },
  ketu:           { lat: 6.5990, lng: 3.3850, name: 'Ketu' },
  ikeja:          { lat: 6.6018, lng: 3.3515, name: 'Ikeja' },
};

type Pt = { lat: number; lng: number; name: string };
function route(a: Pt, b: Pt, pref?: 'keke' | 'okada' | 'danfo') {
  return calculateSmartRoute(a.lat, a.lng, a.name, b.lat, b.lng, b.name,
    pref ? { preferredFirstLegMode: pref } : undefined);
}
const allLegs = (opts: RouteOption[]): RouteLeg[] => opts.flatMap((o) => o.legs);
const recommended = (r: ReturnType<typeof route>) =>
  r.options.find((o) => o.id === r.recommendedOptionId) ?? r.options[0];

describe('restriction zones', () => {
  it('places landmarks in the right LGA', () => {
    expect(zoneAt(P.falomo.lat, P.falomo.lng)?.name).toBe('Eti Osa');
    expect(zoneAt(P.ojuelegba.lat, P.ojuelegba.lng)?.name).toBe('Surulere');
    expect(zoneAt(P.ikejaGRA.lat, P.ikejaGRA.lng)?.name).toBe('Ikeja');
    expect(zoneAt(P.cms.lat, P.cms.lng)?.name).toBe('Lagos Island');
    expect(zoneAt(P.ketu.lat, P.ketu.lng)?.name).toBe('Kosofe');
    expect(zoneAt(P.ikoroduGarage.lat, P.ikoroduGarage.lng)).toBeNull();
    expect(zoneAt(P.festac.lat, P.festac.lng)).toBeNull();
  });

  it('keke is restricted in the six 2020 LGAs but not in Kosofe; okada banned in all ten', () => {
    const hop = (a: Pt, b: Pt) => ({ fromLat: a.lat, fromLng: a.lng, toLat: b.lat, toLng: b.lng });
    expect(isKekeRestricted(hop(P.falomo, P.ekoHotel))).toBe(true);
    expect(isOkadaBanned(hop(P.falomo, P.ekoHotel))).toBe(true);
    expect(isKekeRestricted(hop(P.ketu, P.ketu))).toBe(false);
    expect(isOkadaBanned(hop(P.ketu, P.ketu))).toBe(true);
    expect(isKekeRestricted(hop(P.ikoroduGarage, P.ikorodu2km))).toBe(false);
    expect(isOkadaBanned(hop(P.ikoroduGarage, P.ikorodu2km))).toBe(false);
  });

  it('catches a hop that only passes through a banned LGA at its midpoint', () => {
    // Festac → Ikorodu both unrestricted; the midpoint lands in the metro core.
    const hop = { fromLat: P.festac.lat, fromLng: P.festac.lng, toLat: P.ikoroduGarage.lat, toLng: P.ikoroduGarage.lng };
    expect(isOkadaBanned(hop)).toBe(true);
  });
});

describe('walk vs ride', () => {
  it('a 500 m hop is a walk, not a keke', () => {
    const r = route(P.ojuelegba, P.ojuelegba500m);
    const legs = recommended(r).legs;
    expect(legs).toHaveLength(1);
    expect(legs[0].mode).toBe('walk');
  });

  it('never asks anyone to walk more than 1.5 km', () => {
    const trips = [
      route(P.yaba, P.cms), route(P.lekkiPhase1, P.ajah), route(P.ikeja, P.cms),
      route(P.festac, P.ikoroduGarage), route(P.falomo, P.ekoHotel),
    ];
    for (const leg of allLegs(trips.flatMap((t) => t.options))) {
      if (leg.mode === 'walk') expect(leg.distanceKm).toBeLessThanOrEqual(1.5);
    }
  });

  it('a 7 km trip (Yaba → CMS) is a bus trip, not a walk or keke trunk', () => {
    const legs = recommended(route(P.yaba, P.cms)).legs;
    const trunk = legs.reduce((a, b) => (a.distanceKm > b.distanceKm ? a : b));
    expect(['danfo', 'brt', 'rail']).toContain(trunk.mode);
  });
});

describe('keke availability', () => {
  it('a 2 km hop in Ikorodu (unrestricted) is a keke', () => {
    const legs = recommended(route(P.ikoroduGarage, P.ikorodu2km)).legs;
    expect(legs.some((l) => l.mode === 'keke' && !l.mayBeUnavailable)).toBe(true);
  });

  it('never proposes an unflagged keke inside Ikoyi / VI', () => {
    for (const leg of allLegs(route(P.falomo, P.ekoHotel).options)) {
      if (leg.mode === 'keke') expect(leg.mayBeUnavailable || !!leg.corridorName).toBe(true);
    }
  });

  it('inside Ikeja, a keke leg is either flagged or a known keke corridor', () => {
    for (const leg of allLegs(route(P.ikejaGRA, P.computerVillage).options)) {
      if (leg.mode === 'keke') expect(leg.mayBeUnavailable || !!leg.corridorName).toBe(true);
    }
  });

  it('a Lekki → Ajah trip has no unflagged keke and a bus trunk', () => {
    const r = route(P.lekkiPhase1, P.ajah);
    for (const leg of allLegs(r.options)) {
      if (leg.mode === 'keke') expect(leg.mayBeUnavailable || !!leg.corridorName).toBe(true);
    }
    expect(recommended(r).legs.some((l) => l.mode === 'danfo' || l.mode === 'brt')).toBe(true);
  });
});

describe('okada', () => {
  // The rule changed on 2026-10-16 at the product owner's request: okada used
  // to appear only when the rider had switched it on, which in practice meant
  // "danfo, danfo, danfo". Now it is suggested where it is legal and worth it,
  // as a labelled extra option — and still never inside the ban, and never
  // for a rider who has said no.

  it('unprompted, is never proposed inside the ban zones', () => {
    const trips = [route(P.yaba, P.cms), route(P.falomo, P.ekoHotel), route(P.ikejaGRA, P.computerVillage)];
    expect(allLegs(trips.flatMap((t) => t.options)).some((l) => l.mode === 'okada')).toBe(false);
  });

  it('unprompted, appears only as a labelled extra choice, and only where it is legal', () => {
    const r = route(P.ikoroduGarage, P.ikorodu5km);
    for (const o of r.options) {
      for (const l of o.legs.filter((x) => x.mode === 'okada')) {
        expect(isOkadaBanned({ fromLat: l.from.latitude, fromLng: l.from.longitude, toLat: l.to.latitude, toLng: l.to.longitude })).toBe(false);
        expect(o.tags.includes('Okada') || o.type === 'direct').toBe(true);
      }
    }
  });

  it('is never proposed to a rider who has said no', () => {
    const trips = [[P.ikoroduGarage, P.ikorodu5km], [P.festac, P.ikoroduGarage]].map(([a, b]) =>
      calculateSmartRoute(a.lat, a.lng, a.name, b.lat, b.lng, b.name, { okada: 'never' }));
    expect(allLegs(trips.flatMap((t) => t.options)).some((l) => l.mode === 'okada')).toBe(false);
  });

  it('is proposed when asked for, outside the ban', () => {
    const legs = allLegs(route(P.ikoroduGarage, P.ikorodu2km, 'okada').options);
    expect(legs.some((l) => l.mode === 'okada')).toBe(true);
  });

  it('is refused even when asked for, inside the ban', () => {
    const trips = [route(P.falomo, P.ekoHotel, 'okada'), route(P.ketu, P.ikeja, 'okada'), route(P.ikejaGRA, P.computerVillage, 'okada')];
    expect(allLegs(trips.flatMap((t) => t.options)).some((l) => l.mode === 'okada')).toBe(false);
  });
});
