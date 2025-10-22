// app/(tabs)/index.tsx - REDESIGNED with Interactive Pronunciation Feedback

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
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ref, onValue, set, get } from 'firebase/database';
import { auth, database } from '../../lib/firebase';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LearningPathBackground from '../../components/LearningPathBackground';
import EnhancedStreakCalendar from '../../components/EnhancedStreakCalendar';
import DailyWordCard from '../../components/DailyWordCard';
import PracticeTable from '../../components/PracticeTable';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
} from 'react-native-audio-recorder-player';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

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

interface WordProgress {
  wordId: string;
  word: string;
  completed: boolean;
  mastered: boolean;
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
  word_level_analysis?: {
    word_phoneme_mapping: WordPhonemeData[];
  };
  audio_data?: {
    word_audio: { [key: string]: { audio_base64: string; status: string } };
  };
}

interface WordPhonemeData {
  word: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  phoneme_errors: any[];
  per: { per: number };
  accuracy?: number;
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
  
  // Practice words data
  const [allWords, setAllWords] = useState<Word[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // UI State
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDailyTask, setShowDailyTask] = useState(false);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  const [streakDays, setStreakDays] = useState<string[]>([]);
  
  // Practice Modal State
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
  
  // Audio and recording state
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [recordingWord, setRecordingWord] = useState<string | null>(null);
  const [latestAttempt, setLatestAttempt] = useState<any>(null);

  const insets = useSafeAreaInsets();
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
  
  // Scroll animation tracking
  const scrollY = useRef(new Animated.Value(0)).current;
  const SCROLL_THRESHOLD = 100;
  const [floatingPanelExpanded, setFloatingPanelExpanded] = useState(false);

  const [autoScrollDone, setAutoScrollDone] = useState(false);
  const [scrollToPosition, setScrollToPosition] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

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
  // STREAK CALENDAR FUNCTIONS
  // ============================================================================

  const calculateStreakDays = useCallback(async (allDailyWords: any, userId: string) => {
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
      
      // Check if user practiced on this day (daily word OR practice words)
      const hasDailyWord = allDailyWords[checkDateStr] && allDailyWords[checkDateStr].attempts > 0;
      const hasPracticeWords = allPracticeWords[checkDateStr];
      
      if (hasDailyWord || hasPracticeWords) {
        streakDates.push(checkDateStr);
      } else {
        // Stop at first day without practice
        break;
      }
    }
    
    setStreakDays(streakDates);
    return streakDates.length;
  }, []);

  // ============================================================================
  // DATA LOADING FUNCTIONS
  // ============================================================================

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
        setWordProgress(progressData);
        
        // Update completion stats
        updateCompletionStats(words, progressData);
        
        console.log(`✅ Fast loaded ${words.length} ${difficulty} words`);
        return wordsResponse.value.data;
      } else {
        console.error('Words API failed:', wordsResponse.status === 'rejected' ? wordsResponse.reason : 'Unknown error');
        return null;
      }
    } catch (error) {
      console.error('Fast load error:', error);
      return null;
    } finally {
      loadingRef.current = false;
      setIsLoadingProgress(false);
    }
  };

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
      
      return allProgress;
    } catch (error) {
      console.error('Error loading practice progress:', error);
      return {};
    }
  };

  const updateCompletionStats = (words: Word[], progress: { [key: string]: WordProgress }) => {
    // Count completed words (50%+ accuracy)
    const completedInDifficulty = words.filter(w => {
      const prog = progress[w.id];
      return prog && prog.bestScore >= 0.5;
    }).length;
    
    // Count mastered words (80%+ accuracy)
    const masteredInDifficulty = words.filter(w => {
      const prog = progress[w.id];
      return prog && prog.bestScore >= 0.8;
    }).length;
    
    const completionPerc = (completedInDifficulty / words.length) * 100;
    
    setCompletedCount(completedInDifficulty);
    setCompletionPercentage(completionPerc);
    
    // Update current word index
    let newCurrentIndex = 0;
    for (let i = 0; i < words.length; i++) {
      const prog = progress[words[i].id];
      if (!prog || (prog.bestScore || 0) < 0.5) {
        newCurrentIndex = i;
        break;
      }
      if (i === words.length - 1) {
        newCurrentIndex = i;
      }
    }
    setCurrentWordIndex(newCurrentIndex);
  };

  // ============================================================================
  // PRACTICE FUNCTIONS
  // ============================================================================

  const openPracticeModalFast = (word: Word, isDaily: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedWord(word);
    setIsPracticingDaily(isDaily);
    setShowPracticeModal(true);
    setShowResult(false);
    setResult(null);
    setPlayingAudio(false);
    setRecordingTime('00:00');
    recordSecsRef.current = 0;
    recordTimeRef.current = '00:00';
  };

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      try {
        const result = await audioRecorderPlayer.stopRecorder();
        setIsRecording(false);
        audioRecorderPlayer.removeRecordBackListener();
        
        if (result) {
          recordingPathRef.current = result;
          await processRecording(result);
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const audioSet = {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 2,
      AVFormatIDKeyIOS: AVEncodingOption.aac,
    };
    
    const result = await audioRecorderPlayer.startRecorder(undefined, audioSet);
    audioRecorderPlayer.addRecordBackListener((e) => {
      recordSecsRef.current = e.currentPosition;
      recordTimeRef.current = audioRecorderPlayer.mmssss(Math.floor(e.currentPosition));
      setRecordingTime(recordTimeRef.current);
    });
    
    setIsRecording(true);
    recordingPathRef.current = result;
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      }
    }
  };

  const processRecording = async (audioPath: string) => {
    if (!selectedWord) return;
    
    setIsProcessing(true);
    
    try {
      // Convert audio to base64
      const audioData = await RNFS.readFile(audioPath, 'base64');
      const audioUri = `data:audio/m4a;base64,${audioData}`;
      
      // Analyze pronunciation
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        audio: audioUri,
        reference_text: selectedWord.word,
      });
      
      if (response.data && response.data.success) {
        const analysisResult = response.data.analysis || response.data;
        
        const resultData: AnalysisResult = {
          accuracy: analysisResult.accuracy,
          correct_phonemes: analysisResult.correct_phonemes,
          total_phonemes: analysisResult.total_phonemes,
          feedback: analysisResult.feedback || 'Great job!',
          word_level_analysis: analysisResult.word_level_analysis,
          audio_data: analysisResult.audio_data,
        };
        
        setResult(resultData);
        setShowResult(true);
        
        // Save attempt
        if (isPracticingDaily) {
          await saveDailyWordAttempt(
            resultData.accuracy,
            resultData.feedback,
            resultData.correct_phonemes,
            resultData.total_phonemes
          );
        } else {
          await updateWordProgressFast(resultData.accuracy);
        }
        
        // Set latest attempt for practice table
        setLatestAttempt({
          scores: resultData,
          timestamp: new Date().toISOString(),
        });
        
      } else {
        Alert.alert('Analysis Error', 'Failed to analyze pronunciation. Please try again.');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      Alert.alert('Processing Error', 'Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const updateWordProgressFast = async (accuracy: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !selectedWord || !result) return;

      if (isPracticingDaily) {
        console.log('Skipping practice word save - this is a daily word');
        return;
      }

      const timestamp = new Date().toISOString();
      const isCompleted = accuracy >= 0.5;
      const isMastered = accuracy >= 0.8;
      const xpEarned = Math.round(accuracy * 10);
      const wordId = selectedWord.id;
      const difficulty = selectedWord.difficulty;

      const newAttempt: PracticeWordAttempt = {
        timestamp,
        accuracy,
        feedback: result.feedback,
        correct_phonemes: result.correct_phonemes,
        total_phonemes: result.total_phonemes,
      };

      const existingProgress = wordProgress[wordId];
      const previousBestScore = existingProgress?.bestScore || 0;
      const newBestScore = Math.max(previousBestScore, accuracy);

      const updatedProgress: WordProgress = {
        wordId,
        word: selectedWord.word,
        completed: isCompleted,
        mastered: isMastered,
        attempts: (existingProgress?.attempts || 0) + 1,
        bestScore: newBestScore,
        lastAttempted: timestamp,
        attemptHistory: [
          ...(existingProgress?.attemptHistory || []),
          newAttempt
        ].slice(-10), // Keep last 10 attempts
      };

      // Update local state
      setWordProgress(prev => ({
        ...prev,
        [wordId]: updatedProgress
      }));

      // Save to Firebase
      const progressRef = ref(database, `users/${user.uid}/practiceWords/${difficulty}/${wordId}`);
      await set(progressRef, updatedProgress);

      // Update stats
      await updateUserStats(user.uid, xpEarned);

      console.log(`✅ Updated progress for ${selectedWord.word}: ${accuracy.toFixed(2)} accuracy`);
    } catch (error) {
      console.error('Error updating word progress:', error);
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
          mastered: false,
          accuracy: 0,
          attempts: 0,
          bestScore: 0,
          attemptHistory: [],
        };
      }

      const updatedProgress: DailyWordProgress = {
        ...existingProgress,
        attempts: existingProgress.attempts + 1,
        accuracy: accuracy,
        bestScore: Math.max(existingProgress.bestScore, accuracy),
        completed: accuracy >= 0.5,
        mastered: accuracy >= 0.8,
        attemptHistory: [
          ...(existingProgress.attemptHistory || []),
          newAttempt
        ].slice(-10),
      };

      await set(dailyRef, updatedProgress);
      setTodayProgress(updatedProgress);

      // Update streak
      await updateStreakForToday(user.uid, today);

      return updatedProgress;
    } catch (error) {
      console.error('Error saving daily word attempt:', error);
      throw error;
    }
  };

  const updateStreakForToday = async (userId: string, today: string) => {
    try {
      const dailyRef = ref(database, `users/${userId}/dailyWords/${today}`);
      const dailySnapshot = await get(dailyRef);
      
      const practiceToday = await checkPracticeWordsForToday(userId, today);
      
      if (dailySnapshot.exists() || practiceToday) {
        const allDailyWordsRef = ref(database, `users/${userId}/dailyWords`);
        const allDailySnapshot = await get(allDailyWordsRef);
        
        if (allDailySnapshot.exists()) {
          const allDailyWords = allDailySnapshot.val();
          const newStreak = await calculateStreakDays(allDailyWords, userId);
          
          const statsRef = ref(database, `users/${userId}/stats`);
          const statsSnapshot = await get(statsRef);
          const currentStats = statsSnapshot.exists() ? statsSnapshot.val() : {};
          
          await set(statsRef, {
            ...currentStats,
            streak: newStreak,
          });
        }
      }
    } catch (error) {
      console.error('Error updating streak:', error);
    }
  };

  const checkPracticeWordsForToday = async (userId: string, today: string) => {
    try {
      for (const difficulty of ['easy', 'intermediate', 'hard']) {
        const diffRef = ref(database, `users/${userId}/practiceWords/${difficulty}`);
        const snapshot = await get(diffRef);
        
        if (snapshot.exists()) {
          const practiceWords = snapshot.val();
          for (const wordData of Object.values(practiceWords) as any[]) {
            if (wordData.lastAttempted) {
              const attemptDate = new Date(wordData.lastAttempted);
              const dateStr = `${attemptDate.getFullYear()}-${String(attemptDate.getMonth() + 1).padStart(2, '0')}-${String(attemptDate.getDate()).padStart(2, '0')}`;
              if (dateStr === today) {
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

  const updateUserStats = async (userId: string, xpEarned: number) => {
    try {
      const statsRef = ref(database, `users/${userId}/stats`);
      const snapshot = await get(statsRef);
      const currentStats = snapshot.exists() ? snapshot.val() : {};
      
      const newStats = {
        ...currentStats,
        xp: (currentStats.xp || 0) + xpEarned,
        totalWords: (currentStats.totalWords || 0) + 1,
      };
      
      await set(statsRef, newStats);
    } catch (error) {
      console.error('Error updating user stats:', error);
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  const initializeUser = async (userId: string) => {
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
        (async () => {
          const dailyRef = ref(database, `users/${userId}/dailyWords`);
          onValue(dailyRef, (snapshot) => {
            if (snapshot.exists()) {
              const allDailyWords = snapshot.val();
              const today = getTodayDateString();
              const todayData = allDailyWords[today];
              
              if (todayData) {
                setTodayProgress(todayData);
              }
              
              // Calculate streak days
              calculateStreakDays(allDailyWords, userId);
            }
          });
          
          // Load today's word
          const response = await axios.get(`${API_BASE_URL}/api/daily-word/${userId}`);
          if (response.data && response.data.success) {
            setTodayWord(response.data.word);
          }
        })(),
        
        // Practice progress
        loadPracticeProgress(userId),
        
        // Daily progress
        (async () => {
          const today = getTodayDateString();
          const dailyRef = ref(database, `users/${userId}/dailyWords/${today}`);
          const snapshot = await get(dailyRef);
          if (snapshot.exists()) {
            setTodayProgress(snapshot.val());
          }
        })(),
      ]);

      // Load initial practice words
      loadAllDataFast(selectedDifficulty);
      
    } catch (error) {
      console.error('Error initializing user:', error);
    }
  };

  // ============================================================================
  // EFFECTS
  // ============================================================================

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && !user.isAnonymous) {
        setUserName(user.displayName || 'User');
        initializeUser(user.uid);
      } else {
        console.log('No authenticated user');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (lastDifficultyRef.current === selectedDifficulty) return;
    
    lastDifficultyRef.current = selectedDifficulty;
    const user = auth.currentUser;
    
    if (user && !loadingRef.current) {
      console.log(`🚀 Fast loading ${selectedDifficulty} words`);
      loadAllDataFast(selectedDifficulty);
    }
  }, [selectedDifficulty]);

  useEffect(() => {
    if (allWords.length > 0 && !isInitialized) {
      setIsInitialized(true);
      
      // Pre-warm animations for better performance
      allWords.forEach((word, index) => {
        if (!wordNodeAnims[word.id]) {
          wordNodeAnims[word.id] = new Animated.Value(1);
          glowAnims[word.id] = new Animated.Value(0);
          pulseAnims[word.id] = new Animated.Value(1);
          rotateAnims[word.id] = new Animated.Value(0);
        }
      });
    }
  }, [allWords]);

  // ============================================================================
  // ANIMATION EFFECTS
  // ============================================================================

  useEffect(() => {
    // Badge entrance animations
    Animated.stagger(200, [
      Animated.spring(badgeAnims[0], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(badgeAnims[1], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.spring(badgeAnims[2], {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Daily task pulse animation
    if (todayProgress && !todayProgress.completed) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(dailyTaskPulse, {
            toValue: 1.1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(dailyTaskPulse, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      dailyTaskPulse.setValue(1);
    }
  }, [todayProgress]);

  // ============================================================================
  // SCROLL ANIMATIONS
  // ============================================================================

  const headerPaddingBottom = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD],
    outputRange: [16, 8],
    extrapolate: 'clamp',
  });

  const controlsOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const controlsTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD / 2],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const progressOpacity = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD / 2],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const progressTranslateY = scrollY.interpolate({
    inputRange: [0, SCROLL_THRESHOLD / 2],
    outputRange: [0, -20],
    extrapolate: 'clamp',
  });

  const floatingPanelOpacity = scrollY.interpolate({
    inputRange: [SCROLL_THRESHOLD, SCROLL_THRESHOLD + 50],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const floatingPanelTranslateY = scrollY.interpolate({
    inputRange: [SCROLL_THRESHOLD, SCROLL_THRESHOLD + 50],
    outputRange: [20, 0],
    extrapolate: 'clamp',
  });

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleDifficultyChange = (difficulty: DifficultyLevel) => {
    Haptics.selectionAsync();
    setSelectedDifficulty(difficulty);
    setShowDropdown(false);
  };

  const openStreakCalendar = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowStreakCalendar(true);
  };

  const handleWordRecord = (word: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecordingWord(word);
    handleRecord();
  };

  const handleWordPlay = (word: string) => {
    Haptics.selectionAsync();
    setPlayingWord(word);
  };

  const handleViewHistory = () => {
    Haptics.selectionAsync();
    setShowFeedbackHistory(!showFeedbackHistory);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <View style={styles.container}>
      <LearningPathBackground />
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
            paddingBottom: headerPaddingBottom,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <Text style={styles.userName}>Hi, {userName}! </Text>
        </View>

        <View style={styles.badgesContainer}>
          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[0] }] }]}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.secondary]}
              style={styles.badgeGradient}
            >
              <Icon name="menu-book" size={24} color={COLORS.white} />
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeValue}>{stats.totalWords}</Text>
                <Text style={styles.badgeLabel}>Words</Text>
              </View>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[1] }] }]}>
            <TouchableOpacity onPress={openStreakCalendar} activeOpacity={0.8}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.badgeGradient}
              >
                <Icon name="local-fire-department" size={24} color={COLORS.white} />
                <View style={styles.badgeInfo}>
                  <Text style={styles.badgeValue}>{stats.streak}</Text>
                  <Text style={styles.badgeLabel}>Streak</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[styles.badge, { transform: [{ scale: badgeAnims[2] }] }]}>
            <LinearGradient
              colors={[COLORS.success, '#059669']}
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
      </Animated.View>

      {/* Content Area */}
      <View style={styles.contentWrapper}>
        {/* Controls */}
        <Animated.View 
          style={[
            styles.controls,
            {
              opacity: controlsOpacity,
              transform: [{ translateY: controlsTranslateY }],
            },
          ]}
        >
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
        </Animated.View>

        {/* Progress Indicator */}
        {allWords.length > 0 && (
          <Animated.View 
            style={[
              styles.progressContainer,
              {
                opacity: progressOpacity,
                transform: [{ translateY: progressTranslateY }],
              },
            ]}
          >
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
                  colors={[COLORS.primary, COLORS.secondary, COLORS.tertiary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressGradient}
                />
              </Animated.View>
            </View>
            <Text style={styles.progressText}>
              {allWords.filter(w => {
                const prog = wordProgress[w.id];
                return prog && prog.bestScore >= 0.8;
              }).length} mastered · {allWords.filter(w => {
                const prog = wordProgress[w.id];
                return prog && prog.bestScore >= 0.5 && prog.bestScore < 0.8; 
              }).length} completed · Word {currentWordIndex + 1} active
            </Text>
          </Animated.View>
        )}

        {/* Main Content */}
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
        >
          {/* Daily Word Card */}
          {todayWord && (
            <DailyWordCard
              word={todayWord}
              progress={todayProgress || undefined}
              onStartPractice={() => {
                setShowDailyTask(false);
                openPracticeModalFast(todayWord, true);
              }}
              onViewHistory={handleViewHistory}
              showHistory={showFeedbackHistory}
            />
          )}

          {/* Practice Words Table */}
          {latestAttempt && latestAttempt.scores && (
            <PracticeTable
              words={latestAttempt.scores.word_level_analysis?.word_phoneme_mapping || []}
              audioData={latestAttempt.scores.audio_data}
              onWordRecord={handleWordRecord}
              onWordPlay={handleWordPlay}
              isRecording={isRecording}
              isProcessing={isProcessing}
              playingWord={playingWord}
              recordingWord={recordingWord}
              title="Practice Words Analysis"
              showOnlyNeedingPractice={true}
            />
          )}

          {/* All Practice Words Table */}
          {allWords.length > 0 && (
            <PracticeTable
              words={allWords.map(word => ({
                word: word.word,
                reference_phonemes: [],
                predicted_phonemes: [],
                aligned_reference: [],
                aligned_predicted: [],
                status: (() => {
                  const prog = wordProgress[word.id];
                  if (!prog || prog.attempts === 0) return 'mispronounced';
                  if (prog.bestScore >= 0.8) return 'correct';
                  if (prog.bestScore >= 0.5) return 'partial';
                  return 'mispronounced';
                })(),
                phoneme_errors: [],
                per: { per: 0 },
                accuracy: wordProgress[word.id]?.bestScore || 0,
              }))}
              audioData={undefined}
              onWordRecord={handleWordRecord}
              onWordPlay={handleWordPlay}
              isRecording={isRecording}
              isProcessing={isProcessing}
              playingWord={playingWord}
              recordingWord={recordingWord}
              title="All Practice Words"
              showOnlyNeedingPractice={false}
            />
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </View>

      {/* Practice Modal */}
      {selectedWord && (
        <Modal
          visible={showPracticeModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowPracticeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <LinearGradient
                colors={[COLORS.primary, COLORS.secondary]}
                style={styles.modalHeader}
              >
                <Text style={styles.modalTitle}>
                  {isPracticingDaily ? "Today's Challenge" : "Practice Word"}
                </Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setShowPracticeModal(false)}
                >
                  <Icon name="close" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </LinearGradient>

              <View style={styles.modalContent}>
                <Text style={styles.modalWordText}>{selectedWord.word}</Text>
                <Text style={styles.modalPhoneticText}>{selectedWord.phonetic}</Text>
                
                {!showResult ? (
                  <View style={styles.recordingSection}>
                    <TouchableOpacity
                      style={styles.recordButton}
                      onPress={handleRecord}
                      disabled={isProcessing}
                    >
                      <LinearGradient
                        colors={isRecording ? [COLORS.error, '#DC2626'] : [COLORS.primary, COLORS.secondary]}
                        style={styles.recordButtonGradient}
                      >
                        <Icon 
                          name={isRecording ? "stop" : "mic"} 
                          size={48} 
                          color={COLORS.white} 
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <Text style={styles.recordingText}>
                      {isRecording ? 'Recording...' : 'Tap to record'}
                    </Text>
                    
                    {isRecording && (
                      <Text style={styles.recordingTime}>{recordingTime}</Text>
                    )}
                    
                    {isProcessing && (
                      <View style={styles.processingContainer}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.processingText}>Analyzing pronunciation...</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.resultSection}>
                    <Text style={styles.resultTitle}>
                      {result && result.accuracy >= 0.8 ? 'Great job!' : 'Keep practicing!'}
                    </Text>
                    <Text style={styles.resultAccuracy}>
                      {result ? Math.round(result.accuracy * 100) : 0}% Accuracy
                    </Text>
                    <Text style={styles.resultFeedback}>{result?.feedback}</Text>
                    
                    <TouchableOpacity
                      style={styles.tryAgainButton}
                      onPress={() => {
                        setShowResult(false);
                        setResult(null);
                      }}
                    >
                      <Text style={styles.tryAgainText}>Try Again</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Streak Calendar Modal */}
      <EnhancedStreakCalendar
        visible={showStreakCalendar}
        onClose={() => setShowStreakCalendar(false)}
        streakDays={streakDays}
        currentStreak={stats.streak}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTop: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.gray[900],
    letterSpacing: -0.5,
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  badge: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeGradient: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: 2,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  contentWrapper: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  dropdownContainer: {
    position: 'relative',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    gap: 8,
  },
  dropdownButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[800],
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1000,
    marginTop: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.gray[50],
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray[700],
  },
  dropdownItemTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.gray[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressGradient: {
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray[600],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 20,
    alignItems: 'center',
  },
  modalWordText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  modalPhoneticText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 32,
  },
  recordingSection: {
    alignItems: 'center',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 8,
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.error,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginTop: 12,
  },
  resultSection: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  resultAccuracy: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 16,
  },
  resultFeedback: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  tryAgainButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});