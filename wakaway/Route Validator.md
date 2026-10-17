
# Route Validator

`client/src/services/routeValidator.ts` — a pure rule table + validator, no side effects.

## What it does

Defines per-mode distance bounds and a `firstLegOnly` flag (e.g. keke/okada only valid as first legs, 0.5–5km/0.5–8km respectively; danfo 3–50km; BRT 5–60km; walk 0–0.5km) and exposes `isValidLeg` to check a leg against those rules.

## Key exports

- `isValidLeg(leg, isFirstLeg): boolean`
- `interface RouteLeg` — this validator's own leg shape (`mode`, `distanceKm`, `durationMin`, `from: string`, `to: string`, optional `cost`) — distinct from the `RouteLeg` types in [[Smart Routing Engine]] and [[Routing Engine (Legacy)]]. See [[Service Duplication & Dead Code]].

## Dependencies

None — only a shared `TransportMode` type.

## Used by

[[Route Auto Fixer]], and `client/src/utils/smartRouter.ts` (imports `RouteLeg as ValidatorLeg` to avoid clashing with [[Smart Routing Engine]]'s own `RouteLeg`).

## Related
[[Architecture]] · [[Route Auto Fixer]] · [[Smart Routing Engine]] · [[Service Duplication & Dead Code]]
