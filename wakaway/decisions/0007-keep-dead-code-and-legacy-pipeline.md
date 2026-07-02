
# 0007 — Leave dead code and the legacy routing pipeline in place, documented only

**Date:** 2026-07-02
**Status:** Decided (deferred)

## Context

The service-level documentation pass surfaced confirmed dead code ([[Google Directions Service (Deprecated)]], [[Image Upload Service]]) and a fully unwired second routing pipeline ([[Routing Engine (Legacy)]] → [[Pricing Service]] → [[Guide Generator]], reachable only via [[useRouting Hook]], which nothing calls) alongside [[Geofencing Service]] (only called by that same unused hook).

## Decision

User chose to keep everything as-is rather than delete now. Deleting was offered as an option (both "delete confirmed-dead files" and "delete the whole legacy pipeline too") and declined for both.

## Why

The legacy pipeline plausibly represents unfinished work toward real turn-by-turn navigation with geofencing (arrival nudges, "Owa!" alerts) — deleting it could throw away a half-built feature rather than genuine cruft. Confirmed-dead files (Google Directions, Image Upload) were also left alone to keep this change set scoped to what was explicitly asked, not a unilateral cleanup pass.

## Affected files
None changed — this decision is "no action," recorded so a future session doesn't re-discover the same dead code and wonder whether it was evaluated.

## Related
[[Service Duplication & Dead Code]]
