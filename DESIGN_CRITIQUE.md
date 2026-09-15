# Critique — WakaWay Redesigned Screens (pass 01)

Reviewed 11 September 2026, against the canvas `WakaWay Redesigned Screens.dc.html`
(6 artboards: Home, Search, Route detail, Navigation, Splash, and a live morph prototype).

Measurements below come from the canvas markup itself, not from looking at it.

---

## Verdict

The system-level work is genuinely good, and most of it is correct. Four of the problems
raised in `DESIGN_MAP.html` are properly closed, the radius set holds, and the colour
discipline is real rather than claimed — danfo yellow appears 10 times against 61 uses of
the near-black, so it is being spent as a single accent exactly as the annotation says.

The concern is not craft. It is that the "Apple method" is quietly sanding off the things
that made WakaWay specifically Lagosian, and nothing in the pass flags that as a decision.
That is the theme running through section 3.

---

## 1. What it fixes, confirmed

| Design Map finding | Status |
|---|---|
| Keke green doubling as success green | **Fixed.** Keke keeps `#5DBB63`; success is now `#1F7A3D` / `#2E9E52` |
| `warning` identical to primary yellow | **Fixed.** `rgba(224,138,0,.94)` — `#E08A00` at 94% — on the go-slow and checkpoint banners |
| Twelve ad-hoc corner radii | **Fixed.** Holds to 10 / 12 / 16 / 20 / 999 |
| No tab bar; Home carrying everything | **Addressed.** Bottom tabs: Home · Search · Contribute · You |

Two more worth crediting, neither of which was asked for:

- **`textOnOrange` is corrected in practice.** The current token file pairs white on danfo
  yellow — 1.63:1, effectively invisible. The canvas uses `#1A1200` on yellow, 11.40:1.
  Same for the keke chip: dark ink at 7.55:1 rather than the token file's white at 2.40:1.
  When porting, fix the tokens; don't carry `kekeText: '#FFFFFF'` across.
- **Reduce Motion is handled** — a 200ms opacity crossfade replacing the full morph. Most
  redesign passes forget this entirely.

Contrast across the state colours is solid: Busy amber 6.00:1, On time green 5.37:1,
warning banner ink 6.90:1, dark-canvas body text 10.59:1. Someone checked.

---

## 2. Must fix before any code

### 2.1 `#8A8D95` fails AA, and it is everywhere

| Use | Ratio | Verdict |
|---|---|---|
| Inactive tab bar labels, 11px | 3.18:1 | **Fail** |
| Mono section headers ("Stops & places", "Recent", "Then"), 12px | 3.32:1 | **Fail** |
| Search placeholder "Where you dey go?", 17px | 3.18:1 | **Fail** |

AA needs 4.5:1 for text this size. `#6B6E76` — already in the palette, already used for row
captions — clears it at 4.89:1 with no visible change in character. This is a one-value fix.

It matters more than the number suggests. This app is used outdoors, in Lagos sun, one-handed,
on a moving danfo. 3.18:1 is marginal on a desk monitor and gone entirely at midday. Treat
4.5:1 as the floor for anything a user has to read while standing at a bus stop.

### 2.2 Notifications have no way in

There is no bell, no alerts tab, and no notification affordance anywhere in the six artboards
— zero matches across the whole canvas. The current app has a `NotificationsScreen` and a
notification dot on Home.

The "Live" pill in the Home header is a **status indicator**, not a destination: a green dot
plus the word Live, sized 44×44 as though it were tappable but wired to nothing.

Either give alerts a home (a fifth tab, or a header entry point that isn't disguised as a
status light), or decide `NotificationsScreen` is being retired and say so.

### 2.3 Text on translucent material has no contrast floor

The Home chrome sits on `rgba(255,255,255,.7)` with `backdrop-filter: blur(24px)` over the
live map. That looks excellent and it is unmeasurable — contrast depends on whatever map
tile happens to be underneath. A dark satellite region or a dense road cluster will take
17:1 text down without warning.

Fix by specifying a minimum: either raise the material to ~0.85 opacity behind anything
textual, or put a solid backing plate under text and let the translucency live in the
padding around it.

---

## 3. Decide these deliberately — they weren't in the spec

None of these are defects. All of them are choices the pass makes silently, and the four
together add up to a different product personality than the one the app has now.

### 3.1 The neutrals changed temperature, and lost their tie to the brand

Ground moves from `#F5F7F5` — a green-biased off-white, deliberately keyed to the brand
green — to `#FBFAF8` / `#F4F1EA` warm cream, over a cool near-black `#14161A` replacing the
forest `#080D0B`.

Warm cream with a single saturated accent is the most common look in contemporary app design
right now; it is where a design tool lands by default. The green bias was the one thing
making WakaWay's neutrals *WakaWay's*. Losing it is a real trade, and it should be made on
purpose rather than inherited from the method.

### 3.2 "Move Local" is gone

The splash tagline reads **"Move smart"**. The brand line is **"Move Smart. Move Local."**
The half that was dropped is the half carrying the Lagos identity.

### 3.3 The pidgin thinned to a single placeholder

"Where you dey go?" survives, in the search field. Everything else — "Stops & places",
"Recent", "Find routes", "Then", "Start" — is neutral English. Pidgin route instructions are
listed in the README as a core differentiator, and the routing engine generates them per leg.
One placeholder is not a voice.

### 3.4 Fare got demoted below time

Route detail leads with **42 min** at 28px/800, with **₦450** at 15px underneath. The Home
cards do the same: "42 min · ₦450".

The app's own premise is knowing the fare *before* you board, so you are not overcharged as
someone new to the city — and the existing component is literally named `FareEstimateCard`
with a "dominant fare display". The redesign inverts that hierarchy without comment. For a
commuter choosing between a ₦300 danfo and a ₦700 keke, price is the decision; minutes are
the tiebreak.

### 3.5 Smaller, still worth a decision

- **The type scale is replaced wholesale** — 34/28/22/17/15/13/11 against the current
  36/26/20/16/14/12/10. 17px body is the iOS convention and it is a defensible choice, but
  it re-specs every text style in the app. This is the largest single line item in the port
  and the annotation doesn't mention it.
- **A second font family.** IBM Plex Mono is added for uppercase eyebrows. That is another
  face to bundle for an audience on budget Android hardware, in service of labels that are
  currently the failing-contrast ones. Plus Jakarta Sans at 600 with the same tracking would
  read nearly identically for free.
- **BRT blue drifted** `#2563EB` → `#1E6FD9`, unremarked.
- **"Contribute" as a top-level tab.** The stated audience is newcomers who don't know the
  city. Contributing is a power-user act, and it is now permanently occupying a quarter of
  the primary navigation while alerts have nowhere to live. Worth swapping.

---

## 4. Implementation risk, from the actual dependency list

Better than expected. Already installed:

- `@react-navigation/bottom-tabs` 7.9.0 — **present and unused.** The tab bar is a
  restructure of `App.tsx`, not a new dependency.
- `react-native-reanimated` 4.1.1 — the spec's damping 26 / stiffness 260 ports directly.
- `expo-blur` — covers `backdrop-filter`.

Three genuine gaps:

1. **Continuous corners.** The squircle is an SVG `clipPath`. React Native has no continuous
   corner radius. Needs Skia or a squircle package, and Android will likely fall back to
   standard radii — so the shape language must survive not being a squircle.
2. **The morphs animate layout properties.** `left`, `top`, `width`, `height`, `font-size`,
   `padding`, `border-radius` over 480ms. Fine in CSS; in RN these are the expensive ones.
   Rebuild on `transform` and `opacity`, and note that animating font-size specifically has
   no cheap RN equivalent — scale a transform instead and accept the reflow at the endpoints.
3. **Blur cost on low-end Android.** `blur(24px)` behind a panning map is where budget
   devices drop frames. Worth a device-tier fallback to a solid material.

Also: the splash runs `markIn` 620ms plus a 1100ms sweep on a 320ms delay, with a 1200ms
timer before Home. That is roughly 1.4s of brand animation before the app is usable. Charming
once; on the fifth launch of the day, at a bus stop, it is a delay. Consider showing it on
first launch only.

---

## 5. Coverage

Five screens of twelve, plus the prototype. Not yet designed: **You, Preferences,
Contribution, Notifications, Login, Signup, Onboarding.**

One interaction worth planning around: four of those undesigned screens — You, Preferences,
Login, Signup — are among the six currently frozen to the static dark palette and unable to
respond to the theme. So this pass does not resolve the theme split; it mostly redesigns
screens on either side of it. Search and Navigation *are* frozen ones and would get fixed
in passing.

Sequence that avoids doing the work twice:

1. Finish the theme migration (13 files off static `Colors`)
2. Land the new palette and type scale as tokens — including the `textOnOrange` / `kekeText`
   corrections above
3. Then build screens against tokens

---

## 6. The one thing to take back into the canvas

Everything in section 2 is mechanical. Section 3 is the real conversation.

The pass applies a method faithfully and the result is clean, calm and well-measured. But
"clean, calm and well-measured" is available to any app. What is not available to any app is
a yellow-and-green transit tool that speaks pidgin, leads with the fare, and is built on
neutrals keyed to its own brand green — for people trying not to get lost or overcharged in
Lagos.

Keep the discipline. Put the locality back: the green-biased ground, the full tagline, pidgin
beyond one placeholder, and the fare as the number that leads.
