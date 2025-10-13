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

// Daily word pool - rotates daily (MANDATORY)
const DAILY_WORDS = [
  { word: 'Beautiful', phonetic: '/ˈbjuːtɪfəl/', tip: 'Stress on first syllable: BEAU-ti-ful' },
  { word: 'Pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃən/', tip: 'Watch the "nun-see-AY-shun" pattern' },
  { word: 'Schedule', phonetic: '/ˈʃedjuːl/', tip: 'UK: SHED-yool, US: SKED-yool' },
  { word: 'Algorithm', phonetic: '/ˈælɡərɪðəm/', tip: 'Stress on first syllable: AL-go-rith-m' },
  { word: 'Wednesday', phonetic: '/ˈwenzdeɪ/', tip: 'Silent "d": WENZ-day' },
  { word: 'February', phonetic: '/ˈfebruəri/', tip: 'Don\'t skip the first "r": FEB-roo-ary' },
  { word: 'Colonel', phonetic: '/ˈkɜːrnəl/', tip: 'Sounds like "kernel"' },
];

// Easy Level Words
const EASY_WORDS = [
  { id: 'e1', word: 'Cat', phonetic: '/kæt/', tip: 'Short "a" sound' },
  { id: 'e2', word: 'Dog', phonetic: '/dɔɡ/', tip: 'Short "o" sound' },
  { id: 'e3', word: 'Book', phonetic: '/bʊk/', tip: 'Short "oo" sound' },
  { id: 'e4', word: 'Water', phonetic: '/ˈwɔːtər/', tip: 'Two syllables: WA-ter' },
  { id: 'e5', word: 'Hello', phonetic: '/həˈloʊ/', tip: 'Stress on second syllable' },
  { id: 'e6', word: 'Thank', phonetic: '/θæŋk/', tip: 'Soft "th" sound' },
  { id: 'e7', word: 'Please', phonetic: '/pliːz/', tip: 'Long "ee" sound' },
  { id: 'e8', word: 'Happy', phonetic: '/ˈhæpi/', tip: 'Stress on first syllable' },
  { id: 'e9', word: 'House', phonetic: '/haʊs/', tip: 'Diphthong "ou"' },
  { id: 'e10', word: 'Friend', phonetic: '/frend/', tip: 'Silent "i"' },
];

// Intermediate Level Words
const INTERMEDIATE_WORDS = [
  { id: 'i1', word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', tip: 'Often said as COMF-ta-ble' },
  { id: 'i2', word: 'Develop', phonetic: '/dɪˈveləp/', tip: 'Stress on second syllable' },
  { id: 'i3', word: 'Chocolate', phonetic: '/ˈtʃɒklət/', tip: 'Two syllables: CHOK-let' },
  { id: 'i4', word: 'Queue', phonetic: '/kjuː/', tip: 'Just sounds like "Q"' },
  { id: 'i5', word: 'Choir', phonetic: '/ˈkwaɪər/', tip: 'Sounds like "quire"' },
  { id: 'i6', word: 'Buffet', phonetic: '/bəˈfeɪ/', tip: 'Stress on second syllable: buh-FAY' },
  { id: 'i7', word: 'Receipt', phonetic: '/rɪˈsiːt/', tip: 'Silent "p"' },
  { id: 'i8', word: 'Island', phonetic: '/ˈaɪlənd/', tip: 'Silent "s"' },
  { id: 'i9', word: 'Knight', phonetic: '/naɪt/', tip: 'Silent "k" and "gh"' },
  { id: 'i10', word: 'Tongue', phonetic: '/tʌŋ/', tip: 'Silent "ue"' },
];

// Hard Level Words
const HARD_WORDS = [
  { id: 'h1', word: 'Epitome', phonetic: '/ɪˈpɪtəmi/', tip: 'Not "EPI-tome", say "e-PIT-o-me"' },
  { id: 'h2', word: 'Worcestershire', phonetic: '/ˈwʊstərʃər/', tip: 'WOOS-ter-shur' },
  { id: 'h3', word: 'Squirrel', phonetic: '/ˈskwɜːrəl/', tip: 'SKWIR-rel with rolled R' },
  { id: 'h4', word: 'Rural', phonetic: '/ˈrʊərəl/', tip: 'Two syllables with rolling R' },
  { id: 'h5', word: 'Brewery', phonetic: '/ˈbruːəri/', tip: 'BREW-er-y, three syllables' },
  { id: 'h6', word: 'Anemone', phonetic: '/əˈneməni/', tip: 'uh-NEM-uh-nee' },
  { id: 'h7', word: 'Otorhinolaryngologist', phonetic: '/ˌoʊtoʊˌraɪnoʊˌlærɪŋˈɡɒlədʒɪst/', tip: 'Ear, nose, and throat doctor' },
  { id: 'h8', word: 'Phenomenal', phonetic: '/fəˈnɒmɪnəl/', tip: 'fe-NOM-i-nal' },
  { id: 'h9', word: 'Mischievous', phonetic: '/ˈmɪstʃɪvəs/', tip: 'MIS-chi-vous, three syllables' },
  { id: 'h10', word: 'Sixth', phonetic: '/sɪksθ/', tip: 'Two "th" sounds' },
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
  lastCompletedDate: string;
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
    lastCompletedDate: '',
  });
  
  // Daily word state
  const [todayWord, setTodayWord] = useState(DAILY_WORDS[0]);
  const [todayProgress, setTodayProgress] = useState<DailyWordProgress | null>(null);
  
  // Practice words state
  const [easyProgress, setEasyProgress] = useState<WordProgress[]>([]);
  const [intermediateProgress, setIntermediateProgress] = useState<WordProgress[]>([]);
  const [hardProgress, setHardProgress] = useState<WordProgress[]>([]);
  
  // UI state
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
      let lastAttemptDate = '';

      dates.forEach(date => {
        const dayData = allDailyWords[date];
        if (dayData && dayData.attempts > 0) {
          wordsAttempted++;
          if (dayData.bestScore && dayData.bestScore > 0) {
            totalAccuracy += dayData.bestScore;
            accuracyCount++;
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
          lastAttemptDate = checkDateStr;
        } else {
          if (daysAgo > 0) break;
        }
      }

      const newStats: UserStats = {
        streak: currentStreak,
        totalWords: wordsAttempted,
        accuracy: averageAccuracy,
        lastCompletedDate: lastAttemptDate,
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
      // Load stats
      const statsRef = ref(database, `users/${userId}/stats`);
      onValue(statsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setStats({
            streak: data.streak || 0,
            totalWords: data.totalWords || 0,
            accuracy: data.accuracy || 0,
            lastCompletedDate: data.lastCompletedDate || '',
          });
        }
      });

      // Load daily words history
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      onValue(dailyWordsRef, (snapshot) => {
        if (snapshot.exists()) {
          const allDailyWords = snapshot.val();
          calculateStatsFromHistory(allDailyWords, userId);
        }
      });

      // Load today's word
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

      // Load practice words progress
      await loadPracticeProgress(userId);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [calculateStatsFromHistory]);

  const loadPracticeProgress = async (userId: string) => {
    try {
      // Load Easy words progress
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

      // Load Intermediate words progress
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

      // Load Hard words progress
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

      if (selectedWordType === 'daily') {
        // Update daily word
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

        // Recalculate stats
        const dailyWordsRef = ref(database, `users/${user.uid}/dailyWords`);
        const snapshot = await get(dailyWordsRef);
        if (snapshot.exists()) {
          await calculateStatsFromHistory(snapshot.val(), user.uid);
        }
      } else {
        // Update practice word
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

        // Update local state
        if (level === 'easy') {
          setEasyProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        } else if (level === 'intermediate') {
          setIntermediateProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        } else {
          setHardProgress(prev => prev.map(p => p.wordId === wordId ? updatedProgress : p));
        }
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

  const renderWordNode = (word: any, progress: WordProgress, index: number, unlockedIndex: number, difficulty: 'easy' | 'intermediate' | 'hard') => {
    const isUnlocked = index <= unlockedIndex;
    const isCompleted = progress.completed;
    const isCurrent = index === unlockedIndex && !isCompleted;

    const colors = {
      easy: ['#10B981', '#059669'],
      intermediate: ['#F59E0B', '#D97706'],
      hard: ['#EF4444', '#DC2626'],
    };

    return (
      <TouchableOpacity
        key={word.id}
        style={styles.wordNode}
        onPress={() => isUnlocked ? openPracticeModal(word, difficulty, word) : null}
        disabled={!isUnlocked}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            isCompleted ? ['#10B981', '#059669'] :
            isCurrent ? colors[difficulty] :
            ['#E5E7EB', '#D1D5DB']
          }
          style={[styles.nodeGradient, !isUnlocked && styles.nodeLocked]}
        >
          {isCompleted && (
            <View style={styles.nodeCheckmark}>
              <Icon name="check-circle" size={24} color="#FFD700" />
            </View>
          )}
          {!isUnlocked && (
            <Icon name="lock" size={28} color="#9CA3AF" />
          )}
          {isUnlocked && !isCompleted && (
            <Icon name="play-circle-filled" size={28} color="#FFFFFF" />
          )}
          <Text style={[
            styles.nodeText,
            !isUnlocked && styles.nodeTextLocked
          ]}>{word.word}</Text>
          {progress.attempts > 0 && (
            <Text style={styles.nodeAttempts}>{progress.attempts} tries</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const easyUnlocked = getNextUnlockedIndex(easyProgress);
  const intUnlocked = getNextUnlockedIndex(intermediateProgress);
  const hardUnlocked = getNextUnlockedIndex(hardProgress);

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hi, {userName}! 👋</Text>
            <Text style={styles.subtitle}>Your learning journey</Text>
          </View>
          <View style={styles.streakBadge}>
            <Icon name="local-fire-department" size={24} color="#FF6B35" />
            <Text style={styles.streakText}>{stats.streak}</Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Icon name="check-circle" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats.totalWords}</Text>
            <Text style={styles.statLabel}>Words</Text>
          </View>
          <View style={styles.statBox}>
            <Icon name="trending-up" size={24} color="#6366F1" />
            <Text style={styles.statValue}>{Math.round(stats.accuracy * 100)}%</Text>
            <Text style={styles.statLabel}>Accuracy</Text>
          </View>
        </View>

        {/* Daily Word (Mandatory) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="star" size={24} color="#FFD700" />
            <Text style={styles.sectionTitle}>Daily Challenge (Mandatory)</Text>
          </View>
          
          <TouchableOpacity
            style={styles.dailyCard}
            onPress={() => openPracticeModal(todayWord, 'daily')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={todayProgress?.completed ? ['#10B981', '#059669'] : ['#6366F1', '#8B5CF6']}
              style={styles.dailyGradient}
            >
              {todayProgress?.completed && (
                <View style={styles.completedStar}>
                  <Icon name="verified" size={32} color="#FFD700" />
                </View>
              )}
              <Text style={styles.dailyWord}>{todayWord.word}</Text>
              <Text style={styles.dailyPhonetic}>{todayWord.phonetic}</Text>
              {todayProgress && todayProgress.attempts > 0 && (
                <View style={styles.dailyStats}>
                  <Text style={styles.dailyStatsText}>
                    {todayProgress.attempts} attempts • Best: {Math.round(todayProgress.bestScore * 100)}%
                  </Text>
                </View>
              )}
              <View style={styles.dailyBadge}>
                <Text style={styles.dailyBadgeText}>
                  {todayProgress?.completed ? 'Completed ✓' : 'Start Practice'}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Easy Level */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.levelBadge} backgroundColor="#D1FAE5">
              <Icon name="mood" size={20} color="#10B981" />
            </View>
            <Text style={styles.sectionTitle}>Easy Level</Text>
            <Text style={styles.levelProgress}>
              {easyProgress.filter(p => p.completed).length}/{EASY_WORDS.length}
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nodesScroll}
          >
            {EASY_WORDS.map((word, index) => 
              renderWordNode(word, easyProgress[index] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }, index, easyUnlocked, 'easy')
            )}
          </ScrollView>
        </View>

        {/* Intermediate Level */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.levelBadge, { backgroundColor: '#FEF3C7' }]}>
              <Icon name="school" size={20} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>Intermediate Level</Text>
            <Text style={styles.levelProgress}>
              {intermediateProgress.filter(p => p.completed).length}/{INTERMEDIATE_WORDS.length}
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nodesScroll}
          >
            {INTERMEDIATE_WORDS.map((word, index) => 
              renderWordNode(word, intermediateProgress[index] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }, index, intUnlocked, 'intermediate')
            )}
          </ScrollView>
        </View>

        {/* Hard Level */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.levelBadge, { backgroundColor: '#FEE2E2' }]}>
              <Icon name="fitness-center" size={20} color="#EF4444" />
            </View>
            <Text style={styles.sectionTitle}>Hard Level</Text>
            <Text style={styles.levelProgress}>
              {hardProgress.filter(p => p.completed).length}/{HARD_WORDS.length}
            </Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nodesScroll}
          >
            {HARD_WORDS.map((word, index) => 
              renderWordNode(word, hardProgress[index] || { wordId: word.id, word: word.word, completed: false, attempts: 0, bestScore: 0, lastAttempted: '' }, index, hardUnlocked, 'hard')
            )}
          </ScrollView>
        </View>

        <View style={{ height: 40 }} />
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
                      {/* Word Header */}
                      <View style={styles.modalHeader}>
                        <TouchableOpacity 
                          style={styles.closeButton}
                          onPress={closePracticeModal}
                        >
                          <Icon name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.modalWordDisplay}>
                        <Text style={styles.modalWord}>{selectedWord?.word || todayWord.word}</Text>
                        <Text style={styles.modalPhonetic}>
                          {selectedWord?.phonetic || todayWord.phonetic}
                        </Text>
                      </View>

                      {/* Tip */}
                      <View style={styles.modalTip}>
                        <Icon name="lightbulb" size={20} color="#F59E0B" />
                        <Text style={styles.modalTipText}>
                          {selectedWord?.tip || todayWord.tip}
                        </Text>
                      </View>

                      {/* Listen Button */}
                      <TouchableOpacity
                        style={styles.modalListenButton}
                        onPress={() => playWordPronunciation(selectedWord?.word || todayWord.word)}
                        disabled={playingAudio}
                      >
                        <Icon name={playingAudio ? 'volume-up' : 'headphones'} size={24} color="#6366F1" />
                        <Text style={styles.modalListenText}>
                          {playingAudio ? 'Playing...' : 'Listen to pronunciation'}
                        </Text>
                      </TouchableOpacity>

                      {/* Record Section */}
                      <View style={styles.modalRecordSection}>
                        {isProcessing ? (
                          <View style={styles.modalProcessing}>
                            <ActivityIndicator size="large" color="#6366F1" />
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
                                  colors={isRecording ? ['#EF4444', '#DC2626'] : ['#6366F1', '#8B5CF6']}
                                  style={styles.modalRecordGradient}
                                >
                                  <Icon 
                                    name={isRecording ? 'stop' : 'mic'} 
                                    size={48} 
                                    color="#FFFFFF" 
                                  />
                                </LinearGradient>
                              </TouchableOpacity>
                            </Animated.View>
                            
                            {isRecording && (
                              <Text style={styles.modalRecordingTime}>{recordingTime}</Text>
                            )}
                            
                            <Text style={styles.modalRecordHint}>
                              {isRecording ? 'Tap to stop recording' : 'Tap to record'}
                            </Text>
                          </>
                        )}
                      </View>
                    </>
                  ) : (
                    /* Result View */
                    <>
                      <View style={styles.modalHeader}>
                        <TouchableOpacity 
                          style={styles.closeButton}
                          onPress={closePracticeModal}
                        >
                          <Icon name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.resultContent}>
                        <Icon 
                          name={result && result.accuracy >= 0.8 ? 'celebration' : 'emoji-events'} 
                          size={72} 
                          color={result && result.accuracy >= 0.8 ? '#10B981' : '#F59E0B'} 
                        />
                        
                        <Text style={styles.resultTitle}>
                          {result && result.accuracy >= 0.9 ? 'Perfect! 🌟' :
                           result && result.accuracy >= 0.8 ? 'Excellent! 🎉' :
                           result && result.accuracy >= 0.7 ? 'Good! 💪' : 'Keep trying! 📚'}
                        </Text>

                        <View style={styles.scoreCircle}>
                          <Text style={styles.scoreText}>{result && Math.round(result.accuracy * 100)}</Text>
                          <Text style={styles.scoreUnit}>%</Text>
                        </View>

                        <View style={styles.resultStats}>
                          <View style={styles.resultStat}>
                            <Icon name="check" size={20} color="#10B981" />
                            <Text style={styles.resultStatText}>
                              {result?.correct_phonemes || 0} correct
                            </Text>
                          </View>
                          <View style={styles.resultStat}>
                            <Icon name="close" size={20} color="#EF4444" />
                            <Text style={styles.resultStatText}>
                              {result ? result.total_phonemes - result.correct_phonemes : 0} errors
                            </Text>
                          </View>
                        </View>

                        <View style={styles.resultFeedback}>
                          <Text style={styles.resultFeedbackText}>{result?.feedback}</Text>
                        </View>

                        <View style={styles.resultActions}>
                          <TouchableOpacity 
                            style={styles.resultTryAgain}
                            onPress={() => setShowResult(false)}
                          >
                            <Icon name="refresh" size={24} color="#6366F1" />
                            <Text style={styles.resultTryAgainText}>Try Again</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity 
                            style={styles.resultContinue}
                            onPress={closePracticeModal}
                          >
                            <LinearGradient
                              colors={['#6366F1', '#8B5CF6']}
                              style={styles.resultContinueGradient}
                            >
                              <Text style={styles.resultContinueText}>Continue</Text>
                              <Icon name="arrow-forward" size={20} color="#FFFFFF" />
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
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: '#FFE0B2',
  },
  streakText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FF6B35',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    flex: 1,
  },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelProgress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366F1',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dailyCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  dailyGradient: {
    padding: 28,
    alignItems: 'center',
    position: 'relative',
  },
  completedStar: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  dailyWord: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -1,
  },
  dailyPhonetic: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  dailyStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 16,
  },
  dailyStatsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dailyBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  dailyBadgeText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#6366F1',
  },
  nodesScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  wordNode: {
    width: 100,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  nodeGradient: {
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    position: 'relative',
  },
  nodeLocked: {
    opacity: 0.5,
  },
  nodeCheckmark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  nodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 8,
  },
  nodeTextLocked: {
    color: '#9CA3AF',
  },
  nodeAttempts: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
    maxHeight: height * 0.85,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalWordDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalWord: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 8,
    letterSpacing: -1.5,
  },
  modalPhonetic: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  modalTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    padding: 16,
    borderRadius: 16,
    gap: 10,
    marginBottom: 20,
    borderWidth: 1.5,
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
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 10,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  modalListenText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
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
    color: '#6B7280',
  },
  modalRecordButton: {
    marginBottom: 16,
  },
  modalRecordGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalRecordingTime: {
    fontSize: 28,
    fontWeight: '900',
    color: '#EF4444',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  modalRecordHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  resultContent: {
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEF2FF',
    borderWidth: 8,
    borderColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreText: {
    fontSize: 56,
    fontWeight: '900',
    color: '#6366F1',
    letterSpacing: -2,
  },
  scoreUnit: {
    fontSize: 24,
    fontWeight: '800',
    color: '#6366F1',
  },
  resultStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  resultStat: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 8,
  },
  resultStatText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  resultFeedback: {
    backgroundColor: '#EEF2FF',
    padding: 20,
    borderRadius: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
  },
  resultFeedbackText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '600',
    textAlign: 'center',
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
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  resultTryAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  resultContinue: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resultContinueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  resultContinueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
