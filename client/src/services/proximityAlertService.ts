import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Vibration, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Contribution } from '../hooks/useContributions';

// Storage keys
const NOTIFIED_ALERTS_KEY = '@waka_way_notified_alerts';
const LOCATION_WATCH_KEY = 'proximity_watch';

// Alert types that trigger proximity notifications
const SECURITY_ALERT_TYPES = ['security', 'danger_zone', 'hazard'];

// Configuration
const DEFAULT_PROXIMITY_RADIUS_KM = 2; // 2km default radius
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes between same alert notifications

interface ProximityCheckResult {
  isNearby: boolean;
  distance: number;
  contribution: Contribution;
}

interface NotifiedAlert {
  contributionId: string;
  notifiedAt: number;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate distance between two coordinates in km (Haversine formula)
 */
export const calculateDistance = (
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Format distance for display
 */
export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

// ============================================================
// NOTIFICATION SETUP
// ============================================================

/**
 * Configure notifications for proximity alerts
 */
export const configureProximityNotifications = async (): Promise<boolean> => {
  try {
    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Notification permissions not granted');
      return false;
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      }),
    });

    // Set up notification categories for actions
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationCategoryAsync('PROXIMITY_ALERT', [
        {
          identifier: 'VIEW_MAP',
          buttonTitle: 'View on Map',
          options: { opensAppToForeground: true },
        },
        {
          identifier: 'DISMISS',
          buttonTitle: 'Dismiss',
          options: { isDestructive: true },
        },
      ]);
    }

    console.log('✅ Proximity notifications configured');
    return true;
  } catch (error) {
    console.error('Error configuring notifications:', error);
    return false;
  }
};

// ============================================================
// NOTIFIED ALERTS TRACKING
// ============================================================

/**
 * Get list of recently notified alerts from storage
 */
const getNotifiedAlerts = async (): Promise<Map<string, number>> => {
  try {
    const stored = await AsyncStorage.getItem(NOTIFIED_ALERTS_KEY);
    if (!stored) return new Map();

    const parsed: NotifiedAlert[] = JSON.parse(stored);
    const now = Date.now();

    // Filter out expired notifications and convert to Map
    const valid = parsed.filter(a => now - a.notifiedAt < NOTIFICATION_COOLDOWN_MS);
    return new Map(valid.map(a => [a.contributionId, a.notifiedAt]));
  } catch (error) {
    console.error('Error reading notified alerts:', error);
    return new Map();
  }
};

/**
 * Mark an alert as notified
 */
const markAlertNotified = async (contributionId: string): Promise<void> => {
  try {
    const notified = await getNotifiedAlerts();
    notified.set(contributionId, Date.now());

    const toStore: NotifiedAlert[] = Array.from(notified.entries()).map(([id, time]) => ({
      contributionId: id,
      notifiedAt: time,
    }));

    await AsyncStorage.setItem(NOTIFIED_ALERTS_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error marking alert notified:', error);
  }
};

/**
 * Check if an alert was recently notified
 */
const wasRecentlyNotified = async (contributionId: string): Promise<boolean> => {
  const notified = await getNotifiedAlerts();
  return notified.has(contributionId);
};

// ============================================================
// PROXIMITY ALERT FUNCTIONS
// ============================================================

/**
 * Send a proximity alert notification
 */
export const sendProximityNotification = async (
  contribution: Contribution,
  distance: number
): Promise<void> => {
  // Check if recently notified
  if (await wasRecentlyNotified(contribution.id)) {
    console.log(`Skipping notification for ${contribution.id} - recently notified`);
    return;
  }

  const typeLabels: Record<string, { emoji: string; title: string }> = {
    security: { emoji: '🚨', title: 'Security Alert' },
    danger_zone: { emoji: '⚠️', title: 'Danger Zone' },
    hazard: { emoji: '⚠️', title: 'Hazard Alert' },
    traffic: { emoji: '🚗', title: 'Traffic Alert' },
    construction: { emoji: '🚧', title: 'Construction' },
  };

  const { emoji, title } = typeLabels[contribution.type] || { emoji: '📍', title: 'Alert' };
  const distanceText = formatDistance(distance);

  try {
    // Send vibration pattern
    Vibration.vibrate([0, 500, 200, 500, 200, 500]); // Alert pattern

    // Schedule notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${emoji} ${title}`,
        body: `${contribution.title || 'Incident reported nearby'}\n📍 ${distanceText} away - Check the map for details.`,
        data: {
          contributionId: contribution.id,
          type: 'proximity_alert',
          latitude: contribution.latitude,
          longitude: contribution.longitude,
        },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'PROXIMITY_ALERT',
      },
      trigger: null, // Immediate
    });

    // Mark as notified
    await markAlertNotified(contribution.id);

    console.log(`🔔 Proximity notification sent for: ${contribution.title} (${distanceText} away)`);
  } catch (error) {
    console.error('Error sending proximity notification:', error);
  }
};

/**
 * Check if any contributions are within proximity radius
 */
export const checkProximityAlerts = (
  contributions: Contribution[],
  userLocation: { latitude: number; longitude: number },
  radiusKm: number = DEFAULT_PROXIMITY_RADIUS_KM
): ProximityCheckResult[] => {
  const nearbyAlerts: ProximityCheckResult[] = [];

  for (const contribution of contributions) {
    // Only check security-related alerts
    if (!SECURITY_ALERT_TYPES.includes(contribution.type)) continue;

    const distance = calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      contribution.latitude,
      contribution.longitude
    );

    if (distance <= radiusKm) {
      nearbyAlerts.push({
        isNearby: true,
        distance,
        contribution,
      });
    }
  }

  // Sort by distance (closest first)
  return nearbyAlerts.sort((a, b) => a.distance - b.distance);
};

/**
 * Process new contribution and send proximity alert if needed
 */
export const processNewContribution = async (
  contribution: Contribution,
  userLocation: { latitude: number; longitude: number } | null,
  radiusKm: number = DEFAULT_PROXIMITY_RADIUS_KM
): Promise<boolean> => {
  if (!userLocation) return false;

  // Only check security-related alerts
  if (!SECURITY_ALERT_TYPES.includes(contribution.type)) return false;

  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    contribution.latitude,
    contribution.longitude
  );

  if (distance <= radiusKm) {
    await sendProximityNotification(contribution, distance);
    return true;
  }

  return false;
};

// ============================================================
// LOCATION WATCHING
// ============================================================

let locationSubscription: Location.LocationSubscription | null = null;
let currentContributions: Contribution[] = [];
let onAlertCallback: ((contribution: Contribution, distance: number) => void) | null = null;

/**
 * Start watching user location and checking for proximity alerts
 */
export const startProximityWatching = async (
  contributions: Contribution[],
  radiusKm: number = DEFAULT_PROXIMITY_RADIUS_KM,
  onAlert?: (contribution: Contribution, distance: number) => void
): Promise<boolean> => {
  try {
    // Request location permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.warn('Location permission not granted');
      return false;
    }

    // Store contributions and callback
    currentContributions = contributions;
    onAlertCallback = onAlert || null;

    // Start watching location
    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 100, // Update every 100 meters
        timeInterval: 30000, // Or every 30 seconds
      },
      async (location) => {
        const userLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        // Check for nearby alerts
        const nearbyAlerts = checkProximityAlerts(
          currentContributions,
          userLocation,
          radiusKm
        );

        // Send notifications for new nearby alerts
        for (const alert of nearbyAlerts) {
          const wasNotified = await wasRecentlyNotified(alert.contribution.id);
          if (!wasNotified) {
            await sendProximityNotification(alert.contribution, alert.distance);
            onAlertCallback?.(alert.contribution, alert.distance);
          }
        }
      }
    );

    console.log('✅ Proximity watching started');
    return true;
  } catch (error) {
    console.error('Error starting proximity watching:', error);
    return false;
  }
};

/**
 * Update the contributions list being watched
 */
export const updateWatchedContributions = (contributions: Contribution[]): void => {
  currentContributions = contributions;
};

/**
 * Stop watching for proximity alerts
 */
export const stopProximityWatching = (): void => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
    console.log('Proximity watching stopped');
  }
};

/**
 * Clear notification history (useful for testing)
 */
export const clearNotificationHistory = async (): Promise<void> => {
  await AsyncStorage.removeItem(NOTIFIED_ALERTS_KEY);
  console.log('Notification history cleared');
};

export default {
  configureProximityNotifications,
  sendProximityNotification,
  checkProximityAlerts,
  processNewContribution,
  startProximityWatching,
  updateWatchedContributions,
  stopProximityWatching,
  calculateDistance,
  formatDistance,
  clearNotificationHistory,
};
