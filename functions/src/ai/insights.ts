import {deterministicSummary} from './core';

type RecordData = {[key: string]: any};
export function calendarWindow(now = Date.now(), timezone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(now));
  const today = ['year','month','day'].map(key => parts.find(p => p.type === key)!.value).join('-');
  return {today, horizon: new Date(Date.parse(today+'T00:00:00Z')+7*86400000).toISOString().slice(0,10)};
}
const active = (r: RecordData) => !['completed','done','closed','cancelled','handed-over','awarded','winner','lost','expired'].includes(r.status);
const money = (r: RecordData, key: string) => Number.isSafeInteger(r[key+'Minor']) ? r[key+'Minor'] : Number.isFinite(r[key]) ? Math.round(r[key]*100) : undefined;

/** Explainable observations, never model-generated scores or predictions. */
export function projectRisks(projects: RecordData[], finance: boolean, now = Date.now(), timezone = 'UTC') {
  const {today} = calendarWindow(now, timezone);
  return projects.filter(active).flatMap(project => {
    const reasons: string[] = [];
    if (project.deadline && project.deadline < today) reasons.push(`Project deadline passed (${project.deadline}).`);
    const tasks: RecordData[] = project.tasks || [];
    for (const task of tasks.filter(active)) {
      if (task.dueDate && task.dueDate < today) reasons.push(`Overdue task: ${task.name} (${task.dueDate}).`);
      const dependencies: string[] = task.dependencies || task.dependencyIds || [];
      const blockers = dependencies.filter(id => !tasks.some(t => t.id === id && t.status === 'completed'));
      if (blockers.length) reasons.push(`Task ${task.name} has ${blockers.length} unfinished or unavailable dependencies.`);
    }
    if (finance) {
      const budget = money(project, 'budget');
      const costs: RecordData[] = project.costs || [];
      const sameCurrency = costs.every(c => !c.currency || c.currency === project.currency);
      const amounts = costs.map(c => money(c, 'amount'));
      if (budget !== undefined && project.currency && sameCurrency && amounts.every(a => a !== undefined)) {
        const spent = amounts.reduce((sum: number, value) => sum + value!, 0);
        if (Number.isSafeInteger(spent) && spent > budget) reasons.push(`Recorded expenses exceed budget by ${project.currency} ${((spent-budget)/100).toFixed(2)}.`);
      } else if (costs.length) reasons.push('Budget comparison unavailable: money or matching currencies are missing.');
    }
    return reasons.length ? [{id:project.id, name:project.name, reasons:reasons.slice(0,12), moreReasons:reasons.length>12}] : [];
  });
}

export function briefingSections(data: {[collection: string]: RecordData[]}, finance: boolean, now = Date.now(), timezone = 'UTC') {
  const {today, horizon} = calendarWindow(now, timezone);
  const tasks = (data.projects || []).flatMap(p => (p.tasks || []).map((t:RecordData) => ({...t, projectId:p.id, projectName:p.name})));
  const attention = (rows:RecordData[], dateKey:string) => rows.filter(active).filter(r => r[dateKey] && r[dateKey] <= horizon).sort((a,b)=>a[dateKey].localeCompare(b[dateKey]));
  return {today, horizon, timezone, tasks:attention(tasks, 'dueDate').slice(0,10), taskSummary:deterministicSummary(tasks,now,timezone),
    tenders:attention(data.tenders || [],'deadline').slice(0,10),
    registrations:(data.registrations || []).filter(r=>r.status!=='cancelled'&&r.expiryDate&&r.expiryDate<=horizon).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate)).slice(0,10),
    ...(finance ? {invoices:(data.invoices || []).filter(r=>r.status!=='cancelled'&&Number.isSafeInteger(r.amountMinor ?? r.totalMinor)&&Number.isSafeInteger(r.paidAmountMinor || 0)&&(r.amountMinor ?? r.totalMinor)>(r.paidAmountMinor || 0)).map(r=>({id:r.id,name:r.name||r.invoiceNumber||r.id,currency:r.currency,dueDate:r.dueDate,outstandingMinor:(r.amountMinor ?? r.totalMinor)-(r.paidAmountMinor||0)})).slice(0,10)} : {})};
}

export function briefingText(value: ReturnType<typeof briefingSections>, truncated: string[] = []) {
  const lines = [`Daily briefing · ${value.today} · ${value.timezone}`, `Through ${value.horizon}; overdue items included.`,
    `Tasks: ${value.taskSummary.overdue} overdue, ${value.taskSummary.upcoming} due within 7 days (scanned records).`,
    ...value.tasks.map(t=>`• ${t.name} — ${t.dueDate} (${t.projectName})`),
    'Tender deadlines:', ...value.tenders.map(t=>`• ${t.name} — ${t.deadline}`),
    'Registration expiry:', ...value.registrations.map(r=>`• ${r.name} — ${r.expiryDate}`)];
  if (value.invoices) lines.push('Unpaid invoices:', ...value.invoices.map(i=>`• ${i.name} — ${i.currency ? i.currency+' '+(i.outstandingMinor/100).toFixed(2) : 'currency unavailable'} outstanding${i.dueDate?' · due '+i.dueDate:''}`));
  lines.push('Up to 10 items per section. Empty sections have no matching items in scanned records.', truncated.length ? `Partial scan: more ${truncated.join(', ')} records remain.` : 'All accessible records within the scan limits checked.');
  return lines.join('\n');
}
