import React from 'react';
import { cn } from '@/lib/utils';
import { stageById, type DealStage } from '@/config/pipeline';

const COLORS: Record<DealStage, string> = {
  lead: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  qualified: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  proposal: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  negotiation: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  lost: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

export const StageBadge: React.FC<{ stage: DealStage; className?: string }> = ({ stage, className }) => (
  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', COLORS[stage], className)}>
    {stageById(stage)?.label ?? stage}
  </span>
);
