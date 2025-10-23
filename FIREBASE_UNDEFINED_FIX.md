# Firebase Undefined Values Fix

## Problem

Firebase Realtime Database was rejecting data with `undefined` values, causing errors:

```
ERROR  Error saving daily word data: [Error: set failed: value argument contains undefined in property 'users.XXX.phonemeData.dailyWords.2025-10-23.aligned_reference']

ERROR  Error saving daily word attempt: [Error: set failed: value argument contains undefined in property 'users.XXX.dailyWords.2025-10-23.attemptHistory.0.scores.aligned_predicted']
```

### Root Causes:
1. **Optional phoneme data fields** (`aligned_reference`, `aligned_predicted`) were sometimes undefined
2. **Scores object** contained undefined properties when saving daily word attempts
3. **Firebase doesn't accept undefined** - it requires either a value or the field should be omitted entirely

---

## Solution

### 1. Created Helper Function to Clean Data

Added `cleanFirebaseData()` function to recursively remove undefined values from objects before saving:

**In `app/(tabs)/index.tsx`:**
```typescript
// Helper function to remove undefined values from objects (Firebase doesn't allow undefined)
const cleanFirebaseData = <T extends Record<string, any>>(obj: T): T => {
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanFirebaseData(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map(item => 
          item && typeof item === 'object' ? cleanFirebaseData(item) : item
        ).filter(item => item !== undefined);
      } else {
        cleaned[key] = value;
      }
    }
  });
  return cleaned as T;
};
```

**In `services/phonemeFirebaseService.ts`:**
Same helper function added to service file.

---

### 2. Updated Save Functions

#### A. `saveDailyWordAttempt()` in `index.tsx`

**Before:**
```typescript
const newAttempt: DailyWordAttempt = {
  timestamp,
  accuracy,
  feedback,
  correct_phonemes,
  total_phonemes,
  scores: result || undefined, // ❌ Could be undefined
};

// ...
await set(dailyRef, updatedProgress); // ❌ Could contain undefined
```

**After:**
```typescript
const newAttempt: DailyWordAttempt = {
  timestamp,
  accuracy,
  feedback,
  correct_phonemes,
  total_phonemes,
  ...(result && { scores: result }), // ✅ Only add if exists
};

// ...
const cleanedProgress = cleanFirebaseData(updatedProgress);
await set(dailyRef, cleanedProgress); // ✅ Clean data
```

#### B. Daily Word Data Saving in `processAudio()`

**Before:**
```typescript
await saveDailyWordData(today, {
  word: selectedWord.word,
  phonetic: selectedWord.phonetic,
  accuracy: resultData.accuracy,
  reference_phonemes: resultData.reference_phonemes, // ❌ Could be undefined
  predicted_phonemes: resultData.predicted_phonemes, // ❌ Could be undefined
  aligned_reference: resultData.aligned_reference,   // ❌ Could be undefined
  aligned_predicted: resultData.aligned_predicted,   // ❌ Could be undefined
  phoneme_breakdown: getPhonemeBreakdown(resultData),
} as any);
```

**After:**
```typescript
// Create daily word data object with only defined values
const dailyWordData: any = {
  word: selectedWord.word,
  phonetic: selectedWord.phonetic,
  accuracy: resultData.accuracy,
};

// Only add optional fields if they exist
if (resultData.reference_phonemes) {
  dailyWordData.reference_phonemes = resultData.reference_phonemes;
}
if (resultData.predicted_phonemes) {
  dailyWordData.predicted_phonemes = resultData.predicted_phonemes;
}
if (resultData.aligned_reference) {
  dailyWordData.aligned_reference = resultData.aligned_reference;
}
if (resultData.aligned_predicted) {
  dailyWordData.aligned_predicted = resultData.aligned_predicted;
}

// Add phoneme breakdown if available
const phonemeBreakdown = getPhonemeBreakdown(resultData);
if (phonemeBreakdown && phonemeBreakdown.length > 0) {
  dailyWordData.phoneme_breakdown = phonemeBreakdown;
}

// Clean and save
await saveDailyWordData(today, cleanFirebaseData(dailyWordData));
```

---

### 3. Updated Firebase Service Functions

#### `saveDailyWordData()`
```typescript
const dataToSave: DailyWordData = {
  // ... data
};

// Clean undefined values before saving
const cleanedData = cleanFirebaseData(dataToSave);
await set(ref(database, dailyPath), cleanedData);
```

#### `saveWordPhonemeData()`
```typescript
const dataToSave: WordPhonemeData = {
  // ... data
};

// Clean undefined values before saving
const cleanedData = cleanFirebaseData(dataToSave);
await set(ref(database, wordPath), cleanedData);
```

#### `savePhonemeAttempt()`
```typescript
// Clean undefined values before saving
const cleanedData = cleanFirebaseData(currentData);
await set(ref(database, phonemePath), cleanedData);
```

#### `updateWordProgressWithPhonemes()`
```typescript
// Build scores object with only defined values
const scoresData: any = {
  accuracy: scores.accuracy,
  correct_phonemes: scores.correct_phonemes || 0,
  total_phonemes: scores.total_phonemes || 0,
  feedback: scores.feedback || '',
};

// Only add arrays if they have values
if (scores.reference_phonemes && scores.reference_phonemes.length > 0) {
  scoresData.reference_phonemes = scores.reference_phonemes;
}
// ... similar for other arrays

const updatedProgress = {
  scores: scoresData,
  // ... other fields
};

// Clean undefined values before saving
const cleanedProgress = cleanFirebaseData(updatedProgress);
await update(ref(database, progressPath), cleanedProgress);
```

---

### 4. Added Data Reload After Save

To ensure UI displays latest data:

```typescript
// Update local state with the cleaned data
setTodayProgress(cleanedProgress as DailyWordProgress);

// Update streak if this is the first practice today
await updateStreakForToday(user.uid, today);

// Reload the progress to ensure we have the latest data
await loadDailyWordProgress(user.uid);
```

---

## Files Modified

1. **`app/(tabs)/index.tsx`**
   - Added `cleanFirebaseData()` helper function
   - Updated `saveDailyWordAttempt()` to clean data
   - Updated daily word save logic in `processAudio()`
   - Added explicit data reload after save

2. **`services/phonemeFirebaseService.ts`**
   - Added `cleanFirebaseData()` helper function
   - Updated `saveDailyWordData()` to clean data
   - Updated `saveWordPhonemeData()` to clean data
   - Updated `savePhonemeAttempt()` to clean data
   - Updated `updateWordProgressWithPhonemes()` to only include defined values

---

## Testing Checklist

- [x] Daily word attempts save successfully
- [x] Daily word progress saves successfully
- [x] Phoneme data saves successfully
- [x] No Firebase errors about undefined values
- [x] Latest data displays correctly in UI
- [x] Attempt history is preserved
- [x] Real-time updates work correctly

---

## Results

### Before:
```
❌ Firebase errors about undefined values
❌ Data not saving
❌ Attempts not recorded
❌ UI not showing latest data
```

### After:
```
✅ All data saves successfully
✅ No Firebase errors
✅ Attempts recorded properly
✅ UI displays latest data
✅ Real-time updates work
✅ Phoneme data persists correctly
```

---

## Key Learnings

1. **Firebase doesn't accept undefined** - Always clean data before saving
2. **Use conditional spreads** - `...(value && { key: value })` pattern
3. **Explicit checks for arrays** - Ensure arrays have length before saving
4. **Clean nested objects** - Recursively handle complex data structures
5. **Reload after save** - Ensure UI has latest data from database

---

## Summary

All Firebase save operations now properly handle undefined values by:
1. Creating a helper function to recursively clean data
2. Using conditional spreads for optional fields
3. Explicit checks for array and object values
4. Cleaning data before every Firebase write operation
5. Reloading data after saves to ensure UI accuracy

Daily word saves, attempts, and phoneme data now persist correctly to Firebase! 🎉
