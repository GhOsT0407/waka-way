# 0013 — Explain the journey, not the map

**Date:** 2026-09-21
**Status:** Accepted

## Context

The [[Product Audit 2026-09-21]] found the engine right and the explanation missing. A newcomer typing "Lekki Phase 1" met: a mandatory online signup, a modal question that changed nothing, a card headed with one count-up number (the maximum fare), leg titles that were labels ("Danfo · Ikeja → Obalende") with the actual instruction in a 13 pt caption, a car-navigation map whose camera never followed, "You done reach!" up to 400 m from the door, and a post-trip question whose positive answer was thrown away. Community reports were free text that never touched a route, a fare, or the next rider. On any engine error the rider was shown a hard-coded mock route as if it were real.

The strategy's thesis is *Google Maps tells you where to go; WakaWay tells you how to move*. The app was still shaped like a map with a data card.

## Decision

1. **The journey is a numbered story, and one function tells it.** `services/explainJourney.ts` turns a `RouteOption` into steps — walk, board, get down, arrive — each carrying what a friend would add: where to stand (`boardAt`), what the place looks like (`landmark`), what the conductor shouts (`listenFor`), what to tell them (`say`), the fare and where that number comes from. The route screen (`components/journey/JourneyExplainer.tsx`), Wakaway Mode (`screens/NavigationScreen.tsx`) and the share text all read from it, so what the rider reads, follows and forwards is one story.

2. **The data model can hold local knowledge.** `GraphStop` gains `landmark` and `boardAt` (keyed by the terminal the bus is heading to, which is what carries "cross to the other side"). `RouteLeg` gains `terminalName`, `corridorId`, `fromStopId`/`toStopId`, `landmark`, `boardAt`, `alightLandmark` and `fareSource` ('table' | 'band' | 'free'). Only common-knowledge stops are seeded (Obalende, CMS, Ojuelegba, Oshodi, Ikeja, Yaba, Mile 2, Berger, Ketu, Lekki Phase 1); an empty field is honest, a guess is not.

3. **Every option says how hard it is.** `RouteOption.complexity` (easy / moderate / complex) with `complexityReasons` in the rider's words; `transfers`, `walkMins`. Cheapest / Fastest / Simplest are always assigned (an option can be all three). A "new to this area" preference moves the recommendation toward fewer changes when that costs ≤ 15 min and ≤ ₦300 — it moves the recommendation, never the options.

4. **Fares are ranges with a provenance.** The headline is `₦min – ₦max`, never a single animated figure. Each leg says whether the number is a LAMATA table, a distance estimate, or what riders paid: `corridor_signals` (new RPC) aggregates `fare_paid`/`fare_change` rows per corridor over seven days; ≥ 3 recent reports replace the estimate and read "14 riders paid ₦500–₦700 this week"; 1–2 read "reported"; none reads "estimate — tell us what you pay".

5. **Reports are keyed to the transport data.** `contributions` gains `corridor_id, stop_id, mode, fare_ngn, leg_from, leg_to, trip_key` and two confirmation kinds, `fare_paid` and `route_ok`, which never appear as pins (`get_active_contributions` excludes them) and roll up through `corridor_signals`. The post-trip question writes `route_ok` rows per ride on "Yes, e work", then asks one tap for the fare; the negative answers land in Report with the corridor and stops prefilled. Reports carry `expires_at` per kind.

6. **Real-time lives inside the journey.** `hooks/useLiveAlerts.ts` fetches active reports; `alertsAlongRoute` attaches them to the leg they touch, measured against the corridor's stop chain, not the chord between the leg's ends; the route screen shows them with freshness and "Still happening? Yes / No" through the vote RPC; `avoidPointsFrom` feeds security / danger / hazard / construction reports into the engine's incident reranking, which existed but had no caller.

7. **Finding a route needs no account.** `App.tsx` renders Main for everyone; Login/Signup are stack screens reached the moment an action needs them (save, report, vote) through `hooks/useRequireSignIn.ts`, and return to the caller on success. Sign-in is a request at the point of writing to the shared map, never a wall.

8. **No made-up routes.** `services/journeyPlanner.ts` is the one door into the engine; on failure it throws and Home says so. The mock data, the Django API client, the legacy engine, three fare models, two `RouteLeg` types, a second Supabase client, the Home map's own report/vote path and ~25 orphan components are out of the build — moved to `attic/client-src/` (48 files, ~7,000 lines) rather than deleted, so nothing is lost until the owner runs `git rm -r attic`.

9. **Wakaway Mode is instruction-first.** The step card is the screen; the map sits under it for bearings. Steps advance from GPS where that is possible (arrived at the stop; moved 300 m from the boarding stop; within the mode's alighting radius) and from a thumb where it is not; an approach cue with vibration fires 450 m before the stop; "N stops to go · next is X" comes from the corridor chain; the screen stays awake; ORS geometry falls back to the corridor's stop chain instead of drawing nothing; the last few hundred metres are said as a distance and a compass direction.

## Alternatives rejected

- **Keep the per-search "What transport dey near you?" modal.** Four of its five answers changed nothing in the engine. Replaced by one question, once ("New to this area?"), and an okada opt-in under Preferences.
- **Keep auth mandatory to protect RLS.** RLS only needs auth for writes; routing is on-device. Gating reads cost the North Star's first move.
- **Store fares in prose and parse later.** Structurally cannot roll up; a column costs nothing.
- **Delete the dead code outright.** Preferred, but the auto-mode classifier refused `git rm`; an attic is reversible and keeps the build clean.

## Consequences

- Positive: the route screen answers "what do I do?" without a map; a fare says what kind of number it is; a report a rider sends today changes what the next rider sees on that corridor; a newcomer gets fewer changes and more words; a failed plan is a message, not a fake trip. Tests: 79, up from 55.
- Negative: `boardAt`/`landmark` are seeded for ten stops only; the rest of the network shows the derived guidance (terminal, call, stop count, "the one after X"). `corridor_signals` needs riders before it says anything. Live-location sharing, the Explore tab and Gemini verification remain unbuilt on purpose.
- The attic must be emptied (`git rm -r attic`) once reviewed; until then it is dead weight in the repo, not in the app.

## Related
[[Product Audit 2026-09-21]] · [[0011-mode-choice-from-zones-and-distance]] · [[0012-route-over-corridors-not-between-hubs]] · [[0009-supabase-auth-over-firebase]] · [[0010-route-votes-through-the-rpc]] · [[Active Context]]
