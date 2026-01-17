/**
 * WakaWay Multimodal Routing Types
 * 
 * Comprehensive type definitions for Lagos multimodal transit routing
 */

// ============================================================
// COORDINATES & LOCATION
// ============================================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Location extends Coordinates {
  name?: string;
  address?: string;
}

// ============================================================
// TRANSIT TYPES
// ============================================================

export type TransitMode = 
  | 'walk'
  | 'keke'      // Tricycle (Keke Napep/Marwa)
  | 'okada'     // Motorcycle
  | 'danfo'     // Yellow minibus
  | 'brt'       // Bus Rapid Transit
  | 'ferry'     // Lagos ferry
  | 'uber'      // Ride-hailing
  | 'bolt';     // Ride-hailing

export type LegType = 
  | 'first_mile'    // Start to first transit node
  | 'connector'     // Short connector between modes
  | 'main_transit'  // Main bus/BRT leg
  | 'intermediate'  // Transfer point
  | 'last_mile';    // Final leg to destination

export type LandmarkType = 
  | 'keke_stand'
  | 'okada_junction'
  | 'bus_stop'
  | 'brt_station'
  | 'ferry_terminal'
  | 'junction'
  | 'market'
  | 'mall'
  | 'hospital'
  | 'school'
  | 'church'
  | 'mosque'
  | 'police_station'
  | 'other';

// ============================================================
// LANDMARKS
// ============================================================

export interface Landmark {
  id: string;
  name: string;
  type: LandmarkType;
  latitude: number;
  longitude: number;
  address?: string;
  local_name?: string;        // Local/informal name
  operating_hours?: string;   // e.g., "6am-10pm"
  is_24hr?: boolean;
  verified?: boolean;
  created_at?: string;
}

// ============================================================
// ROUTE LEGS
// ============================================================

export interface RouteLeg {
  id: string;
  type: LegType;
  mode: TransitMode;
  
  // Locations
  start: Location;
  end: Location;
  
  // Distance & Duration
  distance_meters: number;
  duration_minutes: number;
  
  // Pricing
  price_estimate: PriceEstimate;
  
  // Instructions
  instruction: string;
  local_instruction?: string;   // Lagos pidgin/local version
  nudge?: string;               // Special tip (e.g., "tell driver to stop at...")
  
  // Flags
  is_long_walk?: boolean;       // Walk > 1.2km
  has_pivot?: boolean;          // Pivoted from walk to vehicle
  pivot_reason?: string;
  
  // Safety
  safety_alert?: SafetyAlert;
  is_night_route?: boolean;
  
  // Landmarks along the way
  landmarks?: Landmark[];
  
  // Polyline for map display
  polyline?: string;
}

export interface SafetyAlert {
  type: 'security' | 'traffic' | 'hazard' | 'construction';
  severity: 'low' | 'medium' | 'high';
  message: string;
  contribution_id?: string;
  expires_at?: string;
}

// ============================================================
// PRICING
// ============================================================

export interface PriceEstimate {
  base_fare: number;
  distance_fare: number;
  time_surcharge: number;       // Night surcharge, peak hours
  safety_surcharge: number;     // Forced vehicle due to safety
  total: number;
  currency: 'NGN';
  
  // Price range for negotiable fares
  min_price?: number;
  max_price?: number;
  
  // Flags
  is_negotiable?: boolean;      // Keke/Okada often negotiable
  is_night_price?: boolean;
  is_peak_price?: boolean;
  
  // Breakdown text
  breakdown?: string;
}

export interface PricingConfig {
  // Walking
  walk_cost: number;            // Always 0
  
  // Danfo/BRT
  danfo_base_fare: number;
  danfo_rate_per_km: number;
  brt_base_fare: number;
  brt_rate_per_km: number;
  
  // Keke/Okada (Short trips)
  keke_short_trip_min: number;
  keke_short_trip_max: number;
  keke_rate_per_km: number;
  okada_short_trip_min: number;
  okada_short_trip_max: number;
  okada_rate_per_km: number;
  
  // Ferry
  ferry_base_fare: number;
  
  // Surcharges
  night_surcharge_percent: number;      // 20-50%
  peak_surcharge_percent: number;       // 10-30%
  safety_surcharge_percent: number;     // Forced vehicle route
  
  // Time thresholds
  night_start_hour: number;             // 20 (8PM)
  night_end_hour: number;               // 6 (6AM)
  peak_morning_start: number;           // 7
  peak_morning_end: number;             // 10
  peak_evening_start: number;           // 17
  peak_evening_end: number;             // 21
}

// ============================================================
// COMPLETE ROUTE
// ============================================================

export interface MultimodalRoute {
  id: string;
  
  // Origin & Destination
  origin: Location;
  destination: Location;
  
  // Route legs
  legs: RouteLeg[];
  
  // Totals
  total_distance_meters: number;
  total_duration_minutes: number;
  total_price: PriceEstimate;
  
  // Time context
  departure_time: Date;
  arrival_time_estimate: Date;
  is_night_route: boolean;
  is_peak_hours: boolean;
  
  // Safety
  safety_alerts: SafetyAlert[];
  has_danger_zones: boolean;
  route_adjusted_for_safety: boolean;
  
  // Flags
  has_first_mile_pivot: boolean;
  first_mile_pivot_reason?: string;
  
  // Alternative routes
  alternatives?: MultimodalRoute[];
  
  // Guide instructions (formatted for UI)
  guide_steps: GuideStep[];
  
  // Metadata
  created_at: Date;
  expires_at?: Date;            // Route may become stale
}

export interface GuideStep {
  step_number: number;
  leg_type: LegType;
  mode: TransitMode;
  icon: string;                 // Ionicons name
  
  // Main instruction
  title: string;
  description: string;
  
  // Price
  price_text: string;
  
  // Special nudge
  nudge?: string;
  
  // Location
  location: Location;
  
  // Timing
  duration_text: string;
  
  // Flags
  is_current?: boolean;
  is_completed?: boolean;
}

// ============================================================
// ROUTING REQUEST & RESPONSE
// ============================================================

export interface RoutingRequest {
  origin: Coordinates;
  destination: Coordinates;
  departure_time?: Date;        // Defaults to now
  
  // Preferences
  avoid_walking?: boolean;
  max_walk_distance_meters?: number;  // Default 1200m (1.2km)
  prefer_brt?: boolean;
  prefer_ferry?: boolean;
  
  // Safety preferences
  avoid_danger_zones?: boolean;
  force_vehicle_at_night?: boolean;
  
  // Price preferences
  prefer_cheapest?: boolean;
  prefer_fastest?: boolean;
}

export interface RoutingResponse {
  success: boolean;
  route?: MultimodalRoute;
  alternatives?: MultimodalRoute[];
  error?: string;
  
  // Metadata
  computed_at: Date;
  computation_time_ms: number;
}

// ============================================================
// GEOFENCING & ARRIVAL
// ============================================================

export interface GeofenceRegion {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  type: 'arrival' | 'departure' | 'waypoint' | 'danger_zone';
  triggered?: boolean;
}

export interface ArrivalNudge {
  type: 'approaching' | 'arrived' | 'passed';
  distance_meters: number;
  message: string;
  local_message?: string;       // "Owa!" notification
  landmark_name?: string;
  should_vibrate: boolean;
  should_notify: boolean;
}

// ============================================================
// CONTRIBUTION INTEGRATION (DANGER ZONES)
// ============================================================

export interface DangerZone {
  id: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  type: 'security' | 'traffic' | 'hazard';
  severity: 'low' | 'medium' | 'high';
  description: string;
  confirmed_count: number;
  expires_at?: string;
  avoid_route: boolean;         // Should routing avoid this area?
}
