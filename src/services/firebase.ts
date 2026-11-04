import { initializeApp } from 'firebase/app';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

/**
 * When true (set in .env.development), the app talks to the local Firebase
 * emulators instead of the live project, so local work never touches real data.
 * Start them with `npm run emulators`. Use `npm run dev:live` to hit production.
 */
export const useEmulators = import.meta.env.VITE_USE_EMULATORS === 'true';

const liveConfig = {
  apiKey: "AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI",
  authDomain: "crm-gpt-2026.firebaseapp.com",
  projectId: "crm-gpt-2026",
  storageBucket: "crm-gpt-2026.firebasestorage.app",
  messagingSenderId: "1041174966108",
  appId: "1:1041174966108:web:171f4acd2017d0256c5b99",
  measurementId: "G-43ZZ93G0VT"
};

// A "demo-" project ID can never reach real Firebase services, even by mistake.
export const firebaseConfig = useEmulators
  ? { ...liveConfig, projectId: 'demo-crm', storageBucket: 'demo-crm.appspot.com' }
  : liveConfig;

export const EMULATOR_HOST = '127.0.0.1';
export const EMULATOR_PORTS = { auth: 9099, firestore: 8085, storage: 9199 } as const;

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

if (useEmulators) {
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORTS.firestore);
  connectStorageEmulator(storage, EMULATOR_HOST, EMULATOR_PORTS.storage);
}

export default app;
