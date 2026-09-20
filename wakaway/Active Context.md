
# Active Context

Session memory for ongoing development. Read this first when resuming work — it's the fastest way back into where things stand. Updated 2026-09-17.

## Latest session (2026-09-17) — SDK 57, calmer Home, mode accuracy

**Why:** the iPhone couldn't load the app — Expo Go on the App Store only ships the current SDK (57), the project was on 54, and an iOS dev build needs a paid Apple account. Upgraded instead.

- **Expo SDK 57 / RN 0.86 / React 19.2 / TS 6.** Sentry kept at 8.x (`expo.install.exclude`); `expo-module-scripts` removed (it dragged in an old `babel-preset-expo` that broke RN 0.86 codegen); `babel-preset-expo` declared directly. Map views use `PROVIDER_GOOGLE` on Android only — iOS is Apple Maps, which Expo Go supports and which needs no key. Commit `a8b716b` captured the first half; the working tree has the rest.
- **Home simplified** (the user felt the UI "looks complex" — it showed eleven things before a tap). Now: map, "Where you dey go?", bell, alert banner only when there is an alert, and a draggable sheet with Home/Work + 3 recents only once they exist. Mode chips, hardcoded popular routes, Live pill, breathing/pulsing animations and the swap button are gone. Search overlay extracted to `components/home/SearchOverlay.tsx`.
- **One sheet:** `components/ui/Sheet.tsx` on `@gorhom/bottom-sheet` v5 (Reanimated, UI-thread). Home uses it. **Route detail and Navigation still use their hand-rolled sheets** — convert next.
- **Mode accuracy** — see [[Routes Data Research]] and [[0011-mode-choice-from-zones-and-distance]]. LGA polygons from OSM (`data/lagosZones.ts`, `services/lagosZones.ts`) replace the circle okada check and add keke restriction; `connectorMode` rewritten (walk ≤ 1 km, keke ≤ 4 km where legal, okada only on request outside the ban, bus for the rest); 2026 fare bands; hub-chain silliness collapsed. 13 golden trip tests in `modeChoice.test.ts`; 28 tests total.

- **WakaWay Mobile canvas implemented** (claude.ai/design, artboard 1a). Tab bar is now Home · Live · Report · You. New: `LiveScreen` (community map, glyph pins from `utils/reportKinds.ts`, alert sheet with "Still dey happen / Don clear" votes), `ReportScreen` (chips, big ₦ amount, where, send → `contributions`; live `type` CHECK extended with `fare_change`, `route_down`, `stop_moved`, `new_route` via migration `contributions_add_report_types`). Rebuilt: Onboarding, TransportModeSelector, RouteDetail (full-screen, fare-led card with count-up, "Start waka · N min", heart saves), Navigation (yellow action pill, "You done reach!"), You (Trips/Saved/Places, dark-mode card; Home/Work now sync to the AsyncStorage keys Home reads). Deleted: ContributionScreen, NotificationsScreen, LiveAlertsFeed, QuickReportBar, AlertMarkers (all emoji-era, all unreferenced). `FareDisputeModal` / `FareEstimateCard` are now orphans — delete or rewire into Report.
- **Not in the canvas, so untouched:** Login, Signup, Preferences. 1b/1c/1d Home variants not built.

- **Corridor graph** — see [[0012-route-over-corridors-not-between-hubs]]. The user searched Yaba → Gbagada and was sent to Berger. Root cause: 165 of 209 stop coordinates couldn't be confirmed (Ikorodu Road shifted a stop north, Gbagada at Oworonshoki, rail 1–2 km off) and the engine drew bus legs geometrically between hubs. Now: `data/lagosRoutes.ts` (~130 checked stops, 2 BRT + 2 rail + ~30 danfo corridors) and `services/routeGraph.ts` (Dijkstra over stop×corridor states). Bus legs exist only along corridors; unreachable trips get "Ask at the park". Route card shows "via …" and stop counts. 43 tests.
- **Repo hygiene:** `.idea/`, `server/backend/db.sqlite3`, `.claude/settings*.json` untracked and ignored (anon key was in a saved command; rotate it when convenient).
- Search overlay now says *why* a search came back thin (no key / offline / rejected) instead of silently falling back to the 52 built-in landmarks.

- **Coverage pass:** corridors expanded to every LGA — 3 BRT, 2 rail, 24 LAMATA standard routes, ~40 danfo, 11 keke feeders; every hop road-measured with OSRM. 1,190/1,190 cross-Lagos test trips route on confirmed lines. **ORS key is dead** (API "disallowed") — Navigation's road geometry silently fails until replaced.

- **Competitor pass (2026-09-19):** studied Lara, Àjàlá, OrnaMap, RouteWise, Danfo.ng (Avigate/RoadPulse in the validation PDF aren't transport apps). Took: conductor call per leg (`calls` on corridors, terminal-name-doubled fallback) and instruction-style leg wording; "Simplest" option; one-line trip input "Ikeja to Lekki" (`TRIP_RE` in SearchOverlay, Home routes from the typed origin); share-as-text (`services/explainJourney.ts`, share button on Route options); "Did the route work?" on arrival/End → Report prefilled; Live pins ringed green/yellow/faded by `freshnessOf`, quiet-state pill; "Add this route" card when coverage runs out.

### Next, in order
1. **Commit the working tree** (SDK fix · Home/sheet · mode accuracy · design pass · corridors · competitor pass — six commits).
2. More corridors (Ikorodu hinterland, Ogba–Berger, Agege–Iyana-Ipaja, Ajah inner roads) and a review path for "Route no dey work" reports.
3. Login / Signup / Preferences on the new system (no canvas for them yet).
3. **Corridors:** bus legs are still geometric between hubs (Festac → Ikeja renders as one 16 km danfo). Plan in [[Routes Data Research]] §Implementation plan steps 3–5.
4. Validate the 209 stop coordinates against OSM (several hubs are 0.5–1.3 km off their namesakes).
5. Explore tab (local businesses, OSM-backed) replacing the redundant Search tab — user's ask, after the above.
6. Everything in the 2026-09-03 list below that is still open (live signup test, credentials, store assets).

---

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
