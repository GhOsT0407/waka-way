# WakaWay - Design Documentation

## Table of Contents
1. [Brand Identity](#brand-identity)
2. [UI/UX Design System](#uiux-design-system)
3. [Wireframes](#wireframes)
4. [Screen Mockups](#screen-mockups)
5. [User Flows](#user-flows)

---

## Brand Identity

### App Name
**WakaWay** - "Find your WakaWay"
- Derived from "Waka" (Nigerian pidgin for "walk/move") + "Way"
- Taglines: "Move Smart. Move Local", "Your Way. The Naija Way", "Waka easy, anywhere you dey."

### Brand Personality
- **Friendly**: Approachable, warm, welcoming
- **Helpful**: Always there when users need navigation assistance
- **Street-smart**: Understanding of local transport nuances
- **Nigerian**: Authentic, culturally aware, community-focused

### Logo Concepts
1. **Map pin with road forming "W"**: Combines navigation and identity
2. **Stylized "W" made of curved paths/arrows**: Represents movement and routes
3. **Minimalist keke/okada silhouette forming "W"**: Local transport integration

### App Icon
- **Design**: White "W" on Lagos Green (#2ECC71) background
- **Style**: Flat design, simple, scalable
- **Rounded corners**: Modern iOS/Android standards

---

## UI/UX Design System

### Color Palette

#### Primary Colors
- **Lagos Green**: `#2ECC71` - Primary actions, app icon, highlights
- **Vibrant Purple**: `#6C63FF` - Secondary actions, accents
- **Soft White**: `#F7F7F7` - Backgrounds, cards

#### Accent Colors
- **Okada Orange**: `#FFA726` - Warnings, special routes, alerts
- **Deep Charcoal**: `#222222` - Primary text, headers

#### Status Colors
- **Success**: `#2ECC71` (Lagos Green)
- **Warning**: `#FFA726` (Okada Orange)
- **Error**: `#E74C3C`
- **Info**: `#3498DB`

### Typography

#### Primary Fonts
- **Poppins** (Primary): Body text, buttons, labels
  - Regular: 400
  - Medium: 500
  - Semi-Bold: 600
  - Bold: 700

- **Nunito Sans** (Alternative Primary): Secondary text
  - Regular: 400
  - Semi-Bold: 600
  - Bold: 700

#### Display Fonts
- **Raleway Bold**: Headings, hero text, display elements

#### Font Sizes
- **Display Large**: 32px (Raleway Bold)
- **Display Medium**: 24px (Raleway Bold)
- **Heading 1**: 20px (Poppins Bold)
- **Heading 2**: 18px (Poppins Semi-Bold)
- **Body Large**: 16px (Poppins Regular)
- **Body**: 14px (Poppins Regular)
- **Caption**: 12px (Poppins Regular)
- **Small**: 10px (Poppins Regular)

### Spacing & Layout

#### Spacing Scale
- **xs**: 4px
- **sm**: 8px
- **md**: 16px
- **lg**: 24px
- **xl**: 32px
- **xxl**: 48px

#### Border Radius
- **Small**: 8px (buttons, small cards)
- **Medium**: 12px (cards, inputs)
- **Large**: 16px (modal, containers)
- **Round**: 50% (avatars, icons)

#### Shadows
- **Card Shadow**: `0 2px 8px rgba(0, 0, 0, 0.1)`
- **Elevated Shadow**: `0 4px 16px rgba(0, 0, 0, 0.15)`
- **Button Shadow**: `0 2px 4px rgba(46, 204, 113, 0.3)`

---

## Wireframes

### 1. Home Screen (Map View)

```
┌─────────────────────────────────────┐
│  [☰]  WakaWay          [🔔] [👤]   │  ← Header
├─────────────────────────────────────┤
│                                     │
│                                     │
│          [📍 Current Location]      │  ← Map View
│                                     │
│                                     │
│              🗺️                     │
│                                     │
│                                     │
│         [📍 Destination]            │
│                                     │
├─────────────────────────────────────┤
│  Where you dey go?                  │  ← Search Bar
│  ┌─────────────────────────────┐   │
│  │ 🔍 Search destination...    │   │
│  └─────────────────────────────┘   │
│                                     │
│  [🚌] Buses  [🏍️] Okada  [🛺] Keke │  ← Transport Filters
│  [🚶] Walk                          │
├─────────────────────────────────────┤
│  Suggested Routes                   │
│  ┌─────────────────────────────────┐│
│  │ 🚌 Bus → 🛺 Keke → 🚶 Walk     ││  ← Route Card 1
│  │ 45 mins  •  ₦250                ││
│  └─────────────────────────────────┘│
│  ┌─────────────────────────────────┐│
│  │ 🏍️ Okada → 🚶 Walk             ││  ← Route Card 2
│  │ 30 mins  •  ₦150                ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 2. Route Details Screen

```
┌─────────────────────────────────────┐
│  [←] Route Details                  │  ← Header
├─────────────────────────────────────┤
│                                     │
│  Current Location → Destination     │  ← Route Summary
│  30 mins  •  ₦150                   │
│                                     │
├─────────────────────────────────────┤
│  Step-by-step Directions            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 1. Walk to Bus Stop         │   │  ← Step 1
│  │    5 mins • 0.2 km          │   │
│  │    → Turn right on Main St  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 2. Take Bus #47             │   │  ← Step 2
│  │    15 mins • ₦100           │   │
│  │    → Get off at Oshodi      │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 3. Walk to Destination      │   │  ← Step 3
│  │    10 mins • 0.5 km         │   │
│  │    → Continue straight      │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  [📍] View on Map  [⚠️] Report Issue│  ← Actions
└─────────────────────────────────────┘
```

### 3. Search Screen

```
┌─────────────────────────────────────┐
│  [←] Search Destination             │  ← Header
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 🔍 Lagos Island...          │   │  ← Search Input
│  └─────────────────────────────┘   │
│                                     │
│  Recent Searches                    │  ← Section
│  ┌─────────────────────────────┐   │
│  │ 📍 Ikeja City Mall          │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📍 Victoria Island          │   │
│  └─────────────────────────────┘   │
│                                     │
│  Popular Destinations               │  ← Section
│  ┌─────────────────────────────┐   │
│  │ 🏛️ National Museum Lagos    │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🛒 Shoprite Ikeja           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🏥 Lagos University Hospital│   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 4. Route Report Screen

```
┌─────────────────────────────────────┐
│  [←] Report Route/Update            │  ← Header
├─────────────────────────────────────┤
│                                     │
│  What you want report?              │  ← Question
│                                     │
│  ┌─────────────────────────────┐   │
│  │ [ ] Route no dey work       │   │  ← Options
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [ ] Fare don change         │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [ ] New route available     │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ [ ] Stop location wrong     │   │
│  └─────────────────────────────┘   │
│                                     │
│  Additional Details                 │
│  ┌─────────────────────────────┐   │
│  │ Tell us more...             │   │  ← Text Input
│  │                             │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Updated Fare (if applicable)       │
│  ┌─────────────────────────────┐   │
│  │ ₦  [Enter new fare]         │   │
│  └─────────────────────────────┘   │
│                                     │
│         [Submit Report]             │  ← Button
└─────────────────────────────────────┘
```

### 5. Profile/Settings Screen

```
┌─────────────────────────────────────┐
│  [←] Profile                        │  ← Header
├─────────────────────────────────────┤
│                                     │
│           👤                        │  ← Avatar
│        Your Name                    │
│     user@example.com                │
│                                     │
├─────────────────────────────────────┤
│  My Activity                        │  ← Section
│  ┌─────────────────────────────┐   │
│  │ 📍 Saved Places             │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🗺️ Route History            │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📝 My Reports               │   │
│  └─────────────────────────────┘   │
│                                     │
│  Settings                           │  ← Section
│  ┌─────────────────────────────┐   │
│  │ 🔔 Notifications            │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 📍 Location Services        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 🌍 Language (Pidgin/English)│   │
│  └─────────────────────────────┘   │
│                                     │
│  About                              │  ← Section
│  ┌─────────────────────────────┐   │
│  │ 📖 Help & Support           │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ ℹ️ About WakaWay            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## Screen Mockups

### Key UI Components

#### 1. Transport Mode Icons
- **Bus (Danfo)**: 🚌 Green/Yellow bus icon
- **Okada**: 🏍️ Orange motorcycle icon
- **Keke**: 🛺 Yellow tricycle icon
- **Walk**: 🚶 Blue walking icon

#### 2. Route Card Component
```
┌─────────────────────────────────────────┐
│ 🚌 Bus → 🛺 Keke → 🚶 Walk              │  Transport modes
│                                         │
│ ⏱️ 45 mins  •  💰 ₦250                 │  Time & Fare
│ 📍 2.3 km total distance                │  Distance
│                                         │
│ [View Details] [🔗 Share]               │  Actions
└─────────────────────────────────────────┘
```

#### 3. Step-by-Step Instruction Card
```
┌─────────────────────────────────────────┐
│ 1️⃣  Walk to Bus Stop                   │  Step number & title
│                                         │
│ ⏱️ 5 mins  •  📍 0.2 km                │  Duration & distance
│                                         │
│ → Turn right on Main Street             │  Instructions
│ → Continue for 200m                     │
│ → Bus stop on your left                 │
│                                         │
│ [📍 Show on Map]                        │  Action
└─────────────────────────────────────────┘
```

#### 4. Fare Breakdown Card
```
┌─────────────────────────────────────────┐
│ 💰 Fare Breakdown                       │
│                                         │
│ Bus #47:            ₦100                │
│ Keke:               ₦100                │
│ Walk:               ₦0                  │
│ ───────────────────────────             │
│ Total:              ₦200                │
│                                         │
│ *Fares are estimates and may vary       │
└─────────────────────────────────────────┘
```

---

## User Flows

### Flow 1: Basic Route Search

```
[Home Screen]
    ↓
[User taps search bar]
    ↓
[Search Screen]
    ↓
[User enters destination]
    ↓
[Search Results / Location Selection]
    ↓
[Route Calculation Loading]
    ↓
[Route Results Screen]
    ↓
[User selects route]
    ↓
[Route Details Screen]
    ↓
[Navigation/Map View]
```

### Flow 2: Report Route/Fare Update

```
[Route Details Screen]
    ↓
[User taps "Report Issue"]
    ↓
[Report Screen - Select Issue Type]
    ↓
[User selects issue (e.g., "Fare don change")]
    ↓
[User enters details & new fare]
    ↓
[User submits report]
    ↓
[Success confirmation]
    ↓
[Return to Route Details]
```

### Flow 3: Filter by Transport Mode

```
[Home Screen]
    ↓
[User taps transport filter (e.g., "Okada only")]
    ↓
[Filter applied - routes recalculated]
    ↓
[Route results filtered]
    ↓
[User selects filtered route]
    ↓
[Route Details Screen]
```

### Flow 4: View Saved Places

```
[Profile Screen]
    ↓
[User taps "Saved Places"]
    ↓
[Saved Places List]
    ↓
[User selects place]
    ↓
[Route search with saved place as destination]
    ↓
[Route Results Screen]
```

---

## Design Principles

### 1. Cultural Sensitivity
- Use Nigerian Pidgin English appropriately (optional toggle)
- Understand local transport terminology (danfo, okada, keke)
- Respect cultural context and urban navigation challenges

### 2. Accessibility
- High contrast for outdoor visibility
- Large tap targets (minimum 44x44px)
- Clear typography hierarchy
- Voice navigation support (future)

### 3. Performance
- Fast initial load (< 3 seconds)
- Smooth map interactions (60fps)
- Offline route caching (future)
- Efficient data usage

### 4. Trust & Safety
- Clear fare estimates with disclaimers
- User reports and verification system
- Safe route indicators (future)
- Emergency contacts integration (future)

---

## Next Steps for Visual Design

1. **High-Fidelity Mockups**: Create detailed Figma/Sketch designs
2. **Component Library**: Build reusable React Native components
3. **Prototype**: Interactive prototype for user testing
4. **Icon Set**: Custom icons for transport modes
5. **Animation Guidelines**: Micro-interactions and transitions

