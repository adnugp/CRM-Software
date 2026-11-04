import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord, Workspace } from '@/types';

// Every company's records live under workspaces/{wsId}/{collection}. Callers
// pass the signed-in user's workspace id; firestore.rules reject any other.
const wsCollection = (wsId: string, name: string) => collection(db, 'workspaces', wsId, name);
const wsDoc = (wsId: string, name: string, id: string) => doc(db, 'workspaces', wsId, name, id);

// Firestore returns server timestamps (e.g. createdAt) as Timestamp objects.
// The app's types and date maths expect Date, and `new Date(timestamp)` is
// Invalid Date, so convert top-level Timestamps when reading a document.
const fromDoc = <T>(snapshot: QueryDocumentSnapshot<DocumentData>): T => {
  const data = snapshot.data();
  for (const key of Object.keys(data)) {
    if (data[key] instanceof Timestamp) {
      data[key] = (data[key] as Timestamp).toDate();
    }
  }
  return { id: snapshot.id, ...data } as T;
};

// Generic helper to get a collection
const getCollection = async <T>(wsId: string, collectionName: string): Promise<T[]> => {
  try {
    const q = query(wsCollection(wsId, collectionName), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => fromDoc<T>(d));
  } catch (error) {
    // Fallback if index does not exist yet or other query error
    const snapshot = await getDocs(wsCollection(wsId, collectionName));
    return snapshot.docs.map(d => fromDoc<T>(d));
  }
};

// Firestore rejects undefined values anywhere in a document payload.
const removeUndefined = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => removeUndefined(item));
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.entries(value).reduce((result, [key, entry]) => {
      if (entry !== undefined) {
        result[key] = removeUndefined(entry);
      }
      return result;
    }, {} as Record<string, unknown>);
  }

  return value;
};

const addDocument = async <T>(wsId: string, collectionName: string, data: Omit<T, 'id'>): Promise<string> => {
  const cleanData = removeUndefined(data);
  const docRef = await addDoc(wsCollection(wsId, collectionName), {
    ...(cleanData as DocumentData),
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

const updateDocument = async <T>(wsId: string, collectionName: string, id: string, data: Partial<T>): Promise<void> => {
  const cleanData = removeUndefined(data);
  const docRef = wsDoc(wsId, collectionName, id);
  await updateDoc(docRef, cleanData as DocumentData);
};

const deleteDocument = async (wsId: string, collectionName: string, id: string): Promise<void> => {
  const docRef = wsDoc(wsId, collectionName, id);
  await deleteDoc(docRef);
};

// Projects
export const getProjects = async (wsId: string): Promise<Project[]> => getCollection<Project>(wsId, 'projects');

// Clients may only read projects linked to them (see firestore.rules), and
// Firestore rejects any query that could return documents the caller can't
// read. So clients query by their own uid / organization instead of the whole
// collection, and the two result sets are merged.
export const getProjectsForClient = async (wsId: string, uid: string, organizationId?: string): Promise<Project[]> => {
  const queries = [query(wsCollection(wsId, 'projects'), where('clientId', '==', uid))];
  if (organizationId) {
    queries.push(query(wsCollection(wsId, 'projects'), where('organizationId', '==', organizationId)));
  }
  const snapshots = await Promise.all(queries.map(q => getDocs(q)));
  const byId = new Map<string, Project>();
  snapshots.forEach(snapshot =>
    snapshot.docs.forEach(d => byId.set(d.id, fromDoc<Project>(d)))
  );
  return [...byId.values()];
};

export const addProject = async (wsId: string, project: Omit<Project, 'id'>): Promise<string> => addDocument<Project>(wsId, 'projects', project);
export const updateProject = async (wsId: string, id: string, project: Partial<Project>): Promise<void> => updateDocument<Project>(wsId, 'projects', id, project);
export const deleteProject = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'projects', id);

// Tenders
export const getTenders = async (wsId: string): Promise<Tender[]> => getCollection<Tender>(wsId, 'tenders');
export const addTender = async (wsId: string, tender: Omit<Tender, 'id'>): Promise<string> => addDocument<Tender>(wsId, 'tenders', tender);
export const updateTender = async (wsId: string, id: string, tender: Partial<Tender>): Promise<void> => updateDocument<Tender>(wsId, 'tenders', id, tender);
export const deleteTender = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'tenders', id);

// Employees
export const getEmployees = async (wsId: string): Promise<Employee[]> => getCollection<Employee>(wsId, 'employees');
export const addEmployee = async (wsId: string, employee: Omit<Employee, 'id'>): Promise<string> => addDocument<Employee>(wsId, 'employees', employee);
export const updateEmployee = async (wsId: string, id: string, employee: Partial<Employee>): Promise<void> => updateDocument<Employee>(wsId, 'employees', id, employee);
export const deleteEmployee = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'employees', id);

// Registrations
export const getRegistrations = async (wsId: string): Promise<Registration[]> => getCollection<Registration>(wsId, 'registrations');
export const addRegistration = async (wsId: string, registration: Omit<Registration, 'id'>): Promise<string> => addDocument<Registration>(wsId, 'registrations', registration);
export const updateRegistration = async (wsId: string, id: string, registration: Partial<Registration>): Promise<void> => updateDocument<Registration>(wsId, 'registrations', id, registration);
export const deleteRegistration = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'registrations', id);

// Payments
export const getPayments = async (wsId: string): Promise<Payment[]> => getCollection<Payment>(wsId, 'payments');
export const addPayment = async (wsId: string, payment: Omit<Payment, 'id'>): Promise<string> => addDocument<Payment>(wsId, 'payments', payment);
export const updatePayment = async (wsId: string, id: string, payment: Partial<Payment>): Promise<void> => updateDocument<Payment>(wsId, 'payments', id, payment);
export const deletePayment = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'payments', id);

// Subscriptions
export const getSubscriptions = async (wsId: string): Promise<Subscription[]> => getCollection<Subscription>(wsId, 'subscriptions');
export const addSubscription = async (wsId: string, subscription: Omit<Subscription, 'id'>): Promise<string> => addDocument<Subscription>(wsId, 'subscriptions', subscription);
export const updateSubscription = async (wsId: string, id: string, subscription: Partial<Subscription>): Promise<void> => updateDocument<Subscription>(wsId, 'subscriptions', id, subscription);
export const deleteSubscription = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'subscriptions', id);

// Partners
export const getPartners = async (wsId: string): Promise<Partner[]> => getCollection<Partner>(wsId, 'partners');
export const addPartner = async (wsId: string, partner: Omit<Partner, 'id'>): Promise<string> => addDocument<Partner>(wsId, 'partners', partner);
export const updatePartner = async (wsId: string, id: string, partner: Partial<Partner>): Promise<void> => updateDocument<Partner>(wsId, 'partners', id, partner);
export const deletePartner = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'partners', id);

// Files
export const getFiles = async (wsId: string): Promise<FileRecord[]> => getCollection<FileRecord>(wsId, 'files');
export const addFile = async (wsId: string, file: Omit<FileRecord, 'id'>): Promise<string> => addDocument<FileRecord>(wsId, 'files', file);
export const updateFile = async (wsId: string, id: string, file: Partial<FileRecord>): Promise<void> => updateDocument<FileRecord>(wsId, 'files', id, file);
export const deleteFile = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'files', id);

// Workspace (company) settings: name, logo, brand colour, divisions.
export const getWorkspace = async (wsId: string): Promise<Workspace | null> => {
  const snapshot = await getDoc(doc(db, 'workspaces', wsId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    divisions: Array.isArray(data.divisions) ? data.divisions : [],
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
  } as Workspace;
};

export const updateWorkspace = async (wsId: string, data: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'workspaces', wsId), removeUndefined(data) as DocumentData);
};
