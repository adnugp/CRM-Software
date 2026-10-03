export type UserRole = 'admin' | 'user' | 'client' | 'manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  avatar?: string;
  workspaceId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  divisions: (string | {id:string;name:string})[];
  role: UserRole;
  status?: string;
}

export interface RecordMetadata {
  workspaceId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
  sharedWith?: string[];
  teamMembers?: string[];
  assignedUserIds?: string[];
  archivedAt?: string;
}

export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  data: string;
  storagePath?: string;
  fileId?: string;
  versionId?: string;
  quarantine?: 'pending' | 'clean' | 'blocked' | 'rejected';
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
  startDate?: string;
  dependencies?: string[];
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  fileAttachment?: DocumentFile;
}

export interface ProjectCost {
  id: string;
  projectId: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type?: 'debit' | 'credit';
}

export interface Project extends RecordMetadata {
  id: string;
  projectId?: string;
  sourceTenderId?: string;
  clientId?: string;
  clientName?: string;
  name: string;
  company: string;
  organizationId?: string;
  belongsTo: ParentCompany;
  status: 'running' | 'in-progress' | 'completed' | 'handed-over';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  documents?: DocumentFile[];
  description?: string;
  budget?: number;
  currency?: string;
  tasks?: ProjectTask[];
  costs?: ProjectCost[];
  createdAt?: Date;
}

export interface Tender extends RecordMetadata {
  id: string;
  clientId?: string;
  clientName?: string;
  name: string;
  company: string;
  organizationId?: string;
  rfqCode?: string;
  bidAmount?: number;
  currency?: string;
  evaluationNotes?: string;
  checklist?: (string | { id: string; text: string; completed: boolean })[];
  clarifications?: {id:string;question:string;answer:string;createdAt:string;createdBy:string}[];
  approvalSteps?: {id:string;label:string;status:'pending'|'approved'|'rejected';actorId?:string;at?:string}[];
  portal?: string;
  belongsTo: ParentCompany;
  status: 'running' | 'submitted' | 'cancelled' | 'to-be-evaluated' | 'winner' | 'awarded';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  documents?: DocumentFile[];
  description?: string;
  createdAt?: Date;
}

export interface Employee extends RecordMetadata {
  userId?: string;
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

export interface Registration extends RecordMetadata {
  id: string;
  name: string;
  company: string;
  organizationId?: string;
  belongsTo: ParentCompany;
  type: string;
  documents?: DocumentFile[];
  registrationNumber?: string;
  previousRegistrationId?: string;
  registrationDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  assignedTo?: string;
  assignedToName?: string;
  document?: string;
  documentFile?: DocumentFile;
  createdAt?: Date;
}

export interface Payment extends RecordMetadata {
  id: string;
  description: string;
  amount: number;
  currency?: string;
  amountMinor?: number;
  paidAmountMinor?: number;
  paidDate?: string;
  date?: string;
  projectId?: string;
  invoiceId?: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  company: string;
  organizationId?: string;
  createdAt?: Date;
}

export interface Subscription {
  currency?: string;
  amountMinor?: number;
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
  organizationId?: string;
  email: string;
  phone: string;
  partnershipType: string;
  category?: string;
  since: string;
  status: 'active' | 'inactive';
  createdAt?: Date;
}

export interface FileRecord extends RecordMetadata {
  id: string;
  name: string;
  category: string;
  company: string;
  organizationId?: string;
  uploadedAt: string;
  uploadedBy: string;
  document: DocumentFile;
  documents: DocumentFile[];
  createdAt?: Date;
}
