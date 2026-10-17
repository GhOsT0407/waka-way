
# 0001 — Require authentication inside `vote_on_contribution`

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

Supabase security advisor flagged `vote_on_contribution` as a `SECURITY DEFINER` function callable by `anon`. Inspecting the function body showed it looked up an existing vote via `user_id = auth.uid()`. For unauthenticated callers `auth.uid()` is `NULL`, so the lookup never matched, and every anon call fell through to the "insert new vote" branch with `user_id = NULL` (the column allowed nulls) — unlimited free votes, no account needed, directly undermining the auto-verify (5 confirms) / auto-reject (3 dismisses) trust mechanism.

## Decision

Added an explicit `if auth.uid() is null then raise exception` guard at the top of the function, revoked `EXECUTE` from `anon` and `PUBLIC` (kept for `authenticated`), and added `NOT NULL` on `votes.user_id` as defense in depth.

## Why

RLS policies don't apply to `SECURITY DEFINER` functions — they bypass RLS entirely by design, so the fix has to live inside the function itself, not in a table policy. Belt-and-suspenders: the internal check stops it even if grants are ever misconfigured again; the revoke stops PostgREST from exposing the RPC to anon at all.

## Verified

Confirmed via `get_advisors` (security) and a direct `information_schema.routine_privileges` query before/after — `anon` no longer appears for this function.

## Affected files
- Supabase migration (applied directly via MCP, not a local `.sql` file — see [[Supabase Integration]])
- [[useContributions Hook]] — the client caller of this RPC
- [[Community Contributions]]
