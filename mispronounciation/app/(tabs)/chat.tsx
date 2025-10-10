import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  feedback?: {
    grammar: string[];
    pronunciation: string[];
    suggestions: string[];
  };
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hi! I'm your AI pronunciation coach. Start a voice conversation with me to practice your speaking skills. I'll analyze your pronunciation and grammar in real-time! 🎙️",
      sender: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const startVoiceChat = () => {
    setIsRecording(true);
    // Implement voice recording logic here
  };

  const stopVoiceChat = () => {
    setIsRecording(false);
    setIsAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      const userMessage: Message = {
        id: Date.now().toString(),
        text: "I was trying to say: 'The weather is beautiful today'",
        sender: 'user',
        timestamp: new Date(),
      };
      
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: "Great effort! Let me help you improve:",
        sender: 'ai',
        timestamp: new Date(),
        feedback: {
          grammar: ["✅ Perfect sentence structure!"],
          pronunciation: [
            "⚠️ 'weather' - Pay attention to the 'th' sound",
            "✅ 'beautiful' - Excellent pronunciation!",
            "⚠️ 'today' - Stress on first syllable: TO-day"
          ],
          suggestions: [
            "Practice the 'th' sound by placing your tongue between your teeth",
            "Record yourself and compare with native speakers"
          ]
        }
      };
      
      setMessages(prev => [...prev, userMessage, aiResponse]);
      setIsAnalyzing(false);
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 2000);
  };

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText,
        sender: 'user',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, newMessage]);
      setInputText('');
      
      // Simulate AI response
      setTimeout(() => {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          text: "I can help you better with voice! Tap the microphone to start a voice conversation. 🎤",
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 1000);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.aiAvatar}>
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.avatarGradient}
            >
              <Icon name="smart-toy" size={28} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>AI Coach</Text>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Online</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((message) => (
          <View key={message.id} style={styles.messageWrapper}>
            {message.sender === 'ai' && (
              <View style={styles.aiMessageContainer}>
                <View style={styles.aiMessageBubble}>
                  <Text style={styles.aiMessageText}>{message.text}</Text>
                  
                  {message.feedback && (
                    <View style={styles.feedbackContainer}>
                      {/* Grammar Feedback */}
                      <View style={styles.feedbackSection}>
                        <View style={styles.feedbackHeader}>
                          <Icon name="check-circle" size={18} color="#10B981" />
                          <Text style={styles.feedbackTitle}>Grammar</Text>
                        </View>
                        {message.feedback.grammar.map((item, index) => (
                          <Text key={index} style={styles.feedbackItem}>{item}</Text>
                        ))}
                      </View>

                      {/* Pronunciation Feedback */}
                      <View style={styles.feedbackSection}>
                        <View style={styles.feedbackHeader}>
                          <Icon name="mic" size={18} color="#6366F1" />
                          <Text style={styles.feedbackTitle}>Pronunciation</Text>
                        </View>
                        {message.feedback.pronunciation.map((item, index) => (
                          <Text key={index} style={styles.feedbackItem}>{item}</Text>
                        ))}
                      </View>

                      {/* Suggestions */}
                      <View style={styles.feedbackSection}>
                        <View style={styles.feedbackHeader}>
                          <Icon name="lightbulb" size={18} color="#F59E0B" />
                          <Text style={styles.feedbackTitle}>Suggestions</Text>
                        </View>
                        {message.feedback.suggestions.map((item, index) => (
                          <Text key={index} style={styles.feedbackItem}>• {item}</Text>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.timestamp}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}

            {message.sender === 'user' && (
              <View style={styles.userMessageContainer}>
                <View style={styles.userMessageBubble}>
                  <Text style={styles.userMessageText}>{message.text}</Text>
                </View>
                <Text style={styles.timestamp}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          </View>
        ))}

        {isAnalyzing && (
          <View style={styles.analyzingContainer}>
            <View style={styles.analyzingBubble}>
              <Text style={styles.analyzingText}>Analyzing your speech...</Text>
              <View style={styles.dotsContainer}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Section */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputSection}
      >
        {/* Voice Recording Button */}
        {!isRecording ? (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="#9CA3AF"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            {inputText.trim() ? (
              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Icon name="send" size={24} color="#6366F1" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={startVoiceChat} style={styles.voiceButton}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6']}
                  style={styles.voiceGradient}
                >
                  <Icon name="mic" size={28} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity onPress={stopVoiceChat} style={styles.recordingContainer}>
            <View style={styles.recordingPulse}>
              <View style={styles.recordingButton}>
                <Icon name="stop" size={32} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.recordingText}>Tap to stop recording</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FE',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatar: {
    marginRight: 14,
  },
  avatarGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 10,
  },
  messageWrapper: {
    marginBottom: 20,
  },
  aiMessageContainer: {
    alignItems: 'flex-start',
  },
  aiMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    padding: 16,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  aiMessageText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
    lineHeight: 24,
  },
  userMessageContainer: {
    alignItems: 'flex-end',
  },
  userMessageBubble: {
    backgroundColor: '#6366F1',
    borderRadius: 20,
    borderTopRightRadius: 6,
    padding: 16,
    maxWidth: '85%',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  userMessageText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    lineHeight: 24,
  },
  timestamp: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    fontWeight: '500',
  },
  feedbackContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  feedbackSection: {
    marginBottom: 12,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginLeft: 8,
  },
  feedbackItem: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 22,
    marginLeft: 26,
  },
  analyzingContainer: {
    alignItems: 'flex-start',
  },
  analyzingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 16,
  },
  analyzingText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
    marginRight: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  dot1: {},
  dot2: {},
  dot3: {},
  inputSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  voiceButton: {
    marginLeft: 8,
  },
  voiceGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  recordingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordingPulse: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
