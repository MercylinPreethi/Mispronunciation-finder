import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function ResultDisplay({ results }) {
  if (!results) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Analysis Results</Text>
      
      <View style={styles.scoreContainer}>
        <Text style={styles.score}>Overall Score: {results.scores?.overall_score?.toFixed(1) || 'N/A'}/10</Text>
        <Text style={styles.confidence}>Confidence: {(results.confidence * 100)?.toFixed(1)}%</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.subtitle}>Transcription:</Text>
        <Text style={styles.transcription}>{results.transcription || 'No transcription available'}</Text>
      </View>

      {results.mispronunciations && results.mispronunciations.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={styles.subtitle}>Mispronunciations:</Text>
          <ScrollView style={styles.errorsList}>
            {results.mispronunciations.map((error, index) => (
              <View key={index} style={styles.errorItem}>
                <Text style={styles.errorText}>
                  {error.type === 'substitution' 
                    ? `Expected "${error.expected}" but said "${error.actual}"`
                    : `Low confidence on "${error.expected}"`
                  }
                </Text>
                <Text style={styles.confidenceText}>Confidence: {(error.confidence * 100).toFixed(1)}%</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.feedbackSection}>
        <Text style={styles.subtitle}>Feedback:</Text>
        <Text style={styles.feedbackText}>{results.feedback}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  score: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  confidence: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  detailSection: {
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  transcription: {
    fontSize: 14,
    color: '#555',
    backgroundColor: '#f9f9f9',
    padding: 10,
    borderRadius: 6,
  },
  errorsList: {
    maxHeight: 150,
  },
  errorItem: {
    backgroundColor: '#FFF3F3',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
  },
  confidenceText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  feedbackSection: {
    marginTop: 10,
  },
  feedbackText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
});