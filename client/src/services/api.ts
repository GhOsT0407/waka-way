import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { calculateSmartRoute, SmartRouteResult, RouteOption, TransportMode } from './smartRoutingService';

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
  preferredFirstLegMode?: TransportMode;
  avoidPoints?: { latitude: number; longitude: number; radiusKm: number }[];
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
      data.destinationName || 'Destination',
      {
        preferredFirstLegMode: data.preferredFirstLegMode,
        avoidPoints: data.avoidPoints,
      }
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

// Corridors
export const getCorridors = async (params?: {
  city?: number;
  primary_mode?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 300));
    // Return mock corridors data
    return {
      count: 8,
      next: null,
      previous: null,
      results: [],
    };
  }
  const response = await apiClient.get('/corridors/', { params });
  return response.data;
};

export const getCorridorDetail = async (id: number) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 400));
    return null;
  }
  const response = await apiClient.get(`/corridors/${id}/`);
  return response.data;
};

export const getCorridorByIdOrCode = async (idOrCode: string) => {
  // Try to fetch by ID first, then by corridor_code
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 400));
    return null;
  }
  try {
    const response = await apiClient.get(`/corridors/${idOrCode}/`);
    return response.data;
  } catch {
    // If numeric ID fails, try searching by corridor_id
    const corridors = await getCorridors({ search: idOrCode });
    return corridors.results?.[0] || null;
  }
};

export const getCorridorStops = async (corridorId: number, params?: {
  page?: number;
  page_size?: number;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 300));
    return {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  }
  const response = await apiClient.get('/corridor-stops/', {
    params: { corridor: corridorId, ...params },
  });
  return response.data;
};

export const getStopConnections = async (params?: {
  from_stop?: number;
  to_stop?: number;
  transport_mode?: string;
  corridor?: number;
  page?: number;
  page_size?: number;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 300));
    return {
      count: 0,
      next: null,
      previous: null,
      results: [],
    };
  }
  const response = await apiClient.get('/stop-connections/', { params });
  return response.data;
};

export default apiClient;
