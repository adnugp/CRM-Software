import React, { createContext, useCallback, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  listenCollection, listenProjectsForClient, listenProjectCosts,
  changeRecordList as changeListOnRecord, changeProjectCosts as changeCostsOnProject, type Unsubscribe,
  addProject, updateProject, deleteProject, moveLegacyProjectCosts,
  addTender, updateTender, deleteTender,
  addEmployee, updateEmployee, deleteEmployee,
  addRegistration, updateRegistration, deleteRegistration,
  addPayment, updatePayment, deletePayment,
  addSubscription, updateSubscription, deleteSubscription,
  addPartner, updatePartner, deletePartner,
  addFile, updateFile, deleteFile, setEmployee
} from '@/services/firestore';
import type { ListChange } from '@/lib/project-lists';
import { employeeSync, newEmployeeRecord } from '@/lib/team';
import { Project, ProjectCost, Tender, Employee, Registration, Payment, Subscription, Partner, FileRecord } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { nextProjectNumber } from '@/lib/workspace';
import { canSeeProjectCosts } from '@/lib/project-visibility';
import { useWriteGuard } from '@/hooks/use-write-guard';

type CollectionKey = 'projects' | 'tenders' | 'employees' | 'registrations' | 'payments' | 'subscriptions' | 'partners' | 'files';

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
  /** Collections that failed to load (connection or permission problem). */
  loadErrors: Partial<Record<CollectionKey, true>>;
  /** Changes one list field (tasks, documents, team members) on the newest copy of a record. */
  changeRecordList: <T>(collectionName: 'projects' | 'tenders' | 'files', id: string, field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>) => Promise<void>;
  /** Live costs of one project: admins and managers only (firestore.rules). */
  watchProjectCosts: (projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void) => Unsubscribe;
  /** Changes a project's costs on the newest copy. */
  changeProjectCosts: (projectId: string, change: ListChange<ProjectCost>) => Promise<void>;

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
const sameText = (a?: string, b?: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, allUsers, loading: authLoading } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const userOrganizationId = user?.organizationId;
  const { workspaceId, divisionById, access } = useWorkspace();
  const canWrite = access.canWrite;

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

  const allLoaded = (value: boolean) => ({
    projects: value,
    tenders: value,
    employees: value,
    registrations: value,
    payments: value,
    subscriptions: value,
    partners: value,
    files: value,
  });

  const [loadErrors, setLoadErrors] = useState<Partial<Record<CollectionKey, true>>>({});
  const movedLegacyCosts = useRef(false);

  // Live lists while signed in. Firestore rules require a signed-in user, and
  // data from a previous session must not linger after logout. Every change
  // (other people's, and this browser's own writes) arrives through these.
  useEffect(() => {
    if (authLoading) return;
    if (!userId || !workspaceId) {
      setProjects([]); setTenders([]); setEmployees([]); setRegistrations([]);
      setPayments([]); setSubscriptions([]); setPartners([]); setFiles([]);
      setLoading(allLoaded(false));
      setLoadErrors({});
      return;
    }

    setLoading(allLoaded(true));
    setLoadErrors({});
    movedLegacyCosts.current = false;
    const isClient = userRole === 'client';

    const handlers = <T,>(key: CollectionKey, set: (items: T[]) => void) => ({
      onData: (items: T[]) => {
        set(items);
        setLoading(prev => ({ ...prev, [key]: false }));
        setLoadErrors(prev => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
      onError: (error: unknown) => {
        console.error(`Error loading ${key}:`, error);
        setLoading(prev => ({ ...prev, [key]: false }));
        setLoadErrors(prev => ({ ...prev, [key]: true }));
      },
    });

    const live = <T,>(key: CollectionKey, set: (items: T[]) => void): Unsubscribe => {
      const h = handlers<T>(key, set);
      return listenCollection<T>(workspaceId, key, h.onData, h.onError);
    };

    const stops: Unsubscribe[] = [];
    if (isClient) {
      const h = handlers<Project>('projects', setProjects);
      stops.push(listenProjectsForClient(workspaceId, userId, userOrganizationId, h.onData, h.onError));
      // Clients read nothing else.
      setTenders([]); setEmployees([]); setRegistrations([]); setPayments([]);
      setSubscriptions([]); setPartners([]); setFiles([]);
      setLoading(prev => ({ ...allLoaded(false), projects: prev.projects }));
    } else {
      stops.push(
        live<Project>('projects', setProjects),
        live<Tender>('tenders', setTenders),
        live<Employee>('employees', setEmployees),
        live<Registration>('registrations', setRegistrations),
        live<Payment>('payments', setPayments),
        live<Subscription>('subscriptions', setSubscriptions),
        live<Partner>('partners', setPartners),
        live<FileRecord>('files', setFiles),
      );
    }
    return () => stops.forEach(stop => stop());
  }, [authLoading, userId, userRole, userOrganizationId, workspaceId]);

  // Older versions saved costs on the project record, which clients can read.
  // Once per session, an admin or manager moves any that are left into the
  // staff-only costs record (only while the company can be changed).
  useEffect(() => {
    if (movedLegacyCosts.current || loading.projects || !canSeeProjectCosts(userRole) || !canWrite || !workspaceId) return;
    movedLegacyCosts.current = true;
    for (const project of projects) {
      if (project.costs === undefined) continue;
      moveLegacyProjectCosts(workspaceId, project.id)
        .catch(error => console.error(`Could not move the costs of project ${project.id}:`, error));
    }
  }, [projects, loading.projects, userRole, canWrite, workspaceId]);

  // Every staff login has an employee record with the same id, and linked
  // records follow the login's name and email. Admins' and managers' sessions
  // fill in whatever is missing (e.g. people who joined before this existed).
  // Runs again whenever the people or employees lists change.
  useEffect(() => {
    if (!workspaceId || !canWrite || !['admin', 'manager'].includes(userRole || '') || loading.employees) return;
    const { create, update } = employeeSync(allUsers, employees);
    const today = new Date().toISOString().slice(0, 10);
    for (const person of create) {
      setEmployee(workspaceId, person.id, newEmployeeRecord(person, today))
        .catch(error => console.error(`Could not add ${person.name} to Employees:`, error));
    }
    for (const change of update) {
      updateEmployee(workspaceId, change.id, { name: change.name, email: change.email })
        .catch(error => console.error(`Could not update employee ${change.id}:`, error));
    }
  }, [allUsers, employees, loading.employees, workspaceId, canWrite, userRole]);

  const organizationIdFor = (clientId?: string) =>
    allUsers.find(u => u.id === normalizeOptionalId(clientId))?.organizationId || '';

  // Human-readable project number: PRJ-{division code}-NNN, or PRJ-NNN when
  // the project has no division (see src/lib/workspace.ts).
  const generateProjectId = (divisionId?: string) =>
    nextProjectNumber(projects.map(p => p.projectId), divisionById(divisionId)?.code);

  // Read-only companies (trial ended / suspended) get a clear message.
  const guard = useWriteGuard();

  // CRUD functions
  const handleAddProject = async (project: Omit<Project, 'id'>) => {
    // Auto-generate projectId if not already set
    const projectId = project.projectId || generateProjectId(project.divisionId);
    // Sanitize clientId: treat 'none' as empty
    const clientId = normalizeOptionalId(project.clientId);
    const projectWithIds = { ...project, projectId, clientId };
    const id = await addProject(workspaceId, projectWithIds);
    return id;
  };

  const handleUpdateProject = async (id: string, project: Partial<Project>) => {
    await updateProject(workspaceId, id, project);
  };

  const handleDeleteProject = async (id: string) => {
    await deleteProject(workspaceId, id);
  };

  // Costs are kept apart from the project record (see services/firestore.ts).
  const watchProjectCosts = useCallback(
    (projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void) =>
      listenProjectCosts(workspaceId, projectId, onData, onError),
    [workspaceId],
  );

  const handleChangeProjectCosts = async (projectId: string, change: ListChange<ProjectCost>) => {
    // A record still carrying old-style costs: fold them in first, so the
    // change applies to the full list.
    if (projects.find(p => p.id === projectId)?.costs !== undefined) {
      await moveLegacyProjectCosts(workspaceId, projectId);
    }
    await changeCostsOnProject(workspaceId, projectId, change);
  };

  // Tasks, documents and team members change one item at a time on the newest
  // copy of the record, so two people editing at once both keep their work.
  const handleChangeRecordList = <T,>(
    collectionName: 'projects' | 'tenders' | 'files', id: string,
    field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>,
  ) => changeListOnRecord<T>(workspaceId, collectionName, id, field, change);

  const handleAddTender = async (tender: Omit<Tender, 'id'>) => {
    const id = await addTender(workspaceId, tender);

    // Auto-create Project if Tender is Awarded on creation
    if (tender.status === 'awarded') {
      const projectExists = projects.some(p => 
        sameText(p.name, tender.name) && sameText(p.company, tender.company)
      );

      if (!projectExists) {
        // Find assigned person's name if missing
        let assignedName = tender.assignedToName;
        if (!assignedName && tender.assignedTo) {
          const emp = employees.find(e => e.id === tender.assignedTo);
          if (emp) assignedName = emp.name;
        }

        const newProject: Omit<Project, 'id'> = {
          name: tender.name,
          company: tender.company,
          divisionId: tender.divisionId,
          status: 'running',
          assignedTo: tender.assignedTo,
          assignedToName: assignedName || '',
          deadline: tender.deadline,
          budget: 0,
          clientId: normalizeOptionalId(tender.clientId),
          clientName: tender.clientName || '',
          organizationId: organizationIdFor(tender.clientId),
          description: `Automatically created from Awarded Tender (Direct Add): ${tender.name}`,
          createdAt: new Date()
        };

        await handleAddProject(newProject);
      }
    }

    return id;
  };

  const handleUpdateTender = async (id: string, tender: Partial<Tender>) => {
    const existingTender = tenders.find(t => t.id === id);
    if (!existingTender) {
      await updateTender(workspaceId, id, tender);
      return;
    }

    const updatedTenderData = { ...existingTender, ...tender };

    await updateTender(workspaceId, id, tender);

    // Auto-create Project if Tender is Awarded
    if (tender.status === 'awarded') {
      const projectExists = projects.some(p => 
        sameText(p.name, updatedTenderData.name) && sameText(p.company, updatedTenderData.company)
      );

      if (!projectExists) {
        // Find assigned person's name if missing
        let assignedName = updatedTenderData.assignedToName;
        if (!assignedName && updatedTenderData.assignedTo) {
          const emp = employees.find(e => e.id === updatedTenderData.assignedTo);
          if (emp) assignedName = emp.name;
        }

        const newProject: Omit<Project, 'id'> = {
          name: updatedTenderData.name,
          company: updatedTenderData.company,
          divisionId: updatedTenderData.divisionId,
          status: 'running',
          assignedTo: updatedTenderData.assignedTo,
          assignedToName: assignedName || '',
          deadline: updatedTenderData.deadline,
          budget: 0,
          clientId: normalizeOptionalId(updatedTenderData.clientId),
          clientName: updatedTenderData.clientName || '',
          organizationId: organizationIdFor(updatedTenderData.clientId),
          description: `Automatically created from Awarded Tender: ${updatedTenderData.name}`,
          createdAt: new Date()
        };

        await handleAddProject(newProject);
      }
    }
  };

  const handleDeleteTender = async (id: string) => {
    await deleteTender(workspaceId, id);
  };

  // GPT-0071: The employees collection in Firestore is the single source of truth.
  // All employee data (name, email, department, position, phone, joinDate, status)
  // must be managed through the Employees page. Avoid syncing from external auth providers.
  const handleAddEmployee = async (employee: Omit<Employee, 'id'>) => {
    const id = await addEmployee(workspaceId, employee);
    return id;
  };

  const handleUpdateEmployee = async (id: string, employee: Partial<Employee>) => {
    await updateEmployee(workspaceId, id, employee);
  };

  const handleDeleteEmployee = async (id: string) => {
    await deleteEmployee(workspaceId, id);
  };

  const handleAddRegistration = async (registration: Omit<Registration, 'id'>) => {
    const id = await addRegistration(workspaceId, registration);
    return id;
  };

  const handleUpdateRegistration = async (id: string, registration: Partial<Registration>) => {
    await updateRegistration(workspaceId, id, registration);
  };

  const handleDeleteRegistration = async (id: string) => {
    await deleteRegistration(workspaceId, id);
  };

  const handleAddPayment = async (payment: Omit<Payment, 'id'>) => {
    const id = await addPayment(workspaceId, payment);
    return id;
  };

  const handleUpdatePayment = async (id: string, payment: Partial<Payment>) => {
    await updatePayment(workspaceId, id, payment);
  };

  const handleDeletePayment = async (id: string) => {
    await deletePayment(workspaceId, id);
  };

  const handleAddSubscription = async (subscription: Omit<Subscription, 'id'>) => {
    const id = await addSubscription(workspaceId, subscription);
    return id;
  };

  const handleUpdateSubscription = async (id: string, subscription: Partial<Subscription>) => {
    await updateSubscription(workspaceId, id, subscription);
  };

  const handleDeleteSubscription = async (id: string) => {
    await deleteSubscription(workspaceId, id);
  };

  const handleAddPartner = async (partner: Omit<Partner, 'id'>) => {
    const id = await addPartner(workspaceId, partner);
    return id;
  };

  const handleUpdatePartner = async (id: string, partner: Partial<Partner>) => {
    await updatePartner(workspaceId, id, partner);
  };

  const handleDeletePartner = async (id: string) => {
    await deletePartner(workspaceId, id);
  };

  const handleAddFile = async (file: Omit<FileRecord, 'id'>) => {
    const id = await addFile(workspaceId, file);
    return id;
  };

  const handleUpdateFile = async (id: string, file: Partial<FileRecord>) => {
    await updateFile(workspaceId, id, file);
  };

  const handleDeleteFile = async (id: string) => {
    await deleteFile(workspaceId, id);
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
      addProject: guard(handleAddProject),
      updateProject: guard(handleUpdateProject),
      deleteProject: guard(handleDeleteProject),
      loadErrors,
      watchProjectCosts,
      changeProjectCosts: guard(handleChangeProjectCosts),
      changeRecordList: guard(handleChangeRecordList) as DataContextType['changeRecordList'],
      addTender: guard(handleAddTender),
      updateTender: guard(handleUpdateTender),
      deleteTender: guard(handleDeleteTender),
      addEmployee: guard(handleAddEmployee),
      updateEmployee: guard(handleUpdateEmployee),
      deleteEmployee: guard(handleDeleteEmployee),
      addRegistration: guard(handleAddRegistration),
      updateRegistration: guard(handleUpdateRegistration),
      deleteRegistration: guard(handleDeleteRegistration),
      addPayment: guard(handleAddPayment),
      updatePayment: guard(handleUpdatePayment),
      deletePayment: guard(handleDeletePayment),
      addSubscription: guard(handleAddSubscription),
      updateSubscription: guard(handleUpdateSubscription),
      deleteSubscription: guard(handleDeleteSubscription),
      addPartner: guard(handleAddPartner),
      updatePartner: guard(handleUpdatePartner),
      deletePartner: guard(handleDeletePartner),
      addFile: guard(handleAddFile),
      updateFile: guard(handleUpdateFile),
      deleteFile: guard(handleDeleteFile),
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
