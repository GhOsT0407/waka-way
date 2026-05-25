/**
 * WakaWay Multimodal Routing Engine
 * 
 * Calculates routes with:
 * - First-Mile Pivot (walk > 1.2km → suggest keke/okada)
 * - Danger Zone avoidance
 * - Dynamic pricing integration
 * - Lagos-specific transit modes
 */

import { supabase } from '../lib/supabase';
import {
  Coordinates,
  Location,
  TransitMode,
  LegType,
  Landmark,
  RouteLeg,
  SafetyAlert,
  MultimodalRoute,
  GuideStep,
  RoutingRequest,
  RoutingResponse,
  DangerZone,
} from '../types/routing';
import {
  calculatePrice,
  calculateTotalPrice,
  calculateDistance,
  isNightTime,
  isPeakHours,
  formatPrice,
} from './pricingService';

// ============================================================
// CONFIGURATION
// ============================================================

const ROUTING_CONFIG = {
  // First-mile thresholds
  MAX_WALK_DISTANCE_KM: 1.2,              // Pivot to vehicle if walk > 1.2km
  COMFORTABLE_WALK_DISTANCE_KM: 0.5,      // Ideal walking distance
  
  // Danger zone settings
  DANGER_ZONE_BUFFER_KM: 0.3,             // 300m buffer around danger zones
  
  // Speed estimates (km/h)
  WALK_SPEED: 5,
  KEKE_SPEED: 25,
  OKADA_SPEED: 35,
  DANFO_SPEED: 20,                        // Includes stops
  BRT_SPEED: 30,
  
  // Arrival threshold
  ARRIVAL_NUDGE_DISTANCE_M: 300,
};

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Calculate travel duration in minutes
 */
function calculateDuration(distanceKm: number, mode: TransitMode): number {
  const speeds: Record<TransitMode, number> = {
    walk: ROUTING_CONFIG.WALK_SPEED,
    keke: ROUTING_CONFIG.KEKE_SPEED,
    okada: ROUTING_CONFIG.OKADA_SPEED,
    danfo: ROUTING_CONFIG.DANFO_SPEED,
    brt: ROUTING_CONFIG.BRT_SPEED,
    rail: ROUTING_CONFIG.BRT_SPEED * 1.5,
    uber: ROUTING_CONFIG.KEKE_SPEED * 1.2,
    bolt: ROUTING_CONFIG.KEKE_SPEED * 1.2,
  };
  
  const speed = speeds[mode] || ROUTING_CONFIG.WALK_SPEED;
  return Math.round((distanceKm / speed) * 60);
}

/**
 * Format duration for display
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

/**
 * Get icon for transit mode
 */
function getModeIcon(mode: TransitMode): string {
  const icons: Record<TransitMode, string> = {
    walk: 'walk-outline',
    keke: 'car-outline',
    okada: 'bicycle-outline',
    danfo: 'bus-outline',
    brt: 'bus',
    rail: 'train-outline',
    uber: 'car-sport-outline',
    bolt: 'car-sport-outline',
  };
  return icons[mode] || 'help-circle-outline';
}

// ============================================================
// LANDMARK QUERIES
// ============================================================

/**
 * Find nearest landmarks of specific types
 */
async function findNearestLandmarks(
  lat: number,
  lng: number,
  types: string[],
  maxDistanceKm: number = 3,
  limit: number = 5
): Promise<Landmark[]> {
  try {
    const { data, error } = await supabase.rpc('find_nearest_landmarks', {
      user_lat: lat,
      user_lng: lng,
      landmark_types: types,
      max_distance_km: maxDistanceKm,
      result_limit: limit,
    });
    
    if (error) {
      console.error('Error finding landmarks:', error);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      local_name: d.local_name,
      type: d.type,
      latitude: d.latitude,
      longitude: d.longitude,
      address: d.address,
    }));
  } catch (e) {
    console.error('Error in findNearestLandmarks:', e);
    return [];
  }
}

/**
 * Find nearest keke/okada stand
 */
async function findNearestConnector(
  lat: number,
  lng: number
): Promise<Landmark | null> {
  const landmarks = await findNearestLandmarks(
    lat,
    lng,
    ['keke_stand', 'okada_junction'],
    2,
    1
  );
  return landmarks.length > 0 ? landmarks[0] : null;
}

/**
 * Find nearest bus stop
 */
async function findNearestBusStop(
  lat: number,
  lng: number
): Promise<Landmark | null> {
  const landmarks = await findNearestLandmarks(
    lat,
    lng,
    ['bus_stop', 'brt_station'],
    3,
    1
  );
  return landmarks.length > 0 ? landmarks[0] : null;
}

// ============================================================
// DANGER ZONE QUERIES
// ============================================================

/**
 * Get active danger zones from contributions
 */
async function getActiveDangerZones(): Promise<DangerZone[]> {
  try {
    const { data, error } = await supabase
      .from('contributions')
      .select('*')
      .in('type', ['security', 'danger_zone', 'hazard'])
      .in('status', ['approved', 'verified', 'pending'])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    
    if (error) {
      console.error('Error fetching danger zones:', error);
      return [];
    }
    
    return (data || []).map((d: any) => ({
      id: d.id,
      latitude: d.latitude,
      longitude: d.longitude,
      radius_meters: d.type === 'security' ? 500 : 300,
      type: d.type,
      severity: d.confirm_count >= 5 ? 'high' : d.confirm_count >= 3 ? 'medium' : 'low',
      description: d.title,
      confirmed_count: d.confirm_count || 0,
      expires_at: d.expires_at,
      avoid_route: d.type === 'security' && d.confirm_count >= 3,
    }));
  } catch (e) {
    console.error('Error in getActiveDangerZones:', e);
    return [];
  }
}

/**
 * Check if a point is within any danger zone
 */
function isInDangerZone(
  lat: number,
  lng: number,
  dangerZones: DangerZone[]
): DangerZone | null {
  for (const zone of dangerZones) {
    const distance = calculateDistance(lat, lng, zone.latitude, zone.longitude);
    const bufferKm = (zone.radius_meters / 1000) + ROUTING_CONFIG.DANGER_ZONE_BUFFER_KM;
    
    if (distance <= bufferKm) {
      return zone;
    }
  }
  return null;
}

/**
 * Check if route passes through danger zones
 */
function checkRouteDangerZones(
  start: Coordinates,
  end: Coordinates,
  dangerZones: DangerZone[]
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  
  // Check start point
  const startZone = isInDangerZone(start.latitude, start.longitude, dangerZones);
  if (startZone) {
    alerts.push({
      type: startZone.type as any,
      severity: startZone.severity as any,
      message: `⚠️ Your starting area has a ${startZone.type} alert: ${startZone.description}`,
      contribution_id: startZone.id,
      expires_at: startZone.expires_at,
    });
  }
  
  // Check end point
  const endZone = isInDangerZone(end.latitude, end.longitude, dangerZones);
  if (endZone) {
    alerts.push({
      type: endZone.type as any,
      severity: endZone.severity as any,
      message: `⚠️ Your destination area has a ${endZone.type} alert: ${endZone.description}`,
      contribution_id: endZone.id,
      expires_at: endZone.expires_at,
    });
  }
  
  // Check midpoint (simple check)
  const midLat = (start.latitude + end.latitude) / 2;
  const midLng = (start.longitude + end.longitude) / 2;
  const midZone = isInDangerZone(midLat, midLng, dangerZones);
  if (midZone && midZone.id !== startZone?.id && midZone.id !== endZone?.id) {
    alerts.push({
      type: midZone.type as any,
      severity: midZone.severity as any,
      message: `⚠️ Your route passes through a ${midZone.type} area: ${midZone.description}`,
      contribution_id: midZone.id,
      expires_at: midZone.expires_at,
    });
  }
  
  return alerts;
}

// ============================================================
// ROUTE LEG BUILDERS
// ============================================================

/**
 * Build a walking leg
 */
function buildWalkLeg(
  start: Location,
  end: Location,
  legType: LegType,
  departureTime: Date,
  isLongWalk: boolean = false
): RouteLeg {
  const distanceKm = calculateDistance(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude
  );
  const distanceMeters = distanceKm * 1000;
  const duration = calculateDuration(distanceKm, 'walk');
  
  return {
    id: generateId(),
    type: legType,
    mode: 'walk',
    start,
    end,
    distance_meters: distanceMeters,
    duration_minutes: duration,
    price_estimate: calculatePrice({ distanceKm, mode: 'walk', departureTime }),
    instruction: `Walk to ${end.name || 'destination'}`,
    local_instruction: `Waka go ${end.name || 'there'}`,
    is_long_walk: isLongWalk,
  };
}

/**
 * Build a keke/okada connector leg
 */
function buildConnectorLeg(
  start: Location,
  end: Location,
  mode: 'keke' | 'okada',
  legType: LegType,
  departureTime: Date,
  forcedVehicle: boolean = false,
  pivotReason?: string
): RouteLeg {
  const distanceKm = calculateDistance(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude
  );
  const distanceMeters = distanceKm * 1000;
  const duration = calculateDuration(distanceKm, mode);
  const price = calculatePrice({
    distanceKm,
    mode,
    departureTime,
    forcedVehicle,
  });
  
  const modeLabel = mode === 'keke' ? 'Keke' : 'Okada';
  
  return {
    id: generateId(),
    type: legType,
    mode,
    start,
    end,
    distance_meters: distanceMeters,
    duration_minutes: duration,
    price_estimate: price,
    instruction: `Take a ${modeLabel} from ${start.name || 'here'} to ${end.name || 'destination'}`,
    local_instruction: `Enter ${modeLabel} for ${end.name || 'there'}`,
    has_pivot: !!pivotReason,
    pivot_reason: pivotReason,
  };
}

/**
 * Build a bus leg (Danfo or BRT)
 */
function buildBusLeg(
  start: Location,
  end: Location,
  mode: 'danfo' | 'brt',
  departureTime: Date
): RouteLeg {
  const distanceKm = calculateDistance(
    start.latitude,
    start.longitude,
    end.latitude,
    end.longitude
  );
  const distanceMeters = distanceKm * 1000;
  const duration = calculateDuration(distanceKm, mode);
  const price = calculatePrice({ distanceKm, mode, departureTime });
  
  const modeLabel = mode === 'brt' ? 'BRT' : 'bus';
  
  return {
    id: generateId(),
    type: 'main_transit',
    mode,
    start,
    end,
    distance_meters: distanceMeters,
    duration_minutes: duration,
    price_estimate: price,
    instruction: `Board a ${modeLabel} heading to ${end.name || 'destination'}`,
    local_instruction: `Enter ${modeLabel} wey dey go ${end.name || 'there'}`,
    nudge: `Tell the conductor you're going to ${end.name}. When you're close, shout "Owa!"`,
  };
}

// ============================================================
// MAIN ROUTING FUNCTION
// ============================================================

/**
 * Calculate multimodal route
 */
export async function calculateRoute(
  request: RoutingRequest
): Promise<RoutingResponse> {
  const startTime = Date.now();
  const departureTime = request.departure_time || new Date();
  const isNight = isNightTime(departureTime);
  const isPeak = isPeakHours(departureTime);
  
  try {
    // 1. Get danger zones
    const dangerZones = request.avoid_danger_zones !== false
      ? await getActiveDangerZones()
      : [];
    
    // 2. Check for safety alerts along route
    const safetyAlerts = checkRouteDangerZones(
      request.origin,
      request.destination,
      dangerZones
    );
    
    const hasDangerZones = safetyAlerts.length > 0;
    const hasSecurityAlert = safetyAlerts.some(a => a.type === 'security' && a.severity !== 'low');
    
    // 3. Calculate total distance
    const totalDistanceKm = calculateDistance(
      request.origin.latitude,
      request.origin.longitude,
      request.destination.latitude,
      request.destination.longitude
    );
    
    // 4. Find landmarks
    const [nearestBusStop, nearestConnector, destinationLandmark] = await Promise.all([
      findNearestBusStop(request.origin.latitude, request.origin.longitude),
      findNearestConnector(request.origin.latitude, request.origin.longitude),
      findNearestLandmarks(
        request.destination.latitude,
        request.destination.longitude,
        ['bus_stop', 'junction', 'market', 'mall'],
        1,
        1
      ).then(arr => arr[0] || null),
    ]);
    
    // 5. Build route legs
    const legs: RouteLeg[] = [];
    let hasFirstMilePivot = false;
    let firstMilePivotReason: string | undefined;
    
    // Origin location
    const originLocation: Location = {
      latitude: request.origin.latitude,
      longitude: request.origin.longitude,
      name: 'Your Location',
    };
    
    // Destination location
    const destinationLocation: Location = {
      latitude: request.destination.latitude,
      longitude: request.destination.longitude,
      name: destinationLandmark?.name || 'Destination',
    };
    
    // === FIRST MILE ===
    if (nearestBusStop) {
      const distanceToBusStop = calculateDistance(
        request.origin.latitude,
        request.origin.longitude,
        nearestBusStop.latitude,
        nearestBusStop.longitude
      );
      
      const busStopLocation: Location = {
        latitude: nearestBusStop.latitude,
        longitude: nearestBusStop.longitude,
        name: nearestBusStop.name,
      };
      
      const maxWalk = request.max_walk_distance_meters
        ? request.max_walk_distance_meters / 1000
        : ROUTING_CONFIG.MAX_WALK_DISTANCE_KM;
      
      // Check if we need to pivot from walking
      const needsPivot = 
        distanceToBusStop > maxWalk ||
        request.avoid_walking ||
        (isNight && request.force_vehicle_at_night !== false) ||
        hasSecurityAlert;
      
      if (needsPivot && nearestConnector) {
        // PIVOT: Use keke/okada instead of walking
        hasFirstMilePivot = true;
        
        if (distanceToBusStop > maxWalk) {
          firstMilePivotReason = `This walk is long (${(distanceToBusStop * 1000).toFixed(0)}m). Take a Keke instead.`;
        } else if (isNight) {
          firstMilePivotReason = `It's late. For safety, take a Keke instead of walking.`;
        } else if (hasSecurityAlert) {
          firstMilePivotReason = `⚠️ Security alert in this area. Take a vehicle for safety.`;
        }
        
        const connectorLocation: Location = {
          latitude: nearestConnector.latitude,
          longitude: nearestConnector.longitude,
          name: nearestConnector.name,
        };
        
        // Walk to keke stand (if needed)
        const distanceToConnector = calculateDistance(
          request.origin.latitude,
          request.origin.longitude,
          nearestConnector.latitude,
          nearestConnector.longitude
        );
        
        if (distanceToConnector > 0.1) {
          legs.push(buildWalkLeg(
            originLocation,
            connectorLocation,
            'first_mile',
            departureTime
          ));
        }
        
        // Keke to bus stop
        const connectorMode = nearestConnector.type === 'okada_junction' ? 'okada' : 'keke';
        legs.push(buildConnectorLeg(
          connectorLocation,
          busStopLocation,
          connectorMode,
          'connector',
          departureTime,
          hasSecurityAlert,
          firstMilePivotReason
        ));
      } else {
        // Walk to bus stop
        legs.push(buildWalkLeg(
          originLocation,
          busStopLocation,
          'first_mile',
          departureTime,
          distanceToBusStop > maxWalk
        ));
      }
      
      // === MAIN TRANSIT ===
      // Find intermediate stop near destination
      const nearestToDestBusStop = await findNearestBusStop(
        request.destination.latitude,
        request.destination.longitude
      );
      
      if (nearestToDestBusStop) {
        const intermediateLocation: Location = {
          latitude: nearestToDestBusStop.latitude,
          longitude: nearestToDestBusStop.longitude,
          name: nearestToDestBusStop.name,
        };
        
        // Bus from first stop to intermediate
        const busMode = nearestBusStop.type === 'brt_station' ? 'brt' : 'danfo';
        legs.push(buildBusLeg(
          busStopLocation,
          intermediateLocation,
          busMode,
          departureTime
        ));
        
        // === LAST MILE ===
        const distanceToFinalDest = calculateDistance(
          nearestToDestBusStop.latitude,
          nearestToDestBusStop.longitude,
          request.destination.latitude,
          request.destination.longitude
        );
        
        if (distanceToFinalDest > 0.5 || isNight || hasSecurityAlert) {
          // Take keke for last mile
          legs.push(buildConnectorLeg(
            intermediateLocation,
            destinationLocation,
            'keke',
            'last_mile',
            departureTime,
            hasSecurityAlert
          ));
        } else {
          // Walk to final destination
          legs.push(buildWalkLeg(
            intermediateLocation,
            destinationLocation,
            'last_mile',
            departureTime
          ));
        }
      } else {
        // Direct to destination
        legs.push(buildBusLeg(
          busStopLocation,
          destinationLocation,
          'danfo',
          departureTime
        ));
      }
    } else {
      // No bus stop found, use direct keke/okada
      legs.push(buildConnectorLeg(
        originLocation,
        destinationLocation,
        'keke',
        'first_mile',
        departureTime,
        hasSecurityAlert
      ));
    }
    
    // 6. Calculate totals
    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance_meters, 0);
    const totalDuration = legs.reduce((sum, leg) => sum + leg.duration_minutes, 0);
    const totalPrice = calculateTotalPrice(legs.map(l => l.price_estimate));
    
    // 7. Generate guide steps
    const guideSteps = generateGuideSteps(legs);
    
    // 8. Build final route
    const route: MultimodalRoute = {
      id: generateId(),
      origin: originLocation,
      destination: destinationLocation,
      legs,
      total_distance_meters: totalDistance,
      total_duration_minutes: totalDuration,
      total_price: totalPrice,
      departure_time: departureTime,
      arrival_time_estimate: new Date(departureTime.getTime() + totalDuration * 60 * 1000),
      is_night_route: isNight,
      is_peak_hours: isPeak,
      safety_alerts: safetyAlerts,
      has_danger_zones: hasDangerZones,
      route_adjusted_for_safety: hasSecurityAlert,
      has_first_mile_pivot: hasFirstMilePivot,
      first_mile_pivot_reason: firstMilePivotReason,
      guide_steps: guideSteps,
      created_at: new Date(),
    };
    
    return {
      success: true,
      route,
      computed_at: new Date(),
      computation_time_ms: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error('Error calculating route:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate route',
      computed_at: new Date(),
      computation_time_ms: Date.now() - startTime,
    };
  }
}

// ============================================================
// GUIDE STEP GENERATOR
// ============================================================

/**
 * Generate Lagos-style guide steps from route legs
 */
function generateGuideSteps(legs: RouteLeg[]): GuideStep[] {
  return legs.map((leg, index) => {
    let title: string;
    let description: string;
    
    switch (leg.type) {
      case 'first_mile':
        if (leg.mode === 'walk') {
          title = `Walk to ${leg.end.name}`;
          description = leg.has_pivot
            ? `⚠️ ${leg.pivot_reason}`
            : `Head to ${leg.end.name} (${Math.round(leg.distance_meters)}m)`;
        } else {
          title = `Take a ${leg.mode === 'keke' ? 'Keke' : 'Okada'} to ${leg.end.name}`;
          description = leg.pivot_reason || `Get a ${leg.mode} to ${leg.end.name}`;
        }
        break;
      
      case 'connector':
        title = `Enter ${leg.mode === 'keke' ? 'Keke' : 'Okada'}`;
        description = `Take a ${leg.mode} from ${leg.start.name} to ${leg.end.name}`;
        break;
      
      case 'main_transit':
        title = `Board ${leg.mode === 'brt' ? 'BRT' : 'bus'} to ${leg.end.name}`;
        description = `Get on a ${leg.mode === 'brt' ? 'BRT' : 'Danfo'} heading to ${leg.end.name}`;
        break;
      
      case 'last_mile':
        if (leg.mode === 'walk') {
          title = `Walk to destination`;
          description = `Walk from ${leg.start.name} to your final destination`;
        } else {
          title = `Last Keke to destination`;
          description = `Enter a Keke going toward ${leg.end.name}`;
        }
        break;
      
      default:
        title = `Continue to ${leg.end.name}`;
        description = leg.instruction;
    }
    
    return {
      step_number: index + 1,
      leg_type: leg.type,
      mode: leg.mode,
      icon: getModeIcon(leg.mode),
      title,
      description,
      price_text: formatPrice(leg.price_estimate),
      nudge: leg.nudge,
      location: leg.end,
      duration_text: formatDuration(leg.duration_minutes),
    };
  });
}

// ============================================================
// EXPORT HELPER FUNCTIONS
// ============================================================

export {
  findNearestLandmarks,
  findNearestConnector,
  findNearestBusStop,
  getActiveDangerZones,
  calculateDistance,
  formatDuration,
  getModeIcon,
};
