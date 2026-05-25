# WakaWay — Code Structure & Architecture

## Table of Contents
1. [Frontend Structure](#frontend-structure)
2. [Backend Structure](#backend-structure)
3. [API Design](#api-design)
4. [Key Patterns](#key-patterns)

---

## Frontend Structure

```
waka-way/client/
├── App.tsx                        # Expo entry — re-exports src/App.tsx
├── app.json                       # Expo config
├── package.json
├── tsconfig.json
│
└── src/
    ├── App.tsx                    # NavigationContainer + AuthStack + AppNavigator
    │
    ├── screens/
    │   ├── OnboardingScreen.tsx   # 3-slide intro; AsyncStorage flag; fade out
    │   ├── LoginScreen.tsx        # Animated focus fields; spring press button
    │   ├── SignupScreen.tsx       # Full validation; same field animation pattern
    │   ├── HomeScreen.tsx         # Search-first; popular routes FlatList; search overlay
    │   ├── SearchScreen.tsx       # Autocomplete; recent searches; places API
    │   ├── RouteDetailScreen.tsx  # SmartRouteOptions; fare cards; leg timeline
    │   ├── NavigationScreen.tsx   # Real-time tracking; turn-by-turn RouteGuide
    │   ├── ContributionScreen.tsx # Submit route/fare corrections
    │   ├── NotificationsScreen.tsx
    │   ├── PreferencesScreen.tsx
    │   └── YouScreen.tsx          # Profile; settings; dark mode toggle
    │
    ├── components/
    │   ├── SmartRouteOptions.tsx  # Route cards: fare dominant, difficulty chip, leg timeline
    │   ├── FareEstimateCard.tsx   # Standalone fare display component
    │   ├── TransportModeSelector.tsx  # Bottom-sheet modal; spring open, cubic-ease close
    │   ├── RouteStepCard.tsx
    │   │
    │   ├── map/
    │   │   ├── CommunityMapView.tsx  # Alert markers + incident report form
    │   │   ├── AlertMarkers.tsx
    │   │   ├── AlertBottomSheet.tsx
    │   │   ├── MapView.tsx
    │   │   └── index.ts
    │   │
    │   ├── routing/
    │   │   ├── RouteGuide.tsx     # Turn-by-turn guidance component
    │   │   └── index.ts
    │   │
    │   ├── route/
    │   │   ├── RouteCard.tsx
    │   │   └── RouteStepCard.tsx
    │   │
    │   ├── search/
    │   │   └── SearchBar.tsx
    │   │
    │   └── ui/
    │       ├── Toast.tsx
    │       ├── OfflineBanner.tsx
    │       ├── ErrorBoundary.tsx
    │       ├── PlacesRow.tsx
    │       ├── WeatherWidget.tsx
    │       ├── MapControls.tsx
    │       ├── LocationDot.tsx
    │       ├── RecentsList.tsx
    │       ├── ShareLocationButton.tsx
    │       └── GuidesSection.tsx
    │
    ├── context/
    │   ├── ThemeContext.tsx        # useAppTheme() — theme, isDark, toggleTheme, tokens
    │   ├── AuthContext.tsx         # useAuth() — isAuthenticated, login, signup, logout
    │   └── ToastContext.tsx        # useToast() — showSuccess/Error/Warning/Info
    │
    ├── services/
    │   ├── smartRoutingService.ts  # Core routing engine (29 stops, no transit API)
    │   ├── routingEngine.ts        # Lower-level routing primitives
    │   ├── locationService.ts      # GPS, permissions, reverse geocoding
    │   ├── api.ts                  # Axios client + corridor API methods
    │   ├── placesService.ts        # Google Places / geocoding integration
    │   ├── reportService.ts        # User report submission
    │   ├── incidentService.ts      # Incident avoidance routing
    │   ├── pricingService.ts       # Fare calculation helpers
    │   ├── pricingEngine.ts        # Dynamic pricing (peak hours, night rates)
    │   ├── lagosRouteRules.ts      # Lagos-specific routing constraints
    │   ├── routeValidator.ts       # Route validation logic
    │   ├── routeAutoFixer.ts       # Auto-correct malformed routes
    │   ├── guideGenerator.ts       # Step instruction generation
    │   ├── googleDirectionsService.ts
    │   ├── geofencingService.ts
    │   ├── proximityAlertService.ts
    │   ├── supabaseDataService.ts
    │   ├── imageUploadService.ts
    │   └── mockData.ts             # Static mock routes for USE_MOCK_DATA=true
    │
    ├── hooks/
    │   ├── useNetworkStatus.ts
    │   ├── useRouting.ts
    │   ├── useContributions.ts
    │   ├── useRealtimeContributions.ts
    │   └── index.ts
    │
    ├── theme/
    │   ├── colors.ts              # LightColors, DarkColors, legacy Colors alias
    │   └── typography.ts          # Typography scale (xs=10 → hero=32) + weights
    │
    ├── types/
    │   ├── route.types.ts
    │   ├── routing.ts
    │   ├── corridor.ts            # Corridor, CorridorStop, StopConnection types
    │   └── index.ts
    │
    ├── utils/
    │   ├── constants.ts           # USE_MOCK_AUTH, USE_MOCK_DATA, SPACING, BORDER_RADIUS
    │   ├── formatters.ts          # formatTime, formatFare, formatDistance
    │   ├── locationDetector.ts
    │   ├── offlineMap.ts          # Offline map tile caching
    │   └── smartRouter.ts
    │
    ├── data/
    │   └── lagosStops.ts          # Static stop coordinates for the routing engine
    │
    └── lib/
        └── supabase.ts
```

### Navigation Architecture

Navigation is defined entirely in `src/App.tsx` — there is no separate `navigation/` folder.

```
App
└── AppNavigator
    ├── [not authenticated]
    │   └── Auth (Stack.Screen → AuthStack)
    │       ├── Login
    │       └── Signup
    │
    └── [authenticated, onboarding done]
        ├── Home                   (root)
        ├── You                    (modal, slide_from_bottom)
        ├── Contribution           (modal, slide_from_bottom)
        ├── Search                 (formSheet, slide_from_bottom)
        ├── RouteDetail            (formSheet, slide_from_bottom)
        ├── Notifications          (slide_from_right)
        ├── Preferences            (slide_from_right)
        └── Navigation             (slide_from_bottom, gesture disabled)
```

Onboarding (`OnboardingScreen`) is rendered outside `NavigationContainer` while `onboardingDone === false`, then replaced by the navigator on completion.

### Theme System

```typescript
// client/src/theme/colors.ts
export const LightColors = { bg, surface, accent: '#E8541A', ... } as const;
export const DarkColors  = { bg, surface, accent: '#FF6B35', ... } as const;
export const Colors      = { /* legacy alias — all values map to LightColors */ };

// client/src/context/ThemeContext.tsx
export const useAppTheme = () => {
  // returns: { theme, isDark, toggleTheme, tokens, light, dark }
};
```

Always use `tokens` (= `LightColors | DarkColors`) or `LightColors` directly. Never hardcode hex values in component `StyleSheet.create()` — use the token constants.

### Mode Flags

```typescript
// client/src/utils/constants.ts
export const USE_MOCK_AUTH = true;  // any credentials log in
export const USE_MOCK_DATA = true;  // routing engine runs client-side
```

---

## Backend Structure

```
waka-way/server/backend/
├── manage.py
├── requirements.txt
├── db.sqlite3
├── .env.example
├── Dockerfile
├── docker-compose.yml
│
├── backend/                      # Project settings
│   ├── settings.py
│   ├── urls.py                   # Root URL conf: /api/v1/ → core + routing + stops + reports
│   ├── wsgi.py
│   └── asgi.py
│
├── core/                         # Base models + corridor data
│   ├── models.py                 # 13 models (see Database Schema)
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py                   # /api/v1/corridors/, /corridor-stops/, /stop-connections/
│   ├── admin.py
│   ├── migrations/
│   │   ├── 0001_initial.py
│   │   ├── 0002_corridor_models.py
│   │   └── 0003_soft_deletes_and_idempotency.py
│   └── management/commands/
│       └── seed_lagos_corridors.py
│
├── routing/                      # Route calculation endpoints
│   ├── views.py
│   ├── urls.py
│   ├── services.py
│   ├── serializers.py
│   └── lagos_stops.py            # Server-side stop coordinates
│
├── stops/                        # Transport stop endpoints
│   ├── views.py
│   ├── urls.py
│   ├── services.py
│   └── serializers.py
│
└── reports/                      # User report endpoints
    ├── views.py
    ├── urls.py
    ├── services.py
    └── serializers.py
```

---

## API Design

### Base URL
```
Development: http://localhost:8000/api/v1/
```

### Authentication
DRF token auth. `USE_MOCK_AUTH=true` bypasses real auth during frontend development.

### Implemented Endpoints

```
GET  /api/v1/health/                   # Health check
GET  /api/v1/corridors/                # List corridors (paginated, filterable)
GET  /api/v1/corridors/{id}/           # Corridor detail with stops & connections
GET  /api/v1/corridor-stops/           # List corridor stops
GET  /api/v1/stop-connections/         # List inter-stop connections
```

### Planned Endpoints (models exist, views partially implemented)

```
POST /api/v1/routes/search/            # Server-side route search
GET  /api/v1/stops/nearby/             # Nearby stops by lat/lng
POST /api/v1/reports/                  # Submit user report
GET  /api/v1/reports/                  # List reports
POST /api/v1/reports/{id}/vote/        # Upvote/downvote report
GET  /api/v1/favorites/                # User favourite places
GET  /api/v1/history/                  # Route search history
```

### Corridor API Query Parameters

```
GET /api/v1/corridors/?city=1&primary_mode=brt&search=Ikorodu&page=1&page_size=20
```

| Param | Values |
|---|---|
| `city` | City ID |
| `primary_mode` | `danfo` `brt` `keke` `okada` `ferry` `walk` `mixed` |
| `is_active` | `true` / `false` |
| `search` | Name or corridor_id substring |
| `ordering` | `name` `-name` `created_at` |

---

## Key Patterns

### Routing (client-side)

`smartRoutingService.ts` is the authoritative routing engine. It runs entirely on-device with no network call when `USE_MOCK_DATA=true`.

Difficulty is derived from transit leg count — not stored:
```typescript
// ≤2 transit legs → EASY · 3 → MODERATE · 4+ → COMPLEX
const transitLegs = legs.filter(l => l.mode !== 'walk').length;
```

Each `RouteLeg` has both `instruction` (English) and `localInstruction` (pidgin).

### Back navigation guard

All screens guard `navigation.goBack()` with `canGoBack()`:
```typescript
onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home')}
// SignupScreen fallback: navigate('Login')
```

### Overlay & scroll conventions

- Overlay open: `Animated.timing` with `Easing.out(Easing.cubic)`, 220ms
- Overlay close: `Animated.timing` with `Easing.in(Easing.cubic)`, 160ms
- Bottom sheet open: `Animated.spring` (friction 8, tension 50) — already feels natural
- All `FlatList` components use `decelerationRate="normal"` + `overScrollMode="never"`

### Transport mode colors

```typescript
// Hardcoded in SmartRouteOptions and HomeScreen — not in theme tokens
const MODE = {
  danfo: { bg: '#F5C518', text: '#111111' },
  brt:   { bg: '#1A5BDB', text: '#FFFFFF' },
  keke:  { bg: '#2D7A4F', text: '#FFFFFF' },
  okada: { bg: '#D93025', text: '#FFFFFF' },
};
```
