// Assistant answers about deals and follow-ups. Pure: relative runtime
// imports only, so `node --test` runs it.
import { STAGES, stageById } from '../config/pipeline.ts';
import { dueFollowUps, formatAed, isOpenStage, localDate, pipelineTotals } from './pipeline.ts';
import type { Company, Deal } from '../types/index.ts';

export interface SalesData {
  deals: Deal[];
  companies: Pick<Company, 'id' | 'name'>[];
}

const LIMIT = 25;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** An answer for sales questions, or null to let the main engine answer. */
export function answerSalesQuestion(question: string, data: SalesData, now: Date): string | null {
  const q = question.toLowerCase();
  const nameOf = (id: string) => data.companies.find(c => c.id === id)?.name ?? 'Unknown company';

  if (/follow[\s-]?ups?/.test(q)) {
    const due = dueFollowUps(data.deals, localDate(now));
    if (!due.length) return 'No follow-ups are due today or overdue.';
    return `Follow-ups due (${due.length}):\n` + due.slice(0, LIMIT)
      .map(d => `• ${d.nextFollowUp!.date} — ${d.title} (${nameOf(d.companyId)})${d.nextFollowUp!.note ? `: ${d.nextFollowUp!.note}` : ''}`)
      .join('\n');
  }

  if (!/\b(deals?|pipeline)\b/.test(q)) return null;

  const stage = STAGES.find(s => new RegExp(`\\b${s.id}\\b`).test(q));
  const company = data.companies.find(c => q.includes(c.name.toLowerCase()));

  if (/\bpipeline\b/.test(q) && !stage && !company) {
    const t = pipelineTotals(data.deals, now);
    return `Pipeline: ${plural(t.openCount, 'open deal')} worth ${formatAed(t.openValue)} (weighted ${formatAed(t.weightedValue)}). `
      + `Won this month: ${formatAed(t.wonThisMonth)} from ${plural(t.wonThisMonthCount, 'deal')}.`;
  }

  let list = data.deals;
  const parts: string[] = [];
  if (stage) {
    list = list.filter(d => d.stage === stage.id);
    parts.push(`in ${stage.label}`);
  }
  if (company) {
    list = list.filter(d => d.companyId === company.id);
    parts.push(`for ${company.name}`);
  }
  if (!parts.length) list = list.filter(d => isOpenStage(d.stage));

  if (!list.length) return `No deals ${parts.length ? parts.join(' ') : 'are open'}.`;
  const heading = parts.length ? `Deals ${parts.join(' ')}` : 'Open deals';
  return `${heading} (${list.length}):\n` + list.slice(0, LIMIT)
    .map(d => `• ${d.title} — ${nameOf(d.companyId)} · ${formatAed(d.value)} · ${stageById(d.stage)?.label ?? d.stage}`)
    .join('\n');
}
