
# Backend API

Django REST Framework service in `server/backend/`. Models the "proper" transit domain, but most of it is currently dormant behind [[Mock Mode]] since the [[Smart Routing Engine]] already handles routing client-side.

## Django apps

- **core** — `City`, `TransportStop` (bus/keke/okada/walk/junction), `TransportRoute`, `RouteSegment`, `Fare`, `RouteSuggestion`, `RouteStep`, `UserReport` (with upvotes/downvotes and an idempotency key), `UserFavoritePlace`, `UserRouteHistory`, `Corridor`, `CorridorStop`, `StopConnection` (cross-mode connectors, e.g. keke→okada).
- **stops** — stop management.
- **reports** — user-submitted reports (fare updates, route disruptions).
- **routing** — server-side route computation endpoint; not the primary engine ([[Smart Routing Engine]] is).

## Endpoints

`/api/v1/health/`, `/api/v1/cities/`, `/api/v1/corridors/`, `/api/v1/corridor-stops/`, `/api/v1/stop-connections/`, `/api/v1/stops/nearby/` (geospatial), `/api/v1/reports/` (CRUD + up/downvote), `/api/v1/routes/compute/`.

## Database

SQLite in dev, Postgres in production (Railway). PostGIS is disabled — geometry falls back to `JSONField`.

## Relationship to the client

[[API Client]] (`api.ts`) is the only thing that would call these endpoints, and it's gated by `USE_MOCK_DATA` in [[Mock Mode]] — currently `true`, so every one of these endpoints exists but isn't exercised by the running app.

## Related
[[Architecture]] · [[Mock Mode]] · [[Smart Routing Engine]] · [[API Client]]
