// WakaWay - Constants

import { Space, Radius } from '../theme/spacing';
import { Typography } from '../theme/typography';

// ── Legacy token aliases ──────────────────────────────────────────────────────
// These three objects predate theme/spacing.ts and theme/typography.ts and are
// still referenced from ~25 files. They now resolve to the theme scales so
// there is one set of values; prefer Space / Radius / Typography in new code.

export const SPACING = {
  XS:  Space.xs,    // 4
  SM:  Space.sm,    // 8
  MD:  Space.lg,    // 16
  LG:  Space.xl,    // 24
  XL:  Space.xxl,   // 32
  XXL: Space.xxxl,  // 48
} as const;

export const BORDER_RADIUS = {
  SMALL:  Radius.sm,    // was 8  → 10
  MEDIUM: Radius.md,    // 12
  LARGE:  Radius.lg,    // 16
  XL:     Radius.xl,    // was 24 → 20
  ROUND:  Radius.pill,  // was 50 → 999
} as const;

export const FONT_SIZES = {
  DISPLAY_LARGE:  Typography.hero,  // was 32 → 34
  DISPLAY_MEDIUM: Typography.xxl,   // was 24 → 28
  HEADING_1:      Typography.xxl,   // was 24 → 28
  HEADING_2:      Typography.xl,    // was 20 → 22
  HEADING_3:      Typography.lg,    // was 18 → 17
  BODY_LARGE:     Typography.lg,    // was 16 → 17
  BODY:           Typography.md,    // was 14 → 15
  CAPTION:        Typography.sm,    // was 12 → 13
  SMALL:          Typography.xs,    // was 10 → 11
} as const;

export const TRANSPORT_MODES = {
  BUS: 'bus',
  KEKE: 'keke',
  OKADA: 'okada',
  WALK: 'walk',
} as const;



// MapTiler is still used for place search/geocoding (placesService.ts) —
// map rendering itself now runs on Google Maps via react-native-maps.
export const MAPTILER_KEY = process.env.EXPO_PUBLIC_MAPTILER_KEY || '';
export const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY || '';

// Google Maps custom style (dark mode) — matches the WW_DARK brand palette.
// Light mode uses Google's default style (pass an empty array).
export const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b0f0d' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a9590' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0f0d' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#d4d9d6' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#131815' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#6b756f' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#10180f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1d2420' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0b0f0d' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a9590' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2418' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0b0f0d' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#F5C518' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#131815' }] },
  { featureType: 'transit.station', elementType: 'labels.text.fill', stylers: [{ color: '#8a9590' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#060a09' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5550' }] },
] as const;

export const GOOGLE_MAPS_LIGHT_STYLE = [] as const;


export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://waka-way-production.up.railway.app/api/v1';

// Django backend is not required — routing runs client-side via smartRoutingService
export const USE_MOCK_DATA = true;

export const REPORT_TYPES = {
  FARE_UPDATE: 'fare_update',
  ROUTE_DISRUPTED: 'route_disrupted',
  NEW_ROUTE: 'new_route',
  STOP_MOVED: 'stop_moved',
  ROUTE_WRONG: 'route_wrong',
  OTHER: 'other',
} as const;

export const CITIES = {
  LAGOS: 1,
  ABUJA: 2,
} as const;

// Default settings
export const DEFAULT_SETTINGS = {
  MAX_WALK_DISTANCE_KM: 1.0,
  DEFAULT_SEARCH_RADIUS_KM: 5.0,
  DEFAULT_CITY_ID: CITIES.LAGOS,
} as const;

