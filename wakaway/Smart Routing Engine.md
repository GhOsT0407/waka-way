
# Smart Routing Engine

The heart of [[Architecture|WakaWay]]. `client/src/services/smartRoutingService.ts` (~900 lines) computes multimodal routes entirely on-device — no transit API exists for Lagos's informal transport, so this replaces one.

## How it works

- **Distance**: Haversine formula (R = 6371 km) for all leg distances.
- **Trip band classification** gates which route builders run: micro (<2km), short (<8km), medium (<25km), long (≥25km).
- **Mode speeds (km/h)**: walk 4, keke 22, okada 30, danfo 14, BRT 28, rail 60, uber/bolt 35.
- **Connector mode selection** (first/last mile): walk <0.2km, keke ≤5km, okada ≤6–8km (if not banned), danfo >8km.
- **Okada ban zones**: a bounding box over Lagos metro core (6.410–6.650°N, 3.280–3.620°E) where okada legs are excluded, matching Lagos State policy.
- **2025 Lagos pricing engine**: distance-bucketed fare ranges per mode (e.g. danfo ≤3km = ₦200–₦400).
- **Instructions**: generated in both English and Lagos Pidgin per leg (e.g. "Enter keke for Ikeja side, tell am make e drop you CMS").

## Infrastructure data

Imported from `client/src/data/lagosStops.ts`:
- BRT: 30 stops across two corridors (Ikorodu↔TBS/CMS, Abule-Egba↔Oshodi)
- Blue Line Rail: Mile 2↔Marina (5 stations)
- Red Line Rail: Oyingbo↔Agbado (9 stations)
- 100+ danfo hubs/parks/junctions

## Output shape

Returns a `SmartRouteResult`: origin/destination, trip band, nearest stops, 2–4 `RouteOption`s (each with `legs[]`, total distance/duration/price, `isCheapest`/`isFastest`/`isRecommended` flags, tags), plus a `recommendedOptionId` and a price/time `comparison`.

## Related services

- [[Route Auto Fixer]] → [[Route Validator]] + [[Lagos Route Rules]] — post-processing pass run via `utils/smartRouter.ts`
- [[Directions Service]] — polyline/path generation for [[Map Layer]]
- [[Places Service]] — MapTiler-based place search/autocomplete

**Not** used by this engine, despite superficially overlapping purposes — see [[Service Duplication & Dead Code]]:
- [[Routing Engine (Legacy)]] / [[Pricing Service]] / [[Guide Generator]] — a second, unwired routing pipeline reachable only via [[useRouting Hook]]
- [[Pricing Engine]] — a third, independent pricing implementation used only by `FareEstimateCard.tsx`

## Used by

`HomeScreen` and `RouteDetailScreen` call this directly (via `searchRoutes()` in [[API Client]]), independent of [[Mock Mode]] — routing itself was never server-backed, only stops/cities/reports were. `FareDisputeModal` reads `RouteLeg[]` from a computed route to build a shareable fare breakdown.

## Related
[[Architecture]] · [[Map Layer]] · [[Mock Mode]] · [[Backend API]] · [[API Client]] · [[Route Auto Fixer]] · [[Places Service]] · [[Directions Service]] · [[Service Duplication & Dead Code]]
