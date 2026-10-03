import { useAuth } from '@/contexts/AuthContext';
import {requireWorkspace} from '@/services/api';
import { listPage } from '@/services/firestore';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  getProjects, addProject, updateProject, deleteProject,
  getTenders, addTender, updateTender, deleteTender,
  getEmployees, addEmployee, updateEmployee, deleteEmployee,
  getRegistrations, addRegistration, updateRegistration, deleteRegistration,
  getPayments, addPayment, updatePayment, deletePayment,
  getSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  getPartners, addPartner, updatePartner, deletePartner,
  getFiles, addFile, updateFile, deleteFile
} from '@/services/firestore';
import { Project, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';

interface DataContextType {
  errors: Record<string, string>;
  refresh: () => Promise<void>;
  loadMore: (collection: string) => Promise<void>;
  cursors: Record<string, string | undefined>;
  // Data
  projects: Project[];
  tenders: Tender[];
  employees: Employee[];
  registrations: Registration[];
  payments: Payment[];
  subscriptions: Subscription[];
  partners: Partner[];
  files: FileRecord[];

  // Loading states
  loading: {
    projects: boolean;
    tenders: boolean;
    employees: boolean;
    registrations: boolean;
    payments: boolean;
    subscriptions: boolean;
    partners: boolean;
    files: boolean;
  };

  // CRUD functions
  addProject: (project: Omit<Project, 'id'>) => Promise<string>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addTender: (tender: Omit<Tender, 'id'>) => Promise<string>;
  updateTender: (id: string, tender: Partial<Tender>) => Promise<void>;
  deleteTender: (id: string) => Promise<void>;

  addEmployee: (employee: Omit<Employee, 'id'>) => Promise<string>;
  updateEmployee: (id: string, employee: Partial<Employee>) => Promise<void>;
  deleteEmployee: (id: string) => Promise<void>;

  addRegistration: (registration: Omit<Registration, 'id'>) => Promise<string>;
  updateRegistration: (id: string, registration: Partial<Registration>) => Promise<void>;
  deleteRegistration: (id: string) => Promise<void>;

  addPayment: (payment: Omit<Payment, 'id'>) => Promise<string>;
  updatePayment: (id: string, payment: Partial<Payment>) => Promise<void>;
  deletePayment: (id: string) => Promise<void>;

  addSubscription: (subscription: Omit<Subscription, 'id'>) => Promise<string>;
  updateSubscription: (id: string, subscription: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;

  addPartner: (partner: Omit<Partner, 'id'>) => Promise<string>;
  updatePartner: (id: string, partner: Partial<Partner>) => Promise<void>;
  deletePartner: (id: string) => Promise<void>;

  addFile: (file: Omit<FileRecord, 'id'>) => Promise<string>;
  updateFile: (id: string, file: Partial<FileRecord>) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;

  // Stats
  stats: {
    activeProjects: number;
    openTenders: number;
    pendingPayments: number;
    totalProjectsAndTenders: number;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const normalizeOptionalId = (value?: string) => value && value !== 'none' ? value : '';

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeWorkspace, user } = useAuth();
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [cursors,setCursors] = useState<Record<string,string | undefined>>({});
  const [revision,setRevision] = useState(0);
  const refresh = async () => { setRevision(value => value + 1); };
  const [projects, setProjects] = useState<Project[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [files, setFiles] = useState<FileRecord[]>([]);

  const [loading, setLoading] = useState({
    projects: true,
    tenders: true,
    employees: true,
    registrations: true,
    payments: true,
    subscriptions: true,
    partners: true,
    files: true,
  });

  const scope = `${activeWorkspace?.id}/${user?.id}/${user?.role}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;
  const ensureScope=()=>{if(!activeWorkspace||requireWorkspace()!==activeWorkspace.id)throw new Error('Workspace changed. Reopen the record before saving.');};
  const loaders = {
    projects: {get:getProjects,set:setProjects}, tenders: {get:getTenders,set:setTenders},
    employees: {get:getEmployees,set:setEmployees}, registrations: {get:getRegistrations,set:setRegistrations},
    payments: {get:getPayments,set:setPayments}, subscriptions: {get:getSubscriptions,set:setSubscriptions},
    partners: {get:getPartners,set:setPartners}, files: {get:getFiles,set:setFiles},
  };
  useEffect(() => {
    let cancelled = false;
    Object.values(loaders).forEach(item => item.set([]));
    setErrors({}); setCursors({});
    const allowed = user?.role === 'client' ? ['projects'] : user?.role === 'user' ? ['projects','tenders','registrations','files','partners'] : Object.keys(loaders);
    setLoading(Object.fromEntries(Object.keys(loaders).map(name => [name,!!activeWorkspace && allowed.includes(name)])) as typeof loading);
    if (!activeWorkspace) return;
    for (const name of allowed) {
      const item = loaders[name as keyof typeof loaders];
      listPage(name).then(page => {
        if (!cancelled) { (item.set as (data:unknown[])=>void)(page.records); setCursors(prev => ({...prev,[name]:page.cursor})); }
      }).catch(error => {
        if (!cancelled) setErrors(prev => ({...prev,[name]:error instanceof Error ? error.message : 'Unable to load records'}));
      }).finally(() => { if (!cancelled) setLoading(prev => ({...prev,[name]:false})); });
    }
    return () => { cancelled = true; };
  // loaders are wrappers around stable state setters; reload only for identity/workspace changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id,user?.id,user?.role,revision]);
  const loadMore = async (name:string) => {
    const item = loaders[name as keyof typeof loaders];
    if (!item || !cursors[name]) return;
    const capturedScope = scope;
    ensureScope();
    try {
      const page = await listPage(name,cursors[name]);
      if (scopeRef.current !== capturedScope || requireWorkspace() !== activeWorkspace?.id) return;
      (item.set as (fn:(previous:unknown[])=>unknown[])=>void)(previous => [...previous,...page.records]);
      setCursors(prev => ({...prev,[name]:page.cursor}));
    } catch (error) { if (scopeRef.current !== capturedScope) return; setErrors(prev => ({...prev,[name]:error instanceof Error ? error.message : 'Unable to load records'})); }
  };
  const handleAddProject = async (project:Omit<Project,'id'>) => {
    ensureScope();
    const id = await addProject(project); await refresh(); return id;
  };
  const handleUpdateProject = async (id:string, project:Partial<Project>) => {
    ensureScope();
    await updateProject(id,project); await refresh();
  };
  const handleDeleteProject = async (id:string) => {
    ensureScope(); await deleteProject(id); await refresh(); };
  const handleAddTender = async (tender:Omit<Tender,'id'>) => {
    ensureScope();
    const id = await addTender(tender); await refresh(); return id;
  };
  const handleUpdateTender = async (id:string,tender:Partial<Tender>) => {
    ensureScope();
    await updateTender(id,tender); await refresh();
  };

  const handleDeleteTender = async (id: string) => {
    ensureScope();
    await deleteTender(id);
    setTenders(prev => prev.filter(t => t.id !== id));
  };

  // GPT-0071: The employees collection in Firestore is the single source of truth.
  // All employee data (name, email, department, position, phone, joinDate, status)
  // must be managed through the Employees page. Avoid syncing from external auth providers.
  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    ensureScope();
    const id = await addEmployee(employee);
    const newEmployee = { ...employee, id };
    await refresh();
    return id;
  };

  const handleUpdateEmployee = async (id: string, employee: Partial<Employee>) => {
    ensureScope();
    await updateEmployee(id, employee);
    await refresh();
  };

  const handleDeleteEmployee = async (id: string) => {
    ensureScope();
    await deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleAddRegistration = async (registration: Omit<Registration, 'id'>) => {
    ensureScope();
    const id = await addRegistration(registration);
    const newRegistration = { ...registration, id };
    await refresh();
    return id;
  };

  const handleUpdateRegistration = async (id: string, registration: Partial<Registration>) => {
    ensureScope();
    await updateRegistration(id, registration);
    await refresh();
  };

  const handleDeleteRegistration = async (id: string) => {
    ensureScope();
    await deleteRegistration(id);
    setRegistrations(prev => prev.filter(r => r.id !== id));
  };

  const handleAddPayment = async (payment: Omit<Payment, 'id'>) => {
    ensureScope();
    const id = await addPayment(payment);
    const newPayment = { ...payment, id };
    await refresh();
    return id;
  };

  const handleUpdatePayment = async (id: string, payment: Partial<Payment>) => {
    ensureScope();
    await updatePayment(id, payment);
    await refresh();
  };

  const handleDeletePayment = async (id: string) => {
    ensureScope();
    await deletePayment(id);
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleAddSubscription = async (subscription: Omit<Subscription, 'id'>) => {
    ensureScope();
    const id = await addSubscription(subscription);
    const newSubscription = { ...subscription, id };
    await refresh();
    return id;
  };

  const handleUpdateSubscription = async (id: string, subscription: Partial<Subscription>) => {
    ensureScope();
    await updateSubscription(id, subscription);
    await refresh();
  };

  const handleDeleteSubscription = async (id: string) => {
    ensureScope();
    await deleteSubscription(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const handleAddPartner = async (partner: Omit<Partner, 'id'>) => {
    ensureScope();
    const id = await addPartner(partner);
    const newPartner = { ...partner, id };
    await refresh();
    return id;
  };

  const handleUpdatePartner = async (id: string, partner: Partial<Partner>) => {
    ensureScope();
    await updatePartner(id, partner);
    await refresh();
  };

  const handleDeletePartner = async (id: string) => {
    ensureScope();
    await deletePartner(id);
    setPartners(prev => prev.filter(p => p.id !== id));
  };

  const handleAddFile = async (file: Omit<FileRecord, 'id'>) => {
    ensureScope();
    const id = await addFile(file);
    const newFile = { ...file, id };
    await refresh();
    return id;
  };

  const handleUpdateFile = async (id: string, file: Partial<FileRecord>) => {
    ensureScope();
    await updateFile(id, file);
    await refresh();
  };

  const handleDeleteFile = async (id: string) => {
    ensureScope();
    await deleteFile(id);
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const stats = {
    activeProjects: projects.filter(p => ['running', 'in-progress'].includes(p.status)).length,
    openTenders: tenders.filter(t => t.status === 'running').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    totalProjectsAndTenders: projects.length + tenders.length,
  };

  return (
    <DataContext.Provider value={{
      errors, refresh, loadMore, cursors,
      projects,
      tenders,
      employees,
      registrations,
      payments,
      subscriptions,
      partners,
      files,
      loading,
      addProject: handleAddProject,
      updateProject: handleUpdateProject,
      deleteProject: handleDeleteProject,
      addTender: handleAddTender,
      updateTender: handleUpdateTender,
      deleteTender: handleDeleteTender,
      addEmployee: handleAddEmployee,
      updateEmployee: handleUpdateEmployee,
      deleteEmployee: handleDeleteEmployee,
      addRegistration: handleAddRegistration,
      updateRegistration: handleUpdateRegistration,
      deleteRegistration: handleDeleteRegistration,
      addPayment: handleAddPayment,
      updatePayment: handleUpdatePayment,
      deletePayment: handleDeletePayment,
      addSubscription: handleAddSubscription,
      updateSubscription: handleUpdateSubscription,
      deleteSubscription: handleDeleteSubscription,
      addPartner: handleAddPartner,
      updatePartner: handleUpdatePartner,
      deletePartner: handleDeletePartner,
      addFile: handleAddFile,
      updateFile: handleUpdateFile,
      deleteFile: handleDeleteFile,
      stats
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
