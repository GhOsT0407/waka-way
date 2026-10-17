
# Directions Service

**Retired 2026-09-22** — see [[0014-draw-legs-from-the-corridor-not-a-directions-api]].

`client/src/services/directionsService.ts` wrapped the OpenRouteService Directions API for road-following polylines in Wakaway Mode. The key died in September 2026 and the API drew a car's road rather than the danfo's corridor, so the file, `ORS_API_KEY` and `EXPO_PUBLIC_ORS_API_KEY` were removed.

Leg geometry now comes from `client/src/services/routeGeometry.ts` — `legGeometry(leg)` chains the corridor's stops from `data/lagosRoutes.ts`, the same data the engine routed on. Used by `screens/NavigationScreen.tsx` (polylines) and `hooks/useLiveAlerts.ts` (route-scoped alert matching).

## Related
[[Architecture]] · [[Map Layer]] · [[Smart Routing Engine]] · [[Google Directions Service (Deprecated)]]
