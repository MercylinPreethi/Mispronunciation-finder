import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function FileUploader({ onFileSelect }) {
  const selectAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.type === 'success') {
        // Read file as base64
        const base64 = await FileSystem.readAsStringAsync(result.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        const audioData = `data:audio/${result.name.split('.').pop()};base64,${base64}`;
        onFileSelect(audioData);
      }
    } catch (err) {
      console.error('File pick error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Or Upload Audio File</Text>
      
      <TouchableOpacity
        style={styles.uploadButton}
        onPress={selectAudioFile}
      >
        <Text style={styles.buttonText}>Select Audio File</Text>
      </TouchableOpacity>

      <Text style={styles.noteText}>Supported formats: WAV, MP3, M4A</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 25,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  noteText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
  },
});