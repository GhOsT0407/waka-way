
# Testing

Client: `jest-expo` (pinned to `54.0.17` to match `expo ~54.0.35` — the latest `jest-expo` requires React 19.2, this project is on 19.1.0) + `jest`. Config at `client/jest.config.js`; run via `npm test` in `client/`. Backend: still zero real test coverage (`server/backend/core/tests.py` is the default empty Django stub).

## What's covered

`client/src/services/__tests__/smartRoutingService.test.ts` — 14 tests against [[Smart Routing Engine]], chosen as the starting point since it's the most critical, pure-function-heavy code with the highest bug impact:

- `calculateDistance` — Haversine correctness (identity, known real-world distance, symmetry)
- `formatPrice` — free/fixed/range formatting
- `classifyTrip` — all four trip-band boundaries (micro/short/medium/long)
- `calculateSmartRoute` — structural validity of a real long-distance route (Ikorodu → TBS), a micro walkable trip, the price/time comparison block, and — notably — a regression test asserting **no route ever includes an okada leg between two points inside the Lagos metro okada-ban zone**, exercising the real (correct) bounding-box check inline in `smartRoutingService.ts`, as opposed to the always-`false` stub in [[Lagos Route Rules]].

## Not covered

Everything else in [[Service Duplication & Dead Code]]'s three pricing implementations and two routing pipelines, [[Community Contributions]] voting/realtime logic, screens/components, and the Django backend. This was scoped as a first slice, not comprehensive coverage — see [[Architecture]] for the full punch list.

## Related
[[Architecture]] · [[Smart Routing Engine]] · [[Service Duplication & Dead Code]]
