
# Community Contributions

Crowdsourced traffic/hazard/security alerts, backed by a single unified `contributions` table in [[Supabase Integration]] (replacing an earlier per-report-type structure).

## Schema (contributions table)

`id`, `user_id`, `type` (traffic / hazard / security / danger_zone / construction / bus_stop / taxi_stand / other), `title`, `description`, `latitude`, `longitude`, `address`, `status` (pending / approved / rejected / high-priority), `confirms`, `dismisses`, `ai_score`, `ai_category`, `ai_sentiment`, `image_url`, `created_at`, `expires_at`.

## Voting & lifecycle

A separate `votes` table (`user_id`, `contribution_id`, `vote_type` CONFIRM/DISMISS) feeds a Postgres trigger, `update_contribution_vote_counts()`:
- **Auto-verify**: 5+ confirms → `verified = TRUE`
- **Auto-reject**: 3+ dismisses, or (dismisses > confirms and ≥2 dismisses) → `status = 'rejected'`, `expires_at = NOW()`

Legitimacy can also be scored automatically by [[AI Verification]] (`ai_score`/`ai_category`/`ai_sentiment`).

## Client side

- **Reading**: [[useRealtimeContributions Hook]] does a one-shot fetch (despite its name — no realtime subscription actually exists in it); `useNearbyAlerts()` is a variant filtered to alert-relevant types. [[useContributions Hook]] is the one that actually subscribes to Supabase Realtime, and additionally adds proximity-radius alerting and voting — it's the hook that powers `CommunityMapView`.
- **Writing**: `QuickReportBar` → `addReport()` in [[Report Service]] → insert into `contributions`, with a local AsyncStorage fallback if Supabase isn't configured.
- **Displaying**: `LiveAlertsFeed` (horizontal feed with confirm counts and a "LIVE" pulse indicator, backed by [[useRealtimeContributions Hook]]) and the [[Map Layer]] (`CommunityMapView` backed by [[useContributions Hook]], `AlertMarkers`).
- **Voting**: two separate code paths exist — [[useContributions Hook]]'s `vote()` calls the `vote_on_contribution` RPC (hardened against unauthenticated spam-voting, see [[Supabase Integration]]); `LiveAlertsFeed` instead calls the standalone `confirmContribution(id)`/`dismissContribution(id)` functions in [[useRealtimeContributions Hook]]; and [[Supabase Data Service]] has a third `voteOnContribution` that bypasses the RPC entirely. See [[Service Duplication & Dead Code]].

## Related
[[Architecture]] · [[Map Layer]] · [[Supabase Integration]] · [[AI Verification]] · [[Report Service]] · [[useContributions Hook]] · [[useRealtimeContributions Hook]] · [[Supabase Data Service]] · [[Service Duplication & Dead Code]]
