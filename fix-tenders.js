import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, where, doc, setDoc, deleteDoc } from 'firebase/firestore';

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

// Correct tender data based on mock data
const correctTenders = [
  { 
    id: '1', 
    name: 'Government Portal Development', 
    company: 'Ministry of Technology', 
    belongsTo: 'Grow Plus Technologies', 
    status: 'open', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-03-25', 
    document: 'tender_specs.pdf', 
    description: 'E-government portal development',
    createdAt: new Date('2024-01-01')
  },
  { 
    id: '2', 
    name: 'Smart City Infrastructure', 
    company: 'Dubai Municipality', 
    belongsTo: 'Sadeem Energy', 
    status: 'submitted', 
    assignedTo: '2', 
    assignedToName: 'Mohamed Ajumal', 
    deadline: '2024-04-15', 
    document: 'smart_city.pdf', 
    description: 'IoT infrastructure for smart city',
    createdAt: new Date('2024-01-02')
  },
  { 
    id: '3', 
    name: 'Healthcare Management System', 
    company: 'DHA', 
    belongsTo: 'Grow Plus Technologies', 
    status: 'awarded', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-05-01', 
    document: 'healthcare_system.pdf', 
    description: 'Hospital management software',
    createdAt: new Date('2024-01-03')
  },
  { 
    id: '4', 
    name: 'Banking Software Upgrade', 
    company: 'National Bank', 
    belongsTo: 'Sadeem Energy', 
    status: 'closed', 
    assignedTo: '2', 
    assignedToName: 'Mohamed Ajumal', 
    deadline: '2024-02-20', 
    document: 'banking_upgrade.pdf', 
    description: 'Core banking system upgrade',
    createdAt: new Date('2024-01-04')
  },
  { 
    id: '5', 
    name: 'Education Platform', 
    company: 'Ministry of Education', 
    belongsTo: 'Grow Plus Technologies', 
    status: 'open', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-04-30', 
    document: 'education_platform.pdf', 
    description: 'E-learning platform development',
    createdAt: new Date('2024-01-05')
  },
  { 
    id: '6', 
    name: 'Transport Management System', 
    company: 'RTA', 
    belongsTo: 'Sadeem Energy', 
    status: 'submitted', 
    assignedTo: '2', 
    assignedToName: 'Mohamed Ajumal', 
    deadline: '2024-06-15', 
    document: 'transport_system.pdf', 
    description: 'Public transport management system',
    createdAt: new Date('2024-01-06')
  },
  { 
    id: '7', 
    name: 'Security Solutions', 
    company: 'Dubai Police', 
    belongsTo: 'Grow Plus Technologies', 
    status: 'open', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-07-20', 
    document: 'security_solutions.pdf', 
    description: 'Advanced security monitoring system',
    createdAt: new Date('2024-01-07')
  },
  { 
    id: '8', 
    name: 'Energy Management Platform', 
    company: 'DEWA', 
    belongsTo: 'Sadeem Energy', 
    status: 'awarded', 
    assignedTo: '2', 
    assignedToName: 'Mohamed Ajumal', 
    deadline: '2024-08-10', 
    document: 'energy_platform.pdf', 
    description: 'Smart energy monitoring and management',
    createdAt: new Date('2024-01-08')
  },
  { 
    id: '9', 
    name: 'Retail POS System', 
    company: 'Majid Al Futtaim', 
    belongsTo: 'Grow Plus Technologies', 
    status: 'submitted', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-09-05', 
    document: 'retail_pos.pdf', 
    description: 'Point of sale system for retail chain',
    createdAt: new Date('2024-01-09')
  },
  { 
    id: '10', 
    name: 'Logistics Tracking System', 
    company: 'Aramex', 
    belongsTo: 'Sadeem Energy', 
    status: 'open', 
    assignedTo: '2', 
    assignedToName: 'Mohamed Ajumal', 
    deadline: '2024-10-15', 
    document: 'logistics_tracking.pdf', 
    description: 'Real-time logistics and shipment tracking',
    createdAt: new Date('2024-01-10')
  }
];

const fixTenders = async () => {
  try {
    console.log('🔧 Fixing tender data in Firestore...\n');
    
    // Get current tenders
    const currentTendersQuery = query(collection(db, 'tenders'));
    const currentSnapshot = await getDocs(currentTendersQuery);
    const currentTenders = currentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📊 Current tenders in Firestore: ${currentTenders.length}`);
    
    // Delete all current tenders
    console.log('🗑️  Deleting current tenders...');
    for (const tender of currentTenders) {
      await deleteDoc(doc(db, 'tenders', tender.id));
    }
    console.log(`✅ Deleted ${currentTenders.length} tenders`);
    
    // Add correct tenders
    console.log('📝 Adding correct tenders...');
    for (const tender of correctTenders) {
      await setDoc(doc(db, 'tenders', tender.id), tender);
    }
    console.log(`✅ Added ${correctTenders.length} correct tenders`);
    
    // Verify the fix
    const verifyQuery = query(collection(db, 'tenders'), where('status', '==', 'submitted'));
    const verifySnapshot = await getDocs(verifyQuery);
    const submittedTenders = verifySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`\n✅ Verification complete!`);
    console.log(`📤 Submitted tenders: ${submittedTenders.length}`);
    console.log('\n📋 Submitted tenders after fix:');
    submittedTenders.forEach((tender, index) => {
      console.log(`${index + 1}. ${tender.name} - ${tender.company} - Assigned: ${tender.assignedToName} - Belongs to: ${tender.belongsTo} - Deadline: ${tender.deadline}`);
    });
    
    console.log('\n🎉 Tender data has been fixed! Now you should see exactly 3 submitted tenders in the UI.');
    
  } catch (error) {
    console.error('❌ Error fixing tenders:', error);
  }
  
  process.exit(0);
};

fixTenders();
