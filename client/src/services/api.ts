import axios from 'axios';
import { API_BASE_URL, USE_MOCK_DATA } from '../utils/constants';
import { calculateSmartRoute, SmartRouteResult, RouteOption, TransportMode } from './smartRoutingService';
import { MOCK_CITIES, MOCK_STOPS, MOCK_ROUTES } from './mockData';

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Auth token injected at runtime by wireAuthToken()
let _authToken: string | null = null;

/** Call this once the Supabase session is available. */
export function wireAuthToken(token: string | null) {
  _authToken = token;
}

apiClient.interceptors.request.use((config) => {
  if (_authToken) {
    config.headers.Authorization = `Bearer ${_authToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('API Error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('Network Error:', error.message);
    }
    return Promise.reject(error);
  },
);

// ─── Health ───────────────────────────────────────────────────────────────────

export const checkHealth = async () => {
  if (USE_MOCK_DATA) return { status: 'healthy', mock: true };
  const response = await apiClient.get('/health/');
  return response.data;
};

// ─── Cities ───────────────────────────────────────────────────────────────────

export const getCities = async () => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 300));
    return MOCK_CITIES;
  }
  const response = await apiClient.get('/cities/');
  return response.data;
};

// ─── Stops ────────────────────────────────────────────────────────────────────

export const getStops = async (params?: {
  city?: number;
  stop_type?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 400));
    return MOCK_STOPS;
  }
  const response = await apiClient.get('/stops/', { params });
  return response.data;
};

export const getNearbyStops = async (
  latitude: number,
  longitude: number,
  radius = 2,
  stop_type?: string,
) => {
  if (USE_MOCK_DATA) return MOCK_STOPS;
  const response = await apiClient.get('/stops/nearby/', {
    params: { lat: latitude, lng: longitude, radius, stop_type },
  });
  return response.data;
};

// ─── Route search (always client-side engine) ─────────────────────────────────

export const searchRoutes = async (data: {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  destinationName?: string;
  destinationDetails?: any;
  preferredFirstLegMode?: TransportMode;
  avoidPoints?: { latitude: number; longitude: number; radiusKm: number }[];
}): Promise<{ smartRoute: SmartRouteResult; legacyRoute: any }> => {
  try {
    await new Promise(resolve => setTimeout(resolve, 400));

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
      },
    );

    const legacyRoute = _smartToLegacy(smartRoute, data.origin, data.destination, data.destinationName);
    return { smartRoute, legacyRoute };
  } catch (error) {
    console.error('Route search error:', error);
    return { smartRoute: null as any, legacyRoute: MOCK_ROUTES.search_results[0] };
  }
};

const _smartToLegacy = (
  smartRoute: SmartRouteResult,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  destinationName?: string,
) => {
  const recommended = smartRoute.options.find(o => o.id === smartRoute.recommendedOptionId)
    ?? smartRoute.options[0];

  if (!recommended) return MOCK_ROUTES.search_results[0];

  return {
    id: 1,
    origin:               smartRoute.origin.name,
    destination:          smartRoute.destination.name,
    rating:               4.5,
    total_fare:           recommended.totalPriceMax,
    total_duration_mins:  recommended.totalDurationMins,
    total_distance_km:    recommended.totalDistanceKm,
    origin_coords:        origin,
    destination_coords:   destination,
    segments: recommended.legs.map((leg, i) => ({
      id:           i + 1,
      mode:         leg.mode.toUpperCase(),
      instruction:  leg.instruction,
      duration_mins:leg.durationMins,
      distance_km:  leg.distanceKm,
      fare:         leg.priceMax,
      from_stop:    leg.from.name,
      to_stop:      leg.to.name,
    })),
    is_fastest:    recommended.isFastest,
    is_cheapest:   recommended.isCheapest,
    is_safest:     true,
    smartRouteData:smartRoute,
  };
};

export const getRoute = async (id: number) => {
  if (USE_MOCK_DATA) return MOCK_ROUTES.search_results.find(r => r.id === id);
  const response = await apiClient.get(`/routes/${id}/`);
  return response.data;
};

// ─── Reports ──────────────────────────────────────────────────────────────────

export const createReport = async (data: {
  report_type: string;
  title: string;
  description: string;
  route?: number;
  stop?: number;
  new_fare_ngn?: number;
  user_device_id?: string;
}, idempotencyKey?: string) => {
  if (USE_MOCK_DATA) {
    await new Promise(r => setTimeout(r, 600));
    return { status: 'success', id: 999 };
  }
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const response = await apiClient.post('/reports/', data, { headers });
  return response.data;
};

export const upvoteReport = async (id: number) => {
  if (USE_MOCK_DATA) return { id, upvotes: 1 };
  const response = await apiClient.post(`/reports/${id}/upvote/`);
  return response.data;
};

export const downvoteReport = async (id: number) => {
  if (USE_MOCK_DATA) return { id, downvotes: 1 };
  const response = await apiClient.post(`/reports/${id}/downvote/`);
  return response.data;
};

// ─── Corridors ────────────────────────────────────────────────────────────────

export const getCorridors = async (params?: {
  city?: number;
  primary_mode?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  page_size?: number;
}) => {
  if (USE_MOCK_DATA) {
    return { count: 0, next: null, previous: null, results: [] };
  }
  const response = await apiClient.get('/corridors/', { params });
  return response.data;
};

export const getCorridorDetail = async (id: number) => {
  if (USE_MOCK_DATA) return null;
  const response = await apiClient.get(`/corridors/${id}/`);
  return response.data;
};

export const getCorridorByIdOrCode = async (idOrCode: string) => {
  if (USE_MOCK_DATA) return null;
  try {
    const response = await apiClient.get(`/corridors/${idOrCode}/`);
    return response.data;
  } catch {
    const corridors = await getCorridors({ search: idOrCode });
    return corridors.results?.[0] ?? null;
  }
};

export const getCorridorStops = async (corridorId: number, params?: {
  page?: number;
  page_size?: number;
}) => {
  if (USE_MOCK_DATA) return { count: 0, next: null, previous: null, results: [] };
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
  if (USE_MOCK_DATA) return { count: 0, next: null, previous: null, results: [] };
  const response = await apiClient.get('/stop-connections/', { params });
  return response.data;
};

export default apiClient;
