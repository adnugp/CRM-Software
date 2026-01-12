import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'project' | 'tender' | 'registration' | 'payment' | 'subscription' | 'employee' | 'partner';
}

const statusStyles: Record<string, Record<string, string>> = {
  project: {
    'pending': 'bg-warning/10 text-warning border-warning/20',
    'in-progress': 'bg-info/10 text-info border-info/20',
    'completed': 'bg-success/10 text-success border-success/20',
    'on-hold': 'bg-muted text-muted-foreground border-border',
  },
  tender: {
    'open': 'bg-info/10 text-info border-info/20',
    'submitted': 'bg-warning/10 text-warning border-warning/20',
    'awarded': 'bg-success/10 text-success border-success/20',
    'closed': 'bg-muted text-muted-foreground border-border',
  },
  registration: {
    'active': 'bg-success/10 text-success border-success/20',
    'expired': 'bg-destructive/10 text-destructive border-destructive/20',
    'pending': 'bg-warning/10 text-warning border-warning/20',
  },
  payment: {
    'pending': 'bg-warning/10 text-warning border-warning/20',
    'paid': 'bg-success/10 text-success border-success/20',
    'overdue': 'bg-destructive/10 text-destructive border-destructive/20',
  },
  subscription: {
    'active': 'bg-success/10 text-success border-success/20',
    'cancelled': 'bg-muted text-muted-foreground border-border',
    'expired': 'bg-destructive/10 text-destructive border-destructive/20',
  },
  employee: {
    'active': 'bg-success/10 text-success border-success/20',
    'inactive': 'bg-muted text-muted-foreground border-border',
  },
  partner: {
    'active': 'bg-success/10 text-success border-success/20',
    'inactive': 'bg-muted text-muted-foreground border-border',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, variant = 'project' }) => {
  const styles = statusStyles[variant]?.[status] || 'bg-muted text-muted-foreground border-border';
  
  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize',
      styles
    )}>
      {status.replace('-', ' ')}
    </span>
  );
};

export default StatusBadge;
