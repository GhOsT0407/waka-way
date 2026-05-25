# WakaWay — Features Status

Last updated: 2026-05-19

---

## Fully Implemented

### Screens & Navigation
- **OnboardingScreen** — 3-slide carousel, AsyncStorage flag, fade-out transition
- **LoginScreen** — animated focus fields, spring press button, mock auth support
- **SignupScreen** — full validation (email format, password length/match), mock auth support
- **HomeScreen** — search-first design, popular routes FlatList, animated search overlay, GPS origin chip
- **SearchScreen** — autocomplete, recent searches (AsyncStorage), places API integration
- **RouteDetailScreen** — SmartRouteOptions with fare cards, difficulty chips, leg timeline
- **NavigationScreen** — real-time location tracking, turn-by-turn RouteGuide, map view
- **CommunityMapView** — alert markers, incident reporting form, AlertBottomSheet
- **ContributionScreen** — submit route/fare corrections with location
- **NotificationsScreen** — alert feed
- **YouScreen** — profile, settings, dark mode toggle

### Custom Routing Engine (`smartRoutingService.ts`)
- 29 Lagos stops with real GPS coordinates
- Multi-modal route calculation: walk → keke/okada → danfo/BRT → walk
- First-mile pivot (keke/okada suggested when walking > 1.2 km)
- Incident avoidance routing with 300 m buffer
- Dynamic pricing: peak hours (7–9 am, 5–8 pm), night rates, per-mode base fares
- Pidgin/local instructions per leg
- Difficulty derivation: EASY (≤2 transit legs), MODERATE (3), COMPLEX (4+)
- Fare range display (min–max based on route variability)

### Design System
- `LightColors` / `DarkColors` token sets in `theme/colors.ts`
- `useAppTheme()` hook — `theme`, `isDark`, `toggleTheme`, `tokens`, `light`, `dark`
- Full dark mode support across all redesigned screens
- Transport mode color coding: Danfo #F5C518, BRT #1A5BDB, Keke #2D7A4F, Okada #D93025
- DM Sans typography scale (xs→hero)

### Backend (Django)
- All 10 database models defined and registered in admin
- DRF serializers for all models
- Health check endpoint (`GET /api/v1/health/`)
- Auth endpoints (registration, login via DRF tokens)
- Soft-delete migration applied (0003)
- Idempotency key support on reports

### Infrastructure
- Offline map tile caching (`offlineMapCache.ts`)
- Location service with permission handling, reverse geocoding
- API client (Axios) with interceptors and error handling
- Toast notification system
- Error boundary component
- Offline banner component

---

## Partially Implemented

### Backend API Endpoints
- Route search: frontend calls the custom routing engine directly (client-side); no `/api/v1/routes/search/` endpoint yet
- Reports: frontend submits to AsyncStorage; backend model exists but write endpoint not wired
- Stops: models exist; `/api/v1/stops/nearby/` not implemented

### Map Integration
- Map renders correctly; route polylines work with mock data
- Google Maps API key required for full directions — uses `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- Transport stop markers: frontend ready, needs real stop data from backend

---

## Not Yet Implemented

### Backend
- `/api/v1/routes/search/` — route search using server-side engine
- `/api/v1/stops/` and `/api/v1/stops/nearby/` — stop listings
- `/api/v1/reports/` write endpoint — persist user reports to DB
- `/api/v1/fares/` — fare lookup by route
- Push notifications (backend trigger)
- PostgreSQL + PostGIS migration (currently SQLite)

### Features
- Saved favourite places (backend storage; UI shows static mock)
- Route history (model exists; not surfaced in UI)
- Real-time transport availability
- Voice navigation
- Offline route caching (map tiles cached; full route data not yet persisted)

---

## Development Mode Flags

```ts
// client/src/utils/constants.ts
USE_MOCK_AUTH = true   // any credentials log in; no backend needed
USE_MOCK_DATA = true   // uses smartRoutingService directly; no API call
```

Set to `false` to connect to a live backend.

---

## Known Issues

1. **Google Maps API key** — map direction lines require a real key; configure in `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
2. **Android emulator** — use `10.0.2.2:8000` instead of `localhost` for backend URL
3. **Physical device** — use your machine's local IP address for `EXPO_PUBLIC_API_BASE_URL`
