
# 0006 — Scope the first test coverage to Smart Routing Engine only

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

Zero test coverage existed anywhere in the repo. Options presented were: unit-test the routing core, write golden-path integration tests (auth → search → route → report → vote), or skip testing for now.

## Decision

User chose to start with [[Smart Routing Engine]] core logic. Set up `jest-expo` (pinned to `54.0.17` — latest wanted React 19.2, project is on 19.1.0) and wrote 14 tests covering `calculateDistance`, `formatPrice`, `classifyTrip`, and `calculateSmartRoute` (including a regression test for the okada-ban zone).

## Why

Pure-function-heavy, highest bug impact, easiest to test in isolation without mocking Supabase/Firebase/native modules — the best ratio of test value to setup cost as a first slice. Golden-path integration tests would need auth/Supabase test fixtures, a much bigger lift to stand up.

## Not done
Everything else — the other two pricing implementations, the unwired routing pipeline, [[Community Contributions]] voting/realtime, screens, backend. See [[Testing]] for current coverage.

## Affected files
- `client/jest.config.js` (new)
- `client/package.json` (added `test` script + `jest`/`jest-expo`/`@types/jest` devDependencies)
- `client/src/services/__tests__/smartRoutingService.test.ts` (new)
- [[Testing]]
