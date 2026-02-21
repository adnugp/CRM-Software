import { Project, Tender, Employee, Registration, Payment, Subscription, Partner } from '@/types';

export const employees: Employee[] = [
  { id: '1', name: 'Mohamed Ismayil', email: 'mmismayil2003@gmail.com', department: 'Engineering', position: 'AI Engineer', phone: '+971 50 123 4567', joinDate: '2022-03-15', status: 'active' },
  { id: '2', name: 'Mohamed Ajumal', email: 'ajumal@gptechnologies.ae', department: 'Sales', position: 'AI Engineer', phone: '+971 50 234 5678', joinDate: '2021-08-20', status: 'active' },
];

export const projects: Project[] = [
  { id: '1', name: 'Website Redesign', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', status: 'in-progress', assignedTo: '1', assignedToName: 'Ahmed Hassan', deadline: '2024-03-15', document: 'project_spec.pdf', description: 'Complete website redesign with modern UI/UX' },
  { id: '2', name: 'Mobile App Development', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', status: 'pending', assignedTo: '2', assignedToName: 'Sarah Johnson', deadline: '2024-04-20', document: 'app_requirements.pdf', description: 'Native mobile app for iOS and Android' },
  { id: '3', name: 'ERP Implementation', company: 'QWE Solutions', belongsTo: 'Grow Plus Technologies', status: 'completed', assignedTo: '3', assignedToName: 'Mohammed Ali', deadline: '2024-02-28', document: 'erp_docs.pdf', description: 'Full ERP system implementation' },
  { id: '4', name: 'Cloud Migration', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', status: 'in-progress', assignedTo: '1', assignedToName: 'Ahmed Hassan', deadline: '2024-05-10', description: 'Migrate infrastructure to AWS' },
  { id: '5', name: 'Security Audit', company: 'Al Thahir Group', belongsTo: 'Sadeem Energy', status: 'on-hold', assignedTo: '4', assignedToName: 'Emily Chen', deadline: '2024-03-30', description: 'Comprehensive security assessment' },
  { id: '6', name: 'Data Analytics Platform', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', status: 'pending', assignedTo: '2', assignedToName: 'Sarah Johnson', deadline: '2024-06-15', description: 'Build custom analytics dashboard' },
];

export const tenders: Tender[] = [
  { id: '1', name: 'Government Portal Development', company: 'Ministry of Technology', belongsTo: 'Grow Plus Technologies', status: 'open', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-03-25', document: 'tender_specs.pdf', description: 'E-government portal development' },
  { id: '2', name: 'Smart City Infrastructure', company: 'Dubai Municipality', belongsTo: 'Sadeem Energy', status: 'submitted', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-04-15', document: 'smart_city.pdf', description: 'IoT infrastructure for smart city' },
  { id: '3', name: 'Healthcare Management System', company: 'DHA', belongsTo: 'Grow Plus Technologies', status: 'awarded', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-05-01', document: 'healthcare_system.pdf', description: 'Hospital management software' },
  { id: '4', name: 'Banking Software Upgrade', company: 'National Bank', belongsTo: 'Sadeem Energy', status: 'closed', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-02-20', document: 'banking_upgrade.pdf', description: 'Core banking system upgrade' },
  { id: '5', name: 'Education Platform', company: 'Ministry of Education', belongsTo: 'Grow Plus Technologies', status: 'open', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-04-30', document: 'education_platform.pdf', description: 'E-learning platform development' },
  { id: '6', name: 'Transport Management System', company: 'RTA', belongsTo: 'Sadeem Energy', status: 'submitted', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-06-15', document: 'transport_system.pdf', description: 'Public transport management system' },
  { id: '7', name: 'Security Solutions', company: 'Dubai Police', belongsTo: 'Grow Plus Technologies', status: 'open', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-07-20', document: 'security_solutions.pdf', description: 'Advanced security monitoring system' },
  { id: '8', name: 'Energy Management Platform', company: 'DEWA', belongsTo: 'Sadeem Energy', status: 'awarded', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-08-10', document: 'energy_platform.pdf', description: 'Smart energy monitoring and management' },
  { id: '9', name: 'Retail POS System', company: 'Majid Al Futtaim', belongsTo: 'Grow Plus Technologies', status: 'submitted', assignedTo: '1', assignedToName: 'Mohamed Ismayil', deadline: '2024-09-05', document: 'retail_pos.pdf', description: 'Point of sale system for retail chain' },
  { id: '10', name: 'Logistics Tracking System', company: 'Aramex', belongsTo: 'Sadeem Energy', status: 'open', assignedTo: '2', assignedToName: 'Mohamed Ajumal', deadline: '2024-10-15', document: 'logistics_tracking.pdf', description: 'Real-time logistics and shipment tracking' },
];

export const registrations: Registration[] = [
  { id: '1', name: 'Al Thahir Group Registration', company: 'Al Thahir Group', belongsTo: 'Grow Plus Technologies', type: 'Trade License', registrationDate: '2023-01-15', expiryDate: '2025-01-14', status: 'active', document: 'trade_license.pdf' },
  { id: '2', name: 'TechCorp LLC Formation', company: 'TechCorp', belongsTo: 'Grow Plus Technologies', type: 'Company Formation', registrationDate: '2022-06-20', expiryDate: '2024-06-19', status: 'active', document: 'formation_docs.pdf' },
  { id: '3', name: 'ZXY VAT Registration', company: 'ZXY Industries', belongsTo: 'Sadeem Energy', type: 'VAT Registration', registrationDate: '2023-03-01', expiryDate: '2024-02-28', status: 'expired' },
  { id: '4', name: 'QWE ISO Certification', company: 'QWE Solutions', belongsTo: 'Sadeem Energy', type: 'ISO 9001', registrationDate: '2023-08-10', expiryDate: '2026-08-09', status: 'active', document: 'iso_cert.pdf' },
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

