/**
 * WakaWay Geofencing Service
 * 
 * Location monitoring for:
 * - Arrival nudge notifications (300m from destination)
 * - "Owa!" alerts for bus passengers
 * - Danger zone proximity warnings
 * - Step-by-step navigation updates
 */

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Vibration, Platform } from 'react-native';
import {
  Coordinates,
  MultimodalRoute,
  RouteLeg,
  GeofenceRegion,
  ArrivalNudge,
} from '../types/routing';
import { calculateDistance } from './pricingService';
import { generateOwaReminder, generateArrivalNudge } from './guideGenerator';

// ============================================================
// CONFIGURATION
// ============================================================

const GEOFENCE_CONFIG = {
  // Distance thresholds (meters)
  ARRIVAL_ALERT_DISTANCE: 300,      // First alert
  PREPARE_STOP_DISTANCE: 200,       // "Prepare to stop"
  STOP_NOW_DISTANCE: 100,           // "Stop now!"
  ARRIVED_DISTANCE: 50,             // "You've arrived"
  
  // Danger zone warning
  DANGER_ZONE_ALERT_DISTANCE: 500,
  
  // Location update settings
  LOCATION_UPDATE_INTERVAL: 5000,   // 5 seconds
  LOCATION_DISTANCE_FILTER: 20,     // 20 meters minimum movement
  
  // Vibration patterns
  VIBRATION_APPROACHING: [0, 200, 100, 200],
  VIBRATION_STOP_NOW: [0, 500, 200, 500, 200, 500],
  VIBRATION_ARRIVED: [0, 1000],
};

// ============================================================
// NOTIFICATION CONFIGURATION
// ============================================================

/**
 * Configure notifications for geofencing
 */
export async function configureGeofenceNotifications(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Notification permission not granted');
      return false;
    }
    
    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    
    // Create notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('arrival-alerts', {
        name: 'Arrival Alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: GEOFENCE_CONFIG.VIBRATION_APPROACHING,
        sound: 'default',
      });
      
      await Notifications.setNotificationChannelAsync('owa-alerts', {
        name: 'Owa! Stop Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: GEOFENCE_CONFIG.VIBRATION_STOP_NOW,
        sound: 'default',
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error configuring notifications:', error);
    return false;
  }
}

// ============================================================
// LOCATION MONITORING
// ============================================================

let locationSubscription: Location.LocationSubscription | null = null;
let activeRoute: MultimodalRoute | null = null;
let currentLegIndex: number = 0;
let alertCooldowns: Map<string, number> = new Map();

/**
 * Start monitoring user location for a route
 */
export async function startRouteMonitoring(
  route: MultimodalRoute,
  onLocationUpdate?: (location: Coordinates, distanceToNext: number) => void,
  onArrivalNudge?: (nudge: ArrivalNudge) => void,
  onLegComplete?: (legIndex: number) => void
): Promise<boolean> {
  try {
    // Request location permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.error('Location permission not granted');
      return false;
    }
    
    // Stop any existing subscription
    await stopRouteMonitoring();
    
    // Store active route
    activeRoute = route;
    currentLegIndex = 0;
    alertCooldowns.clear();
    
    // Start location updates
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: GEOFENCE_CONFIG.LOCATION_UPDATE_INTERVAL,
        distanceInterval: GEOFENCE_CONFIG.LOCATION_DISTANCE_FILTER,
      },
      (location) => {
        handleLocationUpdate(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          onLocationUpdate,
          onArrivalNudge,
          onLegComplete
        );
      }
    );
    
    console.log('Route monitoring started');
    return true;
  } catch (error) {
    console.error('Error starting route monitoring:', error);
    return false;
  }
}

/**
 * Stop monitoring user location
 */
export async function stopRouteMonitoring(): Promise<void> {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  activeRoute = null;
  currentLegIndex = 0;
  alertCooldowns.clear();
  console.log('Route monitoring stopped');
}

/**
 * Handle location update
 */
function handleLocationUpdate(
  userLocation: Coordinates,
  onLocationUpdate?: (location: Coordinates, distanceToNext: number) => void,
  onArrivalNudge?: (nudge: ArrivalNudge) => void,
  onLegComplete?: (legIndex: number) => void
): void {
  if (!activeRoute || currentLegIndex >= activeRoute.legs.length) {
    return;
  }
  
  const currentLeg = activeRoute.legs[currentLegIndex];
  const distanceToLegEnd = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    currentLeg.end.latitude,
    currentLeg.end.longitude
  ) * 1000; // Convert to meters
  
  // Notify location update
  if (onLocationUpdate) {
    onLocationUpdate(userLocation, distanceToLegEnd);
  }
  
  // Check for arrival at current leg end
  if (distanceToLegEnd <= GEOFENCE_CONFIG.ARRIVED_DISTANCE) {
    // Leg complete
    if (onLegComplete) {
      onLegComplete(currentLegIndex);
    }
    currentLegIndex++;
    
    // Check if we've completed all legs
    if (currentLegIndex >= activeRoute.legs.length) {
      triggerArrivalNotification(activeRoute.destination.name || 'Destination');
      if (onArrivalNudge) {
        onArrivalNudge({
          type: 'arrived',
          distance_meters: 0,
          message: `🎯 You've arrived at ${activeRoute.destination.name || 'your destination'}!`,
          should_vibrate: true,
          should_notify: true,
        });
      }
      stopRouteMonitoring();
    }
    return;
  }
  
  // Check for approaching leg end (generate nudges)
  const nudge = checkForNudge(currentLeg, distanceToLegEnd);
  if (nudge && onArrivalNudge) {
    onArrivalNudge(nudge);
  }
  
  // Final destination check
  if (currentLegIndex === activeRoute.legs.length - 1) {
    const distanceToFinal = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      activeRoute.destination.latitude,
      activeRoute.destination.longitude
    ) * 1000;
    
    const finalNudge = checkFinalDestinationNudge(distanceToFinal);
    if (finalNudge && onArrivalNudge) {
      onArrivalNudge(finalNudge);
    }
  }
}

/**
 * Check if we should generate a nudge for approaching leg end
 */
function checkForNudge(leg: RouteLeg, distanceMeters: number): ArrivalNudge | null {
  const cooldownKey = `leg-${leg.id}-${Math.floor(distanceMeters / 50)}`;
  const now = Date.now();
  
  // Check cooldown (don't spam alerts)
  if (alertCooldowns.has(cooldownKey)) {
    const lastAlert = alertCooldowns.get(cooldownKey)!;
    if (now - lastAlert < 30000) { // 30 second cooldown
      return null;
    }
  }
  
  let nudge: ArrivalNudge | null = null;
  const destName = leg.end.name || 'your stop';
  
  // Generate appropriate nudge based on distance and mode
  if (distanceMeters <= GEOFENCE_CONFIG.STOP_NOW_DISTANCE) {
    // Immediate stop needed
    const message = leg.mode === 'danfo' || leg.mode === 'brt'
      ? `🚨 NOW! Shout "OWA!" - ${destName} is here!`
      : `🎯 ${destName} is right here!`;
    
    nudge = {
      type: 'arrived',
      distance_meters: distanceMeters,
      message,
      local_message: 'Owa! Owa!',
      landmark_name: destName,
      should_vibrate: true,
      should_notify: true,
    };
    
    Vibration.vibrate(GEOFENCE_CONFIG.VIBRATION_STOP_NOW);
    triggerOwaNotification(destName, leg.mode);
    
  } else if (distanceMeters <= GEOFENCE_CONFIG.PREPARE_STOP_DISTANCE) {
    // Prepare to stop
    const message = leg.mode === 'danfo' || leg.mode === 'brt'
      ? `⚠️ Get ready to shout "Owa!" - ${destName} is ${Math.round(distanceMeters)}m ahead!`
      : `📍 Prepare to stop - ${destName} is ${Math.round(distanceMeters)}m ahead`;
    
    nudge = {
      type: 'approaching',
      distance_meters: distanceMeters,
      message,
      landmark_name: destName,
      should_vibrate: true,
      should_notify: false,
    };
    
    Vibration.vibrate(GEOFENCE_CONFIG.VIBRATION_APPROACHING);
    
  } else if (distanceMeters <= GEOFENCE_CONFIG.ARRIVAL_ALERT_DISTANCE) {
    // First alert
    nudge = {
      type: 'approaching',
      distance_meters: distanceMeters,
      message: `📍 ${destName} coming up in ${Math.round(distanceMeters)}m. Watch for your stop!`,
      landmark_name: destName,
      should_vibrate: false,
      should_notify: false,
    };
  }
  
  if (nudge) {
    alertCooldowns.set(cooldownKey, now);
  }
  
  return nudge;
}

/**
 * Check for final destination nudge
 */
function checkFinalDestinationNudge(distanceMeters: number): ArrivalNudge | null {
  if (!activeRoute) return null;
  
  const cooldownKey = `final-${Math.floor(distanceMeters / 50)}`;
  const now = Date.now();
  
  if (alertCooldowns.has(cooldownKey)) {
    const lastAlert = alertCooldowns.get(cooldownKey)!;
    if (now - lastAlert < 30000) {
      return null;
    }
  }
  
  const destName = activeRoute.destination.name || 'your destination';
  let nudge: ArrivalNudge | null = null;
  
  if (distanceMeters <= GEOFENCE_CONFIG.ARRIVED_DISTANCE) {
    nudge = {
      type: 'arrived',
      distance_meters: distanceMeters,
      message: `🎯 You've arrived at ${destName}!`,
      landmark_name: destName,
      should_vibrate: true,
      should_notify: true,
    };
    Vibration.vibrate(GEOFENCE_CONFIG.VIBRATION_ARRIVED);
    
  } else if (distanceMeters <= GEOFENCE_CONFIG.ARRIVAL_ALERT_DISTANCE) {
    nudge = {
      type: 'approaching',
      distance_meters: distanceMeters,
      message: `🔔 Approaching ${destName} (${Math.round(distanceMeters)}m). Prepare to stop!`,
      landmark_name: destName,
      should_vibrate: true,
      should_notify: false,
    };
    Vibration.vibrate(GEOFENCE_CONFIG.VIBRATION_APPROACHING);
  }
  
  if (nudge) {
    alertCooldowns.set(cooldownKey, now);
  }
  
  return nudge;
}

// ============================================================
// NOTIFICATIONS
// ============================================================

/**
 * Trigger arrival notification
 */
async function triggerArrivalNotification(destinationName: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 You\'ve Arrived!',
        body: `Welcome to ${destinationName}`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.error('Error sending arrival notification:', error);
  }
}

/**
 * Trigger "Owa!" notification for bus passengers
 */
async function triggerOwaNotification(stopName: string, mode: string): Promise<void> {
  if (mode !== 'danfo' && mode !== 'brt') return;
  
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 OWA! STOP NOW!',
        body: `Shout "Owa!" - ${stopName} is here!`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Error sending Owa notification:', error);
  }
}

/**
 * Trigger danger zone proximity notification
 */
export async function triggerDangerZoneNotification(
  zoneName: string,
  distanceMeters: number
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Security Alert Ahead',
        body: `${zoneName} is ${Math.round(distanceMeters)}m ahead. Stay alert.`,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });
    
    Vibration.vibrate(GEOFENCE_CONFIG.VIBRATION_APPROACHING);
  } catch (error) {
    console.error('Error sending danger zone notification:', error);
  }
}

// ============================================================
// GEOFENCE REGION HELPERS
// ============================================================

/**
 * Create geofence regions for a route
 */
export function createRouteGeofences(route: MultimodalRoute): GeofenceRegion[] {
  const regions: GeofenceRegion[] = [];
  
  // Add waypoints for each leg end
  route.legs.forEach((leg, index) => {
    regions.push({
      id: `leg-${index}-end`,
      latitude: leg.end.latitude,
      longitude: leg.end.longitude,
      radius_meters: GEOFENCE_CONFIG.ARRIVAL_ALERT_DISTANCE,
      type: index === route.legs.length - 1 ? 'arrival' : 'waypoint',
    });
  });
  
  // Add danger zone regions
  route.safety_alerts.forEach((alert, index) => {
    // Note: We'd need coordinates from the contribution for this
    // For now, this is a placeholder
  });
  
  return regions;
}

/**
 * Check if user is within any geofence region
 */
export function checkGeofences(
  userLocation: Coordinates,
  regions: GeofenceRegion[]
): GeofenceRegion[] {
  return regions.filter(region => {
    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      region.latitude,
      region.longitude
    ) * 1000; // meters
    
    return distance <= region.radius_meters && !region.triggered;
  });
}

// ============================================================
// UTILITY EXPORTS
// ============================================================

export {
  GEOFENCE_CONFIG,
  calculateDistance,
};
