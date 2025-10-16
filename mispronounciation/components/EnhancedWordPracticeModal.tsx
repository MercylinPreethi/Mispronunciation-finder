import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  secondary: '#8B5CF6',
  tertiary: '#EC4899',
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
  background: '#F8F9FE',
  gradients: {
    primary: ['#6366F1', '#8B5CF6', '#EC4899'] as const,
    success: ['#10B981', '#059669', '#047857'] as const,
    warning: ['#F59E0B', '#D97706', '#B45309'] as const,
    error: ['#EF4444', '#DC2626', '#B91C1C'] as const,
    gold: ['#FFC800', '#F59E0B', '#D97706'] as const,
    blue: ['#3B82F6', '#2563EB', '#1D4ED8'] as const,
  },
};

interface Word {
  id: string;
  word: string;
  phonetic: string;
  meaning: string;
  example: string;
  tip: string;
  difficulty: string;
}

interface AnalysisResult {
  accuracy: number;
  feedback: string;
  correct_phonemes: number;
  total_phonemes: number;
  transcription?: string;
}

interface EnhancedWordPracticeModalProps {
  visible: boolean;
  word: Word | null;
  onClose: () => void;
  onRecord: () => void;
  onPlayPronunciation: () => void;
  isRecording: boolean;
  isProcessing: boolean;
  playingAudio: boolean;
  recordingTime: string;
  showResult: boolean;
  result: AnalysisResult | null;
  onTryAgain: () => void;
}

export default function EnhancedWordPracticeModal({
  visible,
  word,
  onClose,
  onRecord,
  onPlayPronunciation,
  isRecording,
  isProcessing,
  playingAudio,
  recordingTime,
  showResult,
  result,
  onTryAgain,
}: EnhancedWordPracticeModalProps) {
  // Animation values
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scoreRevealAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  
  // Visual feedback states
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [accuracyRingProgress, setAccuracyRingProgress] = useState(0);

  // Safety check
  if (!visible || !word) {
    return null;
  }

  useEffect(() => {
    if (visible) {
      // Entry animations
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Haptic feedback on open
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Exit animations
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Pulse animation for recording button
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
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

      // Generate waveform animation
      const interval = setInterval(() => {
        const newBars = Array.from({ length: 20 }, () => Math.random() * 80 + 20);
        setWaveformBars(newBars);
      }, 100);

      return () => clearInterval(interval);
    } else {
      pulseAnim.setValue(1);
      setWaveformBars([]);
    }
  }, [isRecording]);

  // Progress ring animation
  useEffect(() => {
    if (showResult && result) {
      Animated.sequence([
        Animated.delay(200),
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]).start();

      // Animate accuracy ring
      const targetAccuracy = result.accuracy;
      const steps = 60;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        setAccuracyRingProgress((currentStep / steps) * targetAccuracy);
        
        if (currentStep >= steps) {
          clearInterval(interval);
        }
      }, 20);

      // Score reveal animation
      Animated.sequence([
        Animated.delay(300),
        Animated.spring(scoreRevealAnim, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Confetti animation for good scores
      if (result.accuracy >= 0.7) {
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(confettiAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start();
        
        // Strong haptic feedback for success
        Haptics.notificationAsync(
          result.accuracy >= 0.9 
            ? Haptics.NotificationFeedbackType.Success 
            : Haptics.NotificationFeedbackType.Success
        );
      }

      return () => clearInterval(interval);
    } else {
      scoreRevealAnim.setValue(0);
      confettiAnim.setValue(0);
      ringAnim.setValue(0);
      setAccuracyRingProgress(0);
    }
  }, [showResult, result]);

  const handleRecordPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onRecord();
  };

  const handlePlayPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayPronunciation();
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleTryAgain = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onTryAgain();
  };

  const renderAccuracyRing = () => {
    if (!result) return null;
    
    const radius = 80;
    const strokeWidth = 12;
    const circumference = 2 * Math.PI * radius;
    const progressOffset = circumference - (accuracyRingProgress * circumference);
    
    return (
      <View style={styles.accuracyRingContainer}>
        <View style={styles.ringWrapper}>
          {/* Background circle */}
          <View style={[styles.ringBackground, { width: radius * 2, height: radius * 2 }]}>
            <LinearGradient
              colors={[COLORS.gray[100], COLORS.gray[50]] as const}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          
          {/* Progress ring */}
          <Animated.View 
            style={[
              styles.progressRing,
              {
                width: radius * 2,
                height: radius * 2,
                transform: [
                  { rotate: ringAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  })},
                ],
              }
            ]}
          >
            <View style={styles.ringGradientWrapper}>
              <LinearGradient
                colors={
                  result.accuracy >= 0.8 
                    ? [...COLORS.gradients.success]
                    : result.accuracy >= 0.6
                    ? [...COLORS.gradients.warning]
                    : [...COLORS.gradients.error]
                }
                style={styles.ringGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </View>
          </Animated.View>
          
          {/* Center content */}
          <Animated.View 
            style={[
              styles.ringCenter,
              {
                transform: [{ scale: scoreRevealAnim }],
              }
            ]}
          >
            <Text style={styles.accuracyPercentage}>
              {Math.round(accuracyRingProgress * 100)}%
            </Text>
            <Text style={styles.accuracyLabel}>Accuracy</Text>
          </Animated.View>
        </View>
      </View>
    );
  };

  const renderConfetti = () => {
    if (!showResult || !result || result.accuracy < 0.7) return null;
    
    const confettiColors = [COLORS.gold, COLORS.primary, COLORS.secondary, COLORS.tertiary, COLORS.success];
    
    return (
      <View style={styles.confettiContainer} pointerEvents="none">
        {Array.from({ length: 30 }).map((_, index) => {
          const randomColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
          const randomDelay = Math.random() * 500;
          const randomX = Math.random() * width;
          const randomRotation = Math.random() * 720;
          
          const translateY = confettiAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [-100, height + 100],
          });
          
          return (
            <Animated.View
              key={index}
              style={[
                styles.confettiPiece,
                {
                  backgroundColor: randomColor,
                  left: randomX,
                  transform: [
                    { translateY },
                    { rotate: `${randomRotation}deg` },
                  ],
                  opacity: confettiAnim,
                },
              ]}
            />
          );
        })}
      </View>
    );
  };

  const renderWaveform = () => {
    if (!isRecording || waveformBars.length === 0) return null;
    
    return (
      <View style={styles.waveformContainer}>
        {waveformBars.map((height, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              { 
                height,
                backgroundColor: COLORS.error,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
          }
        ]}
      >
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
        
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim },
              ],
            }
          ]}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            <View style={styles.modalCard}>
              {!showResult ? (
                <>
                  {/* Header */}
                  <View style={styles.header}>
                    <View style={styles.headerDeco}>
                      <LinearGradient
                        colors={[...COLORS.gradients.primary]}
                        style={styles.headerGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      />
                    </View>
                    <TouchableOpacity 
                      style={styles.closeButton}
                      onPress={handleClose}
                    >
                      <Icon name="close" size={24} color={COLORS.gray[600]} />
                    </TouchableOpacity>
                  </View>

                  {/* Word Display */}
                  <View style={styles.wordDisplayContainer}>
                    <View style={styles.wordBadge}>
                      <LinearGradient
                        colors={[...COLORS.gradients.primary]}
                        style={styles.wordBadgeGradient}
                      >
                        <Icon name="school" size={20} color={COLORS.white} />
                        <Text style={styles.wordBadgeText}>Practice Word</Text>
                      </LinearGradient>
                    </View>
                    
                    <Animated.View 
                      style={[
                        styles.wordCard,
                        {
                          transform: [{ scale: scaleAnim }],
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={[COLORS.white, COLORS.gray[50]] as const}
                        style={styles.wordCardGradient}
                      >
                        <Text style={styles.wordText}>{word.word}</Text>
                        <Text style={styles.phoneticText}>{word.phonetic}</Text>
                      </LinearGradient>
                    </Animated.View>
                  </View>

                  {/* Word Details */}
                  <View style={styles.detailsContainer}>
                    <View style={styles.detailCard}>
                      <View style={styles.detailHeader}>
                        <View style={styles.detailIconWrapper}>
                          <LinearGradient
                            colors={[COLORS.primary, COLORS.secondary] as const}
                            style={styles.detailIconGradient}
                          >
                            <Icon name="book" size={18} color={COLORS.white} />
                          </LinearGradient>
                        </View>
                        <Text style={styles.detailLabel}>Meaning</Text>
                      </View>
                      <Text style={styles.detailText}>{word.meaning}</Text>
                    </View>

                    <View style={styles.detailCard}>
                      <View style={styles.detailHeader}>
                        <View style={styles.detailIconWrapper}>
                          <LinearGradient
                            colors={[COLORS.secondary, COLORS.tertiary] as const}
                            style={styles.detailIconGradient}
                          >
                            <Icon name="format-quote" size={18} color={COLORS.white} />
                          </LinearGradient>
                        </View>
                        <Text style={styles.detailLabel}>Example</Text>
                      </View>
                      <Text style={styles.detailText}>"{word.example}"</Text>
                    </View>

                    <View style={styles.detailCard}>
                      <View style={styles.detailHeader}>
                        <View style={styles.detailIconWrapper}>
                          <LinearGradient
                            colors={[COLORS.gold, COLORS.warning] as const}
                            style={styles.detailIconGradient}
                          >
                            <Icon name="lightbulb" size={18} color={COLORS.white} />
                          </LinearGradient>
                        </View>
                        <Text style={styles.detailLabel}>Pro Tip</Text>
                      </View>
                      <Text style={styles.detailText}>{word.tip}</Text>
                    </View>
                  </View>

                  {/* Listen Button */}
                  <TouchableOpacity
                    style={styles.listenButton}
                    onPress={handlePlayPress}
                    disabled={playingAudio}
                  >
                    <LinearGradient
                      colors={playingAudio ? [...COLORS.gradients.blue] : [...COLORS.gradients.primary]}
                      style={styles.listenGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Icon 
                        name={playingAudio ? 'volume-up' : 'headphones'} 
                        size={24} 
                        color={COLORS.white} 
                      />
                      <Text style={styles.listenText}>
                        {playingAudio ? 'Playing Pronunciation...' : 'Listen to Pronunciation'}
                      </Text>
                      {playingAudio && (
                        <ActivityIndicator size="small" color={COLORS.white} />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Recording Section */}
                  <View style={styles.recordingSection}>
                    <Text style={styles.recordingTitle}>Your Turn!</Text>
                    <Text style={styles.recordingSubtitle}>
                      Tap the microphone to record your pronunciation
                    </Text>

                    {isProcessing ? (
                        <View style={styles.processingContainer}>
                          <LinearGradient
                            colors={[...COLORS.gradients.primary]}
                            style={styles.processingGradient}
                          >
                          <ActivityIndicator size="large" color={COLORS.white} />
                          <Text style={styles.processingText}>Analyzing your pronunciation...</Text>
                          <Text style={styles.processingSubtext}>Please wait</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <>
                        <Animated.View 
                          style={[
                            styles.recordButtonContainer,
                            {
                              transform: [{ scale: pulseAnim }],
                            }
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.recordButton}
                            onPress={handleRecordPress}
                            activeOpacity={0.8}
                          >
                            <LinearGradient
                              colors={isRecording ? [...COLORS.gradients.error] : [...COLORS.gradients.primary]}
                              style={styles.recordButtonGradient}
                            >
                              {isRecording && (
                                <View style={styles.recordingRipple}>
                                  <View style={[styles.rippleCircle, styles.ripple1]} />
                                  <View style={[styles.rippleCircle, styles.ripple2]} />
                                  <View style={[styles.rippleCircle, styles.ripple3]} />
                                </View>
                              )}
                              <View style={styles.recordIconWrapper}>
                                <Icon 
                                  name={isRecording ? 'stop' : 'mic'} 
                                  size={48} 
                                  color={COLORS.white} 
                                />
                              </View>
                            </LinearGradient>
                          </TouchableOpacity>
                        </Animated.View>

                        {isRecording && (
                          <View style={styles.recordingInfo}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTime}>{recordingTime}</Text>
                          </View>
                        )}

                        {renderWaveform()}

                        <Text style={styles.recordingHint}>
                          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
                        </Text>
                      </>
                    )}
                  </View>
                </>
              ) : (
                <>
                  {/* Result Screen */}
                  <View style={styles.resultContainer}>
                    {renderConfetti()}
                    
                    <TouchableOpacity 
                      style={styles.closeButtonResult}
                      onPress={handleClose}
                    >
                      <Icon name="close" size={24} color={COLORS.gray[600]} />
                    </TouchableOpacity>

                    <Animated.View 
                      style={[
                        styles.resultHeader,
                        {
                          opacity: scoreRevealAnim,
                        }
                      ]}
                    >
                      <LinearGradient
                        colors={
                          result && result.accuracy >= 0.8 
                            ? [...COLORS.gradients.success]
                            : result && result.accuracy >= 0.6
                            ? [...COLORS.gradients.warning]
                            : [...COLORS.gradients.error]
                        }
                        style={styles.resultIconCircle}
                      >
                        <Icon 
                          name={
                            result && result.accuracy >= 0.9 ? 'celebration' :
                            result && result.accuracy >= 0.8 ? 'emoji-events' :
                            result && result.accuracy >= 0.6 ? 'thumb-up' : 'refresh'
                          } 
                          size={64} 
                          color={COLORS.white} 
                        />
                      </LinearGradient>
                      
                      <Text style={styles.resultTitle}>
                        {result && result.accuracy >= 0.9 ? 'Outstanding! 🎉' :
                         result && result.accuracy >= 0.8 ? 'Excellent Work! ⭐' :
                         result && result.accuracy >= 0.6 ? 'Good Job! 👍' : 
                         'Keep Practicing! 💪'}
                      </Text>

                      <View style={styles.xpBadge}>
                        <LinearGradient
                          colors={[...COLORS.gradients.gold]}
                          style={styles.xpBadgeGradient}
                        >
                          <Icon name="stars" size={20} color={COLORS.white} />
                          <Text style={styles.xpText}>
                            +{result && Math.round(result.accuracy * 10)} XP
                          </Text>
                        </LinearGradient>
                      </View>
                    </Animated.View>

                    {/* Accuracy Ring */}
                    {renderAccuracyRing()}

                    {/* Stats Cards */}
                    <Animated.View 
                      style={[
                        styles.statsContainer,
                        {
                          opacity: scoreRevealAnim,
                          transform: [
                            { 
                              translateY: scoreRevealAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [30, 0],
                              })
                            }
                          ],
                        }
                      ]}
                    >
                      <View style={styles.statCard}>
                        <LinearGradient
                          colors={[...COLORS.gradients.success]}
                          style={styles.statCardGradient}
                        >
                          <Icon name="check-circle" size={32} color={COLORS.white} />
                          <Text style={styles.statValue}>{result?.correct_phonemes || 0}</Text>
                          <Text style={styles.statLabel}>Correct Phonemes</Text>
                        </LinearGradient>
                      </View>

                      <View style={styles.statCard}>
                        <LinearGradient
                          colors={[...COLORS.gradients.error]}
                          style={styles.statCardGradient}
                        >
                          <Icon name="cancel" size={32} color={COLORS.white} />
                          <Text style={styles.statValue}>
                            {result ? result.total_phonemes - result.correct_phonemes : 0}
                          </Text>
                          <Text style={styles.statLabel}>Need Improvement</Text>
                        </LinearGradient>
                      </View>
                    </Animated.View>

                    {/* Feedback Card */}
                    <Animated.View 
                      style={[
                        styles.feedbackCard,
                        {
                          opacity: scoreRevealAnim,
                        }
                      ]}
                    >
                      <View style={styles.feedbackHeader}>
                        <Icon name="feedback" size={24} color={COLORS.primary} />
                        <Text style={styles.feedbackTitle}>Detailed Feedback</Text>
                      </View>
                      <Text style={styles.feedbackText}>{result?.feedback}</Text>
                    </Animated.View>

                    {/* Action Buttons */}
                    <Animated.View 
                      style={[
                        styles.actionButtons,
                        {
                          opacity: scoreRevealAnim,
                        }
                      ]}
                    >
                      <TouchableOpacity 
                        style={styles.tryAgainButton}
                        onPress={handleTryAgain}
                      >
                        <Icon name="refresh" size={24} color={COLORS.primary} />
                        <Text style={styles.tryAgainText}>Try Again</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={styles.continueButton}
                        onPress={handleClose}
                      >
                        <LinearGradient
                          colors={[...COLORS.gradients.primary]}
                          style={styles.continueGradient}
                        >
                          <Text style={styles.continueText}>Continue Learning</Text>
                          <Icon name="arrow-forward" size={24} color={COLORS.white} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: height * 0.95,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    position: 'relative',
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerDeco: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    overflow: 'hidden',
  },
  headerGradient: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonResult: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray[100],
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  wordDisplayContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    alignItems: 'center',
  },
  wordBadge: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  wordBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  wordBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  wordCard: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  wordCardGradient: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  wordText: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.gray[900],
    marginBottom: 8,
    textAlign: 'center',
  },
  phoneticText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  detailsContainer: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: COLORS.gray[50],
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  detailIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailIconGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.gray[700],
  },
  detailText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray[600],
    lineHeight: 22,
  },
  listenButton: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  listenGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  listenText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  recordingSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
    backgroundColor: COLORS.gray[50],
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[100],
  },
  recordingTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.gray[900],
    marginBottom: 8,
  },
  recordingSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  processingContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 20,
  },
  processingGradient: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 16,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    textAlign: 'center',
  },
  processingSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  recordButtonContainer: {
    marginVertical: 20,
  },
  recordButton: {
    width: 140,
    height: 140,
    borderRadius: 70,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  recordButtonGradient: {
    flex: 1,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  recordingRipple: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  ripple1: {
    transform: [{ scale: 1.2 }],
    opacity: 0.6,
  },
  ripple2: {
    transform: [{ scale: 1.4 }],
    opacity: 0.4,
  },
  ripple3: {
    transform: [{ scale: 1.6 }],
    opacity: 0.2,
  },
  recordIconWrapper: {
    zIndex: 1,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
  },
  recordingTime: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.error,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 100,
    gap: 3,
    marginVertical: 16,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: COLORS.error,
  },
  recordingHint: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[500],
    marginTop: 12,
  },
  resultContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  resultIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.gray[900],
    textAlign: 'center',
    marginBottom: 16,
  },
  xpBadge: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  xpBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  xpText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  accuracyRingContainer: {
    marginVertical: 24,
  },
  ringWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringBackground: {
    borderRadius: 80,
    overflow: 'hidden',
  },
  progressRing: {
    position: 'absolute',
    borderRadius: 80,
  },
  ringGradientWrapper: {
    flex: 1,
    borderRadius: 80,
    overflow: 'hidden',
  },
  ringGradient: {
    flex: 1,
  },
  ringCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  accuracyPercentage: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.gray[900],
  },
  accuracyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray[600],
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
    width: '100%',
  },
  statCard: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  statCardGradient: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.white,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  feedbackCard: {
    width: '100%',
    backgroundColor: COLORS.gray[50],
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.gray[100],
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray[800],
  },
  feedbackText: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.gray[600],
    lineHeight: 22,
  },
  actionButtons: {
    width: '100%',
    gap: 12,
  },
  tryAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
    gap: 10,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  continueButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 10,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
