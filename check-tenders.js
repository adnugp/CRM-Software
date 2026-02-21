import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, where } from 'firebase/firestore';

// Firebase configuration
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
const db = getFirestore(app);

const checkTenders = async () => {
  try {
    console.log('🔍 Checking current tenders in Firestore...\n');
    
    // Get all tenders
    const allTendersQuery = query(collection(db, 'tenders'), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(allTendersQuery);
    const allTenders = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📊 Total tenders in Firestore: ${allTenders.length}`);
    
    // Get submitted tenders
    const submittedQuery = query(collection(db, 'tenders'), where('status', '==', 'submitted'));
    const submittedSnapshot = await getDocs(submittedQuery);
    const submittedTenders = submittedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📤 Submitted tenders: ${submittedTenders.length}\n`);
    
    if (submittedTenders.length > 0) {
      console.log('📋 Submitted tenders details:');
      submittedTenders.forEach((tender, index) => {
        console.log(`${index + 1}. ${tender.name || 'No name'} - ${tender.company || 'No company'} - Assigned: ${tender.assignedToName || 'No assignee'} - Belongs to: ${tender.belongsTo || 'Not specified'} - Deadline: ${tender.deadline || 'No deadline'}`);
      });
    }
    
    console.log('\n📋 All tenders in Firestore:');
    allTenders.forEach((tender, index) => {
      console.log(`${index + 1}. ${tender.name || 'No name'} - Status: ${tender.status || 'No status'} - Company: ${tender.company || 'No company'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking tenders:', error);
  }
  
  process.exit(0);
};

checkTenders();
