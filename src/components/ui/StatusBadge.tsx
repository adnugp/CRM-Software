import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  variant?: 'project' | 'tender' | 'registration' | 'payment' | 'subscription' | 'employee' | 'partner';
}

const statusStyles: Record<string, Record<string, string>> = {
  project: {
    'running': 'bg-info/10 text-info border-info/20',
    'in-progress': 'bg-warning/10 text-warning border-warning/20',
    'completed': 'bg-success/10 text-success border-success/20',
    'handed-over': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
  },
  tender: {
    'running': 'bg-info/10 text-info border-info/20',
    'submitted': 'bg-warning/10 text-warning border-warning/20',
    'cancelled': 'bg-destructive/10 text-destructive border-destructive/20',
    'to-be-evaluated': 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
    'winner': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    'awarded': 'bg-success/10 text-success border-success/20',
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
