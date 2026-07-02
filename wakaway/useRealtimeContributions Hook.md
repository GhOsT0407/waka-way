
# useRealtimeContributions Hook

`client/src/hooks/useRealtimeContributions.ts` — a second, simpler contributions hook, distinct from [[useContributions Hook]].

## What it does

Fetches `contributions` (optionally filtered by type, optionally excluding expired). Its options type has `onNewContribution`/`onUpdateContribution`/`onDeleteContribution` callbacks implying a realtime subscription, but the actual implementation only does a **one-shot fetch** — no `supabase.channel(...)` subscription exists here (unlike [[useContributions Hook]], which does subscribe). Also exports `useNearbyAlerts`, a convenience wrapper pinned to alert-relevant types, and two standalone vote-count helpers.

## Key exports

- `Contribution` interface — similar to but **not identical to** [[useContributions Hook]]'s: missing `confirm_count`/`dismiss_count`/`verified`/`reporter_trust_score`, and `status` excludes `'expired'`
- `useRealtimeContributions(options?)` → `{ contributions, loading, error, refetch }`
- `useNearbyAlerts(options?)` — pins `filterTypes` to `['traffic','security','hazard','construction','danger_zone']`
- `confirmContribution(contributionId)` / `dismissContribution(contributionId)` — standalone functions that increment `confirms`/`dismisses` directly, independent of hook state

## Dependencies

The Supabase client from [[Supabase Integration]] only.

## Used by

[[Community Contributions]]'s `LiveAlertsFeed.tsx` component (via `useNearbyAlerts`, `confirmContribution`) and [[Map Layer]]'s `AlertMarkers.tsx` (type-only).

## Related
[[Architecture]] · [[Community Contributions]] · [[Map Layer]] · [[useContributions Hook]] · [[Supabase Integration]] · [[Service Duplication & Dead Code]]
