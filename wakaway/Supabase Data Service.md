
# Supabase Data Service

`client/src/services/supabaseDataService.ts` — the general-purpose Supabase CRUD layer (no local fallback, unlike [[Report Service]]).

## What it does

Covers favorite places (home/work/favorite), route history, saved routes, community contributions (read/vote), and user profiles — the primary persistence surface for anything per-user beyond quick reports.

## Key exports

- Favorites: `getFavoritePlaces`, `upsertFavoritePlace`, `deleteFavoritePlace`
- Route history: `getRouteHistory`, `addRouteHistory`, `deleteRouteHistory`, `clearAllRouteHistory`
- Saved routes: `getSavedRoutes`, `saveRoute`, `deleteSavedRoute`
- Contributions: `getNearbyContributions` (RPC `get_contributions_within_radius`), `getAllContributions`
- `voteOnContribution(contributionId, userId, vote)` — upserts a vote row and bumps `confirms`/`dismisses` — a **separate voting path** from the RPC `vote_on_contribution` used by [[useContributions Hook]]; see [[Service Duplication & Dead Code]]
- `getUserProfile`, `updateUserProfile`

## Dependencies

The Supabase client from [[Supabase Integration]]; type-only import of `SmartRouteResult`/`RouteOption` from [[Smart Routing Engine]] (for `addRouteHistory`/`saveRoute` signatures).

## Used by

`NotificationsScreen`, `PreferencesScreen`, `SearchScreen`, `RouteDetailScreen`, `YouScreen` (see [[Navigation & Screens]]).

## Related
[[Architecture]] · [[Supabase Integration]] · [[Smart Routing Engine]] · [[Community Contributions]] · [[useContributions Hook]] · [[Service Duplication & Dead Code]]
