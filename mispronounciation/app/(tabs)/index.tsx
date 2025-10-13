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

// Material Design 3 Color Scheme (matching other tabs)
const DIFFICULTY_COLORS = {
  easy: {
    primary: '#10B981',
    dark: '#059669',
    light: '#34D399',
    gradient: ['#10B981', '#059669'],
  },
  intermediate: {
    primary: '#6366F1',
    dark: '#4F46E5',
    light: '#818CF8',
    gradient: ['#6366F1', '#8B5CF6'],
  },
  hard: {
    primary: '#EC4899',
    dark: '#DB2777',
    light: '#F472B6',
    gradient: ['#EC4899', '#DB2777'],
  },
};

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
  { 
    word: 'Algorithm', 
    phonetic: '/ˈælɡərɪðəm/', 
    meaning: 'A process or set of rules to be followed in calculations',
    example: 'The algorithm sorts data efficiently.',
    tip: 'Stress on first syllable: AL-go-rith-m'
  },
  { 
    word: 'Wednesday', 
    phonetic: '/ˈwenzdeɪ/', 
    meaning: 'The day of the week after Tuesday and before Thursday',
    example: 'We have a meeting every Wednesday.',
    tip: 'Silent "d": WENZ-day'
  },
];

// Easy Level Words
const EASY_WORDS = [
  { id: 'e1', word: 'Cat', phonetic: '/kæt/', meaning: 'A small domesticated carnivorous mammal', example: 'The cat is sleeping.', tip: 'Short "a" sound' },
  { id: 'e2', word: 'Dog', phonetic: '/dɔɡ/', meaning: 'A domesticated carnivorous mammal', example: 'My dog loves to play.', tip: 'Short "o" sound' },
  { id: 'e3', word: 'Book', phonetic: '/bʊk/', meaning: 'A written or printed work', example: 'I read a book every night.', tip: 'Short "oo" sound' },
  { id: 'e4', word: 'Water', phonetic: '/ˈwɔːtər/', meaning: 'A clear liquid essential for life', example: 'Drink plenty of water.', tip: 'Two syllables: WA-ter' },
  { id: 'e5', word: 'Hello', phonetic: '/həˈloʊ/', meaning: 'Used as a greeting', example: 'Hello, how are you?', tip: 'Stress on second syllable' },
  { id: 'e6', word: 'Thank', phonetic: '/θæŋk/', meaning: 'Express gratitude to someone', example: 'Thank you for your help.', tip: 'Soft "th" sound' },
  { id: 'e7', word: 'Please', phonetic: '/pliːz/', meaning: 'Used in polite requests', example: 'Please close the door.', tip: 'Long "ee" sound' },
  { id: 'e8', word: 'Happy', phonetic: '/ˈhæpi/', meaning: 'Feeling or showing pleasure', example: 'I am happy today.', tip: 'Stress on first syllable' },
  { id: 'e9', word: 'House', phonetic: '/haʊs/', meaning: 'A building for human habitation', example: 'They bought a new house.', tip: 'Diphthong "ou"' },
  { id: 'e10', word: 'Friend', phonetic: '/frend/', meaning: 'A person with whom one has a bond', example: 'She is my best friend.', tip: 'Silent "i"' },
];

// Intermediate Level Words
const INTERMEDIATE_WORDS = [
  { id: 'i1', word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', meaning: 'Providing physical ease and relaxation', example: 'This chair is very comfortable.', tip: 'Often said as COMF-ta-ble' },
  { id: 'i2', word: 'Develop', phonetic: '/dɪˈveləp/', meaning: 'Grow or cause to grow', example: 'We need to develop new skills.', tip: 'Stress on second syllable' },
  { id: 'i3', word: 'Chocolate', phonetic: '/ˈtʃɒklət/', meaning: 'A sweet food made from cacao', example: 'I love dark chocolate.', tip: 'Two syllables: CHOK-let' },
  { id: 'i4', word: 'Queue', phonetic: '/kjuː/', meaning: 'A line of people waiting', example: 'There is a long queue at the store.', tip: 'Just sounds like "Q"' },
  { id: 'i5', word: 'Receipt', phonetic: '/rɪˈsiːt/', meaning: 'A written acknowledgment of payment', example: 'Keep the receipt for returns.', tip: 'Silent "p"' },
  { id: 'i6', word: 'Island', phonetic: '/ˈaɪlənd/', meaning: 'A piece of land surrounded by water', example: 'They live on a tropical island.', tip: 'Silent "s"' },
  { id: 'i7', word: 'Choir', phonetic: '/ˈkwaɪər/', meaning: 'An organized group of singers', example: 'She sings in the church choir.', tip: 'Sounds like "quire"' },
  { id: 'i8', word: 'Knight', phonetic: '/naɪt/', meaning: 'A medieval warrior', example: 'The knight rode a horse.', tip: 'Silent "k" and "gh"' },
];

// Hard Level Words
const HARD_WORDS = [
  { id: 'h1', word: 'Epitome', phonetic: '/ɪˈpɪtəmi/', meaning: 'A perfect example of something', example: 'She is the epitome of elegance.', tip: 'Not "EPI-tome", say "e-PIT-o-me"' },
  { id: 'h2', word: 'Worcestershire', phonetic: '/ˈwʊstərʃər/', meaning: 'A fermented liquid condiment', example: 'Add Worcestershire sauce to the recipe.', tip: 'WOOS-ter-shur' },
  { id: 'h3', word: 'Squirrel', phonetic: '/ˈskwɜːrəl/', meaning: 'A small rodent with a bushy tail', example: 'A squirrel climbed the tree.', tip: 'SKWIR-rel with rolled R' },
  { id: 'h4', word: 'Rural', phonetic: '/ˈrʊərəl/', meaning: 'Relating to the countryside', example: 'They moved to a rural area.', tip: 'Two syllables with rolling R' },
  { id: 'h5', word: 'Phenomenal', phonetic: '/fəˈnɒmɪnəl/', meaning: 'Very remarkable or extraordinary', example: 'Her performance was phenomenal.', tip: 'fe-NOM-i-nal' },
  { id: 'h6', word: 'Brewery', phonetic: '/ˈbruːəri/', meaning: 'A place where beer is made', example: 'We toured the local brewery.', tip: 'BREW-er-y, three syllables' },
];

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

type DifficultyLevel = 'easy' | 'intermediate' | 'hard' | null;

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
  
  const [easyProgress, setEasyProgress] = useState<WordProgress[]>([]);
  const [intermediateProgress, setIntermediateProgress] = useState<WordProgress[]>([]);
  const [hardProgress, setHardProgress] = useState<WordProgress[]>([]);
  
  // Level selection state
  const [selectedLevel, setSelectedLevel] = useState<DifficultyLevel>(null);
  
  const [selectedWord, setSelectedWord] = useState<any>(null);
  const [selectedWordType, setSelectedWordType] = useState<'daily' | 'easy' | 'intermediate' | 'hard'>('daily');
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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const levelTransitionAnim = useRef(new Animated.Value(0)).current;

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
      const easyRef = ref(database, `users/${userId}/practiceWords/easy`);
      const easySnapshot = await get(easyRef);
      if (easySnapshot.exists()) {
        const data = easySnapshot.val();
        const progressArray = EASY_WORDS.map(word => 
          data[word.id] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }
        );
        setEasyProgress(progressArray);
      } else {
        setEasyProgress(EASY_WORDS.map(word => ({ 
          wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
        })));
      }

      const intRef = ref(database, `users/${userId}/practiceWords/intermediate`);
      const intSnapshot = await get(intRef);
      if (intSnapshot.exists()) {
        const data = intSnapshot.val();
        const progressArray = INTERMEDIATE_WORDS.map(word => 
          data[word.id] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }
        );
        setIntermediateProgress(progressArray);
      } else {
        setIntermediateProgress(INTERMEDIATE_WORDS.map(word => ({ 
          wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
        })));
      }

      const hardRef = ref(database, `users/${userId}/practiceWords/hard`);
      const hardSnapshot = await get(hardRef);
      if (hardSnapshot.exists()) {
        const data = hardSnapshot.val();
        const progressArray = HARD_WORDS.map(word => 
          data[word.id] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }
        );
        setHardProgress(progressArray);
      } else {
        setHardProgress(HARD_WORDS.map(word => ({ 
          wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
        })));
      }
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

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [loadUserData]);

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

  const handleLevelSelect = (level: 'easy' | 'intermediate' | 'hard') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedLevel(level);
    
    Animated.spring(levelTransitionAnim, {
      toValue: 1,
      tension: 50,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleBackToLevelSelect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Animated.timing(levelTransitionAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedLevel(null);
    });
  };

  const openPracticeModal = (word: any, type: 'daily' | 'easy' | 'intermediate' | 'hard', wordData?: any) => {
    setSelectedWord(wordData || word);
    setSelectedWordType(type);
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

      if (selectedWordType === 'daily') {
        const todayDate = getTodayDateString();
        const newAttempts = (todayProgress?.attempts || 0) + 1;
        const newBestScore = Math.max(todayProgress?.bestScore || 0, accuracy);

        const updatedProgress: DailyWordProgress = {
          word: todayWord.word,
          date: todayDate,
          completed: isCompleted || (todayProgress?.completed || false),
          accuracy: accuracy,
          attempts: newAttempts,
          bestScore: newBestScore,
        };

        const progressRef = ref(database, `users/${user.uid}/dailyWords/${todayDate}`);
        await set(progressRef, updatedProgress);
        setTodayProgress(updatedProgress);

        const dailyWordsRef = ref(database, `users/${user.uid}/dailyWords`);
        const snapshot = await get(dailyWordsRef);
        if (snapshot.exists()) {
          await calculateStatsFromHistory(snapshot.val(), user.uid);
        }
      } else {
        const level = selectedWordType;
        const wordId = selectedWord.id;
        const currentProgress = 
          level === 'easy' ? easyProgress.find(p => p.wordId === wordId) :
          level === 'intermediate' ? intermediateProgress.find(p => p.wordId === wordId) :
          hardProgress.find(p => p.wordId === wordId);

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

        const wordRef = ref(database, `users/${user.uid}/practiceWords/${level}/${wordId}`);
        await set(wordRef, updatedProgress);

        if (level === 'easy') {
          setEasyProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        } else if (level === 'intermediate') {
          setIntermediateProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        } else {
          setHardProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        }
      }

      // Update XP and total words
      const newXP = stats.xp + xpEarned;
      const newTotalWords = stats.totalWords + (isCompleted ? 1 : 0);
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

  const getNextUnlockedIndex = (progressArray: WordProgress[]) => {
    const firstIncomplete = progressArray.findIndex(p => !p.completed);
    return firstIncomplete === -1 ? progressArray.length : firstIncomplete;
  };

  const getCurrentLevelData = () => {
    switch (selectedLevel) {
      case 'easy':
        return { words: EASY_WORDS, progress: easyProgress, colors: DIFFICULTY_COLORS.easy };
      case 'intermediate':
        return { words: INTERMEDIATE_WORDS, progress: intermediateProgress, colors: DIFFICULTY_COLORS.intermediate };
      case 'hard':
        return { words: HARD_WORDS, progress: hardProgress, colors: DIFFICULTY_COLORS.hard };
      default:
        return { words: [], progress: [], colors: DIFFICULTY_COLORS.easy };
    }
  };

  const renderWordPath = () => {
    const { words, progress, colors } = getCurrentLevelData();
    const unlockedIndex = getNextUnlockedIndex(progress);

    return words.map((word, index) => {
      const wordProgress = progress[index] || { 
        wordId: word.id, 
        word: word.word, 
        completed: false, 
        attempts: 0, 
        bestScore: 0, 
        lastAttempted: '' 
      };
      const isUnlocked = index <= unlockedIndex;
      const isCompleted = wordProgress.completed;
      const isCurrent = index === unlockedIndex && !isCompleted;
      const canPractice = isCompleted || isUnlocked;

      // Alternating position (left/right zigzag)
      const isLeft = index % 2 === 0;

      return (
        <View key={word.id} style={styles.pathNodeContainer}>
          {/* Connecting Line */}
          {index < words.length - 1 && (
            <View style={[
              styles.pathConnector,
              { backgroundColor: isCompleted ? colors.primary : COLORS.gray[300] }
            ]} />
          )}
          
          {/* Word Node */}
          <TouchableOpacity
            style={[
              styles.wordNodeWrapper,
              { alignSelf: isLeft ? 'flex-start' : 'flex-end' }
            ]}
            onPress={() => canPractice ? openPracticeModal(word, selectedLevel!, word) : null}
            disabled={!canPractice}
            activeOpacity={0.8}
          >
            <Animated.View style={[
              styles.wordNode,
              isCompleted && { 
                borderColor: colors.primary,
                backgroundColor: colors.light + '20',
              },
              isCurrent && {
                borderColor: colors.primary,
                shadowColor: colors.primary,
                shadowOpacity: 0.4,
              },
              !isUnlocked && {
                borderColor: COLORS.gray[300],
                backgroundColor: COLORS.gray[100],
              }
            ]}>
              {/* Node Icon */}
              <View style={styles.nodeIconContainer}>
                {isCompleted ? (
                  <LinearGradient
                    colors={colors.gradient}
                    style={styles.nodeIconGradient}
                  >
                    <Icon name="check-circle" size={40} color={COLORS.white} />
                  </LinearGradient>
                ) : isCurrent ? (
                  <LinearGradient
                    colors={colors.gradient}
                    style={styles.nodeIconGradient}
                  >
                    <Icon name="star" size={40} color={COLORS.white} />
                  </LinearGradient>
                ) : !isUnlocked ? (
                  <View style={styles.nodeIconLocked}>
                    <Icon name="lock" size={32} color={COLORS.gray[400]} />
                  </View>
                ) : (
                  <LinearGradient
                    colors={colors.gradient}
                    style={styles.nodeIconGradient}
                  >
                    <Icon name="play-circle-filled" size={40} color={COLORS.white} />
                  </LinearGradient>
                )}
              </View>

              {/* Word Info */}
              {canPractice && (
                <View style={styles.nodeInfo}>
                  <Text style={[
                    styles.nodeWord,
                    { color: isCompleted ? colors.dark : isCurrent ? colors.primary : COLORS.gray[700] }
                  ]}>{word.word}</Text>
                  {isCompleted && wordProgress.bestScore > 0 && (
                    <View style={[styles.scoreChip, { backgroundColor: colors.light + '40' }]}>
                      <Icon name="stars" size={14} color={colors.dark} />
                      <Text style={[styles.scoreText, { color: colors.dark }]}>
                        {Math.round(wordProgress.bestScore * 100)}%
                      </Text>
                    </View>
                  )}
                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.currentText}>START</Text>
                    </View>
                  )}
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
        </View>
      );
    });
  };

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const levelOpacity = levelTransitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const levelScale = levelTransitionAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const getLevelStats = (level: 'easy' | 'intermediate' | 'hard') => {
    const progressMap = {
      easy: easyProgress,
      intermediate: intermediateProgress,
      hard: hardProgress,
    };
    const wordsMap = {
      easy: EASY_WORDS,
      intermediate: INTERMEDIATE_WORDS,
      hard: HARD_WORDS,
    };
    
    const progress = progressMap[level];
    const total = wordsMap[level].length;
    const completed = progress.filter(p => p.completed).length;
    
    return { completed, total };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={selectedLevel ? getCurrentLevelData().colors.gradient : [COLORS.primary, COLORS.secondary]}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {selectedLevel ? (
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBackToLevelSelect}
            >
              <Icon name="arrow-back" size={24} color={COLORS.white} />
            </TouchableOpacity>
          ) : null}
          
          <View style={styles.headerStats}>
            <View style={styles.statBadge}>
              <Icon name="check-circle" size={20} color={COLORS.gold} />
              <Text style={styles.statText}>{stats.totalWords}</Text>
            </View>
            <View style={styles.statBadge}>
              <Icon name="local-fire-department" size={20} color={COLORS.gold} />
              <Text style={styles.statText}>{stats.streak}</Text>
            </View>
            <View style={styles.statBadge}>
              <Icon name="stars" size={20} color={COLORS.gold} />
              <Text style={styles.statText}>{stats.xp}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!selectedLevel ? (
          /* Level Selection View */
          <>
            <Text style={styles.welcomeTitle}>Choose Your Level</Text>
            <Text style={styles.welcomeSubtitle}>Select a difficulty to start your learning journey</Text>

            {/* Daily Challenge */}
            <Animated.View style={[styles.dailyCardWrapper, { transform: [{ translateY: floatY }] }]}>
              <TouchableOpacity
                style={styles.dailyCard}
                onPress={() => openPracticeModal(todayWord, 'daily')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={todayProgress?.completed ? [COLORS.success, '#059669'] : [COLORS.primary, COLORS.secondary]}
                  style={styles.dailyGradient}
                >
                  <View style={styles.dailyHeader}>
                    <View style={styles.dailyBadge}>
                      <Text style={styles.dailyBadgeText}>DAILY WORD</Text>
                    </View>
                    {todayProgress?.completed && (
                      <Icon name="check-circle" size={24} color={COLORS.gold} />
                    )}
                  </View>
                  <Text style={styles.dailyWord}>{todayWord.word}</Text>
                  <Text style={styles.dailyPhonetic}>{todayWord.phonetic}</Text>
                  <View style={styles.dailyFooter}>
                    <Text style={styles.dailyAction}>
                      {todayProgress?.completed ? 'Practice Again →' : 'Start Now →'}
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Level Cards */}
            <View style={styles.levelCardsContainer}>
              {/* Easy */}
              <TouchableOpacity
                style={styles.levelCard}
                onPress={() => handleLevelSelect('easy')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={DIFFICULTY_COLORS.easy.gradient}
                  style={styles.levelGradient}
                >
                  <Icon name="sentiment-very-satisfied" size={48} color={COLORS.white} />
                  <Text style={styles.levelTitle}>Easy</Text>
                  <Text style={styles.levelDescription}>Perfect for beginners</Text>
                  <View style={styles.levelProgress}>
                    <Text style={styles.levelProgressText}>
                      {getLevelStats('easy').completed} / {getLevelStats('easy').total} words
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Intermediate */}
              <TouchableOpacity
                style={styles.levelCard}
                onPress={() => handleLevelSelect('intermediate')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={DIFFICULTY_COLORS.intermediate.gradient}
                  style={styles.levelGradient}
                >
                  <Icon name="emoji-events" size={48} color={COLORS.white} />
                  <Text style={styles.levelTitle}>Intermediate</Text>
                  <Text style={styles.levelDescription}>Challenge yourself</Text>
                  <View style={styles.levelProgress}>
                    <Text style={styles.levelProgressText}>
                      {getLevelStats('intermediate').completed} / {getLevelStats('intermediate').total} words
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Hard */}
              <TouchableOpacity
                style={styles.levelCard}
                onPress={() => handleLevelSelect('hard')}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={DIFFICULTY_COLORS.hard.gradient}
                  style={styles.levelGradient}
                >
                  <Icon name="fitness-center" size={48} color={COLORS.white} />
                  <Text style={styles.levelTitle}>Hard</Text>
                  <Text style={styles.levelDescription}>Master pronunciation</Text>
                  <View style={styles.levelProgress}>
                    <Text style={styles.levelProgressText}>
                      {getLevelStats('hard').completed} / {getLevelStats('hard').total} words
                    </Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Learning Path View */
          <Animated.View style={{
            opacity: levelOpacity,
            transform: [{ scale: levelScale }]
          }}>
            <View style={styles.pathHeader}>
              <Text style={[styles.pathTitle, { color: getCurrentLevelData().colors.primary }]}>
                {selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1)} Level
              </Text>
              <Text style={styles.pathSubtitle}>
                {getLevelStats(selectedLevel).completed} / {getLevelStats(selectedLevel).total} completed
              </Text>
            </View>

            <View style={styles.pathView}>
              {renderWordPath()}
              
              {/* Completion Badge */}
              {getLevelStats(selectedLevel).completed === getLevelStats(selectedLevel).total && (
                <View style={styles.completionBadge}>
                  <LinearGradient
                    colors={getCurrentLevelData().colors.gradient}
                    style={styles.completionGradient}
                  >
                    <Icon name="workspace-premium" size={48} color={COLORS.gold} />
                    <Text style={styles.completionText}>Level Complete! 🎉</Text>
                    <Text style={styles.completionSubtext}>
                      You've mastered all {getLevelStats(selectedLevel).total} words!
                    </Text>
                  </LinearGradient>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Practice Modal */}
      <Modal
        visible={showPracticeModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closePracticeModal}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closePracticeModal}
          >
            <Animated.View 
              style={[
                styles.modalContainer,
                {
                  opacity: modalAnim,
                  transform: [{ scale: modalScale }]
                }
              ]}
            >
              <TouchableOpacity activeOpacity={1}>
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
                        <Text style={styles.modalWord}>{selectedWord?.word || todayWord.word}</Text>
                        <Text style={styles.modalPhonetic}>
                          {selectedWord?.phonetic || todayWord.phonetic}
                        </Text>
                      </View>

                      <View style={styles.modalMeaning}>
                        <Icon name="book" size={20} color={COLORS.primary} />
                        <Text style={styles.modalMeaningText}>
                          {selectedWord?.meaning || todayWord.meaning}
                        </Text>
                      </View>

                      <View style={styles.modalExample}>
                        <Icon name="format-quote" size={20} color={COLORS.gray[500]} />
                        <Text style={styles.modalExampleText}>
                          {selectedWord?.example || todayWord.example}
                        </Text>
                      </View>

                      <View style={styles.modalTip}>
                        <Icon name="lightbulb-outline" size={20} color={COLORS.gold} />
                        <Text style={styles.modalTipText}>
                          {selectedWord?.tip || todayWord.tip}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.modalListenButton}
                        onPress={() => playWordPronunciation(selectedWord?.word || todayWord.word)}
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
                                  colors={isRecording ? [COLORS.error, '#DC2626'] : [COLORS.primary, COLORS.secondary]}
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
                            ? [COLORS.success, '#059669'] 
                            : [COLORS.warning, '#D97706']
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
                            <Icon name="check-circle" size={24} color={COLORS.primary} />
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
                              colors={[COLORS.primary, COLORS.secondary]}
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
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
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
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerStats: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    justifyContent: 'flex-end',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  statText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.gray[800],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.gray[800],
    textAlign: 'center',
    marginTop: 32,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '500',
  },
  dailyCardWrapper: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  dailyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  dailyGradient: {
    padding: 24,
  },
  dailyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dailyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dailyBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  dailyWord: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 6,
    letterSpacing: -1,
  },
  dailyPhonetic: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  dailyFooter: {
    alignItems: 'center',
  },
  dailyAction: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  levelCardsContainer: {
    paddingHorizontal: 20,
    gap: 16,
  },
  levelCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  levelGradient: {
    padding: 28,
    alignItems: 'center',
  },
  levelTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  levelDescription: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginBottom: 16,
  },
  levelProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  levelProgressText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  pathHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  pathTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  pathSubtitle: {
    fontSize: 16,
    color: COLORS.gray[600],
    fontWeight: '600',
  },
  pathView: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  pathNodeContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  pathConnector: {
    position: 'absolute',
    width: 4,
    height: 50,
    left: '50%',
    top: 90,
    marginLeft: -2,
    zIndex: -1,
  },
  wordNodeWrapper: {
    width: '100%',
  },
  wordNode: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 3,
    borderColor: COLORS.gray[200],
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  nodeIconContainer: {
    width: 70,
    height: 70,
  },
  nodeIconGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeIconLocked: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: COLORS.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeInfo: {
    flex: 1,
  },
  nodeWord: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
  },
  currentBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 0.5,
  },
  completionBadge: {
    marginTop: 32,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  completionGradient: {
    padding: 32,
    alignItems: 'center',
  },
  completionText: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.white,
    marginTop: 16,
    marginBottom: 8,
  },
  completionSubtext: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
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
