
# Directions Service

`client/src/services/directionsService.ts` — wraps the OpenRouteService (ORS) Directions API for real road-following polyline geometry. The functional replacement for [[Google Directions Service (Deprecated)]].

## What it does

Fetches route geometry for a single leg (`fetchLegGeometry`) or a batch of legs (`fetchAllLegGeometries`), converting ORS's `[lng,lat]` output to `{latitude, longitude}` arrays. Free tier, requires `EXPO_PUBLIC_ORS_API_KEY`. Fails gracefully — returns `null` on missing key or fetch error, letting the caller fall back to straight lines.

## Key exports

- `fetchLegGeometry(fromLat, fromLng, toLat, toLng, mode): Promise<LatLng[] | null>`
- `fetchAllLegGeometries(legs[]): Promise<(LatLng[] | null)[]>`

## Dependencies

Only `ORS_API_KEY` from `utils/constants` — no cross-service imports.

## Used by

`client/src/screens/NavigationScreen.tsx` (`fetchAllLegGeometries`) — draws road-accurate polylines for [[Smart Routing Engine]]-produced routes on the [[Map Layer]].

## Related
[[Architecture]] · [[Map Layer]] · [[Smart Routing Engine]] · [[Google Directions Service (Deprecated)]]
