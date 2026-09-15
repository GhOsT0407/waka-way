
# 0002 — Revoke public EXECUTE on `handle_new_user`

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

`handle_new_user` is a trigger function (fires on `auth.users` insert to create a matching `profiles` row) but was, like `vote_on_contribution`, flagged as callable by `anon`/`authenticated` via `/rest/v1/rpc/handle_new_user`.

## Decision

Revoked `EXECUTE` from `anon`, `authenticated`, and `PUBLIC`. Left it grantable to `postgres`/`service_role` (the trigger still fires correctly — trigger invocation isn't gated by role-level `EXECUTE` grants the same way direct RPC calls are).

## Why

A trigger function should never be directly callable as a public RPC — calling it outside a trigger context would fail anyway (it references `NEW`, which only exists inside a trigger), but leaving the grant in place was still an unnecessary exposed surface flagged by the linter. No functional risk either way, but no reason to leave it open.

## Affected files
- Supabase migration (applied directly via MCP — see [[Supabase Integration]])
- [[Auth]]
