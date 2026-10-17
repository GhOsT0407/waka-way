# Routes Data Research

Research pass on 2026-09-17 for making the [[Smart Routing Engine]] accurate — stops, corridors, fares and, above all, the walk / keke / bus decision. Sources are linked at the bottom; every figure below has one.

## What the engine does today (and why it mis-advises)

Read from `client/src/services/smartRoutingService.ts` and `client/src/data/lagosStops.ts`:

- **Data:** 31 BRT stops (Ikorodu–TBS, Oshodi–Abule Egba), 5 Blue Line + 9 Red Line stations, 164 danfo hubs. Points only — **no lines**.
- **Walk is chosen only ≤ 200 m** (`connectorMode`). 200 m – 5 km becomes a *keke* leg. So it under-walks and over-kekes; a 400 m hop to the bus stop is a keke ride.
- **Danfo legs are geometric.** Any two hubs ≤ 6 km apart get a "Danfo A → B" leg whether or not a danfo plies that pair (Lekki Phase 1 → Ikoyi has no direct danfo; you go via Obalende or CMS). Longer pairs are chained through `stopsAlongCorridor`, which picks hubs near the straight line — not real corridors.
- **Keke restrictions are not modelled.** Okada has a crude circle-based ban zone; keke has none, so keke is suggested inside Surulere, Ikeja, Eti-Osa, Lagos Island, Lagos Mainland, Apapa — where it has been banned from major roads since Feb 2020.
- **Rail is never called.** `buildRailRoute` exists; `calculateSmartRoute` only runs BRT and danfo.
- **Fares are 2025 distance bands**, not the LAMATA table. Rail fares are guessed.
- "MMIA Domestic" is listed as a Red Line station; it is not one.

## What public data exists

| Need | Source | Verdict |
|---|---|---|
| BRT + LAMATA standard-route fares | Tribune / BusinessDay, LAMATA 13% revision effective **2 Mar 2026** — full origin/destination fare table, ~75 routes | **Use as-is.** Best structured data available. |
| Blue Line | 5 stations Mile 2 → Suru-Alaba → Orile Iganmu → National Theatre → Marina; ₦750 full line, ₦200–500 zonal, 25% off-peak 10:00–16:00; Mon–Sat 05:30–23:00, every 8–10 min; Cowry card only | **Use.** Matches our station list. |
| Red Line | 8 stations Agbado → Iju → Agege → Ikeja → Oshodi → Mushin → Yaba → Oyingbo; **9 trips/day, weekdays only**, morning + evening windows; ₦500 short / ₦1,000 / ₦1,500 Agbado–Oyingbo | **Use, time-windowed.** Recommending it outside its 9 departures is worse than not recommending it. |
| Danfo routes | No structured public dataset. OSM has **2 bus relations** in all of Lagos State (both BRT). LAMATA's site shows a map image only. | **Must be curated by hand** from local knowledge + the standard-route list + published guides, with a confidence flag and community correction. |
| Danfo fares (Apr 2026) | Ojuelegba–CMS ₦300–500; Ikeja–Maryland ₦200–350; Yaba–VI ≈ ₦650; Surulere–VI ≈ ₦450; Ajah–Ikeja GRA ≈ ₦1,600 | **Use as bands**, 2026 values. |
| Keke fares (Apr 2026) | < 1 km ₦200–300; 1–3 km ₦300–500; 3–5 km ₦500–800 | **Use.** Engine currently says ₦300–800. |
| Okada fares (Apr 2026) | < 500 m ₦200–300; 1.5–3 km ₦500–800 | **Use.** Engine says ₦500–1,500 — too high. |
| Stop coordinates | OSM has 148 `bus_stop` + 10 `bus_station` nodes in Lagos, 130 named. Sparse but useful for spot-checking our 209. | **Validate against**, don't replace. |
| Restriction zones | Okada + keke: 6 LGAs since 1 Feb 2020 — Apapa, Lagos Mainland, Surulere, Ikeja, Eti-Osa, Lagos Island (+9 LCDAs) + 10 highways/40 bridges. Okada total ban extended 1 Sep 2022 to Kosofe, Oshodi-Isolo, Shomolu, Mushin (+6 LCDAs). Enforcement active in 2026 (65 bikes seized in Ikoyi, Feb 2026). | **Model as LGA polygons** (OSM `admin_level=6` boundaries are available), not circles. |

## Decision rules to implement

**Walk vs ride.** Lagosians walk to the bus stop. Walk ≤ 0.8 km (≈ 10 min at 4.5 km/h); allow up to 1.2 km when keke is unavailable (restricted LGA); never propose a walk leg > 1.5 km. Never propose walk as the *trunk* of a trip ≥ 1.5 km when a corridor exists.

**Keke.** 0.8 – 4 km, outside the six 2020 LGAs, never along an expressway/bridge segment. Inside the six LGAs, only as an inner-street last-mile ≤ 1.5 km, flagged "may not be available".

**Okada.** Outside the ten total-ban LGAs only. Never Lagos Island / Ikoyi / VI / Lekki-Ikoyi bridge / any expressway.

**Danfo / bus.** Only along an encoded corridor. Transfers happen at hubs the corridor data says are interchange points. If no corridor pair reaches the destination, say so and fall back to keke/ride-hail — don't invent a bus.

**Rail.** Blue Line whenever both endpoints are within 2 km of a station and the rail leg ≥ 2 stations. Red Line only if the request time is within ~40 min before a scheduled departure on a weekday.

## Implementation plan

1. **Restriction polygons** — fetch the 20 LGA boundaries from OSM, store simplified polygons, replace `isOkadaBannedLocation`; add `isKekeRestricted`.
2. **Mode rules** — rewrite `connectorMode` to the thresholds above; add 4.5 km/h walk, keep 14 km/h danfo, 20 km/h BRT (28 is optimistic in traffic).
3. **Route graph** — new `client/src/data/lagosRoutes.ts`: ordered stop lists per corridor with mode, operator, fare (table or band), confidence (`verified` / `local-knowledge` / `unverified`). Seed: 2 BRT corridors, Blue + Red Line, ~75 LAMATA standard routes from the fare table, ~50 danfo corridors from hubs.
4. **Graph search** — Dijkstra over stops with edges from the corridors (cost = minutes + λ·fare), replacing `buildDanfoRoute`'s geometric chaining and `stopsAlongCorridor`.
5. **Fares** — LAMATA table lookup for BRT/standard/rail, 2026 bands for danfo/keke/okada.
6. **Validation** — geocode-check all 209 stops against OSM/MapTiler, flag > 400 m drift; a golden test set of ~30 real trips asserting first-leg mode and corridor (e.g. Yaba → CMS must not start with a keke; Ojuelegba → Stadium is a walk; Lekki Phase 1 → Ikoyi goes via Obalende/CMS or Sandfill, never a direct danfo).
7. **Correction loop** — the existing fare-dispute and report flows write to `contributions`; add a "wrong route" report type so curated corridors get corrected by riders.

## What was built from this (2026-09-17)

`client/src/data/lagosRoutes.ts` + `client/src/services/routeGraph.ts` — see [[0012-route-over-corridors-not-between-hubs]]. Validation tools, kept out of the repo: an OSM/MapTiler cross-check of every stop coordinate (only 44 of the original 209 could be confirmed), and an OSRM road-distance pass over every corridor hop (both directions, shorter kept). OpenRouteService's key in `client/.env` is rejected ("Access to this API has been disallowed") — Navigation's road geometry needs a fresh key.

## Sources

- Tribune — [Full list: new BRT, standard route fares (13% hike, 2 Mar 2026)](https://tribuneonlineng.com/full-list-new-brt-standard-route-fares-as-lamata-implements-13-hike/)
- BusinessDay — [LAMATA releases new BRT fares](https://businessday.ng/transport/article/lamata-releases-new-brt-fares-following-13-increase/)
- Lagos Post — [Blue Line stations, fares, how to board (2026)](https://www.lagospostng.com/lagos-blue-line-train-stations-fares-and-how-to-board-2026-complete-guide/)
- Nairametrics — [Red Line: 9 daily trips Agbado–Oyingbo](http://nairametrics.com/2025/02/08/lagos-red-line-to-run-9-daily-trips-between-agbado-and-oyingbo-from-feb-10/)
- LAMATA — [Red Line schedule](https://www.lamata-ng.com/our-schedule/redline-train-schedule/), [Train services](https://www.lamata-ng.com/train-services/), [Bus services](https://www.lamata-ng.com/bus-services/)
- Transportlog — [Transport fares in Nigeria 2026 (danfo/keke/okada bands)](https://transportlog.com.ng/transport-fare-in-nigeria-2026-complete-guide-to-bus-taxi-okada-and-interstate-prices/)
- Lagos.Cool — [Lagos transport costs 2026](https://lagos.cool/transport)
- Tribune — [Lagos bans okada in six LGAs, nine LCDAs (2020)](https://tribuneonlineng.com/lagos-bans-okada-in-six-lgas-nine-lcdas/)
- Leadership — [Fresh total ban in additional 4 LGAs, 6 LCDAs (2022)](https://leadership.ng/lagos-declares-fresh-total-ban-on-okada-in-additional-4-lgas-6-lcdas/)
- AllAfrica — [65 motorcycles confiscated in restricted areas (Feb 2026)](https://allafrica.com/stories/202602030077.html)
- OSM Overpass query, 2026-09-17: 3 route relations and 195 stop nodes inside the Lagos bounding box.

## Related
[[Smart Routing Engine]] · [[Pricing Engine]] · [[Lagos Route Rules]] · [[Active Context]]
