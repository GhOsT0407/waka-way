
# Navigation & Screens

`client/src/App.tsx` is the entry point: loads Plus Jakarta Sans fonts, wraps the app in `ErrorBoundary` → `SafeAreaProvider` → `GestureHandlerRootView` → `AuthProvider` → `ThemeProvider` → `ToastProvider`, shows a custom `WakaWaySplash` while fonts/auth resolve, then hands off to the navigator. Whether the user lands on the main app or `AuthStack` depends on [[Auth]] state.

## Screens (`client/src/screens/`)

| Screen | Purpose |
|---|---|
| `HomeScreen` | Map + search entry, hosts `LiveAlertsFeed` and `QuickReportBar` (see [[Community Contributions]]) |
| `SearchScreen` | Autocomplete destination search with recent searches |
| `RouteDetailScreen` | Route breakdown, fares, share modal — hosts `FareDisputeModal` |
| `NavigationScreen` | Active turn-by-turn navigation with geofencing alerts |
| `ContributionScreen` | Submit a new traffic/security/hazard alert |
| `YouScreen` | Profile, saved places, history, preferences |
| `NotificationsScreen` | Incoming alerts & confirmations |
| `PreferencesScreen` | Theme, transport preferences, notification settings |
| `LoginScreen` / `SignupScreen` | Firebase email/password + phone OTP |
| `OnboardingScreen` | First-run setup, tracked in AsyncStorage (`ONBOARDING_DONE_KEY`) |
| `WakaWaySplash` | Brand splash before the app finishes loading |

## Related
[[Architecture]] · [[Auth]] · [[Theming]] · [[Community Contributions]] · [[Smart Routing Engine]]
