import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import axios from 'axios';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://192.168.14.34:5050'; 

interface PronunciationFeedback {
  accuracy: number;
  fluency_score: number;
  mispronounced_words: string[];
  partial_words: string[];
  correct_words: string[];
  suggestions: string[];
  per: number;
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  transcription?: string;
  feedback?: PronunciationFeedback;
  isVoiceMessage?: boolean;
}

export default function CoachScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hey there! 👋 I'm your AI pronunciation coach. Ready to level up your speaking skills? Just hold the mic button and start talking - I'll give you real-time feedback!",
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [latestFeedback, setLatestFeedback] = useState<PronunciationFeedback | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const micScaleAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const feedbackOverlayAnim = useRef(new Animated.Value(0)).current;
  const durationInterval = useRef<number | null>(null);

  useEffect(() => {
    setupAudio();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    // Animate the welcome message immediately when component mounts
    const welcomeAnimation = getMessageAnimation('1');
    Animated.parallel([
      Animated.timing(welcomeAnimation.opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(welcomeAnimation.translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Ripple effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(rippleAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
    }
  }, [isRecording]);

  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const messageAnimations = useRef(new Map()).current;

  const getMessageAnimation = (id: string) => {
    if (!messageAnimations.has(id)) {
      messageAnimations.set(id, {
        opacity: new Animated.Value(0),
        translateY: new Animated.Value(20),
      });
    }
    return messageAnimations.get(id);
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is needed for voice chat.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Mic button scale animation
      Animated.spring(micScaleAnim, {
        toValue: 0.9,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Reset mic button scale
      Animated.spring(micScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();

      if (uri && recordingDuration >= 1) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await processVoiceMessage(uri);
      } else if (recordingDuration < 1) {
        Alert.alert('Too Short', 'Please speak for at least 1 second');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const processVoiceMessage = async (audioUri: string) => {
    setIsProcessing(true);

    try {
      console.log('📤 Sending audio to AI Coach...');
      
      const formData = new FormData();
      formData.append('audio_file', {
        uri: Platform.OS === 'ios' ? audioUri : `file://${audioUri}`,
        type: 'audio/wav',
        name: 'voice_message.wav',
      } as any);

      const response = await axios.post(`${API_BASE_URL}/chat_with_coach`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      if (response.data.success) {
        console.log('✅ Coach response received');
        
        const { transcription, ai_response, pronunciation_feedback } = response.data;
        
        // Add user message with feedback attached
        const userMessage: Message = {
          id: Date.now().toString(),
          text: transcription,
          sender: 'user',
          timestamp: new Date(),
          isVoiceMessage: true,
          transcription: transcription,
          feedback: pronunciation_feedback,
        };
        
        setMessages(prev => [...prev, userMessage]);
        scrollViewRef.current?.scrollToEnd({ animated: true });

        // Add AI response WITHOUT feedback display
        setTimeout(() => {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            text: ai_response,
            sender: 'ai',
            timestamp: new Date(),
          };
          
          setMessages(prev => [...prev, aiMessage]);
          scrollViewRef.current?.scrollToEnd({ animated: true });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 600);
        
      } else {
        throw new Error(response.data.error || 'Failed to process');
      }
    } catch (error: any) {
      console.error('❌ Processing failed:', error);
      
      let errorMessage = 'Failed to process your message';
      if (error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getFeedbackColor = (score: number): string => {
    if (score >= 85) return '#10B981';
    if (score >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getFeedbackGradient = (score: number): readonly [string, string] => {
    if (score >= 85) return ['#10B981', '#059669'] as const;
    if (score >= 70) return ['#F59E0B', '#D97706'] as const;
    return ['#EF4444', '#DC2626'] as const;
  };

  const handleAnalyzeClick = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.feedback) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Show feedback overlay for this specific message
      setLatestFeedback(message.feedback);
      setShowFeedbackOverlay(true);
      
      Animated.spring(feedbackOverlayAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }).start();
      
      // Auto-hide overlay after 8 seconds (longer for review)
      setTimeout(() => {
        Animated.timing(feedbackOverlayAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowFeedbackOverlay(false);
          setLatestFeedback(null);
        });
      }, 8000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Animated Background */}
      <LinearGradient
        colors={['#667EEA', '#764BA2', '#F093FB']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.backgroundGradient}
      />

      {/* Header */}
      <BlurView intensity={95} tint="light" style={styles.headerBlur}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.coachAvatarContainer}>
              <LinearGradient
                colors={['#667EEA', '#764BA2']}
                style={styles.coachAvatar}
              >
                <Icon name="psychology" size={28} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.onlineIndicator} />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>AI Coach</Text>
              <View style={styles.statusContainer}>
                <View style={styles.pulsingDot} />
                <Text style={styles.statusText}>Active now</Text>
              </View>
            </View>
          </View>
        </View>
      </BlurView>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((message, index) => {
          const animation = getMessageAnimation(message.id);
          return(
            <Animated.View 
              key={message.id} 
              style={[
                styles.messageWrapper,
                {
                  opacity: animation.opacity,
                  transform: [{ translateY: animation.translateY }]
                }
              ]}
              onLayout={() => {
                // Fix the animation here too - use the correct animation values
                Animated.parallel([
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
                ]).start();
              }}
            >
              {message.sender === 'ai' ? (
                <View style={styles.aiMessageContainer}>
                  <View style={styles.aiAvatarSmall}>
                    <LinearGradient
                      colors={['#667EEA', '#764BA2']}
                      style={styles.aiAvatarSmallGradient}
                    >
                      <Icon name="psychology" size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                  <View style={styles.aiMessageBubbleContainer}>
                    <View style={styles.aiMessageBubble}>
                      <Text style={styles.aiMessageText}>{message.text}</Text>
                    </View>
                    <Text style={styles.timestamp}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ) : (
                <View style={styles.userMessageContainer}>
                  <View style={styles.userMessageBubbleContainer}>
                    <LinearGradient
                      colors={['#667EEA', '#764BA2']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.userMessageBubble}
                    >
                      <Text style={styles.userMessageText}>{message.text}</Text>
                      {message.isVoiceMessage && (
                        <View style={styles.voiceIndicator}>
                          <Icon name="graphic-eq" size={14} color="rgba(255,255,255,0.9)" />
                          <Text style={styles.voiceText}>Voice</Text>
                        </View>
                      )}
                    </LinearGradient>
                    
                    {/* Analyze Button Overlay - Always visible for voice messages */}
                    {message.isVoiceMessage && message.feedback && (
                      <TouchableOpacity
                        style={styles.analyzeButton}
                        onPress={() => handleAnalyzeClick(message.id)}
                        activeOpacity={0.9}
                      >
                        <LinearGradient
                          colors={['#F59E0B', '#D97706']}
                          style={styles.analyzeButtonGradient}
                        >
                          <Icon name="analytics" size={18} color="#FFFFFF" />
                          <Text style={styles.analyzeButtonText}>Analyze</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                    
                    <Text style={styles.timestampUser}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              )}
            </Animated.View>
          );
        })};

        {isProcessing && (
          <View style={styles.typingIndicatorContainer}>
            <View style={styles.typingIndicator}>
              <View style={styles.typingDot} />
              <View style={[styles.typingDot, styles.typingDotDelay1]} />
              <View style={[styles.typingDot, styles.typingDotDelay2]} />
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Feedback Overlay */}
      {showFeedbackOverlay && latestFeedback && (
        <Animated.View
          style={[
            styles.feedbackOverlay,
            {
              opacity: feedbackOverlayAnim,
              transform: [{
                translateY: feedbackOverlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              }],
            }
          ]}
        >
          <BlurView intensity={95} tint="light" style={styles.feedbackOverlayBlur}>
            <TouchableOpacity
              style={styles.feedbackOverlayContent}
              onPress={() => {
                Animated.timing(feedbackOverlayAnim, {
                  toValue: 0,
                  duration: 250,
                  useNativeDriver: true,
                }).start(() => {
                  setShowFeedbackOverlay(false);
                  setLatestFeedback(null);
                });
              }}
              activeOpacity={0.95}
            >
              <View style={styles.feedbackOverlayHeader}>
                <LinearGradient
                  colors={
                    latestFeedback.accuracy >= 85
                      ? ['#10B981', '#059669'] as const
                      : latestFeedback.accuracy >= 70
                      ? ['#F59E0B', '#D97706'] as const
                      : ['#EF4444', '#DC2626'] as const
                  }
                  style={styles.feedbackOverlayScoreBadge}
                >
                  <Icon name="stars" size={16} color="#FFFFFF" />
                  <Text style={styles.feedbackOverlayScoreText}>
                    {latestFeedback.accuracy.toFixed(0)}%
                  </Text>
                </LinearGradient>
                <Text style={styles.feedbackOverlayTitle}>Quick Analysis</Text>
                <TouchableOpacity
                  onPress={() => {
                    Animated.timing(feedbackOverlayAnim, {
                      toValue: 0,
                      duration: 250,
                      useNativeDriver: true,
                    }).start(() => {
                      setShowFeedbackOverlay(false);
                      setLatestFeedback(null);
                    });
                  }}
                  style={styles.feedbackOverlayClose}
                >
                  <Icon name="close" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <View style={styles.feedbackOverlayStats}>
                <View style={styles.feedbackOverlayStat}>
                  <Icon name="check-circle" size={18} color="#10B981" />
                  <Text style={styles.feedbackOverlayStatText}>
                    {latestFeedback.correct_words.length} correct
                  </Text>
                </View>
                {latestFeedback.mispronounced_words.length > 0 && (
                  <View style={styles.feedbackOverlayStat}>
                    <Icon name="warning" size={18} color="#EF4444" />
                    <Text style={styles.feedbackOverlayStatText}>
                      {latestFeedback.mispronounced_words.length} to practice
                    </Text>
                  </View>
                )}
              </View>

              {latestFeedback.mispronounced_words.length > 0 && (
                <View style={styles.feedbackOverlayWords}>
                  {latestFeedback.mispronounced_words.slice(0, 3).map((word, idx) => (
                    <View key={idx} style={styles.feedbackOverlayWordChip}>
                      <Text style={styles.feedbackOverlayWordText}>{word}</Text>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.feedbackOverlayHint}>Tap to dismiss</Text>
            </TouchableOpacity>
          </BlurView>
        </Animated.View>
      )}

      {/* Input Area with Glassmorphism */}
      <BlurView intensity={100} tint="light" style={styles.inputBlur}>
        <View style={styles.inputContainer}>
          {isRecording ? (
            <View style={styles.recordingUI}>
              {/* Ripple Effect */}
              <Animated.View 
                style={[
                  styles.ripple,
                  {
                    opacity: rippleAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.7, 0],
                    }),
                    transform: [{
                      scale: rippleAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                    }],
                  }
                ]}
              />

              {/* Recording Info */}
              <View style={styles.recordingInfo}>
                <View style={styles.recordingDotContainer}>
                  <View style={styles.recordingDotPulse} />
                  <View style={styles.recordingDot} />
                </View>
                <Text style={styles.recordingDuration}>{formatDuration(recordingDuration)}</Text>
              </View>

              {/* Stop Button */}
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  onPress={stopRecording}
                  style={styles.stopButtonContainer}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#EF4444', '#DC2626']}
                    style={styles.stopButton}
                  >
                    <Icon name="stop" size={32} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>

              <Text style={styles.recordingHint}>Release to send</Text>
            </View>
          ) : (
            <View style={styles.idleUI}>
              {/* Hint Text Above */}
              <Text style={styles.inputHint}>
                {isProcessing ? '🤔 Analyzing your speech...' : ' '}
              </Text>
              
              {/* Mic Button and Text Side by Side */}
              <View style={styles.micRow}>
                <Animated.View style={{ transform: [{ scale: micScaleAnim }] }}>
                  <TouchableOpacity
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    style={styles.micButtonContainer}
                    activeOpacity={0.9}
                    disabled={isProcessing}
                  >
                    <LinearGradient
                      colors={isProcessing ? ['#9CA3AF', '#6B7280'] : ['#667EEA', '#764BA2']}
                      style={styles.micButton}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="large" color="#FFFFFF" />
                      ) : (
                        <>
                          <Icon name="mic" size={36} color="#FFFFFF" />
                          <View style={styles.micPulse} />
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>

                {/* Side Text */}
                <View style={styles.micTextContainer}>
                  <Text style={styles.micMainText}>Hold to Record</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    opacity: 0.15,
  },
  headerBlur: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 12,
    borderBottomWidth: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coachAvatarContainer: {
    position: 'relative',
  },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerTextContainer: {
    marginLeft: 14,
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 10,
  },
  messageWrapper: {
    marginBottom: 16,
  },
  aiMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '85%',
  },
  aiAvatarSmall: {
    marginTop: 4,
    marginRight: 10,
  },
  aiAvatarSmallGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  aiMessageBubbleContainer: {
    flex: 1,
  },
  idleUI: {
    alignItems: 'center',
    gap: 16,
  },
  inputHint: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  micRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  micButtonContainer: {
    position: 'relative',
  },
  micButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  micPulse: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#667EEA',
    opacity: 0.15,
  },
  micTextContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  micMainText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1F2937',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  micSubText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  footerHint: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  aiMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderTopLeftRadius: 6,
    padding: 18,
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(102, 126, 234, 0.1)',
  },
  aiMessageText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  feedbackContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  scoresContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  scoreCardWrapper: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  scoreCardGradient: {
    padding: 16,
    alignItems: 'center',
  },
  scoreCardValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -1.5,
  },
  scoreCardLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  wordsSection: {
    marginBottom: 14,
  },
  wordsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  wordsSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1F2937',
    marginLeft: 6,
    letterSpacing: -0.2,
  },
  wordsChipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1.5,
  },
  wordChipError: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  wordChipTextError: {
    fontSize: 14,
    fontWeight: '800',
    color: '#DC2626',
  },
  wordChipWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  wordChipTextWarning: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D97706',
  },
  wordChipSuccess: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  wordChipTextSuccess: {
    fontSize: 14,
    fontWeight: '800',
    color: '#059669',
  },
  tipsContainer: {
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#667EEA',
    borderWidth: 1.5,
    borderColor: 'rgba(102, 126, 234, 0.2)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#667EEA',
    marginLeft: 6,
    letterSpacing: -0.2,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  tipBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#667EEA',
    marginTop: 6,
    marginRight: 10,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    fontWeight: '600',
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userMessageBubbleContainer: {
    maxWidth: '80%',
  },
  userMessageBubble: {
    borderRadius: 24,
    borderTopRightRadius: 6,
    padding: 18,
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  userMessageText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    gap: 6,
  },
  voiceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  timestampUser: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 6,
    fontWeight: '600',
    textAlign: 'right',
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667EEA',
    opacity: 0.5,
  },
  typingDotDelay1: {
    opacity: 0.7,
  },
  typingDotDelay2: {
    opacity: 1,
  },
  inputBlur: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  recordingUI: {
    alignItems: 'center',
    gap: 14,
  },
  ripple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#667EEA',
    top: '30%',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  recordingDotContainer: {
    position: 'relative',
    width: 16,
    height: 16,
  },
  recordingDotPulse: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    opacity: 0.3,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    margin: 2,
  },
  recordingDuration: {
    fontSize: 20,
    fontWeight: '900',
    color: '#EF4444',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  stopButtonContainer: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  stopButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  recordingHint: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  feedbackOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 140 : 120,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  feedbackOverlayBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#667EEA',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  feedbackOverlayContent: {
    padding: 20,
  },
  feedbackOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  feedbackOverlayScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  feedbackOverlayScoreText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  feedbackOverlayTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  feedbackOverlayClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackOverlayStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 14,
  },
  feedbackOverlayStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(249, 250, 251, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  feedbackOverlayStatText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  feedbackOverlayWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  feedbackOverlayWordChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  feedbackOverlayWordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  feedbackOverlayHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  analyzeButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  analyzeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  analyzeButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});