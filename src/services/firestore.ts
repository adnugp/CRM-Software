// firestore.ts - Replaced Firebase Firestore with localStorage-based data persistence

import { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';

// Helper to get/set data from localStorage
const getCollection = <T>(key: string): T[] => {
  try {
    const data = localStorage.getItem(`crm_${key}`);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const setCollection = <T>(key: string, data: T[]): void => {
  localStorage.setItem(`crm_${key}`, JSON.stringify(data));
};

const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Projects
export const getProjects = async (): Promise<Project[]> => {
  return getCollection<Project>('projects');
};

export const addProject = async (project: Omit<Project, 'id'>): Promise<string> => {
  const id = generateId();
  const projects = getCollection<Project>('projects');
  projects.unshift({ ...project, id, createdAt: new Date() } as Project);
  setCollection('projects', projects);
  return id;
};

export const updateProject = async (id: string, project: Partial<Project>): Promise<void> => {
  const projects = getCollection<Project>('projects');
  const index = projects.findIndex(p => p.id === id);
  if (index >= 0) {
    projects[index] = { ...projects[index], ...project };
    setCollection('projects', projects);
  }
};

export const deleteProject = async (id: string): Promise<void> => {
  const projects = getCollection<Project>('projects').filter(p => p.id !== id);
  setCollection('projects', projects);
};

// Tenders
export const getTenders = async (): Promise<Tender[]> => {
  return getCollection<Tender>('tenders');
};

export const addTender = async (tender: Omit<Tender, 'id'>): Promise<string> => {
  const id = generateId();
  const tenders = getCollection<Tender>('tenders');
  tenders.unshift({ ...tender, id, createdAt: new Date() } as Tender);
  setCollection('tenders', tenders);
  return id;
};

export const updateTender = async (id: string, tender: Partial<Tender>): Promise<void> => {
  const tenders = getCollection<Tender>('tenders');
  const index = tenders.findIndex(t => t.id === id);
  if (index >= 0) {
    tenders[index] = { ...tenders[index], ...tender };
    setCollection('tenders', tenders);
  }
};

export const deleteTender = async (id: string): Promise<void> => {
  const tenders = getCollection<Tender>('tenders').filter(t => t.id !== id);
  setCollection('tenders', tenders);
};

// Employees
export const getEmployees = async (): Promise<Employee[]> => {
  return getCollection<Employee>('employees');
};

export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<string> => {
  const id = generateId();
  const employees = getCollection<Employee>('employees');
  employees.unshift({ ...employee, id, createdAt: new Date() } as Employee);
  setCollection('employees', employees);
  return id;
};

export const updateEmployee = async (id: string, employee: Partial<Employee>): Promise<void> => {
  const employees = getCollection<Employee>('employees');
  const index = employees.findIndex(e => e.id === id);
  if (index >= 0) {
    employees[index] = { ...employees[index], ...employee };
    setCollection('employees', employees);
  }
};

export const deleteEmployee = async (id: string): Promise<void> => {
  const employees = getCollection<Employee>('employees').filter(e => e.id !== id);
  setCollection('employees', employees);
};

// Registrations
export const getRegistrations = async (): Promise<Registration[]> => {
  return getCollection<Registration>('registrations');
};

export const addRegistration = async (registration: Omit<Registration, 'id'>): Promise<string> => {
  const id = generateId();
  const registrations = getCollection<Registration>('registrations');
  registrations.unshift({ ...registration, id, createdAt: new Date() } as Registration);
  setCollection('registrations', registrations);
  return id;
};

export const updateRegistration = async (id: string, registration: Partial<Registration>): Promise<void> => {
  const registrations = getCollection<Registration>('registrations');
  const index = registrations.findIndex(r => r.id === id);
  if (index >= 0) {
    registrations[index] = { ...registrations[index], ...registration };
    setCollection('registrations', registrations);
  }
};

export const deleteRegistration = async (id: string): Promise<void> => {
  const registrations = getCollection<Registration>('registrations').filter(r => r.id !== id);
  setCollection('registrations', registrations);
};

// Payments
export const getPayments = async (): Promise<Payment[]> => {
  return getCollection<Payment>('payments');
};

export const addPayment = async (payment: Omit<Payment, 'id'>): Promise<string> => {
  const id = generateId();
  const payments = getCollection<Payment>('payments');
  payments.unshift({ ...payment, id, createdAt: new Date() } as Payment);
  setCollection('payments', payments);
  return id;
};

export const updatePayment = async (id: string, payment: Partial<Payment>): Promise<void> => {
  const payments = getCollection<Payment>('payments');
  const index = payments.findIndex(p => p.id === id);
  if (index >= 0) {
    payments[index] = { ...payments[index], ...payment };
    setCollection('payments', payments);
  }
};

export const deletePayment = async (id: string): Promise<void> => {
  const payments = getCollection<Payment>('payments').filter(p => p.id !== id);
  setCollection('payments', payments);
};

// Subscriptions
export const getSubscriptions = async (): Promise<Subscription[]> => {
  return getCollection<Subscription>('subscriptions');
};

export const addSubscription = async (subscription: Omit<Subscription, 'id'>): Promise<string> => {
  const id = generateId();
  const subscriptions = getCollection<Subscription>('subscriptions');
  subscriptions.unshift({ ...subscription, id, createdAt: new Date() } as Subscription);
  setCollection('subscriptions', subscriptions);
  return id;
};

export const updateSubscription = async (id: string, subscription: Partial<Subscription>): Promise<void> => {
  const subscriptions = getCollection<Subscription>('subscriptions');
  const index = subscriptions.findIndex(s => s.id === id);
  if (index >= 0) {
    subscriptions[index] = { ...subscriptions[index], ...subscription };
    setCollection('subscriptions', subscriptions);
  }
};

export const deleteSubscription = async (id: string): Promise<void> => {
  const subscriptions = getCollection<Subscription>('subscriptions').filter(s => s.id !== id);
  setCollection('subscriptions', subscriptions);
};

// Partners
export const getPartners = async (): Promise<Partner[]> => {
  return getCollection<Partner>('partners');
};

export const addPartner = async (partner: Omit<Partner, 'id'>): Promise<string> => {
  const id = generateId();
  const partners = getCollection<Partner>('partners');
  partners.unshift({ ...partner, id, createdAt: new Date() } as Partner);
  setCollection('partners', partners);
  return id;
};

export const updatePartner = async (id: string, partner: Partial<Partner>): Promise<void> => {
  const partners = getCollection<Partner>('partners');
  const index = partners.findIndex(p => p.id === id);
  if (index >= 0) {
    partners[index] = { ...partners[index], ...partner };
    setCollection('partners', partners);
  }
};

export const deletePartner = async (id: string): Promise<void> => {
  const partners = getCollection<Partner>('partners').filter(p => p.id !== id);
  setCollection('partners', partners);
};

// Files
export const getFiles = async (): Promise<FileRecord[]> => {
  return getCollection<FileRecord>('files');
};

export const addFile = async (file: Omit<FileRecord, 'id'>): Promise<string> => {
  const id = generateId();
  const files = getCollection<FileRecord>('files');
  files.unshift({ ...file, id, createdAt: new Date() } as FileRecord);
  setCollection('files', files);
  return id;
};

export const updateFile = async (id: string, file: Partial<FileRecord>): Promise<void> => {
  const files = getCollection<FileRecord>('files');
  const index = files.findIndex(f => f.id === id);
  if (index >= 0) {
    files[index] = { ...files[index], ...file };
    setCollection('files', files);
  }
};

export const deleteFile = async (id: string): Promise<void> => {
  const files = getCollection<FileRecord>('files').filter(f => f.id !== id);
  setCollection('files', files);
};
