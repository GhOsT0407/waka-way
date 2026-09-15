# 0010 — Route all voting through `vote_on_contribution`

**Date:** 2026-09-03
**Status:** Partially applied

## Context

Three separate vote implementations existed side by side, and only one was correct — the fragmentation [[Service Duplication & Dead Code]] already flagged.

1. `hooks/useContributions.ts` — calls the `vote_on_contribution` RPC. **Correct**, and the one hardened in [[0001-require-auth-for-vote-rpc]].
2. `services/supabaseDataService.ts` → `voteOnContribution()` — upserted `contribution_votes`, then read a counter and wrote back `count + 1`.
3. `hooks/useRealtimeContributions.ts` → `confirmContribution`/`dismissContribution` — raw read-then-increment straight on `contributions.confirms/dismisses`.

Path 2 was doubly broken: **`contribution_votes` does not exist in the live database.** The live schema has `votes`. That call failed every single time, independent of the auth problem in [[0009-supabase-auth-over-firebase]].

Paths 2 and 3 both defeat the point of the RPC. It derives the voter from `auth.uid()`, enforces one vote per user, and updates counters transactionally. A direct table write skips all three: no auth check, no dedup, and a lost-update race between the read and the write.

## Decision

Every vote goes through the RPC. No exceptions — a second write path is how the guarantee gets lost.

## Changes

- `services/supabaseDataService.ts` — `voteOnContribution()` now calls `supabase.rpc('vote_on_contribution', …)` and surfaces the RPC's own `{ success: false, error }` payload. Signature dropped its `userId` argument; the RPC takes the voter from `auth.uid()`, so accepting a caller-supplied id was misleading.
- `screens/NotificationsScreen.tsx` — updated for the new signature (sole caller).

## Still to do

`hooks/useRealtimeContributions.ts` (path 3, feeding `LiveAlertsFeed.tsx`) is untouched. It largely duplicates `useContributions.ts`, so the fix is to retire the duplicate hook rather than patch its vote path — a bigger change than this one, and worth doing deliberately.

## Verification

- `tsc --noEmit` clean.
- `vote_on_contribution(p_contribution_id uuid, p_vote_type text)` confirmed present in the live project.
- Live tables confirmed: `contributions`, `favorite_places`, `profiles`, `route_history`, `saved_routes`, `votes` — no `contribution_votes`.

## Related
[[0001-require-auth-for-vote-rpc]] · [[0009-supabase-auth-over-firebase]] · [[Service Duplication & Dead Code]] · [[Active Context]]
