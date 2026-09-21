// utils/supabaseClient.ts
// Complete Supabase integration for Lagos Transit App

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
// TYPES
// ================================================================

export interface Stop {
  id: string;
  name: string;
  alias: string[];
  latitude: number;
  longitude: number;
  zone: string;
  available_modes: string[];
  is_okada_banned: boolean;
  is_danfo_banned: boolean;
  is_major_hub: boolean;
  connected_stops: string[];
}

export interface Route {
  id: string;
  from_stop: string;
  to_stop: string;
  mode: string;
  distance_km: number;
  duration_min: number;
  peak_duration_min: number;
  cost_min: number;
  cost_max: number;
  is_active: boolean;
}

export type CrowdReportType =
  | "HEAVY_TRAFFIC"
  | "LIGHT_TRAFFIC"
  | "NO_BUS"
  | "BUS_AVAILABLE"
  | "ROAD_BLOCKED"
  | "FLOODING"
  | "ACCIDENT"
  | "OKADA_AROUND"
  | "DANFO_FULL";

export interface CrowdReport {
  id: string;
  stop_id: string;
  route_id?: string;
  report_type: CrowdReportType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  latitude?: number;
  longitude?: number;
  upvotes: number;
  expires_at: string;
  created_at: string;
}

// ================================================================
// STOPS QUERIES
// ================================================================

// Get all stops (cached — stops rarely change)
export async function getAllStops(): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .order("name");

  if (error) throw new Error(`Failed to fetch stops: ${error.message}`);
  return data ?? [];
}

// Get a single stop by ID
export async function getStopById(id: string): Promise<Stop | null> {
  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

// Find nearest stops to user's location using PostGIS
export async function getNearestStops(
  lat: number,
  lng: number,
  limit = 3
): Promise<{ id: string; name: string; distance_meters: number }[]> {
  const { data, error } = await supabase.rpc("get_nearest_stop", {
    user_lat: lat,
    user_lng: lng,
    limit_count: limit,
  });

  if (error) throw new Error(`Nearest stop query failed: ${error.message}`);
  return data ?? [];
}

// Search stops by name or alias
export async function searchStops(query: string): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .or(`name.ilike.%${query}%,alias.cs.{${query}}`);

  if (error) throw new Error(`Stop search failed: ${error.message}`);
  return data ?? [];
}

// Get all stops in a zone
export async function getStopsByZone(zone: string): Promise<Stop[]> {
  const { data, error } = await supabase
    .from("stops")
    .select("*")
    .eq("zone", zone);

  if (error) throw new Error(`Zone query failed: ${error.message}`);
  return data ?? [];
}

// ================================================================
// ROUTES QUERIES
// ================================================================

// Get all active routes from a stop
export async function getRoutesFromStop(stopId: string): Promise<Route[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("from_stop", stopId)
    .eq("is_active", true);

  if (error) throw new Error(`Routes query failed: ${error.message}`);
  return data ?? [];
}

// Get a direct route between two stops
export async function getDirectRoute(
  fromStop: string,
  toStop: string
): Promise<Route | null> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("from_stop", fromStop)
    .eq("to_stop", toStop)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return data;
}

// Get all routes for a specific transport mode
export async function getRoutesByMode(mode: string): Promise<Route[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("*")
    .eq("mode", mode)
    .eq("is_active", true);

  if (error) throw new Error(`Mode query failed: ${error.message}`);
  return data ?? [];
}

// ================================================================
// CROWD REPORTS QUERIES
// ================================================================

// Submit a new crowd report
export async function submitCrowdReport(report: {
  stop_id: string;
  route_id?: string;
  report_type: CrowdReportType;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  latitude?: number;
  longitude?: number;
}): Promise<CrowdReport> {
  const { data, error } = await supabase
    .from("crowd_reports")
    .insert(report)
    .select()
    .single();

  if (error) throw new Error(`Failed to submit report: ${error.message}`);
  return data;
}

// Get active reports for a stop
export async function getActiveReports(stopId: string): Promise<CrowdReport[]> {
  const { data, error } = await supabase.rpc("get_active_reports", {
    p_stop_id: stopId,
  });

  if (error) throw new Error(`Failed to fetch reports: ${error.message}`);
  return data ?? [];
}

// Upvote a crowd report
export async function upvoteCrowdReport(reportId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_upvotes", {
    report_id: reportId,
  });

  if (error) throw new Error(`Failed to upvote: ${error.message}`);
}

// Get reports along a route (for traffic awareness)
export async function getReportsAlongRoute(
  stopIds: string[]
): Promise<CrowdReport[]> {
  const { data, error } = await supabase
    .from("crowd_reports")
    .select("*")
    .in("stop_id", stopIds)
    .gt("expires_at", new Date().toISOString())
    .order("upvotes", { ascending: false });

  if (error) throw new Error(`Failed to fetch route reports: ${error.message}`);
  return data ?? [];
}

// ================================================================
// REAL-TIME CROWD REPORTS SUBSCRIPTION
// ================================================================

// Subscribe to live crowd reports for a stop
export function subscribeToStopReports(
  stopId: string,
  onNewReport: (report: CrowdReport) => void
) {
  const channel = supabase
    .channel(`stop-reports-${stopId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "crowd_reports",
        filter: `stop_id=eq.${stopId}`,
      },
      (payload) => {
        onNewReport(payload.new as CrowdReport);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => supabase.removeChannel(channel);
}

// Subscribe to ALL reports on a route (multiple stops)
export function subscribeToRouteReports(
  stopIds: string[],
  onNewReport: (report: CrowdReport) => void
) {
  const channel = supabase
    .channel("route-reports")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "crowd_reports",
      },
      (payload) => {
        const report = payload.new as CrowdReport;
        if (stopIds.includes(report.stop_id)) {
          onNewReport(report);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
