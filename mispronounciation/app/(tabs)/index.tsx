// app/(tabs)/index.tsx - Updated with Batch System
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
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';
import ProgressCircle from '../../components/ProgressCircle';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

// Material Design 3 Colors
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
} as const;

const DIFFICULTY_COLORS = {
  easy: { primary: '#10B981', gradient: ['#10B981', '#059669'] as const },
  intermediate: { primary: '#F59E0B', gradient: ['#F59E0B', '#D97706'] as const },
  hard: { primary: '#EF4444', gradient: ['#EF4444', '#DC2626'] as const },
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

interface WordBatch {
  batchNumber: number;
  difficulty: string;
  words: Word[];
  generatedAt: string;
  wordCount: number;
  status: string;
}

interface WordProgress {
  wordId: string;
  word: string;
  completed: boolean;
  attempts: number;
  bestScore: number;
  lastAttempted: string;
}

interface DailyWordProgress {
  word: string;
  date: string;
  completed: boolean;
  accuracy: number;
  attempts: number;
  bestScore: number;
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

type DifficultyLevel = 'easy' | 'intermediate' | 'hard';

// Add missing type declarations for audio recorder
interface AudioSet {
  AudioEncoderAndroid?: any;
  AudioSourceAndroid?: any;
  AVEncoderAudioQualityKeyIOS?: any;
  AVNumberOfChannelsKeyIOS?: number;
  AVFormatIDKeyIOS?: any;
}

const AudioEncoderAndroidType = {
  AAC: 3,
  AMR_NB: 1,
  AMR_WB: 2,
  DEFAULT: 0,
  HE_AAC: 4,
  OPUS: 5,
} as const;

const AudioSourceAndroidType = {
  DEFAULT: 0,
  MIC: 1,
  VOICE_UPLINK: 2,
  VOICE_DOWNLINK: 3,
  VOICE_CALL: 4,
  CAMCORDER: 5,
  VOICE_RECOGNITION: 6,
  VOICE_COMMUNICATION: 7,
  UNPROCESSED: 8,
} as const;

const AVEncoderAudioQualityIOSType = {
  min: 0,
  low: 32,
  medium: 64,
  high: 96,
  max: 127,
} as const;

const AVEncodingOption = {
  lpcm: 'lpcm',
  aac: 'aac',
} as const;

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
  
  // BATCH SYSTEM STATES
  const [currentBatch, setCurrentBatch] = useState<WordBatch | null>(null);
  const [currentBatchNumber, setCurrentBatchNumber] = useState(0);
  const [batchWords, setBatchWords] = useState<Word[]>([]);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [batchCompletionPercent, setBatchCompletionPercent] = useState(0);
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDailyTask, setShowDailyTask] = useState(false);
  
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const recordingPathRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const modalAnim = useRef(new Animated.Value(0)).current;
  
  // FIXED: Properly typed animation refs
  const badgeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ] as Animated.Value[]).current;

  const dailyTaskPulse = useRef(new Animated.Value(1)).current;
  
  // FIXED: Properly typed animation objects
  const wordNodeAnims = useRef<Record<string, Animated.Value>>({}).current;
  const glowAnims = useRef<Record<string, Animated.Value>>({}).current;
  
  const scrollViewRef = useRef<ScrollView>(null);

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  };

  // ============================================================================
  // BATCH SYSTEM FUNCTIONS
  // ============================================================================

  /**
   * Fetch a specific batch from backend
   */
  const fetchBatch = async (difficulty: DifficultyLevel, batchNumber: number): Promise<WordBatch | null> => {
    try {
      setIsLoadingBatch(true);
      
      const response = await axios.get(
        `${API_BASE_URL}/api/batches/${difficulty}/${batchNumber}`
      );
      
      if (response.data.success) {
        return response.data.batch;
      }
      
      return null;
    } catch (error: any) {
      console.error('Error fetching batch:', error);
      
      if (error.response?.status === 404) {
        Alert.alert('No More Batches', 'You\'ve completed all available batches for this level!');
      } else {
        Alert.alert('Error', 'Failed to load word batch');
      }
      
      return null;
    } finally {
      setIsLoadingBatch(false);
    }
  };

  /**
   * Load current batch for selected difficulty
   */
  const loadCurrentBatch = async (difficulty: DifficultyLevel) => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Get user's current batch number from Firebase
      const batchProgressRef = ref(database, `users/${user.uid}/batchProgress/${difficulty}`);
      const snapshot = await get(batchProgressRef);
      
      const userBatchNumber = snapshot.exists() ? snapshot.val().currentBatch || 0 : 0;
      setCurrentBatchNumber(userBatchNumber);

      // Fetch batch from backend
      const batch = await fetchBatch(difficulty, userBatchNumber);
      
      if (batch) {
        setCurrentBatch(batch);
        setBatchWords(batch.words);
        
        // Initialize animations for words
        batch.words.forEach((word: Word, index: number) => {
          if (!wordNodeAnims[word.id]) {
            wordNodeAnims[word.id] = new Animated.Value(0);
            glowAnims[word.id] = new Animated.Value(0);
          }
          
          Animated.spring(wordNodeAnims[word.id], {
            toValue: 1,
            tension: 50,
            friction: 7,
            delay: index * 80,
            useNativeDriver: true,
          }).start();
        });

        // Calculate completion percentage
        calculateBatchCompletion(batch.words);
      }
    } catch (error) {
      console.error('Error loading batch:', error);
    }
  };

  /**
   * Calculate batch completion percentage
   */
  const calculateBatchCompletion = (words: Word[]) => {
    const completedCount = words.filter(word => 
      wordProgress[word.id]?.completed
    ).length;
    
    const percent = (completedCount / words.length) * 100;
    setBatchCompletionPercent(Math.round(percent));

    // Auto-advance to next batch if current is 100% complete
    if (percent === 100) {
      checkAndAdvanceBatch();
    }
  };

  /**
   * Check if batch is complete and advance to next
   */
  const checkAndAdvanceBatch = async () => {
    try {
      const user = auth.currentUser;
      if (!user || !currentBatch) return;

      const allCompleted = batchWords.every(word => wordProgress[word.id]?.completed);

      if (allCompleted) {
        // Show celebration
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Alert.alert(
          '🎉 Batch Complete!',
          `Congratulations! You've mastered all ${batchWords.length} words in this batch. Ready for the next challenge?`,
          [
            {
              text: 'Continue',
              onPress: () => advanceToNextBatch(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error checking batch completion:', error);
    }
  };

  /**
   * Advance to next batch
   */
  const advanceToNextBatch = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const nextBatchNumber = currentBatchNumber + 1;

      // Update user's current batch in Firebase
      const batchProgressRef = ref(database, `users/${user.uid}/batchProgress/${selectedDifficulty}`);
      await set(batchProgressRef, {
        currentBatch: nextBatchNumber,
        completedBatches: currentBatchNumber + 1,
        lastUpdated: new Date().toISOString(),
      });

      // Load next batch
      setCurrentBatchNumber(nextBatchNumber);
      await loadCurrentBatch(selectedDifficulty);

      // Scroll to top
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      console.error('Error advancing batch:', error);
      Alert.alert('Error', 'Failed to load next batch');
    }
  };

  // ============================================================================
  // EXISTING FUNCTIONS (Updated)
  // ============================================================================

  const fetchDailyWord = async () => {
    try {
      // Use persistent daily word endpoint
      const response = await axios.get(`${API_BASE_URL}/api/daily-word-persistent`);
      if (response.data.success) {
        setTodayWord(response.data.word);
      }
    } catch (error) {
      console.error('Error fetching daily word:', error);
      Alert.alert('Error', 'Failed to load daily word');
    }
  };

  const calculateStatsFromHistory = useCallback(async (allDailyWords: any, userId: string) => {
    try {
      const dates = Object.keys(allDailyWords);
      let wordsAttempted = 0;
      let totalAccuracy = 0;
      let accuracyCount = 0;
      let currentStreak = 0;
      let totalXP = 0;

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

      const averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - daysAgo);
        const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        
        const dayData = allDailyWords[checkDateStr];
        if (dayData && dayData.attempts > 0) {
          currentStreak++;
        } else {
          if (daysAgo > 0) break;
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

  const loadUserData = useCallback(async (userId: string) => {
    try {
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

      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      onValue(dailyWordsRef, (snapshot) => {
        if (snapshot.exists()) {
          const allDailyWords = snapshot.val();
          calculateStatsFromHistory(allDailyWords, userId);
        }
      });

      // Fetch persistent daily word
      await fetchDailyWord();

      // Load daily word progress
      const todayDate = getTodayDateString();
      const progressRef = ref(database, `users/${userId}/dailyWords/${todayDate}`);
      const snapshot = await get(progressRef);
      
      if (snapshot.exists()) {
        setTodayProgress(snapshot.val());
      } else if (todayWord) {
        const newProgress: DailyWordProgress = {
          word: todayWord.word,
          date: todayDate,
          completed: false,
          accuracy: 0,
          attempts: 0,
          bestScore: 0,
        };
        setTodayProgress(newProgress);
        await set(progressRef, newProgress);
      }

      await loadPracticeProgress(userId);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [calculateStatsFromHistory, todayWord]);

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
      
      // Load current batch for selected difficulty
      await loadCurrentBatch(selectedDifficulty);
    } catch (error) {
      console.error('Error loading practice progress:', error);
    }
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      loadUserData(user.uid);
    }

    // Badge animations - FIXED: No .current needed since we're using .current in the declaration
    badgeAnims.forEach((anim, index) => {
      Animated.spring(anim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: index * 100,
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

  useEffect(() => {
    // Load new batch when difficulty changes
    loadCurrentBatch(selectedDifficulty);
  }, [selectedDifficulty]);

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

  useEffect(() => {
    // Recalculate batch completion when progress changes
    if (batchWords.length > 0) {
      calculateBatchCompletion(batchWords);
    }
  }, [wordProgress, batchWords]);

  const handleDifficultyChange = (difficulty: DifficultyLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDifficulty(difficulty);
    setShowDropdown(false);
  };

  const openPracticeModal = (word: Word, isDaily: boolean = false) => {
    setSelectedWord(word);
    setShowPracticeModal(true);
    setShowResult(false);
    setResult(null);
    Animated.spring(modalAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const closePracticeModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowPracticeModal(false);
      setSelectedWord(null);
      setShowResult(false);
      setResult(null);
      setIsRecording(false);
      setIsProcessing(false);
    });
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const path = `${RNFS.DocumentDirectoryPath}/word_${Date.now()}.wav`;
      const audioSet: AudioSet = {
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
      
      const wordToAnalyze = selectedWord?.word || todayWord?.word || '';
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
        await updateWordProgress(resultData.accuracy);
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

  const updateWordProgress = async (accuracy: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !selectedWord) return;

      const timestamp = new Date().toISOString();
      const isCompleted = accuracy >= 0.8;
      const xpEarned = Math.round(accuracy * 10);

      const wordId = selectedWord.id;
      const difficulty = selectedWord.difficulty;
      const currentProgress = wordProgress[wordId];

      const newAttempts = (currentProgress?.attempts || 0) + 1;
      const newBestScore = Math.max(currentProgress?.bestScore || 0, accuracy);

      const updatedProgress: WordProgress = {
        wordId: wordId,
        word: selectedWord.word,
        completed: isCompleted || (currentProgress?.completed || false),
        attempts: newAttempts,
        bestScore: newBestScore,
        lastAttempted: timestamp,
      };

      const wordRef = ref(database, `users/${user.uid}/practiceWords/${difficulty}/${wordId}`);
      await set(wordRef, updatedProgress);

      setWordProgress(prev => ({ ...prev, [wordId]: updatedProgress }));

      // Celebrate completion with animation
      if (isCompleted && !currentProgress?.completed) {
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

          const glowAnim = glowAnims[wordId];
          if (glowAnim) {
            Animated.loop(
              Animated.sequence([
                Animated.timing(glowAnim, {
                  toValue: 1,
                  duration: 1500,
                  useNativeDriver: false,
                }),
                Animated.timing(glowAnim, {
                  toValue: 0,
                  duration: 1500,
                  useNativeDriver: false,
                }),
              ])
            ).start();
          }
        }
      }

      // Update stats
      const newXP = stats.xp + xpEarned;
      const newTotalWords = isCompleted ? stats.totalWords + 1 : stats.totalWords;
      setStats(prev => ({ ...prev, xp: newXP, totalWords: newTotalWords }));
      const statsRef = ref(database, `users/${user.uid}/stats`);
      await set(statsRef, { ...stats, xp: newXP, totalWords: newTotalWords });

      // Check if batch is complete
      if (isCompleted) {
        calculateBatchCompletion(batchWords);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
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

  const getNextUnlockedIndex = () => {
    // Unlock next word after practicing current word at least once (attempts > 0)
    const practicedCount = batchWords.filter(word => wordProgress[word.id]?.attempts > 0).length;
    return practicedCount;
  };

  const getPathPositions = () => {
    const positions: { x: number; y: number; word: Word; index: number; }[] = [];
    const pathWidth = width - 100;
    const centerX = width / 2;
    const verticalSpacing = 140;
    
    batchWords.forEach((word, index) => {
      const wave = Math.sin(index * 0.8) * (pathWidth * 0.35);
      
      let x = centerX + wave + (Math.random() * 20 - 10);
      const y = 80 + (index * verticalSpacing);
      
      x = Math.max(60, Math.min(width - 60, x));
      
      positions.push({ x, y, word, index });
    });
    
    return positions;
  };

  const shouldShowMilestone = (index: number) => {
    return (index + 1) % 5 === 0 && index > 0;
  };

  const getProgressStats = (upToIndex: number) => {
    let completed = 0;
    let totalScore = 0;
    
    for (let i = 0; i <= upToIndex; i++) {
      const word = batchWords[i];
      const progress = wordProgress[word?.id];
      if (progress?.completed) {
        completed++;
        totalScore += progress.bestScore || 0;
      }
    }
    
    const accuracy = completed > 0 ? Math.round((totalScore / completed) * 100) : 0;
    return { completed, total: upToIndex + 1, accuracy };
  };

  const renderWordChain = () => {
    const unlockedIndex = getNextUnlockedIndex();
    const positions = getPathPositions();

    return (
      <>
        {positions.map((pos, index) => {
          const { word, x, y } = pos;
          const progress = wordProgress[word.id];
          const isUnlocked = index <= unlockedIndex;
          const isCompleted = progress?.completed || false;
          const isCurrent = index === unlockedIndex && !isCompleted;
          
          const nodeAnim = wordNodeAnims[word.id] || new Animated.Value(1);
          const glowAnim = glowAnims[word.id] || new Animated.Value(0);

          const glowColor = glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: ['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.4)']
          });

          const scale = nodeAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 1]
          });

          const opacity = nodeAnim;

          const nextPos = positions[index + 1];
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
              {pathPoints && (
                <View
                  style={[
                    styles.connectingPath,
                    {
                      position: 'absolute',
                      left: pathPoints.startX,
                      top: pathPoints.startY,
                      width: pathPoints.width,
                      height: 8,
                      transform: [
                        { translateY: -4 },
                        { rotate: `${pathPoints.angle}deg` }
                      ],
                    }
                  ]}
                >
                  <LinearGradient
                    colors={
                      progress?.attempts > 0
                        ? [COLORS.warning, '#D97706'] as const  // Yellow for practiced words
                        : [COLORS.gray[300], COLORS.gray[200]] as const
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.pathGradient}
                  />
                  
                  {progress?.attempts > 0 && (
                    <View style={styles.pathDotsContainer}>
                      {[0.25, 0.5, 0.75].map((position, i) => (
                        <Animated.View
                          key={i}
                          style={[
                            styles.pathDotMoving,
                            {
                              left: `${position * 100}%`,
                              backgroundColor: COLORS.warning,
                              opacity: glowAnim,
                            }
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              )}

              <Animated.View 
                style={[
                  styles.wordNode,
                  { 
                    left: x - 40,
                    top: y - 40,
                    opacity: opacity,
                    transform: [{ scale: scale }]
                  }
                ]}
              >
                {(isCompleted || isCurrent) && (
                  <Animated.View
                    style={[
                      styles.wordGlow,
                      { backgroundColor: glowColor }
                    ]}
                  />
                )}

                <TouchableOpacity
                  style={styles.wordCircleButton}
                  onPress={() => {
                    if (isUnlocked) {
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
                      openPracticeModal(word);
                    }
                  }}
                  disabled={!isUnlocked}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      isCompleted 
                        ? DIFFICULTY_COLORS[selectedDifficulty].gradient
                        : isCurrent 
                        ? [COLORS.primary, COLORS.secondary] as const
                        : isUnlocked
                        ? [COLORS.white, COLORS.gray[50]] as const
                        : [COLORS.gray[200], COLORS.gray[300]] as const
                    }
                    style={styles.circleGradient}
                  >
                    {progress?.attempts > 0 ? (
                      // Show pie-chart progress circle for practiced words
                      <View style={styles.progressCircleContainer}>
                        <ProgressCircle
                          size={70}
                          accuracy={progress.bestScore}
                          strokeWidth={8}
                          showPercentage={true}
                        />
                        {isCompleted && progress.bestScore >= 0.95 && (
                          <View style={styles.perfectStar}>
                            <Icon name="stars" size={20} color={COLORS.gold} />
                          </View>
                        )}
                      </View>
                    ) : isCurrent ? (
                      <Animated.View style={{ transform: [{ rotate: '0deg' }] }}>
                        <Icon name="star" size={36} color={COLORS.white} />
                      </Animated.View>
                    ) : !isUnlocked ? (
                      <Icon name="lock" size={28} color={COLORS.gray[400]} />
                    ) : (
                      <View style={styles.wordPreview}>
                        <Icon name="play-circle-filled" size={32} color={COLORS.primary} />
                      </View>
                    )}
                  </LinearGradient>
                  
                  {progress?.attempts > 0 && !isCompleted && progress?.bestScore && progress.bestScore > 0 && (
                    <Animated.View style={[styles.scoreLabel, { opacity: 1 }]}>
                      <LinearGradient
                        colors={['#FFFFFF', '#F8FAFC'] as const}
                        style={styles.scoreLabelGradient}
                      >
                        <Icon name="stars" size={10} color={COLORS.gold} />
                        <Text style={styles.scoreLabelText}>
                          {progress.attempts} {progress.attempts === 1 ? 'try' : 'tries'}
                        </Text>
                      </LinearGradient>
                    </Animated.View>
                  )}
                </TouchableOpacity>

                {isUnlocked && (
                  <Animated.View 
                    style={[
                      styles.wordLabelBelow,
                      { opacity: nodeAnim }
                    ]}
                  >
                    <LinearGradient
                      colors={
                        isCompleted
                          ? [DIFFICULTY_COLORS[selectedDifficulty].primary + '20', DIFFICULTY_COLORS[selectedDifficulty].primary + '10'] as const
                          : [COLORS.white, COLORS.gray[50]] as const
                      }
                      style={styles.wordLabelGradient}
                    >
                      <Text style={[
                        styles.wordLabelText,
                        { color: isCompleted ? DIFFICULTY_COLORS[selectedDifficulty].primary : COLORS.gray[800] }
                      ]}>{word.word}</Text>
                      {isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>NEW</Text>
                        </View>
                      )}
                    </LinearGradient>
                  </Animated.View>
                )}
              </Animated.View>

              {shouldShowMilestone(index) && isUnlocked && (
                <Animated.View
                  style={[
                    styles.milestoneMarker,
                    {
                      left: x - 70,
                      top: y + 60,
                      opacity: nodeAnim,
                    }
                  ]}
                >
                  <LinearGradient
                    colors={[COLORS.tertiary, '#DB2777'] as const}
                    style={styles.milestoneGradient}
                  >
                    <View style={styles.milestoneIcon}>
                      <Icon name="emoji-events" size={28} color={COLORS.gold} />
                    </View>
                    <View style={styles.milestoneInfo}>
                      <Text style={styles.milestoneTitle}>Milestone!</Text>
                      <Text style={styles.milestoneText}>
                        {getProgressStats(index).completed}/{getProgressStats(index).total} completed
                      </Text>
                      {getProgressStats(index).accuracy > 0 && (
                        <View style={styles.milestoneAccuracy}>
                          <Icon name="show-chart" size={14} color={COLORS.white} />
                          <Text style={styles.milestoneAccuracyText}>
                            {getProgressStats(index).accuracy}% avg
                          </Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                </Animated.View>
              )}
            </View>
          );
        })}
      </>
    );
  };

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <View style={styles.container}>
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

      {/* BATCH PROGRESS INDICATOR */}
      {currentBatch && (
        <View style={styles.batchProgressContainer}>
          <View style={styles.batchProgressHeader}>
            <View style={styles.batchInfo}>
              <Icon name="collections-bookmark" size={20} color={COLORS.primary} />
              <Text style={styles.batchTitle}>Batch {currentBatchNumber + 1}</Text>
            </View>
            <Text style={styles.batchCompletion}>{batchCompletionPercent}%</Text>
          </View>
          <View style={styles.batchProgressBar}>
            <Animated.View 
              style={[
                styles.batchProgressFill,
                { width: `${batchCompletionPercent}%` }
              ]}
            >
              <LinearGradient
                colors={DIFFICULTY_COLORS[selectedDifficulty].gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.batchProgressGradient}
              />
            </Animated.View>
          </View>
          <Text style={styles.batchProgressText}>
            {batchWords.filter(w => wordProgress[w.id]?.completed).length} / {batchWords.length} words completed
          </Text>
        </View>
      )}

      {isLoadingBatch ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading batch...</Text>
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
            {renderWordChain()}
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
                    openPracticeModal(todayWord, true);
                  }}
                >
                  <LinearGradient
                    colors={[COLORS.primary, COLORS.secondary] as const}
                    style={styles.startDailyGradient}
                  >
                    <Text style={styles.startDailyText}>
                      {todayProgress?.completed ? 'Practice Again' : 'Start Challenge'}
                    </Text>
                    <Icon name="arrow-forward" size={20} color={COLORS.white} />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
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
            </Animated.View>
          </View>
        </Modal>
      )}
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
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerTop: {
    marginBottom: 16,
  },
  userName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.gray[800],
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  badgeInfo: {
    flex: 1,
  },
  badgeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.white,
    lineHeight: 20,
  },
  badgeLabel: {
    fontSize: 10,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  dropdownMenu: {
    position: 'absolute',
    top: 50,
    left: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 160,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownItemActive: {
    backgroundColor: COLORS.gray[50],
  },
  difficultyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
  // NEW: Batch Progress Styles
  batchProgressContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  batchProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[800],
  },
  batchCompletion: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
  },
  batchProgressBar: {
    height: 12,
    backgroundColor: COLORS.gray[200],
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  batchProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
  batchProgressGradient: {
    flex: 1,
  },
  batchProgressText: {
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
    minHeight: height * 1.5,
    paddingTop: 20,
  },
  connectingPath: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 1,
  },
  pathGradient: {
    flex: 1,
    borderRadius: 4,
  },
  pathDotsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  pathDotMoving: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
  wordNode: {
    position: 'absolute',
    width: 80,
    height: 80,
    zIndex: 10,
  },
  wordGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    left: -10,
    top: -10,
  },
  wordCircleButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  circleGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  completedIcon: {
    position: 'relative',
  },
  progressCircleContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfectStar: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordPreview: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreLabel: {
    position: 'absolute',
    bottom: -12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scoreLabelGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  scoreLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.gray[800],
  },
  wordLabelBelow: {
    position: 'absolute',
    top: 90,
    left: '50%',
    transform: [{ translateX: -60 }],
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    minWidth: 120,
  },
  wordLabelGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  wordLabelText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  currentBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  milestoneMarker: {
    position: 'absolute',
    width: 140,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.tertiary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  milestoneGradient: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  milestoneIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  milestoneText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 4,
  },
  milestoneAccuracy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  milestoneAccuracyText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
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
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: height * 0.9,
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
    backgroundColor: COLORS.gray[50],
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
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
    backgroundColor: COLORS.gray[50],
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
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
});