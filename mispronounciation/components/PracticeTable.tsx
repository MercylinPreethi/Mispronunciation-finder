import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import axios from 'axios';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();
const API_BASE_URL = 'http://192.168.14.34:5050';

const COLORS = {
  primary: '#6366F1',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  gold: '#FFC800',
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },
  white: '#FFFFFF',
};

interface WordPhonemeData {
  word: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  phoneme_errors: any[];
  per: { per: number };
  accuracy?: number;
}

interface AudioData {
  word_audio: { [key: string]: { audio_base64: string; status: string } };
}

interface PracticeTableProps {
  words: WordPhonemeData[];
  audioData?: AudioData;
  onWordRecord: (word: string) => void;
  onWordPlay: (word: string) => void;
  isRecording: boolean;
  isProcessing: boolean;
  playingWord: string | null;
  recordingWord: string | null;
  title?: string;
  showOnlyNeedingPractice?: boolean;
}

export default function PracticeTable({
  words,
  audioData,
  onWordRecord,
  onWordPlay,
  isRecording,
  isProcessing,
  playingWord,
  recordingWord,
  title = "Practice Words",
  showOnlyNeedingPractice = true,
}: PracticeTableProps) {
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [loadingAudio, setLoadingAudio] = useState<Set<string>>(new Set());
  
  const cardAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  const phonemeAnims = useRef<Map<string, Animated.Value[]>>(new Map()).current;

  // Initialize animations for words
  useEffect(() => {
    words.forEach((word, index) => {
      if (!cardAnims.has(word.word)) {
        cardAnims.set(word.word, new Animated.Value(0));
      }
      
      const phonemes = word.aligned_reference || word.reference_phonemes || [];
      if (!phonemeAnims.has(word.word)) {
        phonemeAnims.set(word.word, phonemes.map(() => new Animated.Value(0)));
      }
    });
  }, [words]);

  // Animate cards on mount
  useEffect(() => {
    words.forEach((word, index) => {
      const anim = cardAnims.get(word.word);
      if (anim) {
        Animated.timing(anim, {
          toValue: 1,
          duration: 300,
          delay: index * 100,
          useNativeDriver: true,
        }).start();
      }
    });
  }, [words]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'correct': return COLORS.success;
      case 'partial': return COLORS.warning;
      case 'mispronounced': return COLORS.error;
      default: return COLORS.gray[500];
    }
  };

  const getStatusBackground = (status: string) => {
    switch (status) {
      case 'correct': return '#D1FAE5';
      case 'partial': return '#FEF3C7';
      case 'mispronounced': return '#FEE2E2';
      default: return COLORS.gray[100];
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return COLORS.success;
    if (accuracy >= 0.7) return COLORS.warning;
    return COLORS.error;
  };

  const formatAccuracy = (accuracy: number) => {
    return `${(accuracy * 100).toFixed(0)}%`;
  };

  const calculateAccuracy = (wordData: WordPhonemeData): number => {
    if (typeof wordData.accuracy === 'number') {
      return wordData.accuracy / 100;
    }
    if (wordData.per && typeof wordData.per.per === 'number') {
      return 1 - (wordData.per.per / 100);
    }
    if (wordData.aligned_reference && wordData.aligned_predicted) {
      let matches = 0;
      const refPhonemes = wordData.aligned_reference;
      const predPhonemes = wordData.aligned_predicted;
      const length = Math.min(refPhonemes.length, predPhonemes.length);
      
      for (let i = 0; i < length; i++) {
        if (refPhonemes[i] === predPhonemes[i] && refPhonemes[i] !== '_') {
          matches++;
        }
      }
      
      const refLength = refPhonemes.filter(p => p !== '_').length;
      return refLength > 0 ? matches / refLength : 0;
    }
    return 0;
  };

  const getPhonemeStatus = (wordData: WordPhonemeData, index: number): 'correct' | 'incorrect' | 'missing' => {
    const refPhonemes = wordData.aligned_reference || wordData.reference_phonemes || [];
    const predPhonemes = wordData.aligned_predicted || wordData.predicted_phonemes || [];
    
    if (index >= refPhonemes.length) return 'missing';
    if (index >= predPhonemes.length) return 'missing';
    
    const ref = refPhonemes[index];
    const pred = predPhonemes[index];
    
    if (ref === '_' && pred === '_') return 'missing';
    if (ref === pred && ref !== '_') return 'correct';
    return 'incorrect';
  };

  const getPhonemeColor = (status: 'correct' | 'incorrect' | 'missing') => {
    switch (status) {
      case 'correct': return COLORS.success;
      case 'incorrect': return COLORS.error;
      case 'missing': return COLORS.gray[400];
    }
  };

  const getPhonemeBackground = (status: 'correct' | 'incorrect' | 'missing') => {
    switch (status) {
      case 'correct': return '#D1FAE5';
      case 'incorrect': return '#FEE2E2';
      case 'missing': return COLORS.gray[100];
    }
  };

  const handlePlayWord = async (word: string) => {
    try {
      Haptics.selectionAsync();
      setLoadingAudio(prev => new Set(prev).add(word));
      
      if (playingWord === word) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        onWordPlay('');
        return;
      }
      
      const wordAudioData = audioData?.word_audio?.[word];
      
      if (wordAudioData && wordAudioData.audio_base64) {
        await playBase64Audio(wordAudioData.audio_base64, word);
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
            await playBase64Audio(base64Audio, word);
          }
        } catch (apiError) {
          console.error('API word audio request failed:', apiError);
          Alert.alert('Audio Not Available', `Pronunciation audio for "${word}" is not available.`);
        }
      }
    } catch (error) {
      console.error('Error playing word audio:', error);
      onWordPlay('');
    } finally {
      setLoadingAudio(prev => {
        const newSet = new Set(prev);
        newSet.delete(word);
        return newSet;
      });
    }
  };

  const playBase64Audio = async (base64Audio: string, word: string) => {
    try {
      const audioPath = `${RNFS.DocumentDirectoryPath}/temp_${word}.m4a`;
      await RNFS.writeFile(audioPath, base64Audio, 'base64');
      
      await audioRecorderPlayer.startPlayer(audioPath);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          onWordPlay('');
          audioRecorderPlayer.removePlayBackListener();
        }
      });
      
      onWordPlay(word);
    } catch (error) {
      console.error('Error playing base64 audio:', error);
      onWordPlay('');
    }
  };

  const toggleWordExpansion = (word: string) => {
    Haptics.selectionAsync();
    setExpandedWords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(word)) {
        newSet.delete(word);
      } else {
        newSet.add(word);
        
        // Animate phonemes when expanding
        const phonemeAnimArray = phonemeAnims.get(word);
        if (phonemeAnimArray) {
          Animated.stagger(50, 
            phonemeAnimArray.map(anim => 
              Animated.timing(anim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              })
            )
          ).start();
        }
      }
      return newSet;
    });
  };

  const handleRecordWord = (word: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onWordRecord(word);
  };

  // Filter words based on showOnlyNeedingPractice
  const displayWords = showOnlyNeedingPractice 
    ? words.filter(word => word.status === 'mispronounced' || word.status === 'partial')
    : words;

  if (displayWords.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎉</Text>
          <Text style={styles.emptyTitle}>Perfect Pronunciation!</Text>
          <Text style={styles.emptyText}>
            {showOnlyNeedingPractice 
              ? 'All words were pronounced correctly!' 
              : 'No words available for practice.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title} ({displayWords.length})</Text>
      
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {displayWords.map((wordData, index) => {
          const accuracy = calculateAccuracy(wordData);
          const status = wordData.status;
          const statusColor = getStatusColor(status);
          const statusBackground = getStatusBackground(status);
          const accuracyColor = getAccuracyColor(accuracy);
          const isExpanded = expandedWords.has(wordData.word);
          const isRecordingThisWord = isRecording && recordingWord === wordData.word;
          const isLoadingAudio = loadingAudio.has(wordData.word);
          const isPlaying = playingWord === wordData.word;
          
          const cardAnim = cardAnims.get(wordData.word) || new Animated.Value(0);
          const phonemeAnimArray = phonemeAnims.get(wordData.word) || [];

          return (
            <Animated.View
              key={wordData.word}
              style={[
                styles.wordCard,
                {
                  opacity: cardAnim,
                  transform: [
                    {
                      translateY: cardAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Word Header */}
              <TouchableOpacity
                style={[
                  styles.wordHeader,
                  { borderColor: statusColor, backgroundColor: statusBackground }
                ]}
                onPress={() => toggleWordExpansion(wordData.word)}
                activeOpacity={0.8}
              >
                <View style={styles.wordInfo}>
                  <Text style={[styles.wordText, { color: statusColor }]}>
                    {wordData.word}
                  </Text>
                  <View style={styles.wordStats}>
                    <View style={[styles.accuracyBadge, { backgroundColor: accuracyColor + '20', borderColor: accuracyColor }]}>
                      <Text style={[styles.accuracyText, { color: accuracyColor }]}>
                        {formatAccuracy(accuracy)}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                      <Text style={[styles.statusText, { color: statusColor }]}>
                        {status === 'mispronounced' ? 'Practice' : status === 'partial' ? 'Improve' : 'Correct'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handlePlayWord(wordData.word)}
                    disabled={isProcessing || isLoadingAudio}
                  >
                    {isLoadingAudio ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <Icon 
                        name={isPlaying ? "pause" : "play-arrow"} 
                        size={20} 
                        color={COLORS.primary} 
                      />
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      isRecordingThisWord && styles.recordingButton
                    ]}
                    onPress={() => handleRecordWord(wordData.word)}
                    disabled={isProcessing || (isRecording && !isRecordingThisWord)}
                  >
                    <Icon 
                      name={isRecordingThisWord ? "stop" : "mic"} 
                      size={20} 
                      color={isRecordingThisWord ? COLORS.error : COLORS.primary} 
                    />
                  </TouchableOpacity>
                  
                  <Icon 
                    name={isExpanded ? "expand-less" : "expand-more"} 
                    size={24} 
                    color={statusColor} 
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded Phoneme Analysis */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  <View style={styles.phonemeSection}>
                    <Text style={styles.phonemeTitle}>Phoneme Analysis</Text>
                    
                    {/* Reference Phonemes */}
                    <View style={styles.phonemeRow}>
                      <Text style={styles.phonemeLabel}>Reference:</Text>
                      <View style={styles.phonemeContainer}>
                        {(wordData.aligned_reference || wordData.reference_phonemes || []).map((phoneme, index) => {
                          const status = getPhonemeStatus(wordData, index);
                          const color = getPhonemeColor(status);
                          const background = getPhonemeBackground(status);
                          
                          return (
                            <Animated.View
                              key={`ref-${index}`}
                              style={[
                                styles.phonemeBox,
                                {
                                  backgroundColor: background,
                                  borderColor: color,
                                  opacity: phonemeAnimArray[index] || 0,
                                  transform: [
                                    {
                                      scale: phonemeAnimArray[index]?.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 1],
                                      }) || 0.8,
                                    },
                                  ],
                                },
                              ]}
                            >
                              <Text style={[styles.phonemeText, { color }]}>
                                {phoneme === '_' ? '•' : phoneme}
                              </Text>
                            </Animated.View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Predicted Phonemes */}
                    <View style={styles.phonemeRow}>
                      <Text style={styles.phonemeLabel}>Your pronunciation:</Text>
                      <View style={styles.phonemeContainer}>
                        {(wordData.aligned_predicted || wordData.predicted_phonemes || []).map((phoneme, index) => {
                          const status = getPhonemeStatus(wordData, index);
                          const color = getPhonemeColor(status);
                          const background = getPhonemeBackground(status);
                          
                          return (
                            <Animated.View
                              key={`pred-${index}`}
                              style={[
                                styles.phonemeBox,
                                {
                                  backgroundColor: background,
                                  borderColor: color,
                                  opacity: phonemeAnimArray[index] || 0,
                                  transform: [
                                    {
                                      scale: phonemeAnimArray[index]?.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.8, 1],
                                      }) || 0.8,
                                    },
                                  ],
                                },
                              ]}
                            >
                              <Text style={[styles.phonemeText, { color }]}>
                                {phoneme === '_' ? '•' : phoneme}
                              </Text>
                            </Animated.View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Legend */}
                    <View style={styles.legend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#D1FAE5', borderColor: COLORS.success }]} />
                        <Text style={styles.legendText}>Correct</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: '#FEE2E2', borderColor: COLORS.error }]} />
                        <Text style={styles.legendText}>Incorrect</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendColor, { backgroundColor: COLORS.gray[100], borderColor: COLORS.gray[400] }]} />
                        <Text style={styles.legendText}>Missing</Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[800],
    padding: 16,
    paddingBottom: 8,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray[600],
    textAlign: 'center',
  },
  wordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  wordStats: {
    flexDirection: 'row',
    gap: 6,
  },
  accuracyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  accuracyText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: COLORS.error + '20',
  },
  expandedContent: {
    padding: 12,
    paddingTop: 0,
  },
  phonemeSection: {
    marginTop: 8,
  },
  phonemeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 12,
  },
  phonemeRow: {
    marginBottom: 8,
  },
  phonemeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginBottom: 6,
  },
  phonemeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  phonemeBox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 24,
    alignItems: 'center',
  },
  phonemeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
});