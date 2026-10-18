/**
 * Road shapes for every corridor hop, fetched once and committed as data.
 *
 *   node scripts/build-corridor-shapes.mjs            (from client/)
 *
 * Writes src/data/corridorShapes.ts: for each pair of consecutive stops on a
 * road corridor, the road between them as an encoded polyline. The map draws
 * these instead of straight lines (ADR 0015). Nothing is fetched while a
 * rider uses the app, so no position leaves the device (ADR 0014).
 *
 * Road shapes come from the public OSRM demo server — the same engine the
 * corridor `hops` were measured with. Its policy allows light use at one
 * request a second, which this keeps to. Rail shapes follow the OSM track
 * itself, fetched once from Overpass. Rerun after adding or moving stops;
 * pairs already in the file are reused unless --fresh is passed.
 *
 * A hop whose road comes back much longer than the measured hop (a U-turn
 * round a divided highway, a stop snapped to the wrong road) is left out, so
 * the map falls back to a straight line there. Those are listed at the end.
 *
 * Needs Node 22.18+ (reads the TypeScript data file directly).
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CORRIDORS, STOP_BY_ID } from '../src/data/lagosRoutes.ts';

const OUT = fileURLToPath(new URL('../src/data/corridorShapes.ts', import.meta.url));
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const fresh = process.argv.includes('--fresh');

/** Longer than this × the measured hop, and the road is not the bus's road. */
const MAX_STRETCH = 1.6;
/** …unless it never doubles back, in which case up to this. */
const LOOSE_STRETCH = 2.5;
/** Douglas–Peucker tolerance in degrees (~5 m): drops points no one can see. */
const TOLERANCE = 0.00005;

// ─── Encoded polylines (Google's format, precision 5) ───────────────────────

function decode(str) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lng += d;
    }
    out.push([lat / 1e5, lng / 1e5]);
  }
  return out;
}

function encode(points) {
  let out = '', pLat = 0, pLng = 0;
  const num = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lat, lng] of points) {
    const a = Math.round(lat * 1e5), b = Math.round(lng * 1e5);
    out += num(a - pLat) + num(b - pLng);
    pLat = a; pLng = b;
  }
  return out;
}

function simplify(points) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    const [ay, ax] = points[s], [by, bx] = points[e];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    let worst = -1, at = -1;
    for (let i = s + 1; i < e; i++) {
      const [py, px] = points[i];
      const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > worst) { worst = d; at = i; }
    }
    if (worst > TOLERANCE) { keep[at] = 1; stack.push([s, at], [at, e]); }
  }
  return points.filter((_, i) => keep[i]);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Compass heading from one point to another, 0–359. */
function heading(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude));
  const x = Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude))
    - Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

/**
 * The road from a to b. With `headings`, each end is snapped only to a road
 * running that way (±60°): on a divided highway that is the carriageway the
 * bus is on, so this hop and the next meet at the same point instead of on
 * opposite sides of the divider with a U-turn between.
 */
async function road(a, b, headings) {
  const bias = headings ? `&bearings=${headings[0]},60;${headings[1]},60&radiuses=150;150` : '';
  const url = `${OSRM}/${a.longitude},${a.latitude};${b.longitude},${b.latitude}?overview=full&geometries=polyline${bias}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'WakaWay corridor shapes (one-off build script)' } });
    if (res.status === 429 || res.status >= 500) { await sleep(5000 * (attempt + 1)); continue; }
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.length) return null;
    return { km: json.routes[0].distance / 1000, points: decode(json.routes[0].geometry) };
  }
  return null;
}

/**
 * True when the road comes back within 60 m of somewhere it passed more than
 * 500 m of road earlier — a U-turn round a divider, or a loop round a block.
 */
function doublesBack(points) {
  const at = (p) => ({ latitude: p[0], longitude: p[1] });
  const along = [0];
  for (let i = 1; i < points.length; i++) along.push(along[i - 1] + haversineKm(at(points[i - 1]), at(points[i])));
  for (let j = 0; j < points.length; j++) {
    for (let i = 0; i < j && along[j] - along[i] > 0.5; i++) {
      if (haversineKm(at(points[i]), at(points[j])) < 0.06) return true;
    }
  }
  return false;
}

/** Where the nearest few distinct roads pass a stop, within a short walk of it. */
async function snaps(s) {
  const url = `${OSRM.replace('/route/', '/nearest/')}/${s.longitude},${s.latitude}?number=3`;
  const res = await fetch(url, { headers: { 'User-Agent': 'WakaWay corridor shapes (one-off build script)' } });
  await sleep(1100);
  const json = res.ok ? await res.json() : null;
  const out = (json?.waypoints ?? [])
    .filter((w) => w.distance <= 60)
    .map((w) => ({ latitude: w.location[1], longitude: w.location[0] }));
  return out.length ? out : [s];
}

// ─── Rail: the tracks from OpenStreetMap ────────────────────────────────────

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
/** Mainline track around Lagos: Blue Line (subway) and Red Line (rail). Yards and spurs only mislead. */
const TRACK_QUERY = '[out:json][timeout:120];way["railway"~"^(rail|light_rail|subway)$"](6.40,3.20,6.75,3.50);out geom;';
/** Parallel tracks of a double line meet in OSM only at crossovers; join any within this. */
const JOIN_KM = 0.04;

function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Every mainline track node, with edges along the track and across to a parallel one. */
async function railNetwork() {
  let ways = null;
  for (const url of OVERPASS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'WakaWay corridor shapes (one-off build script)', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(TRACK_QUERY)}`,
      });
      if (res.ok) { ways = (await res.json()).elements; break; }
    } catch { /* try the next server */ }
  }
  if (!ways) return null;

  const pos = new Map(), adj = new Map();
  const edge = (u, v, d) => { adj.get(u).push([v, d]); adj.get(v).push([u, d]); };
  for (const w of ways) {
    if (/yard|industrial/.test(`${w.tags.service ?? ''} ${w.tags.usage ?? ''}`)) continue;
    w.nodes.forEach((id, i) => {
      pos.set(id, { latitude: w.geometry[i].lat, longitude: w.geometry[i].lon, subway: w.tags.railway !== 'rail' });
      if (!adj.has(id)) adj.set(id, []);
      if (i) edge(w.nodes[i - 1], id, haversineKm(pos.get(w.nodes[i - 1]), pos.get(id)));
    });
  }
  const ids = [...pos.keys()];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const p = pos.get(ids[i]), q = pos.get(ids[j]);
      if (p.subway !== q.subway) continue; // the Blue Line never joins the Red
      const d = haversineKm(p, q);
      // Weighted up, so a jump between tracks is taken only to avoid a detour.
      if (d < JOIN_KM) edge(ids[i], ids[j], d * 3);
    }
  }
  return { pos, adj };
}

/**
 * Shortest way along the track between the nodes nearest two stations. The
 * Blue Line is mapped in OSM as railway=subway, the Red Line as railway=rail.
 */
function trackBetween({ pos, adj }, a, b, subway) {
  // Every track node within reach of a station, with the distance to it. The
  // nearest one alone can be a siding that never reaches the main line.
  const near = (s) => {
    const out = new Map();
    for (const [id, p] of pos) {
      if (p.subway !== subway) continue;
      const d = haversineKm(p, s);
      if (d < 0.3) out.set(id, d);
    }
    return out;
  };
  const starts = near(a), ends = near(b);
  if (!starts.size || !ends.size) return null;

  // Dijkstra from all the starts at once; the first end settled, counting
  // the step off the track to the station, is the shortest way.
  const dist = new Map(starts), prev = new Map(), done = new Set();
  const queue = [...starts].map(([id, d]) => [d, id]);
  let best = null;
  while (queue.length) {
    queue.sort((x, y) => x[0] - y[0]);
    const [d, u] = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    if (best && d >= best.km) break;
    if (ends.has(u) && (!best || d + ends.get(u) < best.km)) best = { km: d + ends.get(u), at: u };
    for (const [v, w] of adj.get(u)) {
      if (d + w < (dist.get(v) ?? Infinity)) { dist.set(v, d + w); prev.set(v, u); queue.push([d + w, v]); }
    }
  }
  if (!best) return null;
  const ids = [best.at];
  while (prev.has(ids[0])) ids.unshift(prev.get(ids[0]));
  return { km: best.km, points: ids.map((id) => [pos.get(id).latitude, pos.get(id).longitude]) };
}

// ─── Build ───────────────────────────────────────────────────────────────────

const previous = {};
if (!fresh && existsSync(OUT)) {
  for (const m of readFileSync(OUT, 'utf8').matchAll(/^ {2}'([^']+)': '((?:[^'\\]|\\.)*)',$/gm)) {
    previous[m[1]] = m[2].replace(/\\(.)/g, '$1');
  }
}

// Each hop once, in the direction a corridor rides it; the reverse is drawn
// from the same shape backwards.
const hops = new Map();
for (const c of CORRIDORS) {
  c.stops.forEach((id, i) => {
    const next = c.stops[i + 1];
    if (!next || hops.has(`${id}>${next}`) || hops.has(`${next}>${id}`)) return;
    // The way the bus is heading at each end: along the line through the
    // stops either side, so both hops at a stop ask for the same carriageway.
    const at = (k) => STOP_BY_ID[c.stops[Math.max(0, Math.min(c.stops.length - 1, k))]];
    const headings = [heading(at(i - 1), at(i + 1)), heading(at(i), at(i + 2))];
    hops.set(`${id}>${next}`, { from: id, to: next, km: c.hops?.[i], corridor: c.id, rail: c.mode === 'rail', headings });
  });
}

const shapes = {};
const skipped = [];
let n = 0;
let tracks = null;
for (const [key, h] of hops) {
  n++;
  if (previous[key]) { shapes[key] = previous[key]; continue; }
  const a = STOP_BY_ID[h.from], b = STOP_BY_ID[h.to];
  if (!a || !b) { skipped.push(`${key}: unknown stop`); continue; }

  if (h.rail) {
    // A car's road is not the track: rail follows the rails themselves.
    tracks ??= await railNetwork();
    const t = tracks && trackBetween(tracks, a, b, h.corridor === 'rail_blue');
    if (!t) { skipped.push(`${key}: no track found`); continue; }
    if (t.km > haversineKm(a, b) * MAX_STRETCH) {
      skipped.push(`${key}: track ${t.km.toFixed(2)} km vs ${haversineKm(a, b).toFixed(2)} km straight`);
      continue;
    }
    shapes[key] = encode(simplify([[a.latitude, a.longitude], ...t.points, [b.latitude, b.longitude]]));
    continue;
  }

  // A stop pinned on the far carriageway of a divided road sends the car on
  // to the next U-turn and back. The line has no direction on the map, so
  // the hop is also asked for the other way round and the shorter kept.
  let r = await road(a, b, h.headings);
  await sleep(1100);
  if (!r || (h.km && r.km > h.km * MAX_STRETCH)) {
    const free = await road(a, b);
    await sleep(1100);
    if (free && (!r || free.km < r.km)) r = free;
  }
  if (!r || (h.km && r.km > h.km * MAX_STRETCH)) {
    const back = await road(b, a);
    await sleep(1100);
    if (back && (!r || back.km < r.km)) r = { km: back.km, points: back.points.reverse() };
  }
  // Still too long: the pin sits nearer a side street or service lane than
  // the road the bus takes. Try the few roads within reach of each end.
  if (!r || (h.km && r.km > h.km * MAX_STRETCH)) {
    const [ea, eb] = [await snaps(a), await snaps(b)];
    for (const p of ea) {
      for (const q of eb) {
        const t = await road(p, q);
        await sleep(1100);
        if (t && (!r || t.km < r.km)) r = t;
      }
    }
  }
  if (!r) { skipped.push(`${key}: no route`); continue; }
  // One-way systems and slip roads make some real hops longer than measured.
  // What reads wrong on a map is a line that doubles back on itself, so a
  // longer road is fine as long as it never does.
  if (h.km && r.km > h.km * MAX_STRETCH && (r.km > h.km * LOOSE_STRETCH || doublesBack(r.points))) {
    skipped.push(`${key} (${h.corridor}): road ${r.km.toFixed(2)} km vs hop ${h.km} km`);
    continue;
  }
  // Start and end on the stops themselves, so the line meets the dots.
  const points = simplify([[a.latitude, a.longitude], ...r.points, [b.latitude, b.longitude]]);
  shapes[key] = encode(points);
  process.stdout.write(`\r${n}/${hops.size} ${key}`.padEnd(70));
}
process.stdout.write('\n');

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const body = Object.keys(shapes).sort().map((k) => `  '${k}': '${esc(shapes[k])}',`).join('\n');
writeFileSync(OUT, `// Generated by scripts/build-corridor-shapes.mjs — do not edit by hand.
// Roads via OSRM, rail along the mapped track; both © OpenStreetMap contributors (ODbL).

/**
 * The road between two consecutive corridor stops, keyed "fromStopId>toStopId"
 * in the direction a corridor rides it, as an encoded polyline (precision 5).
 * A hop missing here is drawn as a straight line. See ADR 0015.
 */
export const CORRIDOR_SHAPES: Record<string, string> = {
${body}
};
`);

console.log(`${Object.keys(shapes).length} shapes written, ${skipped.length} left straight`);
for (const s of skipped) console.log(`  straight: ${s}`);
