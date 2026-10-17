# Product Audit — 2026-09-21

Full audit of the app against the WakaWay product strategy (CLAUDE.md). Method: seven subsystem read-throughs (six completed, file:line-cited), plus a first-hand read of the engine, route screen, navigation screen, report flow and data model. Baseline: `chore/expo-sdk-57` with the uncommitted mode-mix diff; 55/55 tests green.

The one-line verdict: **the engine is right and the explanation is missing.** Corridors, legality, conductor calls, honest fallbacks and the golden-trip tests are real product assets. What sits on top of them still behaves like a map app with a data card, the trust layer is absent, and community reports are display-only — they never touch a route, a fare, or the next rider.

## Preserve (do not rewrite)

- Corridor graph + Dijkstra over (stop, corridor) states, walk-links, six search variants, mode-signature dedup — `services/routeGraph.ts`, ADR 0012.
- Legality before preference from LGA polygons — `services/lagosZones.ts`, ADR 0011.
- Conductor call per leg, via-stops, per-corridor confidence, "Ask at the park" instead of an invented line — `smartRoutingService.ts:419-457, 507-518`.
- Recommendation rules (cheaper within 10 min wins; BRT/rail within 10 min & ₦150 wins; confirmed > ad-hoc > unverified) — `smartRoutingService.ts:625-658`.
- 55 tests, 28 of them golden trips — `services/__tests__/`.
- One-line trip input "Ikeja to Lekki" flowing end-to-end — `SearchOverlay.tsx:57`, `HomeScreen.tsx:172-218`.
- Local-first place search with an explicit failure taxonomy — `placesService.ts:131-194`.
- Post-journey "Did the route work?" deep-linking into a prefilled Report — `NavigationScreen.tsx:249-272`, `ReportScreen.tsx:41-59`.
- `utils/reportKinds.ts` as the single presentation source for report kinds; `vote_on_contribution` RPC (ADR 0001/0010); `Sheet.tsx`; the calm one-question Home; the pidgin voice.

## Ranked contradictions

Ranked by impact on the North Star ("can someone who has never made the journey complete it without asking a human?"), foundations first.

### P0 — trust and foundation

**1. On any engine error the rider is shown a fabricated route.** `services/api.ts:120-123` returns `MOCK_ROUTES.search_results[0]` — a hard-coded Oshodi → Lekki Phase 1, ₦1200, "Take BRT to CMS" — with `smartRoute: null`; `HomeScreen.tsx:236` only checks `legacyRoute` and navigates. RouteDetail renders it for whatever the rider typed. `USE_MOCK_DATA = true` (`constants.ts:85`) is the shipped default, `searchRoutes` sleeps 400 ms for nothing, and a "legacy" route shape is still threaded through navigation params and save/history. Contradicts §21 "never invent routes".

**2. A first-time user must create an account online before typing a destination.** `App.tsx:168-202` renders Main only when `isAuthenticated`; no guest path. Onboarding slide 3 promises "Works with no data". The engine needs no user (`api.ts:92-124`). This is the single largest install → first-route friction and contradicts the North Star's opening move (open app → type "Lekki Phase 1").

**3. The data model has nowhere to put local knowledge.** `GraphStop` (`data/lagosRoutes.ts:28-35`) is id/name/coords/source; `Corridor` has `calls` keyed by terminal only (9 of ~80 corridors set it). `RouteLeg` cannot carry where to stand, what to look for, which side to cross to, or what happens after getting down. §4/§7/§13/§15 are structurally impossible until the model can express them. Absent, not unwired.

**4. Community reports are free text and never reach routing, fares, or the next rider.** `ReportScreen.tsx:109-115` stores the fare inside the title string and the route as `address: 'A → B'`; no corridor id, stop id, mode or numeric fare column. `avoidPoints` is never supplied by any caller (`HomeScreen.tsx:228-235`), so the incident-avoidance block at `smartRoutingService.ts:619-677` is unreachable. "Yes, e work" writes nothing (`NavigationScreen.tsx:267`). The flywheel (§11) and the trust states (§10) cannot exist on this schema.

### P0 — journey clarity

**5. The route screen is a data card, not an explanation.** `SmartRouteOptions.tsx:132-149` headlines a single count-up figure — the **max** fare — with the range demoted to "from ₦X"; leg titles are labels (`Danfo · Ojuelegba → CMS`, `:253`) while the friend-style `instruction` ("enter the danfo calling …, tell the conductor …") is never rendered and the pidgin version is a 13 pt caption. No step says GET DOWN, CROSS OVER or what to look for. Transfers are not counted anywhere on the selected card. `recommendationReason` and `comparisonText` are computed and never shown. Rail legs render as lowercase `rail` on a grey badge (no `rail` case in `modeCfg`, `:35-44`); BRT legs are told to "Listen for 'CMS CMS!'" (`smartRoutingService.ts:435`) on a ticketed, queued service. No difficulty, no "what to expect", no fare freshness.

**6. No journey difficulty; "Simplest" is a tag, not a choice.** `isSimplest` is only set when it differs from cheapest/fastest (`smartRoutingService.ts:596-604`); nothing rates a route Easy/Moderate/Complex; the recommendation never trades minutes for fewer changes. §6.

**7. The per-search transport question is ignored four times out of five.** `TransportModeSelector` asks "What transport dey near you?" on every search; `connectorMode` branches only on `preferred === 'okada'` (`smartRoutingService.ts:357`). Keke/Danfo/BRT/Walk answers change nothing. A question before every route that does nothing is pure friction (§12).

### P1 — journey mode

**8. Navigation is a car-nav map, and the camera does not even follow.** `NavigationScreen.tsx`: full-screen map with a two-line banner; the `watchPositionAsync` callback captures `navMode = 'overview'` from first render (`:219`) so `animateCamera` never runs and Recenter is a no-op; `turnIcon` keyword-matches "turn left" (`:86-98`) and always yields arrow-up; speed in km/h and a static ETA; one 80 m radius for every mode (`:209`); no approach cue, no vibration, no "get down in N stops" (`:385`); the top-left back arrow ends the journey without the feedback question (`:376`); when the (dead) ORS key returns nothing, no line is drawn and nothing is said (`:303`); arrival is "You done reach!" with no last-500 m step. §15, §13, §3.

**9. Real-time intelligence is a separate tab, not part of the journey.** Live pins exist (`CommunityMapView.tsx`), freshness rings exist (`reportKinds.ts:52-64`), but nothing on RouteDetail or Navigation says "Heavy traffic at Ojota, reported 8 min ago, 17 confirmed, +25–40 min, still happening?". Home's "nearby" banner is citywide and filtered to kinds a rider cannot file (`useRealtimeContributions.ts:150`). §9.

### P2

**10. Contribution effort and positive confirmations.** The post-journey prompt is one tap to a failure report (good) but "Fare was different" prefills the NEW FARE field with the OLD estimate (`ReportScreen.tsx:42`), positive answers are discarded, and there is no "How much did you pay? ₦500 [Confirm]" one-tap. §12.

**11. Two of everything.** Two live report-writing paths (Report tab vs Home map FAB via `reportService.ts`), two live vote paths (RPC vs `reportService.confirmReport` SELECT-then-UPDATE on legacy columns, `MapView.tsx:133`), three fare models, three `RouteLeg` types, two `Contribution` types, a second unpersisted Supabase client with zero importers, a 772-line legacy engine, and ~25 orphan components/services. ADR 0007 deferred this; it now actively conflicts (the mock fallback is live, the second vote path bypasses the auth-hardened RPC). Roughly 7,000 lines with no path from the UI.

**12. Home and Live hygiene.** Home reads recents/Home/Work once at mount (`HomeScreen.tsx:81-86`) so changes on You/Preferences do not appear; the origin is `MOCK_LOCATION` until GPS returns, with no timeout and no refresh on search (`:45,:146`); developer copy ships to riders ("start Metro from the client folder", `SearchOverlay.tsx:213`); reports never expire (`ReportScreen.tsx:109` sets no `expires_at`); "N REPORTS NEAR YOU" is a citywide count; `useContributions` resubscribes in a loop from inline callbacks (`useContributions.ts:400`); a vote failure is silent.

**13. Design polish.** No `rail` colour token; badge text at 9–11 pt; no `maxFontSizeMultiplier` anywhere; YouScreen has 7 pressables and 1 label; AlertBottomSheet buttons unlabelled.

## Not now

Live location sharing / trusted contacts (after journey mode works); Gemini verification; the Explore tab; uber/bolt branches (delete); offline tiles; photo attachments; nationwide coverage.

## North Star gap, concretely

Today a newcomer typing "Lekki Phase 1" gets: mandatory signup → a modal question that changes nothing → a card headed "₦1,500" → "Danfo · Ikeja Under Bridge → Obalende" with a small caption → a map with a two-line banner and no get-down cue → "You done reach!" up to 400 m from the door → a question whose positive answer is thrown away. The route underneath is correct.

## Plan (foundations → clarity → journey mode → real-time → flywheel)

See [[Active Context]] for the running state. Batches: A foundation (1, 2, 11, 3, 4) · B clarity (5, 6, 7) · C journey mode (8) · D real-time + flywheel (9, 10) · E hygiene (12, 13).

## Related
[[Active Context]] · [[0011-mode-choice-from-zones-and-distance]] · [[0012-route-over-corridors-not-between-hubs]] · [[Service Duplication & Dead Code]] · [[Smart Routing Engine]]
