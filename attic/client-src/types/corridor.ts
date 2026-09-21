/**
 * WakaWay Corridor Types
 * 
 * Type definitions for Lagos transport corridors and stop connections
 */

// ============================================================
// CORRIDOR ENUMS & TYPES
// ============================================================

export type CorridorMode = 
  | 'danfo'   // Danfo/Minibus
  | 'brt'     // Bus Rapid Transit
  | 'keke'    // Keke/Tricycle
  | 'okada'   // Okada/Motorcycle
  | 'ferry'   // Ferry
  | 'walk'    // Walking
  | 'mixed';  // Mixed modes

export type StopType =
  | 'major_park'
  | 'major_interchange'
  | 'bus_stop'
  | 'major_bus_stop'
  | 'junction'
  | 'major_junction'
  | 'terminal'
  | 'major_terminal';

export type TransportMode =
  | 'danfo'
  | 'brt'
  | 'keke'
  | 'okada'
  | 'ferry'
  | 'walk';

// ============================================================
// LOCATION & STOP
// ============================================================

export interface Location {
  latitude: number;
  longitude: number;
}

export interface TransportStop {
  id: number;
  name: string;
  stop_type: string;
  location: Location | null;
  address?: string;
  city: number;
  landmark?: string;
  is_verified: boolean;
}

// ============================================================
// CORRIDOR STOP
// ============================================================

export interface CorridorStop {
  id: number;
  sequence: number;
  stop: TransportStop;
  stop_type: StopType;
  stop_type_display: string;
  estimated_time_from_previous: number;
}

// ============================================================
// STOP CONNECTION
// ============================================================

export interface StopConnection {
  id: number;
  from_stop: TransportStop;
  to_stop: TransportStop;
  transport_mode: TransportMode;
  transport_mode_display: string;
  corridor: number | null;
  estimated_time_minutes: number;
  distance_km: number;
  is_verified: boolean;
  created_at: string;
}

// ============================================================
// CORRIDOR
// ============================================================

export interface CorridorBase {
  id: number;
  corridor_id: string;
  name: string;
  primary_mode: CorridorMode;
  primary_mode_display: string;
  city_id: number;
  is_active: boolean;
  notes?: string;
}

export interface CorridorList extends CorridorBase {
  stop_count: number;
}

export interface City {
  id: number;
  name: string;
  state: string;
  country: string;
  is_active: boolean;
}

export interface CorridorDetail extends CorridorBase {
  description?: string;
  operating_hours_start?: string;
  operating_hours_end?: string;
  city: City;
  corridor_stops: CorridorStop[];
  connections: StopConnection[];
  created_at: string;
  updated_at: string;
}

// ============================================================
// API RESPONSES
// ============================================================

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface CorridorListResponse extends PaginatedResponse<CorridorList> {}
export interface CorridorStopListResponse extends PaginatedResponse<CorridorStop> {}
export interface StopConnectionListResponse extends PaginatedResponse<StopConnection> {}

// ============================================================
// QUERY PARAMETERS
// ============================================================

export interface CorridorQueryParams {
  city?: number;
  primary_mode?: CorridorMode;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface CorridorStopQueryParams {
  corridor?: number;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export interface StopConnectionQueryParams {
  from_stop?: number;
  to_stop?: number;
  transport_mode?: TransportMode;
  corridor?: number;
  page?: number;
  page_size?: number;
  ordering?: string;
}
