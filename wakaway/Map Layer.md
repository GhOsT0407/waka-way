
# Map Layer

`client/src/components/map/` — renders routes, user location, and community data on `react-native-maps` (Google Maps provider).

## Components

**MapView.tsx** — main map used during route planning/navigation.
- Renders the route polyline when a [[Smart Routing Engine|route]] is active
- Loads/renders reports via [[Report Service]] (Supabase, with local AsyncStorage fallback)
- User location tracking + "center on me" button, via [[Location Service]]
- 60s cleanup interval to expire stale reports
- Custom dark map style from `utils/constants.ts` (`GOOGLE_MAPS_DARK_STYLE`), paired with [[Theming]]

**CommunityMapView.tsx** — the community-alerts view.
- Uses [[useContributions Hook]] (distinct from [[useRealtimeContributions Hook]]) to load [[Community Contributions]]
- Renders contributions as colored markers with a bottom-sheet detail + vote UI
- Draws danger-zone circles around security/hazard alerts
- Filters by contribution type via a `filterTypes` prop
- Reads proximity config from [[Proximity Alert Service]]

**AlertMarkers.tsx** — reusable marker rendering, generic + type-specific exports (`TrafficMarkers`, `SecurityMarkers`, `HazardMarkers`, `TransportMarkers`).
- Priority order: security (5) > hazard/traffic (4) > construction (3) > bus_stop (2) > other (1)
- Renders both a `Circle` (geofence-style radius) and a `Marker` (pin) per contribution

## Data flow

```
useRealtimeContributions / useContributions
        ↓
CommunityMapView / LiveAlertsFeed
        ↓
AlertMarkers (colored pins + circles)
```

## Related
[[Architecture]] · [[Community Contributions]] · [[Smart Routing Engine]] · [[Theming]] · [[Report Service]] · [[Location Service]] · [[useContributions Hook]] · [[Proximity Alert Service]]
