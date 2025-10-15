import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LearningPathBackground from '../../components/LearningPathBackground';
import * as Haptics from 'expo-haptics';
import { auth, database } from '../../lib/firebase';
import { ref, get, set } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

// Avatar options - 'initial' is a special value for showing user's first letter
const AVATAR_OPTIONS = [
  'initial', '😊', '😎', '🤓', '😇', '🥳', '🤩', '😸', '🐶', 
  '🐱', '🐼', '🦊', '🐨', '🐯', '🦁', '🐸', '🐙',
  '🦄', '🌟', '⚡', '🔥', '💎', '🎯', '🎨', '🎭',
  '🎮', '🚀', '🌈', '🍕', '🍔', '🎂', '☕', '🌺'
];

interface Stats {
  totalWords: number;
  accuracy: number;
  streak: number;
  practiceTime: number;
}

interface Achievement {
  id: string;
  title: string;
  icon: string;
  unlocked: boolean;
  color: string;
}

interface PracticeHistory {
  word: string;
  accuracy: number;
  timestamp: number;
  date: string;
  type: 'daily_word' | 'custom_sentence' | 'word_practice';
  practiceType?: string;
  attemptCount?: number;
}

// Streak Calendar Component
const StreakCalendar = ({ visible, onClose, streakDays, currentStreak }: { 
  visible: boolean; 
  onClose: () => void;
  streakDays: string[];
  currentStreak: number;
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get days in month and starting day
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  // Check if a date is in streak
  const isDateInStreak = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return streakDays.includes(dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  // Navigate months
  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.selectionAsync();
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  // Render calendar days
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
    const today = new Date();
    
    const rows = [];
    let currentRow = [];
    
    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDayOfMonth; i++) {
      currentRow.push(
        <View key={`empty-${i}`} style={[calendarStyles.calendarDay, calendarStyles.emptyDay]} />
      );
    }
    
    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isStreakDay = isDateInStreak(date);
      const isCurrentDay = isToday(date);
      
      currentRow.push(
        <View 
          key={`day-${day}`}
          style={[
            calendarStyles.calendarDay,
            isCurrentDay && calendarStyles.today,
            isStreakDay && !isCurrentDay && calendarStyles.streakDay,
            !isStreakDay && !isCurrentDay && calendarStyles.normalDay,
          ]}
        >
          <Text style={[
            calendarStyles.calendarDayText,
            isCurrentDay && calendarStyles.todayText,
            isStreakDay && !isCurrentDay && calendarStyles.streakDayText,
          ]}>
            {day}
          </Text>
        </View>
      );
      
      // Start new row after 7 days
      if (currentRow.length === 7) {
        rows.push(
          <View key={`row-${rows.length}`} style={calendarStyles.calendarRow}>
            {currentRow}
          </View>
        );
        currentRow = [];
      }
    }
    
    // Fill remaining cells in last row
    if (currentRow.length > 0) {
      const remainingCells = 7 - currentRow.length;
      for (let i = 0; i < remainingCells; i++) {
        currentRow.push(
          <View key={`empty-end-${i}`} style={[calendarStyles.calendarDay, calendarStyles.emptyDay]} />
        );
      }
      rows.push(
        <View key={`row-${rows.length}`} style={calendarStyles.calendarRow}>
          {currentRow}
        </View>
      );
    }
    
    return rows;
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={calendarStyles.calendarContainer}>
          {/* Header */}
          <View style={calendarStyles.calendarHeader}>
            <TouchableOpacity 
              style={calendarStyles.calendarNavButton}
              onPress={() => navigateMonth('prev')}
            >
              <Icon name="chevron-left" size={20} color="#6B7280" />
            </TouchableOpacity>
            
            <Text style={calendarStyles.calendarMonthText}>
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </Text>
            
            <TouchableOpacity 
              style={calendarStyles.calendarNavButton}
              onPress={() => navigateMonth('next')}
            >
              <Icon name="chevron-right" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Week Days */}
          <View style={calendarStyles.weekDaysContainer}>
            {['M', 'D', 'W', 'D', 'V', 'Z', 'Z'].map((day, index) => (
              <Text key={index} style={calendarStyles.weekDayText}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={calendarStyles.calendarGrid}>
            {renderCalendarDays()}
          </View>

          {/* Stats */}
          <View style={calendarStyles.statsContainer}>
            <View style={calendarStyles.statItem}>
              <Icon name="local-fire-department" size={24} color="#F59E0B" />
              <Text style={calendarStyles.statValue}>{currentStreak}</Text>
              <Text style={calendarStyles.statLabel}>Current Streak</Text>
            </View>
            <View style={calendarStyles.statItem}>
              <Icon name="calendar-today" size={24} color="#6366F1" />
              <Text style={calendarStyles.statValue}>{streakDays.length}</Text>
              <Text style={calendarStyles.statLabel}>Total Days</Text>
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity 
            style={calendarStyles.closeButton}
            onPress={onClose}
          >
            <Text style={calendarStyles.closeButtonText}>
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// Calendar Styles
const calendarStyles = StyleSheet.create({
  // Calendar Container
  calendarContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    margin: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 400,
    width: '90%',
  },

  // Calendar Header
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  calendarMonthText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  calendarNavButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },

  // Week Days Header
  weekDaysContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 12,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Calendar Grid
  calendarGrid: {
    marginBottom: 8,
  },
  calendarRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },

  // Calendar Days
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderRadius: 10,
    minHeight: 40,
  },
  calendarDayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  
  // Day States
  emptyDay: {
    backgroundColor: 'transparent',
  },
  normalDay: {
    backgroundColor: '#F3F4F6',
  },
  streakDay: {
    backgroundColor: '#FF6B35',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  today: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  todayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  streakDayText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },

  // Close Button
  closeButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalWords: 0,
    accuracy: 0,
    streak: 0,
    practiceTime: 0,
  });
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyWordCounts, setWeeklyWordCounts] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [recentPractice, setRecentPractice] = useState<PracticeHistory[]>([]);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [streakDays, setStreakDays] = useState<string[]>([]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/(auth)/signin');
      return;
    }

    setUserName(user.displayName || 'User');
    setUserEmail(user.email || '');

    loadUserData(user.uid);
  }, []);

  const loadUserData = async (userId: string) => {
    try {
      console.log('📊 Loading user data for:', userId);

      await Promise.all([
        loadStats(userId),
        loadAllPracticeHistory(userId),
        loadAchievements(userId),
        loadUserProfile(userId),
      ]);

      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      setLoading(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const profileRef = ref(database, `users/${userId}/profile`);
      const snapshot = await get(profileRef);
      const data = snapshot.val();
      
      if (data?.avatar) {
        setUserAvatar(data.avatar);
      } else {
        // Set default avatar to 'initial' (user's first letter)
        setUserAvatar('initial');
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      setUserAvatar('initial');
    }
  };

  const loadStats = async (userId: string) => {
    try {
      const statsRef = ref(database, `users/${userId}/stats`);
      const snapshot = await get(statsRef);
      const data = snapshot.val();
      
      console.log('📈 Stats data:', data);

      if (data) {
        setStats({
          totalWords: data.totalWords || 0,
          accuracy: Math.round((data.accuracy || data.averageAccuracy || 0) * 100),
          streak: data.streak || data.currentStreak || 0,
          practiceTime: Math.round((data.totalPracticeTime || data.practiceTime || 0) / 60),
        });
      }

      // Load and calculate streak days
      await calculateStreakDays(userId);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // CORRECTED: Proper streak calculation from all practice sources
  const calculateStreakDays = async (userId: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const streakDates: string[] = [];
      
      console.log('🔥 Calculating streak days...');

      // 1. Check Daily Words
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      const dailySnapshot = await get(dailyWordsRef);
      
      if (dailySnapshot.exists()) {
        const dailyData = dailySnapshot.val();
        Object.entries(dailyData).forEach(([date, dayData]: [string, any]) => {
          if (dayData.attempts > 0) {
            // Validate date format and add to streak
            const dateObj = new Date(date);
            if (!isNaN(dateObj.getTime())) {
              const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              if (!streakDates.includes(dateStr)) {
                streakDates.push(dateStr);
              }
            }
          }
        });
        console.log(`✅ Daily words streak days: ${Object.keys(dailyData).filter(date => dailyData[date].attempts > 0).length}`);
      }

      // 2. Check Practice Words (Batch System)
      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const practiceRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const practiceSnapshot = await get(practiceRef);
        
        if (practiceSnapshot.exists()) {
          const practiceData = practiceSnapshot.val();
          
          Object.values(practiceData).forEach((wordData: any) => {
            if (wordData.attempts > 0 && wordData.lastAttempted) {
              const attemptDate = new Date(wordData.lastAttempted);
              attemptDate.setHours(0, 0, 0, 0);
              const dateStr = `${attemptDate.getFullYear()}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}-${String(attemptDate.getDate()).padStart(2, '0')}`;
              
              if (!streakDates.includes(dateStr)) {
                streakDates.push(dateStr);
              }
            }
          });
          console.log(`✅ ${difficulty} practice words checked`);
        }
      }

      // 3. Check Custom Sentences/References
      const referencesRef = ref(database, `users/${userId}/references`);
      const referencesSnapshot = await get(referencesRef);
      
      if (referencesSnapshot.exists()) {
        const referencesData = referencesSnapshot.val();
        
        Object.values(referencesData).forEach((sessionData: any) => {
          if (sessionData.attempts) {
            // Check all attempts in this session
            Object.values(sessionData.attempts).forEach((attemptData: any) => {
              if (attemptData.timestamp) {
                const attemptDate = new Date(attemptData.timestamp);
                attemptDate.setHours(0, 0, 0, 0);
                const dateStr = `${attemptDate.getFullYear()}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}-${String(attemptDate.getDate()).padStart(2, '0')}`;
                
                if (!streakDates.includes(dateStr)) {
                  streakDates.push(dateStr);
                }
              }
            });
          }
        });
        console.log(`✅ Custom sentences checked`);
      }

      // 4. Check Practice Tracking (if exists)
      const practiceTrackingRef = ref(database, `users/${userId}/practiceTracking`);
      const trackingSnapshot = await get(practiceTrackingRef);
      
      if (trackingSnapshot.exists()) {
        const trackingData = trackingSnapshot.val();
        Object.entries(trackingData).forEach(([date, data]: [string, any]) => {
          if (data.practiced) {
            const dateObj = new Date(date);
            if (!isNaN(dateObj.getTime())) {
              const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
              if (!streakDates.includes(dateStr)) {
                streakDates.push(dateStr);
              }
            }
          }
        });
        console.log(`✅ Practice tracking checked`);
      }

      // Sort and deduplicate dates
      const uniqueDates = [...new Set(streakDates)].sort();
      console.log(`🔥 Total unique practice days: ${uniqueDates.length}`);
      console.log('Streak dates:', uniqueDates);

      setStreakDays(uniqueDates);

      // Calculate current streak
      const currentStreak = calculateCurrentStreak(uniqueDates);
      console.log(`🔥 Current streak: ${currentStreak} days`);

      // Update stats with calculated streak
      setStats(prev => ({
        ...prev,
        streak: currentStreak
      }));

    } catch (error) {
      console.error('Error calculating streak days:', error);
      setStreakDays([]);
    }
  };

  // Calculate current streak from practice dates
  const calculateCurrentStreak = (practiceDates: string[]): number => {
    if (practiceDates.length === 0) return 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sortedDates = practiceDates
      .map(date => new Date(date))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 0;
    let currentDate = today.getTime();
    
    // Check if today was practiced
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const hasPracticedToday = practiceDates.includes(todayStr);
    
    if (!hasPracticedToday) {
      // If today not practiced, start from yesterday
      currentDate = today.getTime() - (24 * 60 * 60 * 1000);
    }

    // Count consecutive days backwards
    for (let i = 0; i < sortedDates.length; i++) {
      const practiceDate = sortedDates[i].getTime();
      const expectedDate = currentDate - (streak * 24 * 60 * 60 * 1000);
      
      // Check if this practice date matches the expected date in the streak
      const practiceDateStr = `${sortedDates[i].getFullYear()}-${String(sortedDates[i].getMonth() + 1).padStart(2, '0')}-${String(sortedDates[i].getDate()).padStart(2, '0')}`;
      const expectedDateObj = new Date(expectedDate);
      const expectedDateStr = `${expectedDateObj.getFullYear()}-${String(expectedDateObj.getMonth() + 1).padStart(2, '0')}-${String(expectedDateObj.getDate()).padStart(2, '0')}`;
      
      if (practiceDateStr === expectedDateStr) {
        streak++;
      } else {
        // If there's a gap, stop counting
        break;
      }
    }

    return streak;
  };

  const loadAllPracticeHistory = async (userId: string) => {
    try {
      const allPractices: PracticeHistory[] = [];
      const practiceMap = new Map<string, PracticeHistory>();

      // 1. Load Daily Words
      console.log('📅 Loading daily words...');
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      const dailySnapshot = await get(dailyWordsRef);
      
      if (dailySnapshot.exists()) {
        const dailyData = dailySnapshot.val();
        Object.entries(dailyData).forEach(([date, dayData]: [string, any]) => {
          if (dayData.attempts > 0) {
            const word = dayData.word.toLowerCase();
            const practice: PracticeHistory = {
              word: ` ${dayData.word}`,
              accuracy: Math.round((dayData.bestScore || dayData.accuracy || 0) * 100),
              timestamp: new Date(date).getTime(),
              date: formatDate(new Date(date).getTime()),
              type: 'daily_word',
              practiceType: 'daily_word',
            };

            const existingPractice = practiceMap.get(word);
            if (!existingPractice || practice.timestamp > existingPractice.timestamp) {
              practiceMap.set(word, practice);
            }
          }
        });
      }

      // 2. Load Practice Sessions (Custom Sentences)
      console.log('📝 Loading practice sessions...');
      const referencesRef = ref(database, `users/${userId}/references`);
      const referencesSnapshot = await get(referencesRef);
      
      if (referencesSnapshot.exists()) {
        const referencesData = referencesSnapshot.val();
        
        Object.entries(referencesData).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.attempts) {
            const text = (sessionData.text || 'Practice Session').toLowerCase();
            const displayText = sessionData.text || 'Practice Session';
            const wordCount = displayText.split(' ').length;
            
            const attempts = Object.entries(sessionData.attempts).map(([attemptId, attemptData]: [string, any]) => ({
              id: attemptId,
              timestamp: new Date(attemptData.timestamp).getTime(),
              accuracy: Math.round((attemptData.scores?.accuracy || 0) * 100),
              data: attemptData,
            }));

            attempts.sort((a, b) => b.timestamp - a.timestamp);
            const mostRecentAttempt = attempts[0];

            if (mostRecentAttempt) {
              const practice: PracticeHistory = {
                word: wordCount > 3 
                  ? ` ${displayText.substring(0, 30)}${displayText.length > 30 ? '...' : ''}`
                  : displayText,
                accuracy: mostRecentAttempt.accuracy,
                timestamp: mostRecentAttempt.timestamp,
                date: formatDate(mostRecentAttempt.timestamp),
                type: wordCount > 3 ? 'custom_sentence' : 'word_practice',
                practiceType: 'sentence',
              };

              const existingPractice = practiceMap.get(text);
              if (!existingPractice || practice.timestamp > existingPractice.timestamp) {
                practiceMap.set(text, practice);
              }
            }
          }
        });
      }

      // 3. Load Practice Words from Batch System
      console.log('📚 Loading batch practice words...');
      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const practiceRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const practiceSnapshot = await get(practiceRef);
        
        if (practiceSnapshot.exists()) {
          const practiceData = practiceSnapshot.val();
          
          Object.entries(practiceData).forEach(([wordId, wordData]: [string, any]) => {
            if (wordData.attempts > 0) {
              const word = (wordData.word || '').toLowerCase();
              const displayWord = wordData.word || 'Unknown';
              
              const practice: PracticeHistory = {
                word: ` ${displayWord}`,
                accuracy: Math.round((wordData.bestScore || 0) * 100),
                timestamp: new Date(wordData.lastAttempted || Date.now()).getTime(),
                date: formatDate(new Date(wordData.lastAttempted || Date.now()).getTime()),
                type: 'word_practice',
                practiceType: 'word_practice',
                attemptCount: wordData.attempts,
              };

              const existingPractice = practiceMap.get(word);
              if (!existingPractice || practice.timestamp > existingPractice.timestamp) {
                practiceMap.set(word, practice);
              }
            }
          });
        }
      }

      // Convert map to array and sort
      const uniquePractices = Array.from(practiceMap.values());
      uniquePractices.sort((a, b) => b.timestamp - a.timestamp);
      const recentFive = uniquePractices.slice(0, 5);
      
      setRecentPractice(recentFive);
      calculateWeeklyProgressFromUnique(uniquePractices);

    } catch (error) {
      console.error('Error loading practice history:', error);
      setRecentPractice([]);
    }
  };

  const calculateWeeklyProgressFromUnique = (allPractices: PracticeHistory[]) => {
    try {
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      
      const weekData = [0, 0, 0, 0, 0, 0, 0];
      const dayCounts = [0, 0, 0, 0, 0, 0, 0];
      
      allPractices.forEach((practice) => {
        if (practice.timestamp >= sevenDaysAgo) {
          const practiceDate = new Date(practice.timestamp);
          const dayOfWeek = practiceDate.getDay();
          const mondayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          
          weekData[mondayIndex] += practice.accuracy;
          dayCounts[mondayIndex] += 1;
        }
      });

      const averagedData = weekData.map((total, index) => {
        const count = dayCounts[index];
        return count > 0 ? Math.round(total / count) : 0;
      });

      setWeeklyData(averagedData);
      setWeeklyWordCounts(dayCounts);
    } catch (error) {
      console.error('Error calculating weekly progress:', error);
      setWeeklyData([0, 0, 0, 0, 0, 0, 0]);
      setWeeklyWordCounts([0, 0, 0, 0, 0, 0, 0]);
    }
  };

  const loadAchievements = async (userId: string) => {
    try {
      const statsRef = ref(database, `users/${userId}/stats`);
      const snapshot = await get(statsRef);
      const stats = snapshot.val();
      
      const totalWords = stats?.totalWords || 0;
      const currentStreak = stats?.streak || stats?.currentStreak || 0;
      const averageAccuracy = (stats?.accuracy || stats?.averageAccuracy || 0);
      const totalAttempts = stats?.totalAttempts || 0;

      const normalizedAccuracy = averageAccuracy > 1 ? averageAccuracy / 100 : averageAccuracy;

      const achievementsList: Achievement[] = [
        {
          id: '1',
          title: 'First Steps',
          icon: 'stars',
          unlocked: totalWords >= 1,
          color: '#10B981',
        },
        {
          id: '2',
          title: '7 Day Streak',
          icon: 'local-fire-department',
          unlocked: currentStreak >= 7,
          color: '#F59E0B',
        },
        {
          id: '3',
          title: '100 Words',
          icon: 'workspace-premium',
          unlocked: totalWords >= 100,
          color: '#6366F1',
        },
        {
          id: '4',
          title: 'Perfect Score',
          icon: 'emoji-events',
          unlocked: normalizedAccuracy >= 0.95 && totalAttempts >= 10,
          color: '#EC4899',
        },
        {
          id: '5',
          title: '500 Words',
          icon: 'military-tech',
          unlocked: totalWords >= 500,
          color: '#8B5CF6',
        },
        {
          id: '6',
          title: '30 Day Streak',
          icon: 'whatshot',
          unlocked: currentStreak >= 30,
          color: '#EF4444',
        },
      ];

      setAchievements(achievementsList);
    } catch (error) {
      console.error('Error loading achievements:', error);
      setAchievements([]);
    }
  };

  const formatDate = (timestamp: number): string => {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getPracticeTypeIcon = (type: string): string => {
    switch (type) {
      case 'daily_word':
        return 'event';
      case 'custom_sentence':
        return 'create';
      default:
        return 'mic';
    }
  };

  const getPracticeTypeColor = (type: string): string => {
    switch (type) {
      case 'daily_word':
        return '#6366F1';
      case 'custom_sentence':
        return '#8B5CF6';
      default:
        return '#10B981';
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Do you want to clear your saved login credentials?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Keep Credentials',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/(auth)/signin');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
        {
          text: 'Clear & Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('rememberedEmail');
              await AsyncStorage.removeItem('rememberedPassword');
              await AsyncStorage.removeItem('rememberMe');
              
              await signOut(auth);
              router.replace('/(auth)/signin');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRefresh = async () => {
    const user = auth.currentUser;
    if (user) {
      setLoading(true);
      await loadUserData(user.uid);
    }
  };

  const handleDayPress = (index: number) => {
    if (weeklyWordCounts[index] > 0) {
      setSelectedDayIndex(index);
      setTooltipVisible(true);
    }
  };

  const handleCloseTooltip = () => {
    setTooltipVisible(false);
    setTimeout(() => setSelectedDayIndex(null), 300);
  };

  const getDayName = (index: number): string => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[index];
  };

  const openStreakCalendar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowStreakCalendar(true);
  };

  const handleAvatarSelect = async (avatar: string) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Save to Firebase
      const profileRef = ref(database, `users/${user.uid}/profile`);
      await set(profileRef, {
        avatar: avatar,
        updatedAt: new Date().toISOString(),
      });

      // Update local state
      setUserAvatar(avatar);
      setShowAvatarPicker(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving avatar:', error);
      Alert.alert('Error', 'Failed to save avatar. Please try again.');
    }
  };

  const openAvatarPicker = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAvatarPicker(true);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  const maxWeeklyValue = Math.max(...weeklyData, 1);

  return (
    <View style={styles.container}>
      <LearningPathBackground />
      {/* Header with Refresh */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <Icon name="refresh" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.profileGradient}
          >
            <View style={styles.avatarContainer}>
              <TouchableOpacity 
                style={styles.avatar}
                onPress={openAvatarPicker}
                activeOpacity={0.8}
              >
                {userAvatar === 'initial' || !userAvatar ? (
                  <Text style={styles.avatarText}>
                    {userName.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Text style={styles.avatarEmoji}>{userAvatar}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={openAvatarPicker}
                activeOpacity={0.8}
              >
                <Icon name="edit" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.userName}>{userName}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </LinearGradient>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Icon name="menu-book" size={28} color="#6366F1" />
            <Text style={styles.statValue}>{stats.totalWords}</Text>
            <Text style={styles.statLabel}>Total Words</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="check-circle" size={28} color="#10B981" />
            <Text style={styles.statValue}>{stats.accuracy}%</Text>
            <Text style={styles.statLabel}>Avg Accuracy</Text>
          </View>
          <TouchableOpacity style={styles.statCard} onPress={openStreakCalendar} activeOpacity={0.8}>
            <Icon name="local-fire-department" size={28} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Icon name="timer" size={28} color="#EC4899" />
            <Text style={styles.statValue}>{stats.practiceTime}</Text>
            <Text style={styles.statLabel}>Minutes</Text>
          </View>
        </View>

        {/* Weekly Progress */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Progress</Text>
            <Text style={styles.sectionSubtitle}>Last 7 days • Tap bars for details</Text>
          </View>
          <View style={styles.card}>
            {weeklyData.every(val => val === 0) ? (
              <View style={styles.emptyState}>
                <Icon name="show-chart" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No practice data yet</Text>
                <Text style={styles.emptyStateSubtext}>Start practicing to see your progress!</Text>
              </View>
            ) : (
              <View style={styles.chartContainer}>
                {weeklyData.map((value, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.barContainer}
                    onPress={() => handleDayPress(index)}
                    disabled={weeklyWordCounts[index] === 0}
                    activeOpacity={0.7}
                  >
                    {/* Accuracy percentage above bar */}
                    {value > 0 && (
                      <Text style={[
                        styles.barPercentage,
                        selectedDayIndex === index && styles.barPercentageSelected
                      ]}>
                        {value}%
                      </Text>
                    )}
                    
                    <View style={styles.barWrapper}>
                      <LinearGradient
                        colors={value > 0 ? ['#6366F1', '#8B5CF6'] : ['#E5E7EB', '#E5E7EB']}
                        style={[
                          styles.bar,
                          { height: `${(value / maxWeeklyValue) * 100}%` },
                          selectedDayIndex === index && styles.barSelected
                        ]}
                      />
                    </View>
                    
                    <Text style={[
                      styles.barLabel,
                      selectedDayIndex === index && styles.barLabelSelected
                    ]}>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            {/* Interactive Tooltip */}
            {tooltipVisible && selectedDayIndex !== null && (
              <TouchableOpacity 
                style={styles.tooltipOverlay}
                activeOpacity={1}
                onPress={handleCloseTooltip}
              >
                <View style={styles.tooltipContainer}>
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.tooltipGradient}
                  >
                    <View style={styles.tooltipHeader}>
                      <Text style={styles.tooltipDay}>{getDayName(selectedDayIndex)}</Text>
                      <TouchableOpacity onPress={handleCloseTooltip} style={styles.tooltipClose}>
                        <Icon name="close" size={20} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                    
                    <View style={styles.tooltipStats}>
                      <View style={styles.tooltipStatItem}>
                        <Icon name="menu-book" size={32} color="#FFFFFF" />
                        <Text style={styles.tooltipStatValue}>{weeklyWordCounts[selectedDayIndex]}</Text>
                        <Text style={styles.tooltipStatLabel}>
                          {weeklyWordCounts[selectedDayIndex] === 1 ? 'Word Practiced' : 'Words Practiced'}
                        </Text>
                      </View>
                      
                      <View style={styles.tooltipDivider} />
                      
                      <View style={styles.tooltipStatItem}>
                        <Icon name="trending-up" size={32} color="#FFFFFF" />
                        <Text style={styles.tooltipStatValue}>{weeklyData[selectedDayIndex]}%</Text>
                        <Text style={styles.tooltipStatLabel}>Accuracy Rate</Text>
                      </View>
                    </View>
                    
                    <View style={styles.tooltipFooter}>
                      <Icon name="touch-app" size={16} color="rgba(255, 255, 255, 0.7)" />
                      <Text style={styles.tooltipFooterText}>Tap anywhere to close</Text>
                    </View>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Text style={styles.sectionSubtitle}>
              {achievements.filter(a => a.unlocked).length} of {achievements.length}
            </Text>
          </View>
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
                style={[
                  styles.achievementCard,
                  !achievement.unlocked && styles.achievementLocked
                ]}
              >
                <View style={[
                  styles.achievementIcon,
                  { backgroundColor: achievement.unlocked ? achievement.color : '#E5E7EB' }
                ]}>
                  <Icon
                    name={achievement.icon}
                    size={32}
                    color={achievement.unlocked ? '#FFFFFF' : '#9CA3AF'}
                  />
                </View>
                <Text style={[
                  styles.achievementTitle,
                  !achievement.unlocked && styles.achievementTitleLocked
                ]}>
                  {achievement.title}
                </Text>
                {achievement.unlocked && (
                  <View style={styles.unlockedBadge}>
                    <Icon name="check" size={14} color="#10B981" />
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Recent Practice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Practice</Text>
          <View style={styles.card}>
            {recentPractice.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="history" size={48} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>No practice history yet</Text>
                <Text style={styles.emptyStateSubtext}>Your recent practice will appear here</Text>
              </View>
            ) : (
              recentPractice.map((item, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.practiceItem,
                    index === recentPractice.length - 1 && styles.practiceItemLast
                  ]}
                >
                  {/* Practice Type Icon */}
                  <View style={[
                    styles.practiceTypeIcon,
                    { backgroundColor: `${getPracticeTypeColor(item.type)}20` }
                  ]}>
                    <Icon 
                      name={getPracticeTypeIcon(item.type)} 
                      size={20} 
                      color={getPracticeTypeColor(item.type)} 
                    />
                  </View>

                  {/* Practice Info */}
                  <View style={styles.practiceInfo}>
                    <Text style={styles.practiceWord} numberOfLines={2}>
                      {item.word}
                    </Text>
                    <Text style={styles.practiceDate}>{item.date}</Text>
                  </View>

                  {/* Accuracy Badge */}
                  <View style={styles.practiceStats}>
                    <View style={[
                      styles.accuracyBadge,
                      { 
                        backgroundColor: item.accuracy >= 85 ? '#ECFDF5' : 
                                       item.accuracy >= 70 ? '#FEF3C7' : '#FEE2E2'
                      }
                    ]}>
                      <Text style={[
                        styles.practiceAccuracy,
                        { 
                          color: item.accuracy >= 85 ? '#10B981' : 
                                item.accuracy >= 70 ? '#F59E0B' : '#EF4444'
                        }
                      ]}>
                        {item.accuracy}%
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Settings Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.settingItem}>
              <Icon name="notifications" size={24} color="#6B7280" />
              <Text style={styles.settingText}>Notifications</Text>
              <Icon name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <Icon name="language" size={24} color="#6B7280" />
              <Text style={styles.settingText}>Language</Text>
              <Icon name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingItem}>
              <Icon name="privacy-tip" size={24} color="#6B7280" />
              <Text style={styles.settingText}>Privacy</Text>
              <Icon name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.settingItem, styles.settingItemLast]}>
              <Icon name="help" size={24} color="#6B7280" />
              <Text style={styles.settingText}>Help & Support</Text>
              <Icon name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Icon name="logout" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* STREAK CALENDAR MODAL */}
      {/* Avatar Picker Modal */}
      <Modal
        visible={showAvatarPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowAvatarPicker(false)}
          >
            <TouchableOpacity 
              style={styles.avatarPickerContainer}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.avatarPickerHeader}>
                <Text style={styles.avatarPickerTitle}>Choose Your Avatar</Text>
                <TouchableOpacity 
                  onPress={() => setShowAvatarPicker(false)}
                  style={styles.closeIconButton}
                >
                  <Icon name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              
              <ScrollView 
                style={styles.avatarOptionsScroll}
                contentContainerStyle={styles.avatarOptionsGrid}
                showsVerticalScrollIndicator={false}
              >
                {AVATAR_OPTIONS.map((avatar, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.avatarOption,
                      userAvatar === avatar && styles.avatarOptionSelected,
                      avatar === 'initial' && styles.initialAvatarOption
                    ]}
                    onPress={() => handleAvatarSelect(avatar)}
                    activeOpacity={0.7}
                  >
                    {avatar === 'initial' ? (
                      <>
                        <LinearGradient
                          colors={['#6366F1', '#8B5CF6']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.initialAvatarGradient}
                        >
                          <Text style={styles.initialAvatarText}>
                            {userName.charAt(0).toUpperCase()}
                          </Text>
                        </LinearGradient>
                        <Text style={styles.initialAvatarLabel}>Initial</Text>
                      </>
                    ) : (
                      <Text style={styles.avatarOptionEmoji}>{avatar}</Text>
                    )}
                    {userAvatar === avatar && (
                      <View style={styles.selectedBadge}>
                        <Icon name="check" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      </Modal>

      <StreakCalendar 
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        streakDays={streakDays}
        currentStreak={stats.streak}
      />
    </View>
  );
}

// ... (keep the existing styles object exactly as it was)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  profileGradient: {
    padding: 28,
    alignItems: 'center',
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarEmoji: {
    fontSize: 42,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 12,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 10,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  barPercentage: {
    fontSize: 13,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  barPercentageSelected: {
    color: '#4F46E5',
    fontSize: 14,
  },
  barWrapper: {
    flex: 1,
    width: '70%',
    justifyContent: 'flex-end',
    marginBottom: 8,
    position: 'relative',
  },
  bar: {
    width: '100%',
    borderRadius: 8,
    minHeight: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  barSelected: {
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    transform: [{ scale: 1.05 }],
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 8,
  },
  barLabelSelected: {
    color: '#6366F1',
    fontWeight: '700',
  },
  tooltipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  tooltipContainer: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  tooltipGradient: {
    padding: 24,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  tooltipDay: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  tooltipClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  tooltipStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  tooltipDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  tooltipStatValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -1,
  },
  tooltipStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textAlign: 'center',
  },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tooltipFooterText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
  },
  achievementLocked: {
    opacity: 0.5,
  },
  achievementIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  achievementTitleLocked: {
    color: '#9CA3AF',
  },
  unlockedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  practiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  practiceItemLast: {
    borderBottomWidth: 0,
  },
  practiceTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  practiceInfo: {
    flex: 1,
    marginRight: 12,
  },
  practiceWord: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  practiceDate: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  practiceStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accuracyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  practiceAccuracy: {
    fontSize: 15,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 14,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#FEE2E2',
    gap: 10,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: width - 40,
    maxHeight: 520,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  avatarPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOptionsScroll: {
    maxHeight: 420,
  },
  avatarOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  avatarOption: {
    width: (width - 40 - 32 - 48) / 5, // 5 columns with gaps
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  avatarOptionSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
    borderWidth: 3,
  },
  avatarOptionEmoji: {
    fontSize: 32,
  },
  initialAvatarOption: {
    backgroundColor: 'transparent',
    padding: 4,
  },
  initialAvatarGradient: {
    width: '100%',
    height: '70%',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  initialAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  initialAvatarLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});