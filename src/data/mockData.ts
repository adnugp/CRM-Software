import { Project, Tender, Employee, Registration, Payment, Subscription, Partner } from '@/types';

export const employees: Employee[] = [
  { id: '1', name: 'Mohamed Ismayil', email: 'mmismayil2003@gmail.com', department: 'Engineering', position: 'AI Engineer', phone: '+971 50 123 4567', joinDate: '2022-03-15', status: 'active' },
  { id: '2', name: 'Mohamed Ajumal', email: 'ajumal@gptechnologies.ae', department: 'Sales', position: 'AI Engineer', phone: '+971 50 234 5678', joinDate: '2021-08-20', status: 'active' },
];

export const projects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    company: 'TechCorp',
    belongsTo: 'Grow Plus Technologies',
    status: 'in-progress',
    assignedTo: '1',
    assignedToName: 'Ahmed Hassan',
    deadline: '2024-03-15',
    document: 'project_spec.pdf',
    description: 'Complete website redesign with modern UI/UX',
    budget: 50000,
    tasks: [
      { id: 't1', projectId: '1', name: 'UI Mockups', description: 'Create initial UI designs', assignedTo: '1', assignedToName: 'Ahmed Hassan', dueDate: '2024-03-01', status: 'completed', priority: 'high' },
      { id: 't2', projectId: '1', name: 'Frontend Dev', description: 'Implement React components', assignedTo: '2', assignedToName: 'Sarah Johnson', dueDate: '2024-03-10', status: 'in-progress', priority: 'medium' },
      { id: 't3', projectId: '1', name: 'User Testing', description: 'Conduct usability tests', assignedTo: '1', assignedToName: 'Ahmed Hassan', dueDate: '2024-03-14', status: 'pending', priority: 'low' }
    ],
    costs: [
      { id: 'c1', projectId: '1', description: 'Software Licenses', amount: 1500, date: '2024-02-10', category: 'software' },
      { id: 'c2', projectId: '1', description: 'Cloud Infrastructure', amount: 2000, date: '2024-02-15', category: 'other' },
      { id: 'c3', projectId: '1', description: 'Freelance Designer', amount: 5000, date: '2024-02-20', category: 'labor' }
    ]
  },
  { id: '2', name: 'Mobile App Development', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', status: 'running', assignedTo: '2', assignedToName: 'Sarah Johnson', deadline: '2024-04-20', document: 'app_requirements.pdf', description: 'Native mobile app for iOS and Android', budget: 75000 },
  { id: '3', name: 'ERP Implementation', company: 'QWE Solutions', belongsTo: 'Grow Plus Technologies', status: 'completed', assignedTo: '3', assignedToName: 'Mohammed Ali', deadline: '2024-02-28', document: 'erp_docs.pdf', description: 'Full ERP system implementation', budget: 120000 },
  { id: '4', name: 'Cloud Migration', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', status: 'running', assignedTo: '1', assignedToName: 'Ahmed Hassan', deadline: '2024-05-10', description: 'Migrate infrastructure to AWS', budget: 30000 },
  { id: '5', name: 'Security Audit', company: 'Al Thahir Group', belongsTo: 'Sadeem Energy', status: 'handed-over', assignedTo: '4', assignedToName: 'Emily Chen', deadline: '2024-03-30', description: 'Comprehensive security assessment', budget: 15000 },
  { id: '6', name: 'Data Analytics Platform', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', status: 'running', assignedTo: '2', assignedToName: 'Sarah Johnson', deadline: '2024-06-15', description: 'Build custom analytics dashboard', budget: 60000 },
  { 
    id: '7', 
    name: 'Smart Surveillance System', 
    company: 'Dubai Police', 
    organizationId: 'ORG-DP-001',
    belongsTo: 'Grow Plus Technologies', 
    status: 'in-progress', 
    assignedTo: '1', 
    assignedToName: 'Mohamed Ismayil', 
    deadline: '2024-08-20', 
    description: 'Advanced AI surveillance for city safety.', 
    budget: 250000,
    tasks: [
      { id: 'dp1', projectId: '7', name: 'Camera Installation', description: 'Install high-res cameras at HQ', assignedTo: '1', assignedToName: 'Mohamed Ismayil', dueDate: '2024-05-10', status: 'completed', priority: 'high' },
      { id: 'dp2', projectId: '7', name: 'AI Model Training', description: 'Train facial recognition models', assignedTo: '1', assignedToName: 'Mohamed Ismayil', dueDate: '2024-06-15', status: 'in-progress', priority: 'high' },
      { id: 'dp3', projectId: '7', name: 'Control Room Setup', description: 'Configure monitoring dashboards', assignedTo: '1', assignedToName: 'Mohamed Ismayil', dueDate: '2024-07-20', status: 'pending', priority: 'medium' }
    ]
  },
];

export const tenders: Tender[] = [
  { id: '1', rfqCode: 'RFQ-GP-2024-001', portal: 'Tejari', name: 'Government Portal Development', company: 'Ministry of Technology', belongsTo: 'Grow Plus Technologies', status: 'running', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-25', document: 'tender_specs.pdf', description: 'E-government portal development' },
  { id: '2', rfqCode: 'RFQ-SE-2024-015', portal: 'e-Supply', name: 'Smart City Infrastructure', company: 'Dubai Municipality', belongsTo: 'Sadeem Energy', status: 'submitted', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-15', document: 'smart_city.pdf', description: 'IoT infrastructure for smart city' },
  { id: '3', rfqCode: 'RFP-GP-2024-042', portal: 'DHA Portal', name: 'Healthcare Management System', company: 'DHA', belongsTo: 'Grow Plus Technologies', status: 'awarded', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-05-01', document: 'healthcare_system.pdf', description: 'Hospital management software' },
  { id: '4', rfqCode: 'RFQ-SE-2024-008', portal: 'Etisalat Portal', name: 'Banking Software Upgrade', company: 'National Bank', belongsTo: 'Sadeem Energy', status: 'cancelled', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-02-20', document: 'banking_upgrade.pdf', description: 'Core banking system upgrade' },
  { id: '5', rfqCode: 'RFQ-GP-2024-022', portal: 'MOE Portal', name: 'Education Platform', company: 'Ministry of Education', belongsTo: 'Grow Plus Technologies', status: 'running', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-04-30', document: 'education_platform.pdf', description: 'E-learning platform development' },
  { id: '6', rfqCode: 'RFQ-SE-2024-031', portal: 'RTA Portal', name: 'Transport Management System', company: 'RTA', belongsTo: 'Sadeem Energy', status: 'submitted', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-06-15', document: 'transport_system.pdf', description: 'Transport management system' },
  { id: '7', rfqCode: 'RFQ-DP-2024-088', portal: 'Dubai Police Portal', name: 'Cybersecurity Enhancement', company: 'Dubai Police', organizationId: 'ORG-DP-001', belongsTo: 'Grow Plus Technologies', status: 'running', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-07-15', description: 'Upgrading network security across departments.' },
];

export const registrations: Registration[] = [

  { id: '5', name: 'Municipality License Renewal', company: 'Al Thahir Group', belongsTo: 'Sadeem Energy', type: 'Municipality License', registrationDate: '2024-01-01', expiryDate: '2024-12-31', status: 'pending' },
];

export const payments: Payment[] = [
  { id: '1', description: 'Office Rent - March 2024', amount: 15000, dueDate: '2024-03-01', status: 'pending', company: 'Property Management LLC' },
  { id: '2', description: 'Software Licenses', amount: 5500, dueDate: '2024-02-28', status: 'overdue', company: 'Microsoft' },
  { id: '3', description: 'Utility Bills', amount: 2300, dueDate: '2024-03-15', status: 'pending', company: 'DEWA' },
  { id: '4', description: 'Insurance Premium', amount: 8000, dueDate: '2024-03-20', status: 'pending', company: 'National Insurance' },
  { id: '5', description: 'Equipment Purchase', amount: 12000, dueDate: '2024-02-15', status: 'paid', company: 'Tech Suppliers' },
];

export const subscriptions: Subscription[] = [
  { id: '1', name: 'Microsoft 365 Business', provider: 'Microsoft', amount: 1200, billingCycle: 'monthly', nextBillingDate: '2024-03-01', status: 'active' },
  { id: '2', name: 'AWS Cloud Services', provider: 'Amazon', amount: 3500, billingCycle: 'monthly', nextBillingDate: '2024-03-05', status: 'active' },
  { id: '3', name: 'Salesforce CRM', provider: 'Salesforce', amount: 18000, billingCycle: 'yearly', nextBillingDate: '2024-06-15', status: 'active' },
  { id: '4', name: 'Slack Business+', provider: 'Slack', amount: 800, billingCycle: 'monthly', nextBillingDate: '2024-03-10', status: 'active' },
  { id: '5', name: 'Adobe Creative Cloud', provider: 'Adobe', amount: 4800, billingCycle: 'yearly', nextBillingDate: '2024-08-20', status: 'cancelled' },
];

export const partners: Partner[] = [
  { id: '1', name: 'Mohammed Al Rashid', company: 'Al Rashid Holdings', email: 'mohammed@alrashid.com', phone: '+971 50 111 2222', partnershipType: 'Strategic Partner', since: '2020-05-15', status: 'active' },
  { id: '2', name: 'Lisa Wang', company: 'Pacific Tech Solutions', email: 'lisa@pacifictech.com', phone: '+852 9876 5432', partnershipType: 'Technology Partner', since: '2021-09-01', status: 'active' },
  { id: '3', name: 'James Anderson', company: 'Global Consulting Group', email: 'james@gcg.com', phone: '+1 555 123 4567', partnershipType: 'Consulting Partner', since: '2019-03-20', status: 'active' },
  { id: '4', name: 'Fatima Al Zahra', company: 'Al Zahra Investments', email: 'fatima@alzahra.ae', phone: '+971 50 333 4444', partnershipType: 'Investment Partner', since: '2022-01-10', status: 'inactive' },
];

export const companies = ['TechCorp', 'ZXY Industries', 'QWE Solutions', 'Al Thahir Group'];
export const assignees = employees.map(e => ({ id: e.id, name: e.name }));

