// services/phonemeFirebaseService.ts
import { ref, set, get, update, push, onValue, off } from 'firebase/database';
import { database, auth } from '../lib/firebase';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PhonemeAnalysis {
  phoneme: string;
  status: 'correct' | 'partial' | 'mispronounced';
  accuracy: number;
  feedback: string;
  reference_phoneme: string;
  predicted_phoneme: string;
}

export interface PhonemePracticeAttempt {
  timestamp: string;
  accuracy: number;
  feedback: string;
  predicted_phoneme: string;
  reference_phoneme: string;
}

export interface PhonemePracticeData {
  phoneme: string;
  word: string;
  attempts: PhonemePracticeAttempt[];
  bestScore: number;
  totalAttempts: number;
  mastered: boolean;
  lastAttempted: string;
}

export interface WordPhonemeData {
  word: string;
  wordId: string;
  difficulty: 'easy' | 'intermediate' | 'hard';
  phonetic: string;
  reference_phonemes: string[];
  predicted_phonemes: string[];
  aligned_reference: string[];
  aligned_predicted: string[];
  status: 'correct' | 'partial' | 'mispronounced';
  accuracy: number;
  totalAttempts: number;
  bestScore: number;
  lastAttempted: string;
  phoneme_breakdown: PhonemeAnalysis[];
}

export interface DailyWordData {
  word: string;
  date: string;
  phonetic: string;
  accuracy: number;
  completed: boolean;
  mastered: boolean;
  attempts: number;
  bestScore: number;
  lastAttempted: string;
  reference_phonemes?: string[];
  predicted_phonemes?: string[];
  aligned_reference?: string[];
  aligned_predicted?: string[];
  phoneme_breakdown?: PhonemeAnalysis[];
}

// ============================================================================
// FIREBASE PATH HELPERS
// ============================================================================

const getUserPath = (userId: string) => `users/${userId}`;
const getPhonemeDataPath = (userId: string) => `${getUserPath(userId)}/phonemeData`;
const getWordPhonemeDataPath = (userId: string, wordId: string) => 
  `${getPhonemeDataPath(userId)}/words/${wordId}`;
const getPhonemePracticePath = (userId: string, phoneme: string) => 
  `${getPhonemeDataPath(userId)}/phonemePractices/${phoneme}`;
const getDailyWordPath = (userId: string, date: string) => 
  `${getPhonemeDataPath(userId)}/dailyWords/${date}`;
const getWordProgressPath = (userId: string, difficulty: string, wordId: string) =>
  `${getUserPath(userId)}/wordProgress/${difficulty}/${wordId}`;

// ============================================================================
// WORD-LEVEL PHONEME DATA
// ============================================================================

/**
 * Save or update word-level phoneme analysis data
 */
export const saveWordPhonemeData = async (
  wordId: string,
  wordData: Partial<WordPhonemeData>
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const wordPath = getWordPhonemeDataPath(user.uid, wordId);
    const existingData = await get(ref(database, wordPath));
    
    const dataToSave: WordPhonemeData = {
      ...existingData.val(),
      ...wordData,
      wordId,
      lastAttempted: new Date().toISOString(),
      totalAttempts: (existingData.val()?.totalAttempts || 0) + 1,
      bestScore: Math.max(
        existingData.val()?.bestScore || 0,
        wordData.accuracy || 0
      ),
    } as WordPhonemeData;

    await set(ref(database, wordPath), dataToSave);
    console.log(`✅ Saved word phoneme data for: ${wordId}`);
    return true;
  } catch (error) {
    console.error('Error saving word phoneme data:', error);
    return false;
  }
};

/**
 * Get word-level phoneme analysis data
 */
export const getWordPhonemeData = async (
  wordId: string
): Promise<WordPhonemeData | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const wordPath = getWordPhonemeDataPath(user.uid, wordId);
    const snapshot = await get(ref(database, wordPath));
    
    if (snapshot.exists()) {
      return snapshot.val() as WordPhonemeData;
    }
    return null;
  } catch (error) {
    console.error('Error getting word phoneme data:', error);
    return null;
  }
};

/**
 * Get all word phoneme data for a difficulty level
 */
export const getAllWordPhonemeData = async (
  difficulty?: 'easy' | 'intermediate' | 'hard'
): Promise<Record<string, WordPhonemeData>> => {
  try {
    const user = auth.currentUser;
    if (!user) return {};

    const phonemeDataPath = getPhonemeDataPath(user.uid);
    const snapshot = await get(ref(database, `${phonemeDataPath}/words`));
    
    if (snapshot.exists()) {
      const allData = snapshot.val();
      
      if (difficulty) {
        const filtered: Record<string, WordPhonemeData> = {};
        Object.entries(allData).forEach(([key, value]) => {
          if ((value as WordPhonemeData).difficulty === difficulty) {
            filtered[key] = value as WordPhonemeData;
          }
        });
        return filtered;
      }
      
      return allData;
    }
    return {};
  } catch (error) {
    console.error('Error getting all word phoneme data:', error);
    return {};
  }
};

// ============================================================================
// PHONEME-LEVEL PRACTICE DATA
// ============================================================================

/**
 * Save phoneme practice attempt
 */
export const savePhonemeAttempt = async (
  phoneme: string,
  word: string,
  attempt: PhonemePracticeAttempt
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const phonemePath = getPhonemePracticePath(user.uid, phoneme);
    const existingData = await get(ref(database, phonemePath));
    
    const currentData: PhonemePracticeData = existingData.val() || {
      phoneme,
      word,
      attempts: [],
      bestScore: 0,
      totalAttempts: 0,
      mastered: false,
      lastAttempted: new Date().toISOString(),
    };

    // Add new attempt to beginning of array (most recent first)
    currentData.attempts = [attempt, ...currentData.attempts].slice(0, 10); // Keep last 10
    currentData.totalAttempts = (currentData.totalAttempts || 0) + 1;
    currentData.bestScore = Math.max(currentData.bestScore, attempt.accuracy);
    currentData.lastAttempted = attempt.timestamp;
    currentData.mastered = currentData.bestScore >= 0.9;
    currentData.word = word;

    await set(ref(database, phonemePath), currentData);
    console.log(`✅ Saved phoneme practice for: ${phoneme}`);
    return true;
  } catch (error) {
    console.error('Error saving phoneme attempt:', error);
    return false;
  }
};

/**
 * Get phoneme practice data
 */
export const getPhonemeData = async (
  phoneme: string
): Promise<PhonemePracticeData | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const phonemePath = getPhonemePracticePath(user.uid, phoneme);
    const snapshot = await get(ref(database, phonemePath));
    
    if (snapshot.exists()) {
      return snapshot.val() as PhonemePracticeData;
    }
    return null;
  } catch (error) {
    console.error('Error getting phoneme data:', error);
    return null;
  }
};

/**
 * Get all phoneme practice data
 */
export const getAllPhonemeData = async (): Promise<Record<string, PhonemePracticeData>> => {
  try {
    const user = auth.currentUser;
    if (!user) return {};

    const phonemeDataPath = getPhonemeDataPath(user.uid);
    const snapshot = await get(ref(database, `${phonemeDataPath}/phonemePractices`));
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  } catch (error) {
    console.error('Error getting all phoneme data:', error);
    return {};
  }
};

// ============================================================================
// DAILY WORD DATA
// ============================================================================

/**
 * Save daily word practice data
 */
export const saveDailyWordData = async (
  date: string,
  dailyWordData: Partial<DailyWordData>
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const dailyPath = getDailyWordPath(user.uid, date);
    const existingData = await get(ref(database, dailyPath));
    
    const dataToSave: DailyWordData = {
      ...existingData.val(),
      ...dailyWordData,
      date,
      lastAttempted: new Date().toISOString(),
      attempts: (existingData.val()?.attempts || 0) + 1,
      bestScore: Math.max(
        existingData.val()?.bestScore || 0,
        dailyWordData.accuracy || 0
      ),
      completed: (dailyWordData.accuracy || 0) >= 0.7,
      mastered: (dailyWordData.accuracy || 0) >= 0.9,
    } as DailyWordData;

    await set(ref(database, dailyPath), dataToSave);
    console.log(`✅ Saved daily word data for: ${date}`);
    return true;
  } catch (error) {
    console.error('Error saving daily word data:', error);
    return false;
  }
};

/**
 * Get daily word data
 */
export const getDailyWordData = async (date: string): Promise<DailyWordData | null> => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    const dailyPath = getDailyWordPath(user.uid, date);
    const snapshot = await get(ref(database, dailyPath));
    
    if (snapshot.exists()) {
      return snapshot.val() as DailyWordData;
    }
    return null;
  } catch (error) {
    console.error('Error getting daily word data:', error);
    return null;
  }
};

/**
 * Get all daily word data
 */
export const getAllDailyWordData = async (): Promise<Record<string, DailyWordData>> => {
  try {
    const user = auth.currentUser;
    if (!user) return {};

    const phonemeDataPath = getPhonemeDataPath(user.uid);
    const snapshot = await get(ref(database, `${phonemeDataPath}/dailyWords`));
    
    if (snapshot.exists()) {
      return snapshot.val();
    }
    return {};
  } catch (error) {
    console.error('Error getting all daily word data:', error);
    return {};
  }
};

// ============================================================================
// WORD PROGRESS INTEGRATION
// ============================================================================

/**
 * Update word progress with phoneme data
 */
export const updateWordProgressWithPhonemes = async (
  difficulty: string,
  wordId: string,
  scores: {
    accuracy: number;
    reference_phonemes?: string[];
    predicted_phonemes?: string[];
    aligned_reference?: string[];
    aligned_predicted?: string[];
    correct_phonemes?: number;
    total_phonemes?: number;
    feedback?: string;
  }
): Promise<boolean> => {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.error('No authenticated user');
      return false;
    }

    const progressPath = getWordProgressPath(user.uid, difficulty, wordId);
    const existingProgress = await get(ref(database, progressPath));
    
    const updatedProgress = {
      ...existingProgress.val(),
      scores: {
        accuracy: scores.accuracy,
        correct_phonemes: scores.correct_phonemes || 0,
        total_phonemes: scores.total_phonemes || 0,
        feedback: scores.feedback || '',
        reference_phonemes: scores.reference_phonemes || [],
        predicted_phonemes: scores.predicted_phonemes || [],
        aligned_reference: scores.aligned_reference || [],
        aligned_predicted: scores.aligned_predicted || [],
      },
      lastAttempted: new Date().toISOString(),
      attempts: (existingProgress.val()?.attempts || 0) + 1,
      bestScore: Math.max(existingProgress.val()?.bestScore || 0, scores.accuracy),
      completed: scores.accuracy >= 0.7,
      mastered: scores.accuracy >= 0.9,
    };

    await update(ref(database, progressPath), updatedProgress);
    console.log(`✅ Updated word progress with phonemes: ${wordId}`);
    return true;
  } catch (error) {
    console.error('Error updating word progress:', error);
    return false;
  }
};

// ============================================================================
// REAL-TIME LISTENERS
// ============================================================================

/**
 * Listen to word phoneme data changes
 */
export const subscribeToWordPhonemeData = (
  wordId: string,
  callback: (data: WordPhonemeData | null) => void
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const wordPath = getWordPhonemeDataPath(user.uid, wordId);
  const wordRef = ref(database, wordPath);

  const listener = onValue(wordRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val() as WordPhonemeData);
    } else {
      callback(null);
    }
  });

  // Return unsubscribe function
  return () => off(wordRef, 'value', listener);
};

/**
 * Listen to all phoneme practice data changes
 */
export const subscribeToAllPhonemeData = (
  callback: (data: Record<string, PhonemePracticeData>) => void
): (() => void) => {
  const user = auth.currentUser;
  if (!user) return () => {};

  const phonemeDataPath = getPhonemeDataPath(user.uid);
  const phonemeRef = ref(database, `${phonemeDataPath}/phonemePractices`);

  const listener = onValue(phonemeRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback({});
    }
  });

  // Return unsubscribe function
  return () => off(phonemeRef, 'value', listener);
};

export default {
  saveWordPhonemeData,
  getWordPhonemeData,
  getAllWordPhonemeData,
  savePhonemeAttempt,
  getPhonemeData,
  getAllPhonemeData,
  saveDailyWordData,
  getDailyWordData,
  getAllDailyWordData,
  updateWordProgressWithPhonemes,
  subscribeToWordPhonemeData,
  subscribeToAllPhonemeData,
};
