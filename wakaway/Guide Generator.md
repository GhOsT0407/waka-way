
# Guide Generator

`client/src/services/guideGenerator.ts` — turns a `MultimodalRoute` (the [[Routing Engine (Legacy)]] output shape) into Lagos-flavored, Pidgin-inflected turn-by-turn `GuideStep[]`.

## What it does

Generates step text with "Owa!" shout nudges for danfo/BRT stops, arrival-proximity messages, and a plain-text route summary/formatted guide for UI display. Pairs specifically with `routingEngine.ts`'s route shape — it is **not** used by [[Smart Routing Engine]], which has its own inline English/Pidgin instruction generation per leg.

## Key exports

- `generateGuideSteps(route, options?)`
- `generateRouteSummary(route)`
- `generateFormattedGuide(route)`
- `generateArrivalNudge(distanceMeters, destinationName)`
- `generateOwaReminder(distanceMeters, destinationName, mode)`

## Dependencies

Imports `formatPrice` from [[Pricing Service]].

## Used by

- [[useRouting Hook]] — via `generateFormattedGuide`
- [[Geofencing Service]] — imports `generateOwaReminder`/`generateArrivalNudge`

## Related
[[Architecture]] · [[Routing Engine (Legacy)]] · [[Pricing Service]] · [[useRouting Hook]] · [[Geofencing Service]] · [[Service Duplication & Dead Code]]
