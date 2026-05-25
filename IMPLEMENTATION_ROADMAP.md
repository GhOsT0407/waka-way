# WakaWay — Implementation Roadmap

## Table of Contents
1. [MVP Development Phases](#mvp-development-phases)
2. [Technical Setup](#technical-setup)
3. [Development Checklist](#development-checklist)
4. [Testing Strategy](#testing-strategy)
5. [Deployment Plan](#deployment-plan)

---

## MVP Development Phases

### Phase 0: Project Setup ✅ COMPLETE

#### Frontend Setup
- [x] Initialize Expo project
- [x] Install dependencies (React Navigation, Maps, Location)
- [x] Set up TypeScript configuration
- [x] Configure app.json with app details
- [x] Set up folder structure
- [x] Configure colors and typography constants (danfo orange design system, DM Sans)
- [x] Create base components (Button, Input, Card)

#### Backend Setup
- [x] Set up Django project
- [x] Install Django REST Framework
- [x] Set up SQLite (dev) / PostGIS fallback
- [x] Set up CORS for mobile app
- [x] Create core app structure
- [x] Configure settings.py
- [x] Set up virtual environment

#### Infrastructure
- [x] Set up version control (Git)
- [x] Configure environment variables (.env.example)
- [x] Dockerfile + docker-compose.yml

---

### Phase 1: Core Models & Database ✅ COMPLETE

#### Backend
- [x] City model
- [x] TransportStop model
- [x] TransportRoute model
- [x] RouteSegment model
- [x] Fare model
- [x] RouteSuggestion model
- [x] RouteStep model
- [x] UserReport model (+ idempotency_key + soft delete via migration 0003)
- [x] UserFavoritePlace model (+ soft delete via migration 0003)
- [x] UserRouteHistory model
- [x] Corridor model (migration 0002)
- [x] CorridorStop model (migration 0002)
- [x] StopConnection model (migration 0002)
- [x] Run migrations (0001_initial, 0002_corridor_models, 0003_soft_deletes_and_idempotency)
- [x] Django admin interface
- [x] Database indexes

#### Data Collection
- [x] 29 Lagos stops encoded in smartRoutingService.ts (client-side)
- [x] 8 corridors (C001–C008), 79 stops, 40+ connections in seed data
- [x] Fare information and route data
- [x] Management command for data seeding (`seed_lagos_corridors`)

**Status**: 13 models, 3 migrations, full admin interface.

---

### Phase 2: API Development ✅ PARTIAL

#### API Endpoints — Implemented
- [x] Corridor endpoints (`GET /api/v1/corridors/`, `/corridors/{id}/`)
- [x] CorridorStop endpoints (`GET /api/v1/corridor-stops/`)
- [x] StopConnection endpoints (`GET /api/v1/stop-connections/`)
- [x] Health check (`GET /api/v1/health/`)

#### API Endpoints — Planned (models exist, views partially implemented)
- [ ] Route search (`POST /api/v1/routes/search/`)
- [ ] Nearby stops (`GET /api/v1/stops/nearby/`)
- [ ] User reports (`POST /api/v1/reports/`, upvote/downvote)
- [ ] Favorites (`GET/POST /api/v1/favorites/`)
- [ ] Route history (`GET /api/v1/history/`)

#### Route Calculation Service
- [x] Client-side routing engine (`smartRoutingService.ts`) — 29 stops, no external API
- [x] Multi-modal route combination (danfo, keke, okada, BRT, walk)
- [x] Time estimation, fare calculation, route optimization
- [x] Incident avoidance (`incidentService.ts`)
- [x] Dynamic pricing (`pricingEngine.ts`) — peak hours, night rates
- [ ] Server-side route calculation (routing/ app scaffolded, not complete)

**Status**: Corridor APIs live. Client-side routing engine fully functional. Server-side route search pending.

---

### Phase 3: Frontend — Core Screens ✅ COMPLETE

#### Navigation Setup
- [x] React Navigation (native stack)
- [x] Auth stack (Login, Signup)
- [x] App stack (Home, Search, RouteDetail, Navigation, You, Contribution, Notifications, Preferences)
- [x] Onboarding screen (outside NavigationContainer, AsyncStorage flag)

#### Home Screen
- [x] Search-first design (warm white `#F8F7F5` background, no map)
- [x] Search bar component (56px, orange location pin)
- [x] GPS origin chip
- [x] Popular routes FlatList
- [x] Search overlay (slides up with cubic easing)

#### Search Screen
- [x] Search input with autocomplete
- [x] Recent searches FlatList
- [x] Places API integration (`placesService.ts`)

#### Route Detail Screen
- [x] SmartRouteOptions component (fare-dominant cards)
- [x] Difficulty chip (EASY / MODERATE / COMPLEX)
- [x] Leg timeline with pidgin instructions
- [x] Start Journey button → NavigationScreen

#### Navigation Screen
- [x] Real-time GPS tracking
- [x] Turn-by-turn RouteGuide component
- [x] Route progress tracking

#### Other Screens
- [x] OnboardingScreen (3 slides, dark navy `#0F172A`, per-slide accent colors)
- [x] LoginScreen (danfo orange, DM Sans, card form)
- [x] SignupScreen (same pattern)
- [x] ContributionScreen (report submission)
- [x] NotificationsScreen
- [x] YouScreen (profile, dark mode toggle)

---

### Phase 4: Maps & Location ✅ IMPLEMENTED

- [x] GPS location detection (`locationService.ts`, expo-location)
- [x] Location permissions handling
- [x] Reverse geocoding
- [x] Google Places / geocoding integration (`placesService.ts`, `googleDirectionsService.ts`)
- [x] Map view component (`CommunityMapView`, `AlertMarkers`, `AlertBottomSheet`)
- [x] Geofencing and proximity alerts (`geofencingService.ts`, `proximityAlertService.ts`)
- [x] Offline map tile caching (`offlineMap.ts`)

---

### Phase 5: Route Search Integration ✅ COMPLETE (client-side)

- [x] Axios API client (`api.ts`)
- [x] Client-side routing engine with 29 Lagos stops (no network call when `USE_MOCK_DATA=true`)
- [x] Route visualization on map
- [x] Step-by-step instructions (English + pidgin)
- [x] Transport mode icons and fare display
- [x] Route sort/filter
- [x] Route auto-correction (`routeAutoFixer.ts`)
- [x] Route validation (`routeValidator.ts`)

---

### Phase 6: User Reports ✅ IMPLEMENTED

- [x] ContributionScreen UI (report type selection, form fields)
- [x] `reportService.ts` — submit report with idempotency key
- [x] Confirmation and error handling
- [x] Soft delete support on UserReport (migration 0003)

---

### Phase 7: Polish & UX ✅ COMPLETE

- [x] Danfo orange design system (LightColors / DarkColors token system)
- [x] DM Sans typography (xs=10 → hero=32)
- [x] Flat design — zero card elevation, color creates hierarchy
- [x] Overlay animations: `Easing.out(Easing.cubic)` 220ms enter / `Easing.in(Easing.cubic)` 160ms exit
- [x] Bottom sheet: `Animated.spring` (friction 8, tension 50)
- [x] FlatList scroll: `decelerationRate="normal"` + `overScrollMode="never"`
- [x] Onboarding screen (3 slides)
- [x] Dark mode toggle (ThemeContext)
- [x] Error boundary
- [x] Offline banner
- [x] Toast notifications

---

### Phase 8: Testing & QA ⏳ PENDING

- [ ] Unit tests for components
- [ ] Integration tests for route search flow
- [ ] End-to-end tests
- [ ] API tests (corridor endpoints)
- [ ] Device testing (iOS, Android)
- [ ] Bug fixes from testing

---

### Phase 9: Launch Preparation ⏳ PENDING

- [ ] App icon and splash screen finalization
- [ ] App store screenshots
- [ ] Privacy policy / Terms of service
- [ ] Production database setup (PostgreSQL + PostGIS)
- [ ] Backend deployment (Gunicorn + Docker)
- [ ] Play Store / App Store submission

---

## Technical Setup

### Frontend Dependencies

```json
{
  "dependencies": {
    "expo": "~54.0.23",
    "react": "19.1.0",
    "react-native": "0.81.5",
    "@react-navigation/native": "^7.1.19",
    "@react-navigation/native-stack": "^7.6.2",
    "expo-location": "~19.0.7",
    "react-native-maps": "^1.26.18",
    "axios": "^1.13.2",
    "@react-native-async-storage/async-storage": "^2.1.0",
    "@expo/vector-icons": "^14.0.4"
  }
}
```

### Backend Dependencies

```txt
Django==5.2
djangorestframework==3.15.2
django-cors-headers==4.6.0
psycopg2-binary==2.9.10
django-environ==0.11.2
```

### Backend Run (Development)

```bash
cd server/backend
python manage.py migrate
python manage.py seed_lagos_corridors --file waka_way_corridors.json --city Lagos
python manage.py runserver
```

### Database Setup (Production)

```bash
# PostgreSQL + PostGIS
sudo apt-get install postgresql-postgis
createdb wakaway_db
psql -d wakaway_db -c "CREATE EXTENSION postgis;"
```

---

## Development Checklist

### MVP Features — Current Status

- [x] Design documentation (danfo orange system)
- [x] Database schema (13 models, 3 migrations)
- [x] Code structure (10 screens, 30+ components/services)
- [x] GPS location detection
- [x] Destination search (autocomplete)
- [x] Route suggestions (client-side, 29 stops)
- [x] Step-by-step instructions (English + pidgin)
- [x] Fare estimates
- [x] Travel time estimates
- [x] Map visualization (NavigationScreen + CommunityMapView)
- [x] User reports (ContributionScreen)
- [x] Dark mode
- [x] Offline banner

### Future Features

- [ ] Server-side route search API
- [ ] Real-time navigation improvements
- [ ] User authentication (backend — mock auth works in dev)
- [ ] Favorite places (backend API)
- [ ] Route history (backend API)
- [ ] Payment integration
- [ ] Multi-city support (Abuja, Port Harcourt)

---

## Testing Strategy

### Unit Tests
- Component rendering
- Utility functions (formatters, routing engine)
- API serializers
- Route calculation logic

### Integration Tests
- Corridor API endpoints
- Route search flow
- Report submission flow

### End-to-End Tests
- Route search → route detail → navigation
- Onboarding → login → home

### Manual Testing
- Device testing (iOS, Android)
- Network conditions (3G, 4G, WiFi, offline)
- Dark mode on both platforms

---

## Deployment Plan

### Backend Deployment
1. **Hosting**: AWS EC2 / DigitalOcean / Render
2. **Database**: PostgreSQL + PostGIS (managed)
3. **API**: Django + Gunicorn (Dockerfile included)
4. **Static Files**: AWS S3 / WhiteNoise
5. **Monitoring**: Sentry

### Frontend Deployment
1. **Build**: Expo EAS Build
2. **Distribution**:
   - Google Play Store (Android)
   - Apple App Store (iOS)
   - Expo Go (development/testing)

### CI/CD
1. GitHub Actions for automated testing
2. Automated deployment on merge to main
3. Environment management (dev → staging → prod)

---

## Success Metrics

### User Engagement
- Daily active users (DAU)
- Routes searched per user
- Reports submitted
- Routes shared

### Technical Performance
- API response time (< 2s)
- App load time (< 3s)
- Crash rate (< 1%)
- Route accuracy (> 90%)

### Business Metrics
- App downloads
- User retention (30-day)
- User satisfaction (ratings)
