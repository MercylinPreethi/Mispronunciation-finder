# Firebase Realtime Database Structure

## Overview
This document outlines the complete Firebase Realtime Database structure for the Pronunciation Learning App.

---

## Database Schema

```json
{
  "users": {
    "{userId}": {
      "profile": {
        "displayName": "John Doe",
        "email": "john@example.com",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "lastLoginAt": "2024-10-13T08:15:00.000Z"
      },
      
      "stats": {
        "streak": 7,
        "totalWords": 45,
        "accuracy": 0.87,
        "xp": 420,
        "lastCompletedDate": "2024-10-13"
      },
      
      "dailyWords": {
        "2024-10-13": {
          "word": "Beautiful",
          "date": "2024-10-13",
          "completed": true,
          "accuracy": 0.92,
          "attempts": 3,
          "bestScore": 0.92
        },
        "2024-10-12": {
          "word": "Schedule",
          "date": "2024-10-12",
          "completed": true,
          "accuracy": 0.85,
          "attempts": 2,
          "bestScore": 0.88
        },
        "2024-10-11": {
          "word": "Algorithm",
          "date": "2024-10-11",
          "completed": true,
          "accuracy": 0.78,
          "attempts": 4,
          "bestScore": 0.84
        }
      },
      
      "practiceWords": {
        "easy": {
          "e1": {
            "wordId": "e1",
            "word": "Cat",
            "completed": true,
            "attempts": 2,
            "bestScore": 0.95,
            "lastAttempted": "2024-10-13T09:20:00.000Z"
          },
          "e2": {
            "wordId": "e2",
            "word": "Dog",
            "completed": true,
            "attempts": 1,
            "bestScore": 0.98,
            "lastAttempted": "2024-10-13T09:25:00.000Z"
          },
          "e3": {
            "wordId": "e3",
            "word": "Book",
            "completed": false,
            "attempts": 1,
            "bestScore": 0.72,
            "lastAttempted": "2024-10-13T09:30:00.000Z"
          }
        },
        
        "intermediate": {
          "i1": {
            "wordId": "i1",
            "word": "Comfortable",
            "completed": true,
            "attempts": 3,
            "bestScore": 0.88,
            "lastAttempted": "2024-10-12T14:15:00.000Z"
          },
          "i2": {
            "wordId": "i2",
            "word": "Develop",
            "completed": false,
            "attempts": 2,
            "bestScore": 0.75,
            "lastAttempted": "2024-10-12T14:20:00.000Z"
          }
        },
        
        "hard": {
          "h1": {
            "wordId": "h1",
            "word": "Epitome",
            "completed": true,
            "attempts": 5,
            "bestScore": 0.82,
            "lastAttempted": "2024-10-11T16:45:00.000Z"
          },
          "h2": {
            "wordId": "h2",
            "word": "Worcestershire",
            "completed": false,
            "attempts": 4,
            "bestScore": 0.68,
            "lastAttempted": "2024-10-11T16:50:00.000Z"
          }
        }
      }
    }
  }
}
```

---

## Data Structure Details

### 1. **Users Collection**
```
users/
  └── {userId}/  (Firebase Auth UID)
```

### 2. **Profile Data**
```json
{
  "displayName": "string",     // User's full name
  "email": "string",           // User's email address
  "createdAt": "ISO timestamp", // Account creation date
  "lastLoginAt": "ISO timestamp" // Last login timestamp
}
```

### 3. **Stats Object**
```json
{
  "streak": "number",          // Consecutive days of practice
  "totalWords": "number",      // Total unique words practiced
  "accuracy": "number",        // Average accuracy (0.0 - 1.0)
  "xp": "number",             // Total experience points
  "lastCompletedDate": "string" // Last practice date (YYYY-MM-DD)
}
```

**Calculations:**
- `streak`: Calculated from consecutive daily practice
- `totalWords`: Count of unique completed words
- `accuracy`: Average of all bestScores
- `xp`: Sum of (accuracy * 10) for all attempts
- `lastCompletedDate`: Most recent practice date

### 4. **Daily Words**
```
dailyWords/
  └── {date}/  (YYYY-MM-DD format)
      └── {DailyWordProgress}
```

**DailyWordProgress Object:**
```json
{
  "word": "string",           // The daily word
  "date": "YYYY-MM-DD",       // Practice date
  "completed": "boolean",     // True if accuracy >= 0.8
  "accuracy": "number",       // Latest attempt accuracy
  "attempts": "number",       // Number of attempts
  "bestScore": "number"       // Best accuracy achieved
}
```

**Example:**
```json
"2024-10-13": {
  "word": "Beautiful",
  "date": "2024-10-13",
  "completed": true,
  "accuracy": 0.92,
  "attempts": 3,
  "bestScore": 0.92
}
```

### 5. **Practice Words**
```
practiceWords/
  ├── easy/
  │   └── {wordId}/
  ├── intermediate/
  │   └── {wordId}/
  └── hard/
      └── {wordId}/
```

**WordProgress Object:**
```json
{
  "wordId": "string",         // Unique word identifier (e.g., "e1", "i5", "h3")
  "word": "string",           // The word text
  "completed": "boolean",     // True if accuracy >= 0.8
  "attempts": "number",       // Number of practice attempts
  "bestScore": "number",      // Best accuracy achieved (0.0 - 1.0)
  "lastAttempted": "ISO timestamp" // Last practice timestamp
}
```

**Example - Easy Level:**
```json
"easy": {
  "e1": {
    "wordId": "e1",
    "word": "Cat",
    "completed": true,
    "attempts": 2,
    "bestScore": 0.95,
    "lastAttempted": "2024-10-13T09:20:00.000Z"
  },
  "e2": {
    "wordId": "e2",
    "word": "Dog",
    "completed": false,
    "attempts": 1,
    "bestScore": 0.72,
    "lastAttempted": "2024-10-13T09:25:00.000Z"
  }
}
```

---

## Firebase Security Rules

```json
{
  "rules": {
    "users": {
      "$userId": {
        ".read": "$userId === auth.uid",
        ".write": "$userId === auth.uid",
        
        "profile": {
          ".validate": "newData.hasChildren(['displayName', 'email'])"
        },
        
        "stats": {
          ".validate": "newData.hasChildren(['streak', 'totalWords', 'accuracy', 'xp'])"
        },
        
        "dailyWords": {
          "$date": {
            ".validate": "newData.hasChildren(['word', 'date', 'completed', 'accuracy', 'attempts', 'bestScore'])"
          }
        },
        
        "practiceWords": {
          "$difficulty": {
            ".validate": "$difficulty === 'easy' || $difficulty === 'intermediate' || $difficulty === 'hard'",
            "$wordId": {
              ".validate": "newData.hasChildren(['wordId', 'word', 'completed', 'attempts', 'bestScore', 'lastAttempted'])"
            }
          }
        }
      }
    }
  }
}
```

---

## Data Access Patterns

### **Read Operations:**

```typescript
// 1. Get user stats
const statsRef = ref(database, `users/${userId}/stats`);
const snapshot = await get(statsRef);
const stats = snapshot.val();

// 2. Listen to stats updates (real-time)
onValue(statsRef, (snapshot) => {
  const data = snapshot.val();
  setStats(data);
});

// 3. Get today's daily word progress
const todayDate = '2024-10-13';
const dailyRef = ref(database, `users/${userId}/dailyWords/${todayDate}`);
const snapshot = await get(dailyRef);

// 4. Get all practice words for a difficulty
const easyRef = ref(database, `users/${userId}/practiceWords/easy`);
const snapshot = await get(easyRef);
const easyWords = snapshot.val();

// 5. Get specific word progress
const wordRef = ref(database, `users/${userId}/practiceWords/easy/e1`);
const snapshot = await get(wordRef);
```

### **Write Operations:**

```typescript
// 1. Update stats
const statsRef = ref(database, `users/${userId}/stats`);
await set(statsRef, {
  streak: 7,
  totalWords: 45,
  accuracy: 0.87,
  xp: 420
});

// 2. Update daily word progress
const todayDate = '2024-10-13';
const dailyRef = ref(database, `users/${userId}/dailyWords/${todayDate}`);
await set(dailyRef, {
  word: 'Beautiful',
  date: todayDate,
  completed: true,
  accuracy: 0.92,
  attempts: 3,
  bestScore: 0.92
});

// 3. Update practice word progress
const wordRef = ref(database, `users/${userId}/practiceWords/easy/e1`);
await set(wordRef, {
  wordId: 'e1',
  word: 'Cat',
  completed: true,
  attempts: 2,
  bestScore: 0.95,
  lastAttempted: new Date().toISOString()
});

// 4. Update multiple stats atomically
import { update } from 'firebase/database';
const updates = {};
updates[`users/${userId}/stats/xp`] = 450;
updates[`users/${userId}/stats/totalWords`] = 46;
await update(ref(database), updates);
```

---

## Example: Complete User Data

```json
{
  "users": {
    "abc123xyz": {
      "profile": {
        "displayName": "Sarah Johnson",
        "email": "sarah@example.com",
        "createdAt": "2024-09-01T12:00:00.000Z",
        "lastLoginAt": "2024-10-13T08:30:00.000Z"
      },
      
      "stats": {
        "streak": 15,
        "totalWords": 67,
        "accuracy": 0.89,
        "xp": 598,
        "lastCompletedDate": "2024-10-13"
      },
      
      "dailyWords": {
        "2024-10-13": {
          "word": "Beautiful",
          "date": "2024-10-13",
          "completed": true,
          "accuracy": 0.92,
          "attempts": 2,
          "bestScore": 0.92
        },
        "2024-10-12": {
          "word": "Pronunciation",
          "date": "2024-10-12",
          "completed": true,
          "accuracy": 0.88,
          "attempts": 3,
          "bestScore": 0.88
        }
      },
      
      "practiceWords": {
        "easy": {
          "e1": {
            "wordId": "e1",
            "word": "Cat",
            "completed": true,
            "attempts": 1,
            "bestScore": 0.98,
            "lastAttempted": "2024-10-10T10:15:00.000Z"
          },
          "e2": {
            "wordId": "e2",
            "word": "Dog",
            "completed": true,
            "attempts": 1,
            "bestScore": 0.96,
            "lastAttempted": "2024-10-10T10:20:00.000Z"
          },
          "e3": {
            "wordId": "e3",
            "word": "Book",
            "completed": true,
            "attempts": 2,
            "bestScore": 0.93,
            "lastAttempted": "2024-10-10T10:25:00.000Z"
          }
        },
        
        "intermediate": {
          "i1": {
            "wordId": "i1",
            "word": "Comfortable",
            "completed": true,
            "attempts": 3,
            "bestScore": 0.85,
            "lastAttempted": "2024-10-11T14:00:00.000Z"
          },
          "i2": {
            "wordId": "i2",
            "word": "Develop",
            "completed": false,
            "attempts": 2,
            "bestScore": 0.73,
            "lastAttempted": "2024-10-11T14:10:00.000Z"
          }
        },
        
        "hard": {
          "h1": {
            "wordId": "h1",
            "word": "Epitome",
            "completed": false,
            "attempts": 4,
            "bestScore": 0.68,
            "lastAttempted": "2024-10-12T16:30:00.000Z"
          }
        }
      }
    }
  }
}
```

---

## Data Types

### **User Profile**
| Field | Type | Description |
|-------|------|-------------|
| `displayName` | string | User's full name |
| `email` | string | User's email address |
| `createdAt` | ISO timestamp | Account creation date |
| `lastLoginAt` | ISO timestamp | Last login timestamp |

### **User Stats**
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `streak` | number | 0+ | Consecutive days of practice |
| `totalWords` | number | 0+ | Total unique words completed |
| `accuracy` | number | 0.0 - 1.0 | Average pronunciation accuracy |
| `xp` | number | 0+ | Total experience points earned |
| `lastCompletedDate` | string | YYYY-MM-DD | Most recent practice date |

### **Daily Word Progress**
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `word` | string | - | The daily word |
| `date` | string | YYYY-MM-DD | Practice date |
| `completed` | boolean | - | True if accuracy >= 0.8 |
| `accuracy` | number | 0.0 - 1.0 | Latest attempt accuracy |
| `attempts` | number | 0+ | Number of attempts |
| `bestScore` | number | 0.0 - 1.0 | Best accuracy achieved |

### **Practice Word Progress**
| Field | Type | Range | Description |
|-------|------|-------|-------------|
| `wordId` | string | - | Unique identifier (e1, i5, h3) |
| `word` | string | - | The word text |
| `completed` | boolean | - | True if accuracy >= 0.8 |
| `attempts` | number | 0+ | Number of practice attempts |
| `bestScore` | number | 0.0 - 1.0 | Best accuracy achieved |
| `lastAttempted` | ISO timestamp | - | Last practice timestamp |

---

## Query Examples

### **1. Get User's Total XP**
```typescript
const xpRef = ref(database, `users/${userId}/stats/xp`);
const snapshot = await get(xpRef);
const xp = snapshot.val(); // Returns: 420
```

### **2. Get All Completed Easy Words**
```typescript
const easyRef = ref(database, `users/${userId}/practiceWords/easy`);
const snapshot = await get(easyRef);
const easyWords = snapshot.val();

const completedWords = Object.values(easyWords).filter(
  (word: any) => word.completed
);
```

### **3. Get Last 7 Days of Daily Practice**
```typescript
const dailyRef = ref(database, `users/${userId}/dailyWords`);
const snapshot = await get(dailyRef);
const allDays = snapshot.val();

const last7Days = Object.entries(allDays)
  .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
  .slice(0, 7);
```

### **4. Check Today's Daily Word Status**
```typescript
const today = '2024-10-13';
const todayRef = ref(database, `users/${userId}/dailyWords/${today}`);
const snapshot = await get(todayRef);
const todayWord = snapshot.val();

if (todayWord?.completed) {
  console.log('Daily word already completed!');
}
```

### **5. Get Overall Progress**
```typescript
const statsRef = ref(database, `users/${userId}/stats`);
const snapshot = await get(statsRef);
const { totalWords, accuracy, streak, xp } = snapshot.val();

console.log(`Progress: ${totalWords} words, ${Math.round(accuracy * 100)}% accuracy`);
```

---

## Backend API Integration (Future)

### **Fetch More Words Endpoint**
```typescript
// GET /api/words?difficulty=easy&offset=10&limit=20
interface WordResponse {
  words: Array<{
    id: string;
    word: string;
    phonetic: string;
    meaning: string;
    example: string;
    tip: string;
    difficulty: 'easy' | 'intermediate' | 'hard';
  }>;
  total: number;
  hasMore: boolean;
}
```

### **Implementation Example:**
```typescript
const loadMoreWords = async (difficulty: string, offset: number) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/words`, {
      params: { difficulty, offset, limit: 20 }
    });
    
    const newWords = response.data.words;
    setCurrentWords(prev => [...prev, ...newWords]);
    
    return newWords;
  } catch (error) {
    console.error('Error loading more words:', error);
    return [];
  }
};
```

---

## Data Flow Diagram

```
User Opens App
     ↓
Load User Data
     ├─→ Profile
     ├─→ Stats (streak, totalWords, accuracy, xp)
     ├─→ Today's Daily Word
     └─→ Practice Words Progress (easy/intermediate/hard)
     
User Completes Word
     ↓
Update Word Progress
     ├─→ practiceWords/{difficulty}/{wordId}
     │   └─→ Set completed: true, bestScore, attempts
     ├─→ stats/totalWords (increment if first completion)
     ├─→ stats/xp (add earned XP)
     └─→ Recalculate stats/accuracy (average of all scores)
     
Daily Word Completed
     ↓
Update Daily Progress
     ├─→ dailyWords/{date}
     │   └─→ Set completed: true, accuracy, attempts
     ├─→ stats/streak (recalculate from daily history)
     └─→ stats/lastCompletedDate (update to today)
```

---

## Indexing Recommendations

For better query performance, create these indexes in Firebase Console:

```json
{
  "users": {
    "$userId": {
      "dailyWords": {
        ".indexOn": ["date", "completed"]
      },
      "practiceWords": {
        "easy": {
          ".indexOn": ["completed", "lastAttempted"]
        },
        "intermediate": {
          ".indexOn": ["completed", "lastAttempted"]
        },
        "hard": {
          ".indexOn": ["completed", "lastAttempted"]
        }
      }
    }
  }
}
```

---

## Storage Estimation

**Per User:**
- Profile: ~200 bytes
- Stats: ~100 bytes
- Daily Words (365 days): ~18 KB
- Practice Words (100 words): ~10 KB
- **Total per user**: ~30 KB

**For 10,000 users**: ~300 MB

---

## Backup Strategy

### **Export User Data:**
```typescript
const exportUserData = async (userId: string) => {
  const userRef = ref(database, `users/${userId}`);
  const snapshot = await get(userRef);
  return snapshot.val();
};
```

### **Restore User Data:**
```typescript
const restoreUserData = async (userId: string, data: any) => {
  const userRef = ref(database, `users/${userId}`);
  await set(userRef, data);
};
```

---

## Migration Scripts

### **Add New Field to All Users:**
```typescript
const addXPToAllUsers = async () => {
  const usersRef = ref(database, 'users');
  const snapshot = await get(usersRef);
  const users = snapshot.val();
  
  const updates = {};
  Object.keys(users).forEach(userId => {
    if (!users[userId].stats?.xp) {
      updates[`users/${userId}/stats/xp`] = 0;
    }
  });
  
  await update(ref(database), updates);
};
```

---

## Real-time Listeners

### **Listen to Stats Changes:**
```typescript
useEffect(() => {
  const user = auth.currentUser;
  if (!user) return;
  
  const statsRef = ref(database, `users/${user.uid}/stats`);
  
  const unsubscribe = onValue(statsRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      setStats(data);
    }
  });
  
  return () => off(statsRef);
}, []);
```

---

## Best Practices

1. ✅ **Use transactions** for concurrent updates
2. ✅ **Denormalize data** for faster reads
3. ✅ **Keep individual nodes small** (< 1 MB)
4. ✅ **Use batch writes** for multiple updates
5. ✅ **Implement offline persistence**
6. ✅ **Add proper security rules**
7. ✅ **Index frequently queried fields**
8. ✅ **Clean up old data** (e.g., daily words > 1 year old)

---

## Future Enhancements

### **1. Achievements System:**
```json
"achievements": {
  "first_word": {
    "id": "first_word",
    "name": "First Steps",
    "description": "Complete your first word",
    "unlocked": true,
    "unlockedAt": "2024-10-10T10:15:00.000Z"
  }
}
```

### **2. Leaderboard:**
```json
"leaderboard": {
  "global": {
    "userId1": { "xp": 1250, "displayName": "User1" },
    "userId2": { "xp": 980, "displayName": "User2" }
  }
}
```

### **3. Word Collections:**
```json
"collections": {
  "animals": ["e1", "e2", "e3"],
  "colors": ["e15", "e16", "e17"],
  "numbers": ["e20", "e21", "e22"]
}
```

---

## Notes

- All timestamps are in **ISO 8601 format**
- Accuracy values are **decimals** (0.0 - 1.0), multiply by 100 for percentage
- Word completion threshold is **80% accuracy** (0.8)
- XP calculation: `Math.round(accuracy * 10)` per word
- Streak breaks if user misses a day
- `userId` is the Firebase Auth UID
