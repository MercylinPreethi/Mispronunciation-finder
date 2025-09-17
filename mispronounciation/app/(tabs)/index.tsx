import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  SafeAreaView,
  StatusBar
} from 'react-native';
import AudioRecorderPlayer, { 
  AudioEncoderAndroidType, 
  AudioSourceAndroidType,
  AVEncoderAudioQualityIOSType,
  AVEncodingOption
} from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import axios from 'axios';

const audioRecorderPlayer = new AudioRecorderPlayer();

interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
}

interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
}

interface APIResponse {
  success: boolean;
  analysis?: AnalysisResult;
  feedback?: string;
  error?: string;
}

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<APIResponse | null>(null);
  const [referenceText, setReferenceText] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [recordingTime, setRecordingTime] = useState('00:00');

  const recordSecsRef = useRef(0);
  const recordTimeRef = useRef('00:00');

  // Update with your cluster backend URL
  const API_BASE_URL = 'http://192.168.14.34:5050';

  const startRecording = async () => {
    if (!referenceText.trim()) {
      Alert.alert('Error', 'Please enter reference text first');
      return;
    }

    try {
      setIsRecording(true);
      setResults(null);
      const path = `${RNFS.DocumentDirectoryPath}/recording.wav`;
      setAudioPath(path);

      const audioSet = {
        AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
        AudioSourceAndroid: AudioSourceAndroidType.MIC,
        AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
        AVNumberOfChannelsKeyIOS: 1,
        AVFormatIDKeyIOS: AVEncodingOption.lpcm,
      };

      await audioRecorderPlayer.startRecorder(path, audioSet);
      audioRecorderPlayer.addRecordBackListener((e) => {
        recordSecsRef.current = e.currentPosition;
        recordTimeRef.current = audioRecorderPlayer.mmssss(
          Math.floor(e.currentPosition),
        );
        setRecordingTime(recordTimeRef.current);
      });
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Error', 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorderPlayer.stopRecorder();
      audioRecorderPlayer.removeRecordBackListener();
      setIsRecording(false);
      setRecordingTime('00:00');

      // Process the recording
      await processRecording();
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording');
      setIsRecording(false);
    }
  };

  const processRecording = async () => {
    if (!audioPath) return;

    setIsProcessing(true);
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio_file', {
        uri: `file://${audioPath}`,
        type: 'audio/wav',
        name: 'recording.wav',
      } as any);
      formData.append('reference_text', referenceText);

      // Send to backend for analysis
      const response = await axios.post(`${API_BASE_URL}/analyze`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000, // 30 second timeout
      });

      if (response.data.success) {
        setResults(response.data);
      } else {
        throw new Error(response.data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Processing error:', error);
      Alert.alert('Error', 'Failed to process audio. Please check your connection.');
    } finally {
      setIsProcessing(false);
    }
  };

  const playReferenceAudio = () => {
    // Optional: Play reference audio for the text
    Alert.alert('Info', 'Reference audio playback would be implemented here');
  };

  const resetApp = () => {
    setResults(null);
    setReferenceText('');
    setRecordingTime('00:00');
  };

  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 0.9) return '#34C759'; // Green
    if (accuracy >= 0.8) return '#FF9500'; // Orange
    return '#FF3B30'; // Red
  };

  const formatAccuracy = (accuracy: number): string => {
    return `${(accuracy * 100).toFixed(1)}%`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text style={styles.title}>Pronunciation Coach</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Reference Text to Practice:</Text>
          <TextInput
            style={styles.textInput}
            value={referenceText}
            onChangeText={setReferenceText}
            placeholder="Enter text to practice pronunciation"
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity 
            style={styles.referenceButton} 
            onPress={playReferenceAudio}
          >
            <Text style={styles.buttonText}>Hear Reference</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recordingContainer}>
          <Text style={styles.recordingTime}>{recordingTime}</Text>
          
          <TouchableOpacity
            style={[styles.recordButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
          >
            <Text style={styles.recordButtonText}>
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </Text>
          </TouchableOpacity>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.processingText}>Analyzing pronunciation...</Text>
            </View>
          )}
        </View>

        {results && results.success && results.analysis && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Analysis Results</Text>
            
            <View style={styles.scoreContainer}>
              <Text style={[
                styles.scoreText, 
                { color: getAccuracyColor(results.analysis.accuracy) }
              ]}>
                Accuracy: {formatAccuracy(results.analysis.accuracy)}
              </Text>
              <Text style={styles.scoreSubtext}>
                {results.analysis.correct_phonemes}/{results.analysis.total_phonemes} phonemes correct
              </Text>
            </View>

            {results.analysis.predicted_phonemes && results.analysis.reference_phonemes && (
              <View style={styles.phonemeContainer}>
                <Text style={styles.sectionTitle}>Phoneme Comparison:</Text>
                <Text style={styles.phonemeText}>
                  Your speech: {results.analysis.predicted_phonemes.join(' ')}
                </Text>
                <Text style={styles.phonemeText}>
                  Reference: {results.analysis.reference_phonemes.join(' ')}
                </Text>
              </View>
            )}

            {results.analysis.mispronunciations && results.analysis.mispronunciations.length > 0 && (
              <View style={styles.mispronunciationsContainer}>
                <Text style={styles.sectionTitle}>
                  Pronunciation Issues ({results.analysis.mispronunciations.length}):
                </Text>
                {results.analysis.mispronunciations.slice(0, 5).map((error, index) => (
                  <View key={index} style={styles.errorItem}>
                    <Text style={styles.errorText}>
                      • Position {error.position + 1}: {error.type}
                    </Text>
                    <Text style={styles.errorDetail}>
                      {error.type === 'substitution' && 
                        `Said "${error.predicted}" instead of "${error.reference}"`
                      }
                      {error.type === 'deletion' && 
                        `Missing phoneme "${error.reference}"`
                      }
                      {error.type === 'insertion' && 
                        `Added extra phoneme "${error.predicted}"`
                      }
                    </Text>
                  </View>
                ))}
                {results.analysis.mispronunciations.length > 5 && (
                  <Text style={styles.moreErrorsText}>
                    ... and {results.analysis.mispronunciations.length - 5} more issues
                  </Text>
                )}
              </View>
            )}

            {results.analysis.mispronunciations && results.analysis.mispronunciations.length === 0 && (
              <View style={styles.perfectContainer}>
                <Text style={styles.perfectText}>🎉 Perfect! No pronunciation issues detected.</Text>
              </View>
            )}

            {results.feedback && (
              <View style={styles.feedbackContainer}>
                <Text style={styles.sectionTitle}>Detailed Feedback:</Text>
                <Text style={styles.feedbackText}>{results.feedback}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.resetButton} onPress={resetApp}>
              <Text style={styles.resetButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {results && !results.success && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>Analysis Failed</Text>
            <Text style={styles.errorMessage}>
              {results.error || 'Unknown error occurred'}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={resetApp}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  referenceButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  recordingTime: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 50,
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: '#5856D6',
  },
  recordButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  processingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scoreSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  phonemeContainer: {
    marginBottom: 20,
    backgroundColor: '#f8f8f8',
    padding: 15,
    borderRadius: 8,
  },
  phonemeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  mispronunciationsContainer: {
    marginBottom: 20,
  },
  errorItem: {
    backgroundColor: '#FFF2F2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  moreErrorsText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  perfectContainer: {
    backgroundColor: '#F0FFF4',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  perfectText: {
    fontSize: 18,
    color: '#34C759',
    fontWeight: '600',
  },
  feedbackContainer: {
    marginBottom: 20,
  },
  feedbackText: {
    fontSize: 16,
    lineHeight: 22,
    color: '#333',
  },
  resetButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default App;