import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import RNFS from 'react-native-fs';
import RNFS from 'react-native-fs';

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

interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  tip: string;
  difficulty: 'easy' | 'intermediate' | 'hard';
}

interface DailyWordProgress {
  word: string;
  date: string;
  completed: boolean;
  mastered: boolean;
  accuracy: number;
  attempts: number;
  bestScore: number;
  attemptHistory?: DailyWordAttempt[];
}

interface DailyWordAttempt {
  timestamp: string;
  accuracy: number;
  feedback: string;
  correct_phonemes: number;
  total_phonemes: number;
}

interface DailyWordCardProps {
  word: Word;
  progress?: DailyWordProgress;
  onStartPractice: () => void;
  onViewHistory: () => void;
  showHistory?: boolean;
}

export default function DailyWordCard({
  word,
  progress,
  onStartPractice,
  onViewHistory,
  showHistory = false,
}: DailyWordCardProps) {
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(cardAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (expanded) {
      Animated.timing(expandAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [expanded]);

  // Pulse animation for incomplete daily word
  useEffect(() => {
    if (progress && !progress.completed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [progress]);

  const handlePlayPronunciation = async () => {
    try {
      Haptics.selectionAsync();
      setLoadingAudio(true);
      
      if (playing) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlaying(false);
        return;
      }
      
      try {
        const response = await axios.get(`${API_BASE_URL}/get_word_audio/${word.word}`, {
          responseType: 'arraybuffer',
          timeout: 10000
        });
        
        if (response.data) {
          const uint8Array = new Uint8Array(response.data);
          let binary = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Audio = btoa(binary);
          await playBase64Audio(base64Audio);
        }
      } catch (apiError) {
        console.error('API word audio request failed:', apiError);
        Alert.alert('Audio Not Available', `Pronunciation audio for "${word.word}" is not available.`);
      }
    } catch (error) {
      console.error('Error playing word audio:', error);
      setPlaying(false);
    } finally {
      setLoadingAudio(false);
    }
  };

  const playBase64Audio = async (base64Audio: string) => {
    try {
      const audioPath = `${RNFS.DocumentDirectoryPath}/temp_daily_${word.word}.m4a`;
      await RNFS.writeFile(audioPath, base64Audio, 'base64');
      
      await audioRecorderPlayer.startPlayer(audioPath);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          setPlaying(false);
          audioRecorderPlayer.removePlayBackListener();
        }
      });
      
      setPlaying(true);
    } catch (error) {
      console.error('Error playing base64 audio:', error);
      setPlaying(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return COLORS.success;
      case 'intermediate': return COLORS.warning;
      case 'hard': return COLORS.error;
      default: return COLORS.primary;
    }
  };

  const getDifficultyBackground = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#D1FAE5';
      case 'intermediate': return '#FEF3C7';
      case 'hard': return '#FEE2E2';
      default: return COLORS.gray[100];
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return COLORS.success;
    if (accuracy >= 0.7) return COLORS.warning;
    return COLORS.error;
  };

  const formatAccuracy = (accuracy: number) => {
    return `${(accuracy * 100).toFixed(0)}%`;
  };

  const hasAttempts = progress && progress.attempts > 0;
  const isCompleted = progress && progress.completed;
  const isMastered = progress && progress.mastered;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: cardAnim,
          transform: [
            {
              translateY: cardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}
    >
      <LinearGradient
        colors={[COLORS.gold, '#D97706']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon name="wb-sunny" size={24} color={COLORS.white} />
            <Text style={styles.headerTitle}>Today's Challenge</Text>
          </View>
          {!isCompleted && (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>!</Text>
              </View>
            </Animated.View>
          )}
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Word Display */}
        <View style={styles.wordSection}>
          <View style={styles.wordHeader}>
            <Text style={styles.wordText}>{word.word}</Text>
            <View style={styles.wordActions}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={handlePlayPronunciation}
                disabled={loadingAudio}
              >
                {loadingAudio ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <Icon 
                    name={playing ? "pause" : "play-arrow"} 
                    size={20} 
                    color={COLORS.primary} 
                  />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.expandButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  setExpanded(!expanded);
                }}
              >
                <Icon 
                  name={expanded ? "expand-less" : "expand-more"} 
                  size={24} 
                  color={COLORS.gray[600]} 
                />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.phoneticText}>{word.phonetic}</Text>
          
          {/* Difficulty Badge */}
          <View style={[
            styles.difficultyBadge,
            { 
              backgroundColor: getDifficultyBackground(word.difficulty),
              borderColor: getDifficultyColor(word.difficulty)
            }
          ]}>
            <Text style={[
              styles.difficultyText,
              { color: getDifficultyColor(word.difficulty) }
            ]}>
              {word.difficulty.charAt(0).toUpperCase() + word.difficulty.slice(1)}
            </Text>
          </View>
        </View>

        {/* Progress Summary */}
        {hasAttempts && (
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Icon name="history" size={18} color={COLORS.primary} />
              <Text style={styles.progressTitle}>Latest Attempt</Text>
              {isCompleted && (
                <View style={styles.completedBadge}>
                  <Icon name="check-circle" size={16} color={COLORS.success} />
                  <Text style={styles.completedText}>Completed</Text>
                </View>
              )}
            </View>
            
            <View style={styles.progressStats}>
              <View style={styles.statItem}>
                <Text style={[
                  styles.statValue,
                  { color: getAccuracyColor(progress.accuracy) }
                ]}>
                  {formatAccuracy(progress.accuracy)}
                </Text>
                <Text style={styles.statLabel}>Accuracy</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{progress.attempts}</Text>
                <Text style={styles.statLabel}>Attempts</Text>
              </View>
              
              <View style={styles.statDivider} />
              
              <View style={styles.statItem}>
                <Text style={[
                  styles.statValue,
                  { color: getAccuracyColor(progress.bestScore) }
                ]}>
                  {formatAccuracy(progress.bestScore)}
                </Text>
                <Text style={styles.statLabel}>Best</Text>
              </View>
            </View>
          </View>
        )}

        {/* Expanded Details */}
        <Animated.View
          style={[
            styles.expandedContent,
            {
              opacity: expandAnim,
              maxHeight: expandAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 300],
              }),
            },
          ]}
        >
          <View style={styles.detailsSection}>
            <View style={styles.detailItem}>
              <View style={styles.detailHeader}>
                <Icon name="book" size={16} color={COLORS.primary} />
                <Text style={styles.detailLabel}>Meaning</Text>
              </View>
              <Text style={styles.detailText}>{word.meaning}</Text>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailHeader}>
                <Icon name="format-quote" size={16} color={COLORS.secondary} />
                <Text style={styles.detailLabel}>Example</Text>
              </View>
              <Text style={styles.detailText}>"{word.example}"</Text>
            </View>

            <View style={styles.detailItem}>
              <View style={styles.detailHeader}>
                <Icon name="lightbulb" size={16} color={COLORS.gold} />
                <Text style={styles.detailLabel}>Pro Tip</Text>
              </View>
              <Text style={styles.detailText}>{word.tip}</Text>
            </View>
          </View>

          {/* Latest Feedback */}
          {hasAttempts && progress.attemptHistory && progress.attemptHistory.length > 0 && (
            <View style={styles.feedbackSection}>
              <Text style={styles.feedbackTitle}>Latest Feedback</Text>
              <Text style={styles.feedbackText}>
                {progress.attemptHistory[progress.attemptHistory.length - 1]?.feedback || 'No feedback available'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.practiceButton}
            onPress={onStartPractice}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.practiceButtonGradient}
            >
              <Icon 
                name={hasAttempts ? "refresh" : "play-arrow"} 
                size={20} 
                color={COLORS.white} 
              />
              <Text style={styles.practiceButtonText}>
                {hasAttempts ? 'Try Again' : 'Start Challenge'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {hasAttempts && (
            <TouchableOpacity
              style={styles.historyButton}
              onPress={onViewHistory}
            >
              <Icon name="history" size={18} color={COLORS.primary} />
              <Text style={styles.historyButtonText}>View History</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  headerGradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
  },
  notificationBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  content: {
    padding: 16,
  },
  wordSection: {
    marginBottom: 16,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wordText: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gray[900],
  },
  wordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneticText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 12,
  },
  difficultyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressSection: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.gray[300],
    marginHorizontal: 8,
  },
  expandedContent: {
    overflow: 'hidden',
  },
  detailsSection: {
    marginBottom: 16,
  },
  detailItem: {
    marginBottom: 12,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  detailText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray[600],
    lineHeight: 20,
  },
  feedbackSection: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  feedbackTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray[700],
    marginBottom: 6,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray[600],
    lineHeight: 18,
  },
  actionButtons: {
    gap: 12,
  },
  practiceButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  practiceButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  practiceButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray[100],
    gap: 8,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});