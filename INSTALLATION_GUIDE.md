# Installation Guide for Notification System

## 📦 New Dependencies

The notification system requires two additional Expo packages:

```json
{
  "expo-notifications": "~0.30.13",
  "expo-device": "~7.1.4"
}
```

---

## 🚀 Installation Steps

### Step 1: Install Dependencies

```bash
cd mispronounciation
npm install
```

This will install the newly added packages from `package.json`.

### Step 2: Rebuild Native Code

Since we added native modules, you need to rebuild the native code:

```bash
# Clean and rebuild
npx expo prebuild --clean

# For Android
npx expo run:android

# For iOS
npx expo run:ios
```

### Step 3: Verify Configuration

The following are already configured in `app.json`:

#### Plugin Configuration:
```json
{
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/images/icon.png",
      "color": "#6366F1",
      "mode": "production"
    }]
  ]
}
```

#### Android Permissions:
```json
{
  "android": {
    "permissions": [
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
      "android.permission.SCHEDULE_EXACT_ALARM"
    ]
  }
}
```

---

## 🔧 Platform-Specific Setup

### Android

#### 1. Notification Channels
Already configured in code. The app will create these channels automatically:
- `default` - Daily reminders
- `streak-alerts` - Streak warnings
- `achievements` - Achievement notifications

#### 2. Exact Alarms (Android 12+)
For precise notification timing, ensure this permission is in `app.json` (already added):
```xml
android.permission.SCHEDULE_EXACT_ALARM
```

#### 3. Google Services (if using FCM)
If you want remote push notifications (future feature), add `google-services.json`:
```bash
# Place your google-services.json in:
android/app/google-services.json
```

### iOS

#### 1. Capabilities
No additional setup needed for local notifications.

#### 2. Background Modes (Optional - for remote notifications)
To enable background notification handling, add to `Info.plist`:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

---

## 🧪 Testing the Notification System

### 1. Request Permissions
Open the app and grant notification permissions when prompted.

### 2. Configure Settings
1. Tap the settings icon (⚙️) in the top-right corner
2. Enable notifications
3. Set your preferred reminder time
4. Choose frequency (Daily recommended)
5. Enable streak alerts
6. Save preferences

### 3. Test Notifications

#### Immediate Test (Development):
You can trigger test notifications from the code:
```typescript
import { sendMotivationalNotification } from './services/notificationService';

// Test milestone notification
await sendMotivationalNotification('streak_milestone', { streak: 7 });

// Test mastery notification
await sendMotivationalNotification('mastery_achieved', { word: 'test' });
```

#### Scheduled Test:
1. Set reminder time to 1-2 minutes from now
2. Save settings
3. Wait for notification
4. Verify it appears

### 4. Test In-App Notifications
1. Practice a word and complete it
2. Check for notification badge in header
3. Tap badge to view notification
4. Tap notification to mark as read

---

## 🐛 Troubleshooting

### Notifications Not Appearing

#### Check 1: Permissions
```typescript
import * as Notifications from 'expo-notifications';

const { status } = await Notifications.getPermissionsAsync();
console.log('Permission status:', status);
```

#### Check 2: Scheduled Notifications
```typescript
import { getScheduledNotifications } from './services/notificationService';

const scheduled = await getScheduledNotifications();
console.log('Scheduled notifications:', scheduled.length);
```

#### Check 3: Device Settings
- Android: Settings → Apps → Mispronounciation → Notifications → Enabled
- iOS: Settings → Notifications → Mispronounciation → Allow Notifications

### Common Issues

#### Issue: "Notifications only work on physical devices"
**Solution:** Use real device, not emulator/simulator

#### Issue: "Permission denied"
**Solution:** 
1. Uninstall app
2. Reinstall
3. Grant permission when prompted
4. Or manually enable in device settings

#### Issue: "Notifications not scheduling"
**Solution:**
1. Check if enabled in preferences
2. Verify notification time is in the future
3. Check console for scheduling errors
4. Ensure Firebase preferences saved

#### Issue: "Badge not showing"
**Solution:**
- iOS: Automatic with expo-notifications
- Android: Use notification count in header badge instead

---

## 📱 Platform Differences

### Android
- ✅ Notification channels for categorization
- ✅ Custom vibration patterns
- ✅ LED light colors
- ✅ Priority levels (MAX, HIGH, DEFAULT)
- ✅ Collapsed notifications
- ✅ Exact alarm scheduling
- ❌ No app icon badges (uses in-app badge)

### iOS
- ✅ App icon badges with count
- ✅ Banner notifications
- ✅ Lock screen notifications
- ✅ Notification center
- ✅ Critical alerts (for streak risks)
- ❌ No notification channels (uses categories instead)

---

## 🔐 Security & Privacy

### Data Storage
- Preferences stored in Firebase under user's account
- In-app notifications stored per user
- No external services used
- No data shared with third parties

### Permission Model
- Opt-in by default (user must grant)
- Can be revoked anytime in settings
- Granular control over notification types
- Respects quiet hours

---

## 📊 Monitoring & Analytics

### Logging
The service logs important events:
```
✅ Notification permissions granted
✅ Notification preferences saved
✅ Daily reminder scheduled: [id]
✅ Streak risk notification scheduled for: [time]
✅ Motivational notification sent: [type]
📬 Notification received: [notification]
👆 Notification tapped: [response]
```

### Firebase Data
Track notification effectiveness:
- Preferences saved → usage tracking
- In-app notifications → engagement metrics
- Streak improvements → correlation analysis

---

## 🆘 Support

### Common Questions

**Q: Can I disable specific notification types?**
A: Yes! Use the settings modal to toggle each type independently.

**Q: Will notifications work offline?**
A: Local notifications (scheduled) work offline. In-app notifications require connection.

**Q: Can I change the reminder time daily?**
A: Yes, changes take effect immediately after saving.

**Q: What happens if I deny permissions?**
A: Notifications won't work, but app functions normally. You can enable later in device settings.

**Q: Do notifications drain battery?**
A: Minimal impact. System-managed and optimized for efficiency.

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Dependencies installed (`node_modules` contains expo-notifications)
- [ ] Native code rebuilt (ran `expo prebuild`)
- [ ] App launches without errors
- [ ] Settings modal opens
- [ ] Can save notification preferences
- [ ] Notification badge appears when unread exist
- [ ] Can test send notification (in dev mode)
- [ ] Firebase saves preferences correctly
- [ ] No console errors related to notifications

---

## 🎉 You're All Set!

The notification system is now installed and ready to use. Users can:
- ✅ Customize their reminder schedule
- ✅ Receive daily practice reminders
- ✅ Get streak risk alerts
- ✅ Celebrate milestones
- ✅ View in-app notifications
- ✅ Maintain learning streaks

**Happy learning! 📚🔔**
