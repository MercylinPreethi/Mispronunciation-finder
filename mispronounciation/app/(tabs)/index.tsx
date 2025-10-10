import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  Dimensions,
  Animated,
  Alert,
  ScrollView
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, set, get, onValue, off } from 'firebase/database';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, database } from '@/lib/firebase'; 
import { router } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';


const audioRecorderPlayer = new AudioRecorderPlayer();
const { width, height } = Dimensions.get('window');

interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
}

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

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
  audio_data?: AudioData;
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

interface ChatMessage {
  id: string;
  type: 'text' | 'audio' | 'result';
  content: string;
  audioPath?: string;
  fileName?: string;
  timestamp: Date;
  isUser: boolean;
  result?: PracticeAttempt;
}

interface SentenceSession {
  id: string;
  referenceText: string;
  createdAt: Date;
  attempts: PracticeAttempt[];
  messages: ChatMessage[];
}

interface FirebaseAttempt {
  timestamp: string;
  audioPath: string;
  audioUrl?: string;
  scores: AnalysisResult;
  feedback: string;
  source: 'recording' | 'upload';
  fileName?: string;
  mispronuncedWords: string[];
  correctlyPronuncedWords: string[];
}

interface FirebaseMessage {
  type: 'text' | 'audio' | 'result';
  content: string;
  audioPath?: string;
  fileName?: string;
  timestamp: string;
  isUser: boolean;
  result?: FirebaseAttempt;
}

interface FirebaseReferenceText {
  text: string;
  createdAt: string;
  attempts: { [key: string]: FirebaseAttempt };
  messages: { [key: string]: FirebaseMessage };
  word_practices?: { [key: string]: FirebaseWordPractice };  // Add this line
}

interface FirebaseWordPractice {
  word: string;
  attempts: {
    [key: string]: {
      timestamp: string;
      audioPath: string;
      audioUrl?: string;
      accuracy: number;
      status: 'correct' | 'partial' | 'mispronounced';
      feedback: string;
      scores?: AnalysisResult;  // Make sure this line is added
    }
  };
  bestScore: number;
  needsMorePractice: boolean;
  mastered: boolean;
  lastPracticed: string;
}


const generateSessionId = (referenceText: string): string => {
  const timestamp = Date.now();
  const textHash = referenceText.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `${textHash}_${timestamp}`;
};

// Audio playback utility for base64 audio
const playBase64Audio = async (base64Audio: string, word: string, setPlayingWord: (word: string | null) => void) => {
  try {
    console.log(`Playing pronunciation audio for word: "${word}"`);
    
    // Create temporary file from base64
    const tempPath = `${RNFS.DocumentDirectoryPath}/temp_pronunciation_${word}_${Date.now()}.wav`;
    
    // Write base64 audio to temporary file
    await RNFS.writeFile(tempPath, base64Audio, 'base64');
    
    // Verify file was created
    const fileExists = await RNFS.exists(tempPath);
    if (!fileExists) {
      throw new Error('Failed to create temporary audio file');
    }
    
    setPlayingWord(word);
    
    // Play the audio
    await audioRecorderPlayer.startPlayer(tempPath);
    
    audioRecorderPlayer.addPlayBackListener((e) => {
      if (e.currentPosition >= e.duration) {
        audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(null);
        
        // Clean up temporary file
        RNFS.unlink(tempPath).catch(err => 
          console.warn('Could not delete temporary audio file:', err)
        );
      }
    });
    
    console.log(`Successfully started playing pronunciation for: "${word}"`);
    
  } catch (error) {
    console.error(`Error playing pronunciation audio for "${word}":`, error);
    setPlayingWord(null);
    
    // Fallback: Use text-to-speech API endpoint
    try {
      console.log(`Fallback: Requesting TTS for word "${word}"`);
      const response = await axios.get(`http://192.168.14.34:5050/get_word_audio/${word}`, {
        responseType: 'blob',
        timeout: 10000
      });
      
      if (response.data) {
        console.log(`TTS fallback successful for word: "${word}"`);
        // Note: Handling blob response in React Native requires additional setup
        // For now, we'll show a message to the user
        Alert.alert(
          'Audio Playback', 
          `Pronunciation audio for "${word}" is available but requires additional setup for blob playback.`
        );
      }
    } catch (fallbackError) {
      console.error('TTS fallback failed:', fallbackError);
      Alert.alert(
        'Audio Error', 
        `Could not play pronunciation audio for "${word}". Please check your connection.`
      );
    }
  }
};

// Component to render individual words with color coding and click handlers
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
      case 'correct': return '#10B981'; // Green
      case 'partial': return '#F59E0B'; // Yellow/Orange
      case 'mispronounced': return '#EF4444'; // Red
      default: return '#6B7280'; // Gray
    }
  };

  const getWordBackgroundColor = (status: string) => {
    switch (status) {
      case 'correct': return '#D1FAE5'; // Light green
      case 'partial': return '#FEF3C7'; // Light yellow
      case 'mispronounced': return '#FEE2E2'; // Light red
      default: return '#F3F4F6'; // Light gray
    }
  };

  const handleWordPress = async () => {
    try {
      Haptics.selectionAsync();
      
      if (playingWord === word) {
        // Stop current playback
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(null);
        return;
      }
      
      if (playingWord) {
        // Stop any other playing audio
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      }

      if (audioData && audioData.audio_base64) {
        console.log(`Playing generated audio for word: "${word}"`);
        await playBase64Audio(audioData.audio_base64, word, setPlayingWord);
      } else {
        // Fallback to API call for word audio
        console.log(`No cached audio found for "${word}", requesting from API...`);
        try {
          const response = await axios.get(`http://192.168.14.34:5050/get_word_audio/${word}`, {
            responseType: 'arraybuffer',
            timeout: 10000
          });
          
          if (response.data) {
            // Convert array buffer to base64
            const base64Audio = Buffer.from(response.data).toString('base64');
            await playBase64Audio(base64Audio, word, setPlayingWord);
          }
        } catch (apiError) {
          console.error('API word audio request failed:', apiError);
          Alert.alert(
            'Audio Not Available',
            `Pronunciation audio for "${word}" is not available. Please check your connection to the pronunciation server.`
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
      accessibilityLabel={`${word}, ${status} pronunciation, tap to hear correct pronunciation`}
      accessibilityRole="button"
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

export default function PronunciationCoachChat() {
  const [sessions, setSessions] = useState<SentenceSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [playingWord, setPlayingWord] = useState<string | null>(null); // New state for word audio
  const sidebarAnim = useRef(new Animated.Value(-width * 0.8)).current;
  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const chatScrollRef = useRef<FlatList<ChatMessage> | null>(null);
  const API_BASE_URL = 'http://192.168.14.34:5050';
  const [userId, setUserId] = useState<string>('');
  const insets = useSafeAreaInsets();
  const [showAllAttempts, setShowAllAttempts] = useState(false);
  const [practiceWords, setPracticeWords] = useState<{[key: string]: PracticeWordData}>({});
  const [currentPracticeWord, setCurrentPracticeWord] = useState<string | null>(null);
  const [isPracticingWord, setIsPracticingWord] = useState(false);
  const [practiceRecordingTime, setPracticeRecordingTime] = useState('00:00');
  const [isProcessingWordPractice, setIsProcessingWordPractice] = useState(false);

  
  interface PracticeWordData {
    word: string;
    attempts: {
      id: string;
      timestamp: Date;
      audioPath: string;
      audioUrl?: string;
      accuracy: number;
      status: 'correct' | 'partial' | 'mispronounced';
      feedback: string;
      scores?: AnalysisResult; // Add this line
    }[];
    bestScore: number;
    needsMorePractice: boolean;
    mastered: boolean;
  }

  interface FirebaseWordPractice {
    word: string;
    attempts: {
      [key: string]: {
        timestamp: string;
        audioPath: string;
        audioUrl?: string;
        accuracy: number;
        status: 'correct' | 'partial' | 'mispronounced';
        feedback: string;
        scores?: AnalysisResult; // Add this line
      }
    };
    bestScore: number;
    needsMorePractice: boolean;
    mastered: boolean;
    lastPracticed: string;
  }

  // Authentication check
  useEffect(() => {
    setIsAuthenticating(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        // Only proceed with actual authenticated users
        console.log('User authenticated:', user.uid);
        setCurrentUser(user);
        setUserId(user.uid);
        setIsFirebaseConnected(true);
        loadUserSessions(user.uid);
        setupSessionsListener(user.uid);
        setIsAuthenticating(false);
      } else {
        console.log('No authenticated user, redirecting to sign in');
        setCurrentUser(null);
        setUserId('');
        setIsFirebaseConnected(false);
        setIsAuthenticating(false);
        router.replace('/(auth)/signin');
      }
    });

    return () => {
      unsubscribe();
      if (userId) {
        const sessionsRef = ref(database, `users/${userId}/sessions`);
        off(sessionsRef);
      }
    };
  }, []);

  const loadUserSessions = async (userIdParam: string) => {
    try {
      const referencesRef = ref(database, `users/${userIdParam}/references`);
      const snapshot = await get(referencesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val() as { [key: string]: FirebaseReferenceText };
        const loadedSessions: SentenceSession[] = Object.keys(data).map(key => {
          const refData = data[key];
          
          // Load attempts
          const attempts = refData.attempts ? Object.keys(refData.attempts).map(attemptKey => {
            const attemptData = refData.attempts[attemptKey];
            return {
              id: attemptKey,
              timestamp: new Date(attemptData.timestamp),
              audioPath: attemptData.audioPath,
              audioUrl: attemptData.audioUrl,
              scores: attemptData.scores,
              feedback: attemptData.feedback,
              source: attemptData.source,
              fileName: attemptData.fileName,
              mispronuncedWords: attemptData.mispronuncedWords || [],
              correctlyPronuncedWords: attemptData.correctlyPronuncedWords || []
            };
          }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) : [];
          
          // Load messages
          const messages = refData.messages ? Object.keys(refData.messages).map(msgKey => {
            const messageData = refData.messages[msgKey];
            return {
              id: msgKey,
              type: messageData.type,
              content: messageData.content,
              audioPath: messageData.audioPath,
              fileName: messageData.fileName,
              timestamp: new Date(messageData.timestamp),
              isUser: messageData.isUser,
              result: messageData.result ? {
                id: msgKey + '_result',
                timestamp: new Date(messageData.result.timestamp),
                audioPath: messageData.result.audioPath,
                audioUrl: messageData.result.audioUrl,
                scores: messageData.result.scores,
                feedback: messageData.result.feedback,
                source: messageData.result.source,
                fileName: messageData.result.fileName,
                mispronuncedWords: messageData.result.mispronuncedWords || [],
                correctlyPronuncedWords: messageData.result.correctlyPronuncedWords || []
              } : undefined
            };
          }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) : [];
          
          // Load word practices for this session
          if (refData.word_practices) {
            const loadedWordPractices: {[key: string]: PracticeWordData} = {};
            
            Object.keys(refData.word_practices).forEach(word => {
              const wordData = refData.word_practices![word];
              loadedWordPractices[word] = {
                word: wordData.word,
                attempts: Object.keys(wordData.attempts || {}).map(attemptKey => ({
                  id: attemptKey,
                  timestamp: new Date(wordData.attempts[attemptKey].timestamp),
                  audioPath: wordData.attempts[attemptKey].audioPath,
                  audioUrl: wordData.attempts[attemptKey].audioUrl,
                  accuracy: wordData.attempts[attemptKey].accuracy,
                  status: wordData.attempts[attemptKey].status,
                  feedback: wordData.attempts[attemptKey].feedback,
                  scores: wordData.attempts[attemptKey].scores // Add this line
                })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
                bestScore: wordData.bestScore,
                needsMorePractice: wordData.needsMorePractice,
                mastered: wordData.mastered
              };
            });
            
            // Merge loaded word practices into state
            setPracticeWords(prev => ({ ...prev, ...loadedWordPractices }));
          }
          
          return {
            id: key,
            referenceText: refData.text,
            createdAt: new Date(refData.createdAt),
            attempts,
            messages
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setSessions(loadedSessions);
        console.log(`Loaded ${loadedSessions.length} sessions for user ${userIdParam}`);
      } else {
        console.log('No sessions found for user');
        setSessions([]);
      }
    } catch (error) {
      console.error('Error loading user sessions from Firebase:', error);
      Alert.alert('Load Error', 'Failed to load your practice sessions. Please try again.');
    }
  };

  const saveWordPracticeToFirebase = async (
    sessionId: string, 
    wordData: PracticeWordData
  ) => {
    if (!isFirebaseConnected || !userId) {
      console.warn('Cannot save word practice: Firebase not connected');
      return;
    }
    
    try {
      const wordPracticeRef = ref(
        database, 
        `users/${userId}/references/${sessionId}/word_practices/${wordData.word}`
      );
      
      const firebaseWordPractice: FirebaseWordPractice = {
        word: wordData.word,
        attempts: {},
        bestScore: wordData.bestScore,
        needsMorePractice: wordData.needsMorePractice,
        mastered: wordData.mastered,
        lastPracticed: new Date().toISOString()
      };
      
      wordData.attempts.forEach(attempt => {
        firebaseWordPractice.attempts[attempt.id] = {
          timestamp: attempt.timestamp.toISOString(),
          audioPath: attempt.audioPath,
          audioUrl: attempt.audioUrl,
          accuracy: attempt.accuracy,
          status: attempt.status,
          feedback: attempt.feedback,
          scores: attempt.scores // Add this line
        };
      });
      
      await set(wordPracticeRef, firebaseWordPractice);
      console.log(`Word practice saved to Firebase for: ${wordData.word}`);
    } catch (error) {
      console.error('Error saving word practice to Firebase:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('User signed out successfully');
      router.replace('/(auth)/signin');
    } catch (error) {
      console.error('Sign out error:', error);
      Alert.alert('Sign Out Error', 'Failed to sign out. Please try again.');
    }
  };


  const setupSessionsListener = (userIdParam: string) => {
    const referencesRef = ref(database, `users/${userIdParam}/references`);
    onValue(referencesRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val() as { [key: string]: FirebaseReferenceText };
        const loadedSessions: SentenceSession[] = Object.keys(data).map(key => {
          const refData = data[key];
          return {
            id: key,
            referenceText: refData.text,
            createdAt: new Date(refData.createdAt),
            attempts: refData.attempts ? Object.keys(refData.attempts).map(attemptKey => {
              const attemptData = refData.attempts[attemptKey];
              return {
                id: attemptKey,
                timestamp: new Date(attemptData.timestamp),
                audioPath: attemptData.audioPath,
                audioUrl: attemptData.audioUrl,
                scores: attemptData.scores,
                feedback: attemptData.feedback,
                source: attemptData.source,
                fileName: attemptData.fileName,
                mispronuncedWords: attemptData.mispronuncedWords || [],
                correctlyPronuncedWords: attemptData.correctlyPronuncedWords || []
              };
            }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) : [],
            messages: refData.messages ? Object.keys(refData.messages).map(msgKey => {
              const messageData = refData.messages[msgKey];
              return {
                id: msgKey,
                type: messageData.type,
                content: messageData.content,
                audioPath: messageData.audioPath,
                fileName: messageData.fileName,
                timestamp: new Date(messageData.timestamp),
                isUser: messageData.isUser,
                result: messageData.result ? {
                  id: msgKey + '_result',
                  timestamp: new Date(messageData.result.timestamp),
                  audioPath: messageData.result.audioPath,
                  audioUrl: messageData.result.audioUrl,
                  scores: messageData.result.scores,
                  feedback: messageData.result.feedback,
                  source: messageData.result.source,
                  fileName: messageData.result.fileName,
                  mispronuncedWords: messageData.result.mispronuncedWords || [],
                  correctlyPronuncedWords: messageData.result.correctlyPronuncedWords || []
                } : undefined
              };
            }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) : []
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setSessions(loadedSessions);
      } else {
        setSessions([]);
      }
    }, (error) => {
      console.error('Firebase listener error:', error);
    });
  };

  const loadFirebaseSessions = async (userIdParam: string) => {
    try {
      const referencesRef = ref(database, `users/${userIdParam}/references`);
      const snapshot = await get(referencesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val() as { [key: string]: FirebaseReferenceText };
        const loadedSessions: SentenceSession[] = Object.keys(data).map(key => {
          const refData = data[key];
          
          // Load attempts
          const attempts = refData.attempts ? Object.keys(refData.attempts).map(attemptKey => {
            const attemptData = refData.attempts[attemptKey];
            return {
              id: attemptKey,
              timestamp: new Date(attemptData.timestamp),
              audioPath: attemptData.audioPath,
              audioUrl: attemptData.audioUrl,
              scores: attemptData.scores,
              feedback: attemptData.feedback,
              source: attemptData.source,
              fileName: attemptData.fileName,
              mispronuncedWords: attemptData.mispronuncedWords || [],
              correctlyPronuncedWords: attemptData.correctlyPronuncedWords || []
            };
          }).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) : [];
          
          // Load messages
          const messages = refData.messages ? Object.keys(refData.messages).map(msgKey => {
            const messageData = refData.messages[msgKey];
            return {
              id: msgKey,
              type: messageData.type,
              content: messageData.content,
              audioPath: messageData.audioPath,
              fileName: messageData.fileName,
              timestamp: new Date(messageData.timestamp),
              isUser: messageData.isUser,
              result: messageData.result ? {
                id: msgKey + '_result',
                timestamp: new Date(messageData.result.timestamp),
                audioPath: messageData.result.audioPath,
                audioUrl: messageData.result.audioUrl,
                scores: messageData.result.scores,
                feedback: messageData.result.feedback,
                source: messageData.result.source,
                fileName: messageData.result.fileName,
                mispronuncedWords: messageData.result.mispronuncedWords || [],
                correctlyPronuncedWords: messageData.result.correctlyPronuncedWords || []
              } : undefined
            };
          }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()) : [];
          
          // Load word practices for this session
          if (refData.word_practices) {
            const loadedWordPractices: {[key: string]: PracticeWordData} = {};
            
            Object.keys(refData.word_practices).forEach(word => {
              const wordData = refData.word_practices![word];
              loadedWordPractices[word] = {
                word: wordData.word,
                attempts: Object.keys(wordData.attempts || {}).map(attemptKey => ({
                  id: attemptKey,
                  timestamp: new Date(wordData.attempts[attemptKey].timestamp),
                  audioPath: wordData.attempts[attemptKey].audioPath,
                  audioUrl: wordData.attempts[attemptKey].audioUrl,
                  accuracy: wordData.attempts[attemptKey].accuracy,
                  status: wordData.attempts[attemptKey].status,
                  feedback: wordData.attempts[attemptKey].feedback,
                  scores: wordData.attempts[attemptKey].scores // Add this line
                })).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()),
                bestScore: wordData.bestScore,
                needsMorePractice: wordData.needsMorePractice,
                mastered: wordData.mastered
              };
            });
            
            // Merge loaded word practices into state
            setPracticeWords(prev => ({ ...prev, ...loadedWordPractices }));
          }
          return {
            id: key,
            referenceText: refData.text,
            createdAt: new Date(refData.createdAt),
            attempts,
            messages
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setSessions(loadedSessions);
      }
    } catch (error) {
      console.error('Error loading sessions from Firebase:', error);
    }
  };

  const CLOUDINARY_UPLOAD_PRESET = 'dc8kh6npf';
  const CLOUDINARY_CLOUD_NAME = 'dc8kh6npf';

  const uploadToCloudinary = async (audioPath: string, attemptId: string): Promise<string> => {
    try {
      console.log('Starting Cloudinary upload for user:', userId);
      
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
      formData.append('public_id', `user_${userId}/pronunciation_audio_${attemptId}`);
      formData.append('resource_type', 'video');
      formData.append('folder', `pronunciation_coach/users/${userId}`);
      
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/dc8kh6npf/upload`,
        {
          method: 'POST',
          body: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );
      
      const result = await response.json();
      
      if (result.secure_url) {
        console.log('Upload successful for user:', userId);
        return result.secure_url;
      }
      
      throw new Error('Cloudinary upload failed: ' + (result.error?.message || JSON.stringify(result)));
      
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  const processAudio = async (audioPath: string, source: 'recording' | 'upload', fileName?: string) => {
    const currentSession = getCurrentSession();
    if (!currentSession || !audioPath) return;
    
    setIsProcessing(true);
    addMessage({
      type: 'text',
      content: 'Analyzing your pronunciation... 🔄',
      isUser: false
    });
    
    try {
      // First, ensure we have a valid audio file
      let finalAudioPath = audioPath;
      let audioExists = false;
      
      try {
        const fileExists = await RNFS.exists(audioPath);
        audioExists = fileExists;
        if (!fileExists && source === 'recording') {
          throw new Error('Recording file not found. Please try recording again.');
        }
      } catch (error) {
        console.error('Error checking audio file:', error);
        throw new Error('Could not access audio file. Please try again.');
      }

      // Upload to Cloudinary FIRST (before API call) to ensure we have a permanent URL
      let audioUrl = audioPath;
      let uploadSuccess = false;
      
      try {
        console.log(`Uploading ${source} audio to Cloudinary...`);
        const attemptId = Date.now().toString();
        audioUrl = await uploadToCloudinary(audioPath, attemptId);
        uploadSuccess = true;
        console.log('Cloudinary upload successful:', audioUrl);
        
        // Show upload success message
        addMessage({
          type: 'text',
          content: '✅ Audio uploaded successfully. Processing pronunciation...',
          isUser: false
        });
        
      } catch (cloudinaryError) {
        console.warn('Cloudinary upload failed:', cloudinaryError);
        console.log('Continuing with local file path...');
        
        // For recorded files, we need to copy to a permanent location
        if (source === 'recording') {
          try {
            const permanentPath = `${RNFS.DocumentDirectoryPath}/recordings/recording_${Date.now()}.wav`;
            await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/recordings`);
            await RNFS.copyFile(audioPath, permanentPath);
            finalAudioPath = permanentPath;
            audioUrl = permanentPath;
            console.log('Audio copied to permanent location:', permanentPath);
          } catch (copyError) {
            console.error('Failed to copy recording to permanent location:', copyError);
            // Continue with original path
          }
        }
        
        addMessage({
          type: 'text',
          content: '⚠️ Cloud upload failed, using local storage. Analyzing pronunciation...',
          isUser: false
        });
      }
      
      // Prepare form data for API call
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
      formData.append('reference_text', currentSession.referenceText);
      formData.append('use_llm_judge', 'true'); // Enable LLM judge for better feedback
      formData.append('generate_audio', 'true'); // Enable audio generation
      formData.append('filter_extraneous', 'true');
      
      console.log('Sending audio to pronunciation analysis API...');
      const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000, // Increased timeout for LLM processing
      });
      
      if (response.data.success) {
        console.log('Analysis successful! Processing results...');
        const analysisResult = response.data.analysis;
        const wordLevelAnalysis = response.data.word_level_analysis;
        
        // IMPORTANT: Extract word-level results correctly
        let mispronuncedWords: string[] = [];
        let correctlyPronuncedWords: string[] = [];
        let partialWords: string[] = [];
        
        if (wordLevelAnalysis && wordLevelAnalysis.words) {
          wordLevelAnalysis.words.forEach((wordData: any) => {
            const word = wordData.word;
            const status = wordData.status; // This is the key field!
            
            console.log(`Word: ${word}, Status: ${status}`); // Debug log
            
            if (status === 'correct') {
              correctlyPronuncedWords.push(word);
            } else if (status === 'mispronounced') {
              mispronuncedWords.push(word);
            } else if (status === 'partial') {
              partialWords.push(word);
            }
          });
        }
        
        console.log('Word analysis:', { 
          mispronuncedWords, 
          correctlyPronuncedWords,
          partialWords,
          totalAccuracy: analysisResult.accuracy,
          audioData: analysisResult.audio_data
        });
        
        // Create attempt object with proper word lists
        const attemptId = Date.now().toString();
        const newAttempt: PracticeAttempt = {
          id: attemptId,
          timestamp: new Date(),
          audioPath: finalAudioPath,
          audioUrl: uploadSuccess ? audioUrl : finalAudioPath,
          scores: {
            ...analysisResult,
            audio_data: analysisResult.audio_data
          },
          feedback: response.data.feedback || 'Analysis completed',
          source: source,
          fileName: audioFileName,
          mispronuncedWords: mispronuncedWords,
          correctlyPronuncedWords: correctlyPronuncedWords
          // Note: partial words are tracked in scores.word_summary but not in separate list
        };
        
        console.log('Saving attempt to Firebase...');
        await saveAttemptToFirebase(currentSession.id, newAttempt);
        
        // Add success message
        const accuracyPercent = (analysisResult.accuracy * 100).toFixed(1);
        const audioInfo = analysisResult.audio_data?.generated_count 
          ? `\n🎵 ${analysisResult.audio_data.generated_count} word pronunciations available`
          : '';
        const feedbackMessage = `🎉 Analysis Complete!\n\n📊 Score: ${accuracyPercent}%\n${uploadSuccess ? '☁️ Audio saved to cloud' : '💾 Audio saved locally'}${audioInfo}\n\n${response.data.feedback}`;
        
        addMessage({
          type: 'result',
          content: feedbackMessage,
          isUser: false,
          result: newAttempt
        });
        
        console.log('Attempt saved successfully!');
        
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
        
      } catch (error: any) {
        console.error('Processing error:', error);
        console.error('Error details:', error.response?.data);
        
        let errorMessage = 'Failed to process audio.';
        
        if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
          errorMessage = `Unable to connect to server at ${API_BASE_URL}. Please check:\n• Server is running\n• IP address is correct\n• Network connection is active`;
        } else if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timeout. Server might be processing slowly.';
        } else if (error.message.includes('Recording file not found')) {
          errorMessage = error.message;
        }
        
        addMessage({
          type: 'text',
          content: `❌ ${errorMessage}`,
          isUser: false
        });
        
      } finally {
        setIsProcessing(false);
      }
    };

  const saveSessionToFirebase = async (session: SentenceSession) => {
    if (!isFirebaseConnected || !userId) {
      Alert.alert('Firebase Error', 'Not connected to Firebase or user not authenticated.');
      return;
    }
    try {
      const referenceRef = ref(database, `users/${userId}/references/${session.id}`);
      const referenceData: FirebaseReferenceText = {
        text: session.referenceText,
        createdAt: session.createdAt.toISOString(),
        attempts: {},
        messages: {}
      };
      session.attempts.forEach(attempt => {
        referenceData.attempts[attempt.id] = {
          timestamp: attempt.timestamp.toISOString(),
          audioPath: attempt.audioPath,
          audioUrl: attempt.audioUrl,
          scores: attempt.scores,
          feedback: attempt.feedback,
          source: attempt.source,
          fileName: attempt.fileName,
          mispronuncedWords: attempt.mispronuncedWords,
          correctlyPronuncedWords: attempt.correctlyPronuncedWords
        };
      });
      session.messages.forEach(message => {
        referenceData.messages[message.id] = {
          type: message.type,
          content: message.content,
          audioPath: message.audioPath,
          fileName: message.fileName,
          timestamp: message.timestamp.toISOString(),
          isUser: message.isUser,
          result: message.result ? {
            timestamp: message.result.timestamp.toISOString(),
            audioPath: message.result.audioPath,
            audioUrl: message.result.audioUrl,
            scores: message.result.scores,
            feedback: message.result.feedback,
            source: message.result.source,
            fileName: message.result.fileName,
            mispronuncedWords: message.result.mispronuncedWords,
            correctlyPronuncedWords: message.result.correctlyPronuncedWords
          } : undefined
        };
      });
      await set(referenceRef, referenceData);
    } catch (error) {
      console.error('Error saving reference session to Firebase:', error);
    }
  };

  const saveAttemptToFirebase = async (sessionId: string, attempt: PracticeAttempt) => {
    if (!isFirebaseConnected) {
      Alert.alert('Firebase Error', 'Not connected to Firebase. Please check your connection.');
      return;
    }
    try {
      const attemptRef = ref(database, `users/${userId}/references/${sessionId}/attempts/${attempt.id}`);
      const attemptData: FirebaseAttempt = {
        timestamp: attempt.timestamp.toISOString(),
        audioPath: attempt.audioPath,
        audioUrl: attempt.audioUrl,
        scores: attempt.scores,
        feedback: attempt.feedback,
        source: attempt.source,
        fileName: attempt.fileName,
        mispronuncedWords: attempt.mispronuncedWords,
        correctlyPronuncedWords: attempt.correctlyPronuncedWords
      };
      await set(attemptRef, attemptData);
    } catch (error) {
      console.error('Error saving attempt to Firebase:', error);

    }
  };

  const saveMessageToFirebase = async (sessionId: string, message: ChatMessage) => {
    if (!isFirebaseConnected) {
      Alert.alert('Firebase Error', 'Not connected to Firebase. Please check your connection.');
      return;
    }
    try {
      const messageRef = ref(database, `users/${userId}/references/${sessionId}/messages/${message.id}`);
      
      // Build message data with proper null checks
      const messageData: FirebaseMessage = {
        type: message.type,
        content: message.content,
        audioPath: message.audioPath,
        fileName: message.fileName,
        timestamp: message.timestamp.toISOString(), // This is fine - message.timestamp is a Date
        isUser: message.isUser,
        result: message.result ? {
          timestamp: message.result.timestamp instanceof Date 
            ? message.result.timestamp.toISOString() 
            : (typeof message.result.timestamp === 'string' 
                ? message.result.timestamp 
                : new Date().toISOString()), // Fallback to current time
          audioPath: message.result.audioPath,
          audioUrl: message.result.audioUrl,
          scores: message.result.scores,
          feedback: message.result.feedback,
          source: message.result.source,
          fileName: message.result.fileName,
          mispronuncedWords: message.result.mispronuncedWords,
          correctlyPronuncedWords: message.result.correctlyPronuncedWords
        } : undefined
      };
      
      await set(messageRef, messageData);
    } catch (error) {
      console.error('Error saving message to Firebase:', error);
    }
  };

  const getCurrentSession = (): SentenceSession | null => {
    return sessions.find(session => session.id === currentSessionId) || null;
  };

  const createNewSession = async (referenceText: string) => {
    const sessionId = generateSessionId(referenceText);
    const newSession: SentenceSession = {
      id: sessionId,
      referenceText,
      createdAt: new Date(),
      attempts: [],
      messages: []
    };
    setSessions(prevSessions => [newSession, ...prevSessions]);
    setCurrentSessionId(newSession.id);
    await saveSessionToFirebase(newSession);
    setTimeout(() => {
      addMessage({
        type: 'text',
        content: `Perfect! I've created a new practice session for:\n\n"${referenceText}"\n\nNow you can:\n🎤 Record your pronunciation\n📁 Upload an audio file\n\nChoose either option above to start practicing!`,
        isUser: false
      });
    }, 100);
  };

  const addMessage = async (messageData: Partial<ChatMessage>) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...messageData
    } as ChatMessage;
    const currentSession = getCurrentSession();
    if (currentSession && isFirebaseConnected) {
      const cleanedMessage: any = {
        type: newMessage.type,
        content: newMessage.content || '',
        audioPath: newMessage.audioPath || undefined,
        fileName: newMessage.fileName || undefined,
        timestamp: newMessage.timestamp.toISOString(),
        isUser: newMessage.isUser || false,
        result: newMessage.result ? {
          timestamp: newMessage.result.timestamp.toISOString(),
          audioPath: newMessage.result.audioPath || '',
          audioUrl: newMessage.result.audioUrl || undefined,
          scores: newMessage.result.scores,
          feedback: newMessage.result.feedback || '',
          source: newMessage.result.source,
          fileName: newMessage.result.fileName || undefined,
          mispronuncedWords: newMessage.result.mispronuncedWords || [],
          correctlyPronuncedWords: newMessage.result.correctlyPronuncedWords || []
        } : undefined
      };
      Object.keys(cleanedMessage).forEach(key => {
        if (cleanedMessage[key] === undefined) {
          delete cleanedMessage[key];
        }
      });
      if (cleanedMessage.result) {
        Object.keys(cleanedMessage.result).forEach(key => {
          if (cleanedMessage.result[key] === undefined) {
            delete cleanedMessage.result[key];
          }
        });
      }
      await saveMessageToFirebase(currentSession.id, {
        ...newMessage,
        audioPath: cleanedMessage.audioPath,
        fileName: cleanedMessage.fileName,
        result: cleanedMessage.result
      });
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else if (!currentSession && !newMessage.isUser) {
      console.log('Bot message without session:', newMessage.content);
      setTimeout(() => {
        chatScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const sendTextMessage = () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    const currentSession = getCurrentSession();
    setInputText('');
    
    // Check if a session with this exact text already exists
    const existingSession = sessions.find(
      session => session.referenceText.toLowerCase() === text.toLowerCase()
    );
    
    if (existingSession) {
      // Session already exists, navigate to it
      Haptics.selectionAsync();
      setCurrentSessionId(existingSession.id);
      setShowAllAttempts(false);
      
      // Show a message that we're switching to existing session
      setTimeout(() => {
        Alert.alert(
          'Existing Session Found',
          `Switched to your existing practice session for:\n\n"${existingSession.referenceText}"\n\nYou have ${existingSession.attempts.length} previous attempt${existingSession.attempts.length === 1 ? '' : 's'}.`,
          [{ text: 'Continue Practicing' }]
        );
      }, 300);
      return;
    }
    
    // If we have a current session, show the user we're creating a new one
    if (currentSession) {
      addMessage({
        type: 'text',
        content: text,
        isUser: true
      });
      
      if (text.toLowerCase() === 'new') {
        setTimeout(() => {
          addMessage({
            type: 'text',
            content: "Please type the new sentence you'd like to practice:",
            isUser: false
          });
        }, 500);
        return;
      }
      
      const lastMessages = currentSession.messages.slice(-2);
      const lastBotMessage = lastMessages.find(m => !m.isUser);
      if (lastBotMessage && lastBotMessage.content.includes("Please type the new sentence")) {
        createNewSession(text);
        return;
      }
      
      setTimeout(() => {
        addMessage({
          type: 'text',
          content: `I see you want to practice: "${text}"\n\nThis will create a new practice session. Your current session for "${currentSession.referenceText}" will be saved in Practice History.\n\nWould you like to continue with the new session?`,
          isUser: false
        });
        setTimeout(() => {
          createNewSession(text);
        }, 2000);
      }, 500);
    } else {
      // No current session, create new one
      createNewSession(text);
    }
  };

  const startRecording = async () => {
    const currentSession = getCurrentSession();
    if (!currentSession) {
      Alert.alert('Error', 'Please send a sentence to practice first');
      return;
    }
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
      console.log('Stopping recording...');
      const result = await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime('00:00');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      console.log('Recording stopped. File path:', result);
      
      // Verify the recording exists and has content
      try {
        const exists = await RNFS.exists(result);
        if (!exists) {
          throw new Error('Recording file was not created');
        }
        
        const stats = await RNFS.stat(result);
        if (stats.size === 0) {
          throw new Error('Recording file is empty');
        }
        
        console.log(`Recording verified: ${(stats.size / 1024).toFixed(1)} KB`);
        
      } catch (verifyError) {
        console.error('Recording verification failed:', verifyError);
        Alert.alert('Recording Error', 'The recording was not saved properly. Please try again.');
        return;
      }
      
      // Add message about the recording
      addMessage({
        type: 'audio',
        content: 'Voice recording',
        audioPath: result,
        isUser: true
      });
      
      // Process the audio
      processAudio(result, 'recording');
      
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
      setIsRecording(false);
    }
  };

  const selectAudioFile = async () => {
    const currentSession = getCurrentSession();
    if (!currentSession) {
      Alert.alert('Error', 'Please send a sentence to practice first');
      return;
    }
    try {
      Haptics.selectionAsync();
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        addMessage({
          type: 'audio',
          content: 'Audio file uploaded',
          audioPath: file.uri,
          fileName: file.name,
          isUser: true
        });
        processAudio(file.uri, 'upload', file.name);
      }
    } catch (error) {
      console.error('File selection error:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
  };

  const playAudio = async (audioPath: string, messageId: string) => {
    try {
      Haptics.selectionAsync();
      console.log('Attempting to play audio:', audioPath);
      
      // Stop current playback if any
      if (isPlaying && playingMessageId === messageId) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setIsPlaying(false);
        setPlayingMessageId(null);
        return;
      }
      
      if (isPlaying) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
      }
      
      // Determine if this is a URL or local path
      let playbackPath = audioPath;
      const isUrl = audioPath.startsWith('http://') || audioPath.startsWith('https://');
      const isLocalPath = audioPath.startsWith('file://') || audioPath.startsWith('/');
      
      if (!isUrl && !isLocalPath) {
        // Try to construct proper file:// URL for local files
        playbackPath = Platform.OS === 'ios' ? audioPath : `file://${audioPath}`;
      }
      
      // Check if local file exists (for local paths only)
      if (!isUrl) {
        const actualPath = playbackPath.replace('file://', '');
        const exists = await RNFS.exists(actualPath);
        if (!exists) {
          console.error('Audio file not found:', actualPath);
          Alert.alert('Playback Error', 'Audio file not found. It may have been moved or deleted.');
          return;
        }
      }
      
      console.log('Playing audio from:', playbackPath);
      setIsPlaying(true);
      setPlayingMessageId(messageId);
      
      await audioRecorderPlayer.startPlayer(playbackPath);
      
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition >= e.duration) {
          audioRecorderPlayer.stopPlayer();
          audioRecorderPlayer.removePlayBackListener();
          setIsPlaying(false);
          setPlayingMessageId(null);
        }
      });
      
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlaying(false);
      setPlayingMessageId(null);
      
      Alert.alert('Playback Error', 'Could not play audio file. Please try again.');
    }
  };

  const toggleSidebar = () => {
    Haptics.selectionAsync();
    const toValue = sidebarVisible ? -width * 0.8 : 0;
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarVisible(!sidebarVisible);
  };

  const selectSession = (session: SentenceSession) => {
    Haptics.selectionAsync();
    setCurrentSessionId(session.id);
    setShowAllAttempts(false);
    toggleSidebar();
  };

  // Word practice functions
  const startWordPractice = (word: string) => {
    setCurrentPracticeWord(word);
    setIsPracticingWord(false);
    
    // Initialize practice data if not exists
    if (!practiceWords[word]) {
      setPracticeWords(prev => ({
        ...prev,
        [word]: {
          word,
          attempts: [],
          bestScore: 0,
          needsMorePractice: true,
          mastered: false
        }
      }));
    }
  };

  const stopWordPractice = async () => {
    // Clean up any active recording
    if (isPracticingWord) {
      try {
        await audioRecorderPlayer.stopRecorder();
        audioRecorderPlayer.removeRecordBackListener();
      } catch (e) {
        console.log('No active recording to stop');
      }
    }
  
  setCurrentPracticeWord(null);
  setIsPracticingWord(false);
  setPracticeRecordingTime('00:00');
};

  // Add this with your other useRef declarations at the top
const isPracticingWordRef = useRef(false);

// Update startWordRecording:
const startWordRecording = async () => {
  if (!currentPracticeWord) return;
  
  // Check both state and ref
  if (isPracticingWord || isPracticingWordRef.current) {
    console.log('Already recording, ignoring start request');
    return;
  }
  
  try {
    // Ensure any previous recording is fully stopped
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
    } catch (e) {
      console.log('No previous recording to stop');
    }
    
    // Set both state and ref
    setIsPracticingWord(true);
    isPracticingWordRef.current = true;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const path = `${RNFS.DocumentDirectoryPath}/word_practice_${currentPracticeWord}_${Date.now()}.wav`;
    
    const audioSet = {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 1,
      AVFormatIDKeyIOS: AVEncodingOption.lpcm,
    };
    
    console.log('Starting word practice recording for:', currentPracticeWord);
    await audioRecorderPlayer.startRecorder(path, audioSet);
    
    audioRecorderPlayer.addRecordBackListener((e) => {
      const time = audioRecorderPlayer.mmssss(Math.floor(e.currentPosition));
      setPracticeRecordingTime(time);
    });
    
  } catch (error) {
    console.error('Word practice recording error:', error);
    Alert.alert('Error', 'Failed to start word practice recording');
    setIsPracticingWord(false);
    isPracticingWordRef.current = false;
    setPracticeRecordingTime('00:00');
  }
};

// Update stopWordRecording to use the ref:
const stopWordRecording = async () => {
  if (!currentPracticeWord) {
    console.log('No practice word set');
    return;
  }
  
  // Check ref instead of just state
  if (!isPracticingWordRef.current) {
    console.log('Not recording according to ref, attempting force stop anyway');
  }
  
  try {
    console.log('Attempting to stop recorder...');
    
    const wordToProcess = currentPracticeWord;
    
    // Force stop
    const result = await audioRecorderPlayer.stopRecorder();
    console.log('Recorder stopped, file path:', result);
    
    audioRecorderPlayer.removeRecordBackListener();
    
    // Update both state and ref
    setIsPracticingWord(false);
    isPracticingWordRef.current = false;
    setPracticeRecordingTime('00:00');
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Verify recording
    const exists = await RNFS.exists(result);
    if (!exists) {
      throw new Error('Recording file was not created');
    }
    
    const stats = await RNFS.stat(result);
    if (stats.size === 0) {
      throw new Error('Recording file is empty');
    }
    
    console.log(`Recording verified: ${(stats.size / 1024).toFixed(1)} KB`);
    
    await processWordPracticeAudio(result, wordToProcess);
    
  } catch (error: any) {
    console.error('Stop recording error:', error);
    
    // Force reset
    setIsPracticingWord(false);
    isPracticingWordRef.current = false;
    setPracticeRecordingTime('00:00');
    
    Alert.alert('Recording Error', 'Failed to stop recording. Please try again.');
  }
};

  const processWordPracticeAudio = async (audioPath: string, word: string) => {
    if (!currentSession) {
      Alert.alert('Error', 'No active session');
      return;
    }
    
    try {
      console.log(`Processing word practice audio for: "${word}"`);
      
      // Step 1: Upload to Cloudinary
      let audioUrl = audioPath;
      const attemptId = Date.now().toString();
      
      try {
        console.log('Uploading word practice audio to Cloudinary...');
        audioUrl = await uploadToCloudinary(audioPath, `word_${word}_${attemptId}`);
        console.log('Word practice audio uploaded successfully:', audioUrl);
      } catch (uploadError) {
        console.warn('Cloudinary upload failed for word practice:', uploadError);
        const permanentPath = `${RNFS.DocumentDirectoryPath}/word_practices/word_${word}_${attemptId}.wav`;
        try {
          await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/word_practices`);
          await RNFS.copyFile(audioPath, permanentPath);
          audioUrl = permanentPath;
        } catch (copyError) {
          console.error('Failed to copy word practice audio:', copyError);
        }
      }
      
      // Step 2: Send to dedicated word practice endpoint
      const formData = new FormData();
      formData.append('audio_file', {
        uri: Platform.OS === 'ios' ? audioPath : `file://${audioPath}`,
        type: 'audio/wav',
        name: `word_practice_${word}.wav`,
      } as any);
      formData.append('word', word); // Send word instead of reference_text
      
      console.log('Sending word practice to backend API...');
      const response = await axios.post(`${API_BASE_URL}/analyze_word_practice`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      
      if (response.data.success) {
        const { status, accuracy, feedback, analysis } = response.data;
        
        console.log('Word practice analysis:', { word, accuracy, status, feedback });
        
        // Create attempt record with full analysis
        const newAttempt = {
          id: attemptId,
          timestamp: new Date(),
          audioPath: audioPath,
          audioUrl: audioUrl,
          accuracy: accuracy,
          status: status as 'correct' | 'partial' | 'mispronounced',
          feedback: feedback,
          scores: analysis, // Full analysis data
        };
        
        // Update practice words data
        setPracticeWords(prev => {
          const currentData = prev[word] || {
            word,
            attempts: [],
            bestScore: 0,
            needsMorePractice: true,
            mastered: false
          };
          
          const newAttempts = [...currentData.attempts, newAttempt];
          const bestScore = Math.max(currentData.bestScore, accuracy);
          const mastered = bestScore >= 85 && newAttempts.slice(-3).every(a => a.accuracy >= 80);
          const needsMorePractice = !mastered;
          
          const updatedWordData = {
            ...currentData,
            attempts: newAttempts,
            bestScore: bestScore,
            mastered: mastered,
            needsMorePractice: needsMorePractice
          };
          
          // Save to Firebase
          saveWordPracticeToFirebase(currentSession.id, updatedWordData);
          
          return {
            ...prev,
            [word]: updatedWordData
          };
        });
        
        // Show detailed result with full feedback
        const resultTitle = status === 'correct' ? 'Excellent! 🎉' : 
                          status === 'partial' ? 'Good Progress! 👍' : 
                          'Keep Practicing! 💪';
        
        Alert.alert(
          resultTitle,
          `${word}\n\nScore: ${accuracy.toFixed(1)}%\nStatus: ${status}\n\n${feedback}`,
          [
            { text: 'Practice Again', onPress: () => {} },
            { text: 'Done', onPress: () => stopWordPractice() }
          ]
        );
        
        console.log('Word practice complete:', { word, accuracy, status });
        
      } else {
        throw new Error(response.data.error || 'Word practice analysis failed');
      }
      
    } catch (error: any) {
      console.error('Word practice processing error:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Could not analyze your pronunciation. Please try again.';
      
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        errorMessage = `Unable to connect to server at ${API_BASE_URL}. Please check your connection.`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Server might be processing slowly.';
      }
      
      Alert.alert('Analysis Error', errorMessage);
    }
  };

  // Component for word practice session
  const WordPracticeSession = ({ word }: { word: string }) => {
    const practiceData = practiceWords[word];
    const [showAllWordAttempts, setShowAllWordAttempts] = useState(false);
    const [expandedFeedback, setExpandedFeedback] = useState<{[key: string]: boolean}>({});
    const [isPlayingPronunciation, setIsPlayingPronunciation] = useState(false);
    
    const toggleFeedback = (attemptId: string) => {
      setExpandedFeedback(prev => ({
        ...prev,
        [attemptId]: !prev[attemptId]
      }));
    };
    
    const playWordPronunciation = async () => {
      try {
        Haptics.selectionAsync();
        
        // Stop if already playing
        if (isPlayingPronunciation) {
          await audioRecorderPlayer.stopPlayer();
          audioRecorderPlayer.removePlayBackListener();
          setIsPlayingPronunciation(false);
          return;
        }
        
        console.log(`Requesting pronunciation audio for: "${word}"`);
        
        const response = await axios.get(`${API_BASE_URL}/get_word_audio/${word}`, {
          responseType: 'arraybuffer',
          timeout: 10000
        });
        
        if (response.data) {
          // Convert ArrayBuffer to base64 using React Native compatible method
          const uint8Array = new Uint8Array(response.data);
          let binary = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64Audio = btoa(binary);
          
          // Create temporary file
          const tempPath = `${RNFS.DocumentDirectoryPath}/temp_word_pronunciation_${word}_${Date.now()}.wav`;
          await RNFS.writeFile(tempPath, base64Audio, 'base64');
          
          // Verify file
          const fileExists = await RNFS.exists(tempPath);
          if (!fileExists) {
            throw new Error('Failed to create temporary audio file');
          }
          
          setIsPlayingPronunciation(true);
          
          // Play audio
          await audioRecorderPlayer.startPlayer(tempPath);
          
          audioRecorderPlayer.addPlayBackListener((e) => {
            if (e.currentPosition >= e.duration) {
              audioRecorderPlayer.stopPlayer();
              audioRecorderPlayer.removePlayBackListener();
              setIsPlayingPronunciation(false);
              
              // Clean up temporary file
              RNFS.unlink(tempPath).catch(err => 
                console.warn('Could not delete temporary audio file:', err)
              );
            }
          });
          
          console.log(`Playing pronunciation for: "${word}"`);
        }
      } catch (error) {
        console.error('Error playing word pronunciation:', error);
        setIsPlayingPronunciation(false);
        Alert.alert('Audio Error', `Could not play pronunciation for "${word}". Please check your connection.`);
      }
    };
    
    const renderWordAttemptRow = ({ item: attempt, index }: { item: any, index: number }) => {
      const attemptNumber = practiceData.attempts.length - index;
      const audioUrl = attempt.audioUrl || attempt.audioPath;
      const isCloudStored = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'));
      const isExpanded = expandedFeedback[attempt.id] || false;
      const feedbackText = attempt.feedback || 'No feedback available';
      
      // Calculate display accuracy - prioritize the accuracy field from backend
      // Fallback to calculating from PER if accuracy field doesn't exist
      const displayAccuracy = attempt.accuracy !== undefined 
        ? attempt.accuracy 
        : (attempt.scores?.accuracy !== undefined 
            ? attempt.scores.accuracy * 100 
            : (100 - (attempt.scores?.per || 0)));
      
      // Show detailed error breakdown if available
      let detailedFeedback = feedbackText;
      if (attempt.scores?.error_breakdown) {
        const { substitutions, deletions, insertions } = attempt.scores.error_breakdown;
        detailedFeedback += `\n\nError Details:`;
        if (substitutions > 0) detailedFeedback += `\n• ${substitutions} sound(s) substituted`;
        if (deletions > 0) detailedFeedback += `\n• ${deletions} sound(s) deleted`;
        if (insertions > 0) detailedFeedback += `\n• ${insertions} sound(s) inserted`;
      }
      
      const shouldTruncate = detailedFeedback.length > 100;
      const displayFeedback = (isExpanded || !shouldTruncate) 
        ? detailedFeedback 
        : `${detailedFeedback.substring(0, 100)}...`;
      
      return (
        <View key={attempt.id} style={styles.wordAttemptRow}>
          <View style={styles.wordAttemptCol1}>
            <Text style={styles.wordAttemptText}>{attemptNumber}</Text>
          </View>
          <View style={styles.wordAttemptCol2}>
            <TouchableOpacity
              style={styles.wordAttemptAudioButton}
              onPress={() => playAudio(audioUrl, attempt.id)}
              accessibilityLabel="Play word practice attempt"
              accessibilityRole="button"
            >
              <Text style={styles.audioPlayIcon}>
                {isPlaying && playingMessageId === attempt.id ? '⏸️' : '▶️'}
              </Text>
              <View style={styles.wordAttemptAudioInfo}>
                <Text style={styles.wordAttemptAudioText} numberOfLines={1}>
                  Practice {attemptNumber}
                </Text>
                <Text style={styles.wordAttemptAudioStatus}>
                  {isCloudStored ? '☁️ Cloud' : '💾 Local'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
          <View style={styles.wordAttemptCol3}>
            <Text style={[
              styles.wordAttemptScore,
              { color: getAccuracyColor(displayAccuracy / 100) }
            ]}>
              {displayAccuracy.toFixed(1)}%
            </Text>
            <Text style={styles.wordAttemptStatus}>
              {attempt.status === 'correct' ? '✅' : attempt.status === 'partial' ? '⚠️' : '❌'}
              {' '}{attempt.status}
            </Text>
          </View>
          <View style={styles.wordAttemptCol4}>
            <Text style={styles.wordAttemptFeedback}>
              {displayFeedback}
            </Text>
            {shouldTruncate && (
              <TouchableOpacity
                style={styles.feedbackShowMoreButton}
                onPress={() => {
                  Haptics.selectionAsync();
                  toggleFeedback(attempt.id);
                }}
                accessibilityLabel={isExpanded ? "Show less feedback" : "Show more feedback"}
                accessibilityRole="button"
              >
                <Text style={styles.feedbackShowMoreText}>
                  {isExpanded ? 'Show Less' : 'Show More'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.wordAttemptCol5}>
            <Text style={styles.wordAttemptTime}>
              {attempt.timestamp.toLocaleDateString()}
            </Text>
            <Text style={styles.wordAttemptTime}>
              {attempt.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      );
    };
        
    return (
      <View style={styles.practiceSessionContainer}>
        <View style={styles.practiceHeader}>
          <Text style={styles.practiceWordTitle}>Practice: "{word}"</Text>
          <TouchableOpacity
            style={styles.closePracticeButton}
            onPress={stopWordPractice}
            accessibilityLabel="Close practice session"
            accessibilityRole="button"
          >
            <Text style={styles.closePracticeText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        {/* Practice audio button - FIXED */}
        <View style={styles.practiceAudioSection}>
          <TouchableOpacity
            style={[
              styles.practiceListenButton,
              isPlayingPronunciation && styles.practiceListenButtonActive
            ]}
            onPress={playWordPronunciation}
            accessibilityLabel={`Listen to correct pronunciation of ${word}`}
            accessibilityRole="button"
          >
            <Text style={styles.practiceListenText}>
              {isPlayingPronunciation ? '⏸️ Playing...' : '🔊 Listen to Correct Pronunciation'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Record practice button */}
        <View style={styles.practiceRecordSection}>
          <TouchableOpacity
            style={[
              styles.practiceRecordButton,
              isPracticingWord && styles.practiceRecordButtonActive
            ]}
            onPress={isPracticingWord ? stopWordRecording : startWordRecording}
            accessibilityLabel={isPracticingWord ? 'Stop recording practice' : 'Start recording practice'}
            accessibilityRole="button"
          >
            <Text style={styles.practiceRecordIcon}>
              {isPracticingWord ? '⏹️' : '🎤'}
            </Text>
            <Text style={styles.practiceRecordText}>
              {isPracticingWord ? `Recording... ${practiceRecordingTime}` : 'Record Your Pronunciation'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Practice statistics */}
        {practiceData && practiceData.attempts.length > 0 && (
          <View style={styles.practiceStatsSection}>
            <Text style={styles.practiceStatsTitle}>Practice Progress:</Text>
            <View style={styles.practiceStatsRow}>
              <Text style={styles.practiceStatText}>Attempts: {practiceData.attempts.length}</Text>
              <Text style={styles.practiceStatText}>Best Score: {practiceData.bestScore.toFixed(1)}%</Text>
              <Text style={[
                styles.practiceStatText,
                { color: practiceData.mastered ? '#10B981' : '#F59E0B' }
              ]}>
                {practiceData.mastered ? '✅ Mastered!' : '📚 Keep Practicing'}
              </Text>
            </View>
            
            {/* Tabular view of attempts */}
            <View style={styles.wordAttemptsTableContainer}>
              <Text style={styles.wordAttemptsTableTitle}>Practice History ({practiceData.attempts.length})</Text>
              <ScrollView 
                horizontal={true}
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.wordAttemptsScrollContent}
              >
                <View style={styles.wordAttemptsTable}>
                  {/* Table Header */}
                  <View style={styles.wordAttemptHeader}>
                    <View style={styles.wordAttemptCol1}>
                      <Text style={styles.wordAttemptHeaderText}>#</Text>
                    </View>
                    <View style={styles.wordAttemptCol2}>
                      <Text style={styles.wordAttemptHeaderText}>Audio</Text>
                    </View>
                    <View style={styles.wordAttemptCol3}>
                      <Text style={styles.wordAttemptHeaderText}>Score</Text>
                    </View>
                    <View style={styles.wordAttemptCol4}>
                      <Text style={styles.wordAttemptHeaderText}>Feedback</Text>
                    </View>
                    <View style={styles.wordAttemptCol5}>
                      <Text style={styles.wordAttemptHeaderText}>Date/Time</Text>
                    </View>
                  </View>
                  
                  {/* Table Rows */}
                  <FlatList
                    data={showAllWordAttempts ? practiceData.attempts : practiceData.attempts.slice(0, 3)}
                    keyExtractor={(item) => item.id}
                    renderItem={renderWordAttemptRow}
                    scrollEnabled={false}
                    nestedScrollEnabled={true}
                  />
                  
                  {/* Show More/Less Button */}
                  {practiceData.attempts.length > 3 && (
                    <View style={styles.wordAttemptShowMoreContainer}>
                      {showAllWordAttempts ? (
                        <TouchableOpacity
                          style={styles.showLessButton}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setShowAllWordAttempts(false);
                          }}
                          accessibilityLabel="Show fewer attempts"
                          accessibilityRole="button"
                        >
                          <Text style={styles.showLessText}>Show Fewer Attempts</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.showMoreButton}
                          onPress={() => {
                            Haptics.selectionAsync();
                            setShowAllWordAttempts(true);
                          }}
                          accessibilityLabel="Show all attempts"
                          accessibilityRole="button"
                        >
                          <Text style={styles.showMoreText}>Show All {practiceData.attempts.length} Attempts</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    );
  };
      

  // Enhanced pronunciation analysis component with clickable words
  const EnhancedPronunciationAnalysis = ({ 
    attempt, 
    showWordLimit = true 
  }: { 
    attempt: PracticeAttempt; 
    showWordLimit?: boolean;
  }) => {
    const audioData = attempt.scores.audio_data;
    const referenceText = getCurrentSession()?.referenceText || '';
    const words = referenceText.toLowerCase().split(/\s+/);
    
    // Create word status mapping
    const wordStatusMap: { [key: string]: 'correct' | 'partial' | 'mispronounced' } = {};
    
    attempt.correctlyPronuncedWords.forEach(word => {
      wordStatusMap[word.toLowerCase()] = 'correct';
    });
    
    attempt.mispronuncedWords.forEach(word => {
      wordStatusMap[word.toLowerCase()] = 'mispronounced';
    });
    
    // Words not in either list are assumed to be partial
    words.forEach(word => {
      if (!wordStatusMap[word]) {
        wordStatusMap[word] = 'partial';
      }
    });

    const displayWords = showWordLimit ? words.slice(0, 8) : words;
    const hasMoreWords = words.length > 8;

    return (
      <View style={styles.pronunciationAnalysis}>
        <Text style={styles.pronunciationSectionTitle}>
          Pronunciation Analysis (Tap words to hear correct pronunciation):
        </Text>
        <View style={styles.wordsContainer}>
          {displayWords.map((word, wordIndex) => {
            const status = wordStatusMap[word] || 'partial';
            const wordAudioData = audioData?.word_audio?.[word];
            
            return (
              <PronunciationWord
                key={wordIndex}
                word={word}
                status={status}
                audioData={wordAudioData}
                playingWord={playingWord}
                setPlayingWord={setPlayingWord}
              />
            );
          })}
          {showWordLimit && hasMoreWords && (
            <Text style={styles.moreWordsText}>+{words.length - 8} more words</Text>
          )}
        </View>
        
        {audioData?.sentence_audio && (
          <TouchableOpacity
            style={styles.sentenceAudioButton}
            onPress={async () => {
              try {
                Haptics.selectionAsync();
                if (audioData.sentence_audio?.audio_base64) {
                  await playBase64Audio(
                    audioData.sentence_audio.audio_base64, 
                    'complete sentence', 
                    setPlayingWord
                  );
                }
              } catch (error) {
                console.error('Error playing sentence audio:', error);
                Alert.alert('Audio Error', 'Could not play sentence pronunciation.');
              }
            }}
            accessibilityLabel="Play correct pronunciation of complete sentence"
            accessibilityRole="button"
          >
            <Text style={styles.sentenceAudioText}>
              🔊 Play Complete Sentence Pronunciation
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const SimpleProgressChart = ({ data } : any) => {
    if (!data || !data.datasets[0] || data.datasets[0].data.length === 0) {
      return null;
    }

    const maxValue = Math.max(...data.datasets[0].data);
    const minValue = Math.min(...data.datasets[0].data);
    const range = maxValue - minValue || 1;
    
    const chartHeight = 120;
    const dataPoints = data.datasets[0].data;
    const numPoints = dataPoints.length;

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Progress Chart</Text>
        <View style={styles.simpleChart}>
          <View style={styles.chartYAxis}>
            <Text style={styles.chartAxisLabel}>{maxValue.toFixed(1)}%</Text>
            <Text style={styles.chartAxisLabel}>{((maxValue + minValue) / 2).toFixed(1)}%</Text>
            <Text style={styles.chartAxisLabel}>{minValue.toFixed(1)}%</Text>
          </View>
          <View style={styles.chartArea}>
            <View style={styles.chartLine}>
              {/* Data points - render FIRST so they appear behind the line */}
              {dataPoints.map((value : any, index : any) => {
                const xPercent = (index / (numPoints - 1)) * 100;
                // Distance from bottom (inverted from minValue-maxValue range)
                const yFromBottom = ((value - minValue) / range) * chartHeight;

                return (
                  <React.Fragment key={index}>
                    {/* Dot */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: yFromBottom - 6,
                        left: `${xPercent}%`,
                        marginLeft: -6,
                        width: 12,
                        height: 12,
                        borderRadius: 6,
                        backgroundColor: getAccuracyColor(value / 100),
                        borderWidth: 3,
                        borderColor: '#FFFFFF',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.2,
                        shadowRadius: 4,
                        elevation: 4,
                        zIndex: 2,
                      }}
                    />
                    {/* Value label */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: yFromBottom + 15,
                        left: `${xPercent}%`,
                        marginLeft: -15,
                        backgroundColor: '#6B7280',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4,
                        zIndex: 3,
                      }}
                    >
                      <Text style={styles.chartValueText}>{value.toFixed(0)}%</Text>
                    </View>
                  </React.Fragment>
                );
              })}

              {/* SVG Line - render AFTER dots */}
              <View
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: chartHeight,
                  bottom: 0, // Anchor to bottom
                }}
              >
                <Svg
                  width="100%"
                  height={chartHeight}
                  viewBox={`0 0 100 ${chartHeight}`}
                  preserveAspectRatio="none"
                >
                  <Polyline
                    points={dataPoints.map((value: any, index: any) => {
                      const x = (index / (numPoints - 1)) * 100;
                      // SVG Y from bottom (same as dots): 0 = bottom, chartHeight = top
                      const y = chartHeight - ((value - minValue) / range) * chartHeight;
                      return `${x},${y}`;
                    }).join(' ')}
                    fill="none"
                    stroke="#7C3AED"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            <View style={styles.chartXAxis}>
              {data.labels.map((label : any, index : any) => (
                <Text key={index} style={styles.chartXLabel}>#{label}</Text>
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  const getProgressChartData = () => {
    const currentSession = getCurrentSession();
    if (!currentSession || currentSession.attempts.length === 0) {
      return null;
    }
    const attempts = [...currentSession.attempts].reverse();
    const labels = attempts.map((_, index) => `${index + 1}`);
    const data = attempts.map(attempt => attempt.scores.accuracy * 100);
    return {
      labels,
      datasets: [{ data }]
    };
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#6EE7B7';
    if (accuracy >= 0.8) return '#FBBF24';
    return '#FCA5A5';
  };

  const renderMessage = ({ item: message }: { item: ChatMessage }) => {
    const isUser = message.isUser;
    return (
      <View key={message.id} style={[
        styles.messageContainer,
        isUser ? styles.userMessage : styles.botMessage
      ]}>
        {message.type === 'text' && (
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.botMessageText
          ]}>
            {message.content}
          </Text>
        )}
        {message.type === 'audio' && (
          <View style={styles.audioMessage}>
            <TouchableOpacity
              style={styles.audioPlayButton}
              onPress={() => playAudio(message.audioPath!, message.id)}
              accessibilityLabel={isPlaying && playingMessageId === message.id ? 'Pause audio' : 'Play audio'}
              accessibilityRole="button"
            >
              <Text style={styles.audioPlayButtonText}>
                {isPlaying && playingMessageId === message.id ? '⏸' : '▶️'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.audioMessageText}>
              {message.fileName || 'Voice recording'}
            </Text>
          </View>
        )}
        {message.type === 'result' && message.result && (
          <View style={styles.resultMessage}>
            <Text style={styles.resultTitle}>Pronunciation Analysis</Text>
            <View style={styles.scoreContainer}>
              <Text style={[
                styles.scoreText,
                { color: getAccuracyColor(message.result.scores.accuracy) }
              ]}>
                Score: {formatAccuracy(message.result.scores.accuracy)}
              </Text>
              <Text style={styles.phonemeText}>
                Phonemes: {message.result.scores.correct_phonemes}/{message.result.scores.total_phonemes}
              </Text>
            </View>
            {message.result.feedback && (
              <View style={styles.feedbackContainer}>
                <Text style={styles.feedbackTitle}>Feedback:</Text>
                <Text style={styles.feedbackText}>{message.result.feedback}</Text>
              </View>
            )}
            
            {/* Enhanced Pronunciation Analysis with clickable words */}
            <EnhancedPronunciationAnalysis attempt={message.result} />
          </View>
        )}
        <Text style={styles.messageTime}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const renderHistoryItem = ({ item: attempt, index }: { item: PracticeAttempt, index: number }) => {
    const attemptNumber = currentSession!.attempts.length - index;
    const audioUrl = attempt.audioUrl || attempt.audioPath;
    const isCloudStored = audioUrl && (audioUrl.startsWith('http://') || audioUrl.startsWith('https://'));
    
    // Get mispronounced words for practice
    const mispronuncedWords = attempt.mispronuncedWords || [];
    
    return (
      <View key={attempt.id} style={styles.tableRow}>
        <View style={styles.colSerialNumber}>
          <Text style={styles.tableCellText}>{attemptNumber}</Text>
        </View>
        <View style={styles.colAudioFile}>
          <TouchableOpacity
            style={styles.audioButtonContainer}
            onPress={() => playAudio(audioUrl, attempt.id)}
            accessibilityLabel={isPlaying && playingMessageId === attempt.id ? 'Pause audio' : 'Play audio'}
            accessibilityRole="button"
          >
            <Text style={styles.audioPlayIcon}>
              {isPlaying && playingMessageId === attempt.id ? '⏸️' : '▶️'}
            </Text>
            <View style={styles.audioFileInfo}>
              <Text style={styles.audioFileName}>
                {attempt.fileName || `Recording ${attemptNumber}`}
              </Text>
              <Text style={styles.audioFileStatus}>
                {isCloudStored ? '☁️ Cloud' : '💾 Local'} • {attempt.source === 'recording' ? 'Recorded' : 'Uploaded'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.colScore}>
          <View style={styles.scoreContainer}>
            <Text style={[
              styles.scoreValue,
              { color: getAccuracyColor(attempt.scores.accuracy) }
            ]}>
              {formatAccuracy(attempt.scores.accuracy)}
            </Text>
            <Text style={styles.phonemeInfo}>
              {attempt.scores.correct_phonemes}/{attempt.scores.total_phonemes}
            </Text>
          </View>
        </View>
        <View style={styles.colPronunciation}>
          <EnhancedPronunciationAnalysis attempt={attempt} showWordLimit={true} />
        </View>
        <View style={styles.colPractice}>
          {mispronuncedWords.length > 0 ? (
            <View style={styles.practiceColumn}>
              <Text style={styles.practiceTitle}>Words to Practice:</Text>
              <ScrollView style={styles.practiceWordsScrollView} nestedScrollEnabled>
                {mispronuncedWords.map((word, wordIndex) => {
                  const wordPracticeData = practiceWords[word];
                  const isMastered = wordPracticeData?.mastered || false;
                  
                  return (
                    <TouchableOpacity
                      key={wordIndex}
                      style={[
                        styles.practiceWordButton,
                        isMastered && styles.masteredWordButton
                      ]}
                      onPress={() => startWordPractice(word)}
                      accessibilityLabel={`Practice pronunciation of ${word}`}
                      accessibilityRole="button"
                    >
                      <Text style={[
                        styles.practiceWordText,
                        isMastered && styles.masteredWordText
                      ]}>
                        {word} {isMastered ? '✅' : '📚'}
                      </Text>
                      {wordPracticeData && (
                        <Text style={styles.practiceWordStats}>
                          {wordPracticeData.attempts.length} tries, best: {wordPracticeData.bestScore.toFixed(0)}%
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.practiceHint}>Tap words to practice individually</Text>
            </View>
          ) : (
            <View style={styles.noPracticeNeeded}>
              <Text style={styles.noPracticeText}>🎉 All words pronounced correctly!</Text>
            </View>
          )}
        </View>
        <View style={styles.colFeedback}>
          <View style={styles.feedbackContainer}>
            <Text style={styles.feedbackPreview} numberOfLines={3}>
              {attempt.feedback || 'No feedback'}
            </Text>
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => {
                Haptics.selectionAsync();
                Alert.alert(
                  'Detailed Feedback',
                  attempt.feedback || 'No feedback available',
                  [{ text: 'OK' }]
                );
              }}
              accessibilityLabel="View detailed feedback"
              accessibilityRole="button"
            >
              <Text style={styles.showMoreText}>Show more</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.colDateTime}>
          <Text style={styles.timestampText}>
            {attempt.timestamp.toLocaleDateString()}
          </Text>
          <Text style={styles.timestampText}>
            {attempt.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  const currentSession = getCurrentSession();
  const chartData = getProgressChartData();

  if (isAuthenticating) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A5B4FC" />
          <Text style={styles.loadingText}>Authenticating...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return null; // Will redirect to sign in
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.sidebarToggle}
          onPress={toggleSidebar}
          accessibilityLabel="Toggle practice history sidebar"
          accessibilityRole="button"
        >
          <Text style={styles.sidebarIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {currentSession ? `Practice: ${currentSession.referenceText.slice(0, 30)}${currentSession.referenceText.length > 30 ? '...' : ''}` : 'Start New Practice'}
        </Text>
        <View style={styles.headerActions}>
          {currentSession && (
            <TouchableOpacity
              style={styles.newSessionButton}
              onPress={() => {
                Haptics.selectionAsync();
                setCurrentSessionId(null);
                setInputText('');
              }}
              accessibilityLabel="Start new practice session"
              accessibilityRole="button"
            >
              <Text style={styles.newSessionButtonText}>+ New</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityLabel="Sign out"
            accessibilityRole="button"
          >
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
          <Text style={styles.connectionIndicator}>🟢</Text>
        </View>
      </View>

      {/* User info banner */}
      <View style={styles.userInfoBanner}>
        <Text style={styles.userInfoText}>
          👤 {currentUser.displayName || currentUser.email}
        </Text>
      </View>        
      
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: sidebarAnim }] }]}>
        <View style={styles.sidebarHeader}>
          <View style={styles.sidebarTitleContainer}>
            <Text style={styles.sidebarTitle}>Practice History</Text>
            <Text style={styles.sidebarSubtitle}>{sessions.length} sessions</Text>
          </View>
          <TouchableOpacity
            onPress={toggleSidebar}
            style={styles.closeButtonContainer}
            accessibilityLabel="Close sidebar"
            accessibilityRole="button"
          >
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          renderItem={({ item: session }) => (
            <TouchableOpacity
              style={[
                styles.sessionItem,
                currentSession?.id === session.id && styles.activeSessionItem
              ]}
              onPress={() => selectSession(session)}
              accessibilityLabel={`Select session: ${session.referenceText}`}
              accessibilityRole="button"
            >
              <Text style={[
                styles.sessionText,
                currentSession?.id === session.id && styles.activeSessionText
              ]} numberOfLines={2}>
                {session.referenceText}
              </Text>
              <Text style={styles.sessionMeta}>
                {session.attempts.length} attempts • {session.createdAt.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptySessionsContainer}>
              <Text style={styles.emptySessionsIcon}>📚</Text>
              <Text style={styles.emptySessions}>No practice sessions yet</Text>
              <Text style={styles.emptySessionsSubtext}>Start practicing to see your history here</Text>
            </View>
          }
          contentContainerStyle={styles.sidebarContent}
        />
      </Animated.View>
      {sidebarVisible && (
        <TouchableOpacity
          style={styles.sidebarOverlay}
          onPress={toggleSidebar}
          activeOpacity={1}
          accessibilityLabel="Close sidebar"
          accessibilityRole="button"
        />
      )}
      <View style={[
          styles.mainContent, 
          { paddingBottom: currentSession ? insets.bottom + 20 : insets.bottom + 80 }
        ]}>
        {currentSession ? (
          <>
            <View style={styles.referenceSection}>
              <View style={styles.referenceHeader}>
                <Text style={styles.referenceLabel}>Reference Text:</Text>
                <Text style={styles.sessionCount}>Session {currentSession.attempts.length + 1}</Text>
              </View>
              <Text style={styles.referenceText}>{currentSession.referenceText}</Text>
              <View style={styles.audioInputOptions}>
                <TouchableOpacity
                  style={[
                    styles.audioOptionButton,
                    styles.recordOptionButton,
                    (!isFirebaseConnected || isProcessing) && styles.disabledButton
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={!isFirebaseConnected || isProcessing}
                  accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioOptionIcon}>
                    {isRecording ? '⏹️' : '🎤'}
                  </Text>
                  <Text style={styles.audioOptionText}>
                    {isRecording ? `Recording... ${recordingTime}` : 'Record Audio'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.audioOptionButton,
                    styles.uploadOptionButton,
                    (!isFirebaseConnected || isProcessing) && styles.disabledButton
                  ]}
                  onPress={selectAudioFile}
                  disabled={!isFirebaseConnected || isProcessing}
                  accessibilityLabel="Upload audio file"
                  accessibilityRole="button"
                  activeOpacity={0.8}
                >
                  <Text style={styles.audioOptionIcon}>📁</Text>
                  <Text style={styles.audioOptionText}>Upload Audio File</Text>
                </TouchableOpacity>
              </View>
              {isProcessing && (
                <View style={styles.processingSection}>
                  <ActivityIndicator size="small" color="#A5B4FC" />
                  <Text style={styles.processingText}>Analyzing pronunciation...</Text>
                </View>
              )}
            </View>
            <FlatList
              ref={chatScrollRef}
              data={currentSession.messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.chatContent}
              ListFooterComponent={() => (
                <>
                  {chartData && currentSession.attempts.length > 1 && (
                    <SimpleProgressChart data={chartData} />
                  )}
                  {currentSession.attempts.length > 0 && (
                    <View style={styles.historyContainer}>
                      <Text style={styles.historyTitle}>Practice History ({currentSession.attempts.length})</Text>
                      <ScrollView
                        horizontal={true}
                        showsHorizontalScrollIndicator={true}
                        contentContainerStyle={styles.historyTableContainer}
                      >
                        <FlatList
                          data={showAllAttempts ? currentSession.attempts : currentSession.attempts.slice(0, 3)}
                          keyExtractor={(item) => item.id}
                          renderItem={renderHistoryItem}
                          contentContainerStyle={styles.historyTable}
                          showsVerticalScrollIndicator={true}
                          nestedScrollEnabled={true}
                          ListHeaderComponent={
                            <View style={styles.tableHeader}>
                              <View style={styles.colSerialNumber}>
                                <Text style={styles.tableHeaderText}>Attempt #</Text>
                              </View>
                              <View style={styles.colAudioFile}>
                                <Text style={styles.tableHeaderText}>Audio File</Text>
                              </View>
                              <View style={styles.colScore}>
                                <Text style={styles.tableHeaderText}>Score</Text>
                              </View>
                              <View style={styles.colPronunciation}>
                                <Text style={styles.tableHeaderText}>Pronunciation Analysis</Text>
                              </View>
                              <View style={styles.colPractice}>
                                <Text style={styles.tableHeaderText}>Word Practice</Text>
                              </View>
                              <View style={styles.colFeedback}>
                                <Text style={styles.tableHeaderText}>Feedback</Text>
                              </View>
                              <View style={styles.colDateTime}>
                                <Text style={styles.tableHeaderText}>Date/Time</Text>
                              </View>
                            </View>
                          }
                          ListFooterComponent={() =>
                            currentSession.attempts.length > 3 ? (
                              <View style={styles.showMoreContainer}>
                                {showAllAttempts ? (
                                  <TouchableOpacity
                                    style={styles.showLessButton}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      setShowAllAttempts(false);
                                    }}
                                    accessibilityLabel="Show fewer attempts"
                                    accessibilityRole="button"
                                  >
                                    <Text style={styles.showLessText}>Show Fewer Attempts</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity
                                    style={styles.showMoreButton}
                                    onPress={() => {
                                      Haptics.selectionAsync();
                                      setShowAllAttempts(true);
                                    }}
                                    accessibilityLabel="Show all attempts"
                                    accessibilityRole="button"
                                  >
                                    <Text style={styles.showMoreText}>Show All {currentSession.attempts.length} Attempts</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            ) : null
                          }
                        />
                      </ScrollView>
                    </View>
                  )}
                </>
              )}
            />
          </>
        ) : (
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeTitle}>Welcome to Pronunciation Coach!</Text>
            <Text style={styles.welcomeText}>
              Send a sentence you'd like to practice, then record your pronunciation or upload an audio file.
            </Text>
            {!isFirebaseConnected && (
              <Text style={styles.firebaseWarning}>
                ⚠️ Please check Firebase configuration or authentication.
              </Text>
            )}
          </View>
        )}
      </View>
      
      {/* Word Practice Session Overlay */}
      {currentPracticeWord && (
        <View style={styles.practiceOverlay}>
          <View style={styles.practiceOverlayBackground} />
          <View style={styles.practiceModal}>
            <WordPracticeSession word={currentPracticeWord} />
          </View>
        </View>
      )}
      
      {/* Only show input section when there's NO active session */}
      {!currentSession && (
        <View style={[styles.inputSection, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a sentence to practice..."
              multiline
              maxLength={200}
              editable={isFirebaseConnected}
              accessibilityLabel="Enter practice sentence"
              accessibilityRole="text"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || isProcessing || !isFirebaseConnected) && styles.sendButtonDisabled
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                sendTextMessage();
              }}
              disabled={!inputText.trim() || isProcessing || !isFirebaseConnected}
              accessibilityLabel="Send practice sentence"
              accessibilityRole="button"
              activeOpacity={0.8}
            >
              <Text style={styles.sendButtonText}>➤</Text>
            </TouchableOpacity>
          </View>
          {!isFirebaseConnected && (
            <Text style={styles.connectionWarning}>
              ⚠️ Firebase connection required to save sessions
            </Text>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontWeight: '600',
    fontFamily: 'RobotoMono-Medium',
  },
  connectionStatus: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F43F5E',
    alignItems: 'center',
  },
  connectionStatusText: {
    fontSize: 12,
    color: '#F43F5E',
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: 'RobotoMono-Medium',
  },
  connectionIndicator: {
    fontSize: 14,
    marginLeft: 12,
    color: '#10B981',
  },
  disabledButton: {
    opacity: 0.6,
  },
  firebaseWarning: {
    fontSize: 14,
    color: '#F43F5E',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'RobotoMono-Medium',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
  },
  sidebarToggle: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(102, 126, 234, 0.12)',
    marginRight: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sidebarIcon: {
    fontSize: 24,
    color: '#667eea',
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: width < 360 ? 16 : 18,
    fontWeight: '700',
    color: '#1F2937',
    marginRight: 12,
    fontFamily: 'RobotoMono-Bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newSessionButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  newSessionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.8,
    backgroundColor: '#FFFFFF',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#667eea',
  },
  sidebarTitleContainer: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: width < 360 ? 18 : 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'RobotoMono-Bold',
  },
  sidebarSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '400',
    fontFamily: 'RobotoMono-Regular',
  },
  closeButtonContainer: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  closeButton: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sidebarContent: {
    flexGrow: 1,
    padding: 12,
  },
  sessionItem: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeSessionItem: {
    backgroundColor: 'rgba(102, 126, 234, 0.15)',
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  sessionText: {
    fontSize: width < 360 ? 14 : 15,
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 20,
    fontFamily: 'RobotoMono-Medium',
  },
  activeSessionText: {
    color: '#667eea',
    fontWeight: '700',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    fontFamily: 'RobotoMono-Regular',
  },
  emptySessionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: height * 0.1,
    paddingHorizontal: 20,
  },
  emptySessionsIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: '#6B7280',
    opacity: 0.6,
  },
  emptySessions: {
    textAlign: 'center',
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'RobotoMono-SemiBold',
  },
  emptySessionsSubtext: {
    textAlign: 'center',
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'RobotoMono-Regular',
  },
  mainContent: {
    flex: 1,
    paddingBottom: 80,
  },
  referenceSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
    borderLeftWidth: 4,
    borderLeftColor: '#EDE9FE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  referenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referenceLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
    fontFamily: 'RobotoMono-Bold',
  },
  sessionCount: {
    fontSize: 12,
    color: '#6B7280',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    fontFamily: 'RobotoMono-Medium',
  },
  referenceText: {
    fontSize: width < 360 ? 16 : 18,
    color: '#1F2937',
    lineHeight: 26,
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#7C3AED',
    fontFamily: 'RobotoMono-Regular',
  },
  audioInputOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  audioOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 140,
  },
  recordOptionButton: {
    backgroundColor: '#667eea',
  },
  uploadOptionButton: {
    backgroundColor: '#f093fb',
  },
  audioOptionIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    marginRight: 10,
  },
  audioOptionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  processingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 10,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderRadius: 10,
  },
  processingText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'RobotoMono-Medium',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FF',
  },
  welcomeTitle: {
    fontSize: width < 360 ? 22 : 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'RobotoMono-Bold',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'RobotoMono-Regular',
  },
  // Enhanced pronunciation word styles
  pronunciationWordButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pronunciationWordText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  sentenceAudioButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sentenceAudioText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'RobotoMono-Regular',
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#1F2937',
  },
  audioMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  audioPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioPlayButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  audioMessageText: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
    fontFamily: 'RobotoMono-Regular',
  },
  resultMessage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'RobotoMono-Bold',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'RobotoMono-Bold',
  },
  phonemeText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'RobotoMono-Regular',
  },
  audioFileInfo: {
    flex: 1,
    marginLeft: 8,
  },
  audioFileStatus: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'RobotoMono-Regular',
  },
  moreWordsText: {
    fontSize: 11,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 4,
    fontFamily: 'RobotoMono-Regular',
  },
  feedbackContainer: {
    backgroundColor: '#EDE9FE',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    fontFamily: 'RobotoMono-Bold',
  },
  feedbackText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontFamily: 'RobotoMono-Regular',
  },
  messageTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'right',
    fontFamily: 'RobotoMono-Regular',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    textAlign: 'center',
    fontFamily: 'RobotoMono-Bold',
  },
  simpleChart: {
    flexDirection: 'row',
    height: 180,
    marginVertical: 16,
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 16,
  },
  chartYAxis: {
    width: 60,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  chartAxisLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontFamily: 'RobotoMono-SemiBold',
  },
  chartLine: {
    height: 130,
    position: 'relative',
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  chartArea: {
    flex: 1,
    justifyContent: 'flex-end',
    position: 'relative', // Added for proper SVG positioning
  },
  
chartPointContainer: {
  position: 'absolute',
  width: 12,
  height: '100%',
  alignItems: 'center',
  marginLeft: -6, // Center the point
},
chartDot: {
  position: 'absolute',
  width: 12,
  height: 12,
  borderRadius: 6,
  borderWidth: 3,
  borderColor: '#FFFFFF',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 5, // Higher elevation for dots to appear on top
  zIndex: 10,
},

chartValueLabel: {
  position: 'absolute',
  backgroundColor: '#6B7280',
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 8,
  opacity: 0.9,
  zIndex: 11, // Labels on top
},
  chartValueText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: 'RobotoMono-Bold',
  },
  chartXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
  },
  chartXLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
    flex: 1,
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  historyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
    fontFamily: 'RobotoMono-Bold',
  },
  historyTableContainer: {
    minWidth: 1200, // Increased width to accommodate practice column
    flexGrow: 1,
  },
  historyTable: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EDE9FE',
    backgroundColor: '#EDE9FE',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7C3AED',
    borderBottomWidth: 2,
    borderBottomColor: '#EDE9FE',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minWidth: 1200, // Increased width
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE9FE',
  },
  colSerialNumber: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colAudioFile: {
    width: 180,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  colScore: {
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colPronunciation: {
    width: 220,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  colPractice: {
    width: 250, // New practice column
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  colFeedback: {
    width: 250, // Reduced from 300 to make room
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  colDateTime: {
    width: 120,
    justifyContent: 'center',
    alignItems: 'center',
  }, 
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'RobotoMono-Bold',
  },
  tableCellText: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    fontFamily: 'RobotoMono-Regular',
  },
  audioButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioPlayIcon: {
    fontSize: 20,
    color: '#7C3AED',
  },
  audioFileName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
    fontFamily: 'RobotoMono-Regular',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'RobotoMono-Bold',
  },
  phonemeInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontFamily: 'RobotoMono-Regular',
  },
  pronunciationAnalysis: {
    flex: 1,
  },
  correctWordsSection: {
    marginBottom: 8,
  },
  mispronuncedWordsSection: {
    marginBottom: 8,
  },
  pronunciationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    fontFamily: 'RobotoMono-SemiBold',
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  correctWordTag: {
    backgroundColor: '#6EE7B7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  correctWordText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  mispronunciationTag: {
    backgroundColor: '#FCA5A5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mispronunciationText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  perfectSection: {
    backgroundColor: '#6EE7B7',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  perfectText: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  // Practice column styles
  practiceColumn: {
    flex: 1,
  },
  practiceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    fontFamily: 'RobotoMono-Bold',
  },
  practiceWordsScrollView: {
    maxHeight: 120,
    marginBottom: 6,
  },
  practiceWordButton: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 4,
    alignItems: 'center',
  },
  masteredWordButton: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  practiceWordText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    fontFamily: 'RobotoMono-SemiBold',
  },
  masteredWordText: {
    color: '#10B981',
  },
  practiceWordStats: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'RobotoMono-Regular',
  },
  practiceHint: {
    fontSize: 10,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    fontFamily: 'RobotoMono-Regular',
  },
  noPracticeNeeded: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPracticeText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'RobotoMono-SemiBold',
  },
  // Practice session overlay styles
  practiceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  practiceOverlayBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  practiceModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    margin: 20,
    maxWidth: width * 0.9,
    maxHeight: height * 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  practiceSessionContainer: {
    minWidth: 300,
  },
  practiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  practiceWordTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    fontFamily: 'RobotoMono-Bold',
  },
  closePracticeButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePracticeText: {
    fontSize: 18,
    color: '#6B7280',
    fontWeight: '600',
  },
  practiceAudioSection: {
    marginBottom: 20,
  },
  practiceListenButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  practiceListenText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  practiceRecordSection: {
    marginBottom: 20,
  },
  practiceRecordButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  practiceRecordButtonActive: {
    backgroundColor: '#EF4444',
  },
  practiceRecordIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  practiceRecordText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  practiceStatsSection: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  practiceStatsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    fontFamily: 'RobotoMono-Bold',
  },
  practiceStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  practiceStatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'RobotoMono-SemiBold',
  },
  recentAttemptsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
    fontFamily: 'RobotoMono-SemiBold',
  },
  recentAttemptsList: {
    maxHeight: 120,
  },
  attemptItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attemptInfo: {
    flex: 1,
  },
  attemptScore: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'RobotoMono-SemiBold',
  },
  attemptTime: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontFamily: 'RobotoMono-Regular',
  },
  playAttemptButton: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  playAttemptIcon: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  practiceTipsSection: {
    backgroundColor: '#EDE9FE',
    borderRadius: 12,
    padding: 16,
  },
  practiceTipsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
    marginBottom: 12,
    fontFamily: 'RobotoMono-Bold',
  },
  practiceTipText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
    fontFamily: 'RobotoMono-Regular',
  },
  feedbackPreview: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    fontFamily: 'RobotoMono-Regular',
  },
  showMoreButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  showMoreText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  showLessButton: {
    marginTop: 12,
    alignSelf: 'center',
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  showLessText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
  showMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    fontFamily: 'RobotoMono-Regular',
  },
  inputSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#E8ECFF',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    maxHeight: 100,
    fontFamily: 'RobotoMono-Regular',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  sendButtonDisabled: {
    backgroundColor: '#B8C5F6',
    shadowOpacity: 0.1,
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  connectionWarning: {
    fontSize: 12,
    color: '#F43F5E',
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'RobotoMono-Regular',
  },
  signOutButton: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  signOutText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  userInfoBanner: {
    backgroundColor: '#EDE9FE',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#C4B5FD',
  },
  userInfoText: {
    fontSize: 12,
    color: '#5B21B6',
    fontWeight: '500',
  },

  wordAttemptsTableContainer: {
  marginTop: 16,
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: '#EDE9FE',
},
feedbackShowMoreButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#7C3AED',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  feedbackShowMoreText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'RobotoMono-SemiBold',
  },
wordAttemptsTableTitle: {
  fontSize: 14,
  fontWeight: '700',
  color: '#1F2937',
  marginBottom: 12,
  fontFamily: 'RobotoMono-Bold',
},
wordAttemptsScrollContent: {
  minWidth: 700,
},
wordAttemptsTable: {
  minWidth: 700,
},
wordAttemptHeader: {
  flexDirection: 'row',
  backgroundColor: '#7C3AED',
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderTopLeftRadius: 8,
  borderTopRightRadius: 8,
},
wordAttemptHeaderText: {
  fontSize: 12,
  fontWeight: '700',
  color: '#FFFFFF',
  textAlign: 'center',
  fontFamily: 'RobotoMono-Bold',
},
wordAttemptRow: {
  flexDirection: 'row',
  backgroundColor: '#FFFFFF',
  paddingVertical: 10,
  paddingHorizontal: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#EDE9FE',
},
wordAttemptCol1: {
  width: 50,
  justifyContent: 'center',
  alignItems: 'center',
},
wordAttemptCol2: {
  width: 180,
  justifyContent: 'center',
  paddingHorizontal: 8,
},
wordAttemptCol3: {
  width: 120,
  justifyContent: 'center',
  alignItems: 'center',
},
wordAttemptCol4: {
  width: 250,
  justifyContent: 'center',
  paddingHorizontal: 8,
},
wordAttemptCol5: {
  width: 100,
  justifyContent: 'center',
  alignItems: 'center',
},
wordAttemptText: {
  fontSize: 14,
  fontWeight: '600',
  color: '#1F2937',
  fontFamily: 'RobotoMono-SemiBold',
},
wordAttemptAudioButton: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
},
wordAttemptAudioInfo: {
  flex: 1,
},
wordAttemptAudioText: {
  fontSize: 13,
  color: '#1F2937',
  fontFamily: 'RobotoMono-Regular',
},
wordAttemptAudioStatus: {
  fontSize: 10,
  color: '#6B7280',
  marginTop: 2,
  fontFamily: 'RobotoMono-Regular',
},
wordAttemptScore: {
  fontSize: 16,
  fontWeight: '700',
  fontFamily: 'RobotoMono-Bold',
},
wordAttemptStatus: {
  fontSize: 11,
  color: '#6B7280',
  marginTop: 4,
  textAlign: 'center',
  fontFamily: 'RobotoMono-Regular',
},
wordAttemptFeedback: {
  fontSize: 12,
  color: '#6B7280',
  lineHeight: 18,
  fontFamily: 'RobotoMono-Regular',
},
wordAttemptTime: {
  fontSize: 11,
  color: '#6B7280',
  textAlign: 'center',
  fontFamily: 'RobotoMono-Regular',
},
wordAttemptShowMoreContainer: {
  paddingVertical: 12,
  alignItems: 'center',
  borderTopWidth: 1,
  borderTopColor: '#EDE9FE',
},
practiceListenButtonActive: {
  backgroundColor: '#5B21B6', // Darker purple when playing
},
});