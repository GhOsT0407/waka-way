
# Google Directions Service (Deprecated)

`client/src/services/googleDirectionsService.ts` — **confirmed dead code**, replaced by [[Directions Service]].

## Status

The file's own first line states it's no longer used. `GOOGLE_MAPS_API_KEY` is hardcoded to an empty string, so every export (`getWalkingDirections`, `getDrivingDirections`, `getTransitDirections`, `getRoadDistanceKm`) always hits its `if (!GOOGLE_MAPS_API_KEY)` guard and returns `null`/logs a warning — non-functional as shipped. A repo-wide search found **zero import sites** anywhere in `client/src`.

Not a drop-in equivalent to its replacement: this file attempted turn-by-turn steps and transit data; [[Directions Service]] (OpenRouteService) only returns geometry.

## Recommendation

Safe to delete. See [[Service Duplication & Dead Code]] for the full list of dead/unwired files found in this audit.

## Related
[[Architecture]] · [[Directions Service]] · [[Service Duplication & Dead Code]]
