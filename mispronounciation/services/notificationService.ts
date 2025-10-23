// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { ref, set, get, update } from 'firebase/database';
import { database, auth } from '../lib/firebase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NotificationPreferences {
  enabled: boolean;
  dailyReminderEnabled: boolean;
  streakAlertEnabled: boolean;
  motivationalEnabled: boolean;
  reminderTime: string; // Format: "HH:MM" (24-hour)
  frequency: 'daily' | 'weekdays' | 'custom';
  customDays?: number[]; // 0-6 (Sunday-Saturday)
  streakRiskThreshold: number; // Hours before notification
  quietHours?: {
    enabled: boolean;
    start: string; // "HH:MM"
    end: string; // "HH:MM"
  };
}

// ============================================================================
// NOTIFICATION QUEUE & THROTTLING
// ============================================================================

interface QueuedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: any;
  priority: number; // 1-5 (5 = highest)
  timestamp: number;
}

class NotificationQueue {
  private queue: QueuedNotification[] = [];
  private isProcessing: boolean = false;
  private lastNotificationTime: number = 0;
  private readonly MIN_INTERVAL = 30000; // 30 seconds minimum between notifications
  private readonly BATCH_DELAY = 120000; // 2 minutes delay for batched notifications
  
  /**
   * Add notification to queue with priority
   */
  enqueue(notification: Omit<QueuedNotification, 'id' | 'timestamp'>) {
    const queuedNotif: QueuedNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    this.queue.push(queuedNotif);
    this.queue.sort((a, b) => b.priority - a.priority); // Sort by priority
    
    console.log(`📬 Notification queued: ${notification.title} (Priority: ${notification.priority})`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  /**
   * Process notification queue with intelligent spacing
   */
  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastNotif = now - this.lastNotificationTime;
      
      // Wait if notifications are too close together
      if (timeSinceLastNotif < this.MIN_INTERVAL) {
        const waitTime = this.MIN_INTERVAL - timeSinceLastNotif;
        console.log(`⏳ Waiting ${waitTime}ms before next notification...`);
        await this.sleep(waitTime);
      }
      
      const notification = this.queue.shift()!;
      
      // Check if notification is too old (older than 5 minutes)
      const age = Date.now() - notification.timestamp;
      if (age > 300000) {
        console.log(`🗑️ Skipping stale notification: ${notification.title}`);
        continue;
      }
      
      try {
        await this.sendNotification(notification);
        this.lastNotificationTime = Date.now();
        
        // For low-priority notifications in a batch, add extra delay
        if (notification.priority <= 2 && this.queue.length > 0) {
          const nextNotif = this.queue[0];
          if (nextNotif.priority <= 2) {
            console.log(`⏳ Batch delay: waiting 2 minutes before next low-priority notification...`);
            await this.sleep(this.BATCH_DELAY);
          }
        }
      } catch (error) {
        console.error('Error sending queued notification:', error);
      }
    }
    
    this.isProcessing = false;
  }
  
  /**
   * Send notification immediately
   */
  private async sendNotification(notification: QueuedNotification) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.body,
          data: notification.data,
          sound: true,
          priority: notification.priority >= 4 
            ? Notifications.AndroidNotificationPriority.HIGH 
            : Notifications.AndroidNotificationPriority.DEFAULT,
        },
        trigger: null, // Send immediately
      });
      
      console.log(`✅ Notification sent: ${notification.title}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }
  
  /**
   * Check if similar notification was sent recently
   */
  isDuplicate(type: string, withinMinutes: number = 5): boolean {
    const cutoff = Date.now() - (withinMinutes * 60 * 1000);
    return this.queue.some(n => 
      n.type === type && n.timestamp > cutoff
    );
  }
  
  /**
   * Clear all queued notifications
   */
  clear() {
    this.queue = [];
    console.log('🗑️ Notification queue cleared');
  }
  
  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      lastNotificationTime: this.lastNotificationTime,
    };
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global notification queue instance
const notificationQueue = new NotificationQueue();

export interface NotificationData {
  type: 'daily_reminder' | 'streak_alert' | 'motivational' | 'achievement' | 'milestone';
  title: string;
  body: string;
  data?: any;
}

// ============================================================================
// NOTIFICATION CONFIGURATION
// ============================================================================

// Set notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Default preferences
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  dailyReminderEnabled: true,
  streakAlertEnabled: true,
  motivationalEnabled: true,
  reminderTime: "19:00", // 7 PM default
  frequency: 'daily',
  streakRiskThreshold: 6, // 6 hours before midnight
  quietHours: {
    enabled: false,
    start: "22:00",
    end: "08:00",
  },
};

// ============================================================================
// NOTIFICATION PERMISSIONS
// ============================================================================

/**
 * Request notification permissions (iOS and Android)
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    if (!Device.isDevice) {
      console.log('Notifications only work on physical devices');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return false;
    }

    // Configure notification channel for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });

      await Notifications.setNotificationChannelAsync('streak-alerts', {
        name: 'Streak Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#F59E0B',
      });

      await Notifications.setNotificationChannelAsync('achievements', {
        name: 'Achievements',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10B981',
      });
    }

    console.log('✅ Notification permissions granted');
    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Get Expo push token for remote notifications (future feature)
 */
export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    if (!Device.isDevice) {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-project-id', // Replace with your Expo project ID
    });

    console.log('📱 Expo Push Token:', token.data);
    return token.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};

// ============================================================================
// NOTIFICATION PREFERENCES
// ============================================================================

/**
 * Save notification preferences to Firebase
 */
export const saveNotificationPreferences = async (
  preferences: NotificationPreferences
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const prefsPath = `users/${user.uid}/notificationPreferences`;
    await set(ref(database, prefsPath), preferences);
    
    console.log('✅ Notification preferences saved');
    
    // Reschedule notifications with new preferences
    await scheduleNotifications(preferences);
    
    return true;
  } catch (error) {
    console.error('Error saving notification preferences:', error);
    return false;
  }
};

/**
 * Get notification preferences from Firebase
 */
export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      return DEFAULT_PREFERENCES;
    }

    const prefsPath = `users/${user.uid}/notificationPreferences`;
    const snapshot = await get(ref(database, prefsPath));
    
    if (snapshot.exists()) {
      return snapshot.val() as NotificationPreferences;
    }
    
    // Save default preferences if none exist
    await saveNotificationPreferences(DEFAULT_PREFERENCES);
    return DEFAULT_PREFERENCES;
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
};

// ============================================================================
// NOTIFICATION SCHEDULING
// ============================================================================

/**
 * Schedule daily reminder notification
 */
export const scheduleDailyReminder = async (
  preferences: NotificationPreferences
): Promise<string | null> => {
  try {
    if (!preferences.enabled || !preferences.dailyReminderEnabled) {
      return null;
    }

    // Parse reminder time
    const [hours, minutes] = preferences.reminderTime.split(':').map(Number);
    
    // Create trigger based on frequency
    let trigger: any;
    
    if (preferences.frequency === 'daily') {
      trigger = {
        hour: hours,
        minute: minutes,
        repeats: true,
      };
    } else if (preferences.frequency === 'weekdays') {
      // Schedule for Monday-Friday
      trigger = {
        hour: hours,
        minute: minutes,
        weekday: [2, 3, 4, 5, 6], // Monday = 2, Friday = 6
        repeats: true,
      };
    } else if (preferences.frequency === 'custom' && preferences.customDays) {
      // Schedule for custom days
      trigger = {
        hour: hours,
        minute: minutes,
        weekday: preferences.customDays.map(d => d + 1), // Convert to expo format (Sunday = 1)
        repeats: true,
      };
    }

    const motivationalMessages = [
      "Time to practice! Keep your streak alive! 🔥",
      "Your daily word is waiting! Let's improve together! 📚",
      "Practice makes perfect! Ready to level up? 🚀",
      "Don't break your streak! Time for today's challenge! ⭐",
      "Your pronunciation journey continues! Let's go! 💪",
    ];

    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)];

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily Practice Reminder 📖",
        body: randomMessage,
        data: { type: 'daily_reminder' },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger,
    });

    console.log('✅ Daily reminder scheduled:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
};

/**
 * Schedule streak risk notification
 */
export const scheduleStreakRiskNotification = async (
  currentStreak: number,
  preferences: NotificationPreferences
): Promise<string | null> => {
  try {
    if (!preferences.enabled || !preferences.streakAlertEnabled || currentStreak === 0) {
      return null;
    }

    // Calculate notification time (X hours before midnight)
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    
    const hoursBeforeMidnight = preferences.streakRiskThreshold;
    const notificationTime = new Date(midnight.getTime() - (hoursBeforeMidnight * 60 * 60 * 1000));

    // Only schedule if notification time is in the future
    if (notificationTime <= now) {
      return null;
    }

    const streakMessages = [
      `🔥 Your ${currentStreak}-day streak is at risk! Practice now to keep it going!`,
      `⚠️ Don't lose your ${currentStreak}-day streak! Practice before midnight!`,
      `🎯 ${currentStreak} days strong! Keep it alive with today's practice!`,
      `💪 Protect your ${currentStreak}-day streak! Time to practice!`,
    ];

    const randomMessage = streakMessages[Math.floor(Math.random() * streakMessages.length)];

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Streak Alert! 🔥",
        body: randomMessage,
        data: { type: 'streak_alert', streak: currentStreak },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: notificationTime,
    });

    console.log('✅ Streak risk notification scheduled for:', notificationTime);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling streak notification:', error);
    return null;
  }
};

/**
 * Send motivational notification (queued with intelligent spacing)
 */
export const sendMotivationalNotification = async (
  type: 'streak_milestone' | 'accuracy_improvement' | 'mastery_achieved' | 'daily_complete',
  data: any
): Promise<void> => {
  try {
    const preferences = await getNotificationPreferences();
    if (!preferences.enabled || !preferences.motivationalEnabled) {
      return;
    }

    // Check if duplicate notification was sent recently
    if (notificationQueue.isDuplicate(`motivational_${type}`, 10)) {
      console.log(`⏭️ Skipping duplicate notification: ${type}`);
      return;
    }

    let title = '';
    let body = '';
    let priority = 3; // Default medium priority

    switch (type) {
      case 'streak_milestone':
        const streak = data.streak;
        title = '🎉 Streak Milestone!';
        body = `Amazing! You've reached a ${streak}-day streak! Keep going!`;
        priority = 4; // High priority for milestones
        break;
      
      case 'accuracy_improvement':
        const improvement = data.improvement;
        title = '📈 Great Progress!';
        body = `Your accuracy improved by ${improvement}%! Keep up the excellent work!`;
        priority = 2; // Lower priority
        break;
      
      case 'mastery_achieved':
        const word = data.word;
        title = '⭐ Mastery Achieved!';
        body = `You've mastered "${word}"! Outstanding pronunciation!`;
        priority = 3; // Medium priority
        break;
      
      case 'daily_complete':
        title = '✅ Daily Goal Complete!';
        body = "Great job! You've completed today's practice. See you tomorrow!";
        priority = 3; // Medium priority
        break;
    }

    // Add to queue instead of sending immediately
    notificationQueue.enqueue({
      type: `motivational_${type}`,
      title,
      body,
      data: { type: 'motivational', ...data },
      priority,
    });

    console.log(`📬 Motivational notification queued: ${type} (Priority: ${priority})`);
  } catch (error) {
    console.error('Error queueing motivational notification:', error);
  }
};

/**
 * Schedule achievement notification (queued)
 */
export const scheduleAchievementNotification = async (
  achievement: string,
  description: string
): Promise<void> => {
  try {
    const preferences = await getNotificationPreferences();
    if (!preferences.enabled) {
      return;
    }

    // Check for duplicates
    if (notificationQueue.isDuplicate(`achievement_${achievement}`, 30)) {
      console.log(`⏭️ Skipping duplicate achievement: ${achievement}`);
      return;
    }

    // Add to queue with high priority
    notificationQueue.enqueue({
      type: `achievement_${achievement}`,
      title: `🏆 Achievement Unlocked!`,
      body: `${achievement}: ${description}`,
      data: { type: 'achievement', achievement },
      priority: 4, // High priority
    });

    console.log(`📬 Achievement notification queued: ${achievement}`);
  } catch (error) {
    console.error('Error queueing achievement notification:', error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All notifications cancelled');
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
};

/**
 * Schedule all notifications based on preferences
 */
export const scheduleNotifications = async (
  preferences: NotificationPreferences
): Promise<void> => {
  try {
    // Cancel existing notifications first
    await cancelAllNotifications();

    if (!preferences.enabled) {
      console.log('Notifications disabled, skipping scheduling');
      return;
    }

    // Schedule daily reminder
    if (preferences.dailyReminderEnabled) {
      await scheduleDailyReminder(preferences);
    }

    console.log('✅ Notifications scheduled successfully');
  } catch (error) {
    console.error('Error scheduling notifications:', error);
  }
};

/**
 * Initialize notifications on app start
 */
export const initializeNotifications = async (): Promise<boolean> => {
  try {
    // Request permissions
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Notification permissions not granted');
      return false;
    }

    // Get user preferences
    const preferences = await getNotificationPreferences();
    
    // Schedule notifications
    await scheduleNotifications(preferences);
    
    return true;
  } catch (error) {
    console.error('Error initializing notifications:', error);
    return false;
  }
};

// ============================================================================
// STREAK MANAGEMENT
// ============================================================================

/**
 * Check if user needs streak reminder today
 */
export const checkAndScheduleStreakReminder = async (
  currentStreak: number,
  lastPracticeDate: string
): Promise<void> => {
  try {
    const preferences = await getNotificationPreferences();
    if (!preferences.enabled || !preferences.streakAlertEnabled) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastPractice = new Date(lastPracticeDate);
    lastPractice.setHours(0, 0, 0, 0);
    
    const daysSinceLastPractice = Math.floor((today.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24));
    
    // If user hasn't practiced today and has a streak, schedule reminder
    if (daysSinceLastPractice === 0 && currentStreak > 0) {
      await scheduleStreakRiskNotification(currentStreak, preferences);
    }
  } catch (error) {
    console.error('Error checking streak reminder:', error);
  }
};

/**
 * Send streak milestone notification
 */
export const sendStreakMilestoneNotification = async (streak: number): Promise<void> => {
  const milestones = [3, 7, 14, 30, 60, 100, 365];
  
  if (milestones.includes(streak)) {
    await sendMotivationalNotification('streak_milestone', { streak });
  }
};

/**
 * Send daily completion notification (throttled to once per day)
 */
export const sendDailyCompleteNotification = async (): Promise<void> => {
  // Only send once per day
  if (!notificationQueue.isDuplicate('daily_complete', 1440)) {
    await sendMotivationalNotification('daily_complete', {});
  } else {
    console.log('⏭️ Skipping duplicate daily complete notification');
  }
};

// ============================================================================
// IN-APP NOTIFICATIONS
// ============================================================================

export interface InAppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionData?: any;
}

/**
 * Save in-app notification to Firebase
 */
export const saveInAppNotification = async (
  notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const notificationId = Date.now().toString();
    const notificationData: InAppNotification = {
      ...notification,
      id: notificationId,
      timestamp: new Date(),
      read: false,
    };

    const notifPath = `users/${user.uid}/inAppNotifications/${notificationId}`;
    await set(ref(database, notifPath), notificationData);
    
    console.log('✅ In-app notification saved');
    return true;
  } catch (error) {
    console.error('Error saving in-app notification:', error);
    return false;
  }
};

/**
 * Get unread in-app notifications
 */
export const getUnreadNotifications = async (): Promise<InAppNotification[]> => {
  try {
    const user = auth.currentUser;
    if (!user) return [];

    const notifsPath = `users/${user.uid}/inAppNotifications`;
    const snapshot = await get(ref(database, notifsPath));
    
    if (!snapshot.exists()) {
      return [];
    }

    const notifications = snapshot.val() as Record<string, InAppNotification>;
    return (Object.values(notifications) as InAppNotification[])
      .filter((n) => !n.read)
      .sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  } catch (error) {
    console.error('Error getting unread notifications:', error);
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const notifPath = `users/${user.uid}/inAppNotifications/${notificationId}`;
    await update(ref(database, notifPath), { read: true });
    
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Clear all old notifications (older than 7 days)
 */
export const clearOldNotifications = async (): Promise<void> => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const notifsPath = `users/${user.uid}/inAppNotifications`;
    const snapshot = await get(ref(database, notifsPath));
    
    if (!snapshot.exists()) return;

    const notifications = snapshot.val();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    for (const [id, notification] of Object.entries(notifications)) {
      const notifDate = new Date((notification as any).timestamp);
      if (notifDate < sevenDaysAgo) {
        await set(ref(database, `${notifsPath}/${id}`), null);
      }
    }

    console.log('✅ Old notifications cleared');
  } catch (error) {
    console.error('Error clearing old notifications:', error);
  }
};

// ============================================================================
// NOTIFICATION LISTENERS
// ============================================================================

/**
 * Set up notification received listener
 */
export const addNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Set up notification response listener (user tapped notification)
 */
export const addNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

// ============================================================================
// BADGE MANAGEMENT
// ============================================================================

/**
 * Set app badge count (iOS)
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error('Error setting badge count:', error);
  }
};

/**
 * Clear app badge
 */
export const clearBadge = async (): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if notification time is in quiet hours
 */
export const isQuietHours = (preferences: NotificationPreferences): boolean => {
  if (!preferences.quietHours?.enabled) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime < endTime) {
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime < endTime;
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

// ============================================================================
// NOTIFICATION QUEUE MANAGEMENT
// ============================================================================

/**
 * Clear notification queue
 */
export const clearNotificationQueue = (): void => {
  notificationQueue.clear();
};

/**
 * Get notification queue status
 */
export const getNotificationQueueStatus = () => {
  return notificationQueue.getStatus();
};

/**
 * Check if notification would be duplicate
 */
export const wouldBeDuplicate = (type: string, withinMinutes: number = 5): boolean => {
  return notificationQueue.isDuplicate(type, withinMinutes);
};

export default {
  requestNotificationPermissions,
  getExpoPushToken,
  saveNotificationPreferences,
  getNotificationPreferences,
  scheduleDailyReminder,
  scheduleStreakRiskNotification,
  sendMotivationalNotification,
  scheduleAchievementNotification,
  cancelAllNotifications,
  scheduleNotifications,
  initializeNotifications,
  checkAndScheduleStreakReminder,
  sendStreakMilestoneNotification,
  sendDailyCompleteNotification,
  saveInAppNotification,
  getUnreadNotifications,
  markNotificationAsRead,
  clearOldNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  setBadgeCount,
  clearBadge,
  isQuietHours,
  getScheduledNotifications,
  clearNotificationQueue,
  getNotificationQueueStatus,
  wouldBeDuplicate,
};
cations,
  clearNotificationQueue,
  getNotificationQueueStatus,
  wouldBeDuplicate,
};
