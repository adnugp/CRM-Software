import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import setupNotificationService from './notification-service.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


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

// Initialize Firebase
let db = null;
try {
  const firebaseConfig = {
    apiKey: "AIzaSyBcCR3upbuvG1fQFUOE9qLnITa8tk41cXI",
    authDomain: "crm-gpt-2026.firebaseapp.com",
    projectId: "crm-gpt-2026",
    storageBucket: "crm-gpt-2026.firebasestorage.app",
    messagingSenderId: "1041174966108",
    appId: "1:1041174966108:web:171f4acd2017d0256c5b99",
    measurementId: "G-43ZZ93G0VT"
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
  tenders: [
    { id: '1', name: 'Government Portal Development', company: 'Ministry of Technology', status: 'open', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-25', description: 'E-government portal development' },
    { id: '2', name: 'Smart City Infrastructure', company: 'Dubai Municipality', status: 'submitted', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-15', description: 'IoT infrastructure for smart city' },
    { id: '3', name: 'Healthcare Management System', company: 'DHA', status: 'awarded', assignedToName: 'Mohamed Ismayil', deadline: '2024-05-01', description: 'Hospital management software' },
    { id: '4', name: 'Banking Software Upgrade', company: 'National Bank', status: 'closed', assignedToName: 'Mohamed Ajumal', deadline: '2024-02-20', description: 'Core banking system upgrade' },
    { id: '5', name: 'Education Platform', company: 'Ministry of Education', status: 'open', assignedToName: 'Mohamed Ismayil', deadline: '2024-04-30', description: 'E-learning platform development' }
  ],
  projects: [
    { id: '1', name: 'Website Redesign', company: 'TechCorp', status: 'in-progress', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-15', description: 'Complete website redesign with modern UI/UX' },
    { id: '2', name: 'Mobile App Development', company: 'ZXY Industries', status: 'running', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-20', description: 'Native mobile app for iOS and Android' },
    { id: '3', name: 'ERP Implementation', company: 'QWE Solutions', status: 'completed', assignedToName: 'Mohammed Ali', deadline: '2024-02-28', description: 'Full ERP system implementation' },
    { id: '4', name: 'Security Audit', company: 'Al Thahir Group', status: 'handed-over', assignedToName: 'Emily Chen', deadline: '2024-03-30', description: 'Comprehensive security assessment' }
  ],
  payments: [
    { id: '1', description: 'Office Rent - March 2024', amount: 15000, dueDate: '2024-03-01', status: 'pending', company: 'Property Management LLC' },
    { id: '2', description: 'Software Licenses', amount: 5500, dueDate: '2024-02-28', status: 'overdue', company: 'Microsoft' }
  ],
  employees: [
    { id: '1', name: 'Mohamed Ismayil', email: 'mmismayil2003@gmail.com', company: 'Grow Plus Technologies', department: 'Engineering', position: 'AI Engineer', phone: '+971 50 123 4567', status: 'active', joinDate: '2023-01-15' },
    { id: '2', name: 'Mohamed Ajumal', email: 'ajumal@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Sales', position: 'AI Engineer', phone: '+971 50 234 5678', status: 'active', joinDate: '2023-02-20' },
    { id: '3', name: 'Muhammed Adnan', email: 'muhammed.adnan@gptechnologies.ae', company: 'Grow Plus Technologies', department: 'Management', position: 'Project Manager', phone: '+971 50 345 6789', status: 'active', joinDate: '2022-06-10' }
  ],
  files: [
    { id: '1', name: 'Contract Agreement', type: 'PDF', size: '2.5MB', uploadDate: '2024-01-15', status: 'active' },
    { id: '2', name: 'Invoice Template', type: 'Document', size: '1.2MB', uploadDate: '2024-01-14', status: 'active' },
    { id: '3', name: 'Company Logo', type: 'Image', size: '500KB', uploadDate: '2024-01-13', status: 'archived' }
  ],
  registrations: [
    { id: '1', name: 'isupplier', company: 'Dubai Police Department', type: 'Commercial License', registrationNumber: 'CL-2025-001', status: 'active', registrationDate: '2025-07-16', expiryDate: '2026-07-16' },
    { id: '2', name: 'SME Champions', company: 'GP', type: 'Commercial License', registrationNumber: 'CL-2025-002', status: 'active', registrationDate: '2025-12-25', expiryDate: '2029-10-10' }
  ]
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

// Set up file uploads directory
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set up static serving for the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload Endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Construct full URL using req.protocol and req.get('host')
  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  
  res.json({
    message: 'File uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  });
});

// In-memory storage for chat sessions
const chatSessions = new Map();

// Query Firebase CRM data
async function queryFirebaseData(collectionName) {
  if (!db) {
    console.log(`Firebase not available, returning mock data for ${collectionName}`);
    return mockCRMData[collectionName] || [];
  }

  try {
    console.log(`Querying Firebase collection: ${collectionName}`);
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

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
    return mockCRMData[collectionName] || [];
  }
}

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
        num_predict: parseInt(process.env.OLLAMA_NUM_PREDICT) || 500
      }
    }, {
      timeout: 15000
    });

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

// Generate AI response with comprehensive direct filtering
async function generateAIResponse(message, sessionId) {
  try {
    console.log(`🔍 Processing message: "${message}"`);
    console.log('🚀 Starting generateAIResponse function...');

    let lowerMessage = message.toLowerCase().trim();
    console.log(`📝 Lowercase message: "${lowerMessage}"`);

    const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'];
    console.log('📝 Checking greetings...');

    // More precise greeting detection - check if message is exactly a greeting or starts with greeting
    const isGreeting = greetings.some(greeting => {
      const trimmedMessage = lowerMessage.trim();
      return trimmedMessage === greeting ||
        trimmedMessage.startsWith(greeting + ' ') ||
        trimmedMessage.endsWith(' ' + greeting) ||
        (trimmedMessage.includes(' ' + greeting + ' '));
    });

    if (isGreeting) {
      console.log('📝 Greeting detected, returning greeting response');
      return {
        response: 'Hello! I\'m your CRM AI assistant. I can help you with tenders, projects, payments, employees, files, and registrations. What would you like to know?'
      };
    }

    console.log('📝 Checking tender queries...');

    // Handle tender queries directly
    if (lowerMessage.includes('tender') || lowerMessage.includes('tenders')) {
      console.log('🎯 Direct tender query detected');
      const tenders = await queryFirebaseData('tenders');

      if (tenders.length === 0) {
        return { response: 'No tender data available in your CRM.' };
      }

      let filteredTenders = tenders;
      let filterDescription = '';

      // Enhanced company/parent company filtering - check first for better specificity
      if (lowerMessage.includes('sadeem energy') || lowerMessage.includes('sadeem')) {
        filteredTenders = filteredTenders.filter(t =>
          (t.belongsTo || '').toLowerCase().includes('sadeem') ||
          (t.company || '').toLowerCase().includes('sadeem') ||
          (t.name || '').toLowerCase().includes('sadeem')
        );
        filterDescription = 'Sadeem Energy';
      } else if (lowerMessage.includes('growplus technologies') || lowerMessage.includes('growplus') || lowerMessage.includes('grow plus')) {
        filteredTenders = filteredTenders.filter(t =>
          (t.belongsTo || '').toLowerCase().includes('growplus') ||
          (t.belongsTo || '').toLowerCase().includes('grow plus') ||
          (t.company || '').toLowerCase().includes('growplus') ||
          (t.company || '').toLowerCase().includes('grow plus') ||
          (t.name || '').toLowerCase().includes('growplus') ||
          (t.name || '').toLowerCase().includes('grow plus')
        );
        filterDescription = 'Grow Plus Technologies';
      } else {
        // General company filtering
        const tenderCompanies = [...new Set(tenders.map(t => (t.company || '').toLowerCase()))];
        for (const company of tenderCompanies) {
          if (lowerMessage.includes(company)) {
            filteredTenders = filteredTenders.filter(t => (t.company || '').toLowerCase() === company);
            filterDescription = filterDescription ? `from ${company}` : company;
            break;
          }
        }
      }

      // Enhanced status filtering - support multiple statuses
      const statusFilters = [];
      if (lowerMessage.includes('open')) statusFilters.push('open');
      if (lowerMessage.includes('submitted')) statusFilters.push('submitted');
      if (lowerMessage.includes('awarded')) statusFilters.push('awarded');
      if (lowerMessage.includes('closed')) statusFilters.push('closed');
      if (lowerMessage.includes('on hold') || lowerMessage.includes('onhold') || lowerMessage.includes('hold')) statusFilters.push('on-hold', 'on hold', 'hold');

      if (statusFilters.length > 0) {
        filteredTenders = filteredTenders.filter(t =>
          statusFilters.some(status =>
            Array.isArray(status) ? status.includes(t.status) : t.status === status
          )
        );
        filterDescription = filterDescription ? `${filterDescription} ${statusFilters.join(' and ')}` : statusFilters.join(' and ');
      }

      // Enhanced name filtering - check multiple name variations
      const nameVariations = {
        'ismayil': ['ismayil', 'ismail', 'is mail'],
        'ajumal': ['ajumal', 'ajmal', 'a jumal'],
        'adnan': ['adnan', 'ad nan'],
        'mohamed': ['mohamed', 'mohammed', 'mohammad', 'muhammad', 'mohamed'],
        'muhammed': ['muhammed', 'mohammed', 'muhammad', 'mohammad'],
        'pranav': ['pranav']
      };

      for (const [baseName, variations] of Object.entries(nameVariations)) {
        for (const variation of variations) {
          if (lowerMessage.includes(variation)) {
            filteredTenders = filteredTenders.filter(t => (t.assignedToName || '').toLowerCase().includes(baseName));
            filterDescription = filterDescription ? `${baseName} ${filterDescription}` : `assigned to ${baseName}`;
            break;
          }
        }
        if (filterDescription.includes('assigned to')) break;
      }

      // Deadline/date filtering
      if (lowerMessage.includes('today') || lowerMessage.includes('due today')) {
        const today = new Date().toISOString().split('T')[0];
        filteredTenders = filteredTenders.filter(t => t.deadline === today);
        filterDescription = filterDescription ? `${filterDescription} due today` : 'due today';
      } else if (lowerMessage.includes('overdue') || lowerMessage.includes('expired')) {
        const today = new Date().toISOString().split('T')[0];
        filteredTenders = filteredTenders.filter(t => t.deadline < today && t.status !== 'closed');
        filterDescription = filterDescription ? `${filterDescription} overdue` : 'overdue';
      } else if (lowerMessage.includes('upcoming') || lowerMessage.includes('future')) {
        const today = new Date().toISOString().split('T')[0];
        filteredTenders = filteredTenders.filter(t => t.deadline > today);
        filterDescription = filterDescription ? `${filterDescription} upcoming` : 'upcoming';
      }

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

      const response = `Found ${filteredTenders.length} ${filterDescription || 'tender(s)'}:\n\n${filteredTenders.map(t => `• ${t.name} - ${t.company} - ${t.status} - Assigned to: ${t.assignedToName || 'N/A'} - Deadline: ${t.deadline || 'N/A'}${t.belongsTo ? ` - Belongs to: ${t.belongsTo}` : ''}`).join('\n')}`;
      return { response };
    }

    // Handle project queries directly
    if (lowerMessage.includes('project') || lowerMessage.includes('projects') ||
      ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed'].some(name => lowerMessage.includes(name.toLowerCase()))) {
      console.log('🎯 Direct project query detected');
      const projects = await queryFirebaseData('projects');

      if (projects.length === 0) {
        return { response: 'No project data available in your CRM.' };
      }

      let filteredProjects = projects;
      let filterDescription = '';

      // Enhanced company/parent company filtering - check first for better specificity
      if (lowerMessage.includes('sadeem energy') || lowerMessage.includes('sadeem')) {
        filteredProjects = filteredProjects.filter(p =>
          (p.belongsTo || '').toLowerCase().includes('sadeem') ||
          (p.company || '').toLowerCase().includes('sadeem') ||
          (p.name || '').toLowerCase().includes('sadeem') ||
          (p.description || '').toLowerCase().includes('sadeem')
        );
        filterDescription = 'Sadeem Energy';
      } else if (lowerMessage.includes('growplus technologies') || lowerMessage.includes('growplus') || lowerMessage.includes('grow plus')) {
        filteredProjects = filteredProjects.filter(p =>
          (p.belongsTo || '').toLowerCase().includes('growplus') ||
          (p.belongsTo || '').toLowerCase().includes('grow plus') ||
          (p.company || '').toLowerCase().includes('growplus') ||
          (p.company || '').toLowerCase().includes('grow plus') ||
          (p.name || '').toLowerCase().includes('growplus') ||
          (p.name || '').toLowerCase().includes('grow plus') ||
          (p.description || '').toLowerCase().includes('growplus') ||
          (p.description || '').toLowerCase().includes('grow plus')
        );
        filterDescription = 'Grow Plus Technologies';
      } else {
        // General company filtering
        const projectCompanies = [...new Set(projects.map(p => (p.company || '').toLowerCase()))];
        for (const company of projectCompanies) {
          if (lowerMessage.includes(company)) {
            filteredProjects = filteredProjects.filter(p => (p.company || '').toLowerCase() === company);
            filterDescription = filterDescription ? `from ${company}` : company;
            break;
          }
        }
      }

      // Specific project name filtering - check for exact project names first
      const projectNames = [...new Set(projects.map(p => (p.name || '').toLowerCase()))];
      let foundSpecificProject = false;

      for (const projectName of projectNames) {
        if (lowerMessage.includes(projectName) && projectName.length > 2) {
          filteredProjects = filteredProjects.filter(p => (p.name || '').toLowerCase() === projectName);
          filterDescription = `project "${projectName}"`;
          foundSpecificProject = true;
          break;
        }
      }

      // Enhanced name filtering - only if no specific project found
      if (!foundSpecificProject) {
        const nameVariations = {
          'ismayil': ['ismayil', 'ismail', 'is mail'],
          'ajumal': ['ajumal', 'ajmal', 'a jumal'],
          'adnan': ['adnan', 'ad nan'],
          'mohamed': ['mohamed', 'mohammed', 'mohammad', 'muhammad', 'mohamed'],
          'muhammed': ['muhammed', 'mohammed', 'muhammad', 'mohammad'],
          'pranav': ['pranav']
        };

        for (const [baseName, variations] of Object.entries(nameVariations)) {
          for (const variation of variations) {
            if (lowerMessage.includes(variation)) {
              filteredProjects = filteredProjects.filter(p => (p.assignedToName || '').toLowerCase().includes(baseName));
              filterDescription = filterDescription ? `${baseName} ${filterDescription}` : `assigned to ${baseName}`;
              break;
            }
          }
          if (filterDescription.includes('assigned to')) break;
        }
      }

      // Enhanced status filtering - support multiple statuses
      const statusFilters = [];
      if (lowerMessage.includes('running')) statusFilters.push('running');
      if (lowerMessage.includes('in-progress') || lowerMessage.includes('in progress') || lowerMessage.includes('inprogress')) statusFilters.push('in-progress');
      if (lowerMessage.includes('completed') || lowerMessage.includes('complete') || lowerMessage.includes('done') || lowerMessage.includes('finished')) statusFilters.push('completed');
      if (lowerMessage.includes('handed-over') || lowerMessage.includes('handed over') || lowerMessage.includes('handedover') || lowerMessage.includes('hand over') || lowerMessage.includes('handover')) statusFilters.push('handed-over');

      if (statusFilters.length > 0) {
        filteredProjects = filteredProjects.filter(p =>
          statusFilters.some(status => p.status === status)
        );
        filterDescription = filterDescription ? `${filterDescription} ${statusFilters.join(' and ')}` : statusFilters.join(' and ');
      }

      // Deadline/date filtering
      if (lowerMessage.includes('today') || lowerMessage.includes('due today')) {
        const today = new Date().toISOString().split('T')[0];
        filteredProjects = filteredProjects.filter(p => p.deadline === today);
        filterDescription = filterDescription ? `${filterDescription} due today` : 'due today';
      } else if (lowerMessage.includes('overdue') || lowerMessage.includes('expired')) {
        const today = new Date().toISOString().split('T')[0];
        filteredProjects = filteredProjects.filter(p => p.deadline < today && p.status !== 'completed');
        filterDescription = filterDescription ? `${filterDescription} overdue` : 'overdue';
      } else if (lowerMessage.includes('upcoming') || lowerMessage.includes('future')) {
        const today = new Date().toISOString().split('T')[0];
        filteredProjects = filteredProjects.filter(p => p.deadline > today);
        filterDescription = filterDescription ? `${filterDescription} upcoming` : 'upcoming';
      }

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

      const response = `Found ${filteredProjects.length} ${filterDescription || 'project(s)'}:\n\n${filteredProjects.map(p => `• ${p.name} - ${p.company} - ${p.status} - Assigned to: ${p.assignedToName || 'N/A'} - Deadline: ${p.deadline || 'N/A'}${p.belongsTo ? ` - Belongs to: ${p.belongsTo}` : ''}`).join('\n')}`;
      return { response };
    }

    // Handle payment queries directly
    if (lowerMessage.includes('payment') || lowerMessage.includes('payments') || lowerMessage.includes('amount')) {
      console.log('🎯 Direct payment query detected');
      const payments = await queryFirebaseData('payments');

      if (payments.length === 0) {
        return { response: 'No payment data available in your CRM.' };
      }

      let filteredPayments = payments;
      let filterDescription = '';

      // Enhanced company filtering - check first for better specificity
      if (lowerMessage.includes('sadeem energy') || lowerMessage.includes('sadeem')) {
        filteredPayments = filteredPayments.filter(p =>
          (p.company || '').toLowerCase().includes('sadeem') ||
          (p.description || '').toLowerCase().includes('sadeem')
        );
        filterDescription = 'Sadeem Energy';
      } else if (lowerMessage.includes('growplus technologies') || lowerMessage.includes('growplus') || lowerMessage.includes('grow plus')) {
        filteredPayments = filteredPayments.filter(p =>
          (p.company || '').toLowerCase().includes('growplus') ||
          (p.company || '').toLowerCase().includes('grow plus') ||
          (p.description || '').toLowerCase().includes('growplus') ||
          (p.description || '').toLowerCase().includes('grow plus')
        );
        filterDescription = 'Grow Plus Technologies';
      } else {
        // General company filtering
        const paymentCompanies = [...new Set(payments.map(p => (p.company || '').toLowerCase()))];
        for (const company of paymentCompanies) {
          if (lowerMessage.includes(company)) {
            filteredPayments = filteredPayments.filter(p => (p.company || '').toLowerCase() === company);
            filterDescription = filterDescription ? `from ${company}` : company;
            break;
          }
        }
      }

      // Enhanced status filtering - support multiple statuses
      const statusFilters = [];
      if (lowerMessage.includes('pending')) statusFilters.push('pending');
      if (lowerMessage.includes('paid')) statusFilters.push('paid');
      if (lowerMessage.includes('overdue')) statusFilters.push('overdue');

      if (statusFilters.length > 0) {
        filteredPayments = filteredPayments.filter(p =>
          statusFilters.some(status => p.status === status)
        );
        filterDescription = filterDescription ? `${filterDescription} ${statusFilters.join(' and ')}` : statusFilters.join(' and ');
      }

      // Date filtering
      if (lowerMessage.includes('today') || lowerMessage.includes('due today')) {
        const today = new Date().toISOString().split('T')[0];
        filteredPayments = filteredPayments.filter(p => p.dueDate === today);
        filterDescription = filterDescription ? `${filterDescription} due today` : 'due today';
      } else if (lowerMessage.includes('overdue') || lowerMessage.includes('expired')) {
        const today = new Date().toISOString().split('T')[0];
        filteredPayments = filteredPayments.filter(p => p.dueDate < today && p.status !== 'paid');
        filterDescription = filterDescription ? `${filterDescription} overdue` : 'overdue';
      } else if (lowerMessage.includes('upcoming') || lowerMessage.includes('future')) {
        const today = new Date().toISOString().split('T')[0];
        filteredPayments = filteredPayments.filter(p => p.dueDate > today);
        filterDescription = filterDescription ? `${filterDescription} upcoming` : 'upcoming';
      }

      // Amount calculation
      const isAmountQuery = lowerMessage.includes('amount') || lowerMessage.includes('total') || lowerMessage.includes('calculate') || lowerMessage.includes('sum');

      if (isAmountQuery) {
        const totalAmount = filteredPayments.reduce((sum, p) => {
          const amount = parseFloat(p.amount) || 0;
          return sum + amount;
        }, 0);

        return {
          response: `Total ${filterDescription || 'payment'} amount: $${totalAmount.toFixed(2)} (${filteredPayments.length} payments)`
        };
      }

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

      const response = `Found ${filteredPayments.length} ${filterDescription || 'payment(s)'}:\n\n${filteredPayments.map(p => `• ${p.description} - ${p.company} - $${p.amount} - Due: ${p.dueDate} - Status: ${p.status}`).join('\n')}`;
      return { response };
    }

    // Handle employee queries directly
    if (lowerMessage.includes('employee') || lowerMessage.includes('employees') ||
      lowerMessage.includes('contact') || lowerMessage.includes('details') ||
      ['ismayil', 'ajumal', 'adnan', 'mohamed', 'muhammed'].some(name => lowerMessage.includes(name.toLowerCase()))) {
      console.log('🎯 Direct employee query detected');
      console.log('📝 Message matched employee condition:', lowerMessage);
      const employees = await queryFirebaseData('employees');

      if (employees.length === 0) {
        return { response: 'No employee data available in your CRM.' };
      }

      let filteredEmployees = employees;
      let filterDescription = '';

      // Enhanced company filtering - check first for better specificity
      if (lowerMessage.includes('sadeem energy') || lowerMessage.includes('sadeem')) {
        filteredEmployees = filteredEmployees.filter(e =>
          (e.company || '').toLowerCase().includes('sadeem')
        );
        filterDescription = 'Sadeem Energy';
      } else if (lowerMessage.includes('growplus technologies') || lowerMessage.includes('growplus') || lowerMessage.includes('grow plus')) {
        filteredEmployees = filteredEmployees.filter(e =>
          (e.company || '').toLowerCase().includes('growplus') ||
          (e.company || '').toLowerCase().includes('grow plus')
        );
        filterDescription = 'Grow Plus Technologies';
      } else {
        // General company filtering
        const employeeCompanies = [...new Set(employees.map(e => (e.company || '').toLowerCase()))];
        for (const company of employeeCompanies) {
          if (lowerMessage.includes(company)) {
            filteredEmployees = filteredEmployees.filter(e => (e.company || '').toLowerCase() === company);
            filterDescription = filterDescription ? `from ${company}` : company;
            break;
          }
        }
      }

      // Enhanced name filtering - check multiple name variations
      const nameVariations = {
        'ismayil': ['ismayil', 'ismail', 'is mail'],
        'ajumal': ['ajumal', 'ajmal', 'a jumal'],
        'adnan': ['adnan', 'ad nan'],
        'mohamed': ['mohamed', 'mohammed', 'mohammad', 'muhammad', 'mohamed'],
        'muhammed': ['muhammed', 'mohammed', 'muhammad', 'mohammad'],
        'pranav': ['pranav']
      };

      for (const [baseName, variations] of Object.entries(nameVariations)) {
        for (const variation of variations) {
          if (lowerMessage.includes(variation)) {
            filteredEmployees = filteredEmployees.filter(e => (e.name || '').toLowerCase().includes(baseName));
            filterDescription = filterDescription ? `${baseName} ${filterDescription}` : baseName;
            break;
          }
        }
        if (filterDescription && !filterDescription.includes('from')) break;
      }

      // Department filtering
      if (lowerMessage.includes('engineering')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'engineering');
        filterDescription = filterDescription ? `${filterDescription} engineering` : 'engineering';
      } else if (lowerMessage.includes('sales')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'sales');
        filterDescription = filterDescription ? `${filterDescription} sales` : 'sales';
      } else if (lowerMessage.includes('management')) {
        filteredEmployees = filteredEmployees.filter(e => (e.department || '').toLowerCase() === 'management');
        filterDescription = filterDescription ? `${filterDescription} management` : 'management';
      }

      // Enhanced status filtering - support multiple statuses
      const statusFilters = [];
      if (lowerMessage.includes('active')) statusFilters.push('active');
      if (lowerMessage.includes('inactive')) statusFilters.push('inactive');

      if (statusFilters.length > 0) {
        filteredEmployees = filteredEmployees.filter(e =>
          statusFilters.some(status => e.status === status)
        );
        filterDescription = filterDescription ? `${filterDescription} ${statusFilters.join(' and ')}` : statusFilters.join(' and ');
      }

      // Position filtering
      if (lowerMessage.includes('engineer')) {
        filteredEmployees = filteredEmployees.filter(e => (e.position || '').toLowerCase().includes('engineer'));
        filterDescription = filterDescription ? `${filterDescription} engineers` : 'engineers';
      } else if (lowerMessage.includes('manager')) {
        filteredEmployees = filteredEmployees.filter(e => (e.position || '').toLowerCase().includes('manager'));
        filterDescription = filterDescription ? `${filterDescription} managers` : 'managers';
      } else if (lowerMessage.includes('director')) {
        filteredEmployees = filteredEmployees.filter(e => (e.position || '').toLowerCase().includes('director'));
        filterDescription = filterDescription ? `${filterDescription} directors` : 'directors';
      }

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

      const response = `Found ${filteredEmployees.length} ${filterDescription || 'employee(s)'}:\n\n${filteredEmployees.map(e => `• ${e.name} - ${e.position} - ${e.department} - ${e.email} - ${e.phone}${e.company ? ` - ${e.company}` : ''}`).join('\n')}`;
      return { response };
    }

    // Handle registration queries directly
    if (lowerMessage.includes('registration') || lowerMessage.includes('registrations') ||
      lowerMessage.includes('commercial license') || lowerMessage.includes('comercial license') ||
      lowerMessage.includes('business license') ||
      lowerMessage.includes('trade license') || lowerMessage.includes('professional license') ||
      lowerMessage.includes('industrial license') || lowerMessage.includes('tourism license') ||
      lowerMessage.includes('freelance license') || lowerMessage.includes('e-commerce license')) {
      console.log('🎯 Direct registration query detected');
      console.log('📝 Message:', lowerMessage);
      const registrations = await queryFirebaseData('registrations');

      if (registrations.length === 0) {
        return { response: 'No registration data available in your CRM.' };
      }

      let filteredRegistrations = registrations;
      let filterDescription = '';

      // Enhanced company filtering - check first for better specificity
      if (lowerMessage.includes('sadeem energy') || lowerMessage.includes('sadeem')) {
        filteredRegistrations = filteredRegistrations.filter(r =>
          (r.company || '').toLowerCase().includes('sadeem') ||
          (r.name || '').toLowerCase().includes('sadeem')
        );
        filterDescription = 'Sadeem Energy';
      } else if (lowerMessage.includes('growplus technologies') || lowerMessage.includes('growplus') || lowerMessage.includes('grow plus')) {
        filteredRegistrations = filteredRegistrations.filter(r =>
          (r.company || '').toLowerCase().includes('growplus') ||
          (r.company || '').toLowerCase().includes('grow plus') ||
          (r.name || '').toLowerCase().includes('growplus') ||
          (r.name || '').toLowerCase().includes('grow plus')
        );
        filterDescription = 'Grow Plus Technologies';
      } else {
        // General company filtering
        const registrationCompanies = [...new Set(registrations.map(r => (r.company || '').toLowerCase()))];
        for (const company of registrationCompanies) {
          if (lowerMessage.includes(company)) {
            filteredRegistrations = filteredRegistrations.filter(r => (r.company || '').toLowerCase() === company);
            filterDescription = filterDescription ? `from ${company}` : company;
            break;
          }
        }
      }

      // Enhanced status filtering - support multiple statuses
      const statusFilters = [];
      if (lowerMessage.includes('active')) statusFilters.push('active');
      if (lowerMessage.includes('expired')) statusFilters.push('expired');
      if (lowerMessage.includes('pending')) statusFilters.push('pending');

      if (statusFilters.length > 0) {
        filteredRegistrations = filteredRegistrations.filter(r =>
          statusFilters.some(status => r.status === status)
        );
        filterDescription = filterDescription ? `${filterDescription} ${statusFilters.join(' and ')}` : statusFilters.join(' and ');
      }

      // Type filtering
      if (lowerMessage.includes('commercial license') || lowerMessage.includes('comercial license') || lowerMessage.includes('commercial') || lowerMessage.includes('comercial')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('commercial'));
        filterDescription = filterDescription ? `${filterDescription} commercial license` : 'commercial license';
      } else if (lowerMessage.includes('business license') || lowerMessage.includes('business')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('business'));
        filterDescription = filterDescription ? `${filterDescription} business license` : 'business license';
      } else if (lowerMessage.includes('trade license') || lowerMessage.includes('trade')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('trade'));
        filterDescription = filterDescription ? `${filterDescription} trade license` : 'trade license';
      } else if (lowerMessage.includes('professional license') || lowerMessage.includes('professional')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('professional'));
        filterDescription = filterDescription ? `${filterDescription} professional license` : 'professional license';
      } else if (lowerMessage.includes('industrial license') || lowerMessage.includes('industrial')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('industrial'));
        filterDescription = filterDescription ? `${filterDescription} industrial license` : 'industrial license';
      } else if (lowerMessage.includes('tourism license') || lowerMessage.includes('tourism')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('tourism'));
        filterDescription = filterDescription ? `${filterDescription} tourism license` : 'tourism license';
      } else if (lowerMessage.includes('freelance license') || lowerMessage.includes('freelance')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('freelance'));
        filterDescription = filterDescription ? `${filterDescription} freelance license` : 'freelance license';
      } else if (lowerMessage.includes('e-commerce license') || lowerMessage.includes('ecommerce') || lowerMessage.includes('e commerce')) {
        filteredRegistrations = filteredRegistrations.filter(r => (r.type || '').toLowerCase().includes('e-commerce') || (r.type || '').toLowerCase().includes('ecommerce'));
        filterDescription = filterDescription ? `${filterDescription} e-commerce license` : 'e-commerce license';
      }

      // Date filtering
      if (lowerMessage.includes('today') || lowerMessage.includes('expiring today')) {
        const today = new Date().toISOString().split('T')[0];
        filteredRegistrations = filteredRegistrations.filter(r => r.expiryDate === today);
        filterDescription = filterDescription ? `${filterDescription} expiring today` : 'expiring today';
      } else if (lowerMessage.includes('expired') || lowerMessage.includes('already expired')) {
        const today = new Date().toISOString().split('T')[0];
        filteredRegistrations = filteredRegistrations.filter(r => r.expiryDate < today);
        filterDescription = filterDescription ? `${filterDescription} already expired` : 'already expired';
      } else if (lowerMessage.includes('upcoming') || lowerMessage.includes('future') || lowerMessage.includes('expiring soon')) {
        const today = new Date().toISOString().split('T')[0];
        filteredRegistrations = filteredRegistrations.filter(r => r.expiryDate > today);
        filterDescription = filterDescription ? `${filterDescription} expiring soon` : 'expiring soon';
      }

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

      const response = `Found ${filteredRegistrations.length} ${filterDescription || 'registration(s)'}:\n\n${filteredRegistrations.map(r => `• ${r.name} - ${r.company} - ${r.type || 'N/A'} - Reg #: ${r.registrationNumber || 'N/A'} - Status: ${r.status || 'N/A'} - Expires: ${r.expiryDate || 'N/A'}`).join('\n')}`;
      return { response };
    }

    // Handle partner queries directly
    if (lowerMessage.includes('partner') || lowerMessage.includes('partners')) {
      console.log('🎯 Direct partner query detected');
      console.log('📝 Message:', lowerMessage);

      // Since partners might be stored in different collections, check multiple sources
      const [tenders, projects, payments, employees, files, registrations] = await Promise.all([
        queryFirebaseData('tenders'),
        queryFirebaseData('projects'),
        queryFirebaseData('payments'),
        queryFirebaseData('employees'),
        queryFirebaseData('files'),
        queryFirebaseData('registrations')
      ]);

      let partnerItems = [];
      let filterDescription = '';

      // Search for partners in all collections
      const allItems = [
        ...tenders.map(t => ({ ...t, type: 'tender', name: t.name || t.title || 'N/A' })),
        ...projects.map(p => ({ ...p, type: 'project', name: p.name || 'N/A' })),
        ...payments.map(p => ({ ...p, type: 'payment', name: p.description || 'N/A' })),
        ...employees.map(e => ({ ...e, type: 'employee', name: e.name || 'N/A' })),
        ...files.map(f => ({ ...f, type: 'file', name: f.name || 'N/A' })),
        ...registrations.map(r => ({ ...r, type: 'registration', name: r.name || 'N/A' }))
      ];

      // Filter for technology partners if specified
      if (lowerMessage.includes('technology')) {
        partnerItems = allItems.filter(item =>
          (item.name || '').toLowerCase().includes('technology') ||
          (item.company || '').toLowerCase().includes('technology') ||
          (item.category || '').toLowerCase().includes('technology')
        );
        filterDescription = 'technology partners';
      } else {
        partnerItems = allItems.filter(item =>
          (item.name || '').toLowerCase().includes('partner') ||
          (item.company || '').toLowerCase().includes('partner') ||
          (item.category || '').toLowerCase().includes('partner')
        );
        filterDescription = 'partners';
      }

      if (partnerItems.length === 0) {
        return { response: `No ${filterDescription} found in your CRM.` };
      }

      const response = `Found ${partnerItems.length} ${filterDescription}:\n\n${partnerItems.map(p => `• ${p.name} - ${p.company || 'N/A'} - ${p.type || 'N/A'}`).join('\n')}`;
      return { response };
    }

    // Handle file queries directly
    if (lowerMessage.includes('file') || lowerMessage.includes('files') ||
      lowerMessage.includes('document') || lowerMessage.includes('documents') ||
      lowerMessage.includes('image') || lowerMessage.includes('images') ||
      lowerMessage.includes('video') || lowerMessage.includes('videos') ||
      lowerMessage.includes('audio') || lowerMessage.includes('audios') ||
      lowerMessage.includes('archive') || lowerMessage.includes('archives') ||
      lowerMessage.includes('spreadsheet') || lowerMessage.includes('spreadsheets') ||
      lowerMessage.includes('presentation') || lowerMessage.includes('presentations') ||
      lowerMessage.includes('text') || lowerMessage.includes('pdf') ||
      lowerMessage.includes('doc') || lowerMessage.includes('jpg') || lowerMessage.includes('png') ||
      lowerMessage.includes('mp4') || lowerMessage.includes('mp3') || lowerMessage.includes('zip') ||
      lowerMessage.includes('report') || lowerMessage.includes('reports')) {
      console.log('🎯 Direct file query detected');
      console.log('📝 Message contains file keyword:', lowerMessage);
      const files = await queryFirebaseData('files');

      if (files.length === 0) {
        return { response: 'No file data available in your CRM.' };
      }

      let filteredFiles = files;
      let filterDescription = '';

      // Type filtering
      if (lowerMessage.includes('pdf')) {
        filteredFiles = filteredFiles.filter(f => (f.type || '').toLowerCase() === 'pdf');
        filterDescription = 'PDF';
      } else if (lowerMessage.includes('document') || lowerMessage.includes('doc') || lowerMessage.includes('documents')) {
        filteredFiles = filteredFiles.filter(f => (f.type || '').toLowerCase().includes('doc') || (f.type || '').toLowerCase().includes('document'));
        filterDescription = 'Document';
      } else if (lowerMessage.includes('report') || lowerMessage.includes('reports')) {
        filteredFiles = filteredFiles.filter(f => (f.type || '').toLowerCase().includes('report') || (f.name || '').toLowerCase().includes('report'));
        filterDescription = 'Report';
      } else if (lowerMessage.includes('license')) {
        filteredFiles = filteredFiles.filter(f => (f.type || '').toLowerCase().includes('license'));
        filterDescription = 'License';
      } else if (lowerMessage.includes('image') || lowerMessage.includes('jpg') || lowerMessage.includes('png') || lowerMessage.includes('images')) {
        filteredFiles = filteredFiles.filter(f => ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Image';
      } else if (lowerMessage.includes('video') || lowerMessage.includes('mp4') || lowerMessage.includes('avi') || lowerMessage.includes('videos')) {
        filteredFiles = filteredFiles.filter(f => ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Video';
      } else if (lowerMessage.includes('audio') || lowerMessage.includes('mp3') || lowerMessage.includes('wav') || lowerMessage.includes('audios')) {
        filteredFiles = filteredFiles.filter(f => ['mp3', 'wav', 'aac', 'flac', 'ogg'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Audio';
      } else if (lowerMessage.includes('archive') || lowerMessage.includes('zip') || lowerMessage.includes('rar') || lowerMessage.includes('archives')) {
        filteredFiles = filteredFiles.filter(f => ['zip', 'rar', '7z', 'tar', 'gz'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Archive';
      } else if (lowerMessage.includes('spreadsheet') || lowerMessage.includes('excel') || lowerMessage.includes('xls') || lowerMessage.includes('csv')) {
        filteredFiles = filteredFiles.filter(f => ['xls', 'xlsx', 'csv'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Spreadsheet';
      } else if (lowerMessage.includes('presentation') || lowerMessage.includes('powerpoint') || lowerMessage.includes('ppt') || lowerMessage.includes('slide')) {
        filteredFiles = filteredFiles.filter(f => ['ppt', 'pptx'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Presentation';
      } else if (lowerMessage.includes('text') || lowerMessage.includes('txt') || lowerMessage.includes('readme')) {
        filteredFiles = filteredFiles.filter(f => ['txt', 'md', 'readme'].includes((f.type || '').toLowerCase()));
        filterDescription = 'Text';
      }

      // Size filtering
      if (lowerMessage.includes('larger than') || lowerMessage.includes('greater than') || lowerMessage.includes('over')) {
        const sizeMatch = lowerMessage.match(/(\d+(?:\.\d+)?)\s*(mb|kb|gb)/i);
        if (sizeMatch) {
          const size = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2].toLowerCase();
          const targetSizeBytes = unit === 'gb' ? size * 1024 * 1024 * 1024 : unit === 'mb' ? size * 1024 * 1024 : size * 1024;

          filteredFiles = filteredFiles.filter(f => {
            const fileSize = f.size || '0';
            const fileSizeMatch = fileSize.match(/(\d+(?:\.\d+)?)\s*(mb|kb|gb)/i);
            if (fileSizeMatch) {
              const fileSizeNum = parseFloat(fileSizeMatch[1]);
              const fileSizeUnit = fileSizeMatch[2].toLowerCase();
              const fileSizeBytes = fileSizeUnit === 'gb' ? fileSizeNum * 1024 * 1024 * 1024 : fileSizeUnit === 'mb' ? fileSizeNum * 1024 * 1024 : fileSizeNum * 1024;
              return fileSizeBytes > targetSizeBytes;
            }
            return false;
          });
          filterDescription = filterDescription ? `larger than ${size}${unit}` : `larger than ${size}${unit}`;
        }
      }

      // Status filtering
      if (lowerMessage.includes('active')) {
        filteredFiles = filteredFiles.filter(f => f.status === 'active');
        filterDescription = filterDescription ? `active ${filterDescription}` : 'active';
      } else if (lowerMessage.includes('archived')) {
        filteredFiles = filteredFiles.filter(f => f.status === 'archived');
        filterDescription = filterDescription ? `archived ${filterDescription}` : 'archived';
      }

      const isCountQuery = lowerMessage.includes('how many') || lowerMessage.includes('count') || lowerMessage.includes('number of');

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

      const response = `Found ${filteredFiles.length} ${filterDescription || 'file(s)'}:\n\n${filteredFiles.map(f => `• ${f.name} - ${f.type || 'Unknown'} - ${f.size || 'N/A'} - Uploaded: ${f.uploadDate || 'N/A'} - Status: ${f.status || 'N/A'}`).join('\n')}`;
      return { response };
    }

    // Fallback to AI for other queries
    console.log('🤖 Query not handled by direct filtering, using AI fallback');

    const crmOverview = await getCRMOverview();
    const aiPrompt = `Based on this CRM data, please answer the user's question. Be helpful and specific.

CRM Data:
${crmOverview}

User Question: "${message}"

Please provide a comprehensive and helpful response:`;

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
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
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

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  console.log('🔌 New WebSocket connection established');

  const sessionId = uuidv4();
  chatSessions.set(sessionId, {
    ws,
    messages: [],
    connectedAt: new Date()
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`📨 Received message from session ${sessionId}:`, message);

      switch (message.type) {
        case 'chat':
          const response = await generateAIResponse(message.message, sessionId);
          ws.send(JSON.stringify({
            type: 'chat_response',
            sessionId,
            timestamp: new Date().toISOString(),
            ...response
          }));
          break;

        default:
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
            sessionId
          }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message',
        sessionId
      }));
    }
  });

  ws.on('close', () => {
    console.log(`🔌 WebSocket connection closed for session ${sessionId}`);
    chatSessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for session ${sessionId}:`, error);
  });

  ws.send(JSON.stringify({
    type: 'connection_established',
    sessionId,
    message: 'Connected to CRM AI Assistant'
  }));
});

// Initialize and start server
async function startServer() {
  console.log('🚀 Starting simplified CRM server with comprehensive direct filtering...');

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`✅ AI Chat Backend server running on port ${PORT}`);
    console.log(`✅ WebSocket server ready for connections`);
    console.log('✅ Direct filtering enabled for all CRM sections');
    console.log('✅ Fast responses (100-300ms) for all filter queries');

    // Initialize notification service for automated email alerts
    try {
      setupNotificationService(db, queryFirebaseData);
      console.log('✅ Notification service initialized');
    } catch (notificationError) {
      console.error('❌ Failed to initialize notification service:', notificationError);
    }
  });
}

startServer().catch(console.error);
