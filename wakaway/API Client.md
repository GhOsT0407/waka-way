
# API Client

`client/src/services/api.ts` — the Axios-based client for the [[Backend API]] (Django), gated per-endpoint by the `USE_MOCK_DATA` flag (see [[Mock Mode]]).

## What it does

When mocking, endpoints return canned data from `mockData.ts` with artificial delays; when live, they hit `API_BASE_URL` via a shared `apiClient` axios instance that injects a Bearer token (set via `wireAuthToken`, called from `App.tsx` on [[Auth]] state change) and logs errors via a response interceptor.

**Important:** `searchRoutes`/`getRoute` do **not** branch on `USE_MOCK_DATA` — routing is always computed client-side via [[Smart Routing Engine]]'s `calculateSmartRoute`, then converted to a legacy shape for backward compatibility. Routing was never actually server-backed, mock flag or not.

## Key exports

- `wireAuthToken(token)`
- `checkHealth`, `getCities`, `getStops`, `getNearbyStops`
- `searchRoutes(data)` → `{ smartRoute, legacyRoute }`, `getRoute(id)`
- `createReport`, `upvoteReport`, `downvoteReport` — Django `/reports/`, a **separate report path** from [[Report Service]]'s Supabase `contributions`
- `getCorridors`, `getCorridorDetail`, `getCorridorByIdOrCode`, `getCorridorStops`, `getStopConnections`

## Dependencies

[[Smart Routing Engine]] (`calculateSmartRoute`), `mockData.ts` (`MOCK_CITIES`, `MOCK_STOPS`, `MOCK_ROUTES`).

## Used by

`SearchScreen`, `HomeScreen` (`searchRoutes`), `RouteDetailScreen` (`getRoute`), `App.tsx` (`wireAuthToken`). Also re-exported wholesale by `client/src/api.ts` as a backward-compat shim.

## Related
[[Architecture]] · [[Backend API]] · [[Mock Mode]] · [[Smart Routing Engine]] · [[Report Service]] · [[Auth]]
