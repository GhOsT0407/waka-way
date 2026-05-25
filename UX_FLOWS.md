# WakaWay — User Experience Flows

## Table of Contents
1. [Primary User Flows](#primary-user-flows)
2. [Secondary User Flows](#secondary-user-flows)
3. [Error Handling Flows](#error-handling-flows)
4. [Nigerian Context Considerations](#nigerian-context-considerations)

---

## Primary User Flows

### Flow 1: Route Search & Navigation

**Goal**: User wants to find the best route from their current location to a destination.

**Actual Implementation**:

```
1. [Home Screen — Search-First]
   - Warm white background (#F8F7F5), no map
   - Search bar at top: "Where are you going?" with orange location pin
   - GPS origin chip below search bar: "Current location"
   - FlatList of popular routes (Ojuelegba→CMS, Ikeja→VI, etc.)

2. [User taps search bar]
   - SearchScreen slides up from bottom (slide_from_bottom, 250ms)
   - Shows recent searches FlatList
   - Empty state: bus icon + "Where to?" + "Type a place — e.g. 'Lekki'"
   - User types destination

3. [Autocomplete Results]
   - Location suggestions appear as user types (Google Places)
   - Each result: name + address
   - User selects destination

4. [TransportModeSelector bottom sheet]
   - Slides up with spring (friction 8, tension 50)
   - "What transport dey near you?"
   - Grid: Keke · Danfo · Okada · BRT · Walk
   - Shows "Last used" badge on previously selected mode
   - User selects mode

5. [RouteDetailScreen]
   - Slides up from bottom
   - SmartRouteOptions: fare-dominant cards (₦ amount in accent orange, 22px/700)
   - Difficulty chip: EASY (≤2 legs, green) / MODERATE (3, amber) / COMPLEX (4+, red)
   - Transport chain: [DANFO]──●──[BRT]──●──[WALK]
   - Leg timeline with English + pidgin instructions
   - "Enter danfo wey dey go CMS" style instructions

6. [User taps "Start Journey"]
   - NavigationScreen slides up (slide_from_bottom, gesture disabled)
   - Real-time GPS tracking
   - RouteGuide component: turn-by-turn instructions
   - Route progress overlay
```

**Key UX Elements**:
- Fare is the dominant element — always largest, most prominent (22px/700, accent color)
- Search reachable in ≤ 2 taps from home
- Pidgin instructions on every route leg alongside English
- No map on Home screen — map lives in RouteDetail and NavigationScreen

---

### Flow 2: Report Route / Fare Update

**Goal**: User wants to report incorrect route information or updated fare.

**User Journey**:
```
1. [RouteDetailScreen]
   - User notices incorrect information
   - Taps contribution/report button

2. [ContributionScreen — modal, slides from bottom]
   - Report type selection:
     * "Fare Update" (Fare don change)
     * "Route Disrupted" (Route no dey work)
     * "New Route Available"
     * "Stop Location Changed"
     * "Route Information Incorrect"
     * "Other"

3. [Report Details Form]
   - Context-aware fields based on report type
   - If fare update: new fare amount (₦)
   - Description text area
   - User fills form

4. [Submit Report]
   - Idempotency key prevents duplicate submissions on retry
   - Confirmation toast: "Report submitted! Thank you"
   - Modal dismisses, returns to RouteDetailScreen

5. [Report Status] (future)
   - Reports tracked via status: Pending / Verified / Resolved / Rejected
   - Soft delete: records preserved, never hard-deleted
```

**Key UX Elements**:
- Context-aware fields (only show what's relevant to the report type)
- Idempotency key: submitting the same report twice on network retry won't create duplicates
- Friendly pidgin framing in copy

---

### Flow 3: Transport Mode Selection

**Goal**: User selects what transport is available at their starting point.

**Actual Implementation**:
```
1. [SearchScreen — after selecting destination]
   - SearchScreen transitions to TransportModeSelector sheet

2. [TransportModeSelector — bottom sheet]
   - Slides up with spring animation (friction 8, tension 50)
   - Title: "What transport dey near you?"
   - Subtitle: "Select what's available at your starting point"
   - 3-column icon grid:
     * Keke (orange) · Danfo (blue) · Okada (purple)
     * BRT (green) · Walk (grey)
   - Each card: icon circle + label + pidgin text ("Enter Keke", "Waka", etc.)
   - Saved preference shows "Last used" badge

3. [Selection]
   - User taps a mode
   - Sheet closes with cubic-ease-in (220ms)
   - Route calculation begins with selected mode filter
   - RouteDetailScreen opens
```

**Key UX Elements**:
- Spring open animation feels natural and physical
- "Last used" badge reduces friction for repeat users
- Pidgin text reinforces local identity

---

### Flow 4: Onboarding → Auth

**Goal**: First-time user gets oriented then logs in.

**User Journey**:
```
1. [OnboardingScreen — rendered before NavigationContainer]
   - 3 slides on dark navy (#0F172A) background
   - Slide 1 (green accent): "Lagos in Your Pocket" — multi-modal routes
   - Slide 2 (blue accent): "See Real Fares" — before you board
   - Slide 3 (amber accent): "Works Offline" — no data needed
   - Progress bar + "Continue →" CTA in slide accent color
   - "Skip" in top right
   - AsyncStorage flag: ONBOARDING_DONE_KEY persists after completion

2. [LoginScreen]
   - Warm white background (#F8F7F5)
   - Orange logo ring + "WakaWay" wordmark
   - White card with email + password fields
   - Focus state: orange border on active field
   - "Sign In" button (orange, full width)
   - "Forgot password?" text link (orange)
   - "Don't have an account? Sign Up" link below card

3. [SignupScreen]
   - Same card pattern
   - Additional name field
   - "Create Account" button
   - Back button: navigate('Login') fallback

4. [Home Screen — search-first layout]
   - After auth success (mock or real)
   - Ready for route search
```

---

### Flow 5: Save Favorite Places (Planned)

**Goal**: User frequently visits certain places and wants quick access.

**User Journey**:
```
1. [RouteDetailScreen]
   - User taps "Save Place"
   - OR taps destination name

2. [Save Place Dialog]
   - Prompt: "Save [Destination Name] as favorite?"
   - User can rename (e.g., "Home", "Office", "Market")

3. [Saved in Favorites]
   - Appears in YouScreen > Saved Places
   - Shows in search suggestions
   - Quick access from Home search bar

Note: UserFavoritePlace model supports soft delete (deleted_at).
      Favorites marked deleted are excluded from results.
```

---

## Secondary User Flows

### Flow 6: View Route History

**Goal**: User wants to see previously searched routes.

**User Journey**:
```
1. [YouScreen]
   - User taps "Route History"

2. [UserRouteHistory list]
   - Origin → Destination
   - Searched date/time
   - Route summary (time, fare)
   - Ordered by -searched_at

3. [Route Details]
   - Shows full route details for that search
   - Option to search again with same endpoints
```

---

### Flow 7: Share Route

**Goal**: User wants to share a route with a friend.

**User Journey**:
```
1. [RouteDetailScreen]
   - User taps "Share" button

2. [Share Options]
   - WhatsApp, SMS, copy link, other apps
   - Pre-composed message with route summary + link

3. [Route Shared]
   - Confirmation toast
```

---

### Flow 8: Dark Mode Toggle

**Goal**: User wants to use dark mode.

**User Journey**:
```
1. [YouScreen]
   - Toggle "Dark Mode" switch

2. [Instant switch]
   - ThemeContext updates isDark state
   - All screens rerender with DarkColors tokens:
     * bg: #111318, surface: #1C1C1E
     * accent: #FF6B35 (brighter orange on dark bg)
   - StatusBar switches to light content
```

---

## Error Handling Flows

### Flow 9: No Route Found

**Scenario**: Routing engine cannot find a route between origin and destination.

**User Journey**:
```
1. [Route Calculation]
   - SmartRoutingService returns empty results

2. [RouteDetailScreen — empty state]
   - Message: "No routes found"
   - Suggestions:
     * "Try a different transport mode"
     * "Try enabling more modes"
     * "Report if you know a route exists"
   - Actions: "Adjust Search" · "Report Route" · "Go Back"
```

---

### Flow 10: Location Permission Denied

**Scenario**: User denies location access.

**User Journey**:
```
1. [App launch]
   - expo-location requests permission
   - User denies

2. [Degraded mode]
   - Origin chip shows "Enter location manually"
   - Search still works from typed origin
   - Banner or prompt explaining limitation

3. [Settings redirect] (if user taps to enable)
   - Opens device settings
   - Returns to app — location detected automatically
```

---

### Flow 11: Network Error / Offline

**Scenario**: User has no internet connection.

**User Journey**:
```
1. [App detects network loss]
   - OfflineBanner appears at top of screen (useNetworkStatus hook)
   - Banner: "You're offline" in warning color

2. [Route search]
   - USE_MOCK_DATA=true: routing engine still works client-side (no network needed)
   - Places/geocoding API: falls back to recent searches only

3. [Back online]
   - OfflineBanner animates out
   - Full API functionality restored
```

---

## Nigerian Context Considerations

### Language & Terminology

**Local Terms Used**:
- "Danfo" for yellow minibuses
- "Keke" for tricycles (Keke NAPEP)
- "Okada" for motorbikes
- "Waka" — pidgin for "walk/move" (the app name)
- "BRT" for Bus Rapid Transit / LAGBUS

**Pidgin Instructions on Every Route Leg**:
- "Enter danfo wey dey go CMS"
- "Board keke from Oshodi"
- "Waka 400m to Ojuelegba park"

**UI Copy**:
- "What transport dey near you?" (TransportModeSelector)
- "Where are you going?" (search bar)
- "Move Smart. Move Local." (tagline)

### Cultural Considerations

- Okada drivers negotiate fares — show range (₦200–₦300), not fixed
- Bus routes lack fixed schedules — show frequency estimate
- Some LGA areas have okada bans — Lagos routing constraints in `lagosRouteRules.ts`
- Rush hour (7–9am, 5–7pm) increases fares — `pricingEngine.ts` applies peak rates

### User Behavior Patterns

| Scenario | User Need | App Response |
|----------|-----------|--------------|
| Morning commute | Fastest route to work | EASY routes prioritized, departure time estimate |
| Market trip | Cheapest route | Fare-first display, keke/okada options |
| Evening return | Safe, well-lit | Route reliability status |
| Weekend outing | Flexible timing | All mode options shown |

---

## Accessibility Considerations

### Visual Accessibility
- WCAG AA contrast (4.5:1) in both light and dark mode
- Minimum touch target: 44pt (enforced via `hitSlop` on icon buttons)
- Icon + text labels — never icons alone
- Transport mode colors paired with text labels (color-not-only rule)

### Typography
- DM Sans — high legibility at small sizes
- Minimum body size: 14px (md scale)
- 11px only for secondary labels (pidgin, timestamps)

### Motor Accessibility
- Swipe gestures for navigation (gestureEnabled on stack screens)
- Large touch targets on all interactive elements
- Bottom sheet close: swipe down or tap cancel button

---

## Animation & Transition Summary

| Transition | Animation | Duration |
|-----------|-----------|----------|
| Screen enter (slide right) | `slide_from_right` | 250ms |
| Bottom sheet open (Search, RouteDetail, You, Contribution) | `slide_from_bottom` | 250ms |
| Search overlay enter | `Easing.out(Easing.cubic)` | 220ms |
| Search overlay exit | `Easing.in(Easing.cubic)` | 160ms |
| TransportModeSelector open | `Animated.spring` (friction 8, tension 50) | — |
| TransportModeSelector close | `Easing.in(Easing.cubic)` | 220ms |
| Auth screen | `fade` | 250ms |

---

## Future Enhancements

### Phase 2 Features
- Real-time navigation improvements (live rerouting)
- Server-side route search API (PostgreSQL + PostGIS)
- User authentication backend
- Favorite places backend API
- Route sharing (deep links)
- Voice navigation in Nigerian languages

### Advanced Features
- ML-based route optimization from community data
- Predictive arrival times based on time of day
- Integration with ride-hailing apps
- Public transport schedule display
- Emergency SOS and location sharing
