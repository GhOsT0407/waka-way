
# useContributions Hook

`client/src/hooks/useContributions.ts` — the hook that actually powers the live [[Community Contributions]] map.

## What it does

Fetches active contributions (prefers RPC `get_active_contributions`, falls back to a direct `contributions` table query filtered on `expires_at`/`status`), subscribes to Supabase Realtime (`postgres_changes` on `contributions`), tracks the current user's votes, and exposes a `vote()` wrapper around the `vote_on_contribution` RPC. Independently of [[Proximity Alert Service]], it has its **own inline** Haversine/notification/cooldown logic for security/danger_zone/hazard proximity alerts.

## Key exports

- `Contribution` interface — full contributions-table row shape, including `confirm_count`/`dismiss_count`, `status` includes `'high-priority' | 'expired'`
- `useContributions(options?)` → `{ alerts, loading, error, refetch, vote, getUserVote, userVotes }`

## Dependencies

The Supabase client from [[Supabase Integration]] only — no imports from other services/hooks (its proximity logic duplicates [[Proximity Alert Service]] rather than calling it).

## Used by

[[Map Layer]] (`CommunityMapView.tsx`) — the hook that's actually invoked, unlike [[useRealtimeContributions Hook]] which powers a different component.

## Known duplication

Two independently-defined `Contribution` types exist ([[useContributions Hook|this one]] and [[useRealtimeContributions Hook]]'s), and `vote()` here calls the `vote_on_contribution` RPC while [[Supabase Data Service]]'s `voteOnContribution` does a separate direct upsert — two different voting code paths for the same feature. See [[Service Duplication & Dead Code]] (this file also directly matches the `vote_on_contribution` RPC that had the anon-vote-spam fix applied — see [[Supabase Integration]]).

## Related
[[Architecture]] · [[Community Contributions]] · [[Map Layer]] · [[Supabase Integration]] · [[Proximity Alert Service]] · [[useRealtimeContributions Hook]] · [[Supabase Data Service]] · [[Service Duplication & Dead Code]]
