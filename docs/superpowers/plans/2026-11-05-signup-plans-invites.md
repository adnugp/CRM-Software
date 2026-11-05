# Company Sign-up, Plans, Invites and Super Admin: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new company signs up on its own with a plan and a 14-day trial, its admin
invites staff and clients by one-time link, and the product owner manages every
company from a Platform page.

**Architecture:** No backend. Sign-up and invite-accept are single batched writes from
the browser; `firestore.rules` checks each batch as a whole with `getAfter()`/`existsAfter()`.
The workspace document gains plan fields (`status`, `plan`, `staffLimit`, `staffCount`,
`trialEndsAt`); a `writable(ws)` rule makes expired/suspended companies read-only, and
`staffCount` enforces the staff limit. `/platformOwners/{uid}` (script-only) marks the
super admin.

**Tech Stack:** React 18, TypeScript (strict off), Vite 7, shadcn/ui, react-hook-form +
zod, Firebase JS SDK 12, Firestore/Storage rules, `@firebase/rules-unit-testing` v5,
`node --test` (Node 24 runs `.ts` files that have no imports directly).

**Spec:** `docs/superpowers/specs/2026-11-05-signup-plans-invites-design.md`

## Global Constraints

- Branch `redesign`. Local emulators only (project `demo-crm`). **Never deploy, never run `npm run dev:live`.**
- Windows: files are CRLF; PowerShell blocks `firebase.ps1`, so use npm scripts / `npx firebase`.
- `npm run test:rules` starts its own emulators on the same ports: stop the running
  emulators first (preview server `firebase-emulators`, or Ctrl+C on `npm run emulators`), restart after.
- Every task ends with: `npx tsc --noEmit -p tsconfig.app.json` clean, `npm run lint` 0 errors
  (the 10 existing fast-refresh warnings are expected), relevant tests green, one commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Plans (placeholders): `starter` 5 staff "AED 99 / month", `team` 20 "AED 299 / month",
  `business` 50 "AED 599 / month"; Enterprise = "Contact us". `TRIAL_DAYS = 14`, `INVITE_DAYS = 7`.
- **Staff** = roles `admin`, `manager`, `user`. Clients never count toward the limit.
- `staffLimit: 0` means unlimited. A workspace with no `status` is treated as `active`.
- Emails are stored lowercase everywhere (profiles, invites, workspace contact).
- Product owner = `mohamedismayil@gptechnologies.ae`, marked by `"platformOwner": true` in
  `scripts/local-accounts.json` (git-ignored).

## File map

| File | Change | Responsibility |
|---|---|---|
| `src/config/plans.ts` | create | Plans, trial/invite lengths, sales email |
| `src/config/roles.ts` | create | Role display labels |
| `src/lib/subscription.ts` | create | Pure: staff roles, access state, seats, invite state, labels |
| `tests/unit/subscription.test.mjs` | create | Unit tests for the two files above |
| `firestore.rules` | rewrite | Sign-up, invites, read-only, staff counter, super admin |
| `storage.rules` | modify | Uploads need a writable workspace |
| `tests/security-rules.test.mjs` | modify | New and updated rules tests |
| `scripts/seed-emulator.mjs`, `scripts/local-accounts.mjs`, `scripts/local-accounts.example.json` | modify | Plan fields, Falcon (expired), a pending invite, platform owner |
| `src/types/index.ts` | modify | Workspace plan fields, `Invite`, `User.inviteId` |
| `src/services/firestore.ts` | modify | `toWorkspace()` (shared converter) |
| `src/services/signup.ts`, `src/services/invites.ts`, `src/services/platform.ts` | create | Firestore writes for each flow |
| `src/contexts/AuthContext.tsx` | modify | `signUpCompany`, `joinWithInvite`, `isOwner`, counter-aware `removeUser`; drop `addUser` |
| `src/contexts/WorkspaceContext.tsx` | modify | `access`, `reloadWorkspace` |
| `src/contexts/DataContext.tsx` | modify | Block writes when read-only |
| `src/components/subscription/ReadOnlyBanner.tsx` | create | Banner shown when read-only |
| `src/components/brand/PublicShell.tsx` | create | Layout for signed-out pages |
| `src/pages/Signup.tsx`, `src/pages/Join.tsx`, `src/pages/Platform.tsx` | create | New screens |
| `src/components/settings/TeamInvites.tsx` | create | Invite form + invites list |
| `src/pages/Settings.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/MainLayout.tsx`, `src/pages/Login.tsx`, `src/App.tsx` | modify | Wire it all in |
| `src/pages/Register.tsx` | delete | Replaced by invites |
| `README.md`, `TODO.md` | modify | Docs |

---

### Task 1: Plans config and subscription helpers

**Files:**
- Create: `src/config/plans.ts`, `src/config/roles.ts`, `src/lib/subscription.ts`
- Test: `tests/unit/subscription.test.mjs`
- Modify: `package.json` (`test:unit` script)

**Interfaces:**
- Produces (`src/config/plans.ts`): `type PlanId = 'starter'|'team'|'business'`, `interface Plan {id,name,staffLimit,priceLabel,blurb}`, `PLANS: Plan[]`, `planById(id?: string): Plan | undefined`, `TRIAL_DAYS = 14`, `INVITE_DAYS = 7`, `SALES_EMAIL`.
- Produces (`src/config/roles.ts`): `ROLE_LABELS: Record<UserRole, string>`.
- Produces (`src/lib/subscription.ts`): `DAY_MS`, `isStaffRole(role?)`, `addDays(from, days)`, `type WorkspaceStatus`, `type AccessState = 'active'|'trial'|'trial-ended'|'suspended'`, `interface BillingFields`, `interface WorkspaceAccess {state, canWrite, daysLeft}`, `workspaceAccess(ws, now)`, `staffSeatsLeft(ws, pendingStaffInvites): number|null`, `type InviteStatus`, `type InviteState`, `inviteState(invite, now)`, `accessLabel(access)`, `readOnlyMessage(state)`, `extendedTrialEnd(current, now, days)`.

- [ ] **Step 1: Write the failing tests** — `tests/unit/subscription.test.mjs`

```js
// Unit tests for plans and trial/seat/invite helpers. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaffRole, addDays, workspaceAccess, staffSeatsLeft, inviteState,
  accessLabel, readOnlyMessage, extendedTrialEnd,
} from '../../src/lib/subscription.ts';
import { PLANS, planById, TRIAL_DAYS, INVITE_DAYS } from '../../src/config/plans.ts';

const now = new Date('2026-11-05T10:00:00Z');

test('admins, managers and employees use staff places; clients do not', () => {
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('manager'), true);
  assert.equal(isStaffRole('user'), true);
  assert.equal(isStaffRole('client'), false);
  assert.equal(isStaffRole(undefined), false);
});

test('a company with no status is active (older companies)', () => {
  assert.deepEqual(workspaceAccess({}, now), { state: 'active', canWrite: true, daysLeft: null });
  assert.deepEqual(workspaceAccess(null, now), { state: 'active', canWrite: true, daysLeft: null });
});

test('a running trial can write and reports whole days left, rounded up', () => {
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: addDays(now, 9) }, now),
    { state: 'trial', canWrite: true, daysLeft: 9 });
  assert.equal(workspaceAccess({ status: 'trial', trialEndsAt: new Date(now.getTime() + 60_000) }, now).daysLeft, 1);
});

test('an ended trial, or one with no end date, is read-only', () => {
  const ended = { state: 'trial-ended', canWrite: false, daysLeft: 0 };
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: now }, now), ended);
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: addDays(now, -3) }, now), ended);
  assert.deepEqual(workspaceAccess({ status: 'trial' }, now), ended);
});

test('a suspended company is read-only', () => {
  assert.deepEqual(workspaceAccess({ status: 'suspended' }, now), { state: 'suspended', canWrite: false, daysLeft: null });
});

test('staff places left count members and pending staff invites; limit 0 = unlimited', () => {
  assert.equal(staffSeatsLeft({ staffLimit: 5, staffCount: 3 }, 1), 1);
  assert.equal(staffSeatsLeft({ staffLimit: 5, staffCount: 5 }, 2), 0);
  assert.equal(staffSeatsLeft({ staffLimit: 0, staffCount: 40 }, 3), null);
  assert.equal(staffSeatsLeft(null, 0), null);
});

test('a pending invite past its expiry shows as expired', () => {
  assert.equal(inviteState({ status: 'pending', expiresAt: addDays(now, 1) }, now), 'pending');
  assert.equal(inviteState({ status: 'pending', expiresAt: addDays(now, -1) }, now), 'expired');
  assert.equal(inviteState({ status: 'accepted', expiresAt: addDays(now, -1) }, now), 'accepted');
  assert.equal(inviteState({ status: 'revoked', expiresAt: addDays(now, 1) }, now), 'revoked');
});

test('labels for the plan status', () => {
  assert.equal(accessLabel({ state: 'active', canWrite: true, daysLeft: null }), 'Active');
  assert.equal(accessLabel({ state: 'trial', canWrite: true, daysLeft: 9 }), 'Trial · 9 days left');
  assert.equal(accessLabel({ state: 'trial', canWrite: true, daysLeft: 1 }), 'Trial · 1 day left');
  assert.equal(accessLabel({ state: 'trial-ended', canWrite: false, daysLeft: 0 }), 'Trial ended');
  assert.equal(accessLabel({ state: 'suspended', canWrite: false, daysLeft: null }), 'Suspended');
  assert.match(readOnlyMessage('trial-ended'), /trial has ended/);
  assert.match(readOnlyMessage('suspended'), /suspended/);
});

test('extending a trial adds days from today, or from the current end if later', () => {
  assert.deepEqual(extendedTrialEnd(addDays(now, -5), now, 14), addDays(now, 14));
  assert.deepEqual(extendedTrialEnd(addDays(now, 3), now, 14), addDays(now, 17));
  assert.deepEqual(extendedTrialEnd(undefined, now, 14), addDays(now, 14));
});

test('plans config', () => {
  assert.deepEqual(PLANS.map((p) => p.id), ['starter', 'team', 'business']);
  assert.deepEqual(PLANS.map((p) => p.staffLimit), [5, 20, 50]);
  assert.equal(planById('team')?.name, 'Team');
  assert.equal(planById('nope'), undefined);
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(INVITE_DAYS, 7);
});
```

- [ ] **Step 2: Point `test:unit` at both unit files** — in `package.json`:

```json
"test:unit": "node --test tests/unit/workspace.test.mjs tests/unit/subscription.test.mjs",
```

- [ ] **Step 3: Run, expect failure**

Run: `npm run test:unit`
Expected: FAIL — `Cannot find module …/src/lib/subscription.ts`.

- [ ] **Step 4: Create `src/config/plans.ts`** (no imports, so Node can load it in tests)

```ts
// Plans a company can pick when it signs up. Names, limits and prices are
// placeholders: change them here. firestore.rules keeps the same
// id → staff limit map (planLimits); a rules test fails if they drift apart.

export type PlanId = 'starter' | 'team' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  /** Maximum staff (admins, managers, employees). Clients are free. */
  staffLimit: number;
  priceLabel: string;
  blurb: string;
}

export const PLANS: Plan[] = [
  { id: 'starter', name: 'Starter', staffLimit: 5, priceLabel: 'AED 99 / month', blurb: 'For small teams getting started' },
  { id: 'team', name: 'Team', staffLimit: 20, priceLabel: 'AED 299 / month', blurb: 'For growing project teams' },
  { id: 'business', name: 'Business', staffLimit: 50, priceLabel: 'AED 599 / month', blurb: 'For established contractors' },
];

export const planById = (id?: string): Plan | undefined => PLANS.find((p) => p.id === id);

/** Length of the free trial a new company gets. */
export const TRIAL_DAYS = 14;
/** How long an invite link stays valid. */
export const INVITE_DAYS = 7;
/** Where "Contact us" (Enterprise, choosing a plan) goes. Placeholder. */
export const SALES_EMAIL = 'sales@yourcompany.com';
```

- [ ] **Step 5: Create `src/config/roles.ts`**

```ts
import type { UserRole } from '@/types';

/** How each role is named in the UI. */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  user: 'Employee',
  client: 'Client',
};
```

- [ ] **Step 6: Create `src/lib/subscription.ts`** (no imports)

```ts
// Pure helpers for plans, trials and invites. No imports, so the unit tests
// run this file directly with Node (npm run test:unit).

export const DAY_MS = 24 * 60 * 60 * 1000;

const STAFF_ROLES = ['admin', 'manager', 'user'];

/** Admins, managers and employees use up a plan's staff places; clients don't. */
export const isStaffRole = (role?: string): boolean => STAFF_ROLES.includes(role ?? '');

export const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * DAY_MS);

export type WorkspaceStatus = 'trial' | 'active' | 'suspended';
export type AccessState = 'active' | 'trial' | 'trial-ended' | 'suspended';

export interface BillingFields {
  status?: WorkspaceStatus;
  trialEndsAt?: Date;
  staffLimit?: number;
  staffCount?: number;
}

export interface WorkspaceAccess {
  state: AccessState;
  /** False = read-only: firestore.rules reject every write. */
  canWrite: boolean;
  /** Whole days left in the trial (rounded up); null when not on a trial. */
  daysLeft: number | null;
}

/** Mirrors writable() in firestore.rules. No status means 'active' (older companies). */
export function workspaceAccess(ws: BillingFields | null | undefined, now: Date): WorkspaceAccess {
  const status = ws?.status ?? 'active';
  if (status === 'suspended') return { state: 'suspended', canWrite: false, daysLeft: null };
  if (status === 'trial') {
    const msLeft = ws?.trialEndsAt ? ws.trialEndsAt.getTime() - now.getTime() : 0;
    if (msLeft <= 0) return { state: 'trial-ended', canWrite: false, daysLeft: 0 };
    return { state: 'trial', canWrite: true, daysLeft: Math.ceil(msLeft / DAY_MS) };
  }
  return { state: 'active', canWrite: true, daysLeft: null };
}

/** Staff places still free, counting pending staff invites as taken. null = unlimited. */
export function staffSeatsLeft(ws: BillingFields | null | undefined, pendingStaffInvites: number): number | null {
  const limit = ws?.staffLimit ?? 0;
  if (limit <= 0) return null;
  return Math.max(0, limit - (ws?.staffCount ?? 0) - pendingStaffInvites);
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked';
export type InviteState = InviteStatus | 'expired';

/** What an invite link should show: a pending invite past its expiry is 'expired'. */
export function inviteState(invite: { status: InviteStatus; expiresAt: Date }, now: Date): InviteState {
  if (invite.status === 'pending' && invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return invite.status;
}

/** Short status text: "Active", "Trial · 9 days left", "Trial ended", "Suspended". */
export function accessLabel(access: WorkspaceAccess): string {
  switch (access.state) {
    case 'trial':
      return `Trial · ${access.daysLeft} day${access.daysLeft === 1 ? '' : 's'} left`;
    case 'trial-ended':
      return 'Trial ended';
    case 'suspended':
      return 'Suspended';
    default:
      return 'Active';
  }
}

/** Why the company is read-only, for the banner and blocked actions. */
export function readOnlyMessage(state: AccessState): string {
  return state === 'suspended'
    ? 'This company is suspended, so your data is read-only.'
    : 'Your free trial has ended, so your data is read-only.';
}

/** New trial end when the owner extends a trial: from today, or from the current end if that is later. */
export function extendedTrialEnd(current: Date | undefined, now: Date, days: number): Date {
  const from = current && current.getTime() > now.getTime() ? current : now;
  return addDays(from, days);
}
```

- [ ] **Step 7: Run, expect pass**

Run: `npm run test:unit`
Expected: PASS — all workspace and subscription tests.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run lint
git add src/config/plans.ts src/config/roles.ts src/lib/subscription.ts tests/unit/subscription.test.mjs package.json
git commit -m "feat: plans config and trial/seat/invite helpers"
```

---

### Task 2: Firestore rules for sign-up, invites, plans and super admin

**Files:**
- Rewrite: `firestore.rules`
- Modify: `tests/security-rules.test.mjs`

**Interfaces:**
- Consumes: `PLANS` from `src/config/plans.ts` (drift test).
- Produces (data contract used by Tasks 4–10):
  - Sign-up batch: `workspaces/{new}` with exactly `name, divisions([]), status('trial'), plan, staffLimit(=plan limit), staffCount(1), trialEndsAt(≤15 days), createdBy(uid), createdAt, contactName, contactEmail(=login email)` + `users/{uid}` with exactly `name, email(=login email, lowercase), role('admin'), workspaceId`.
  - Invite doc `invites/{token}`: `workspaceId, workspaceName, email(lowercase), name, role, company?, organizationId?, status('pending'), invitedBy(uid), createdAt, expiresAt(≤8 days)`.
  - Accept batch: `users/{uid}` = invite's `name?, email, role, workspaceId, company?, organizationId?` + `inviteId`; `invites/{token}` update `status:'accepted', acceptedBy, acceptedAt`; staff roles also `workspaces/{ws}` update `staffCount: +1`.
  - Remove staff batch: delete `users/{x}` + `workspaces/{ws}` update `staffCount: -1, removedUid: x`.
  - Owner update on `workspaces/{ws}`: only `status, plan, staffLimit, trialEndsAt`.

- [ ] **Step 1: Update the test fixtures** — in `tests/security-rules.test.mjs`, add imports and helpers after the existing imports:

```js
import assert from 'node:assert/strict';
import { PLANS } from '../src/config/plans.ts';
```

Replace the `profiles` object with:

```js
const profiles = {
  admin: { name: 'Admin', email: 'admin@a.dev', role: 'admin', workspaceId: 'wsA' },
  manager: { name: 'Manager', email: 'manager@a.dev', role: 'manager', workspaceId: 'wsA' },
  employee: { name: 'Employee', email: 'employee@a.dev', role: 'user', workspaceId: 'wsA' },
  clientA: { name: 'Client A', email: 'a@client.dev', role: 'client', workspaceId: 'wsA', company: 'Acme', organizationId: 'ORG-ACM-001' },
  clientA2: { name: 'Client A2', email: 'a2@client.dev', role: 'client', workspaceId: 'wsA', company: 'Beta', organizationId: 'ORG-BET-002' },
  adminB: { name: 'Admin B', email: 'admin@b.dev', role: 'admin', workspaceId: 'wsB' },
  employeeB: { name: 'Employee B', email: 'employee@b.dev', role: 'user', workspaceId: 'wsB' },
  adminT: { name: 'Admin T', email: 'admin@t.dev', role: 'admin', workspaceId: 'wsT' }, // trial ended
  adminS: { name: 'Admin S', email: 'admin@s.dev', role: 'admin', workspaceId: 'wsS' }, // suspended
  owner: { name: 'Owner', email: 'owner@p.dev', role: 'admin', workspaceId: 'wsO' },   // super admin
};

const inDays = (n) => new Date(Date.now() + n * 86400000);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// A signed-in context whose token carries an email (needed for sign-up and invites).
const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore();

const workspaces = {
  wsA: { name: 'Company A', divisions: [], status: 'active', plan: 'team', staffLimit: 5, staffCount: 3 },
  wsB: { name: 'Company B', divisions: [], status: 'active', plan: 'custom', staffLimit: 0, staffCount: 2 },
  wsT: { name: 'Trial over', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1, trialEndsAt: inDays(-1) },
  wsS: { name: 'Suspended', divisions: [], status: 'suspended', plan: 'starter', staffLimit: 5, staffCount: 1 },
  wsO: { name: 'Owner Co', divisions: [], status: 'active', plan: 'custom', staffLimit: 0, staffCount: 1 },
};

const invite = (over) => ({
  workspaceId: 'wsA', workspaceName: 'Company A', name: 'Invitee', status: 'pending',
  invitedBy: 'admin', createdAt: new Date(), expiresAt: inDays(7), ...over,
});
const invites = {
  'inv-mgr': invite({ role: 'manager', email: 'new@a.dev', name: 'New Manager' }),
  'inv-client': invite({ role: 'client', email: 'gamma@client.dev', name: 'Gamma', company: 'Gamma LLC', organizationId: 'ORG-GL-001' }),
  'inv-expired': invite({ role: 'user', email: 'late@a.dev', expiresAt: inDays(-1) }),
  'inv-revoked': invite({ role: 'user', email: 'gone@a.dev', status: 'revoked' }),
  'inv-t': invite({ workspaceId: 'wsT', workspaceName: 'Trial over', role: 'user', email: 't@t.dev' }),
};
```

In `beforeEach`, replace the two `workspaces` `set` lines with the loops below, and add the rest at the end of the callback:

```js
    for (const [id, data] of Object.entries(workspaces)) {
      await fs.collection('workspaces').doc(id).set(data);
    }
```

```js
    await fs.collection('workspaces').doc('wsT').collection('projects').doc('p-t').set({ name: 'Old project' });
    await fs.collection('platformOwners').doc('owner').set({ email: 'owner@p.dev' });
    for (const [id, data] of Object.entries(invites)) {
      await fs.collection('invites').doc(id).set(data);
    }
```

- [ ] **Step 2: Update the existing tests that change meaning**

In `describe('workspace isolation')`, rename `'nobody can create or delete a workspace from the app'` to `'staff cannot create or delete a workspace'` (body unchanged).

In `describe('user profiles')`, replace the test `'only admins create users, and only in their own workspace'` with:

```js
  it('nobody creates profiles directly: people join by sign-up or invite', async () => {
    await assertFails(db('admin').collection('users').doc('new').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
    await assertFails(db('manager').collection('users').doc('new5').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
  });
```

and replace `'admins manage users of their own workspace only'` with:

```js
  it('admins manage users of their own workspace only', async () => {
    await assertSucceeds(db('admin').collection('users').doc('employee').update({ role: 'manager' }));
    await assertFails(db('admin').collection('users').doc('employee').update({ workspaceId: 'wsB' }));
    await assertFails(db('admin').collection('users').doc('employeeB').update({ role: 'manager' }));
    await assertFails(db('admin').collection('users').doc('employeeB').delete());
  });
```

- [ ] **Step 3: Add the new test blocks** at the end of the file (before nothing — after `describe('storage', …)`):

```js
describe('company sign-up', () => {
  const founder = () => as('founder', 'founder@new.dev');
  const newCompany = (over = {}) => ({
    name: 'New Co', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1,
    trialEndsAt: inDays(14), createdBy: 'founder', createdAt: new Date(),
    contactName: 'Fay', contactEmail: 'founder@new.dev', ...over,
  });
  const founderProfile = (over = {}) => ({ name: 'Fay', email: 'founder@new.dev', role: 'admin', workspaceId: 'wsNew', ...over });
  const signUp = (fs, { company = {}, profile = {}, wsId = 'wsNew' } = {}) => {
    const batch = fs.batch();
    batch.set(fs.collection('workspaces').doc(wsId), newCompany(company));
    batch.set(fs.collection('users').doc('founder'), founderProfile({ workspaceId: wsId, ...profile }));
    return batch.commit();
  };

  it('creates a trial company with its founder as admin, who can then work in it', async () => {
    await assertSucceeds(signUp(founder()));
    await assertSucceeds(ws('founder', 'wsNew').get());
    await assertSucceeds(ws('founder', 'wsNew').collection('tenders').add({ name: 'First' }));
  });

  it('cannot skip the trial or choose its own staff limit', async () => {
    await assertFails(signUp(founder(), { company: { status: 'active' } }));
    await assertFails(signUp(founder(), { company: { staffLimit: 500 } }));
    await assertFails(signUp(founder(), { company: { plan: 'custom', staffLimit: 0 } }));
    await assertFails(signUp(founder(), { company: { trialEndsAt: inDays(60) } }));
    await assertFails(signUp(founder(), { company: { staffCount: 0 } }));
  });

  it('must use the login email, be the creator and be the admin', async () => {
    await assertFails(signUp(founder(), { profile: { email: 'someone@else.dev' } }));
    await assertFails(signUp(founder(), { company: { createdBy: 'admin' } }));
    await assertFails(signUp(founder(), { profile: { role: 'manager' } }));
  });

  it('cannot join an existing company', async () => {
    await assertFails(signUp(founder(), { wsId: 'wsA' }));
    await assertFails(founder().collection('users').doc('founder').set(founderProfile({ workspaceId: 'wsA' })));
  });

  it('only works for a login with no profile yet', async () => {
    const fs = as('admin', 'admin@a.dev');
    await assertFails(fs.collection('workspaces').doc('wsSecond').set(newCompany({ createdBy: 'admin', contactEmail: 'admin@a.dev' })));
  });

  it('a company without its founder profile is rejected', async () => {
    await assertFails(founder().collection('workspaces').doc('wsNew').set(newCompany()));
  });
});

describe('invites', () => {
  const newInvite = (over = {}) => invite({ email: 'hire@a.dev', name: 'Hire', role: 'user', ...over });
  const accept = (uid, token, { email = invites[token].email, profile = {}, staffCount } = {}) => {
    const inv = invites[token];
    const fs = as(uid, email);
    const batch = fs.batch();
    batch.set(fs.collection('users').doc(uid), clean({
      name: inv.name, email: inv.email, role: inv.role, workspaceId: inv.workspaceId,
      company: inv.company, organizationId: inv.organizationId, inviteId: token, ...profile,
    }));
    batch.update(fs.collection('invites').doc(token), { status: 'accepted', acceptedBy: uid, acceptedAt: new Date() });
    if (staffCount !== undefined) batch.update(fs.collection('workspaces').doc(inv.workspaceId), { staffCount });
    return batch.commit();
  };

  it('only an admin creates invites, for their own company', async () => {
    await assertSucceeds(db('admin').collection('invites').add(newInvite()));
    await assertFails(db('manager').collection('invites').add(newInvite({ invitedBy: 'manager' })));
    await assertFails(db('adminB').collection('invites').add(newInvite({ invitedBy: 'adminB' })));
    await assertFails(db('admin').collection('invites').add(newInvite({ expiresAt: inDays(30) })));
    await assertFails(db('admin').collection('invites').add(newInvite({ email: 'Hire@A.dev' })));
    await assertFails(db('admin').collection('invites').add(newInvite({ status: 'accepted' })));
  });

  it('anyone with the link can open one invite, but nobody can browse them', async () => {
    await assertSucceeds(db(null).collection('invites').doc('inv-mgr').get());
    await assertFails(db(null).collection('invites').get());
    await assertSucceeds(db('admin').collection('invites').where('workspaceId', '==', 'wsA').get());
    await assertFails(db('adminB').collection('invites').where('workspaceId', '==', 'wsA').get());
    await assertFails(db('employee').collection('invites').where('workspaceId', '==', 'wsA').get());
  });

  it('admins can revoke a pending invite of their own company', async () => {
    await assertFails(db('employee').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
    await assertFails(db('adminB').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
    await assertSucceeds(db('admin').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
  });

  it('a staff invite is accepted with the invited email and takes one staff place', async () => {
    await assertSucceeds(accept('newbie', 'inv-mgr', { staffCount: 4 }));
    await assertSucceeds(ws('newbie', 'wsA').collection('projects').get());
  });

  it('a staff invite cannot skip the staff count', async () => {
    await assertFails(accept('newbie', 'inv-mgr'));
  });

  it('a client invite does not touch the staff count', async () => {
    await assertFails(accept('gamma', 'inv-client', { staffCount: 4 }));
    await assertSucceeds(accept('gamma', 'inv-client'));
  });

  it('the login email must match the invite', async () => {
    await assertFails(accept('newbie', 'inv-mgr', { email: 'other@a.dev', staffCount: 4 }));
  });

  it('expired, revoked and used invites cannot be accepted', async () => {
    await assertFails(accept('late', 'inv-expired', { staffCount: 4 }));
    await assertFails(accept('gone', 'inv-revoked', { staffCount: 4 }));
    await assertSucceeds(accept('newbie', 'inv-mgr', { staffCount: 4 }));
    await assertFails(accept('again', 'inv-mgr', { staffCount: 5 }));
  });

  it('the profile must copy the invite (no role or company escalation)', async () => {
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 4, profile: { role: 'admin' } }));
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 4, profile: { workspaceId: 'wsB' } }));
    await assertFails(accept('gamma', 'inv-client', { profile: { organizationId: 'ORG-ACM-001' } }));
  });

  it('a full company cannot take more staff', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().collection('workspaces').doc('wsA').update({ staffCount: 5 }));
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 6 }));
  });

  it('a read-only company cannot take new people', async () => {
    await assertFails(accept('tnew', 'inv-t', { staffCount: 2 }));
  });
});

describe('read-only companies (trial ended or suspended)', () => {
  it('can still read their data', async () => {
    await assertSucceeds(ws('adminT', 'wsT').get());
    await assertSucceeds(ws('adminT', 'wsT').collection('projects').get());
    await assertSucceeds(ws('adminS', 'wsS').collection('tenders').get());
  });

  it('cannot change anything', async () => {
    await assertFails(ws('adminT', 'wsT').collection('projects').add({ name: 'x' }));
    await assertFails(ws('adminT', 'wsT').collection('projects').doc('p-t').update({ name: 'y' }));
    await assertFails(ws('adminT', 'wsT').update({ name: 'Renamed' }));
    await assertFails(ws('adminS', 'wsS').collection('tenders').add({ name: 'x' }));
    await assertFails(ws('adminS', 'wsS').collection('employees').add({ name: 'x' }));
    await assertFails(db('adminT').collection('invites').add(invite({ workspaceId: 'wsT', workspaceName: 'Trial over', email: 'n@t.dev', role: 'user', invitedBy: 'adminT' })));
  });
});

describe('super admin', () => {
  it('lists every company', async () => {
    await assertSucceeds(db('owner').collection('workspaces').get());
    await assertFails(db('admin').collection('workspaces').get());
  });

  it('changes plan and status, nothing else', async () => {
    await assertSucceeds(ws('owner', 'wsA').update({ status: 'suspended' }));
    await assertSucceeds(ws('owner', 'wsA').update({ plan: 'business', staffLimit: 50 }));
    await assertSucceeds(ws('owner', 'wsT').update({ trialEndsAt: inDays(14) }));
    await assertFails(ws('owner', 'wsA').update({ name: 'Taken over' }));
    await assertFails(ws('owner', 'wsA').update({ status: 'deleted' }));
    await assertFails(ws('owner', 'wsA').update({ staffCount: 0 }));
  });

  it("cannot read any company's records or people", async () => {
    await assertFails(ws('owner', 'wsA').collection('projects').get());
    await assertFails(db('owner').collection('users').doc('admin').get());
  });

  it('owner status is set by script only', async () => {
    await assertSucceeds(db('owner').collection('platformOwners').doc('owner').get());
    await assertFails(db('admin').collection('platformOwners').doc('owner').get());
    await assertFails(db('admin').collection('platformOwners').doc('admin').set({ email: 'admin@a.dev' }));
  });

  it('company admins cannot change their own plan, status or count', async () => {
    await assertFails(ws('admin', 'wsA').update({ plan: 'business', staffLimit: 50 }));
    await assertFails(ws('admin', 'wsA').update({ staffCount: 0 }));
    await assertFails(ws('admin', 'wsA').update({ status: 'active' }));
    await assertFails(ws('adminT', 'wsT').update({ trialEndsAt: inDays(30) }));
  });
});

describe('removing people and changing roles', () => {
  const removeStaff = (uid, staffCount, removedUid = uid) => {
    const fs = db('admin');
    const batch = fs.batch();
    batch.delete(fs.collection('users').doc(uid));
    batch.update(fs.collection('workspaces').doc('wsA'), { staffCount, removedUid });
    return batch.commit();
  };

  it('removing staff frees exactly one place', async () => {
    await assertFails(db('admin').collection('users').doc('employee').delete());
    await assertFails(removeStaff('employee', 1));
    await assertSucceeds(removeStaff('employee', 2));
  });

  it('the freed place must belong to the person removed', async () => {
    await assertFails(removeStaff('employee', 2, 'manager'));
    await assertFails(db('admin').collection('workspaces').doc('wsA').update({ staffCount: 2, removedUid: 'manager' }));
  });

  it('removing a client needs no count change', async () => {
    await assertSucceeds(db('admin').collection('users').doc('clientA').delete());
  });

  it("admins can't switch people between staff and client (re-invite instead)", async () => {
    await assertFails(db('admin').collection('users').doc('clientA').update({ role: 'user' }));
    await assertFails(db('admin').collection('users').doc('employee').update({ role: 'client' }));
    await assertSucceeds(db('admin').collection('users').doc('employee').update({ role: 'manager' }));
  });
});

describe('plans', () => {
  it('plan limits in firestore.rules match src/config/plans.ts', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const match = rules.match(/function planLimits\(\) \{\s*return (\{[^}]*\});/);
    assert.ok(match, 'planLimits() not found in firestore.rules');
    const inRules = JSON.parse(match[1].replace(/'/g, '"'));
    assert.deepEqual(inRules, Object.fromEntries(PLANS.map((p) => [p.id, p.staffLimit])));
  });
});
```

- [ ] **Step 4: Run, expect failures**

Stop the running emulators first (see Global Constraints).
Run: `npm run test:rules`
Expected: FAIL — sign-up, invites, read-only, super admin, removal and plans tests fail (the old rules have no such branches; `planLimits()` not found).

- [ ] **Step 5: Replace `firestore.rules`** with:

```
rules_version = '2';

// Multi-company access for ProjectDesk.
//
// Each customer company is a workspace: /workspaces/{ws} holds its settings
// (name, logo, brand colour, divisions) and its plan (status, plan, staffLimit,
// staffCount, trialEndsAt). Every business record lives underneath it, e.g.
// /workspaces/{ws}/projects/{id}.
//
// Every signed-in person has a profile at /users/{uid} with a `workspaceId`
// and a `role` of 'admin' | 'manager' | 'user' (employee) | 'client'. A person
// can only ever reach the workspace named on their own profile. A login with
// no profile gets no access, except to finish a company sign-up or accept an
// invite; both are single batched writes, checked as a whole with getAfter().
//
// Plans: a company whose trial has ended, or that is suspended, is read-only
// (every write requires writable(ws)). Staff, not clients, count against the
// plan's staffLimit through the workspace's staffCount.
//
// The product owner (super admin) has a /platformOwners/{uid} document, made
// by script only. They can list companies and change plan fields, nothing else.
service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function userPath(uid) {
      return /databases/$(database)/documents/users/$(uid);
    }

    function wsPath(ws) {
      return /databases/$(database)/documents/workspaces/$(ws);
    }

    function invitePath(token) {
      return /databases/$(database)/documents/invites/$(token);
    }

    function hasProfile() {
      return signedIn() && exists(userPath(request.auth.uid));
    }

    function me() {
      return get(userPath(request.auth.uid)).data;
    }

    // The caller's profile as it will be after this write (batches).
    function meAfter() {
      return getAfter(userPath(request.auth.uid)).data;
    }

    function myWs() {
      return hasProfile() ? me().get('workspaceId', '') : '';
    }

    function role() {
      return hasProfile() ? me().role : '';
    }

    // True when the caller belongs to workspace `ws`.
    function inWs(ws) {
      return myWs() != '' && myWs() == ws;
    }

    function isStaffRole(r) {
      return r in ['admin', 'manager', 'user'];
    }

    function validRole(r) {
      return r in ['admin', 'manager', 'user', 'client'];
    }

    function isAdmin() {
      return role() == 'admin';
    }

    function isStaff() {
      return isStaffRole(role());
    }

    function isClient() {
      return role() == 'client';
    }

    function isOwner() {
      return signedIn() && exists(/databases/$(database)/documents/platformOwners/$(request.auth.uid));
    }

    function authEmail() {
      return request.auth.token.email.lower();
    }

    function changed() {
      return request.resource.data.diff(resource.data).affectedKeys();
    }

    // Self-serve plans and their staff limits. Keep in sync with
    // src/config/plans.ts (tests/security-rules.test.mjs checks).
    function planLimits() {
      return {'starter': 5, 'team': 20, 'business': 50};
    }

    // False once a trial has ended or the company is suspended (read-only).
    // Mirrors workspaceAccess() in src/lib/subscription.ts.
    function writable(ws) {
      let w = get(wsPath(ws)).data;
      let status = w.get('status', 'active');
      return status == 'active' || (status == 'trial' && request.time < w.trialEndsAt);
    }

    function canWrite(ws) {
      return inWs(ws) && writable(ws);
    }

    // A new trial company written together with its founder's admin profile.
    function validSignupWorkspace(ws, d) {
      return d.keys().hasOnly(['name', 'divisions', 'status', 'plan', 'staffLimit', 'staffCount',
                               'trialEndsAt', 'createdBy', 'createdAt', 'contactName', 'contactEmail'])
        && d.name is string && d.name.size() > 0 && d.name.size() <= 100
        && d.divisions is list && d.divisions.size() == 0
        && d.status == 'trial'
        && d.plan in planLimits()
        && d.staffLimit == planLimits()[d.plan]
        && d.staffCount == 1
        && d.trialEndsAt > request.time
        && d.trialEndsAt <= request.time + duration.value(15, 'd')
        && d.createdBy == request.auth.uid
        && d.contactEmail == authEmail()
        && meAfter().workspaceId == ws
        && meAfter().role == 'admin';
    }

    // A profile that copies a pending invite, which the same batch marks
    // accepted. Staff also take one place (staffCount + 1, see workspaces).
    function validInviteProfile(d) {
      let inv = get(invitePath(d.inviteId)).data;
      let ws = d.workspaceId;
      return d.keys().hasOnly(['name', 'email', 'role', 'workspaceId', 'company', 'organizationId', 'inviteId'])
        && inv.status == 'pending'
        && request.time < inv.expiresAt
        && inv.email == authEmail()
        && d.email == inv.email
        && ws == inv.workspaceId
        && d.role == inv.role
        && d.get('company', '') == inv.get('company', '')
        && d.get('organizationId', '') == inv.get('organizationId', '')
        && writable(ws)
        && getAfter(invitePath(d.inviteId)).data.status == 'accepted'
        && (!isStaffRole(d.role)
            || getAfter(wsPath(ws)).data.staffCount == get(wsPath(ws)).data.staffCount + 1);
    }

    // `uid` was a staff member of `ws` before this batch and is gone after it.
    function removedStaff(ws, uid) {
      return exists(userPath(uid))
        && get(userPath(uid)).data.workspaceId == ws
        && isStaffRole(get(userPath(uid)).data.role)
        && !existsAfter(userPath(uid));
    }

    // ---- Super admin marker (script-only) ------------------------------
    match /platformOwners/{uid} {
      allow get: if signedIn() && request.auth.uid == uid;
    }

    // ---- User profiles -------------------------------------------------
    match /users/{uid} {
      // Staff list colleagues with where('workspaceId' == theirWorkspace);
      // the comparison below is what lets Firestore accept that query.
      allow read: if (signedIn() && request.auth.uid == uid)
        || (isStaff() && resource.data.workspaceId == myWs());

      // Company sign-up: the founder's own admin profile, created in the same
      // batch as their new trial workspace (see validSignupWorkspace).
      allow create: if signedIn() && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['name', 'email', 'role', 'workspaceId'])
        && request.resource.data.role == 'admin'
        && request.resource.data.email == authEmail()
        && !exists(wsPath(request.resource.data.workspaceId))
        && getAfter(wsPath(request.resource.data.workspaceId)).data.createdBy == uid;

      // Accepting an invite.
      allow create: if signedIn() && request.auth.uid == uid
        && validInviteProfile(request.resource.data);

      // Admins manage their own workspace's people but never move anyone to
      // another workspace, and never switch someone between staff and client
      // (that would bypass the staff count: re-invite instead). Everyone can
      // edit their own name/email/avatar.
      allow update: if (isAdmin()
          && resource.data.workspaceId == myWs()
          && request.resource.data.workspaceId == resource.data.workspaceId
          && validRole(request.resource.data.role)
          && isStaffRole(request.resource.data.role) == isStaffRole(resource.data.role)
          && writable(myWs()))
        || (signedIn() && request.auth.uid == uid
          && changed().hasOnly(['name', 'email', 'avatar']));

      // Removing a staff member frees their place: the same batch lowers the
      // workspace's staffCount and names them in removedUid.
      allow delete: if isAdmin() && resource.data.workspaceId == myWs() && writable(myWs())
        && (!isStaffRole(resource.data.role)
          || (getAfter(wsPath(myWs())).data.staffCount == get(wsPath(myWs())).data.staffCount - 1
            && getAfter(wsPath(myWs())).data.get('removedUid', '') == uid));
    }

    // ---- Invites -------------------------------------------------------
    match /invites/{token} {
      // The random token is the secret: whoever has the link can open that one
      // invite, even signed out. Invites can't be browsed.
      allow get: if true;
      allow list: if isAdmin() && resource.data.workspaceId == myWs();

      allow create: if isAdmin() && writable(myWs())
        && request.resource.data.keys().hasOnly(['workspaceId', 'workspaceName', 'email', 'name', 'role',
                                                 'company', 'organizationId', 'status', 'invitedBy',
                                                 'createdAt', 'expiresAt'])
        && request.resource.data.workspaceId == myWs()
        && request.resource.data.status == 'pending'
        && request.resource.data.invitedBy == request.auth.uid
        && validRole(request.resource.data.role)
        && request.resource.data.email is string
        && request.resource.data.email == request.resource.data.email.lower()
        && request.resource.data.expiresAt > request.time
        && request.resource.data.expiresAt <= request.time + duration.value(8, 'd');

      allow update: if
        // An admin revokes a pending invite.
        (isAdmin() && resource.data.workspaceId == myWs()
          && resource.data.status == 'pending'
          && request.resource.data.status == 'revoked'
          && changed().hasOnly(['status']))
        // The invitee accepts it (see validInviteProfile).
        || (signedIn() && resource.data.status == 'pending'
          && request.resource.data.status == 'accepted'
          && changed().hasOnly(['status', 'acceptedBy', 'acceptedAt'])
          && request.resource.data.acceptedBy == request.auth.uid
          && meAfter().get('inviteId', '') == token);
      // Never deleted: kept as a record of who was invited.
    }

    // ---- Workspaces ----------------------------------------------------
    match /workspaces/{ws} {
      // Every member, clients included, needs the name/logo/colour and plan.
      allow get: if inWs(ws) || isOwner();
      allow list: if isOwner();

      // Company sign-up (one batch with the founder's profile).
      allow create: if signedIn() && !hasProfile()
        && validSignupWorkspace(ws, request.resource.data);

      allow update: if
        // Company admins: branding and divisions.
        (isAdmin() && canWrite(ws)
          && changed().hasOnly(['name', 'logoUrl', 'brandColor', 'divisions']))
        // Super admin: plan and status only.
        || (isOwner()
          && changed().hasOnly(['status', 'plan', 'staffLimit', 'trialEndsAt'])
          && request.resource.data.get('status', 'active') in ['trial', 'active', 'suspended']
          && (request.resource.data.get('plan', 'custom') in planLimits()
              || request.resource.data.get('plan', 'custom') == 'custom')
          && request.resource.data.get('staffLimit', 0) is int
          && request.resource.data.get('staffLimit', 0) >= 0)
        // Someone accepting a staff invite takes one place.
        || (signedIn() && !hasProfile()
          && changed().hasOnly(['staffCount'])
          && request.resource.data.staffCount == resource.data.staffCount + 1
          && (resource.data.get('staffLimit', 0) == 0
              || request.resource.data.staffCount <= resource.data.staffLimit)
          && meAfter().workspaceId == ws
          && isStaffRole(meAfter().role)
          && meAfter().get('inviteId', '') != '')
        // An admin removing a staff member frees one place.
        || (isAdmin() && canWrite(ws)
          && changed().hasOnly(['staffCount', 'removedUid'])
          && request.resource.data.staffCount == resource.data.staffCount - 1
          && removedStaff(ws, request.resource.data.removedUid));

      allow delete: if false;

      // ---- Projects ----------------------------------------------------
      match /projects/{projectId} {
        // Plain field comparisons so Firestore can match them against the
        // client's where('clientId' == uid) / where('organizationId' == org)
        // queries (see getProjectsForClient in src/services/firestore.ts).
        allow read: if inWs(ws) && (isStaff()
          || (isClient() && (
                resource.data.clientId == request.auth.uid
                || (me().get('organizationId', '') != ''
                    && resource.data.organizationId == me().organizationId))));

        allow create, update, delete: if canWrite(ws) && isStaff();
      }

      // ---- Employee directory ------------------------------------------
      match /employees/{employeeId} {
        allow read: if inWs(ws) && isStaff();
        allow create, update, delete: if canWrite(ws) && role() in ['admin', 'manager'];
      }

      // ---- Other business data (staff only) ----------------------------
      match /{coll}/{docId} {
        allow read: if inWs(ws) && isStaff()
          && coll in ['tenders', 'registrations', 'payments', 'subscriptions', 'partners', 'files'];
        allow write: if canWrite(ws) && isStaff()
          && coll in ['tenders', 'registrations', 'payments', 'subscriptions', 'partners', 'files'];
      }
    }

    // Anything not listed above is denied by default.
  }
}
```

- [ ] **Step 6: Run, expect pass**

Run: `npm run test:rules`
Expected: PASS — all tests (existing 26 adjusted + new). If a test fails, read the emulator's rule error in the output (it names the failing line) and fix the rule, not the test, unless the test contradicts the spec.

- [ ] **Step 7: Commit** (restart the emulators afterwards)

```bash
git add firestore.rules tests/security-rules.test.mjs
git commit -m "feat(rules): self-serve sign-up, invites, plan limits, read-only mode and super admin"
```

---

### Task 3: Storage uploads need a writable company

**Files:**
- Modify: `storage.rules`
- Modify: `tests/security-rules.test.mjs` (storage block)

**Interfaces:**
- Consumes: workspace `status` / `trialEndsAt` fields from Task 2.

- [ ] **Step 1: Write the failing test** — inside `describe('storage', …)` add:

```js
  it('read-only companies cannot upload', async () => {
    await assertFails(put('adminT', 'workspaces/wsT/documents/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('adminT', 'workspaces/wsT/task-attachments/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('adminS', 'workspaces/wsS/branding/logo.png', png, 'image/png'));
  });
```

- [ ] **Step 2: Run, expect failure**

Run: `npm run test:rules` (emulators stopped)
Expected: FAIL — `read-only companies cannot upload` (uploads succeed today).

- [ ] **Step 3: Update `storage.rules`** — add after `isAdminOf`:

```
    // Mirrors writable() in firestore.rules: no uploads once a trial has ended
    // or the company is suspended.
    function writable(ws) {
      let w = firestore.get(/databases/(default)/documents/workspaces/$(ws)).data;
      let status = w.get('status', 'active');
      return status == 'active' || (status == 'trial' && request.time < w.trialEndsAt);
    }
```

and change the three workspace blocks to:

```
    match /workspaces/{ws}/documents/{fileName} {
      allow read: if isStaffOf(ws);
      allow delete: if isStaffOf(ws) && writable(ws);
      allow create, update: if isStaffOf(ws) && writable(ws) && underMB(50);
    }

    match /workspaces/{ws}/task-attachments/{fileName} {
      allow read: if isStaffOf(ws);
      allow delete: if isStaffOf(ws) && writable(ws);
      allow create, update: if isStaffOf(ws) && writable(ws) && underMB(50);
    }

    match /workspaces/{ws}/branding/{fileName} {
      allow read: if inWs(ws);
      allow create, update: if isAdminOf(ws) && writable(ws) && isImage() && underMB(2);
      allow delete: if isAdminOf(ws) && writable(ws);
    }
```

Keep the existing comments above each block.

- [ ] **Step 4: Run, expect pass**

Run: `npm run test:rules`
Expected: PASS. If the emulator reports a cross-service document access limit, replace `registered()` with
`request.auth != null && profile() != null` style checks so each request reads at most the user doc and the workspace doc, then re-run.

- [ ] **Step 5: Commit** (restart the emulators afterwards)

```bash
git add storage.rules tests/security-rules.test.mjs
git commit -m "feat(storage): no uploads for read-only companies"
```

---

### Task 4: Seed data and local accounts

**Files:**
- Modify: `scripts/seed-emulator.mjs`, `scripts/local-accounts.mjs`, `scripts/local-accounts.example.json`
- Modify (git-ignored, local only): `scripts/local-accounts.json`

**Interfaces:**
- Produces: seeded companies — Acme `active`/`business`/50, Noor `trial`/`starter`/5 (9 days left), Falcon `ws-falcon` trial ended 2 days ago; invite token `seed-invite-acme` (Acme, `newhire@acme.test`, employee); `platformOwners/{uid}` for accounts with `"platformOwner": true`.

- [ ] **Step 1: Plan fields in `createWorkspace`** — `scripts/seed-emulator.mjs`, change the signature and first line:

```js
async function createWorkspace({ id, name, brandColor, divisions, people, billing }) {
  const founder = people.find((p) => p.role === 'admin');
  await put('workspaces', id, {
    name, brandColor, divisions, createdAt: ago(400),
    ...billing,
    staffCount: people.filter((p) => p.role !== 'client').length,
    contactName: founder?.name, contactEmail: founder?.email,
  });
```

Add `billing` to each existing company call:
- `seedAcme`: `billing: { status: 'active', plan: 'business', staffLimit: 50 },`
- `seedNoor`: `billing: { status: 'trial', plan: 'starter', staffLimit: 5, trialEndsAt: new Date(Date.now() + 9 * 86400000) },`

- [ ] **Step 2: Add Falcon (expired trial) and the pending invite** — after `seedNoor`:

```js
// ---------- Falcon Builders (trial ended: read-only) ----------

async function seedFalcon() {
  const ws = 'ws-falcon';
  const person = await createWorkspace({
    id: ws,
    name: 'Falcon Builders',
    brandColor: '#ea580c',
    divisions: [],
    billing: { status: 'trial', plan: 'starter', staffLimit: 5, trialEndsAt: ago(2) },
    people: [
      { key: 'admin', email: 'admin@falcon.test', name: 'Khalid Mansour', role: 'admin', department: 'Management', position: 'Owner', phone: '+971 50 888 1000' },
      { key: 'employee', email: 'employee@falcon.test', name: 'Rana Aziz', role: 'user', department: 'Projects', position: 'Site Supervisor', phone: '+971 55 888 2000' },
    ],
  });
  await putProjects(ws, person, [
    {
      id: 'prj-1', projectId: 'PRJ-001', name: 'Villa Renovation', company: 'Private Client',
      status: 'in-progress', who: 'employee', deadline: day(20), budget: 85000, createdAt: ago(20),
      description: 'Full interior renovation of a four-bedroom villa.', tasks: [], costs: [],
    },
  ]);
  return person;
}

// ---------- A pending invite (open the link printed at the end) ----------

const SEED_INVITE = 'seed-invite-acme';

async function seedInvite(acme) {
  await put('invites', SEED_INVITE, {
    workspaceId: 'ws-acme', workspaceName: 'Acme Contracting', email: 'newhire@acme.test',
    name: 'Nadia Karim', role: 'user', status: 'pending', invitedBy: acme.admin.id,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000),
  });
}
```

- [ ] **Step 3: Wire them into `main()`**

```js
  console.log('Creating demo companies...');
  const acme = await seedAcme();
  const noor = await seedNoor();
  const falcon = await seedFalcon();
  await seedInvite(acme);

  console.log(`\nDone. Local logins (password for all: see TEST_PASSWORD in scripts/seed-emulator.mjs):`);
  for (const [label, people] of [
    ['Acme Contracting (active)', acme],
    ['Noor Engineering (trial, 9 days left)', noor],
    ['Falcon Builders (trial ended: read-only)', falcon],
  ]) {
    console.log(`  ${label}`);
    for (const p of Object.values(people)) console.log(`    ${p.role.padEnd(8)} ${p.email}`);
  }
  console.log(`\nPending invite (Acme, employee newhire@acme.test): http://localhost:8080/join/${SEED_INVITE}`);
```

- [ ] **Step 4: Plan fields and platform owner in `scripts/local-accounts.mjs`** — replace the workspace `put` with:

```js
  await put('workspaces', workspace.id, {
    name: workspace.name, brandColor: workspace.brandColor, divisions, createdAt: new Date(),
    // Your own company: active, no staff limit unless the file says otherwise.
    status: workspace.status ?? 'active',
    plan: workspace.plan ?? 'custom',
    staffLimit: workspace.staffLimit ?? 0,
    staffCount: accounts.filter((a) => a.role !== 'client').length,
    trialEndsAt: workspace.trialEndsAt ? new Date(workspace.trialEndsAt) : undefined,
  });
```

and inside the accounts loop, after the `users` `put`:

```js
    // "platformOwner": true makes this login the super admin (Platform page).
    if (a.platformOwner) await put('platformOwners', uid, { email: a.email, createdAt: new Date() });
```

Update the header comment: add a line `// "platformOwner": true on an account makes it the super admin.`

- [ ] **Step 5: Example and your own file** — in `scripts/local-accounts.example.json` add `"platformOwner": true` to the `you@example.com` account. In `scripts/local-accounts.json` (git-ignored) add `"platformOwner": true` to the `mohamedismayil@gptechnologies.ae` account.

- [ ] **Step 6: Run the seed**

With emulators running: `npm run seed`
Expected: prints the three companies, the invite link and "Your accounts …". In the Emulator UI (http://localhost:4000/firestore) `workspaces/ws-falcon` has `status: trial` with a past `trialEndsAt`, `platformOwners` has one document, `invites/seed-invite-acme` exists.

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-emulator.mjs scripts/local-accounts.mjs scripts/local-accounts.example.json
git commit -m "chore(seed): plan fields, an expired-trial company, a pending invite and the platform owner"
```

---

### Task 5: Types, services and sign-up/invite sessions in AuthContext

**Files:**
- Modify: `src/types/index.ts`, `src/services/firestore.ts`, `src/contexts/AuthContext.tsx`
- Create: `src/services/signup.ts`, `src/services/invites.ts`, `src/services/platform.ts`

**Interfaces:**
- Consumes: `planById`, `TRIAL_DAYS`, `INVITE_DAYS` (Task 1); `addDays`, `isStaffRole`, `WorkspaceStatus`, `InviteStatus` (Task 1); data contract (Task 2).
- Produces:
  - `Workspace` gains `status?, plan?, staffLimit?, staffCount?, trialEndsAt?: Date, createdBy?, contactName?, contactEmail?`; `User.inviteId?`; `interface Invite`.
  - `toWorkspace(id, data): Workspace` (firestore.ts).
  - `createCompanyRecords(uid, input: CompanySignup): Promise<string>`; `interface CompanySignup {plan, companyName, name, email}`.
  - `createInvite(input: NewInvite): Promise<Invite>`, `listInvites(wsId)`, `revokeInvite(id)`, `getInvite(token): Promise<Invite|null>`, `acceptInviteRecords(uid, invite, name)`, `inviteLink(token): string`.
  - `listAllWorkspaces(): Promise<Workspace[]>`, `updateWorkspacePlan(wsId, change: PlanChange)`, `type PlanChange`.
  - `useAuth()` gains `isOwner: boolean`, `signUpCompany(input: CompanySignup & {password}): Promise<true|string>`, `joinWithInvite(invite, name, password): Promise<true|string>`; `addUser` stays until Task 9.

- [ ] **Step 1: Types** — `src/types/index.ts`. Add at the top (next to the `Division` re-export):

```ts
import type { InviteStatus, WorkspaceStatus } from '@/lib/subscription';
```

Add `inviteId?: string;` to `User` (comment: `/** The invite this login joined through, if any. */`).
Add to `Workspace` after `divisions`:

```ts
  /** Plan state. Missing = 'active' (companies created before plans). */
  status?: WorkspaceStatus;
  /** 'starter' | 'team' | 'business' (src/config/plans.ts) or 'custom'. */
  plan?: string;
  /** Maximum staff; 0 = unlimited. */
  staffLimit?: number;
  /** Staff (non-client) members right now. */
  staffCount?: number;
  trialEndsAt?: Date;
  createdBy?: string;
  contactName?: string;
  contactEmail?: string;
```

Add after `Workspace`:

```ts
/** A one-time link that lets someone join a workspace with a given role. */
export interface Invite {
  /** The random document id; it is the secret in the link. */
  id: string;
  workspaceId: string;
  workspaceName: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  status: InviteStatus;
  invitedBy: string;
  createdAt?: Date;
  expiresAt: Date;
  acceptedBy?: string;
  acceptedAt?: Date;
}
```

- [ ] **Step 2: Shared workspace converter** — `src/services/firestore.ts`, replace `getWorkspace` with:

```ts
const toDate = (value: unknown): Date | undefined => (value instanceof Timestamp ? value.toDate() : undefined);

/** Firestore data → Workspace (timestamps become Dates). */
export const toWorkspace = (id: string, data: DocumentData): Workspace => ({
  id,
  ...data,
  divisions: Array.isArray(data.divisions) ? data.divisions : [],
  createdAt: toDate(data.createdAt),
  trialEndsAt: toDate(data.trialEndsAt),
} as Workspace);

// Workspace (company) settings: name, logo, brand colour, divisions, plan.
export const getWorkspace = async (wsId: string): Promise<Workspace | null> => {
  const snapshot = await getDoc(doc(db, 'workspaces', wsId));
  return snapshot.exists() ? toWorkspace(snapshot.id, snapshot.data()) : null;
};
```

(If `toDate` already exists in the file, reuse it instead of redefining.)

- [ ] **Step 3: `src/services/signup.ts`**

```ts
import { collection, doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { planById, TRIAL_DAYS, type PlanId } from '@/config/plans';
import { addDays } from '@/lib/subscription';

export interface CompanySignup {
  plan: PlanId;
  companyName: string;
  name: string;
  email: string;
}

/**
 * Creates a trial company and its founder's admin profile in one batch, for
 * the signed-in login `uid`. firestore.rules accept it only for a login with
 * no profile yet, a self-serve plan with its own limit, and a trial of at most
 * 14 days. Returns the new workspace id.
 */
export async function createCompanyRecords(uid: string, input: CompanySignup): Promise<string> {
  const plan = planById(input.plan);
  if (!plan) throw new Error(`Unknown plan "${input.plan}"`);
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const workspaceRef = doc(collection(db, 'workspaces'));

  const batch = writeBatch(db);
  batch.set(workspaceRef, {
    name: input.companyName.trim(),
    divisions: [],
    status: 'trial',
    plan: plan.id,
    staffLimit: plan.staffLimit,
    staffCount: 1,
    trialEndsAt: addDays(new Date(), TRIAL_DAYS),
    createdBy: uid,
    createdAt: serverTimestamp(),
    contactName: name,
    contactEmail: email,
  });
  batch.set(doc(db, 'users', uid), { name, email, role: 'admin', workspaceId: workspaceRef.id });
  await batch.commit();
  return workspaceRef.id;
}
```

- [ ] **Step 4: `src/services/invites.ts`**

```ts
import {
  collection, doc, getDoc, getDocs, increment, query, serverTimestamp, setDoc,
  Timestamp, updateDoc, where, writeBatch, type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { INVITE_DAYS } from '@/config/plans';
import { addDays, isStaffRole } from '@/lib/subscription';
import type { Invite, UserRole } from '@/types';

const invitesCol = collection(db, 'invites');
const toDate = (value: unknown): Date | undefined => (value instanceof Timestamp ? value.toDate() : undefined);
const withoutEmpty = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));

const toInvite = (id: string, d: DocumentData): Invite => ({
  id,
  ...d,
  createdAt: toDate(d.createdAt),
  expiresAt: toDate(d.expiresAt) ?? new Date(0),
  acceptedAt: toDate(d.acceptedAt),
} as Invite);

export interface NewInvite {
  workspaceId: string;
  workspaceName: string;
  email: string;
  name: string;
  role: UserRole;
  company?: string;
  organizationId?: string;
  invitedBy: string;
}

/** Saves a pending invite. Its random id is the secret part of the link. */
export async function createInvite(input: NewInvite): Promise<Invite> {
  const ref = doc(invitesCol);
  const expiresAt = addDays(new Date(), INVITE_DAYS);
  const fields = withoutEmpty({
    ...input,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
    company: input.company?.trim(),
    status: 'pending',
    expiresAt,
  });
  await setDoc(ref, { ...fields, createdAt: serverTimestamp() });
  return { ...(fields as Omit<Invite, 'id' | 'createdAt'>), id: ref.id, createdAt: new Date(), expiresAt };
}

/** All invites of a workspace, newest first (admins only). */
export async function listInvites(workspaceId: string): Promise<Invite[]> {
  const snapshot = await getDocs(query(invitesCol, where('workspaceId', '==', workspaceId)));
  return snapshot.docs
    .map((d) => toInvite(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export const revokeInvite = (id: string) => updateDoc(doc(invitesCol, id), { status: 'revoked' });

/** Opens one invite by its token; works signed out. */
export async function getInvite(token: string): Promise<Invite | null> {
  const snapshot = await getDoc(doc(invitesCol, token));
  return snapshot.exists() ? toInvite(snapshot.id, snapshot.data()) : null;
}

/**
 * For the signed-in login `uid`: writes their profile from the invite, marks
 * the invite accepted and, for staff, takes one place on the plan — all in one
 * batch, as firestore.rules require.
 */
export async function acceptInviteRecords(uid: string, invite: Invite, name: string): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid), withoutEmpty({
    name: name.trim() || invite.name,
    email: invite.email,
    role: invite.role,
    workspaceId: invite.workspaceId,
    company: invite.company,
    organizationId: invite.organizationId,
    inviteId: invite.id,
  }));
  batch.update(doc(invitesCol, invite.id), { status: 'accepted', acceptedBy: uid, acceptedAt: serverTimestamp() });
  if (isStaffRole(invite.role)) {
    batch.update(doc(db, 'workspaces', invite.workspaceId), { staffCount: increment(1) });
  }
  await batch.commit();
}

/** The link to send. VITE_APP_URL is the app address once deployed; locally it's this origin. */
export const inviteLink = (token: string): string =>
  `${(import.meta.env.VITE_APP_URL as string | undefined) || window.location.origin}/join/${token}`;
```

- [ ] **Step 5: `src/services/platform.ts`**

```ts
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { toWorkspace } from './firestore';
import type { Workspace } from '@/types';

/** The only workspace fields the super admin may change (firestore.rules). */
export type PlanChange = Partial<Pick<Workspace, 'status' | 'plan' | 'staffLimit' | 'trialEndsAt'>>;

/** Every company, by name (super admin only). */
export async function listAllWorkspaces(): Promise<Workspace[]> {
  const snapshot = await getDocs(collection(db, 'workspaces'));
  return snapshot.docs.map((d) => toWorkspace(d.id, d.data())).sort((a, b) => a.name.localeCompare(b.name));
}

export const updateWorkspacePlan = (wsId: string, change: PlanChange) =>
  updateDoc(doc(db, 'workspaces', wsId), change);
```

- [ ] **Step 6: AuthContext — session loading and onboarding**

In `src/contexts/AuthContext.tsx`:

1. Imports: add `writeBatch, increment` to the `firebase/firestore` import; add
   ```ts
   import { createCompanyRecords, type CompanySignup } from '@/services/signup';
   import { acceptInviteRecords } from '@/services/invites';
   import { isStaffRole } from '@/lib/subscription';
   import type { Invite } from '@/types';
   ```
2. Move `fetchUserData` out of the component to module level (unchanged body), so hooks can use it without dependencies.
3. Add module-level:
   ```ts
   // Messages for sign-up / invite-accept failures.
   const onboardingError = (code: string | undefined, deniedMessage: string): string => {
     switch (code) {
       case 'auth/invalid-credential':
       case 'auth/wrong-password':
         return 'This email already has an account. Sign in instead.';
       case 'auth/weak-password':
         return 'Password should be at least 6 characters.';
       case 'auth/invalid-email':
         return 'Please enter a valid email address.';
       case 'auth/network-request-failed':
       case 'unavailable':
         return 'Network problem. Check your connection and try again.';
       case 'permission-denied':
         return deniedMessage;
       default:
         return 'Something went wrong. Please try again.';
     }
   };
   ```
4. Interface additions:
   ```ts
   /** True for the product owner (super admin): /platformOwners/{uid} exists. */
   isOwner: boolean;
   /** Self-serve sign-up: creates the login, the trial company and the admin profile. */
   signUpCompany: (input: CompanySignup & { password: string }) => Promise<true | string>;
   /** Creates the login for an invite and joins its company. */
   joinWithInvite: (invite: Invite, name: string, password: string) => Promise<true | string>;
   ```
5. In the provider, add state/ref and replace the `onAuthStateChanged` effect with:
   ```ts
   const [isOwner, setIsOwner] = useState(false);
   // True while sign-up / invite-accept runs: the login exists a moment before
   // its profile, so the auth listener leaves the session to onboard().
   const onboardingRef = useRef(false);

   // Loads profile, owner flag and colleagues for a signed-in login.
   const applySession = useCallback(async (firebaseUser: FirebaseUser | null) => {
     if (!firebaseUser) {
       workspaceIdRef.current = '';
       setUser(null);
       setAllUsers([]);
       setIsOwner(false);
       return;
     }
     const userData = await fetchUserData(firebaseUser.uid);
     // No profile document means the account was never registered (or was
     // removed). Firestore rules grant such accounts no access, so fall back
     // to the least-privileged role.
     const profile: AppUser = userData || {
       id: firebaseUser.uid,
       email: firebaseUser.email || '',
       name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
       role: 'client'
     };
     workspaceIdRef.current = profile.workspaceId || '';
     const owner = await getDoc(doc(db, 'platformOwners', firebaseUser.uid))
       .then(snapshot => snapshot.exists())
       .catch(() => false);
     setIsOwner(owner);
     setUser(profile);
     if (profile.role === 'client' || !profile.workspaceId) {
       // Clients may only read their own profile (see firestore.rules).
       setAllUsers([profile]);
     } else {
       await refreshUsers();
     }
   }, [refreshUsers]);

   useEffect(() => {
     const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
       if (onboardingRef.current) return;
       setLoading(true);
       await applySession(firebaseUser);
       setLoading(false);
     });
     return () => unsubscribe();
   }, [applySession]);

   // Creates (or, after an earlier half-finished attempt, re-uses) the login,
   // writes the records, then loads the session. Returns true or an error message.
   const onboard = useCallback(async (
     email: string,
     password: string,
     displayName: string,
     writeRecords: (uid: string) => Promise<unknown>,
     deniedMessage: string,
   ): Promise<true | string> => {
     onboardingRef.current = true;
     try {
       let credential;
       try {
         credential = await createUserWithEmailAndPassword(auth, email, password);
       } catch (error) {
         if ((error as { code?: string }).code !== 'auth/email-already-in-use') throw error;
         // An earlier attempt may have created the login but not the profile: finish it.
         credential = await signInWithEmailAndPassword(auth, email, password);
         if (await fetchUserData(credential.user.uid)) {
           await signOut(auth);
           return 'This email already has an account. Sign in instead.';
         }
       }
       await updateFirebaseProfile(credential.user, { displayName }).catch(() => undefined);
       await writeRecords(credential.user.uid);
       await applySession(credential.user);
       return true;
     } catch (error) {
       console.error('Onboarding error:', error);
       if (auth.currentUser) await signOut(auth).catch(() => undefined);
       return onboardingError((error as { code?: string }).code, deniedMessage);
     } finally {
       onboardingRef.current = false;
     }
   }, [applySession]);

   const signUpCompany = useCallback((input: CompanySignup & { password: string }) =>
     onboard(input.email.trim().toLowerCase(), input.password, input.name.trim(),
       uid => createCompanyRecords(uid, input),
       'We could not create your company. Please try again.'), [onboard]);

   const joinWithInvite = useCallback((invite: Invite, name: string, password: string) =>
     onboard(invite.email, password, name.trim(),
       uid => acceptInviteRecords(uid, invite, name),
       'This invite can no longer be used: it may have expired, or the company is full or read-only. Ask your admin for a new one.'),
     [onboard]);
   ```
6. Replace `removeUser` with the counter-aware batch:
   ```ts
   const removeUser = useCallback(async (id: string): Promise<boolean> => {
     try {
       // Deletes the profile, which revokes all data access. The Auth login
       // itself needs the Admin SDK to delete (see TODO.md).
       const target = allUsers.find(u => u.id === id);
       const batch = writeBatch(db);
       batch.delete(doc(db, 'users', id));
       // Staff free one place on the plan (firestore.rules: removing staff).
       if (target && isStaffRole(target.role)) {
         batch.update(doc(db, 'workspaces', workspaceIdRef.current), { staffCount: increment(-1), removedUid: id });
       }
       await batch.commit();
       await refreshUsers();
       if (user?.id === id) {
         await logout();
       }
       return true;
     } catch (error) {
       console.error('Remove user error:', error);
       return false;
     }
   }, [allUsers, refreshUsers, user, logout]);
   ```
7. Add `isOwner, signUpCompany, joinWithInvite` to the `AuthContext.Provider` value object.

- [ ] **Step 7: Verify**

```bash
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run test:unit
```
Expected: clean / 0 errors / PASS. In the running app (http://localhost:8080) sign in as `admin@acme.test` and confirm Dashboard and Projects still load (no console errors).

- [ ] **Step 8: Commit**

```bash
git add src/types/index.ts src/services/firestore.ts src/services/signup.ts src/services/invites.ts src/services/platform.ts src/contexts/AuthContext.tsx
git commit -m "feat: services and auth flows for company sign-up, invites and the super admin"
```

---

### Task 6: Read-only mode and the trial note

**Files:**
- Modify: `src/contexts/WorkspaceContext.tsx`, `src/contexts/DataContext.tsx`, `src/components/layout/MainLayout.tsx`, `src/components/layout/Sidebar.tsx`
- Create: `src/components/subscription/ReadOnlyBanner.tsx`

**Interfaces:**
- Consumes: `workspaceAccess`, `accessLabel`, `readOnlyMessage`, `WorkspaceAccess` (Task 1); `SALES_EMAIL`.
- Produces: `useWorkspace()` gains `access: WorkspaceAccess` and `reloadWorkspace(): Promise<void>`.

- [ ] **Step 1: WorkspaceContext** — import `workspaceAccess, type WorkspaceAccess` from `@/lib/subscription`; add to the interface:

```ts
  /** Plan state: trial days left, and whether writes are allowed (read-only otherwise). */
  access: WorkspaceAccess;
  /** Re-reads the workspace (e.g. after staffCount changed). */
  reloadWorkspace: () => Promise<void>;
```

Add after `updateWorkspace`:

```ts
  const reloadWorkspace = useCallback(async () => {
    if (!wsId) return;
    const ws = await getWorkspace(wsId);
    setLoaded({ forId: wsId, workspace: ws });
  }, [wsId]);
```

In the `useMemo` value add `access: workspaceAccess(workspace, new Date()),` and `reloadWorkspace,`; add `reloadWorkspace` to its dependency list.

- [ ] **Step 2: `src/components/subscription/ReadOnlyBanner.tsx`**

```tsx
import { Lock } from 'lucide-react';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { readOnlyMessage } from '@/lib/subscription';
import { SALES_EMAIL } from '@/config/plans';

/** Shown across the top of the app while the company is read-only. */
export default function ReadOnlyBanner() {
  const { access } = useWorkspace();
  if (access.canWrite) return null;
  return (
    <div role="status" className="flex items-start gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {readOnlyMessage(access.state)} Nothing has been deleted.{' '}
        <a className="font-medium underline" href={`mailto:${SALES_EMAIL}?subject=Choose%20a%20plan`}>
          Contact us to choose a plan
        </a>.
      </span>
    </div>
  );
}
```

- [ ] **Step 3: MainLayout** — import `ReadOnlyBanner from '@/components/subscription/ReadOnlyBanner'` and render `<ReadOnlyBanner />` as the first child of `<main>`, before the `AnnouncementBanner` block.

- [ ] **Step 4: Sidebar trial note (admins)** — import `useWorkspace` and `accessLabel`; in the component:

```tsx
  const { access } = useWorkspace();
  const planNote = user?.role === 'admin' && access.state !== 'active' ? accessLabel(access) : null;
```

Inside `SidebarContent`, right after the logo `<div>` (the one with `<BrandMark size="lg" />`):

```tsx
      {planNote && (
        <Link
          to="/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'mx-3 mt-3 block rounded-md px-3 py-1.5 text-xs font-medium',
            access.canWrite
              ? 'bg-sidebar-accent text-sidebar-accent-foreground'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
          )}
        >
          {planNote}
        </Link>
      )}
```

- [ ] **Step 5: DataContext guard** — add `access` to `const { workspaceId, divisionById } = useWorkspace();`, import `toast` from `@/hooks/use-toast` and `readOnlyMessage` from `@/lib/subscription`, and add before `// CRUD functions`:

```ts
  // Read-only companies (trial ended / suspended): stop writes here with a
  // clear message instead of a raw permission error from Firestore.
  const guard = <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      if (!access.canWrite) {
        const message = readOnlyMessage(access.state);
        toast({ title: 'Read-only', description: message, variant: 'destructive' });
        throw new Error(message);
      }
      return fn(...args);
    };
```

In the provider `value`, wrap all 24 write entries, e.g. `addProject: guard(handleAddProject),` … `deleteFile: guard(handleDeleteFile),`.

- [ ] **Step 6: Verify in the browser** (dev server `crm-dev` on 8080, emulators running, seeded)

- `admin@falcon.test`: amber banner "Your free trial has ended…", sidebar note "Trial ended"; Projects shows PRJ-001; clicking Add Project and saving shows a "Read-only" toast and nothing is created.
- `admin@noor.test`: no banner; sidebar "Trial · 9 days left"; adding a tender works.
- `admin@acme.test`: no banner, no sidebar note.
- `employee@noor.test`: no sidebar note (admins only).
- Then: `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/WorkspaceContext.tsx src/contexts/DataContext.tsx src/components/layout/MainLayout.tsx src/components/layout/Sidebar.tsx src/components/subscription/ReadOnlyBanner.tsx
git commit -m "feat: read-only mode after the trial and a trial note for admins"
```

---

### Task 7: Sign-up page

**Files:**
- Create: `src/components/brand/PublicShell.tsx`, `src/pages/Signup.tsx`
- Modify: `src/App.tsx`, `src/pages/Login.tsx`

**Interfaces:**
- Consumes: `useAuth().signUpCompany`, `isAuthenticated`; `PLANS`, `TRIAL_DAYS`, `SALES_EMAIL`, `PlanId`.
- Produces: `PublicShell({children, wide?})` used by Join (Task 8).

- [ ] **Step 1: `src/components/brand/PublicShell.tsx`**

```tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ProductLogo } from '@/components/brand/BrandMark';
import { PRODUCT_NAME } from '@/config/product';

/** Page frame for signed-out screens (sign-up, invite links). */
export default function PublicShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className={wide ? 'mx-auto max-w-5xl' : 'mx-auto max-w-md'}>
        <Link to="/login" className="mb-8 flex items-center justify-center gap-3">
          <ProductLogo className="h-10 w-10" />
          <span className="text-xl font-bold text-foreground">{PRODUCT_NAME}</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `src/pages/Signup.tsx`**

```tsx
import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2 } from 'lucide-react';
import PublicShell from '@/components/brand/PublicShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, SALES_EMAIL, TRIAL_DAYS, type PlanId } from '@/config/plans';
import { cn } from '@/lib/utils';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(100, 'Keep it under 100 characters'),
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Use at least 6 characters'),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type Values = z.infer<typeof schema>;

const Signup: React.FC = () => {
  const { isAuthenticated, signUpCompany } = useAuth();
  const [plan, setPlan] = useState<PlanId>('team');
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', name: '', email: '', password: '', confirm: '' },
  });

  // Also where a successful sign-up lands: the new session opens the app.
  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (values: Values) => {
    setError('');
    const result = await signUpCompany({
      plan, companyName: values.companyName, name: values.name, email: values.email, password: values.password,
    });
    if (result !== true) setError(result);
  };

  const field = (name: keyof Values, label: string, type = 'text', autoComplete?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: input }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} autoComplete={autoComplete} {...input} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <PublicShell wide>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Start your free trial</h1>
        <p className="mt-2 text-muted-foreground">
          {TRIAL_DAYS} days free, no card needed. Pick a plan by team size; clients are always free.
        </p>
      </div>

      <div role="radiogroup" aria-label="Plan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={plan === p.id}
            onClick={() => setPlan(p.id)}
            className={cn(
              'rounded-xl border bg-card p-5 text-left transition hover:border-primary',
              plan === p.id && 'border-primary ring-2 ring-primary/30'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{p.name}</span>
              {plan === p.id && <Check className="h-4 w-4 text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Up to {p.staffLimit} staff</p>
            <p className="mt-3 text-lg font-bold text-foreground">{p.priceLabel}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
          </button>
        ))}
        <a
          href={`mailto:${SALES_EMAIL}?subject=Enterprise%20plan`}
          className="rounded-xl border border-dashed bg-card p-5 text-left transition hover:border-primary"
        >
          <span className="font-semibold text-foreground">Enterprise</span>
          <p className="mt-1 text-sm text-muted-foreground">More than 50 staff</p>
          <p className="mt-3 text-lg font-bold text-foreground">Contact us</p>
        </a>
      </div>

      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Create your company</CardTitle>
          <CardDescription>You'll be its admin and can invite your team next.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {field('companyName', 'Company name', 'text', 'organization')}
              {field('name', 'Your name', 'text', 'name')}
              {field('email', 'Work email', 'email', 'email')}
              {field('password', 'Password', 'password', 'new-password')}
              {field('confirm', 'Confirm password', 'password', 'new-password')}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start free trial
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </PublicShell>
  );
};

export default Signup;
```

- [ ] **Step 3: Route** — `src/App.tsx`: add `const Signup = lazy(() => import("./pages/Signup"));` with the other lazy pages and `<Route path="/signup" element={<Signup />} />` after the `/login` route.

- [ ] **Step 4: Login link** — `src/pages/Login.tsx`, directly after the sign-in `</form>` (line ~251, the form whose submit button reads "Sign in"):

```tsx
              <p className="mt-6 text-center text-sm text-muted-foreground">
                New company?{' '}
                <Link to="/signup" className="font-medium text-primary hover:underline">Start a free trial</Link>
              </p>
```

- [ ] **Step 5: Verify in the browser**

- `/login` shows "New company? Start a free trial" → `/signup`.
- Submit empty: field errors. Mismatched passwords: "Passwords do not match".
- Sign up "Test Builders", `owner@testbuilders.test`, plan Starter → app opens as admin of "Test Builders", sidebar "Trial · 14 days left", Projects empty, Settings → Company shows the name.
- Sign out; sign up again with `admin@acme.test` + its password → "This email already has an account. Sign in instead."
- Emulator UI: new workspace has `status: trial`, `plan: starter`, `staffLimit: 5`, `staffCount: 1`.
- `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`.

- [ ] **Step 6: Commit**

```bash
git add src/components/brand/PublicShell.tsx src/pages/Signup.tsx src/App.tsx src/pages/Login.tsx
git commit -m "feat: self-serve company sign-up with plan choice and a 14-day trial"
```

---

### Task 8: Join page for invite links

**Files:**
- Create: `src/pages/Join.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `getInvite`, `useAuth().joinWithInvite / isAuthenticated / user / logout`, `inviteState`, `ROLE_LABELS`, `PublicShell`.

- [ ] **Step 1: `src/pages/Join.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Loader2, LogOut } from 'lucide-react';
import PublicShell from '@/components/brand/PublicShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { getInvite } from '@/services/invites';
import { inviteState } from '@/lib/subscription';
import { ROLE_LABELS } from '@/config/roles';
import type { Invite } from '@/types';

type Loaded = { kind: 'loading' } | { kind: 'missing' } | { kind: 'ready'; invite: Invite };

const Message: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <PublicShell>
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  </PublicShell>
);

const Join: React.FC = () => {
  const { token = '' } = useParams();
  const { isAuthenticated, user, logout, joinWithInvite } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getInvite(token)
      .then(invite => {
        if (cancelled) return;
        setLoaded(invite ? { kind: 'ready', invite } : { kind: 'missing' });
        if (invite) setName(invite.name);
      })
      .catch(() => !cancelled && setLoaded({ kind: 'missing' }));
    return () => { cancelled = true; };
  }, [token]);

  if (loaded.kind === 'loading') {
    return <PublicShell><div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></PublicShell>;
  }
  if (loaded.kind === 'missing') {
    return <Message title="This invite link isn't valid">Check you copied the whole link, or ask your admin to send a new one.</Message>;
  }

  const { invite } = loaded;

  if (isAuthenticated) {
    // Straight after joining, the new session lands here: go into the app.
    if (user?.email?.toLowerCase() === invite.email) return <Navigate to="/" replace />;
    return (
      <Message title="You're signed in with another account">
        You're signed in as {user?.email}. Sign out to accept this invite for {invite.email}.
        <Button variant="outline" className="mt-4 flex" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </Message>
    );
  }

  const state = inviteState(invite, new Date());
  if (state === 'revoked') return <Message title="This invite was cancelled">Ask your admin at {invite.workspaceName} for a new one.</Message>;
  if (state === 'expired') return <Message title="This invite has expired">Invite links work for 7 days. Ask your admin at {invite.workspaceName} for a new one.</Message>;
  if (state === 'accepted') {
    return (
      <Message title="This invite has already been used">
        If it was you, <Link to="/login" className="font-medium text-primary hover:underline">sign in</Link> with {invite.email}.
      </Message>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (name.trim().length < 2) return setError('Enter your name.');
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    const result = await joinWithInvite(invite, name, password);
    if (result !== true) {
      setError(result);
      setSaving(false);
    }
  };

  return (
    <PublicShell>
      <Card>
        <CardHeader>
          <CardTitle>Join {invite.workspaceName}</CardTitle>
          <CardDescription>
            You've been invited as <span className="font-medium text-foreground">{ROLE_LABELS[invite.role]}</span>. Choose a password to finish.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="join-email">Email</Label>
              <Input id="join-email" value={invite.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-name">Your name</Label>
              <Input id="join-name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-password">Password</Label>
              <Input id="join-password" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join-confirm">Confirm password</Label>
              <Input id="join-confirm" type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join {invite.workspaceName}
            </Button>
          </form>
        </CardContent>
      </Card>
    </PublicShell>
  );
};

export default Join;
```

- [ ] **Step 2: Route** — `src/App.tsx`: `const Join = lazy(() => import("./pages/Join"));` and `<Route path="/join/:token" element={<Join />} />` after `/signup`.

- [ ] **Step 3: Verify in the browser** (signed out)

- `/join/nope` → "This invite link isn't valid".
- `/join/seed-invite-acme` → "Join Acme Contracting … Employee", email fixed. Mismatched passwords → error. Valid → lands in Acme as Nadia Karim; Settings shows role Employee. Emulator UI: invite `accepted`, `ws-acme.staffCount` went from 4 to 5.
- Open the same link again signed out → "This invite has already been used".
- Signed in as `admin@noor.test`, open any invite link → "You're signed in with another account".
- `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Join.tsx src/App.tsx
git commit -m "feat: join a company from an invite link"
```

---

### Task 9: Team invites in Settings (replaces the registration portal)

**Files:**
- Create: `src/components/settings/TeamInvites.tsx`
- Modify: `src/pages/Settings.tsx`, `src/App.tsx`, `src/contexts/AuthContext.tsx`
- Delete: `src/pages/Register.tsx`

**Interfaces:**
- Consumes: `createInvite`, `listInvites`, `revokeInvite`, `inviteLink`; `inviteState`, `isStaffRole`, `staffSeatsLeft`, `accessLabel`; `planById`; `nextOrganizationId` (`src/lib/workspace.ts`); `ROLE_LABELS`; `useWorkspace().access / reloadWorkspace`.

- [ ] **Step 1: `src/components/settings/TeamInvites.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Loader2, UserPlus, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { createInvite, inviteLink, listInvites, revokeInvite } from '@/services/invites';
import { nextOrganizationId } from '@/lib/workspace';
import { accessLabel, inviteState, isStaffRole, staffSeatsLeft, type InviteState } from '@/lib/subscription';
import { planById } from '@/config/plans';
import { ROLE_LABELS } from '@/config/roles';
import type { Invite, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ORDER: UserRole[] = ['user', 'manager', 'admin', 'client'];
const STATE_BADGE: Record<InviteState, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'default' },
  accepted: { label: 'Joined', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'outline' },
  revoked: { label: 'Revoked', variant: 'destructive' },
};

/** Settings → Team: plan usage, invite form and the list of invites (admins). */
const TeamInvites: React.FC = () => {
  const { user, allUsers } = useAuth();
  const { workspace, access, reloadWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastLink, setLastLink] = useState('');
  const workspaceId = workspace?.id ?? '';

  const load = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setInvites(await listInvites(workspaceId));
    } catch (err) {
      console.error('Error loading invites:', err);
    }
  }, [workspaceId]);

  // Fresh invites and staff count (people may have joined since sign-in).
  useEffect(() => {
    load();
    reloadWorkspace().catch(err => console.error('Error reloading workspace:', err));
  }, [load, reloadWorkspace]);

  const now = new Date();
  const pending = invites.filter(i => inviteState(i, now) === 'pending');
  const seatsLeft = staffSeatsLeft(workspace, pending.filter(i => isStaffRole(i.role)).length);
  const staffFull = seatsLeft === 0;
  const plan = planById(workspace?.plan);
  const planName = plan?.name ?? (workspace?.plan === 'custom' ? 'Custom' : 'Current');
  const staffText = workspace?.staffLimit
    ? `${workspace.staffCount ?? 0} of ${workspace.staffLimit} staff`
    : `${workspace?.staffCount ?? 0} staff (no limit)`;

  // Everyone from one client company shares an organisation id, including
  // people invited but not joined yet.
  const organizationIdFor = (clientName: string) => {
    const key = clientName.trim().toLowerCase();
    const people = [...allUsers, ...invites];
    const known = people.find(p => p.role === 'client' && p.organizationId && (p.company || '').trim().toLowerCase() === key);
    return known?.organizationId || nextOrganizationId(clientName, people.map(p => p.organizationId));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL.test(cleanEmail)) return setError('Enter a valid email address.');
    if (name.trim().length < 2) return setError('Enter their name.');
    if (role === 'client' && company.trim().length < 2) return setError("Enter the client's company.");
    if (isStaffRole(role) && staffFull) return setError('Your plan has no staff places left. Clients can still be invited.');
    if (allUsers.some(u => u.email.toLowerCase() === cleanEmail)) return setError('This person is already in your company.');
    if (pending.some(i => i.email === cleanEmail)) return setError('There is already a pending invite for this email.');
    if (!workspace || !user) return;

    setSaving(true);
    try {
      const invite = await createInvite({
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        email: cleanEmail,
        name: name.trim(),
        role,
        invitedBy: user.id,
        ...(role === 'client' ? { company: company.trim(), organizationId: organizationIdFor(company) } : {}),
      });
      setInvites(prev => [invite, ...prev]);
      setLastLink(inviteLink(invite.id));
      setEmail('');
      setName('');
      setCompany('');
    } catch (err) {
      console.error('Create invite error:', err);
      setError('Could not create the invite. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'Link copied', description: 'Send it to them by email or chat.' });
    } catch {
      toast({ title: 'Copy this link', description: link });
    }
  };

  const revoke = async (invite: Invite) => {
    if (!window.confirm(`Revoke the invite for ${invite.email}? The link will stop working.`)) return;
    try {
      await revokeInvite(invite.id);
      setInvites(prev => prev.map(i => (i.id === invite.id ? { ...i, status: 'revoked' } : i)));
    } catch (err) {
      console.error('Revoke invite error:', err);
      toast({ title: 'Could not revoke the invite', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="font-semibold text-foreground">{planName} plan</span>
        <span className="text-muted-foreground">·</span>
        <span>{accessLabel(access)}</span>
        <span className="text-muted-foreground">·</span>
        <span>{staffText}</span>
        <span className="text-muted-foreground">· clients are free</span>
      </div>

      {access.canWrite ? (
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2" noValidate>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={v => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_ORDER.map(r => (
                  <SelectItem key={r} value={r} disabled={isStaffRole(r) && staffFull}>
                    {ROLE_LABELS[r]}{isStaffRole(r) && staffFull ? ' (plan full)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === 'client' && (
            <div className="space-y-2">
              <Label htmlFor="invite-company">Client company</Label>
              <Input id="invite-company" value={company} onChange={e => setCompany(e.target.value)} />
              {company.trim().length >= 2 && (
                <p className="text-xs text-muted-foreground">Organisation ID: {organizationIdFor(company)}</p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-destructive md:col-span-2">{error}</p>}
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create invite link
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Invites are paused while your company is read-only.</p>
      )}

      {lastLink && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <Link2 className="h-4 w-4 shrink-0 text-primary" />
          <code className="min-w-0 flex-1 truncate text-xs">{lastLink}</code>
          <Button type="button" size="sm" variant="outline" onClick={() => copy(lastLink)}>
            <Copy className="mr-2 h-4 w-4" /> Copy link
          </Button>
        </div>
      )}

      {invites.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Invited</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map(invite => {
                const state = inviteState(invite, now);
                return (
                  <TableRow key={invite.id}>
                    <TableCell>
                      <div className="font-medium">{invite.name}</div>
                      <div className="text-xs text-muted-foreground">{invite.email}</div>
                    </TableCell>
                    <TableCell>{ROLE_LABELS[invite.role]}{invite.company ? ` · ${invite.company}` : ''}</TableCell>
                    <TableCell><Badge variant={STATE_BADGE[state].variant}>{STATE_BADGE[state].label}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">{invite.expiresAt.toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      {state === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => copy(inviteLink(invite.id))} aria-label={`Copy link for ${invite.email}`}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revoke(invite)} aria-label={`Revoke invite for ${invite.email}`}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default TeamInvites;
```

- [ ] **Step 2: Settings** — `src/pages/Settings.tsx`:
  - Import `TeamInvites from '@/components/settings/TeamInvites'` and `useWorkspace`.
  - Rename the `access` tab label "Access Control" → "Team".
  - Replace the whole `{/* Specialized Registration Portals */}` grid (both portal cards, down to its closing `</div>`) with `<TeamInvites />`.
  - In `handleRemoveUser`, after a successful `removeUser`, call `await reloadWorkspace();` (from `const { reloadWorkspace } = useWorkspace();`).
  - Remove imports that are now unused (`useNavigate`/`navigate`, `ExternalLink`, `UserPlus` if unused) so lint stays clean.

- [ ] **Step 3: Remove the old portal**
  - Delete `src/pages/Register.tsx`.
  - `src/App.tsx`: remove the `Register` lazy import and the `/register`, `/registration/employee`, `/registration/client` routes.
  - `src/contexts/AuthContext.tsx`: remove `addUser` (interface, implementation, provider value), `getSecondaryApp`, and imports only it used (`initializeApp`, `getApps`, `firebaseConfig`, `getAuth`, `connectAuthIfEmulated`, `UserRole` if unused).
  - Run `grep -rn "addUser\|registration/\|Register" src` — expect no matches except unrelated words.

- [ ] **Step 4: Verify in the browser** (reseed first: `npm run seed`)

- `admin@noor.test` → Settings → Team: "Starter plan · Trial · 9 days left · 2 of 5 staff · clients are free".
- Invite `site@noor.test` as Employee → link box appears; Copy works; row "Pending".
- Invite two more employees, then a fourth: staff roles show "(plan full)" (2 staff + 3 pending = 5); a Client invite still works and shows "Organisation ID: ORG-…".
- Revoke one invite → row "Revoked"; open its link signed out → "This invite was cancelled".
- Accept one employee invite in a private window → back as admin, Team strip shows "3 of 5 staff".
- Remove that employee in the staff table → strip shows "2 of 5 staff".
- `admin@falcon.test` → Team shows "Invites are paused while your company is read-only."
- `/register` → Not Found page.
- `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/TeamInvites.tsx src/pages/Settings.tsx src/App.tsx src/contexts/AuthContext.tsx
git rm src/pages/Register.tsx
git commit -m "feat: invite staff and clients by link from Settings → Team"
```

---

### Task 10: Platform page for the super admin

**Files:**
- Create: `src/pages/Platform.tsx`
- Modify: `src/App.tsx`, `src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: `listAllWorkspaces`, `updateWorkspacePlan`, `PlanChange`; `workspaceAccess`, `accessLabel`, `extendedTrialEnd`, `AccessState`; `PLANS`, `planById`, `TRIAL_DAYS`; `useAuth().isOwner`.

- [ ] **Step 1: `src/pages/Platform.tsx`**

```tsx
import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import SearchInput from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { listAllWorkspaces, updateWorkspacePlan, type PlanChange } from '@/services/platform';
import { accessLabel, extendedTrialEnd, workspaceAccess, type AccessState } from '@/lib/subscription';
import { PLANS, planById, TRIAL_DAYS } from '@/config/plans';
import type { Workspace } from '@/types';

const STATUS_FILTERS: { value: 'all' | AccessState; label: string }[] = [
  { value: 'all', label: 'All companies' },
  { value: 'trial', label: 'On trial' },
  { value: 'trial-ended', label: 'Trial ended' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];
const BADGE: Record<AccessState, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default', trial: 'secondary', 'trial-ended': 'outline', suspended: 'destructive',
};
const formatDate = (d?: Date) => (d ? d.toLocaleDateString() : '—');

/** Super admin: every company's plan and status. No access to company data. */
const Platform: React.FC = () => {
  const { isOwner } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Workspace[] | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | AccessState>('all');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setCompanies(await listAllWorkspaces());
    } catch (err) {
      console.error('Error loading companies:', err);
      setCompanies([]);
      toast({ title: 'Could not load companies', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    if (isOwner) load();
  }, [isOwner, load]);

  if (!isOwner) return <Navigate to="/" replace />;

  const now = new Date();
  const rows = (companies ?? [])
    .map(ws => ({ ws, access: workspaceAccess(ws, now) }))
    .filter(({ ws, access }) =>
      (filter === 'all' || access.state === filter)
      && ws.name.toLowerCase().includes(search.trim().toLowerCase()));

  const change = async (ws: Workspace, data: PlanChange, done: string) => {
    setBusyId(ws.id);
    try {
      await updateWorkspacePlan(ws.id, data);
      setCompanies(prev => prev?.map(w => (w.id === ws.id ? { ...w, ...data } : w)) ?? null);
      toast({ title: done, description: ws.name });
    } catch (err) {
      console.error('Plan change error:', err);
      toast({ title: 'Change failed', description: ws.name, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const changePlan = (ws: Workspace, planId: string) => {
    const plan = planById(planId);
    change(ws, plan ? { plan: plan.id, staffLimit: plan.staffLimit } : { plan: 'custom', staffLimit: 0 }, 'Plan changed');
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 animate-fade-in pb-10">
        <PageHeader title="Platform" description="Every company using the product: plans, staff and trials." />

        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." />
          <Select value={filter} onValueChange={v => setFilter(v as 'all' | AccessState)}>
            <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTERS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Trial ends</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies === null && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {companies !== null && rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No companies match.</TableCell></TableRow>
              )}
              {rows.map(({ ws, access }) => (
                <TableRow key={ws.id}>
                  <TableCell>
                    <div className="font-medium">{ws.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[ws.contactName, ws.contactEmail].filter(Boolean).join(' · ') || ws.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={planById(ws.plan) ? ws.plan : 'custom'} onValueChange={v => changePlan(ws, v)} disabled={busyId === ws.id}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>{ws.staffCount ?? 0} / {ws.staffLimit ? ws.staffLimit : '∞'}</TableCell>
                  <TableCell><Badge variant={BADGE[access.state]}>{accessLabel(access)}</Badge></TableCell>
                  <TableCell className="hidden lg:table-cell">{ws.status === 'trial' ? formatDate(ws.trialEndsAt) : '—'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{formatDate(ws.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" disabled={busyId === ws.id} aria-label={`Actions for ${ws.name}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {access.state !== 'active' && (
                          <DropdownMenuItem onClick={() => change(ws, { status: 'active' }, 'Activated')}>
                            {access.state === 'suspended' ? 'Reactivate' : 'Activate (paid)'}
                          </DropdownMenuItem>
                        )}
                        {(access.state === 'trial' || access.state === 'trial-ended') && (
                          <DropdownMenuItem onClick={() => change(ws, { status: 'trial', trialEndsAt: extendedTrialEnd(ws.trialEndsAt, new Date(), TRIAL_DAYS) }, `Trial extended by ${TRIAL_DAYS} days`)}>
                            Extend trial by {TRIAL_DAYS} days
                          </DropdownMenuItem>
                        )}
                        {access.state !== 'suspended' && (
                          <DropdownMenuItem className="text-destructive" onClick={() => window.confirm(`Suspend ${ws.name}? Their data becomes read-only.`) && change(ws, { status: 'suspended' }, 'Suspended')}>
                            Suspend
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
};

export default Platform;
```

Before writing, open `src/components/ui/SearchInput.tsx` and match its props (if it takes `onChange(e)` instead of `onChange(value)`, adapt the call).

- [ ] **Step 2: Route** — `src/App.tsx`: `const Platform = lazy(() => import("./pages/Platform"));` and

```tsx
              <Route path="/platform" element={
                <ProtectedRoute>
                  <Platform />
                </ProtectedRoute>
              } />
```

- [ ] **Step 3: Sidebar link** — `src/components/layout/Sidebar.tsx`: import `Building2` from lucide; take `isOwner` from `useAuth()`; build

```tsx
  const visibleItems = isOwner
    ? [...filteredMenuItems, { path: '/platform', icon: Building2, label: 'Platform', roles: [] as string[] }]
    : filteredMenuItems;
```

and map `visibleItems` instead of `filteredMenuItems` in the nav.

- [ ] **Step 4: Verify in the browser**

- `mohamedismayil@gptechnologies.ae` (password 123456): sidebar shows "Platform"; the page lists Acme (Active), Falcon (Trial ended), GP Technologies (Active, Custom, ∞), Noor (Trial · 9 days left) and any company signed up in Task 7.
- Filter "Trial ended" → only Falcon. Search "noor" → only Noor.
- Falcon → Extend trial → badge "Trial · 14 days left"; sign in as `admin@falcon.test`: no banner, adding a project works.
- Noor → plan Team → Staff "2 / 20".
- Acme → Suspend → `admin@acme.test` sees the suspended banner; Reactivate → banner gone.
- `admin@acme.test`: no Platform link; `/platform` redirects home.
- Reseed afterwards (`npm run seed`) to reset demo data.
- `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Platform.tsx src/App.tsx src/components/layout/Sidebar.tsx
git commit -m "feat: Platform page for the super admin to manage company plans"
```

---

### Task 11: Docs and full check

**Files:**
- Modify: `README.md`, `TODO.md`

- [ ] **Step 1: README** —
  - Seed table: add Falcon Builders ("trial ended: read-only", `admin@ / employee@falcon.test`), mark Acme active and Noor on trial, and mention the printed invite link.
  - New section **Sign-up, plans and invites** after "Workspaces and divisions": companies sign up at `/signup` (plan + 14-day trial, plans in `src/config/plans.ts`, limits mirrored in `firestore.rules`); staff count against the limit, clients don't; after the trial or when suspended the company is read-only; admins invite people from **Settings → Team** (7-day links); the super admin (`"platformOwner": true` in `local-accounts.json`) manages plans on **Platform**.
  - Roles section: replace "Accounts are created by an admin from **Settings → Registration portal**…" with "People join through an invite link from **Settings → Team**, or by signing up a new company. A login without a profile (or a workspace) gets no data access."
  - Commands table, `npm run accounts` row: mention `platformOwner`.

- [ ] **Step 2: TODO.md** —
  - Migration list: add "Set `status: 'active'`, `plan: 'custom'`, `staffLimit: 0` and `staffCount` (staff users) on the existing company" and "Create `platformOwners/{owner uid}` with the Admin SDK".
  - New "Before the first deploy" item: "Two Hosting sites: main domain for `/signup` (and later a landing page), `app.` domain for the app; set `VITE_APP_URL` so invite links use the app address."
  - Product list: replace "Company sign-up and team invites" with "Card payment with Stripe (Cloud Functions, Blaze plan): turn trials into paid plans; send invite and sign-up emails; verify sign-up emails."
  - Known gaps: add "Plan prices and `SALES_EMAIL` in `src/config/plans.ts` are placeholders."

- [ ] **Step 3: Full check**

```bash
npm run test:unit
npx tsc --noEmit -p tsconfig.app.json
npm run lint
npm run build
```
Then stop the emulators and run `npm run test:rules`; restart the emulators and `npm run seed`.
Expected: all green.

- [ ] **Step 4: End-to-end walkthrough in the browser**

1. Signed out: `/signup` → create "Walkthrough Ltd" on Starter → lands as admin, "Trial · 14 days left".
2. Settings → Team: invite a manager and a client; copy both links.
3. Private window: accept the manager link → in the app as Manager; accept the client link → sees only Projects.
4. Back as admin: Team strip "2 of 5 staff"; invites show "Joined".
5. Super admin: Platform lists Walkthrough Ltd with 2 / 5 staff; suspend it → the manager sees the read-only banner; reactivate.
6. No console errors throughout (check `read_console_messages`).

- [ ] **Step 5: Commit**

```bash
git add README.md TODO.md
git commit -m "docs: sign-up, plans, invites and the super admin"
```
