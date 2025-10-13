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
  { word: 'Beautiful', phonetic: '/ˈbjuːtɪfəl/', difficulty: 'Medium', tip: 'Stress on first syllable: BEAU-ti-ful', level: 1 },
  { word: 'Pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃən/', difficulty: 'Hard', tip: 'Watch the "nun-see-AY-shun" pattern', level: 2 },
  { word: 'Schedule', phonetic: '/ˈʃedjuːl/', difficulty: 'Hard', tip: 'UK: SHED-yool, US: SKED-yool', level: 3 },
  { word: 'Algorithm', phonetic: '/ˈælɡərɪðəm/', difficulty: 'Hard', tip: 'Stress on first syllable: AL-go-rith-m', level: 4 },
  { word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', difficulty: 'Medium', tip: 'Often said as COMF-ta-ble', level: 5 },
  { word: 'Develop', phonetic: '/dɪˈveləp/', difficulty: 'Easy', tip: 'Stress on second syllable: de-VEL-op', level: 6 },
  { word: 'Wednesday', phonetic: '/ˈwenzdeɪ/', difficulty: 'Medium', tip: 'Silent "d": WENZ-day', level: 7 },
  { word: 'Chocolate', phonetic: '/ˈtʃɒklət/', difficulty: 'Easy', tip: 'Two syllables: CHOK-let', level: 8 },
  { word: 'February', phonetic: '/ˈfebruəri/', difficulty: 'Medium', tip: 'Don\'t skip the first "r": FEB-roo-ary', level: 9 },
  { word: 'Queue', phonetic: '/kjuː/', difficulty: 'Medium', tip: 'Just sounds like "Q"', level: 10 },
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
  xp: number;
  level: number;
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
    xp: 0,
    level: 1,
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
  const floatAnim = useRef(new Animated.Value(0)).current;
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

  const calculateStatsFromHistory = useCallback(async (allDailyWords: any, userId: string) => {
    try {
      const dates = Object.keys(allDailyWords);
      let wordsAttempted = 0;
      let totalAccuracy = 0;
      let accuracyCount = 0;
      let currentStreak = 0;
      let lastAttemptDate = '';
      let totalXP = 0;

      dates.forEach(date => {
        const dayData = allDailyWords[date];
        
        if (dayData && dayData.attempts > 0) {
          wordsAttempted++;
          
          if (dayData.bestScore && dayData.bestScore > 0) {
            totalAccuracy += dayData.bestScore;
            accuracyCount++;
            // Award XP based on accuracy
            totalXP += Math.round(dayData.bestScore * 100);
          }
        }
      });

      const averageAccuracy = accuracyCount > 0 ? totalAccuracy / accuracyCount : 0;

      // Calculate streak
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

      const level = Math.floor(totalXP / 500) + 1;

      const newStats: UserStats = {
        streak: currentStreak,
        totalWords: wordsAttempted,
        accuracy: averageAccuracy,
        lastCompletedDate: lastAttemptDate,
        xp: totalXP,
        level: level,
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
            xp: data.xp || 0,
            level: data.level || 1,
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
  }, []);

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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const getAccuracyMessage = (accuracy: number) => {
    if (accuracy >= 0.9) return 'Perfect! 🎉';
    if (accuracy >= 0.8) return 'Amazing! 🌟';
    if (accuracy >= 0.7) return 'Great! 💪';
    return 'Keep trying! 📚';
  };

  const formatAccuracy = (accuracy: number) => {
    return `${(accuracy * 100).toFixed(0)}%`;
  };

  const floatY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });

  const currentXP = stats.xp % 500;
  const xpForNextLevel = 500;
  const xpProgress = (currentXP / xpForNextLevel) * 100;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#58CC02', '#48A302']}
        style={styles.headerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.streakContainer}>
              <Icon name="local-fire-department" size={24} color="#FF9600" />
              <Text style={styles.streakNumber}>{stats.streak}</Text>
            </View>
            
            <View style={styles.xpContainer}>
              <Icon name="stars" size={20} color="#FFD700" />
              <Text style={styles.xpText}>{stats.xp}</Text>
            </View>
          </View>

          <View style={styles.levelContainer}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Level {stats.level}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBackground}>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressBarFill, { width: `${xpProgress}%` }]}
                />
              </View>
              <Text style={styles.progressText}>{currentXP}/{xpForNextLevel} XP</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!showResult ? (
          <>
            {/* Learning Path */}
            <View style={styles.pathContainer}>
              {/* Today's Challenge Title */}
              <View style={styles.challengeHeader}>
                <Icon name="emoji-events" size={28} color="#FFD700" />
                <Text style={styles.challengeTitle}>Today's Challenge</Text>
                <Icon name="emoji-events" size={28} color="#FFD700" />
              </View>

              {/* Main Word Node */}
              <Animated.View style={[styles.wordNode, { transform: [{ translateY: floatY }] }]}>
                <LinearGradient
                  colors={todayProgress?.completed ? ['#10B981', '#059669'] : ['#1CB0F6', '#1899D6']}
                  style={styles.nodeGradient}
                >
                  {todayProgress?.completed && (
                    <View style={styles.completedStar}>
                      <Icon name="star" size={40} color="#FFD700" />
                    </View>
                  )}
                  
                  <View style={styles.nodeContent}>
                    <View style={[
                      styles.difficultyPill,
                      { backgroundColor: `${getDifficultyColor(todayWord.difficulty)}40` }
                    ]}>
                      <Text style={[
                        styles.difficultyText,
                        { color: getDifficultyColor(todayWord.difficulty) }
                      ]}>
                        {todayWord.difficulty}
                      </Text>
                    </View>
                    
                    <Text style={styles.nodeWord}>{todayWord.word}</Text>
                    <Text style={styles.nodePhonetic}>{todayWord.phonetic}</Text>
                    
                    {todayProgress && todayProgress.attempts > 0 && (
                      <View style={styles.nodeStats}>
                        <View style={styles.nodeStat}>
                          <Icon name="refresh" size={16} color="#FFFFFF" />
                          <Text style={styles.nodeStatText}>{todayProgress.attempts}</Text>
                        </View>
                        <View style={styles.nodeStat}>
                          <Icon name="trending-up" size={16} color="#FFFFFF" />
                          <Text style={styles.nodeStatText}>{formatAccuracy(todayProgress.bestScore)}</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </Animated.View>

              {/* Tip Card */}
              <View style={styles.tipCard}>
                <View style={styles.tipHeader}>
                  <Icon name="lightbulb" size={24} color="#FFA500" />
                  <Text style={styles.tipTitle}>Pro Tip</Text>
                </View>
                <Text style={styles.tipText}>{todayWord.tip}</Text>
              </View>

              {/* Listen Button */}
              <TouchableOpacity
                style={styles.listenButton}
                onPress={playWordPronunciation}
                disabled={playingAudio}
              >
                <LinearGradient
                  colors={['#CE82FF', '#A869E5']}
                  style={styles.listenGradient}
                >
                  <Icon name={playingAudio ? 'volume-up' : 'headphones'} size={24} color="#FFFFFF" />
                  <Text style={styles.listenText}>
                    {playingAudio ? 'Playing...' : 'Listen to Pronunciation'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Record Button */}
              <View style={styles.recordSection}>
                {isProcessing ? (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color="#1CB0F6" />
                    <Text style={styles.processingText}>Analyzing...</Text>
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
                          colors={isRecording ? ['#FF4B4B', '#E63946'] : ['#58CC02', '#48A302']}
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
                      {isRecording ? 'Tap to stop' : 'Tap to practice'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          </>
        ) : (
          /* Result Screen */
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
              colors={result && result.accuracy >= 0.8 ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
              style={styles.resultGradient}
            >
              {/* Mascot/Icon */}
              <View style={styles.resultIconContainer}>
                <Icon 
                  name={result && result.accuracy >= 0.8 ? 'celebration' : 'emoji-events'} 
                  size={80} 
                  color="#FFFFFF" 
                />
              </View>

              <Text style={styles.resultMessage}>
                {result && getAccuracyMessage(result.accuracy)}
              </Text>

              {/* Score */}
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreValue}>
                  {result && formatAccuracy(result.accuracy)}
                </Text>
                <Text style={styles.scoreLabel}>Accuracy</Text>
              </View>

              {/* XP Earned */}
              <View style={styles.xpEarned}>
                <Icon name="stars" size={32} color="#FFD700" />
                <Text style={styles.xpEarnedText}>+{result ? Math.round(result.accuracy * 100) : 0} XP</Text>
              </View>

              {/* Phonemes */}
              <View style={styles.phonemeStats}>
                <View style={styles.phonemeStat}>
                  <Icon name="check-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.phonemeStatText}>
                    {result?.correct_phonemes || 0} correct
                  </Text>
                </View>
                <View style={styles.phonemeStat}>
                  <Icon name="cancel" size={24} color="#FFFFFF" />
                  <Text style={styles.phonemeStatText}>
                    {result ? result.total_phonemes - result.correct_phonemes : 0} errors
                  </Text>
                </View>
              </View>

              {/* Feedback */}
              <View style={styles.feedbackBox}>
                <Text style={styles.feedbackText}>{result?.feedback}</Text>
              </View>

              {/* Actions */}
              <View style={styles.resultActions}>
                <TouchableOpacity 
                  style={styles.tryAgainButton}
                  onPress={handleTryAgain}
                >
                  <Icon name="refresh" size={24} color="#FFFFFF" />
                  <Text style={styles.tryAgainText}>Practice Again</Text>
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
    backgroundColor: '#FFFFFF',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  streakNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  xpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  xpText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  levelContainer: {
    gap: 8,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  progressBarContainer: {
    gap: 6,
  },
  progressBarBackground: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  pathContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    alignItems: 'center',
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  challengeTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  wordNode: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 32,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  nodeGradient: {
    padding: 32,
    borderRadius: 32,
    position: 'relative',
  },
  completedStar: {
    position: 'absolute',
    top: -20,
    right: -10,
  },
  nodeContent: {
    alignItems: 'center',
  },
  difficultyPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  difficultyText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nodeWord: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: -1,
  },
  nodePhonetic: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  nodeStats: {
    flexDirection: 'row',
    gap: 20,
  },
  nodeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  nodeStatText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  tipCard: {
    backgroundColor: '#FFF9E6',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FFE066',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  tipTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#B8860B',
  },
  tipText: {
    fontSize: 15,
    color: '#8B7355',
    fontWeight: '600',
    lineHeight: 22,
  },
  listenButton: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: '#A869E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listenGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  listenText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  recordSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '700',
    color: '#1CB0F6',
  },
  recordButton: {
    marginBottom: 16,
    borderRadius: 90,
    shadowColor: '#58CC02',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  recordGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 6,
    borderColor: '#FFFFFF',
  },
  recordingTime: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF4B4B',
    marginBottom: 8,
    fontVariant: ['tabular-nums'],
  },
  recordLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  resultCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  resultGradient: {
    padding: 32,
    alignItems: 'center',
  },
  resultIconContainer: {
    marginBottom: 20,
  },
  resultMessage: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 6,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  xpEarned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 24,
  },
  xpEarnedText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  phonemeStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  phonemeStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
  },
  phonemeStatText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  feedbackBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    marginBottom: 24,
  },
  feedbackText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  resultActions: {
    width: '100%',
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tryAgainText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#58CC02',
  },
});
