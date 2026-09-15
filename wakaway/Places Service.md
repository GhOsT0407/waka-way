
# Places Service

`client/src/services/placesService.ts` — two-layer place search/autocomplete for destination search.

## What it does

1. Instant local fuzzy search over a hardcoded `LAGOS_POIS` array (~40 major Lagos landmarks/malls/hospitals/bus stops, zero network cost).
2. Maptiler Geocoding API fallback for anything not in the local list, bounded to a Lagos bbox.

Merges and dedupes results; caches coordinates from both sources so `getPlaceDetails` never needs a second network round-trip.

## Key exports

- `searchPlaces(query): Promise<PlacePrediction[]>`
- `getPlaceDetails(placeId): Promise<PlaceDetails | null>`
- `isWithinLagos(lat, lng): boolean`

## Dependencies

Only `MAPTILER_KEY` from `utils/constants` — no cross-service imports.

## Used by

The three main location-search entry points: `YouScreen`, `SearchScreen`, `HomeScreen` (see [[Navigation & Screens]]).

## Related
[[Architecture]] · [[Navigation & Screens]] · [[Smart Routing Engine]]
