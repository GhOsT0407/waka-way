# 0014 — Draw legs from the corridor, not a directions API

**Date:** 2026-09-22
**Status:** Accepted

## Context

Wakaway Mode drew each leg's polyline by asking OpenRouteService for road-following geometry, falling back to the corridor's stop chain (`services/routeGeometry.ts`) when the API was silent. Since the 2026-09-19 coverage pass the ORS key has been dead ("disallowed"), so every ride fired one failing request per leg, logged a warning per leg, and sent the rider's start and end coordinates to a third party for a line that was never drawn.

Even with a live key the API answered the wrong question. Its `driving-car` profile draws a car's road between two points; a danfo follows its corridor, which can differ. The stop chain is built from the same data the engine routed on, so it agrees with the instructions by construction. [[0013-explain-the-journey-not-the-map]] made the map a bearings layer under the instruction, not the product.

## Decision

The corridor's stop chain is the only leg geometry. `legGeometry(leg)` (renamed from `legFallbackGeometry`) returns straight lines between the stops the leg rides through, or the leg's endpoints when it has no corridor. `services/directionsService.ts`, `ORS_API_KEY` and `EXPO_PUBLIC_ORS_API_KEY` are gone; the privacy policy no longer lists OpenRouteService as a processor.

## Alternatives considered

- **Replace the key.** Keeps a cosmetic gain for walking legs (≤ 1 km) at the cost of a secret, a network dependency on every ride, and a third-party data flow. Not worth it while the map is for bearings.
- **Keep the code, skip the call when the key is empty.** Leaves a dead path that the next reader has to reason about, and the privacy text would still be describing a flow that never runs.

## Consequences

- One fewer secret in `.env`, one fewer processor in the privacy policy, no network call when Wakaway Mode opens.
- Walking legs are straight lines. If that ever reads wrong on a real ride, road-following geometry for `walk` legs only is the thing to bring back — from this repo's history at `directionsService.ts`, or from OSRM, which the corridor measurements already used.
- Wakaway Mode's map is fully offline once the route is computed.
