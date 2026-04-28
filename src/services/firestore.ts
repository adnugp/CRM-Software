import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';

// Generic helper to get a collection
const getCollection = async <T>(collectionName: string): Promise<T[]> => {
  try {
    const q = query(collection(db, collectionName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    // Fallback if index does not exist yet or other query error
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  }
};

const addDocument = async <T>(collectionName: string, data: Omit<T, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

const updateDocument = async <T>(collectionName: string, id: string, data: Partial<T>): Promise<void> => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, data as any);
};

const deleteDocument = async (collectionName: string, id: string): Promise<void> => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

// Projects
export const getProjects = async (): Promise<Project[]> => getCollection<Project>('projects');
export const addProject = async (project: Omit<Project, 'id'>): Promise<string> => addDocument<Project>('projects', project);
export const updateProject = async (id: string, project: Partial<Project>): Promise<void> => updateDocument<Project>('projects', id, project);
export const deleteProject = async (id: string): Promise<void> => deleteDocument('projects', id);

// Tenders
export const getTenders = async (): Promise<Tender[]> => getCollection<Tender>('tenders');
export const addTender = async (tender: Omit<Tender, 'id'>): Promise<string> => addDocument<Tender>('tenders', tender);
export const updateTender = async (id: string, tender: Partial<Tender>): Promise<void> => updateDocument<Tender>('tenders', id, tender);
export const deleteTender = async (id: string): Promise<void> => deleteDocument('tenders', id);

// Employees
export const getEmployees = async (): Promise<Employee[]> => getCollection<Employee>('employees');
export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<string> => addDocument<Employee>('employees', employee);
export const updateEmployee = async (id: string, employee: Partial<Employee>): Promise<void> => updateDocument<Employee>('employees', id, employee);
export const deleteEmployee = async (id: string): Promise<void> => deleteDocument('employees', id);

// Registrations
export const getRegistrations = async (): Promise<Registration[]> => getCollection<Registration>('registrations');
export const addRegistration = async (registration: Omit<Registration, 'id'>): Promise<string> => addDocument<Registration>('registrations', registration);
export const updateRegistration = async (id: string, registration: Partial<Registration>): Promise<void> => updateDocument<Registration>('registrations', id, registration);
export const deleteRegistration = async (id: string): Promise<void> => deleteDocument('registrations', id);

// Payments
export const getPayments = async (): Promise<Payment[]> => getCollection<Payment>('payments');
export const addPayment = async (payment: Omit<Payment, 'id'>): Promise<string> => addDocument<Payment>('payments', payment);
export const updatePayment = async (id: string, payment: Partial<Payment>): Promise<void> => updateDocument<Payment>('payments', id, payment);
export const deletePayment = async (id: string): Promise<void> => deleteDocument('payments', id);

// Subscriptions
export const getSubscriptions = async (): Promise<Subscription[]> => getCollection<Subscription>('subscriptions');
export const addSubscription = async (subscription: Omit<Subscription, 'id'>): Promise<string> => addDocument<Subscription>('subscriptions', subscription);
export const updateSubscription = async (id: string, subscription: Partial<Subscription>): Promise<void> => updateDocument<Subscription>('subscriptions', id, subscription);
export const deleteSubscription = async (id: string): Promise<void> => deleteDocument('subscriptions', id);

// Partners
export const getPartners = async (): Promise<Partner[]> => getCollection<Partner>('partners');
export const addPartner = async (partner: Omit<Partner, 'id'>): Promise<string> => addDocument<Partner>('partners', partner);
export const updatePartner = async (id: string, partner: Partial<Partner>): Promise<void> => updateDocument<Partner>('partners', id, partner);
export const deletePartner = async (id: string): Promise<void> => deleteDocument('partners', id);

// Files
export const getFiles = async (): Promise<FileRecord[]> => getCollection<FileRecord>('files');
export const addFile = async (file: Omit<FileRecord, 'id'>): Promise<string> => addDocument<FileRecord>('files', file);
export const updateFile = async (id: string, file: Partial<FileRecord>): Promise<void> => updateDocument<FileRecord>('files', id, file);
export const deleteFile = async (id: string): Promise<void> => deleteDocument('files', id);
