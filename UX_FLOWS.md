# WakaWay - User Experience Flows

## Table of Contents
1. [Primary User Flows](#primary-user-flows)
2. [Secondary User Flows](#secondary-user-flows)
3. [Error Handling Flows](#error-handling-flows)
4. [Nigerian Context Considerations](#nigerian-context-considerations)

---

## Primary User Flows

### Flow 1: Basic Route Search & Navigation

**Goal**: User wants to find the best route from their current location to a destination.

**User Journey**:
```
1. [Home Screen - Map View]
   - App loads with user's current location detected
   - Map centered on user location
   - Search bar visible at top

2. [User taps search bar]
   - Search screen opens
   - Shows recent searches (if any)
   - Shows popular destinations
   - User types destination name (e.g., "Ikeja Mall")

3. [Search Results]
   - Location suggestions appear as user types
   - Each result shows name, address, distance
   - User selects destination

4. [Route Calculation]
   - Loading indicator shows "Finding best routes..."
   - Backend calculates multiple route options
   - Results screen displays 2-5 route suggestions

5. [Route Results Screen]
   - Route cards show:
     * Transport modes (bus → keke → walk)
     * Total time (45 mins)
     * Total fare (₦250)
     * Total distance (12.5 km)
   - User can compare routes side-by-side
   - User taps preferred route

6. [Route Details Screen]
   - Step-by-step instructions
   - Map view with route overlay
   - Fare breakdown
   - Estimated arrival time
   - Actions: "Start Navigation", "Report Issue", "Share"

7. [Navigation Mode] (Future)
   - Turn-by-turn directions
   - Real-time location tracking
   - Notifications for next step
```

**Key UX Elements**:
- ✅ Clear, simple interface
- ✅ Fast search with autocomplete
- ✅ Multiple route options for comparison
- ✅ Visual step-by-step guide
- ✅ Clear fare and time information

---

### Flow 2: Report Route/Fare Update

**Goal**: User wants to report incorrect route information or updated fare.

**User Journey**:
```
1. [Route Details Screen]
   - User notices incorrect information
   - Taps "Report Issue" button

2. [Report Type Selection]
   - Options appear:
     * "Route no dey work" (Route not working)
     * "Fare don change" (Fare changed)
     * "New route available"
     * "Stop location wrong"
     * "Other"
   - User selects appropriate option

3. [Report Details Form]
   - If "Fare don change":
     * Input field for new fare (₦)
     * Description text area
   - If "Stop location wrong":
     * Map picker for new location
     * Description text area
   - If "Route no dey work":
     * Description text area (required)
     - User fills form

4. [Submit Report]
   - Confirmation message: "Report submitted! Thank you"
   - Report status: "Pending Review"
   - Option to add more details
   - Return to route details

5. [Report Status] (Future)
   - User can view their reports in Profile
   - See status: Pending / Verified / Resolved
   - Get notified when report is verified
```

**Key UX Elements**:
- ✅ Simple, quick reporting process
- ✅ Context-aware form fields
- ✅ Clear confirmation feedback
- ✅ Option to view report status

---

### Flow 3: Filter by Transport Mode

**Goal**: User prefers specific transport modes (e.g., only okada, no buses).

**User Journey**:
```
1. [Home Screen]
   - Transport filter buttons visible:
     [🚌 Bus] [🛺 Keke] [🏍️ Okada] [🚶 Walk]
   - All modes selected by default

2. [User taps filter]
   - User deselects "Bus"
   - Filter updates: Only Keke, Okada, Walk routes shown

3. [Route Recalculation]
   - Loading: "Finding routes without bus..."
   - New routes displayed (filtered)
   - Routes may have longer time/distance
   - User selects route

4. [Route Details]
   - Shows filtered route with selected modes
   - Clear indication of chosen filters
   - Option to clear filters
```

**Key UX Elements**:
- ✅ Visual filter toggles
- ✅ Clear indication of active filters
- ✅ Fast recalculation
- ✅ Shows impact of filters (time/distance change)

---

### Flow 4: Save Favorite Places

**Goal**: User frequently visits certain places and wants quick access.

**User Journey**:
```
1. [Route Details Screen]
   - User finds a route they use often
   - Taps "Save Place" button
   - OR taps destination name to save

2. [Save Place Dialog]
   - Prompt: "Save [Destination Name] as favorite?"
   - User can rename (e.g., "Home", "Office", "Market")
   - User confirms

3. [Saved in Favorites]
   - Place appears in Profile > Saved Places
   - Can be accessed quickly from Home screen
   - Appears in search suggestions

4. [Quick Access]
   - User opens Home screen
   - Recent/Saved places shown at top
   - User taps saved place
   - Route search starts immediately
```

**Key UX Elements**:
- ✅ One-tap save option
- ✅ Custom naming for favorites
- ✅ Quick access from home screen
- ✅ Integration with search

---

## Secondary User Flows

### Flow 5: View Route History

**Goal**: User wants to see previously searched routes.

**User Journey**:
```
1. [Profile Screen]
   - User taps "Route History"

2. [Route History List]
   - Shows recent searches:
     * Origin → Destination
     * Date/time
     * Route summary (time, fare)
   - Most recent at top
   - User taps a history item

3. [Route Details]
   - Shows full route details
   - Option to use again
   - Option to save as favorite
```

---

### Flow 6: Share Route

**Goal**: User wants to share route with friend/family member.

**User Journey**:
```
1. [Route Details Screen]
   - User taps "Share" button

2. [Share Options]
   - Options:
     * Share via WhatsApp
     * Share via SMS
     * Copy link
     * Share via other apps

3. [Shared Content]
   - Message includes:
     * Route summary
     * Link to route in app
     * Map screenshot (future)
   - User selects app/platform

4. [Route Shared]
   - Confirmation: "Route shared successfully!"
```

---

### Flow 7: Find Nearby Stops

**Goal**: User wants to see transport stops near their location.

**User Journey**:
```
1. [Home Screen - Map View]
   - User taps "Nearby Stops" button
   - OR map shows stop markers automatically

2. [Nearby Stops List]
   - Shows stops within 1km radius:
     * Stop name
     * Stop type (Bus/Keke/Okada)
     * Distance
     * Address
   - Sorted by distance (nearest first)

3. [Stop Details]
   - User taps a stop
   - Shows:
     * Stop location on map
     * Routes passing through stop
     * Fares from this stop
     * User reports about stop
```

---

## Error Handling Flows

### Flow 8: No Route Found

**Scenario**: Backend cannot find a route between origin and destination.

**User Journey**:
```
1. [Route Search]
   - User searches for route
   - Backend returns no results

2. [Error Screen]
   - Message: "No routes found"
   - Suggestions:
     * "Try adjusting your destination"
     * "Try enabling more transport modes"
     * "Report if you know a route"
   - Actions:
     * "Adjust Search"
     * "Report Route"
     * "Go Back"

3. [User Action]
   - User adjusts search or reports route
```

**Key UX Elements**:
- ✅ Friendly, helpful error message
- ✅ Actionable suggestions
- ✅ Alternative paths forward
- ✅ No dead ends

---

### Flow 9: Location Permission Denied

**Scenario**: User denies location access.

**User Journey**:
```
1. [App Launch]
   - App requests location permission
   - User denies

2. [Permission Prompt]
   - Message: "Location needed for route search"
   - Explanation: "WakaWay needs your location to find nearby transport stops"
   - Actions:
     * "Enable Location"
     * "Enter Location Manually"
     * "Maybe Later"

3. [Manual Location Entry]
   - Map picker or address search
   - User selects location manually
   - App continues normally

4. [Settings Redirect] (if user taps "Enable Location")
   - Opens device settings
   - User enables location
   - Returns to app
   - Location detected automatically
```

---

### Flow 10: Network Error / Offline

**Scenario**: User has no internet connection.

**User Journey**:
```
1. [Network Request]
   - App tries to search routes
   - Network error occurs

2. [Error Message]
   - Message: "No internet connection"
   - Icon/illustration
   - Suggestions:
     * "Check your connection"
     * "Try again"
   - Option: "Use offline mode" (Future)

3. [Retry]
   - User taps "Try Again"
   - App retries request
   - Success or error shown again
```

---

## Nigerian Context Considerations

### Language & Terminology

**Local Terms**:
- ✅ Use "Danfo" for local buses
- ✅ Use "Keke" for tricycles
- ✅ Use "Okada" for motorbikes
- ✅ Use Nigerian Pidgin when appropriate
- ✅ Understand local landmarks and area names

**Example Messages**:
- "Where you dey go?" (Where are you going?)
- "Route no dey work" (Route not working)
- "Fare don change" (Fare has changed)
- "Waka easy, anywhere you dey" (Tagline)

### Cultural Considerations

**Transport Behavior**:
- ✅ Okada drivers may negotiate fares
- ✅ Bus routes may not have fixed schedules
- ✅ Some areas have restricted okada/bus access
- ✅ Rush hour significantly affects travel time

**Safety Considerations**:
- ✅ Show verified routes vs. user-reported routes
- ✅ Indicate safe areas (future)
- ✅ Emergency contacts (future)
- ✅ Share location feature (future)

### User Behavior Patterns

**Common Scenarios**:
1. **Morning Commute**: User needs fastest route to work
2. **Market Trip**: User needs cheapest route with okada/keke
3. **Evening Return**: User needs safe, well-lit routes
4. **Weekend Outing**: User doesn't mind longer routes with buses
5. **Emergency**: User needs fastest route regardless of cost

**Design Implications**:
- ✅ Show multiple route options (fastest vs. cheapest vs. most convenient)
- ✅ Indicate rush hour impact on travel time
- ✅ Allow fare negotiation indication
- ✅ Show route reliability/verification status

---

## Accessibility Considerations

### Visual Accessibility
- ✅ High contrast colors for outdoor visibility
- ✅ Large tap targets (minimum 44x44px)
- ✅ Clear typography hierarchy
- ✅ Icon + text labels (not icons alone)

### Motor Accessibility
- ✅ Swipe gestures for navigation
- ✅ Large touch targets
- ✅ Minimal fine motor skills required

### Cognitive Accessibility
- ✅ Simple, clear language
- ✅ Step-by-step instructions
- ✅ Visual aids (maps, icons)
- ✅ Error prevention (validation before submission)

---

## Performance Considerations

### Speed Requirements
- ✅ Route search: < 3 seconds
- ✅ Map rendering: < 1 second
- ✅ Search autocomplete: < 500ms
- ✅ Offline caching (future)

### Data Usage
- ✅ Minimize API calls
- ✅ Cache route data
- ✅ Compress map tiles
- ✅ Offline mode (future)

---

## Success Metrics

### User Engagement
- Routes searched per user per week
- Routes saved as favorites
- Reports submitted
- Routes shared

### Route Accuracy
- User-reported route issues
- Fare accuracy (reported vs. actual)
- Route verification rate

### User Satisfaction
- App store ratings
- User feedback
- Retention rate
- Daily active users

---

## Future Enhancements

### Phase 2 Features
- Real-time navigation with turn-by-turn directions
- Live traffic updates
- Payment integration (bus ticket booking)
- Driver/hawker ratings
- Emergency contacts and SOS feature
- Offline mode with cached routes
- Voice navigation in Nigerian languages
- AR-based navigation (future)

### Advanced Features
- ML-based route optimization
- Predictive arrival times
- Route recommendations based on user history
- Integration with ride-hailing apps
- Public transport schedules (where available)
- Bike-sharing integration
- Carpooling options (future)

