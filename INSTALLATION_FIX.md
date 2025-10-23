# Installation Fix - Correct Package Versions

## Issue
The original implementation specified `expo-notifications@~0.30.13` which doesn't exist.

## Fix Applied
Changed to `expo-notifications@~0.29.8` which is compatible with Expo SDK 53.

## Installation Steps

### On Windows (Your System):

```bash
# 1. Navigate to project directory
cd D:\mispro\mispronounciation

# 2. Clear any cached data
rd /s /q node_modules
del package-lock.json

# 3. Install dependencies
npm install

# 4. Clean and rebuild
npx expo prebuild --clean

# 5. Run on Android
npx expo run:android
```

### On Linux/Mac:

```bash
# 1. Navigate to project directory
cd mispronounciation

# 2. Clear any cached data
rm -rf node_modules package-lock.json

# 3. Install dependencies
npm install

# 4. Clean and rebuild
npx expo prebuild --clean

# 5. Run on Android
npx expo run:android
```

## Verified Compatibility

For **Expo SDK 53**:
- ✅ `expo-notifications@~0.29.8`
- ✅ `expo-device@~7.1.4`

These versions are confirmed to work with:
- `expo@~53.0.22`
- `react-native@0.79.6`

## Alternative: Use Expo Install Command

After fixing package.json, you can also use:
```bash
npx expo install --fix
```

This will automatically correct any version mismatches for your SDK version.

## Expected Result

After running these commands, you should see:
```
✔ Built Expo modules
✔ Installed dependencies
✔ Configured Android project
```

Then the app will build and launch on your Android device/emulator.
