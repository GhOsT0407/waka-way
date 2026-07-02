
# Proximity Alert Service

`client/src/services/proximityAlertService.ts` — standalone proximity-alert engine for security/hazard alerts.

## What it does

Watches the user's live location (`expo-location`), computes Haversine distance to nearby `security`/`danger_zone`/`hazard` [[Community Contributions|contributions]], and fires local push notifications (`expo-notifications`) plus device vibration when the user enters a configurable radius (default 2km). De-dupes via a 30-minute cooldown persisted in `AsyncStorage`.

## Key exports

- `calculateDistance`, `formatDistance`
- `configureProximityNotifications()`
- `sendProximityNotification(contribution, distance)`
- `checkProximityAlerts(contributions, userLocation, radiusKm?)`
- `processNewContribution(contribution, userLocation, radiusKm?)`
- `startProximityWatching(contributions, radiusKm?, onAlert?)`, `updateWatchedContributions`, `stopProximityWatching`
- `clearNotificationHistory()`

## Dependencies

Type-only import of `Contribution` from [[useContributions Hook]].

## Used by

[[Map Layer]] (`CommunityMapView.tsx`) — but only `configureProximityNotifications` and `calculateDistance` are actually consumed; `startProximityWatching`, `processNewContribution`, and `sendProximityNotification` appear unused outside this file.

## Known duplication

[[useContributions Hook]] has its **own independent** inline copy of this same Haversine/notification/cooldown logic rather than calling into this service. See [[Service Duplication & Dead Code]].

## Related
[[Architecture]] · [[Map Layer]] · [[Community Contributions]] · [[useContributions Hook]] · [[Service Duplication & Dead Code]]
