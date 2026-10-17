# 0012 — Route over real corridors, not between hubs

**Date:** 2026-09-17
**Status:** Accepted

## Context

A rider searched from Yaba to Gbagada and was told to get down at Berger. Reproducing it showed why, and it was worse than one bad hub: every trip to Gbagada ended "BRT to Jibowu, walk 610 m" — Jibowu is 5 km from Gbagada. Two independent faults:

1. **The stop coordinates were wrong.** Cross-checking all 209 stops in `lagosStops.ts` against OpenStreetMap bus-stop / station nodes and MapTiler geocoding: the Ikorodu Road stops were each shifted north by roughly one stop (the dataset's "Ojota" sits where Mile 12 is), "Gbagada" was placed at Oworonshoki, both rail lines were 1–2 km off, and the Oshodi–Abule-Egba BRT stops were ~5 km south of the road. Only 44 of 209 were within 1.2 km of an independent source.
2. **The engine had no lines, only points.** `buildDanfoRoute` drew a "danfo" between any two hubs ≤ 6 km apart and chained further hubs that lay near the straight line (`stopsAlongCorridor`). The BRT stop *order* was also fiction (Yaba, Onipanu, Palmgrove before Fadeyi; Gbagada listed on the BRT).

There is no public dataset of Lagos bus lines — OSM has two route relations in the whole state, both BRT ([[Routes Data Research]]). So the corridors had to be written down.

## Decision

Bus and rail legs exist **only along a corridor** — an ordered list of real stops in `client/src/data/lagosRoutes.ts` — and itineraries come from a graph search over those corridors (`services/routeGraph.ts`), not from geometry.

- **Stops:** ~130 corridor stops with coordinates checked on 2026-09-17; `osm` where an OSM node exists (all 13 rail stations, the whole Ikorodu Road BRT, Ikotun, Chevron, Abraham Adesanya…), `known` for junctions placed from local knowledge ±150 m.
- **Corridors:** 2 BRT lines and both rail lines (`verified`, LAMATA), ~30 danfo corridors (`local` = every Lagosian knows it; `likely` = runs, stop list may be off). Each carries an in-traffic speed (expressways 20 km/h, streets 14) and, for BRT/rail, the LAMATA fare bands.
- **Search:** Dijkstra on minutes over (stop, corridor) states, so changing bus is an explicit event with a wait. Origin and destination attach to stops within 3 km through the same walk/keke/legality rules as [[0011-mode-choice-from-zones-and-distance]] — the graph cannot prefer a keke the leg builder would refuse. Three passes (fastest, fewest changes, no BRT/rail) give up to three distinct options.
- **Honesty when the network doesn't reach:** an "Ask at the park" option tagged `Unverified`, never an invented line.
- **Recommendation:** fastest verified option, unless a cheaper one is within 10 minutes of it.
- **Legs carry their corridor** (`corridorName`, `stopsSpanned`, `viaStops`, `confidence`), and the route card shows "via Stadium, Iponri, Costain · 4 stops" so a rider can tell the right bus from the wrong one.

## Alternatives rejected

- **Fix the coordinates and keep the geometric chaining.** Correct points still produce buses that don't exist (Lekki Phase 1 → Ikoyi "direct"); the failure is structural.
- **Google/MapTiler transit directions.** Neither covers informal Lagos transport; that gap is why the engine exists.
- **Crowdsource the corridors first.** Right long-term source, empty at launch. Curated corridors are the floor; "Route no dey work" reports on the Report tab are how they get corrected.

## Consequences

- Positive: Yaba → Gbagada goes via Bariga or Anthony; Festac → Ikeja goes Mile 2 → Oshodi; Ojuelegba → CMS is one bus down Western Avenue; Berger appears only for trips that pass Berger. 43 tests, 15 of them golden trips.
- Negative: coverage is the ~30 corridors written. Trips that touch the outskirts (Ota road, Ikorodu hinterland, Epe town streets) fall to "Ask at the park". Stop positions marked `known` are ±150 m, expressway stops beyond Agbara ±2 km.
- `lagosStops.ts` is now only a type source; its 209 hubs are no longer used for routing.

## Coverage pass (same day, later)

The user then asked for every location to every location across Lagos. There is no finite list of that; what is finite is the corridor network, so the file was expanded until every LGA and every major park is connected:

- **Stops:** ~170, every one checked (OSM node, or a known junction placed ±150 m in the metro, ±1 km on the outer expressways). Rail-station coordinates are never reused as road stops — they sit on the expressway median and route badly.
- **Corridors:** 3 BRT lanes, 2 rail lines, 24 LAMATA standard routes from the 2 Mar 2026 fare table (fares are shared by the fraction of the line ridden, floor 35 %), ~40 danfo corridors, 11 keke feeders. Keke feeders are corridors on purpose: keke is banned from Ikeja LGA's major roads, yet Berger → Ogba by keke is how everyone does that hop, and specific knowledge beats the polygon.
- **Road distances:** every consecutive hop was routed with OSRM in both directions (OSM stop nodes sit on one carriageway of a divided road, so one direction can need a long U-turn) and the shorter figure baked in as `hops`. A figure far above the chord on a short hop is treated as a snapping artifact and capped.
- **Search:** four passes — fastest, fastest on confirmed lines only, fewest changes, danfo only. A confirmed option is never dropped as a near-duplicate of a `likely` one, and the recommendation prefers confirmed corridors over an ad-hoc connector over an unconfirmed line.
- **Sweep:** 35 places across all 20 LGAs plus five residential points, every pair — **1,190 of 1,190 trips route on confirmed corridors**. Epe → Badagry is the longest at ~9 h, which is optimistic-danfo-speed honest.

`brt_okokomaiko_oyingbo` is `likely`: LAMATA prices it as BRT, but how much of the Badagry-expressway lane runs is unclear from here.

## Still to do

- Wire "Route no dey work" reports to a review queue that edits `lagosRoutes.ts`.
- More corridors: Ikorodu hinterland (Ikorodu – Sagamu road, Ikorodu – Ijede), Ogba – Berger, Agege – Iyana-Ipaja, Ajah inner roads, Apapa – Mile 2.
- Per-stop keke availability from reports, to relax [[0011-mode-choice-from-zones-and-distance]]'s LGA floor.

## Related
[[Routes Data Research]] · [[0011-mode-choice-from-zones-and-distance]] · [[Smart Routing Engine]] · [[Active Context]]
