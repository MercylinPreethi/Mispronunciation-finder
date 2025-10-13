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

// Monochromatic Green Color Palette (Duolingo-inspired)
const COLORS = {
  primary: '#58CC02',
  primaryDark: '#46A302',
  primaryLight: '#89E219',
  secondary: '#1CB0F6',
  gold: '#FFC800',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
  },
  success: '#58CC02',
  warning: '#FFC800',
  error: '#FF4B4B',
  white: '#FFFFFF',
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
];

// Intermediate Level Words
const INTERMEDIATE_WORDS = [
  { id: 'i1', word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', meaning: 'Providing physical ease and relaxation', example: 'This chair is very comfortable.', tip: 'Often said as COMF-ta-ble' },
  { id: 'i2', word: 'Develop', phonetic: '/dɪˈveləp/', meaning: 'Grow or cause to grow', example: 'We need to develop new skills.', tip: 'Stress on second syllable' },
  { id: 'i3', word: 'Chocolate', phonetic: '/ˈtʃɒklət/', meaning: 'A sweet food made from cacao', example: 'I love dark chocolate.', tip: 'Two syllables: CHOK-let' },
  { id: 'i4', word: 'Queue', phonetic: '/kjuː/', meaning: 'A line of people waiting', example: 'There is a long queue at the store.', tip: 'Just sounds like "Q"' },
  { id: 'i5', word: 'Receipt', phonetic: '/rɪˈsiːt/', meaning: 'A written acknowledgment of payment', example: 'Keep the receipt for returns.', tip: 'Silent "p"' },
  { id: 'i6', word: 'Island', phonetic: '/ˈaɪlənd/', meaning: 'A piece of land surrounded by water', example: 'They live on a tropical island.', tip: 'Silent "s"' },
];

// Hard Level Words
const HARD_WORDS = [
  { id: 'h1', word: 'Epitome', phonetic: '/ɪˈpɪtəmi/', meaning: 'A perfect example of something', example: 'She is the epitome of elegance.', tip: 'Not "EPI-tome", say "e-PIT-o-me"' },
  { id: 'h2', word: 'Worcestershire', phonetic: '/ˈwʊstərʃər/', meaning: 'A fermented liquid condiment', example: 'Add Worcestershire sauce to the recipe.', tip: 'WOOS-ter-shur' },
  { id: 'h3', word: 'Squirrel', phonetic: '/ˈskwɜːrəl/', meaning: 'A small rodent with a bushy tail', example: 'A squirrel climbed the tree.', tip: 'SKWIR-rel with rolled R' },
  { id: 'h4', word: 'Rural', phonetic: '/ˈrʊərəl/', meaning: 'Relating to the countryside', example: 'They moved to a rural area.', tip: 'Two syllables with rolling R' },
  { id: 'h5', word: 'Phenomenal', phonetic: '/fəˈnɒmɪnəl/', meaning: 'Very remarkable or extraordinary', example: 'Her performance was phenomenal.', tip: 'fe-NOM-i-nal' },
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

      // Update XP
      const newXP = stats.xp + xpEarned;
      setStats(prev => ({ ...prev, xp: newXP }));
      const statsRef = ref(database, `users/${user.uid}/stats`);
      await set(statsRef, { ...stats, xp: newXP });
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

  const renderLessonNode = (word: any, progress: WordProgress, index: number, unlockedIndex: number, isLast: boolean) => {
    const isUnlocked = index <= unlockedIndex;
    const isCompleted = progress.completed;
    const isCurrent = index === unlockedIndex && !isCompleted;

    return (
      <View key={word.id} style={styles.lessonNodeContainer}>
        {!isLast && <View style={styles.pathLine} />}
        <TouchableOpacity
          style={[
            styles.lessonNode,
            { left: index % 2 === 0 ? 20 : width - 100 }
          ]}
          onPress={() => isUnlocked ? openPracticeModal(word, selectedWordType, word) : null}
          disabled={!isUnlocked}
          activeOpacity={0.8}
        >
          <View style={[
            styles.nodeCircle,
            isCompleted && styles.nodeCompleted,
            isCurrent && styles.nodeCurrent,
            !isUnlocked && styles.nodeLocked,
          ]}>
            {isCompleted ? (
              <Icon name="check-circle" size={32} color={COLORS.success} />
            ) : isCurrent ? (
              <Icon name="star" size={32} color={COLORS.gold} />
            ) : !isUnlocked ? (
              <Icon name="lock" size={28} color={COLORS.gray[400]} />
            ) : (
              <Icon name="play-circle-filled" size={32} color={COLORS.primary} />
            )}
          </View>
          {isUnlocked && (
            <View style={styles.nodeLabel}>
              <Text style={[
                styles.nodeLabelText,
                !isCompleted && styles.nodeLabelTextActive
              ]}>{word.word}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const easyUnlocked = getNextUnlockedIndex(easyProgress);
  const intUnlocked = getNextUnlockedIndex(intermediateProgress);
  const hardUnlocked = getNextUnlockedIndex(hardProgress);

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.streakContainer}>
            <Icon name="local-fire-department" size={24} color={COLORS.gold} />
            <Text style={styles.streakText}>{stats.streak}</Text>
          </View>
          <View style={styles.xpContainer}>
            <Icon name="stars" size={20} color={COLORS.gold} />
            <Text style={styles.xpText}>{stats.xp} XP</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Challenge */}
        <View style={styles.dailySection}>
          <Text style={styles.sectionTitle}>Today's Challenge</Text>
          <Animated.View style={{ transform: [{ translateY: floatY }] }}>
            <TouchableOpacity
              style={styles.dailyCard}
              onPress={() => openPracticeModal(todayWord, 'daily')}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={todayProgress?.completed 
                  ? [COLORS.success, COLORS.primaryDark] 
                  : [COLORS.primary, COLORS.primaryLight]
                }
                style={styles.dailyCardGradient}
              >
                <View style={styles.dailyCardHeader}>
                  <View style={styles.dailyBadge}>
                    <Text style={styles.dailyBadgeText}>DAILY</Text>
                  </View>
                  {todayProgress?.completed && (
                    <Icon name="check-circle" size={28} color={COLORS.gold} />
                  )}
                </View>
                
                <View style={styles.dailyContent}>
                  <Text style={styles.dailyWordText}>{todayWord.word}</Text>
                  <Text style={styles.dailyPhonetic}>{todayWord.phonetic}</Text>
                  
                  <View style={styles.dailyMeaning}>
                    <Icon name="info-outline" size={16} color={COLORS.white} />
                    <Text style={styles.dailyMeaningText}>{todayWord.meaning}</Text>
                  </View>
                  
                  <View style={styles.dailyExample}>
                    <Text style={styles.dailyExampleText}>"{todayWord.example}"</Text>
                  </View>
                </View>

                <View style={styles.dailyFooter}>
                  <View style={styles.dailyButton}>
                    <Text style={styles.dailyButtonText}>
                      {todayProgress?.completed ? 'Practice Again' : 'Start Learning'}
                    </Text>
                    <Icon name="arrow-forward" size={20} color={COLORS.primary} />
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Learning Path - Easy */}
        <View style={styles.pathSection}>
          <View style={styles.unitHeader}>
            <View style={[styles.unitBadge, { backgroundColor: COLORS.gray[200] }]}>
              <Icon name="school" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.unitInfo}>
              <Text style={styles.unitTitle}>Unit 1 • Easy</Text>
              <Text style={styles.unitSubtitle}>
                {easyProgress.filter(p => p.completed).length} / {EASY_WORDS.length} completed
              </Text>
            </View>
          </View>
          
          <View style={styles.pathContainer}>
            {EASY_WORDS.map((word, index) => {
              const progress = easyProgress[index] || { 
                wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
              };
              return (
                <View key={word.id}>
                  {renderLessonNode(word, progress, index, easyUnlocked, index === EASY_WORDS.length - 1)}
                </View>
              );
            })}
            
            {/* Checkpoint */}
            <View style={styles.checkpointContainer}>
              <View style={styles.checkpoint}>
                <Icon name="emoji-events" size={32} color={COLORS.gold} />
                <Text style={styles.checkpointText}>Checkpoint</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Learning Path - Intermediate */}
        <View style={styles.pathSection}>
          <View style={styles.unitHeader}>
            <View style={[styles.unitBadge, { backgroundColor: COLORS.gray[200] }]}>
              <Icon name="trending-up" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.unitInfo}>
              <Text style={styles.unitTitle}>Unit 2 • Intermediate</Text>
              <Text style={styles.unitSubtitle}>
                {intermediateProgress.filter(p => p.completed).length} / {INTERMEDIATE_WORDS.length} completed
              </Text>
            </View>
          </View>
          
          <View style={styles.pathContainer}>
            {INTERMEDIATE_WORDS.map((word, index) => {
              const progress = intermediateProgress[index] || { 
                wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
              };
              return (
                <View key={word.id}>
                  {renderLessonNode(word, progress, index, intUnlocked, index === INTERMEDIATE_WORDS.length - 1)}
                </View>
              );
            })}
            
            <View style={styles.checkpointContainer}>
              <View style={styles.checkpoint}>
                <Icon name="emoji-events" size={32} color={COLORS.gold} />
                <Text style={styles.checkpointText}>Checkpoint</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Learning Path - Hard */}
        <View style={styles.pathSection}>
          <View style={styles.unitHeader}>
            <View style={[styles.unitBadge, { backgroundColor: COLORS.gray[200] }]}>
              <Icon name="fitness-center" size={20} color={COLORS.primary} />
            </View>
            <View style={styles.unitInfo}>
              <Text style={styles.unitTitle}>Unit 3 • Hard</Text>
              <Text style={styles.unitSubtitle}>
                {hardProgress.filter(p => p.completed).length} / {HARD_WORDS.length} completed
              </Text>
            </View>
          </View>
          
          <View style={styles.pathContainer}>
            {HARD_WORDS.map((word, index) => {
              const progress = hardProgress[index] || { 
                wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' 
              };
              return (
                <View key={word.id}>
                  {renderLessonNode(word, progress, index, hardUnlocked, index === HARD_WORDS.length - 1)}
                </View>
              );
            })}
            
            <View style={styles.checkpointContainer}>
              <View style={styles.checkpoint}>
                <Icon name="emoji-events" size={32} color={COLORS.gold} />
                <Text style={styles.checkpointText}>Mastery Achieved!</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: 60 }} />
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
                                <View style={[
                                  styles.modalRecordCircle,
                                  isRecording && styles.modalRecordCircleActive
                                ]}>
                                  <Icon 
                                    name={isRecording ? 'stop' : 'mic'} 
                                    size={40} 
                                    color={COLORS.white} 
                                  />
                                </View>
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
                        <View style={[
                          styles.resultIconCircle,
                          { backgroundColor: result && result.accuracy >= 0.8 ? COLORS.success : COLORS.gold }
                        ]}>
                          <Icon 
                            name={result && result.accuracy >= 0.8 ? 'celebration' : 'emoji-events'} 
                            size={64} 
                            color={COLORS.white} 
                          />
                        </View>
                        
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
                              colors={[COLORS.primary, COLORS.primaryDark]}
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
    backgroundColor: COLORS.white,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  streakText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.gold,
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  xpText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  dailySection: {
    padding: 20,
    backgroundColor: COLORS.gray[50],
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray[800],
    marginBottom: 16,
  },
  dailyCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  dailyCardGradient: {
    padding: 24,
  },
  dailyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  dailyBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dailyBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 1,
  },
  dailyContent: {
    marginBottom: 20,
  },
  dailyWordText: {
    fontSize: 40,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: 8,
    letterSpacing: -1,
  },
  dailyPhonetic: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  dailyMeaning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  dailyMeaningText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.white,
    fontWeight: '600',
    lineHeight: 22,
  },
  dailyExample: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.white,
  },
  dailyExampleText: {
    fontSize: 14,
    color: COLORS.white,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  dailyFooter: {
    alignItems: 'center',
  },
  dailyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  dailyButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  pathSection: {
    paddingTop: 32,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  unitBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitInfo: {
    flex: 1,
  },
  unitTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gray[800],
    marginBottom: 4,
  },
  unitSubtitle: {
    fontSize: 14,
    color: COLORS.gray[600],
    fontWeight: '600',
  },
  pathContainer: {
    position: 'relative',
    paddingVertical: 20,
    minHeight: 400,
  },
  pathLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 4,
    height: 120,
    backgroundColor: COLORS.gray[200],
    marginLeft: -2,
    zIndex: -1,
  },
  lessonNodeContainer: {
    height: 120,
    width: '100%',
    position: 'relative',
  },
  lessonNode: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1,
  },
  nodeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.white,
    borderWidth: 4,
    borderColor: COLORS.gray[300],
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nodeCompleted: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.gray[50],
  },
  nodeCurrent: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
  },
  nodeLocked: {
    borderColor: COLORS.gray[300],
    backgroundColor: COLORS.gray[100],
  },
  nodeLabel: {
    marginTop: 8,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray[200],
  },
  nodeLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray[600],
  },
  nodeLabelTextActive: {
    color: COLORS.primary,
  },
  checkpointContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  checkpoint: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkpointText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 8,
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
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 16,
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  modalRecordCircleActive: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
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
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
