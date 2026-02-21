import express from 'express';
import cron from 'node-cron';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';

// Load environment variables
dotenv.config();

// Fuzzy matching function for typos
function fuzzyMatch(input, target, threshold = 0.6) {
  input = input.toLowerCase();
  target = target.toLowerCase();

  if (input === target) return 1.0;
  if (target.includes(input)) return 0.9;
  if (input.includes(target)) return 0.9;

  // Calculate Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= target.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= input.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= target.length; i++) {
    for (let j = 1; j <= input.length; j++) {
      if (target.charAt(i - 1) === input.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[target.length][input.length];
  const maxLength = Math.max(target.length, input.length);
  const similarity = 1 - (distance / maxLength);

  return similarity;
}

// Find best fuzzy match from an array
function findBestMatch(input, options, threshold = 0.6) {
  let bestMatch = null;
  let bestScore = 0;

  for (const option of options) {
    const score = fuzzyMatch(input, option);
    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = option;
    }
  }

  return { match: bestMatch, score: bestScore };
}

// Check if message contains any of the keywords (with fuzzy matching)
function isKeywordMatch(message, keywords, threshold = 0.8) {
  const words = message.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue; // Skip very short words
    for (const keyword of keywords) {
      if (fuzzyMatch(word, keyword.toLowerCase()) >= threshold) {
        return true;
      }
    }
  }
  return false;
}

// Check if a name is a partner name
async function isPartnerName(name) {
  try {
    const partners = await queryFirebaseData('partners');
    return partners.some(p => (p.name || '').toLowerCase().includes(name.toLowerCase()));
  } catch (error) {
    console.error('Error checking partner name:', error);
    return false;
  }
}

let db = null;
try {
  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyDnLzgeF7Pc7xKvNPBz70mVvFzTy0ND1pU",
    authDomain: "crm-gpt-2026.firebaseapp.com",
    projectId: "crm-gpt-2026",
    storageBucket: "crm-gpt-2026.firebasestorage.app",
    messagingSenderId: "428084017633",
    appId: "1:428084017633:web:c42b0e9e5bc7152f96d66e"
  };

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  console.log('⚠️ Running in demo mode with mock data.');
}

// Mock CRM data as fallback
const mockCRMData = {
  contacts: [
    { id: '1', name: 'Mohamed Ismayil', email: 'mmismayil2003@gmail.com', company: 'Grow Plus Technologies', department: 'Engineering', position: 'AI Engineer', phone: '+971 50 123 4567', status: 'active' },
    { id: '2', name: 'Mohamed Ajumal', email: 'ajumal@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Sales', position: 'AI Engineer', phone: '+971 50 234 5678', status: 'active' }
  ],
  projects: [
    { id: '1', name: 'Website Redesign', company: 'TechCorp', status: 'in-progress', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-15', description: 'Complete website redesign with modern UI/UX', belongsTo: 'Grow Plus Technologies' },
    { id: '2', name: 'Mobile App Development', company: 'ZXY Industries', status: 'pending', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-20', description: 'Native mobile app for iOS and Android', belongsTo: 'Grow Plus Technologies' }
  ],
  tenders: [
    { id: '1', name: 'Government Portal Development', company: 'Ministry of Technology', status: 'open', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-25', description: 'E-government portal development', belongsTo: 'Grow Plus Technologies' },
    { id: '2', name: 'Smart City Infrastructure', company: 'Dubai Municipality', status: 'submitted', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-15', description: 'IoT infrastructure for smart city', belongsTo: 'Grow Plus Technologies' },
    { id: '3', name: 'Healthcare Management System', company: 'DHA', status: 'awarded', assignedToName: 'Mohamed Ismayil', deadline: '2024-05-01', description: 'Hospital management software', belongsTo: 'Grow Plus Technologies' },
    { id: '4', name: 'Banking Software Upgrade', company: 'National Bank', status: 'closed', assignedToName: 'Mohamed Ajumal', deadline: '2024-02-20', description: 'Core banking system upgrade', belongsTo: 'Grow Plus Technologies' },
    { id: '5', name: 'Education Platform', company: 'Ministry of Education', status: 'open', assignedToName: 'Mohamed Ismayil', deadline: '2024-04-30', description: 'E-learning platform development', belongsTo: 'Grow Plus Technologies' },
    { id: '6', name: 'Transport Management System', company: 'RTA', status: 'submitted', assignedToName: 'Mohamed Ajumal', deadline: '2024-06-15', description: 'Public transport management system', belongsTo: 'Grow Plus Technologies' },
    { id: '7', name: 'Security Solutions', company: 'Dubai Police', status: 'open', assignedToName: 'Mohamed Ismayil', deadline: '2024-07-20', description: 'Advanced security monitoring system', belongsTo: 'Grow Plus Technologies' },
    { id: '8', name: 'Energy Management Platform', company: 'DEWA', status: 'awarded', assignedToName: 'Mohamed Ajumal', deadline: '2024-08-10', description: 'Smart energy monitoring and management', belongsTo: 'Grow Plus Technologies' },
    { id: '9', name: 'Retail POS System', company: 'Majid Al Futtaim', status: 'submitted', assignedToName: 'Mohamed Ismayil', deadline: '2024-09-05', description: 'Point of sale system for retail chain', belongsTo: 'Grow Plus Technologies' },
    { id: '10', name: 'Logistics Tracking System', company: 'Aramex', status: 'open', assignedToName: 'Mohamed Ajumal', deadline: '2024-10-15', description: 'Real-time logistics and shipment tracking', belongsTo: 'Grow Plus Technologies' }
  ],
  payments: [
    { id: '1', description: 'Office Rent - March 2024', amount: 15000, dueDate: '2024-03-01', status: 'pending', company: 'Property Management LLC' },
    { id: '2', description: 'Software Licenses', amount: 5500, dueDate: '2024-02-28', status: 'overdue', company: 'Microsoft' }
  ],
  employees: [
    { id: '1', name: 'Mohamed Ismayil', email: 'mmismayil2003@gmail.com', company: 'Grow Plus Technologies', department: 'Engineering', position: 'AI Engineer', phone: '+971 50 123 4567', status: 'active', joinDate: '2023-01-15' },
    { id: '2', name: 'Mohamed Ajumal', email: 'ajumal@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Sales', position: 'AI Engineer', phone: '+971 50 234 5678', status: 'active', joinDate: '2023-02-20' },
    { id: '3', name: 'Muhammed Adnan', email: 'muhammed.adnan@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Management', position: 'Project Manager', phone: '+971 50 345 6789', status: 'active', joinDate: '2022-06-10' },
    { id: '4', name: 'Ahmed Hassan', email: 'ahmed.hassan@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Engineering', position: 'Senior Developer', phone: '+971 50 456 7890', status: 'active', joinDate: '2021-09-01' }
  ],
  partners: [
    { id: '1', name: 'Mohammed Al Rashid', company: 'Al Rashid Holdings', email: 'mohammed@alrashid.com', partnershipType: 'Strategic Partner', status: 'active', since: '2020-05-15' }
  ],
  registrations: [
    { id: '1', name: 'Al Thahir Group Registration', company: 'Al Thahir Group', belongsTo: 'Grow Plus Technologies', type: 'Trade License', registrationDate: '2023-01-15', expiryDate: '2025-01-14', status: 'active' },
    { id: '2', name: 'TechCorp LLC Formation', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', type: 'Company Formation', registrationDate: '2022-06-20', expiryDate: '2024-06-19', status: 'active' },
    { id: '3', name: 'ZXY VAT Registration', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', type: 'VAT Registration', registrationDate: '2023-03-01', expiryDate: '2024-02-28', status: 'expired' }
  ],
  subscriptions: [],
  files: [
    { id: '1', name: 'Service Agreement.pdf', fileName: 'Service Agreement.pdf', fileType: 'pdf', category: 'Contract', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', uploadedBy: 'Mohamed Ismayil', uploadDate: '2024-01-15' },
    { id: '2', name: 'Project Proposal.docx', fileName: 'Project Proposal.docx', fileType: 'docx', category: 'Proposal', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', uploadedBy: 'Mohamed Ajumal', uploadDate: '2024-02-10' },
    { id: '3', name: 'NDAs.pdf', fileName: 'NDAs.pdf', fileType: 'pdf', category: 'Contract', company: 'Al Thahir Group', belongsTo: 'Grow Plus Technologies', uploadedBy: 'Ahmed Hassan', uploadDate: '2024-03-05' }
  ],
  deals: [],
  tickets: []
};

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// In-memory storage for chat sessions (replace with Redis in production)
const chatSessions = new Map();

// Employee name resolution cache
let employeeCache = null;
let lastCacheUpdate = 0;

async function getEmployees() {
  const now = Date.now();
  if (!employeeCache || now - lastCacheUpdate > 300000) { // 5 min cache
    console.log('🔄 Refreshing employee cache...');
    employeeCache = await queryFirebaseData('employees');
    lastCacheUpdate = now;
  }
  return employeeCache;
}

async function enrichWithEmployeeNames(data) {
  try {
    const employees = await getEmployees();
    return data.map(item => {
      // Create a shallow copy to avoid mutating the original data if it's cached elsewhere
      const enrichedItem = { ...item };
      if (enrichedItem.assignedTo && !enrichedItem.assignedToName) {
        const emp = employees.find(e => e.id === enrichedItem.assignedTo);
        if (emp) enrichedItem.assignedToName = emp.name;
      }
      return enrichedItem;
    });
  } catch (error) {
    console.error('Error enriching data with employee names:', error);
    return data;
  }
}

// Query Firebase CRM data
async function queryFirebaseData(collectionName) {
  // If Firebase is not initialized, return empty array
  if (!db) {
    console.log(`Firebase not available, returning empty results for ${collectionName}`);
    return [];
  }

  try {
    console.log(`Querying Firebase collection: ${collectionName}`);

    // Try with ordering first, fall back to simple query if it fails
    let querySnapshot;
    try {
      const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
      querySnapshot = await getDocs(q);
    } catch (orderError) {
      console.log(`No createdAt field in ${collectionName}, using simple query`);
      querySnapshot = await getDocs(collection(db, collectionName));
    }

    if (querySnapshot.empty) {
      console.log(`No documents found in ${collectionName}`);
      return [];
    }

    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`Found ${data.length} documents in ${collectionName}`);
    return data;
  } catch (error) {
    console.error(`Error querying ${collectionName}:`, error);
    // Fallback to mock data for all collections if Firebase fails
    if (mockCRMData[collectionName]) {
      console.log(`Falling back to mock ${collectionName} data`);
      return mockCRMData[collectionName];
    }
    return [];
  }
}

// Convert Firebase data to readable text format (without IDs for cleaner AI responses)
function convertFirebaseDataToText(data, type) {
  if (!data || data.length === 0) return '';

  return data.map((item, index) => {
    const num = index + 1;
    switch (type) {
      case 'tenders':
        return `${num}. ${item.name || item.title || item.description || 'Untitled Tender'}
   • Company: ${item.company || 'N/A'}
   • Status: ${item.status || 'N/A'}
   • Description: ${item.description || 'N/A'}
   • Assigned To: ${item.assignedToName || 'N/A'}
   • Deadline: ${item.deadline || 'N/A'}`;

      case 'contacts':
        return `${num}. ${item.name || 'Unnamed Contact'}
   • Company: ${item.company || 'N/A'}
   • Position: ${item.position || 'N/A'}
   • Email: ${item.email || 'N/A'}
   • Phone: ${item.phone || 'N/A'}`;

      case 'employees':
        return `${num}. ${item.name || 'Unnamed Employee'}
   • Company: ${item.company || 'N/A'}
   • Department: ${item.department || 'N/A'}
   • Position: ${item.position || 'N/A'}
   • Status: ${item.status || 'N/A'}`;

      case 'projects':
        return `${num}. ${item.name || 'Untitled Project'}
   • Company: ${item.company || 'N/A'}
   • Status: ${item.status || 'N/A'}
   • Assigned To: ${item.assignedToName || 'N/A'}
   • Deadline: ${item.deadline || 'N/A'}`;

      case 'payments':
        return `${num}. ${item.description || 'Payment'}
   • Amount: ${item.amount || 'N/A'}
   • Company: ${item.company || 'N/A'}
   • Status: ${item.status || 'N/A'}
   • Due Date: ${item.dueDate || 'N/A'}`;

      case 'partners':
        return `${num}. ${item.name || 'Unnamed Partner'}
   • Company: ${item.company || 'N/A'}
   • Type: ${item.partnershipType || 'N/A'}
   • Status: ${item.status || 'N/A'}`;

      case 'registrations':
        return `${num}. ${item.name || 'Unnamed Registration'}
   • Company: ${item.company || 'N/A'}
   • Type: ${item.type || 'N/A'}
   • Status: ${item.status || 'N/A'}
   • Expiry: ${item.expiryDate || 'N/A'}`;

      case 'files':
        return `${num}. File: ${item.name || 'Unnamed File'}
   • Category: ${item.category || 'N/A'}
   • Company: ${item.company || 'N/A'}
   • Uploaded By: ${item.uploadedBy || 'N/A'}`;

      case 'subscriptions':
        return `${num}. ${item.name || 'Unnamed Subscription'}
   • Provider: ${item.provider || 'N/A'}
   • Amount: ${item.amount || 'N/A'}
   • Status: ${item.status || 'N/A'}`;

      default:
        return `${num}. ${item.name || type}
   • ${Object.entries(item).filter(([k]) => !['id', 'name'].includes(k)).slice(0, 4).map(([k, v]) => `${k}: ${v}`).join('\n   • ')}`;
    }
  }).join('\n\n');
}

// Initialize and start server
// async function startServer() {
//   console.log('🚀 Starting simplified CRM server with direct filtering...');
//   
//   const PORT = process.env.PORT || 3001;
//   server.listen(PORT, () => {
//     console.log(`AI Chat Backend server running on port ${PORT}`);
//     console.log(`WebSocket server ready for connections`);
//     console.log('✅ Direct filtering enabled for all CRM sections');
//   });
// }
// 
// startServer().catch(console.error);

// Query Ollama for AI response
async function queryOllama(prompt, context = []) {
  try {
    const response = await axios.post(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
      model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
      prompt: prompt,
      context: context,
      stream: false,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE || '24h',
      options: {
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.1,
        top_p: parseFloat(process.env.OLLAMA_TOP_P) || 0.9,
        num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT) || 300 // Lowered for faster responses
      }
    }, {
      timeout: 90000  // 90 second timeout for slow models
    });

    // Validate response structure
    if (!response.data || !response.data.response) {
      throw new Error('Invalid response structure from Ollama');
    }

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.error('Ollama request timeout');
      throw new Error('AI_TIMEOUT');
    } else if (error.response) {
      console.error('Ollama API error:', error.response.status, error.response.data);
      throw new Error('AI_UNAVAILABLE');
    } else {
      console.error('Error querying Ollama:', error.message);
      throw new Error('AI_ERROR');
    }
  }
}

// Search CRM data using ChromaDB
async function searchCRMData(query) {
  if (!crmCollection) return [];

  try {
    console.log('Searching for:', query);
    const results = await crmCollection.query({
      queryTexts: [query],
      nResults: 5
    });

    console.log('Vector search results:', results);

    // If vector search returns no results, try keyword-based fallback
    if (!results.documents[0] || results.documents[0].length === 0) {
      console.log('Vector search empty, using keyword fallback');
      return keywordSearchCRMData(query);
    }

    return results.documents[0].map((doc, index) => ({
      document: doc,
      metadata: results.metadatas[0][index],
      distance: results.distances[0][index]
    }));
  } catch (error) {
    console.error('Error searching CRM data:', error);
    return keywordSearchCRMData(query);
  }
}

// Keyword-based fallback search
function keywordSearchCRMData(query) {
  const lowerQuery = query.toLowerCase();
  const results = [];

  // Search through all mock data
  mockCRMData.contacts.forEach(contact => {
    const doc = `Contact: ${contact.name}, Company: ${contact.company}, Email: ${contact.email}, Department: ${contact.department}, Position: ${contact.position}, Phone: ${contact.phone}, Status: ${contact.status}`;
    if (doc.toLowerCase().includes(lowerQuery)) {
      results.push({
        document: doc,
        metadata: { type: 'contact', id: contact.id, data: contact },
        distance: 0.1
      });
    }
  });

  mockCRMData.projects.forEach(project => {
    const doc = `Project: ${project.name}, Company: ${project.company}, Status: ${project.status}, Assigned To: ${project.assignedToName}, Deadline: ${project.deadline}, Description: ${project.description}`;
    if (doc.toLowerCase().includes(lowerQuery)) {
      results.push({
        document: doc,
        metadata: { type: 'project', id: project.id, data: project },
        distance: 0.1
      });
    }
  });

  mockCRMData.tenders.forEach(tender => {
    const doc = `Tender: ${tender.name}, Company: ${tender.company}, Status: ${tender.status}, Assigned To: ${tender.assignedToName}, Deadline: ${tender.deadline}, Description: ${tender.description}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('tender')) {
      results.push({
        document: doc,
        metadata: { type: 'tender', id: tender.id, data: tender },
        distance: 0.1
      });
    }
  });

  mockCRMData.registrations.forEach(registration => {
    const doc = `Registration: ${registration.name}, Company: ${registration.company}, Type: ${registration.type}, Status: ${registration.status}, Registration Date: ${registration.registrationDate}, Expiry Date: ${registration.expiryDate}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('registration')) {
      results.push({
        document: doc,
        metadata: { type: 'registration', id: registration.id, data: registration },
        distance: 0.1
      });
    }
  });

  mockCRMData.payments.forEach(payment => {
    const doc = `Payment: ${payment.description}, Amount: ${payment.amount}, Due Date: ${payment.dueDate}, Status: ${payment.status}, Company: ${payment.company}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('payment')) {
      results.push({
        document: doc,
        metadata: { type: 'payment', id: payment.id, data: payment },
        distance: 0.1
      });
    }
  });

  mockCRMData.subscriptions.forEach(subscription => {
    const doc = `Subscription: ${subscription.name}, Provider: ${subscription.provider}, Amount: ${subscription.amount}, Billing Cycle: ${subscription.billingCycle}, Status: ${subscription.status}, Next Billing: ${subscription.nextBillingDate}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('subscription')) {
      results.push({
        document: doc,
        metadata: { type: 'subscription', id: subscription.id, data: subscription },
        distance: 0.1
      });
    }
  });

  mockCRMData.employees.forEach(employee => {
    const doc = `Employee: ${employee.name}, Company: ${employee.company}, Department: ${employee.department}, Position: ${employee.position}, Email: ${employee.email}, Phone: ${employee.phone}, Status: ${employee.status}, Join Date: ${employee.joinDate}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('employee')) {
      results.push({
        document: doc,
        metadata: { type: 'employee', id: employee.id, data: employee },
        distance: 0.1
      });
    }
  });

  mockCRMData.partners.forEach(partner => {
    const doc = `Partner: ${partner.name}, Company: ${partner.company}, Partnership Type: ${partner.partnershipType}, Status: ${partner.status}, Since: ${partner.since}`;
    if (doc.toLowerCase().includes(lowerQuery) || lowerQuery.includes('partner')) {
      results.push({
        document: doc,
        metadata: { type: 'partner', id: partner.id, data: partner },
        distance: 0.1
      });
    }
  });

  console.log('Keyword search results:', results);
  return results.slice(0, 5);
}

// Get CRM overview data for AI context
async function getCRMOverview() {
  try {
    const overviews = [];

    const dataTypes = [
      { name: 'Projects', key: 'projects' },
      { name: 'Tenders', key: 'tenders' },
      { name: 'Payments', key: 'payments' },
      { name: 'Employees', key: 'employees' },
      { name: 'Partners', key: 'partners' },
      { name: 'Registrations', key: 'registrations' },
      { name: 'Files', key: 'files' }
    ];

    for (const dataType of dataTypes) {
      try {
        const data = await queryFirebaseData(dataType.key);
        if (data && data.length > 0) {
          overviews.push(`${dataType.name}: ${data.length} items`);

          // Add some summary stats for key data types
          if (dataType.key === 'projects') {
            const active = data.filter(p => p.status === 'in-progress').length;
            const completed = data.filter(p => p.status === 'completed').length;
            overviews.push(`  - Active: ${active}, Completed: ${completed}`);
          } else if (dataType.key === 'payments') {
            const pending = data.filter(p => p.status === 'pending').length;
            const paid = data.filter(p => p.status === 'paid').length;
            overviews.push(`  - Pending: ${pending}, Paid: ${paid}`);
          } else if (dataType.key === 'employees') {
            const active = data.filter(e => e.status === 'active').length;
            overviews.push(`  - Active: ${active}`);
          }
        }
      } catch (error) {
        console.log(`Could not fetch ${dataType.key} data for overview`);
      }
    }

    return overviews.length > 0 ? overviews.join('\n') : 'No CRM data available.';
  } catch (error) {
    console.error('Error getting CRM overview:', error);
    return 'Unable to fetch CRM overview.';
  }
}

// Generate AI response based on CRM data
async function generateAIResponse(message, sessionId) {
  try {
    console.log(`🔍 Processing message: "${message}"`);

    // Check for greetings first
    let lowerMessage = message.toLowerCase().trim();
    console.log(`📝 Lowercase message: "${lowerMessage}"`);

    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const overviewQueries = ['all things', 'everything', 'overview', 'summary', 'what do you have', 'show me all', 'all data'];

    if (greetings.some(greeting => lowerMessage.includes(greeting))) {
      return {
        response: 'Hello! I\'m your CRM AI assistant. I can help you with contacts, projects, tenders, payments, employees, files, and registrations. What would you like to know?'
      };
    }

    // Handle tender queries directly for better performance and filtering
    if (lowerMessage.includes('tender') || lowerMessage.includes('tenders')) {
      console.log('🎯 Direct tender query detected - bypassing AI for better performance');
      const tenders = await queryFirebaseData('tenders');
      
      if (tenders.length === 0) {
        return {
          response: 'No tender data available in your CRM.'
        };
      }
      
      // Filter tenders based on criteria
      let filteredTenders = tenders;
      let filterDescription = '';
      
      // Company filtering with fuzzy matching
      const companies = [...new Set(tenders.map(t => t.company.toLowerCase()))];
      let companyFilter = '';
      
      for (const word of lowerMessage.split(' ')) {
        if (word.length < 2) continue;
        
        const companyMatch = findBestMatch(word, companies, 0.6);
        if (companyMatch.match) {
          const actualCompany = companies.find(c => c === companyMatch.match);
          filteredTenders = filteredTenders.filter(t => t.company.toLowerCase() === actualCompany);
          companyFilter = actualCompany;
          filterDescription = companyFilter ? `from ${companyFilter}` : '';
          console.log(`🏢 Company filter applied for tenders: ${companyFilter}`);
          break;
        }
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('open')) {
        filteredTenders = filteredTenders.filter(t => t.status === 'open');
        statusFilter = 'open';
      } else if (lowerMessage.includes('submitted')) {
        filteredTenders = filteredTenders.filter(t => t.status === 'submitted');
        statusFilter = 'submitted';
      } else if (lowerMessage.includes('awarded')) {
        filteredTenders = filteredTenders.filter(t => t.status === 'awarded');
        statusFilter = 'awarded';
      } else if (lowerMessage.includes('closed')) {
        filteredTenders = filteredTenders.filter(t => t.status === 'closed');
        statusFilter = 'closed';
      }
      
      // AssignedTo filtering with fuzzy matching
      const assignees = [...new Set(tenders.map(t => (t.assignedToName || '').toLowerCase()).filter(Boolean))];
      let assigneeFilter = '';
      
      for (const word of lowerMessage.split(' ')) {
        if (word.length < 2) continue;
        
        const assigneeMatch = findBestMatch(word, assignees, 0.6);
        if (assigneeMatch.match) {
          const actualAssignee = assignees.find(a => a === assigneeMatch.match);
          filteredTenders = filteredTenders.filter(t => (t.assignedToName || '').toLowerCase() === actualAssignee);
          assigneeFilter = actualAssignee;
          console.log(`👤 Assignee filter applied for tenders: ${assigneeFilter}`);
          break;
        }
      }
      
      // Deadline filtering
      const datePattern = /\b(20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\b/g;
      const dates = lowerMessage.match(datePattern);
      if (dates && dates.length > 0) {
        const targetDate = dates[0];
        filteredTenders = filteredTenders.filter(t => t.deadline === targetDate);
        filterDescription = filterDescription ? `with deadline ${targetDate}` : `with deadline ${targetDate}`;
      }
      
      // Tender name filtering
      const tenderNames = [...new Set(tenders.map(t => (t.name || t.title || '').toLowerCase()).filter(Boolean))];
      let nameFilter = '';
      
      for (const word of lowerMessage.split(' ')) {
        if (word.length < 2) continue;
        
        const nameMatch = findBestMatch(word, tenderNames, 0.6);
        if (nameMatch.match) {
          const actualName = tenderNames.find(n => n === nameMatch.match);
          filteredTenders = filteredTenders.filter(t => (t.name || t.title || '').toLowerCase() === actualName);
          nameFilter = actualName;
          console.log(`📋 Tender name filter applied: ${nameFilter}`);
          break;
        }
      }
      
      // Combine filter descriptions
      if (statusFilter && companyFilter) {
        filterDescription = `${statusFilter} tenders ${filterDescription}`;
      } else if (statusFilter && assigneeFilter) {
        filterDescription = `${statusFilter} tenders assigned to ${assigneeFilter}`;
      } else if (statusFilter) {
        filterDescription = `${statusFilter} tenders`;
      } else if (companyFilter) {
        filterDescription = `tenders ${filterDescription}`;
      } else if (assigneeFilter) {
        filterDescription = `tenders assigned to ${assigneeFilter}`;
      }
      
      // Check if user is asking for count only
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (isCountQuery) {
        return {
          response: `Found ${filteredTenders.length} ${filterDescription || 'tender(s)'} in your CRM.`
        };
      }
      
      if (filteredTenders.length === 0) {
        return {
          response: `No ${filterDescription || 'tenders'} found in your CRM.`
        };
      }
      
      // Group by status for better readability when there are many results
      if (filteredTenders.length > 5) {
        const groupedByStatus = filteredTenders.reduce((groups, tender) => {
          const status = tender.status || 'unknown';
          if (!groups[status]) {
            groups[status] = [];
          }
          groups[status].push(tender);
          return groups;
        }, {});
        
        let response = `Found ${filteredTenders.length} ${filterDescription || 'tender(s)'}:\n\n`;
        
        for (const [status, statusTenders] of Object.entries(groupedByStatus)) {
          response += `📋 **${status.toUpperCase()}** (${statusTenders.length}):\n`;
          statusTenders.forEach(t => {
            response += `  • ${t.name || t.title} - ${t.company} - Deadline: ${t.deadline || 'N/A'}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      // For smaller lists, show detailed format
      const response = `Found ${filteredTenders.length} ${filterDescription || 'tender(s)'}:\n\n${filteredTenders.map(t => `• ${t.name || t.title} - ${t.company} - ${t.status} - Assigned to: ${t.assignedToName || 'N/A'} - Deadline: ${t.deadline || 'N/A'}`).join('\n')}`;

      return { response };
    }

    // Handle project queries directly for better performance and filtering
    if (lowerMessage.includes('project') || lowerMessage.includes('projects') ||
        // Check for specific assignee names without requiring "project" keyword
        ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed', 'pranav'].some(name => lowerMessage.includes(name.toLowerCase()))) {
      console.log('🎯 Direct project query detected - bypassing AI for better performance');
      const projects = await queryFirebaseData('projects');
      
      if (projects.length === 0) {
        return {
          response: 'No project data available in your CRM.'
        };
      }
      
      // Filter projects based on criteria
      let filteredProjects = projects;
      let filterDescription = '';
      
      // Name filtering - check if a specific person's name is mentioned
      const assignees = [...new Set(projects.map(p => (p.assignedToName || '').toLowerCase()).filter(Boolean))];
      let nameFilter = '';
      
      for (const assignee of assignees) {
        if (lowerMessage.includes(assignee.toLowerCase())) {
          filteredProjects = filteredProjects.filter(p => (p.assignedToName || '').toLowerCase() === assignee);
          nameFilter = assignee;
          filterDescription = nameFilter ? `assigned to ${nameFilter}` : '';
          console.log(`👤 Name filter applied for projects: ${assignee}`);
          break;
        }
      }
      
      // If no exact match, try partial matching for known names
      if (!nameFilter && ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed', 'pranav'].some(name => lowerMessage.includes(name.toLowerCase()))) {
        for (const name of ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed', 'pranav']) {
          if (lowerMessage.includes(name.toLowerCase())) {
            filteredProjects = filteredProjects.filter(p => (p.assignedToName || '').toLowerCase().includes(name));
            nameFilter = name;
            filterDescription = nameFilter ? `assigned to ${nameFilter}` : '';
            console.log(`👤 Partial name filter applied for projects: ${name}`);
            break;
          }
        }
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('in-progress') || lowerMessage.includes('in progress')) {
        filteredProjects = filteredProjects.filter(p => p.status === 'in-progress');
        statusFilter = 'in-progress';
      } else if (lowerMessage.includes('completed')) {
        filteredProjects = filteredProjects.filter(p => p.status === 'completed');
        statusFilter = 'completed';
      } else if (lowerMessage.includes('pending')) {
        filteredProjects = filteredProjects.filter(p => p.status === 'pending');
        statusFilter = 'pending';
      }
      
      // Combine filter descriptions
      if (statusFilter && nameFilter) {
        filterDescription = `${statusFilter} projects assigned to ${nameFilter}`;
      } else if (statusFilter) {
        filterDescription = `${statusFilter} projects`;
      } else if (nameFilter) {
        filterDescription = `projects assigned to ${nameFilter}`;
      }
      
      // Check if user is asking for count only
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (isCountQuery) {
        return {
          response: `Found ${filteredProjects.length} ${filterDescription || 'project(s)'} in your CRM.`
        };
      }
      
      if (filteredProjects.length === 0) {
        return {
          response: `No ${filterDescription || 'projects'} found in your CRM.`
        };
      }
      
      // Group by status for better readability when there are many results
      if (filteredProjects.length > 5) {
        const groupedByStatus = filteredProjects.reduce((groups, project) => {
          const status = project.status || 'unknown';
          if (!groups[status]) {
            groups[status] = [];
          }
          groups[status].push(project);
          return groups;
        }, {});
        
        let response = `Found ${filteredProjects.length} ${filterDescription || 'project(s)'}:\n\n`;
        
        for (const [status, statusProjects] of Object.entries(groupedByStatus)) {
          response += `📋 **${status.toUpperCase()}** (${statusProjects.length}):\n`;
          statusProjects.forEach(p => {
            response += `  • ${p.name} - ${p.company} - Deadline: ${p.deadline || 'N/A'}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      const response = `Found ${filteredProjects.length} ${filterDescription || 'project(s)'}:\n\n${filteredProjects.map(p => `• ${p.name} - ${p.company} - ${p.status} - Assigned to: ${p.assignedToName || 'N/A'} - Deadline: ${p.deadline || 'N/A'}`).join('\n')}`;

      return { response };
    }

    // Handle payment queries directly for better performance and filtering  
    if (lowerMessage.includes('payment') || lowerMessage.includes('payments')) {
      console.log('🎯 Direct payment query detected - bypassing AI for better performance');
      const payments = await queryFirebaseData('payments');
      
      if (payments.length === 0) {
        return {
          response: 'No payment data available in your CRM.'
        };
      }
      
      // Filter payments based on criteria
      let filteredPayments = payments;
      let filterDescription = '';
      
      // Company filtering
      const companies = [...new Set(payments.map(p => p.company.toLowerCase()))];
      let companyFilter = '';
      
      for (const company of companies) {
        if (lowerMessage.includes(company.toLowerCase())) {
          filteredPayments = filteredPayments.filter(p => p.company.toLowerCase() === company);
          companyFilter = company;
          filterDescription = companyFilter ? `from ${companyFilter}` : '';
          console.log(`🏢 Company filter applied for payments: ${company}`);
          break;
        }
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('pending')) {
        filteredPayments = filteredPayments.filter(p => p.status === 'pending');
        statusFilter = 'pending';
      } else if (lowerMessage.includes('paid')) {
        filteredPayments = filteredPayments.filter(p => p.status === 'paid');
        statusFilter = 'paid';
      } else if (lowerMessage.includes('overdue')) {
        filteredPayments = filteredPayments.filter(p => p.status === 'overdue');
        statusFilter = 'overdue';
      }
      
      // Amount filtering - look for amount patterns
      const amountPattern = /\$\d+(\.\d+)?/g;
      const amounts = lowerMessage.match(amountPattern);
      if (amounts && amounts.length > 0) {
        const targetAmount = parseFloat(amounts[0].replace('$', ''));
        filteredPayments = filteredPayments.filter(p => {
          const paymentAmount = parseFloat(p.amount || '0');
          return Math.abs(paymentAmount - targetAmount) < 0.01;
        });
        filterDescription = filterDescription ? `${filterDescription} of $${targetAmount}` : `payments of $${targetAmount}`;
      }
      
      // Combine filter descriptions
      if (statusFilter && companyFilter) {
        filterDescription = `${statusFilter} payments ${filterDescription}`;
      } else if (statusFilter) {
        filterDescription = `${statusFilter} payments`;
      } else if (companyFilter) {
        filterDescription = `payments ${filterDescription}`;
      }
      
      // Check if user is asking for count only
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (isCountQuery) {
        return {
          response: `Found ${filteredPayments.length} ${filterDescription || 'payment(s)'} in your CRM.`
        };
      }
      
      if (filteredPayments.length === 0) {
        return {
          response: `No ${filterDescription || 'payments'} found in your CRM.`
        };
      }
      
      // Group by status for better readability when there are many results
      if (filteredPayments.length > 5) {
        const groupedByStatus = filteredPayments.reduce((groups, payment) => {
          const status = payment.status || 'unknown';
          if (!groups[status]) {
            groups[status] = [];
          }
          groups[status].push(payment);
          return groups;
        }, {});
        
        let response = `Found ${filteredPayments.length} ${filterDescription || 'payment(s)'}:\n\n`;
        
        for (const [status, statusPayments] of Object.entries(groupedByStatus)) {
          response += `📋 **${status.toUpperCase()}** (${statusPayments.length}):\n`;
          statusPayments.forEach(p => {
            response += `  • ${p.description} - $${p.amount} - Due: ${p.dueDate || 'N/A'}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      const response = `Found ${filteredPayments.length} ${filterDescription || 'payment(s)'}:\n\n${filteredPayments.map(p => `• ${p.description} - ${p.company} - $${p.amount} - Due: ${p.dueDate} - Status: ${p.status}`).join('\n')}`;

      return { response };
    }

    // Handle employee queries directly for better performance and filtering
    if (lowerMessage.includes('employee') || lowerMessage.includes('employees') || 
        // Check for specific employee names without requiring "employee" keyword
        ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed'].some(name => lowerMessage.includes(name.toLowerCase()))) {
      console.log('🎯 Direct employee query detected - bypassing AI for better performance');
      const employees = await queryFirebaseData('employees');
      
      if (employees.length === 0) {
        return {
          response: 'No employee data available in your CRM.'
        };
      }
      
      // Filter employees based on criteria
      let filteredEmployees = employees;
      let filterDescription = '';
      
      // Name filtering - exact matching for employee names
      const employeeNames = [...new Set(employees.map(e => (e.name || '').toLowerCase()).filter(Boolean))];
      let nameFilter = '';
      
      for (const name of employeeNames) {
        if (lowerMessage.includes(name.toLowerCase())) {
          filteredEmployees = filteredEmployees.filter(e => (e.name || '').toLowerCase() === name);
          nameFilter = name;
          filterDescription = nameFilter ? `named ${nameFilter}` : '';
          console.log(`👤 Name filter applied for employees: ${name}`);
          break;
        }
      }
      
      // Department filtering
      let departmentFilter = '';
      if (lowerMessage.includes('engineering')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'engineering');
        departmentFilter = 'engineering';
      } else if (lowerMessage.includes('sales')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'sales');
        departmentFilter = 'sales';
      } else if (lowerMessage.includes('management')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'management');
        departmentFilter = 'management';
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('active')) {
        filteredEmployees = filteredEmployees.filter(e => e.status === 'active');
        statusFilter = 'active';
      } else if (lowerMessage.includes('inactive')) {
        filteredEmployees = filteredEmployees.filter(e => e.status === 'inactive');
        statusFilter = 'inactive';
      }
      
      // If no employee filter was applied but a name was mentioned, try partial matching
      if (!nameFilter && ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed'].some(name => lowerMessage.includes(name.toLowerCase()))) {
        for (const name of ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed']) {
          if (lowerMessage.includes(name.toLowerCase())) {
            filteredEmployees = filteredEmployees.filter(e => (e.name || '').toLowerCase().includes(name));
            nameFilter = name;
            filterDescription = nameFilter ? `containing ${nameFilter}` : '';
            console.log(`👤 Partial name filter applied for employees: ${name}`);
            break;
          }
        }
      }
      
      // Combine filter descriptions
      const filters = [];
      if (nameFilter) filters.push(nameFilter.includes('containing') ? nameFilter : `named ${nameFilter}`);
      if (departmentFilter) filters.push(`in ${departmentFilter}`);
      if (statusFilter) filters.push(`with ${statusFilter} status`);
      filterDescription = filters.join(' ');
      
      // Check if user is asking for count only
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (isCountQuery) {
        return {
          response: `Found ${filteredEmployees.length} ${filterDescription || 'employee(s)'} in your CRM.`
        };
      }
      
      if (filteredEmployees.length === 0) {
        return {
          response: `No ${filterDescription || 'employees'} found in your CRM.`
        };
      }
      
      // Group by department for better readability when there are many results
      if (filteredEmployees.length > 5) {
        const groupedByDept = filteredEmployees.reduce((groups, employee) => {
          const dept = employee.department || 'unknown';
          if (!groups[dept]) {
            groups[dept] = [];
          }
          groups[dept].push(employee);
          return groups;
        }, {});
        
        let response = `Found ${filteredEmployees.length} ${filterDescription || 'employee(s)'}:\n\n`;
        
        for (const [dept, deptEmployees] of Object.entries(groupedByDept)) {
          response += `📋 **${dept.toUpperCase()}** (${deptEmployees.length}):\n`;
          deptEmployees.forEach(e => {
            response += `  • ${e.name} - ${e.position} - ${e.email}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      const response = `Found ${filteredEmployees.length} ${filterDescription || 'employee(s)'}:\n\n${filteredEmployees.map(e => `• ${e.name} - ${e.position} - ${e.department} - ${e.email} - ${e.phone}`).join('\n')}`;

      return { response };
    }

    // Handle file queries directly for better performance and filtering
    if (lowerMessage.includes('file') || lowerMessage.includes('files')) {
      console.log('🎯 Direct file query detected - bypassing AI for better performance');
      const files = await queryFirebaseData('files');
      
      if (files.length === 0) {
        return {
          response: 'No file data available in your CRM.'
        };
      }
      
      // Filter files based on criteria
      let filteredFiles = files;
      let filterDescription = '';
      
      // File type filtering
      let typeFilter = '';
      if (lowerMessage.includes('pdf')) {
        filteredFiles = filteredFiles.filter(f => (f.fileType || f.type || '').toLowerCase() === 'pdf');
        typeFilter = 'PDF';
      } else if (lowerMessage.includes('doc') || lowerMessage.includes('document')) {
        filteredFiles = filteredFiles.filter(f => (f.fileType || f.type || '').toLowerCase().includes('doc'));
        typeFilter = 'Document';
      } else if (lowerMessage.includes('image') || lowerMessage.includes('jpg') || lowerMessage.includes('png')) {
        filteredFiles = filteredFiles.filter(f => ['jpg', 'jpeg', 'png', 'gif'].includes((f.fileType || f.type || '').toLowerCase()));
        typeFilter = 'Image';
      } else if (lowerMessage.includes('excel') || lowerMessage.includes('spreadsheet') || lowerMessage.includes('xlsx')) {
        filteredFiles = filteredFiles.filter(f => (f.fileType || f.type || '').toLowerCase().includes('xls'));
        typeFilter = 'Spreadsheet';
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('active')) {
        filteredFiles = filteredFiles.filter(f => f.status === 'active');
        statusFilter = 'active';
      } else if (lowerMessage.includes('archived')) {
        filteredFiles = filteredFiles.filter(f => f.status === 'archived');
        statusFilter = 'archived';
      } else if (lowerMessage.includes('deleted')) {
        filteredFiles = filteredFiles.filter(f => f.status === 'deleted');
        statusFilter = 'deleted';
      }
      
      // Date filtering - look for date patterns
      const datePattern = /\b(20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\b/g;
      const dates = lowerMessage.match(datePattern);
      if (dates && dates.length > 0) {
        const targetDate = dates[0];
        filteredFiles = filteredFiles.filter(f => (f.uploadDate || f.createdDate || f.date) === targetDate);
        filterDescription = filterDescription ? `uploaded on ${targetDate}` : `files uploaded on ${targetDate}`;
      }
      
      // Name filtering - search in file names
      // Skip name filtering if this is a count query
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (!isCountQuery && lowerMessage.length > 3) {
        const searchTerms = lowerMessage.split(' ').filter(word => word.length > 2 && !['file', 'files', 'pdf', 'doc', 'image', 'excel', 'active', 'archived', 'deleted', 'how', 'many', 'count', 'number', 'of'].includes(word));
        if (searchTerms.length > 0) {
          filteredFiles = filteredFiles.filter(f => 
            searchTerms.some(term => (f.name || f.fileName || '').toLowerCase().includes(term))
          );
          filterDescription = filterDescription ? `matching "${searchTerms.join(' ')}"` : `matching "${searchTerms.join(' ')}"`;
        }
      }
      
      // Combine filter descriptions
      if (typeFilter && statusFilter) {
        filterDescription = `${typeFilter} files that are ${statusFilter}`;
      } else if (typeFilter) {
        filterDescription = `${typeFilter} files`;
      } else if (statusFilter) {
        filterDescription = `${statusFilter} files`;
      }
      
      // Check if user is asking for count only
      if (isCountQuery) {
        return {
          response: `Found ${filteredFiles.length} ${filterDescription || 'file(s)'} in your CRM.`
        };
      }
      
      if (filteredFiles.length === 0) {
        return {
          response: `No ${filterDescription || 'files'} found in your CRM.`
        };
      }
      
      // Group by file type for better readability when there are many results
      if (filteredFiles.length > 5) {
        const groupedByType = filteredFiles.reduce((groups, file) => {
          const type = file.fileType || file.type || 'unknown';
          if (!groups[type]) {
            groups[type] = [];
          }
          groups[type].push(file);
          return groups;
        }, {});
        
        let response = `Found ${filteredFiles.length} ${filterDescription || 'file(s)'}:\n\n`;
        
        for (const [type, typeFiles] of Object.entries(groupedByType)) {
          response += `📋 **${type.toUpperCase()}** (${typeFiles.length}):\n`;
          typeFiles.forEach(f => {
            response += `  • ${f.name || f.fileName || 'Unnamed File'} - ${f.fileSize || 'N/A'} - Uploaded: ${f.uploadDate || f.createdDate || 'N/A'}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      const response = `Found ${filteredFiles.length} ${filterDescription || 'file(s)'}:\n\n${filteredFiles.map(f => `• ${f.name || f.fileName || 'Unnamed File'} - ${f.fileType || f.type || 'Unknown'} - ${f.fileSize || 'N/A'} - Uploaded: ${f.uploadDate || f.createdDate || 'N/A'} - Status: ${f.status || 'N/A'}`).join('\n')}`;

      return { response };
    }

    // Handle registration queries directly for better performance and filtering
    if (lowerMessage.includes('registration') || lowerMessage.includes('registrations')) {
      console.log('🎯 Direct registration query detected - bypassing AI for better performance');
      const registrations = await queryFirebaseData('registrations');
      
      if (registrations.length === 0) {
        return {
          response: 'No registration data available in your CRM.'
        };
      }
      
      // Filter registrations based on criteria
      let filteredRegistrations = registrations;
      let filterDescription = '';
      
      // Registration type filtering
      let typeFilter = '';
      if (lowerMessage.includes('business')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase() === 'business');
        typeFilter = 'business';
      } else if (lowerMessage.includes('trade')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase() === 'trade');
        typeFilter = 'trade';
      } else if (lowerMessage.includes('professional')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase() === 'professional');
        typeFilter = 'professional';
      } else if (lowerMessage.includes('service')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase() === 'service');
        typeFilter = 'service';
      }
      
      // Status filtering
      let statusFilter = '';
      if (lowerMessage.includes('active')) {
        filteredRegistrations = filteredRegistrations.filter(r => r.status === 'active');
        statusFilter = 'active';
      } else if (lowerMessage.includes('expired')) {
        filteredRegistrations = filteredRegistrations.filter(r => r.status === 'expired');
        statusFilter = 'expired';
      } else if (lowerMessage.includes('pending')) {
        filteredRegistrations = filteredRegistrations.filter(r => r.status === 'pending');
        statusFilter = 'pending';
      } else if (lowerMessage.includes('cancelled')) {
        filteredRegistrations = filteredRegistrations.filter(r => r.status === 'cancelled');
        statusFilter = 'cancelled';
      }
      
      // Company filtering
      const companies = [...new Set(registrations.map(r => (r.company || '').toLowerCase()).filter(Boolean))];
      let companyFilter = '';
      
      for (const company of companies) {
        if (lowerMessage.includes(company.toLowerCase())) {
          filteredRegistrations = filteredRegistrations.filter(r => (r.company || '').toLowerCase() === company);
          companyFilter = company;
          filterDescription = companyFilter ? `from ${companyFilter}` : '';
          console.log(`🏢 Company filter applied for registrations: ${company}`);
          break;
        }
      }
      
      // Expiry date filtering - look for date patterns
      const datePattern = /\b(20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))\b/g;
      const dates = lowerMessage.match(datePattern);
      if (dates && dates.length > 0) {
        const targetDate = dates[0];
        filteredRegistrations = filteredRegistrations.filter(r => r.expiryDate === targetDate);
        filterDescription = filterDescription ? `expiring on ${targetDate}` : `registrations expiring on ${targetDate}`;
      }
      
      // Registration number filtering
      const regNumberPattern = /reg[-\s]?(\d+)/gi;
      const regNumbers = lowerMessage.match(regNumberPattern);
      if (regNumbers && regNumbers.length > 0) {
        const targetNumber = regNumbers[0].replace(/reg[-\s]?/i, '');
        filteredRegistrations = filteredRegistrations.filter(r => (r.registrationNumber || '').includes(targetNumber));
        filterDescription = filterDescription ? `with registration number ${targetNumber}` : `registration number ${targetNumber}`;
      }
      
      // Combine filter descriptions
      if (typeFilter && statusFilter) {
        filterDescription = `${typeFilter} registrations that are ${statusFilter}`;
      } else if (typeFilter && companyFilter) {
        filterDescription = `${typeFilter} registrations ${filterDescription}`;
      } else if (typeFilter) {
        filterDescription = `${typeFilter} registrations`;
      } else if (statusFilter) {
        filterDescription = `${statusFilter} registrations`;
      } else if (companyFilter) {
        filterDescription = `registrations ${filterDescription}`;
      }
      
      // Check if user is asking for count only
      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');
      
      if (isCountQuery) {
        return {
          response: `Found ${filteredRegistrations.length} ${filterDescription || 'registration(s)'} in your CRM.`
        };
      }
      
      if (filteredRegistrations.length === 0) {
        return {
          response: `No ${filterDescription || 'registrations'} found in your CRM.`
        };
      }
      
      // Group by status for better readability when there are many results
      if (filteredRegistrations.length > 5) {
        const groupedByStatus = filteredRegistrations.reduce((groups, registration) => {
          const status = registration.status || 'unknown';
          if (!groups[status]) {
            groups[status] = [];
          }
          groups[status].push(registration);
          return groups;
        }, {});
        
        let response = `Found ${filteredRegistrations.length} ${filterDescription || 'registration(s)'}:\n\n`;
        
        for (const [status, statusRegistrations] of Object.entries(groupedByStatus)) {
          response += `📋 **${status.toUpperCase()}** (${statusRegistrations.length}):\n`;
          statusRegistrations.forEach(r => {
            response += `  • ${r.name} - ${r.company} - Reg #: ${r.registrationNumber || 'N/A'} - Expires: ${r.expiryDate || 'N/A'}\n`;
          });
          response += '\n';
        }
        
        return { response };
      }
      
      const response = `Found ${filteredRegistrations.length} ${filterDescription || 'registration(s)'}:\n\n${filteredRegistrations.map(r => `• ${r.name} - ${r.company} - ${r.type || 'N/A'} - Reg #: ${r.registrationNumber || 'N/A'} - Status: ${r.status || 'N/A'} - Registered: ${r.registrationDate || 'N/A'} - Expires: ${r.expiryDate || 'N/A'}`).join('\n')}`;

      return { response };
    }

    // Fallback to AI for other queries
    console.log('🤖 Query not handled by direct filtering, using AI fallback');
    
    // Get CRM overview for context
    const crmOverview = await getCRMOverview();
    const aiPrompt = `Based on this CRM data, please answer the user's question. Be helpful and specific.

CRM Data:
${crmOverview}

User Question: "${message}"

Please provide a comprehensive and helpful response:`;

    console.log('🤖 Generating AI response with Ollama...');
    const aiResponse = await queryOllama(aiPrompt);
    
    if (aiResponse && aiResponse.response) {
      return {
        response: aiResponse.response
      };
    }

    return {
      response: 'I apologize, but I encountered an error processing your request. Please try again.'
    };
  } catch (error) {
    console.error('Error in generateAIResponse:', error);
    return {
      response: 'I apologize, but I encountered an error processing your request. Please try again.'
    };
  }
}

// Get CRM overview for AI context
async function getCRMOverview() {
  try {
    const [tenders, projects, payments, employees, files, registrations] = await Promise.all([
      queryFirebaseData('tenders'),
      queryFirebaseData('projects'),
      queryFirebaseData('payments'),
      queryFirebaseData('employees'),
      queryFirebaseData('files'),
      queryFirebaseData('registrations')
    ]);

    return `Tenders: ${tenders.length} items
Projects: ${projects.length} items
Payments: ${payments.length} items
Employees: ${employees.length} items
Files: ${files.length} items
Registrations: ${registrations.length} items`;
  } catch (error) {
    console.error('Error getting CRM overview:', error);
    return 'CRM data temporarily unavailable';
  }
}

// Initialize and start server
async function startServer() {
  console.log('🚀 Starting simplified CRM server with direct filtering...');
  
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`AI Chat Backend server running on port ${PORT}`);
    console.log(`WebSocket server ready for connections`);
    console.log('✅ Direct filtering enabled for all CRM sections');
  });
}

startServer().catch(console.error);
      const keywords = lowerMessage.split(/\s+/).filter(w => w.length > 2 && !stopWords.includes(w));

      for (const dataType of crmDataTypes) {
        const singular = dataType.endsWith('ies') ? dataType.slice(0, -3) + 'y' : dataType.slice(0, -1);

        // Match if entity type is mentioned
        if (lowerMessage.includes(singular) || lowerMessage.includes(dataType)) {
          console.log(`📊 Fetching context for: ${dataType}`);
          try {
            let data = await queryFirebaseData(dataType);

            // Enrich with employee names if missing (projects, tenders, files)
            if (['projects', 'tenders', 'files'].includes(dataType)) {
              data = await enrichWithEmployeeNames(data);
            }

            // OPTIMIZATION: If the query contains specific keywords (like a company name), 
            // filter the records locally to reduce noise for the small AI model.
            if (keywords.length > 0) {
              const filteredData = data.filter(item => {
                const itemStr = JSON.stringify(item).toLowerCase();
                // Match keywords that aren't just the category name or its singular form
                return keywords.some(k =>
                  itemStr.includes(k) &&
                  k !== singular &&
                  k !== dataType &&
                  !dataType.includes(k) &&
                  !singular.includes(k)
                );
              });

              // Only use filtered data if matches found for specific keywords
              if (filteredData.length > 0) {
                console.log(`✨ Filtered ${dataType} down to ${filteredData.length} relevant items`);
                data = filteredData;
              }
            }

            if (data && data.length > 0) {
              contextData += `\n\n${dataType.charAt(0).toUpperCase() + dataType.slice(1)} Data:\n${convertFirebaseDataToText(data, dataType)}`;
            }
          } catch (error) {
            console.log(`Could not fetch ${dataType} data:`, error.message);
          }
        }
      }

      // If still no context, or for broad searches, scan for specific keywords in message across all data
      if (keywords.length > 0 && !contextData.includes('Data:')) {
        console.log('🔍 Scanning all categories for keywords...');
        for (const dataType of crmDataTypes) {
          try {
            const data = await queryFirebaseData(dataType);
            const matches = data.filter(item => {
              const itemStr = JSON.stringify(item).toLowerCase();
              return keywords.some(k => itemStr.includes(k));
            });

            if (matches.length > 0) {
              contextData += `\n\nRelated ${dataType.charAt(0).toUpperCase() + dataType.slice(1)} found for keywords:\n${convertFirebaseDataToText(matches, dataType)}`;
            }
          } catch (e) { /* ignore */ }
        }
      }

      // If specific entities are not mentioned, or for overview queries, get general overview
      const overviewQueries = ['all things', 'everything', 'overview', 'summary', 'what do you have', 'show me all', 'all data', 'all reports'];
      if (!contextData || overviewQueries.some(query => lowerMessage.includes(query))) {
        try {
          console.log('🔗 Fetching general CRM overview...');
          const overviewData = await getCRMOverview();
          contextData = (contextData ? contextData + '\n\n' : '') + overviewData;
        } catch (error) {
          console.log('Could not fetch overview data:', error.message);
        }
      }

      // Create AI prompt
      const aiPrompt = `You are a highly professional CRM assistant. Answer the user's question using the CRM DATA provided below.

CRM DATA:
${contextData || 'No specific data found in CRM.'}

USER QUESTION: "${message}"

RESPONSE RULES (STRTRICT ADHERENCE):
1. USE PROFESSIONAL TONE. Avoid conversational filler like "Okay, I understand".
2. NO MARKDOWN BOLDING (no **) in your answer. Use plain text or standard bullet points (•).
3. If the user asks "how many", answer directly: "You have X [items]." 
4. Omit IDs and internal technical fields.
5. If data is missing for a specific request, say: "No [item] found matching '[request]' in the CRM."
6. Provide a concise summary if multiple items are found.

PROFESSIONAL RESPONSE:`;

      console.log('🤖 Generating AI response...');
      const aiResponse = await queryOllama(aiPrompt);

      if (aiResponse && aiResponse.response) {
        // Generate smart suggestions based on the response content
        const suggestions = [
          { text: 'Show recent tenders', action: 'chat', data: { message: 'What are the recent open tenders?' } },
          { text: 'Payment summary', action: 'chat', data: { message: 'Show me all pending payments' } },
          { text: 'Employee list', action: 'chat', data: { message: 'List all employees' } }
        ];

        return {
          response: aiResponse.response.trim(),
          suggestions: suggestions.slice(0, 3),
          sources: contextData ? [{ type: 'crm_data', data: 'CRM Context' }] : []
        };
      } else {
        throw new Error('Invalid AI response from Ollama');
      }

    } catch (aiError) {
      console.error('AI Processing Error:', aiError.message);

      // Fallback: Direct keyword-based overview if AI fails
      const overview = await getCRMOverview();
      return {
        response: `I'm having trouble processing your request with the AI model right now. However, based on your data summary:\n\n${overview}\n\nWhat specific information would you like about these items?`,
        sources: [{ type: 'crm_overview', data: 'Direct fallback summary' }]
      };
    }

  } catch (error) {
    console.error('Error generating AI response:', error);
    return {
      response: 'Unable to retrieve CRM data right now.'
    };
  }
}

// Generate comprehensive CRM overview
function generateCRMOverview() {
  const totalContacts = mockCRMData.contacts.length;
  const activeDeals = mockCRMData.deals.filter(d => d.stage !== 'closed').length;
  const openTickets = mockCRMData.tickets.filter(t => t.status === 'open').length;
  const activeTenders = mockCRMData.tenders.filter(t => t.status === 'bidding' || t.status === 'evaluation').length;
  const totalPipelineValue = mockCRMData.deals.reduce((sum, deal) => sum + deal.value, 0);
  const totalTenderValue = mockCRMData.tenders.reduce((sum, tender) => sum + tender.value, 0);

  const highValueDeals = mockCRMData.deals.filter(d => d.value > 100000);
  const urgentTenders = mockCRMData.tenders.filter(t => {
    const daysUntilDeadline = Math.floor((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilDeadline <= 7;
  });

  let response = `Here's your complete CRM overview:\n\n`;
  response += `📊 **Summary**\n`;
  response += `• ${totalContacts} contacts\n`;
  response += `• ${activeDeals} active deals worth $${totalPipelineValue.toLocaleString()}\n`;
  response += `• ${activeTenders} active tenders worth $${totalTenderValue.toLocaleString()}\n`;
  response += `• ${openTickets} open tickets\n\n`;

  response += `🔥 **Key Opportunities**\n`;
  if (highValueDeals.length > 0) {
    response += `• ${highValueDeals.length} high-value deals (>$100K)\n`;
  }
  if (urgentTenders.length > 0) {
    response += `• ${urgentTenders.length} tenders with deadlines in 7 days\n`;
  }

  response += `\n💡 **Recent Activity**\n`;
  response += `• Latest activities: calls, emails, and meetings tracked\n`;
  response += `• Ticket support: ${openTickets} issues requiring attention\n`;

  const suggestions = [
    { text: 'Follow up on high-value deals', action: 'deals', data: { filter: 'high_value' } },
    { text: 'Review urgent tender deadlines', action: 'tenders', data: { filter: 'urgent' } },
    { text: 'Address open support tickets', action: 'tickets', data: { filter: 'open' } }
  ];

  const sources = [
    { type: 'contacts', data: { count: totalContacts } },
    { type: 'deals', data: { count: activeDeals, value: totalPipelineValue } },
    { type: 'tenders', data: { count: activeTenders, value: totalTenderValue } },
    { type: 'tickets', data: { count: openTickets } }
  ];

  return { response, suggestions, sources };
}

// Generate smart suggestions based on CRM data
function generateSuggestions(searchResults, userMessage) {
  const suggestions = [];

  // Analyze search results for actionable insights
  searchResults.forEach(result => {
    const { type, data } = result.metadata;

    switch (type) {
      case 'contact':
        if (data.status === 'lead' && data.lastContact) {
          const daysSinceContact = Math.floor((new Date() - new Date(data.lastContact)) / (1000 * 60 * 60 * 24));
          if (daysSinceContact > 3) {
            suggestions.push({
              text: `Follow up with ${data.name} (${daysSinceContact} days since last contact)`,
              action: 'contact',
              data: { contactId: data.id, name: data.name }
            });
          }
        }
        break;

      case 'deal':
        if (data.stage === 'negotiation' && data.probability > 70) {
          suggestions.push({
            text: `Push to close "${data.name}" (${data.probability}% probability)`,
            action: 'deal',
            data: { dealId: data.id, name: data.name }
          });
        }
        break;

      case 'ticket':
        if (data.priority === 'high' && data.status === 'open') {
          suggestions.push({
            text: `Address high-priority ticket: ${data.title}`,
            action: 'ticket',
            data: { ticketId: data.id, title: data.title }
          });
        }
        break;

      case 'tender':
        if (data.status === 'bidding') {
          const daysUntilDeadline = Math.floor((new Date(data.deadline) - new Date()) / (1000 * 60 * 60 * 24));
          if (daysUntilDeadline <= 7) {
            suggestions.push({
              text: `Submit bid for "${data.title}" (${daysUntilDeadline} days until deadline)`,
              action: 'tender',
              data: { tenderId: data.id, title: data.title }
            });
          }
        }
        break;
    }
  });

  return suggestions.slice(0, 3); // Limit to 3 suggestions
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  const sessionId = uuidv4();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'chat':
          const response = await generateAIResponse(data.message, sessionId);
          ws.send(JSON.stringify({
            type: 'chat_response',
            sessionId,
            ...response
          }));
          break;

        case 'action':
          // Handle actionable button clicks
          ws.send(JSON.stringify({
            type: 'action_response',
            action: data.action,
            data: data.data,
            message: `Action "${data.action}" executed successfully`
          }));
          break;

        case 'refresh':
          // Handle real-time data refresh request
          console.log('🔄 Real-time refresh requested from frontend...');
          const refreshSuccess = await refreshCRMData();
          ws.send(JSON.stringify({
            type: 'refresh_response',
            success: refreshSuccess,
            message: refreshSuccess ? 'CRM data refreshed successfully' : 'Failed to refresh CRM data',
            timestamp: new Date().toISOString()
          }));
          break;
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process message'
      }));
    }
  });

  ws.on('close', () => {
    // Clean up session if needed
  });
});

// REST API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/crm/summary', async (req, res) => {
  try {
    const summary = {
      totalContacts: mockCRMData.contacts.length,
      activeDeals: mockCRMData.deals.filter(d => d.stage !== 'closed').length,
      openTickets: mockCRMData.tickets.filter(t => t.status === 'open').length,
      activeTenders: mockCRMData.tenders.filter(t => t.status === 'bidding' || t.status === 'evaluation').length,
      totalPipelineValue: mockCRMData.deals.reduce((sum, deal) => sum + deal.value, 0),
      totalTenderValue: mockCRMData.tenders.reduce((sum, tender) => sum + tender.value, 0)
    };
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch CRM summary' });
  }
});

app.post('/api/crm/search', async (req, res) => {
  try {
    const { query } = req.body;
    const results = await searchCRMData(query);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search CRM data' });
  }
});

// Refresh CRM data manually
app.post('/api/refresh-data', async (req, res) => {
  try {
    console.log('🔄 Manual data refresh requested...');
    await indexCRMData();
    console.log('✅ CRM data reindexed successfully');
    res.json({
      success: true,
      message: 'CRM data refreshed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error refreshing CRM data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh CRM data'
    });
  }
});

// Refresh specific collection
app.post('/api/refresh/:collection', async (req, res) => {
  try {
    const { collection } = req.params;
    console.log(`🔄 Refreshing ${collection} collection...`);

    // Re-index specific collection data
    if (collection === 'tenders') {
      const tenders = await queryFirebaseData('tenders');
      console.log(`📊 Refreshed ${tenders.length} tenders`);
    } else if (collection === 'projects') {
      const projects = await queryFirebaseData('projects');
      console.log(`📊 Refreshed ${projects.length} projects`);
    } else if (collection === 'payments') {
      const payments = await queryFirebaseData('payments');
      console.log(`📊 Refreshed ${payments.length} payments`);
    } else if (collection === 'subscriptions') {
      const subscriptions = await queryFirebaseData('subscriptions');
      console.log(`📊 Refreshed ${subscriptions.length} subscriptions`);
    } else if (collection === 'registrations') {
      const registrations = await queryFirebaseData('registrations');
      console.log(`📊 Refreshed ${registrations.length} registrations`);
    } else if (collection === 'files') {
      const files = await queryFirebaseData('files');
      console.log(`📊 Refreshed ${files.length} files`);
    } else if (collection === 'contacts') {
      const contacts = await queryFirebaseData('contacts');
      console.log(`📊 Refreshed ${contacts.length} contacts`);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection name'
      });
    }

    res.json({
      success: true,
      message: `${collection} data refreshed successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error refreshing ${req.params.collection}:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to refresh ${req.params.collection} data`
    });
  }
});

// Real-time data refresh function
async function refreshCRMData() {
  try {
    console.log('🔄 Real-time CRM data refresh started...');
    await indexCRMData();
    console.log('✅ Real-time CRM data refresh completed');
    return true;
  } catch (error) {
    console.error('❌ Error in real-time CRM data refresh:', error);
    return false;
  }
}

// Schedule periodic data reindexing (every 6 hours)
cron.schedule('0 */6 * * *', async () => {
  console.log('🔄 Scheduled CRM data reindexing...');
  await refreshCRMData();
});

// Schedule more frequent refresh during business hours (every 30 minutes from 9 AM to 6 PM)
cron.schedule('*/30 9-18 * * 1-5', async () => {
  console.log('🔄 Business hours CRM data refresh...');
  await refreshCRMData();
});

// Initialize and start server
async function startServer() {
  // await initializeChromaDB();

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`AI Chat Backend server running on port ${PORT}`);
    console.log(`WebSocket server ready for connections`);
  });
}

startServer().catch(console.error);
