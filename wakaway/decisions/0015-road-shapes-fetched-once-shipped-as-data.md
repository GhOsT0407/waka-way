# 0015 — Road shapes fetched once, shipped as data

**Date:** 2026-10-18
**Status:** Accepted. Amends [[0014-draw-legs-from-the-corridor-not-a-directions-api]].

## Context

0014 made the corridor's stop chain the only leg geometry: straight lines between consecutive stops. With the web map (MapLibre over OpenFreeMap tiles) riders now see those lines over real streets, and a straight line cutting across blocks and lagoon reads as wrong — the founder's own first reaction. 0014's objections were to a directions API *at ride time*: a secret, a network call per leg, the rider's position sent to a third party, and a car's road between the leg's ends rather than the bus's.

## Decision

Each hop between two consecutive corridor stops gets its shape once, ahead of time, from `client/scripts/build-corridor-shapes.mjs`, committed as `client/src/data/corridorShapes.ts` (encoded polylines keyed `fromStopId>toStopId`). `legGeometry()` concatenates the hops a leg rides. Nothing is fetched while a rider uses the app.

- **Roads** come from the public OSRM demo server, one request a second — the engine the corridor `hops` were measured with. Each end is snapped with a bearing (the bus's heading through that stop), so on a divided highway both hops at a stop use the same carriageway.
- **Rail** follows the mapped track: Overpass `railway=rail|subway` ways around Lagos, shortest path between the nodes nearest two stations.
- A road much longer than the measured hop (> 1.6×), or longer and doubling back on itself, is not kept; that hop stays straight. The script lists them.
- At draw time a short retrace where two hops meet (a pin a little off the road) is trimmed, but never so far that the stop's dot leaves the line.

## Why this keeps 0014's reasons

- Shapes are hop by hop between the corridor's own stops, so the line still agrees with the instructions by construction — it cannot invent a car's shortcut between a leg's ends.
- No secret, no runtime dependency, no third-party data flow: the privacy policy is unchanged.

## Consequences

- About 20 KB of data (gzip ~15 KB), shared by the app and the web map.
- Adding or moving a stop means rerunning the script (only new hops are fetched unless `--fresh`). `geometry.test.ts` fails on a shape whose key is no longer a hop, or whose ends are not on its stops.
- Walking legs from the rider's own position stay straight and dashed: their start is not known ahead of time.
- Shapes are © OpenStreetMap contributors (ODbL); the map's attribution already credits OSM.
