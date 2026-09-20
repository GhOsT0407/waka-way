import type { WWColors } from '../theme/colors';

// One presentation per contribution type — the Live map pins, the alert
// sheet, the Report chips and the notifications list all read from here so
// a kind looks the same everywhere. Glyphs are single characters, as the
// canvas draws them, not emoji (which render differently on every Android
// OEM and can't be tinted).

export type ReportKind =
  | 'fare_change' | 'route_down' | 'stop_moved' | 'new_route'
  | 'traffic' | 'security' | 'danger_zone' | 'hazard' | 'construction'
  | 'bus_stop' | 'taxi_stand' | 'other';

export interface KindMeta {
  label: string;      // "Fare change"
  pidgin: string;     // the Report chip — "Fare don change"
  glyph: string;      // pin / sheet character
  color: (WW: WWColors) => string;
  onColor: (WW: WWColors) => string;
}

export const REPORT_KINDS: Record<ReportKind, KindMeta> = {
  fare_change:  { label: 'Fare change',  pidgin: 'Fare don change',    glyph: '₦', color: (W) => W.danfo,   onColor: (W) => W.danfoText },
  route_down:   { label: 'Route down',   pidgin: 'Route no dey work',  glyph: '×', color: (W) => W.error,   onColor: (W) => W.okadaText },
  stop_moved:   { label: 'Stop moved',   pidgin: 'Stop move',          glyph: '↔', color: (W) => W.brt,     onColor: (W) => W.brtText },
  new_route:    { label: 'New route',    pidgin: 'New route',          glyph: '+', color: (W) => W.green,   onColor: (W) => W.textOnGreen },
  traffic:      { label: 'Traffic',      pidgin: 'Go-slow',            glyph: '!', color: (W) => W.warning, onColor: (W) => W.textOnWarning },
  security:     { label: 'Security',     pidgin: 'Wahala',             glyph: '!', color: (W) => W.error,   onColor: (W) => W.okadaText },
  danger_zone:  { label: 'Danger zone',  pidgin: 'No pass here',       glyph: '!', color: (W) => W.error,   onColor: (W) => W.okadaText },
  hazard:       { label: 'Hazard',       pidgin: 'Hazard',             glyph: '!', color: (W) => W.warning, onColor: (W) => W.textOnWarning },
  construction: { label: 'Construction', pidgin: 'Dem dey work',       glyph: '!', color: (W) => W.warning, onColor: (W) => W.textOnWarning },
  bus_stop:     { label: 'Bus stop',     pidgin: 'Bus stop',           glyph: 'B', color: (W) => W.brt,     onColor: (W) => W.brtText },
  taxi_stand:   { label: 'Taxi stand',   pidgin: 'Taxi stand',         glyph: 'T', color: (W) => W.keke,    onColor: (W) => W.kekeText },
  other:        { label: 'Other',        pidgin: 'Something else',     glyph: '•', color: (W) => W.textMuted, onColor: (W) => W.bg },
};

/** The four kinds a rider can file from the Report tab, in chip order. */
export const REPORTABLE_KINDS: ReportKind[] = ['fare_change', 'route_down', 'stop_moved', 'new_route'];

export function kindMeta(type: string | null | undefined): KindMeta {
  return REPORT_KINDS[(type as ReportKind) in REPORT_KINDS ? (type as ReportKind) : 'other'];
}

/**
 * How much to trust a report right now (validation doc: green / yellow / grey).
 *   verified — confirmed by riders and still recent
 *   reported — one voice, fresh
 *   stale    — older than a few hours; probably over
 */
export type Freshness = 'verified' | 'reported' | 'stale';

export function freshnessOf(r: { created_at: string; verified?: boolean; confirm_count?: number; confirms?: number }): Freshness {
  const ageH = (Date.now() - new Date(r.created_at).getTime()) / 3_600_000;
  const confirms = r.confirm_count ?? r.confirms ?? 0;
  if ((r.verified || confirms >= 2) && ageH < 6) return 'verified';
  if (ageH < 3) return 'reported';
  return 'stale';
}

export function freshnessLabel(f: Freshness, confirms: number): string {
  if (f === 'verified') return confirms > 0 ? `VERIFIED BY ${confirms} RIDER${confirms === 1 ? '' : 'S'}` : 'VERIFIED';
  if (f === 'reported') return 'REPORTED';
  return 'OLDER INFO';
}

/** "4 min ago", "1 hr ago", "2 days ago". */
export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
