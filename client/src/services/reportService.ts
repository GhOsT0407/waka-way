import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type ReportType = 'Traffic' | 'Hazard' | 'Security';

export interface Report {
  id: string;
  latitude: number;
  longitude: number;
  type: ReportType;
  createdAt: string; // ISO
  confirms: number;
  dismisses: number;
  title?: string;
  description?: string;
  status?: string;
  ai_score?: number;
}

const STORAGE_KEY = '@waka_way_reports_v1';

const EXPIRY_MS: Record<ReportType, number> = {
  Traffic: 1000 * 60 * 60 * 1, // 1 hour
  Hazard: 1000 * 60 * 60 * 3, // 3 hours (default)
  Security: 1000 * 60 * 60 * 6, // 6 hours
};

// Map ReportType to contribution type for Supabase
const typeToContribType: Record<ReportType, string> = {
  Traffic: 'traffic',
  Hazard: 'hazard',
  Security: 'security',
};

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  try {
    // Check if supabase URL is not placeholder
    return !supabase.supabaseUrl.includes('YOUR_PROJECT_ID');
  } catch {
    return false;
  }
};

// ===== LOCAL STORAGE FALLBACK =====
async function readAllLocal(): Promise<Report[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: Report[] = JSON.parse(raw);
    return data;
  } catch (err) {
    console.warn('reportService: read error', err);
    return [];
  }
}

async function writeAllLocal(reports: Report[]) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  } catch (err) {
    console.warn('reportService: write error', err);
  }
}

// ===== SUPABASE FUNCTIONS =====
async function addReportSupabase(report: Omit<Report, 'id' | 'createdAt' | 'confirms' | 'dismisses'>): Promise<Report> {
  const expiresAt = new Date(Date.now() + EXPIRY_MS[report.type]).toISOString();

  const { data, error } = await supabase
    .from('contributions')
    .insert({
      type: typeToContribType[report.type],
      title: `${report.type} Alert`,
      description: report.description || `Reported via quick map report (${report.type}).`,
      latitude: report.latitude,
      longitude: report.longitude,
      status: 'pending',
      confirms: 0,
      dismisses: 0,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    latitude: data.latitude,
    longitude: data.longitude,
    type: report.type,
    createdAt: data.created_at,
    confirms: data.confirms || 0,
    dismisses: data.dismisses || 0,
    title: data.title,
    description: data.description,
    status: data.status,
    ai_score: data.ai_score,
  };
}

async function getReportsSupabase(): Promise<Report[]> {
  const { data, error } = await supabase
    .from('contributions')
    .select('*')
    .in('type', ['traffic', 'hazard', 'security'])
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const contribTypeToReport: Record<string, ReportType> = {
    traffic: 'Traffic',
    hazard: 'Hazard',
    security: 'Security',
  };

  return (data || []).map((d) => ({
    id: d.id,
    latitude: d.latitude,
    longitude: d.longitude,
    type: contribTypeToReport[d.type] || 'Hazard',
    createdAt: d.created_at,
    confirms: d.confirms || 0,
    dismisses: d.dismisses || 0,
    title: d.title,
    description: d.description,
    status: d.status,
    ai_score: d.ai_score,
  }));
}

async function confirmReportSupabase(id: string): Promise<Report | null> {
  const { data: current } = await supabase
    .from('contributions')
    .select('confirms')
    .eq('id', id)
    .single();

  if (!current) return null;

  const { data, error } = await supabase
    .from('contributions')
    .update({ confirms: (current.confirms || 0) + 1 })
    .eq('id', id)
    .select()
    .single();

  if (error) return null;

  const contribTypeToReport: Record<string, ReportType> = {
    traffic: 'Traffic',
    hazard: 'Hazard',
    security: 'Security',
  };

  return {
    id: data.id,
    latitude: data.latitude,
    longitude: data.longitude,
    type: contribTypeToReport[data.type] || 'Hazard',
    createdAt: data.created_at,
    confirms: data.confirms || 0,
    dismisses: data.dismisses || 0,
  };
}

async function dismissReportSupabase(id: string): Promise<Report | null> {
  const { data: current } = await supabase
    .from('contributions')
    .select('dismisses')
    .eq('id', id)
    .single();

  if (!current) return null;

  const { data, error } = await supabase
    .from('contributions')
    .update({ dismisses: (current.dismisses || 0) + 1 })
    .eq('id', id)
    .select()
    .single();

  if (error) return null;

  const contribTypeToReport: Record<string, ReportType> = {
    traffic: 'Traffic',
    hazard: 'Hazard',
    security: 'Security',
  };

  return {
    id: data.id,
    latitude: data.latitude,
    longitude: data.longitude,
    type: contribTypeToReport[data.type] || 'Hazard',
    createdAt: data.created_at,
    confirms: data.confirms || 0,
    dismisses: data.dismisses || 0,
  };
}

// ===== MAIN EXPORTS (auto-switch between Supabase and local) =====
export async function addReport(report: Omit<Report, 'id' | 'createdAt' | 'confirms' | 'dismisses'>): Promise<Report> {
  if (isSupabaseConfigured()) {
    try {
      return await addReportSupabase(report);
    } catch (err) {
      console.warn('Supabase addReport failed, falling back to local', err);
    }
  }

  // Local fallback
  const all = await readAllLocal();
  const newReport: Report = {
    ...report,
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    confirms: 0,
    dismisses: 0,
  };
  all.push(newReport);
  await writeAllLocal(all);
  return newReport;
}

export async function getReports(cleanExpired = true): Promise<Report[]> {
  if (isSupabaseConfigured()) {
    try {
      return await getReportsSupabase();
    } catch (err) {
      console.warn('Supabase getReports failed, falling back to local', err);
    }
  }

  // Local fallback
  let all = await readAllLocal();
  if (cleanExpired) {
    const now = Date.now();
    all = all.filter((r) => {
      const created = new Date(r.createdAt).getTime();
      const ttl = EXPIRY_MS[r.type] ?? EXPIRY_MS.Hazard;
      return now - created < ttl;
    });
    await writeAllLocal(all);
  }
  return all;
}

export async function confirmReport(id: string): Promise<Report | null> {
  if (isSupabaseConfigured()) {
    try {
      return await confirmReportSupabase(id);
    } catch (err) {
      console.warn('Supabase confirmReport failed, falling back to local', err);
    }
  }

  // Local fallback
  const all = await readAllLocal();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx].confirms += 1;
  await writeAllLocal(all);
  return all[idx];
}

export async function dismissReport(id: string): Promise<Report | null> {
  if (isSupabaseConfigured()) {
    try {
      return await dismissReportSupabase(id);
    } catch (err) {
      console.warn('Supabase dismissReport failed, falling back to local', err);
    }
  }

  // Local fallback
  const all = await readAllLocal();
  const idx = all.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  all[idx].dismisses += 1;
  await writeAllLocal(all);
  return all[idx];
}

export async function cleanupExpired(): Promise<Report[]> {
  // For Supabase, expiry is handled via expires_at column
  if (isSupabaseConfigured()) {
    return getReports();
  }

  // Local fallback
  const before = await readAllLocal();
  const now = Date.now();
  const after = before.filter((r) => {
    const created = new Date(r.createdAt).getTime();
    const ttl = EXPIRY_MS[r.type] ?? EXPIRY_MS.Hazard;
    return now - created < ttl;
  });
  if (after.length !== before.length) await writeAllLocal(after);
  return after;
}

export default {
  addReport,
  getReports,
  confirmReport,
  dismissReport,
  cleanupExpired,
};
