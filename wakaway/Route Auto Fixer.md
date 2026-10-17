
# Route Auto Fixer

`client/src/services/routeAutoFixer.ts` — post-processes a leg array to auto-correct invalid mode/distance combinations.

## What it does

Downgrades banned okada legs to keke, replaces legs that fail [[Route Validator]]'s `isValidLeg` check with a distance/position-appropriate fallback mode, and strips useless 0km walk legs. Operates on `routeValidator.ts`'s `RouteLeg` shape (string `from`/`to`), a third, distinct `RouteLeg` type from the ones in [[Smart Routing Engine]] and [[Routing Engine (Legacy)]] — see [[Service Duplication & Dead Code]].

## Key exports

- `validateRoute(legs: RouteLeg[]): RouteLeg[]` — the only export

## Dependencies

- `isValidLeg` from [[Route Validator]]
- `isOkadaAllowed` from [[Lagos Route Rules]] — **always `false`**, so the okada-downgrade path always fires (see that note for the bug)

## Used by

`client/src/utils/smartRouter.ts` — runs as a post-processing pass on [[Smart Routing Engine]] output.

## Related
[[Architecture]] · [[Route Validator]] · [[Lagos Route Rules]] · [[Smart Routing Engine]] · [[Service Duplication & Dead Code]]
