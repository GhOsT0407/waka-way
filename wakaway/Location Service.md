
# Location Service

`client/src/services/locationService.ts` — thin wrapper around `expo-location` for device GPS.

## What it does

Permission requests, one-shot current location + reverse geocoding to a human address, continuous location watching (5s/10m thresholds), and forward geocoding (address → coordinates).

## Key exports

- `requestLocationPermission(): Promise<boolean>`
- `getCurrentLocation(): Promise<LocationData | null>` — includes reverse-geocoded `address`
- `watchLocation(callback)`
- `geocodeAddress(address): Promise<LocationCoords | null>`

## Dependencies

Only the external `expo-location` package — no cross-service imports.

## Used by

[[Map Layer]] (`MapView.tsx`, via `getCurrentLocation`). Narrower adoption than [[Places Service]] — other screens/hooks that need location largely call `expo-location` directly rather than through this wrapper.

## Related
[[Architecture]] · [[Map Layer]] · [[Places Service]]
