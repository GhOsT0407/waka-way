
# useRouting Hook

`client/src/hooks/useRouting.ts` — orchestrates the full navigation lifecycle around [[Routing Engine (Legacy)]].

## What it does

Calculates a multimodal route via `routingEngine.calculateRoute`, formats it for display via [[Guide Generator]], and (optionally auto-)starts live-location monitoring via [[Geofencing Service]] — exposing progress %, current leg, distance-to-next-stop, and the latest arrival nudge as hook state. Also exports `useQuickRoute`, a thin wrapper that auto-triggers on mount/prop change.

## Key exports

- `useRouting(options?)` — `{ route, formattedGuide, loading, error, userLocation, currentLegIndex, distanceToNextStop, latestNudge, isNavigating, progress, calculateNewRoute, startNavigation, stopNavigation, recalculateRoute, clearRoute }`
- `useQuickRoute(options)`

## Dependencies

[[Routing Engine (Legacy)]] (`calculateRoute`), [[Geofencing Service]] (`startRouteMonitoring`, `stopRouteMonitoring`, `configureGeofenceNotifications`), [[Guide Generator]] (`generateFormattedGuide`).

## Status — unwired

Only referenced by the `hooks/index.ts` barrel re-export. A repo-wide search found **no screen or component actually calling `useRouting`/`useQuickRoute`**. The screens that do navigation (`NavigationScreen`) instead work directly off [[Smart Routing Engine]]'s output. See [[Service Duplication & Dead Code]].

## Related
[[Architecture]] · [[Routing Engine (Legacy)]] · [[Geofencing Service]] · [[Guide Generator]] · [[Service Duplication & Dead Code]]
