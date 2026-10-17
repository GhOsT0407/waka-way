
# AI Verification

Added in commit `8e4c466` ("implement AI verification for reports and add atomic confirm/dismiss RPC functions"). Scores the legitimacy of a [[Community Contributions|contribution]] using Gemini.

## Flow

1. Edge function `verify-report` (Deno, in [[Supabase Integration]]) receives `{ contribution_id }`.
2. Fetches the contribution row from Postgres (type, title, description, location, address).
3. Calls the Gemini API with a prompt asking it to analyze legitimacy of a Lagos traffic/security report.
4. Gemini returns: `is_valid` (boolean), `category` (real / spam / unclear), `confidence` (0–1), `sentiment` (urgent / neutral / low), `reason`.
5. The function writes `ai_score`, `ai_category`, `ai_sentiment` back onto the contribution row.
6. Requires `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` as Supabase secrets.

## Current status — incomplete

`supabase/functions/verify-report/index.ts` is deleted from the working tree (per `git status`). The implementation currently only exists as commented code in `supabase_edge_function_ai_verify.sql`. The `votes`/trigger side of this feature (auto-verify at 5 confirms, auto-reject at 3 dismisses — see [[Community Contributions]]) is live and independent of this edge function, but the Gemini-based `ai_score` will not populate until the function is redeployed.

## Related
[[Architecture]] · [[Community Contributions]] · [[Supabase Integration]]
