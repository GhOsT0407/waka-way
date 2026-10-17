
# 0004 — Add `expo-image-picker` permission strings despite the camera flow being dead code

**Date:** 2026-07-02
**Status:** Decided, applied

## Context

Soft-launch audit flagged a missing iOS `NSCameraUsageDescription`. Investigation found the only `launchCameraAsync` call site is in [[Image Upload Service]], which no screen or component actually imports — the camera path is unreachable from the running app.

## Decision

Added the `expo-image-picker` config plugin to `app.config.js` with `cameraPermission`/`photosPermission` strings anyway, rather than skipping the fix because the code path is currently dead.

## Why

`expo-image-picker` is still a linked native dependency (in `package.json`), so Expo prebuild tooling and App Store review can still flag the missing usage strings based on the linked module alone, independent of whether any JS code calls it. Two-line config change, zero downside, removes a review-rejection risk even before the dead code is either wired up or deleted.

## Affected files
- `client/app.config.js`
- [[Image Upload Service]]
