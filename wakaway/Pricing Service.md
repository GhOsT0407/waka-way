
# Pricing Service

`client/src/services/pricingService.ts` — the detailed, function-based pricing module that feeds [[Routing Engine (Legacy)]]. One of three independent pricing implementations (see [[Service Duplication & Dead Code]]).

## What it does

Computes per-mode `PriceEstimate` objects (walk/danfo/BRT/keke/okada/uber/bolt) with itemized base fare, distance fare, time surcharge, safety surcharge, min/max negotiable range, and Lagos-convention rounding (nearest ₦50/₦100). Also owns the canonical Haversine `calculateDistance` and night/peak time-window helpers that other services reuse.

## Key exports

- `calculatePrice(options)` — dispatches to per-mode calculators
- `calculateWalkPrice`, `calculateDanfoPrice`, `calculateBRTPrice`, `calculateKekePrice`, `calculateOkadaPrice`
- `calculateTotalPrice(prices[])`
- `calculateDistance(lat1, lng1, lat2, lng2)` — Haversine, reused elsewhere
- `isNightTime`, `isPeakHours`, `getTimeContext`
- `formatPrice(price)`
- `DEFAULT_PRICING_CONFIG`

## Dependencies

No cross-service imports (only shared types from `types/routing`).

## Used by

- [[Routing Engine (Legacy)]] — its pricing backend
- [[Guide Generator]] — uses `formatPrice`
- [[Geofencing Service]] — uses `calculateDistance`

## Related
[[Architecture]] · [[Routing Engine (Legacy)]] · [[Pricing Engine]] · [[Smart Routing Engine]] · [[Guide Generator]] · [[Geofencing Service]] · [[Service Duplication & Dead Code]]
