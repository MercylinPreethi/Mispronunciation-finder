import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ref, onValue, get } from 'firebase/database';
import { auth, db } from '../../firebaseConfig';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const [streak, setStreak] = useState(0);
  const [todayProgress, setTodayProgress] = useState(0);
  const [totalWords, setTotalWords] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      
      // Fetch user stats from Firebase
      const userStatsRef = ref(db, `users/${user.uid}/stats`);
      onValue(userStatsRef, (snapshot) => {
        const stats = snapshot.val();
        if (stats) {
          setStreak(stats.streak || 0);
          setTodayProgress(stats.todayProgress || 0);
          setTotalWords(stats.totalWords || 0);
          setAccuracy(stats.accuracy || 0);
        }
      });
    }
  }, []);

  const dailyLessons = [
    { id: 1, title: 'Basic Vowels', difficulty: 'Easy', words: 15, completed: 12, icon: 'volume-up' },
    { id: 2, title: 'Consonant Sounds', difficulty: 'Medium', words: 20, completed: 8, icon: 'hearing' },
    { id: 3, title: 'Difficult Words', difficulty: 'Hard', words: 10, completed: 2, icon: 'stars' },
  ];

  const quickPracticeWords = ['Beautiful', 'Pronunciation', 'Algorithm', 'Schedule', 'Queue'];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
              <Text style={styles.headerSubtitle}>Let's practice today</Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{streak}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Today's Progress Card */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Today's Progress</Text>
              <Text style={styles.progressPercentage}>{todayProgress}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${todayProgress}%` }]} />
            </View>
            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{totalWords}</Text>
                <Text style={styles.progressStatLabel}>Words</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{accuracy}%</Text>
                <Text style={styles.progressStatLabel}>Accuracy</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{Math.floor(todayProgress * 0.3)}</Text>
                <Text style={styles.progressStatLabel}>Minutes</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Daily Lessons */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Lessons</Text>
          {dailyLessons.map((lesson) => (
            <TouchableOpacity key={lesson.id} style={styles.lessonCard}>
              <View style={[styles.lessonIcon, { backgroundColor: `${getDifficultyColor(lesson.difficulty)}20` }]}>
                <Icon name={lesson.icon} size={28} color={getDifficultyColor(lesson.difficulty)} />
              </View>
              <View style={styles.lessonContent}>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <View style={styles.lessonMeta}>
                  <View style={[styles.difficultyBadge, { backgroundColor: `${getDifficultyColor(lesson.difficulty)}20` }]}>
                    <Text style={[styles.difficultyText, { color: getDifficultyColor(lesson.difficulty) }]}>
                      {lesson.difficulty}
                    </Text>
                  </View>
                  <Text style={styles.lessonWords}>{lesson.words} words</Text>
                </View>
                <View style={styles.lessonProgressBar}>
                  <View 
                    style={[
                      styles.lessonProgress, 
                      { 
                        width: `${(lesson.completed / lesson.words) * 100}%`,
                        backgroundColor: getDifficultyColor(lesson.difficulty)
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.lessonCompleted}>{lesson.completed}/{lesson.words} completed</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Practice */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Practice</Text>
          <View style={styles.card}>
            <Text style={styles.quickPracticeSubtitle}>Tap a word to practice</Text>
            <View style={styles.wordChips}>
              {quickPracticeWords.map((word, index) => (
                <TouchableOpacity key={index} style={styles.wordChip}>
                  <Text style={styles.wordChipText}>{word}</Text>
                  <Icon name="mic" size={18} color="#6366F1" style={styles.wordChipIcon} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Continue Learning Button */}
        <TouchableOpacity style={styles.continueButton}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueGradient}
          >
            <Text style={styles.continueButtonText}>Continue Learning</Text>
            <Icon name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
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
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  streakEmoji: {
    fontSize: 24,
    marginRight: 6,
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressPercentage: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6366F1',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  progressStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  lessonIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  difficultyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  lessonWords: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  lessonProgressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  lessonProgress: {
    height: '100%',
    borderRadius: 3,
  },
  lessonCompleted: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  quickPracticeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    fontWeight: '500',
  },
  wordChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  wordChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
    marginRight: 8,
  },
  wordChipIcon: {
    marginLeft: 4,
  },
  continueButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 10,
  },
});
