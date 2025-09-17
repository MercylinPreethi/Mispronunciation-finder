import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export default function AudioRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingStatus, setRecordingStatus] = useState('idle');

  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, [recording]);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      setRecordingStatus('recording');
    } catch (err) {
      console.error('Failed to start recording', err);
      setRecordingStatus('error');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setRecordingStatus('processing');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Convert to base64 for sending to server
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      onRecordingComplete(`data:audio/m4a;base64,${base64Audio}`);
      setRecording(null);
      setRecordingStatus('idle');
    } catch (err) {
      console.error('Failed to stop recording', err);
      setRecordingStatus('error');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Record Audio</Text>
      
      <TouchableOpacity
        style={[styles.button, isRecording ? styles.stopButton : styles.recordButton]}
        onPress={isRecording ? stopRecording : startRecording}
        disabled={recordingStatus === 'processing'}
      >
        <Text style={styles.buttonText}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
          {recordingStatus === 'processing' ? ' (Processing...)' : ''}
        </Text>
      </TouchableOpacity>

      {isRecording && (
        <Text style={styles.recordingText}>Recording in progress... 🎤</Text>
      )}
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
  button: {
    padding: 15,
    borderRadius: 25,
    minWidth: 150,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#FF3B30',
  },
  stopButton: {
    backgroundColor: '#4CD964',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  recordingText: {
    marginTop: 10,
    color: '#FF3B30',
    fontSize: 14,
  },
});