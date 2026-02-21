import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

// --- 1. PARTNERS (Updated to 10 items) ---
const samplePartners = [
  { id: '1', name: 'Tech Solutions Inc', type: 'Technology Partner', status: 'Active', region: 'Middle East', email: 'contact@techsol.com' },
  { id: '2', name: 'Global Logistics Co', type: 'Logistics Partner', status: 'Active', region: 'Global', email: 'support@global.com' },
  { id: '3', name: 'Microsoft', type: 'Technology Partner', status: 'Active', region: 'Global', email: 'partners@microsoft.com' },
  { id: '4', name: 'AWS Cloud Services', type: 'Technology Partner', status: 'Active', region: 'Global', email: 'aws-sales@amazon.com' },
  { id: '5', name: 'Oracle', type: 'Database Partner', status: 'Active', region: 'Middle East', email: 'oracle.ae@oracle.com' },
  { id: '6', name: 'Cisco Systems', type: 'Network Partner', status: 'Active', region: 'Global', email: 'info@cisco.com' },
  { id: '7', name: 'Dell Technologies', type: 'Hardware Partner', status: 'Inactive', region: 'Europe', email: 'partners@dell.com' },
  { id: '8', name: 'IBM', type: 'AI Partner', status: 'Active', region: 'Global', email: 'watson@ibm.com' },
  { id: '9', name: 'SAP', type: 'ERP Partner', status: 'Active', region: 'Germany', email: 'sap-cloud@sap.com' },
  { id: '10', name: 'Salesforce', type: 'CRM Partner', status: 'Active', region: 'USA', email: 'hello@salesforce.com' }
];

// --- 2. REGISTRATIONS (Fixed "undefined" issue) ---
const sampleRegistrations = [
  { id: '1', name: 'Commercial License', company: 'Grow Plus', type: 'Business', status: 'Active', expiryDate: '2025-10-20', authority: 'Dubai Economy' },
  { id: '2', name: 'Trade License', company: 'Sadeem Energy', type: 'Trade', status: 'Expired', expiryDate: '2023-05-15', authority: 'Chamber of Commerce' }
];

// --- 3. PAYMENTS (Fixed amounts for calculation) ---
const samplePayments = [
  { id: '1', client: 'Microsoft', amount: 15000, status: 'Pending', dueDate: '2024-06-01', description: 'License fee' },
  { id: '2', client: 'Google', amount: 5000, status: 'Paid', dueDate: '2024-01-15', description: 'Cloud storage' },
  { id: '3', client: 'Amazon', amount: 2500, status: 'Overdue', dueDate: '2023-12-20', description: 'Maintenance' },
  { id: '4', client: 'Grow Plus', amount: 50000, status: 'Pending', dueDate: '2024-07-01', description: 'Project Advance' }
];

// --- 4. FILES (For "larger than 1MB" test) ---
const sampleFiles = [
  { id: '1', name: 'Q1_Financial_Report.pdf', type: 'application/pdf', size: 2500000, category: 'Report', status: 'Active' }, // 2.5MB
  { id: '2', name: 'Project_Blueprint.png', type: 'image/png', size: 500000, category: 'Image', status: 'Archived' }, // 0.5MB
  { id: '3', name: 'High_Res_Logo.psd', type: 'image/psd', size: 15000000, category: 'Design', status: 'Active' } // 15MB
];

// --- 5. OTHER DATA (Keep existing) ---
const sampleTenders = [
  { id: '1', name: 'Government Portal', company: 'Ministry of Technology', status: 'open', assignedToName: 'Mohamed Ismayil' },
  { id: '2', name: 'Smart City', company: 'Dubai Municipality', status: 'submitted', assignedToName: 'Mohamed Ajumal' },
  { id: '3', name: 'Healthcare System', company: 'DHA', status: 'awarded', assignedToName: 'Mohamed Ajumal' }
];
const sampleEmployees = [
  { id: '1', name: 'Mohamed Ismayil', department: 'Engineering', status: 'active', email: 'mmismayil2003@gmail.com' },
  { id: '2', name: 'Mohamed Ajumal', department: 'Sales', status: 'active', email: 'ajumal@gptechnologies.ae' }
];
const sampleProjects = [
  { id: '1', name: 'AI Bot', company: 'Grow Plus', status: 'In Progress', assignedToName: 'Mohamed Ajumal' },
  { id: '2', name: 'Solar Grid', company: 'Sadeem Energy', status: 'Completed', assignedToName: 'Mohamed Ismayil' }
];

// --- SEEDING FUNCTION ---
const seedFirestore = async () => {
  try {
    console.log('🚀 Updating Firestore with CORRECTED data (10 Partners)...');
    const uploadList = async (col, list) => {
      for (const item of list) await setDoc(doc(db, col, item.id), item);
      console.log(`✅ ${col}: ${list.length} items`);
    };

    await uploadList('partners', samplePartners);
    await uploadList('registrations', sampleRegistrations);
    await uploadList('payments', samplePayments);
    await uploadList('files', sampleFiles);
    await uploadList('tenders', sampleTenders);
    await uploadList('employees', sampleEmployees);
    await uploadList('projects', sampleProjects);
    
    console.log('🎉 Data fixed successfully! You now have 10 Partners.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

seedFirestore();