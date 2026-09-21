/**
 * WakaWay Routing Hook
 * 
 * React hook for multimodal routing with:
 * - Route calculation
 * - Real-time location monitoring
 * - Arrival nudges
 * - Danger zone integration
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Location from 'expo-location';
import {
  Coordinates,
  MultimodalRoute,
  RoutingRequest,
  RoutingResponse,
  ArrivalNudge,
  GuideStep,
} from '../types/routing';
import { calculateRoute } from '../services/routingEngine';
import {
  startRouteMonitoring,
  stopRouteMonitoring,
  configureGeofenceNotifications,
} from '../services/geofencingService';
import { generateFormattedGuide, FormattedGuide } from '../services/guideGenerator';

// ============================================================
// HOOK TYPES
// ============================================================

export interface UseRoutingOptions {
  /** Auto-start monitoring when route is calculated */
  autoStartMonitoring?: boolean;
  /** Avoid danger zones from contributions */
  avoidDangerZones?: boolean;
  /** Force vehicle at night for safety */
  forceVehicleAtNight?: boolean;
  /** Maximum walk distance before suggesting vehicle (meters) */
  maxWalkDistance?: number;
}

export interface UseRoutingReturn {
  // State
  route: MultimodalRoute | null;
  formattedGuide: FormattedGuide | null;
  loading: boolean;
  error: string | null;
  
  // Location
  userLocation: Coordinates | null;
  currentLegIndex: number;
  distanceToNextStop: number;
  
  // Nudges
  latestNudge: ArrivalNudge | null;
  
  // Navigation state
  isNavigating: boolean;
  progress: number; // 0-100
  
  // Actions
  calculateNewRoute: (destination: Coordinates, origin?: Coordinates) => Promise<void>;
  startNavigation: () => Promise<void>;
  stopNavigation: () => void;
  recalculateRoute: () => Promise<void>;
  clearRoute: () => void;
}

// ============================================================
// MAIN HOOK
// ============================================================

export function useRouting(options: UseRoutingOptions = {}): UseRoutingReturn {
  const {
    autoStartMonitoring = false,
    avoidDangerZones = true,
    forceVehicleAtNight = true,
    maxWalkDistance = 1200,
  } = options;
  
  // Route state
  const [route, setRoute] = useState<MultimodalRoute | null>(null);
  const [formattedGuide, setFormattedGuide] = useState<FormattedGuide | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Location state
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [distanceToNextStop, setDistanceToNextStop] = useState(0);
  
  // Nudge state
  const [latestNudge, setLatestNudge] = useState<ArrivalNudge | null>(null);
  
  // Navigation state
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Refs
  const lastDestination = useRef<Coordinates | null>(null);
  const lastOrigin = useRef<Coordinates | null>(null);
  
  // ============================================================
  // INITIALIZATION
  // ============================================================
  
  useEffect(() => {
    // Configure notifications on mount
    configureGeofenceNotifications();
    
    // Get initial location
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setUserLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      } catch (e) {
        console.error('Error getting initial location:', e);
      }
    })();
    
    // Cleanup on unmount
    return () => {
      stopRouteMonitoring();
    };
  }, []);
  
  // ============================================================
  // ROUTE CALCULATION
  // ============================================================
  
  const calculateNewRoute = useCallback(async (
    destination: Coordinates,
    origin?: Coordinates
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    
    try {
      // Get origin (user location if not provided)
      let startLocation = origin;
      if (!startLocation) {
        if (userLocation) {
          startLocation = userLocation;
        } else {
          const location = await Location.getCurrentPositionAsync({});
          startLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          setUserLocation(startLocation);
        }
      }
      
      // Store for recalculation
      lastDestination.current = destination;
      lastOrigin.current = startLocation;
      
      // Build request
      const request: RoutingRequest = {
        origin: startLocation,
        destination,
        departure_time: new Date(),
        avoid_danger_zones: avoidDangerZones,
        force_vehicle_at_night: forceVehicleAtNight,
        max_walk_distance_meters: maxWalkDistance,
      };
      
      // Calculate route
      const response = await calculateRoute(request);
      
      if (response.success && response.route) {
        setRoute(response.route);
        setFormattedGuide(generateFormattedGuide(response.route));
        setCurrentLegIndex(0);
        setProgress(0);
        
        // Auto-start monitoring if enabled
        if (autoStartMonitoring) {
          await startNavigationInternal(response.route);
        }
      } else {
        setError(response.error || 'Failed to calculate route');
      }
    } catch (e) {
      console.error('Error calculating route:', e);
      setError(e instanceof Error ? e.message : 'Failed to calculate route');
    } finally {
      setLoading(false);
    }
  }, [userLocation, avoidDangerZones, forceVehicleAtNight, maxWalkDistance, autoStartMonitoring]);
  
  // ============================================================
  // NAVIGATION CONTROL
  // ============================================================
  
  const startNavigationInternal = async (routeToNavigate: MultimodalRoute): Promise<void> => {
    const success = await startRouteMonitoring(
      routeToNavigate,
      // Location update handler
      (location, distance) => {
        setUserLocation(location);
        setDistanceToNextStop(distance);
        
        // Calculate progress
        if (routeToNavigate.total_distance_meters > 0) {
          const completedDistance = routeToNavigate.legs
            .slice(0, currentLegIndex)
            .reduce((sum, leg) => sum + leg.distance_meters, 0);
          const currentLeg = routeToNavigate.legs[currentLegIndex];
          const currentLegProgress = currentLeg 
            ? currentLeg.distance_meters - distance
            : 0;
          const totalProgress = completedDistance + Math.max(0, currentLegProgress);
          setProgress(Math.min(100, (totalProgress / routeToNavigate.total_distance_meters) * 100));
        }
      },
      // Arrival nudge handler
      (nudge) => {
        setLatestNudge(nudge);
      },
      // Leg complete handler
      (legIndex) => {
        setCurrentLegIndex(legIndex + 1);
      }
    );
    
    if (success) {
      setIsNavigating(true);
    }
  };
  
  const startNavigation = useCallback(async (): Promise<void> => {
    if (!route) {
      setError('No route to navigate');
      return;
    }
    
    await startNavigationInternal(route);
  }, [route]);
  
  const stopNavigation = useCallback((): void => {
    stopRouteMonitoring();
    setIsNavigating(false);
    setLatestNudge(null);
  }, []);
  
  const recalculateRoute = useCallback(async (): Promise<void> => {
    if (lastDestination.current) {
      await calculateNewRoute(lastDestination.current);
    }
  }, [calculateNewRoute]);
  
  const clearRoute = useCallback((): void => {
    stopNavigation();
    setRoute(null);
    setFormattedGuide(null);
    setCurrentLegIndex(0);
    setDistanceToNextStop(0);
    setProgress(0);
    setError(null);
    lastDestination.current = null;
    lastOrigin.current = null;
  }, [stopNavigation]);
  
  // ============================================================
  // RETURN
  // ============================================================
  
  return {
    route,
    formattedGuide,
    loading,
    error,
    userLocation,
    currentLegIndex,
    distanceToNextStop,
    latestNudge,
    isNavigating,
    progress,
    calculateNewRoute,
    startNavigation,
    stopNavigation,
    recalculateRoute,
    clearRoute,
  };
}

// ============================================================
// SIMPLIFIED HOOK FOR QUICK ROUTES
// ============================================================

export interface UseQuickRouteOptions {
  origin?: Coordinates;
  destination: Coordinates;
  autoCalculate?: boolean;
}

export function useQuickRoute(options: UseQuickRouteOptions) {
  const { origin, destination, autoCalculate = true } = options;
  const routing = useRouting();
  
  useEffect(() => {
    if (autoCalculate && destination) {
      routing.calculateNewRoute(destination, origin);
    }
  }, [destination?.latitude, destination?.longitude, origin?.latitude, origin?.longitude, autoCalculate]);
  
  return routing;
}

export default useRouting;
