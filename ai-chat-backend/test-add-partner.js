import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI",
  authDomain: "crm-gpt-2026.firebaseapp.com",
  projectId: "crm-gpt-2026",
  storageBucket: "crm-gpt-2026.firebasestorage.app",
  messagingSenderId: "1041174966108",
  appId: "1:1041174966108:web:171f4acd2017d0256c5b99"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const addNewPartner = async () => {
  try {
    console.log("🚀 Simulating 'Add Partner' action...");
    
    // Add "Future AI Corp" to the partners collection
    await addDoc(collection(db, 'partners'), {
      name: 'Future AI Corp',
      type: 'Technology Partner',
      region: 'Japan',
      status: 'Active',
      email: 'contact@futureai.jp',
      createdAt: new Date()
    });

    console.log("✅ New partner 'Future AI Corp' added successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error adding partner:", error);
    process.exit(1);
  }
};

addNewPartner();