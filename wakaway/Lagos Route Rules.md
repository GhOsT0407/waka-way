
# Lagos Route Rules

`client/src/services/lagosRouteRules.ts` — a thin backward-compatibility shim. Its own header comment says core logic moved to [[Smart Routing Engine]].

## What it does (and doesn't)

All three exports are near-no-ops:
- `validateLagosConnection(from, to)` — stub, always returns `{ isValid: true }`
- `toSmartRouteMode(mode)` — stub, identity function
- `isOkadaAllowed(from, to)` — stub, **always returns `false`** as a "conservative default" placeholder comment — the real coordinate-based okada-ban bounding-box check lives inline inside [[Smart Routing Engine]], not here.

## Bug worth knowing about

[[Route Auto Fixer]] imports `isOkadaAllowed` from *this* file, not from [[Smart Routing Engine]]. Since it always returns `false`, every okada leg the auto-fixer evaluates gets treated as banned, regardless of actual location — the fixer's okada-downgrade logic effectively always triggers. See [[Service Duplication & Dead Code]].

## Used by

[[Route Auto Fixer]] only.

## Related
[[Architecture]] · [[Smart Routing Engine]] · [[Route Auto Fixer]] · [[Service Duplication & Dead Code]]
