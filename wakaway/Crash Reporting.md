
# Crash Reporting

Sentry (`@sentry/react-native`), wired 2026-07-02. Previously the app had no crash reporting at all — [[Architecture]] "Current state / open threads" flagged this during the soft-launch audit.

## Setup

- `client/src/lib/sentry.ts` — `initSentry()` calls `Sentry.init()` only if `EXPO_PUBLIC_SENTRY_DSN` is set; skips silently otherwise so local dev without a DSN doesn't crash.
- Called at the top of `App.tsx`, alongside `SplashScreen.preventAutoHideAsync()`.
- `ErrorBoundary.tsx`'s `componentDidCatch` now calls `Sentry.captureException` in addition to its existing `console.error`, so React render-tree crashes get reported, not just logged locally.
- `@sentry/react-native/expo` config plugin added to `app.config.js` for native-side crash capture (iOS/Android native crashes, not just JS).

## Status — needs your DSN

`EXPO_PUBLIC_SENTRY_DSN` is unset in `client/.env.example` / `client/.env`. Until you create a Sentry project and add the DSN, `initSentry()` is a no-op and nothing is actually reported — the scaffolding is in place but inactive.

## Not set up

Source-map upload for readable native stack traces (`sentry-expo-upload-sourcemaps` / EAS build hooks) requires `SENTRY_AUTH_TOKEN` + org/project slugs — not configured, since it needs your Sentry account details. Worth adding once the basic DSN wiring is confirmed working.

## Related
[[Architecture]] · [[Navigation & Screens]]
