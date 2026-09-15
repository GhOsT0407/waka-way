# 0009 — Use Supabase Auth, drop Firebase

**Date:** 2026-09-03
**Status:** Applied

## Context

The app authenticated with Firebase (`@react-native-firebase/auth`) while every table and RLS policy in Supabase was written for Supabase Auth — `user_id uuid REFERENCES auth.users(id)`, policies of the form `auth.uid() = user_id`, and a `handle_new_user` trigger on `auth.users`.

Nothing bridged the two. `AuthContext.tsx` never called `supabase.auth.*`, and `lib/supabase.ts` had no `accessToken` callback, so every Supabase request went out with the anon key and `auth.uid()` evaluated to NULL. Every RLS-protected write was rejected.

The failures were invisible: every data-layer function swallows its error into `console.warn`. Features looked implemented and were silently no-ops.

Confirmed against the live database — every table was empty, `auth.users` included:

| table | rows |
|---|---|
| profiles | 0 |
| contributions | 0 |
| votes | 0 |
| favorite_places | 0 |
| route_history | 0 |
| saved_routes | 0 |
| auth.users | 0 |

## Options

**A — Keep Firebase, migrate the schema.** Configure Supabase third-party auth to trust Firebase JWTs, then change `user_id` from `uuid` to `text` on five tables (Firebase UIDs are 28-char strings, not UUIDs), drop the FKs to `auth.users`, rewrite every RLS policy to compare `auth.jwt() ->> 'sub'`, and replace `handle_new_user` (it can never fire — Firebase creates no `auth.users` rows).

**B — Drop Firebase, use Supabase Auth.** Zero schema change; the schema already assumes it.

## Decision

**B.** The schema was built for Supabase Auth, so it needs no migration at all — and with every table empty there was no data to preserve either way.

Firebase's phone-OTP support was the one real argument for keeping it, but `sendOTP`/`verifyOTP` existed only in `AuthContext` — no screen called them. Only `LoginScreen` and `SignupScreen` exist, both email/password. Nothing was lost.

Bonus: this removes the missing `GoogleService-Info.plist` launch blocker entirely, since that file is Firebase-only.

## Changes

- `context/AuthContext.tsx` — rewritten on `supabase.auth`. Public interface kept identical (`login`, `signup`, `logout`, `updateProfile`, `user`, `isLoading`, `isAuthenticated`), so `LoginScreen`/`SignupScreen` and the other eight `useAuth()` consumers needed no edits. `firebaseUser` → `session`. Dropped the unused `sendOTP`/`verifyOTP` rather than porting dead code.
- `signup()` passes `full_name` via `options.data`, which lands in `raw_user_meta_data` — exactly what `handle_new_user` reads to populate `profiles`.
- `needsConfirmation` now derives from a real signal (`!data.session`) instead of always being `false`. `SignupScreen` already handled the flag.
- `App.tsx` — Django API token now comes from `session.access_token` instead of `firebaseUser.getIdToken()`.
- `app.config.js` — removed the `@react-native-firebase/app` plugin and `googleServicesFile`.
- `package.json` — removed `@react-native-firebase/app` and `@react-native-firebase/auth`.

`lib/supabase.ts` was already correct (AsyncStorage storage, `persistSession`, `autoRefreshToken`) and needed no change.

## Verification

- `tsc --noEmit` clean.
- No `firebase` references remain anywhere in `src/` or the config files.
- `on_auth_user_created` trigger confirmed present on `auth.users` in the live project.
- All RLS policies confirmed as `auth.uid() = user_id` / `auth.uid() = id` — these now resolve, because Supabase issues the JWT.
- **Still outstanding:** a real signup on device. Supabase rejects `@example.com`, and firing confirmation mail at a live domain to test wasn't worth it. Sign up in the app and confirm a `profiles` row appears and a favorite saves.

## Related
[[Active Context]] · [[0010-route-votes-through-the-rpc]] · [[Auth]] · [[Architecture]]
