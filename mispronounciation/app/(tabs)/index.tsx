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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';

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
];

export default function PronunciationApp() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showHint, setShowHint] = useState(false);
  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const currentWord = wordList[currentWordIndex];

  useEffect(() => {
    // Animate word slide when changing
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [currentWordIndex]);

  const checkPronunciation = (spokenText: string) => {
    const targetWord = currentWord.word.toLowerCase();
    const similarity = calculateSimilarity(spokenText, targetWord);
    
    setTotalAttempts(prev => prev + 1);
    
    if (similarity >= 0.7) {
      setIsCorrect(true);
      setScore(prev => prev + 1);
      Alert.alert(
        'Excellent! 🎉',
        `You pronounced "${currentWord.word}" correctly!`,
        [{ text: 'Next Word', onPress: nextWord }]
      );
    } else {
      setIsCorrect(false);
      Alert.alert(
        'Try Again',
        `You said: "${spokenText}"\nCorrect: "${currentWord.word}"\n\nWould you like to hear the correct pronunciation?`,
        [
          { text: 'Skip', onPress: nextWord },
          { text: 'Hear It', onPress: playCorrectPronunciation },
        ]
      );
    }
  };

  const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
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

  const startListening = async () => {
    try {
      setIsListening(true);
      setSpokenText('');
      setIsCorrect(null);
      
      // Simulate speech recognition for demo
      setTimeout(() => {
        const mockSpokenText = prompt('Enter what you said (for demo):') || '';
        setSpokenText(mockSpokenText);
        checkPronunciation(mockSpokenText);
        setIsListening(false);
      }, 2000);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      Alert.alert('Error', 'Could not start speech recognition');
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    setIsListening(false);
  };

  const playCorrectPronunciation = async () => {
    setIsPlayingAudio(true);
    try {
      await Speech.speak(currentWord.word, {
        language: 'en-US',
        pitch: 1.0,
        rate: 0.8,
      });
    } catch (error) {
      console.error('Error playing audio:', error);
    } finally {
      setIsPlayingAudio(false);
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
        <Text style={styles.title}>Pronunciation Practice</Text>
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
                💡 Tip: Break it down into syllables and practice slowly
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
            isListening && styles.recording,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.recordButtonInner}
            onPress={isListening ? stopListening : startListening}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isListening ? "stop" : "mic"}
              size={40}
              color="white"
            />
          </TouchableOpacity>
        </Animated.View>
        
        <Text style={styles.recordButtonText}>
          {isListening ? "Tap to Stop" : "Tap to Speak"}
        </Text>
      </View>

      {spokenText && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultLabel}>You said:</Text>
          <Text style={styles.spokenText}>{spokenText}</Text>
          {isCorrect !== null && (
            <View style={[styles.feedbackContainer, isCorrect ? styles.correct : styles.incorrect]}>
              <Ionicons
                name={isCorrect ? "checkmark-circle" : "close-circle"}
                size={24}
                color={isCorrect ? "#4CAF50" : "#F44336"}
              />
              <Text style={styles.feedbackText}>
                {isCorrect ? "Correct!" : "Try again"}
              </Text>
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
    width: 100,
    height: 100,
    borderRadius: 50,
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
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
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
    marginBottom: 8,
  },
  spokenText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '500',
    marginBottom: 15,
  },
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
    fontWeight: '500',
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
