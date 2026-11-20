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
  Timestamp,
  arrayUnion,
  deleteField,
  runTransaction,
  setDoc,
  writeBatch,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { Project, ProjectCost, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord, Workspace, WorkspaceBilling, Company, Contact, Deal, Activity } from '@/types';
import { mergeCosts } from '@/lib/project-costs';
import type { ListChange } from '@/lib/project-lists';

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

export type Unsubscribe = () => void;

// Live version of getCollection: calls onData with the whole list now and on
// every change (including this browser's own writes, at once). Ordered newest
// first; records without createdAt are kept (sorted last) instead of dropped.
export const listenCollection = <T>(
  wsId: string,
  collectionName: string,
  onData: (items: T[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe =>
  onSnapshot(
    wsCollection(wsId, collectionName),
    snapshot => {
      const items = snapshot.docs.map(d => fromDoc<T & { createdAt?: Date }>(d));
      const time = (x: { createdAt?: Date }) => (x.createdAt instanceof Date ? x.createdAt.getTime() : 0);
      items.sort((x, y) => time(y) - time(x));
      onData(items as T[]);
    },
    onError,
  );

// Clients may only read projects linked to them (firestore.rules), so they
// listen to two queries (by uid, by organization) and the results are merged.
export const listenProjectsForClient = (
  wsId: string,
  uid: string,
  organizationId: string | undefined,
  onData: (items: Project[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe => {
  const queries = [query(wsCollection(wsId, 'projects'), where('clientId', '==', uid))];
  if (organizationId) queries.push(query(wsCollection(wsId, 'projects'), where('organizationId', '==', organizationId)));
  const results: Map<string, Project>[] = queries.map(() => new Map());
  const emit = () => {
    const merged = new Map<string, Project>();
    results.forEach(r => r.forEach((p, id) => merged.set(id, p)));
    onData([...merged.values()]);
  };
  const stops = queries.map((q, i) =>
    onSnapshot(q, snapshot => {
      results[i] = new Map(snapshot.docs.map(d => [d.id, fromDoc<Project>(d)]));
      emit();
    }, onError),
  );
  return () => stops.forEach(stop => stop());
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

// What a project costs us is kept in its own record, projects/{id}/private/costs,
// which only admins and managers can read (firestore.rules). The project record
// itself is sent to clients, so costs are never saved on it.
const costsDoc = (wsId: string, projectId: string) => doc(db, 'workspaces', wsId, 'projects', projectId, 'private', 'costs');

// A project's costs record goes with it.
export const deleteProject = async (wsId: string, id: string): Promise<void> => {
  const batch = writeBatch(db);
  batch.delete(wsDoc(wsId, 'projects', id));
  batch.delete(costsDoc(wsId, id));
  await batch.commit();
};

/** Live costs of one project (admins and managers only, see firestore.rules). */
export const listenProjectCosts = (
  wsId: string,
  projectId: string,
  onData: (costs: ProjectCost[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe =>
  onSnapshot(costsDoc(wsId, projectId), snapshot => {
    const costs = snapshot.data()?.costs;
    onData(Array.isArray(costs) ? costs : []);
  }, onError);

// The first document is also kept in older single-document fields that some
// screens still read: documentFile + document (its name) on projects and
// tenders, document (the file itself) on files.
const firstDocumentFields = (collectionName: string, docs: unknown[]): Record<string, unknown> => {
  const first = docs[0] as { name?: string } | undefined;
  if (collectionName === 'files') return { document: first ?? deleteField() };
  return { documentFile: first ?? deleteField(), document: first?.name ?? deleteField() };
};

/**
 * Changes one list field on a record (project tasks, documents or team
 * members; tender and file documents) by applying `change` to the newest
 * copy in a transaction, so two people editing at once both keep their work.
 */
export const changeRecordList = async <T>(
  wsId: string,
  collectionName: 'projects' | 'tenders' | 'files',
  id: string,
  field: 'tasks' | 'documents' | 'teamMembers',
  change: ListChange<T>,
): Promise<void> => {
  const ref = wsDoc(wsId, collectionName, id);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error(`${collectionName}/${id} no longer exists`);
    const current = snapshot.data()[field];
    const next = change(Array.isArray(current) ? (current as T[]) : []);
    const update: Record<string, unknown> = { [field]: removeUndefined(next) };
    if (field === 'documents') Object.assign(update, firstDocumentFields(collectionName, next as unknown[]));
    tx.update(ref, update);
  });
};

/** Same as changeRecordList, for a project's staff-only costs record. */
export const changeProjectCosts = async (wsId: string, projectId: string, change: ListChange<ProjectCost>): Promise<void> => {
  const ref = costsDoc(wsId, projectId);
  await runTransaction(db, async (tx) => {
    const current = (await tx.get(ref)).data()?.costs;
    tx.set(ref, { costs: removeUndefined(change(Array.isArray(current) ? current : [])) });
  });
};

/** Writes an employee record with a chosen id (a login's uid). */
export const setEmployee = (wsId: string, id: string, data: Record<string, unknown>) =>
  setDoc(wsDoc(wsId, 'employees', id), { ...data, createdAt: serverTimestamp() });

/**
 * Older versions saved costs on the project record. This moves them into the
 * costs record and takes them off the project, as one step, so nothing is lost
 * or counted twice if two people have the app open. Does nothing for a project
 * with no old-style costs.
 */
export const moveLegacyProjectCosts = async (wsId: string, projectId: string): Promise<void> => {
  const projectRef = wsDoc(wsId, 'projects', projectId);
  await runTransaction(db, async (tx) => {
    const legacy = (await tx.get(projectRef)).data()?.costs;
    if (legacy === undefined) return;
    if (Array.isArray(legacy) && legacy.length > 0) {
      const current = (await tx.get(costsDoc(wsId, projectId))).data()?.costs;
      tx.set(costsDoc(wsId, projectId), { costs: mergeCosts(Array.isArray(current) ? current : [], legacy) });
    }
    tx.update(projectRef, { costs: deleteField() });
  });
};

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

const toDate = (value: unknown): Date | undefined => (value instanceof Timestamp ? value.toDate() : undefined);

/** Firestore data → Workspace (timestamps become Dates). */
export const toWorkspace = (id: string, data: DocumentData): Workspace => ({
  id,
  ...data,
  divisions: Array.isArray(data.divisions) ? data.divisions : [],
  createdAt: toDate(data.createdAt),
  trialEndsAt: toDate(data.trialEndsAt),
} as Workspace);

// Workspace (company) settings: name, logo, brand colour, divisions, plan.
export const getWorkspace = async (wsId: string): Promise<Workspace | null> => {
  const snapshot = await getDoc(doc(db, 'workspaces', wsId));
  return snapshot.exists() ? toWorkspace(snapshot.id, snapshot.data()) : null;
};

// Billing contact and period (company admins and the super admin only).
export const getWorkspaceBilling = async (wsId: string): Promise<WorkspaceBilling | null> => {
  const snapshot = await getDoc(doc(db, 'workspaces', wsId, 'private', 'billing'));
  return snapshot.exists() ? (snapshot.data() as WorkspaceBilling) : null;
};

export const updateWorkspace = async (wsId: string, data: Partial<Omit<Workspace, 'id' | 'createdAt'>>): Promise<void> => {
  await updateDoc(doc(db, 'workspaces', wsId), removeUndefined(data) as DocumentData);
};

// Sales: companies, contacts and deals (staff only, see firestore.rules)
export const getCompanies = async (wsId: string): Promise<Company[]> => getCollection<Company>(wsId, 'companies');
export const addCompany = async (wsId: string, data: Omit<Company, 'id'>): Promise<string> => addDocument<Company>(wsId, 'companies', data);
export const updateCompany = async (wsId: string, id: string, data: Partial<Company>): Promise<void> => updateDocument<Company>(wsId, 'companies', id, data);
export const deleteCompany = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'companies', id);

export const getContacts = async (wsId: string): Promise<Contact[]> => getCollection<Contact>(wsId, 'contacts');
export const addContact = async (wsId: string, data: Omit<Contact, 'id'>): Promise<string> => addDocument<Contact>(wsId, 'contacts', data);
export const updateContact = async (wsId: string, id: string, data: Partial<Contact>): Promise<void> => updateDocument<Contact>(wsId, 'contacts', id, data);
export const deleteContact = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'contacts', id);

export const getDeals = async (wsId: string): Promise<Deal[]> => getCollection<Deal>(wsId, 'deals');
export const addDeal = async (wsId: string, data: Omit<Deal, 'id'>): Promise<string> => addDocument<Deal>(wsId, 'deals', data);
export const updateDeal = async (wsId: string, id: string, data: Partial<Deal>): Promise<void> => updateDocument<Deal>(wsId, 'deals', id, data);
export const deleteDeal = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'deals', id);

/**
 * Updates a deal and appends one history entry in a single write. arrayUnion
 * is added after removeUndefined, which would otherwise walk into the
 * FieldValue object and break it.
 */
export const updateDealWithActivity = async (wsId: string, id: string, data: Partial<Deal>, activity: Activity): Promise<void> => {
  await updateDoc(wsDoc(wsId, 'deals', id), {
    ...(removeUndefined(data) as DocumentData),
    activities: arrayUnion(removeUndefined(activity)),
  });
};
