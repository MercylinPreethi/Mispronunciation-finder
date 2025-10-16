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
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  PanResponder,
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
import { BlurView } from 'expo-blur';
import LearningPathBackground from '../../components/LearningPathBackground';

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
  const [newSessionModalVisible, setNewSessionModalVisible] = useState(false);
  const [newSessionText, setNewSessionText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'recent' | 'high-accuracy' | 'needs-practice'>('all');
  
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const modalAnim = useRef(new Animated.Value(1)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const cardAnimations = useRef(new Map()).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const filterAnim = useRef(new Animated.Value(0)).current;
  const refreshAnim = useRef(new Animated.Value(0)).current;
  const floatingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Staggered entrance animations
    Animated.sequence([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(searchAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Floating animation for background elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (showStats) {
      Animated.spring(statsAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(statsAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [showStats]);

  // Debug modal state
  useEffect(() => {
    console.log('Modal state changed:', newSessionModalVisible);
  }, [newSessionModalVisible]);

  useEffect(() => {
    Animated.spring(filterAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  // Animate cards when filteredSessions change
  useEffect(() => {
    filteredSessions.forEach((session, index) => {
      let animation = cardAnimations.get(session.id);
      if (!animation) {
        animation = {
          scale: new Animated.Value(0.95),
          opacity: new Animated.Value(0),
          translateY: new Animated.Value(20),
        };
        cardAnimations.set(session.id, animation);
      }
      
      Animated.sequence([
        Animated.delay(index * 100),
        Animated.parallel([
          Animated.spring(animation.scale, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(animation.opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(animation.translateY, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      ]).start();
    });
  }, [filteredSessions]);

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
    let filtered = sessions;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(session =>
        session.referenceText.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    switch (selectedFilter) {
      case 'recent':
        filtered = filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 10);
        break;
      case 'high-accuracy':
        filtered = filtered.filter(session => {
          const latestAttempt = session.attempts[0];
          return latestAttempt && latestAttempt.scores.accuracy >= 0.8;
        });
        break;
      case 'needs-practice':
        filtered = filtered.filter(session => {
          const latestAttempt = session.attempts[0];
          return latestAttempt && latestAttempt.mispronuncedWords.length > 0;
        });
        break;
    }

    setFilteredSessions(filtered);
  }, [searchQuery, sessions, selectedFilter]);

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

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate refresh button
    Animated.sequence([
      Animated.timing(refreshAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(refreshAnim, {
        toValue: 0,
        duration: 0,
        useNativeDriver: true,
      }),
    ]).start();

    // Refresh data
    if (currentUser) {
      await loadUserSessions(currentUser.uid);
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, 1000);
  };

  const handleNewSession = () => {
    console.log('handleNewSession called'); // Debug log
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNewSessionText('');
    setNewSessionModalVisible(true);
    console.log('Modal should be visible now'); // Debug log
    // Modal should be visible immediately
    modalAnim.setValue(1);
  };

  const handleCreateSession = () => {
    if (newSessionText && newSessionText.trim()) {
      // Close modal with animation
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setNewSessionModalVisible(false);
        // Reset for next time
        modalAnim.setValue(1);
        // Navigate to recording interface with new session
        router.push({
          pathname: '/(tabs)/explore',
          params: { referenceText: newSessionText.trim(), isNew: 'true' }
        });
      });
    } else {
      Alert.alert('Input Required', 'Please enter a sentence to practice.');
    }
  };

  const handleCancelModal = () => {
    Animated.timing(modalAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setNewSessionModalVisible(false);
      setNewSessionText('');
      // Reset for next time
      modalAnim.setValue(1);
    });
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

  // Card animation helper function - no longer needed as a hook

  const renderSessionCard = ({ item: session, index }: { item: SentenceSession; index: number }) => {
    const latestAttempt = session.attempts[0];
    const accuracy = latestAttempt ? latestAttempt.scores.accuracy : 0;
    const accuracyPercent = (accuracy * 100).toFixed(0);
    
    // Get animation values directly from the Map
    let animation = cardAnimations.get(session.id);
    if (!animation) {
      animation = {
        scale: new Animated.Value(0.95),
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
      };
      cardAnimations.set(session.id, animation);
    }

    // Animate card entrance with stagger - moved outside of render function
    // This will be handled by the parent component

    const handlePressIn = () => {
      Animated.spring(animation.scale, {
        toValue: 0.98,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(animation.scale, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.sessionCardContainer,
          {
            opacity: animation.opacity,
            transform: [
              { scale: animation.scale },
              { translateY: animation.translateY }
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.sessionCard}
          onPress={() => handleSessionPress(session)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <LinearGradient
            colors={['rgba(99, 102, 241, 0.08)', 'rgba(139, 92, 246, 0.08)']}
            style={styles.sessionGradient}
          >
            {/* Progress Ring */}
            <View style={styles.progressRingContainer}>
              <View style={styles.progressRing}>
                <View style={[
                  styles.progressFill,
                  { 
                    transform: [{ rotate: `${(accuracy * 360) - 90}deg` }],
                    backgroundColor: getAccuracyColor(accuracy)
                  }
                ]} />
                <View style={styles.progressInner}>
                  <Text style={styles.progressText}>{accuracyPercent}%</Text>
                </View>
              </View>
            </View>

            <View style={styles.sessionContent}>
              <View style={styles.sessionHeader}>
                <View style={styles.sessionTitleContainer}>
                  <Text style={styles.sessionTitle} numberOfLines={2}>
                    {session.referenceText}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {session.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
                <View style={styles.sessionActions}>
                  <Icon name="chevron-right" size={24} color="#9CA3AF" />
                </View>
              </View>

              <View style={styles.sessionStats}>
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Icon name="history" size={16} color="#6366F1" />
                  </View>
                  <Text style={styles.statText}>{session.attempts.length} attempts</Text>
                </View>
                
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Icon name="trending-up" size={16} color="#10B981" />
                  </View>
                  <Text style={styles.statText}>Latest: {accuracyPercent}%</Text>
                </View>
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
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
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

  const modalScale = modalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  return (
    <View style={styles.container}>
      <LearningPathBackground />
      <StatusBar barStyle="dark-content" />
      
      {/* Enhanced Header */}
      <Animated.View 
        style={[
          styles.header, 
          { 
            paddingTop: insets.top + 16,
            opacity: headerAnim,
            transform: [{
              translateY: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-50, 0],
              }),
            }],
          }
        ]}
      >
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Practice Sessions</Text>
              <Text style={styles.headerSubtitle}>{filteredSessions.length} total sessions</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.statsButton}
                onPress={() => setShowStats(!showStats)}
                activeOpacity={0.8}
              >
                <Icon name="analytics" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.refreshButton}
                onPress={handleRefresh}
                activeOpacity={0.8}
              >
                <Animated.View style={{
                  transform: [{
                    rotate: refreshAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  }],
                }}>
                  <Icon name="refresh" size={24} color="#FFFFFF" />
                </Animated.View>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* Quick Stats Bar - Only show when stats are visible */}
      {showStats && (
        <Animated.View 
          style={[
            styles.statsBar,
            {
              opacity: statsAnim,
              transform: [{
                translateY: statsAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0],
                }),
              }],
            }
          ]}
        >
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Icon name="check-circle" size={20} color="#10B981" />
              <Text style={styles.statValue}>
                {sessions.filter(s => s.attempts[0]?.scores.accuracy >= 0.8).length}
              </Text>
              <Text style={styles.statLabel}>Mastered</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="warning" size={20} color="#F59E0B" />
              <Text style={styles.statValue}>
                {sessions.filter(s => s.attempts[0]?.mispronuncedWords.length > 0).length}
              </Text>
              <Text style={styles.statLabel}>Need Practice</Text>
            </View>
            <View style={styles.statCard}>
              <Icon name="trending-up" size={20} color="#6366F1" />
              <Text style={styles.statValue}>
                {sessions.reduce((acc, s) => acc + s.attempts.length, 0)}
              </Text>
              <Text style={styles.statLabel}>Total Attempts</Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Filter Tabs - Immediately below header or stats */}
      <Animated.View 
        style={[
          styles.filterContainer,
          {
            opacity: filterAnim,
            transform: [{
              translateY: filterAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0],
              }),
            }],
          }
        ]}
      >
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {[
            { key: 'all', label: 'All', icon: 'apps' },
            { key: 'recent', label: 'Recent', icon: 'schedule' },
            { key: 'high-accuracy', label: 'Mastered', icon: 'star' },
            { key: 'needs-practice', label: 'Practice', icon: 'fitness-center' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                selectedFilter === filter.key && styles.filterTabActive
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setSelectedFilter(filter.key as any);
              }}
              activeOpacity={0.8}
            >
              <Icon 
                name={filter.icon} 
                size={18} 
                color={selectedFilter === filter.key ? '#FFFFFF' : '#6B7280'} 
              />
              <Text style={[
                styles.filterTabText,
                selectedFilter === filter.key && styles.filterTabTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Enhanced Search Bar and New Button - Immediately below filter tabs */}
      <Animated.View 
        style={[
          styles.searchContainer, 
          { 
            opacity: searchAnim,
            transform: [{
              translateY: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-30, 0],
              }),
            }],
          }
        ]}
      >
        <BlurView intensity={95} tint="light" style={styles.searchBlur}>
          <View style={styles.searchInputContainer}>
            <View style={styles.searchIconContainer}>
              <Icon name="search" size={20} color="#6366F1" />
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Search sessions..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => {
                  Haptics.selectionAsync();
                  setSearchQuery('');
                }}
                style={styles.clearButton}
              >
                <Icon name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </BlurView>

        <TouchableOpacity
          style={styles.newButton}
          onPress={() => {
            console.log('Plus button clicked!');
            handleNewSession();
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#6366F1', '#8B5CF6']}
            style={styles.newButtonGradient}
          >
            <Icon name="add" size={24} color="#FFFFFF" />
            <View style={styles.newButtonPulse} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Enhanced Sessions List */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {filteredSessions.length > 0 ? (
          <FlatList
            data={filteredSessions}
            keyExtractor={(item) => item.id}
            renderItem={renderSessionCard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onRefresh={handleRefresh}
            refreshing={isRefreshing}
            refreshControl={
              <Animated.View style={styles.refreshControl}>
                <ActivityIndicator size="small" color="#6366F1" />
              </Animated.View>
            }
          />
        ) : (
          <Animated.View 
            style={[
              styles.emptyState,
              {
                opacity: fadeAnim,
                transform: [{
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.emptyIconContainer,
                {
                  transform: [{
                    rotate: floatingAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '10deg'],
                    }),
                  }],
                }
              ]}
            >
              <Icon name="mic-off" size={64} color="#D1D5DB" />
            </Animated.View>
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No sessions found' : 'No practice sessions yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery 
                ? 'Try a different search term' 
                : 'Create your first session to start practicing'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity 
                style={styles.emptyButton} 
                onPress={handleNewSession}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.emptyButtonGradient}
                >
                  <Icon name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyButtonText}>Create New Session</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* New Session Modal */}
      <Modal
        visible={newSessionModalVisible}
        transparent={true}
        animationType="none"
        onRequestClose={handleCancelModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={handleCancelModal}
          />
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <Icon name="add-circle-outline" size={32} color="#FFFFFF" />
                  <Text style={styles.modalTitle}>New Practice Session</Text>
                </View>
                <TouchableOpacity 
                  onPress={handleCancelModal}
                  style={styles.modalCloseButton}
                >
                  <Icon name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalContent}>
                <Text style={styles.modalLabel}>Enter the sentence you want to practice:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={newSessionText}
                  onChangeText={setNewSessionText}
                  placeholder="Type your sentence here..."
                  placeholderTextColor="rgba(99, 102, 241, 0.4)"
                  multiline
                  numberOfLines={3}
                  autoFocus
                  textAlignVertical="top"
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.modalCancelButton}
                    onPress={handleCancelModal}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.modalCreateButton}
                    onPress={handleCreateSession}
                  >
                    <LinearGradient
                      colors={['#FFFFFF', '#F3F4F6']}
                      style={styles.modalCreateGradient}
                    >
                      <Icon name="arrow-forward" size={20} color="#6366F1" />
                      <Text style={styles.modalCreateText}>Create Session</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  headerGradient: {
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  statsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statsBar: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    marginTop: 4,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  filterScrollContent: {
    paddingRight: 20,
    paddingLeft: 0,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 12,
  },
  searchBlur: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  searchIconContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    position: 'relative',
  },
  newButtonGradient: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  newButtonPulse: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#6366F1',
    opacity: 0.2,
  },
  content: {
    flex: 1,
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sessionCardContainer: {
    marginBottom: 16,
  },
  sessionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  sessionGradient: {
    backgroundColor: '#FFFFFF',
    padding: 0,
    flexDirection: 'row',
  },
  progressRingContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressFill: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: 'transparent',
    borderTopColor: 'currentColor',
    transform: [{ rotate: '-90deg' }],
  },
  progressInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1F2937',
  },
  sessionContent: {
    flex: 1,
    padding: 20,
    paddingLeft: 0,
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
  sessionActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
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
    borderRadius: 12,
    borderWidth: 1.5,
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
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '500',
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 16,
    gap: 10,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  refreshControl: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 420,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 16,
    zIndex: 1001,
    backgroundColor: '#FFFFFF', // Add solid background
  },
  modalGradient: {
    padding: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 16,
    letterSpacing: -0.5,
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 24,
    padding: 24,
    backdropFilter: 'blur(20px)',
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    opacity: 0.95,
  },
  modalInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    minHeight: 120,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 16,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCreateButton: {
    flex: 1.5,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  modalCreateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  modalCreateText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6366F1',
  },
});