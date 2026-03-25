import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
import { projects as mockProjects, tenders as mockTenders, employees as mockEmployees, registrations as mockRegistrations, payments as mockPayments, subscriptions as mockSubscriptions, partners as mockPartners } from '@/data/mockData';

interface DataContextType {
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

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
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

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsData, tendersData, employeesData, registrationsData, paymentsData, subscriptionsData, partnersData, filesData] = await Promise.all([
          getProjects().catch(() => mockProjects),
          getTenders().catch(() => mockTenders),
          getEmployees().catch(() => mockEmployees),
          getRegistrations().catch(() => mockRegistrations),
          getPayments().catch(() => mockPayments),
          getSubscriptions().catch(() => mockSubscriptions),
          getPartners().catch(() => mockPartners),
          getFiles().catch(() => []),
        ]);

        // Merge local data with mock data as a baseline, avoiding duplicates by ID
        const mergedProjects = [...projectsData];
        mockProjects.forEach(mockP => {
          if (!mergedProjects.find(p => p.id === mockP.id)) {
            mergedProjects.push(mockP);
          }
        });
        setProjects(mergedProjects);
        setTenders(tendersData.length > 0 ? tendersData : mockTenders);
        setEmployees(employeesData.length > 0 ? employeesData : mockEmployees);
        setRegistrations(registrationsData.length > 0 ? registrationsData : mockRegistrations);
        setPayments(paymentsData.length > 0 ? paymentsData : mockPayments);
        setSubscriptions(subscriptionsData.length > 0 ? subscriptionsData : mockSubscriptions);
        setPartners(partnersData.length > 0 ? partnersData : mockPartners);
        setFiles(filesData);

        setLoading({
          projects: false,
          tenders: false,
          employees: false,
          registrations: false,
          payments: false,
          subscriptions: false,
          partners: false,
          files: false,
        });
      } catch (error) {
        console.error('Error fetching data, using mock data:', error);
        // Use mock data as fallback
        setProjects(mockProjects);
        setTenders(mockTenders);
        setEmployees(mockEmployees);
        setRegistrations(mockRegistrations);
        setPayments(mockPayments);
        setSubscriptions(mockSubscriptions);
        setPartners(mockPartners);
        setFiles([]);

        setLoading({
          projects: false,
          tenders: false,
          employees: false,
          registrations: false,
          payments: false,
          subscriptions: false,
          partners: false,
          files: false,
        });
      }
    };

    fetchData();
  }, []);

  // CRUD functions
  const handleAddProject = async (project: Omit<Project, 'id'>) => {
    const id = await addProject(project);
    const newProject = { ...project, id };
    setProjects(prev => [newProject, ...prev]);
    return id;
  };

  const handleUpdateProject = async (id: string, project: Partial<Project>) => {
    await updateProject(id, project);
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...project } : p));
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const handleAddTender = async (tender: Omit<Tender, 'id'>) => {
    const id = await addTender(tender);
    const newTender = { ...tender, id };
    setTenders(prev => [newTender, ...prev]);
    return id;
  };

  const handleUpdateTender = async (id: string, tender: Partial<Tender>) => {
    await updateTender(id, tender);
    setTenders(prev => prev.map(t => t.id === id ? { ...t, ...tender } : t));
  };

  const handleDeleteTender = async (id: string) => {
    await deleteTender(id);
    setTenders(prev => prev.filter(t => t.id !== id));
  };

  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    const id = await addEmployee(employee);
    const newEmployee = { ...employee, id };
    setEmployees(prev => [newEmployee, ...prev]);
    return id;
  };

  const handleUpdateEmployee = async (id: string, employee: Partial<Employee>) => {
    await updateEmployee(id, employee);
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...employee } : e));
  };

  const handleDeleteEmployee = async (id: string) => {
    await deleteEmployee(id);
    setEmployees(prev => prev.filter(e => e.id !== id));
  };

  const handleAddRegistration = async (registration: Omit<Registration, 'id'>) => {
    const id = await addRegistration(registration);
    const newRegistration = { ...registration, id };
    setRegistrations(prev => [newRegistration, ...prev]);
    return id;
  };

  const handleUpdateRegistration = async (id: string, registration: Partial<Registration>) => {
    await updateRegistration(id, registration);
    setRegistrations(prev => prev.map(r => r.id === id ? { ...r, ...registration } : r));
  };

  const handleDeleteRegistration = async (id: string) => {
    await deleteRegistration(id);
    setRegistrations(prev => prev.filter(r => r.id !== id));
  };

  const handleAddPayment = async (payment: Omit<Payment, 'id'>) => {
    const id = await addPayment(payment);
    const newPayment = { ...payment, id };
    setPayments(prev => [newPayment, ...prev]);
    return id;
  };

  const handleUpdatePayment = async (id: string, payment: Partial<Payment>) => {
    await updatePayment(id, payment);
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...payment } : p));
  };

  const handleDeletePayment = async (id: string) => {
    await deletePayment(id);
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleAddSubscription = async (subscription: Omit<Subscription, 'id'>) => {
    const id = await addSubscription(subscription);
    const newSubscription = { ...subscription, id };
    setSubscriptions(prev => [newSubscription, ...prev]);
    return id;
  };

  const handleUpdateSubscription = async (id: string, subscription: Partial<Subscription>) => {
    await updateSubscription(id, subscription);
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, ...subscription } : s));
  };

  const handleDeleteSubscription = async (id: string) => {
    await deleteSubscription(id);
    setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const handleAddPartner = async (partner: Omit<Partner, 'id'>) => {
    const id = await addPartner(partner);
    const newPartner = { ...partner, id };
    setPartners(prev => [newPartner, ...prev]);
    return id;
  };

  const handleUpdatePartner = async (id: string, partner: Partial<Partner>) => {
    await updatePartner(id, partner);
    setPartners(prev => prev.map(p => p.id === id ? { ...p, ...partner } : p));
  };

  const handleDeletePartner = async (id: string) => {
    await deletePartner(id);
    setPartners(prev => prev.filter(p => p.id !== id));
  };

  const handleAddFile = async (file: Omit<FileRecord, 'id'>) => {
    const id = await addFile(file);
    const newFile = { ...file, id };
    setFiles(prev => [newFile, ...prev]);
    return id;
  };

  const handleUpdateFile = async (id: string, file: Partial<FileRecord>) => {
    await updateFile(id, file);
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...file } : f));
  };

  const handleDeleteFile = async (id: string) => {
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
