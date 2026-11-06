import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useWriteGuard } from '@/hooks/use-write-guard';
import {
  getCompanies, addCompany as saveCompany, updateCompany as patchCompany, deleteCompany as removeCompany,
  getContacts, addContact as saveContact, updateContact as patchContact, deleteContact as removeContact,
  getDeals, addDeal as saveDeal, updateDeal as patchDeal, deleteDeal as removeDeal, updateDealWithActivity,
} from '@/services/firestore';
import { companyInUse, contactInUse, newActivity, stageChange } from '@/lib/pipeline';
import { stageById } from '@/config/pipeline';
import type { Activity, ActivityType, Company, Contact, Deal, DealStage, NewDeal } from '@/types';

type NewCompany = Omit<Company, 'id' | 'createdAt'>;
type NewContact = Omit<Contact, 'id' | 'createdAt'>;

interface SalesContextType {
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  loading: boolean;
  companyById: (id?: string) => Company | undefined;
  contactById: (id?: string) => Contact | undefined;
  addCompany: (data: NewCompany) => Promise<string>;
  updateCompany: (id: string, data: Partial<Company>) => Promise<void>;
  /** Throws (with the reason) while deals or contacts use the company. */
  deleteCompany: (id: string) => Promise<void>;
  addContact: (data: NewContact) => Promise<string>;
  updateContact: (id: string, data: Partial<Contact>) => Promise<void>;
  /** Throws (with the reason) while deals use the contact. */
  deleteContact: (id: string) => Promise<void>;
  addDeal: (data: NewDeal) => Promise<string>;
  updateDeal: (id: string, data: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  moveDeal: (id: string, to: DealStage, lostReason?: string) => Promise<void>;
  logActivity: (id: string, type: ActivityType, text: string) => Promise<void>;
  completeFollowUp: (id: string) => Promise<void>;
  markConverted: (id: string, kind: 'tender' | 'project', recordId: string) => Promise<void>;
}

const SalesContext = createContext<SalesContextType | undefined>(undefined);
const makeId = () => crypto.randomUUID();

export const SalesProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { workspaceId } = useWorkspace();
  const guard = useWriteGuard();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;
  const isStaff = !!user && user.role !== 'client';

  // Staff only (clients have no access in firestore.rules). Cleared on logout.
  useEffect(() => {
    if (authLoading) return;
    if (!userId || !workspaceId || !isStaff) {
      setCompanies([]);
      setContacts([]);
      setDeals([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const empty = (name: string) => (error: unknown) => {
      console.error(`Error fetching ${name}:`, error);
      return [];
    };
    Promise.all([
      getCompanies(workspaceId).catch(empty('companies')),
      getContacts(workspaceId).catch(empty('contacts')),
      getDeals(workspaceId).catch(empty('deals')),
    ]).then(([c, k, d]) => {
      if (cancelled) return;
      setCompanies(c as Company[]);
      setContacts(k as Contact[]);
      setDeals((d as Deal[]).map(x => ({ ...x, activities: x.activities ?? [] })));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, workspaceId, isStaff]);

  const companyById = (id?: string) => (id ? companies.find(c => c.id === id) : undefined);
  const contactById = (id?: string) => (id ? contacts.find(c => c.id === id) : undefined);
  const findDeal = (id: string) => {
    const deal = deals.find(d => d.id === id);
    if (!deal) throw new Error('This deal no longer exists.');
    return deal;
  };
  const activity = (type: Activity['type'], text: string) => newActivity(type, text, userId ?? '', new Date(), makeId());

  // Applies a change plus one history entry, in Firestore and on screen.
  const writeWithActivity = async (id: string, data: Partial<Deal>, entry: Activity) => {
    await updateDealWithActivity(workspaceId, id, data, entry);
    setDeals(prev => prev.map(d => (d.id === id ? { ...d, ...data, activities: [...d.activities, entry] } : d)));
  };

  const addCompany = async (data: NewCompany) => {
    const id = await saveCompany(workspaceId, data);
    setCompanies(prev => [{ ...data, id, createdAt: new Date() }, ...prev]);
    return id;
  };
  const updateCompany = async (id: string, data: Partial<Company>) => {
    await patchCompany(workspaceId, id, data);
    setCompanies(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)));
  };
  const deleteCompany = async (id: string) => {
    const reason = companyInUse(id, deals, contacts);
    if (reason) throw new Error(reason);
    await removeCompany(workspaceId, id);
    setCompanies(prev => prev.filter(c => c.id !== id));
  };

  const addContact = async (data: NewContact) => {
    const id = await saveContact(workspaceId, data);
    setContacts(prev => [{ ...data, id, createdAt: new Date() }, ...prev]);
    return id;
  };
  const updateContact = async (id: string, data: Partial<Contact>) => {
    await patchContact(workspaceId, id, data);
    setContacts(prev => prev.map(c => (c.id === id ? { ...c, ...data } : c)));
  };
  const deleteContact = async (id: string) => {
    const reason = contactInUse(id, deals);
    if (reason) throw new Error(reason);
    await removeContact(workspaceId, id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const addDeal = async (data: NewDeal) => {
    const record: Omit<Deal, 'id'> = {
      ...data,
      activities: [activity('stage', `Created in ${stageById(data.stage)?.label ?? data.stage}`)],
      wonAt: null,
      closedAt: null,
      lostReason: null,
      convertedTo: null,
      nextFollowUp: data.nextFollowUp ?? null,
    };
    const id = await saveDeal(workspaceId, record);
    setDeals(prev => [{ ...record, id, createdAt: new Date() }, ...prev]);
    return id;
  };
  const updateDeal = async (id: string, data: Partial<Deal>) => {
    await patchDeal(workspaceId, id, data);
    setDeals(prev => prev.map(d => (d.id === id ? { ...d, ...data } : d)));
  };
  const deleteDeal = async (id: string) => {
    await removeDeal(workspaceId, id);
    setDeals(prev => prev.filter(d => d.id !== id));
  };
  const moveDeal = async (id: string, to: DealStage, lostReason?: string) => {
    const { activity: entry, ...fields } = stageChange(findDeal(id), to, { byId: userId ?? '', now: new Date(), makeId, lostReason });
    await writeWithActivity(id, fields, entry);
  };
  const logActivity = async (id: string, type: ActivityType, text: string) => {
    const clean = text.trim();
    if (!clean) throw new Error('Write something first.');
    findDeal(id);
    await writeWithActivity(id, {}, activity(type, clean));
  };
  const completeFollowUp = async (id: string) => {
    const note = findDeal(id).nextFollowUp?.note?.trim();
    await writeWithActivity(id, { nextFollowUp: null }, activity('note', note ? `Follow-up done: ${note}` : 'Follow-up done'));
  };
  const markConverted = async (id: string, kind: 'tender' | 'project', recordId: string) => {
    await writeWithActivity(
      id,
      { convertedTo: { kind, id: recordId } },
      activity('note', kind === 'tender' ? 'Converted to a tender' : 'Project created'),
    );
  };

  return (
    <SalesContext.Provider value={{
      companies, contacts, deals, loading, companyById, contactById,
      addCompany: guard(addCompany), updateCompany: guard(updateCompany), deleteCompany: guard(deleteCompany),
      addContact: guard(addContact), updateContact: guard(updateContact), deleteContact: guard(deleteContact),
      addDeal: guard(addDeal), updateDeal: guard(updateDeal), deleteDeal: guard(deleteDeal),
      moveDeal: guard(moveDeal), logActivity: guard(logActivity),
      completeFollowUp: guard(completeFollowUp), markConverted: guard(markConverted),
    }}>
      {children}
    </SalesContext.Provider>
  );
};

export const useSales = () => {
  const context = useContext(SalesContext);
  if (!context) throw new Error('useSales must be used within a SalesProvider');
  return context;
};
