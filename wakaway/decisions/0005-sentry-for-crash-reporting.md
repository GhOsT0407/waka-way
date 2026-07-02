
# 0005 — Sentry for crash reporting, DSN-optional at init

**Date:** 2026-07-02
**Status:** Decided, applied (inactive until DSN supplied)

## Context

App had zero crash reporting — `ErrorBoundary.componentDidCatch` only did `console.error`. Choice was between Sentry and Firebase Crashlytics (Firebase already wired for [[Auth]], so Crashlytics would need no new account).

## Decision

User chose Sentry. Implemented `initSentry()` in `client/src/lib/sentry.ts`, called at the top of `App.tsx`; wired `Sentry.captureException` into `ErrorBoundary`; added the `@sentry/react-native/expo` config plugin. `initSentry()` is a deliberate no-op when `EXPO_PUBLIC_SENTRY_DSN` is unset, so local dev without a DSN doesn't break.

## Why

Sentry is framework-agnostic and has mature Expo support; user's explicit preference over Crashlytics despite the latter needing no new account. Made the DSN optional-at-runtime rather than required, since I can't generate a DSN myself — this way the scaffolding ships now and goes live the moment a DSN is added, instead of blocking on it.

## Not done
Source-map upload for readable native stack traces needs `SENTRY_AUTH_TOKEN` + org/project slugs — deferred, needs the user's Sentry account details.

## Affected files
- `client/src/lib/sentry.ts` (new)
- `client/src/App.tsx`
- `client/src/components/ui/ErrorBoundary.tsx`
- `client/app.config.js`
- `client/.env.example`
- [[Crash Reporting]]
