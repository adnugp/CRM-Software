import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';

// Projects
export const getProjects = async (): Promise<Project[]> => {
  const q = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
};

export const addProject = async (project: Omit<Project, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'projects'), {
    ...project,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateProject = async (id: string, project: Partial<Project>): Promise<void> => {
  const docRef = doc(db, 'projects', id);
  await updateDoc(docRef, project);
};

export const deleteProject = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'projects', id));
};

// Tenders
export const getTenders = async (): Promise<Tender[]> => {
  const q = query(collection(db, 'tenders'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tender));
};

export const addTender = async (tender: Omit<Tender, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'tenders'), {
    ...tender,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateTender = async (id: string, tender: Partial<Tender>): Promise<void> => {
  const docRef = doc(db, 'tenders', id);
  await updateDoc(docRef, tender);
};

export const deleteTender = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'tenders', id));
};

// Employees
export const getEmployees = async (): Promise<Employee[]> => {
  const q = query(collection(db, 'employees'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
};

export const addEmployee = async (employee: Omit<Employee, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'employees'), {
    ...employee,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateEmployee = async (id: string, employee: Partial<Employee>): Promise<void> => {
  const docRef = doc(db, 'employees', id);
  await updateDoc(docRef, employee);
};

export const deleteEmployee = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'employees', id));
};

// Registrations
export const getRegistrations = async (): Promise<Registration[]> => {
  const q = query(collection(db, 'registrations'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
};

export const addRegistration = async (registration: Omit<Registration, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'registrations'), {
    ...registration,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateRegistration = async (id: string, registration: Partial<Registration>): Promise<void> => {
  const docRef = doc(db, 'registrations', id);
  await updateDoc(docRef, registration);
};

export const deleteRegistration = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'registrations', id));
};

// Payments
export const getPayments = async (): Promise<Payment[]> => {
  const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
};

export const addPayment = async (payment: Omit<Payment, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'payments'), {
    ...payment,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updatePayment = async (id: string, payment: Partial<Payment>): Promise<void> => {
  const docRef = doc(db, 'payments', id);
  await updateDoc(docRef, payment);
};

export const deletePayment = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'payments', id));
};

// Subscriptions
export const getSubscriptions = async (): Promise<Subscription[]> => {
  const q = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subscription));
};

export const addSubscription = async (subscription: Omit<Subscription, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'subscriptions'), {
    ...subscription,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateSubscription = async (id: string, subscription: Partial<Subscription>): Promise<void> => {
  const docRef = doc(db, 'subscriptions', id);
  await updateDoc(docRef, subscription);
};

export const deleteSubscription = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'subscriptions', id));
};

// Partners
export const getPartners = async (): Promise<Partner[]> => {
  const q = query(collection(db, 'partners'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Partner));
};

export const addPartner = async (partner: Omit<Partner, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'partners'), {
    ...partner,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updatePartner = async (id: string, partner: Partial<Partner>): Promise<void> => {
  const docRef = doc(db, 'partners', id);
  await updateDoc(docRef, partner);
};

export const deletePartner = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'partners', id));
};

// Files
export const getFiles = async (): Promise<FileRecord[]> => {
  const q = query(collection(db, 'files'), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FileRecord));
};

export const addFile = async (file: Omit<FileRecord, 'id'>): Promise<string> => {
  const docRef = await addDoc(collection(db, 'files'), {
    ...file,
    createdAt: new Date(),
  });
  return docRef.id;
};

export const updateFile = async (id: string, file: Partial<FileRecord>): Promise<void> => {
  const docRef = doc(db, 'files', id);
  await updateDoc(docRef, file);
};

export const deleteFile = async (id: string): Promise<void> => {
  await deleteDoc(doc(db, 'files', id));
};
