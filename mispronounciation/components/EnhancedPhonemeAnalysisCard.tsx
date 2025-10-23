// components/EnhancedPhonemeAnalysisCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import RNFS from 'react-native-fs';
import { 
  PhonemePracticeAttempt, 
  PhonemePracticeData 
} from '../lib/phonemeFirebaseService';

const { width } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

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

interface PhonemeAnalysis {
  phoneme: string;
  status: 'correct' | 'partial' | 'mispronounced';
  accuracy: number;
  feedback: string;
  reference_phoneme: string;
  predicted_phoneme: string;
}

// PhonemePracticeAttempt and PhonemePracticeData are imported at the top from phonemeFirebaseService

interface EnhancedPhonemeAnalysisCardProps {
  phoneme: PhonemeAnalysis;
  practiceData?: PhonemePracticeData;
  onPlayPhoneme: (phoneme: string) => void;
  onPracticePhoneme: (phoneme: string) => void;
  isPlaying?: boolean;
  isPracticing?: boolean;
  isRecording?: boolean;
  recordingTime?: string;
}

export default function EnhancedPhonemeAnalysisCard({
  phoneme,
  practiceData,
  onPlayPhoneme,
  onPracticePhoneme,
  isPlaying = false,
  isPracticing = false,
  isRecording = false,
  recordingTime = '00:00',
}: EnhancedPhonemeAnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  const expandAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Expand/collapse animation
  useEffect(() => {
    Animated.spring(expandAnim, {
      toValue: expanded ? 1 : 0,
      tension: 50,
      friction: 7,
      useNativeDriver: false,
    }).start();
  }, [expanded]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording && isPracticing) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, isPracticing]);

  // Shimmer animation for mastered phonemes
  useEffect(() => {
    if (practiceData?.mastered) {
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [practiceData?.mastered]);

  const getStatusColor = () => {
    if (practiceData?.mastered) return COLORS.success;
    switch (phoneme.status) {
      case 'correct': return COLORS.success;
      case 'partial': return COLORS.warning;
      case 'mispronounced': return COLORS.error;
      default: return COLORS.gray[500];
    }
  };

  const getStatusGradient = () => {
    if (practiceData?.mastered) return [COLORS.success, '#059669'];
    switch (phoneme.status) {
      case 'correct': return [COLORS.success, '#059669'];
      case 'partial': return [COLORS.warning, '#D97706'];
      case 'mispronounced': return [COLORS.error, '#DC2626'];
      default: return [COLORS.gray[500], COLORS.gray[600]];
    }
  };

  const getStatusIcon = () => {
    if (practiceData?.mastered) return 'verified';
    switch (phoneme.status) {
      case 'correct': return 'check-circle';
      case 'partial': return 'warning';
      case 'mispronounced': return 'cancel';
      default: return 'info';
    }
  };

  const getAccuracyDisplay = () => {
    const accuracy = practiceData?.bestScore ?? phoneme.accuracy;
    return Math.round(accuracy * 100);
  };

  const handlePlayPhoneme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPhoneme(phoneme.phoneme);
  };

  const handlePractice = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPracticePhoneme(phoneme.phoneme);
  };

  const toggleExpand = () => {
    Haptics.selectionAsync();
    setExpanded(!expanded);
  };

  const statusColor = getStatusColor();
  const statusGradient = getStatusGradient();
  const statusIcon = getStatusIcon();
  const accuracyValue = getAccuracyDisplay();

  const maxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 300],
  });

  return (
    <View style={styles.container}>
      {/* Card Header */}
      <TouchableOpacity
        style={[styles.cardHeader, { borderColor: statusColor }]}
        onPress={toggleExpand}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[`${statusColor}15`, `${statusColor}25`]}
          style={styles.cardHeaderGradient}
        >
          {/* Mastered Shimmer Effect */}
          {practiceData?.mastered && (
            <Animated.View
              style={[
                styles.shimmerOverlay,
                {
                  opacity: shimmerAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 0.6, 0.3],
                  }),
                },
              ]}
            />
          )}

          <View style={styles.headerLeft}>
            {/* Status Icon */}
            <View style={[styles.statusIconContainer, { backgroundColor: `${statusColor}20` }]}>
              <Icon name={statusIcon} size={24} color={statusColor} />
            </View>

            {/* Phoneme Symbol */}
            <View style={styles.phonemeInfo}>
              <Text style={styles.phonemeSymbol}>/{phoneme.phoneme}/</Text>
              <Text style={styles.phonemeCompare}>
                {phoneme.reference_phoneme === phoneme.predicted_phoneme ? (
                  <Text style={{ color: COLORS.success }}>✓ Match</Text>
                ) : (
                  <Text style={{ color: COLORS.error }}>
                    {phoneme.reference_phoneme} → {phoneme.predicted_phoneme}
                  </Text>
                )}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {/* Accuracy Badge */}
            <View style={[styles.accuracyBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.accuracyText}>{accuracyValue}%</Text>
            </View>

            {/* Mastered Badge */}
            {practiceData?.mastered && (
              <View style={styles.masteredBadge}>
                <Icon name="star" size={16} color={COLORS.gold} />
              </View>
            )}

            {/* Expand Icon */}
            <Icon 
              name={expanded ? 'expand-less' : 'expand-more'} 
              size={24} 
              color={statusColor} 
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Expanded Content */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            maxHeight,
            opacity: expandAnim,
          },
        ]}
      >
        <View style={styles.expandedInner}>
          {/* Feedback Section */}
          <View style={styles.feedbackSection}>
            <View style={styles.feedbackHeader}>
              <Icon name="feedback" size={18} color={COLORS.primary} />
              <Text style={styles.feedbackTitle}>Feedback</Text>
            </View>
            <Text style={styles.feedbackText}>{phoneme.feedback}</Text>
          </View>

          {/* Practice Stats */}
          {practiceData && (
            <View style={styles.statsSection}>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Icon name="fitness-center" size={20} color={COLORS.secondary} />
                  <View style={styles.statInfo}>
                    <Text style={styles.statValue}>{practiceData.totalAttempts}</Text>
                    <Text style={styles.statLabel}>Attempts</Text>
                  </View>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statItem}>
                  <Icon name="emoji-events" size={20} color={COLORS.gold} />
                  <View style={styles.statInfo}>
                    <Text style={styles.statValue}>
                      {Math.round(practiceData.bestScore * 100)}%
                    </Text>
                    <Text style={styles.statLabel}>Best Score</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Practice History */}
          {practiceData && practiceData.attempts.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Recent Practice</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.historyScroll}
              >
                {practiceData.attempts.slice(0, 5).map((attempt: { accuracy: number; timestamp: string | number | Date; }, idx: React.Key | null | undefined) => (
                  <View key={idx} style={styles.historyItem}>
                    <View style={[
                      styles.historyScoreCircle,
                      { 
                        borderColor: attempt.accuracy >= 0.8 ? COLORS.success :
                                   attempt.accuracy >= 0.5 ? COLORS.warning : COLORS.error
                      }
                    ]}>
                      <Text style={[
                        styles.historyScore,
                        { 
                          color: attempt.accuracy >= 0.8 ? COLORS.success :
                                 attempt.accuracy >= 0.5 ? COLORS.warning : COLORS.error
                        }
                      ]}>
                        {Math.round(attempt.accuracy * 100)}
                      </Text>
                    </View>
                    <Text style={styles.historyTime}>
                      {new Date(attempt.timestamp).toLocaleDateString([], { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* Listen Button */}
            <TouchableOpacity
              style={[styles.actionButton, styles.listenButton]}
              onPress={handlePlayPhoneme}
              disabled={isPlaying}
            >
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.actionButtonGradient}
              >
                {isPlaying ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Icon name="volume-up" size={20} color={COLORS.white} />
                )}
                <Text style={styles.actionButtonText}>
                  {isPlaying ? 'Playing...' : 'Listen'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Practice Button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }], flex: 1 }}>
              <TouchableOpacity
                style={[styles.actionButton, styles.practiceButton]}
                onPress={handlePractice}
                disabled={isRecording && !isPracticing}
              >
                <LinearGradient
                  colors={isRecording && isPracticing ? 
                    [COLORS.error, '#DC2626'] : 
                    [COLORS.success, '#059669']
                  }
                  style={styles.actionButtonGradient}
                >
                  <Icon 
                    name={isRecording && isPracticing ? 'stop' : 'mic'} 
                    size={20} 
                    color={COLORS.white} 
                  />
                  <Text style={styles.actionButtonText}>
                    {isRecording && isPracticing ? recordingTime : 'Practice'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  cardHeader: {
    borderWidth: 2,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeaderGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.gold,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  statusIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phonemeInfo: {
    flex: 1,
  },
  phonemeSymbol: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  phonemeCompare: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accuracyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  accuracyText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  masteredBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${COLORS.gold}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    overflow: 'hidden',
  },
  expandedInner: {
    padding: 16,
    paddingTop: 0,
  },
  feedbackSection: {
    backgroundColor: COLORS.gray[50],
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 12,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray[700],
    lineHeight: 18,
  },
  statsSection: {
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    padding: 12,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[900],
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[500],
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.gray[300],
    marginHorizontal: 8,
  },
  historySection: {
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray[700],
    marginBottom: 8,
  },
  historyScroll: {
    marginHorizontal: -4,
  },
  historyItem: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  historyScoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginBottom: 4,
  },
  historyScore: {
    fontSize: 14,
    fontWeight: '800',
  },
  historyTime: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  listenButton: {},
  practiceButton: {},
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
});
