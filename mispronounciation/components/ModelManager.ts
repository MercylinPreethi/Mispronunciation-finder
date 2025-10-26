/**
 * ModelManager.ts
 * 
 * Purpose: Manages the ONNX model lifecycle
 * - Loads model once on app startup
 * - Caches model location
 * - Tracks loading state
 * - Provides status checks
 * 
 * Think of this as a "librarian" for your 316 MB model:
 * - Opens the library (loads model) once when app starts
 * - Remembers where books are (caches path)
 * - Tells you if library is open (isLoaded status)
 * - Prevents opening library twice (singleton pattern)
 */

import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pronunciationAnalyzer } from './OnDevicePronunciationAnalyzer';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for your INT8 model
 * Update these values based on your setup
 */
const MODEL_CONFIG = {
  name: 'wav2vec2_phoneme_int8.onnx',
  version: '1.0.0',
  size: 331350016,  // 316 MB in bytes (exact size of your model)
  
  // If you host model on CDN, update this URL:
  url: '',
  
  // Set to true if model is bundled with app in assets folder
  // Set to false if model should be downloaded from CDN
  bundled: true,
};

/**
 * Storage keys for caching model information
 */
const STORAGE_KEYS = {
  MODEL_PATH: 'model_path_int8',
  MODEL_VERSION: 'model_version',
  MODEL_LOADED: 'model_loaded_timestamp',
};

// ============================================================================
// MODEL MANAGER CLASS
// ============================================================================

/**
 * ModelManager handles all model loading and lifecycle
 * 
 * Key Features:
 * - Singleton pattern (only one instance exists)
 * - Loads model only once
 * - Caches model path for fast subsequent loads
 * - Progress tracking during load
 * - Error handling
 */
export class ModelManager {
  // Singleton instance
  private static instance: ModelManager;
  
  // Model state
  private isLoaded: boolean = false;
  private modelPath: string | null = null;
  private loadingPromise: Promise<boolean> | null = null;

  /**
   * Private constructor ensures singleton pattern
   * Use ModelManager.getInstance() instead
   */
  private constructor() {
    console.log('🔧 ModelManager created');
  }

  /**
   * Get the singleton instance
   * Always use this instead of 'new ModelManager()'
   */
  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager();
    }
    return ModelManager.instance;
  }

  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Initialize and load the model
   * Call this once in App.tsx when app starts
   * 
   * @param onProgress - Optional callback for loading progress (0 to 1)
   * @returns true if successful, false otherwise
   * 
   * Example:
   *   await modelManager.initialize((progress) => {
   *     console.log(`Loading: ${(progress * 100).toFixed(0)}%`);
   *   });
   */
  async initialize(onProgress?: (progress: number) => void): Promise<boolean> {
    // If already loaded, return immediately
    if (this.isLoaded && this.modelPath) {
      console.log('✅ Model already loaded');
      onProgress?.(1.0);
      return true;
    }

    // If currently loading, wait for that to finish
    if (this.loadingPromise) {
      console.log('⏳ Model loading in progress, waiting...');
      return this.loadingPromise;
    }

    // Start loading
    this.loadingPromise = this._loadModel(onProgress);
    const result = await this.loadingPromise;
    this.loadingPromise = null;
    
    return result;
  }

  /**
   * Check if model is loaded and ready to use
   * Call this before analyzing audio
   * 
   * @returns true if model is ready, false otherwise
   * 
   * Example:
   *   if (modelManager.isModelLoaded()) {
   *     // Safe to analyze
   *   } else {
   *     // Show loading message
   *   }
   */
  isModelLoaded(): boolean {
    return this.isLoaded;
  }

  /**
   * Get information about the loaded model
   * Useful for debugging and UI display
   * 
   * @returns Object with model details
   * 
   * Example:
   *   const info = modelManager.getModelInfo();
   *   console.log(info);
   *   // { name: 'wav2vec2_phoneme_int8.onnx', size: '316 MB', ... }
   */
  getModelInfo() {
    return {
      name: MODEL_CONFIG.name,
      version: MODEL_CONFIG.version,
      size: `${(MODEL_CONFIG.size / 1024 / 1024).toFixed(0)} MB`,
      type: 'INT8 Quantized',
      loaded: this.isLoaded,
      path: this.modelPath,
      bundled: MODEL_CONFIG.bundled,
    };
  }

  /**
   * Unload model from memory
   * Call this to free memory when model is no longer needed
   * 
   * @returns Promise that resolves when model is unloaded
   * 
   * Example:
   *   await modelManager.unload();
   *   // 316 MB of memory freed!
   */
  async unload(): Promise<void> {
    if (!this.isLoaded) {
      console.log('⚠️ Model not loaded, nothing to unload');
      return;
    }

    try {
      await pronunciationAnalyzer.dispose();
      this.isLoaded = false;
      this.modelPath = null;
      console.log('✅ Model unloaded, memory freed');
    } catch (error) {
      console.error('❌ Failed to unload model:', error);
      throw error;
    }
  }

  /**
   * Clear cached model data
   * Useful for troubleshooting or forcing fresh download
   * 
   * @returns Promise that resolves when cache is cleared
   */
  async clearCache(): Promise<void> {
    try {
      console.log('🗑️ Clearing model cache...');
      
      // Remove cached keys
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.MODEL_PATH,
        STORAGE_KEYS.MODEL_VERSION,
        STORAGE_KEYS.MODEL_LOADED,
      ]);

      // Delete downloaded model file (if exists)
      const modelPath = `${FileSystem.documentDirectory}${MODEL_CONFIG.name}`;
      const info = await FileSystem.getInfoAsync(modelPath);
      
      if (info.exists) {
        await FileSystem.deleteAsync(modelPath);
        console.log('✅ Downloaded model deleted');
      }

      console.log('✅ Cache cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear cache:', error);
      throw error;
    }
  }

  // ==========================================================================
  // PRIVATE METHODS (Internal use only)
  // ==========================================================================

  /**
   * Internal method: Load model into memory
   */
  private async _loadModel(onProgress?: (progress: number) => void): Promise<boolean> {
    try {
      console.log('📦 Initializing INT8 model (316 MB)...');
      onProgress?.(0);

      // Step 1: Get model file path (from bundle or download)
      onProgress?.(0.1);
      this.modelPath = await this._getModelPath(onProgress);

      if (!this.modelPath) {
        throw new Error('Failed to get model path');
      }

      // Step 2: Verify model file exists and is correct size
      onProgress?.(0.7);
      const isValid = await this._verifyModel(this.modelPath);
      if (!isValid) {
        throw new Error('Model file verification failed');
      }

      // Step 3: Load model into ONNX Runtime
      onProgress?.(0.8);
      console.log('🔧 Loading model into ONNX Runtime...');
      await pronunciationAnalyzer.loadModel(this.modelPath);

      // Step 4: Mark as loaded and cache timestamp
      this.isLoaded = true;
      await AsyncStorage.setItem(
        STORAGE_KEYS.MODEL_LOADED, 
        Date.now().toString()
      );
      
      onProgress?.(1.0);
      console.log('✅ INT8 model loaded successfully');
      console.log('📊 Model info:', this.getModelInfo());
      
      return true;

    } catch (error) {
      console.error('❌ Model loading failed:', error);
      this.isLoaded = false;
      this.modelPath = null;
      throw error;
    }
  }

  /**
   * Internal method: Get model file path
   * Either from bundle or by downloading
   */
  private async _getModelPath(onProgress?: (progress: number) => void): Promise<string | null> {
    if (MODEL_CONFIG.bundled) {
      return this._loadBundledModel(onProgress);
    } else {
      return this._downloadModel(onProgress);
    }
  }

  /**
   * Internal method: Load model from app bundle
   */
  private async _loadBundledModel(onProgress?: (progress: number) => void): Promise<string | null> {
    try {
      console.log('📦 Loading bundled INT8 model...');
      
      // Check if we have cached path
      const cachedPath = await AsyncStorage.getItem(STORAGE_KEYS.MODEL_PATH);
      if (cachedPath) {
        const info = await FileSystem.getInfoAsync(cachedPath);
        if (info.exists && info.size === MODEL_CONFIG.size) {
          console.log('✅ Using cached model path');
          onProgress?.(0.6);
          return cachedPath;
        }
      }

      onProgress?.(0.2);

      // Load from bundle
      console.log('📥 Loading model from bundle...');
      const modelAsset = await Asset.fromModule(
        require('../assets/models/wav2vec2_phoneme_int8.onnx')
      );

      onProgress?.(0.4);

      await modelAsset.downloadAsync();

      onProgress?.(0.6);

      if (!modelAsset.localUri) {
        throw new Error('Model asset has no local URI');
      }

      // Cache the path for next time
      await AsyncStorage.setItem(STORAGE_KEYS.MODEL_PATH, modelAsset.localUri);
      
      console.log('✅ Bundled model ready:', modelAsset.localUri);
      return modelAsset.localUri;

    } catch (error) {
      console.error('❌ Failed to load bundled model:', error);
      return null;
    }
  }

  /**
   * Internal method: Download model from CDN
   */
  private async _downloadModel(onProgress?: (progress: number) => void): Promise<string | null> {
    try {
      const modelPath = `${FileSystem.documentDirectory}${MODEL_CONFIG.name}`;
      
      // Check if already downloaded
      const info = await FileSystem.getInfoAsync(modelPath);
      if (info.exists && info.size === MODEL_CONFIG.size) {
        console.log('✅ Model already downloaded');
        onProgress?.(0.6);
        return modelPath;
      }

      console.log('📥 Downloading INT8 model (316 MB)...');
      console.log('⏱️ This may take a few minutes on first launch');

      onProgress?.(0.1);

      // Create resumable download with progress tracking
      const downloadResumable = FileSystem.createDownloadResumable(
        MODEL_CONFIG.url,
        modelPath,
        {},
        (downloadProgress) => {
          const progress = 
            downloadProgress.totalBytesWritten / 
            downloadProgress.totalBytesExpectedToWrite;
          
          // Map download progress (0-1) to 0.1-0.6 range
          const mappedProgress = 0.1 + (progress * 0.5);
          onProgress?.(mappedProgress);
          
          // Log every 10%
          if (progress < 1 && Math.floor(progress * 10) % 1 === 0) {
            console.log(`📥 Download: ${(progress * 100).toFixed(0)}%`);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      
      if (!result || !result.uri) {
        throw new Error('Download failed - no result URI');
      }

      console.log('✅ Model downloaded successfully');
      
      // Verify download size
      const finalInfo = await FileSystem.getInfoAsync(result.uri);
      if (!finalInfo.exists || finalInfo.size !== MODEL_CONFIG.size) {
        throw new Error(
          `Downloaded model size mismatch. ` +
          `Expected ${MODEL_CONFIG.size}, got ${finalInfo.size}`
        );
      }

      // Cache the path and version
      await AsyncStorage.setItem(STORAGE_KEYS.MODEL_PATH, result.uri);
      await AsyncStorage.setItem(STORAGE_KEYS.MODEL_VERSION, MODEL_CONFIG.version);

      return result.uri;

    } catch (error) {
      console.error('❌ Model download failed:', error);
      return null;
    }
  }

  /**
   * Internal method: Verify model file integrity
   */
  private async _verifyModel(path: string): Promise<boolean> {
    try {
      console.log('🔍 Verifying model file...');
      
      const info = await FileSystem.getInfoAsync(path);
      
      // Check file exists
      if (!info.exists) {
        console.error('❌ Model file does not exist at:', path);
        return false;
      }

      // Check file size matches expected size
      if (info.size !== MODEL_CONFIG.size) {
        console.error(
          `❌ Model size mismatch\n` +
          `   Expected: ${MODEL_CONFIG.size} bytes (${(MODEL_CONFIG.size / 1024 / 1024).toFixed(0)} MB)\n` +
          `   Actual: ${info.size} bytes (${(info.size / 1024 / 1024).toFixed(0)} MB)`
        );
        return false;
      }

      console.log('✅ Model file verified successfully');
      console.log(`   Size: ${(info.size / 1024 / 1024).toFixed(0)} MB`);
      console.log(`   Path: ${path}`);
      
      return true;

    } catch (error) {
      console.error('❌ Model verification failed:', error);
      return false;
    }
  }
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

/**
 * Export singleton instance for use throughout the app
 * 
 * Usage in your screens:
 * 
 *   import { modelManager } from './lib/ModelManager';
 * 
 *   // In App.tsx:
 *   await modelManager.initialize();
 * 
 *   // In any screen:
 *   if (modelManager.isModelLoaded()) {
 *     // Analyze audio
 *   }
 */
export const modelManager = ModelManager.getInstance();

/**
 * Example Usage:
 * 
 * // In App.tsx (on startup):
 * import { modelManager } from './lib/ModelManager';
 * 
 * useEffect(() => {
 *   initModel();
 * }, []);
 * 
 * const initModel = async () => {
 *   const success = await modelManager.initialize((progress) => {
 *     console.log(`Loading model: ${(progress * 100).toFixed(0)}%`);
 *   });
 *   
 *   if (success) {
 *     console.log('Model ready!');
 *   }
 * };
 * 
 * 
 * // In your screens (before analysis):
 * if (!modelManager.isModelLoaded()) {
 *   Alert.alert('Please wait', 'Model is loading...');
 *   return;
 * }
 * 
 * // Now safe to analyze
 * const result = await analyzeAudio({ ... });
 */