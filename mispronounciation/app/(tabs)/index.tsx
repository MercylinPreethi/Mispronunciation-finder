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

// Daily word pool - rotates daily
const DAILY_WORDS = [
  { word: 'Beautiful', phonetic: '/ˈbjuːtɪfəl/', difficulty: 'Medium', tip: 'Stress on first syllable: BEAU-ti-ful' },
  { word: 'Pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃən/', difficulty: 'Hard', tip: 'Watch the "nun-see-AY-shun" pattern' },
  { word: 'Schedule', phonetic: '/ˈʃedjuːl/', difficulty: 'Hard', tip: 'UK: SHED-yool, US: SKED-yool' },
  { word: 'Algorithm', phonetic: '/ˈælɡərɪðəm/', difficulty: 'Hard', tip: 'Stress on first syllable: AL-go-rith-m' },
  { word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', difficulty: 'Medium', tip: 'Often said as COMF-ta-ble' },
  { word: 'Develop', phonetic: '/dɪˈveləp/', difficulty: 'Easy', tip: 'Stress on second syllable: de-VEL-op' },
  { word: 'Wednesday', phonetic: '/ˈwenzdeɪ/', difficulty: 'Medium', tip: 'Silent "d": WENZ-day' },
  { word: 'Chocolate', phonetic: '/ˈtʃɒklət/', difficulty: 'Easy', tip: 'Two syllables: CHOK-let' },
  { word: 'February', phonetic: '/ˈfebruəri/', difficulty: 'Medium', tip: 'Don\'t skip the first "r": FEB-roo-ary' },
  { word: 'Queue', phonetic: '/kjuː/', difficulty: 'Medium', tip: 'Just sounds like "Q"' },
  { word: 'Colonel', phonetic: '/ˈkɜːrnəl/', difficulty: 'Hard', tip: 'Sounds like "kernel"' },
  { word: 'Choir', phonetic: '/ˈkwaɪər/', difficulty: 'Medium', tip: 'Sounds like "quire"' },
  { word: 'Epitome', phonetic: '/ɪˈpɪtəmi/', difficulty: 'Hard', tip: 'Not "EPI-tome", say "e-PIT-o-me"' },
  { word: 'Buffet', phonetic: '/bəˈfeɪ/', difficulty: 'Medium', tip: 'Stress on second syllable: buh-FAY' },
];

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
  const [todayWord, setTodayWord] = useState(DAILY_WORDS[0]);
  const [todayProgress, setTodayProgress] = useState<DailyWordProgress | null>(null);
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
  const resultAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  // NOW the callback with streak calculation
  const calculateStatsFromHistory = useCallback(async (allDailyWords: any, userId: string) => {
    try {
      console.log('📊 Calculating stats from history...');
      
      const dates = Object.keys(allDailyWords);
      let wordsAttempted = 0;
      let totalAccuracy = 0;
      let accuracyCount = 0;
      let currentStreak = 0;
      let lastAttemptDate = '';

      // Count all attempted words and calculate average accuracy
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

      // Calculate streak: consecutive days with attempts
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check up to 365 days back
      for (let daysAgo = 0; daysAgo < 365; daysAgo++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - daysAgo);
        const checkDateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        
        const dayData = allDailyWords[checkDateStr];
        
        if (dayData && dayData.attempts > 0) {
          currentStreak++;
          lastAttemptDate = checkDateStr;
          console.log(`🔥 Day ${daysAgo}: Found attempt, streak = ${currentStreak}`);
        } else {
          // Only break if we're past today and found a gap
          if (daysAgo > 0) {
            console.log(`🔥 Day ${daysAgo}: No attempt, streak ends at ${currentStreak}`);
            break;
          }
        }
      }

      const newStats: UserStats = {
        streak: currentStreak,
        totalWords: wordsAttempted,
        accuracy: averageAccuracy,
        lastCompletedDate: lastAttemptDate,
      };

      console.log('✅ Stats calculated:', {
        streak: `🔥 ${currentStreak}`,
        totalWords: wordsAttempted,
        accuracy: `${(averageAccuracy * 100).toFixed(1)}%`
      });

      const statsRef = ref(database, `users/${userId}/stats`);
      await set(statsRef, newStats);
      setStats(newStats);

    } catch (error) {
      console.error('❌ Error calculating stats:', error);
    }
  }, []);

  const loadUserData = useCallback(async (userId: string) => {
    try {
      console.log('🔄 Loading user data for:', userId);
      
      // Load user stats
      const statsRef = ref(database, `users/${userId}/stats`);
      onValue(statsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          console.log('📊 Loaded stats from Firebase:', data);
          setStats({
            streak: data.streak || 0,
            totalWords: data.totalWords || 0,
            accuracy: data.accuracy || 0,
            lastCompletedDate: data.lastCompletedDate || '',
          });
        }
      });

      // Load ALL daily word history to calculate accurate stats
      const dailyWordsRef = ref(database, `users/${userId}/dailyWords`);
      onValue(dailyWordsRef, (snapshot) => {
        if (snapshot.exists()) {
          const allDailyWords = snapshot.val();
          console.log('📚 Loaded daily words from Firebase');
          calculateStatsFromHistory(allDailyWords, userId);
        } else {
          console.log('📚 No daily words found in Firebase');
        }
      });

      // Load today's word progress
      const todayDate = getTodayDateString();
      const wordIndex = getTodayWordIndex();
      const dailyWord = DAILY_WORDS[wordIndex];
      setTodayWord(dailyWord);

      console.log(`📅 Today's date: ${todayDate}, Word: ${dailyWord.word}`);

      const progressRef = ref(database, `users/${userId}/dailyWords/${todayDate}`);
      const snapshot = await get(progressRef);
      
      if (snapshot.exists()) {
        const progress = snapshot.val();
        console.log('📝 Found existing progress for today:', progress);
        setTodayProgress(progress);
      } else {
        // Initialize today's progress
        const newProgress: DailyWordProgress = {
          word: dailyWord.word,
          date: todayDate,
          completed: false,
          accuracy: 0,
          attempts: 0,
          bestScore: 0,
        };
        console.log('📝 Creating new progress for today:', newProgress);
        setTodayProgress(newProgress);
        await set(progressRef, newProgress);
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
  }, [calculateStatsFromHistory]);

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
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    if (showResult) {
      Animated.parallel([
        Animated.spring(resultAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      resultAnim.setValue(0);
      slideAnim.setValue(50);
    }
  }, [showResult, resultAnim, slideAnim]);

  const startRecording = async () => {
    try {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const path = `${RNFS.DocumentDirectoryPath}/daily_word_${Date.now()}.wav`;
      
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
      if (!exists) {
        throw new Error('Recording file was not created');
      }
      
      const stats = await RNFS.stat(result);
      if (stats.size === 0) {
        throw new Error('Recording file is empty');
      }
      
      console.log(`Recording verified: ${(stats.size / 1024).toFixed(1)} KB`);
      
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
        name: 'daily_word_recording.wav',
      } as any);
      
      formData.append('reference_text', todayWord.word);
      formData.append('use_llm_judge', 'true');
      formData.append('generate_audio', 'false');
      formData.append('filter_extraneous', 'true');
      
      console.log(`Analyzing pronunciation for "${todayWord.word}"...`);
      
      const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      
      if (response.data.success) {
        console.log('Analysis successful!');
        const analysisResult = response.data.analysis;
        
        const resultData: AnalysisResult = {
          accuracy: analysisResult.accuracy,
          correct_phonemes: analysisResult.correct_phonemes,
          total_phonemes: analysisResult.total_phonemes,
          feedback: response.data.feedback || 'Great job!',
        };
        
        console.log('📊 Analysis result:', resultData);
        
        setResult(resultData);
        setShowResult(true);
        
        // Update progress
        await updateProgress(resultData.accuracy);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
      
    } catch (error: any) {
      console.error('Processing error:', error);
      
      let errorMessage = 'Failed to analyze pronunciation.';
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Analysis Error', errorMessage);
      
    } finally {
      setIsProcessing(false);
    }
  };

  const updateProgress = async (accuracy: number) => {
    try {
      const user = auth.currentUser;
      if (!user || !todayProgress) return;

      console.log(`📝 Updating progress with accuracy: ${accuracy}`);

      const todayDate = getTodayDateString();
      const newAttempts = todayProgress.attempts + 1;
      const newBestScore = Math.max(todayProgress.bestScore, accuracy);
      const isCompleted = accuracy >= 0.8; // 80% threshold to complete
      const wasAlreadyCompleted = todayProgress.completed;

      console.log(`Attempts: ${newAttempts}, Best Score: ${newBestScore}, Completed: ${isCompleted}`);

      // Update daily word progress
      const updatedProgress: DailyWordProgress = {
        ...todayProgress,
        accuracy: accuracy,
        attempts: newAttempts,
        bestScore: newBestScore,
        completed: isCompleted || todayProgress.completed,
      };

      const progressRef = ref(database, `users/${user.uid}/dailyWords/${todayDate}`);
      await set(progressRef, updatedProgress);
      setTodayProgress(updatedProgress);

      console.log('💾 Saved progress to Firebase:', updatedProgress);

      // Recalculate and update stats from all history
      const dailyWordsRef = ref(database, `users/${user.uid}/dailyWords`);
      const snapshot = await get(dailyWordsRef);
      
      if (snapshot.exists()) {
        const allDailyWords = snapshot.val();
        console.log('🔄 Recalculating stats after update...');
        await calculateStatsFromHistory(allDailyWords, user.uid);
      }

      // Show completion message if just completed
      if (isCompleted && !wasAlreadyCompleted) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log('🎉 Daily word completed!');
      }
    } catch (error) {
      console.error('❌ Error updating progress:', error);
    }
  };

  const playWordPronunciation = async () => {
    try {
      Haptics.selectionAsync();
      setPlayingAudio(true);
      
      const response = await axios.get(`${API_BASE_URL}/get_word_audio/${todayWord.word}`, {
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
        
        const tempPath = `${RNFS.DocumentDirectoryPath}/temp_daily_word_${Date.now()}.wav`;
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
      Alert.alert('Audio Not Available', 'Pronunciation audio is not available for this word.');
      setPlayingAudio(false);
    }
  };

  const handleTryAgain = () => {
    setShowResult(false);
    setResult(null);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const getAccuracyMessage = (accuracy: number) => {
    if (accuracy >= 0.9) return 'Excellent! 🎉';
    if (accuracy >= 0.8) return 'Great job! 👏';
    if (accuracy >= 0.7) return 'Good effort! 💪';
    return 'Keep practicing! 📚';
  };

  const formatAccuracy = (accuracy: number) => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Gradient */}
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
              <Text style={styles.headerSubtitle}>Practice your daily word</Text>
            </View>
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakNumber}>{stats.streak}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Icon name="check-circle" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats.totalWords}</Text>
            <Text style={styles.statLabel}>Words Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Icon name="trending-up" size={24} color="#6366F1" />
            <Text style={styles.statValue}>{(stats.accuracy * 100).toFixed(0)}%</Text>
            <Text style={styles.statLabel}>Avg Accuracy</Text>
          </View>
        </View>

        {!showResult ? (
          <>
            {/* Daily Word Card */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Today's Word</Text>
                {todayProgress?.completed && (
                  <View style={styles.completedBadge}>
                    <Icon name="check-circle" size={16} color="#10B981" />
                    <Text style={styles.completedText}>Completed</Text>
                  </View>
                )}
              </View>

              <View style={styles.wordCard}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.1)', 'rgba(139, 92, 246, 0.1)']}
                  style={styles.wordCardGradient}
                >
                  {/* Word Header */}
                  <View style={styles.wordHeader}>
                    <View style={[
                      styles.difficultyBadge,
                      { backgroundColor: `${getDifficultyColor(todayWord.difficulty)}20` }
                    ]}>
                      <Text style={[
                        styles.difficultyText,
                        { color: getDifficultyColor(todayWord.difficulty) }
                      ]}>
                        {todayWord.difficulty}
                      </Text>
                    </View>
                    {todayProgress && todayProgress.attempts > 0 && (
                      <Text style={styles.attemptsText}>
                        {todayProgress.attempts} attempt{todayProgress.attempts > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>

                  {/* Word Display */}
                  <View style={styles.wordDisplay}>
                    <Text style={styles.wordText}>{todayWord.word}</Text>
                    <Text style={styles.phoneticText}>{todayWord.phonetic}</Text>
                  </View>

                  {/* Speaker Button */}
                  <TouchableOpacity
                    style={styles.speakerButton}
                    onPress={playWordPronunciation}
                    disabled={playingAudio}
                  >
                    <Icon 
                      name={playingAudio ? 'volume-up' : 'volume-up'} 
                      size={24} 
                      color="#6366F1" 
                    />
                    <Text style={styles.speakerText}>
                      {playingAudio ? 'Playing...' : 'Listen to pronunciation'}
                    </Text>
                  </TouchableOpacity>

                  {/* Tip */}
                  <View style={styles.tipContainer}>
                    <Icon name="lightbulb-outline" size={18} color="#F59E0B" />
                    <Text style={styles.tipText}>{todayWord.tip}</Text>
                  </View>

                  {/* Best Score */}
                  {todayProgress && todayProgress.bestScore > 0 && (
                    <View style={styles.bestScoreContainer}>
                      <Text style={styles.bestScoreLabel}>Your Best Score:</Text>
                      <Text style={[
                        styles.bestScoreValue,
                        { color: getAccuracyColor(todayProgress.bestScore) }
                      ]}>
                        {formatAccuracy(todayProgress.bestScore)}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </View>
            </View>

            {/* Recording Section */}
            <View style={styles.recordingSection}>
              {isProcessing ? (
                <View style={styles.processingContainer}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.processingText}>Analyzing your pronunciation...</Text>
                </View>
              ) : (
                <>
                  <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity
                      style={styles.recordButton}
                      onPress={handleRecord}
                      activeOpacity={0.8}
                    >
                      <LinearGradient
                        colors={isRecording ? ['#EF4444', '#DC2626'] : ['#6366F1', '#8B5CF6']}
                        style={styles.recordGradient}
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
                    <Text style={styles.recordingTime}>{recordingTime}</Text>
                  )}
                  
                  <Text style={styles.recordLabel}>
                    {isRecording ? 'Tap to stop recording' : 'Tap to record your pronunciation'}
                  </Text>
                </>
              )}
            </View>
          </>
        ) : (
          /* Result Card */
          <Animated.View 
            style={[
              styles.resultCard,
              {
                opacity: resultAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <LinearGradient
              colors={['#FFFFFF', '#F9FAFB']}
              style={styles.resultGradient}
            >
              {/* Success Icon */}
              <View style={[
                styles.resultIconContainer,
                { backgroundColor: `${getAccuracyColor(result?.accuracy || 0)}20` }
              ]}>
                <Icon 
                  name={result && result.accuracy >= 0.8 ? 'check-circle' : 'info'} 
                  size={64} 
                  color={getAccuracyColor(result?.accuracy || 0)} 
                />
              </View>

              {/* Result Message */}
              <Text style={styles.resultMessage}>
                {result && getAccuracyMessage(result.accuracy)}
              </Text>

              {/* Score Display */}
              <View style={styles.scoreDisplay}>
                <Text style={styles.scoreLabel}>Your Score</Text>
                <Text style={[
                  styles.scoreValue,
                  { color: getAccuracyColor(result?.accuracy || 0) }
                ]}>
                  {result && formatAccuracy(result.accuracy)}
                </Text>
              </View>

              {/* Phonemes Info */}
              <View style={styles.phonemesInfo}>
                <View style={styles.phonemeItem}>
                  <Icon name="check" size={20} color="#10B981" />
                  <Text style={styles.phonemeText}>
                    {result?.correct_phonemes || 0} correct
                  </Text>
                </View>
                <View style={styles.phonemedivider} />
                <View style={styles.phonemeItem}>
                  <Icon name="close" size={20} color="#EF4444" />
                  <Text style={styles.phonemeText}>
                    {result ? result.total_phonemes - result.correct_phonemes : 0} errors
                  </Text>
                </View>
              </View>

              {/* Feedback */}
              <View style={styles.feedbackContainer}>
                <Text style={styles.feedbackTitle}>Feedback:</Text>
                <Text style={styles.feedbackText}>{result?.feedback}</Text>
              </View>

              {/* Completion Status */}
              {result && result.accuracy >= 0.8 && todayProgress && !todayProgress.completed && (
                <View style={styles.completionBanner}>
                  <Icon name="celebration" size={24} color="#10B981" />
                  <Text style={styles.completionText}>
                    Daily word completed! Come back tomorrow for a new word.
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.resultActions}>
                <TouchableOpacity 
                  style={styles.tryAgainButton}
                  onPress={handleTryAgain}
                >
                  <Icon name="refresh" size={20} color="#6366F1" />
                  <Text style={styles.tryAgainText}>Try Again</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.continueButton}
                  onPress={() => setShowResult(false)}
                >
                  <LinearGradient
                    colors={['#6366F1', '#8B5CF6']}
                    style={styles.continueGradient}
                  >
                    <Text style={styles.continueText}>Continue</Text>
                    <Icon name="arrow-forward" size={20} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completedText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  wordCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  wordCardGradient: {
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  difficultyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attemptsText: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  wordDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  wordText: {
    fontSize: 48,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 8,
    letterSpacing: -1,
  },
  phoneticText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  speakerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#C7D2FE',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  speakerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6366F1',
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    marginBottom: 16,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#78350F',
    fontWeight: '500',
    lineHeight: 20,
  },
  bestScoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  bestScoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  bestScoreValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  recordingSection: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  recordButton: {
    marginBottom: 20,
    borderRadius: 85,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  recordGradient: {
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingTime: {
    fontSize: 36,
    fontWeight: '900',
    color: '#EF4444',
    marginBottom: 12,
    fontVariant: ['tabular-nums'],
  },  
  recordLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },
  resultCard: {
    marginHorizontal: 20,
    marginTop: 28,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
  resultGradient: {
    padding: 32,
    alignItems: 'center',
  },
  resultIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultMessage: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  phonemesInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 24,
    gap: 20,
  },
  phonemeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  phonemedivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  phonemeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  feedbackContainer: {
    width: '100%',
    backgroundColor: '#EEF2FF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackText: {
    fontSize: 15,
    color: '#4F46E5',
    fontWeight: '500',
    lineHeight: 22,
  },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 20,
  },
  resultActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  tryAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#6366F1',
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
  continueButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});