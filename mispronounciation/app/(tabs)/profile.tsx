import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { auth, database as db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState({
    totalWords: 0,
    accuracy: 0,
    streak: 0,
    practiceTime: 0,
  });
  const [weeklyData, setWeeklyData] = useState([65, 80, 45, 90, 70, 85, 95]);
  const [achievements, setAchievements] = useState([
    { id: 1, title: 'First Steps', icon: 'stars', unlocked: true, color: '#10B981' },
    { id: 2, title: '7 Day Streak', icon: 'local-fire-department', unlocked: true, color: '#F59E0B' },
    { id: 3, title: '100 Words', icon: 'workspace-premium', unlocked: true, color: '#6366F1' },
    { id: 4, title: 'Perfect Score', icon: 'emoji-events', unlocked: false, color: '#D1D5DB' },
  ]);

  const [recentPractice, setRecentPractice] = useState([
    { word: 'Beautiful', accuracy: 92, improvement: 5, date: 'Today' },
    { word: 'Schedule', accuracy: 78, improvement: -3, date: 'Yesterday' },
    { word: 'Algorithm', accuracy: 85, improvement: 12, date: '2 days ago' },
  ]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      setUserEmail(user.email || '');

      const userStatsRef = ref(db, `users/${user.uid}/stats`);
      onValue(userStatsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setStats({
            totalWords: data.totalWords || 0,
            accuracy: data.accuracy || 0,
            streak: data.streak || 0,
            practiceTime: data.practiceTime || 0,
          });
        }
      });
    }
  }, []);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/(auth)/signin');
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  const maxWeeklyValue = Math.max(...weeklyData);

  return (
    <View style={styles.container}>
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
            <Text style={styles.statLabel}>Accuracy</Text>
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
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <View style={styles.card}>
            <View style={styles.chartContainer}>
              {weeklyData.map((value, index) => (
                <View key={index} style={styles.barContainer}>
                  <View style={styles.barWrapper}>
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={[
                        styles.bar,
                        { height: `${(value / maxWeeklyValue) * 100}%` }
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Achievements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Achievements</Text>
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
                  { backgroundColor: `${achievement.color}${achievement.unlocked ? 'FF' : '40'}` }
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
              </View>
            ))}
          </View>
        </View>

        {/* Recent Practice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Practice</Text>
          <View style={styles.card}>
            {recentPractice.map((item, index) => (
              <View key={index} style={styles.practiceItem}>
                <View style={styles.practiceInfo}>
                  <Text style={styles.practiceWord}>{item.word}</Text>
                  <Text style={styles.practiceDate}>{item.date}</Text>
                </View>
                <View style={styles.practiceStats}>
                  <Text style={styles.practiceAccuracy}>{item.accuracy}%</Text>
                  <View style={[
                    styles.improvementBadge,
                    { backgroundColor: item.improvement >= 0 ? '#ECFDF5' : '#FEF2F2' }
                  ]}>
                    <Icon
                      name={item.improvement >= 0 ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={item.improvement >= 0 ? '#10B981' : '#EF4444'}
                    />
                    <Text style={[
                      styles.improvementText,
                      { color: item.improvement >= 0 ? '#10B981' : '#EF4444' }
                    ]}>
                      {Math.abs(item.improvement)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
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
            <TouchableOpacity style={styles.settingItem}>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  profileCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
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
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    flex: 1,
    width: '70%',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  bar: {
    width: '100%',
    borderRadius: 6,
    minHeight: 20,
  },
  barLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 8,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achievementCard: {
    width: (width - 52) / 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  achievementLocked: {
    opacity: 0.6,
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
  practiceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  practiceInfo: {
    flex: 1,
  },
  practiceWord: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  practiceDate: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  practiceStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  practiceAccuracy: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  improvementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  improvementText: {
    fontSize: 13,
    fontWeight: '700',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
    borderRadius: 14,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    gap: 10,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#EF4444',
  },
});
