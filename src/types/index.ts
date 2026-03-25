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

export type ParentCompany = 'Grow Plus Technologies' | 'Sadeem Energy';

export interface ProjectTask {
  id: string;
  projectId: string;
  name: string;
  description: string;
  assignedTo: string;
  assignedToName: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
}

export interface ProjectCost {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export interface Project {
  id: string;
  name: string;
  company: string;
  belongsTo: ParentCompany;
  status: 'running' | 'in-progress' | 'completed' | 'handed-over';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  description?: string;
  budget?: number;
  tasks?: ProjectTask[];
  costs?: ProjectCost[];
  createdAt?: Date;
}

export interface Tender {
  id: string;
  name: string;
  company: string;
  rfqCode?: string;
  portal?: string;
  belongsTo: ParentCompany;
  status: 'running' | 'submitted' | 'cancelled' | 'to-be-evaluated' | 'winner' | 'awarded';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  description?: string;
  createdAt?: Date;
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
  createdAt?: Date;
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
  createdAt?: Date;
}

export interface Payment {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  company: string;
  createdAt?: Date;
}

export interface Subscription {
  id: string;
  name: string;
  provider: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: 'active' | 'cancelled' | 'expired';
  createdAt?: Date;
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
  createdAt?: Date;
}

export interface FileRecord {
  id: string;
  name: string;
  category: string;
  company: string;
  uploadedAt: string;
  uploadedBy: string;
  document: DocumentFile;
  createdAt?: Date;
}
