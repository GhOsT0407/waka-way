/**
 * Location Detector
 * 
 * Multi-strategy location detection for Lagos:
 * 1. High-accuracy GPS (best, ≤20m accuracy)
 * 2. Wi-Fi/Cell triangulation (≤100m)
 * 3. Cell tower only (fallback)
 * 
 * Also provides network connectivity check.
 */

import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';

export type LocationAccuracy = 'GPS' | 'WIFI' | 'CELL' | 'OFFLINE';

export interface DetectedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: LocationAccuracy;
}

/**
 * Try each location method in order until one works.
 * Returns null if all methods fail or permission is denied.
 */
export async function detectUserLocation(): Promise<DetectedLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    console.error('Location permission denied');
    return null;
  }

  // 1. Try high-accuracy GPS first
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
      timeInterval: 5000,
    });
    if (location.coords.accuracy && location.coords.accuracy <= 20) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        source: 'GPS',
      };
    }
  } catch (_) {}

  // 2. Fall back to Wi-Fi/Cell triangulation
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 8000,
    });
    if (location.coords.accuracy && location.coords.accuracy <= 100) {
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        source: location.coords.accuracy <= 50 ? 'WIFI' : 'CELL',
      };
    }
  } catch (_) {}

  // 3. Last resort — low accuracy (cell towers only)
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
      timeInterval: 10000,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 999,
      source: 'CELL',
    };
  } catch (_) {}

  return null;
}

/**
 * Check if the device has an active internet connection.
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
}
