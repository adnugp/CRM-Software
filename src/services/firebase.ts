// firebase.ts

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI",
  authDomain: "crm-gpt-2026.firebaseapp.com",
  projectId: "crm-gpt-2026",
  storageBucket: "crm-gpt-2026.firebasestorage.app",
  messagingSenderId: "1041174966108",
  appId: "1:1041174966108:web:171f4acd2017d0256c5b99",
  measurementId: "G-43ZZ93G0VT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics (ONLY if browser + production)
// const analytics = getAnalytics(app);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
