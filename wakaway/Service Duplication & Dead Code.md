
# Service Duplication & Dead Code

Findings from a full read-through of `client/src/services/` and `client/src/hooks/` (2026-07-02). Not a component — a running list of fragmentation and dead-code issues surfaced while documenting every service, kept here so they aren't buried inside individual notes.

## Two parallel routing pipelines

1. **Live pipeline**: [[Smart Routing Engine]] (synchronous, static `lagosStops` data, own inline pricing) → consumed directly by `HomeScreen`, `SearchScreen`, `NavigationScreen`, `RouteDetailScreen`, and `utils/smartRouter.ts` (which runs the output through [[Route Auto Fixer]] → [[Route Validator]] + [[Lagos Route Rules]]).
2. **Unwired pipeline**: [[Routing Engine (Legacy)]] (async, Supabase-backed) → [[Pricing Service]] → only reachable via [[useRouting Hook]], paired with [[Guide Generator]]. No screen or component calls `useRouting`/`useQuickRoute` — this entire chain, plus [[Geofencing Service]] (which only `useRouting` calls), currently has no path from the UI.

These two pipelines have **three incompatible `RouteLeg` type definitions** — [[Smart Routing Engine]]'s (full `Location` objects, `priceMin`/`priceMax`, `instruction`), `routingEngine.ts`'s (from `types/routing`), and [[Route Validator]]'s (string `from`/`to`, `cost`).

## Three independent pricing implementations

- [[Smart Routing Engine]]'s own inline `calcPrice` — feeds the routes real screens show.
- [[Pricing Service]] — feeds [[Routing Engine (Legacy)]] and [[Guide Generator]].
- [[Pricing Engine]] (`TransportPricingEngine` class) — feeds only `FareEstimateCard.tsx`.

None of the three call each other. A fare shown in one place (e.g. `FareEstimateCard`) can disagree with the fare shown in the actual route flow.

## Two divergent contribution voting paths

- [[useContributions Hook]]'s `vote()` calls the `vote_on_contribution` RPC (the one hardened for anon-vote-spam — see [[Supabase Integration]]).
- [[Supabase Data Service]]'s `voteOnContribution` does a separate direct table upsert + counter bump, bypassing that RPC (and its auth check) entirely.

Two different `Contribution` TypeScript interfaces also exist ([[useContributions Hook]]'s vs [[useRealtimeContributions Hook]]'s), with different fields.

## Known bug: `isOkadaAllowed` always false

[[Lagos Route Rules]]'s `isOkadaAllowed` stub always returns `false`, but [[Route Auto Fixer]] imports it (not the real coordinate-based check inside [[Smart Routing Engine]]) — so the auto-fixer's okada-downgrade path always fires regardless of actual location.

## Confirmed dead code (zero import sites found)

- [[Google Directions Service (Deprecated)]] — superseded by [[Directions Service]]; also non-functional (empty API key).
- [[Image Upload Service]] — including its only camera call site (`launchCameraAsync`); no "attach photo to report" UI exists despite `contributions.image_url` existing in the schema.
- [[useRouting Hook]] and everything only it depends on ([[Geofencing Service]] as currently wired).

## Why this matters for a soft launch

None of these are launch blockers on their own — the live pipeline works. But they're worth resolving before the codebase grows further: pick one routing pipeline and one pricing implementation, delete the dead code, and unify the two voting paths so the RPC-level auth fix actually covers all vote writes.

## Related
[[Architecture]] · [[Smart Routing Engine]] · [[Routing Engine (Legacy)]] · [[Pricing Service]] · [[Pricing Engine]] · [[useRouting Hook]] · [[useContributions Hook]] · [[useRealtimeContributions Hook]] · [[Supabase Data Service]] · [[Lagos Route Rules]] · [[Route Auto Fixer]]
