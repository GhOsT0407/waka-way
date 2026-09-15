
# Routing Engine (Legacy)

`client/src/services/routingEngine.ts` — an async, Supabase-backed multimodal route calculator (`calculateRoute`). A second, parallel routing pipeline to [[Smart Routing Engine]], not a shared dependency of it.

## What it does

Queries a Supabase RPC (`find_nearest_landmarks`) and the `contributions` table for live danger-zone/safety data (see [[Community Contributions]]), then builds first-mile → main-transit → last-mile legs with pivot logic (walk vs keke/okada based on distance/night/safety). Prices come from [[Pricing Service]]; it has its own leg/mode speed table for durations.

## Key exports

- `calculateRoute(request): Promise<RoutingResponse>` — main entry point
- `findNearestLandmarks`, `findNearestConnector`, `findNearestBusStop` — Supabase landmark lookups
- `getActiveDangerZones` — maps contribution rows to danger zones
- `calculateDistance`, `formatDuration`, `getModeIcon` — re-exported helpers

## Dependencies

- Imports `calculatePrice`, `calculateTotalPrice`, `calculateDistance`, `isNightTime`, `isPeakHours`, `formatPrice` from [[Pricing Service]]
- Imports the Supabase client from [[Supabase Integration]]

## Used by

Only [[useRouting Hook]] (`hooks/useRouting.ts`) — no screen imports this directly.

## Known issue
See [[Service Duplication & Dead Code]] — this entire pipeline (routingEngine → useRouting → guideGenerator) appears to be **unreferenced by any screen**, while [[Smart Routing Engine]] is what every real screen actually uses.

## Related
[[Architecture]] · [[Smart Routing Engine]] · [[Pricing Service]] · [[useRouting Hook]] · [[Guide Generator]] · [[Service Duplication & Dead Code]]
