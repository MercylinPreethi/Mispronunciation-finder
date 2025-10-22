import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
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

interface PhonemeData {
  reference: string;
  predicted: string;
  isCorrect: boolean;
  position: number;
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

interface PhonemeAnalysisCardProps {
  wordData: WordPhonemeData;
  audioData?: {
    audio_base64: string;
    status: 'correct' | 'partial' | 'mispronounced';
  };
  onPlayPhoneme?: (phoneme: string, word: string) => void;
  onRecordWord?: (word: string) => void;
  isRecording?: boolean;
  isProcessing?: boolean;
  playingPhoneme?: string | null;
  recordingWord?: string | null;
}

export default function PhonemeAnalysisCard({
  wordData,
  audioData,
  onPlayPhoneme,
  onRecordWord,
  isRecording = false,
  isProcessing = false,
  playingPhoneme = null,
  recordingWord = null,
}: PhonemeAnalysisCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [playingWord, setPlayingWord] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  
  const expandAnim = useRef(new Animated.Value(0)).current;
  const phonemeAnims = useRef<Animated.Value[]>([]).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize phoneme animations
  useEffect(() => {
    const phonemes = wordData.aligned_reference || wordData.reference_phonemes || [];
    phonemeAnims.length = 0;
    phonemes.forEach(() => {
      phonemeAnims.push(new Animated.Value(0));
    });
  }, [wordData]);

  // Animate phonemes on expand
  useEffect(() => {
    if (expanded) {
      Animated.parallel([
        Animated.timing(expandAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        ...phonemeAnims.map((anim, index) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 200,
            delay: index * 50,
            useNativeDriver: true,
          })
        ),
      ]).start();
    } else {
      Animated.timing(expandAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [expanded]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording && recordingWord === wordData.word) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, recordingWord]);

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

  const calculateAccuracy = (): number => {
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

  const getPhonemeStatus = (index: number): 'correct' | 'incorrect' | 'missing' => {
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

  const handlePlayWord = async () => {
    try {
      Haptics.selectionAsync();
      setLoadingAudio(true);
      
      if (playingWord) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingWord(false);
        return;
      }
      
      if (audioData && audioData.audio_base64) {
        await playBase64Audio(audioData.audio_base64);
      } else {
        try {
          const response = await axios.get(`${API_BASE_URL}/get_word_audio/${wordData.word}`, {
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
            await playBase64Audio(base64Audio);
          }
        } catch (apiError) {
          console.error('API word audio request failed:', apiError);
          Alert.alert('Audio Not Available', `Pronunciation audio for "${wordData.word}" is not available.`);
        }
      }
    } catch (error) {
      console.error('Error playing word audio:', error);
      setPlayingWord(false);
    } finally {
      setLoadingAudio(false);
    }
  };

  const playBase64Audio = async (base64Audio: string) => {
    try {
      const audioPath = `${RNFS.DocumentDirectoryPath}/temp_${wordData.word}.m4a`;
      await RNFS.writeFile(audioPath, base64Audio, 'base64');
      
      await audioRecorderPlayer.startPlayer(audioPath);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          setPlayingWord(false);
          audioRecorderPlayer.removePlayBackListener();
        }
      });
      
      setPlayingWord(true);
    } catch (error) {
      console.error('Error playing base64 audio:', error);
      setPlayingWord(false);
    }
  };

  const handlePlayPhoneme = (phoneme: string, index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPlayPhoneme) {
      onPlayPhoneme(phoneme, wordData.word);
    }
  };

  const handleRecordWord = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onRecordWord) {
      onRecordWord(wordData.word);
    }
  };

  const accuracy = calculateAccuracy();
  const status = wordData.status;
  const statusColor = getStatusColor(status);
  const statusBackground = getStatusBackground(status);
  const accuracyColor = getAccuracyColor(accuracy);

  const refPhonemes = wordData.aligned_reference || wordData.reference_phonemes || [];
  const predPhonemes = wordData.aligned_predicted || wordData.predicted_phonemes || [];
  const maxLength = Math.max(refPhonemes.length, predPhonemes.length);

  return (
    <View style={styles.container}>
      {/* Word Header */}
      <TouchableOpacity
        style={[
          styles.wordHeader,
          { borderColor: statusColor, backgroundColor: statusBackground }
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          setExpanded(!expanded);
        }}
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
            onPress={handlePlayWord}
            disabled={isProcessing || loadingAudio}
          >
            {loadingAudio ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Icon 
                name={playingWord ? "pause" : "play-arrow"} 
                size={20} 
                color={COLORS.primary} 
              />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRecordWord}
            disabled={isProcessing || (isRecording && recordingWord !== wordData.word)}
          >
            <Icon 
              name={isRecording && recordingWord === wordData.word ? "stop" : "mic"} 
              size={20} 
              color={isRecording && recordingWord === wordData.word ? COLORS.error : COLORS.primary} 
            />
          </TouchableOpacity>
          
          <Icon 
            name={expanded ? "expand-less" : "expand-more"} 
            size={24} 
            color={statusColor} 
          />
        </View>
      </TouchableOpacity>

      {/* Expanded Phoneme Analysis */}
      <Animated.View
        style={[
          styles.expandedContent,
          {
            opacity: expandAnim,
            maxHeight: expandAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 400],
            }),
          },
        ]}
      >
        <View style={styles.phonemeSection}>
          <Text style={styles.phonemeTitle}>Phoneme Analysis</Text>
          
          {/* Reference Phonemes */}
          <View style={styles.phonemeRow}>
            <Text style={styles.phonemeLabel}>Reference:</Text>
            <View style={styles.phonemeContainer}>
              {refPhonemes.map((phoneme, index) => {
                const status = getPhonemeStatus(index);
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
                        opacity: phonemeAnims[index] || 0,
                        transform: [
                          {
                            scale: phonemeAnims[index]?.interpolate({
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
              {predPhonemes.map((phoneme, index) => {
                const status = getPhonemeStatus(index);
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
                        opacity: phonemeAnims[index] || 0,
                        transform: [
                          {
                            scale: phonemeAnims[index]?.interpolate({
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.gray[200],
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2,
  },
  wordInfo: {
    flex: 1,
  },
  wordText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  wordStats: {
    flexDirection: 'row',
    gap: 8,
  },
  accuracyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedContent: {
    overflow: 'hidden',
  },
  phonemeSection: {
    padding: 16,
    paddingTop: 0,
  },
  phonemeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 16,
  },
  phonemeRow: {
    marginBottom: 12,
  },
  phonemeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginBottom: 8,
  },
  phonemeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  phonemeBox: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 32,
    alignItems: 'center',
  },
  phonemeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray[600],
  },
});