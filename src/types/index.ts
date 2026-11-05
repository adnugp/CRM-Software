export type { Division } from '@/lib/workspace';
import type { Division } from '@/lib/workspace';
import type { InviteStatus, WorkspaceStatus } from '@/lib/subscription';
import type { PaymentMethodSummary } from '@/lib/payment';
import type { BillingCycle } from '@/config/plans';

export type UserRole = 'admin' | 'user' | 'client' | 'manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  /** The customer company (workspace) this login belongs to. */
  workspaceId?: string;
  avatar?: string;
  /** The invite this login joined through, if any. */
  inviteId?: string;
}

/** A customer company using the CRM. Its records live under workspaces/{id}/. */
export interface Workspace {
  id: string;
  name: string;
  logoUrl?: string;
  /** Hex colour, e.g. #16a34a. Drives the primary accent colour. */
  brandColor?: string;
  divisions: Division[];
  createdAt?: Date;
  /** Plan state. Missing = 'active' (companies created before plans). */
  status?: WorkspaceStatus;
  /** 'starter' | 'team' | 'business' (src/config/plans.ts) or 'custom'. */
  plan?: string;
  /** Maximum staff; 0 = unlimited. */
  staffLimit?: number;
  /** Staff (non-client) members right now. */
  staffCount?: number;
  trialEndsAt?: Date;
  createdBy?: string;
  contactName?: string;
  contactEmail?: string;
  billingCycle?: BillingCycle;
  /** Card on file: brand, last 4 and expiry only. */
  paymentMethod?: PaymentMethodSummary;
}

/** A one-time link that lets someone join a workspace with a given role. */
export interface Invite {
  /** The random document id; it is the secret in the link. */
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  status: InviteStatus;
  invitedBy: string;
  createdAt?: Date;
  expiresAt: Date;
  acceptedBy?: string;
  acceptedAt?: Date;
}

export interface DocumentFile {
  name: string;
  size: number;
  type: string;
  data: string;
}

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

export interface Project {
  id: string;
  projectId?: string;
  clientId?: string;
  clientName?: string;
  name: string;
  company: string;
  organizationId?: string;
  /** Division of the workspace this record belongs to (optional). */
  divisionId?: string;
  status: 'running' | 'in-progress' | 'completed' | 'handed-over';
  assignedTo: string;
  assignedToName: string;
  deadline: string;
  document?: string;
  documentFile?: DocumentFile;
  documents?: DocumentFile[];
  description?: string;
  budget?: number;
  tasks?: ProjectTask[];
  costs?: ProjectCost[];
  createdAt?: Date;
}

export interface Tender {
  id: string;
  clientId?: string;
  clientName?: string;
  name: string;
  company: string;
  organizationId?: string;
  rfqCode?: string;
  portal?: string;
  /** Division of the workspace this record belongs to (optional). */
  divisionId?: string;
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
  organizationId?: string;
  /** Division of the workspace this record belongs to (optional). */
  divisionId?: string;
  type: string;
  registrationDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending';
  assignedTo?: string;
  assignedToName?: string;
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
  organizationId?: string;
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
  organizationId?: string;
  email: string;
  phone: string;
  partnershipType: string;
  category?: string;
  since: string;
  status: 'active' | 'inactive';
  createdAt?: Date;
}

export interface FileRecord {
  id: string;
  name: string;
  category: string;
  divisionId?: string;
  organizationId?: string;
  uploadedAt: string;
  uploadedBy: string;
  document: DocumentFile;
  documents: DocumentFile[];
  createdAt?: Date;
}
