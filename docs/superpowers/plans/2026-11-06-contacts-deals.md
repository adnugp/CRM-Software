# Contacts, Companies and Deals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sales side to each workspace: a companies directory, contacts, and a fixed-stage deals pipeline (board and list, history and follow-ups) whose deals turn into tenders or projects.

**Architecture:** Three new staff-only collections under `workspaces/{ws}/` (`companies`, `contacts`, `deals`). The business rules live in pure modules that the unit tests run directly: stage changes, totals, follow-ups and matching earlier records. A new `SalesContext` loads the three collections and owns every write, all behind the same read-only guard as `DataContext`. The screens are new pages, plus a small `prefill` prop on the existing Tender and Project forms for conversion.

**Tech Stack:** React 18, TypeScript (strict off), Vite, shadcn/ui (Radix), react-hook-form + zod, Firebase JS SDK 12 (Firestore), node:test, @firebase/rules-unit-testing.

**Spec:** `docs/superpowers/specs/2026-11-06-contacts-deals-design.md`

## Global Constraints

- Work on branch `redesign`. Test against the local emulators (project `demo-crm`); never use `npm run dev:live`.
- Commit after each task. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Pure modules (`src/config/pipeline.ts`, `src/lib/pipeline.ts`, `src/lib/salesChat.ts`) never import `@/…` at runtime. They use relative imports with a `.ts` extension; type-only imports (`import type`) are fine, because Node strips them.
- Money is AED, shown as `AED 12,500` (no decimals).
- Dates entered by people are `YYYY-MM-DD` strings. Activity times are ISO strings, because `fromDoc` only converts top-level Timestamps. `wonAt`/`closedAt` are top-level Dates or `null`.
- Never pass a Firestore `FieldValue` (e.g. `arrayUnion`) through `removeUndefined`, which walks into objects and would break it.
- `npm run test:rules` uses the same ports as the running emulators. Stop the `firebase-emulators` preview server first, then start it again and run `npm run seed`.
- Windows: files use CRLF. Write files with the editor tools, not bash heredocs.
- Every new form awaits its save. On failure it shows a "Not saved" toast and stays open.
- Stage names, win chances and the stage order are exactly: Lead 10%, Qualified 25%, Proposal 50%, Negotiation 75%, Won 100%, Lost 0%.

## Deviations from the spec (approved in planning; spec updated to match)

1. **Sales data gets its own `SalesContext`** instead of growing `DataContext`, which is already 484 lines. The read-only guard moves into a shared `useWriteGuard()` hook that both contexts use.
2. **New deals start in an open stage** (Lead to Negotiation). Won and Lost are reached only through a stage move, so the lost reason is always collected by the Lost dialog and every close is logged.
3. **The client invite "Company" picker** is the existing company text box with directory suggestions (`<datalist>`). Choosing a directory company reuses or creates its `organizationId`.

## File map

| File | New/changed | Responsibility |
|---|---|---|
| `src/config/pipeline.ts` | new | Stage table, activity types and labels |
| `src/lib/pipeline.ts` | new | Pure rules: totals, follow-ups, stage changes, sorting, matching, in-use checks, money format |
| `src/lib/salesChat.ts` | new | Pure assistant answers for sales questions |
| `tests/unit/pipeline.test.mjs`, `tests/unit/salesChat.test.mjs` | new | Unit tests |
| `src/types/index.ts` | changed | `Company`, `Contact`, `Deal`, `Activity`, `FollowUp`, `NewDeal`; `companyId?`/`dealId?` on Project and Tender |
| `firestore.rules`, `tests/security-rules.test.mjs` | changed | Staff-only access to the three collections |
| `src/services/firestore.ts` | changed | CRUD plus `updateDealWithActivity` |
| `src/hooks/use-write-guard.ts` | new | Shared read-only guard |
| `src/contexts/SalesContext.tsx` | new | Sales state and writes |
| `src/contexts/DataContext.tsx`, `src/App.tsx` | changed | Use the guard hook; mount `SalesProvider`; routes |
| `src/components/layout/Sidebar.tsx` | changed | Sales group |
| `src/components/sales/fields.tsx` | new | Shared form fields, staff options, initials, error text |
| `src/components/companies/CompanyForm.tsx`, `ContactForm.tsx`, `CompanyPicker.tsx` | new | Forms |
| `src/pages/Companies.tsx`, `CompanyDetail.tsx`, `Contacts.tsx`, `ContactDetail.tsx` | new | Directory screens |
| `src/components/deals/*` | new | `StageBadge`, `MoveToMenu`, `LostReasonDialog`, `useStageMove`, `DealCard`, `DealBoard`, `DealList`, `DealForm`, `ActivityTimeline`, `FollowUpBox` |
| `src/pages/Deals.tsx`, `DealDetail.tsx` | new | Pipeline screens |
| `src/components/forms/TenderForm.tsx`, `ProjectForm.tsx` | changed | `prefill` prop |
| `src/components/dashboard/FollowUpsCard.tsx`, `PipelineCard.tsx`, `src/pages/Dashboard.tsx` | new/changed | Dashboard cards |
| `src/services/crmChatEngine.ts`, `src/components/AIChatbotWidget.tsx` | changed | Assistant hook-up |
| `src/components/settings/TeamInvites.tsx` | changed | Directory suggestions and organisation ID reuse |
| `scripts/seed-emulator.mjs`, `README.md`, `TODO.md` | changed | Demo data, docs |

---

### Task 1: Stage table and pure pipeline rules

**Files:**
- Create: `src/config/pipeline.ts`, `src/lib/pipeline.ts`, `tests/unit/pipeline.test.mjs`
- Modify: `src/types/index.ts` (append sales types; add two fields to Project and Tender), `package.json` (`test:unit`)

**Interfaces:**
- Produces:
  - `DealStage`, `ActivityType`, `StageInfo`, `STAGES`, `OPEN_STAGES`, `stageById(id)`, `ACTIVITY_LABELS`;
  - `Company`, `Contact`, `Deal`, `Activity`, `FollowUp`, `ConvertedTo`, `NewDeal` (from `@/types`);
  - `localDate(d)`, `formatAed(n)`, `sameName(a,b)`, `isOpenStage(s)`;
  - `pipelineTotals(deals, now)` → `{openCount, openValue, weightedValue, wonThisMonth, wonThisMonthCount}`;
  - `stageTotals(deals)` → `Record<DealStage,{count,value}>`;
  - `isFollowUpDue(deal, today)`, `isFollowUpOverdue(deal, today)`, `dueFollowUps(deals, today)`;
  - `newActivity(type, text, byId, at, id)`;
  - `stageChange(deal, to, {byId, now, makeId, lostReason?})` → `{stage, wonAt, closedAt, lostReason, activity}`;
  - `sortActivities(list)`, `sortDeals(deals, key)` with `key: 'value'|'close'|'followUp'`;
  - `matchesCompany(record, company)`, `companyInUse(id, deals, contacts)`, `contactInUse(id, deals)`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/pipeline.test.mjs`

```js
// Unit tests for the deals pipeline rules (stages, totals, follow-ups, history).
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, OPEN_STAGES, stageById } from '../../src/config/pipeline.ts';
import {
  pipelineTotals, stageTotals, isFollowUpDue, isFollowUpOverdue, dueFollowUps, stageChange,
  newActivity, sortActivities, sortDeals, matchesCompany, companyInUse, contactInUse, localDate, formatAed,
} from '../../src/lib/pipeline.ts';

const now = new Date(2026, 10, 6, 10, 0); // 6 Nov 2026, local time
let n = 0;
const makeId = () => `id-${++n}`;
const deal = (over) => ({ stage: 'lead', value: 0, wonAt: null, closedAt: null, nextFollowUp: null, ...over });

test('stages are in order with their win chances', () => {
  assert.deepEqual(STAGES.map(s => [s.id, s.winChance]), [
    ['lead', 0.1], ['qualified', 0.25], ['proposal', 0.5], ['negotiation', 0.75], ['won', 1], ['lost', 0],
  ]);
  assert.deepEqual(OPEN_STAGES, ['lead', 'qualified', 'proposal', 'negotiation']);
  assert.equal(stageById('proposal').label, 'Proposal');
  assert.equal(stageById('nope'), undefined);
});

test('pipeline totals: open deals, weighted value, and wins this month', () => {
  const t = pipelineTotals([
    deal({ stage: 'lead', value: 1000 }),
    deal({ stage: 'negotiation', value: 2000 }),
    deal({ stage: 'won', value: 5000, wonAt: new Date(2026, 10, 2) }),
    deal({ stage: 'won', value: 9000, wonAt: new Date(2026, 9, 30) }),
    deal({ stage: 'lost', value: 7000 }),
  ], now);
  assert.deepEqual(t, { openCount: 2, openValue: 3000, weightedValue: 1600, wonThisMonth: 5000, wonThisMonthCount: 1 });
});

test('stage totals per board column', () => {
  const t = stageTotals([deal({ stage: 'lead', value: 10 }), deal({ stage: 'lead', value: 5 }), deal({ stage: 'won', value: 1 })]);
  assert.deepEqual(t.lead, { count: 2, value: 15 });
  assert.deepEqual(t.won, { count: 1, value: 1 });
  assert.deepEqual(t.lost, { count: 0, value: 0 });
});

test('local date and money format', () => {
  assert.equal(localDate(now), '2026-11-06');
  assert.equal(formatAed(12500.4), 'AED 12,500');
  assert.equal(formatAed(0), 'AED 0');
});

test('follow-ups: due today or earlier, overdue before today, only on open deals', () => {
  const today = '2026-11-06';
  const a = deal({ nextFollowUp: { date: '2026-11-04', note: 'Call' } });
  const b = deal({ nextFollowUp: { date: '2026-11-06', note: 'Send quote' } });
  const c = deal({ nextFollowUp: { date: '2026-11-09', note: 'Later' } });
  const d = deal({ stage: 'won', nextFollowUp: { date: '2026-11-01', note: 'Closed' } });
  const e = deal({});
  assert.deepEqual([a, b, c, d, e].map(x => isFollowUpDue(x, today)), [true, true, false, false, false]);
  assert.deepEqual([a, b, c].map(x => isFollowUpOverdue(x, today)), [true, false, false]);
  assert.deepEqual(dueFollowUps([c, b, d, a, e], today), [a, b]);
});

test('stageChange: winning sets both dates and logs the move', () => {
  const won = stageChange(deal({ stage: 'proposal' }), 'won', { byId: 'u1', now, makeId });
  assert.equal(won.stage, 'won');
  assert.equal(won.wonAt, now);
  assert.equal(won.closedAt, now);
  assert.equal(won.lostReason, null);
  assert.deepEqual(won.activity, { id: won.activity.id, type: 'stage', text: 'Moved to Won', at: now.toISOString(), byId: 'u1' });
});

test('stageChange: losing needs a reason', () => {
  assert.throws(() => stageChange(deal({}), 'lost', { byId: 'u1', now, makeId }), /reason/);
  assert.throws(() => stageChange(deal({}), 'lost', { byId: 'u1', now, makeId, lostReason: '   ' }), /reason/);
  const lost = stageChange(deal({ stage: 'negotiation' }), 'lost', { byId: 'u1', now, makeId, lostReason: ' Price too high ' });
  assert.equal(lost.wonAt, null);
  assert.equal(lost.closedAt, now);
  assert.equal(lost.lostReason, 'Price too high');
  assert.equal(lost.activity.text, 'Moved to Lost: Price too high');
});

test('stageChange: reopening clears the close fields; same stage is refused', () => {
  const reopened = stageChange(deal({ stage: 'lost', closedAt: now, lostReason: 'x' }), 'proposal', { byId: 'u1', now, makeId });
  assert.deepEqual([reopened.stage, reopened.wonAt, reopened.closedAt, reopened.lostReason], ['proposal', null, null, null]);
  assert.throws(() => stageChange(deal({ stage: 'lead' }), 'lead', { byId: 'u1', now, makeId }), /already/);
});

test('history is shown newest first without changing the original list', () => {
  const list = [
    newActivity('note', 'a', 'u1', new Date('2026-11-01T10:00:00Z'), '1'),
    newActivity('call', 'b', 'u1', new Date('2026-11-05T10:00:00Z'), '2'),
    newActivity('email', 'c', 'u1', new Date('2026-11-03T10:00:00Z'), '3'),
  ];
  assert.deepEqual(sortActivities(list).map(a => a.id), ['2', '3', '1']);
  assert.deepEqual(list.map(a => a.id), ['1', '2', '3']);
});

test('deal list sorting', () => {
  const x = deal({ value: 5, expectedCloseDate: '2026-12-01', nextFollowUp: { date: '2026-11-10', note: '' } });
  const y = deal({ value: 9, expectedCloseDate: '2026-11-20' });
  const z = deal({ value: 1, nextFollowUp: { date: '2026-11-07', note: '' } });
  assert.deepEqual(sortDeals([x, y, z], 'value'), [y, x, z]);
  assert.deepEqual(sortDeals([x, y, z], 'close'), [y, x, z]);
  assert.deepEqual(sortDeals([x, y, z], 'followUp'), [z, x, y]);
});

test('earlier records match by link, organisation id or name', () => {
  const co = { id: 'co1', name: 'Gulf Facilities LLC', organizationId: 'ORG-GF-001' };
  assert.equal(matchesCompany({ companyId: 'co1', company: 'Other' }, co), true);
  assert.equal(matchesCompany({ organizationId: 'ORG-GF-001', company: 'Renamed' }, co), true);
  assert.equal(matchesCompany({ company: '  gulf facilities llc ' }, co), true);
  assert.equal(matchesCompany({ company: 'Gulf Trading Co.' }, co), false);
  assert.equal(matchesCompany({ organizationId: '', company: 'x' }, { id: 'c2', name: 'y', organizationId: '' }), false);
});

test('deleting is blocked while something still uses the record', () => {
  assert.equal(companyInUse('co1', [], []), null);
  assert.equal(companyInUse('co1', [{ companyId: 'co1' }], []), '1 deal uses this company.');
  assert.equal(
    companyInUse('co1', [{ companyId: 'co1' }, { companyId: 'co1' }, { companyId: 'x' }], [{ companyId: 'co1' }]),
    '2 deals and 1 contact use this company.',
  );
  assert.equal(contactInUse('k1', []), null);
  assert.equal(contactInUse('k1', [{ contactId: 'k1' }]), '1 deal uses this contact.');
});
```

- [ ] **Step 2: Add the test file to `test:unit`** in `package.json`:

```json
"test:unit": "node --test tests/unit/workspace.test.mjs tests/unit/subscription.test.mjs tests/unit/payment.test.mjs tests/unit/pipeline.test.mjs",
```

- [ ] **Step 3: Run the tests to make sure they fail**

Run: `npm run test:unit`
Expected: FAIL. `pipeline.test.mjs` can't find `src/config/pipeline.ts`; the other 36 tests pass.

- [ ] **Step 4: Create `src/config/pipeline.ts`**

```ts
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
```

- [ ] **Step 5: Append the sales types** to the end of `src/types/index.ts`

```ts
// ---- Sales: companies, contacts and deals --------------------------------
export type { DealStage, ActivityType } from '@/config/pipeline';
import type { DealStage, ActivityType } from '@/config/pipeline';

export interface Company {
  id: string;
  name: string;
  industry?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
  /** Same format as client logins (ORG-XX-NNN); set when a client is invited. */
  organizationId?: string;
  ownerId: string;
  createdAt?: Date;
}

export interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  companyId?: string;
  notes?: string;
  createdAt?: Date;
}

export interface FollowUp {
  date: string; // YYYY-MM-DD
  note: string;
}

export interface Activity {
  id: string;
  type: ActivityType | 'stage';
  text: string;
  at: string; // ISO time (nested values aren't converted from Timestamps)
  byId: string;
}

export interface ConvertedTo {
  kind: 'tender' | 'project';
  id: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number; // AED
  stage: DealStage;
  companyId: string;
  contactId?: string;
  ownerId: string;
  divisionId?: string;
  expectedCloseDate?: string;
  source?: string;
  nextFollowUp?: FollowUp | null;
  lostReason?: string | null;
  activities: Activity[];
  convertedTo?: ConvertedTo | null;
  wonAt?: Date | null;
  closedAt?: Date | null;
  createdAt?: Date;
}

/** What the New deal form provides; the context adds history and close fields. */
export type NewDeal = Omit<Deal, 'id' | 'activities' | 'createdAt' | 'wonAt' | 'closedAt' | 'lostReason' | 'convertedTo'>;
```

In the same file, add to **both** `interface Project` and `interface Tender`, right after `organizationId?: string;`:

```ts
  /** Directory company this record belongs to (records made from a deal). */
  companyId?: string;
  /** The deal this record was created from. */
  dealId?: string;
```

- [ ] **Step 6: Create `src/lib/pipeline.ts`**

```ts
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
```

- [ ] **Step 7: Run the tests to make sure they pass**

Run: `npm run test:unit`
Expected: all pass (36 existing + 12 new).

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/config/pipeline.ts src/lib/pipeline.ts src/types/index.ts tests/unit/pipeline.test.mjs package.json
git commit -m "feat: deal stages and pure pipeline rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Security rules for companies, contacts and deals

**Files:**
- Modify: `tests/security-rules.test.mjs` (seed data in `beforeEach` and a new `describe` block), `firestore.rules:327-329`

**Interfaces:**
- Consumes: the existing fixtures `profiles`, `ws(uid, id)`, and the workspaces `wsA`, `wsB`, `wsT`, `wsS`.
- Produces: staff-only rules for the `companies`, `contacts` and `deals` collections.

- [ ] **Step 1: Seed one document of each kind.** In `beforeEach`, right after `await a.collection('employees').doc('e1').set({ name: 'Emp' });`, add:

```js
    await a.collection('companies').doc('c1').set({ name: 'Gulf Facilities LLC', ownerId: 'admin' });
    await a.collection('contacts').doc('k1').set({ name: 'Omar', companyId: 'c1' });
    await a.collection('deals').doc('d1').set({ title: 'Chiller retrofit', stage: 'lead', value: 1000, companyId: 'c1' });
    await fs.collection('workspaces').doc('wsT').collection('deals').doc('d-t').set({ title: 'Old deal' });
    await fs.collection('workspaces').doc('wsS').collection('deals').doc('d-s').set({ title: 'Paused deal' });
```

- [ ] **Step 2: Write the failing tests.** Add this block after the `describe('workspace isolation', …)` block:

```js
describe('sales: companies, contacts and deals', () => {
  const SALES = { companies: 'c1', contacts: 'k1', deals: 'd1' };

  it('staff can read and write all three', async () => {
    for (const uid of ['admin', 'manager', 'employee']) {
      for (const [coll, id] of Object.entries(SALES)) {
        await assertSucceeds(ws(uid, 'wsA').collection(coll).get());
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(id).update({ notes: uid }));
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(`new-${uid}`).set({ name: 'x' }));
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(`new-${uid}`).delete());
      }
    }
  });

  it('clients cannot read or write them', async () => {
    for (const [coll, id] of Object.entries(SALES)) {
      await assertFails(ws('clientA', 'wsA').collection(coll).doc(id).get());
      await assertFails(ws('clientA', 'wsA').collection(coll).get());
      await assertFails(ws('clientA', 'wsA').collection(coll).doc('x').set({ name: 'x' }));
    }
  });

  it('another company cannot read or write them', async () => {
    for (const [coll, id] of Object.entries(SALES)) {
      await assertFails(ws('adminB', 'wsA').collection(coll).doc(id).get());
      await assertFails(ws('adminB', 'wsA').collection(coll).doc(id).update({ notes: 'b' }));
    }
  });

  it('read-only companies can read deals but not change them', async () => {
    for (const [uid, wsId, id] of [['adminT', 'wsT', 'd-t'], ['adminS', 'wsS', 'd-s']]) {
      const deals = ws(uid, wsId).collection('deals');
      await assertSucceeds(deals.doc(id).get());
      await assertFails(deals.doc(id).update({ stage: 'won' }));
      await assertFails(deals.doc('new').set({ title: 'x' }));
      await assertFails(deals.doc(id).delete());
    }
  });
});
```

- [ ] **Step 3: Run them to make sure they fail.** Stop the `firebase-emulators` preview server first (it uses the same ports).

Run: `npm run test:rules`
Expected: FAIL in "staff can read and write all three" and the first assertion of "read-only companies…" (the collections aren't allowed yet). The other three new tests pass, since they expect denial.

- [ ] **Step 4: Allow the collections.** In `firestore.rules`, replace both collection lists in the "Other business data (staff only)" block:

```
      // ---- Other business data (staff only) ----------------------------
      match /{coll}/{docId} {
        allow read: if inWs(ws) && isStaff()
          && coll in ['tenders', 'registrations', 'payments', 'subscriptions', 'partners', 'files',
                      'companies', 'contacts', 'deals'];
        allow write: if canWrite(ws) && isStaff()
          && coll in ['tenders', 'registrations', 'payments', 'subscriptions', 'partners', 'files',
                      'companies', 'contacts', 'deals'];
      }
```

- [ ] **Step 5: Run the rules tests**

Run: `npm run test:rules`
Expected: all pass (59 existing + 4 new).

- [ ] **Step 6: Restart the emulators and reseed.** Start the `firebase-emulators` preview server, then run `npm run seed`.

- [ ] **Step 7: Commit**

```bash
git add firestore.rules tests/security-rules.test.mjs
git commit -m "feat(rules): staff-only companies, contacts and deals" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Data layer, SalesContext and the shared write guard

**Files:**
- Create: `src/hooks/use-write-guard.ts`, `src/contexts/SalesContext.tsx`
- Modify: `src/services/firestore.ts`, `src/contexts/DataContext.tsx` (use the hook), `src/App.tsx` (mount the provider)

**Interfaces:**
- Consumes (Task 1): `stageChange`, `newActivity`, `companyInUse`, `contactInUse`; types `Company`, `Contact`, `Deal`, `NewDeal`, `Activity`, `DealStage`, `ActivityType`.
- Produces:
  - `useWriteGuard()`, returning `guard(fn)`;
  - `useSales()`, returning `{ companies, contacts, deals, loading, companyById(id?), contactById(id?), addCompany(data) → Promise<string>, updateCompany(id, data), deleteCompany(id), addContact(data) → Promise<string>, updateContact(id, data), deleteContact(id), addDeal(data: NewDeal) → Promise<string>, updateDeal(id, data: Partial<Deal>), deleteDeal(id), moveDeal(id, to, lostReason?), logActivity(id, type, text), completeFollowUp(id), markConverted(id, kind, recordId) }`.

- [ ] **Step 1: Add the service functions** to the end of `src/services/firestore.ts`. Add `arrayUnion` to the `firebase/firestore` import, and `Company, Contact, Deal, Activity` to the `@/types` import.

```ts
// Sales: companies, contacts and deals (staff only, see firestore.rules)
export const getCompanies = async (wsId: string): Promise<Company[]> => getCollection<Company>(wsId, 'companies');
export const addCompany = async (wsId: string, data: Omit<Company, 'id'>): Promise<string> => addDocument<Company>(wsId, 'companies', data);
export const updateCompany = async (wsId: string, id: string, data: Partial<Company>): Promise<void> => updateDocument<Company>(wsId, 'companies', id, data);
export const deleteCompany = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'companies', id);

export const getContacts = async (wsId: string): Promise<Contact[]> => getCollection<Contact>(wsId, 'contacts');
export const addContact = async (wsId: string, data: Omit<Contact, 'id'>): Promise<string> => addDocument<Contact>(wsId, 'contacts', data);
export const updateContact = async (wsId: string, id: string, data: Partial<Contact>): Promise<void> => updateDocument<Contact>(wsId, 'contacts', id, data);
export const deleteContact = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'contacts', id);

export const getDeals = async (wsId: string): Promise<Deal[]> => getCollection<Deal>(wsId, 'deals');
export const addDeal = async (wsId: string, data: Omit<Deal, 'id'>): Promise<string> => addDocument<Deal>(wsId, 'deals', data);
export const updateDeal = async (wsId: string, id: string, data: Partial<Deal>): Promise<void> => updateDocument<Deal>(wsId, 'deals', id, data);
export const deleteDeal = async (wsId: string, id: string): Promise<void> => deleteDocument(wsId, 'deals', id);

/**
 * Updates a deal and appends one history entry in a single write. arrayUnion
 * is added after removeUndefined, which would otherwise walk into the
 * FieldValue object and break it.
 */
export const updateDealWithActivity = async (wsId: string, id: string, data: Partial<Deal>, activity: Activity): Promise<void> => {
  await updateDoc(wsDoc(wsId, 'deals', id), {
    ...(removeUndefined(data) as DocumentData),
    activities: arrayUnion(removeUndefined(activity)),
  });
};
```

- [ ] **Step 2: Create `src/hooks/use-write-guard.ts`**

```ts
import { useCallback } from 'react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { readOnlyMessage } from '@/lib/subscription';
import { toast } from '@/hooks/use-toast';

/**
 * Wraps a write so read-only companies (trial ended / suspended) get a clear
 * message instead of a raw permission error from Firestore.
 */
export function useWriteGuard() {
  const { access } = useWorkspace();
  return useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        if (!access.canWrite) {
          const message = readOnlyMessage(access.state);
          toast({ title: 'Read-only', description: message, variant: 'destructive' });
          throw new Error(message);
        }
        return fn(...args);
      },
    [access.canWrite, access.state],
  );
}
```

- [ ] **Step 3: Use the hook in `DataContext.tsx`.**
  - Replace the whole local `const guard = …` block (the comment "Read-only companies…" and the function) with `const guard = useWriteGuard();`.
  - Add `import { useWriteGuard } from '@/hooks/use-write-guard';`.
  - Remove the now-unused imports `readOnlyMessage` and `toast`, unless something else in the file still uses them (check with a search).
  - `access` is still destructured from `useWorkspace()`. Remove it if nothing else uses it.

- [ ] **Step 4: Create `src/contexts/SalesContext.tsx`**

```tsx
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
      setCompanies([]); setContacts([]); setDeals([]); setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const empty = (name: string) => (error: unknown) => { console.error(`Error fetching ${name}:`, error); return []; };
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
    return () => { cancelled = true; };
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
      wonAt: null, closedAt: null, lostReason: null, convertedTo: null, nextFollowUp: data.nextFollowUp ?? null,
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
    await writeWithActivity(id, { convertedTo: { kind, id: recordId } }, activity('note', kind === 'tender' ? 'Converted to a tender' : 'Project created'));
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
```

- [ ] **Step 5: Mount the provider** in `src/App.tsx`. Add `import { SalesProvider } from "@/contexts/SalesContext";`, put `<SalesProvider>` on the line after `<DataProvider>`, and put `</SalesProvider>` on the line before `</DataProvider>`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm run test:unit`
Expected: no type errors, lint 0 errors (10 existing warnings), unit tests pass.

Then open http://localhost:8080 signed in as `admin@acme.test` (password: `TEST_PASSWORD` in `scripts/seed-emulator.mjs`). The dashboard loads, the console shows no "Error fetching deals" or similar, and editing a project still works (the guard refactor).

- [ ] **Step 7: Commit**

```bash
git add src/services/firestore.ts src/hooks/use-write-guard.ts src/contexts/SalesContext.tsx src/contexts/DataContext.tsx src/App.tsx
git commit -m "feat: sales data layer and shared read-only guard" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Sidebar, routes and the Companies and Contacts screens

**Files:**
- Create: `src/components/sales/fields.tsx`, `src/components/companies/CompanyForm.tsx`, `src/components/companies/ContactForm.tsx`, `src/pages/Companies.tsx`, `src/pages/CompanyDetail.tsx`, `src/pages/Contacts.tsx`, `src/pages/ContactDetail.tsx`, `src/components/deals/StageBadge.tsx`
- Modify: `src/components/layout/Sidebar.tsx`, `src/App.tsx`

**Interfaces:**
- Consumes (Task 3): `useSales()`. From Task 1: `matchesCompany`, `formatAed`, `isOpenStage`, `stageById`.
- Produces:
  - `TextField`, `SelectField`, `useStaffOptions()`, `initials(name)` and `errorMessage(e)` from `@/components/sales/fields`;
  - `CompanyForm` with props `{open, onOpenChange, company?, onSaved?(id)}`;
  - `ContactForm` with props `{open, onOpenChange, contact?, defaultCompanyId?}`;
  - `StageBadge` with props `{stage}`;
  - the routes `/companies`, `/companies/:id`, `/contacts`, `/contacts/:id`, `/deals`, `/deals/:id` (the deal pages come in Tasks 5 and 6; until then those two routes are left out).

- [ ] **Step 1: Create `src/components/sales/fields.tsx`**

```tsx
import React from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';

/** Staff (not clients) as select options, for owners. */
export function useStaffOptions() {
  const { allUsers } = useAuth();
  return React.useMemo(
    () => allUsers.filter(u => u.role !== 'client').map(u => ({ value: u.id, label: u.name })),
    [allUsers],
  );
}

interface FieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
}

export function TextField<T extends FieldValues>({ control, name, label, placeholder, type = 'text', multiline }: FieldProps<T> & { type?: string; multiline?: boolean }) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          {multiline
            ? <Textarea rows={3} placeholder={placeholder} {...field} value={field.value ?? ''} />
            : <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ''} />}
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, placeholder, options }: FieldProps<T> & { options: { value: string; label: string }[] }) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={field.onChange} value={field.value || undefined}>
          <FormControl>
            <SelectTrigger><SelectValue placeholder={placeholder ?? 'Select'} /></SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}
```

- [ ] **Step 2: Create `src/components/deals/StageBadge.tsx`**

```tsx
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
```

- [ ] **Step 3: Create `src/components/companies/CompanyForm.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { SelectField, TextField, errorMessage, useStaffOptions } from '@/components/sales/fields';
import type { Company } from '@/types';

const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const schema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(100, 'Keep it under 100 characters'),
  industry: text(100),
  phone: text(50),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  website: text(200),
  address: text(300),
  notes: text(2000),
  ownerId: z.string().min(1, 'Choose who looks after this company'),
});
type CompanyFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
  onSaved?: (id: string) => void;
}

export const CompanyForm: React.FC<Props> = ({ open, onOpenChange, company, onSaved }) => {
  const { addCompany, updateCompany } = useSales();
  const { user } = useAuth();
  const staff = useStaffOptions();
  const form = useForm<CompanyFormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: company?.name ?? '', industry: company?.industry ?? '', phone: company?.phone ?? '',
      email: company?.email ?? '', website: company?.website ?? '', address: company?.address ?? '',
      notes: company?.notes ?? '', ownerId: company?.ownerId ?? user?.id ?? '',
    });
  }, [open, company, user?.id, form]);

  const submit = async (data: CompanyFormData) => {
    try {
      if (company) await updateCompany(company.id, data);
      else onSaved?.(await addCompany(data as Omit<Company, 'id' | 'createdAt'>));
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: company ? 'Company updated' : 'Company added', description: data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{company ? 'Edit company' : 'New company'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="name" label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="industry" label="Industry" />
              <SelectField control={form.control} name="ownerId" label="Owner" options={staff} />
              <TextField control={form.control} name="phone" label="Phone" />
              <TextField control={form.control} name="email" label="Email" type="email" />
            </div>
            <TextField control={form.control} name="website" label="Website" />
            <TextField control={form.control} name="address" label="Address" />
            <TextField control={form.control} name="notes" label="Notes" multiline />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{company ? 'Save' : 'Add company'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 4: Create `src/components/companies/ContactForm.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { useSales } from '@/contexts/SalesContext';
import { toast } from '@/hooks/use-toast';
import { SelectField, TextField, errorMessage } from '@/components/sales/fields';
import type { Contact } from '@/types';

const NO_COMPANY = 'none';
const text = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  jobTitle: text(100),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  phone: text(50),
  companyId: z.string(),
  notes: text(2000),
});
type ContactFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  defaultCompanyId?: string;
}

export const ContactForm: React.FC<Props> = ({ open, onOpenChange, contact, defaultCompanyId }) => {
  const { companies, addContact, updateContact } = useSales();
  const form = useForm<ContactFormData>({ resolver: zodResolver(schema) });
  const companyOptions = [{ value: NO_COMPANY, label: 'No company' }, ...companies.map(c => ({ value: c.id, label: c.name }))];

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: contact?.name ?? '', jobTitle: contact?.jobTitle ?? '', email: contact?.email ?? '',
      phone: contact?.phone ?? '', notes: contact?.notes ?? '',
      companyId: contact?.companyId || defaultCompanyId || NO_COMPANY,
    });
  }, [open, contact, defaultCompanyId, form]);

  const submit = async (data: ContactFormData) => {
    const record = { ...data, companyId: data.companyId === NO_COMPANY ? '' : data.companyId };
    try {
      if (contact) await updateContact(contact.id, record);
      else await addContact(record as Omit<Contact, 'id' | 'createdAt'>);
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: contact ? 'Contact updated' : 'Contact added', description: data.name });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{contact ? 'Edit contact' : 'New contact'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="name" label="Name" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="jobTitle" label="Job title" />
              <SelectField control={form.control} name="companyId" label="Company" options={companyOptions} />
              <TextField control={form.control} name="email" label="Email" type="email" />
              <TextField control={form.control} name="phone" label="Phone" />
            </div>
            <TextField control={form.control} name="notes" label="Notes" multiline />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{contact ? 'Save' : 'Add contact'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 5: Create `src/pages/Companies.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSales } from '@/contexts/SalesContext';
import { CompanyForm } from '@/components/companies/CompanyForm';
import { formatAed, isOpenStage } from '@/lib/pipeline';

const Companies: React.FC = () => {
  const { companies, contacts, deals, loading } = useSales();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.industry || '').toLowerCase().includes(q))
      .map(c => {
        const open = deals.filter(d => d.companyId === c.id && isOpenStage(d.stage));
        return {
          company: c,
          contacts: contacts.filter(k => k.companyId === c.id).length,
          openDeals: open.length,
          openValue: open.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
        };
      })
      .sort((a, b) => a.company.name.localeCompare(b.company.name));
  }, [companies, contacts, deals, search]);

  return (
    <MainLayout>
      <PageHeader
        title="Companies"
        description="The companies you sell to, their people and their deals."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New company</Button>}
      />
      <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="mb-4 w-full sm:w-72" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Company</TableHead>
              <TableHead className="hidden md:table-cell">Industry</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Open deals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                {companies.length ? 'No companies match.' : 'No companies yet. Add the first one.'}
              </TableCell></TableRow>
            )}
            {rows.map(r => (
              <TableRow key={r.company.id} className="cursor-pointer" onClick={() => navigate(`/companies/${r.company.id}`)}>
                <TableCell className="font-medium">{r.company.name}</TableCell>
                <TableCell className="hidden md:table-cell">{r.company.industry || '—'}</TableCell>
                <TableCell>{r.contacts}</TableCell>
                <TableCell>{r.openDeals ? `${r.openDeals} · ${formatAed(r.openValue)}` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CompanyForm open={formOpen} onOpenChange={setFormOpen} onSaved={id => navigate(`/companies/${id}`)} />
    </MainLayout>
  );
};

export default Companies;
```

- [ ] **Step 6: Create `src/pages/CompanyDetail.tsx`.** The "New deal" button here opens `DealForm`, which Task 5 creates. For now it shows only a link to `/deals`; Task 5, Step 9 swaps it for the form.

```tsx
import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { CompanyForm } from '@/components/companies/CompanyForm';
import { ContactForm } from '@/components/companies/ContactForm';
import { StageBadge } from '@/components/deals/StageBadge';
import { errorMessage } from '@/components/sales/fields';
import { companyInUse, formatAed, matchesCompany } from '@/lib/pipeline';
import { toast } from '@/hooks/use-toast';
import type { Contact } from '@/types';

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section className="rounded-xl border bg-card p-5">
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="font-semibold">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);
const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-sm text-muted-foreground">{children}</p>;

const CompanyDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { companyById, contacts, deals, loading, deleteCompany } = useSales();
  const { projects, tenders, payments } = useData();
  const { allUsers } = useAuth();
  const company = companyById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const earlier = useMemo(() => company ? {
    projects: projects.filter(p => matchesCompany(p, company)),
    tenders: tenders.filter(t => matchesCompany(t, company)),
    payments: payments.filter(p => matchesCompany(p, company)),
  } : { projects: [], tenders: [], payments: [] }, [company, projects, tenders, payments]);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!company) {
    return <MainLayout><p className="mb-4">This company doesn't exist (it may have been deleted).</p><Link className="text-primary underline" to="/companies">Back to companies</Link></MainLayout>;
  }

  const companyContacts = contacts.filter(c => c.companyId === company.id);
  const companyDeals = deals.filter(d => d.companyId === company.id);
  const owner = allUsers.find(u => u.id === company.ownerId)?.name;

  const askDelete = () => {
    const reason = companyInUse(company.id, deals, contacts);
    if (reason) toast({ title: "Can't delete yet", description: reason, variant: 'destructive' });
    else setConfirmDelete(true);
  };
  const doDelete = async () => {
    try {
      await deleteCompany(company.id);
      toast({ title: 'Company deleted', description: company.name });
      navigate('/companies');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const details = [
    ['Industry', company.industry], ['Phone', company.phone], ['Email', company.email],
    ['Website', company.website], ['Address', company.address], ['Owner', owner], ['Organisation ID', company.organizationId],
  ].filter(([, v]) => v);

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/companies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Companies</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={askDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>
        </div>

        <Section title="Details">
          {details.length ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {details.map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}
            </dl>
          ) : <Empty>No details yet.</Empty>}
          {company.notes && <p className="mt-3 whitespace-pre-wrap text-sm">{company.notes}</p>}
        </Section>

        <Section title={`Contacts (${companyContacts.length})`} action={
          <Button size="sm" variant="outline" onClick={() => { setEditingContact(null); setContactOpen(true); }}><Plus className="mr-1 h-4 w-4" />Add contact</Button>
        }>
          {companyContacts.length ? (
            <ul className="divide-y text-sm">
              {companyContacts.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <div>
                    <Link to={`/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <div className="text-muted-foreground">{[c.jobTitle, c.email, c.phone].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditingContact(c); setContactOpen(true); }}>Edit</Button>
                </li>
              ))}
            </ul>
          ) : <Empty>No contacts yet.</Empty>}
        </Section>

        <Section title={`Deals (${companyDeals.length})`} action={
          <Button size="sm" variant="outline" asChild><Link to="/deals">Go to deals</Link></Button>
        }>
          {companyDeals.length ? (
            <ul className="divide-y text-sm">
              {companyDeals.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <span className="flex items-center gap-2">{formatAed(d.value)} <StageBadge stage={d.stage} /></span>
                </li>
              ))}
            </ul>
          ) : <Empty>No deals yet.</Empty>}
        </Section>

        <Section title="Earlier records">
          <p className="mb-3 text-xs text-muted-foreground">Projects, tenders and payments with this company's name or organisation ID.</p>
          {earlier.projects.length + earlier.tenders.length + earlier.payments.length === 0 ? <Empty>None found.</Empty> : (
            <ul className="space-y-1 text-sm">
              {earlier.projects.map(p => <li key={p.id}>Project · <Link className="hover:underline" to={`/projects/${p.id}`}>{p.projectId ? `${p.projectId} ` : ''}{p.name}</Link></li>)}
              {earlier.tenders.map(t => <li key={t.id}>Tender · <Link className="hover:underline" to="/tenders">{t.name}</Link> ({t.status})</li>)}
              {earlier.payments.map(p => <li key={p.id}>Payment · <Link className="hover:underline" to="/payments">{p.description}</Link> · {formatAed(p.amount)} ({p.status})</li>)}
            </ul>
          )}
        </Section>
      </div>

      <CompanyForm open={editOpen} onOpenChange={setEditOpen} company={company} />
      <ContactForm open={contactOpen} onOpenChange={setContactOpen} contact={editingContact} defaultCompanyId={company.id} />
      <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete company?" description={`${company.name} will be removed from the directory.`} onConfirm={doDelete} />
    </MainLayout>
  );
};

export default CompanyDetail;
```

- [ ] **Step 7: Create `src/pages/Contacts.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSales } from '@/contexts/SalesContext';
import { ContactForm } from '@/components/companies/ContactForm';

const Contacts: React.FC = () => {
  const { contacts, companyById, loading } = useSales();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .map(c => ({ contact: c, company: companyById(c.companyId)?.name ?? '' }))
      .filter(({ contact, company }) => !q || [contact.name, contact.email, contact.jobTitle, company].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.contact.name.localeCompare(b.contact.name));
  }, [contacts, companyById, search]);

  return (
    <MainLayout>
      <PageHeader title="Contacts" description="The people you deal with."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New contact</Button>} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search contacts..." className="mb-4 w-full sm:w-72" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Job title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="hidden lg:table-cell">Phone</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{contacts.length ? 'No contacts match.' : 'No contacts yet.'}</TableCell></TableRow>
            )}
            {rows.map(({ contact, company }) => (
              <TableRow key={contact.id} className="cursor-pointer" onClick={() => navigate(`/contacts/${contact.id}`)}>
                <TableCell className="font-medium">{contact.name}</TableCell>
                <TableCell className="hidden md:table-cell">{contact.jobTitle || '—'}</TableCell>
                <TableCell>{company || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell">{contact.email || '—'}</TableCell>
                <TableCell className="hidden lg:table-cell">{contact.phone || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ContactForm open={formOpen} onOpenChange={setFormOpen} />
    </MainLayout>
  );
};

export default Contacts;
```

- [ ] **Step 8: Create `src/pages/ContactDetail.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useSales } from '@/contexts/SalesContext';
import { ContactForm } from '@/components/companies/ContactForm';
import { StageBadge } from '@/components/deals/StageBadge';
import { errorMessage } from '@/components/sales/fields';
import { contactInUse, formatAed } from '@/lib/pipeline';
import { toast } from '@/hooks/use-toast';

const ContactDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { contactById, companyById, deals, loading, deleteContact } = useSales();
  const contact = contactById(id);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!contact) {
    return <MainLayout><p className="mb-4">This contact doesn't exist (it may have been deleted).</p><Link className="text-primary underline" to="/contacts">Back to contacts</Link></MainLayout>;
  }
  const company = companyById(contact.companyId);
  const contactDeals = deals.filter(d => d.contactId === contact.id);

  const askDelete = () => {
    const reason = contactInUse(contact.id, deals);
    if (reason) toast({ title: "Can't delete yet", description: reason, variant: 'destructive' });
    else setConfirmDelete(true);
  };
  const doDelete = async () => {
    try {
      await deleteContact(contact.id);
      toast({ title: 'Contact deleted', description: contact.name });
      navigate('/contacts');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Contacts</Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <p className="text-sm text-muted-foreground">
              {contact.jobTitle}{contact.jobTitle && company ? ' at ' : ''}
              {company && <Link className="hover:underline" to={`/companies/${company.id}`}>{company.name}</Link>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={askDelete}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>
        </div>
        <section className="rounded-xl border bg-card p-5 text-sm">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Email</dt><dd>{contact.email || '—'}</dd></div>
            <div><dt className="text-muted-foreground">Phone</dt><dd>{contact.phone || '—'}</dd></div>
          </dl>
          {contact.notes && <p className="mt-3 whitespace-pre-wrap">{contact.notes}</p>}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-3 font-semibold">Deals ({contactDeals.length})</h2>
          {contactDeals.length ? (
            <ul className="divide-y text-sm">
              {contactDeals.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <span className="flex items-center gap-2">{formatAed(d.value)} <StageBadge stage={d.stage} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No deals yet.</p>}
        </section>
      </div>
      <ContactForm open={editOpen} onOpenChange={setEditOpen} contact={contact} />
      <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete contact?" description={`${contact.name} will be removed.`} onConfirm={doDelete} />
    </MainLayout>
  );
};

export default ContactDetail;
```

- [ ] **Step 9: Add the Sales group to the sidebar** (`src/components/layout/Sidebar.tsx`).
  - Add `Target`, `Building` and `Contact` to the lucide import.
  - Replace the `menuItems` array:

```ts
  const STAFF = ['admin', 'user', 'manager'];
  const menuItems: { path: string; icon: typeof LayoutDashboard; label: string; roles: string[]; group?: string }[] = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard', roles: STAFF },
    { path: '/deals', icon: Target, label: 'Deals', roles: STAFF, group: 'Sales' },
    { path: '/companies', icon: Building, label: 'Companies', roles: STAFF, group: 'Sales' },
    { path: '/contacts', icon: Contact, label: 'Contacts', roles: STAFF, group: 'Sales' },
    { path: '/projects', icon: FolderKanban, label: 'Projects', roles: ['admin', 'user', 'client', 'manager'] },
    { path: '/tenders', icon: FileText, label: 'Tenders', roles: STAFF },
    { path: '/registrations', icon: ClipboardList, label: 'Registrations', roles: STAFF },
    { path: '/files', icon: Files, label: 'Files', roles: STAFF },
    { path: '/payments', icon: CreditCard, label: 'Payments & Subscriptions', roles: STAFF },
    { path: '/partners', icon: Handshake, label: 'Partners', roles: STAFF },
    { path: '/employees', icon: Users, label: 'Employees', roles: ['admin', 'manager'] },
    { path: '/settings', icon: Settings, label: 'Settings', roles: STAFF },
  ];
```

  - In `visibleItems.map((item) => {`, change the signature to `(item, i)`. Return a fragment that puts a heading before the first item of a group, and a divider right after the group ends:

```tsx
        {visibleItems.map((item, i) => {
          const Icon = item.icon;
          const prevGroup = visibleItems[i - 1]?.group;
          const startsGroup = item.group && item.group !== prevGroup;
          const endsGroup = !item.group && prevGroup;
          return (
            <React.Fragment key={item.path}>
              {startsGroup && <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{item.group}</p>}
              {endsGroup && <div className="mx-3 my-2 border-t border-sidebar-border" />}
              <Link
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                  isActive(item.path)
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </React.Fragment>
          );
        })}
```

  (The Platform item added by `visibleItems` has no `group` and comes after Settings, so it gets no heading.)

- [ ] **Step 10: Add the routes** in `src/App.tsx`. Add the lazy imports next to the others:

```tsx
const Companies = lazy(() => import("./pages/Companies"));
const CompanyDetail = lazy(() => import("./pages/CompanyDetail"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactDetail = lazy(() => import("./pages/ContactDetail"));
```

  Then add these routes just before the `/tenders` route:

```tsx
              {/* Sales (staff only) */}
              <Route path="/companies" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Companies /></ProtectedRoute>} />
              <Route path="/companies/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><CompanyDetail /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Contacts /></ProtectedRoute>} />
              <Route path="/contacts/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><ContactDetail /></ProtectedRoute>} />
```

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: no type errors; lint 0 errors.

In the browser, signed in as `admin@acme.test`:
- the sidebar shows the Sales heading with Deals, Companies and Contacts (Deals is a 404 until Task 5);
- add the company "Test Co"; you land on its page;
- add a contact there; it shows under Contacts and on /contacts;
- Delete the company: blocked with "1 contact uses this company.";
- delete the contact, then delete the company: it works.

Signed in as `client@gulf.test`: no Sales items, and `/companies` redirects away.

- [ ] **Step 12: Commit**

```bash
git add src/components/sales src/components/companies src/components/deals/StageBadge.tsx src/pages/Companies.tsx src/pages/CompanyDetail.tsx src/pages/Contacts.tsx src/pages/ContactDetail.tsx src/components/layout/Sidebar.tsx src/App.tsx
git commit -m "feat: companies and contacts directory with a Sales sidebar group" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Deals page (board, list, filters, new deal)

**Files:**
- Create: `src/components/deals/MoveToMenu.tsx`, `LostReasonDialog.tsx`, `useStageMove.tsx`, `DealCard.tsx`, `DealBoard.tsx`, `DealList.tsx`, `DealForm.tsx`, `src/components/companies/CompanyPicker.tsx`, `src/pages/Deals.tsx`
- Modify: `src/App.tsx` (route `/deals`), `src/pages/CompanyDetail.tsx` (New deal button)

**Interfaces:**
- Consumes:
  - `useSales()` (`moveDeal`, `addDeal`, `updateDeal`, `addCompany`);
  - from Task 1: `stageTotals`, `pipelineTotals`, `sortDeals`, `isFollowUpOverdue`, `localDate`, `formatAed`, `STAGES`, `OPEN_STAGES`;
  - from Task 4: `StageBadge`, `TextField`, `SelectField`, `useStaffOptions`, `initials`, `errorMessage`.
- Produces:
  - `useStageMove()`, returning `{ requestMove(deal, to), dialog }`;
  - `MoveToMenu` with props `{deal, onMove(to), disabled?, label?}`;
  - `DealForm` with props `{open, onOpenChange, deal?, defaultCompanyId?, onSaved?(id)}`;
  - `LostReasonDialog` with props `{open, onOpenChange, dealTitle, onConfirm(reason): Promise<void>}`.

- [ ] **Step 1: Create `src/components/deals/MoveToMenu.tsx`**

```tsx
import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { STAGES, type DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deal: Deal;
  onMove: (to: DealStage) => void;
  disabled?: boolean;
  /** Text on the button; icon-only when omitted. */
  label?: string;
}

/** Keyboard- and phone-friendly alternative to dragging a card. */
export const MoveToMenu: React.FC<Props> = ({ deal, onMove, disabled, label }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="sm" variant={label ? 'outline' : 'ghost'} disabled={disabled} aria-label={`Move ${deal.title} to another stage`}
        onClick={e => e.stopPropagation()}>
        <ArrowRightLeft className={label ? 'mr-2 h-4 w-4' : 'h-4 w-4'} />{label}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
      <DropdownMenuLabel>Move to</DropdownMenuLabel>
      {STAGES.filter(s => s.id !== deal.stage).map(s => (
        <DropdownMenuItem key={s.id} onClick={() => onMove(s.id)}>{s.label}</DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);
```

- [ ] **Step 2: Create `src/components/deals/LostReasonDialog.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealTitle: string;
  onConfirm: (reason: string) => Promise<void>;
}

export const LostReasonDialog: React.FC<Props> = ({ open, onOpenChange, dealTitle, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) setReason(''); }, [open]);
  const valid = reason.trim().length >= 3;

  const confirm = async () => {
    setSaving(true);
    try { await onConfirm(reason.trim()); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as lost</DialogTitle>
          <DialogDescription>{dealTitle}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="lost-reason">Why was it lost?</Label>
          <Textarea id="lost-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Lost on price to a local contractor" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!valid || saving} onClick={confirm}>Mark as lost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 3: Create `src/components/deals/useStageMove.tsx`**

```tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';
import { useSales } from '@/contexts/SalesContext';
import { stageById, type DealStage } from '@/config/pipeline';
import { errorMessage } from '@/components/sales/fields';
import { LostReasonDialog } from './LostReasonDialog';
import type { Deal } from '@/types';

/**
 * One way to move a deal, shared by the board, the list and the deal page:
 * Lost asks for a reason first; Won offers "Create project".
 */
export function useStageMove() {
  const { moveDeal } = useSales();
  const navigate = useNavigate();
  const [lostFor, setLostFor] = useState<Deal | null>(null);

  const run = async (deal: Deal, to: DealStage, reason?: string) => {
    try {
      await moveDeal(deal.id, to, reason);
    } catch (e) {
      toast({ title: 'Not moved', description: errorMessage(e), variant: 'destructive' });
      return false;
    }
    if (to === 'won' && deal.convertedTo?.kind !== 'project') {
      toast({
        title: 'Deal won',
        description: deal.title,
        action: <ToastAction altText="Create project" onClick={() => navigate(`/deals/${deal.id}?convert=project`)}>Create project</ToastAction>,
      });
    } else {
      toast({ title: `Moved to ${stageById(to)?.label ?? to}`, description: deal.title });
    }
    return true;
  };

  const requestMove = (deal: Deal, to: DealStage) => {
    if (deal.stage === to) return;
    if (to === 'lost') setLostFor(deal);
    else void run(deal, to);
  };

  const dialog = (
    <LostReasonDialog
      open={!!lostFor}
      onOpenChange={open => { if (!open) setLostFor(null); }}
      dealTitle={lostFor?.title ?? ''}
      onConfirm={async reason => { if (lostFor && await run(lostFor, 'lost', reason)) setLostFor(null); }}
    />
  );

  return { requestMove, dialog };
}
```

- [ ] **Step 4: Create `src/components/deals/DealCard.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAed, isFollowUpOverdue } from '@/lib/pipeline';
import { MoveToMenu } from './MoveToMenu';
import type { DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deal: Deal;
  companyName: string;
  ownerInitials: string;
  ownerName: string;
  today: string;
  canWrite: boolean;
  onMove: (to: DealStage) => void;
}

export const DealCard: React.FC<Props> = ({ deal, companyName, ownerInitials, ownerName, today, canWrite, onMove }) => {
  const overdue = isFollowUpOverdue(deal, today);
  return (
    <div
      draggable={canWrite}
      onDragStart={e => { e.dataTransfer.setData('text/plain', deal.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={cn('rounded-lg border bg-background p-3 shadow-sm', canWrite && 'cursor-grab active:cursor-grabbing')}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to={`/deals/${deal.id}`} className="font-medium leading-snug hover:underline">{deal.title}</Link>
        <MoveToMenu deal={deal} onMove={onMove} disabled={!canWrite} />
      </div>
      <p className="truncate text-sm text-muted-foreground">{companyName}</p>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="font-semibold">{formatAed(deal.value)}</span>
        <span title={ownerName} className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">{ownerInitials}</span>
      </div>
      {deal.nextFollowUp?.date && (
        <p className={cn('mt-2 flex items-center gap-1 text-xs', overdue ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          <CalendarClock className="h-3.5 w-3.5" />{overdue ? 'Overdue · ' : ''}{deal.nextFollowUp.date}
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 5: Create `src/components/deals/DealBoard.tsx`**

```tsx
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { STAGES, type DealStage } from '@/config/pipeline';
import { formatAed, stageTotals } from '@/lib/pipeline';
import { DealCard } from './DealCard';
import type { Deal } from '@/types';

interface Props {
  deals: Deal[];
  today: string;
  canWrite: boolean;
  companyName: (id: string) => string;
  owner: (id: string) => { name: string; initials: string };
  onMove: (deal: Deal, to: DealStage) => void;
}

export const DealBoard: React.FC<Props> = ({ deals, today, canWrite, companyName, owner, onMove }) => {
  const [over, setOver] = useState<DealStage | null>(null);
  const totals = stageTotals(deals);

  const drop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    setOver(null);
    const deal = deals.find(d => d.id === e.dataTransfer.getData('text/plain'));
    if (deal) onMove(deal, stage);
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGES.map(stage => (
        <div
          key={stage.id}
          onDragOver={e => { if (canWrite) { e.preventDefault(); setOver(stage.id); } }}
          onDragLeave={() => setOver(o => (o === stage.id ? null : o))}
          onDrop={e => drop(e, stage.id)}
          className={cn('flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 p-3', over === stage.id && 'ring-2 ring-primary')}
        >
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{stage.label}</h3>
              <span className="text-xs text-muted-foreground">{Math.round(stage.winChance * 100)}%</span>
            </div>
            <p className="text-xs text-muted-foreground">{totals[stage.id].count} · {formatAed(totals[stage.id].value)}</p>
          </div>
          <div className="flex min-h-24 flex-col gap-2">
            {deals.filter(d => d.stage === stage.id).map(d => {
              const o = owner(d.ownerId);
              return (
                <DealCard key={d.id} deal={d} companyName={companyName(d.companyId)} ownerName={o.name} ownerInitials={o.initials}
                  today={today} canWrite={canWrite} onMove={to => onMove(d, to)} />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 6: Create `src/components/deals/DealList.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatAed, isFollowUpOverdue } from '@/lib/pipeline';
import { StageBadge } from './StageBadge';
import { MoveToMenu } from './MoveToMenu';
import type { DealStage } from '@/config/pipeline';
import type { Deal } from '@/types';

interface Props {
  deals: Deal[];
  today: string;
  canWrite: boolean;
  companyName: (id: string) => string;
  ownerName: (id: string) => string;
  onMove: (deal: Deal, to: DealStage) => void;
}

export const DealList: React.FC<Props> = ({ deals, today, canWrite, companyName, ownerName, onMove }) => (
  <div className="overflow-x-auto rounded-xl border bg-card">
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          <TableHead>Deal</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead className="hidden md:table-cell">Expected close</TableHead>
          <TableHead className="hidden md:table-cell">Follow-up</TableHead>
          <TableHead className="hidden lg:table-cell">Owner</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.length === 0 && <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No deals match.</TableCell></TableRow>}
        {deals.map(d => (
          <TableRow key={d.id}>
            <TableCell>
              <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
              <div className="text-xs text-muted-foreground">{companyName(d.companyId)}</div>
            </TableCell>
            <TableCell><StageBadge stage={d.stage} /></TableCell>
            <TableCell className="text-right">{formatAed(d.value)}</TableCell>
            <TableCell className="hidden md:table-cell">{d.expectedCloseDate || '—'}</TableCell>
            <TableCell className={cn('hidden md:table-cell', isFollowUpOverdue(d, today) && 'font-medium text-destructive')}>{d.nextFollowUp?.date || '—'}</TableCell>
            <TableCell className="hidden lg:table-cell">{ownerName(d.ownerId)}</TableCell>
            <TableCell><MoveToMenu deal={d} onMove={to => onMove(d, to)} disabled={!canWrite} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
```

- [ ] **Step 7: Create `src/components/companies/CompanyPicker.tsx`**

```tsx
import React from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import { useSales } from '@/contexts/SalesContext';
import { SelectField, TextField } from '@/components/sales/fields';

export const NEW_COMPANY = '__new__';

/** Company select with a "+ New company" option that reveals a name box. */
export function CompanyPicker<T extends FieldValues>({ control }: { control: Control<T> }) {
  const { companies } = useSales();
  const companyId = useWatch({ control, name: 'companyId' as Path<T> });
  const options = [
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name })),
    { value: NEW_COMPANY, label: '+ New company' },
  ];
  return (
    <>
      <SelectField control={control} name={'companyId' as Path<T>} label="Company" placeholder="Choose a company" options={options} />
      {companyId === NEW_COMPANY && <TextField control={control} name={'newCompanyName' as Path<T>} label="New company name" />}
    </>
  );
}
```

- [ ] **Step 8: Create `src/components/deals/DealForm.tsx`**

```tsx
import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { DivisionField } from '@/components/divisions/DivisionField';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { CompanyPicker, NEW_COMPANY } from '@/components/companies/CompanyPicker';
import { SelectField, TextField, errorMessage, useStaffOptions } from '@/components/sales/fields';
import { OPEN_STAGES, stageById } from '@/config/pipeline';
import type { Deal, NewDeal } from '@/types';

const NO_CONTACT = 'none';
const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  value: z.coerce.number({ invalid_type_error: 'Enter an amount' }).min(0, 'Value can’t be negative'),
  stage: z.enum(['lead', 'qualified', 'proposal', 'negotiation']),
  companyId: z.string().min(1, 'Choose a company'),
  newCompanyName: z.string().trim().max(100).optional(),
  contactId: z.string(),
  ownerId: z.string().min(1, 'Choose an owner'),
  divisionId: z.string().optional(),
  expectedCloseDate: z.string().optional(),
  source: z.string().trim().max(100).optional(),
}).superRefine((d, ctx) => {
  if (d.companyId === NEW_COMPANY && !d.newCompanyName?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['newCompanyName'], message: 'Enter the company name' });
  }
});
type DealFormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal?: Deal | null;
  defaultCompanyId?: string;
  onSaved?: (id: string) => void;
}

export const DealForm: React.FC<Props> = ({ open, onOpenChange, deal, defaultCompanyId, onSaved }) => {
  const { contacts, addDeal, updateDeal, addCompany } = useSales();
  const { user } = useAuth();
  const { divisions } = useWorkspace();
  const staff = useStaffOptions();
  // A string, not the divisions array, so the reset effect below doesn't re-run on every render.
  const defaultDivisionId = divisions[0]?.id ?? '';
  const form = useForm<DealFormData>({ resolver: zodResolver(schema) });
  const companyId = useWatch({ control: form.control, name: 'companyId' });
  const contactOptions = [
    { value: NO_CONTACT, label: 'No contact' },
    ...contacts.filter(c => c.companyId && c.companyId === companyId).map(c => ({ value: c.id, label: c.name })),
  ];

  useEffect(() => {
    if (!open) return;
    form.reset({
      title: deal?.title ?? '', value: deal?.value ?? 0,
      stage: deal && OPEN_STAGES.includes(deal.stage) ? (deal.stage as DealFormData['stage']) : 'lead',
      companyId: deal?.companyId ?? defaultCompanyId ?? '', newCompanyName: '',
      contactId: deal?.contactId || NO_CONTACT, ownerId: deal?.ownerId ?? user?.id ?? '',
      divisionId: deal?.divisionId || defaultDivisionId, expectedCloseDate: deal?.expectedCloseDate ?? '',
      source: deal?.source ?? '',
    });
  }, [open, deal, defaultCompanyId, user?.id, defaultDivisionId, form]);

  // A contact from another company makes no sense; clear it when the company changes.
  useEffect(() => {
    const current = form.getValues('contactId');
    if (current !== NO_CONTACT && !contacts.some(c => c.id === current && c.companyId === companyId)) {
      form.setValue('contactId', NO_CONTACT);
    }
  }, [companyId, contacts, form]);

  const submit = async (data: DealFormData) => {
    try {
      let company = data.companyId;
      if (company === NEW_COMPANY) {
        company = await addCompany({ name: data.newCompanyName!.trim(), ownerId: data.ownerId });
      }
      const fields = {
        title: data.title, value: data.value, companyId: company,
        contactId: data.contactId === NO_CONTACT ? '' : data.contactId,
        ownerId: data.ownerId, divisionId: data.divisionId || '', expectedCloseDate: data.expectedCloseDate || '',
        source: data.source || '',
      };
      if (deal) await updateDeal(deal.id, fields);
      else onSaved?.(await addDeal({ ...fields, stage: data.stage } as NewDeal));
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
      return;
    }
    toast({ title: deal ? 'Deal updated' : 'Deal created', description: data.title });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{deal ? 'Edit deal' : 'New deal'}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <TextField control={form.control} name="title" label="Title" placeholder="e.g. Chiller plant retrofit" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="value" label="Value (AED)" type="number" />
              {!deal && (
                <SelectField control={form.control} name="stage" label="Stage"
                  options={OPEN_STAGES.map(s => ({ value: s, label: stageById(s)!.label }))} />
              )}
            </div>
            <CompanyPicker control={form.control} />
            <SelectField control={form.control} name="contactId" label="Contact" options={contactOptions} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField control={form.control} name="expectedCloseDate" label="Expected close" type="date" />
              <SelectField control={form.control} name="ownerId" label="Owner" options={staff} />
              <TextField control={form.control} name="source" label="Source" placeholder="e.g. Referral" />
              <DivisionField control={form.control} name="divisionId" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>{deal ? 'Save' : 'Create deal'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
```

- [ ] **Step 9: Create `src/pages/Deals.tsx`**

```tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleDollarSign, Plus, Scale, Trophy } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import StatCard from '@/components/ui/StatCard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { DealBoard } from '@/components/deals/DealBoard';
import { DealList } from '@/components/deals/DealList';
import { DealForm } from '@/components/deals/DealForm';
import { useStageMove } from '@/components/deals/useStageMove';
import { initials } from '@/components/sales/fields';
import { formatAed, localDate, pipelineTotals, sortDeals, type DealSortKey } from '@/lib/pipeline';

const Deals: React.FC = () => {
  const { deals, companyById, loading } = useSales();
  const { allUsers } = useAuth();
  const { divisions, access } = useWorkspace();
  const navigate = useNavigate();
  const { requestMove, dialog } = useStageMove();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [ownerId, setOwnerId] = useState('all');
  const [divisionId, setDivisionId] = useState('all');
  const [sortKey, setSortKey] = useState<DealSortKey>('value');
  const [formOpen, setFormOpen] = useState(false);

  const now = new Date();
  const today = localDate(now);
  const companyName = (id: string) => companyById(id)?.name ?? 'Unknown company';
  const ownerName = (id: string) => allUsers.find(u => u.id === id)?.name ?? '—';
  const owner = (id: string) => { const name = ownerName(id); return { name, initials: initials(name === '—' ? '' : name) }; };
  const staff = allUsers.filter(u => u.role !== 'client');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter(d =>
      (ownerId === 'all' || d.ownerId === ownerId)
      && (divisionId === 'all' || d.divisionId === divisionId)
      && (!q || d.title.toLowerCase().includes(q) || (companyById(d.companyId)?.name ?? '').toLowerCase().includes(q)));
  }, [deals, search, ownerId, divisionId, companyById]);

  const totals = pipelineTotals(deals, now);

  return (
    <MainLayout>
      <PageHeader title="Deals" description="Your sales pipeline, from first lead to won work."
        action={<Button onClick={() => setFormOpen(true)}><Plus className="mr-2 h-4 w-4" />New deal</Button>} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Open pipeline" value={formatAed(totals.openValue)} icon={CircleDollarSign} />
        <StatCard title="Weighted value" value={formatAed(totals.weightedValue)} icon={Scale} />
        <StatCard title="Won this month" value={formatAed(totals.wonThisMonth)} icon={Trophy} />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs value={view} onValueChange={v => setView(v as 'board' | 'list')}>
          <TabsList><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="list">List</TabsTrigger></TabsList>
        </Tabs>
        <SearchInput value={search} onChange={setSearch} placeholder="Search deals or companies..." className="w-full lg:w-64" />
        <Select value={ownerId} onValueChange={setOwnerId}>
          <SelectTrigger className="lg:w-44" aria-label="Filter by owner"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All owners</SelectItem>
            {staff.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {divisions.length > 0 && (
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className="lg:w-44" aria-label="Filter by division"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All divisions</SelectItem>
              {divisions.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {view === 'list' && (
          <Select value={sortKey} onValueChange={v => setSortKey(v as DealSortKey)}>
            <SelectTrigger className="lg:w-48" aria-label="Sort deals"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="value">Sort by value</SelectItem>
              <SelectItem value="close">Sort by expected close</SelectItem>
              <SelectItem value="followUp">Sort by follow-up</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? <p className="text-muted-foreground">Loading…</p> : deals.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">No deals yet. Create the first one.</div>
      ) : view === 'board' ? (
        <DealBoard deals={filtered} today={today} canWrite={access.canWrite} companyName={companyName} owner={owner} onMove={requestMove} />
      ) : (
        <DealList deals={sortDeals(filtered, sortKey)} today={today} canWrite={access.canWrite} companyName={companyName} ownerName={ownerName} onMove={requestMove} />
      )}

      {dialog}
      <DealForm open={formOpen} onOpenChange={setFormOpen} onSaved={id => navigate(`/deals/${id}`)} />
    </MainLayout>
  );
};

export default Deals;
```

- [ ] **Step 10: Add the route and the New deal button.**
  - In `src/App.tsx`, add `const Deals = lazy(() => import("./pages/Deals"));` and, next to the other Sales routes:

```tsx
              <Route path="/deals" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><Deals /></ProtectedRoute>} />
```

  - In `src/pages/CompanyDetail.tsx`:
    - add `import { DealForm } from '@/components/deals/DealForm';` and the state `const [dealOpen, setDealOpen] = useState(false);`;
    - replace the "Go to deals" button with:

```tsx
          <Button size="sm" variant="outline" onClick={() => setDealOpen(true)}><Plus className="mr-1 h-4 w-4" />New deal</Button>
```

    - next to the other dialogs at the bottom, add `<DealForm open={dealOpen} onOpenChange={setDealOpen} defaultCompanyId={company.id} onSaved={id => navigate(`/deals/${id}`)} />`.

- [ ] **Step 11: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: no type errors; lint 0 errors.

In the browser as `admin@acme.test`:
- **Create a deal** with "+ New company": the company is created and you land on `/deals/:id` (a 404 until Task 6, which is expected). Go back to `/deals`.
- **Board:** the card is in Lead; the summary bar includes it in the open pipeline and in the weighted value (10%).
- **Drag** it to Proposal: a toast appears and the column totals change.
- **"Move to…" → Lost:** the dialog needs at least 3 characters.
- **"Move to…" → Won:** the toast offers "Create project".
- **List view:** sorting works; the owner and division filters work.

As `admin@falcon.test` (read-only), cards can't be dragged and "Move to…" is disabled.

- [ ] **Step 12: Commit**

```bash
git add src/components/deals src/components/companies/CompanyPicker.tsx src/pages/Deals.tsx src/pages/CompanyDetail.tsx src/App.tsx
git commit -m "feat: deals board and list with stage moves and a new-deal form" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Deal page (history, follow-up, convert to tender or project)

**Files:**
- Create: `src/components/deals/ActivityTimeline.tsx`, `src/components/deals/FollowUpBox.tsx`, `src/pages/DealDetail.tsx`
- Modify: `src/components/forms/TenderForm.tsx`, `src/components/forms/ProjectForm.tsx` (`prefill` prop), `src/App.tsx` (route `/deals/:id`)

**Interfaces:**
- Consumes:
  - from `useSales()`: `logActivity`, `completeFollowUp`, `updateDeal`, `deleteDeal`, `moveDeal`, `markConverted`;
  - from `useData()`: `addTender` and `addProject`, both returning `Promise<string>` (check that `handleAddTender` and `handleAddProject` in DataContext return the new id);
  - from Task 5: `useStageMove`, `MoveToMenu`, `DealForm`, `StageBadge`.
- Produces: `TenderForm` and `ProjectForm` accept `prefill?: Partial<TenderFormData>` / `Partial<ProjectFormData>`, applied when creating (not editing).

- [ ] **Step 1: Add `prefill` to `TenderForm.tsx`.**
  - Add `prefill?: Partial<TenderFormData>;` to `TenderFormProps`.
  - Add `prefill,` to the destructured props.
  - In the `useEffect`, change the `else` branch's `form.reset({...})` so its object ends with `...prefill,` after `portal: '',`.
  - Change the effect's dependency list to `[tender, form, defaultDivisionId, prefill, open]`, so the form resets each time it opens.

- [ ] **Step 2: Do the same in `ProjectForm.tsx`.**
  - Add `prefill?: Partial<ProjectFormData>;` to `ProjectFormProps`.
  - Add `prefill,` to the destructured props.
  - End the `else` branch's reset object with `...prefill,` after `budget: 0,`.
  - Change the dependency list to `[project, form, defaultDivisionId, prefill, open]`.

- [ ] **Step 3: Create `src/components/deals/ActivityTimeline.tsx`**

```tsx
import React, { useState } from 'react';
import { CalendarDays, GitCommitHorizontal, Mail, MessageSquare, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSales } from '@/contexts/SalesContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { ACTIVITY_LABELS, type ActivityType } from '@/config/pipeline';
import { sortActivities } from '@/lib/pipeline';
import { errorMessage } from '@/components/sales/fields';
import type { Activity, Deal } from '@/types';

const ICONS: Record<Activity['type'], React.ElementType> = {
  note: MessageSquare, call: Phone, meeting: CalendarDays, email: Mail, stage: GitCommitHorizontal,
};

export const ActivityTimeline: React.FC<{ deal: Deal; canWrite: boolean }> = ({ deal, canWrite }) => {
  const { logActivity } = useSales();
  const { allUsers } = useAuth();
  const [type, setType] = useState<ActivityType>('note');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    try {
      await logActivity(deal.id, type, text);
      setText('');
    } catch (e) {
      toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">History</h2>
      {canWrite && (
        <div className="mb-5 space-y-2">
          <div className="flex gap-2">
            <Select value={type} onValueChange={v => setType(v as ActivityType)}>
              <SelectTrigger className="w-36" aria-label="Kind of entry"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ACTIVITY_LABELS) as ActivityType[]).map(t => <SelectItem key={t} value={t}>{ACTIVITY_LABELS[t]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={add} disabled={saving || !text.trim()}>Add</Button>
          </div>
          <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="What happened?" aria-label="History entry" />
        </div>
      )}
      <ol className="space-y-4">
        {sortActivities(deal.activities).map(a => {
          const Icon = ICONS[a.type] ?? MessageSquare;
          return (
            <li key={a.id} className="flex gap-3 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="whitespace-pre-wrap">{a.text}</p>
                <p className="text-xs text-muted-foreground">
                  {a.type === 'stage' ? 'Stage' : ACTIVITY_LABELS[a.type]} · {allUsers.find(u => u.id === a.byId)?.name ?? 'Someone'} · {new Date(a.at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
```

- [ ] **Step 4: Create `src/components/deals/FollowUpBox.tsx`**

```tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSales } from '@/contexts/SalesContext';
import { toast } from '@/hooks/use-toast';
import { isFollowUpOverdue, localDate } from '@/lib/pipeline';
import { errorMessage } from '@/components/sales/fields';
import type { Deal } from '@/types';

export const FollowUpBox: React.FC<{ deal: Deal; canWrite: boolean }> = ({ deal, canWrite }) => {
  const { updateDeal, completeFollowUp } = useSales();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const follow = deal.nextFollowUp;
  const overdue = isFollowUpOverdue(deal, localDate(new Date()));

  const startEdit = () => { setDate(follow?.date ?? ''); setNote(follow?.note ?? ''); setEditing(true); };
  const act = async (fn: () => Promise<void>, done: string) => {
    setSaving(true);
    try { await fn(); toast({ title: done, description: deal.title }); setEditing(false); }
    catch (e) { toast({ title: 'Not saved', description: errorMessage(e), variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="mb-3 font-semibold">Next follow-up</h2>
      {editing ? (
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="fu-date">Date</Label><Input id="fu-date" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="fu-note">What to do</Label><Input id="fu-note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Call about the revised quote" /></div>
          <div className="flex gap-2">
            <Button disabled={saving || !date} onClick={() => act(() => updateDeal(deal.id, { nextFollowUp: { date, note: note.trim() } }), 'Follow-up saved')}>Save</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : follow?.date ? (
        <div className="space-y-3">
          <p className={cn('text-sm', overdue && 'font-medium text-destructive')}>{overdue ? 'Overdue · ' : ''}{follow.date}{follow.note ? ` — ${follow.note}` : ''}</p>
          {canWrite && (
            <div className="flex gap-2">
              <Button size="sm" disabled={saving} onClick={() => act(() => completeFollowUp(deal.id), 'Follow-up done')}>Done</Button>
              <Button size="sm" variant="outline" onClick={startEdit}>Reschedule</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">No follow-up planned.</p>
          {canWrite && <Button size="sm" variant="outline" onClick={startEdit}>Plan a follow-up</Button>}
        </div>
      )}
    </section>
  );
};
```

- [ ] **Step 5: Create `src/pages/DealDetail.tsx`**

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, FolderKanban, Pencil, Trash2, Trophy, XCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import TenderForm, { type TenderFormData } from '@/components/forms/TenderForm';
import ProjectForm, { type ProjectFormData } from '@/components/forms/ProjectForm';
import { useSales } from '@/contexts/SalesContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { toast } from '@/hooks/use-toast';
import { StageBadge } from '@/components/deals/StageBadge';
import { MoveToMenu } from '@/components/deals/MoveToMenu';
import { DealForm } from '@/components/deals/DealForm';
import { ActivityTimeline } from '@/components/deals/ActivityTimeline';
import { FollowUpBox } from '@/components/deals/FollowUpBox';
import { useStageMove } from '@/components/deals/useStageMove';
import { errorMessage } from '@/components/sales/fields';
import { formatAed } from '@/lib/pipeline';
import type { Project, Tender } from '@/types';

const DealDetail: React.FC = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { deals, loading, companyById, contactById, deleteDeal, moveDeal, markConverted } = useSales();
  const { addTender, addProject, projects, tenders } = useData();
  const { allUsers } = useAuth();
  const { access } = useWorkspace();
  const { requestMove, dialog } = useStageMove();
  const [editOpen, setEditOpen] = useState(false);
  const [tenderOpen, setTenderOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deal = deals.find(d => d.id === id);
  const company = companyById(deal?.companyId);
  const contact = contactById(deal?.contactId);

  // Memoised so the forms don't reset on every render.
  const tenderPrefill = useMemo<Partial<TenderFormData> | undefined>(() => deal && ({
    name: deal.title, company: company?.name ?? '', divisionId: deal.divisionId || undefined, assignedTo: deal.ownerId,
  }), [deal?.id, deal?.title, deal?.divisionId, deal?.ownerId, company?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const projectPrefill = useMemo<Partial<ProjectFormData> | undefined>(() => deal && ({
    name: deal.title, company: company?.name ?? '', divisionId: deal.divisionId || undefined, assignedTo: deal.ownerId, budget: deal.value,
  }), [deal?.id, deal?.title, deal?.divisionId, deal?.ownerId, deal?.value, company?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Create project" from the Won toast lands here with ?convert=project.
  useEffect(() => {
    if (params.get('convert') === 'project' && deal && deal.convertedTo?.kind !== 'project') {
      setProjectOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, deal, setParams]);

  if (loading) return <MainLayout><p className="text-muted-foreground">Loading…</p></MainLayout>;
  if (!deal) {
    return <MainLayout><p className="mb-4">This deal doesn't exist (it may have been deleted).</p><Link className="text-primary underline" to="/deals">Back to deals</Link></MainLayout>;
  }

  const ownerName = allUsers.find(u => u.id === deal.ownerId)?.name ?? '—';
  const client = (clientId?: string) => {
    const cid = clientId && clientId !== 'none' ? clientId : '';
    const user = allUsers.find(u => u.id === cid);
    return { clientId: cid, clientName: user?.name || '', organizationId: user?.organizationId || company?.organizationId || '' };
  };
  const assigneeName = (uid: string) => allUsers.find(u => u.id === uid)?.name || '';

  // The record is saved first; if linking the deal then fails, say so without
  // throwing, so the form doesn't offer to save a second copy.
  const link = async (kind: 'tender' | 'project', recordId: string) => {
    try {
      if (kind === 'project' && deal.stage !== 'won') await moveDeal(deal.id, 'won');
      await markConverted(deal.id, kind, recordId);
    } catch (e) {
      toast({ title: `${kind === 'tender' ? 'Tender' : 'Project'} saved, but the deal wasn't updated`, description: errorMessage(e), variant: 'destructive' });
    }
  };
  const submitTender = async (data: TenderFormData) => {
    const recordId = await addTender({
      ...data, ...client(data.clientId), assignedToName: assigneeName(data.assignedTo),
      companyId: deal.companyId, dealId: deal.id, description: `From deal: ${deal.title}`,
    } as Omit<Tender, 'id'>);
    await link('tender', recordId);
  };
  const submitProject = async (data: ProjectFormData) => {
    const recordId = await addProject({
      ...data, ...client(data.clientId), assignedToName: assigneeName(data.assignedTo),
      companyId: deal.companyId, dealId: deal.id, description: `From deal: ${deal.title}`,
    } as Omit<Project, 'id'>);
    await link('project', recordId);
  };

  const doDelete = async () => {
    try {
      await deleteDeal(deal.id);
      toast({ title: 'Deal deleted', description: deal.title });
      navigate('/deals');
    } catch (e) {
      toast({ title: 'Not deleted', description: errorMessage(e), variant: 'destructive' });
    }
  };

  const converted = deal.convertedTo;
  const convertedName = converted?.kind === 'project'
    ? projects.find(p => p.id === converted.id)?.name
    : tenders.find(t => t.id === converted?.id)?.name;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 pb-10">
        <Link to="/deals" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Deals</Link>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{deal.title}</h1>
            <StageBadge stage={deal.stage} />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{formatAed(deal.value)}</span>
            {' · '}{company ? <Link className="hover:underline" to={`/companies/${company.id}`}>{company.name}</Link> : 'Unknown company'}
            {contact && <>{' · '}<Link className="hover:underline" to={`/contacts/${contact.id}`}>{contact.name}</Link></>}
            {' · Owner: '}{ownerName}
            {deal.expectedCloseDate && ` · Expected close ${deal.expectedCloseDate}`}
            {deal.source && ` · Source: ${deal.source}`}
          </p>
          {deal.stage === 'lost' && deal.lostReason && <p className="text-sm text-destructive">Lost: {deal.lostReason}</p>}

          <div className="flex flex-wrap gap-2">
            <MoveToMenu deal={deal} onMove={to => requestMove(deal, to)} disabled={!access.canWrite} label="Move stage" />
            {deal.stage !== 'won' && <Button variant="outline" onClick={() => requestMove(deal, 'won')} disabled={!access.canWrite}><Trophy className="mr-2 h-4 w-4" />Mark won</Button>}
            {deal.stage !== 'lost' && <Button variant="outline" onClick={() => requestMove(deal, 'lost')} disabled={!access.canWrite}><XCircle className="mr-2 h-4 w-4" />Mark lost</Button>}
            {!converted && <Button variant="outline" onClick={() => setTenderOpen(true)}><FileText className="mr-2 h-4 w-4" />Convert to tender</Button>}
            {converted?.kind !== 'project' && <Button variant="outline" onClick={() => setProjectOpen(true)}><FolderKanban className="mr-2 h-4 w-4" />Create project</Button>}
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="outline" onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
          </div>

          {converted && (
            <p className="text-sm">
              {converted.kind === 'project' ? 'Project: ' : 'Tender: '}
              <Link className="text-primary hover:underline" to={converted.kind === 'project' ? `/projects/${converted.id}` : '/tenders'}>
                {convertedName ?? 'open'}
              </Link>
            </p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1"><FollowUpBox deal={deal} canWrite={access.canWrite} /></div>
          <div className="lg:col-span-2"><ActivityTimeline deal={deal} canWrite={access.canWrite} /></div>
        </div>
      </div>

      {dialog}
      <DealForm open={editOpen} onOpenChange={setEditOpen} deal={deal} />
      <TenderForm open={tenderOpen} onOpenChange={setTenderOpen} prefill={tenderPrefill} onSubmit={submitTender} />
      <ProjectForm open={projectOpen} onOpenChange={setProjectOpen} prefill={projectPrefill} onSubmit={submitProject} />
      <DeleteConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete deal?" description={`${deal.title} and its history will be removed.`} onConfirm={doDelete} />
    </MainLayout>
  );
};

export default DealDetail;
```

- [ ] **Step 6: Add the route.** In `src/App.tsx`, add `const DealDetail = lazy(() => import("./pages/DealDetail"));` and:

```tsx
              <Route path="/deals/:id" element={<ProtectedRoute allowedRoles={['admin', 'user', 'manager']}><DealDetail /></ProtectedRoute>} />
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: no type errors; lint 0 errors. Remove any `eslint-disable-line` comment that lint reports as unused.

In the browser as `admin@acme.test`, on a deal:
- add a note and a call; they appear newest first with your name;
- plan a follow-up for yesterday: it shows "Overdue" in red; Done clears it and logs "Follow-up done: …";
- Mark lost (reason required): the stage shows Lost with the reason; then use "Move stage" → Proposal: the reason is gone and history shows both moves;
- Convert to tender: the form opens pre-filled (name, company, division, assignee); save; the deal shows "Tender: …" and the button is hidden; on `/tenders` the tender exists;
- Create project: pre-filled with the budget equal to the deal value; save; the deal is Won and links to the project, and `/projects/:id` opens;
- on a different deal, drag it to Won on the board and click "Create project" in the toast: the project form opens on the deal page;
- Tenders and Projects pages: "New" still opens empty forms, and Edit still fills in the record.

- [ ] **Step 8: Commit**

```bash
git add src/components/deals/ActivityTimeline.tsx src/components/deals/FollowUpBox.tsx src/pages/DealDetail.tsx src/components/forms/TenderForm.tsx src/components/forms/ProjectForm.tsx src/App.tsx
git commit -m "feat: deal page with history, follow-ups and conversion to tender or project" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Dashboard cards and assistant answers

**Files:**
- Create: `src/lib/salesChat.ts`, `tests/unit/salesChat.test.mjs`, `src/components/dashboard/FollowUpsCard.tsx`, `src/components/dashboard/PipelineCard.tsx`
- Modify: `package.json` (`test:unit`), `src/services/crmChatEngine.ts`, `src/components/AIChatbotWidget.tsx`, `src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes (Task 1): `dueFollowUps`, `pipelineTotals`, `formatAed`, `localDate`, `STAGES`, `isOpenStage`.
- Produces: `answerSalesQuestion(q: string, data: { deals: Deal[]; companies: Company[] }, now: Date): string | null`. `CrmData` gains `deals?` and `companies?`.

- [ ] **Step 1: Write the failing test** `tests/unit/salesChat.test.mjs`, and add it to `test:unit` in `package.json` after `pipeline.test.mjs`.

```js
// Unit tests for the assistant's sales answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerSalesQuestion } from '../../src/lib/salesChat.ts';

const now = new Date(2026, 10, 6, 10, 0);
const data = {
  companies: [{ id: 'c1', name: 'Gulf Facilities LLC' }, { id: 'c2', name: 'Harbor Logistics' }],
  deals: [
    { id: 'd1', title: 'Chiller retrofit', companyId: 'c1', value: 40000, stage: 'proposal', nextFollowUp: { date: '2026-11-05', note: 'Call Omar' } },
    { id: 'd2', title: 'CCTV upgrade', companyId: 'c2', value: 10000, stage: 'lead', nextFollowUp: null },
    { id: 'd3', title: 'Old win', companyId: 'c1', value: 5000, stage: 'won', wonAt: new Date(2026, 10, 1) },
  ],
};

test('leaves non-sales questions to the main engine', () => {
  assert.equal(answerSalesQuestion('how many tenders are running', data, now), null);
});

test('follow-ups due', () => {
  assert.match(answerSalesQuestion('follow-ups today', data, now), /Follow-ups due \(1\)[\s\S]*Chiller retrofit[\s\S]*Call Omar/);
  assert.match(answerSalesQuestion('any overdue follow ups?', { ...data, deals: [] }, now), /No follow-ups are due/);
});

test('deals by stage, by company, and open deals', () => {
  assert.match(answerSalesQuestion('deals in proposal', data, now), /Deals in Proposal \(1\)[\s\S]*Chiller retrofit/);
  assert.match(answerSalesQuestion('show deals for harbor logistics', data, now), /Deals for Harbor Logistics \(1\)[\s\S]*CCTV upgrade/);
  assert.match(answerSalesQuestion('list my deals', data, now), /Open deals \(2\)/);
  assert.match(answerSalesQuestion('deals in negotiation', data, now), /No deals in Negotiation/);
});

test('pipeline value', () => {
  assert.match(answerSalesQuestion('pipeline value', data, now), /2 open deals worth AED 50,000 \(weighted AED 21,000\)\. Won this month: AED 5,000 from 1 deal\./);
});
```

- [ ] **Step 2: Run to make sure it fails**

Run: `npm run test:unit`
Expected: FAIL. `src/lib/salesChat.ts` not found.

- [ ] **Step 3: Create `src/lib/salesChat.ts`**

```ts
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
    return `Pipeline: ${t.openCount} open deal${t.openCount === 1 ? '' : 's'} worth ${formatAed(t.openValue)} (weighted ${formatAed(t.weightedValue)}). `
      + `Won this month: ${formatAed(t.wonThisMonth)} from ${t.wonThisMonthCount} deal${t.wonThisMonthCount === 1 ? '' : 's'}.`;
  }

  let list = data.deals;
  const parts: string[] = [];
  if (stage) { list = list.filter(d => d.stage === stage.id); parts.push(`in ${stage.label}`); }
  if (company) { list = list.filter(d => d.companyId === company.id); parts.push(`for ${company.name}`); }
  const heading = parts.length ? `Deals ${parts.join(' ')}` : 'Open deals';
  if (!parts.length) list = list.filter(d => isOpenStage(d.stage));

  if (!list.length) return `No deals ${parts.length ? parts.join(' ') : 'are open'}.`;
  return `${heading} (${list.length}):\n` + list.slice(0, LIMIT)
    .map(d => `• ${d.title} — ${nameOf(d.companyId)} · ${formatAed(d.value)} · ${stageById(d.stage)?.label ?? d.stage}`)
    .join('\n');
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:unit`
Expected: all pass.

- [ ] **Step 5: Hook it into the engine** (`src/services/crmChatEngine.ts`).
  - Add `Deal` and `Company` to the type import.
  - Add `import { answerSalesQuestion } from '@/lib/salesChat';`.
  - Add these two fields to `CrmData`:

```ts
  /** Sales pipeline (staff only); omitted when not loaded. */
  deals?: Deal[];
  companies?: Company[];
```

  - In `answerCrmQuestion`, directly after `const sections = buildSections(data);`, insert:

```ts
  if (data.deals) {
    const sales = answerSalesQuestion(q, { deals: data.deals, companies: data.companies ?? [] }, new Date());
    if (sales) return sales;
  }
```

  - In `HELP_TEXT`, add the line `• "Pipeline value", "deals in proposal" or "follow-ups today"` after `• "Registrations expiring soon"`.

- [ ] **Step 6: Pass the data in** `src/components/AIChatbotWidget.tsx`.
  - Add `import { useSales } from '@/contexts/SalesContext';` and `const sales = useSales();` next to the existing `crm` hook.
  - Add `deals: sales.deals, companies: sales.companies,` to the `crmData` object.

- [ ] **Step 7: Create `src/components/dashboard/FollowUpsCard.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSales } from '@/contexts/SalesContext';
import { dueFollowUps, isFollowUpOverdue, localDate } from '@/lib/pipeline';

export const FollowUpsCard: React.FC = () => {
  const { deals, companyById } = useSales();
  const today = localDate(new Date());
  const due = dueFollowUps(deals, today);
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Follow-ups due</h2>
        <CalendarClock className="h-5 w-5 text-primary" />
      </div>
      {due.length === 0 ? <p className="py-6 text-center text-sm italic text-muted-foreground">Nothing due. You're up to date.</p> : (
        <ul className="space-y-3">
          {due.slice(0, 6).map(d => (
            <li key={d.id} className="rounded-lg bg-muted/50 p-3 text-sm">
              <Link to={`/deals/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
              <span className="text-muted-foreground"> · {companyById(d.companyId)?.name ?? 'Unknown company'}</span>
              <p className={cn('text-xs', isFollowUpOverdue(d, today) ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {d.nextFollowUp!.date}{d.nextFollowUp!.note ? ` — ${d.nextFollowUp!.note}` : ''}
              </p>
            </li>
          ))}
          {due.length > 6 && <li className="text-sm"><Link className="text-primary hover:underline" to="/deals">and {due.length - 6} more</Link></li>}
        </ul>
      )}
    </div>
  );
};
```

- [ ] **Step 8: Create `src/components/dashboard/PipelineCard.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { useSales } from '@/contexts/SalesContext';
import { formatAed, pipelineTotals } from '@/lib/pipeline';

export const PipelineCard: React.FC = () => {
  const { deals } = useSales();
  const t = pipelineTotals(deals, new Date());
  const rows = [
    ['Open pipeline', `${formatAed(t.openValue)} · ${t.openCount} deal${t.openCount === 1 ? '' : 's'}`],
    ['Weighted value', formatAed(t.weightedValue)],
    ['Won this month', `${formatAed(t.wonThisMonth)} · ${t.wonThisMonthCount} deal${t.wonThisMonthCount === 1 ? '' : 's'}`],
  ];
  return (
    <div className="rounded-xl border bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pipeline</h2>
        <Target className="h-5 w-5 text-primary" />
      </div>
      <dl className="space-y-3 text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
      <Link to="/deals" className="mt-4 inline-block text-sm text-primary hover:underline">Open the deals board</Link>
    </div>
  );
};
```

- [ ] **Step 9: Show the cards** in `src/pages/Dashboard.tsx`. Add the imports `import { FollowUpsCard } from '@/components/dashboard/FollowUpsCard';` and `import { PipelineCard } from '@/components/dashboard/PipelineCard';`. Directly before the `{isLoading ? (` block that renders `<ProjectStatusChart />`, insert:

```tsx
      {!isLoading && !isClient && (
        <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FollowUpsCard />
          <PipelineCard />
        </div>
      )}
```

- [ ] **Step 10: Verify**

Run: `npm run test:unit && npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: all green.

In the browser as `admin@acme.test`:
- the Dashboard shows both cards;
- the assistant answers "pipeline value", "deals in proposal" and "follow-ups today", and still answers "how many tenders are running" as before.

As `client@gulf.test`, the Dashboard shows neither card.

- [ ] **Step 11: Commit**

```bash
git add src/lib/salesChat.ts tests/unit/salesChat.test.mjs package.json src/services/crmChatEngine.ts src/components/AIChatbotWidget.tsx src/components/dashboard src/pages/Dashboard.tsx
git commit -m "feat: follow-ups and pipeline on the dashboard; assistant answers sales questions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Client invites reuse a directory company's organisation ID

**Files:**
- Modify: `src/components/settings/TeamInvites.tsx`

**Interfaces:**
- Consumes: `useSales()` (`companies`, `updateCompany`), `sameName` from `@/lib/pipeline`.

- [ ] **Step 1: Use the directory.**
  - Add the imports `import { useSales } from '@/contexts/SalesContext';` and `import { sameName } from '@/lib/pipeline';`.
  - Inside the component, add `const { companies, updateCompany } = useSales();`.
  - Replace `organizationIdFor` with:

```tsx
  // Everyone from one client company shares an organisation id, including
  // people invited but not joined yet, and the company's directory entry.
  const directoryCompany = (clientName: string) => companies.find(c => sameName(c.name, clientName));
  const organizationIdFor = (clientName: string) => {
    const fromDirectory = directoryCompany(clientName)?.organizationId;
    if (fromDirectory) return fromDirectory;
    const people = [...allUsers, ...invites];
    const known = people.find(p => p.role === 'client' && p.organizationId && sameName(p.company, clientName));
    return known?.organizationId
      || nextOrganizationId(clientName, [...people.map(p => p.organizationId), ...companies.map(c => c.organizationId)]);
  };
```

- [ ] **Step 2: Save a new organisation ID on the directory company.** In `submit`, right after `setLastLink(inviteLink(invite.id));`, add:

```tsx
      const entry = role === 'client' ? directoryCompany(company) : undefined;
      if (entry && !entry.organizationId && invite.organizationId) {
        // Not fatal: the invite already works; the directory just won't show the id yet.
        updateCompany(entry.id, { organizationId: invite.organizationId }).catch(err => console.error('Saving organisation id:', err));
      }
```

- [ ] **Step 3: Suggest directory companies.**
  - Give the client company input the attribute `list="directory-companies"`.
  - Right after that input, add:

```tsx
              <datalist id="directory-companies">
                {companies.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: green.

In the browser as `admin@acme.test`, Settings → Team:
- choose the role Client and type "Pal": "Palm Hospitality Group" is suggested;
- choose it: the organisation ID shown is a new `ORG-PH-…`;
- create the invite: the company page now shows that organisation ID;
- type "Gulf Facilities LLC": it shows `ORG-GF-001`.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/TeamInvites.tsx
git commit -m "feat: client invites reuse a directory company's organisation id" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Demo data, docs and a full check

**Files:**
- Modify: `scripts/seed-emulator.mjs`, `README.md`, `TODO.md`

- [ ] **Step 1: Add the seed helpers** after `putProjects` in `scripts/seed-emulator.mjs`:

```js
// Sales: companies, contacts and deals. History entries use ISO times.
async function putSales(ws, person, { companies, contacts, deals }) {
  for (const { id, who, ...c } of companies) {
    await putIn(ws, 'companies', id, { ...c, ownerId: person[who].id, createdAt: ago(120) });
  }
  for (const { id, ...k } of contacts) {
    await putIn(ws, 'contacts', id, { ...k, createdAt: ago(90) });
  }
  for (const { id, who, activities = [], ...d } of deals) {
    await putIn(ws, 'deals', id, {
      nextFollowUp: null, lostReason: null, wonAt: null, closedAt: null, convertedTo: null, contactId: '', divisionId: '', source: '',
      ...d,
      ownerId: person[who].id,
      activities: activities.map(([aid, type, text, daysAgo, by]) => ({ id: aid, type, text, at: ago(daysAgo).toISOString(), byId: person[by ?? who].id })),
      createdAt: ago(Math.max(...activities.map(a => a[3]), 1)),
    });
  }
}
```

- [ ] **Step 2: Acme sales data.**
  - In `seedAcme`, add `companyId: 'co-desert', dealId: 'dl-6'` to the `prj-2` entry.
  - After the partners loop, before `return person;`, add:

```js
  await putSales(ws, person, {
    companies: [
      { id: 'co-gulf', name: 'Gulf Facilities LLC', industry: 'Facilities management', phone: '+971 4 123 4567', email: 'info@gulffacilities.test', organizationId: 'ORG-GF-001', who: 'manager' },
      { id: 'co-desert', name: 'Desert Solar FZE', industry: 'Renewable energy', email: 'hello@desertsolar.test', organizationId: 'ORG-DS-001', who: 'manager' },
      { id: 'co-gtc', name: 'Gulf Trading Co.', industry: 'Trading', who: 'employee2' },
      { id: 'co-dha', name: 'Dubai Health Authority', industry: 'Healthcare', who: 'employee2' },
      { id: 'co-sharjah', name: 'Sharjah Municipality', industry: 'Government', who: 'manager' },
      { id: 'co-palm', name: 'Palm Hospitality Group', industry: 'Hospitality', website: 'palmhospitality.test', who: 'admin' },
    ],
    contacts: [
      { id: 'k-1', name: 'Hassan Ali', jobTitle: 'Facilities Director', email: 'hassan@gulffacilities.test', phone: '+971 50 900 1001', companyId: 'co-gulf' },
      { id: 'k-2', name: 'Mira Thomas', jobTitle: 'Procurement Lead', email: 'mira@gulffacilities.test', companyId: 'co-gulf' },
      { id: 'k-3', name: 'Faisal Noor', jobTitle: 'Project Director', email: 'faisal@desertsolar.test', companyId: 'co-desert' },
      { id: 'k-4', name: 'Anita Rao', jobTitle: 'IT Manager', email: 'anita@gtc.test', companyId: 'co-gtc' },
      { id: 'k-5', name: 'Dr. Salem Obaid', jobTitle: 'Head of Infrastructure', companyId: 'co-dha' },
      { id: 'k-6', name: 'Rashid Al Suwaidi', jobTitle: 'Lighting Engineer', companyId: 'co-sharjah' },
      { id: 'k-7', name: 'Claire Dubois', jobTitle: 'Group Engineering Manager', email: 'claire@palmhospitality.test', companyId: 'co-palm' },
      { id: 'k-8', name: 'Tariq Hamdan', jobTitle: 'Independent consultant', phone: '+971 55 900 1008' },
    ],
    deals: [
      { id: 'dl-1', title: 'Chiller plant retrofit', companyId: 'co-gulf', contactId: 'k-1', value: 185000, stage: 'proposal', divisionId: BLD, source: 'Existing client', expectedCloseDate: day(30), who: 'manager',
        nextFollowUp: { date: day(-2), note: 'Call Hassan about the revised quote' },
        activities: [['a1', 'stage', 'Created in Lead', 40], ['a2', 'meeting', 'Site walk-through with Hassan; two chillers past end of life.', 32], ['a3', 'stage', 'Moved to Proposal', 10], ['a4', 'email', 'Sent proposal v1.', 9]] },
      { id: 'dl-2', title: 'Solar carport extension', companyId: 'co-desert', contactId: 'k-3', value: 240000, stage: 'negotiation', divisionId: ENG, source: 'Existing client', expectedCloseDate: day(14), who: 'manager',
        nextFollowUp: { date: day(0), note: 'Send the final price' },
        activities: [['a1', 'stage', 'Created in Qualified', 50], ['a2', 'stage', 'Moved to Negotiation', 6], ['a3', 'call', 'Faisal asked for 5% off for a 3-year O&M bundle.', 2]] },
      { id: 'dl-3', title: 'BMS service contract', companyId: 'co-gulf', contactId: 'k-2', value: 60000, stage: 'qualified', divisionId: BLD, source: 'Existing client', expectedCloseDate: day(45), who: 'employee2',
        nextFollowUp: { date: day(5), note: 'Share service levels' },
        activities: [['a1', 'stage', 'Created in Lead', 20], ['a2', 'stage', 'Moved to Qualified', 8]] },
      { id: 'dl-4', title: 'ERP phase 2', companyId: 'co-gtc', contactId: 'k-4', value: 95000, stage: 'lead', divisionId: BLD, source: 'Referral', who: 'employee2',
        nextFollowUp: { date: day(-1), note: 'Book a discovery call with Anita' },
        activities: [['a1', 'stage', 'Created in Lead', 7]] },
      { id: 'dl-5', title: 'Clinic network cabling', companyId: 'co-dha', contactId: 'k-5', value: 120000, stage: 'lead', divisionId: BLD, source: 'Tender portal', who: 'employee2',
        activities: [['a1', 'stage', 'Created in Lead', 3], ['a2', 'note', 'Watch Dubai eSupply for the RFQ.', 3]] },
      { id: 'dl-6', title: 'Rooftop solar phase 2', companyId: 'co-desert', contactId: 'k-3', value: 310000, stage: 'won', divisionId: ENG, source: 'Existing client', who: 'manager',
        wonAt: ago(40), closedAt: ago(40), convertedTo: { kind: 'project', id: 'prj-2' },
        activities: [['a1', 'stage', 'Created in Proposal', 70], ['a2', 'stage', 'Moved to Won', 40], ['a3', 'note', 'Project created', 40]] },
      { id: 'dl-7', title: 'Hotel energy audit', companyId: 'co-palm', contactId: 'k-7', value: 35000, stage: 'won', divisionId: ENG, source: 'Website', who: 'admin',
        wonAt: ago(2), closedAt: ago(2),
        activities: [['a1', 'stage', 'Created in Lead', 25], ['a2', 'stage', 'Moved to Won', 2]] },
      { id: 'dl-8', title: 'Street lighting phase 2', companyId: 'co-sharjah', contactId: 'k-6', value: 150000, stage: 'lost', divisionId: ENG, source: 'Tender portal', who: 'manager',
        closedAt: ago(10), lostReason: 'Lost on price to a local contractor',
        activities: [['a1', 'stage', 'Created in Proposal', 45], ['a2', 'stage', 'Moved to Lost: Lost on price to a local contractor', 10]] },
    ],
  });
```

- [ ] **Step 3: Noor and Falcon sales data.**
  - In `seedNoor`, before `return person;`:

```js
  await putSales(ws, person, {
    companies: [
      { id: 'co-harbor', name: 'Harbor Logistics LLC', industry: 'Logistics', organizationId: 'ORG-HL-001', who: 'admin' },
      { id: 'co-lagoon', name: 'Blue Lagoon Hotels', industry: 'Hospitality', who: 'admin' },
    ],
    contacts: [
      { id: 'k-1', name: 'Joseph Mathai', jobTitle: 'Warehouse Manager', companyId: 'co-harbor' },
      { id: 'k-2', name: 'Sara Haddad', jobTitle: 'Projects Manager', companyId: 'co-lagoon' },
    ],
    deals: [
      { id: 'dl-1', title: 'Cold store fire alarm', companyId: 'co-harbor', contactId: 'k-1', value: 48000, stage: 'proposal', who: 'admin',
        nextFollowUp: { date: day(-1), note: 'Chase the signed quote' }, activities: [['a1', 'stage', 'Created in Lead', 12], ['a2', 'stage', 'Moved to Proposal', 4]] },
      { id: 'dl-2', title: 'Lobby lighting upgrade', companyId: 'co-lagoon', contactId: 'k-2', value: 22000, stage: 'lead', who: 'employee',
        activities: [['a1', 'stage', 'Created in Lead', 2]] },
      { id: 'dl-3', title: 'Port lighting maintenance', companyId: 'co-harbor', value: 36000, stage: 'negotiation', who: 'admin',
        nextFollowUp: { date: day(3), note: 'Agree visit frequency' }, activities: [['a1', 'stage', 'Created in Qualified', 15], ['a2', 'stage', 'Moved to Negotiation', 5]] },
    ],
  });
```

  - In `seedFalcon`, before `return person;`:

```js
  await putSales(ws, person, {
    companies: [{ id: 'co-private', name: 'Private Client', who: 'admin' }],
    contacts: [],
    deals: [
      { id: 'dl-1', title: 'Garden annex', companyId: 'co-private', value: 60000, stage: 'qualified', who: 'admin',
        activities: [['a1', 'stage', 'Created in Lead', 30], ['a2', 'stage', 'Moved to Qualified', 20]] },
    ],
  });
```

  - Update the header comment at the top: say each company also has sample companies, contacts and deals.

- [ ] **Step 4: Reseed and check the data loads**

Run: `npm run seed`
Expected: it finishes with no errors and prints the logins as before.

- [ ] **Step 5: Update the docs.**
  - In `README.md`, add a section after "Sign-up, plans and invites":

```markdown
## Sales: deals, companies and contacts

Staff see a **Sales** group in the sidebar.

- **Deals** is the pipeline: Lead → Qualified → Proposal → Negotiation → Won / Lost.
  - Win chances are 10 / 25 / 50 / 75 / 100 / 0 %, giving the weighted value. They're set in `src/config/pipeline.ts`.
  - Drag cards between columns, or use "Move to…". Lost asks for a reason.
  - Each deal has a history (notes, calls, meetings, emails and stage changes) and one next follow-up.
- **Converting:** "Convert to tender" or "Create project" opens the usual form, pre-filled. The deal then links to the record it became.
- **Companies:** each company page lists its contacts and deals. It also lists earlier projects, tenders and payments whose company name or organisation ID matches.
- **Deleting** a company or contact is blocked while deals use it.
- **Rules:** the pipeline rules are pure functions in `src/lib/pipeline.ts`, unit-tested in `tests/unit/pipeline.test.mjs`.
- **Access:** clients can't see any of it (see `firestore.rules`).
```

  - In the README command table, change the `test:unit` description to "Unit tests for the pure helpers (numbering, divisions, theme, plans and trials, pipeline, assistant sales answers)".
  - In `TODO.md`, delete the line `- [ ] Contacts, companies and a deals pipeline.`.

- [ ] **Step 6: Full check**

Run, in this order:
- `npm run test:unit` (expect everything to pass);
- `npx tsc --noEmit -p tsconfig.app.json` (no errors);
- `npm run lint` (0 errors);
- `npm run build` (succeeds);
- stop the emulators, run `npm run test:rules` (all pass), restart the emulators and run `npm run seed`.

- [ ] **Step 7: Browser run-through on the emulators** (follow the spec's Testing section):
  1. As `admin@acme.test`:
     - the Dashboard shows 3 follow-ups due: Chiller (overdue), ERP (overdue) and Solar carport (today);
     - the Pipeline card shows open AED 700,000, weighted AED 309,000 and won this month AED 35,000 (AED 0 if the seed ran on the 1st or 2nd of the month, because `ago(2)` falls in the previous month).
  2. Deals board: every column is populated; drag "BMS service contract" to Proposal; use "Move to…" on another card.
  3. On "ERP phase 2": add a call note; mark the follow-up done.
  4. Mark "Clinic network cabling" lost (the reason is required), then reopen it to Lead.
  5. Mark "BMS service contract" won → "Create project" from the toast → save. The deal links to the project and back (the project has `dealId`).
  6. Convert "Chiller plant retrofit" to a tender: it appears on `/tenders`.
  7. The Gulf Facilities LLC company page shows its contacts, deals and earlier records (Smart Building Automation, Network Upgrade, two payments).
  8. As `client@gulf.test`: no Sales pages, and `/deals` redirects. As `admin@falcon.test`: deals are visible, but dragging and "Move to…" are disabled, and saving shows the read-only toast.
  9. Assistant: "pipeline value" and "follow-ups today".

  Then run `npm run seed` again to restore clean demo data.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed-emulator.mjs README.md TODO.md
git commit -m "feat(seed): sample companies, contacts and deals; docs for sales" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:**
  - data model: Task 1;
  - access: Task 2;
  - sidebar and routes: Tasks 4, 5 and 6;
  - Deals board, list, filters, summary, new deal and "+ New company": Task 5;
  - deal page actions, follow-up, history, conversion and reopening: Task 6;
  - Companies and Contacts with blocked deletes and earlier records: Task 4;
  - Dashboard and assistant: Task 7;
  - client invites: Task 8;
  - error handling: forms in Tasks 4 to 6, read-only in Tasks 3 and 5, "Unknown company" in Tasks 5 to 7;
  - tests: Tasks 1, 2 and 7, plus the run-through in Task 9;
  - demo data: Task 9.
- **Expected numbers in Task 9, Step 7.** The open deals are:
  - dl-1: 185,000 × 0.5 = 92,500;
  - dl-2: 240,000 × 0.75 = 180,000;
  - dl-3: 60,000 × 0.25 = 15,000;
  - dl-4: 95,000 × 0.1 = 9,500;
  - dl-5: 120,000 × 0.1 = 12,000.

  So the open total is 700,000 and the weighted value is 309,000.
- **Effect dependencies:** form reset effects depend only on stable values (ids, strings, records from context), never on arrays rebuilt every render. The conversion prefills are memoised.
