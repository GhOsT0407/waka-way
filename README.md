# WakaWay — Lagos Transport Navigation App

**Move Smart. Move Local.** — A mobile app helping Lagos newcomers navigate informal transport: danfo, BRT, keke, okada, and molue.

---

## Overview

WakaWay is a React Native app built for people who are new to Lagos and unfamiliar with the city's informal transit network. It calculates multi-modal routes, shows fare estimates before you board, and gives step-by-step guidance — including pidgin instructions and landmark-based directions that match how Lagosians actually navigate.

The core problem: Lagos has no transit API. Danfo, keke, and okada routes exist only in the heads of locals. WakaWay solves this with a custom routing engine that encodes 29 Lagos stops and calculates realistic routes without any external transit data.

---

## Tech Stack

### Frontend
- **React Native** + **Expo** (TypeScript)
- **React Navigation** — stack + bottom tab navigation
- **Expo Location** — GPS, reverse geocoding
- **React Native Maps** — map display and route polylines
- **AsyncStorage** — offline caching, onboarding state

### Backend
- **Django** + **Django REST Framework**
- **SQLite** (dev) → PostgreSQL (production target)
- **Python 3.13**

---

## Design System

- **Accent**: Danfo orange `#E8541A` (light) / `#FF6B35` (dark)
- **Background**: Warm white `#F8F7F5`
- **Typography**: DM Sans — xs/10, sm/12, md/14, lg/16, xl/20, xxl/24, hero/32
- **Style**: Flat design, zero shadows on cards, color creates hierarchy
- **Transport colors**: Danfo `#F5C518` · BRT `#1A5BDB` · Keke `#2D7A4F` · Okada `#D93025`
- **Dark mode**: Full support via `ThemeContext` (`useAppTheme()` hook)

Design tokens live in `client/src/theme/colors.ts` (`LightColors`, `DarkColors`) and `client/src/context/ThemeContext.tsx`.

---

## The Custom Routing Engine

The engine in `client/src/services/smartRoutingService.ts` calculates routes with no external transit API:

| Feature | Detail |
|---|---|
| Stop network | 29 Lagos stops with real coordinates |
| First-mile pivot | Suggests keke/okada when walking > 1.2 km |
| Incident avoidance | Routes around reported hazards with 300 m buffer |
| Dynamic pricing | Peak hours (7–9 am, 5–8 pm), night rates, per-mode fares |
| Pidgin instructions | Each leg gets a localised instruction ("Enter danfo wey dey go CMS") |
| Difficulty rating | EASY (≤2 transit legs) · MODERATE (3) · COMPLEX (4+) |

---

## Project Structure

```
waka-way/
├── client/                        # React Native / Expo
│   └── src/
│       ├── screens/               # HomeScreen, SearchScreen, RouteDetailScreen,
│       │                          #   NavigationScreen, ContributionScreen,
│       │                          #   NotificationsScreen, YouScreen,
│       │                          #   LoginScreen, SignupScreen, OnboardingScreen
│       ├── components/
│       │   ├── SmartRouteOptions  # Route cards with fare, difficulty, leg timeline
│       │   ├── FareEstimateCard   # Dominant fare display
│       │   ├── TransportModeSelector
│       │   ├── map/               # CommunityMapView, AlertMarkers, AlertBottomSheet
│       │   ├── routing/           # RouteGuide (turn-by-turn)
│       │   └── ui/                # Toast, OfflineBanner, ErrorBoundary, PlacesRow
│       ├── context/               # ThemeContext, AuthContext, ToastContext
│       ├── services/              # smartRoutingService, locationService, apiClient
│       ├── theme/                 # colors.ts, typography.ts
│       └── utils/                 # constants.ts, offlineMapCache, mapUtils
│
└── server/backend/                # Django backend
    ├── core/                      # models, serializers, views, urls
    ├── routing/                   # (new) routing endpoints
    ├── stops/                     # (new) stops endpoints
    └── backend/                   # Django settings
```

---

## Getting Started

### Frontend

```bash
cd client
npm install
npx expo start
```

### Backend

```bash
cd server/backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Environment Variables

**Frontend** (`client/.env`):
```
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here
```

**Backend** (`server/backend/.env`):
```
SECRET_KEY=your_secret_key
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
```

### Development Mode Flags

Two flags in `client/src/utils/constants.ts` control mock behaviour:

```ts
USE_MOCK_AUTH = true   // skip real auth; any email/password logs in
USE_MOCK_DATA = true   // use local mock routes; no backend required
```

Set both to `false` when connecting to a real backend.

---

## Screens

| Screen | Description |
|---|---|
| **Onboarding** | 3-slide intro (dark bg, per-slide accent) — shown once |
| **Login / Signup** | Warm white, orange accent, animated focus fields |
| **Home** | Search-first; popular routes list; no map on home |
| **Search** | Full-screen overlay; autocomplete; recent searches |
| **Route Detail** | SmartRouteOptions cards — fare dominant, leg timeline |
| **Navigation** | Turn-by-turn with real-time location tracking |
| **Community Map** | Alert markers; report incident form |
| **Contribution** | Submit route/fare corrections |
| **Notifications** | Alert feed |
| **You** | Profile, settings, dark mode toggle |

---

## Current Status

**Phase**: Functional MVP — all screens implemented, custom routing engine live, UI fully redesigned to danfo-orange design system.

The app runs end-to-end in mock mode without a backend. Backend models and admin panel are ready; API endpoints are partially implemented.

See [FEATURES_STATUS.md](FEATURES_STATUS.md) for a detailed breakdown.
