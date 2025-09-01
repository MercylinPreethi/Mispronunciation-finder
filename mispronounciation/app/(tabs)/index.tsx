import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const { width } = Dimensions.get('window');

interface WordData {
  word: string;
  phonetic: string;
  definition: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const wordList: WordData[] = [
  {
    word: 'pronunciation',
    phonetic: '/prəˌnʌnsiˈeɪʃən/',
    definition: 'The way in which a word is pronounced',
    difficulty: 'hard',
  },
  {
    word: 'mischievous',
    phonetic: '/ˈmɪstʃɪvəs/',
    definition: 'Causing or showing a fondness for causing trouble in a playful way',
    difficulty: 'medium',
  },
  {
    word: 'nuclear',
    phonetic: '/ˈnjuːkliər/',
    definition: 'Relating to the nucleus of an atom',
    difficulty: 'medium',
  },
  {
    word: 'library',
    phonetic: '/ˈlaɪbrəri/',
    definition: 'A building or room containing collections of books',
    difficulty: 'easy',
  },
  {
    word: 'February',
    phonetic: '/ˈfebruəri/',
    definition: 'The second month of the year',
    difficulty: 'medium',
  },
  {
    word: 'comfortable',
    phonetic: '/ˈkʌmftəbəl/',
    definition: 'Giving a feeling of physical ease and relaxation',
    difficulty: 'medium',
  },
  {
    word: 'vegetable',
    phonetic: '/ˈvedʒtəbəl/',
    definition: 'A plant or part of a plant used as food',
    difficulty: 'easy',
  },
  {
    word: 'Wednesday',
    phonetic: '/ˈwenzdeɪ/',
    definition: 'The day of the week before Thursday',
    difficulty: 'medium',
  },
];

// Google Cloud Speech-to-Text API key
const GOOGLE_CLOUD_API_KEY = 'AIzaSyDT8-_mm8MtKn5839PJjOxu4WbMwWm9cNI';

export default function PronunciationApp() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const currentWord = wordList[currentWordIndex];

  useEffect(() => {
    setupAudio();
    // Animate word slide when changing
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [currentWordIndex]);

  const setupAudio = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        console.log('Requesting permission..');
        await requestPermission();
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Failed to setup audio:', error);
    }
  };

  const transcribeAudioWithGoogle = async (audioUri: string): Promise<string> => {
    try {
      // Read audio file and convert to base64
      const audioData = await FileSystem.readAsStringAsync(audioUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const requestBody = {
        config: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          languageCode: 'en-US',
          enableAutomaticPunctuation: false,
        },
        audio: {
          content: audioData,
        },
      };

      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_CLOUD_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google Cloud API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Google Cloud API response:', result);
      
      return result.results?.[0]?.alternatives?.[0]?.transcript || '';
    } catch (error) {
      console.error('Google Speech API error:', error);
      throw error;
    }
  };

  const checkPronunciation = (spokenText: string) => {
    const targetWord = currentWord.word.toLowerCase();
    const spokenLower = spokenText.toLowerCase().trim();
    const similarity = calculateSimilarity(spokenLower, targetWord);
    
    setTotalAttempts(prev => prev + 1);
    setSpokenText(spokenText);
    
    if (similarity >= 0.8) {
      setIsCorrect(true);
      setScore(prev => prev + 1);
      
      // Automatic success feedback
      setTimeout(() => {
        playSuccessSound();
      }, 500);
      
    } else if (similarity >= 0.6) {
      setIsCorrect(false);
      
      // Automatic "close" feedback with correction
      setTimeout(() => {
        playCorrectPronunciation();
      }, 1000);
      
    } else {
      setIsCorrect(false);
      
      // Automatic correction for poor pronunciation
      setTimeout(() => {
        playCorrectPronunciation();
      }, 1000);
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Enhanced similarity calculation with phonetic matching
    if (str1 === str2) return 1.0;
    
    // Remove common filler words and normalize
    const cleanStr1 = str1.replace(/\b(the|a|an|um|uh)\b/g, '').trim();
    const cleanStr2 = str2.replace(/\b(the|a|an|um|uh)\b/g, '').trim();
    
    // Check for common phonetic substitutions
    const phoneticsMap: { [key: string]: string[] } = {
      'f': ['ph', 'gh'],
      'k': ['c', 'ch', 'ck'],
      's': ['c', 'sc', 'z'],
      'z': ['s'],
      'j': ['g'],
      'i': ['y'],
      'er': ['ur', 'or', 'ar'],
      'ay': ['ai', 'ey', 'a'],
      'sh': ['ti', 'ci', 'si'],
    };

    let normalizedStr1 = cleanStr1;
    let normalizedStr2 = cleanStr2;

    // Apply phonetic normalizations
    Object.keys(phoneticsMap).forEach(sound => {
      phoneticsMap[sound].forEach(variant => {
        const regex = new RegExp(variant, 'gi');
        normalizedStr1 = normalizedStr1.replace(regex, sound);
        normalizedStr2 = normalizedStr2.replace(regex, sound);
      });
    });

    const longer = normalizedStr1.length > normalizedStr2.length ? normalizedStr1 : normalizedStr2;
    const shorter = normalizedStr1.length > normalizedStr2.length ? normalizedStr2 : normalizedStr1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    const baseSimilarity = (longer.length - editDistance) / longer.length;
    
    // Bonus for getting the first few letters right (important for pronunciation)
    const prefixMatch = Math.min(cleanStr1.length, cleanStr2.length);
    let prefixBonus = 0;
    for (let i = 0; i < prefixMatch && i < 3; i++) {
      if (cleanStr1[i] === cleanStr2[i]) {
        prefixBonus += 0.05;
      }
    }
    
    // Bonus for similar length
    const lengthDiff = Math.abs(cleanStr1.length - cleanStr2.length);
    const lengthBonus = lengthDiff <= 2 ? 0.1 : 0;
    
    return Math.min(1.0, baseSimilarity + prefixBonus + lengthBonus);
  };

  const levenshteinDistance = (str1: string, str2: string): number => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  const startRecording = async () => {
    try {
      if (permissionResponse?.status !== 'granted') {
        const permission = await requestPermission();
        if (permission.status !== 'granted') {
          Alert.alert('Permission needed', 'Microphone permission is required for speech recognition');
          return;
        }
      }

      setIsListening(true);
      setSpokenText('');
      setIsCorrect(null);
      setIsProcessing(false);

      // Start pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
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

      console.log('Starting recording..');
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);

      // Auto-stop after 4 seconds for better recognition
      setTimeout(() => {
        if (recording && isListening) {
          stopRecording();
        }
      }, 4000);

    } catch (err) {
      console.error('Failed to start recording', err);
      setIsListening(false);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsListening(false);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    setIsProcessing(true);
    
    console.log('Stopping recording..');
    setRecording(null);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    
    const uri = recording.getURI();
    console.log('Recording stopped and stored at', uri);

    if (uri) {
      await processAudioForSpeech(uri);
    }
  };

  const processAudioForSpeech = async (uri: string) => {
    try {
      setSpokenText('Processing your speech...');
      
      // Check if Google Cloud API key is configured
      if (!GOOGLE_CLOUD_API_KEY  || GOOGLE_CLOUD_API_KEY.length < 30) {
        Alert.alert(
          'API Key Required',
          'To use speech recognition, please add your Google Cloud API key in the code.',
          [
            { text: 'OK', onPress: () => {
              setIsProcessing(false);
              setSpokenText('');
            }}
          ]
        );
        return;
      }

      const recognizedText = await transcribeAudioWithGoogle(uri);
      
      console.log('Recognized text:', recognizedText);
      
      if (recognizedText.trim()) {
        checkPronunciation(recognizedText.trim());
      } else {
        setSpokenText('No speech detected. Please try again.');
      }
      
    } catch (error) {
      console.error('Speech recognition error:', error);
      setSpokenText('Speech recognition failed. Please try again.');
      Alert.alert(
        'Recognition Error',
        'Could not process your speech. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const playSuccessSound = async () => {
    try {
      await Speech.speak("Excellent! Perfect pronunciation!", {
        language: 'en-US',
        pitch: 1.2,
        rate: 0.8,
      });
    } catch (error) {
      console.error('Error playing success sound:', error);
    }
  };

  const playCorrectPronunciation = async () => {
    setIsPlayingAudio(true);
    try {
      // First, give feedback about what they said vs. what's correct
      if (spokenText && spokenText !== 'Processing your speech...' && !spokenText.includes('failed')) {
        await Speech.speak(`You said ${spokenText}. The correct pronunciation is:`, {
          language: 'en-US',
          pitch: 1.0,
          rate: 0.7,
        });
        
        // Small pause
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Then say the correct word
      await Speech.speak(currentWord.word, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.6, // Slower for learning
      });
      
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setTimeout(() => setIsPlayingAudio(false), 3000);
    }
  };

  const nextWord = () => {
    setCurrentWordIndex(prev => (prev + 1) % wordList.length);
    setSpokenText('');
    setIsCorrect(null);
    setShowHint(false);
    slideAnim.setValue(0);
  };

  const previousWord = () => {
    setCurrentWordIndex(prev => (prev - 1 + wordList.length) % wordList.length);
    setSpokenText('');
    setIsCorrect(null);
    setShowHint(false);
    slideAnim.setValue(0);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#666';
    }
  };

  const accuracy = totalAttempts > 0 ? Math.round((score / totalAttempts) * 100) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>🎤 Real Pronunciation Practice</Text>
        <View style={styles.statsContainer}>
          <Text style={styles.statsText}>Score: {score}/{totalAttempts}</Text>
          <Text style={styles.statsText}>Accuracy: {accuracy}%</Text>
        </View>
      </View>

      <View style={styles.wordContainer}>
        <Animated.View
          style={[
            styles.wordCard,
            {
              transform: [
                {
                  translateX: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [width, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.wordHeader}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
            <View
              style={[
                styles.difficultyBadge,
                { backgroundColor: getDifficultyColor(currentWord.difficulty) },
              ]}
            >
              <Text style={styles.difficultyText}>{currentWord.difficulty}</Text>
            </View>
          </View>
          
          <Text style={styles.phoneticText}>{currentWord.phonetic}</Text>
          <Text style={styles.definitionText}>{currentWord.definition}</Text>
          
          {showHint && (
            <View style={styles.hintContainer}>
              <Text style={styles.hintText}>
                💡 Tip: Listen carefully to the pronunciation, then speak clearly into the microphone. The AI will analyze your pronunciation and give real-time feedback!
              </Text>
            </View>
          )}
        </Animated.View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.hintButton}
          onPress={() => setShowHint(!showHint)}
        >
          <Ionicons name="bulb-outline" size={24} color="#666" />
          <Text style={styles.hintButtonText}>Hint</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.audioButton}
          onPress={playCorrectPronunciation}
          disabled={isPlayingAudio}
        >
          <Ionicons
            name={isPlayingAudio ? "volume-high" : "volume-high-outline"}
            size={24}
            color={isPlayingAudio ? "#4CAF50" : "#666"}
          />
          <Text style={styles.audioButtonText}>
            {isPlayingAudio ? "Playing..." : "Hear It"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.recordingContainer}>
        <Animated.View
          style={[
            styles.recordButton,
            (isListening || isProcessing) && styles.recording,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.recordButtonInner}
            onPress={isListening ? stopRecording : startRecording}
            activeOpacity={0.8}
            disabled={isProcessing}
          >
            <Ionicons
              name={isListening ? "stop" : isProcessing ? "sync" : "mic"}
              size={40}
              color="white"
            />
          </TouchableOpacity>
        </Animated.View>
        
        <Text style={styles.recordButtonText}>
          {isListening ? "Listening... Tap to Stop" : isProcessing ? "Processing..." : "Tap to Speak"}
        </Text>
        <Text style={styles.infoText}>
          {isListening ? "Speak clearly: " + currentWord.word : 
           isProcessing ? "Analyzing your pronunciation..." :
           "AI speech recognition powered by Google Cloud"}
        </Text>
      </View>

      {spokenText && !isProcessing && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>You said:</Text>
          <Text style={styles.spokenText}>"{spokenText}"</Text>
          <Text style={styles.targetLabel}>Target word:</Text>
          <Text style={styles.targetText}>"{currentWord.word}"</Text>
          {isCorrect !== null && (
            <View style={[styles.feedbackContainer, isCorrect ? styles.correct : styles.incorrect]}>
              <Ionicons
                name={isCorrect ? "checkmark-circle" : "close-circle"}
                size={24}
                color={isCorrect ? "#4CAF50" : "#F44336"}
              />
              <Text style={styles.feedbackText}>
                {isCorrect ? "Perfect! 🎉" : "Let's practice the correct pronunciation 💪"}
              </Text>
            </View>
          )}
          
          {isCorrect !== null && spokenText && !spokenText.includes('failed') && (
            <View style={styles.similarityContainer}>
              <Text style={styles.similarityText}>
                Similarity: {Math.round(calculateSimilarity(spokenText.toLowerCase().trim(), currentWord.word.toLowerCase()) * 100)}%
              </Text>
              {isCorrect && (
                <Text style={styles.encouragementText}>
                  Great job! Ready for the next word? 🚀
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <View style={styles.navigationContainer}>
        <TouchableOpacity style={styles.navButton} onPress={previousWord}>
          <Ionicons name="chevron-back" size={24} color="#666" />
          <Text style={styles.navButtonText}>Previous</Text>
        </TouchableOpacity>
        
        <Text style={styles.wordCounter}>
          {currentWordIndex + 1} / {wordList.length}
        </Text>
        
        <TouchableOpacity style={styles.navButton} onPress={nextWord}>
          <Text style={styles.navButtonText}>Next</Text>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      <View style={styles.apiNotice}>
        <Text style={styles.apiNoticeText}>
          🔊 Powered by Google Cloud Speech-to-Text API
        </Text>
      </View>
    </ScrollView>
  );
}



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 20,
  },
  statsText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  wordContainer: {
    marginBottom: 30,
  },
  apiNotice: {
    backgroundColor: '#FFF3E0',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  apiNoticeText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  wordCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  wordText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  difficultyText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  phoneticText: {
    fontSize: 18,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  definitionText: {
    fontSize: 16,
    color: '#444',
    lineHeight: 24,
  },
  hintContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#E3F2FD',
    borderRadius: 10,
  },
  hintText: {
    fontSize: 14,
    color: '#1976D2',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  hintButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  hintButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  audioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  audioButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  recording: {
    backgroundColor: '#F44336',
  },
  recordButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    marginTop: 15,
    fontSize: 18,
    color: '#333',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  infoText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  resultContainer: {
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 20,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  spokenText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    marginBottom: 15,
  },
  targetLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  targetText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 15,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
  },
  correct: {
    backgroundColor: '#E8F5E8',
  },
  incorrect: {
    backgroundColor: '#FFEBEE',
  },
  feedbackText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: 'bold',
  },
  similarityContainer: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  similarityText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  encouragementText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginTop: 5,
    textAlign: 'center',
  },
  navigationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  navButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  wordCounter: {
    fontSize: 16,
    color: '#333',
    fontWeight: 'bold',
  },
});