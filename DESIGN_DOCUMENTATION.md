# WakaWay — Design Documentation

## Table of Contents
1. [Brand Identity](#brand-identity)
2. [Design System](#design-system)
3. [Screen Wireframes](#screen-wireframes)
4. [Component Patterns](#component-patterns)
5. [User Flows](#user-flows)

---

## Brand Identity

### App Name
**WakaWay** — "Move Smart. Move Local."
- "Waka" = Nigerian pidgin for "walk / move"
- Taglines: "Move Smart. Move Local." · "Your Way. The Naija Way." · "Waka easy, anywhere you dey."

### Brand Personality
- **Street-smart**: Understands how Lagos actually moves
- **Honest**: Shows real fares before you board
- **Local**: Pidgin instructions, landmark navigation, Nigerian context
- **Flat & confident**: No decoration for its own sake — clear hierarchy, bold accent

### Logo
"W" wordmark in `#E8541A` danfo orange. App icon: white W on orange square with rounded corners.

---

## Design System

### Color Tokens

```typescript
// client/src/theme/colors.ts
LightColors = {
  bg:              '#F8F7F5',   // warm white — main backgrounds
  surface:         '#FFFFFF',   // cards, inputs
  surfaceSecondary:'#F2F1EF',   // chips, field backgrounds
  accent:          '#E8541A',   // danfo orange — primary CTAs, focus states
  accentSubtle:    '#FDF0EA',   // fare highlight box, logo glow
  textPrimary:     '#111111',
  textSecondary:   '#6B6B6B',
  textMuted:       '#9E9E9E',   // placeholders, icons
  textOnAccent:    '#FFFFFF',
  divider:         '#E5E5E5',
  success:         '#2D7A4F',
  successSubtle:   '#EBF8F1',
  warning:         '#C8790A',
  warningSubtle:   '#FEF5E7',
  error:           '#C0392B',
  errorSubtle:     '#FDEDEC',
  transportDanfo:  '#F5C518',   // yellow
  transportBRT:    '#1A5BDB',   // blue
  transportKeke:   '#2D7A4F',   // green
  transportOkada:  '#D93025',   // red
  scrim:           'rgba(0,0,0,0.4)',
}

DarkColors = {
  bg:              '#111318',
  surface:         '#1C1C1E',
  accent:          '#FF6B35',   // brighter orange for dark bg
  // ... matching semantic tokens
}
```

Always reference `LightColors` / `DarkColors` directly or via `useAppTheme().tokens`. Never hardcode hex strings in `StyleSheet.create()`.

### Typography

Font: **DM Sans** (loaded via Expo)

```typescript
// client/src/theme/typography.ts
Typography = {
  xs: 10,  sm: 12,  md: 14,  lg: 16,  xl: 20,  xxl: 24,  hero: 32,
  regular: '400',  medium: '500',  semibold: '600',  bold: '700',
}
```

### Spacing & Shape

- **Grid**: 4pt base (4, 8, 12, 16, 20, 24, 32, 40, 48)
- **Card radius**: 12–20px
- **Pill radius**: 999
- **Touch target minimum**: 44pt (enforced via `hitSlop` on icon buttons)
- **Style**: Flat — zero elevation on content cards, color alone creates hierarchy

### Transport Mode Colors

| Mode | Background | Text |
|---|---|---|
| Danfo | `#F5C518` | `#111111` |
| BRT | `#1A5BDB` | `#FFFFFF` |
| Keke | `#2D7A4F` | `#FFFFFF` |
| Okada | `#D93025` | `#FFFFFF` |

---

## Screen Wireframes

### 1. Home Screen (Search-First)

```
┌─────────────────────────────────────┐
│  WAKAWAY          Lagos transit  [U] │  ← wordmark + avatar btn
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │  ← search bar (56px, orange pin)
│  │ 📍 Where are you going?  ⇅ │    │
│  └─────────────────────────────┘    │
│  ○ From: Current location           │  ← GPS origin chip
│                                     │
├─────────────────────────────────────┤
│  POPULAR ROUTES                     │  ← 11px/600, letter-spacing 0.9
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Ojuelegba → CMS      45min  │    │  ← route row card
│  │ ₦400–₦600          [DANFO][BRT]│  │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │ Ikeja → Victoria Island 70m │    │
│  │ ₦600–₦900          [BRT][KEKE]│ │
│  └─────────────────────────────┘    │
│  … (6 routes total, FlatList)       │
└─────────────────────────────────────┘
```

### 2. Search Overlay (slides over Home)

```
┌─────────────────────────────────────┐
│  ← [← search input          ✕]     │  ← back + input row
├─────────────────────────────────────┤
│                                     │
│  RECENT                             │
│  🕐  Lekki Phase 1                  │
│      Lekki, Lagos                   │
│  🕐  Oshodi                         │
│      Oshodi, Lagos                  │
│                                     │
│  [empty state when no recents]      │
│       🚌                            │
│    Where to?                        │
│  Type a place — e.g. "Lekki"        │
└─────────────────────────────────────┘
  Animates in: translateY 16→0 + opacity 0→1 (220ms, Easing.out cubic)
  Animates out: opacity 1→0 (160ms, Easing.in cubic)
```

### 3. Route Detail Screen

```
┌─────────────────────────────────────┐
│  [route map]                    [←] │
├─────────────────────────────────────┤
│  Route Options              (cards) │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  ₦400–600           [EASY]     │ │  ← fare dominant (22px/700 orange)
│  │  ─────────────────────────     │ │
│  │  [DANFO]──●──[BRT]──●──[WALK] │ │  ← transport chain
│  │                                 │ │
│  │  45 min · 12 km                 │ │
│  │                                 │ │
│  │  ▸ Walk 400m to Ojuelegba park  │ │  ← leg timeline
│  │  ▸ "Enter danfo wey dey go CMS" │ │  ← pidgin instruction
│  │  ▸ Board BRT at Oshodi          │ │
│  │                                 │ │
│  │  [START JOURNEY]                │ │  ← only on selected card
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4. Onboarding (3 slides, dark background)

```
┌─────────────────────────────────────┐
│  Skip                    1 / 3      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     [ring illustration]     │    │  ← per-slide accent color
│  │          🚌                  │    │
│  └─────────────────────────────┘    │
│                                     │
│  [NAVIGATION]                       │  ← accent-color tag
│  Lagos in                           │
│  Your Pocket                        │
│                                     │
│  Smart multi-modal routes…          │
│                                     │
│  🚌 Danfo · Keke · Okada · BRT      │
│  💰 See estimated fares             │
│  📴 Works offline                   │
│                                     │
├─────────────────────────────────────┤
│  [███████──────────]                │  ← progress bar
│  [Continue →]                       │  ← accent-colored CTA
└─────────────────────────────────────┘
  Background: #0F172A (dark navy — intentional for dramatic intro)
  Slide accents: slide 1 green · slide 2 blue · slide 3 amber
```

### 5. Login / Signup

```
┌─────────────────────────────────────┐
│  #F8F7F5 warm white background      │
│                                     │
│           [orange logo ring]        │
│              WakaWay                │
│         Move Smart. Move Local.     │
│                                     │
│  ┌────────────────────────────────┐ │  ← white card, subtle shadow
│  │  Sign In                        │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │ ✉️  Email               │  │ │  ← focus → orange border
│  │  └──────────────────────────┘  │ │
│  │  ┌──────────────────────────┐  │ │
│  │  │ 🔒  Password         👁  │  │ │
│  │  └──────────────────────────┘  │ │
│  │  [        Sign In         ]    │ │  ← orange button
│  │  Forgot password?              │ │
│  └────────────────────────────────┘ │
│  Don't have an account? Sign Up     │
└─────────────────────────────────────┘
```

### 6. Transport Mode Selector (bottom sheet)

```
┌─────────────────────────────────────┐  ← spring in from bottom
│  ▬                                  │  ← drag handle
│  What transport dey near you?       │
│  Select what's available…           │
│                                     │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ 🛺   │ │ 🚌   │ │ 🏍   │        │  ← 3-column grid
│  │ Keke │ │Danfo │ │Okada │        │
│  └──────┘ └──────┘ └──────┘        │
│  ┌──────┐ ┌──────┐                 │
│  │ 🚍   │ │ 🚶   │                 │
│  │  BRT │ │ Walk │                 │
│  └──────┘ └──────┘                 │
│                                     │
│            Cancel                   │
└─────────────────────────────────────┘
```

---

## Component Patterns

### Fare Display Rule
Fare is always the dominant visual element on a route card:
- Font size: 22px / weight 700 / color: `accent`
- Placed in `accentSubtle` box at top-left of card

### Difficulty Chip
Derived from transit leg count — not stored:
- `EASY` (≤2 legs) — `success` green
- `MODERATE` (3 legs) — `warning` amber
- `COMPLEX` (4+ legs) — `error` red

### FlatList Scroll Config
Every `FlatList` uses:
```tsx
decelerationRate="normal"
overScrollMode="never"
showsVerticalScrollIndicator={false}
keyboardShouldPersistTaps="handled"
```

### Animated Overlay Convention
```
Enter: Easing.out(Easing.cubic), 220ms
Exit:  Easing.in(Easing.cubic),  160ms
Bottom sheet open: Animated.spring (friction 8, tension 50)
Bottom sheet close: Easing.in(Easing.cubic), 220ms
```

---

## User Flows

### Flow 1: Route Search
```
Home → tap search bar → search overlay slides in
→ type destination → select suggestion → TransportModeSelector sheet
→ select mode → route loading overlay → RouteDetail screen
```

### Flow 2: Popular Route
```
Home → tap popular route row → search overlay opens with destination pre-filled
→ same flow as above
```

### Flow 3: Report Issue
```
RouteDetail → contribution button → ContributionScreen (modal)
→ select issue type → fill details → submit → dismiss modal
```

---

## Design Principles

1. **Fare first** — fare is always the largest, most prominent element on any route card
2. **Search ≤2 taps** — destination reachable in 2 taps from home
3. **No map on home** — Home is search-first; map lives in RouteDetail and NavigationScreen
4. **Pidgin welcome** — every route leg has a local pidgin instruction alongside the English one
5. **Flat hierarchy** — color alone separates levels, no shadows on content cards
6. **WCAG AA** — all text/background pairs meet 4.5:1 contrast in both light and dark mode
