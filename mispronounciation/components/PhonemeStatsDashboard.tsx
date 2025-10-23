// components/PhonemeStatsDashboard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PhonemePracticeData } from '../lib/phonemeFirebaseService';

const COLORS = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  gold: '#FFC800',
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  white: '#FFFFFF',
};

interface PhonemeStatsDashboardProps {
  phonemeData: Record<string, PhonemePracticeData>;
}

export default function PhonemeStatsDashboard({ phonemeData }: PhonemeStatsDashboardProps) {
  const phonemes = Object.values(phonemeData);
  
  if (phonemes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="info-outline" size={48} color={COLORS.gray[400]} />
        <Text style={styles.emptyText}>
          No phoneme practice data yet. Start practicing to see your progress!
        </Text>
      </View>
    );
  }

  // Calculate statistics
  const totalPhonemes = phonemes.length;
  const masteredPhonemes = phonemes.filter(p => p.mastered).length;
  const totalAttempts = phonemes.reduce((sum, p) => sum + (p.totalAttempts || 0), 0);
  const averageScore = phonemes.reduce((sum, p) => sum + p.bestScore, 0) / totalPhonemes;
  const completionRate = (masteredPhonemes / totalPhonemes) * 100;

  // Get phonemes that need practice (not mastered, sorted by best score ascending)
  const needsPractice = phonemes
    .filter(p => !p.mastered)
    .sort((a, b) => a.bestScore - b.bestScore)
    .slice(0, 5);

  // Get recently practiced phonemes
  const recentPractice = phonemes
    .filter(p => p.lastAttempted)
    .sort((a, b) => new Date(b.lastAttempted).getTime() - new Date(a.lastAttempted).getTime())
    .slice(0, 5);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Overall Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Overall Progress</Text>
        
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <LinearGradient
              colors={[COLORS.success, '#059669']}
              style={styles.statGradient}
            >
              <Icon name="verified" size={32} color={COLORS.white} />
              <Text style={styles.statValue}>{masteredPhonemes}</Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.statGradient}
            >
              <Icon name="graphic-eq" size={32} color={COLORS.white} />
              <Text style={styles.statValue}>{totalPhonemes}</Text>
              <Text style={styles.statLabel}>Total Phonemes</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={[COLORS.warning, '#D97706']}
              style={styles.statGradient}
            >
              <Icon name="fitness-center" size={32} color={COLORS.white} />
              <Text style={styles.statValue}>{totalAttempts}</Text>
              <Text style={styles.statLabel}>Total Attempts</Text>
            </LinearGradient>
          </View>

          <View style={styles.statCard}>
            <LinearGradient
              colors={[COLORS.gold, '#F59E0B']}
              style={styles.statGradient}
            >
              <Icon name="emoji-events" size={32} color={COLORS.white} />
              <Text style={styles.statValue}>{Math.round(averageScore * 100)}%</Text>
              <Text style={styles.statLabel}>Avg Score</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Completion Rate</Text>
            <Text style={styles.progressValue}>{Math.round(completionRate)}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={[COLORS.success, '#059669']}
              style={[styles.progressBarFill, { width: `${completionRate}%` }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </View>
        </View>
      </View>

      {/* Needs Practice */}
      {needsPractice.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Needs Practice</Text>
          {needsPractice.map((phoneme, index) => (
            <View key={index} style={styles.phonemeItem}>
              <View style={styles.phonemeLeft}>
                <View style={[
                  styles.phonemeIcon,
                  { backgroundColor: phoneme.bestScore >= 0.5 ? `${COLORS.warning}20` : `${COLORS.error}20` }
                ]}>
                  <Text style={[
                    styles.phonemeSymbol,
                    { color: phoneme.bestScore >= 0.5 ? COLORS.warning : COLORS.error }
                  ]}>
                    {phoneme.phoneme}
                  </Text>
                </View>
                <View style={styles.phonemeInfo}>
                  <Text style={styles.phonemeWord}>{phoneme.word}</Text>
                  <Text style={styles.phonemeAttempts}>{phoneme.totalAttempts} attempts</Text>
                </View>
              </View>
              <View style={styles.phonemeRight}>
                <Text style={[
                  styles.phonemeScore,
                  { color: phoneme.bestScore >= 0.5 ? COLORS.warning : COLORS.error }
                ]}>
                  {Math.round(phoneme.bestScore * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Practice */}
      {recentPractice.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Practice</Text>
          {recentPractice.map((phoneme, index) => (
            <View key={index} style={styles.phonemeItem}>
              <View style={styles.phonemeLeft}>
                <View style={[
                  styles.phonemeIcon,
                  { backgroundColor: phoneme.mastered ? `${COLORS.success}20` : `${COLORS.primary}20` }
                ]}>
                  <Text style={[
                    styles.phonemeSymbol,
                    { color: phoneme.mastered ? COLORS.success : COLORS.primary }
                  ]}>
                    {phoneme.phoneme}
                  </Text>
                </View>
                <View style={styles.phonemeInfo}>
                  <Text style={styles.phonemeWord}>{phoneme.word}</Text>
                  <Text style={styles.phonemeDate}>
                    {new Date(phoneme.lastAttempted).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <View style={styles.phonemeRight}>
                {phoneme.mastered && (
                  <Icon name="verified" size={24} color={COLORS.success} />
                )}
                <Text style={[
                  styles.phonemeScore,
                  { color: phoneme.mastered ? COLORS.success : COLORS.primary }
                ]}>
                  {Math.round(phoneme.bestScore * 100)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[500],
    textAlign: 'center',
    marginTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.gray[800],
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
    opacity: 0.9,
    textTransform: 'uppercase',
  },
  progressContainer: {
    backgroundColor: COLORS.gray[50],
    padding: 16,
    borderRadius: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  progressValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.success,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: COLORS.gray[200],
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  phonemeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  phonemeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  phonemeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phonemeSymbol: {
    fontSize: 18,
    fontWeight: '800',
  },
  phonemeInfo: {
    flex: 1,
  },
  phonemeWord: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 2,
  },
  phonemeAttempts: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  phonemeDate: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  phonemeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phonemeScore: {
    fontSize: 16,
    fontWeight: '800',
  },
});
