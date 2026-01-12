export type UserRole = 'admin' | 'user' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  avatar?: string;
}

export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

export type ParentCompany = 'ABC Tech' | 'XCD Tech';

export interface Project {
  id: string;
  name: string;
  company: string;
  belongsTo: ParentCompany;
  status: 'pending' | 'in-progress' | 'completed' | 'on-hold';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  description?: string;
}

export interface Tender {
  id: string;
  name: string;
  company: string;
  belongsTo: ParentCompany;
  status: 'open' | 'submitted' | 'awarded' | 'closed';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  description?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  phone: string;
  joinDate: string;
  status: 'active' | 'inactive';
}

export interface Registration {
  id: string;
  name: string;
  company: string;
  belongsTo: ParentCompany;
  type: string;
  registrationDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  document?: string;
  documentFile?: DocumentFile;
}

export interface Payment {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  company: string;
}

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'cancelled' | 'expired';
}

export interface Partner {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  partnershipType: string;
  since: string;
  status: 'active' | 'inactive';
}