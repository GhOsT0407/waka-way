
# Mock Mode

`USE_MOCK_DATA = true` in `client/src/utils/constants.ts` is the switch that decides whether `api.ts` talks to the real [[Backend API]] or returns canned data from `mockData.ts` (`MOCK_CITIES`, `MOCK_STOPS`, `MOCK_ROUTES`) with an artificial 300–600ms delay.

## Scope

Affects `getCities()`, `getStops()`, `getNearbyStops()`, `getRoute()`, `searchRoutes()`, `createReport()`, `upvoteReport()`, `downvoteReport()`, `getCorridors()`. It does **not** affect:
- [[Smart Routing Engine]] — always runs client-side regardless of this flag, since it was never server-backed.
- [[Auth]] — always real Firebase, no mock flag exists for it.
- [[Community Contributions]] / [[Supabase Integration]] — always real Supabase, with an AsyncStorage fallback only if Supabase env vars are misconfigured (a different mechanism than this flag).

## Why it matters

The [[Backend API]] now has real, working endpoints (`/api/v1/stops/nearby/`, `/api/v1/routes/compute/`, etc.), but with this flag `true` the client never exercises them — so backend changes are effectively invisible in the running app until someone flips this to `false` and points `API_BASE_URL` at a running Django instance.

## Related
[[Architecture]] · [[Backend API]] · [[Smart Routing Engine]] · [[API Client]]
