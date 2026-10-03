import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getAuth, connectAuthEmulator } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crm-gpt-2026.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "crm-gpt-2026",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "crm-gpt-2026.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1041174966108",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1041174966108:web:171f4acd2017d0256c5b99",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-43ZZ93G0VT"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8081);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectAuthEmulator(getAuth(app), 'http://127.0.0.1:9099', { disableWarnings: true });
}

export default app;
