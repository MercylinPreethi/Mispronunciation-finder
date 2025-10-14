// app/(tabs)/index.tsx - OPTIMIZED with Fast Sequential Word Progression

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ref, onValue, set, get } from 'firebase/database';
import { auth, database } from '../../lib/firebase';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';
import ProgressCircle from '../../components/ProgressCircle';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
} from 'react-native-audio-recorder-player';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

// Enhanced Material Design 3 Colors with Gradients
const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  secondary: '#8B5CF6',
  tertiary: '#EC4899',
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
  background: '#F8F9FE',
  // Enhanced gradient colors
  gradients: {
    primary: ['#6366F1', '#8B5CF6', '#EC4899'],
    success: ['#10B981', '#059669', '#047857'],
    warning: ['#F59E0B', '#D97706', '#B45309'],
    error: ['#EF4444', '#DC2626', '#B91C1C'],
    gold: ['#FFC800', '#F59E0B', '#D97706'],
    blue: ['#3B82F6', '#2563EB', '#1D4ED8'],
  },
  // Shadow colors
  shadows: {
    primary: 'rgba(99, 102, 241, 0.3)',
    success: 'rgba(16, 185, 129, 0.3)',
    warning: 'rgba(245, 158, 11, 0.3)',
    error: 'rgba(239, 68, 68, 0.3)',
    gold: 'rgba(255, 200, 0, 0.3)',
  },
} as const;

const DIFFICULTY_COLORS = {
  easy: { 
    primary: '#10B981', 
    gradient: ['#10B981', '#059669', '#047857'] as const,
    light: '#D1FAE5',
    shadow: 'rgba(16, 185, 129, 0.4)',
    glow: 'rgba(16, 185, 129, 0.6)',
  },
  intermediate: { 
    primary: '#F59E0B', 
    gradient: ['#F59E0B', '#D97706', '#B45309'] as const,
    light: '#FEF3C7',
    shadow: 'rgba(245, 158, 11, 0.4)',
    glow: 'rgba(245, 158, 11, 0.6)',
  },
  hard: { 
    primary: '#EF4444', 
    gradient: ['#EF4444', '#DC2626', '#B91C1C'] as const,
    light: '#FEE2E2',
    shadow: 'rgba(239, 68, 68, 0.4)',
    glow: 'rgba(239, 68, 68, 0.6)',
  },
} as const;

interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  tip: string;
  difficulty: 'easy' | 'intermediate' | 'hard';
}

interface WordProgress {
  wordId: string;
  word: string;
  completed: boolean;
  attempts: number;
  bestScore: number;
  lastAttempted: string;
  attemptHistory?: PracticeWordAttempt[];
}

interface PracticeWordAttempt {
  timestamp: string;
  accuracy: number;
  feedback: string;
  correct_phonemes: number;
  total_phonemes: number;
}

interface DailyWordProgress {
  word: string;
  date: string;
  completed: boolean;
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

interface UserStats {
  streak: number;
  totalWords: number;
  accuracy: number;
  xp: number;
}

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  feedback: string;
}

interface UserProgressResponse {
  success: boolean;
  difficulty: string;
  next_word: Word | null;
  next_index: number;
  total_words: number;
  completed_count: number;
  completion_percentage: number;
  all_completed: boolean;
}

type DifficultyLevel = 'easy' | 'intermediate' | 'hard';

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<UserStats>({
    streak: 0,
    totalWords: 0,
    accuracy: 0,
    xp: 0,
  });
  
  const [todayWord, setTodayWord] = useState<Word | null>(null);
  const [todayProgress, setTodayProgress] = useState<DailyWordProgress | null>(null);
  
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('easy');
  const [wordProgress, setWordProgress] = useState<{ [key: string]: WordProgress }>({});
  
  // **OPTIMIZED: Sequential Progression States**
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState<Word | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDailyTask, setShowDailyTask] = useState(false);
  
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [isPracticingDaily, setIsPracticingDaily] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false);
  const [showPracticeWordFeedback, setShowPracticeWordFeedback] = useState(false);
  const [selectedWordProgress, setSelectedWordProgress] = useState<WordProgress | null>(null);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [streakDays, setStreakDays] = useState<string[]>([]);

  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const recordingPathRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  
  const badgeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ] as Animated.Value[]).current;

  const dailyTaskPulse = useRef(new Animated.Value(1)).current;
  const wordNodeAnims = useRef<Record<string, Animated.Value>>({}).current;
  const glowAnims = useRef<Record<string, Animated.Value>>({}).current;
  const pulseAnims = useRef<Record<string, Animated.Value>>({}).current;
  const rotateAnims = useRef<Record<string, Animated.Value>>({}).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const streakCalendarAnim = useRef(new Animated.Value(0)).current;

  const initializeOnceRef = useRef(false);
  const loadingRef = useRef(false);
  const lastDifficultyRef = useRef<DifficultyLevel>('easy');
  const cacheRef = useRef<{
    words: { [key: string]: Word[] };
    progress: { [key: string]: any };
  }>({
    words: {},
    progress: {}
  });

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // ============================================================================
  // OPTIMIZED SEQUENTIAL WORD PROGRESSION FUNCTIONS
  // ============================================================================

  /**
   * Fast load all data in parallel
   */
  const loadAllDataFast = async (difficulty: DifficultyLevel) => {
    if (loadingRef.current) return null;
    
    loadingRef.current = true;
    setIsLoadingProgress(true);
    
    try {
      const user = auth.currentUser;
      if (!user) return null;

      // Clear cache for fresh data
      delete cacheRef.current.words[difficulty];
      delete cacheRef.current.progress[`${user.uid}-${difficulty}`];

      // Load words and progress in parallel
      const [wordsResponse, progressResponse] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/user-data/${user.uid}/${difficulty}`),
        loadPracticeProgress(user.uid)
      ]);

      // Handle words response
      if (wordsResponse.status === 'fulfilled' && wordsResponse.value.data.success) {
        const data = wordsResponse.value.data;
        const words = data.words || [];
        
        setAllWords(words);
        
        // Get progress data from the settled promise
        const progressData = progressResponse.status === 'fulfilled' ? progressResponse.value : {};
        
        // Calculate the actual current word index based on 50% unlock threshold
        let actualCurrentIndex = 0;
        
        for (let i = 0; i < words.length; i++) {
          const word = words[i];
          const wordProg = progressData[word.id];
          
          if (!wordProg || (wordProg.bestScore || 0) < 0.5) {
            // This is the first word that hasn't reached 50%, so it's current
            actualCurrentIndex = i;
            break;
          }
          
          // If we've gone through all words, stay at the last one
          if (i === words.length - 1) {
            actualCurrentIndex = i;
          }
        }
        
        // Calculate accurate counts for current difficulty only
        const currentDifficultyProgress = words.map((w: { id: string | number; }) => progressData[w.id]).filter(Boolean);
        const accurateCompletedCount = currentDifficultyProgress.filter((p: { bestScore: any; }) => (p.bestScore || 0) >= 0.8).length;
        const accurateCompletionPercentage = words.length > 0 ? (accurateCompletedCount / words.length) * 100 : 0;
        
        setCurrentWord(words[actualCurrentIndex] || data.next_word);
        setCurrentWordIndex(actualCurrentIndex);
        setCompletedCount(accurateCompletedCount);
        setCompletionPercentage(accurateCompletionPercentage);
        
        cacheRef.current.words[difficulty] = words;
        cacheRef.current.progress[`${user.uid}-${difficulty}`] = {
          data: {
            next_word: data.next_word,
            next_index: data.next_index,
            completed_count: data.completed_count,
            completion_percentage: data.completion_percentage
          },
          timestamp: Date.now()
        };

        // Initialize animations
        words.forEach((word: Word, index: number) => {
          if (!wordNodeAnims[word.id]) {
            wordNodeAnims[word.id] = new Animated.Value(1); // Start at 1 for instant appearance
            glowAnims[word.id] = new Animated.Value(0);
            pulseAnims[word.id] = new Animated.Value(1);
            rotateAnims[word.id] = new Animated.Value(0);
          }
          
          Animated.spring(wordNodeAnims[word.id], {
            toValue: 1,
            tension: 50,
            friction: 7,
            delay: index * 30, // Reduced delay for faster loading
            useNativeDriver: true,
          }).start();
          
          // Start continuous glow animation for current word
          if (index === 0) {
            Animated.loop(
              Animated.sequence([
                Animated.timing(glowAnims[word.id], {
                  toValue: 1,
                  duration: 2000,
                  useNativeDriver: false,
                }),
                Animated.timing(glowAnims[word.id], {
                  toValue: 0,
                  duration: 2000,
                  useNativeDriver: false,
                }),
              ])
            ).start();
          }
        });
      }

      return wordsResponse.status === 'fulfilled' ? wordsResponse.value.data : null;
    } catch (error) {
      console.error('Fast load error:', error);
      return null;
    } finally {
      loadingRef.current = false;
      setIsLoadingProgress(false);
    }
  };

  /**
   * Load practice progress from Firebase
   */
  const loadPracticeProgress = async (userId: string) => {
    try {
      const allProgress: { [key: string]: WordProgress } = {};
      
      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const diffRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const snapshot = await get(diffRef);
        
        if (snapshot.exists()) {
          const data = snapshot.val();
          Object.assign(allProgress, data);
        }
      }
      
      setWordProgress(allProgress);
      return allProgress;
    } catch (error) {
      console.error('Error loading practice progress:', error);
      return {};
    }
  };

  /**
   * Optimized user progress update (ONLY for practice words, NOT daily words)
   */
  const updateWordProgressFast = async (accuracy: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !selectedWord || !result) return;

      // CRITICAL: If this is a daily word practice, do NOT save to practice words
      if (isPracticingDaily) {
        console.log('Skipping practice word save - this is a daily word');
        return;
      }

      const timestamp = new Date().toISOString();
      const isCompleted = accuracy >= 0.8;
      const isUnlocked = accuracy >= 0.5; // 50% threshold to unlock next word
      const xpEarned = Math.round(accuracy * 10);
      const wordId = selectedWord.id;
      const difficulty = selectedWord.difficulty;

      // Create new attempt record
      const newAttempt: PracticeWordAttempt = {
        timestamp,
        accuracy,
        feedback: result.feedback,
        correct_phonemes: result.correct_phonemes,
        total_phonemes: result.total_phonemes,
      };

      // Get existing progress and add new attempt to history
      const existingProgress = wordProgress[wordId];
      const previousBestScore = existingProgress?.bestScore || 0;
      const attemptHistory = existingProgress?.attemptHistory || [];
      attemptHistory.push(newAttempt);

      // Update local state immediately for instant feedback
      const newBestScore = Math.max(previousBestScore, accuracy);
      const newProgress: WordProgress = {
        wordId: wordId,
        word: selectedWord.word,
        completed: isCompleted,
        attempts: (wordProgress[wordId]?.attempts || 0) + 1,
        bestScore: newBestScore,
        lastAttempted: timestamp,
        attemptHistory: attemptHistory,
      };

      setWordProgress(prev => ({ ...prev, [wordId]: newProgress }));

      // Update Firebase in background (don't wait for it)
      const wordRef = ref(database, `users/${user.uid}/practiceWords/${difficulty}/${wordId}`);
      set(wordRef, newProgress).catch(console.error);

      // Update stats optimistically
      const newXP = stats.xp + xpEarned;
      const isFirstAttempt = newProgress.attempts === 1;
      const newTotalWords = isFirstAttempt ? stats.totalWords + 1 : stats.totalWords;
      
      setStats(prev => ({ ...prev, xp: newXP, totalWords: newTotalWords }));

      // Update Firebase stats in background
      const statsRef = ref(database, `users/${user.uid}/stats`);
      set(statsRef, { ...stats, xp: newXP, totalWords: newTotalWords }).catch(console.error);

      // Check if this is the FIRST TIME reaching unlock threshold (50%)
      const wasUnlocked = previousBestScore >= 0.5;
      const isNowUnlocked = newBestScore >= 0.5;
      const justUnlocked = !wasUnlocked && isNowUnlocked;
      
      // Only show unlock celebration if this is the first time unlocking AND it's the current word
      if (justUnlocked && currentWordIndex === allWords.findIndex(w => w.id === wordId)) {
        // Show immediate celebration
        const nodeAnim = wordNodeAnims[wordId];
        if (nodeAnim) {
          Animated.sequence([
            Animated.timing(nodeAnim, {
              toValue: 1.3,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.spring(nodeAnim, {
              toValue: 1,
              tension: 100,
              friction: 5,
              useNativeDriver: true,
            }),
          ]).start();
        }

        // Load next word in background (counts will auto-update via useEffect)
        setTimeout(async () => {
          await loadAllDataFast(difficulty);
          
          // Check if also just completed (80%+) for the first time
          const wasCompleted = previousBestScore >= 0.8;
          const isNowCompleted = newBestScore >= 0.8;
          const justCompleted = !wasCompleted && isNowCompleted;
          
          const message = justCompleted
            ? `Great job! You've mastered "${selectedWord.word}". Moving to the next word...`
            : `Good progress! You scored ${Math.round(accuracy * 100)}% on "${selectedWord.word}". Next word unlocked!`;
          
          Alert.alert(
            justCompleted ? '🎉 Word Completed!' : '✨ Next Word Unlocked!',
            message,
            [{ text: 'Continue', onPress: () => closePracticeModal() }]
          );
        }, 1000);
      }

    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  // ============================================================================
  // DAILY WORD FUNCTIONS
  // ============================================================================

  const fetchDailyWord = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/daily-word-consistent`);
      if (response.data.success) {
        setTodayWord(response.data.word);
      }
    } catch (error) {
      console.error('Error fetching daily word:', error);
    }
  };

  const loadDailyWordProgress = async (userId: string) => {
    try {
      const today = getTodayDateString();
      const dailyRef = ref(database, `users/${userId}/dailyWords/${today}`);
      const snapshot = await get(dailyRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val();
        setTodayProgress(data);
      } else {
        setTodayProgress(null);
      }
    } catch (error) {
      console.error('Error loading daily word progress:', error);
    }
  };

  const saveDailyWordAttempt = async (accuracy: number, feedback: string, correct_phonemes: number, total_phonemes: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !todayWord) return;

      const today = getTodayDateString();
      const timestamp = new Date().toISOString();
      
      const newAttempt: DailyWordAttempt = {
        timestamp,
        accuracy,
        feedback,
        correct_phonemes,
        total_phonemes,
      };

      // Get existing progress or create new
      const dailyRef = ref(database, `users/${user.uid}/dailyWords/${today}`);
      const snapshot = await get(dailyRef);
      
      let existingProgress: DailyWordProgress;
      if (snapshot.exists()) {
        existingProgress = snapshot.val();
      } else {
        existingProgress = {
          word: todayWord.word,
          date: today,
          completed: false,
          accuracy: 0,
          attempts: 0,
          bestScore: 0,
          attemptHistory: [],
        };
      }

      // Add new attempt to history
      const attemptHistory = existingProgress.attemptHistory || [];
      attemptHistory.push(newAttempt);

      // Update progress
      const updatedProgress: DailyWordProgress = {
        ...existingProgress,
        attempts: existingProgress.attempts + 1,
        accuracy: accuracy,
        bestScore: Math.max(existingProgress.bestScore, accuracy),
        completed: accuracy >= 0.8 || existingProgress.completed,
        attemptHistory,
      };

      // Save to Firebase
      await set(dailyRef, updatedProgress);
      setTodayProgress(updatedProgress);

      // Update streak if this is the first practice today
      await updateStreakForToday(user.uid, today);

      return updatedProgress;
    } catch (error) {
      console.error('Error saving daily word attempt:', error);
      throw error;
    }
  };

  const updateStreakForToday = async (userId: string, today: string) => {
    try {
      // Check if user has any practice today (daily word or practice words)
      const dailyRef = ref(database, `users/${userId}/dailyWords/${today}`);
      const dailySnapshot = await get(dailyRef);
      
      // Check practice words for today
      const practiceToday = await checkPracticeWordsForToday(userId, today);
      
      // If user has practiced (either daily or practice word), update streak
      if (dailySnapshot.exists() || practiceToday) {
        // Recalculate stats which includes streak
        const allDailyWordsRef = ref(database, `users/${userId}/dailyWords`);
        const allDailySnapshot = await get(allDailyWordsRef);
        
        if (allDailySnapshot.exists()) {
          await calculateStatsFromHistory(allDailySnapshot.val(), userId);
        }
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const checkPracticeWordsForToday = async (userId: string, today: string): Promise<boolean> => {
    try {
      const todayDate = new Date(today);
      todayDate.setHours(0, 0, 0, 0);
      const todayTimestamp = todayDate.getTime();
      const tomorrowTimestamp = todayTimestamp + 24 * 60 * 60 * 1000;

      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const diffRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const snapshot = await get(diffRef);
        
        if (snapshot.exists()) {
          const practiceWords = snapshot.val();
          for (const wordData of Object.values(practiceWords) as WordProgress[]) {
            if (wordData.lastAttempted) {
              const attemptTime = new Date(wordData.lastAttempted).getTime();
              if (attemptTime >= todayTimestamp && attemptTime < tomorrowTimestamp) {
                return true;
              }
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking practice words for today:', error);
      return false;
    }
  };

  // ============================================================================
  // STATS CALCULATION
  // ============================================================================

  const calculateStatsFromHistory = useCallback(async (allDailyWords: any, userId: string) => {
    try {
      const dates = Object.keys(allDailyWords);
      let wordsAttempted = 0;
      let totalAccuracy = 0;
      let accuracyCount = 0;
      let currentStreak = 0;
      let totalXP = 0;

      // Count daily words
      dates.forEach(date => {
        const dayData = allDailyWords[date];
        if (dayData && dayData.attempts > 0) {
          wordsAttempted++;
          if (dayData.bestScore && dayData.bestScore > 0) {
            totalAccuracy += dayData.bestScore;
            accuracyCount++;
            totalXP += Math.round(dayData.bestScore * 10);
          }
        }
      });

      // Get all practice words for accurate stats and streak
      const allPracticeWords: { [date: string]: boolean } = {};
      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const diffRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const snapshot = await get(diffRef);
        
        if (snapshot.exists()) {
          const practiceWords = snapshot.val();
          Object.values(practiceWords).forEach((wordData: any) => {
            if (wordData.attempts > 0) {
              wordsAttempted++;
              if (wordData.bestScore && wordData.bestScore > 0) {
                totalAccuracy += wordData.bestScore;
                accuracyCount++;
                totalXP += Math.round(wordData.bestScore * 10);
              }
              
              // Track dates when practice words were attempted
              if (wordData.lastAttempted) {
                const attemptDate = new Date(wordData.lastAttempted);
                const dateStr = `${attemptDate.getFullYear()}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}-${String(attemptDate.getDate()).padStart(2, '0')}`;
                allPracticeWords[dateStr] = true;
              }
            }
          });
        }
      }

      const averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;
      
      // Calculate streak - counts if user practiced ANY word (daily or practice) on a given day
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - daysAgo);
        const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        
        // Check if there was any activity on this day (daily word OR practice word)
        const dailyWordData = allDailyWords[checkDateStr];
        const hasDailyWord = dailyWordData && dailyWordData.attempts > 0;
        const hasPracticeWord = allPracticeWords[checkDateStr];
        
        if (hasDailyWord || hasPracticeWord) {
          currentStreak++;
        } else {
          if (daysAgo > 0) break; // Break streak if no activity (except for today)
        }
      }

      const newStats: UserStats = {
        streak: currentStreak,
        totalWords: wordsAttempted,
        accuracy: averageAccuracy,
        xp: totalXP,
      };

      const statsRef = ref(database, `users/${userId}/stats`);
      await set(statsRef, newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, []);

  const calculateStreakDays = useCallback(async (allDailyWords: any, userId: string) => {
    console.log('📅 Calculating streak days...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const streakDates: string[] = [];
    
    // Get practice tracking data
    const allPracticeWords: { [date: string]: boolean } = {};
    for (const difficulty of ['easy', 'intermediate', 'hard']) {
      const diffRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
      const snapshot = await get(diffRef);
      
      if (snapshot.exists()) {
        const practiceWords = snapshot.val();
        Object.values(practiceWords).forEach((wordData: any) => {
          if (wordData.lastAttempted && wordData.attempts > 0) {
            const attemptDate = new Date(wordData.lastAttempted);
            const dateStr = `${attemptDate.getFullYear()}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}-${String(attemptDate.getDate()).padStart(2, '0')}`;
            allPracticeWords[dateStr] = true;
          }
        });
      }
    }
    
    // Check last 365 days for active streak days (any practice activity)
    for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - daysAgo);
      const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      
      // Check both daily words and practice tracking
      const dailyData = allDailyWords[checkDateStr];
      const practiceData = allPracticeWords[checkDateStr];
      
      if ((dailyData && dailyData.attempts > 0) || practiceData) {
        streakDates.push(checkDateStr);
      }
    }
    
    console.log(`📅 Found ${streakDates.length} streak days`);
    setStreakDays(streakDates);
  }, []);

  const openStreakCalendar = useCallback(() => {
    console.log('🔥 Opening streak calendar...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowStreakCalendar(true);
    Animated.spring(streakCalendarAnim, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [streakCalendarAnim]);

  const closeStreakCalendar = useCallback(() => {
    console.log('🔥 Closing streak calendar...');
    Animated.timing(streakCalendarAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowStreakCalendar(false);
    });
  }, [streakCalendarAnim]);

  // ============================================================================
  // OPTIMIZED INITIALIZATION
  // ============================================================================

  const loadUserDataFast = useCallback(async (userId: string) => {
    if (initializeOnceRef.current) return;
    initializeOnceRef.current = true;

    try {
      // Load everything in parallel
      const [statsPromise, dailyWordPromise, progressPromise, dailyProgressPromise] = await Promise.allSettled([
        // Stats
        (async () => {
          const statsRef = ref(database, `users/${userId}/stats`);
          onValue(statsRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
              setStats({
                streak: data.streak || 0,
                totalWords: data.totalWords || 0,
                accuracy: data.accuracy || 0,
                xp: data.xp || 0,
              });
            }
          });
        })(),
        
        // Daily word
        fetchDailyWord(),
        
        // Initial progress for current difficulty
        loadAllDataFast(selectedDifficulty),

        // Daily word progress
        loadDailyWordProgress(userId)
      ]);

      // Set up daily words listener (non-blocking)
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      onValue(dailyWordsRef, (snapshot) => {
        if (snapshot.exists()) {
          const allDailyWords = snapshot.val();
          calculateStatsFromHistory(allDailyWords, userId);
          calculateStreakDays(allDailyWords, userId);
          
          // Also update today's progress
          const today = getTodayDateString();
          const todayData = allDailyWords[today];
          if (todayData) {
            setTodayProgress(todayData);
          }
        }
      });

    } catch (error) {
      console.error('Error in fast initialization:', error);
    }
  }, [selectedDifficulty, calculateStreakDays]);

  // ============================================================================
  // OPTIMIZED USE EFFECTS
  // ============================================================================

  // Recalculate counts when word progress changes
  useEffect(() => {
    if (allWords.length > 0) {
      // Only count progress for words in current difficulty level
      const completedInDifficulty = allWords.filter(w => {
        const prog = wordProgress[w.id];
        return prog && prog.bestScore >= 0.8;
      }).length;
      
      const completionPerc = (completedInDifficulty / allWords.length) * 100;
      
      setCompletedCount(completedInDifficulty);
      setCompletionPercentage(completionPerc);
      
      // Also update current word index
      let newCurrentIndex = 0;
      for (let i = 0; i < allWords.length; i++) {
        const prog = wordProgress[allWords[i].id];
        if (!prog || (prog.bestScore || 0) < 0.5) {
          newCurrentIndex = i;
          break;
        }
        if (i === allWords.length - 1) {
          newCurrentIndex = i;
        }
      }
      setCurrentWordIndex(newCurrentIndex);
    }
  }, [wordProgress, allWords]);

  useEffect(() => {
    console.log('🏠 Index tab initialized - Streak calendar ready!');
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      loadUserDataFast(user.uid);
    }

    // Fast badge animations
    badgeAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: 1,
        tension: 60, // Increased tension for faster animation
        friction: 5, // Reduced friction for faster animation
        delay: index * 80, // Reduced delay
        useNativeDriver: true,
      }).start();
    });

    // Daily task pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(dailyTaskPulse, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(dailyTaskPulse, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Debug: Monitor streak calendar state
  useEffect(() => {
    console.log(`🔥 Streak calendar visibility changed: ${showStreakCalendar}`);
  }, [showStreakCalendar]);

  // Fast difficulty change
  useEffect(() => {
    if (lastDifficultyRef.current === selectedDifficulty) return;
    
    lastDifficultyRef.current = selectedDifficulty;
    const user = auth.currentUser;
    
    if (user && !loadingRef.current) {
      console.log(`🚀 Fast loading ${selectedDifficulty} words`);
      loadAllDataFast(selectedDifficulty);
    }
  }, [selectedDifficulty]);

  // Pre-load animations when words are loaded
  useEffect(() => {
    if (allWords.length > 0 && !isInitialized) {
      setIsInitialized(true);
      
      // Pre-warm animations for better performance
      allWords.forEach((word, index) => {
        if (!wordNodeAnims[word.id]) {
          wordNodeAnims[word.id] = new Animated.Value(1); // Start at 1 instead of 0
          glowAnims[word.id] = new Animated.Value(0);
        }
      });
    }
  }, [allWords]);

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // ============================================================================
  // OPTIMIZED UI HANDLERS
  // ============================================================================

  const handleDifficultyChange = (difficulty: DifficultyLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate out current words
    Object.keys(wordNodeAnims).forEach(wordId => {
      Animated.timing(wordNodeAnims[wordId], {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    
    // Change difficulty after animation
    setTimeout(() => {
      setSelectedDifficulty(difficulty);
      setShowDropdown(false);
    }, 200);
  };

  const openPracticeModalFast = (word: Word, isDaily: boolean = false) => {
    const progress = wordProgress[word.id];
    
    // If word has been practiced before, show feedback modal first
    if (!isDaily && progress && progress.attempts > 0) {
      setSelectedWord(word);
      setSelectedWordProgress(progress);
      setShowPracticeWordFeedback(true);
      setShowFeedbackHistory(false);
      
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 70,
        friction: 5,
        useNativeDriver: true,
      }).start();
    } else {
      // First time practicing or daily word - go straight to practice
      setSelectedWord(word);
      setIsPracticingDaily(isDaily);
      setShowPracticeModal(true);
      setShowResult(false);
      setResult(null);
      setShowFeedbackHistory(false);
      
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 70,
        friction: 5,
        useNativeDriver: true,
      }).start();
    }
  };

  const openPracticeFromFeedback = () => {
    // Smooth transition from feedback to practice
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setShowPracticeWordFeedback(false);
      setShowPracticeModal(true);
      setShowResult(false);
      setResult(null);
      setIsPracticingDaily(false);
      
      // Animate back in
      Animated.spring(modalAnim, {
        toValue: 1,
        tension: 70,
        friction: 5,
        useNativeDriver: true,
      }).start();
    });
  };

  const closePracticeWordFeedback = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowPracticeWordFeedback(false);
      setSelectedWord(null);
      setSelectedWordProgress(null);
      setShowFeedbackHistory(false);
    });
  };

  const closePracticeModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowPracticeModal(false);
      setSelectedWord(null);
      setSelectedWordProgress(null);
      setIsPracticingDaily(false);
      setShowResult(false);
      setResult(null);
      setIsRecording(false);
      setIsProcessing(false);
      setShowFeedbackHistory(false);
    });
  };

  // ============================================================================
  // RECORDING & ANALYSIS
  // ============================================================================

  const startRecording = async () => {
    try {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const path = `${RNFS.DocumentDirectoryPath}/word_${Date.now()}.wav`;
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: AVEncodingOption.lpcm,
      };
      
      await audioRecorderPlayer.startRecorder(path, audioSet);
      recordingPathRef.current = path;
      
      audioRecorderPlayer.addRecordBackListener((e: any) => {
        recordSecsRef.current = e.currentPosition;
        recordTimeRef.current = audioRecorderPlayer.mmssss(Math.floor(e.currentPosition));
        setRecordingTime(recordTimeRef.current);
      });
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime('00:00');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      const exists = await RNFS.exists(result);
      if (!exists) throw new Error('Recording file was not created');
      
      const stats = await RNFS.stat(result);
      if (stats.size === 0) throw new Error('Recording file is empty');
      
      processAudio(result);
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to process recording. Please try again.');
      setIsRecording(false);
    }
  };

  const handleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const processAudio = async (audioPath: string) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio_file', {
        uri: Platform.OS === 'ios' ? audioPath : `file://${audioPath}`,
        type: 'audio/wav',
        name: 'word_recording.wav',
      } as any);
      
      const wordToAnalyze = selectedWord?.word || '';
      formData.append('reference_text', wordToAnalyze);
      formData.append('use_llm_judge', 'true');
      formData.append('generate_audio', 'false');
      formData.append('filter_extraneous', 'true');
      
      const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      
      if (response.data.success) {
        const analysisResult = response.data.analysis;
        const resultData: AnalysisResult = {
          accuracy: analysisResult.accuracy,
          correct_phonemes: analysisResult.correct_phonemes,
          total_phonemes: analysisResult.total_phonemes,
          feedback: response.data.feedback || 'Great job!',
        };
        
        setResult(resultData);
        setShowResult(true);
        
        // Check if this is a daily word or practice word
        if (isPracticingDaily) {
          // DAILY WORD: Save to daily word attempts only
          await saveDailyWordAttempt(
            resultData.accuracy,
            resultData.feedback,
            resultData.correct_phonemes,
            resultData.total_phonemes
          );
          // Note: saveDailyWordAttempt already handles streak update
        } else {
          // PRACTICE WORD: Save to practice word attempts only
          await updateWordProgressFast(resultData.accuracy);
          
          // Also update streak since user practiced today
          const user = auth.currentUser;
          if (user) {
            const today = getTodayDateString();
            await updateStreakForToday(user.uid, today);
          }
        }
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      Alert.alert('Analysis Error', 'Failed to analyze pronunciation.');
    } finally {
      setIsProcessing(false);
    }
  };

  const playWordPronunciation = async (word: string) => {
    try {
      Haptics.selectionAsync();
      setPlayingAudio(true);
      
      const response = await axios.get(`${API_BASE_URL}/get_word_audio/${word}`, {
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
        
        const tempPath = `${RNFS.DocumentDirectoryPath}/temp_word_${Date.now()}.wav`;
        await RNFS.writeFile(tempPath, base64Audio, 'base64');
        
        await audioRecorderPlayer.startPlayer(tempPath);
        
        audioRecorderPlayer.addPlayBackListener((e: any) => {
          if (e.currentPosition >= e.duration) {
            audioRecorderPlayer.stopPlayer();
            audioRecorderPlayer.removePlayBackListener();
            setPlayingAudio(false);
            RNFS.unlink(tempPath).catch(err => console.warn('Could not delete temp file:', err));
          }
        });
      }
    } catch (error) {
      console.error('Error playing pronunciation:', error);
      setPlayingAudio(false);
    }
  };

  // ============================================================================
  // OPTIMIZED RENDERING HELPERS
  // ============================================================================

  /**
   * **ENHANCED: Render sequential word path with improved layout**
   */
  const renderWordPath = useCallback(() => {
    const pathPositions: { x: number; y: number; word: Word; index: number; }[] = [];
    const pathWidth = width - 120;
    const centerX = width / 2;
    const verticalSpacing = 200; // Increased spacing to prevent label overlap
    
    allWords.forEach((word, index) => {
      // Smoother wave pattern with alternating sides
      const waveAmplitude = pathWidth * 0.35;
      const wave = Math.sin(index * 0.7) * waveAmplitude;
      
      // Slight randomization for organic feel (using word ID for consistency)
      const seed = word.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const randomOffset = ((seed % 30) - 15);
      
      let x = centerX + wave + randomOffset;
      const y = 120 + (index * verticalSpacing); // Increased top padding
      
      // Ensure circles stay within bounds with more padding
      x = Math.max(90, Math.min(width - 90, x));
      pathPositions.push({ x, y, word, index });
    });

    return (
      <>
        {pathPositions.map((pos, index) => {
          const { word, x, y } = pos;
          const progress = wordProgress[word.id];
          const isCompleted = progress?.completed || false;
          const currentAccuracy = progress?.bestScore || 0;
          const hasAttempted = progress?.attempts > 0;
          
          // Check if previous word has at least 50% accuracy to unlock
          const previousWord = index > 0 ? allWords[index - 1] : null;
          const previousProgress = previousWord ? wordProgress[previousWord.id] : null;
          const isPreviousUnlocked = !previousWord || (previousProgress?.bestScore || 0) >= 0.5;
          
          const isCurrent = currentWordIndex === index;
          const isPastWord = index < currentWordIndex || (hasAttempted && currentAccuracy >= 0.5);
          const isLocked = index > 0 && !isPreviousUnlocked;
          
          const nodeAnim = wordNodeAnims[word.id] || new Animated.Value(1);
          const glowAnim = glowAnims[word.id] || new Animated.Value(0);
          const pulseAnimValue = pulseAnims[word.id] || new Animated.Value(1);

          // Enhanced glow colors based on state
          const getGlowColor = () => {
            if (isCompleted) {
              return [
                `rgba(${DIFFICULTY_COLORS[selectedDifficulty].glow.match(/\d+/g)?.slice(0, 3).join(',')}, 0)`,
                DIFFICULTY_COLORS[selectedDifficulty].glow
              ];
            }
            if (isCurrent) {
              return ['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.6)'];
            }
            if (hasAttempted && currentAccuracy >= 0.5) {
              return ['rgba(255, 200, 0, 0)', 'rgba(255, 200, 0, 0.5)'];
            }
            return ['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.3)'];
          };

          const glowColor = glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: getGlowColor()
          });

          const scale = nodeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1]
          });

          const opacity = nodeAnim;
          
          // Pulse animation for current word
          if (isCurrent && !hasAttempted) {
            Animated.loop(
              Animated.sequence([
                Animated.timing(pulseAnimValue, {
                  toValue: 1.1,
                  duration: 1500,
                  useNativeDriver: true,
                }),
                Animated.timing(pulseAnimValue, {
                  toValue: 1,
                  duration: 1500,
                  useNativeDriver: true,
                }),
              ])
            ).start();
          }

          // Render connecting path to next word
          const nextPos = pathPositions[index + 1];
          let pathPoints = null;
          if (nextPos) {
            const deltaX = nextPos.x - x;
            const deltaY = nextPos.y - y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            
            pathPoints = {
              width: distance,
              angle: angle,
              startX: x,
              startY: y,
            };
          }

          return (
            <View key={word.id}>
              {/* Enhanced Connecting Path */}
              {pathPoints && (
                <View
                  style={[
                    styles.connectingPath,
                    {
                      position: 'absolute',
                      left: pathPoints.startX,
                      top: pathPoints.startY,
                      width: pathPoints.width,
                      height: 10,
                      transform: [
                        { translateY: -5 },
                        { rotate: `${pathPoints.angle}deg` }
                      ],
                    }
                  ]}
                >
                  <LinearGradient
                    colors={
                      currentAccuracy >= 0.8
                        ? DIFFICULTY_COLORS[selectedDifficulty].gradient
                        : currentAccuracy >= 0.5
                        ? COLORS.gradients.gold
                        : isPastWord
                        ? COLORS.gradients.success
                        : [COLORS.gray[300], COLORS.gray[200], COLORS.gray[100]]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.pathGradient}
                  />
                  {/* Path decoration dots */}
                  {currentAccuracy >= 0.5 && (
                    <>
                      <View style={[styles.pathDot, { left: '25%' }]} />
                      <View style={[styles.pathDot, { left: '50%' }]} />
                      <View style={[styles.pathDot, { left: '75%' }]} />
                    </>
                  )}
                </View>
              )}

              {/* Word Node Container */}
              <Animated.View 
                style={[
                  styles.wordNodeContainer,
                  { 
                    left: x - 52,
                    top: y - 52,
                    opacity: opacity,
                    transform: [
                      { scale: scale },
                      { scale: isCurrent ? pulseAnimValue : 1 }
                    ]
                  }
                ]}
              >
                {/* Background decoration */}
                <View style={styles.wordNodeBackground} />
                
                {/* Multi-layer glow effect */}
                {(isCompleted || isCurrent || (hasAttempted && currentAccuracy >= 0.5)) && (
                  <>
                    <Animated.View
                      style={[
                        styles.wordGlowOuter,
                        { backgroundColor: glowColor }
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.wordGlow,
                        { backgroundColor: glowColor, opacity: 0.6 }
                      ]}
                    />
                    <Animated.View
                      style={[
                        styles.wordGlowInner,
                        { backgroundColor: glowColor, opacity: 0.3 }
                      ]}
                    />
                  </>
                )}
                
                {/* Level indicator ring */}
                <View style={[
                  styles.levelRing,
                  { 
                    borderColor: isCompleted 
                      ? DIFFICULTY_COLORS[selectedDifficulty].primary 
                      : hasAttempted && currentAccuracy >= 0.5
                      ? COLORS.gold
                      : isCurrent 
                      ? COLORS.primary 
                      : COLORS.gray[300]
                  }
                ]} />

                <TouchableOpacity
                  style={[
                    styles.wordCircleButton,
                    {
                      shadowColor: isCompleted 
                        ? DIFFICULTY_COLORS[selectedDifficulty].shadow
                        : isCurrent 
                        ? COLORS.shadows.primary 
                        : '#000000',
                    }
                  ]}
                  onPress={() => {
                    if (!isLocked) {
                      Animated.sequence([
                        Animated.timing(nodeAnim, {
                          toValue: 0.9,
                          duration: 100,
                          useNativeDriver: true,
                        }),
                        Animated.spring(nodeAnim, {
                          toValue: 1,
                          tension: 100,
                          friction: 3,
                          useNativeDriver: true,
                        }),
                      ]).start();
                      openPracticeModalFast(word);
                    }
                  }}
                  disabled={isLocked}
                  activeOpacity={0.8}
                >
                  {/* Material Design Surface */}
                  <View style={styles.circleSurface} />
                  
                  <LinearGradient
                    colors={
                      isCompleted 
                        ? [COLORS.white, DIFFICULTY_COLORS[selectedDifficulty].light] as const
                        : hasAttempted && currentAccuracy > 0
                        ? [COLORS.white, '#FFFBEB'] as const
                        : isCurrent 
                        ? [COLORS.white, COLORS.primary + '15'] as const
                        : isLocked
                        ? [COLORS.gray[100], COLORS.gray[200]] as const
                        : [COLORS.white, COLORS.gray[50]] as const
                    }
                    style={styles.circleGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  >
                    {hasAttempted && currentAccuracy > 0 ? (
                      <View style={styles.progressCircleContainer}>
                        <ProgressCircle
                          size={74}
                          accuracy={currentAccuracy}
                          strokeWidth={9}
                          showPercentage={true}
                        />
                        {currentAccuracy >= 0.95 && (
                          <View style={styles.perfectStar}>
                            <Icon name="stars" size={22} color={COLORS.gold} />
                          </View>
                        )}
                      </View>
                    ) : isCurrent ? (
                      <View style={styles.currentIconContainer}>
                        <View style={styles.currentIconGlow} />
                        <Icon name="play-circle-filled" size={48} color={COLORS.primary} />
                      </View>
                    ) : isLocked ? (
                      <View style={styles.lockedContainer}>
                        <Icon name="lock" size={32} color={COLORS.gray[400]} />
                      </View>
                    ) : (
                      <View style={styles.wordPreview}>
                        <Icon name="play-circle-outline" size={36} color={COLORS.primary} />
                      </View>
                    )}
                  </LinearGradient>
                  
                  {/* Attempt Count Badge */}
                  {progress?.attempts > 0 && (
                    <Animated.View style={[styles.scoreLabel, { opacity: 1 }]}>
                      <LinearGradient
                        colors={
                          currentAccuracy >= 0.8 
                            ? [DIFFICULTY_COLORS[selectedDifficulty].primary + '20', DIFFICULTY_COLORS[selectedDifficulty].primary + '10'] as const
                            : currentAccuracy >= 0.5
                            ? ['#FFFBEB', '#FEF3C7'] as const
                            : ['#FEE2E2', '#FECACA'] as const
                        }
                        style={styles.scoreLabelGradient}
                      >
                        <Icon 
                          name={currentAccuracy >= 0.8 ? "check-circle" : currentAccuracy >= 0.5 ? "stars" : "refresh"} 
                          size={10} 
                          color={currentAccuracy >= 0.8 ? DIFFICULTY_COLORS[selectedDifficulty].primary : currentAccuracy >= 0.5 ? COLORS.gold : COLORS.error} 
                        />
                        <Text style={styles.scoreLabelText}>
                          {progress.attempts} {progress.attempts === 1 ? 'try' : 'tries'}
                        </Text>
                      </LinearGradient>
                    </Animated.View>
                  )}
                </TouchableOpacity>

                {/* Enhanced Word Label Card */}
                {!isLocked && (
                  <Animated.View 
                    style={[
                      styles.wordLabelCard,
                      { 
                        opacity: nodeAnim,
                        shadowColor: isCompleted 
                          ? DIFFICULTY_COLORS[selectedDifficulty].shadow 
                          : isCurrent 
                          ? COLORS.shadows.primary 
                          : COLORS.gray[400]
                      }
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isCompleted
                          ? [COLORS.white, DIFFICULTY_COLORS[selectedDifficulty].light] as const
                          : hasAttempted && currentAccuracy >= 0.5
                          ? [COLORS.white, '#FFFBEB'] as const
                          : isCurrent
                          ? [COLORS.white, COLORS.primary + '08'] as const
                          : [COLORS.white, COLORS.gray[50]] as const
                      }
                      style={styles.wordLabelGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                    >
                      <View style={styles.wordLabelContent}>
                        <Text style={[
                          styles.wordLabelText,
                          { 
                            color: isCompleted 
                              ? DIFFICULTY_COLORS[selectedDifficulty].primary 
                              : hasAttempted && currentAccuracy >= 0.5
                              ? COLORS.gold
                              : isCurrent
                              ? COLORS.primary
                              : COLORS.gray[900] 
                          }
                        ]}>{word.word}</Text>
                        
                        {/* Progress indicator */}
                        {hasAttempted && (
                          <View style={styles.wordLabelProgress}>
                            <View style={[
                              styles.wordLabelProgressBar,
                              { 
                                width: `${currentAccuracy * 100}%`,
                                backgroundColor: isCompleted 
                                  ? DIFFICULTY_COLORS[selectedDifficulty].primary 
                                  : currentAccuracy >= 0.5 
                                  ? COLORS.gold 
                                  : COLORS.error
                              }
                            ]} />
                          </View>
                        )}
                      </View>
                      
                      {/* Status Badges */}
                      <View style={styles.wordLabelBadges}>
                        {isCurrent && !hasAttempted && (
                          <View style={[styles.statusBadge, { backgroundColor: COLORS.primary }]}>
                            <Icon name="play-arrow" size={10} color={COLORS.white} />
                            <Text style={styles.statusBadgeText}>ACTIVE</Text>
                          </View>
                        )}
                        {hasAttempted && currentAccuracy >= 0.5 && currentAccuracy < 0.8 && (
                          <View style={[styles.statusBadge, { backgroundColor: COLORS.gold }]}>
                            <Icon name="lock-open" size={10} color={COLORS.white} />
                            <Text style={styles.statusBadgeText}>{Math.round(currentAccuracy * 100)}%</Text>
                          </View>
                        )}
                        {isCompleted && (
                          <View style={[styles.statusBadge, { backgroundColor: DIFFICULTY_COLORS[selectedDifficulty].primary }]}>
                            <Icon name="check" size={10} color={COLORS.white} />
                            <Text style={styles.statusBadgeText}>MASTERED</Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Enhanced Milestone Markers */}
              {(index + 1) % 5 === 0 && index > 0 && !isLocked && (
                <Animated.View
                  style={[
                    styles.milestoneMarker,
                    {
                      left: x - 100,
                      top: y + 90,
                      opacity: nodeAnim,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={COLORS.gradients.primary}
                    style={styles.milestoneGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.milestoneIconContainer}>
                      <View style={styles.milestoneIcon}>
                        <Icon name="emoji-events" size={32} color={COLORS.gold} />
                      </View>
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={styles.milestoneTitle}>🎉 Milestone Reached!</Text>
                      <Text style={styles.milestoneText}>
                        Level {index + 1} • {Math.round(completionPercentage)}% Complete
                      </Text>
                      <View style={styles.milestoneProgressContainer}>
                        <View style={styles.milestoneProgress}>
                          <View style={[
                            styles.milestoneProgressFill,
                            { width: `${completionPercentage}%` }
                          ]} />
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </Animated.View>
              )}
            </View>
          );
        })}
      </>
    );
  }, [allWords, wordProgress, currentWordIndex, selectedDifficulty, completedCount]);

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.userName}>Hi, {userName}! 👋</Text>
        </View>

        <View style={styles.badgesContainer}>
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[0] }] }]}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary] as const}
              style={styles.badgeGradient}
            >
              <Icon name="menu-book" size={24} color={COLORS.white} />
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeValue}>{stats.totalWords}</Text>
                <Text style={styles.badgeLabel}>Words</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <TouchableOpacity onPress={openStreakCalendar} activeOpacity={0.8}>
            <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[1] }] }]}>
              <LinearGradient
                colors={['#F59E0B', '#D97706'] as const}
                style={styles.badgeGradient}
              >
                <Icon name="local-fire-department" size={24} color={COLORS.white} />
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeValue}>{stats.streak}</Text>
                  <Text style={styles.badgeLabel}>Streak</Text>
                </View>
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[2] }] }]}>
            <LinearGradient
              colors={[COLORS.success, '#059669'] as const}
              style={styles.badgeGradient}
            >
              <Icon name="check-circle" size={24} color={COLORS.white} />
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeValue}>{Math.round(stats.accuracy * 100)}%</Text>
                <Text style={styles.badgeLabel}>Accuracy</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => {
              Haptics.selectionAsync();
              setShowDropdown(!showDropdown);
            }}
          >
            <Icon name="tune" size={20} color={COLORS.primary} />
            <Text style={styles.dropdownButtonText}>
              {selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}
            </Text>
            <Icon name={showDropdown ? "expand-less" : "expand-more"} size={20} color={COLORS.primary} />
          </TouchableOpacity>

          {showDropdown && (
            <View style={styles.dropdownMenu}>
              {(['easy', 'intermediate', 'hard'] as DifficultyLevel[]).map((diff) => (
                <TouchableOpacity
                  key={diff}
                  style={[
                    styles.dropdownItem,
                    selectedDifficulty === diff && styles.dropdownItemActive
                  ]}
                  onPress={() => handleDifficultyChange(diff)}
                >
                  <View style={[
                    styles.difficultyDot,
                    { backgroundColor: DIFFICULTY_COLORS[diff].primary }
                  ]} />
                  <Text style={[
                    styles.dropdownItemText,
                    selectedDifficulty === diff && styles.dropdownItemTextActive
                  ]}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </Text>
                  {selectedDifficulty === diff && (
                    <Icon name="check" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Daily Task Button */}
        <Animated.View style={{ transform: [{ scale: dailyTaskPulse }] }}>
          <TouchableOpacity
            style={styles.dailyTaskButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowDailyTask(true);
            }}
          >
            <LinearGradient
              colors={[COLORS.gold, '#D97706'] as const}
              style={styles.dailyTaskGradient}
            >
              <Icon name="assignment" size={24} color={COLORS.white} />
              {!todayProgress?.completed && (
                <View style={styles.dailyTaskBadge}>
                  <Text style={styles.dailyTaskBadgeText}>!</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Progress Indicator */}
      {allWords.length > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <View style={styles.progressInfo}>
              <Icon name="track-changes" size={20} color={COLORS.primary} />
              <Text style={styles.progressTitle}>
                {selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)} Level
              </Text>
            </View>
            <Text style={styles.progressPercentage}>{Math.round(completionPercentage)}%</Text>
          </View>
          <View style={styles.progressBar}>
            <Animated.View 
              style={[
                styles.progressFill,
                { width: `${completionPercentage}%` }
              ]}
            >
              <LinearGradient
                colors={DIFFICULTY_COLORS[selectedDifficulty].gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.progressGradient}
              />
            </Animated.View>
          </View>
          <Text style={styles.progressText}>
            {completedCount} completed · {allWords.filter(w => {
              const prog = wordProgress[w.id];
              return prog && prog.bestScore >= 0.5 && prog.bestScore < 0.8;
            }).length} unlocked · Word {currentWordIndex + 1} active
          </Text>
        </View>
      )}

      {/* Word Path ScrollView */}
      {isLoadingProgress ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      ) : (
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
        >
          <View style={styles.pathContainer}>
            {renderWordPath()}
          </View>
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* DAILY TASK MODAL */}
      {todayWord && (
        <Modal
          visible={showDailyTask}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowDailyTask(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dailyTaskModalContainer}>
              <ScrollView 
                style={styles.dailyTaskScrollView}
                contentContainerStyle={styles.dailyTaskScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                <View style={styles.dailyTaskModal}>
                <LinearGradient
                  colors={[COLORS.gold, '#D97706'] as const}
                  style={styles.dailyTaskHeader}
                >
                  <Icon name="wb-sunny" size={32} color={COLORS.white} />
                  <Text style={styles.dailyTaskTitle}>Today's Challenge</Text>
                  <TouchableOpacity 
                    style={styles.dailyTaskClose}
                    onPress={() => setShowDailyTask(false)}
                  >
                    <Icon name="close" size={24} color={COLORS.white} />
                  </TouchableOpacity>
                </LinearGradient>

                <View style={styles.dailyTaskContent}>
                  <Text style={styles.dailyWordText}>{todayWord.word}</Text>
                  <Text style={styles.dailyPhonetic}>{todayWord.phonetic}</Text>
                  
                  {/* Show Latest Attempt Feedback */}
                  {todayProgress && todayProgress.attemptHistory && todayProgress.attemptHistory.length > 0 && (
                    <View style={styles.latestAttemptSection}>
                      <View style={styles.latestAttemptHeader}>
                        <Icon name="history" size={20} color={COLORS.primary} />
                        <Text style={styles.latestAttemptTitle}>Latest Attempt</Text>
                        {todayProgress.completed && (
                          <View style={styles.completedBadge}>
                            <Icon name="check-circle" size={16} color={COLORS.success} />
                            <Text style={styles.completedBadgeText}>Completed</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.latestAttemptCard}>
                        <View style={styles.attemptScoreRow}>
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>
                              {Math.round(todayProgress.accuracy * 100)}%
                            </Text>
                            <Text style={styles.attemptScoreLabel}>Accuracy</Text>
                          </View>
                          <View style={styles.attemptScoreDivider} />
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>{todayProgress.attempts}</Text>
                            <Text style={styles.attemptScoreLabel}>Attempts</Text>
                          </View>
                          <View style={styles.attemptScoreDivider} />
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>
                              {Math.round(todayProgress.bestScore * 100)}%
                            </Text>
                            <Text style={styles.attemptScoreLabel}>Best</Text>
                          </View>
                        </View>
                        
                        <View style={styles.latestFeedback}>
                          <Text style={styles.latestFeedbackLabel}>Feedback:</Text>
                          <Text style={styles.latestFeedbackText}>
                            {todayProgress.attemptHistory[todayProgress.attemptHistory.length - 1].feedback}
                          </Text>
                        </View>
                      </View>

                      {/* View All Attempts Button */}
                      {todayProgress.attemptHistory.length > 1 && (
                        <TouchableOpacity
                          style={styles.viewHistoryButton}
                          onPress={() => setShowFeedbackHistory(!showFeedbackHistory)}
                        >
                          <Icon name={showFeedbackHistory ? "expand-less" : "expand-more"} size={20} color={COLORS.primary} />
                          <Text style={styles.viewHistoryText}>
                            {showFeedbackHistory ? 'Hide' : 'View All'} {todayProgress.attemptHistory.length} Attempts
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Feedback History - Scrollable */}
                      {showFeedbackHistory && todayProgress.attemptHistory && (
                        <ScrollView 
                          style={styles.feedbackHistoryScroll}
                          nestedScrollEnabled={true}
                        >
                          {todayProgress.attemptHistory.map((attempt, index) => (
                            <View key={index} style={styles.historyAttemptCard}>
                              <View style={styles.historyAttemptHeader}>
                                <Text style={styles.historyAttemptNumber}>Attempt #{index + 1}</Text>
                                <Text style={styles.historyAttemptTime}>
                                  {new Date(attempt.timestamp).toLocaleTimeString()}
                                </Text>
                              </View>
                              
                              <View style={styles.historyAttemptStats}>
                                <View style={styles.historyStatItem}>
                                  <Icon name="percent" size={16} color={COLORS.primary} />
                                  <Text style={styles.historyStatText}>
                                    {Math.round(attempt.accuracy * 100)}%
                                  </Text>
                                </View>
                                <View style={styles.historyStatItem}>
                                  <Icon name="check" size={16} color={COLORS.success} />
                                  <Text style={styles.historyStatText}>
                                    {attempt.correct_phonemes}/{attempt.total_phonemes}
                                  </Text>
                                </View>
                              </View>
                              
                              <Text style={styles.historyFeedbackText}>{attempt.feedback}</Text>
                            </View>
                          )).reverse()}
                        </ScrollView>
                      )}
                    </View>
                  )}
                  
                  <View style={styles.dailyMeaning}>
                    <Icon name="info-outline" size={20} color={COLORS.primary} />
                    <Text style={styles.dailyMeaningText}>{todayWord.meaning}</Text>
                  </View>

                  <View style={styles.dailyExample}>
                    <Icon name="format-quote" size={20} color={COLORS.gray[500]} />
                    <Text style={styles.dailyExampleText}>"{todayWord.example}"</Text>
                  </View>

                  <View style={styles.dailyTip}>
                    <Icon name="lightbulb-outline" size={20} color={COLORS.gold} />
                    <Text style={styles.dailyTipText}>{todayWord.tip}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.startDailyButton}
                    onPress={() => {
                      setShowDailyTask(false);
                      openPracticeModalFast(todayWord, true);
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.secondary] as const}
                      style={styles.startDailyGradient}
                    >
                      <Text style={styles.startDailyText}>
                        {todayProgress && todayProgress.attempts > 0 ? 'Try Again' : 'Start Challenge'}
                      </Text>
                      <Icon name={todayProgress && todayProgress.attempts > 0 ? "refresh" : "arrow-forward"} size={20} color={COLORS.white} />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* PRACTICE WORD FEEDBACK MODAL */}
      {selectedWord && selectedWordProgress && (
        <Modal
          visible={showPracticeWordFeedback}
          transparent={true}
          animationType="fade"
          onRequestClose={closePracticeWordFeedback}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.dailyTaskModalContainer}>
              <ScrollView 
                style={styles.dailyTaskScrollView}
                contentContainerStyle={styles.dailyTaskScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={true}
              >
                <View style={styles.dailyTaskModal}>
                  <LinearGradient
                    colors={DIFFICULTY_COLORS[selectedWord.difficulty].gradient}
                    style={styles.dailyTaskHeader}
                  >
                    <Icon name="school" size={32} color={COLORS.white} />
                    <Text style={styles.dailyTaskTitle}>Practice Progress</Text>
                    <TouchableOpacity 
                      style={styles.dailyTaskClose}
                      onPress={closePracticeWordFeedback}
                    >
                      <Icon name="close" size={24} color={COLORS.white} />
                    </TouchableOpacity>
                  </LinearGradient>

                  <View style={styles.dailyTaskContent}>
                    <Text style={styles.dailyWordText}>{selectedWord.word}</Text>
                    <Text style={styles.dailyPhonetic}>{selectedWord.phonetic}</Text>
                    
                    {/* Show Latest Attempt Feedback */}
                    <View style={styles.latestAttemptSection}>
                      <View style={styles.latestAttemptHeader}>
                        <Icon name="history" size={20} color={COLORS.primary} />
                        <Text style={styles.latestAttemptTitle}>Latest Attempt</Text>
                        {selectedWordProgress.completed && (
                          <View style={styles.completedBadge}>
                            <Icon name="check-circle" size={16} color={COLORS.success} />
                            <Text style={styles.completedBadgeText}>Completed</Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={styles.latestAttemptCard}>
                        <View style={styles.attemptScoreRow}>
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>
                              {Math.round(selectedWordProgress.bestScore * 100)}%
                            </Text>
                            <Text style={styles.attemptScoreLabel}>Accuracy</Text>
                          </View>
                          <View style={styles.attemptScoreDivider} />
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>{selectedWordProgress.attempts}</Text>
                            <Text style={styles.attemptScoreLabel}>Attempts</Text>
                          </View>
                          <View style={styles.attemptScoreDivider} />
                          <View style={styles.attemptScoreItem}>
                            <Text style={styles.attemptScoreValue}>
                              {Math.round(selectedWordProgress.bestScore * 100)}%
                            </Text>
                            <Text style={styles.attemptScoreLabel}>Best</Text>
                          </View>
                        </View>
                        
                        {selectedWordProgress.attemptHistory && selectedWordProgress.attemptHistory.length > 0 && (
                          <View style={styles.latestFeedback}>
                            <Text style={styles.latestFeedbackLabel}>Feedback:</Text>
                            <Text style={styles.latestFeedbackText}>
                              {selectedWordProgress.attemptHistory[selectedWordProgress.attemptHistory.length - 1].feedback}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* View All Attempts Button */}
                      {selectedWordProgress.attemptHistory && selectedWordProgress.attemptHistory.length > 1 && (
                        <TouchableOpacity
                          style={styles.viewHistoryButton}
                          onPress={() => setShowFeedbackHistory(!showFeedbackHistory)}
                        >
                          <Icon name={showFeedbackHistory ? "expand-less" : "expand-more"} size={20} color={COLORS.primary} />
                          <Text style={styles.viewHistoryText}>
                            {showFeedbackHistory ? 'Hide' : 'View All'} {selectedWordProgress.attemptHistory.length} Attempts
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Feedback History - Scrollable */}
                      {showFeedbackHistory && selectedWordProgress.attemptHistory && (
                        <ScrollView 
                          style={styles.feedbackHistoryScroll}
                          nestedScrollEnabled={true}
                        >
                          {selectedWordProgress.attemptHistory.map((attempt, index) => (
                            <View key={index} style={styles.historyAttemptCard}>
                              <View style={styles.historyAttemptHeader}>
                                <Text style={styles.historyAttemptNumber}>Attempt #{index + 1}</Text>
                                <Text style={styles.historyAttemptTime}>
                                  {new Date(attempt.timestamp).toLocaleTimeString()}
                                </Text>
                              </View>
                              
                              <View style={styles.historyAttemptStats}>
                                <View style={styles.historyStatItem}>
                                  <Icon name="percent" size={16} color={COLORS.primary} />
                                  <Text style={styles.historyStatText}>
                                    {Math.round(attempt.accuracy * 100)}%
                                  </Text>
                                </View>
                                <View style={styles.historyStatItem}>
                                  <Icon name="check" size={16} color={COLORS.success} />
                                  <Text style={styles.historyStatText}>
                                    {attempt.correct_phonemes}/{attempt.total_phonemes}
                                  </Text>
                                </View>
                              </View>
                              
                              <Text style={styles.historyFeedbackText}>{attempt.feedback}</Text>
                            </View>
                          )).reverse()}
                        </ScrollView>
                      )}
                    </View>
                    
                    <View style={styles.dailyMeaning}>
                      <Icon name="info-outline" size={20} color={COLORS.primary} />
                      <Text style={styles.dailyMeaningText}>{selectedWord.meaning}</Text>
                    </View>

                    <View style={styles.dailyExample}>
                      <Icon name="format-quote" size={20} color={COLORS.gray[500]} />
                      <Text style={styles.dailyExampleText}>"{selectedWord.example}"</Text>
                    </View>

                    <View style={styles.dailyTip}>
                      <Icon name="lightbulb-outline" size={20} color={COLORS.gold} />
                      <Text style={styles.dailyTipText}>{selectedWord.tip}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.startDailyButton}
                      onPress={openPracticeFromFeedback}
                    >
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.secondary] as const}
                        style={styles.startDailyGradient}
                      >
                        <Text style={styles.startDailyText}>Try Again</Text>
                        <Icon name="refresh" size={20} color={COLORS.white} />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}

      {/* PRACTICE MODAL */}
      {selectedWord && (
        <Modal
          visible={showPracticeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={closePracticeModal}
        >
          <View style={styles.modalOverlay}>
            <Animated.View 
              style={[
                styles.modalContainer,
                {
                  opacity: modalAnim,
                  transform: [{ scale: modalScale }]
                }
              ]}
            >
              <ScrollView
                style={styles.practiceModalScroll}
                contentContainerStyle={styles.practiceModalScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <View style={styles.modalCard}>
                {!showResult ? (
                  <>
                    <View style={styles.modalHeader}>
                      <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={closePracticeModal}
                      >
                        <Icon name="close" size={24} color={COLORS.gray[600]} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.modalWordDisplay}>
                      <Text style={styles.modalWord}>{selectedWord.word}</Text>
                      <Text style={styles.modalPhonetic}>{selectedWord.phonetic}</Text>
                    </View>

                    <View style={styles.modalMeaning}>
                      <Icon name="book" size={20} color={COLORS.primary} />
                      <Text style={styles.modalMeaningText}>{selectedWord.meaning}</Text>
                    </View>

                    <View style={styles.modalExample}>
                      <Icon name="format-quote" size={20} color={COLORS.gray[500]} />
                      <Text style={styles.modalExampleText}>{selectedWord.example}</Text>
                    </View>

                    <View style={styles.modalTip}>
                      <Icon name="lightbulb-outline" size={20} color={COLORS.gold} />
                      <Text style={styles.modalTipText}>{selectedWord.tip}</Text>
                    </View>

                    <TouchableOpacity
                      style={styles.modalListenButton}
                      onPress={() => playWordPronunciation(selectedWord.word)}
                      disabled={playingAudio}
                    >
                      <Icon name={playingAudio ? 'volume-up' : 'headphones'} size={24} color={COLORS.white} />
                      <Text style={styles.modalListenText}>
                        {playingAudio ? 'Playing...' : 'Listen'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.modalRecordSection}>
                      {isProcessing ? (
                        <View style={styles.modalProcessing}>
                          <ActivityIndicator size="large" color={COLORS.primary} />
                          <Text style={styles.modalProcessingText}>Analyzing...</Text>
                        </View>
                      ) : (
                        <>
                          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <TouchableOpacity
                              style={styles.modalRecordButton}
                              onPress={handleRecord}
                              activeOpacity={0.9}
                            >
                              <LinearGradient
                                colors={isRecording ? [COLORS.error, '#DC2626'] as const : [COLORS.primary, COLORS.secondary] as const}
                                style={styles.modalRecordCircle}
                              >
                                <Icon 
                                  name={isRecording ? 'stop' : 'mic'} 
                                  size={40} 
                                  color={COLORS.white} 
                                />
                              </LinearGradient>
                            </TouchableOpacity>
                          </Animated.View>
                          
                          {isRecording && (
                            <Text style={styles.modalRecordingTime}>{recordingTime}</Text>
                          )}
                          
                          <Text style={styles.modalRecordHint}>
                            {isRecording ? 'Tap to stop' : 'Tap to record'}
                          </Text>
                        </>
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    {/* Result Screen */}
                    <View style={styles.modalHeader}>
                      <TouchableOpacity 
                        style={styles.closeButton}
                        onPress={closePracticeModal}
                      >
                        <Icon name="close" size={24} color={COLORS.gray[600]} />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.resultContent}>
                        <LinearGradient
                          colors={result && result.accuracy >= 0.8 
                            ? [COLORS.success, '#059669'] as const
                            : [COLORS.warning, '#D97706'] as const
                          }
                          style={styles.resultIconCircle}
                        >
                          <Icon 
                            name={result && result.accuracy >= 0.8 ? 'celebration' : 'emoji-events'} 
                            size={64} 
                            color={COLORS.white} 
                          />
                        </LinearGradient>
                        
                        <Text style={styles.resultTitle}>
                          {result && result.accuracy >= 0.9 ? 'Perfect!' :
                           result && result.accuracy >= 0.8 ? 'Excellent!' :
                           result && result.accuracy >= 0.7 ? 'Good Job!' : 'Keep Trying!'}
                        </Text>

                        <View style={styles.xpEarned}>
                          <Icon name="stars" size={24} color={COLORS.gold} />
                          <Text style={styles.xpEarnedText}>
                            +{result && Math.round(result.accuracy * 10)} XP
                          </Text>
                        </View>

                        <View style={styles.scoreDisplay}>
                          <Text style={styles.scoreText}>{result && Math.round(result.accuracy * 100)}%</Text>
                          <Text style={styles.scoreLabel}>Accuracy</Text>
                        </View>

                        <View style={styles.resultStats}>
                          <View style={styles.resultStatItem}>
                            <Icon name="check-circle" size={24} color={COLORS.success} />
                            <Text style={styles.resultStatValue}>{result?.correct_phonemes || 0}</Text>
                            <Text style={styles.resultStatLabel}>Correct</Text>
                          </View>
                          <View style={styles.resultStatDivider} />
                          <View style={styles.resultStatItem}>
                            <Icon name="cancel" size={24} color={COLORS.error} />
                            <Text style={styles.resultStatValue}>
                              {result ? result.total_phonemes - result.correct_phonemes : 0}
                            </Text>
                            <Text style={styles.resultStatLabel}>Errors</Text>
                          </View>
                        </View>

                        <View style={styles.resultFeedback}>
                          <Text style={styles.resultFeedbackTitle}>Feedback</Text>
                          <Text style={styles.resultFeedbackText}>{result?.feedback}</Text>
                        </View>

                        <View style={styles.resultActions}>
                          <TouchableOpacity 
                            style={styles.resultTryAgain}
                            onPress={() => setShowResult(false)}
                          >
                            <Icon name="refresh" size={24} color={COLORS.primary} />
                            <Text style={styles.resultTryAgainText}>Try Again</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.resultContinue}
                            onPress={closePracticeModal}
                          >
                            <LinearGradient
                              colors={[COLORS.primary, COLORS.secondary] as const}
                              style={styles.resultContinueGradient}
                            >
                              <Text style={styles.resultContinueText}>Continue</Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        </View>
                      </View>
                  </>
                )}
              </View>
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      )}

      {/* STREAK CALENDAR MODAL */}
      <Modal
        visible={showStreakCalendar}
        transparent={true}
        animationType="fade"
        onRequestClose={closeStreakCalendar}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.streakCalendarContainer,
              {
                opacity: streakCalendarAnim,
                transform: [{
                  scale: streakCalendarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              }
            ]}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706', '#EA580C'] as const}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.streakCalendarHeader}
            >
              <View style={styles.streakHeaderTop}>
                <View style={styles.streakFireIcon}>
                  <Icon name="local-fire-department" size={40} color="#FFFFFF" />
                </View>
                <TouchableOpacity
                  onPress={closeStreakCalendar}
                  style={styles.streakCloseButton}
                >
                  <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.streakCalendarTitle}>🔥 Streak Calendar</Text>
              <View style={styles.streakStatsRow}>
                <View style={styles.streakStatBox}>
                  <Text style={styles.streakStatValue}>{stats.streak}</Text>
                  <Text style={styles.streakStatLabel}>Current Streak</Text>
                </View>
                <View style={styles.streakStatDivider} />
                <View style={styles.streakStatBox}>
                  <Text style={styles.streakStatValue}>{streakDays.length}</Text>
                  <Text style={styles.streakStatLabel}>Total Days</Text>
                </View>
              </View>
            </LinearGradient>

            <ScrollView
              style={styles.streakCalendarContent}
              contentContainerStyle={styles.streakCalendarScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.streakCalendarSubtitle}>
                Keep practicing daily to maintain your streak! 🌟
              </Text>
              
              <View style={styles.calendarGrid}>
                {Array.from({ length: 12 }, (_, monthIndex) => {
                  const currentDate = new Date();
                  const targetMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - monthIndex, 1);
                  return (
                    <View key={monthIndex} style={styles.monthContainer}>
                      <Text style={styles.monthTitle}>
                        {targetMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </Text>
                      <View style={styles.monthGrid}>
                        {Array.from({ length: 31 }, (_, dayIndex) => {
                          const day = dayIndex + 1;
                          const dateCheck = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day);
                          
                          // Check if day exists in this month
                          if (dateCheck.getMonth() !== targetMonth.getMonth()) return null;
                          
                          const dateStr = `${dateCheck.getFullYear()}-${String(dateCheck.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const isStreakDay = streakDays.includes(dateStr);
                          const isToday = dateCheck.toDateString() === new Date().toDateString();
                          
                          return (
                            <View
                              key={dayIndex}
                              style={[
                                styles.dayCell,
                                isStreakDay && styles.dayCellActive,
                                isToday && styles.dayCellToday,
                              ]}
                            >
                              {isStreakDay ? (
                                <Text style={styles.fireEmoji}>🔥</Text>
                              ) : (
                                <Text style={styles.dayNumber}>{day}</Text>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  headerTop: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gray[900],
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.05)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badgeLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  controls: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  dropdownMenu: {
    position: 'absolute',
    top: 55,
    left: 0,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 12,
    minWidth: 180,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 12,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.primary + '10',
  },
  difficultyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[700],
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  dailyTaskButton: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  dailyTaskGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dailyTaskBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  dailyTaskBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.white,
  },
  progressContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[800],
  },
  progressPercentage: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  progressBar: {
    height: 14,
    backgroundColor: COLORS.gray[100],
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  progressFill: {
    height: '100%',
    borderRadius: 7,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  pathContainer: {
    position: 'relative',
    minHeight: height * 2.5,
    paddingTop: 40,
    paddingBottom: 100,
  },
  connectingPath: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  pathGradient: {
    flex: 1,
    borderRadius: 5,
  },
  pathDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.white,
    top: 2,
    transform: [{ translateX: -3 }],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  wordNodeContainer: {
    position: 'absolute',
    width: 104,
    height: 104,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordNodeBackground: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    opacity: 0.6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  wordGlowOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    alignSelf: 'center',
    top: -13,
    opacity: 0.25,
  },
  wordGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    alignSelf: 'center',
    top: -3,
    opacity: 0.5,
  },
  wordGlowInner: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    alignSelf: 'center',
    top: 4,
    opacity: 0.3,
  },
  levelRing: {
    position: 'absolute',
    width: 98,
    height: 98,
    borderRadius: 49,
    borderWidth: 2.5,
    alignSelf: 'center',
    top: 3,
    opacity: 0.5,
  },
  wordCircleButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
  },
  circleSurface: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 42,
    backgroundColor: COLORS.white,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 42,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  progressCircleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfectStar: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FEF3C7',
  },
  currentIconContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentIconGlow: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    opacity: 0.2,
  },
  lockedContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  wordPreview: {
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.7,
  },
  scoreLabel: {
    position: 'absolute',
    bottom: -16,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  scoreLabelGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  scoreLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.gray[800],
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0.5 },
    textShadowRadius: 1,
  },
  wordLabelCard: {
    position: 'absolute',
    top: 110,
    left: '50%',
    transform: [{ translateX: -70 }],
    borderRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
    width: 140,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: COLORS.white,
  },
  wordLabelGradient: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  wordLabelContent: {
    alignItems: 'center',
    gap: 6,
  },
  wordLabelText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.08)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  wordLabelProgress: {
    width: '100%',
    height: 5,
    backgroundColor: '#E9EEF5',
    borderRadius: 3,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  wordLabelProgressBar: {
    height: '100%',
    borderRadius: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  wordLabelBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  milestoneMarker: {
    position: 'absolute',
    width: 200,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  milestoneGradient: {
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  milestoneIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 5,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  milestoneText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    marginBottom: 8,
  },
  milestoneProgressContainer: {
    width: '100%',
  },
  milestoneProgress: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dailyTaskModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  dailyTaskScrollView: {
    flex: 1,
    width: '100%',
  },
  dailyTaskScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  dailyTaskModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  dailyTaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
  },
  dailyTaskTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    marginLeft: 8,
  },
  dailyTaskClose: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dailyTaskContent: {
    padding: 24,
  },
  dailyWordText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.gray[800],
    textAlign: 'center',
    marginBottom: 8,
  },
  dailyPhonetic: {
    fontSize: 16,
    color: COLORS.gray[600],
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 20,
  },
  dailyMeaning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.gray[50],
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
  },
  dailyMeaningText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray[700],
    fontWeight: '500',
    lineHeight: 20,
  },
  dailyExample: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.gray[50],
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  dailyExampleText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray[600],
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 18,
  },
  dailyTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  dailyTipText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 18,
  },
  startDailyButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  startDailyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  startDailyText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  latestAttemptSection: {
    marginBottom: 20,
  },
  latestAttemptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  latestAttemptTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[800],
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  latestAttemptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  attemptScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.gray[100],
  },
  attemptScoreItem: {
    alignItems: 'center',
  },
  attemptScoreValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    marginBottom: 6,
    letterSpacing: -1,
    textShadowColor: 'rgba(99, 102, 241, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  attemptScoreLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[600],
    textTransform: 'uppercase',
  },
  attemptScoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.gray[300],
  },
  latestFeedback: {
    gap: 8,
  },
  latestFeedbackLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.gray[700],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  latestFeedbackText: {
    fontSize: 14,
    color: COLORS.gray[700],
    fontWeight: '500',
    lineHeight: 20,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 12,
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  viewHistoryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  feedbackHistoryScroll: {
    maxHeight: 300,
    backgroundColor: COLORS.gray[50],
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  historyAttemptCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  historyAttemptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyAttemptNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },
  historyAttemptTime: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  historyAttemptStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  historyStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyStatText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  historyFeedbackText: {
    fontSize: 13,
    color: COLORS.gray[600],
    fontWeight: '500',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  practiceModalScroll: {
    width: '100%',
    maxWidth: 440,
    maxHeight: height * 0.9,
  },
  practiceModalScrollContent: {
    flexGrow: 1,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 32,
    padding: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 32,
    elevation: 15,
  },
  modalHeader: {
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWordDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalWord: {
    fontSize: 44,
    fontWeight: '900',
    color: COLORS.gray[800],
    marginBottom: 8,
    letterSpacing: -1.5,
  },
  modalPhonetic: {
    fontSize: 18,
    color: COLORS.gray[600],
    fontWeight: '600',
    fontStyle: 'italic',
  },
  modalMeaning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.gray[50],
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
  },
  modalMeaningText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.gray[700],
    fontWeight: '600',
    lineHeight: 22,
  },
  modalExample: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.gray[50],
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  modalExampleText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray[600],
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 20,
  },
  modalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  modalTipText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 20,
  },
  modalListenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  modalListenText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalRecordSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  modalProcessing: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  modalProcessingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
  modalRecordButton: {
    marginBottom: 16,
  },
  modalRecordCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 10,
  },
  modalRecordingTime: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.error,
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  modalRecordHint: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[500],
  },
  resultContent: {
    alignItems: 'center',
  },
  resultIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gray[800],
    marginBottom: 16,
  },
  xpEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  xpEarnedText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#92400E',
  },
  scoreDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: -2,
    lineHeight: 64,
  },
  resultStats: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  resultStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.gray[800],
    marginTop: 8,
    marginBottom: 4,
  },
  resultStatLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  resultStatDivider: {
    width: 2,
    height: 60,
    backgroundColor: COLORS.gray[300],
  },
  resultFeedback: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  resultFeedbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray[700],
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultFeedbackText: {
    fontSize: 15,
    color: COLORS.gray[700],
    fontWeight: '500',
    lineHeight: 22,
  },
  resultActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  resultTryAgain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 3,
    borderColor: COLORS.gray[300],
  },
  resultTryAgainText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  resultContinue: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  resultContinueGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContinueText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  // Streak Calendar Styles
  streakCalendarContainer: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: COLORS.white,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 15,
  },
  streakCalendarHeader: {
    padding: 24,
    paddingTop: 28,
  },
  streakHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakFireIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  streakCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  streakCalendarTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  streakStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  streakStatBox: {
    flex: 1,
    alignItems: 'center',
  },
  streakStatValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 4,
    letterSpacing: -1,
  },
  streakStatLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.95)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakStatDivider: {
    width: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 16,
  },
  streakCalendarContent: {
    flex: 1,
  },
  streakCalendarScrollContent: {
    padding: 20,
  },
  streakCalendarSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  calendarGrid: {
    gap: 20,
  },
  monthContainer: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.gray[800],
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.gray[200],
  },
  dayCellActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 2,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  dayCellToday: {
    borderColor: COLORS.primary,
    borderWidth: 2.5,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[400],
  },
  fireEmoji: {
    fontSize: 20,
  },
});