// types.ts
import { Timestamp } from 'firebase/firestore';

export interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
}

export interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
}

export interface APIResponse {
  success: boolean;
  analysis?: AnalysisResult;
  feedback?: string;
  error?: string;
}

export interface PracticeAttempt {
  id: string;
  timestamp: Date | Timestamp;
  audioUrl: string;
  localAudioPath?: string;
  scores: AnalysisResult;
  feedback: string;
  source: 'recording' | 'upload';
  fileName?: string;
}

export interface HistoryTab {
  id: string;
  referenceText: string;
  createdAt: Date | Timestamp;
  attempts: PracticeAttempt[];
  referenceAudioUrl?: string;
  userId?: string;
}

export interface FirebaseHistoryTab extends Omit<HistoryTab, 'createdAt' | 'attempts'> {
  createdAt: Timestamp;
  attempts: (Omit<PracticeAttempt, 'timestamp'> & { timestamp: Timestamp })[];
}

// Audio recorder types
export interface AudioSet {
  AudioEncoderAndroid: string;
  AudioSourceAndroid: string;
  AVEncoderAudioQualityKeyIOS: string;
  AVNumberOfChannelsKeyIOS: number;
  AVFormatIDKeyIOS: string;
}