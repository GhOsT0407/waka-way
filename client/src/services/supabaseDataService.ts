import { supabase } from '../lib/supabase';
import type { SmartRouteResult, RouteOption } from './smartRoutingService';

// ============================================================
// TYPES
// ============================================================

export interface FavoritePlace {
  id: string;
  user_id: string;
  label: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  type: 'home' | 'work' | 'favorite';
  created_at: string;
}

// Live schema (verified 2026-09-11 against the Supabase project):
//   route_history: id, user_id, origin_name, destination_name, origin_coords jsonb,
//                  destination_coords jsonb, route_data jsonb, transport_modes text[],
//                  duration_mins int, fare_estimate text, created_at
//   saved_routes:  id, user_id, origin_name, destination_name, origin_coords jsonb,
//                  destination_coords jsonb, route_data jsonb, created_at
//
// Anything else the UI wants (fare min/max, distance) is written into
// route_data.summary and lifted back onto the row when read, so the screens can
// keep reading the flat field names without the table needing those columns.

export interface Coords { latitude: number; longitude: number }

export interface RouteSummary {
  transport_modes?: string[];
  total_duration_mins?: number;
  total_distance_km?: number;
  total_fare_min?: number;
  total_fare_max?: number;
}

export interface RouteHistoryItem extends RouteSummary {
  id: string;
  user_id: string;
  origin_name: string;
  destination_name: string;
  origin_coords?: Coords | null;
  destination_coords?: Coords | null;
  route_data?: any;
  created_at: string;
}

export interface SavedRoute extends RouteSummary {
  id: string;
  user_id: string;
  origin_name: string;
  destination_name: string;
  origin_coords?: Coords | null;
  destination_coords?: Coords | null;
  route_data?: any;
  created_at: string;
}

// Shared by both inserts: the option that was actually chosen, and the summary
// the UI renders, packed alongside the full smartRoute in route_data.
function buildRoutePayload(
  userId: string,
  routeData: any,
  smartRoute: SmartRouteResult | null,
  selectedOption: RouteOption | null,
) {
  const opt = selectedOption
    ?? smartRoute?.options.find(o => o.id === smartRoute?.recommendedOptionId)
    ?? smartRoute?.options[0];
  const modes = [...new Set(opt?.legs.map(l => l.mode) ?? [])];

  const originCoords: Coords | null = routeData.origin_coords
    ?? (smartRoute ? { latitude: smartRoute.origin.latitude, longitude: smartRoute.origin.longitude } : null);
  const destCoords: Coords | null = routeData.destination_coords
    ?? (smartRoute ? { latitude: smartRoute.destination.latitude, longitude: smartRoute.destination.longitude } : null);

  const summary: RouteSummary = {
    transport_modes:     modes,
    total_duration_mins: opt?.totalDurationMins ?? routeData.total_duration_mins,
    total_distance_km:   opt?.totalDistanceKm   ?? routeData.total_distance_km,
    total_fare_min:      opt?.totalPriceMin,
    total_fare_max:      opt?.totalPriceMax      ?? routeData.total_fare,
  };

  return {
    base: {
      user_id:            userId,
      origin_name:        routeData.origin      ?? smartRoute?.origin.name      ?? 'Unknown',
      destination_name:   routeData.destination ?? smartRoute?.destination.name ?? 'Unknown',
      origin_coords:      originCoords,
      destination_coords: destCoords,
      route_data: {
        summary,
        smartRoute: smartRoute ? JSON.parse(JSON.stringify(smartRoute)) : null,
      },
    },
    summary,
    opt,
  };
}

// Lift route_data.summary back onto the row so callers see the flat fields.
function withSummary<T extends { route_data?: any }>(row: T): T & RouteSummary {
  return { ...row, ...(row.route_data?.summary ?? {}) };
}

// ============================================================
// FAVORITE PLACES
// ============================================================

export async function getFavoritePlaces(userId: string): Promise<FavoritePlace[]> {
  const { data, error } = await supabase
    .from('favorite_places')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) { console.warn('getFavoritePlaces error:', error.message); return []; }
  return data ?? [];
}

export async function upsertFavoritePlace(
  userId: string,
  place: Omit<FavoritePlace, 'id' | 'user_id' | 'created_at'>
): Promise<FavoritePlace | null> {
  // For home/work, replace existing rather than duplicate
  if (place.type === 'home' || place.type === 'work') {
    await supabase
      .from('favorite_places')
      .delete()
      .eq('user_id', userId)
      .eq('type', place.type);
  }

  const { data, error } = await supabase
    .from('favorite_places')
    .insert({ ...place, user_id: userId })
    .select()
    .single();

  if (error) { console.warn('upsertFavoritePlace error:', error.message); return null; }
  return data;
}

export async function deleteFavoritePlace(id: string): Promise<boolean> {
  const { error } = await supabase.from('favorite_places').delete().eq('id', id);
  if (error) { console.warn('deleteFavoritePlace error:', error.message); return false; }
  return true;
}

// ============================================================
// ROUTE HISTORY
// ============================================================

export async function getRouteHistory(userId: string, limit = 20): Promise<RouteHistoryItem[]> {
  const { data, error } = await supabase
    .from('route_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.warn('getRouteHistory error:', error.message); return []; }
  return (data ?? []).map(withSummary);
}

export async function addRouteHistory(
  userId: string,
  routeData: any,
  smartRoute: SmartRouteResult | null,
  selectedOption: RouteOption | null
): Promise<void> {
  const { base, summary } = buildRoutePayload(userId, routeData, smartRoute, selectedOption);
  const fare = summary.total_fare_min != null && summary.total_fare_max != null
    ? (summary.total_fare_min === summary.total_fare_max
        ? `₦${summary.total_fare_max}`
        : `₦${summary.total_fare_min}–₦${summary.total_fare_max}`)
    : null;

  const payload = {
    ...base,
    transport_modes: summary.transport_modes ?? [],
    duration_mins:   summary.total_duration_mins ?? null,
    fare_estimate:   fare,
  };

  const { error } = await supabase.from('route_history').insert(payload);
  if (error) console.warn('addRouteHistory error:', error.message);
}

export async function deleteRouteHistory(id: string): Promise<boolean> {
  const { error } = await supabase.from('route_history').delete().eq('id', id);
  if (error) { console.warn('deleteRouteHistory error:', error.message); return false; }
  return true;
}

export async function clearAllRouteHistory(userId: string): Promise<boolean> {
  const { error } = await supabase.from('route_history').delete().eq('user_id', userId);
  if (error) { console.warn('clearAllRouteHistory error:', error.message); return false; }
  return true;
}

// ============================================================
// SAVED ROUTES
// ============================================================

export async function getSavedRoutes(userId: string): Promise<SavedRoute[]> {
  const { data, error } = await supabase
    .from('saved_routes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) { console.warn('getSavedRoutes error:', error.message); return []; }
  return (data ?? []).map(withSummary);
}

export async function saveRoute(
  userId: string,
  routeData: any,
  smartRoute: SmartRouteResult | null,
  selectedOption: RouteOption | null
): Promise<SavedRoute | null> {
  const { base } = buildRoutePayload(userId, routeData, smartRoute, selectedOption);
  const payload = base;

  const { data, error } = await supabase
    .from('saved_routes')
    .insert(payload)
    .select()
    .single();

  if (error) { console.warn('saveRoute error:', error.message); return null; }
  return withSummary(data);
}

export async function deleteSavedRoute(id: string): Promise<boolean> {
  const { error } = await supabase.from('saved_routes').delete().eq('id', id);
  if (error) { console.warn('deleteSavedRoute error:', error.message); return false; }
  return true;
}

// ============================================================
// CONTRIBUTIONS
// ============================================================

export async function getNearbyContributions(lat: number, lng: number, radiusKm = 5) {
  const { data, error } = await supabase.rpc('get_contributions_within_radius', {
    lat,
    lng,
    radius_km: radiusKm,
  });

  if (error) { console.warn('getNearbyContributions error:', error.message); return []; }
  return data ?? [];
}

export async function getAllContributions(limit = 50) {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) { console.warn('getAllContributions error:', error.message); return []; }
  return data ?? [];
}

export async function voteOnContribution(
  contributionId: string,
  vote: 'confirm' | 'dismiss'
): Promise<boolean> {
  // Always go through the RPC: it derives the voter from auth.uid(), enforces
  // one vote per user, and updates the counters in the same transaction.
  // Voting by writing the tables directly bypasses all three.
  const { data, error } = await supabase.rpc('vote_on_contribution', {
    p_contribution_id: contributionId,
    p_vote_type: vote,
  });

  if (error) { console.warn('voteOnContribution error:', error.message); return false; }
  if (data && data.success === false) {
    console.warn('voteOnContribution rejected:', data.error);
    return false;
  }
  return true;
}

// ============================================================
// USER PROFILE
// ============================================================

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) { console.warn('getUserProfile error:', error.message); return null; }
  return data;
}

export async function updateUserProfile(userId: string, updates: { full_name?: string; avatar_url?: string }) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) { console.warn('updateUserProfile error:', error.message); return null; }
  return data;
}
