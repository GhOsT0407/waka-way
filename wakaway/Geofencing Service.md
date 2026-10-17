
# Geofencing Service

`client/src/services/geofencingService.ts` — the core of turn-by-turn "arrival nudge" UX during active navigation.

## What it does

Watches live location during an active `MultimodalRoute` (the [[Routing Engine (Legacy)]] shape), fires proximity thresholds (300m/200m/100m/50m) as the user approaches a stop, plus the Lagos-specific "Owa!" shout-to-stop-the-bus alert for danfo/BRT legs. Advances `currentLegIndex` as legs complete; vibration + `expo-notifications` alerts have per-key 30s cooldowns.

## Key exports

- `configureGeofenceNotifications()`
- `startRouteMonitoring(route, onLocationUpdate?, onArrivalNudge?, onLegComplete?)`, `stopRouteMonitoring()`
- `triggerDangerZoneNotification(zoneName, distanceMeters)`
- `createRouteGeofences(route)`, `checkGeofences(userLocation, regions)`
- `GEOFENCE_CONFIG`, `calculateDistance` (re-exported)

## Dependencies

`calculateDistance` from [[Pricing Service]]; `generateOwaReminder`/`generateArrivalNudge` from [[Guide Generator]].

## Used by

[[useRouting Hook]] only — `startRouteMonitoring`, `stopRouteMonitoring`, `configureGeofenceNotifications`. Since that hook itself appears unwired to any screen (see [[Service Duplication & Dead Code]]), this navigation-alert system is not currently reachable from the running app either — [[Navigation Screen]]/`NavigationScreen.tsx` gets its geofencing separately.

## Related
[[Architecture]] · [[Pricing Service]] · [[Guide Generator]] · [[useRouting Hook]] · [[Service Duplication & Dead Code]]
