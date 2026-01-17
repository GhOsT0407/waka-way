import * as Location from 'expo-location';

export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface LocationData {
  coords: LocationCoords;
  address?: string;
}

/**
 * Request location permissions
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting location permission:', error);
    return false;
  }
}

/**
 * Get current location
 */
export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) {
      console.warn('Location permission not granted');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // Get address from coordinates (reverse geocoding)
    let address: string | undefined;
    try {
      const [reverseGeocode] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      
      if (reverseGeocode) {
        const parts = [];
        if (reverseGeocode.street) parts.push(reverseGeocode.street);
        if (reverseGeocode.name) parts.push(reverseGeocode.name);
        if (reverseGeocode.city) parts.push(reverseGeocode.city);
        address = parts.join(', ');
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }

    return {
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      address,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

/**
 * Watch location updates
 */
export async function watchLocation(
  callback: (location: LocationData) => void
): Promise<Location.LocationSubscription | null> {
  try {
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (location) => {
        callback({
          coords: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
        });
      }
    );
  } catch (error) {
    console.error('Error watching location:', error);
    return null;
  }
}

/**
 * Geocode address to coordinates
 */
export async function geocodeAddress(address: string): Promise<LocationCoords | null> {
  try {
    const results = await Location.geocodeAsync(address);
    if (results && results.length > 0) {
      return {
        latitude: results[0].latitude,
        longitude: results[0].longitude,
      };
    }
    return null;
  } catch (error) {
    console.error('Error geocoding address:', error);
    return null;
  }
}

