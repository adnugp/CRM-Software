// Pure rules for the deals pipeline. Only relative runtime imports, so
// `node --test` runs this file directly.
import { STAGES, stageById, type DealStage, type ActivityType } from '../config/pipeline.ts';
import type { Activity, Deal } from '../types/index.ts';

type Dated = { wonAt?: Date | null };
type FollowUpDeal = Pick<Deal, 'stage'> & { nextFollowUp?: { date: string; note: string } | null };

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD (the format of date inputs). */
export const localDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const formatAed = (n: number): string => `AED ${Math.round(n || 0).toLocaleString('en-US')}`;

export const sameName = (a?: string, b?: string): boolean =>
  (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

export const isOpenStage = (stage: DealStage): boolean => stageById(stage)?.open ?? false;

export interface PipelineTotals {
  openCount: number;
  openValue: number;
  weightedValue: number;
  wonThisMonth: number;
  wonThisMonthCount: number;
}

export function pipelineTotals(deals: (Pick<Deal, 'stage' | 'value'> & Dated)[], now: Date): PipelineTotals {
  let openCount = 0, openValue = 0, weighted = 0, wonThisMonth = 0, wonThisMonthCount = 0;
  for (const d of deals) {
    const value = Number(d.value) || 0;
    if (isOpenStage(d.stage)) {
      openCount += 1;
      openValue += value;
      weighted += value * (stageById(d.stage)?.winChance ?? 0);
    } else if (d.stage === 'won' && d.wonAt instanceof Date
      && d.wonAt.getFullYear() === now.getFullYear() && d.wonAt.getMonth() === now.getMonth()) {
      wonThisMonth += value;
      wonThisMonthCount += 1;
    }
  }
  return { openCount, openValue, weightedValue: Math.round(weighted), wonThisMonth, wonThisMonthCount };
}

export function stageTotals(deals: Pick<Deal, 'stage' | 'value'>[]): Record<DealStage, { count: number; value: number }> {
  const totals = Object.fromEntries(STAGES.map(s => [s.id, { count: 0, value: 0 }])) as Record<DealStage, { count: number; value: number }>;
  for (const d of deals) {
    const t = totals[d.stage];
    if (!t) continue;
    t.count += 1;
    t.value += Number(d.value) || 0;
  }
  return totals;
}

/** A follow-up on an open deal dated today or earlier. */
export const isFollowUpDue = (deal: FollowUpDeal, today: string): boolean =>
  isOpenStage(deal.stage) && !!deal.nextFollowUp?.date && deal.nextFollowUp.date <= today;

export const isFollowUpOverdue = (deal: FollowUpDeal, today: string): boolean =>
  isOpenStage(deal.stage) && !!deal.nextFollowUp?.date && deal.nextFollowUp.date < today;

export function dueFollowUps<T extends FollowUpDeal>(deals: T[], today: string): T[] {
  return deals
    .filter(d => isFollowUpDue(d, today))
    .sort((a, b) => a.nextFollowUp!.date.localeCompare(b.nextFollowUp!.date));
}

export const newActivity = (type: ActivityType | 'stage', text: string, byId: string, at: Date, id: string): Activity =>
  ({ id, type, text, at: at.toISOString(), byId });

export interface StageChange {
  stage: DealStage;
  wonAt: Date | null;
  closedAt: Date | null;
  lostReason: string | null;
  activity: Activity;
}

/**
 * The fields to write when a deal moves stage. Every move (board, menu,
 * "Create project") goes through here, so closing and reopening behave the same.
 */
export function stageChange(
  deal: Pick<Deal, 'stage'>,
  to: DealStage,
  opts: { byId: string; now: Date; makeId: () => string; lostReason?: string },
): StageChange {
  if (deal.stage === to) throw new Error('The deal is already in that stage.');
  const label = stageById(to)?.label ?? to;
  const reason = (opts.lostReason || '').trim();
  if (to === 'lost' && !reason) throw new Error('Give a reason for losing the deal.');

  const fields = to === 'won'
    ? { wonAt: opts.now, closedAt: opts.now, lostReason: null }
    : to === 'lost'
      ? { wonAt: null, closedAt: opts.now, lostReason: reason }
      : { wonAt: null, closedAt: null, lostReason: null };
  const text = to === 'lost' ? `Moved to ${label}: ${reason}` : `Moved to ${label}`;
  return { stage: to, ...fields, activity: newActivity('stage', text, opts.byId, opts.now, opts.makeId()) };
}

/** Newest first; returns a new array. */
export const sortActivities = (list: Activity[]): Activity[] => [...list].sort((a, b) => b.at.localeCompare(a.at));

export type DealSortKey = 'value' | 'close' | 'followUp';

export function sortDeals<T extends Pick<Deal, 'value' | 'expectedCloseDate'> & { nextFollowUp?: { date: string } | null }>(
  deals: T[],
  key: DealSortKey,
): T[] {
  const byDate = (a?: string, b?: string) => (a || '9999-99-99').localeCompare(b || '9999-99-99');
  const sorted = [...deals];
  if (key === 'value') sorted.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  if (key === 'close') sorted.sort((a, b) => byDate(a.expectedCloseDate, b.expectedCloseDate));
  if (key === 'followUp') sorted.sort((a, b) => byDate(a.nextFollowUp?.date, b.nextFollowUp?.date));
  return sorted;
}

/** Older projects, tenders and payments that belong to a directory company. */
export function matchesCompany(
  record: { companyId?: string; organizationId?: string; company?: string },
  company: { id: string; name: string; organizationId?: string },
): boolean {
  if (record.companyId && record.companyId === company.id) return true;
  if (record.organizationId && company.organizationId && record.organizationId === company.organizationId) return true;
  return !!record.company && sameName(record.company, company.name);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Why a company can't be deleted, or null when nothing uses it. */
export function companyInUse(companyId: string, deals: { companyId?: string }[], contacts: { companyId?: string }[]): string | null {
  const d = deals.filter(x => x.companyId === companyId).length;
  const c = contacts.filter(x => x.companyId === companyId).length;
  if (!d && !c) return null;
  const parts = [d ? plural(d, 'deal') : '', c ? plural(c, 'contact') : ''].filter(Boolean);
  return `${parts.join(' and ')} ${d + c === 1 ? 'uses' : 'use'} this company.`;
}

export function contactInUse(contactId: string, deals: { contactId?: string }[]): string | null {
  const d = deals.filter(x => x.contactId === contactId).length;
  return d ? `${plural(d, 'deal')} ${d === 1 ? 'uses' : 'use'} this contact.` : null;
}
