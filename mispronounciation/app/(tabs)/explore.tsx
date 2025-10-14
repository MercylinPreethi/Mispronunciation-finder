// app/(tabs)/explore.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  ScrollView,
  Animated,
} from 'react-native';
import AudioRecorderPlayer, {
  AudioEncoderAndroidType,
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption
} from 'react-native-audio-recorder-player';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, set, get } from 'firebase/database';
import { auth, database } from '@/lib/firebase';

const audioRecorderPlayer = new AudioRecorderPlayer();

// Types
interface WordAudioData {
  audio_base64: string;
  status: 'correct' | 'partial' | 'mispronounced';
  pronunciation_status: string;
  needs_practice: boolean;
}

interface AudioData {
  word_audio: { [key: string]: WordAudioData };
  sentence_audio?: {
    audio_base64: string;
    text: string;
    type: string;
  };
  audio_generation_success: boolean;
  generated_count: number;
  failed_count: number;
}

interface WordPhonemeData {
  word: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  phoneme_errors: any[];
  per: number;
  accuracy?: number;
}

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: any[];
  audio_data?: AudioData;
  word_phonemes?: {
    reference_text: string;
    words: WordPhonemeData[];
  };
  word_level_analysis?: {
    word_phoneme_mapping: WordPhonemeData[];
  };
}

interface PracticeAttempt {
  id: string;
  timestamp: Date;
  audioPath: string;
  audioUrl?: string;
  scores: AnalysisResult;
  feedback: string;
  source: 'recording' | 'upload';
  fileName?: string;
  mispronuncedWords: string[];
  correctlyPronuncedWords: string[];
}

const API_BASE_URL = 'http://192.168.14.34:5050';
const CLOUDINARY_CLOUD_NAME = 'dc8kh6npf';

const generateSessionId = (referenceText: string): string => {
  const timestamp = Date.now();
  const textHash = referenceText.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `${textHash}_${timestamp}`;
};

const playBase64Audio = async (
  base64Audio: string, 
  word: string, 
  setPlayingWord: (word: string | null) => void
) => {
  try {
    const tempPath = `${RNFS.DocumentDirectoryPath}/temp_pronunciation_${word}_${Date.now()}.wav`;
    await RNFS.writeFile(tempPath, base64Audio, 'base64');
    
    const fileExists = await RNFS.exists(tempPath);
    if (!fileExists) {
      throw new Error('Failed to create temporary audio file');
    }
    
    setPlayingWord(word);
    await audioRecorderPlayer.startPlayer(tempPath);
    
    audioRecorderPlayer.addPlayBackListener((e) => {
      if (e.currentPosition >= e.duration) {
        audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(null);
        
        RNFS.unlink(tempPath).catch(err => 
          console.warn('Could not delete temporary audio file:', err)
        );
      }
    });
  } catch (error) {
    console.error(`Error playing pronunciation audio for "${word}":`, error);
    setPlayingWord(null);
  }
};

const PronunciationWord = ({ 
  word, 
  status, 
  audioData, 
  playingWord, 
  setPlayingWord
}: {
  word: string;
  status: 'correct' | 'partial' | 'mispronounced';
  audioData?: WordAudioData;
  playingWord: string | null;
  setPlayingWord: (word: string | null) => void;
}) => {
  const getWordColor = (status: string) => {
    switch (status) {
      case 'correct': return '#10B981';
      case 'partial': return '#F59E0B';
      case 'mispronounced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getWordBackgroundColor = (status: string) => {
    switch (status) {
      case 'correct': return '#D1FAE5';
      case 'partial': return '#FEF3C7';
      case 'mispronounced': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const handleWordPress = async () => {
    try {
      Haptics.selectionAsync();
      
      if (playingWord === word) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(null);
        return;
      }
      
      if (playingWord) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      }

      if (audioData && audioData.audio_base64) {
        await playBase64Audio(audioData.audio_base64, word, setPlayingWord);
      } else {
        try {
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
            await playBase64Audio(base64Audio, word, setPlayingWord);
          }
        } catch (apiError) {
          console.error('API word audio request failed:', apiError);
          Alert.alert(
            'Audio Not Available',
            `Pronunciation audio for "${word}" is not available.`
          );
        }
      }
    } catch (error) {
      console.error('Error in word press handler:', error);
      setPlayingWord(null);
    }
  };

  const isPlaying = playingWord === word;

  return (
    <TouchableOpacity
      style={[
        styles.pronunciationWordButton,
        {
          backgroundColor: getWordBackgroundColor(status),
          borderColor: getWordColor(status),
          borderWidth: isPlaying ? 2 : 1,
        }
      ]}
      onPress={handleWordPress}
    >
      <Text style={[
        styles.pronunciationWordText,
        { 
          color: getWordColor(status),
          fontWeight: isPlaying ? '700' : '600'
        }
      ]}>
        {word}
        {isPlaying && ' 🔊'}
      </Text>
    </TouchableOpacity>
  );
};

const SimplifiedWordTable = ({ 
  attempt, 
  playingWord, 
  setPlayingWord,
  onWordRecord,
  isRecording,
  recordingWord,
  isProcessing,
  referenceText
}: { 
  attempt: PracticeAttempt;
  playingWord: string | null;
  setPlayingWord: (word: string | null) => void;
  onWordRecord: (word: string) => void;
  isRecording: boolean;
  recordingWord: string | null;
  isProcessing: boolean;
  referenceText: string;
}) => {
  const audioData = attempt.scores.audio_data;
  
  // Get word-level data
  const wordPhonemeData =
    attempt.scores?.word_level_analysis?.word_phoneme_mapping || [];
  
  console.log('🎨 Rendering table with word data:', JSON.stringify(wordPhonemeData, null, 2));
  
  if (wordPhonemeData.length === 0) {
    console.error('❌ NO WORD DATA AVAILABLE!');
    return (
      <View style={styles.simplifiedTableContainer}>
        <Text style={{ padding: 20, color: 'red', textAlign: 'center' }}>
          No word-level analysis data available. Check backend response.
        </Text>
      </View>
    );
  }
  
  // Calculate accuracy from PER - NO FALLBACK
  const getWordAccuracy = (wordData: any): number => {
    console.log(`Calculating accuracy for "${wordData.word}":`, {
        accuracy: wordData.accuracy,
        per: wordData.per,
        status: wordData.status
    });
    
    // Priority 1: Use direct accuracy field (0-100 scale from backend)
    if (typeof wordData.accuracy === 'number') {
        const accuracy = wordData.accuracy / 100; // Convert 100 to 1.0
        console.log(`  ✅ Using direct accuracy: ${wordData.accuracy} -> ${accuracy}`);
        return accuracy;
    }
    
    // Priority 2: Calculate from per object
    if (wordData.per && typeof wordData.per.per === 'number') {
        const accuracy = 1 - (wordData.per.per / 100); // per.per is 0-100 scale
        console.log(`  ✅ Calculated from PER: ${wordData.per.per} -> ${accuracy}`);
        return accuracy;
    }
    
    // Priority 3: Calculate from aligned phonemes
    if (wordData.aligned_reference && wordData.aligned_predicted) {
        let matches = 0;
        const refPhonemes = wordData.aligned_reference;
        const predPhonemes = wordData.aligned_predicted;
        const length = Math.max(refPhonemes.length, predPhonemes.length);
        
        for (let i = 0; i < Math.min(refPhonemes.length, predPhonemes.length); i++) {
        if (refPhonemes[i] === predPhonemes[i] && refPhonemes[i] !== '_') {
            matches++;
        }
        }
        
        const refLength = refPhonemes.filter((p: string) => p !== '_').length;
        const accuracy = refLength > 0 ? matches / refLength : 0;
        console.log(`  ✅ Calculated from aligned phonemes: ${matches}/${refLength} = ${accuracy}`);
        return accuracy;
    }
    
    console.error(`  ❌ NO ACCURACY DATA for "${wordData.word}"!`, wordData);
    return 0;
    };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'correct': return '#10B981';
      case 'partial': return '#F59E0B';
      case 'mispronounced': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusBackground = (status: string) => {
    switch (status) {
      case 'correct': return '#D1FAE5';
      case 'partial': return '#FEF3C7';
      case 'mispronounced': return '#FEE2E2';
      default: return '#F3F4F6';
    }
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(0)}%`;
  };

  // Filter words needing practice
  const displayWordData = wordPhonemeData.filter((wordData: any) => {
    return wordData.status === 'mispronounced' || wordData.status === 'partial';
  });

  const handleWordAudioPlay = async (word: string, audioData?: WordAudioData) => {
    try {
      Haptics.selectionAsync();
      
      if (playingWord === word) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(null);
        return;
      }
      
      if (playingWord) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      }

      if (audioData && audioData.audio_base64) {
        await playBase64Audio(audioData.audio_base64, word, setPlayingWord);
      } else {
        try {
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
            await playBase64Audio(base64Audio, word, setPlayingWord);
          }
        } catch (apiError) {
          console.error('API word audio request failed:', apiError);
          Alert.alert('Audio Not Available', `Pronunciation audio for "${word}" is not available.`);
        }
      }
    } catch (error) {
      console.error('Error playing word audio:', error);
      setPlayingWord(null);
    }
  };

  return (
    <View style={styles.simplifiedTableContainer}>
      {/* Word Status Overview */}
      <View style={styles.wordBoxesContainer}>
        <Text style={styles.wordBoxesTitle}>Word Pronunciation Status:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wordBoxesScrollContent}
        >
          <View style={styles.wordBoxes}>
            {wordPhonemeData.map((wordData: any, index: number) => {
              const status = wordData.status;
              const accuracy = getWordAccuracy(wordData);
              
              return (
                <View 
                  key={`${wordData.word}-${index}`}
                  style={[
                    styles.wordBox,
                    { 
                      backgroundColor: getStatusBackground(status),
                      borderColor: getStatusColor(status),
                      borderWidth: 2
                    }
                  ]}
                >
                  <Text style={[
                    styles.wordBoxText,
                    { color: getStatusColor(status), fontWeight: '700' }
                  ]}>
                    {wordData.word}
                  </Text>
                  <Text style={[
                    styles.wordBoxAccuracy,
                    { color: getAccuracyColor(accuracy), fontWeight: '800' }
                  ]}>
                    {formatAccuracy(accuracy)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
        
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColorBox, { backgroundColor: '#D1FAE5', borderColor: '#10B981', borderWidth: 2 }]} />
            <Text style={styles.legendText}>Correct</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColorBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B', borderWidth: 2 }]} />
            <Text style={styles.legendText}>Partial</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColorBox, { backgroundColor: '#FEE2E2', borderColor: '#EF4444', borderWidth: 2 }]} />
            <Text style={styles.legendText}>Mispronounced</Text>
          </View>
        </View>
      </View>

      {/* Words Needing Practice Table */}
      <View style={styles.tableSection}>
        <Text style={styles.tableSectionTitle}>
          Words Needing Practice ({displayWordData.length})
        </Text>
        
        {displayWordData.length > 0 ? (
          <View style={styles.tableContainer}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Word</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Accuracy</Text>
              <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Listen</Text>
              <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Record</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>Status</Text>
            </View>

            <ScrollView style={styles.tableRowsContainer}>
              {displayWordData.map((wordData: any, index: number) => {
                const wordAudioData = audioData?.word_audio?.[wordData.word];
                const isRecordingThisWord = isRecording && recordingWord === wordData.word;
                const accuracy = getWordAccuracy(wordData);
                const status = wordData.status;
                const statusColor = getStatusColor(status);
                
                return (
                  <View key={`${wordData.word}-${index}`} style={styles.tableRow}>
                    <View style={[styles.tableCell, { flex: 1.2 }]}>
                      <Text style={[styles.wordText, { color: statusColor, fontWeight: '700', fontSize: 15 }]}>
                        {wordData.word}
                      </Text>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <View style={[
                        styles.accuracyBadge,
                        { 
                          backgroundColor: getAccuracyColor(accuracy) + '20',
                          borderWidth: 1,
                          borderColor: getAccuracyColor(accuracy)
                        }
                      ]}>
                        <Text style={[
                          styles.accuracyText,
                          { color: getAccuracyColor(accuracy), fontWeight: '800', fontSize: 12 }
                        ]}>
                          {formatAccuracy(accuracy)}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 0.8 }]}>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          playingWord === wordData.word && { backgroundColor: '#6366F1' }
                        ]}
                        onPress={() => handleWordAudioPlay(wordData.word, wordAudioData)}
                        disabled={isRecording || isProcessing}
                      >
                        <Text style={styles.iconText}>
                          {playingWord === wordData.word ? '⏸️' : '🔊'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 0.8 }]}>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          isRecordingThisWord && styles.recordingButton
                        ]}
                        onPress={() => onWordRecord(wordData.word)}
                        disabled={isProcessing || (isRecording && !isRecordingThisWord)}
                      >
                        <Text style={styles.iconText}>
                          {isRecordingThisWord ? '⏹️' : '🎤'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    <View style={[styles.tableCell, { flex: 1 }]}>
                      <View style={[
                        styles.statusBadge,
                        { 
                          backgroundColor: getStatusBackground(status),
                          borderWidth: 1,
                          borderColor: statusColor
                        }
                      ]}>
                        <Text style={[styles.statusText, { color: statusColor, fontWeight: '700' }]}>
                          {status === 'mispronounced' ? 'Practice' : 'Improve'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.allCorrectContainer}>
            <Text style={styles.allCorrectIcon}>🎉</Text>
            <Text style={styles.allCorrectTitle}>Perfect Pronunciation!</Text>
            <Text style={styles.allCorrectText}>
              All words were pronounced correctly with 100% accuracy!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default function RecordingScreen() {
  const params = useLocalSearchParams();
  const { sessionId, referenceText, isNew } = params;
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [latestAttempt, setLatestAttempt] = useState<PracticeAttempt | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [recordingWord, setRecordingWord] = useState<string | null>(null);
  const [wordUpdates, setWordUpdates] = useState<{[key: string]: {status: 'correct' | 'mispronounced', accuracy: number}}>({});
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const insets = useSafeAreaInsets();
  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const recordingWordRef = useRef<string | null>(null);
  const recordingPathRef = useRef<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  // Load the latest attempt when opening an existing session
  useEffect(() => {
    const loadLatestAttempt = async () => {
      // Only load if we have a sessionId and it's not a new session
      if (!sessionId || isNew === 'true') {
        return;
      }

      const user = auth.currentUser;
      if (!user) {
        console.log('No authenticated user');
        return;
      }

      setIsLoadingSession(true);
      try {
        console.log(`Loading latest attempt for session: ${sessionId}`);
        
        // Fetch the session data from Firebase
        const sessionRef = ref(database, `users/${user.uid}/references/${sessionId}`);
        const snapshot = await get(sessionRef);
        
        if (snapshot.exists()) {
          const sessionData = snapshot.val();
          const attempts = sessionData.attempts || {};
          
          // Convert attempts object to array and sort by timestamp (most recent first)
          const attemptsArray = Object.keys(attempts).map(key => ({
            id: key,
            timestamp: new Date(attempts[key].timestamp),
            audioPath: attempts[key].audioPath,
            audioUrl: attempts[key].audioUrl,
            scores: attempts[key].scores,
            feedback: attempts[key].feedback,
            source: attempts[key].source,
            fileName: attempts[key].fileName,
            mispronuncedWords: attempts[key].mispronuncedWords || [],
            correctlyPronuncedWords: attempts[key].correctlyPronuncedWords || []
          })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          
          if (attemptsArray.length > 0) {
            const mostRecentAttempt = attemptsArray[0];
            console.log(`✅ Loaded most recent attempt from ${mostRecentAttempt.timestamp.toLocaleString()}`);
            console.log(`   Accuracy: ${(mostRecentAttempt.scores.accuracy * 100).toFixed(1)}%`);
            console.log(`   Mispronounced words: ${mostRecentAttempt.mispronuncedWords.length}`);
            setLatestAttempt(mostRecentAttempt);
          } else {
            console.log('No attempts found for this session');
          }
        } else {
          console.log('Session not found in database');
        }
      } catch (error) {
        console.error('Error loading latest attempt:', error);
        Alert.alert('Error', 'Failed to load session data. Please try again.');
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadLatestAttempt();
  }, [sessionId, isNew]);

  const handleBack = () => {
    router.back();
  };

  const uploadToCloudinary = async (audioPath: string, attemptId: string): Promise<string> => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user');

      console.log('Starting Cloudinary upload...');
      
      const fileExists = await RNFS.exists(audioPath);
      if (!fileExists) {
        throw new Error(`Audio file not found at path: ${audioPath}`);
      }
      
      const stats = await RNFS.stat(audioPath);
      console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty');
      }
      
      const audioData = await RNFS.readFile(audioPath, 'base64');
      
      if (!audioData) {
        throw new Error('Could not read audio file data');
      }
      
      const formData = new FormData();
      formData.append('file', `data:audio/wav;base64,${audioData}`);
      formData.append('upload_preset', 'dc8kh6npf');
      formData.append('public_id', `user_${user.uid}/pronunciation_audio_${attemptId}`);
      formData.append('resource_type', 'video');
      formData.append('folder', `pronunciation_coach/users/${user.uid}`);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      
      const result = await response.json();
      
      if (result.secure_url) {
        console.log('Upload successful');
        return result.secure_url;
      }
      
      throw new Error('Cloudinary upload failed: ' + (result.error?.message || JSON.stringify(result)));
      
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const path = `${RNFS.DocumentDirectoryPath}/recording_${Date.now()}.wav`;
      
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
      
      processAudio(result, 'recording');
      
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

  const handleUpload = async () => {
    try {
      Haptics.selectionAsync();
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        processAudio(file.uri, 'upload', file.name);
      }
    } catch (error) {
      console.error('File selection error:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
  };

  const processAudio = async (audioPath: string, source: 'recording' | 'upload', fileName?: string) => {
  setIsProcessing(true);
  
  try {
    let finalAudioPath = audioPath;
    let audioUrl = audioPath;
    let uploadSuccess = false;
    
    // Upload to Cloudinary
    try {
      const attemptId = Date.now().toString();
      audioUrl = await uploadToCloudinary(audioPath, attemptId);
      uploadSuccess = true;
      console.log('Cloudinary upload successful:', audioUrl);
    } catch (cloudinaryError) {
      console.warn('Cloudinary upload failed:', cloudinaryError);
      
      if (source === 'recording') {
        try {
          const permanentPath = `${RNFS.DocumentDirectoryPath}/recordings/recording_${Date.now()}.wav`;
          await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/recordings`);
          await RNFS.copyFile(audioPath, permanentPath);
          finalAudioPath = permanentPath;
          audioUrl = permanentPath;
          console.log('Audio copied to permanent location:', permanentPath);
        } catch (copyError) {
          console.error('Failed to copy recording:', copyError);
        }
      }
    }
    
    // Prepare form data
    const formData = new FormData();
    let mimeType = 'audio/wav';
    let audioFileName = source === 'recording' ? 'recording.wav' : (fileName || 'audio.wav');
    
    if (source === 'upload' && fileName) {
      const extension = fileName.toLowerCase().split('.').pop();
      switch (extension) {
        case 'mp3': mimeType = 'audio/mpeg'; break;
        case 'm4a': case 'mp4a': mimeType = 'audio/mp4'; break;
        case 'aac': mimeType = 'audio/aac'; break;
        case 'flac': mimeType = 'audio/flac'; break;
        case 'ogg': mimeType = 'audio/ogg'; break;
        default: mimeType = 'audio/wav';
      }
    }
    
    formData.append('audio_file', {
      uri: Platform.OS === 'ios' ? finalAudioPath : `file://${finalAudioPath}`,
      type: mimeType,
      name: audioFileName,
    } as any);
    formData.append('reference_text', referenceText as string);
    formData.append('use_llm_judge', 'true');
    formData.append('generate_audio', 'true');
    formData.append('filter_extraneous', 'true');
    
    console.log('🚀 Sending audio to pronunciation analysis API...');
    console.log('📝 Reference text:', referenceText);
    
    const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('BACKEND RESPONSE ANALYSIS');
    console.log('='.repeat(80));
    
    if (response.data.success) {
      console.log('✅ Analysis successful!');
      
      // Log top-level keys
      console.log('\n📦 Top-level response keys:');
      console.log(Object.keys(response.data));
      
      // Log each top-level property
      console.log('\n📋 Response structure:');
      Object.keys(response.data).forEach(key => {
        const value = response.data[key];
        if (typeof value === 'object' && value !== null) {
          console.log(`  ${key}: [Object] with keys:`, Object.keys(value));
        } else {
          console.log(`  ${key}:`, typeof value);
        }
      });
      
      // Check analysis object
      if (response.data.analysis) {
        console.log('\n📊 Analysis object keys:');
        console.log(Object.keys(response.data.analysis));
        
        if (response.data.analysis.word_level_analysis) {
          console.log('\n🔍 analysis.word_level_analysis keys:');
          console.log(Object.keys(response.data.analysis.word_level_analysis));
        }
      }
      
      // Check word_level_analysis
      if (response.data.word_level_analysis) {
        console.log('\n🔍 word_level_analysis object keys:');
        console.log(Object.keys(response.data.word_level_analysis));
        
        if (response.data.word_level_analysis.words) {
          console.log(`\n📝 word_level_analysis.words (${response.data.word_level_analysis.words.length} items):`);
          console.log(JSON.stringify(response.data.word_level_analysis.words.slice(0, 2), null, 2));
        }
        
        if (response.data.word_level_analysis.word_phoneme_mapping) {
          console.log(`\n📝 word_level_analysis.word_phoneme_mapping (${response.data.word_level_analysis.word_phoneme_mapping.length} items):`);
          console.log(JSON.stringify(response.data.word_level_analysis.word_phoneme_mapping.slice(0, 2), null, 2));
        }
      }
      
      // Check word_phonemes
      if (response.data.word_phonemes) {
        console.log('\n🔍 word_phonemes object keys:');
        console.log(Object.keys(response.data.word_phonemes));
        
        if (response.data.word_phonemes.words) {
          console.log(`\n📝 word_phonemes.words (${response.data.word_phonemes.words.length} items):`);
          console.log(JSON.stringify(response.data.word_phonemes.words.slice(0, 2), null, 2));
        }
      }
      
      console.log('\n' + '='.repeat(80));
      console.log('END BACKEND RESPONSE ANALYSIS');
      console.log('='.repeat(80) + '\n');
      
      // Now try to extract word data
      const analysisResult = response.data.analysis;
      let wordPhonemeMapping: any[] = [];
      
      // Try all possible locations
      const possibleLocations = [
        { path: 'word_level_analysis.word_phoneme_mapping', data: response.data.word_level_analysis?.word_phoneme_mapping },
        { path: 'word_level_analysis.words', data: response.data.word_level_analysis?.words },
        { path: 'word_phonemes.words', data: response.data.word_phonemes?.words },
        { path: 'analysis.word_level_analysis.word_phoneme_mapping', data: analysisResult?.word_level_analysis?.word_phoneme_mapping },
        { path: 'analysis.word_level_analysis.words', data: analysisResult?.word_level_analysis?.words },
      ];
      
      console.log('🔍 Checking all possible data locations:');
      possibleLocations.forEach(location => {
        if (location.data && Array.isArray(location.data) && location.data.length > 0) {
          console.log(`  ✅ ${location.path}: Found ${location.data.length} items`);
          if (wordPhonemeMapping.length === 0) {
            wordPhonemeMapping = location.data;
            console.log(`  🎯 Using data from: ${location.path}`);
          }
        } else {
          console.log(`  ❌ ${location.path}: ${location.data ? 'Empty or invalid' : 'Not found'}`);
        }
      });
      
      if (wordPhonemeMapping.length === 0) {
        console.error('\n❌ CRITICAL: NO WORD DATA FOUND IN ANY LOCATION!');
        console.error('Full response.data:', JSON.stringify(response.data, null, 2));
        
        Alert.alert(
          'Backend Data Error',
          'No word-level analysis data received from server. Please check server logs and ensure the backend is sending word_level_analysis data.'
        );
        setIsProcessing(false);
        return;
      }
      
      console.log(`\n✅ Successfully extracted ${wordPhonemeMapping.length} word entries`);
      console.log('First word sample:', JSON.stringify(wordPhonemeMapping[0], null, 2));
      
      // Process words
      let mispronuncedWords: string[] = [];
      let correctlyPronuncedWords: string[] = [];
      
      wordPhonemeMapping.forEach((wordData: any) => {
        const status = wordData.status;
        const word = wordData.word;
        
        console.log(`📊 Word: "${word}" | Status: ${status} | PER: ${wordData.per || 'N/A'}`);
        
        if (status === 'correct') {
          correctlyPronuncedWords.push(word);
        } else if (status === 'mispronounced' || status === 'partial') {
          mispronuncedWords.push(word);
        }
      });
      
      console.log('\n📈 Word classification:');
      console.log(`  Correct: [${correctlyPronuncedWords.join(', ')}]`);
      console.log(`  Problems: [${mispronuncedWords.join(', ')}]`);
      
      const attemptId = Date.now().toString();
      const newAttempt: PracticeAttempt = {
        id: attemptId,
        timestamp: new Date(),
        audioPath: finalAudioPath,
        audioUrl: uploadSuccess ? audioUrl : finalAudioPath,
        scores: {
          ...analysisResult,
          audio_data: analysisResult.audio_data,
          word_level_analysis: {
            word_phoneme_mapping: wordPhonemeMapping
          }
        },
        feedback: response.data.feedback || 'Analysis completed',
        source: source,
        fileName: audioFileName,
        mispronuncedWords: mispronuncedWords,
        correctlyPronuncedWords: correctlyPronuncedWords
      };
      
      console.log('\n💾 Created attempt object');
      console.log(`  Total words: ${wordPhonemeMapping.length}`);
      console.log(`  Correct: ${correctlyPronuncedWords.length}`);
      console.log(`  Problems: ${mispronuncedWords.length}`);
      
      // Save to Firebase
      await saveAttemptToFirebase(newAttempt);
      
      // Update UI
      setLatestAttempt(newAttempt);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } else {
      throw new Error(response.data.error || 'Analysis failed');
    }
      
  } catch (error: any) {
    console.error('❌ Processing error:', error);
    
    let errorMessage = 'Failed to process audio.';
    
    if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      errorMessage = `Unable to connect to server. Please check your connection.`;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Server might be processing slowly.';
    }
    
    Alert.alert('Error', errorMessage);
    
  } finally {
    setIsProcessing(false);
  }
};

const saveAttemptToFirebase = async (attempt: PracticeAttempt) => {
try {
const user = auth.currentUser;
if (!user) {
console.error('No authenticated user');
return;
}
  const sessionIdToUse = sessionId as string || generateSessionId(referenceText as string);
  
  // Save or update session
  const sessionRef = ref(database, `users/${user.uid}/references/${sessionIdToUse}`);
  const sessionSnapshot = await get(sessionRef);
  
  if (!sessionSnapshot.exists()) {
    // Create new session
    await set(sessionRef, {
      text: referenceText,
      createdAt: new Date().toISOString(),
      attempts: {},
      messages: {}
    });
  }
  
  // Save attempt
  const attemptRef = ref(database, `users/${user.uid}/references/${sessionIdToUse}/attempts/${attempt.id}`);
  await set(attemptRef, {
    timestamp: attempt.timestamp.toISOString(),
    audioPath: attempt.audioPath,
    audioUrl: attempt.audioUrl,
    scores: attempt.scores,
    feedback: attempt.feedback,
    source: attempt.source,
    fileName: attempt.fileName,
    mispronuncedWords: attempt.mispronuncedWords,
    correctlyPronuncedWords: attempt.correctlyPronuncedWords
  });
  
  console.log('Attempt saved to Firebase successfully');
} catch (error) {
  console.error('Error saving to Firebase:', error);
}
};
// Word recording functions
const startWordRecording = async (word: string) => {
try {
setIsRecording(true);
setRecordingWord(word);
recordingWordRef.current = word;
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  const path = `${RNFS.DocumentDirectoryPath}/word_recording_${word}_${Date.now()}.wav`;
  
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
  console.error('Word recording error:', error);
  Alert.alert('Error', 'Failed to start recording');
  setIsRecording(false);
  setRecordingWord(null);
}
};
const stopWordRecording = async () => {
try {
const result = await audioRecorderPlayer.stopRecorder();
audioRecorderPlayer.removeRecordBackListener();
setIsRecording(false);
setRecordingTime('00:00');
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  const word = recordingWordRef.current;
  const recordingPath = recordingPathRef.current;
  
  if (!word || !recordingPath) {
    throw new Error('Recording data missing');
  }
  
  const exists = await RNFS.exists(recordingPath);
  if (!exists) {
    throw new Error('Recording file was not created');
  }
  
  const stats = await RNFS.stat(recordingPath);
  if (stats.size === 0) {
    throw new Error('Recording file is empty');
  }
  
  console.log(`Word recording verified for "${word}": ${(stats.size / 1024).toFixed(1)} KB`);
  
  await processWordAudio(recordingPath, word);
  
  recordingWordRef.current = null;
  recordingPathRef.current = null;
  setRecordingWord(null);
  
} catch (error) {
  console.error('Stop word recording error:', error);
  Alert.alert('Error', 'Failed to process recording. Please try again.');
  setIsRecording(false);
  setRecordingWord(null);
}
};
const processWordAudio = async (audioPath: string, word: string) => {
setIsProcessing(true);
try {
  const formData = new FormData();
  let mimeType = 'audio/wav';
  
  formData.append('audio_file', {
    uri: Platform.OS === 'ios' ? audioPath : `file://${audioPath}`,
    type: mimeType,
    name: `word_${word}_recording.wav`,
  } as any);
  
  formData.append('reference_text', word);
  formData.append('use_llm_judge', 'true');
  formData.append('generate_audio', 'false');
  formData.append('filter_extraneous', 'true');
  
  console.log(`Sending word "${word}" recording for analysis...`);
  
  const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  });
  
  if (response.data.success) {
    console.log(`Word "${word}" analysis successful!`);
    const analysisResult = response.data.analysis;
    
    const newStatus = analysisResult.accuracy >= 0.8 ? 'correct' : 'mispronounced';
    const accuracy = analysisResult.accuracy;
    
    console.log(`Word "${word}" - Accuracy: ${accuracy}, Status: ${newStatus}`);
    
    setWordUpdates(prev => ({
      ...prev,
      [word]: {
        status: newStatus,
        accuracy: accuracy
      }
    }));
    
    // Update the latest attempt with new word status
    if (latestAttempt) {
      const updatedAttempt = { ...latestAttempt };
      
      // Remove from both arrays
      updatedAttempt.mispronuncedWords = updatedAttempt.mispronuncedWords.filter(w => w.toLowerCase() !== word.toLowerCase());
      updatedAttempt.correctlyPronuncedWords = updatedAttempt.correctlyPronuncedWords.filter(w => w.toLowerCase() !== word.toLowerCase());
      
      // Add to appropriate array
      if (newStatus === 'correct') {
        updatedAttempt.correctlyPronuncedWords.push(word);
      } else {
        updatedAttempt.mispronuncedWords.push(word);
      }
      
      // Update word_level_analysis if it exists
      if (updatedAttempt.scores.word_level_analysis?.word_phoneme_mapping) {
        updatedAttempt.scores.word_level_analysis.word_phoneme_mapping = 
          updatedAttempt.scores.word_level_analysis.word_phoneme_mapping.map(w => {
            if (w.word === word) {
              return {
                ...w,
                status: newStatus,
                accuracy: accuracy,
                per: 1 - accuracy
              };
            }
            return w;
          });
      }
      
      setLatestAttempt(updatedAttempt);
    }
    
    const accuracyPercent = (accuracy * 100).toFixed(1);
    Alert.alert(
      'Word Analysis Complete',
      `"${word}" pronunciation: ${accuracyPercent}% accuracy\nStatus: ${newStatus}`,
      [{ text: 'OK' }]
    );
    
  } else {
    throw new Error(response.data.error || 'Word analysis failed');
  }
  
} catch (error: any) {
  console.error(`Word "${word}" processing error:`, error);
  
  let errorMessage = 'Failed to analyze word pronunciation.';
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

const handleWordRecord = (word: string) => {
    if (isRecording && recordingWord === word) {
        stopWordRecording();
    } else if (!isRecording) {
        startWordRecording(word);
    } else {
        Alert.alert(
        'Recording in Progress',
        'Please finish recording for "${recordingWord}" first',
        [{ text: 'OK' }]
        );
    }
};

const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.8) return '#F59E0B';
    return '#EF4444';
};

const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;  
};

return (
    <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={[styles.header, { paddingTop: insets.top + 16 }]}
        >
            <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Icon name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Practice Session</Text>
            <Text style={styles.headerSubtitle}>
                {isNew ? 'New Session' : 'Continue Practice'}
            </Text>
            </View>
        </LinearGradient>

        <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Reference Text */}
            <View style={styles.referenceContainer}>
            <Text style={styles.referenceLabel}>Practice this sentence:</Text>
            <View style={styles.referenceCard}>
                <Text style={styles.referenceText}>{referenceText}</Text>
            </View>
            </View>

            {/* Loading Session Data */}
            {isLoadingSession ? (
              <View style={styles.processingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.processingText}>Loading session data...</Text>
              </View>
            ) : /* Show Results if Available */ latestAttempt ? (
            <View style={styles.resultsContainer}>
                {/* Recent Output Indicator */}
                {sessionId && !isNew && (
                  <View style={styles.recentOutputBanner}>
                    <Icon name="history" size={18} color="#6366F1" />
                    <Text style={styles.recentOutputText}>
                      Most Recent Attempt • {latestAttempt.timestamp.toLocaleString([], { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                )}

                {/* Overall Score */}
                <View style={styles.scoreCard}>
                <Text style={styles.scoreLabel}>Overall Pronunciation Score</Text>
                <Text style={[
                    styles.scoreValue,
                    { color: getAccuracyColor(latestAttempt.scores.accuracy) }
                ]}>
                    {formatAccuracy(latestAttempt.scores.accuracy)}
                </Text>
                <Text style={styles.scoreSubtext}>
                    {latestAttempt.scores.correct_phonemes}/{latestAttempt.scores.total_phonemes} phonemes correct
                </Text>
                </View>

                {/* Word Analysis Table */}
                <SimplifiedWordTable 
                attempt={latestAttempt}
                playingWord={playingWord}
                setPlayingWord={setPlayingWord}
                onWordRecord={handleWordRecord}
                isRecording={isRecording}
                recordingWord={recordingWord}
                isProcessing={isProcessing}
                referenceText={referenceText as string}
                />

                {/* Practice Again Button */}
                <TouchableOpacity 
                style={styles.practiceAgainButton}
                onPress={() => setLatestAttempt(null)}
                >
                <Icon name="refresh" size={24} color="#6366F1" />
                <Text style={styles.practiceAgainText}>Practice Again</Text>
                </TouchableOpacity>
            </View>
            ) : (
            <>
                {/* Recording Controls */}
                <View style={styles.controlsContainer}>
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
                        disabled={isProcessing}
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
                        {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
                    </Text>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Upload Button */}
                    <TouchableOpacity 
                        style={styles.uploadButton} 
                        onPress={handleUpload}
                        disabled={isProcessing}
                    >
                        <Icon name="upload-file" size={24} color="#6366F1" />
                        <Text style={styles.uploadText}>Upload Audio File</Text>
                    </TouchableOpacity>
                    </>
                )}
                </View>

                {/* Instructions */}
                <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>💡 Tips for better results:</Text>
                <Text style={styles.instructionItem}>• Speak clearly and at a natural pace</Text>
                <Text style={styles.instructionItem}>• Find a quiet environment</Text>
                <Text style={styles.instructionItem}>• Hold phone 6-8 inches from mouth</Text>
                </View>
            </>
            )}
        </ScrollView>
    </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingBottom: 24,
        paddingHorizontal: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
        fontWeight: '600',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    referenceContainer: {
        padding: 20,
    },
    referenceLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    referenceCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 5,
    },
    referenceText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1F2937',
        lineHeight: 32,
        textAlign: 'center',
    },
    resultsContainer: {
        padding: 20,
    },
    scoreCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 6,
    },
    scoreLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    scoreValue: {
        fontSize: 48,
        fontWeight: '900',
        marginBottom: 8,
    },
    scoreSubtext: {
        fontSize: 14,
        color: '#9CA3AF',
        fontWeight: '600',
    },
    practiceAgainButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#6366F1',
        marginTop: 24,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    practiceAgainText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6366F1',
    },
    controlsContainer: {
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingVertical: 40,
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
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        marginVertical: 40,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#9CA3AF',
        marginHorizontal: 16,
        letterSpacing: 1,
    },
    uploadButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 28,
        paddingVertical: 16,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#6366F1',
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    uploadText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#6366F1',
    },
    instructionsContainer: {
        backgroundColor: '#FEF3C7',
        borderRadius: 20,
        padding: 20,
        marginHorizontal: 20,
        borderWidth: 1.5,
        borderColor: '#FDE68A',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    instructionsTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#92400E',
        marginBottom: 12,
    },
    instructionItem: {
        fontSize: 14,
        color: '#78350F',
        fontWeight: '500',
        lineHeight: 22,
        marginBottom: 4,
    },
    // Word table styles
    simplifiedTableContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4,
        overflow: 'hidden',
    },
    wordBoxesContainer: {
        backgroundColor: '#F9FAFB',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    wordBoxesScrollContent: {
        paddingRight: 16,
    },
    wordBoxesTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 10,
    },
    wordBoxes: {
        flexDirection: 'row',
        flexWrap: 'nowrap',
        gap: 6,
        marginBottom: 12,
        minHeight: 40,
    },
    wordBox: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 2,
        minWidth: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    wordBoxText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    wordBoxAccuracy: {
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
    },
    legendContainer: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'space-between',
        paddingHorizontal: 4,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
        justifyContent: 'center',
    },
    legendColorBox: {
        width: 12,
        height: 12,
        borderRadius: 3,
        borderWidth: 1,
    },
    legendText: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
    },
    tableSection: {
        padding: 14,
        flex: 1,
    },
    tableSectionTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
        textAlign: 'center',
    },
    tableContainer: {
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F9FAFB',
        paddingVertical: 14,
        paddingHorizontal: 12,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    tableHeaderText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        textAlign: 'center',
    },
    tableRowsContainer: {
        maxHeight: 400,
    },
    tableRow: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        alignItems: 'center',
        minHeight: 52,
    },
    tableCell: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 2,
    },
    wordText: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
    },
    accuracyBadge: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 10,
        minWidth: 40,
    },
    accuracyText: {
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    iconButton: {
        padding: 6,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
        minWidth: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recordingButton: {
        backgroundColor: '#EF4444',
        transform: [{ scale: 1.05 }],
    },
    iconText: {
        fontSize: 16,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    allCorrectContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        backgroundColor: '#F0FDF4',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#BBF7D0',
        borderStyle: 'dashed',
    },
    allCorrectIcon: {
        fontSize: 36,
        marginBottom: 12,
    },
    allCorrectTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#065F46',
        marginBottom: 6,
        textAlign: 'center',
    },
    allCorrectText: {
        fontSize: 13,
        color: '#047857',
        textAlign: 'center',
        lineHeight: 18,
    },
    pronunciationWordButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        marginRight: 8,
        marginBottom: 8,
    },
    pronunciationWordText: {
        fontSize: 15,
    },
    recentOutputBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#EEF2FF',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1.5,
        borderColor: '#C7D2FE',
    },
    recentOutputText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6366F1',
    },
});