# Quick Start Guide

## 🚀 Getting Started

### Installation (3 steps)

```bash
# 1. Install dependencies
cd mispronounciation
npm install

# 2. Rebuild native code (new modules added)
npx expo prebuild --clean

# 3. Run the app
npx expo run:android  # For Android
npx expo run:ios      # For iOS
```

---

## 📱 New Features at a Glance

### 1. Phoneme-Level Analysis 🔤
**Access:** Practice a word → Tap "Phoneme Analysis" button

**What you'll see:**
- 🟢 Green phonemes = Correct
- 🔴 Red phonemes = Needs work
- Table with practice tracking
- Quick Listen & Practice buttons

**Location:** Index tab (tabs) → Daily word or Practice word feedback modal

---

### 2. Notification & Reminders 🔔
**Access:** Tap ⚙️ (settings) icon in top-right header

**Features:**
- 📅 Daily practice reminders
- 🔥 Streak risk alerts
- 🏆 Milestone celebrations
- ⚙️ Customizable time & frequency

**Badge:** Top-right header shows unread notifications (🔔 with count)

---

## 🎯 Quick Feature Locations

### In the Header:
```
┌──────────────────────────────────┐
│ Hi, User!        [🔔3] [⚙️]     │ ← Notification badge & Settings
│                                  │
│ [Words] [Streak] [Accuracy]     │ ← Stats badges (now visible!)
└──────────────────────────────────┘
```

### In Modals:
- **Daily Word**: Phoneme Analysis + Try Again (side by side)
- **Practice Word**: Same layout
- **Phoneme Analysis**: Color-coded visualization + Practice table
- **Notification Settings**: Complete customization

---

## 🔧 Key Functions for Developers

### Trigger Notifications:
```typescript
import { 
  sendMotivationalNotification,
  sendDailyCompleteNotification 
} from './services/notificationService';

// On daily completion
await sendDailyCompleteNotification();

// On mastery
await sendMotivationalNotification('mastery_achieved', { word: 'test' });
```

### Save Phoneme Data:
```typescript
import { savePhonemeAttempt } from './services/phonemeFirebaseService';

await savePhonemeAttempt(phoneme, word, {
  timestamp: new Date().toISOString(),
  accuracy: 0.85,
  feedback: "Great!",
  predicted_phoneme: "r",
  reference_phoneme: "r"
});
```

---

## 🎨 Visual Elements

### Color Coding:
- **🟢 Green (#10B981)** - Correct/Success
- **🔴 Red (#EF4444)** - Incorrect/Error  
- **🟡 Yellow (#F59E0B)** - Partial/Warning
- **⚪ Gray (#94A3B8)** - Missing/Neutral

### Gradients:
- **Primary**: Indigo → Purple
- **Success**: Green → Dark Green
- **Warning**: Yellow → Orange
- **Error**: Red → Dark Red
- **Gold**: Gold → Orange

---

## 🔥 Firebase Paths

```
users/{userId}/
  ├── phonemeData/              ← Phoneme practice data
  ├── notificationPreferences/  ← User settings
  ├── inAppNotifications/       ← Notification inbox
  ├── dailyWords/              ← Daily practice
  └── wordProgress/            ← Word tracking
```

---

## ⚙️ Default Settings

### Notifications:
- **Enabled**: Yes
- **Daily Reminder**: 7:00 PM
- **Frequency**: Every day
- **Streak Alert**: 6 hours before midnight
- **Achievements**: Enabled

### Can be changed in Settings modal!

---

## 🐛 Quick Troubleshooting

**Badges not showing?**
→ Already fixed! They now appear immediately.

**Notifications not working?**
→ Check: Physical device? Permissions granted? Settings saved?

**Phonemes not colored?**
→ Practice a word first to get data.

**Data not saving?**
→ Check Firebase connection and authentication.

---

## 📖 Full Documentation

For detailed information, see:
- `NOTIFICATION_SYSTEM_IMPLEMENTATION.md` - Complete notification docs
- `PHONEME_ANALYSIS_IMPLEMENTATION.md` - Phoneme system details
- `INSTALLATION_GUIDE.md` - Setup instructions
- `PROJECT_COMPLETE_SUMMARY.md` - Everything together

---

## ✅ What's Working

✅ Header badges visible on load
✅ Phoneme visualization with colors
✅ Practice table with quick actions
✅ All modals have themed headers
✅ Notification system fully integrated
✅ Settings save to Firebase
✅ Real-time data sync
✅ Zero TypeScript/linting errors

---

## 🎉 You're Ready!

Everything is set up and ready to use. Just:
1. Install dependencies (`npm install`)
2. Rebuild native code (`npx expo prebuild --clean`)
3. Run on device (`npx expo run:android` or `run:ios`)
4. Grant notification permissions
5. Start practicing!

**Happy Learning! 📚🔔🎯**
