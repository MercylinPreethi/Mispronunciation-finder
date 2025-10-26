/**
 * Analysis Helper - Unified On-Device Pronunciation Analysis
 * 
 * This helper provides a consistent interface for pronunciation analysis
 * across all screens (index, chat, practice, explore)
 * 
 * Usage:
 *   import { analyzeAudio } from './lib/AnalysisHelper';
 *   const result = await analyzeAudio({ audioPath, referenceText: 'hello' });
 */

import { pronunciationAnalyzer, AnalysisResult } from './OnDevicePronunciationAnalyzer';
import { modelManager } from './ModelManager';

// ============================================================================
// TYPES
// ============================================================================

export interface AnalysisOptions {
  audioPath: string;
  referenceText: string;
  onProgress?: (message: string, progress: number) => void;
  timeout?: number; // milliseconds, default 30000
}

export interface FormattedAnalysisResult {
  // Core metrics
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  
  // Phoneme details
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: any[];
  
  // Word-level analysis
  word_level_analysis?: {
    word_phoneme_mapping: any[];
    correct_words: string[];
    partial_words: string[];
    mispronounced_words: string[];
    word_accuracy: number;
  };
  
  // Convenience fields (extracted from word_level_analysis)
  correct_words: string[];
  mispronounced_words: string[];
  partial_words: string[];
  
  // Feedback
  feedback: string;
  
  // Metadata
  processing_time: number;
  model_type: string;
  success: boolean;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze pronunciation using on-device ONNX model
 * 
 * This is the main function you should use in all screens to replace
 * axios.post calls to the backend API.
 * 
 * @param options - Analysis configuration
 * @returns Formatted analysis result
 * @throws Error if analysis fails
 */
export async function analyzeAudio(
  options: AnalysisOptions
): Promise<FormattedAnalysisResult> {
  const { 
    audioPath, 
    referenceText, 
    onProgress,
    timeout = 30000 
  } = options;

  try {
    // Step 1: Validate inputs
    if (!audioPath || !referenceText) {
      throw new Error('Missing audioPath or referenceText');
    }

    // Step 2: Check model is loaded
    if (!modelManager.isModelLoaded()) {
      throw new Error(
        'Pronunciation model not loaded. ' +
        'Please wait for the app to finish loading.'
      );
    }

    onProgress?.('Starting analysis...', 0.1);

    // Step 3: Run analysis with timeout
    const analysisPromise = pronunciationAnalyzer.analyzeAudio(
      audioPath,
      referenceText
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Analysis timeout')), timeout)
    );

    onProgress?.('Analyzing pronunciation...', 0.3);

    const result: AnalysisResult = await Promise.race([
      analysisPromise,
      timeoutPromise
    ]);

    onProgress?.('Processing results...', 0.8);

    // Step 4: Format result
    const formattedResult = formatAnalysisResult(result);

    onProgress?.('Complete!', 1.0);

    // Step 5: Log success
    console.log('✅ On-device analysis complete:', {
      accuracy: `${(formattedResult.accuracy * 100).toFixed(1)}%`,
      correctWords: formattedResult.correct_words.length,
      mispronounced: formattedResult.mispronounced_words.length,
      processingTime: `${formattedResult.processing_time.toFixed(2)}s`
    });

    return formattedResult;

  } catch (error: any) {
    console.error('❌ On-device analysis failed:', error);
    
    // Provide helpful error messages
    let errorMessage = 'Analysis failed';
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Analysis took too long. Please try with shorter audio.';
    } else if (error.message.includes('not loaded')) {
      errorMessage = 'Pronunciation engine not ready. Please try again.';
    } else if (error.message.includes('Audio loading')) {
      errorMessage = 'Could not load audio file. Please record again.';
    } else {
      errorMessage = `Analysis error: ${error.message}`;
    }

    throw new Error(errorMessage);
  }
}

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

/**
 * Analyze multiple recordings in batch
 * Useful for analyzing practice history or multiple words
 */
export async function analyzeBatch(
  items: Array<{ audioPath: string; referenceText: string }>,
  onProgress?: (current: number, total: number) => void
): Promise<FormattedAnalysisResult[]> {
  const results: FormattedAnalysisResult[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      onProgress?.(i + 1, items.length);
      
      const result = await analyzeAudio({
        audioPath: items[i].audioPath,
        referenceText: items[i].referenceText
      });
      
      results.push(result);
      
    } catch (error) {
      console.error(`Failed to analyze item ${i}:`, error);
      // Continue with next item
    }
  }

  return results;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format raw analysis result into UI-friendly structure
 */
function formatAnalysisResult(result: AnalysisResult): FormattedAnalysisResult {
  const wordAnalysis = result.word_level_analysis;
  
  return {
    // Core metrics
    accuracy: result.accuracy,
    correct_phonemes: result.correct_phonemes,
    total_phonemes: result.total_phonemes,
    
    // Phoneme details
    predicted_phonemes: result.predicted_phonemes,
    reference_phonemes: result.reference_phonemes,
    mispronunciations: result.mispronunciations,
    
    // Word-level analysis
    word_level_analysis: wordAnalysis,
    
    // Convenience fields
    correct_words: wordAnalysis?.correct_words || [],
    mispronounced_words: wordAnalysis?.mispronounced_words || [],
    partial_words: wordAnalysis?.partial_words || [],
    
    // Feedback
    feedback: result.feedback,
    
    // Metadata
    processing_time: result.processing_time,
    model_type: 'INT8 ONNX',
    success: true,
  };
}

/**
 * Check if pronunciation analyzer is ready to use
 */
export function isAnalyzerReady(): boolean {
  return modelManager.isModelLoaded();
}

/**
 * Get current model information
 */
export function getModelInfo() {
  return modelManager.getModelInfo();
}

/**
 * Get analyzer status with human-readable message
 */
export function getAnalyzerStatus(): {
  ready: boolean;
  message: string;
  modelInfo?: any;
} {
  const isReady = modelManager.isModelLoaded();
  
  if (isReady) {
    return {
      ready: true,
      message: 'Ready to analyze',
      modelInfo: modelManager.getModelInfo()
    };
  } else {
    return {
      ready: false,
      message: 'Model is loading...'
    };
  }
}

/**
 * Validate audio file before analysis
 */
export async function validateAudioFile(audioPath: string): Promise<boolean> {
  try {
    const FileSystem = require('expo-file-system');
    const info = await FileSystem.getInfoAsync(audioPath);
    
    if (!info.exists) {
      console.error('Audio file does not exist:', audioPath);
      return false;
    }
    
    if (info.size === 0) {
      console.error('Audio file is empty');
      return false;
    }
    
    // Check minimum size (e.g., at least 1KB)
    if (info.size < 1024) {
      console.error('Audio file too small');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('Failed to validate audio:', error);
    return false;
  }
}

/**
 * Get user-friendly accuracy description
 */
export function getAccuracyDescription(accuracy: number): {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  emoji: string;
  message: string;
  color: string;
} {
  if (accuracy >= 0.9) {
    return {
      level: 'excellent',
      emoji: '🌟',
      message: 'Excellent pronunciation!',
      color: '#10B981'
    };
  } else if (accuracy >= 0.75) {
    return {
      level: 'good',
      emoji: '👍',
      message: 'Good job! Keep practicing.',
      color: '#3B82F6'
    };
  } else if (accuracy >= 0.5) {
    return {
      level: 'fair',
      emoji: '⚠️',
      message: 'Fair. Practice more to improve.',
      color: '#F59E0B'
    };
  } else {
    return {
      level: 'poor',
      emoji: '❌',
      message: 'Needs work. Try again!',
      color: '#EF4444'
    };
  }
}

/**
 * Calculate overall progress from multiple attempts
 */
export function calculateProgress(results: FormattedAnalysisResult[]): {
  averageAccuracy: number;
  improvementRate: number;
  totalAttempts: number;
  bestAccuracy: number;
} {
  if (results.length === 0) {
    return {
      averageAccuracy: 0,
      improvementRate: 0,
      totalAttempts: 0,
      bestAccuracy: 0
    };
  }

  const accuracies = results.map(r => r.accuracy);
  const averageAccuracy = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const bestAccuracy = Math.max(...accuracies);
  
  // Calculate improvement rate (last 5 vs first 5)
  let improvementRate = 0;
  if (results.length >= 10) {
    const first5 = accuracies.slice(0, 5);
    const last5 = accuracies.slice(-5);
    const first5Avg = first5.reduce((a, b) => a + b, 0) / 5;
    const last5Avg = last5.reduce((a, b) => a + b, 0) / 5;
    improvementRate = last5Avg - first5Avg;
  }

  return {
    averageAccuracy,
    improvementRate,
    totalAttempts: results.length,
    bestAccuracy
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  analyzeAudio,
  analyzeBatch,
  isAnalyzerReady,
  getModelInfo,
  getAnalyzerStatus,
  validateAudioFile,
  getAccuracyDescription,
  calculateProgress,
};