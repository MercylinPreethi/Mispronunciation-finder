// lib/firebase.ts
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getDatabase, Database } from 'firebase/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyATKCD4oJsveTPwtzaUcRz28nqXtWJsQRo",
  authDomain: "mispronunciation-e1fb0.firebaseapp.com",
  databaseURL: "https://mispronunciation-e1fb0-default-rtdb.firebaseio.com/",
  projectId: "mispronunciation-e1fb0",
  storageBucket: "mispronunciation-e1fb0.firebasestorage.app",
  messagingSenderId: "329898480943",
  appId: "1:329898480943:android:84388a674d779a271afdda"
};

// Initialize Firebase only once
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (error) {
  // If auth is already initialized, use getAuth
  auth = getAuth(app);
}

// Initialize Database
const database: Database = getDatabase(app);

export { auth, database, app };