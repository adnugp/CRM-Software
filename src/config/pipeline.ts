// Deal pipeline: fixed stages with a default win chance. No imports, so the
// unit tests can run this file directly.

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type ActivityType = 'note' | 'call' | 'meeting' | 'email';

export interface StageInfo {
  id: DealStage;
  label: string;
  /** 0–1. Weighted pipeline value = value × winChance. */
  winChance: number;
  /** Open stages count towards the pipeline; won and lost are closed. */
  open: boolean;
}

export const STAGES: StageInfo[] = [
  { id: 'lead', label: 'Lead', winChance: 0.1, open: true },
  { id: 'qualified', label: 'Qualified', winChance: 0.25, open: true },
  { id: 'proposal', label: 'Proposal', winChance: 0.5, open: true },
  { id: 'negotiation', label: 'Negotiation', winChance: 0.75, open: true },
  { id: 'won', label: 'Won', winChance: 1, open: false },
  { id: 'lost', label: 'Lost', winChance: 0, open: false },
];

export const OPEN_STAGES: DealStage[] = STAGES.filter(s => s.open).map(s => s.id);

export const stageById = (id: string): StageInfo | undefined => STAGES.find(s => s.id === id);

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: 'Note',
  call: 'Call',
  meeting: 'Meeting',
  email: 'Email',
};
