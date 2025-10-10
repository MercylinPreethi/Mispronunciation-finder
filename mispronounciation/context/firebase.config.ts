// firebase.config.ts
import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  // Replace with your actual Firebase configuration
  apiKey: "your-api-key-here",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-id-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456789012"
};

// Initialize Firebase only if it hasn't been initialized already
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize Auth with AsyncStorage persistence for React Native
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, use getAuth
  auth = getAuth(app);
}

// Initialize Firebase services
const db = getDatabase(app); // Realtime Database
const firestore = getFirestore(app); // Firestore
const storage = getStorage(app);

// For development/testing with Firebase emulators (optional)
// Uncomment the lines below if you're using Firebase emulators
/*
if (__DEV__) {
  try {
    connectFirestoreEmulator(firestore, 'localhost', 8080);
    connectStorageEmulator(storage, 'localhost', 9199);
  } catch (error) {
    console.log('Emulator connection error:', error);
  }
}
*/

export { auth, db, firestore, storage, app };
export default app;