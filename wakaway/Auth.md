
# Auth

Real Firebase authentication — not mocked, and not Supabase auth (Supabase is used only for [[Community Contributions]] / [[AI Verification]] data, see [[Supabase Integration]]).

## AuthContext (`client/src/context/AuthContext.tsx`)

- **State**: `user` (name, email, avatar_url, phone), `firebaseUser`, `isLoading`, `isAuthenticated`.
- **Methods**: `login()`, `signup()`, `sendOTP()`, `verifyOTP()`, `logout()`, `updateProfile()`.
- **Phone auth**: Nigerian phone OTP, enforces the `+234` international prefix.

## Wiring into the rest of the app

`App.tsx` uses `isAuthenticated` to branch between the main app and `AuthStack` (`LoginScreen`/`SignupScreen`) — see [[Navigation & Screens]]. On auth state change, the Firebase ID token is injected into the Django API client via `wireAuthToken()`, so any future real calls to [[Backend API]] would be authenticated with the same Firebase identity.

## Related
[[Architecture]] · [[Navigation & Screens]] · [[Supabase Integration]] · [[Backend API]]
