
# Image Upload Service

`client/src/services/imageUploadService.ts` — wraps `expo-image-picker` (permissions + picker launch) and Supabase Storage upload/delete/signed-URL logic for report photos, targeting the `report-images` bucket.

## Status — dead code

A repo-wide search found **zero imports** of this file, `ImagePicker`, `launchCamera`, or `takePhoto` anywhere in `client/src/**/*.tsx`. Not wired into any screen or component — the "attach a photo to a report" feature implied by the `contributions.image_url` column (see [[Community Contributions]]) does not exist in the reachable UI yet. See [[Service Duplication & Dead Code]].

Note: because `expo-image-picker` is still a linked native dependency, the `expo-image-picker` config plugin (with `cameraPermission`/`photosPermission` strings) was added to `app.config.js` defensively, independent of whether this service gets wired up.

## Key exports

- `requestCameraPermissions`, `requestMediaLibraryPermissions`
- `pickImageFromLibrary()`, `takePhoto()`
- `uploadImageToSupabase(base64Data, mimeType?, fileName?)`
- `pickAndUploadImage()`, `takePhotoAndUpload()`
- `deleteImage(filePath)`, `getSignedUrl(filePath, expiresIn?)`

## Dependencies

The Supabase client from [[Supabase Integration]]; external `expo-image-picker`, `expo-file-system`, `base64-arraybuffer`.

## Related
[[Architecture]] · [[Community Contributions]] · [[Supabase Integration]] · [[Service Duplication & Dead Code]]
