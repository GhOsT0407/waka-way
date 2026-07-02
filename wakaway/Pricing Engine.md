
# Pricing Engine

`client/src/services/pricingEngine.ts` — a static-class fare calculator (`TransportPricingEngine`), one of three independent pricing implementations in the codebase (see [[Service Duplication & Dead Code]]).

## What it does

Flat-rate model over a `LAGOS_RATES` table (base + per-km + minimum) for **danfo/keke/okada only** — no BRT, rail, or walk. Applies peak/rain/fuel-scarcity multipliers and its own internal peak-hour clock check. Produces `PriceRange` objects with a ±10% haggling band.

## Key exports

- `TransportPricingEngine` — static methods `calculateFare`, `getPriceRange`, `isPeakHour`, `getAllModePrices`
- `LAGOS_RATES`, `LAGOS_MULTIPLIERS`, `FARE_MODES` — config constants

## Dependencies

No imports from other services — fully self-contained (only a shared `TransportMode` type).

## Used by

`client/src/components/FareEstimateCard.tsx` only — a standalone fare-comparison widget, not the main route flow.

## Related
[[Architecture]] · [[Pricing Service]] · [[Smart Routing Engine]] · [[Service Duplication & Dead Code]]
