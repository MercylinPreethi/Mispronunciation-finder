import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  SafeAreaView,
  StatusBar,
  Platform,
  FlatList,
  Dimensions,
  Animated
} from 'react-native';
import AudioRecorderPlayer, { 
  AudioEncoderAndroidType, 
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption
} from 'react-native-audio-recorder-player';
import * as DocumentPicker from 'expo-document-picker';
import RNFS from 'react-native-fs';
import axios from 'axios';

// Firebase configuration - Set to true and configure properly
const FIREBASE_ENABLED = true;

// Firebase imports
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, push, child, onValue, off } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';

const firebaseConfig = {
    apiKey: "AIzaSyATKCD4oJsveTPwtzaUcRz28nqXtWJsQRo",
    authDomain: "mispronunciation-e1fb0.firebaseapp.com", 
    databaseURL: "https://mispronunciation-e1fb0-default-rtdb.firebaseio.com/",
    projectId: "mispronunciation-e1fb0",
    storageBucket: "mispronunciation-e1fb0.firebasestorage.app",
    messagingSenderId: "329898480943",
    appId: "1:329898480943:android:84388a674d779a271afdda"
  };


const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

const audioRecorderPlayer = new AudioRecorderPlayer();
const { width, height } = Dimensions.get('window');

interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
}

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
}

interface PracticeAttempt {
  id: string;
  timestamp: Date;
  audioPath: string;
  audioUrl?: string; // Cloudinary URL
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

// Firebase data structure interfaces
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
}

interface FirebaseUserData {
  references: { [key: string]: FirebaseReferenceText };
}

// Helper function to generate session ID
const generateSessionId = (referenceText: string): string => {
  const timestamp = Date.now();
  const textHash = referenceText.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `${textHash}_${timestamp}`;
};

export default function PronunciationCoachChat() {
  // Main state
  const [sessions, setSessions] = useState<SentenceSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  
  // Chat state
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  
  const sidebarAnim = useRef(new Animated.Value(-width * 0.8)).current;
  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const chatScrollRef = useRef<ScrollView>(null);
  const API_BASE_URL = 'http://192.168.14.34:5050';
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    initializeFirebase();
    return () => {
      // Clean up any Firebase listeners on unmount
      if (userId) {
        const sessionsRef = ref(database, `users/${userId}/sessions`);
        off(sessionsRef);
      }
    };
  }, [userId]);

  // Initialize Firebase Realtime Database
  const initializeFirebase = async () => {
    try {
      setIsAuthenticating(true);
      
      // Set up auth state listener
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          setCurrentUser(user);
          setUserId(user.uid);
          setIsFirebaseConnected(true);
          console.log('Firebase authenticated successfully:', user.uid);
          
          // Load existing sessions and set up listener
          await loadFirebaseSessions(user.uid);
          setupSessionsListener(user.uid);
        } else {
          // Sign in anonymously
          try {
            const userCredential = await signInAnonymously(auth);
            console.log('Anonymous authentication successful:', userCredential.user.uid);
          } catch (error) {
            console.error('Anonymous authentication failed:', error);
            setIsFirebaseConnected(false);
            Alert.alert('Authentication Error', 'Failed to authenticate with Firebase.');
          }
        }
        setIsAuthenticating(false);
      });
      
    } catch (error) {
      console.error('Error initializing Firebase:', error);
      setIsFirebaseConnected(false);
      setIsAuthenticating(false);
      Alert.alert('Firebase Connection Error', 'Failed to connect to Firebase. Please check your configuration.');
    }
  };

  // Set up real-time listener for sessions
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

  // Load sessions from Firebase
  const loadFirebaseSessions = async (userIdParam: string) => {
    try {
      const referencesRef = ref(database, `users/${userIdParam}/references`);
      const snapshot = await get(referencesRef);
      
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
      }
    } catch (error) {
      console.error('Error loading sessions from Firebase:', error);
    }
  };

  // Cloudinary configuration
  const CLOUDINARY_UPLOAD_PRESET = 'dc8kh6npf'
  const CLOUDINARY_CLOUD_NAME = 'dc8kh6npf'
 
  // Cloudinary upload function
  const uploadToCloudinary = async (audioPath: string, attemptId: string): Promise<string> => {
    try {
      const audioData = await RNFS.readFile(audioPath, 'base64');
      
      const formData = new FormData();
      formData.append('file', `data:audio/wav;base64,${audioData}`);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('public_id', `pronunciation_audio_${attemptId}`);
      formData.append('resource_type', 'video'); 
      formData.append('folder', 'pronunciation_coach');

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const result = await response.json();
      
      if (result.secure_url) {
        console.log('Audio uploaded to Cloudinary:', result.secure_url);
        return result.secure_url;
      } else {
        throw new Error('Failed to upload to Cloudinary: ' + JSON.stringify(result));
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw error;
    }
  };

  // Save session to Firebase (now saves to references structure)
  const saveSessionToFirebase = async (session: SentenceSession) => {
    if (!isFirebaseConnected) {
      Alert.alert('Firebase Error', 'Not connected to Firebase. Please check your connection.');
      return;
    }

    try {
      const referenceRef = ref(database, `users/${userId}/references/${session.id}`);
      
      // Convert session data for Firebase
      const referenceData: FirebaseReferenceText = {
        text: session.referenceText,
        createdAt: session.createdAt.toISOString(),
        attempts: {},
        messages: {}
      };

      // Add attempts
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

      // Add messages
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
      console.log('Reference session saved to Firebase successfully');
      
    } catch (error) {
      console.error('Error saving reference session to Firebase:', error);
      Alert.alert('Save Error', 'Failed to save session to Firebase.');
    }
  };

  // Save attempt to Firebase
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
      console.log('Attempt saved to Firebase successfully');
      
    } catch (error) {
      console.error('Error saving attempt to Firebase:', error);
      Alert.alert('Save Error', 'Failed to save attempt to Firebase.');
    }
  };

  // Save message to Firebase
  const saveMessageToFirebase = async (sessionId: string, message: ChatMessage) => {
    if (!isFirebaseConnected) {
      Alert.alert('Firebase Error', 'Not connected to Firebase. Please check your connection.');
      return;
    }

    try {
      const messageRef = ref(database, `users/${userId}/references/${sessionId}/messages/${message.id}`);
      
      const messageData: FirebaseMessage = {
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

      await set(messageRef, messageData);
      console.log('Message saved to Firebase successfully');
      
    } catch (error) {
      console.error('Error saving message to Firebase:', error);
      Alert.alert('Save Error', 'Failed to save message to Firebase.');
    }
  };

  const getCurrentSession = (): SentenceSession | null => {
    return sessions.find(session => session.id === currentSessionId) || null;
  };

  const createNewSession = async (referenceText: string) => {
    // Check if a session with this reference text already exists
    const existingSession = sessions.find(session => 
      session.referenceText.toLowerCase().trim() === referenceText.toLowerCase().trim()
    );

    if (existingSession) {
      // Switch to existing session
      setCurrentSessionId(existingSession.id);
      
      // Add message indicating we switched to existing session
      addMessage({
        type: 'text',
        content: `Switched to existing session for: "${referenceText}"\n\nYou have ${existingSession.attempts.length} previous attempts. You can continue practicing with the audio options above!`,
        isUser: false
      });
      return;
    }

    // Create new session with reference text as basis for ID
    const sessionId = generateSessionId(referenceText);
    const newSession: SentenceSession = {
      id: sessionId,
      referenceText,
      createdAt: new Date(),
      attempts: [],
      messages: []
    };
    
    setCurrentSessionId(newSession.id);
    
    // Save to Firebase
    await saveSessionToFirebase(newSession);
    
    // Add initial bot message
    addMessage({
      type: 'text',
      content: `Perfect! I've created a new practice session for:\n\n"${referenceText}"\n\nNow you can:\n🎤 Record your pronunciation\n📁 Upload an audio file\n\nChoose either option above to start practicing!`,
      isUser: false
    });
  };

  const addMessage = async (messageData: Partial<ChatMessage>) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      timestamp: new Date(),
      ...messageData
    } as ChatMessage;

    const currentSession = getCurrentSession();
    if (currentSession && isFirebaseConnected) {
      // Check if this is a command to create a new session
      if (newMessage.isUser && newMessage.content.toLowerCase() === 'new') {
        // Don't save this command message, just process it
        setTimeout(() => {
          addMessage({
            type: 'text',
            content: "Please type the new sentence you'd like to practice:",
            isUser: false
          });
        }, 500);
        return;
      }
      
      // Save message to Firebase
      await saveMessageToFirebase(currentSession.id, newMessage);
      
      // Auto scroll to bottom
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
    
    // Handle special commands
    if (currentSession && text.toLowerCase() === 'new') {
      addMessage({
        type: 'text',
        content: 'new',
        isUser: true
      });
      
      setTimeout(() => {
        addMessage({
          type: 'text',
          content: "Please type the new sentence you'd like to practice:",
          isUser: false
        });
      }, 500);
      return;
    }
    
    // Add user message
    addMessage({
      type: 'text',
      content: text,
      isUser: true
    });
    
    // Check if this is a new sentence or continuation
    if (!currentSession) {
      // Create new session with the reference text
      createNewSession(text);
    } else {
      // Check if user wants to start a new session after typing 'new'
      const lastMessages = currentSession.messages.slice(-2);
      const lastBotMessage = lastMessages.find(m => !m.isUser);
      
      if (lastBotMessage && lastBotMessage.content.includes("Please type the new sentence")) {
        // User is providing a new reference text
        createNewSession(text);
      } else {
        // Offer to create a new session or continue with current one
        setTimeout(() => {
          addMessage({
            type: 'text',
            content: `I see you want to practice: "${text}"\n\nWould you like to:\n• Start a new practice session with this text\n• Continue practicing: "${currentSession.referenceText}"\n\nType 'new' to start fresh, or use the audio options above to continue with current session.`,
            isUser: false
          });
        }, 500);
      }
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
        recordTimeRef.current = audioRecorderPlayer.mmssss(
          Math.floor(e.currentPosition),
        );
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
      
      // Add audio message
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
      Alert.alert('Error', 'Failed to stop recording');
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
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Add audio message
        addMessage({
          type: 'audio',
          content: 'Audio file uploaded',
          audioPath: file.uri,
          fileName: file.name,
          isUser: true
        });
        
        // Process the audio
        processAudio(file.uri, 'upload', file.name);
      }
    } catch (error) {
      console.error('File selection error:', error);
      Alert.alert('Error', 'Failed to select audio file');
    }
  };

  const processAudio = async (audioPath: string, source: 'recording' | 'upload', fileName?: string) => {
    const currentSession = getCurrentSession();
    if (!currentSession || !audioPath) return;

    setIsProcessing(true);
    
    // Add processing message
    addMessage({
      type: 'text',
      content: 'Analyzing your pronunciation... 🔄',
      isUser: false
    });

    try {
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
        uri: Platform.OS === 'ios' ? audioPath : `file://${audioPath}`,
        type: mimeType,
        name: audioFileName,
      } as any);
      
      formData.append('reference_text', currentSession.referenceText);

      const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });

      if (response.data.success) {
        const mispronuncedWords = response.data.analysis.mispronunciations.map((error: MispronunciationError) => error.predicted);
        
        // Upload audio to Cloudinary
        let audioUrl = audioPath;
        try {
          audioUrl = await uploadToCloudinary(audioPath, Date.now().toString());
          console.log('Audio uploaded to Cloudinary successfully:', audioUrl);
        } catch (cloudinaryError) {
          console.warn('Cloudinary upload failed, using local path:', cloudinaryError);
        }
        
        const newAttempt: PracticeAttempt = {
          id: Date.now().toString(),
          timestamp: new Date(),
          audioPath,
          audioUrl,
          scores: response.data.analysis,
          feedback: response.data.feedback || '',
          source,
          fileName: source === 'upload' ? fileName : undefined,
          mispronuncedWords,
          correctlyPronuncedWords: [] // Initialize with empty array, can be calculated from analysis
        };

        // Save attempt to Firebase
        await saveAttemptToFirebase(currentSession.id, newAttempt);

        // Add result message
        addMessage({
          type: 'result',
          content: 'Analysis Complete! 🎉',
          isUser: false,
          result: newAttempt
        });
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error: any) {
      console.error('Processing error:', error);
      let errorMessage = 'Failed to process audio.';
      
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        errorMessage = `Unable to connect to server at ${API_BASE_URL}. Please check:\n• Server is running\n• IP address is correct\n• Network connection is active`;
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timeout. Please try with a shorter audio file.';
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

  const playAudio = async (audioPath: string, messageId: string) => {
    try {
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

      setIsPlaying(true);
      setPlayingMessageId(messageId);
      await audioRecorderPlayer.startPlayer(audioPath);
      
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
    }
  };

  const toggleSidebar = () => {
    const toValue = sidebarVisible ? -width * 0.8 : 0;
    Animated.timing(sidebarAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarVisible(!sidebarVisible);
  };

  const selectSession = (session: SentenceSession) => {
    setCurrentSessionId(session.id);
    toggleSidebar();
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#4CAF50';
    if (accuracy >= 0.8) return '#FF9800';
    return '#F44336';
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  // Simple Progress Chart Component
  const SimpleProgressChart = ({ data }: { data: { labels: string[], datasets: Array<{ data: number[] }> } }) => {
    const maxValue = Math.max(...data.datasets[0].data);
    const minValue = Math.min(...data.datasets[0].data);
    const range = maxValue - minValue || 1;
    
    return (
      <View style={styles.simpleChart}>
        <View style={styles.chartYAxis}>
          <Text style={styles.chartAxisLabel}>{maxValue.toFixed(1)}%</Text>
          <Text style={styles.chartAxisLabel}>{((maxValue + minValue) / 2).toFixed(1)}%</Text>
          <Text style={styles.chartAxisLabel}>{minValue.toFixed(1)}%</Text>
        </View>
        <View style={styles.chartArea}>
          <View style={styles.chartLine}>
            {data.datasets[0].data.map((value, index) => {
              const height = ((value - minValue) / range) * 120;
              const isLast = index === data.datasets[0].data.length - 1;
              return (
                <View key={index} style={styles.chartPoint}>
                  <View style={[styles.chartDot, { bottom: height }]} />
                  {index < data.datasets[0].data.length - 1 && (
                    <View 
                      style={[
                        styles.chartConnection,
                        { 
                          bottom: height,
                          height: ((data.datasets[0].data[index + 1] - minValue) / range) * 120 - height,
                        }
                      ]} 
                    />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.chartXAxis}>
            {data.labels.map((label, index) => (
              <Text key={index} style={styles.chartXLabel}>{label}</Text>
            ))}
          </View>
        </View>
      </View>
    );
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
      datasets: [{
        data
      }]
    };
  };

  const renderMessage = (message: ChatMessage) => {
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
          </View>
        )}
        
        <Text style={styles.messageTime}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  const currentSession = getCurrentSession();
  const chartData = getProgressChartData();

  // Show loading screen while authenticating
  if (isAuthenticating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Connecting to Firebase...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Firebase Connection Status */}
      {!isFirebaseConnected && (
        <View style={styles.connectionStatus}>
          <Text style={styles.connectionStatusText}>⚠️ Firebase not connected</Text>
        </View>
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.sidebarToggle} onPress={toggleSidebar}>
          <Text style={styles.sidebarIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {currentSession ? 'Pronunciation Practice' : 'Start New Practice'}
        </Text>
        {isFirebaseConnected && (
          <Text style={styles.connectionIndicator}>🟢</Text>
        )}
      </View>

      {/* Sidebar */}
      <Animated.View 
        style={[
          styles.sidebar,
          { transform: [{ translateX: sidebarAnim }] }
        ]}
      >
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarTitle}>Practice History</Text>
          <TouchableOpacity onPress={toggleSidebar}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.sidebarContent}>
          {sessions.map((session) => (
            <TouchableOpacity
              key={session.id}
              style={[
                styles.sessionItem,
                currentSession?.id === session.id && styles.activeSessionItem
              ]}
              onPress={() => selectSession(session)}
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
          ))}
          {sessions.length === 0 && (
            <Text style={styles.emptySessions}>No practice sessions yet</Text>
          )}
        </ScrollView>
      </Animated.View>

      {/* Sidebar Overlay */}
      {sidebarVisible && (
        <TouchableOpacity 
          style={styles.sidebarOverlay} 
          onPress={toggleSidebar}
          activeOpacity={1}
        />
      )}

      {/* Main Content */}
      <View style={styles.mainContent}>
        {currentSession ? (
          <>
            {/* Reference Text Section */}
            <View style={styles.referenceSection}>
              <View style={styles.referenceHeader}>
                <Text style={styles.referenceLabel}>Reference Text:</Text>
                <Text style={styles.sessionCount}>Session {currentSession.attempts.length + 1}</Text>
              </View>
              <Text style={styles.referenceText}>{currentSession.referenceText}</Text>
              
              {/* Audio Input Options */}
              <View style={styles.audioInputOptions}>
                <TouchableOpacity
                  style={[
                    styles.audioOptionButton,
                    styles.recordOptionButton,
                    (!isFirebaseConnected || isProcessing) && styles.disabledButton
                  ]}
                  onPress={isRecording ? stopRecording : startRecording}
                  disabled={!isFirebaseConnected || isProcessing}
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
                >
                  <Text style={styles.audioOptionIcon}>📁</Text>
                  <Text style={styles.audioOptionText}>Upload Audio File</Text>
                </TouchableOpacity>
              </View>
              
              {isProcessing && (
                <View style={styles.processingSection}>
                  <ActivityIndicator size="small" color="#007AFF" />
                  <Text style={styles.processingText}>Analyzing pronunciation...</Text>
                </View>
              )}
            </View>

            {/* Chat Messages */}
            <ScrollView 
              ref={chatScrollRef}
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContent}
            >
              
              {/* Messages */}
              {currentSession.messages.map(renderMessage)}
              
              {/* Progress Chart */}
              {chartData && currentSession.attempts.length > 1 && (
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Progress Chart</Text>
                  <SimpleProgressChart data={chartData} />
                </View>
              )}
              
              {/* Practice History Table - Horizontally Scrollable */}
              {currentSession.attempts.length > 0 && (
                <View style={styles.historyContainer}>
                  <Text style={styles.historyTitle}>Practice History ({currentSession.attempts.length})</Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScrollContainer}>
                    <View style={styles.historyTable}>
                      {/* Table Header */}
                      <View style={styles.tableHeader}>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>S.No</Text>
                        </View>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>Audio File</Text>
                        </View>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>Score</Text>
                        </View>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>Mispronounced Words</Text>
                        </View>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>Feedback</Text>
                        </View>
                        <View style={styles.tableColumn}>
                          <Text style={styles.tableHeaderText}>Date/Time</Text>
                        </View>
                      </View>
                      
                      {/* Table Rows */}
                      {currentSession.attempts.map((attempt, index) => (
                        <View key={attempt.id} style={styles.tableRow}>
                          <View style={styles.tableColumn}>
                            <Text style={styles.tableCellText}>{index + 1}</Text>
                          </View>
                          
                          <View style={styles.tableColumn}>
                            <TouchableOpacity 
                              style={styles.audioButtonContainer}
                              onPress={() => playAudio(attempt.audioUrl || attempt.audioPath, attempt.id)}
                            >
                              <Text style={styles.audioPlayIcon}>
                                {isPlaying && playingMessageId === attempt.id ? '⏸️' : '▶️'}
                              </Text>
                              <Text style={styles.audioFileName} numberOfLines={2}>
                                {attempt.fileName || `Recording ${index + 1}`}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          
                          <View style={styles.tableColumn}>
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
                          
                          <View style={styles.tableColumn}>
                            <View style={styles.mispronunciationContainer}>
                              {attempt.mispronuncedWords.length > 0 ? (
                                <ScrollView style={styles.mispronunciationScroll} nestedScrollEnabled>
                                  {attempt.mispronuncedWords.map((word, wordIndex) => (
                                    <View key={wordIndex} style={styles.mispronunciationTag}>
                                      <Text style={styles.mispronunciationText}>{word}</Text>
                                    </View>
                                  ))}
                                </ScrollView>
                              ) : (
                                <Text style={styles.perfectText}>Perfect! 🎉</Text>
                              )}
                            </View>
                          </View>
                          
                          <View style={styles.tableColumn}>
                            <TouchableOpacity 
                              style={styles.feedbackContainer}
                              onPress={() => Alert.alert(
                                'Detailed Feedback',
                                attempt.feedback || 'No feedback available',
                                [{ text: 'OK' }]
                              )}
                            >
                              <Text style={styles.feedbackPreview} numberOfLines={3}>
                                {attempt.feedback || 'No feedback'}
                              </Text>
                              <Text style={styles.tapToExpand}>Tap to expand</Text>
                            </TouchableOpacity>
                          </View>
                          
                          <View style={styles.tableColumn}>
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
                      ))}
                    </View>
                  </ScrollView>
                </View>
              )}
            </ScrollView>
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

      {/* Input Section - For Reference Text Only */}
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={currentSession ? "Type a new sentence to practice..." : "Type a sentence to practice..."}
            multiline
            maxLength={200}
            editable={isFirebaseConnected}
          />
          
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isProcessing || !isFirebaseConnected) && styles.sendButtonDisabled
            ]}
            onPress={sendTextMessage}
            disabled={!inputText.trim() || isProcessing || !isFirebaseConnected}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  loadingSubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  connectionStatus: {
    backgroundColor: '#ffebcd',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ffd700',
  },
  connectionStatusText: {
    fontSize: 12,
    color: '#b8860b',
    textAlign: 'center',
  },
  connectionIndicator: {
    fontSize: 12,
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  firebaseWarning: {
    fontSize: 14,
    color: '#ff6b35',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  sidebarToggle: {
    padding: 8,
    marginRight: 10,
  },
  sidebarIcon: {
    fontSize: 18,
    color: '#007AFF',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: width * 0.8,
    backgroundColor: 'white',
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#007AFF',
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
  sidebarContent: {
    flex: 1,
    padding: 10,
  },
  sessionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 5,
  },
  activeSessionItem: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  sessionText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  activeSessionText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#666',
  },
  emptySessions: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
    fontSize: 14,
  },
  mainContent: {
    flex: 1,
  },
  referenceSection: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  referenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  referenceLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  sessionCount: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  referenceText: {
    fontSize: 18,
    color: '#333',
    lineHeight: 26,
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  audioInputOptions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  audioOptionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
  },
  recordOptionButton: {
    backgroundColor: '#FF3B30',
  },
  uploadOptionButton: {
    backgroundColor: '#34C759',
  },
  audioOptionIcon: {
    fontSize: 20,
  },
  audioOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
  },
  processingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    marginTop: 8,
  },
  processingText: {
    color: '#007AFF',
    fontSize: 14,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  welcomeText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  chatContent: {
    padding: 15,
    paddingBottom: 20,
  },
  sessionInfo: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  sessionInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
  },
  sessionInfoText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  botMessageText: {
    color: '#333',
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
    color: 'white',
    fontSize: 16,
  },
  audioMessageText: {
    color: 'white',
    fontSize: 14,
    flex: 1,
  },
  resultMessage: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  phonemeText: {
    fontSize: 14,
    color: '#666',
  },
  feedbackContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  feedbackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  feedbackText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    textAlign: 'right',
  },
  chartContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  simpleChart: {
    flexDirection: 'row',
    height: 160,
    marginVertical: 10,
  },
  chartYAxis: {
    width: 50,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 10,
  },
  chartAxisLabel: {
    fontSize: 12,
    color: '#666',
  },
  chartArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  chartLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    position: 'relative',
    marginBottom: 10,
  },
  chartPoint: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
  },
  chartDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    position: 'absolute',
  },
  chartConnection: {
    width: 2,
    backgroundColor: '#007AFF',
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
  },
  chartXAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartXLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    flex: 1,
  },
  historyContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginVertical: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  historyTable: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 1000,
  },
  tableScrollContainer: {
    maxHeight: 400,
  },
  tableColumn: {
    width: 150,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    justifyContent: 'center',
    minHeight: 80,
  },
  audioButtonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  audioFileName: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  phonemeInfo: {
    fontSize: 12,
    color: '#666',
  },
  mispronunciationContainer: {
    flex: 1,
    maxHeight: 60,
  },
  mispronunciationScroll: {
    maxHeight: 60,
  },
  mispronunciationTag: {
    backgroundColor: '#ffebee',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  mispronunciationText: {
    fontSize: 10,
    color: '#c62828',
    fontWeight: '500',
  },
  perfectText: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  feedbackPreview: {
    fontSize: 10,
    color: '#333',
    lineHeight: 12,
    marginBottom: 4,
  },
  tapToExpand: {
    fontSize: 8,
    color: '#007AFF',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  timestampText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    paddingHorizontal: 5,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  tableCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tableCellText: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
  },
  colIndex: {
    flex: 0.8,
  },
  colAudio: {
    flex: 1.2,
  },
  colScore: {
    flex: 1.5,
  },
  colPhonemes: {
    flex: 2,
  },
  colFeedback: {
    flex: 1,
  },
  tableAudioButton: {
    fontSize: 16,
    backgroundColor: '#007AFF',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textAlign: 'center',
  },
  tableFeedbackButton: {
    fontSize: 16,
    backgroundColor: '#4CAF50',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textAlign: 'center',
  },
  inputSection: {
    backgroundColor: 'white',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  connectionWarning: {
    fontSize: 12,
    color: '#ff6b35',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  actionButton: {
    backgroundColor: '#666',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
    color: 'white',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recordingButton: {
    backgroundColor: '#FF6B6B',
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  recordButtonText: {
    fontSize: 18,
    color: 'white',
  },
  recordingTime: {
    position: 'absolute',
    bottom: -20,
    fontSize: 10,
    color: '#FF3B30',
    fontWeight: 'bold',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    fontSize: 18,
    color: 'white',
    fontWeight: 'bold',
  },
});
