
# Active Context

Session memory for ongoing development. Read this first when resuming work — it's the fastest way back into where things stand. Updated 2026-09-03.

## Latest session (2026-09-03) — auth was broken end to end; fixed

Started as a plan to migrate off Supabase onto the Django backend. **That migration was scrapped** — investigation showed the case for it was weak (data is plain Postgres, auth was never Supabase Auth, free tier covers current usage) and the biggest phase would have meant re-implementing RLS by hand in view code. Decided to stay on Supabase for both this and soko, and fix what's actually broken instead.

**The real bug:** the app authenticated with Firebase while every RLS policy expected Supabase Auth, so `auth.uid()` was NULL on every request and *every* protected write was being rejected — silently, since the data layer swallows errors into `console.warn`. Confirmed against the live database: every table empty, `auth.users` included. Nothing has ever successfully saved.

Fixed by dropping Firebase for Supabase Auth — see [[0009-supabase-auth-over-firebase]]. Zero schema change needed, and it removes the `GoogleService-Info.plist` launch blocker.

Also fixed a vote path that queried `contribution_votes`, **a table that doesn't exist in the live database** — see [[0010-route-votes-through-the-rpc]].

Both Supabase projects had also been **paused** (free tier pauses after ~7 days idle) — restored.

### Next, in order
1. **Sign up on a real device.** The one thing not yet verified — confirm a `profiles` row is created and a favorite/route saves. Everything else typechecks but is unproven against a live signup.
2. **Re-test what "works" now.** Features assumed broken for other reasons may just have been auth. Re-check before debugging anything else.
3. Retire `useRealtimeContributions.ts` (the third vote path, still bypassing the RPC — [[0010-route-votes-through-the-rpc]]).
4. Delete the stale `.sql` files — three drifted `contributions` definitions and two votes-table designs, none matching the live schema. The live DB is the source of truth now.
5. Remaining credentials: `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `EXPO_PUBLIC_SENTRY_DSN`. (`GoogleService-Info.plist` no longer needed.)

---

## Previous session (2026-07-02)

## What we were working on

Soft-launch readiness for WakaWay. Started from "what's left for the soft launch," did a full audit (local repo + live Supabase project), then worked the punch list most-important-first, and along the way built out full service-level documentation for the whole `client/src/services/` + hooks layer.

## What we finished

- **Full architecture documentation** — [[Architecture]] hub note + one note per major service/hook (21 notes) + [[Service Duplication & Dead Code]] capturing fragmentation findings (two parallel routing pipelines, three pricing implementations, two divergent voting paths).
- **Closed a real security hole** — `vote_on_contribution` allowed unauthenticated vote-spam (see [[0001-require-auth-for-vote-rpc]]). Also hardened `handle_new_user` grants and closed 3 `search_path` lint warnings.
- **Django production hardening** — HTTPS/cookie/HSTS settings added, gated behind `DEBUG=False` (see [[0003-django-production-hardening]]).
- **iOS camera permission strings** added defensively for the linked (but currently unwired) `expo-image-picker` dependency.
- **Recreated and deployed** the AI-verification edge function (`verify-report`) — live on Supabase, `verify_jwt: true`, but returns "AI service not configured" until `GEMINI_API_KEY` is set.
- **Sentry crash reporting** scaffolded — `initSentry()`, `ErrorBoundary` reporting, config plugin — inactive until `EXPO_PUBLIC_SENTRY_DSN` is set.
- **Jest test infra** stood up from scratch (`jest-expo` pinned to `54.0.17`) with 14 passing tests against [[Smart Routing Engine]] core logic.
- **Committed** the 3 previously-uncommitted components (`FareDisputeModal`, `LiveAlertsFeed`, `QuickReportBar`) — commit `be56f76`.
- **`client/.env.example`** added, documenting every required var including the two still-missing ones.
- Established this `decisions/` folder convention — see [[0008-commit-only-the-flagged-components]] for the most recent entry, or browse the folder for the full backfilled set from this session.

## What's next

Roughly in priority order:
1. **Supply the two credential blockers** (see below) so native builds actually work.
2. **Set `GEMINI_API_KEY`** as a Supabase secret to activate AI verification.
3. **Set `EXPO_PUBLIC_SENTRY_DSN`** to activate crash reporting.
4. Expand test coverage beyond [[Smart Routing Engine]] — [[Testing]] has the current-vs-not-covered breakdown.
5. Decide whether/when to resolve [[Service Duplication & Dead Code]] (three pricing implementations, two routing pipelines) — explicitly deferred this session, see [[0007-keep-dead-code-and-legacy-pipeline]].
6. Review and commit (or discard) the large pre-existing uncommitted diff in the working tree — `MapView.tsx`, `ThemeContext.tsx`, several screens, and some deleted files were already modified before this session started and were deliberately left untouched (see [[0008-commit-only-the-flagged-components]]).
7. Store screenshots / listing copy / Terms of Service — not started, needed before actual store submission.

## What's blocked (need input only you can provide)

- **`GOOGLE_MAPS_API_KEY`** — unset anywhere; native maps won't render in a real build. Needs a key from Google Cloud console.
- **iOS `GoogleService-Info.plist`** — missing entirely; iOS Firebase auth won't build without it. Needs to come from Firebase console.
- **`GEMINI_API_KEY`** — needed to activate the deployed AI-verification edge function.
- **`EXPO_PUBLIC_SENTRY_DSN`** — needed to activate crash reporting.
- **Sentry source-map upload** (readable native stack traces) — needs `SENTRY_AUTH_TOKEN` + org/project slugs, deferred until basic DSN wiring is confirmed working.

## Related
[[Architecture]] · [[Service Duplication & Dead Code]] · [[Testing]] · [[Crash Reporting]] · [[AI Verification]]
