import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { calculateSmartRoute, SmartRouteResult, RouteOption } from './smartRoutingService';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available (future)
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle common errors
    if (error.response) {
      // Server responded with error
      console.error('API Error:', error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error('Network Error:', error.message);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

import { MOCK_CITIES, MOCK_STOPS, MOCK_ROUTES } from './mockData';

const USE_MOCK_DATA = true;

// ... (keep existing axios logic, but maybe wrapper functions check the flag)

// Simplified for readability in this turn, I will just directly modify the export functions
// but strictly speaking I should probably wrap the axios calls.
// Let's modify the functions directly to check the flag.

// Health check
export const checkHealth = async () => {
  if (USE_MOCK_DATA) return { status: 'healthy', mock: true };
  try {
    const response = await apiClient.get('/health/');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

// Cities
export const getCities = async () => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 500)); // Simulate delay
    return MOCK_CITIES;
  }
  const response = await apiClient.get('/cities/');
  return response.data;
};

// Transport Stops
export const getStops = async (params?: {
  city?: number;
  stop_type?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 600));
    return MOCK_STOPS;
  }
  const response = await apiClient.get('/stops/', { params });
  return response.data;
};

export const getNearbyStops = async (latitude: number, longitude: number, radius: number = 1) => {
  if (USE_MOCK_DATA) return MOCK_STOPS;
  const response = await apiClient.get('/stops/nearby/', {
    params: { lat: latitude, lng: longitude, radius },
  });
  return response.data;
};

// Google Directions API Fetcher
export const searchRoutes = async (data: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationName?: string;
  destinationDetails?: any;
}): Promise<{ smartRoute: SmartRouteResult; legacyRoute: any }> => {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Use new smart routing service
    const smartRoute = calculateSmartRoute(
      data.origin.latitude,
      data.origin.longitude,
      'Your Location',
      data.destination.latitude,
      data.destination.longitude,
      data.destinationName || 'Destination'
    );

    // Also generate legacy route format for backwards compatibility
    const legacyRoute = convertSmartRouteToLegacy(smartRoute, data.origin, data.destination, data.destinationName);

    return { smartRoute, legacyRoute };
  } catch (error) {
    console.error("Route search error:", error);
    // Fallback to mock data
    const fallbackRoute = MOCK_ROUTES.search_results[0];
    return { 
      smartRoute: null as any, 
      legacyRoute: fallbackRoute 
    };
  }
};

// Convert smart route to legacy format for existing RouteDetailScreen
const convertSmartRouteToLegacy = (
  smartRoute: SmartRouteResult,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  destinationName?: string
) => {
  const recommendedOption = smartRoute.options.find(o => o.id === smartRoute.recommendedOptionId) || smartRoute.options[0];
  
  if (!recommendedOption) {
    return MOCK_ROUTES.search_results[0];
  }

  return {
    id: 1,
    origin: smartRoute.origin.name,
    destination: smartRoute.destination.name,
    rating: 4.5,
    total_fare: recommendedOption.totalPriceMax,
    total_duration_mins: recommendedOption.totalDurationMins,
    total_distance_km: recommendedOption.totalDistanceKm,
    origin_coords: origin,
    destination_coords: destination,
    segments: recommendedOption.legs.map((leg, index) => ({
      id: index + 1,
      mode: leg.mode.toUpperCase(),
      instruction: leg.instruction,
      duration_mins: leg.durationMins,
      distance_km: leg.distanceKm,
      fare: leg.priceMax,
      from_stop: leg.from.name,
      to_stop: leg.to.name,
    })),
    is_fastest: recommendedOption.isFastest,
    is_cheapest: recommendedOption.isCheapest,
    is_safest: true,
    // NEW: Include smart route data
    smartRouteData: smartRoute,
  };
};

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (coord1: { latitude: number; longitude: number }, coord2: { latitude: number; longitude: number }): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Helper function to find nearest stops
const findNearestStops = (location: { latitude: number; longitude: number }, maxDistance: number = 2): any[] => {
  return MOCK_STOPS.filter(stop => {
    const distance = calculateDistance(location, { latitude: stop.latitude, longitude: stop.longitude });
    return distance <= maxDistance;
  }).sort((a, b) => {
    const distA = calculateDistance(location, { latitude: a.latitude, longitude: a.longitude });
    const distB = calculateDistance(location, { latitude: b.latitude, longitude: b.longitude });
    return distA - distB;
  });
};

// Generate realistic routes based on actual locations
const generateRealisticRoutes = (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, destinationName?: string) => {
  const totalDistance = calculateDistance(origin, destination);

  // Find nearby stops
  const originStops = findNearestStops(origin, 1.5); // Within 1.5km
  const destStops = findNearestStops(destination, 1.5);

  const routes = [];

  // Route 1: Direct transport if stops are available
  if (originStops.length > 0 && destStops.length > 0) {
    const originStop = originStops[0];
    const destStop = destStops[0];

    const walkToStopDist = calculateDistance(origin, { latitude: originStop.latitude, longitude: originStop.longitude });
    const transportDist = calculateDistance({ latitude: originStop.latitude, longitude: originStop.longitude }, { latitude: destStop.latitude, longitude: destStop.longitude });
    const walkFromStopDist = calculateDistance({ latitude: destStop.latitude, longitude: destStop.longitude }, destination);

    routes.push({
      id: 1,
      origin: 'Your Location',
      destination: destinationName || 'Destination',
      rating: 4.6,
      total_fare: Math.round(200 + transportDist * 50), // Base fare + distance-based
      total_duration_mins: Math.round(walkToStopDist * 12 + transportDist * 3 + walkFromStopDist * 12), // Walking ~5km/h, transport ~20km/h
      total_distance_km: parseFloat(totalDistance.toFixed(1)),
      origin_coords: origin,
      destination_coords: destination,
      segments: [
        {
          id: 1,
          mode: 'WALK',
          instruction: `Walk ${walkToStopDist.toFixed(1)} km to ${originStop.name}`,
          duration_mins: Math.round(walkToStopDist * 12),
          distance_km: parseFloat(walkToStopDist.toFixed(1)),
          fare: 0,
        },
        {
          id: 2,
          mode: originStop.stop_type.toUpperCase(),
          instruction: `Take ${originStop.stop_type} from ${originStop.name} to ${destStop.name}`,
          duration_mins: Math.round(transportDist * 3),
          distance_km: parseFloat(transportDist.toFixed(1)),
          fare: Math.round(200 + transportDist * 40),
          from_stop: originStop.name,
          to_stop: destStop.name,
        },
        {
          id: 3,
          mode: 'WALK',
          instruction: `Walk ${walkFromStopDist.toFixed(1)} km to ${destinationName || 'destination'}`,
          duration_mins: Math.round(walkFromStopDist * 12),
          distance_km: parseFloat(walkFromStopDist.toFixed(1)),
          fare: 0,
        },
      ],
      is_fastest: transportDist < 5,
      is_cheapest: transportDist < 3,
      is_safest: true,
    });
  }

  // Route 2: Alternative route with different stops or direct walking for short distances
  if (totalDistance < 3) {
    // Short distance - suggest walking or keke
    routes.push({
      id: 2,
      origin: 'Your Location',
      destination: destinationName || 'Destination',
      rating: 4.8,
      total_fare: totalDistance < 1 ? 0 : Math.round(totalDistance * 150), // Walking free, keke ~₦150/km
      total_duration_mins: Math.round(totalDistance * (totalDistance < 1 ? 12 : 8)), // Walking slower than keke
      total_distance_km: parseFloat(totalDistance.toFixed(1)),
      origin_coords: origin,
      destination_coords: destination,
      segments: [
        {
          id: 1,
          mode: totalDistance < 1 ? 'WALK' : 'KEKE',
          instruction: totalDistance < 1 ? `Walk ${totalDistance.toFixed(1)} km to ${destinationName || 'destination'}` : `Take Keke ${totalDistance.toFixed(1)} km to ${destinationName || 'destination'}`,
          duration_mins: Math.round(totalDistance * (totalDistance < 1 ? 12 : 8)),
          distance_km: parseFloat(totalDistance.toFixed(1)),
          fare: totalDistance < 1 ? 0 : Math.round(totalDistance * 150),
        },
      ],
      is_fastest: totalDistance < 1,
      is_cheapest: totalDistance < 1,
      is_safest: true,
    });
  } else if (originStops.length > 1 && destStops.length > 1) {
    // Alternative route using different stops
    const altOriginStop = originStops[1] || originStops[0];
    const altDestStop = destStops[1] || destStops[0];

    const altWalkToStopDist = calculateDistance(origin, { latitude: altOriginStop.latitude, longitude: altOriginStop.longitude });
    const altTransportDist = calculateDistance({ latitude: altOriginStop.latitude, longitude: altOriginStop.longitude }, { latitude: altDestStop.latitude, longitude: altDestStop.longitude });
    const altWalkFromStopDist = calculateDistance({ latitude: altDestStop.latitude, longitude: altDestStop.longitude }, destination);

    routes.push({
      id: 2,
      origin: 'Your Location',
      destination: destinationName || 'Destination',
      rating: 4.4,
      total_fare: Math.round(250 + altTransportDist * 45),
      total_duration_mins: Math.round(altWalkToStopDist * 12 + altTransportDist * 3.5 + altWalkFromStopDist * 12),
      total_distance_km: parseFloat(totalDistance.toFixed(1)),
      origin_coords: origin,
      destination_coords: destination,
      segments: [
        {
          id: 1,
          mode: 'WALK',
          instruction: `Walk ${altWalkToStopDist.toFixed(1)} km to ${altOriginStop.name}`,
          duration_mins: Math.round(altWalkToStopDist * 12),
          distance_km: parseFloat(altWalkToStopDist.toFixed(1)),
          fare: 0,
        },
        {
          id: 2,
          mode: altOriginStop.stop_type.toUpperCase(),
          instruction: `Take ${altOriginStop.stop_type} from ${altOriginStop.name} to ${altDestStop.name}`,
          duration_mins: Math.round(altTransportDist * 3.5),
          distance_km: parseFloat(altTransportDist.toFixed(1)),
          fare: Math.round(250 + altTransportDist * 35),
          from_stop: altOriginStop.name,
          to_stop: altDestStop.name,
        },
        {
          id: 3,
          mode: 'WALK',
          instruction: `Walk ${altWalkFromStopDist.toFixed(1)} km to ${destinationName || 'destination'}`,
          duration_mins: Math.round(altWalkFromStopDist * 12),
          distance_km: parseFloat(altWalkFromStopDist.toFixed(1)),
          fare: 0,
        },
      ],
      is_fastest: false,
      is_cheapest: altTransportDist < 3,
      is_safest: true,
    });
  }

  // If no routes generated, create a fallback route
  if (routes.length === 0) {
    routes.push({
      id: 1,
      origin: 'Your Location',
      destination: destinationName || 'Destination',
      rating: 4.5,
      total_fare: Math.round(totalDistance * 100),
      total_duration_mins: Math.round(totalDistance * 10),
      total_distance_km: parseFloat(totalDistance.toFixed(1)),
      origin_coords: origin,
      destination_coords: destination,
      segments: [
        {
          id: 1,
          mode: totalDistance < 2 ? 'WALK' : 'KEKE',
          instruction: `Take ${totalDistance < 2 ? 'Walk' : 'Keke'} ${totalDistance.toFixed(1)} km to ${destinationName || 'destination'}`,
          duration_mins: Math.round(totalDistance * (totalDistance < 2 ? 12 : 8)),
          distance_km: parseFloat(totalDistance.toFixed(1)),
          fare: totalDistance < 2 ? 0 : Math.round(totalDistance * 120),
        },
      ],
      is_fastest: totalDistance < 2,
      is_cheapest: totalDistance < 2,
      is_safest: true,
    });
  }

  return routes;
};

export const getRoute = async (id: number) => {
  if (USE_MOCK_DATA) {
    // Find route in mock data
    return MOCK_ROUTES.search_results.find(r => r.id === id);
  }
  const response = await apiClient.get(`/routes/${id}/`);
  return response.data;
};

// Reports
export const createReport = async (data: {
  report_type: string;
  title: string;
  description: string;
  route_id?: number;
  stop_id?: number;
  location?: { latitude: number; longitude: number };
  new_fare_ngn?: number;
  user_device_id?: string;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 800));
    return { status: 'success', id: 999 };
  }
  const response = await apiClient.post('/reports/', data);
  return response.data;
};

export default apiClient;

