/**
 * On-Device Pronunciation Analyzer using ONNX Runtime
 * Replicates all backend functionality for frontend pronunciation analysis
 * Includes: wav2vec2 inference, phoneme extraction, alignment, word-level analysis
 */

import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

interface PhonemeCategory {
  vowels: Set<string>;
  consonants: Set<string>;
}

interface PhonemeSimilarityMatrix {
  [key: string]: number;
}

interface MispronunciationError {
  position: number;
  predicted: string;
  reference: string;
  type: 'substitution' | 'deletion' | 'insertion';
  severity: 'low' | 'medium' | 'high';
  similarity: number;
}

interface PhonemeAlignment {
  predicted_phonemes: string[];
  reference_phonemes: string[];
  aligned_predicted: string[];
  aligned_reference: string[];
  accuracy: number;
  total_phonemes: number;
  correct_phonemes: number;
  mispronunciations: MispronunciationError[];
}

interface WordPhonemeData {
  word: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  phoneme_errors: any[];
  per: number;
  accuracy?: number;
}

interface WordLevelAnalysis {
  word_phoneme_mapping: WordPhonemeData[];
  correct_words: string[];
  partial_words: string[];
  mispronounced_words: string[];
  word_accuracy: number;
}

export interface AnalysisResult {
  accuracy: number;
  correct_phonemes: number;
  total_phonemes: number;
  predicted_phonemes: string[];
  reference_phonemes: string[];
  mispronunciations: MispronunciationError[];
  word_level_analysis?: WordLevelAnalysis;
  feedback: string;
  processing_time: number;
}

// ============================================================================
// PHONEME MAPPINGS AND CONSTANTS
// ============================================================================

const VOCAB_MAP: { [key: number]: string } = {
  0: '<pad>',
  1: '<s>',
  2: '</s>',
  3: '<unk>',
  4: '|',
  5: 'a',
  6: 'aɪ',
  7: 'aʊ',
  8: 'b',
  9: 'd',
  10: 'e',
  11: 'eɪ',
  12: 'f',
  13: 'h',
  14: 'i',
  15: 'k',
  16: 'l',
  17: 'm',
  18: 'n',
  19: 'o',
  20: 'oʊ',
  21: 'p',
  22: 'r',
  23: 's',
  24: 't',
  25: 'u',
  26: 'v',
  27: 'w',
  28: 'y',
  29: 'z',
  30: 'æ',
  31: 'ð',
  32: 'ŋ',
  33: 'ɑ',
  34: 'ɔ',
  35: 'ɔɪ',
  36: 'ə',
  37: 'ɛ',
  38: 'ɝ',
  39: 'ɡ',
  40: 'ɪ',
  41: 'ɹ',
  42: 'ʃ',
  43: 'ʊ',
  44: 'ʌ',
  45: 'ʒ',
  46: 'θ',
  47: 'dʒ',
  48: 'tʃ',
};

const PHONEME_CATEGORIES: PhonemeCategory = {
  vowels: new Set([
    'i', 'ɪ', 'e', 'ɛ', 'æ', 'a', 'ɑ', 'ɔ', 'o', 'ʊ', 'u', 'ʌ', 'ə', 'ɝ',
    'aɪ', 'aʊ', 'eɪ', 'oʊ', 'ɔɪ'
  ]),
  consonants: new Set([
    'p', 'b', 't', 'd', 'k', 'ɡ', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'h',
    'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'r', 'ɹ', 'w', 'y'
  ])
};

// Simple phoneme to text mapping (for fallback text-to-phoneme conversion)
const SIMPLE_PHONEME_MAPPING: { [key: string]: string[] } = {
  'a': ['æ', 'a', 'ɑ'],
  'e': ['e', 'ɛ', 'i'],
  'i': ['i', 'ɪ'],
  'o': ['o', 'ɔ', 'oʊ'],
  'u': ['u', 'ʊ', 'ʌ'],
  'b': ['b'],
  'c': ['k', 's'],
  'd': ['d'],
  'f': ['f'],
  'g': ['ɡ', 'dʒ'],
  'h': ['h'],
  'j': ['dʒ'],
  'k': ['k'],
  'l': ['l'],
  'm': ['m'],
  'n': ['n'],
  'p': ['p'],
  'q': ['k', 'w'],
  'r': ['r', 'ɹ'],
  's': ['s', 'z'],
  't': ['t'],
  'v': ['v'],
  'w': ['w'],
  'x': ['k', 's'],
  'y': ['y', 'aɪ'],
  'z': ['z'],
};

// ============================================================================
// MAIN CLASS
// ============================================================================

export class OnDevicePronunciationAnalyzer {
  private session: InferenceSession | null = null;
  private sampleRate: number = 16000;
  private phonemeSimilarityMatrix: PhonemeSimilarityMatrix = {};

  constructor() {
    this.initializePhonemeSimilarity();
  }

  /**
   * Initialize phoneme similarity matrix for alignment
   */
  private initializePhonemeSimilarity(): void {
    // Same category = higher similarity
    PHONEME_CATEGORIES.vowels.forEach(p1 => {
      PHONEME_CATEGORIES.vowels.forEach(p2 => {
        this.phonemeSimilarityMatrix[`${p1}-${p2}`] = p1 === p2 ? 1.0 : 0.8;
      });
    });

    PHONEME_CATEGORIES.consonants.forEach(p1 => {
      PHONEME_CATEGORIES.consonants.forEach(p2 => {
        this.phonemeSimilarityMatrix[`${p1}-${p2}`] = p1 === p2 ? 1.0 : 0.6;
      });
    });

    // Cross-category = lower similarity
    PHONEME_CATEGORIES.vowels.forEach(v => {
      PHONEME_CATEGORIES.consonants.forEach(c => {
        this.phonemeSimilarityMatrix[`${v}-${c}`] = 0.2;
        this.phonemeSimilarityMatrix[`${c}-${v}`] = 0.2;
      });
    });
  }

  /**
   * Load ONNX model from file
   */
  async loadModel(modelPath: string): Promise<void> {
    try {
      console.log('Loading ONNX model from:', modelPath);
      this.session = await InferenceSession.create(modelPath);
      console.log('✅ ONNX model loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load ONNX model:', error);
      throw new Error(`Model loading failed: ${error}`);
    }
  }

  /**
   * Load and preprocess audio file
   */
  async loadAudio(audioPath: string): Promise<Float32Array> {
    try {
      console.log('Loading audio from:', audioPath);

      // Read audio file as base64
      const audioData = await FileSystem.readAsStringAsync(audioPath, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Decode base64 to array buffer
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Parse WAV file (assuming WAV format)
      const audioBuffer = this.parseWavFile(bytes.buffer);
      
      // Normalize and resample if needed
      const processedAudio = this.preprocessAudio(audioBuffer);
      
      console.log('✅ Audio loaded:', processedAudio.length, 'samples');
      return processedAudio;
    } catch (error) {
      console.error('❌ Failed to load audio:', error);
      throw new Error(`Audio loading failed: ${error}`);
    }
  }

  /**
   * Parse WAV file buffer
   */
  private parseWavFile(buffer: ArrayBuffer): Float32Array {
    const view = new DataView(buffer);
    
    // Skip WAV header (44 bytes)
    const dataOffset = 44;
    const numSamples = (buffer.byteLength - dataOffset) / 2; // 16-bit audio
    const audioData = new Float32Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      // Read 16-bit PCM sample
      const sample = view.getInt16(dataOffset + i * 2, true);
      // Normalize to [-1, 1]
      audioData[i] = sample / 32768.0;
    }

    return audioData;
  }

  /**
   * Preprocess audio: normalize, remove DC offset, ensure minimum length
   */
  private preprocessAudio(audio: Float32Array): Float32Array {
    // Remove DC offset
    let sum = 0;
    for (let i = 0; i < audio.length; i++) {
      sum += audio[i];
    }
    const mean = sum / audio.length;
    
    const centered = new Float32Array(audio.length);
    for (let i = 0; i < audio.length; i++) {
      centered[i] = audio[i] - mean;
    }

    // Normalize to 0.95 max amplitude
    let maxAbs = 0;
    for (let i = 0; i < centered.length; i++) {
      const abs = Math.abs(centered[i]);
      if (abs > maxAbs) maxAbs = abs;
    }

    const normalized = new Float32Array(centered.length);
    if (maxAbs > 0) {
      for (let i = 0; i < centered.length; i++) {
        normalized[i] = (centered[i] / maxAbs) * 0.95;
      }
    }

    // Ensure minimum length (0.25 seconds)
    const minLength = Math.floor(this.sampleRate * 0.25);
    if (normalized.length < minLength) {
      const padded = new Float32Array(minLength);
      padded.set(normalized);
      return padded;
    }

    return normalized;
  }

  /**
   * Run wav2vec2 inference to get phoneme predictions
   */
  private async runInference(audio: Float32Array): Promise<string[]> {
    if (!this.session) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    try {
      // Create input tensor
      const inputTensor = new Tensor('float32', audio, [1, audio.length]);

      // Run inference
      const feeds = { input: inputTensor };
      const results = await this.session.run(feeds);

      // Get logits output
      const logits = results.logits;
      const logitsData = logits.data as Float32Array;
      const [batch, timeSteps, vocabSize] = logits.dims;

      // Decode logits to phonemes using CTC decoding
      const phonemes = this.ctcDecode(logitsData, timeSteps, vocabSize);

      console.log('Predicted phonemes:', phonemes);
      return phonemes;
    } catch (error) {
      console.error('❌ Inference failed:', error);
      throw new Error(`Inference failed: ${error}`);
    }
  }

  /**
   * CTC Decoding: Convert logits to phoneme sequence
   */
  private ctcDecode(logits: Float32Array, timeSteps: number, vocabSize: number): string[] {
    const phonemes: string[] = [];
    let prevToken = -1;

    for (let t = 0; t < timeSteps; t++) {
      // Find argmax for this timestep
      let maxIdx = 0;
      let maxVal = -Infinity;

      for (let v = 0; v < vocabSize; v++) {
        const idx = t * vocabSize + v;
        if (logits[idx] > maxVal) {
          maxVal = logits[idx];
          maxIdx = v;
        }
      }

      // CTC decoding: ignore blanks (token 0) and repeats
      if (maxIdx !== 0 && maxIdx !== prevToken) {
        const phoneme = VOCAB_MAP[maxIdx];
        if (phoneme && phoneme !== '<pad>' && phoneme !== '<s>' && phoneme !== '</s>' && phoneme !== '<unk>') {
          phonemes.push(phoneme);
        }
      }

      prevToken = maxIdx;
    }

    return this.cleanPhonemeSequence(phonemes);
  }

  /**
   * Clean phoneme sequence: remove word boundaries, merge similar phonemes
   */
  private cleanPhonemeSequence(phonemes: string[]): string[] {
    const cleaned: string[] = [];

    for (let i = 0; i < phonemes.length; i++) {
      const phoneme = phonemes[i];

      // Skip word boundary markers
      if (phoneme === '|' || phoneme === '<sil>') {
        continue;
      }

      // Avoid consecutive duplicates
      if (cleaned.length === 0 || cleaned[cleaned.length - 1] !== phoneme) {
        cleaned.push(phoneme);
      }
    }

    return cleaned.length > 0 ? cleaned : ['<unk>'];
  }

  /**
   * Convert text to phonemes (simplified rule-based approach)
   */
  private textToPhonemes(text: string): string[] {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    const phonemes: string[] = [];

    for (const word of words) {
      if (!word) continue;

      for (const char of word) {
        const phonemeOptions = SIMPLE_PHONEME_MAPPING[char];
        if (phonemeOptions && phonemeOptions.length > 0) {
          // Use first option as default
          phonemes.push(phonemeOptions[0]);
        }
      }
    }

    return phonemes.length > 0 ? phonemes : ['<unk>'];
  }

  /**
   * Get phoneme similarity score
   */
  private getPhonemeSimilarity(p1: string, p2: string): number {
    if (p1 === p2) return 1.0;
    if (p1 === '-' || p2 === '-') return 0.0;

    const key = `${p1}-${p2}`;
    return this.phonemeSimilarityMatrix[key] || 0.1;
  }

  /**
   * Align phoneme sequences using dynamic programming
   */
  private alignPhonemes(predicted: string[], reference: string[]): PhonemeAlignment {
    console.log('Aligning phonemes...');
    console.log('Predicted:', predicted);
    console.log('Reference:', reference);

    if (predicted.length === 0) predicted = ['<sil>'];
    if (reference.length === 0) reference = ['<unk>'];

    const m = predicted.length;
    const n = reference.length;

    // DP matrix for similarity-based alignment
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    // Initialize with gap penalties
    for (let i = 1; i <= m; i++) {
      dp[i][0] = dp[i - 1][0] - 0.5;
    }
    for (let j = 1; j <= n; j++) {
      dp[0][j] = dp[0][j - 1] - 0.5;
    }

    // Fill DP matrix
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const similarity = this.getPhonemeSimilarity(predicted[i - 1], reference[j - 1]);

        dp[i][j] = Math.max(
          dp[i - 1][j - 1] + similarity,  // Match/mismatch
          dp[i - 1][j] - 0.5,             // Insertion
          dp[i][j - 1] - 0.5              // Deletion
        );
      }
    }

    // Backtrack to get alignment
    const alignedPred: string[] = [];
    const alignedRef: string[] = [];
    let i = m, j = n;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0) {
        const similarity = this.getPhonemeSimilarity(predicted[i - 1], reference[j - 1]);
        
        if (Math.abs(dp[i][j] - (dp[i - 1][j - 1] + similarity)) < 0.001) {
          alignedPred.unshift(predicted[i - 1]);
          alignedRef.unshift(reference[j - 1]);
          i--;
          j--;
        } else if (Math.abs(dp[i][j] - (dp[i - 1][j] - 0.5)) < 0.001) {
          alignedPred.unshift(predicted[i - 1]);
          alignedRef.unshift('-');
          i--;
        } else {
          alignedPred.unshift('-');
          alignedRef.unshift(reference[j - 1]);
          j--;
        }
      } else if (i > 0) {
        alignedPred.unshift(predicted[i - 1]);
        alignedRef.unshift('-');
        i--;
      } else {
        alignedPred.unshift('-');
        alignedRef.unshift(reference[j - 1]);
        j--;
      }
    }

    // Calculate accuracy and errors
    let matches = 0;
    let totalScore = 0;
    const mispronunciations: MispronunciationError[] = [];

    for (let k = 0; k < alignedPred.length; k++) {
      const pred = alignedPred[k];
      const ref = alignedRef[k];
      const similarity = this.getPhonemeSimilarity(pred, ref);
      
      totalScore += similarity;

      if (similarity >= 0.8) {
        matches++;
      } else if (pred !== ref) {
        const errorType = pred === '-' ? 'deletion' : ref === '-' ? 'insertion' : 'substitution';
        const severity = similarity > 0.6 ? 'low' : similarity > 0.3 ? 'medium' : 'high';

        mispronunciations.push({
          position: k,
          predicted: pred,
          reference: ref,
          type: errorType,
          severity,
          similarity
        });
      }
    }

    const accuracy = totalScore / reference.length;

    console.log(`Alignment: ${matches}/${reference.length} exact, ${(accuracy * 100).toFixed(1)}% similarity`);

    return {
      predicted_phonemes: predicted,
      reference_phonemes: reference,
      aligned_predicted: alignedPred,
      aligned_reference: alignedRef,
      accuracy,
      total_phonemes: reference.length,
      correct_phonemes: matches,
      mispronunciations
    };
  }

  /**
   * Extract word-level analysis from phoneme alignment
   */
  private extractWordLevelAnalysis(
    alignment: PhonemeAlignment,
    referenceText: string,
    predictedPhonemes: string[]
  ): WordLevelAnalysis {
    const words = referenceText.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w);
    const wordPhonemeMapping: WordPhonemeData[] = [];

    let phonemeIndex = 0;
    const totalPhonemes = alignment.reference_phonemes.length;

    for (const word of words) {
      // Estimate phonemes for this word (simplified)
      const wordLength = word.length;
      const phonemesPerChar = totalPhonemes / referenceText.replace(/[^a-z]/gi, '').length;
      const estimatedPhonemes = Math.max(2, Math.round(wordLength * phonemesPerChar));

      const endIndex = Math.min(phonemeIndex + estimatedPhonemes, totalPhonemes);

      const wordRefPhonemes = alignment.reference_phonemes.slice(phonemeIndex, endIndex);
      const wordPredPhonemes = alignment.predicted_phonemes.slice(phonemeIndex, endIndex);
      const wordAlignedRef = alignment.aligned_reference.slice(phonemeIndex, endIndex);
      const wordAlignedPred = alignment.aligned_predicted.slice(phonemeIndex, endIndex);

      // Calculate word-level accuracy
      let wordMatches = 0;
      let wordTotal = wordRefPhonemes.length;

      for (let i = 0; i < Math.min(wordAlignedRef.length, wordAlignedPred.length); i++) {
        if (this.getPhonemeSimilarity(wordAlignedPred[i], wordAlignedRef[i]) >= 0.8) {
          wordMatches++;
        }
      }

      const wordAccuracy = wordTotal > 0 ? wordMatches / wordTotal : 0;
      const per = 1 - wordAccuracy; // Phoneme Error Rate

      let status: 'correct' | 'partial' | 'mispronounced';
      if (wordAccuracy >= 0.85) {
        status = 'correct';
      } else if (wordAccuracy >= 0.60) {
        status = 'partial';
      } else {
        status = 'mispronounced';
      }

      wordPhonemeMapping.push({
        word,
        reference_phonemes: wordRefPhonemes,
        predicted_phonemes: wordPredPhonemes,
        aligned_reference: wordAlignedRef,
        aligned_predicted: wordAlignedPred,
        status,
        phoneme_errors: [],
        per,
        accuracy: wordAccuracy
      });

      phonemeIndex = endIndex;
    }

    // Categorize words
    const correct_words = wordPhonemeMapping.filter(w => w.status === 'correct').map(w => w.word);
    const partial_words = wordPhonemeMapping.filter(w => w.status === 'partial').map(w => w.word);
    const mispronounced_words = wordPhonemeMapping.filter(w => w.status === 'mispronounced').map(w => w.word);

    const word_accuracy = correct_words.length / words.length;

    return {
      word_phoneme_mapping: wordPhonemeMapping,
      correct_words,
      partial_words,
      mispronounced_words,
      word_accuracy
    };
  }

  /**
   * Generate feedback based on analysis
   */
  private generateFeedback(alignment: PhonemeAlignment, referenceText: string): string {
    const accuracy = alignment.accuracy;
    const mispronunciations = alignment.mispronunciations;

    let feedback = `Pronunciation Analysis\n`;
    feedback += `Text: "${referenceText}"\n`;
    feedback += `Accuracy: ${(accuracy * 100).toFixed(1)}%\n`;
    feedback += `Phonemes: ${alignment.correct_phonemes}/${alignment.total_phonemes} correct\n\n`;

    if (accuracy > 0.9) {
      feedback += '✅ Excellent pronunciation!\n';
    } else if (accuracy > 0.7) {
      feedback += '👍 Good pronunciation with minor variations.\n';
    } else if (accuracy > 0.5) {
      feedback += '⚠️ Fair pronunciation with some issues to address.\n';
    } else {
      feedback += '❌ Significant pronunciation differences detected.\n';
    }

    if (mispronunciations.length > 0) {
      const highPriority = mispronunciations.filter(e => e.severity === 'high');
      
      if (highPriority.length > 0) {
        feedback += `\n🔴 High Priority Issues (${highPriority.length}):\n`;
        highPriority.slice(0, 3).forEach((error, i) => {
          feedback += `  ${i + 1}. ${this.formatError(error)}\n`;
        });
      }

      const mediumPriority = mispronunciations.filter(e => e.severity === 'medium');
      if (mediumPriority.length > 0) {
        feedback += `\n🟡 Medium Priority Issues (${mediumPriority.length})\n`;
      }
    }

    return feedback;
  }

  /**
   * Format error for feedback
   */
  private formatError(error: MispronunciationError): string {
    const similarity = (error.similarity * 100).toFixed(0);

    if (error.type === 'substitution') {
      return `'${error.predicted}' → '${error.reference}' (${similarity}% similar)`;
    } else if (error.type === 'deletion') {
      return `Missing: '${error.reference}'`;
    } else {
      return `Extra: '${error.predicted}'`;
    }
  }

  /**
   * Main analysis function - processes audio and returns complete results
   */
  async analyzeAudio(audioPath: string, referenceText: string): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      console.log('🎤 Starting pronunciation analysis...');
      console.log('Reference text:', referenceText);

      // 1. Load and preprocess audio
      const audio = await this.loadAudio(audioPath);

      // 2. Run wav2vec2 inference
      const predictedPhonemes = await this.runInference(audio);

      // 3. Convert reference text to phonemes
      const referencePhonemes = this.textToPhonemes(referenceText);

      // 4. Align phonemes
      const alignment = this.alignPhonemes(predictedPhonemes, referencePhonemes);

      // 5. Extract word-level analysis
      const wordLevelAnalysis = this.extractWordLevelAnalysis(
        alignment,
        referenceText,
        predictedPhonemes
      );

      // 6. Generate feedback
      const feedback = this.generateFeedback(alignment, referenceText);

      const processingTime = (Date.now() - startTime) / 1000;

      console.log('✅ Analysis complete!');
      console.log(`Processing time: ${processingTime.toFixed(2)}s`);

      return {
        accuracy: alignment.accuracy,
        correct_phonemes: alignment.correct_phonemes,
        total_phonemes: alignment.total_phonemes,
        predicted_phonemes: alignment.predicted_phonemes,
        reference_phonemes: alignment.reference_phonemes,
        mispronunciations: alignment.mispronunciations,
        word_level_analysis: wordLevelAnalysis,
        feedback,
        processing_time: processingTime
      };
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      throw error;
    }
  }

  /**
   * Batch analyze multiple audio files
   */
  async batchAnalyze(audioFiles: { path: string; referenceText: string }[]): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];

    for (const file of audioFiles) {
      try {
        const result = await this.analyzeAudio(file.path, file.referenceText);
        results.push(result);
      } catch (error) {
        console.error(`Failed to analyze ${file.path}:`, error);
        // Continue with next file
      }
    }

    return results;
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // ONNX Runtime doesn't have explicit dispose in React Native
      this.session = null;
      console.log('✅ Resources cleaned up');
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const pronunciationAnalyzer = new OnDevicePronunciationAnalyzer();