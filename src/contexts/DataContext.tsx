import React, { createContext, useContext, useState, ReactNode } from 'react';
import { projects as initialProjects, tenders as initialTenders, payments as initialPayments, subscriptions as initialSubscriptions } from '@/data/mockData';
import { Project, Tender, Payment, Subscription } from '@/types';

interface DataContextType {
  projects: Project[];
  tenders: Tender[];
  payments: Payment[];
  subscriptions: Subscription[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTenders: React.Dispatch<React.SetStateAction<Tender[]>>;
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  setSubscriptions: React.Dispatch<React.SetStateAction<Subscription[]>>;
  stats: {
    activeProjects: number;
    openTenders: number;
    pendingPayments: number;
    totalProjectsAndTenders: number;
  };
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [tenders, setTenders] = useState<Tender[]>(initialTenders);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(initialSubscriptions);

  const stats = {
    activeProjects: projects.filter(p => p.status === 'in-progress').length,
    openTenders: tenders.filter(t => t.status === 'open').length,
    pendingPayments: payments.filter(p => p.status === 'pending').length,
    totalProjectsAndTenders: projects.length + tenders.length,
  };

  return (
    <DataContext.Provider value={{ 
      projects, 
      tenders, 
      payments, 
      subscriptions,
      setProjects, 
      setTenders, 
      setPayments,
      setSubscriptions,
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
