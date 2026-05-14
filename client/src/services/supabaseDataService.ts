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

export interface RouteHistoryItem {
  id: string;
  user_id: string;
  origin_name: string;
  destination_name: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  transport_modes?: string[];
  total_duration_mins?: number;
  total_distance_km?: number;
  total_fare_min?: number;
  total_fare_max?: number;
  route_data?: any;
  started_at: string;
}

export interface SavedRoute {
  id: string;
  user_id: string;
  origin_name: string;
  destination_name: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  transport_modes?: string[];
  total_duration_mins?: number;
  total_distance_km?: number;
  total_fare_min?: number;
  total_fare_max?: number;
  route_data?: any;
  saved_at: string;
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
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) { console.warn('getRouteHistory error:', error.message); return []; }
  return data ?? [];
}

export async function addRouteHistory(
  userId: string,
  routeData: any,
  smartRoute: SmartRouteResult | null,
  selectedOption: RouteOption | null
): Promise<void> {
  const opt = selectedOption ?? smartRoute?.options.find(o => o.id === smartRoute?.recommendedOptionId) ?? smartRoute?.options[0];

  const modes = opt?.legs.map(l => l.mode) ?? [];
  const uniqueModes = [...new Set(modes)];

  const payload = {
    user_id:            userId,
    origin_name:        routeData.origin      ?? smartRoute?.origin.name      ?? 'Unknown',
    destination_name:   routeData.destination ?? smartRoute?.destination.name ?? 'Unknown',
    origin_lat:         routeData.origin_coords?.latitude      ?? smartRoute?.origin.latitude,
    origin_lng:         routeData.origin_coords?.longitude     ?? smartRoute?.origin.longitude,
    destination_lat:    routeData.destination_coords?.latitude  ?? smartRoute?.destination.latitude,
    destination_lng:    routeData.destination_coords?.longitude ?? smartRoute?.destination.longitude,
    transport_modes:    uniqueModes,
    total_duration_mins: opt?.totalDurationMins ?? routeData.total_duration_mins,
    total_distance_km:  opt?.totalDistanceKm   ?? routeData.total_distance_km,
    total_fare_min:     opt?.totalPriceMin,
    total_fare_max:     opt?.totalPriceMax      ?? routeData.total_fare,
    route_data:         smartRoute ? JSON.parse(JSON.stringify(smartRoute)) : null,
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
    .order('saved_at', { ascending: false });

  if (error) { console.warn('getSavedRoutes error:', error.message); return []; }
  return data ?? [];
}

export async function saveRoute(
  userId: string,
  routeData: any,
  smartRoute: SmartRouteResult | null,
  selectedOption: RouteOption | null
): Promise<SavedRoute | null> {
  const opt = selectedOption ?? smartRoute?.options.find(o => o.id === smartRoute?.recommendedOptionId) ?? smartRoute?.options[0];
  const modes = opt?.legs.map(l => l.mode) ?? [];
  const uniqueModes = [...new Set(modes)];

  const payload = {
    user_id:            userId,
    origin_name:        routeData.origin      ?? smartRoute?.origin.name      ?? 'Unknown',
    destination_name:   routeData.destination ?? smartRoute?.destination.name ?? 'Unknown',
    origin_lat:         routeData.origin_coords?.latitude      ?? smartRoute?.origin.latitude,
    origin_lng:         routeData.origin_coords?.longitude     ?? smartRoute?.origin.longitude,
    destination_lat:    routeData.destination_coords?.latitude  ?? smartRoute?.destination.latitude,
    destination_lng:    routeData.destination_coords?.longitude ?? smartRoute?.destination.longitude,
    transport_modes:    uniqueModes,
    total_duration_mins: opt?.totalDurationMins ?? routeData.total_duration_mins,
    total_distance_km:  opt?.totalDistanceKm   ?? routeData.total_distance_km,
    total_fare_min:     opt?.totalPriceMin,
    total_fare_max:     opt?.totalPriceMax      ?? routeData.total_fare,
    route_data:         smartRoute ? JSON.parse(JSON.stringify(smartRoute)) : null,
  };

  const { data, error } = await supabase
    .from('saved_routes')
    .insert(payload)
    .select()
    .single();

  if (error) { console.warn('saveRoute error:', error.message); return null; }
  return data;
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
  userId: string,
  vote: 'confirm' | 'dismiss'
): Promise<boolean> {
  // Upsert vote record
  const { error: voteErr } = await supabase
    .from('contribution_votes')
    .upsert({ contribution_id: contributionId, user_id: userId, vote }, { onConflict: 'contribution_id,user_id' });

  if (voteErr) { console.warn('voteOnContribution error:', voteErr.message); return false; }

  // Update counter
  const field = vote === 'confirm' ? 'confirms' : 'dismisses';
  const { data: current } = await supabase
    .from('contributions')
    .select(field)
    .eq('id', contributionId)
    .single();

  if (current) {
    const count = (current as Record<string, number>)[field] ?? 0;
    await supabase
      .from('contributions')
      .update({ [field]: count + 1 })
      .eq('id', contributionId);
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
