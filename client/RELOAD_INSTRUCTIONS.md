# How to Reload the WakaWay App

If you're seeing "Open up App.tsx to start working on your app!" instead of the WakaWay home screen, follow these steps:

## Quick Fix - Reload the App

1. **In Expo Go (on your phone)**:
   - Shake your device (or press `Cmd+D` on iOS simulator / `Cmd+M` on Android)
   - Select "Reload" from the developer menu

2. **In the terminal where Expo is running**:
   - Press `r` to reload the app
   - Or press `shift+r` to clear cache and reload

3. **If that doesn't work**:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   cd waka-way/client
   npm start
   # Or
   npx expo start --clear
   ```

## Force Clear Cache

```bash
cd waka-way/client

# Clear Expo cache
npx expo start --clear

# Or clear everything and restart
rm -rf node_modules
npm install
npx expo start --clear
```

## Verify the Files

Make sure these files exist:
- ✅ `src/App.tsx` - Should import HomeScreen
- ✅ `src/screens/HomeScreen.tsx` - Should contain the home screen UI
- ✅ `src/components/search/SearchBar.tsx` - Should exist
- ✅ `src/utils/constants.ts` - Should contain color constants

## Common Issues

### Issue: Still seeing old screen
**Solution**: The Metro bundler might be cached. Try:
```bash
npx expo start --clear
```

### Issue: Red screen with errors
**Solution**: Check the error message in Expo Go or terminal. Common fixes:
- Make sure all dependencies are installed: `npm install`
- Check for TypeScript errors: `npx tsc --noEmit`
- Restart the Metro bundler

### Issue: App crashes on load
**Solution**: 
- Check the terminal for error messages
- Make sure React Navigation is properly installed
- Verify all imports are correct

## Expected Result

After reloading, you should see:
- ✅ WakaWay logo and header
- ✅ "Find your WakaWay" welcome message
- ✅ Search bar with "Where you dey go?"
- ✅ Transport mode filters (Bus, Keke, Okada, Walk)
- ✅ Quick actions section
- ✅ Popular destinations
- ✅ Map placeholder

If you still see the old message, the app might not be picking up the changes. Make sure you're editing the correct `App.tsx` file in `src/App.tsx`.

