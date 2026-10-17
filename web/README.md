# WakaWay — web shell

The journey explanation, in a browser. No install, no download, a link you can
paste into WhatsApp.

This is a **shell**, not a second app. It owns no transport logic. Every route
it shows comes from the same engine the Expo app runs, read straight out of
`../client/src`.

## Run it

```bash
cd web
npm install
cp .env.example .env     # fill in the Supabase values
npm run dev
```

`npm run build` produces a static `dist/` that any host will serve.

## The contract with ../client

**This project reads from `../client/src`. It never writes there.** The Expo
app keeps its own `package.json`, its own build and its own tests; nothing here
can change how it behaves.

Three aliases in `vite.config.ts` are the whole bridge:

| Alias | Points at | Why |
|---|---|---|
| `@engine/*` | `../client/src/*` | one copy of the corridors and the engine |
| `@react-native-async-storage/async-storage` | `src/shims/async-storage.ts` | the engine's only native import |
| `react-native-url-polyfill/auto` | `src/shims/empty.ts` | browsers already have `URL` |

The engine is shared by reference on purpose. `data/lagosRoutes.ts` is the most
valuable file in the repo; a copy here would mean two apps that slowly disagree
about Lagos. The cost of sharing is that a refactor inside `client/src` can
break this build — which surfaces at build time, and is much cheaper than
silent data drift.

**Colour is the one thing not shared.** This shell uses the landing page's
palette — green-black `#0B0F0C`, cream `#F4EFE1`, cyan rail — not the Expo
app's `WW_DARK`, so the two web surfaces read as one site. The values live in
the `:root` block at the top of `src/styles.css` and nowhere else; that block
is the only thing to change if the two ever need to converge.

The app's palette is deliberately *not* imported here. Publishing `WW_DARK`
over these variables would quietly undo the choice.

## What it does

- Trip input as one line — "Ikeja to Lekki" — using the same grammar as the
  app's search overlay.
- The full explained journey from `explainJourney.ts`: numbered steps, where to
  stand, what the conductor shouts, what to tell them, fare per leg with its
  trust source.
- Fastest / cheapest / simplest options, where the engine finds more than one.
- Share as text.
- "Yes, e work" writing a `route_ok` row through the existing
  `services/contribute.ts`. Reports need a sign-in (magic link) because the
  trust layer is only worth anything if one person cannot vote a corridor up a
  hundred times.

## What it deliberately does not do

**No map.** The product thesis is that the explanation is the thing
(ADR 0013) — the map is the part people already have. Leaving it out skips the
one piece of the Expo app that genuinely cannot cross over
(`react-native-maps` has no web target) and keeps the first version honest.
MapLibre can come later if the metrics ask for it.

No Wakaway Mode either: live GPS advance, keep-awake and approach vibration are
what the native app is *for*.

## Known edges

- `npm run typecheck` reaches into `client/src` and currently passes clean — no
  React Native types leak through the engine's import graph. If a future change
  in `client/` drags one in, the fix is another alias here, not an edit there.
- Place search without `EXPO_PUBLIC_MAPTILER_KEY` falls back to the built-in
  Lagos landmark list. Good enough to demo, thin for street addresses.
