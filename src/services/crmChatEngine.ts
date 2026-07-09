/**
 * In-browser CRM chat engine.
 *
 * Answers questions about the CRM using ONLY the data already loaded in the app
 * (from DataContext / Firestore) — no backend, no LLM, no network calls.
 *
 * It understands: greetings, help, overviews/summaries, per-section listing,
 * counting, totals, status/company/person/type/date filtering, keyword search
 * across every section, and gives a friendly, guided fallback for anything else.
 */
import type {
  Project,
  Tender,
  Employee,
  Registration,
  Payment,
  Subscription,
  Partner,
  FileRecord,
} from '@/types';

export interface CrmData {
  projects: Project[];
  tenders: Tender[];
  employees: Employee[];
  registrations: Registration[];
  payments: Payment[];
  subscriptions: Subscription[];
  partners: Partner[];
  files: FileRecord[];
}

/* ----------------------------- small utilities ---------------------------- */

const norm = (s: string): string => (s || '').toLowerCase().trim();
const hasAny = (text: string, terms: string[]): boolean => terms.some((t) => text.includes(t));

// Whole-word matching so "active" doesn't match "inactive", "due" doesn't match
// "overdue", "engineer" doesn't match "engineering", etc.
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text: string, term: string): boolean =>
  new RegExp(`(^|[^a-z0-9])${escapeRe(term)}([^a-z0-9]|$)`, 'i').test(text);
const hasAnyWord = (text: string, terms: string[]): boolean => terms.some((t) => hasWord(text, t));
const titleCase = (s: string): string => s.replace(/\b\w/g, (c) => c.toUpperCase());

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'is', 'are', 'do', 'does',
  'me', 'my', 'our', 'all', 'any', 'show', 'list', 'give', 'get', 'find', 'tell', 'about',
  'what', 'which', 'who', 'whose', 'how', 'many', 'much', 'number', 'count', 'total', 'with',
  'have', 'has', 'i', 'we', 'you', 'please', 'can', 'could', 'would', 'there', 'that', 'this',
  'from', 'by', 'at', 'as', 'be', 'it', 'now', 'currently', 'status', 'details', 'detail',
  'info', 'information', 'data', 'crm', 'want', 'need', 'like', 'see', 'view',
]);

const words = (q: string): string[] =>
  q
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .map(norm)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

const parseDate = (s?: string): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const money = (n: number): string =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Human-readable date ("13 Jul 2026") and a relative hint ("in 5 days" /
// "3 days overdue") so date answers read naturally instead of raw ISO strings.
const fmtDate = (s?: string): string => {
  const d = parseDate(s);
  return d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
};
const relDays = (s?: string): string => {
  const d = parseDate(s);
  if (!d) return '';
  const diff = Math.round((d.getTime() - startOfToday().getTime()) / 86400000);
  if (diff === 0) return 'due today';
  if (diff > 0) return `in ${diff} day${diff === 1 ? '' : 's'}`;
  return `${-diff} day${diff === -1 ? '' : 's'} overdue`;
};

const listLimit = 25;

const renderList = (title: string, lines: string[]): string => {
  if (lines.length <= listLimit) return `${title}\n\n${lines.join('\n')}`;
  const shown = lines.slice(0, listLimit);
  return `${title}\n\n${shown.join('\n')}\n\n…and ${lines.length - listLimit} more. Ask more specifically (e.g. add a status, person, or company) to narrow it down.`;
};

/* ------------------------------ collections ------------------------------- */

interface Section {
  key: keyof CrmData;
  singular: string;
  plural: string;
  aliases: string[];
  items: Record<string, unknown>[];
  statuses: [string, string[]][]; // [canonicalStatus, synonyms]
  statusOf?: (x: Record<string, unknown>) => string;
  dateOf?: (x: Record<string, unknown>) => string | undefined; // primary date (deadline/dueDate/expiry)
  dateLabel?: string;
  amountOf?: (x: Record<string, unknown>) => number;
  assigneeOf?: (x: Record<string, unknown>) => string;
  companyOf?: (x: Record<string, unknown>) => string;
  parentOf?: (x: Record<string, unknown>) => string;
  text: (x: Record<string, unknown>) => string;
  nameOf: (x: Record<string, unknown>) => string;
  format: (x: Record<string, unknown>) => string;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

function buildSections(data: CrmData): Section[] {
  const p = (x: Record<string, unknown>) => x as unknown as Project;
  const t = (x: Record<string, unknown>) => x as unknown as Tender;
  const e = (x: Record<string, unknown>) => x as unknown as Employee;
  const r = (x: Record<string, unknown>) => x as unknown as Registration;
  const pay = (x: Record<string, unknown>) => x as unknown as Payment;
  const sub = (x: Record<string, unknown>) => x as unknown as Subscription;
  const pt = (x: Record<string, unknown>) => x as unknown as Partner;
  const f = (x: Record<string, unknown>) => x as unknown as FileRecord;

  return [
    {
      key: 'projects',
      singular: 'project',
      plural: 'projects',
      aliases: ['project', 'projects'],
      items: data.projects as unknown as Record<string, unknown>[],
      statuses: [
        ['running', ['running', 'ongoing', 'active', 'live']],
        ['in-progress', ['in-progress', 'in progress', 'inprogress', 'wip']],
        ['completed', ['completed', 'complete', 'done', 'finished']],
        ['handed-over', ['handed-over', 'handed over', 'handover', 'delivered']],
      ],
      statusOf: (x) => str(p(x).status),
      dateOf: (x) => p(x).deadline,
      dateLabel: 'deadline',
      amountOf: (x) => Number(p(x).budget) || 0,
      assigneeOf: (x) => str(p(x).assignedToName),
      companyOf: (x) => str(p(x).company),
      parentOf: (x) => str(p(x).belongsTo),
      text: (x) => [p(x).name, p(x).company, p(x).status, p(x).assignedToName, p(x).belongsTo, p(x).description].map(str).join(' '),
      nameOf: (x) => str(p(x).name),
      format: (x) =>
        `• ${str(p(x).name)} — ${str(p(x).company) || 'N/A'} — ${str(p(x).status)} — assigned to ${str(p(x).assignedToName) || 'N/A'} — deadline ${fmtDate(p(x).deadline)}${p(x).belongsTo ? ` — ${str(p(x).belongsTo)}` : ''}`,
    },
    {
      key: 'tenders',
      singular: 'tender',
      plural: 'tenders',
      aliases: ['tender', 'tenders', 'rfq', 'bid', 'bids'],
      items: data.tenders as unknown as Record<string, unknown>[],
      statuses: [
        ['running', ['running', 'ongoing', 'open', 'active']],
        ['submitted', ['submitted', 'submit']],
        ['cancelled', ['cancelled', 'canceled', 'cancel']],
        ['to-be-evaluated', ['to-be-evaluated', 'to be evaluated', 'evaluation', 'evaluate']],
        ['winner', ['winner', 'won', 'win']],
        ['awarded', ['awarded', 'award']],
      ],
      statusOf: (x) => str(t(x).status),
      dateOf: (x) => t(x).deadline,
      dateLabel: 'deadline',
      assigneeOf: (x) => str(t(x).assignedToName),
      companyOf: (x) => str(t(x).company),
      parentOf: (x) => str(t(x).belongsTo),
      text: (x) => [t(x).name, t(x).company, t(x).status, t(x).assignedToName, t(x).belongsTo, t(x).rfqCode, t(x).portal, t(x).description].map(str).join(' '),
      nameOf: (x) => str(t(x).name),
      format: (x) =>
        `• ${str(t(x).name)} — ${str(t(x).company) || 'N/A'} — ${str(t(x).status)} — assigned to ${str(t(x).assignedToName) || 'N/A'} — deadline ${fmtDate(t(x).deadline)}${t(x).belongsTo ? ` — ${str(t(x).belongsTo)}` : ''}`,
    },
    {
      key: 'registrations',
      singular: 'registration',
      plural: 'registrations',
      aliases: ['registration', 'registrations', 'license', 'licence', 'licenses', 'licences'],
      items: data.registrations as unknown as Record<string, unknown>[],
      statuses: [
        ['active', ['active', 'valid']],
        ['expired', ['expired', 'lapsed']],
        ['pending', ['pending', 'in process', 'processing']],
      ],
      statusOf: (x) => str(r(x).status),
      dateOf: (x) => r(x).expiryDate,
      dateLabel: 'expiry',
      assigneeOf: (x) => str(r(x).assignedToName),
      companyOf: (x) => str(r(x).company),
      parentOf: (x) => str(r(x).belongsTo),
      text: (x) => [r(x).name, r(x).company, r(x).type, r(x).status, r(x).belongsTo].map(str).join(' '),
      nameOf: (x) => str(r(x).name),
      format: (x) =>
        `• ${str(r(x).name)} — ${str(r(x).company) || 'N/A'} — ${str(r(x).type) || 'N/A'} — ${str(r(x).status)} — expires ${fmtDate(r(x).expiryDate)}${r(x).belongsTo ? ` — ${str(r(x).belongsTo)}` : ''}`,
    },
    {
      key: 'payments',
      singular: 'payment',
      plural: 'payments',
      aliases: ['payment', 'payments', 'invoice', 'invoices', 'amount', 'amounts', 'money', 'outstanding', 'receivable', 'receivables', 'owe', 'owed', 'payable', 'payables', 'dues', 'bill', 'bills'],
      items: data.payments as unknown as Record<string, unknown>[],
      statuses: [
        ['pending', ['pending', 'unpaid', 'due', 'outstanding']],
        ['paid', ['paid', 'settled', 'cleared']],
        ['overdue', ['overdue', 'late']],
      ],
      statusOf: (x) => str(pay(x).status),
      dateOf: (x) => pay(x).dueDate,
      dateLabel: 'due date',
      amountOf: (x) => Number(pay(x).amount) || 0,
      companyOf: (x) => str(pay(x).company),
      text: (x) => [pay(x).description, pay(x).company, pay(x).status].map(str).join(' '),
      nameOf: (x) => str(pay(x).description),
      format: (x) =>
        `• ${str(pay(x).description)} — ${str(pay(x).company) || 'N/A'} — ${money(Number(pay(x).amount) || 0)} — due ${fmtDate(pay(x).dueDate)} — ${str(pay(x).status)}`,
    },
    {
      key: 'employees',
      singular: 'employee',
      plural: 'employees',
      aliases: ['employee', 'employees', 'staff', 'team', 'people', 'personnel', 'colleague', 'colleagues', 'worker', 'workers', 'manager', 'managers', 'engineer', 'engineers', 'director', 'directors', 'developer', 'developers', 'designer', 'designers', 'analyst', 'analysts', 'intern', 'interns', 'executive', 'executives', 'officer', 'officers'],
      items: data.employees as unknown as Record<string, unknown>[],
      statuses: [
        ['active', ['active']],
        ['inactive', ['inactive', 'former', 'left']],
      ],
      statusOf: (x) => str(e(x).status),
      text: (x) => [e(x).name, e(x).position, e(x).department, e(x).email, e(x).phone, e(x).status].map(str).join(' '),
      nameOf: (x) => str(e(x).name),
      format: (x) =>
        `• ${str(e(x).name)} — ${str(e(x).position) || 'N/A'} — ${str(e(x).department) || 'N/A'} — ${str(e(x).email) || 'N/A'} — ${str(e(x).phone) || 'N/A'} — ${str(e(x).status)}`,
    },
    {
      key: 'partners',
      singular: 'partner',
      plural: 'partners',
      aliases: ['partner', 'partners', 'vendor', 'vendors', 'supplier', 'suppliers'],
      items: data.partners as unknown as Record<string, unknown>[],
      statuses: [
        ['active', ['active']],
        ['inactive', ['inactive']],
      ],
      statusOf: (x) => str(pt(x).status),
      companyOf: (x) => str(pt(x).company),
      text: (x) => [pt(x).name, pt(x).company, pt(x).partnershipType, pt(x).category, pt(x).email, pt(x).phone, pt(x).status].map(str).join(' '),
      nameOf: (x) => str(pt(x).name),
      format: (x) =>
        `• ${str(pt(x).name)} — ${str(pt(x).company) || 'N/A'} — ${str(pt(x).partnershipType) || str(pt(x).category) || 'Partner'} — ${str(pt(x).status)}`,
    },
    {
      key: 'files',
      singular: 'file',
      plural: 'files',
      aliases: ['file', 'files', 'document', 'documents', 'doc', 'docs', 'report', 'reports', 'attachment', 'attachments'],
      items: data.files as unknown as Record<string, unknown>[],
      statuses: [],
      companyOf: (x) => str(f(x).company),
      text: (x) => [f(x).name, f(x).category, f(x).company, f(x).uploadedBy].map(str).join(' '),
      nameOf: (x) => str(f(x).name),
      format: (x) =>
        `• ${str(f(x).name)} — ${str(f(x).category) || 'Uncategorized'} — ${str(f(x).company) || 'N/A'} — uploaded ${str(f(x).uploadedAt) || 'N/A'}`,
    },
    {
      key: 'subscriptions',
      singular: 'subscription',
      plural: 'subscriptions',
      aliases: ['subscription', 'subscriptions', 'recurring'],
      items: data.subscriptions as unknown as Record<string, unknown>[],
      statuses: [
        ['active', ['active']],
        ['cancelled', ['cancelled', 'canceled']],
        ['expired', ['expired']],
      ],
      statusOf: (x) => str(sub(x).status),
      dateOf: (x) => sub(x).nextBillingDate,
      dateLabel: 'next billing',
      amountOf: (x) => Number(sub(x).amount) || 0,
      text: (x) => [sub(x).name, sub(x).provider, sub(x).status, sub(x).billingCycle].map(str).join(' '),
      nameOf: (x) => str(sub(x).name),
      format: (x) =>
        `• ${str(sub(x).name)} — ${str(sub(x).provider) || 'N/A'} — ${money(Number(sub(x).amount) || 0)}/${str(sub(x).billingCycle)} — next ${fmtDate(sub(x).nextBillingDate)} — ${str(sub(x).status)}`,
    },
  ];
}

/* ------------------------------- detectors -------------------------------- */

const isGreeting = (q: string): boolean =>
  /^(hi|hello|hey|yo|hiya|good morning|good afternoon|good evening|greetings)\b/.test(q) && q.length <= 20;

const isThanks = (q: string): boolean => hasAny(q, ['thank', 'thanks', 'thx', 'appreciate']);

const isHelp = (q: string): boolean =>
  hasAny(q, ['help', 'what can you do', 'what do you do', 'how do you work', 'commands', 'capabilities', 'what can i ask']);

const isOverview = (q: string): boolean =>
  hasAny(q, ['overview', 'summary', 'summarize', 'dashboard', 'everything', 'all data', 'at a glance', 'snapshot', "what's in", 'whats in', 'status of everything', 'health', 'how is the business', 'how is business']);

const isCount = (q: string): boolean => hasAny(q, ['how many', 'count', 'number of', 'no of', 'total number']);

const isSum = (q: string): boolean =>
  hasWord(q, 'sum') || hasWord(q, 'total') || hasAny(q, ['how much', 'outstanding', 'amount of']);

// Superlatives — "biggest payment", "cheapest subscription", "highest budget project"
const isMaxQuery = (q: string): boolean =>
  hasAnyWord(q, ['biggest', 'largest', 'highest', 'maximum', 'priciest', 'costliest', 'top']) ||
  hasAny(q, ['most expensive']);
const isMinQuery = (q: string): boolean =>
  hasAnyWord(q, ['smallest', 'lowest', 'cheapest', 'minimum']) ||
  hasAny(q, ['least expensive']);

// Contact / profile questions about a person — "Ismayil's email", "who is X", "phone number"
const wantsProfile = (q: string): boolean =>
  hasAny(q, ['who is', 'who’s', 'whois', 'profile', 'tell me about', 'details of', 'details about', 'contact detail']) ||
  hasAnyWord(q, ['email', 'e-mail', 'phone', 'mobile', 'number', 'contact', 'contacts', 'position', 'role', 'department', 'designation']);

/* Parent-company detection */
function detectParent(q: string): string | undefined {
  if (hasWord(q, 'sadeem')) return 'Sadeem Energy';
  if (hasAny(q, ['grow plus', 'growplus', 'grow+']) || hasWord(q, 'gpt')) return 'Grow Plus Technologies';
  return undefined;
}

export interface PersonMatch {
  name: string;
  tokens: string[]; // distinctive tokens used for matching
}

/* Build the set of known people (assignees + employees) from the data */
function knownPeople(data: CrmData): string[] {
  const set = new Set<string>();
  const add = (v?: string) => {
    const n = norm(v || '');
    if (n) set.add(n);
  };
  data.projects.forEach((x) => add(x.assignedToName));
  data.tenders.forEach((x) => add(x.assignedToName));
  data.registrations.forEach((x) => add(x.assignedToName));
  data.employees.forEach((x) => add(x.name));
  return [...set];
}

/* How many distinct people share each name-token (so "mohamed" is not distinctive) */
function tokenFrequency(people: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const p of people) {
    const seen = new Set(p.split(/\s+/).filter((t) => t.length > 2));
    for (const t of seen) freq.set(t, (freq.get(t) || 0) + 1);
  }
  return freq;
}

/* Tokens that identify exactly this person (fall back to all tokens if none are unique) */
function distinctiveTokens(name: string, freq: Map<string, number>): string[] {
  const toks = [...new Set(name.split(/\s+/).filter((t) => t.length > 2))];
  const unique = toks.filter((t) => (freq.get(t) || 0) === 1);
  return unique.length ? unique : toks;
}

/* Return the person mentioned in the query, if any */
function detectPerson(q: string, people: string[], freq: Map<string, number>): PersonMatch | undefined {
  const sorted = [...people].sort((a, b) => b.length - a.length); // longest name first
  for (const name of sorted) {
    if (!name) continue;
    const tokens = distinctiveTokens(name, freq);
    if (q.includes(name) || tokens.some((t) => hasWord(q, t))) {
      return { name, tokens };
    }
  }
  return undefined;
}

/* ------------------------------- filtering -------------------------------- */

function applyStatus(section: Section, items: Record<string, unknown>[], q: string): { items: Record<string, unknown>[]; label: string } {
  if (!section.statusOf || section.statuses.length === 0) return { items, label: '' };
  const active: string[] = [];
  for (const [canonical, syns] of section.statuses) {
    // "overdue" is computed from the due date (see applyDate) so a payment still
    // marked "pending" but past due is caught, not just ones flagged overdue.
    if (canonical === 'overdue' && section.dateOf) continue;
    if (hasAnyWord(q, syns)) active.push(canonical);
  }
  if (active.length === 0) return { items, label: '' };
  const filtered = items.filter((x) => active.includes(norm(section.statusOf!(x))));
  return { items: filtered, label: active.join(' or ') };
}

function applyDate(section: Section, items: Record<string, unknown>[], q: string): { items: Record<string, unknown>[]; label: string } {
  if (!section.dateOf) return { items, label: '' };
  const today = startOfToday();
  const inDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d;
  };
  const between = (d: Date, a: Date, b: Date) => d >= a && d <= b;

  // "overdue" = past its date and not in a finished state — computed from the
  // date so it catches items still marked "pending"/"running" but past due.
  if (hasAnyWord(q, ['overdue', 'past due', 'late'])) {
    return {
      items: items.filter((x) => {
        const d = parseDate(section.dateOf!(x));
        const done = section.statusOf ? ['completed', 'paid', 'handed-over', 'awarded', 'cancelled', 'expired'].includes(norm(section.statusOf(x))) : false;
        return d && d < today && !done;
      }),
      label: 'overdue',
    };
  }
  if (hasAnyWord(q, ['due today', 'today', 'expiring today'])) {
    const end = inDays(1);
    return { items: items.filter((x) => { const d = parseDate(section.dateOf!(x)); return d && between(d, today, end); }), label: 'due today' };
  }
  if (hasAny(q, ['this week', 'next 7 days', 'coming week', 'within a week'])) {
    const end = inDays(7);
    return { items: items.filter((x) => { const d = parseDate(section.dateOf!(x)); return d && between(d, today, end); }), label: 'due this week' };
  }
  if (hasAny(q, ['this month', 'next 30 days', 'expiring soon', 'expiring', 'due soon', 'renew', 'renewal'])) {
    const end = inDays(30);
    return { items: items.filter((x) => { const d = parseDate(section.dateOf!(x)); return d && between(d, today, end); }), label: `${section.dateLabel} within 30 days` };
  }
  if (hasAnyWord(q, ['upcoming', 'future', 'ahead'])) {
    return { items: items.filter((x) => { const d = parseDate(section.dateOf!(x)); return d && d >= today; }), label: 'upcoming' };
  }
  return { items, label: '' };
}

function applyCompany(section: Section, items: Record<string, unknown>[], q: string, parent?: string): { items: Record<string, unknown>[]; label: string } {
  if (parent && section.parentOf) {
    return { items: items.filter((x) => norm(section.parentOf!(x)).includes(norm(parent))), label: parent };
  }
  if (section.companyOf) {
    const companies = [...new Set(items.map((x) => norm(section.companyOf!(x))).filter(Boolean))];
    for (const c of companies) {
      if (c.length > 2 && q.includes(c)) {
        return { items: items.filter((x) => norm(section.companyOf!(x)) === c), label: cap(c) };
      }
    }
  }
  return { items, label: '' };
}

function applyPerson(section: Section, items: Record<string, unknown>[], person?: PersonMatch): { items: Record<string, unknown>[]; label: string } {
  if (!person || !section.assigneeOf) return { items, label: '' };
  const filtered = items.filter((x) => {
    const a = norm(section.assigneeOf!(x));
    return a.includes(person.name) || person.tokens.some((t) => a.includes(t));
  });
  return { items: filtered, label: `assigned to ${titleCase(person.name)}` };
}

/* Employees: department & position filters */
function applyEmployeeFacets(items: Record<string, unknown>[], q: string): { items: Record<string, unknown>[]; label: string } {
  let out = items;
  const labels: string[] = [];
  const depts = ['engineering', 'sales', 'management', 'marketing', 'finance', 'hr', 'operations', 'design', 'support'];
  for (const d of depts) {
    if (hasWord(q, d)) {
      out = out.filter((x) => norm((x as unknown as Employee).department).includes(d));
      labels.push(d);
      break;
    }
  }
  const roles = ['engineer', 'manager', 'director', 'developer', 'designer', 'analyst', 'lead', 'intern', 'ceo', 'cto', 'officer'];
  for (const rrole of roles) {
    if (hasWord(q, rrole) || hasWord(q, `${rrole}s`)) {
      out = out.filter((x) => norm((x as unknown as Employee).position).includes(rrole));
      labels.push(`${rrole}s`);
      break;
    }
  }
  return { items: out, label: labels.join(' ') };
}

/* Registration / file / partner type filtering by matching the free-text type words */
function applyTypeText(section: Section, items: Record<string, unknown>[], q: string): { items: Record<string, unknown>[]; label: string } {
  const qwords = words(q);
  if (qwords.length === 0) return { items, label: '' };
  // Only apply when a query word matches a value in the type-ish field
  const typeField = (x: Record<string, unknown>): string => {
    if (section.key === 'registrations') return norm(str((x as unknown as Registration).type));
    if (section.key === 'files') return norm(str((x as unknown as FileRecord).category));
    if (section.key === 'partners') return norm(str((x as unknown as Partner).partnershipType) + ' ' + str((x as unknown as Partner).category));
    return '';
  };
  const values = [...new Set(items.map(typeField).filter(Boolean))];
  for (const w of qwords) {
    for (const v of values) {
      if (v.includes(w)) {
        return { items: items.filter((x) => typeField(x).includes(w)), label: w };
      }
    }
  }
  return { items, label: '' };
}

/* Free-text name / code search *within* a section, so "rdui tender" or
   "deadline for the substation tender" narrows to that specific item by its
   name, rfqCode, portal, etc. Runs after the structured filters using whatever
   query words are left over (excluding the section's own alias/status/date/
   intent words). */
const INTENT_WORDS = new Set([
  'when', 'will', 'deadline', 'deadlines', 'due', 'date', 'dates', 'expiry',
  'expire', 'expires', 'expiring', 'close', 'closing', 'closes', 'last',
  'submission', 'submit', 'end', 'working', 'work', 'assigned', 'happening',
  'left', 'remaining', 'time', 'day', 'days',
]);
const DATE_FILTER_WORDS = new Set([
  'overdue', 'today', 'week', 'month', 'soon', 'upcoming', 'future', 'past',
  'late', 'ahead', 'renewal', 'renew', 'coming', 'next',
]);

function applyNameSearch(section: Section, items: Record<string, unknown>[], q: string, consumed: Set<string>): { items: Record<string, unknown>[]; label: string } {
  const aliasToks = new Set(section.aliases.flatMap((a) => a.split(/\s+/)));
  const statusSyns = new Set(section.statuses.flatMap(([, syns]) => syns.flatMap((s) => s.split(/\s+/))));
  const leftover = words(q).filter(
    (w) => !aliasToks.has(w) && !INTENT_WORDS.has(w) && !DATE_FILTER_WORDS.has(w) && !statusSyns.has(w) && !consumed.has(w),
  );
  if (leftover.length === 0) return { items, label: '' };

  const identity = (x: Record<string, unknown>) => norm(section.nameOf(x) + ' ' + section.text(x));
  const matchable = leftover.filter((w) => items.some((x) => identity(x).includes(w)));
  if (matchable.length === 0) return { items, label: '' };

  // Prefer items matching ALL matchable words (most specific); fall back to ANY.
  const all = items.filter((x) => matchable.every((w) => identity(x).includes(w)));
  const chosen = all.length ? all : items.filter((x) => matchable.some((w) => identity(x).includes(w)));
  return { items: chosen, label: `matching "${matchable.join(' ')}"` };
}

/* Is the user asking specifically about a date/deadline/"when"? */
function isDateQuestion(q: string): boolean {
  return (
    hasWord(q, 'when') ||
    hasAnyWord(q, ['deadline', 'deadlines', 'expiry', 'closing']) ||
    hasAny(q, ['due date', 'last date', 'submission date', 'end date', 'due by', 'closing date'])
  );
}

/* ------------------------------- answering -------------------------------- */

function answerSection(section: Section, q: string, parent: string | undefined, person: PersonMatch | undefined): string {
  let items = section.items;
  const labels: string[] = [];

  const company = applyCompany(section, items, q, parent);
  items = company.items;
  if (company.label) labels.push(company.label);

  const status = applyStatus(section, items, q);
  items = status.items;
  if (status.label) labels.push(status.label);

  const dated = applyDate(section, items, q);
  items = dated.items;
  if (dated.label) labels.push(dated.label);

  let personLabel = '';
  if (section.assigneeOf) {
    const per = applyPerson(section, items, person);
    items = per.items;
    personLabel = per.label; // "assigned to X" — rendered after the noun for readability
  }

  if (section.key === 'employees') {
    const fac = applyEmployeeFacets(items, q);
    items = fac.items;
    if (fac.label) labels.push(fac.label);
  }

  if (section.key === 'registrations' || section.key === 'files' || section.key === 'partners') {
    const ty = applyTypeText(section, items, q);
    items = ty.items;
    if (ty.label) labels.push(ty.label);
  }

  // Narrow to a specific item by name / code (e.g. "rdui tender"), excluding
  // words already consumed by the company/status/date/person filters above.
  const consumed = new Set(norm(labels.join(' ') + ' ' + personLabel).split(/\s+/).filter(Boolean));
  const named = applyNameSearch(section, items, q, consumed);
  items = named.items;
  if (named.label) labels.push(named.label);

  const label = labels.join(' ');
  const noun = (n: number) => (n === 1 ? section.singular : section.plural);
  const pfx = label ? label + ' ' : '';
  const sfx = personLabel ? ' ' + personLabel : '';
  const subj = (n: number) => `${pfx}${noun(n)}${sfx}`; // e.g. "running projects assigned to X"

  // Direct answer to "when / deadline / due / expiry" questions.
  if (section.dateOf && isDateQuestion(q) && !isCount(q) && !isSum(q) && items.length > 0) {
    const dated = items
      .map((x) => ({ x, d: parseDate(section.dateOf!(x)) }))
      .filter((o) => o.d)
      .sort((a, b) => a.d!.getTime() - b.d!.getTime());
    if (dated.length === 0) {
      return `I found ${items.length} ${noun(items.length)}, but none have a ${section.dateLabel} recorded.`;
    }
    if (dated.length === 1) {
      const x = dated[0].x;
      const who = section.companyOf ? ` (${section.companyOf(x) || 'N/A'})` : '';
      const st = section.statusOf ? ` Status: ${cap(section.statusOf(x))}.` : '';
      const raw = section.dateOf!(x);
      return `The ${section.dateLabel} for ${section.nameOf(x)}${who} is ${fmtDate(raw)} — ${relDays(raw)}.${st}`;
    }
    const lines = dated.map(({ x }) => {
      const raw = section.dateOf!(x);
      const st = section.statusOf ? ` — ${section.statusOf(x)}` : '';
      return `• ${section.nameOf(x)} — ${fmtDate(raw)} (${relDays(raw)})${st}`;
    });
    return renderList(
      `Here ${dated.length === 1 ? 'is' : 'are'} the ${label ? label + ' ' : ''}${noun(dated.length)} by ${section.dateLabel}, soonest first:`,
      lines,
    );
  }

  const amountLabel = section.key === 'projects' ? 'budget' : 'amount';

  // Superlative — biggest / smallest by amount (budget for projects)
  if (section.amountOf && (isMaxQuery(q) || isMinQuery(q)) && items.length > 0) {
    const sorted = [...items].sort((a, b) => section.amountOf!(b) - section.amountOf!(a));
    const pick = isMinQuery(q) ? sorted[sorted.length - 1] : sorted[0];
    const sup = isMinQuery(q) ? 'smallest' : 'largest';
    return `The ${sup} ${pfx}${section.singular}${sfx} by ${amountLabel}:\n\n${section.format(pick)}`;
  }

  // Total / sum
  if (section.amountOf && isSum(q) && !isCount(q)) {
    const total = items.reduce((s, x) => s + section.amountOf!(x), 0);
    return `Total ${pfx}${section.singular}${sfx} ${amountLabel}: ${money(total)} across ${items.length} ${noun(items.length)}.`;
  }

  // Count
  if (isCount(q)) {
    return `You have ${items.length} ${subj(items.length)} in your CRM.`;
  }

  if (items.length === 0) {
    return `No ${pfx}${section.plural}${sfx} found in your CRM.`;
  }

  const title = `Found ${items.length} ${subj(items.length)}:`;
  let body = renderList(title, items.map((x) => section.format(x)));

  // For money-centric sections, append the total of what was listed
  if (section.amountOf && (section.key === 'payments' || section.key === 'subscriptions')) {
    const total = items.reduce((s, x) => s + section.amountOf!(x), 0);
    body += `\n\nTotal: ${money(total)}`;
  }
  return body;
}

/* Cross-section keyword search fallback */
function globalSearch(sections: Section[], q: string): string | null {
  const qwAll = words(q);
  if (qwAll.length === 0) return null;
  // Drop bare numeric tokens (e.g. a "2026" year) when there are word tokens —
  // otherwise a shared year in every code matches everything.
  const alpha = qwAll.filter((w) => /[a-z]/i.test(w));
  const qw = alpha.length ? alpha : qwAll;

  const groups: { section: Section; matches: Record<string, unknown>[] }[] = [];
  let totalMatches = 0;

  // Rank items by how many distinct query words they match; keep only the best
  // scoring items so the most relevant results surface instead of everything.
  for (const section of sections) {
    const scored = section.items
      .map((x) => {
        const text = norm(section.text(x));
        return { x, score: qw.filter((w) => text.includes(w)).length };
      })
      .filter((o) => o.score > 0);
    if (scored.length === 0) continue;
    const best = Math.max(...scored.map((o) => o.score));
    const matches = scored.filter((o) => o.score === best).map((o) => o.x);
    groups.push({ section, matches });
    totalMatches += matches.length;
  }

  if (totalMatches === 0) return null;

  // One clear match to a date question -> answer the date directly.
  if (totalMatches === 1 && isDateQuestion(q)) {
    const g = groups[0];
    if (g.section.dateOf) {
      const x = g.matches[0];
      const raw = g.section.dateOf(x);
      if (parseDate(raw)) {
        const who = g.section.companyOf ? ` (${g.section.companyOf(x) || 'N/A'})` : '';
        const st = g.section.statusOf ? ` Status: ${cap(g.section.statusOf(x))}.` : '';
        return `The ${g.section.dateLabel} for ${g.section.nameOf(x)}${who} is ${fmtDate(raw)} — ${relDays(raw)}.${st}`;
      }
    }
  }

  let out = `Found ${totalMatches} result${totalMatches === 1 ? '' : 's'} matching your search:\n`;
  for (const g of groups) {
    out += `\n${cap(g.section.plural)} (${g.matches.length}):\n`;
    out += g.matches.slice(0, 6).map((x) => g.section.format(x)).join('\n');
    if (g.matches.length > 6) out += `\n  …and ${g.matches.length - 6} more`;
    out += '\n';
  }
  return out.trim();
}

/* Overview / summary of the whole CRM */
function overview(data: CrmData, sections: Section[]): string {
  const lines: string[] = ['Here is your CRM at a glance:', ''];
  for (const s of sections) {
    let extra = '';
    if (s.amountOf) {
      const total = s.items.reduce((sum, x) => sum + s.amountOf!(x), 0);
      extra = ` — ${money(total)} total`;
      if (s.key === 'payments') {
        const pending = data.payments.filter((x) => x.status !== 'paid').reduce((sum, x) => sum + (Number(x.amount) || 0), 0);
        extra = ` — ${money(pending)} outstanding`;
      }
    }
    lines.push(`• ${cap(s.plural)}: ${s.items.length}${extra}`);
  }

  // Attention items
  const today = startOfToday();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  const expiringRegs = data.registrations.filter((r) => {
    const d = parseDate(r.expiryDate);
    return d && d >= today && d <= soon;
  }).length;
  const overduePay = data.payments.filter((p) => {
    const d = parseDate(p.dueDate);
    return p.status !== 'paid' && d && d < today;
  }).length;
  if (expiringRegs || overduePay) {
    lines.push('', 'Needs attention:');
    if (overduePay) lines.push(`• ${overduePay} overdue payment${overduePay === 1 ? '' : 's'}`);
    if (expiringRegs) lines.push(`• ${expiringRegs} registration${expiringRegs === 1 ? '' : 's'} expiring within 30 days`);
  }
  lines.push('', 'Ask about any section for details — e.g. "show running projects" or "total pending payments".');
  return lines.join('\n');
}

const HELP_TEXT = `I'm your CRM assistant. I answer using your live CRM data — projects, tenders, registrations, payments, employees, partners, files and subscriptions.

Try asking me things like:
• "Show all running projects"
• "How many tenders are submitted?"
• "What is Ismayil working on?"
• "Total pending payments"
• "Registrations expiring soon"
• "List Grow Plus Technologies tenders"
• "Show me the employees in engineering"
• "Give me an overview of the CRM"

You can filter by status, person, company, type or date — just say it in plain English.`;

/* ------------------------------ entry point ------------------------------- */

export function answerCrmQuestion(question: string, data: CrmData): string {
  const q = norm(question);
  if (!q) return HELP_TEXT;

  if (isGreeting(q)) {
    return "Hello! I'm your CRM assistant. Ask me about your projects, tenders, payments, registrations, employees, partners, files or subscriptions — or say \"overview\" to see everything at a glance.";
  }
  if (isHelp(q)) return HELP_TEXT;
  if (isThanks(q) && q.length < 25) return "You're welcome! Anything else you'd like to know about your CRM?";

  const sections = buildSections(data);

  if (isOverview(q)) return overview(data, sections);

  const parent = detectParent(q);
  const people = knownPeople(data);
  const person = detectPerson(q, people, tokenFrequency(people));

  // Which sections are explicitly referenced? (whole-word so "engineering" doesn't hit "engineer")
  const matched = sections.filter((s) => hasAnyWord(q, s.aliases));

  // A single clearly-referenced section
  if (matched.length === 1) {
    return answerSection(matched[0], q, parent, person);
  }

  // Multiple sections referenced -> if it's a count/overview style, give counts for each
  if (matched.length > 1) {
    if (isCount(q) || isOverview(q)) {
      const lines = matched.map((s) => {
        let items = s.items;
        items = applyCompany(s, items, q, parent).items;
        items = applyStatus(s, items, q).items;
        return `• ${cap(s.plural)}: ${items.length}`;
      });
      return `Here's what I found:\n\n${lines.join('\n')}`;
    }
    // Otherwise answer the section whose alias appears earliest in the question,
    // so "files in tenders category" answers files (not the tenders section).
    const firstAliasIndex = (s: Section) =>
      Math.min(...s.aliases.map((a) => { const i = q.indexOf(a); return i < 0 ? Infinity : i; }));
    const primary = [...matched].sort((a, b) => firstAliasIndex(a) - firstAliasIndex(b))[0];
    return answerSection(primary, q, parent, person);
  }

  // No section named, but a person is mentioned
  if (person) {
    const emp = data.employees.find((e) => {
      const n = norm(e.name);
      return n.includes(person.name) || person.tokens.some((t) => n.includes(t));
    });

    const workSections = sections.filter((s) => s.assigneeOf);
    const parts: string[] = [];
    for (const s of workSections) {
      const per = applyPerson(s, s.items, person);
      if (per.items.length > 0) {
        parts.push(`${cap(s.plural)} (${per.items.length}):\n${per.items.slice(0, 8).map((x) => s.format(x)).join('\n')}`);
      }
    }

    // Contact / profile question (email, phone, "who is X"), or an employee with
    // nothing assigned -> show their profile card.
    if (emp && (wantsProfile(q) || parts.length === 0)) {
      const card = [
        titleCase(str(emp.name)),
        `• Position: ${str(emp.position) || 'N/A'}`,
        `• Department: ${str(emp.department) || 'N/A'}`,
        `• Email: ${str(emp.email) || 'N/A'}`,
        `• Phone: ${str(emp.phone) || 'N/A'}`,
        `• Status: ${str(emp.status) || 'N/A'}`,
      ].join('\n');
      return parts.length > 0
        ? `${card}\n\nAlso assigned to work — ask "what is ${titleCase(person.name)} working on" for details.`
        : card;
    }

    if (parts.length > 0) {
      return `Here's what ${titleCase(person.name)} is assigned to:\n\n${parts.join('\n\n')}`;
    }
    return `I couldn't find anything for ${titleCase(person.name)} in your CRM.`;
  }

  // Fall back to a keyword search across everything
  const search = globalSearch(sections, q);
  if (search) return search;

  // Truly nothing matched — guide the user
  return `I couldn't find anything matching that in your CRM data. ${HELP_TEXT}`;
}
