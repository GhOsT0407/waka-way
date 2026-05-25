// WakaWay - Constants

export const TRANSPORT_MODES = {
  BUS: 'bus',
  KEKE: 'keke',
  OKADA: 'okada',
  WALK: 'walk',
} as const;

export const COLORS = {
  PRIMARY: '#00C853',      // Sharp Vivid Green
  SECONDARY: '#FFFFFF',    // White
  ACCENT: '#00E676',       // Neon Green Highlight
  BACKGROUND: '#FFFFFF',   // White
  TEXT: '#1B5E20',         // Dark Green Text
  TEXT_SECONDARY: '#43A047', // Medium Green
  ERROR: '#D50000',
  SUCCESS: '#00C853',
  WARNING: '#FFAB00',
  INFO: '#2979FF',
  WHITE: '#FFFFFF',
  BORDER: '#C8E6C9',       // Greenish Border
} as const;

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
} as const;

export const BORDER_RADIUS = {
  SMALL: 8,
  MEDIUM: 12,
  LARGE: 16,
  XL: 24,
  ROUND: 50,
} as const;

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export const FONT_SIZES = {
  DISPLAY_LARGE: 32,
  DISPLAY_MEDIUM: 24,
  HEADING_1: 24,
  HEADING_2: 20,
  HEADING_3: 18,
  BODY_LARGE: 16,
  BODY: 14,
  CAPTION: 12,
  SMALL: 10,
} as const;

export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api/v1'
  : 'https://api.wakaway.com/api/v1';

// Set to true to use local mock data (no Django backend required)
export const USE_MOCK_DATA = false;

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

