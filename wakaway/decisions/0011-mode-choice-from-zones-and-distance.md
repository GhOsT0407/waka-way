# 0011 — Decide walk / keke / okada / bus from restriction zones and distance, not from a 200 m threshold

**Date:** 2026-09-17
**Status:** Accepted

## Context

The product question is "at this hop, do I walk, take a keke, or take a bus?" — and the engine got it wrong in both directions. See [[Routes Data Research]] for the evidence; the mechanics in `smartRoutingService.ts` were:

- `connectorMode` returned `walk` only for hops ≤ 200 m. Everything from 200 m to 5 km became a **keke** leg, so a 400 m walk to the bus stop was sold as a keke ride.
- Okada legality was a handful of hard-coded circles (`isOkadaBannedLocation`). Keke legality was not modelled at all, so keke was proposed inside Surulere, Ikeja, Eti-Osa, Lagos Island, Lagos Mainland and Apapa — where it has been banned from major roads since 1 Feb 2020 and is still enforced in 2026.
- Speeds and fares were 2025 guesses (okada ~2× the going rate).

Three options were considered for the legality check:

1. **Keep circles** — cheap, but Eti-Osa alone runs 30 km east from Ikoyi to Sangotedo; no circle fits it without also swallowing Ikorodu Road.
2. **A server-side geofence** (Supabase + PostGIS) — accurate, but routing runs on the device and must work offline; a network round-trip per hop is the wrong shape.
3. **LGA polygons shipped with the app** — OSM `admin_level=6` boundaries, simplified to ~8 KB, point-in-polygon on device.

## Decision

Option 3, plus explicit distance rules per mode. Legality comes from the polygon; the mode from distance *within* what is legal.

| Hop | Rule |
|---|---|
| Walk | ≤ 0.8 km (≈ 10 min at 4.5 km/h). Up to 1.2 km where keke is restricted and no bus stop is nearer. Never > 1.5 km. |
| Keke | 0.8 – 4 km outside the six keke-restricted LGAs. Inside them: last-mile only, ≤ 1.5 km, flagged `mayBeUnavailable`. |
| Okada | Outside the ten okada-ban LGAs only, ≤ 6 km, and only when the rider asked for it. Never the default. |
| Bus (danfo / BRT / rail) | The trunk of anything ≥ 1.5 km. A trip is never "walk direct" beyond 1.5 km. |

Rider preference (`preferredFirstLegMode`) can move a hop between keke and okada where both are legal; it can never override legality.

## Alternatives rejected

- **Ask the community per stop whether keke is available** — right long-term signal, empty at launch. The polygon is the floor; community reports can later relax it (see Still to do).
- **Google Places / Directions transit** — no informal-transport coverage in Lagos; the reason the engine exists.

## Changes

- `data/lagosZones.ts` — ten LGA rings with `kekeRestricted` / `okadaBanned` flags, generated from Overpass (ODbL).
- `services/lagosZones.ts` — `zoneAt(lat, lng)`, `isKekeRestricted`, `isOkadaBanned`, checked at both ends **and the midpoint** of a hop so a leg that crosses into a banned LGA is caught.
- `services/smartRoutingService.ts` — `connectorMode` rewritten to the table above; `SPEEDS.walk` 4 → 4.5, `brt` 28 → 20 (in-traffic average); 2026 fare bands for keke/okada/danfo; the circle-based `isOkadaBannedLocation` deleted.

## Consequences

- Positive: a user in Ikoyi is never told to take a keke; a user 500 m from Ojuelegba is told to walk; okada disappears from the mainland LGAs where it is impounded.
- Negative: LGA boundaries are coarser than reality — keke does run on inner streets of Surulere and parts of Eti-Osa (Ajah). Until community data relaxes the polygon, those users see "walk" or "bus" for hops a local might do by keke. Chosen deliberately: an unavailable keke is a worse error than an extra 600 m walk.
- Bus legs are still built geometrically between hubs; this ADR fixes the *mode*, not the *corridor*. That is the next piece of [[Routes Data Research]].

## Still to do

- Fare table lookup for BRT / LAMATA standard routes / rail (2 Mar 2026 figures).
- Relax `kekeRestricted` per stop from community reports once the `contributions` flow has data.
- Golden trip tests asserting first-leg mode for ~30 real Lagos trips.

## Related
[[Routes Data Research]] · [[Smart Routing Engine]] · [[Lagos Route Rules]] · [[Active Context]]
