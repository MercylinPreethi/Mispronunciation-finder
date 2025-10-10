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

const audioRecorderPlayer = new AudioRecorderPlayer();
const { width, height } = Dimensions.get('window');

interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
}

interface PhonemeStatusInfo {
  status: string;
  label: string;
  icon: string;
  color: string;
  source: 'initial' | 'practice' | 'none';
  accuracy: number;
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

interface WordPhonemeData {
  word: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  phoneme_errors: PhonemeError[];
  per: number;
  accuracy?: number;
}

interface PhonemeError {
  position: number;
  type: 'substitution' | 'deletion' | 'insertion';
  predicted: string | null;
  expected: string | null;
}

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
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
}

const generateSessionId = (referenceText: string): string => {
  const timestamp = Date.now();
  const textHash = referenceText.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
  return `${textHash}_${timestamp}`;
};

const playBase64Audio = async (base64Audio: string, word: string, setPlayingWord: (word: string | null) => void) => {
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
          const response = await axios.get(`http://192.168.14.34:5050/get_word_audio/${word}`, {
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
      accessibilityLabel={`${word}, ${status} pronunciation. Tap to hear.`}
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

const SimplifiedWordTable = ({ 
  attempt, 
  playingWord, 
  setPlayingWord,
  onWordRecord,
  isRecording,
  recordingWord,
  isProcessing
}: { 
  attempt: PracticeAttempt;
  playingWord: string | null;
  setPlayingWord: (word: string | null) => void;
  onWordRecord: (word: string) => void;
  isRecording: boolean;
  recordingWord: string | null;
  isProcessing: boolean;
}) => {
  const audioData = attempt.scores.audio_data;
  
  const wordPhonemeData =
    attempt.scores?.word_level_analysis?.word_phoneme_mapping ||
    attempt.scores?.word_phonemes?.words ||
    [];
  
  const words = wordPhonemeData.length > 0 
    ? wordPhonemeData.map(w => w.word)
    : (attempt.scores.audio_data ? 
        Object.keys(attempt.scores.audio_data.word_audio || {}).join(' ').toLowerCase().split(/\s+/) 
        : []);
  
  const wordStatusMap: { [key: string]: 'correct' | 'partial' | 'mispronounced' } = {};
  
  attempt.correctlyPronuncedWords.forEach(word => {
    wordStatusMap[word.toLowerCase()] = 'correct';
  });
  
  attempt.mispronuncedWords.forEach(word => {
    wordStatusMap[word.toLowerCase()] = 'mispronounced';
  });
  
  words.forEach(word => {
    if (!wordStatusMap[word]) {
      wordStatusMap[word] = 'partial';
    }
  });

  // Calculate accuracy for each word - prioritize updated data
  const getWordAccuracy = (wordData: any): number => {
    // First check if we have direct accuracy from updates
    if (wordData.accuracy !== undefined) {
      return wordData.accuracy;
    }
    
    // If we have PER data, convert to accuracy
    if (wordData.per !== undefined) {
      return 1 - wordData.per; // PER is error rate, so accuracy = 1 - PER
    }
    
    // Calculate accuracy based on phoneme errors
    if (wordData.phoneme_errors && wordData.reference_phonemes) {
      const totalPhonemes = wordData.reference_phonemes.length;
      const errorCount = wordData.phoneme_errors.length;
      const correctCount = totalPhonemes - errorCount;
      return totalPhonemes > 0 ? correctCount / totalPhonemes : 1;
    }
    
    // Fallback based on status
    switch (wordData.status) {
      case 'correct': return 0.9; // 90% for correct
      case 'partial': return 0.6; // 60% for partial
      case 'mispronounced': return 0.3; // 30% for mispronounced
      default: return 0.5;
    }
  };

  // Get all words that need practice (mispronounced + partial)
  const displayWordData = wordPhonemeData.length > 0
    ? wordPhonemeData.filter(wordData => 
        wordStatusMap[wordData.word] === 'mispronounced' || 
        wordStatusMap[wordData.word] === 'partial'
      )
    : words.map(word => ({
        word,
        reference_phonemes: [],
        predicted_phonemes: [],
        status: wordStatusMap[word] || 'partial',
      })).filter(wordData => 
        wordData.status === 'mispronounced' || 
        wordData.status === 'partial'
      );

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
    if (accuracy >= 0.8) return '#10B981'; // Good
    if (accuracy >= 0.6) return '#F59E0B'; // Fair
    return '#EF4444'; // Poor
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(0)}%`;
  };

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
          const response = await axios.get(`http://192.168.14.34:5050/get_word_audio/${word}`, {
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
      {/* Word Status Overview - Full Width */}
      <View style={styles.wordBoxesContainer}>
        <Text style={styles.wordBoxesTitle}>Word Pronunciation Status:</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.wordBoxesScrollContent}
        >
          <View style={styles.wordBoxes}>
            {words.map((word, index) => {
              const wordData = wordPhonemeData.find(w => w.word === word) || { word, status: wordStatusMap[word] };
              const accuracy = getWordAccuracy(wordData);
              return (
                <View 
                  key={index} 
                  style={[
                    styles.wordBox,
                    { 
                      backgroundColor: getStatusBackground(wordStatusMap[word]),
                      borderColor: getStatusColor(wordStatusMap[word])
                    }
                  ]}
                >
                  <Text style={[
                    styles.wordBoxText,
                    { color: getStatusColor(wordStatusMap[word]) }
                  ]}>
                    {word}
                  </Text>
                  <Text style={[
                    styles.wordBoxAccuracy,
                    { color: getAccuracyColor(accuracy) }
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
            <View style={[styles.legendColorBox, { backgroundColor: '#D1FAE5', borderColor: '#10B981' }]} />
            <Text style={styles.legendText}>Correct</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColorBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>Partial</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColorBox, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]} />
            <Text style={styles.legendText}>Mispronounced</Text>
          </View>
        </View>
      </View>

      {/* Words Needing Practice Table - Full Screen Width */}
      <View style={styles.tableSection}>
        <Text style={styles.tableSectionTitle}>
          Words Needing Practice
        </Text>
        
        {displayWordData.length > 0 ? (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderText}>Word</Text>
              <Text style={styles.tableHeaderText}>Accuracy</Text>
              <Text style={styles.tableHeaderText}>Speaker</Text>
              <Text style={styles.tableHeaderText}>Record</Text>
              <Text style={styles.tableHeaderText}>Status</Text>
            </View>

            {/* Table Rows */}
            <View style={styles.tableRowsContainer}>
              {displayWordData.map((wordData, index) => {
                const wordAudioData = audioData?.word_audio?.[wordData.word];
                const isRecordingThisWord = isRecording && recordingWord === wordData.word;
                const accuracy = getWordAccuracy(wordData);
                const accuracyPercent = formatAccuracy(accuracy);
                const statusColor = getStatusColor(wordData.status);
                
                return (
                  <View key={index} style={styles.tableRow}>
                    {/* Word Column */}
                    <View style={styles.tableCell}>
                      <Text style={[styles.wordText, { color: statusColor }]}>
                        {wordData.word}
                      </Text>
                    </View>
                    
                    {/* Accuracy Column */}
                    <View style={styles.tableCell}>
                      <View style={[
                        styles.accuracyBadge,
                        { backgroundColor: getAccuracyColor(accuracy) + '20' } // Add transparency
                      ]}>
                        <Text style={[
                          styles.accuracyText,
                          { color: getAccuracyColor(accuracy) }
                        ]}>
                          {accuracyPercent}
                        </Text>
                      </View>
                    </View>
                    
                    {/* Speaker Column */}
                    <View style={styles.tableCell}>
                      <TouchableOpacity
                        style={styles.iconButton}
                        onPress={() => handleWordAudioPlay(wordData.word, wordAudioData)}
                        accessibilityLabel={`Play pronunciation for ${wordData.word}`}
                        disabled={isRecording || isProcessing}
                      >
                        <Text style={styles.iconText}>
                          {playingWord === wordData.word ? '⏸️' : '🔊'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Record Column */}
                    <View style={styles.tableCell}>
                      <TouchableOpacity
                        style={[
                          styles.iconButton,
                          isRecordingThisWord && styles.recordingButton
                        ]}
                        onPress={() => onWordRecord(wordData.word)}
                        disabled={isProcessing || (isRecording && !isRecordingThisWord)}
                        accessibilityLabel={`Record pronunciation for ${wordData.word}`}
                      >
                        <Text style={styles.iconText}>
                          {isRecordingThisWord ? '⏹️' : '🎤'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    
                    {/* Status Column */}
                    <View style={styles.tableCell}>
                      <View style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusBackground(wordData.status) }
                      ]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {wordData.status === 'mispronounced' ? 'Needs Practice' : 
                           wordData.status === 'partial' ? 'Needs Work' :
                           wordData.status.charAt(0).toUpperCase() + wordData.status.slice(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.allCorrectContainer}>
            <Text style={styles.allCorrectIcon}>🎉</Text>
            <Text style={styles.allCorrectTitle}>Excellent Pronunciation!</Text>
            <Text style={styles.allCorrectText}>
              All words were pronounced correctly. Keep up the great work!
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const LatestAttemptDisplay = ({ 
  attempt, 
  playingWord, 
  setPlayingWord,
  onWordRecord,
  isRecording,
  recordingWord,
  isProcessing
}: { 
  attempt: PracticeAttempt;
  playingWord: string | null;
  setPlayingWord: (word: string | null) => void;
  onWordRecord: (word: string) => void;
  isRecording: boolean;
  recordingWord: string | null;
  isProcessing: boolean;
}) => {
  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.8) return '#F59E0B';
    return '#EF4444';
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  return (
    <View style={styles.latestAttemptContainer}>
      {/* Accuracy Score Section - Moved to top */}
      <View style={styles.accuracyScoreSection}>
        <Text style={styles.accuracyScoreTitle}>Overall Pronunciation Score</Text>
        <View style={styles.scoreDisplay}>
          <Text style={[
            styles.scoreDisplayText,
            { color: getAccuracyColor(attempt.scores.accuracy) }
          ]}>
            {formatAccuracy(attempt.scores.accuracy)}
          </Text>
        </View>
        <Text style={styles.accuracySubtitle}>
          {attempt.scores.correct_phonemes}/{attempt.scores.total_phonemes} phonemes correct
        </Text>
      </View>

      {/* Word Practice Section */}
      <SimplifiedWordTable 
        attempt={attempt}
        playingWord={playingWord}
        setPlayingWord={setPlayingWord}
        onWordRecord={onWordRecord}
        isRecording={isRecording}
        recordingWord={recordingWord}
        isProcessing={isProcessing}
      />

      {/* Timestamp and Feedback */}
      <View style={styles.latestAttemptInfo}>
        <Text style={styles.latestAttemptMeta}>
          {attempt.timestamp.toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>

      {attempt.feedback && (
        <View style={styles.feedbackSection}>
          <Text style={styles.feedbackTitle}>Feedback:</Text>
          <Text style={styles.feedbackText}>{attempt.feedback}</Text>
        </View>
      )}
    </View>
  );
};

const EnhancedPronunciationAnalysis = ({ 
  attempt, 
  showWordLimit = true,
  playingWord,
  setPlayingWord,
  referenceText
}: { 
  attempt: PracticeAttempt; 
  showWordLimit?: boolean;
  playingWord: string | null;
  setPlayingWord: (word: string | null) => void;
  referenceText: string;
}) => {
  const audioData = attempt.scores.audio_data;
  const words = referenceText.toLowerCase().split(/\s+/);
  
  const wordStatusMap: { [key: string]: 'correct' | 'partial' | 'mispronounced' } = {};
  
  attempt.correctlyPronuncedWords.forEach(word => {
    wordStatusMap[word.toLowerCase()] = 'correct';
  });
  
  attempt.mispronuncedWords.forEach(word => {
    wordStatusMap[word.toLowerCase()] = 'mispronounced';
  });
  
  words.forEach((word: string) => {
    if (!wordStatusMap[word]) {
      wordStatusMap[word] = 'partial';
    }
  });

  const displayWords = showWordLimit ? words.slice(0, 8) : words;
  const hasMoreWords = words.length > 8;

  return (
    <View style={styles.pronunciationAnalysis}>
      <Text style={styles.pronunciationSectionTitle}>
        Tap words to hear pronunciation
      </Text>
      <View style={styles.wordsContainer}>
        {displayWords.map((word: string, wordIndex: number) => {
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
  const [playingWord, setPlayingWord] = useState<string | null>(null);
  const [recordingWord, setRecordingWord] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const sidebarAnim = useRef(new Animated.Value(-width * 0.8)).current;
  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const chatScrollRef = useRef<FlatList<ChatMessage> | null>(null);
  const API_BASE_URL = 'http://192.168.14.34:5050';
  const [userId, setUserId] = useState<string>('');
  const insets = useSafeAreaInsets();

  // Refs for recording
  const recordingWordRef = useRef<string | null>(null);
  const recordingPathRef = useRef<string | null>(null);

  // Add state to track word-specific updates with accuracy
  const [wordUpdates, setWordUpdates] = useState<{[key: string]: {status: 'correct' | 'mispronounced', accuracy: number}}>({});

  useEffect(() => {
    setIsAuthenticating(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
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

  // Debug effect to track word updates
  useEffect(() => {
    console.log('wordUpdates changed:', wordUpdates);
    if (currentSessionId) {
      const session = getCurrentSession();
      if (session && session.attempts.length > 0) {
        const latestAttempt = session.attempts[0];
        console.log('Latest attempt word data:', latestAttempt.scores.word_level_analysis?.word_phoneme_mapping);
      }
    }
  }, [wordUpdates, currentSessionId]);

  const loadUserSessions = async (userIdParam: string) => {
    try {
      const referencesRef = ref(database, `users/${userIdParam}/references`);
      const snapshot = await get(referencesRef);
      
      if (snapshot.exists()) {
        const data = snapshot.val() as { [key: string]: FirebaseReferenceText };
        const loadedSessions: SentenceSession[] = Object.keys(data).map(key => {
          const refData = data[key];
          
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
          
          return {
            id: key,
            referenceText: refData.text,
            createdAt: new Date(refData.createdAt),
            attempts,
            messages
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setSessions(loadedSessions);
        console.log(`✅ Loaded ${loadedSessions.length} sessions for user ${userIdParam}`);
      } else {
        console.log('No sessions found for user');
        setSessions([]);
      }
    } catch (error) {
      console.error('Error loading user sessions from Firebase:', error);
      Alert.alert('Load Error', 'Failed to load your practice sessions. Please try again.');
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

  // Word recording functions
  const startWordRecording = async (word: string) => {
    try {
      const currentSession = getCurrentSession();
      if (!currentSession) {
        Alert.alert('Error', 'No active practice session');
        return;
      }

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
      
      // Verify recording file
      const exists = await RNFS.exists(recordingPath);
      if (!exists) {
        throw new Error('Recording file was not created');
      }
      
      const stats = await RNFS.stat(recordingPath);
      if (stats.size === 0) {
        throw new Error('Recording file is empty');
      }
      
      console.log(`Word recording verified for "${word}": ${(stats.size / 1024).toFixed(1)} KB`);
      
      // Process the word recording
      await processWordAudio(recordingPath, word);
      
      // Clear recording references
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

  const handleWordRecord = (word: string) => {
    if (isRecording && recordingWord === word) {
      stopWordRecording();
    } else if (!isRecording) {
      startWordRecording(word);
    } else {
      Alert.alert(
        'Recording in Progress',
        `Please finish recording for "${recordingWord}" first.`,
        [{ text: 'OK' }]
      );
    }
  };

  const processWordAudio = async (audioPath: string, word: string) => {
    const currentSession = getCurrentSession();
    if (!currentSession) return;
    
    setIsProcessing(true);
    
    try {
      let finalAudioPath = audioPath;
      let audioUrl = audioPath;
      let uploadSuccess = false;
      
      // Upload to Cloudinary
      try {
        const attemptId = `word_${word}_${Date.now()}`;
        audioUrl = await uploadToCloudinary(audioPath, attemptId);
        uploadSuccess = true;
        console.log(`Word "${word}" audio uploaded successfully`);
      } catch (cloudinaryError) {
        console.warn('Cloudinary upload failed for word recording:', cloudinaryError);
        // Continue with local file
        const permanentPath = `${RNFS.DocumentDirectoryPath}/word_recordings/recording_${word}_${Date.now()}.wav`;
        await RNFS.mkdir(`${RNFS.DocumentDirectoryPath}/word_recordings`);
        await RNFS.copyFile(audioPath, permanentPath);
        finalAudioPath = permanentPath;
        audioUrl = permanentPath;
      }
      
      // Prepare form data for word analysis
      const formData = new FormData();
      let mimeType = 'audio/wav';
      
      formData.append('audio_file', {
        uri: Platform.OS === 'ios' ? finalAudioPath : `file://${finalAudioPath}`,
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
        
        // Store both status and accuracy for the word
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
        
        // Force refresh of the component
        setRefreshKey(prev => prev + 1);
        
        // Show success message
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

  // Modified getCurrentSession to include word updates with accuracy
  const getCurrentSession = (): SentenceSession | null => {
    const session = sessions.find(session => session.id === currentSessionId);
    if (!session) return null;

    if (Object.keys(wordUpdates).length === 0) {
      return session;
    }

    // Create a modified session with updated word statuses and accuracy
    const latestAttempt = session.attempts[0];
    if (!latestAttempt) return session;

    // Create a deep copy of the scores to modify
    const modifiedScores = JSON.parse(JSON.stringify(latestAttempt.scores));

    // Update word_level_analysis if it exists
    if (modifiedScores.word_level_analysis?.word_phoneme_mapping) {
      modifiedScores.word_level_analysis.word_phoneme_mapping = modifiedScores.word_level_analysis.word_phoneme_mapping.map((wordData: any) => {
        const update = wordUpdates[wordData.word];
        if (update) {
          return {
            ...wordData,
            status: update.status,
            per: 1 - update.accuracy, // Convert accuracy to PER (Phone Error Rate)
            // Add accuracy field for easy access
            accuracy: update.accuracy
          };
        }
        return wordData;
      });
    }

    // Update word_phonemes if it exists
    if (modifiedScores.word_phonemes?.words) {
      modifiedScores.word_phonemes.words = modifiedScores.word_phonemes.words.map((wordData: any) => {
        const update = wordUpdates[wordData.word];
        if (update) {
          return {
            ...wordData,
            status: update.status,
            per: 1 - update.accuracy,
            accuracy: update.accuracy
          };
        }
        return wordData;
      });
    }

    const modifiedAttempt: PracticeAttempt = {
      ...latestAttempt,
      id: `modified_${latestAttempt.id}`,
      timestamp: new Date(),
      mispronuncedWords: [...latestAttempt.mispronuncedWords],
      correctlyPronuncedWords: [...latestAttempt.correctlyPronuncedWords],
      scores: modifiedScores
    };

    // Apply word updates to the word arrays
    Object.entries(wordUpdates).forEach(([word, update]) => {
      const wordLower = word.toLowerCase();
      
      // Remove from both arrays first
      modifiedAttempt.mispronuncedWords = modifiedAttempt.mispronuncedWords.filter(w => w.toLowerCase() !== wordLower);
      modifiedAttempt.correctlyPronuncedWords = modifiedAttempt.correctlyPronuncedWords.filter(w => w.toLowerCase() !== wordLower);
      
      // Add to appropriate array
      if (update.status === 'correct') {
        modifiedAttempt.correctlyPronuncedWords.push(word);
      } else {
        modifiedAttempt.mispronuncedWords.push(word);
      }
    });

    return {
      ...session,
      attempts: [modifiedAttempt, ...session.attempts.slice(1)]
    };
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

      let audioUrl = audioPath;
      let uploadSuccess = false;
      
      try {
        console.log(`Uploading ${source} audio to Cloudinary...`);
        const attemptId = Date.now().toString();
        audioUrl = await uploadToCloudinary(audioPath, attemptId);
        uploadSuccess = true;
        console.log('Cloudinary upload successful:', audioUrl);
        
        addMessage({
          type: 'text',
          content: '✅ Audio uploaded successfully. Processing pronunciation...',
          isUser: false
        });
        
      } catch (cloudinaryError) {
        console.warn('Cloudinary upload failed:', cloudinaryError);
        console.log('Continuing with local file path...');
        
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
          }
        }
        
        addMessage({
          type: 'text',
          content: '⚠️ Cloud upload failed, using local storage. Analyzing pronunciation...',
          isUser: false
        });
      }
      
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
      formData.append('use_llm_judge', 'true');
      formData.append('generate_audio', 'true');
      formData.append('filter_extraneous', 'true');
      
      console.log('Sending audio to pronunciation analysis API...');
      const response = await axios.post(`${API_BASE_URL}/analyze_with_llm_judge`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      
      if (response.data.success) {
        console.log('Analysis successful! Processing results...');
        const analysisResult = response.data.analysis;
        const wordLevelAnalysis = response.data.word_level_analysis;
        
        let mispronuncedWords: string[] = [];
        let correctlyPronuncedWords: string[] = [];
        let partialWords: string[] = [];
        
        if (wordLevelAnalysis && wordLevelAnalysis.words) {
          wordLevelAnalysis.words.forEach((wordData: any) => {
            const word = wordData.word;
            const status = wordData.status;
            
            console.log(`Word: ${word}, Status: ${status}`);
            
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
        };
        
        console.log('Saving attempt to Firebase...');
        await saveAttemptToFirebase(currentSession.id, newAttempt);
        
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
      
      const messageData: FirebaseMessage = {
        type: message.type,
        content: message.content,
        audioPath: message.audioPath,
        fileName: message.fileName,
        timestamp: message.timestamp.toISOString(),
        isUser: message.isUser,
        result: message.result ? {
          timestamp: message.result.timestamp instanceof Date 
            ? message.result.timestamp.toISOString() 
            : (typeof message.result.timestamp === 'string' 
                ? message.result.timestamp 
                : new Date().toISOString()),
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
    
    const existingSession = sessions.find(
      session => session.referenceText.toLowerCase() === text.toLowerCase()
    );
    
    if (existingSession) {
      Haptics.selectionAsync();
      setCurrentSessionId(existingSession.id);
      
      setTimeout(() => {
        Alert.alert(
          'Existing Session Found',
          `Switched to your existing practice session for:\n\n"${existingSession.referenceText}"\n\nYou have ${existingSession.attempts.length} previous attempt${existingSession.attempts.length === 1 ? '' : 's'}.`,
          [{ text: 'Continue Practicing' }]
        );
      }, 300);
      return;
    }
    
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
      
      addMessage({
        type: 'audio',
        content: 'Voice recording',
        audioPath: result,
        isUser: true
      });
      
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
      
      let playbackPath = audioPath;
      const isUrl = audioPath.startsWith('http://') || audioPath.startsWith('https://');
      const isLocalPath = audioPath.startsWith('file://') || audioPath.startsWith('/');
      
      if (!isUrl && !isLocalPath) {
        playbackPath = Platform.OS === 'ios' ? audioPath : `file://${audioPath}`;
      }
      
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
    toggleSidebar();
    // Clear word updates when switching sessions
    setWordUpdates({});
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

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.8) return '#F59E0B';
    return '#EF4444';
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
            
            <EnhancedPronunciationAnalysis 
              attempt={message.result}
              playingWord={playingWord}
              setPlayingWord={setPlayingWord}
              referenceText={currentSession?.referenceText || ''}
            />
          </View>
        )}
      <Text style={styles.messageTime}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
};

  const currentSession = getCurrentSession();

  if (isAuthenticating) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#475569" />
          <Text style={styles.loadingText}>Authenticating...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return null;
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
                setWordUpdates({}); // Clear word updates when starting new session
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
              onPress={() => {
                selectSession(session);
                setWordUpdates({}); // Clear word updates when switching sessions
              }}
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
              style={styles.chatList}
              ListFooterComponent={() => (
                <>
                  {currentSession.attempts.length > 0 && (
                    <LatestAttemptDisplay 
                      key={refreshKey} // Force re-render when refreshKey changes
                      attempt={currentSession.attempts[0]}
                      playingWord={playingWord}
                      setPlayingWord={setPlayingWord}
                      onWordRecord={handleWordRecord}
                      isRecording={isRecording}
                      recordingWord={recordingWord}
                      isProcessing={isProcessing}
                    />
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
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F0F4F8',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '600',
  },
  connectionIndicator: {
    fontSize: 14,
    marginLeft: 12,
    color: '#10B981',
  },
  disabledButton: {
    opacity: 0.6,
  },
  simplifiedTableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    marginVertical: 20,
    marginHorizontal: 0,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 8,
    overflow: 'hidden',
    width: '100%',
  },
  wordBoxesContainer: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
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
    borderRadius: 8,
    borderWidth: 1.5,
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
    padding: 12,
    flex: 1,
  },
  tableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 12,
    textAlign: 'center',
  },
  tableContainer: {
    flex: 1,
    width: '100%',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomWidth: 3,
    borderBottomColor: '#C7D2FE',
  },
  tableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    color: '#6366F1',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRowsContainer: {
    maxHeight: height * 0.4,
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
    borderRadius: 8,
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
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 0,
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
    marginVertical: 10,
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
  latestAttemptContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    width: '100%',
  },
  accuracyScoreSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#F1F5F9',
  },
  accuracyScoreTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scoreDisplay: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 20,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
    minWidth: 140,
  },
  scoreDisplayText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -1,
  },
  accuracySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  latestAttemptInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  latestAttemptMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  feedbackSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
  },
  feedbackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  feedbackText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
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
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 28,
    paddingTop: 32,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  firebaseWarning: {
    fontSize: 14,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
    fontWeight: '500',
    lineHeight: 20,
  },
  sidebarToggle: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(71, 85, 105, 0.1)',
    marginRight: 12,
  },
  sidebarIcon: {
    fontSize: 24,
    color: '#475569',
    fontWeight: 'bold',
  },
  headerTitle: {
    flex: 1,
    fontSize: width < 360 ? 22 : 26,
    fontWeight: '900',
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    color: '#1E293B',
    marginRight: 12,
    letterSpacing: -1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  newSessionButton: {
    backgroundColor: '#475569',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#475569',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  newSessionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  sidebarTitleContainer: {
    flex: 1,
  },
  sidebarTitle: {
    fontSize: width < 360 ? 22 : 24,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 6,
    letterSpacing: -0.8,
  },
  sidebarSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(71, 85, 105, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: '#475569',
  },
  sessionText: {
    fontSize: width < 360 ? 15 : 16,
    color: '#1E293B',
    marginBottom: 8,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activeSessionText: {
    color: '#475569',
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
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
    color: '#64748B',
    opacity: 0.6,
  },
  emptySessions: {
    textAlign: 'center',
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySessionsSubtext: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  mainContent: {
    flex: 1,
    paddingBottom: 80,
  },
  referenceSection: {
    backgroundColor: '#FFFFFF',
    padding: 28,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 24,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#E0E7FF',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  referenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referenceLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#6366F1',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sessionCount: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  chatList: {
    flex: 1,
    width: '100%',
  },
  chatContent: {
    padding: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  referenceText: {
    fontSize: width < 360 ? 18 : 20,
    color: '#1E293B',
    lineHeight: 34,
    marginBottom: 24,
    padding: 24,
    backgroundColor: '#EEF2FF',
    borderRadius: 24,
    borderLeftWidth: 6,
    borderLeftColor: '#6366F1',
    fontWeight: '700',
    letterSpacing: -0.3,
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
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    minWidth: 145,
  },
  recordOptionButton: {
    backgroundColor: '#6366F1',
  },
  uploadOptionButton: {
    backgroundColor: '#8B5CF6',
  },
  audioOptionIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 8,
  },
  audioOptionText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  processingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 10,
    backgroundColor: 'rgba(71, 85, 105, 0.1)',
    borderRadius: 10,
  },
  processingText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '500',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
    backgroundColor: '#F0F4F9',
  },
  welcomeTitle: {
    fontSize: width < 360 ? 26 : 30,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: -1,
  },
  welcomeText: {
    fontSize: 17,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '600',
  },
  pronunciationWordButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginRight: 12,
    marginBottom: 12,
    borderWidth: 2,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  pronunciationWordText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sentenceAudioButton: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  sentenceAudioText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  messageContainer: {
    marginVertical: 8,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6366F1',
    borderRadius: 28,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    padding: 20,
    paddingHorizontal: 24,
    maxWidth: '78%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 8,
  },
  botMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 16,
    maxWidth: '75%',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  botMessageText: {
    color: '#1E293B',
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
  },
  resultMessage: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
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
    fontWeight: '700',
  },
  phonemeText: {
    fontSize: 14,
    color: '#64748B',
  },
  feedbackContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 12,
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'right',
  },
  pronunciationAnalysis: {
    flex: 1,
  },
  pronunciationSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  wordsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  moreWordsText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  inputSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: '#1E293B',
    maxHeight: 120,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  connectionWarning: {
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    marginTop: 8,
  },
  signOutButton: {
    backgroundColor: '#DC2626',
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
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  userInfoText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
});