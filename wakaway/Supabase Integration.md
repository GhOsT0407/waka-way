
# Supabase Integration

Supabase is WakaWay's realtime data layer — Postgres + realtime subscriptions + RLS + edge functions. It is **not** used for auth (see [[Auth]], which is Firebase); it backs [[Community Contributions]] and [[AI Verification]] only.

## Client setup

`client/src/lib/supabase.ts` — `@supabase/supabase-js` v2, auto-refresh tokens, session persisted to AsyncStorage. Reads `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `client/.env`. If the URL still contains the placeholder `YOUR_PROJECT_ID`, `reportService.ts` silently falls back to local AsyncStorage instead of erroring.

## Schema & policies (SQL migrations, `server/backend/` and `supabase/`)

- **`contributions`** — see [[Community Contributions]] for full column list.
- **`votes`** (`supabase_votes_system.sql`) — one row per user vote, drives the `update_contribution_vote_counts()` trigger (auto-verify at 5 confirms, auto-reject at 3 dismisses).
- **RLS** (`supabase_rls_policies.sql`) — contributions are publicly readable (everyone sees all non-expired alerts); inserts require auth and are scoped to the inserting user. Votes: authenticated users can insert and read their own votes.

## Edge functions

`supabase/functions/` hosts Deno edge functions, e.g. the AI verification function used by [[AI Verification]]. **Note**: `verify-report/index.ts` is currently deleted from the working tree even though the SQL migration and trigger system that depend on it are live — the function body currently only exists as a comment in `supabase_edge_function_ai_verify.sql`, so AI scoring is effectively not deployed until it's restored.

## Related
[[Architecture]] · [[Community Contributions]] · [[AI Verification]] · [[Auth]] · [[Mock Mode]]
