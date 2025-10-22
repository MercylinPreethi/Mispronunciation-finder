import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
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

interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  tip: string;
  difficulty: 'easy' | 'intermediate' | 'hard';
}

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

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  feedback: string;
  word_level_analysis?: {
    word_phoneme_mapping: WordPhonemeData[];
  };
  audio_data?: {
    word_audio: { [key: string]: { audio_base64: string; status: string } };
  };
}

interface EnhancedPracticeModalProps {
  visible: boolean;
  word: Word | null;
  onClose: () => void;
  onSaveAttempt: (result: AnalysisResult) => void;
  isDailyWord?: boolean;
}

export default function EnhancedPracticeModal({
  visible,
  word,
  onClose,
  onSaveAttempt,
  isDailyWord = false,
}: EnhancedPracticeModalProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [playingPhoneme, setPlayingPhoneme] = useState<string | null>(null);
  const [expandedPhonemes, setExpandedPhonemes] = useState(false);
  
  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');
  const recordingPathRef = useRef<string | null>(null);
  
  const modalAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const phonemeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(modalAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (showResult && result) {
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      resultAnim.setValue(0);
    }
  }, [showResult, result]);

  useEffect(() => {
    if (expandedPhonemes) {
      Animated.timing(phonemeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(phonemeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [expandedPhonemes]);

  useEffect(() => {
    if (isRecording) {
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
  }, [isRecording]);

  const handleRecord = async () => {
    if (isRecording) {
      // Stop recording
      try {
        const result = await audioRecorderPlayer.stopRecorder();
        setIsRecording(false);
        audioRecorderPlayer.removeRecordBackListener();
        
        if (result) {
          recordingPathRef.current = result;
          await processRecording(result);
        }
      } catch (error) {
        console.error('Error stopping recording:', error);
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const audioSet = {
          AudioEncoderAndroid: 'AAC',
          AudioSourceAndroid: 'MIC',
          AVEncoderAudioQualityKeyIOS: 'high',
          AVNumberOfChannelsKeyIOS: 2,
          AVFormatIDKeyIOS: 'aac',
        };
    
        const result = await audioRecorderPlayer.startRecorder(undefined, audioSet);
        audioRecorderPlayer.addRecordBackListener((e) => {
          recordSecsRef.current = e.currentPosition;
          recordTimeRef.current = audioRecorderPlayer.mmssss(Math.floor(e.currentPosition));
          setRecordingTime(recordTimeRef.current);
        });
    
        setIsRecording(true);
        recordingPathRef.current = result;
      } catch (error) {
        console.error('Error starting recording:', error);
        Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
      }
    }
  };

  const processRecording = async (audioPath: string) => {
    if (!word) return;
    
    setIsProcessing(true);
    
    try {
      // Convert audio to base64
      const audioData = await RNFS.readFile(audioPath, 'base64');
      const audioUri = `data:audio/m4a;base64,${audioData}`;
      
      // Analyze pronunciation
      const response = await axios.post(`${API_BASE_URL}/analyze`, {
        audio: audioUri,
        reference_text: word.word,
      });
      
      if (response.data && response.data.success) {
        const analysisResult = response.data.analysis || response.data;
        
        const resultData: AnalysisResult = {
          accuracy: analysisResult.accuracy,
          correct_phonemes: analysisResult.correct_phonemes,
          total_phonemes: analysisResult.total_phonemes,
          feedback: analysisResult.feedback || 'Great job!',
          word_level_analysis: analysisResult.word_level_analysis,
          audio_data: analysisResult.audio_data,
        };
        
        setResult(resultData);
        setShowResult(true);
        onSaveAttempt(resultData);
        
      } else {
        Alert.alert('Analysis Error', 'Failed to analyze pronunciation. Please try again.');
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      Alert.alert('Processing Error', 'Failed to process recording. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePlayWord = async () => {
    if (!word) return;
    
    try {
      Haptics.selectionAsync();
      
      if (playingAudio) {
        await audioRecorderPlayer.stopPlayer();
        audioRecorderPlayer.removePlayBackListener();
        setPlayingAudio(false);
        return;
      }
      
      try {
        const response = await axios.get(`${API_BASE_URL}/get_word_audio/${word.word}`, {
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
        Alert.alert('Audio Not Available', `Pronunciation audio for "${word.word}" is not available.`);
      }
    } catch (error) {
      console.error('Error playing word audio:', error);
      setPlayingAudio(false);
    }
  };

  const playBase64Audio = async (base64Audio: string) => {
    if (!word) return;
    
    try {
      const audioPath = `${RNFS.DocumentDirectoryPath}/temp_${word.word}.m4a`;
      await RNFS.writeFile(audioPath, base64Audio, 'base64');
      
      await audioRecorderPlayer.startPlayer(audioPath);
      audioRecorderPlayer.addPlayBackListener((e) => {
        if (e.currentPosition === e.duration) {
          setPlayingAudio(false);
          audioRecorderPlayer.removePlayBackListener();
        }
      });
      
      setPlayingAudio(true);
    } catch (error) {
      console.error('Error playing base64 audio:', error);
      setPlayingAudio(false);
    }
  };

  const handlePlayPhoneme = async (phoneme: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlayingPhoneme(phoneme);
    
    // Simulate phoneme audio playback
    setTimeout(() => {
      setPlayingPhoneme(null);
    }, 1000);
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

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 0.9) return COLORS.success;
    if (accuracy >= 0.7) return COLORS.warning;
    return COLORS.error;
  };

  if (!word) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.modalOverlay,
          { opacity: modalAnim }
        ]}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary]}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>
              {isDailyWord ? "Today's Challenge" : "Practice Word"}
            </Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={onClose}
            >
              <Icon name="close" size={24} color={COLORS.white} />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Word Display */}
            <View style={styles.wordSection}>
              <Text style={styles.wordText}>{word.word}</Text>
              <Text style={styles.phoneticText}>{word.phonetic}</Text>
              
              <View style={styles.wordActions}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handlePlayWord}
                >
                  <Icon 
                    name={playingAudio ? "pause" : "play-arrow"} 
                    size={24} 
                    color={COLORS.primary} 
                  />
                  <Text style={styles.playButtonText}>
                    {playingAudio ? 'Playing...' : 'Listen'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recording Section */}
            {!showResult ? (
              <View style={styles.recordingSection}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <TouchableOpacity
                    style={styles.recordButton}
                    onPress={handleRecord}
                    disabled={isProcessing}
                  >
                    <LinearGradient
                      colors={isRecording ? [COLORS.error, '#DC2626'] : [COLORS.primary, COLORS.secondary]}
                      style={styles.recordButtonGradient}
                    >
                      <Icon 
                        name={isRecording ? "stop" : "mic"} 
                        size={48} 
                        color={COLORS.white} 
                      />
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
                
                <Text style={styles.recordingText}>
                  {isRecording ? 'Recording...' : 'Tap to record'}
                </Text>
                
                {isRecording && (
                  <Text style={styles.recordingTime}>{recordingTime}</Text>
                )}
                
                {isProcessing && (
                  <View style={styles.processingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.processingText}>Analyzing pronunciation...</Text>
                  </View>
                )}
              </View>
            ) : (
              /* Results Section */
              <Animated.View 
                style={[
                  styles.resultSection,
                  { opacity: resultAnim }
                ]}
              >
                {/* Overall Result */}
                <View style={styles.overallResult}>
                  <Text style={styles.resultTitle}>
                    {result && result.accuracy >= 0.8 ? '🎉 Great job!' : '💪 Keep practicing!'}
                  </Text>
                  <Text style={[
                    styles.resultAccuracy,
                    { color: getAccuracyColor(result?.accuracy || 0) }
                  ]}>
                    {result ? Math.round(result.accuracy * 100) : 0}% Accuracy
                  </Text>
                  <Text style={styles.resultFeedback}>{result?.feedback}</Text>
                </View>

                {/* Phoneme Analysis */}
                {result?.word_level_analysis?.word_phoneme_mapping && result.word_level_analysis.word_phoneme_mapping.length > 0 && (
                  <View style={styles.phonemeSection}>
                    <TouchableOpacity
                      style={styles.phonemeHeader}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExpandedPhonemes(!expandedPhonemes);
                      }}
                    >
                      <Text style={styles.phonemeTitle}>Phoneme Analysis</Text>
                      <Icon 
                        name={expandedPhonemes ? "expand-less" : "expand-more"} 
                        size={24} 
                        color={COLORS.primary} 
                      />
                    </TouchableOpacity>

                    <Animated.View
                      style={[
                        styles.phonemeContent,
                        {
                          opacity: phonemeAnim,
                          maxHeight: phonemeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 400],
                          }),
                        },
                      ]}
                    >
                      {result.word_level_analysis.word_phoneme_mapping.map((wordData, wordIndex) => (
                        <View key={wordIndex} style={styles.wordPhonemeContainer}>
                          <Text style={styles.wordPhonemeTitle}>{wordData.word}</Text>
                          
                          {/* Reference Phonemes */}
                          <View style={styles.phonemeRow}>
                            <Text style={styles.phonemeLabel}>Reference:</Text>
                            <View style={styles.phonemeContainer}>
                              {(wordData.aligned_reference || wordData.reference_phonemes || []).map((phoneme, index) => {
                                const status = getPhonemeStatus(wordData, index);
                                const color = getPhonemeColor(status);
                                const background = getPhonemeBackground(status);
                                
                                return (
                                  <TouchableOpacity
                                    key={`ref-${index}`}
                                    style={[
                                      styles.phonemeBox,
                                      {
                                        backgroundColor: background,
                                        borderColor: color,
                                      },
                                    ]}
                                    onPress={() => handlePlayPhoneme(phoneme)}
                                  >
                                    <Text style={[styles.phonemeText, { color }]}>
                                      {phoneme === '_' ? '•' : phoneme}
                                    </Text>
                                  </TouchableOpacity>
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
                                  <TouchableOpacity
                                    key={`pred-${index}`}
                                    style={[
                                      styles.phonemeBox,
                                      {
                                        backgroundColor: background,
                                        borderColor: color,
                                      },
                                    ]}
                                    onPress={() => handlePlayPhoneme(phoneme)}
                                  >
                                    <Text style={[styles.phonemeText, { color }]}>
                                      {phoneme === '_' ? '•' : phoneme}
                                    </Text>
                                  </TouchableOpacity>
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
                      ))}
                    </Animated.View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.tryAgainButton}
                    onPress={() => {
                      setShowResult(false);
                      setResult(null);
                      setExpandedPhonemes(false);
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.primary, COLORS.secondary]}
                      style={styles.tryAgainButtonGradient}
                    >
                      <Icon name="refresh" size={20} color={COLORS.white} />
                      <Text style={styles.tryAgainText}>Try Again</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    flex: 1,
  },
  wordSection: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  wordText: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  phoneticText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 16,
  },
  wordActions: {
    flexDirection: 'row',
    gap: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray[100],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  playButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  recordingSection: {
    padding: 20,
    alignItems: 'center',
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 16,
  },
  recordButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginBottom: 8,
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.error,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  processingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray[700],
    marginTop: 12,
  },
  resultSection: {
    padding: 20,
  },
  overallResult: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  resultAccuracy: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  resultFeedback: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray[600],
    textAlign: 'center',
    lineHeight: 24,
  },
  phonemeSection: {
    marginBottom: 20,
  },
  phonemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  phonemeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  phonemeContent: {
    overflow: 'hidden',
  },
  wordPhonemeContainer: {
    marginTop: 16,
  },
  wordPhonemeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray[800],
    marginBottom: 12,
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
  actionButtons: {
    marginTop: 20,
  },
  tryAgainButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  tryAgainButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});