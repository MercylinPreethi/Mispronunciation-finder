// app/(tabs)/index.tsx
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
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption
} from 'react-native-audio-recorder-player';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';

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

// Difficulty color mappings
const DIFFICULTY_COLORS = {
  easy: { primary: '#10B981', gradient: ['#10B981', '#059669'] as const },
  intermediate: { primary: '#F59E0B', gradient: ['#F59E0B', '#D97706'] as const },
  hard: { primary: '#EF4444', gradient: ['#EF4444', '#DC2626'] as const },
} as const;

// Daily word pool
const DAILY_WORDS = [
  { 
    word: 'Beautiful', 
    phonetic: '/ˈbjuːtɪfəl/', 
    meaning: 'Pleasing to the senses or mind aesthetically',
    example: 'The sunset was absolutely beautiful.',
    tip: 'Stress on first syllable: BEAU-ti-ful'
  },
  { 
    word: 'Pronunciation', 
    phonetic: '/prəˌnʌnsiˈeɪʃən/', 
    meaning: 'The way in which a word is pronounced',
    example: 'Her pronunciation of French words is excellent.',
    tip: 'Watch the "nun-see-AY-shun" pattern'
  },
  { 
    word: 'Schedule', 
    phonetic: '/ˈʃedjuːl/', 
    meaning: 'A plan for carrying out a process or procedure',
    example: 'I need to check my schedule for tomorrow.',
    tip: 'UK: SHED-yool, US: SKED-yool'
  },
];

// Word database - will be expanded dynamically
const WORD_DATABASE = {
  easy: [
    { id: 'e1', word: 'Cat', phonetic: '/kæt/', meaning: 'A small domesticated carnivorous mammal', example: 'The cat is sleeping.', tip: 'Short "a" sound', difficulty: 'easy' },
    { id: 'e2', word: 'Dog', phonetic: '/dɔɡ/', meaning: 'A domesticated carnivorous mammal', example: 'My dog loves to play.', tip: 'Short "o" sound', difficulty: 'easy' },
    { id: 'e3', word: 'Book', phonetic: '/bʊk/', meaning: 'A written or printed work', example: 'I read a book every night.', tip: 'Short "oo" sound', difficulty: 'easy' },
    { id: 'e4', word: 'Water', phonetic: '/ˈwɔːtər/', meaning: 'A clear liquid essential for life', example: 'Drink plenty of water.', tip: 'Two syllables: WA-ter', difficulty: 'easy' },
    { id: 'e5', word: 'Hello', phonetic: '/həˈloʊ/', meaning: 'Used as a greeting', example: 'Hello, how are you?', tip: 'Stress on second syllable', difficulty: 'easy' },
    { id: 'e6', word: 'Thank', phonetic: '/θæŋk/', meaning: 'Express gratitude to someone', example: 'Thank you for your help.', tip: 'Soft "th" sound', difficulty: 'easy' },
    { id: 'e7', word: 'Please', phonetic: '/pliːz/', meaning: 'Used in polite requests', example: 'Please close the door.', tip: 'Long "ee" sound', difficulty: 'easy' },
    { id: 'e8', word: 'Happy', phonetic: '/ˈhæpi/', meaning: 'Feeling or showing pleasure', example: 'I am happy today.', tip: 'Stress on first syllable', difficulty: 'easy' },
    { id: 'e9', word: 'House', phonetic: '/haʊs/', meaning: 'A building for human habitation', example: 'They bought a new house.', tip: 'Diphthong "ou"', difficulty: 'easy' },
    { id: 'e10', word: 'Friend', phonetic: '/frend/', meaning: 'A person with whom one has a bond', example: 'She is my best friend.', tip: 'Silent "i"', difficulty: 'easy' },
    { id: 'e11', word: 'Good', phonetic: '/ɡʊd/', meaning: 'Of high quality', example: 'That was a good meal.', tip: 'Short "oo" sound', difficulty: 'easy' },
    { id: 'e12', word: 'Time', phonetic: '/taɪm/', meaning: 'The indefinite continued progress of existence', example: 'What time is it?', tip: 'Long "i" sound', difficulty: 'easy' },
  ],
  intermediate: [
    { id: 'i1', word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', meaning: 'Providing physical ease and relaxation', example: 'This chair is very comfortable.', tip: 'Often said as COMF-ta-ble', difficulty: 'intermediate' },
    { id: 'i2', word: 'Develop', phonetic: '/dɪˈveləp/', meaning: 'Grow or cause to grow', example: 'We need to develop new skills.', tip: 'Stress on second syllable', difficulty: 'intermediate' },
    { id: 'i3', word: 'Chocolate', phonetic: '/ˈtʃɒklət/', meaning: 'A sweet food made from cacao', example: 'I love dark chocolate.', tip: 'Two syllables: CHOK-let', difficulty: 'intermediate' },
    { id: 'i4', word: 'Queue', phonetic: '/kjuː/', meaning: 'A line of people waiting', example: 'There is a long queue at the store.', tip: 'Just sounds like "Q"', difficulty: 'intermediate' },
    { id: 'i5', word: 'Receipt', phonetic: '/rɪˈsiːt/', meaning: 'A written acknowledgment of payment', example: 'Keep the receipt for returns.', tip: 'Silent "p"', difficulty: 'intermediate' },
    { id: 'i6', word: 'Island', phonetic: '/ˈaɪlənd/', meaning: 'A piece of land surrounded by water', example: 'They live on a tropical island.', tip: 'Silent "s"', difficulty: 'intermediate' },
    { id: 'i7', word: 'Choir', phonetic: '/ˈkwaɪər/', meaning: 'An organized group of singers', example: 'She sings in the church choir.', tip: 'Sounds like "quire"', difficulty: 'intermediate' },
    { id: 'i8', word: 'Knight', phonetic: '/naɪt/', meaning: 'A medieval warrior', example: 'The knight rode a horse.', tip: 'Silent "k" and "gh"', difficulty: 'intermediate' },
    { id: 'i9', word: 'Language', phonetic: '/ˈlæŋɡwɪdʒ/', meaning: 'Method of human communication', example: 'She speaks three languages.', tip: 'Stress on first syllable', difficulty: 'intermediate' },
    { id: 'i10', word: 'Business', phonetic: '/ˈbɪznəs/', meaning: 'Commercial activity', example: 'He runs a small business.', tip: 'BIZ-ness, not BIZ-ee-ness', difficulty: 'intermediate' },
  ],
  hard: [
    { id: 'h1', word: 'Epitome', phonetic: '/ɪˈpɪtəmi/', meaning: 'A perfect example of something', example: 'She is the epitome of elegance.', tip: 'Not "EPI-tome", say "e-PIT-o-me"', difficulty: 'hard' },
    { id: 'h2', word: 'Worcestershire', phonetic: '/ˈwʊstərʃər/', meaning: 'A fermented liquid condiment', example: 'Add Worcestershire sauce to the recipe.', tip: 'WOOS-ter-shur', difficulty: 'hard' },
    { id: 'h3', word: 'Squirrel', phonetic: '/ˈskwɜːrəl/', meaning: 'A small rodent with a bushy tail', example: 'A squirrel climbed the tree.', tip: 'SKWIR-rel with rolled R', difficulty: 'hard' },
    { id: 'h4', word: 'Rural', phonetic: '/ˈrʊərəl/', meaning: 'Relating to the countryside', example: 'They moved to a rural area.', tip: 'Two syllables with rolling R', difficulty: 'hard' },
    { id: 'h5', word: 'Phenomenal', phonetic: '/fəˈnɒmɪnəl/', meaning: 'Very remarkable or extraordinary', example: 'Her performance was phenomenal.', tip: 'fe-NOM-i-nal', difficulty: 'hard' },
    { id: 'h6', word: 'Brewery', phonetic: '/ˈbruːəri/', meaning: 'A place where beer is made', example: 'We toured the local brewery.', tip: 'BREW-er-y, three syllables', difficulty: 'hard' },
    { id: 'h7', word: 'Colonel', phonetic: '/ˈkɜːrnəl/', meaning: 'A military rank', example: 'The colonel gave orders.', tip: 'Sounds like "kernel"', difficulty: 'hard' },
    { id: 'h8', word: 'Mischievous', phonetic: '/ˈmɪstʃɪvəs/', meaning: 'Playfully troublesome', example: 'The child gave a mischievous grin.', tip: 'MIS-chi-vous, three syllables', difficulty: 'hard' },
  ],
};

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

export default function HomeScreen() {
  const [userName, setUserName] = useState('');
  const [stats, setStats] = useState<UserStats>({
    streak: 0,
    totalWords: 0,
    accuracy: 0,
    xp: 0,
  });
  
  const [todayWord, setTodayWord] = useState(DAILY_WORDS[0]);
  const [todayProgress, setTodayProgress] = useState<DailyWordProgress | null>(null);
  
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>('easy');
  const [wordProgress, setWordProgress] = useState<{ [key: string]: WordProgress }>({});
  const [currentWords, setCurrentWords] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDailyTask, setShowDailyTask] = useState(false);
  
  const [selectedWord, setSelectedWord] = useState<any>(null);
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
  const badgeAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const dailyTaskPulse = useRef(new Animated.Value(1)).current;
  const wordNodeAnims = useRef<{ [key: string]: Animated.Value }>({}).current;
  const glowAnims = useRef<{ [key: string]: Animated.Value }>({}).current;

  const getTodayWordIndex = () => {
    const today = new Date();
    const startDate = new Date('2024-01-01');
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceStart % DAILY_WORDS.length;
  };

  const getTodayDateString = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

      const todayDate = getTodayDateString();
      const wordIndex = getTodayWordIndex();
      const dailyWord = DAILY_WORDS[wordIndex];
      setTodayWord(dailyWord);

      const progressRef = ref(database, `users/${userId}/dailyWords/${todayDate}`);
      const snapshot = await get(progressRef);
      
      if (snapshot.exists()) {
        setTodayProgress(snapshot.val());
      } else {
        const newProgress: DailyWordProgress = {
          word: dailyWord.word,
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
  }, [calculateStatsFromHistory]);

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
      updateCurrentWords(selectedDifficulty, allProgress);
    } catch (error) {
      console.error('Error loading practice progress:', error);
    }
  };

  const updateCurrentWords = (difficulty: DifficultyLevel, progress: { [key: string]: WordProgress }) => {
    const words = WORD_DATABASE[difficulty];
    setCurrentWords(words);
    
    // Initialize animations for each word
    words.forEach((word, index) => {
      if (!wordNodeAnims[word.id]) {
        wordNodeAnims[word.id] = new Animated.Value(0);
        glowAnims[word.id] = new Animated.Value(0);
      }
      
      // Stagger entrance animations
      Animated.spring(wordNodeAnims[word.id], {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: index * 80,
        useNativeDriver: true,
      }).start();
      
      // Animate glow for completed and current words
      const wordProgress = progress[word.id];
      if (wordProgress?.completed) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnims[word.id], {
              toValue: 1,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnims[word.id], {
              toValue: 0,
              duration: 1500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      }
    });
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      loadUserData(user.uid);
    }

    // Badge animations
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
  }, [loadUserData]);

  useEffect(() => {
    updateCurrentWords(selectedDifficulty, wordProgress);
  }, [selectedDifficulty, wordProgress]);

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

  const handleDifficultyChange = (difficulty: DifficultyLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedDifficulty(difficulty);
    setShowDropdown(false);
  };

  const openPracticeModal = (word: any, isDaily: boolean = false) => {
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
      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: AVEncodingOption.lpcm,
      };
      
      await audioRecorderPlayer.startRecorder(path, audioSet);
      recordingPathRef.current = path;
      
      audioRecorderPlayer.addRecordBackListener((e) => {
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
      
      const wordToAnalyze = selectedWord?.word || todayWord.word;
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
      if (!user) return;

      const timestamp = new Date().toISOString();
      const isCompleted = accuracy >= 0.8;
      const xpEarned = Math.round(accuracy * 10);

      if (selectedWord?.id) {
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
            // Bounce animation
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

            // Start glow animation
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
      }

      // Update stats
      const newXP = stats.xp + xpEarned;
      const newTotalWords = isCompleted ? stats.totalWords + 1 : stats.totalWords;
      setStats(prev => ({ ...prev, xp: newXP, totalWords: newTotalWords }));
      const statsRef = ref(database, `users/${user.uid}/stats`);
      await set(statsRef, { ...stats, xp: newXP, totalWords: newTotalWords });
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
        
        audioRecorderPlayer.addPlayBackListener((e) => {
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
    const completedCount = currentWords.filter(word => wordProgress[word.id]?.completed).length;
    return completedCount;
  };

  const renderWordChain = () => {
    const unlockedIndex = getNextUnlockedIndex();

    return currentWords.map((word, index) => {
      const progress = wordProgress[word.id];
      const isUnlocked = index <= unlockedIndex;
      const isCompleted = progress?.completed || false;
      const isCurrent = index === unlockedIndex && !isCompleted;
      
      // Zigzag pattern
      const isLeft = index % 2 === 0;
      const topOffset = index * 140;

      // Get animations
      const nodeAnim = wordNodeAnims[word.id] || new Animated.Value(1);
      const glowAnim = glowAnims[word.id] || new Animated.Value(0);

      // Animated glow effect
      const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(99, 102, 241, 0)', 'rgba(99, 102, 241, 0.4)']
      });

      // Scale animation for entrance
      const scale = nodeAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 1]
      });

      const opacity = nodeAnim;

      return (
        <Animated.View 
          key={word.id} 
          style={[
            styles.wordNodeContainer, 
            { 
              top: topOffset,
              opacity: opacity,
              transform: [{ scale: scale }]
            }
          ]}
        >
          {/* Animated Connecting Path */}
          {index < currentWords.length - 1 && (
            <View style={styles.pathLineContainer}>
              <LinearGradient
                colors={
                  isCompleted 
                    ? [DIFFICULTY_COLORS[selectedDifficulty].primary, DIFFICULTY_COLORS[selectedDifficulty].primary + '80'] as const
                    : [COLORS.gray[300], COLORS.gray[200]] as const
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={[
                  styles.pathLine,
                  { left: isLeft ? 60 : width - 60 }
                ]}
              />
              {isCompleted && (
                <View style={[
                  styles.pathDots,
                  { left: isLeft ? 58 : width - 62 }
                ]}>
                  {[0, 1, 2].map((i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.pathDot,
                        {
                          backgroundColor: DIFFICULTY_COLORS[selectedDifficulty].primary,
                          opacity: glowAnim,
                        }
                      ]}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Glow Effect */}
          {(isCompleted || isCurrent) && (
            <Animated.View
              style={[
                styles.wordGlow,
                { 
                  left: isLeft ? 10 : width - 110,
                  backgroundColor: glowColor,
                }
              ]}
            />
          )}

          {/* Word Circle */}
          <TouchableOpacity
            style={[
              styles.wordCircle,
              { left: isLeft ? 20 : width - 100 }
            ]}
            onPress={() => {
              if (isUnlocked) {
                // Bounce animation on press
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
              {isCompleted ? (
                <View style={styles.completedIcon}>
                  <Icon name="check-circle" size={36} color={COLORS.white} />
                  {progress?.bestScore && progress.bestScore >= 0.95 && (
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
            
            {progress?.bestScore && progress.bestScore > 0 && (
              <Animated.View style={[styles.scoreLabel, { opacity: glowAnim }]}>
                <LinearGradient
                  colors={['#FFFFFF', '#F8FAFC'] as const}
                  style={styles.scoreLabelGradient}
                >
                  <Icon name="stars" size={10} color={COLORS.gold} />
                  <Text style={styles.scoreLabelText}>{Math.round(progress.bestScore * 100)}%</Text>
                </LinearGradient>
              </Animated.View>
            )}
          </TouchableOpacity>

          {/* Word Label with Animation */}
          {isUnlocked && (
            <Animated.View 
              style={[
                styles.wordLabel,
                { 
                  left: isLeft ? 100 : 20,
                  opacity: nodeAnim,
                }
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
      );
    });
  };

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.userName}>Hi, {userName}! 👋</Text>
        </View>

        {/* Badges */}
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

      {/* Controls */}
      <View style={styles.controls}>
        {/* Difficulty Dropdown */}
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

        {/* Daily Task */}
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

      {/* Word Chain */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pathContainer}>
          {renderWordChain()}
          
          {/* Load More Indicator */}
          <View style={styles.loadMoreContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.loadMoreText}>Loading more words...</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Daily Task Modal */}
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

      {/* Practice Modal */}
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
                    <Text style={styles.modalWord}>{selectedWord?.word}</Text>
                    <Text style={styles.modalPhonetic}>{selectedWord?.phonetic}</Text>
                  </View>

                  <View style={styles.modalMeaning}>
                    <Icon name="book" size={20} color={COLORS.primary} />
                    <Text style={styles.modalMeaningText}>{selectedWord?.meaning}</Text>
                  </View>

                  <View style={styles.modalExample}>
                    <Icon name="format-quote" size={20} color={COLORS.gray[500]} />
                    <Text style={styles.modalExampleText}>{selectedWord?.example}</Text>
                  </View>

                  <View style={styles.modalTip}>
                    <Icon name="lightbulb-outline" size={20} color={COLORS.gold} />
                    <Text style={styles.modalTipText}>{selectedWord?.tip}</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.modalListenButton}
                    onPress={() => playWordPronunciation(selectedWord?.word)}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
  },
  pathContainer: {
    position: 'relative',
    minHeight: height * 2,
  },
  wordNodeContainer: {
    position: 'absolute',
    width: '100%',
    height: 120,
  },
  pathLineContainer: {
    position: 'absolute',
    width: '100%',
    height: 140,
    top: 80,
  },
  pathLine: {
    position: 'absolute',
    width: 6,
    height: 140,
    borderRadius: 3,
  },
  pathDots: {
    position: 'absolute',
    height: 140,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  pathDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wordGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: -10,
  },
  wordCircle: {
    position: 'absolute',
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
  wordText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.gray[700],
    textAlign: 'center',
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
  wordLabel: {
    position: 'absolute',
    top: 25,
    borderRadius: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  wordLabelGradient: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  loadMoreContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray[500],
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
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[600],
    marginTop: 8,
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
