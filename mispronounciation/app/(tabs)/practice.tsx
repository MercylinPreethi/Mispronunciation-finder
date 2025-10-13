// app/(tabs)/practice.tsx
import React, { useState, useEffect, useRef } from 'react';
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
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import RNFS from 'react-native-fs';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ref, onValue, off } from 'firebase/database';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, database } from '@/lib/firebase';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const audioRecorderPlayer = new AudioRecorderPlayer();
const { width, height } = Dimensions.get('window');

// Types from your original file
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

interface SentenceSession {
  id: string;
  referenceText: string;
  createdAt: Date;
  attempts: PracticeAttempt[];
  messages: any[];
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

interface FirebaseReferenceText {
  text: string;
  createdAt: string;
  attempts: { [key: string]: FirebaseAttempt };
  messages: { [key: string]: any };
}

export default function PracticeScreen() {
  const [sessions, setSessions] = useState<SentenceSession[]>([]);
  const [filteredSessions, setFilteredSessions] = useState<SentenceSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [selectedSession, setSelectedSession] = useState<SentenceSession | null>(null);
  const [userId, setUserId] = useState<string>('');
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    setIsAuthenticating(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !user.isAnonymous) {
        console.log('User authenticated:', user.uid);
        setCurrentUser(user);
        setUserId(user.uid);
        loadUserSessions(user.uid);
        setupSessionsListener(user.uid);
        setIsAuthenticating(false);
      } else {
        console.log('No authenticated user');
        setCurrentUser(null);
        setUserId('');
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

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = sessions.filter(session =>
        session.referenceText.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSessions(filtered);
    } else {
      setFilteredSessions(sessions);
    }
  }, [searchQuery, sessions]);

  const loadUserSessions = async (userIdParam: string) => {
    try {
      const referencesRef = ref(database, `users/${userIdParam}/references`);
      const snapshot = await new Promise<any>((resolve) => {
        onValue(referencesRef, resolve, { onlyOnce: true });
      });
      
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
          
          return {
            id: key,
            referenceText: refData.text,
            createdAt: new Date(refData.createdAt),
            attempts,
            messages: []
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        setSessions(loadedSessions);
        setFilteredSessions(loadedSessions);
        console.log(`✅ Loaded ${loadedSessions.length} sessions`);
      } else {
        setSessions([]);
        setFilteredSessions([]);
      }
    } catch (error) {
      console.error('Error loading user sessions:', error);
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
            messages: []
          };
        }).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setSessions(loadedSessions);
      } else {
        setSessions([]);
      }
    });
  };

  const handleNewSession = () => {
    Alert.prompt(
      'New Practice Session',
      'Enter the sentence you want to practice:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: (text) => {
            if (text && text.trim()) {
              // Navigate to recording interface with new session
              router.push({
                pathname: '/(tabs)/explore',
                params: { referenceText: text.trim(), isNew: 'true' }
              });
            }
          }
        }
      ],
      'plain-text'
    );
  };

  const handleSessionPress = (session: SentenceSession) => {
    Haptics.selectionAsync();
    // Navigate to recording interface with existing session
    router.push({
      pathname: '/(tabs)/explore',
      params: { sessionId: session.id, referenceText: session.referenceText }
    });
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return '#10B981';
    if (accuracy >= 0.7) return '#F59E0B';
    return '#EF4444';
  };

  const renderSessionCard = ({ item: session }: { item: SentenceSession }) => {
    const latestAttempt = session.attempts[0];
    const accuracy = latestAttempt ? latestAttempt.scores.accuracy : 0;
    const accuracyPercent = (accuracy * 100).toFixed(0);

    return (
      <TouchableOpacity
        style={styles.sessionCard}
        onPress={() => handleSessionPress(session)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.05)', 'rgba(139, 92, 246, 0.05)']}
          style={styles.sessionGradient}
        >
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitleContainer}>
              <Text style={styles.sessionTitle} numberOfLines={2}>
                {session.referenceText}
              </Text>
              <Text style={styles.sessionDate}>
                {session.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#9CA3AF" />
          </View>

          <View style={styles.sessionStats}>
            <View style={styles.statItem}>
              <Icon name="history" size={18} color="#6B7280" />
              <Text style={styles.statText}>{session.attempts.length} attempts</Text>
            </View>
            
            {latestAttempt && (
              <View style={styles.statItem}>
                <View style={[
                  styles.accuracyDot,
                  { backgroundColor: getAccuracyColor(accuracy) }
                ]} />
                <Text style={styles.statText}>Latest: {accuracyPercent}%</Text>
              </View>
            )}
          </View>

          {latestAttempt && latestAttempt.mispronuncedWords.length > 0 && (
            <View style={styles.wordsPreview}>
              <Text style={styles.wordsPreviewLabel}>Needs practice:</Text>
              <View style={styles.wordsChips}>
                {latestAttempt.mispronuncedWords.slice(0, 3).map((word, index) => (
                  <View key={index} style={styles.wordChip}>
                    <Text style={styles.wordChipText}>{word}</Text>
                  </View>
                ))}
                {latestAttempt.mispronuncedWords.length > 3 && (
                  <Text style={styles.moreWords}>+{latestAttempt.mispronuncedWords.length - 3}</Text>
                )}
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (isAuthenticating) {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Practice Sessions</Text>
          <Text style={styles.headerSubtitle}>{filteredSessions.length} total sessions</Text>
        </LinearGradient>
      </View>

      {/* Search Bar and New Button */}
      <Animated.View style={[styles.searchContainer, { opacity: fadeAnim }]}>
        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search sessions..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.newButton}
          onPress={handleNewSession}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.newButtonGradient}
          >
            <Icon name="add" size={24} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Sessions List */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {filteredSessions.length > 0 ? (
          <FlatList
            data={filteredSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderSessionCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Icon name="mic-off" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No sessions found' : 'No practice sessions yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try a different search term' 
                : 'Create your first session to start practicing'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleNewSession}>
                <Text style={styles.emptyButtonText}>Create New Session</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  header: {
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  headerGradient: {
    borderRadius: 20,
    padding: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  newButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  newButtonGradient: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sessionCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sessionGradient: {
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sessionTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    lineHeight: 24,
  },
  sessionDate: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  accuracyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  wordsPreview: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  wordsPreviewLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wordsChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  wordChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  wordChipText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
  },
  moreWords: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '700',
    fontStyle: 'italic',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});