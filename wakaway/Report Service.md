
# Report Service

`client/src/services/reportService.ts` — manages quick map "reports" (Traffic / Hazard / Security pins with confirm/dismiss counts and TTL-based expiry).

## What it does

Dual-backend strategy: tries [[Supabase Integration]] first (inserting into `contributions`), and transparently falls back to local `AsyncStorage` persistence if Supabase isn't configured or a call throws. Local reports expire client-side on per-type TTLs (Traffic 1h, Hazard 3h, Security 6h); Supabase reports rely on the server-side `expires_at` column instead. This is distinct from `api.ts`'s Django `/reports/` endpoints — same real-world concept, two separate backends (see [[API Client]]).

## Key exports

- `Report` interface, `ReportType` (`'Traffic' | 'Hazard' | 'Security'`)
- `addReport(report)`, `getReports(cleanExpired?)`, `confirmReport(id)`, `dismissReport(id)`, `cleanupExpired()`

## Dependencies

The Supabase client from [[Supabase Integration]].

## Used by

- [[Map Layer]] (`MapView.tsx`) — `cleanupExpired`, `getReports`, `addReport`, `confirmReport`, `dismissReport`
- `QuickReportBar.tsx` — `addReport` (see [[Community Contributions]])

## Related
[[Architecture]] · [[Community Contributions]] · [[Supabase Integration]] · [[Map Layer]] · [[API Client]]
