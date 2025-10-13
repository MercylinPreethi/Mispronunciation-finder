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
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

// Daily word pool
const DAILY_WORDS = [
  { word: 'Beautiful', phonetic: '/ˈbjuːtɪfəl/', difficulty: 'Medium', tip: 'Stress on first syllable: BEAU-ti-ful', category: 'Common Words', color: ['#FF6B9D', '#C44569'] },
  { word: 'Pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃən/', difficulty: 'Hard', tip: 'Watch the "nun-see-AY-shun" pattern', category: 'Advanced', color: ['#A8E6CF', '#3DDC84'] },
  { word: 'Schedule', phonetic: '/ˈʃedjuːl/', difficulty: 'Hard', tip: 'UK: SHED-yool, US: SKED-yool', category: 'Advanced', color: ['#FFA07A', '#FF6347'] },
  { word: 'Algorithm', phonetic: '/ˈælɡərɪðəm/', difficulty: 'Hard', tip: 'Stress on first syllable: AL-go-rith-m', category: 'Technical', color: ['#B8A4FF', '#8B7AE0'] },
  { word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', difficulty: 'Medium', tip: 'Often said as COMF-ta-ble', category: 'Common Words', color: ['#FFD93D', '#F4A261'] },
  { word: 'Develop', phonetic: '/dɪˈveləp/', difficulty: 'Easy', tip: 'Stress on second syllable: de-VEL-op', category: 'Easy', color: ['#6BCF7F', '#4CAF50'] },
  { word: 'Wednesday', phonetic: '/ˈwenzdeɪ/', difficulty: 'Medium', tip: 'Silent "d": WENZ-day', category: 'Common Words', color: ['#64B5F6', '#2196F3'] },
  { word: 'Chocolate', phonetic: '/ˈtʃɒklət/', difficulty: 'Easy', tip: 'Two syllables: CHOK-let', category: 'Easy', color: ['#FFB6C1', '#FF69B4'] },
  { word: 'February', phonetic: '/ˈfebruəri/', difficulty: 'Medium', tip: 'Don\'t skip the first "r": FEB-roo-ary', category: 'Common Words', color: ['#87CEEB', '#4682B4'] },
  { word: 'Queue', phonetic: '/kjuː/', difficulty: 'Medium', tip: 'Just sounds like "Q"', category: 'Common Words', color: ['#DDA0DD', '#BA55D3'] },
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
  const [showWordDetails, setShowWordDetails] = useState(false);

  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const recordingPathRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;

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
          if (daysAgo > 0) {
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
            lastCompletedDate: data.lastCompletedDate || '',
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
        const progress = snapshot.val();
        setTodayProgress(progress);
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
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [calculateStatsFromHistory]);

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUserName(user.displayName || 'User');
      loadUserData(user.uid);
    }

    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 20,
      friction: 7,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 3000,
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

      const todayDate = getTodayDateString();
      const newAttempts = todayProgress.attempts + 1;
      const newBestScore = Math.max(todayProgress.bestScore, accuracy);
      const isCompleted = accuracy >= 0.8;

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

      const dailyWordsRef = ref(database, `users/${user.uid}/dailyWords`);
      const snapshot = await get(dailyWordsRef);
      
      if (snapshot.exists()) {
        const allDailyWords = snapshot.val();
        await calculateStatsFromHistory(allDailyWords, user.uid);
      }
    } catch (error) {
      console.error('Error updating progress:', error);
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

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      {/* Decorative Background */}
      <View style={styles.backgroundDecor}>
        <Animated.View style={[styles.decorCircle1, { transform: [{ rotate: rotation }] }]} />
        <Animated.View style={[styles.decorCircle2, { transform: [{ rotate: rotation }] }]} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {userName}! 👋</Text>
            <Text style={styles.subtitle}>Ready for today's challenge?</Text>
          </View>
          <View style={styles.streakBadge}>
            <LinearGradient
              colors={['#FF6B35', '#F7931E']}
              style={styles.streakGradient}
            >
              <Icon name="local-fire-department" size={28} color="#FFFFFF" />
              <Text style={styles.streakText}>{stats.streak}</Text>
            </LinearGradient>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.quickStatItem}>
            <View style={[styles.quickStatIcon, { backgroundColor: '#E8F5E9' }]}>
              <Icon name="check-circle" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickStatValue}>{stats.totalWords}</Text>
            <Text style={styles.quickStatLabel}>Words</Text>
          </View>
          
          <View style={styles.quickStatDivider} />
          
          <View style={styles.quickStatItem}>
            <View style={[styles.quickStatIcon, { backgroundColor: '#EDE7F6' }]}>
              <Icon name="analytics" size={24} color="#6366F1" />
            </View>
            <Text style={styles.quickStatValue}>{Math.round(stats.accuracy * 100)}%</Text>
            <Text style={styles.quickStatLabel}>Accuracy</Text>
          </View>
        </View>

        {!showResult ? (
          <>
            {/* Main Word Card */}
            <Animated.View style={[styles.mainCard, { transform: [{ scale: scaleAnim }] }]}>
              <TouchableOpacity
                activeOpacity={0.95}
                onPress={() => {
                  setShowWordDetails(!showWordDetails);
                  Haptics.selectionAsync();
                }}
              >
                <LinearGradient
                  colors={todayWord.color}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.wordCardGradient}
                >
                  {/* Completion Badge */}
                  {todayProgress?.completed && (
                    <View style={styles.completedBadge}>
                      <Icon name="verified" size={28} color="#FFD700" />
                    </View>
                  )}

                  {/* Category Tag */}
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryText}>{todayWord.category}</Text>
                  </View>

                  {/* Word Display */}
                  <View style={styles.wordDisplay}>
                    <Text style={styles.mainWord}>{todayWord.word}</Text>
                    <Text style={styles.phonetic}>{todayWord.phonetic}</Text>
                  </View>

                  {/* Difficulty Badge */}
                  <View style={[
                    styles.difficultyBadge,
                    { backgroundColor: 'rgba(255, 255, 255, 0.3)' }
                  ]}>
                    <View style={[
                      styles.difficultyDot,
                      { backgroundColor: getDifficultyColor(todayWord.difficulty) }
                    ]} />
                    <Text style={styles.difficultyText}>{todayWord.difficulty}</Text>
                  </View>

                  {/* Progress Indicator */}
                  {todayProgress && todayProgress.attempts > 0 && (
                    <View style={styles.progressIndicator}>
                      <View style={styles.progressItem}>
                        <Icon name="replay" size={18} color="#FFFFFF" />
                        <Text style={styles.progressItemText}>{todayProgress.attempts} tries</Text>
                      </View>
                      <View style={styles.progressItem}>
                        <Icon name="star" size={18} color="#FFD700" />
                        <Text style={styles.progressItemText}>Best: {Math.round(todayProgress.bestScore * 100)}%</Text>
                      </View>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Expandable Tip Section */}
            {showWordDetails && (
              <Animated.View style={styles.tipSection}>
                <View style={styles.tipContainer}>
                  <View style={styles.tipIconContainer}>
                    <Icon name="lightbulb" size={24} color="#F59E0B" />
                  </View>
                  <View style={styles.tipContent}>
                    <Text style={styles.tipTitle}>Pronunciation Tip</Text>
                    <Text style={styles.tipText}>{todayWord.tip}</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.listenButton}
                onPress={playWordPronunciation}
                disabled={playingAudio}
              >
                <View style={[styles.actionButton, { backgroundColor: '#E3F2FD' }]}>
                  <Icon 
                    name={playingAudio ? 'volume-up' : 'headset'} 
                    size={28} 
                    color="#2196F3" 
                  />
                  <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>
                    {playingAudio ? 'Playing' : 'Listen'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.detailsButton}
                onPress={() => {
                  setShowWordDetails(!showWordDetails);
                  Haptics.selectionAsync();
                }}
              >
                <View style={[styles.actionButton, { backgroundColor: '#F3E5F5' }]}>
                  <Icon 
                    name={showWordDetails ? 'expand-less' : 'expand-more'} 
                    size={28} 
                    color="#9C27B0" 
                  />
                  <Text style={[styles.actionButtonText, { color: '#9C27B0' }]}>
                    {showWordDetails ? 'Hide' : 'Tips'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Practice Section */}
            <View style={styles.practiceSection}>
              <Text style={styles.practiceTitle}>Start Practicing</Text>
              
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
                      activeOpacity={0.9}
                    >
                      <LinearGradient
                        colors={isRecording ? ['#EF4444', '#DC2626'] : ['#6366F1', '#8B5CF6', '#EC4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.recordGradient}
                      >
                        <View style={styles.recordInner}>
                          <Icon 
                            name={isRecording ? 'stop-circle' : 'mic'} 
                            size={64} 
                            color="#FFFFFF" 
                          />
                        </View>
                      </LinearGradient>
                      {isRecording && (
                        <View style={styles.recordingIndicator}>
                          <View style={styles.recordingDot} />
                        </View>
                      )}
                    </TouchableOpacity>
                  </Animated.View>
                  
                  {isRecording && (
                    <Text style={styles.recordingTime}>{recordingTime}</Text>
                  )}
                  
                  <Text style={styles.recordHint}>
                    {isRecording ? 'Recording... Tap to stop' : 'Tap the microphone to record'}
                  </Text>
                </>
              )}
            </View>
          </>
        ) : (
          /* Result Card */
          <View style={styles.resultContainer}>
            <LinearGradient
              colors={result && result.accuracy >= 0.8 
                ? ['#10B981', '#059669', '#047857'] 
                : result && result.accuracy >= 0.7
                ? ['#F59E0B', '#D97706', '#B45309']
                : ['#EF4444', '#DC2626', '#B91C1C']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.resultGradient}
            >
              {/* Result Icon */}
              <View style={styles.resultIconContainer}>
                <Icon 
                  name={
                    result && result.accuracy >= 0.8 ? 'emoji-events' :
                    result && result.accuracy >= 0.7 ? 'thumb-up' : 'psychology'
                  } 
                  size={80} 
                  color="#FFFFFF" 
                />
              </View>

              {/* Message */}
              <Text style={styles.resultMessage}>
                {result && result.accuracy >= 0.9 ? 'Perfect! 🌟' :
                 result && result.accuracy >= 0.8 ? 'Excellent! 🎉' :
                 result && result.accuracy >= 0.7 ? 'Good Job! 💪' :
                 'Keep Practicing! 📚'}
              </Text>

              {/* Score Display */}
              <View style={styles.scoreDisplay}>
                <Text style={styles.scoreNumber}>
                  {result && Math.round(result.accuracy * 100)}
                </Text>
                <Text style={styles.scorePercent}>%</Text>
              </View>
              <Text style={styles.scoreLabel}>Accuracy Score</Text>

              {/* Details Grid */}
              <View style={styles.detailsGrid}>
                <View style={styles.detailCard}>
                  <Icon name="check-circle" size={32} color="#FFFFFF" />
                  <Text style={styles.detailValue}>{result?.correct_phonemes || 0}</Text>
                  <Text style={styles.detailLabel}>Correct</Text>
                </View>
                <View style={styles.detailCard}>
                  <Icon name="error" size={32} color="#FFFFFF" />
                  <Text style={styles.detailValue}>
                    {result ? result.total_phonemes - result.correct_phonemes : 0}
                  </Text>
                  <Text style={styles.detailLabel}>Errors</Text>
                </View>
              </View>

              {/* Feedback */}
              <View style={styles.feedbackCard}>
                <Text style={styles.feedbackTitle}>AI Feedback:</Text>
                <Text style={styles.feedbackText}>{result?.feedback}</Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.resultButtons}>
                <TouchableOpacity 
                  style={styles.continueButton}
                  onPress={handleTryAgain}
                >
                  <View style={styles.continueInner}>
                    <Icon name="refresh" size={24} color="#6366F1" />
                    <Text style={styles.continueText}>Try Again</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  backgroundDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -50,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    top: 100,
    left: -30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
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
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  streakGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  streakText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  quickStats: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  mainCard: {
    marginHorizontal: 20,
    borderRadius: 32,
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  wordCardGradient: {
    padding: 32,
    borderRadius: 32,
    position: 'relative',
  },
  completedBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  wordDisplay: {
    alignItems: 'center',
    marginBottom: 20,
  },
  mainWord: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: -1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  phonetic: {
    fontSize: 20,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  difficultyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  difficultyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  progressIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 20,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  progressItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tipSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  tipContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  tipIconContainer: {
    marginRight: 12,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#92400E',
    marginBottom: 6,
  },
  tipText: {
    fontSize: 14,
    color: '#78350F',
    fontWeight: '500',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  listenButton: {
    flex: 1,
  },
  detailsButton: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  practiceSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  practiceTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 24,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  processingText: {
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  recordButton: {
    position: 'relative',
    marginBottom: 16,
  },
  recordGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    padding: 8,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  recordInner: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  recordingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  recordingTime: {
    fontSize: 32,
    fontWeight: '900',
    color: '#EF4444',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  recordHint: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  resultContainer: {
    marginHorizontal: 20,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 16,
  },
  resultGradient: {
    padding: 40,
    alignItems: 'center',
  },
  resultIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultMessage: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 32,
    textAlign: 'center',
    letterSpacing: -1,
  },
  scoreDisplay: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  scoreNumber: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -3,
    lineHeight: 72,
  },
  scorePercent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 32,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
    width: '100%',
  },
  detailCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  detailValue: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  feedbackCard: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 28,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  feedbackText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 22,
  },
  resultButtons: {
    width: '100%',
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  continueInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  continueText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6366F1',
  },
});
