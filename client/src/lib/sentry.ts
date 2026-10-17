import * as Sentry from '@sentry/react-native';

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const sentryEnabled = !!dsn;

export function initSentry() {
  if (!dsn) {
    // No DSN configured (e.g. local dev) — skip silently rather than crash.
    return;
  }
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export { Sentry };
