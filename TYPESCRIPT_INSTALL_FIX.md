# TypeScript Errors Fix

## 🔴 Errors You're Seeing

```
1. Cannot find module 'expo-notifications' or its corresponding type declarations
2. Cannot find module 'expo-device' or its corresponding type declarations  
3. Type 'unknown[]' is not assignable to type 'InAppNotification[]'
```

## ✅ How to Fix

### Step 1: Install Missing Packages

The TypeScript errors are because the packages aren't installed yet. Run:

```bash
cd D:\mispro\mispronounciation

# Clear everything
rd /s /q node_modules
del package-lock.json

# Install dependencies
npm install

# If you get errors, try:
npm install --force
```

### Step 2: Verify Installation

After `npm install` completes, check that these packages exist:

```bash
dir node_modules\expo-notifications
dir node_modules\expo-device
```

You should see folders for both packages.

### Step 3: Restart TypeScript Server

In your IDE (VS Code/Cursor):
1. Press `Ctrl+Shift+P`
2. Type "TypeScript: Restart TS Server"
3. Press Enter

### Step 4: Rebuild Native Code

```bash
npx expo prebuild --clean
npx expo run:android
```

---

## 🔍 Why These Errors Happen

### Error 1 & 2: Module Not Found
```
Cannot find module 'expo-notifications'
Cannot find module 'expo-device'
```

**Cause:** These packages aren't installed in `node_modules` yet.

**Fix:** Run `npm install` (as shown above)

### Error 3: Type Issue
```
Type 'unknown[]' is not assignable to type 'InAppNotification[]'
```

**Cause:** TypeScript couldn't infer the type from Firebase data.

**Fix:** Already fixed with proper type casting:
```typescript
const notifications = snapshot.val() as Record<string, InAppNotification>;
return (Object.values(notifications) as InAppNotification[])
```

---

## 🚀 Complete Fresh Install

If you're still having issues, do a complete fresh install:

```bash
# 1. Navigate to project
cd D:\mispro\mispronounciation

# 2. Delete everything
rd /s /q node_modules
rd /s /q android
rd /s /q ios
del package-lock.json

# 3. Install dependencies
npm install

# 4. Prebuild
npx expo prebuild --clean

# 5. Run
npx expo run:android
```

---

## 📦 What Should Be Installed

After `npm install`, you should have:

```json
{
  "expo-notifications": "~0.29.8",
  "expo-device": "~7.1.4"
}
```

Check your `package.json` has these versions.

---

## ⚠️ Common Issues

### Issue 1: "No matching version found"
**Solution:** Make sure `package.json` has correct versions:
- `expo-notifications@~0.29.8` (NOT 0.30.13)
- `expo-device@~7.1.4`

### Issue 2: TypeScript still shows errors after install
**Solution:** 
1. Close all files in IDE
2. Restart TypeScript server
3. Reopen files

### Issue 3: "Module not found" after install
**Solution:**
```bash
# Clear TypeScript cache
rd /s /q node_modules\.cache
npm install
```

---

## ✅ Verification

After following these steps, verify:

1. ✅ `node_modules/expo-notifications` exists
2. ✅ `node_modules/expo-device` exists
3. ✅ TypeScript errors gone
4. ✅ `npm install` completed successfully
5. ✅ No red squiggly lines in IDE

---

## 🎯 Quick Fix Command Sequence

Copy and paste this entire block:

```bash
cd D:\mispro\mispronounciation
rd /s /q node_modules
del package-lock.json
npm install
```

Wait for installation to complete, then restart your IDE's TypeScript server.

---

## 📞 If Still Not Working

If errors persist after installation:

1. Check `package.json` has correct versions
2. Delete `node_modules` and `package-lock.json` again
3. Run `npm cache clean --force`
4. Run `npm install` again
5. Restart IDE completely (not just TS server)

---

**The errors will disappear once packages are installed! 🎉**
