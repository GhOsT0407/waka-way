// WakaWay - Route Type Definitions

export interface Location {
  latitude: number;
  longitude: number;
}

export interface LocationWithName extends Location {
  name?: string;
  address?: string;
}

export interface RouteStep {
  sequence: number;
  transport_mode: 'bus' | 'keke' | 'okada' | 'walk';
  route_id?: number;
  route_number?: string;
  instruction: string;
  start_location: Location;
  end_location: Location;
  distance_km: number;
  duration_minutes: number;
  fare_ngn: number;
  intermediate_stops?: LocationWithName[];
}

export interface RouteSuggestion {
  id: number;
  total_time_minutes: number;
  total_distance_km: number;
  total_fare_ngn: number;
  transport_modes: string[];
  steps: RouteStep[];
  path?: {
    type: string;
    coordinates: number[][];
  };
}

export interface RouteSearchRequest {
  origin: Location;
  destination: Location;
  city: number;
  transport_modes?: string[];
  max_walk_distance_km?: number;
}

export interface RouteSearchResponse {
  suggestions: RouteSuggestion[];
}

