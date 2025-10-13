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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, database } from '../../lib/firebase';
import { ref, get } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

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

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
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
      ]);

      setLoading(false);
    } catch (error) {
      console.error('❌ Error loading user data:', error);
      setLoading(false);
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
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadAllPracticeHistory = async (userId: string) => {
    try {
      const allPractices: PracticeHistory[] = [];
      const practiceMap = new Map<string, PracticeHistory>(); // Track unique practices

      // 1. Load Daily Words
      console.log('📅 Loading daily words...');
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      const dailySnapshot = await get(dailyWordsRef);
      
      if (dailySnapshot.exists()) {
        const dailyData = dailySnapshot.val();
        Object.entries(dailyData).forEach(([date, dayData]: [string, any]) => {
          if (dayData.attempts > 0) {
            const word = dayData.word.toLowerCase(); // Use lowercase as key
            const practice: PracticeHistory = {
              word: ` ${dayData.word}`,
              accuracy: Math.round((dayData.bestScore || dayData.accuracy || 0) * 100),
              timestamp: new Date(date).getTime(),
              date: formatDate(new Date(date).getTime()),
              type: 'daily_word',
              practiceType: 'daily_word',
            };

            // Only keep the most recent attempt for each word
            const existingPractice = practiceMap.get(word);
            if (!existingPractice || practice.timestamp > existingPractice.timestamp) {
              practiceMap.set(word, practice);
            }
          }
        });
        console.log(`✅ Loaded ${Object.keys(dailyData).length} daily words`);
      }

      // 2. Load Practice Sessions (Custom Sentences)
      console.log('📝 Loading practice sessions...');
      const referencesRef = ref(database, `users/${userId}/references`);
      const referencesSnapshot = await get(referencesRef);
      
      if (referencesSnapshot.exists()) {
        const referencesData = referencesSnapshot.val();
        
        Object.entries(referencesData).forEach(([sessionId, sessionData]: [string, any]) => {
          if (sessionData.attempts) {
            const text = (sessionData.text || 'Practice Session').toLowerCase(); // Use lowercase as key
            const displayText = sessionData.text || 'Practice Session';
            const wordCount = displayText.split(' ').length;
            
            // Get all attempts for this session and find the most recent
            const attempts = Object.entries(sessionData.attempts).map(([attemptId, attemptData]: [string, any]) => ({
              id: attemptId,
              timestamp: new Date(attemptData.timestamp).getTime(),
              accuracy: Math.round((attemptData.scores?.accuracy || 0) * 100),
              data: attemptData,
            }));

            // Sort by timestamp to get the most recent
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

              // Only keep the most recent attempt for each sentence
              const existingPractice = practiceMap.get(text);
              if (!existingPractice || practice.timestamp > existingPractice.timestamp) {
                practiceMap.set(text, practice);
              }
            }
          }
        });
        console.log(`✅ Loaded ${Object.keys(referencesData).length} practice sessions`);
      }

      // Convert map to array
      const uniquePractices = Array.from(practiceMap.values());

      // Sort by timestamp (most recent first) and take top 5
      uniquePractices.sort((a, b) => b.timestamp - a.timestamp);
      const recentFive = uniquePractices.slice(0, 5);
      
      console.log(`📊 Total unique practices: ${uniquePractices.length}, showing: ${recentFive.length}`);
      console.log('Recent practices:', recentFive.map(p => ({ word: p.word, accuracy: p.accuracy, date: p.date })));
      
      setRecentPractice(recentFive);

      // Calculate weekly progress from ALL practices (including duplicates for accurate stats)
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
      
      const weekData = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun
      const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Number of words practiced each day
      
      allPractices.forEach((practice) => {
        if (practice.timestamp >= sevenDaysAgo) {
          const practiceDate = new Date(practice.timestamp);
          const dayOfWeek = practiceDate.getDay(); // 0 = Sunday
          const mondayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Mon=0, Sun=6
          
          weekData[mondayIndex] += practice.accuracy;
          dayCounts[mondayIndex] += 1;
        }
      });

      // Calculate average for each day
      const averagedData = weekData.map((total, index) => {
        const count = dayCounts[index];
        return count > 0 ? Math.round(total / count) : 0;
      });

      console.log('📊 Weekly data (from unique practices):', averagedData);
      console.log('📊 Weekly word counts:', dayCounts);
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
      
      console.log('🏆 Calculating achievements...');

      const totalWords = stats?.totalWords || 0;
      const currentStreak = stats?.streak || stats?.currentStreak || 0;
      const averageAccuracy = (stats?.accuracy || stats?.averageAccuracy || 0);
      const totalAttempts = stats?.totalAttempts || 0;

      // Convert accuracy to 0-1 scale if it's in 0-100 scale
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

      const unlockedCount = achievementsList.filter(a => a.unlocked).length;
      console.log(`🎯 Achievements: ${unlockedCount}/${achievementsList.length} unlocked`);

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
              // Clear saved credentials
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
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
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
          <View style={styles.statCard}>
            <Icon name="local-fire-department" size={28} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
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
    </View>
  );
}


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
});