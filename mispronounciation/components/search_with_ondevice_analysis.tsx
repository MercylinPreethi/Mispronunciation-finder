import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { ref, onValue } from 'firebase/database';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import * as FileSystem from 'expo-file-system';
import { pronunciationAnalyzer, AnalysisResult } from './OnDevicePronunciationAnalyzer';

const { width } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();

interface Word {
  id: string;
  word: string;
  phonetic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: 'Vowels' | 'Consonants' | 'Difficult';
  accuracy: number;
  practiced: number;
}

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [words, setWords] = useState<Word[]>([]);
  const [filteredWords, setFilteredWords] = useState<Word[]>([]);
  
  // New state for on-device analysis
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPath, setRecordingPath] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<{ [wordId: string]: AnalysisResult }>({});
  const [selectedWord, setSelectedWord] = useState<Word | null>(null);

  const categories = ['All', 'Vowels', 'Consonants', 'Difficult'];

  // Initialize pronunciation analyzer on mount
  useEffect(() => {
    initializePronunciationAnalyzer();
  }, []);

  const initializePronunciationAnalyzer = async () => {
    try {
      const modelPath = `${FileSystem.documentDirectory}wav2vec2_model.onnx`;
      
      // Check if model exists
      const modelInfo = await FileSystem.getInfoAsync(modelPath);
      
      if (!modelInfo.exists) {
        console.log('📥 Model not found locally. Please ensure model is bundled with app.');
        // You could download the model here from your server
        // await downloadModel(modelPath);
        return;
      }

      await pronunciationAnalyzer.loadModel(modelPath);
      setIsModelLoaded(true);
      console.log('✅ Pronunciation analyzer ready');
    } catch (error) {
      console.error('❌ Failed to initialize analyzer:', error);
      Alert.alert('Warning', 'Pronunciation analysis is not available');
    }
  };

  useEffect(() => {
    // Sample words data - replace with Firebase fetch
    const sampleWords: Word[] = [
      { id: '1', word: 'Beautiful', phonetic: '/ˈbjuːtɪfəl/', difficulty: 'Medium', category: 'Vowels', accuracy: 85, practiced: 12 },
      { id: '2', word: 'Pronunciation', phonetic: '/prəˌnʌnsiˈeɪʃən/', difficulty: 'Hard', category: 'Consonants', accuracy: 72, practiced: 8 },
      { id: '3', word: 'Schedule', phonetic: '/ˈʃedjuːl/', difficulty: 'Hard', category: 'Difficult', accuracy: 68, practiced: 15 },
      { id: '4', word: 'Queue', phonetic: '/kjuː/', difficulty: 'Medium', category: 'Vowels', accuracy: 90, practiced: 6 },
      { id: '5', word: 'Algorithm', phonetic: '/ˈælɡərɪðəm/', difficulty: 'Hard', category: 'Consonants', accuracy: 75, practiced: 10 },
      { id: '6', word: 'Comfortable', phonetic: '/ˈkʌmftəbəl/', difficulty: 'Medium', category: 'Vowels', accuracy: 82, practiced: 9 },
      { id: '7', word: 'Rhythm', phonetic: '/ˈrɪðəm/', difficulty: 'Hard', category: 'Difficult', accuracy: 65, practiced: 14 },
      { id: '8', word: 'Develop', phonetic: '/dɪˈveləp/', difficulty: 'Easy', category: 'Vowels', accuracy: 95, practiced: 5 },
    ];
    
    setWords(sampleWords);
    setFilteredWords(sampleWords);
  }, []);

  useEffect(() => {
    let filtered = words;

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(word => word.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(word => 
        word.word.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredWords(filtered);
  }, [searchQuery, selectedCategory, words]);

  // ====================================================================
  // ON-DEVICE PRONUNCIATION ANALYSIS FUNCTIONS
  // ====================================================================

  const startRecording = async (word: Word) => {
    if (!isModelLoaded) {
      Alert.alert('Not Ready', 'Pronunciation analyzer is still loading...');
      return;
    }

    try {
      setSelectedWord(word);
      setIsRecording(true);

      const path = `${FileSystem.documentDirectory}recording_${word.id}_${Date.now()}.wav`;
      
      await audioRecorderPlayer.startRecorder(path);
      setRecordingPath(path);
      
      console.log('🎤 Recording started:', path);
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      
      console.log('⏹️ Recording stopped');

      // Automatically analyze the recording
      if (selectedWord && recordingPath) {
        await analyzeRecording(recordingPath, selectedWord);
      }
    } catch (error) {
      console.error('❌ Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const analyzeRecording = async (audioPath: string, word: Word) => {
    if (!isModelLoaded) {
      Alert.alert('Not Ready', 'Pronunciation analyzer is not ready');
      return;
    }

    try {
      setIsAnalyzing(true);

      console.log('🔍 Analyzing pronunciation for:', word.word);

      // Run on-device analysis
      const result = await pronunciationAnalyzer.analyzeAudio(audioPath, word.word);

      // Store result
      setAnalysisResults(prev => ({
        ...prev,
        [word.id]: result
      }));

      // Update word accuracy based on result
      const newAccuracy = Math.round(result.accuracy * 100);
      updateWordAccuracy(word.id, newAccuracy);

      // Show results
      showAnalysisResults(word, result);

      console.log('✅ Analysis complete:', {
        accuracy: `${(result.accuracy * 100).toFixed(1)}%`,
        processingTime: `${result.processing_time.toFixed(2)}s`
      });

    } catch (error) {
      console.error('❌ Analysis failed:', error);
      Alert.alert('Analysis Error', 'Failed to analyze pronunciation. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateWordAccuracy = (wordId: string, accuracy: number) => {
    setWords(prevWords => 
      prevWords.map(w => 
        w.id === wordId 
          ? { ...w, accuracy, practiced: w.practiced + 1 }
          : w
      )
    );
  };

  const showAnalysisResults = (word: Word, result: AnalysisResult) => {
    const accuracy = (result.accuracy * 100).toFixed(1);
    const wordAnalysis = result.word_level_analysis;

    let message = `Word: ${word.word}\n`;
    message += `Accuracy: ${accuracy}%\n`;
    message += `Phonemes: ${result.correct_phonemes}/${result.total_phonemes} correct\n\n`;

    if (result.accuracy >= 0.85) {
      message += '✅ Excellent pronunciation!';
    } else if (result.accuracy >= 0.70) {
      message += '👍 Good! Keep practicing for perfection.';
    } else if (result.accuracy >= 0.50) {
      message += '⚠️ Fair. Practice more to improve.';
    } else {
      message += '❌ Needs work. Try again!';
    }

    if (result.mispronunciations.length > 0) {
      message += `\n\nIssues found: ${result.mispronunciations.length}`;
      
      // Show top 3 errors
      const topErrors = result.mispronunciations.slice(0, 3);
      topErrors.forEach((error, i) => {
        message += `\n${i + 1}. ${error.type}: '${error.predicted}' → '${error.reference}'`;
      });
    }

    Alert.alert('Pronunciation Analysis', message, [
      {
        text: 'Try Again',
        onPress: () => startRecording(word)
      },
      {
        text: 'OK',
        style: 'cancel'
      }
    ]);
  };

  const playWordAudio = async (word: Word) => {
    // TODO: Implement text-to-speech for the word
    // or play pre-recorded audio
    Alert.alert('Play Audio', `Playing pronunciation for: ${word.word}`);
  };

  // ====================================================================
  // RENDER FUNCTIONS
  // ====================================================================

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return '#10B981';
      case 'Medium': return '#F59E0B';
      case 'Hard': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 85) return '#10B981';
    if (accuracy >= 70) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search Words</Text>
        <Text style={styles.headerSubtitle}>
          Find and practice any word {isModelLoaded ? '• On-device AI ready' : '• Loading AI...'}
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Icon name="search" size={22} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a word..."
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
        </View>

        {/* Category Filters */}
        <View style={styles.categoriesSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesScroll}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryText,
                  selectedCategory === category && styles.categoryTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results Count */}
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsCount}>
            {filteredWords.length} word{filteredWords.length !== 1 ? 's' : ''} found
          </Text>
        </View>

        {/* Loading Indicator */}
        {isAnalyzing && (
          <View style={styles.analyzingBanner}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.analyzingText}>Analyzing pronunciation...</Text>
          </View>
        )}

        {/* Word Cards */}
        <View style={styles.wordsContainer}>
          {filteredWords.map((word) => {
            const hasResult = analysisResults[word.id];
            const isCurrentlyRecording = isRecording && selectedWord?.id === word.id;

            return (
              <View key={word.id} style={styles.wordCard}>
                <View style={styles.wordHeader}>
                  <View style={styles.wordTitleContainer}>
                    <Text style={styles.wordTitle}>{word.word}</Text>
                    <Text style={styles.wordPhonetic}>{word.phonetic}</Text>
                  </View>
                  <View style={[
                    styles.difficultyBadge, 
                    { backgroundColor: `${getDifficultyColor(word.difficulty)}20` }
                  ]}>
                    <Text style={[styles.difficultyText, { color: getDifficultyColor(word.difficulty) }]}>
                      {word.difficulty}
                    </Text>
                  </View>
                </View>

                <View style={styles.wordStats}>
                  <View style={styles.wordStat}>
                    <Icon name="history" size={18} color="#6B7280" />
                    <Text style={styles.wordStatText}>{word.practiced} times</Text>
                  </View>
                  <View style={styles.wordStat}>
                    <View style={[
                      styles.accuracyIndicator,
                      { backgroundColor: getAccuracyColor(word.accuracy) }
                    ]} />
                    <Text style={styles.wordStatText}>{word.accuracy}% accuracy</Text>
                  </View>
                </View>

                {/* Show latest analysis result */}
                {hasResult && (
                  <View style={styles.resultPreview}>
                    <Text style={styles.resultPreviewLabel}>Latest Result:</Text>
                    <Text style={styles.resultPreviewText}>
                      {(hasResult.accuracy * 100).toFixed(1)}% • {hasResult.correct_phonemes}/{hasResult.total_phonemes} phonemes
                    </Text>
                  </View>
                )}

                <View style={styles.wordActions}>
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => playWordAudio(word)}
                  >
                    <Icon name="volume-up" size={20} color="#6366F1" />
                    <Text style={styles.actionButtonText}>Listen</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[
                      styles.actionButton, 
                      styles.actionButtonPrimary,
                      isCurrentlyRecording && styles.actionButtonRecording,
                      !isModelLoaded && styles.actionButtonDisabled
                    ]}
                    onPress={() => {
                      if (isCurrentlyRecording) {
                        stopRecording();
                      } else {
                        startRecording(word);
                      }
                    }}
                    disabled={!isModelLoaded || (isRecording && selectedWord?.id !== word.id)}
                  >
                    <Icon 
                      name={isCurrentlyRecording ? "stop" : "mic"} 
                      size={20} 
                      color="#FFFFFF" 
                    />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
                      {isCurrentlyRecording ? 'Stop' : 'Practice'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {filteredWords.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="search-off" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateTitle}>No words found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your search or filter
            </Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  categoriesSection: {
    marginTop: 20,
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  categoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  resultsHeader: {
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  analyzingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    gap: 10,
  },
  analyzingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  wordsContainer: {
    paddingHorizontal: 20,
  },
  wordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  wordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  wordTitleContainer: {
    flex: 1,
  },
  wordTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  wordPhonetic: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    fontStyle: 'italic',
  },
  difficultyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  difficultyText: {
    fontSize: 13,
    fontWeight: '700',
  },
  wordStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  wordStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordStatText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  accuracyIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  resultPreview: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  resultPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 4,
  },
  resultPreviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  wordActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  actionButtonPrimary: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  actionButtonDisabled: {
    backgroundColor: '#9CA3AF',
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
