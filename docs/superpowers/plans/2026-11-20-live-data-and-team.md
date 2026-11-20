# Live Data, Safe Edits and the Team List — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every list updates live, list fields inside a record are changed one item at a time on the newest version (no more overwrites), and every staff login is an employee so Team & HR works.

**Architecture:** `src/services/firestore.ts` gains Firestore `onSnapshot` listeners and two transaction helpers (`changeRecordList`, `changeProjectCosts`) that apply small pure changes from `src/lib/project-lists.ts`. `DataContext` swaps its one-off load for listeners and stops patching local state. Employee records for logins share the login's id; they are written in the sign-up / join batch and back-filled by admins' and managers' sessions using the pure rules in `src/lib/team.ts`.

**Tech Stack:** React 18, TypeScript, Vite, Firebase JS SDK 12 (Firestore), node:test, @firebase/rules-unit-testing.

**Spec:** `docs/superpowers/specs/2026-11-20-live-data-and-team-design.md`

## Global Constraints

- Test on the local emulators first (`npm run emulators`, `npm run seed`, `npm run dev`); never `npm run dev:live`.
- `npm run test:rules` needs the emulators stopped (they share ports).
- Files under `src/lib/` that unit tests import must have no `@/` imports (type-only relative imports with `.ts` are fine).
- Commit after each task; messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Deploy or push only when the user asks.
- Amounts use `formatMoney` (AED); user-facing text in plain words.
- Don't repeat credential values; local password is `TEST_PASSWORD` in `scripts/emulator-rest.mjs`.

## File Structure

- Create `src/lib/project-lists.ts` — pure list changes (tasks, costs, documents, team ids).
- Create `src/lib/team.ts` — pure: which logins need an employee record or a name/email update; who is on a project's team.
- Create `tests/unit/project-lists.test.mjs`, `tests/unit/team.test.mjs`.
- Modify `src/services/firestore.ts` — listeners, `changeRecordList`, `changeProjectCosts`; remove `getProjectCosts` / `saveProjectCosts`.
- Modify `src/contexts/DataContext.tsx` — listeners, `loadErrors`, no local patches, new list/costs functions, employee fill-in.
- Modify `src/contexts/AuthContext.tsx` — live people list.
- Modify `src/pages/ProjectManagement.tsx` — use the new functions; live costs; no profile-sync write; Team & HR.
- Modify `src/components/ui/MultiDocumentUpload.tsx`, `src/pages/Projects.tsx`, `src/pages/Tenders.tsx`, `src/pages/Files.tsx` — documents as changes.
- Modify `firestore.rules`, `tests/security-rules.test.mjs` — employee record on joining.
- Modify `src/services/signup.ts`, `src/services/invites.ts` — employee record in the batch.
- Modify `src/types/index.ts` — `Employee.userId`, `Project.teamMembers`.
- Modify `src/pages/Employees.tsx`, `src/components/forms/EmployeeForm.tsx`, `src/pages/Settings.tsx` — linked records.
- Modify list pages for load errors: `Projects.tsx`, `Tenders.tsx`, `Employees.tsx`, `Registrations.tsx`, `Payments.tsx`, `Partners.tsx`, `Files.tsx`.
- Modify `scripts/seed-emulator.mjs`, `package.json`, `README.md`.

---

### Task 1: Pure list changes

**Files:**
- Create: `src/lib/project-lists.ts`
- Test: `tests/unit/project-lists.test.mjs`
- Modify: `package.json` (add the test to `test:unit`)

**Interfaces:**
- Produces:
  - `addItem<T extends { id: string }>(list: T[] | undefined, item: T): T[]`
  - `updateItem<T extends { id: string }>(list: T[] | undefined, id: string, patch: Partial<T>): T[]` — keys whose patch value is `undefined` are removed from the item.
  - `removeItem<T extends { id: string }>(list: T[] | undefined, id: string): T[]`
  - `addDocuments<D extends { data: string }>(list: D[] | undefined, docs: D[]): D[]` — skips URLs already present.
  - `removeDocument<D extends { data: string }>(list: D[] | undefined, url: string): D[]`
  - `addId(list: string[] | undefined, id: string): string[]`, `removeId(list: string[] | undefined, id: string): string[]`
  - `type ListChange<T> = (current: T[]) => T[]`

- [ ] **Step 1: Write the failing test** — `tests/unit/project-lists.test.mjs`:

```js
// Unit tests for changing one item in a list stored on a record.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, updateItem, removeItem, addDocuments, removeDocument, addId, removeId } from '../../src/lib/project-lists.ts';

const a = { id: 'a', name: 'A', status: 'pending' };
const b = { id: 'b', name: 'B', status: 'pending' };

test('addItem appends and leaves the others alone', () => {
  assert.deepEqual(addItem([a], b), [a, b]);
  assert.deepEqual(addItem(undefined, a), [a]);
});

test('addItem does not add an id twice', () => {
  assert.deepEqual(addItem([a, b], { ...a, name: 'again' }), [a, b]);
});

test('updateItem changes only the matching item', () => {
  assert.deepEqual(updateItem([a, b], 'b', { status: 'completed' }), [a, { ...b, status: 'completed' }]);
});

test('updateItem removes keys patched to undefined', () => {
  const withFile = { ...a, fileAttachment: { name: 'f', data: 'u' } };
  assert.deepEqual(updateItem([withFile], 'a', { fileAttachment: undefined }), [a]);
});

test('updating or removing a missing id changes nothing', () => {
  assert.deepEqual(updateItem([a], 'zz', { name: 'x' }), [a]);
  assert.deepEqual(removeItem([a], 'zz'), [a]);
});

test('removeItem removes only the matching item', () => {
  assert.deepEqual(removeItem([a, b], 'a'), [b]);
});

test('documents are added without duplicating a URL and removed by URL', () => {
  const d1 = { name: 'one.pdf', size: 1, type: 'application/pdf', data: 'u1' };
  const d2 = { name: 'two.pdf', size: 2, type: 'application/pdf', data: 'u2' };
  assert.deepEqual(addDocuments([d1], [d1, d2]), [d1, d2]);
  assert.deepEqual(addDocuments(undefined, [d2]), [d2]);
  assert.deepEqual(removeDocument([d1, d2], 'u1'), [d2]);
});

test('ids are added once and removed', () => {
  assert.deepEqual(addId(['x'], 'y'), ['x', 'y']);
  assert.deepEqual(addId(['x'], 'x'), ['x']);
  assert.deepEqual(removeId(['x', 'y'], 'x'), ['y']);
  assert.deepEqual(addId(undefined, 'x'), ['x']);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/project-lists.test.mjs`
Expected: FAIL, `ERR_MODULE_NOT_FOUND` for `src/lib/project-lists.ts`.

- [ ] **Step 3: Write the module** — `src/lib/project-lists.ts`:

```ts
// Changing one item in a list stored on a record (project tasks, costs,
// documents, team members). Each function returns a new list and leaves the
// others untouched, so it can be applied to the newest copy of the record in
// a transaction (changeRecordList in src/services/firestore.ts). No imports,
// so the unit tests run this file directly.

export type ListChange<T> = (current: T[]) => T[];

export function addItem<T extends { id: string }>(list: T[] | undefined, item: T): T[] {
  const current = list ?? [];
  return current.some(x => x.id === item.id) ? current : [...current, item];
}

export function updateItem<T extends { id: string }>(list: T[] | undefined, id: string, patch: Partial<T>): T[] {
  return (list ?? []).map(item => {
    if (item.id !== id) return item;
    const next: Record<string, unknown> = { ...item, ...patch };
    for (const [key, value] of Object.entries(patch)) if (value === undefined) delete next[key];
    return next as T;
  });
}

export function removeItem<T extends { id: string }>(list: T[] | undefined, id: string): T[] {
  return (list ?? []).filter(item => item.id !== id);
}

export function addDocuments<D extends { data: string }>(list: D[] | undefined, docs: D[]): D[] {
  const current = list ?? [];
  const have = new Set(current.map(d => d.data));
  return [...current, ...docs.filter(d => !have.has(d.data))];
}

export function removeDocument<D extends { data: string }>(list: D[] | undefined, url: string): D[] {
  return (list ?? []).filter(d => d.data !== url);
}

export function addId(list: string[] | undefined, id: string): string[] {
  const current = list ?? [];
  return current.includes(id) ? current : [...current, id];
}

export function removeId(list: string[] | undefined, id: string): string[] {
  return (list ?? []).filter(x => x !== id);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/unit/project-lists.test.mjs`
Expected: 8 tests pass.

- [ ] **Step 5: Add to the unit-test command** — in `package.json`, append ` tests/unit/project-lists.test.mjs` to the end of the `test:unit` file list (after `tests/unit/payment-alerts.test.mjs`). Run `npm run test:unit`; expected all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/project-lists.ts tests/unit/project-lists.test.mjs package.json
git commit -m "feat: pure helpers to change one item in a stored list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Pure team rules

**Files:**
- Create: `src/lib/team.ts`
- Test: `tests/unit/team.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `type Person = { id: string; name: string; email: string; role: string }`
  - `type EmployeeLike = { id: string; name: string; email: string; userId?: string; status?: string }`
  - `employeeSync(people: Person[], employees: EmployeeLike[]): { create: Person[]; update: { id: string; name: string; email: string }[] }` — staff roles only (`admin`, `manager`, `user`); `create` = staff with no employee record of the same id; `update` = linked records (`userId === id`) whose name or email differ from the login. Records without `userId` that happen to share an id are left alone.
  - `newEmployeeRecord(person: { id: string; name: string; email: string }, today: string)` → `{ userId, name, email, department: '', position: '', phone: '', joinDate: today, status: 'active' }`
  - `projectTeamIds(project: { assignedTo?: string; tasks?: { assignedTo?: string }[]; teamMembers?: string[] }): string[]` — lead, task assignees, members; unique, order kept, empty values dropped.

- [ ] **Step 1: Write the failing test** — `tests/unit/team.test.mjs`:

```js
// Unit tests for linking logins to employee records and building a project team.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { employeeSync, newEmployeeRecord, projectTeamIds } from '../../src/lib/team.ts';

const people = [
  { id: 'u1', name: 'Aisha', email: 'aisha@a.test', role: 'admin' },
  { id: 'u2', name: 'Priya', email: 'priya@a.test', role: 'user' },
  { id: 'c1', name: 'Client Co', email: 'c@c.test', role: 'client' },
];

test('staff logins without a record are created; clients never', () => {
  const { create } = employeeSync(people, [{ id: 'u1', name: 'Aisha', email: 'aisha@a.test', userId: 'u1' }]);
  assert.deepEqual(create.map(p => p.id), ['u2']);
});

test('a linked record follows the login name and email', () => {
  const { update } = employeeSync(people, [
    { id: 'u1', name: 'Old Name', email: 'aisha@a.test', userId: 'u1' },
    { id: 'u2', name: 'Priya', email: 'priya@a.test', userId: 'u2' },
  ]);
  assert.deepEqual(update, [{ id: 'u1', name: 'Aisha', email: 'aisha@a.test' }]);
});

test('records added by hand are left alone', () => {
  const { create, update } = employeeSync(people, [
    { id: 'u1', name: 'Hand made', email: 'x@x.test' },
    { id: 'u2', name: 'Priya', email: 'priya@a.test', userId: 'u2' },
    { id: 'e9', name: 'Site worker', email: '' },
  ]);
  assert.deepEqual(create, []);
  assert.deepEqual(update, []);
});

test('a new record carries the login and empty HR fields', () => {
  assert.deepEqual(newEmployeeRecord({ id: 'u2', name: 'Priya', email: 'priya@a.test' }, '2026-11-20'), {
    userId: 'u2', name: 'Priya', email: 'priya@a.test', department: '', position: '', phone: '', joinDate: '2026-11-20', status: 'active',
  });
});

test('a project team is the lead, task assignees and members, each once', () => {
  assert.deepEqual(
    projectTeamIds({ assignedTo: 'u1', tasks: [{ assignedTo: 'u2' }, { assignedTo: 'u1' }, { assignedTo: '' }], teamMembers: ['e9', 'u2'] }),
    ['u1', 'u2', 'e9'],
  );
  assert.deepEqual(projectTeamIds({}), []);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test tests/unit/team.test.mjs`
Expected: FAIL, `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write the module** — `src/lib/team.ts`:

```ts
// Linking logins to employee records, and who is on a project's team.
// No imports, so the unit tests run this file directly.

export type Person = { id: string; name: string; email: string; role: string };
export type EmployeeLike = { id: string; name: string; email: string; userId?: string; status?: string };

const STAFF = ['admin', 'manager', 'user'];

/**
 * What to write so every staff login has an employee record with the same id,
 * and linked records keep the login's name and email (the login is the source
 * of truth for those two). Records added by hand (no userId) are left alone.
 */
export function employeeSync(people: Person[], employees: EmployeeLike[]) {
  const byId = new Map(employees.map(e => [e.id, e]));
  const create: Person[] = [];
  const update: { id: string; name: string; email: string }[] = [];
  for (const person of people) {
    if (!STAFF.includes(person.role)) continue;
    const record = byId.get(person.id);
    if (!record) create.push(person);
    else if (record.userId === person.id && (record.name !== person.name || record.email !== person.email)) {
      update.push({ id: person.id, name: person.name, email: person.email });
    }
  }
  return { create, update };
}

/** The employee record for a login (id = the login's uid). */
export function newEmployeeRecord(person: { id: string; name: string; email: string }, today: string) {
  return {
    userId: person.id, name: person.name, email: person.email,
    department: '', position: '', phone: '', joinDate: today, status: 'active' as const,
  };
}

/** The project lead, everyone with a task on it, and members added by hand: each once. */
export function projectTeamIds(project: { assignedTo?: string; tasks?: { assignedTo?: string }[]; teamMembers?: string[] }): string[] {
  const ids = [project.assignedTo, ...(project.tasks ?? []).map(t => t.assignedTo), ...(project.teamMembers ?? [])];
  return [...new Set(ids.filter((id): id is string => !!id))];
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `node --test tests/unit/team.test.mjs`
Expected: 5 tests pass.

- [ ] **Step 5: Add to the unit-test command** — append ` tests/unit/team.test.mjs` to `test:unit` in `package.json`. Run `npm run test:unit`; all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/team.ts tests/unit/team.test.mjs package.json
git commit -m "feat: pure rules for linking logins to employees and project teams

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Listeners and transaction helpers in the service layer

**Files:**
- Modify: `src/services/firestore.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: `ListChange<T>` from `src/lib/project-lists.ts`.
- Produces (all exported from `src/services/firestore.ts`):
  - `type Unsubscribe = () => void`
  - `listenCollection<T>(wsId: string, collectionName: string, onData: (items: T[]) => void, onError: (e: unknown) => void): Unsubscribe`
  - `listenProjectsForClient(wsId: string, uid: string, organizationId: string | undefined, onData: (items: Project[]) => void, onError: (e: unknown) => void): Unsubscribe`
  - `listenProjectCosts(wsId: string, projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void): Unsubscribe`
  - `changeRecordList<T>(wsId: string, collectionName: 'projects' | 'tenders' | 'files', id: string, field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>): Promise<void>`
  - `changeProjectCosts(wsId: string, projectId: string, change: ListChange<ProjectCost>): Promise<void>`
  - Removed: `getProjectCosts`, `saveProjectCosts` (replaced by the two above).
- Types: `Employee.userId?: string`; `Project.teamMembers?: string[]`.

- [ ] **Step 1: Types** — in `src/types/index.ts`, add to `interface Employee` after `status`:

```ts
  /** Set when this record belongs to a login (same id as the login). Name and email then follow the login. */
  userId?: string;
```

and to `interface Project` after `costs?: ProjectCost[];`:

```ts
  /** Employee ids added to the team by hand (Team & HR). */
  teamMembers?: string[];
```

- [ ] **Step 2: Imports** — in `src/services/firestore.ts` add `onSnapshot` to the `firebase/firestore` import list, and below the existing imports add:

```ts
import type { ListChange } from '@/lib/project-lists';
```

- [ ] **Step 3: Listeners** — add after `getCollection`:

```ts
export type Unsubscribe = () => void;

// Live version of getCollection: calls onData with the whole list now and on
// every change (including this browser's own writes, at once). Ordered newest
// first; records without createdAt are kept (sorted last) instead of dropped.
export const listenCollection = <T>(
  wsId: string,
  collectionName: string,
  onData: (items: T[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe =>
  onSnapshot(
    wsCollection(wsId, collectionName),
    snapshot => {
      const items = snapshot.docs.map(d => fromDoc<T & { createdAt?: Date }>(d));
      items.sort((x, y) => (y.createdAt?.getTime?.() ?? 0) - (x.createdAt?.getTime?.() ?? 0));
      onData(items as T[]);
    },
    onError,
  );

// Clients may only read projects linked to them (firestore.rules), so they
// listen to two queries (by uid, by organization) and the results are merged.
export const listenProjectsForClient = (
  wsId: string,
  uid: string,
  organizationId: string | undefined,
  onData: (items: Project[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe => {
  const queries = [query(wsCollection(wsId, 'projects'), where('clientId', '==', uid))];
  if (organizationId) queries.push(query(wsCollection(wsId, 'projects'), where('organizationId', '==', organizationId)));
  const results: Map<string, Project>[] = queries.map(() => new Map());
  const emit = () => {
    const merged = new Map<string, Project>();
    results.forEach(r => r.forEach((p, id) => merged.set(id, p)));
    onData([...merged.values()]);
  };
  const stops = queries.map((q, i) =>
    onSnapshot(q, snapshot => {
      results[i] = new Map(snapshot.docs.map(d => [d.id, fromDoc<Project>(d)]));
      emit();
    }, onError),
  );
  return () => stops.forEach(stop => stop());
};

export const listenProjectCosts = (
  wsId: string,
  projectId: string,
  onData: (costs: ProjectCost[]) => void,
  onError: (e: unknown) => void,
): Unsubscribe =>
  onSnapshot(costsDoc(wsId, projectId), snapshot => {
    const costs = snapshot.data()?.costs;
    onData(Array.isArray(costs) ? costs : []);
  }, onError);
```

(`costsDoc` is defined further down in the file; move the existing `const costsDoc = ...` line up so it sits above `listenProjectCosts`.)

- [ ] **Step 4: Transaction helpers** — replace the existing `getProjectCosts` and `saveProjectCosts` functions with:

```ts
// The first document is also kept in older single-document fields that some
// screens still read: documentFile + document on projects and tenders,
// document on files.
const firstDocumentFields = (collectionName: string, docs: unknown[]): Record<string, unknown> => {
  const first = docs[0] as { name?: string } | undefined;
  if (collectionName === 'files') return { document: first ?? deleteField() };
  return { documentFile: first ?? deleteField(), document: first?.name ?? deleteField() };
};

/**
 * Changes one list field on a record (project tasks, documents or team
 * members; tender and file documents) by applying `change` to the newest
 * copy in a transaction, so two people editing at once both keep their work.
 */
export const changeRecordList = async <T>(
  wsId: string,
  collectionName: 'projects' | 'tenders' | 'files',
  id: string,
  field: 'tasks' | 'documents' | 'teamMembers',
  change: ListChange<T>,
): Promise<void> => {
  const ref = wsDoc(wsId, collectionName, id);
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) throw new Error(`${collectionName}/${id} no longer exists`);
    const current = snapshot.data()[field];
    const next = change(Array.isArray(current) ? (current as T[]) : []);
    const update: Record<string, unknown> = { [field]: removeUndefined(next) };
    if (field === 'documents') Object.assign(update, firstDocumentFields(collectionName, next as unknown[]));
    tx.update(ref, update);
  });
};

/** Same as changeRecordList, for a project's staff-only costs record. */
export const changeProjectCosts = async (wsId: string, projectId: string, change: ListChange<ProjectCost>): Promise<void> => {
  const ref = costsDoc(wsId, projectId);
  await runTransaction(db, async (tx) => {
    const current = (await tx.get(ref)).data()?.costs;
    tx.set(ref, { costs: removeUndefined(change(Array.isArray(current) ? current : [])) });
  });
};
```

- [ ] **Step 5: Type-check** — Run: `npx tsc --noEmit -p tsconfig.app.json`. Expected: errors only in `src/contexts/DataContext.tsx` about `getProjectCosts` / `saveProjectCosts` (fixed in Task 4). No other errors.

- [ ] **Step 6: Commit** (together with Task 4, since the app doesn't compile between them — do not commit yet; continue to Task 4).

---

### Task 4: DataContext goes live

**Files:**
- Modify: `src/contexts/DataContext.tsx`

**Interfaces:**
- Consumes: Task 3 functions; `employeeSync`, `newEmployeeRecord` from `src/lib/team.ts` (used in Task 8 — not here).
- Produces on the context (replacing `getProjectCosts` / `saveProjectCosts`):
  - `loadErrors: Partial<Record<CollectionKey, true>>` where `CollectionKey = 'projects' | 'tenders' | 'employees' | 'registrations' | 'payments' | 'subscriptions' | 'partners' | 'files'`
  - `changeRecordList: <T>(collectionName: 'projects' | 'tenders' | 'files', id: string, field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>) => Promise<void>` (guarded by `useWriteGuard`)
  - `watchProjectCosts: (projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void) => Unsubscribe`
  - `changeProjectCosts: (projectId: string, change: ListChange<ProjectCost>) => Promise<void>` (guarded; moves legacy costs first, as `handleSaveProjectCosts` does today)

- [ ] **Step 1: Imports** — replace the `getProjects, getProjectsForClient, ...` and `getProjectCosts as fetchProjectCosts, saveProjectCosts as storeProjectCosts, moveLegacyProjectCosts,` lines so the import includes `listenCollection, listenProjectsForClient, listenProjectCosts, changeRecordList as changeListOnRecord, changeProjectCosts as changeCostsOnProject, moveLegacyProjectCosts, type Unsubscribe` (keep all the `add*/update*/delete*` imports; drop every `get*` list import). Add `import type { ListChange } from '@/lib/project-lists';`.

- [ ] **Step 2: Interface** — in `DataContextType`, replace the two costs lines with:

```ts
  /** Collections that failed to load (connection or permission problem). */
  loadErrors: Partial<Record<CollectionKey, true>>;
  /** Changes one list field (tasks, documents, team members) on the newest copy of a record. */
  changeRecordList: <T>(collectionName: 'projects' | 'tenders' | 'files', id: string, field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>) => Promise<void>;
  /** Live costs of one project: admins and managers only (firestore.rules). */
  watchProjectCosts: (projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void) => Unsubscribe;
  /** Changes a project's costs on the newest copy. */
  changeProjectCosts: (projectId: string, change: ListChange<ProjectCost>) => Promise<void>;
```

and above the interface:

```ts
type CollectionKey = 'projects' | 'tenders' | 'employees' | 'registrations' | 'payments' | 'subscriptions' | 'partners' | 'files';
```

- [ ] **Step 3: Replace the loading effect** — replace the whole `useEffect` that defines `fetchData` (from `// Fetch data whenever the signed-in user changes.` through its closing `}, [authLoading, userId, userRole, userOrganizationId, workspaceId, canWrite]);`) with:

```ts
  const [loadErrors, setLoadErrors] = useState<Partial<Record<CollectionKey, true>>>({});
  const movedLegacyCosts = useRef(false);

  // Live lists while signed in. Firestore rules require a signed-in user, and
  // data from a previous session must not linger after logout. Every change
  // (other people's, and this browser's own writes) arrives through these.
  useEffect(() => {
    if (authLoading) return;
    if (!userId || !workspaceId) {
      setProjects([]); setTenders([]); setEmployees([]); setRegistrations([]);
      setPayments([]); setSubscriptions([]); setPartners([]); setFiles([]);
      setLoading(allLoaded(false));
      setLoadErrors({});
      return;
    }

    setLoading(allLoaded(true));
    setLoadErrors({});
    movedLegacyCosts.current = false;
    const isClient = userRole === 'client';

    const handlers = <T,>(key: CollectionKey, set: (items: T[]) => void) => ({
      onData: (items: T[]) => {
        set(items);
        setLoading(prev => ({ ...prev, [key]: false }));
        setLoadErrors(prev => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      },
      onError: (error: unknown) => {
        console.error(`Error loading ${key}:`, error);
        setLoading(prev => ({ ...prev, [key]: false }));
        setLoadErrors(prev => ({ ...prev, [key]: true }));
      },
    });

    const live = <T,>(key: CollectionKey, set: (items: T[]) => void): Unsubscribe => {
      const h = handlers<T>(key, set);
      return listenCollection<T>(workspaceId, key, h.onData, h.onError);
    };

    const stops: Unsubscribe[] = [];
    if (isClient) {
      const h = handlers<Project>('projects', setProjects);
      stops.push(listenProjectsForClient(workspaceId, userId, userOrganizationId, h.onData, h.onError));
      // Clients read nothing else.
      setTenders([]); setEmployees([]); setRegistrations([]); setPayments([]);
      setSubscriptions([]); setPartners([]); setFiles([]);
      setLoading(prev => ({ ...allLoaded(false), projects: prev.projects }));
    } else {
      stops.push(
        live<Project>('projects', setProjects),
        live<Tender>('tenders', setTenders),
        live<Employee>('employees', setEmployees),
        live<Registration>('registrations', setRegistrations),
        live<Payment>('payments', setPayments),
        live<Subscription>('subscriptions', setSubscriptions),
        live<Partner>('partners', setPartners),
        live<FileRecord>('files', setFiles),
      );
    }
    return () => stops.forEach(stop => stop());
  }, [authLoading, userId, userRole, userOrganizationId, workspaceId]);

  // Older versions saved costs on the project record, which clients can read.
  // Once per session, an admin or manager moves any that are left into the
  // staff-only costs record (only while the company can be changed).
  useEffect(() => {
    if (movedLegacyCosts.current || loading.projects || !canSeeProjectCosts(userRole) || !canWrite || !workspaceId) return;
    movedLegacyCosts.current = true;
    for (const project of projects) {
      if (project.costs === undefined) continue;
      moveLegacyProjectCosts(workspaceId, project.id)
        .catch(error => console.error(`Could not move the costs of project ${project.id}:`, error));
    }
  }, [projects, loading.projects, userRole, canWrite, workspaceId]);
```

Add `useRef` to the React import. Delete the now-unused `withoutLegacyCosts` helper.

- [ ] **Step 4: Stop patching local state** — in every `handle*` function, delete each line that calls `setProjects(…)`, `setTenders(…)`, `setEmployees(…)`, `setRegistrations(…)`, `setPayments(…)`, `setSubscriptions(…)`, `setPartners(…)` or `setFiles(…)`, and the `const newX = { createdAt: new Date(), ...x, id };` lines that only fed them. Keep everything else (ids, auto-created projects from awarded tenders, guards). The listeners deliver the result. After this, `grep -n "set\(Projects\|Tenders\|Employees\|Registrations\|Payments\|Subscriptions\|Partners\|Files\)(" src/contexts/DataContext.tsx` must show only the lines inside the listener effect from Step 3.

- [ ] **Step 5: Costs and list functions** — replace `loadProjectCosts` and `handleSaveProjectCosts` with:

```ts
  const watchProjectCosts = useCallback(
    (projectId: string, onData: (costs: ProjectCost[]) => void, onError: (e: unknown) => void) =>
      listenProjectCosts(workspaceId, projectId, onData, onError),
    [workspaceId],
  );

  const handleChangeProjectCosts = async (projectId: string, change: ListChange<ProjectCost>) => {
    // A record still carrying old-style costs: fold them in first, so the
    // change applies to the full list.
    if (projects.find(p => p.id === projectId)?.costs !== undefined) {
      await moveLegacyProjectCosts(workspaceId, projectId);
    }
    await changeCostsOnProject(workspaceId, projectId, change);
  };

  const handleChangeRecordList = <T,>(
    collectionName: 'projects' | 'tenders' | 'files', id: string,
    field: 'tasks' | 'documents' | 'teamMembers', change: ListChange<T>,
  ) => changeListOnRecord<T>(workspaceId, collectionName, id, field, change);
```

In the context value, replace `getProjectCosts: loadProjectCosts, saveProjectCosts: guard(handleSaveProjectCosts),` with:

```ts
      loadErrors,
      watchProjectCosts,
      changeProjectCosts: guard(handleChangeProjectCosts),
      changeRecordList: guard(handleChangeRecordList) as DataContextType['changeRecordList'],
```

- [ ] **Step 6: Type-check** — Run `npx tsc --noEmit -p tsconfig.app.json`. Expected: errors only in `src/pages/ProjectManagement.tsx` (uses `getProjectCosts` / `saveProjectCosts`; fixed in Task 5).

- [ ] **Step 7: Continue to Task 5 before committing** (the app compiles again at the end of Task 5).

---

### Task 5: Project page uses safe edits and live costs

**Files:**
- Modify: `src/pages/ProjectManagement.tsx`

**Interfaces:**
- Consumes: `changeRecordList`, `watchProjectCosts`, `changeProjectCosts` from `useData()`; `addItem`, `updateItem`, `removeItem`, `addId` from `@/lib/project-lists`; `projectTeamIds` from `@/lib/team` (Team & HR is finished in Task 9).

- [ ] **Step 1: Imports and context** — change `const { projects, employees, updateProject, getProjectCosts, saveProjectCosts, loading } = useData();` to `const { projects, employees, loading, changeRecordList, watchProjectCosts, changeProjectCosts } = useData();` and add `import { addItem, updateItem, removeItem, addId } from '@/lib/project-lists';`. (Leave `updateProject` out unless another use remains; `tsc` will tell you.)

- [ ] **Step 2: Live costs** — replace the `useEffect` that calls `getProjectCosts(projectId)` with:

```tsx
    useEffect(() => {
        if (!projectId || !canSeeCosts) return;
        return watchProjectCosts(
            projectId,
            list => setLoadedCosts({ forId: projectId, list }),
            error => {
                console.error('Error loading project costs:', error);
                toast({ title: "Couldn't load this project's costs", description: 'Refresh the page to try again.', variant: 'destructive' });
            },
        );
    }, [projectId, canSeeCosts, watchProjectCosts]);
```

Delete the `saveCosts` helper.

- [ ] **Step 3: Remove the write-on-view** — delete the whole "GPT-0032: Profile sync" `useEffect` (it calls `updateProject(project.id, { tasks: updatedTasks })`). Add, next to `getDisplayName`:

```tsx
    // Current name of a task's assignee (people can rename themselves); falls
    // back to the name stored on the task.
    const assigneeName = (task: ProjectTask) =>
        allUsers.find(u => u.id === task.assignedTo)?.name
        || employees.find(e => e.id === task.assignedTo)?.name
        || task.assignedToName;
```

and replace every `task.assignedToName` used for display in the JSX with `assigneeName(task)` (search `assignedToName}` in the render).

- [ ] **Step 4: Tasks** — replace the bodies:
  - In `handleAddTask` replace `const updatedTasks = [...(project.tasks || []), newTask];\n        await updateProject(project.id, { tasks: updatedTasks });` with `await changeRecordList<ProjectTask>('projects', project.id, 'tasks', list => addItem(list, newTask));`
  - `handleUpdateTaskStatus`: `await changeRecordList<ProjectTask>('projects', project.id, 'tasks', list => updateItem(list, taskId, { status: newStatus as ProjectTask['status'] }));`
  - `handleDeleteTask`: `await changeRecordList<ProjectTask>('projects', project.id, 'tasks', list => removeItem(list, taskId));`
  - In `handleTaskAttachmentUpload` replace the `updatedTasks` / `updateProject` pair with `await changeRecordList<ProjectTask>('projects', project.id, 'tasks', list => updateItem(list, taskId, { fileAttachment }));` where `const taskId = pendingTaskId;` is captured at the top of the function (after the `!pendingTaskId` check).
  - `handleTaskAttachmentRemove`: `await changeRecordList<ProjectTask>('projects', project.id, 'tasks', list => updateItem(list, taskId, { fileAttachment: undefined }));`

- [ ] **Step 5: Costs** — in `handleAddCost`:
  - editing: `await changeProjectCosts(project.id, list => updateItem(list, editingCost.id, data as Partial<ProjectCost>));`
  - adding: `await changeProjectCosts(project.id, list => addItem(list, newCost));`
  - `handleDeleteCost`: `await changeProjectCosts(project.id, list => removeItem(list, costId));`

- [ ] **Step 6: Team members saved** — replace `handleAddMember` / `handleRemoveMember` and the `teamMembers` state:

```tsx
    const handleAddMember = async (employeeId: string) => {
        await changeRecordList<string>('projects', project.id, 'teamMembers', list => addId(list, employeeId));
    };
```

Delete `const [teamMembers, setTeamMembers] = useState<string[]>([]);` and `handleRemoveMember` (it has no button). Add `const teamMembers = project?.teamMembers ?? [];` next to `const tasks = project.tasks || [];` (Task 9 replaces the Team & HR list itself).

- [ ] **Step 7: Type-check and lint** — `npx tsc --noEmit -p tsconfig.app.json` (expected: clean) and `npm run lint` (expected: 0 errors).

- [ ] **Step 8: Check on local data** — `npm run emulators` + `npm run seed` + `npm run dev`. Sign in as `admin@acme.test`; open `/projects/prj-1`: tasks, costs and Executive Report show as before; add a task, change its status, attach a file, remove it, add/edit/delete an expense; reload — all kept. In the emulator, the project record still has no `costs` field.

- [ ] **Step 9: Commit Tasks 3–5**

```bash
git add src/services/firestore.ts src/types/index.ts src/contexts/DataContext.tsx src/pages/ProjectManagement.tsx
git commit -m "feat: live lists; project tasks, costs and team saved one change at a time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documents as changes (projects, tenders, files)

**Files:**
- Modify: `src/components/ui/MultiDocumentUpload.tsx`, `src/pages/Projects.tsx`, `src/pages/Tenders.tsx`, `src/pages/Files.tsx`

**Interfaces:**
- Produces: `MultiDocumentUpload` props `{ documents: DocumentFile[]; onAdd: (docs: DocumentFile[]) => void | Promise<void>; onRemove: (doc: DocumentFile) => void | Promise<void>; readOnly?: boolean }` (replaces `onChange`).
- Consumes: `changeRecordList`, `addDocuments`, `removeDocument`.

- [ ] **Step 1: Component** — in `MultiDocumentUpload.tsx` change the props interface to the one above; in `handleFiles` replace `onChange([...documents, ...uploaded]);` with `await onAdd(uploaded);`; replace `handleRemove` with:

```tsx
  const handleRemove = async (doc: DocumentFile) => {
    await onRemove(doc);
    toast({ title: 'Document removed', description: `"${doc.name}" has been removed.` });
  };
```

and update its call site in the JSX from `handleRemove(index)` to `handleRemove(doc)` (the mapped item).

- [ ] **Step 2: Projects page** — replace `selectedProjectForDoc` state with `const [docProjectId, setDocProjectId] = useState<string | null>(null);` and `const docProject = projects.find(p => p.id === docProjectId) ?? null;` (live). `handleOpenDocumentDialog(project)` sets the id. Replace `handleDocumentsChange` with:

```tsx
  const docsOf = (p: Project) => p.documents?.length ? p.documents : (p.documentFile ? [p.documentFile] : []);
  const handleAddDocuments = (docs: DocumentFile[]) =>
    docProject && changeRecordList<DocumentFile>('projects', docProject.id, 'documents', list => addDocuments(list.length ? list : docsOf(docProject), docs));
  const handleRemoveDocument = (doc: DocumentFile) =>
    docProject && changeRecordList<DocumentFile>('projects', docProject.id, 'documents', list => removeDocument(list.length ? list : docsOf(docProject), doc.data));
```

Pass `documents={docProject ? docsOf(docProject) : []} onAdd={handleAddDocuments} onRemove={handleRemoveDocument}`. (`docsOf` covers older records that only have `documentFile`.)

- [ ] **Step 3: Project edit form saves only form fields** — in `handleFormSubmit`, keep `const projectData = { ...data, assignedToName, clientId, clientName, organizationId }`; confirm `ProjectFormData` (zod schema in `ProjectForm.tsx`) has no `tasks`, `documents`, `teamMembers` or `costs` keys. Add a guard comment above the update call: `// Form fields only: tasks, documents and team are changed through changeRecordList.`

- [ ] **Step 4: Tenders page** — same as Step 2 with `tenders`, `'tenders'`, `docTenderId`, `docTender`.

- [ ] **Step 5: Files page** — the "documents" dialog for an existing record: same pattern with `files`, `'files'`, and `docsOf = (f: FileRecord) => f.documents?.length ? f.documents : (f.document ? [f.document] : [])`. The upload dialog for a *new* file keeps its local list: `onAdd={docs => setUploadDocuments(prev => addDocuments(prev, docs))} onRemove={doc => setUploadDocuments(prev => removeDocument(prev, doc.data))}`.

- [ ] **Step 6: Type-check and lint** — clean.

- [ ] **Step 7: Check on local data** — as admin: on `/projects` open a project's documents, add three files at once, remove one, reload: two remain; same on `/tenders` and on an existing record in `/files`; create a new file record with two documents.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/MultiDocumentUpload.tsx src/pages/Projects.tsx src/pages/Tenders.tsx src/pages/Files.tsx
git commit -m "fix: documents on projects, tenders and files are added and removed one change at a time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Live people list

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Listener** — add `onSnapshot` to the `firebase/firestore` import, then after `refreshUsers` add:

```tsx
  // Staff see their company's people live, so someone who joins shows up
  // without a reload. Clients keep reading only their own profile.
  const staffWorkspace = user && user.role !== 'client' ? user.workspaceId || '' : '';
  useEffect(() => {
    if (!staffWorkspace) return;
    return onSnapshot(
      query(collection(db, 'users'), where('workspaceId', '==', staffWorkspace)),
      snapshot => setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AppUser[]),
      error => console.error('Error loading people:', error),
    );
  }, [staffWorkspace]);
```

Keep `refreshUsers` (still used after profile edits; harmless).

- [ ] **Step 2: Check** — two browser sessions on local data: admin on Settings → Team; in the other, accept an invite (Task 8's join flow works already for profiles): the new person appears in the admin's list without a reload.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat: the people list updates live for staff

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Every staff login is an employee

**Files:**
- Modify: `firestore.rules`, `tests/security-rules.test.mjs`, `src/services/signup.ts`, `src/services/invites.ts`, `src/contexts/DataContext.tsx`, `src/pages/Settings.tsx`, `src/pages/Employees.tsx`, `src/components/forms/EmployeeForm.tsx`, `scripts/seed-emulator.mjs`

**Interfaces:**
- Consumes: `employeeSync`, `newEmployeeRecord` from `src/lib/team.ts`.

- [ ] **Step 1: Failing rules tests** — append to `tests/security-rules.test.mjs`:

```js
describe('employee record on joining', () => {
  const today = '2026-11-20';
  const record = (uid, email, over = {}) => ({
    userId: uid, name: 'New', email, department: '', position: '', phone: '', joinDate: today, status: 'active', ...over,
  });

  it('a founder writes their own employee record in the sign-up batch', async () => {
    const fs = as('founder2', 'f2@new.dev');
    const batch = fs.batch();
    const ws = fs.collection('workspaces').doc('wsNew2');
    batch.set(ws, { name: 'New 2', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1, trialEndsAt: inDays(60), createdBy: 'founder2', createdAt: new Date() });
    batch.set(ws.collection('private').doc('billing'), { contactName: 'F', contactEmail: 'f2@new.dev', billingCycle: 'monthly' });
    batch.set(fs.collection('users').doc('founder2'), { name: 'F', email: 'f2@new.dev', role: 'admin', workspaceId: 'wsNew2' });
    batch.set(ws.collection('employees').doc('founder2'), record('founder2', 'f2@new.dev'));
    await assertSucceeds(batch.commit());
  });

  it('only for yourself, only with the allowed fields, only while joining', async () => {
    const fs = as('founder3', 'f3@new.dev');
    const make = (empId, rec) => {
      const batch = fs.batch();
      const ws = fs.collection('workspaces').doc('wsNew3');
      batch.set(ws, { name: 'New 3', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1, trialEndsAt: inDays(60), createdBy: 'founder3', createdAt: new Date() });
      batch.set(ws.collection('private').doc('billing'), { contactName: 'F', contactEmail: 'f3@new.dev', billingCycle: 'monthly' });
      batch.set(fs.collection('users').doc('founder3'), { name: 'F', email: 'f3@new.dev', role: 'admin', workspaceId: 'wsNew3' });
      batch.set(ws.collection('employees').doc(empId), rec);
      return batch.commit();
    };
    await assertFails(make('someoneElse', record('someoneElse', 'f3@new.dev')));
    await assertFails(make('founder3', record('founder3', 'f3@new.dev', { salary: 1 })));
    await assertFails(make('founder3', record('founder3', 'other@new.dev')));
  });

  it("an existing employee can't write their own employee record", async () => {
    await assertFails(as('employee', 'employee@a.dev').collection('workspaces').doc('wsA').collection('employees').doc('employee').set(record('employee', 'employee@a.dev')));
  });

  it('admins and managers still manage employees; clients cannot', async () => {
    await assertSucceeds(db('manager').collection('workspaces').doc('wsA').collection('employees').doc('e-hand').set({ name: 'Site worker', email: '', department: '', position: '', phone: '', joinDate: today, status: 'active' }));
    await assertFails(db('clientA').collection('workspaces').doc('wsA').collection('employees').doc('e-x').set({ name: 'x' }));
  });

  it('staff can save team members on a project; clients cannot', async () => {
    await assertSucceeds(db('employee').collection('workspaces').doc('wsA').collection('projects').doc('p-by-client').update({ teamMembers: ['employee'] }));
    await assertFails(db('clientA').collection('workspaces').doc('wsA').collection('projects').doc('p-by-client').update({ teamMembers: ['clientA'] }));
  });
});
```

(`employee@a.dev` is the fixture email of the `employee` login in the `users` fixture at the top of the file.)

- [ ] **Step 2: Run them to see the founder test fail** — stop the emulators, `npm run test:rules`. Expected: "a founder writes their own employee record…" FAILS; the others pass or fail as the rule is missing.

- [ ] **Step 3: Rule** — in `firestore.rules`, replace the `match /employees/{employeeId}` block with:

```
      match /employees/{employeeId} {
        allow read: if inWs(ws) && isStaff();
        allow create: if (canWrite(ws) && role() in ['admin', 'manager'])
          || ownEmployeeRecordOnJoining(ws, employeeId);
        allow update, delete: if canWrite(ws) && role() in ['admin', 'manager'];
      }
```

and add, next to the other helper functions near the top:

```
    // A person signing up a company or accepting a staff invite writes their
    // own employee record (same id as their login) in the same batch that
    // creates their profile. Only the basic fields, only for themselves.
    function ownEmployeeRecordOnJoining(ws, employeeId) {
      let uid = request.auth.uid;
      let d = request.resource.data;
      return request.auth != null && employeeId == uid
        && !exists(/databases/$(database)/documents/users/$(uid))
        && existsAfter(/databases/$(database)/documents/users/$(uid))
        && getAfter(/databases/$(database)/documents/users/$(uid)).data.workspaceId == ws
        && isStaffRole(getAfter(/databases/$(database)/documents/users/$(uid)).data.role)
        && d.keys().hasOnly(['userId', 'name', 'email', 'department', 'position', 'phone', 'joinDate', 'status', 'createdAt'])
        && d.userId == uid
        && d.email == authEmail()
        && d.name is string && d.name.size() <= 100
        && d.status == 'active';
    }
```

- [ ] **Step 4: Run the rules tests** — `npm run test:rules`. Expected: all pass.

- [ ] **Step 5: Write it in the batches** — `src/services/signup.ts`, inside `createCompanyRecords` before `await batch.commit();`:

```ts
  // The founder is also the company's first employee (same id as the login).
  batch.set(doc(db, 'workspaces', workspaceRef.id, 'employees', uid), {
    ...newEmployeeRecord({ id: uid, name, email }, new Date().toISOString().slice(0, 10)),
    createdAt: serverTimestamp(),
  });
```

`src/services/invites.ts`, inside `acceptInviteRecords` in the `if (isStaffRole(invite.role))` block:

```ts
    batch.set(doc(db, 'workspaces', invite.workspaceId, 'employees', uid), {
      ...newEmployeeRecord({ id: uid, name: name.trim() || invite.name, email: invite.email }, new Date().toISOString().slice(0, 10)),
      createdAt: serverTimestamp(),
    });
```

Import `newEmployeeRecord` from `@/lib/team` in both (and `serverTimestamp` in invites if missing).

- [ ] **Step 6: Fill in existing companies** — first add to `src/services/firestore.ts`:

```ts
/** Writes an employee record with a chosen id (a login's uid). */
export const setEmployee = (wsId: string, id: string, data: Record<string, unknown>) =>
  setDoc(wsDoc(wsId, 'employees', id), { ...data, createdAt: serverTimestamp() });
```

Then in `DataContext.tsx` import `setEmployee` (and the service `updateEmployee`, already imported) from `@/services/firestore` and `employeeSync`, `newEmployeeRecord` from `@/lib/team`, and add:

```ts
  // Every staff login has an employee record with the same id; linked records
  // follow the login's name and email. Admins' and managers' sessions fill in
  // whatever is missing (e.g. people who joined before this existed).
  useEffect(() => {
    if (!workspaceId || !canWrite || !['admin', 'manager'].includes(userRole || '') || loading.employees) return;
    const { create, update } = employeeSync(allUsers, employees);
    const today = new Date().toISOString().slice(0, 10);
    for (const person of create) {
      setEmployee(workspaceId, person.id, newEmployeeRecord(person, today))
        .catch(error => console.error(`Could not add ${person.name} to Employees:`, error));
    }
    for (const change of update) {
      updateEmployee(workspaceId, change.id, { name: change.name, email: change.email })
        .catch(error => console.error(`Could not update employee ${change.id}:`, error));
    }
  }, [allUsers, employees, loading.employees, workspaceId, canWrite, userRole]);
```

(`allUsers` from `useAuth()` is already destructured at the top of the provider; `employeeSync` takes `{ id, name, email, role }`, which `AppUser` satisfies.)

- [ ] **Step 7: Removing a person marks them inactive** — in `Settings.tsx` `handleRemoveUser`, after `if (success) {` add:

```ts
                    if (employees.some(e => e.id === id)) {
                        await updateEmployee(id, { status: 'inactive' }).catch(() => undefined);
                    }
```

with `const { employees, updateEmployee } = useData();` at the top of the component.

- [ ] **Step 8: Linked records on the Employees page** — `EmployeeForm.tsx`: add prop `linked?: boolean`; on the name and email `<Input>` add `readOnly={linked}` and, when `linked`, render below the email field:

```tsx
{linked && <p className="text-xs text-muted-foreground">Linked to a login: name and email follow their profile.</p>}
```

`Employees.tsx`: pass `linked={!!editingEmployee?.userId}`; hide the delete button when `employee.userId` is set (show a small "Login" badge instead: `<span className="text-[10px] text-muted-foreground">Login</span>`).

- [ ] **Step 9: Seed** — in `scripts/seed-emulator.mjs`, the staff employee record written with `putIn(id, 'employees', res.localId, { … })` (inside `createWorkspace`) gets `userId: res.localId,` added to its fields, so local data matches the new shape. The hand-made `emp-former` record stays without `userId`.

- [ ] **Step 10: Type-check, lint, unit, rules** — all clean.

- [ ] **Step 11: Check on local data** — sign up a new company: its founder is in Employees (department empty). Invite and join an employee: they appear in Employees (live, Task 7). Remove them in Settings → Team: their employee record turns Inactive. Edit a linked record: name/email read-only, position editable.

- [ ] **Step 12: Commit**

```bash
git add firestore.rules tests/security-rules.test.mjs src/services/signup.ts src/services/invites.ts src/services/firestore.ts src/contexts/DataContext.tsx src/pages/Settings.tsx src/pages/Employees.tsx src/components/forms/EmployeeForm.tsx scripts/seed-emulator.mjs
git commit -m "feat: every staff login is an employee record (same id)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Team & HR shows the real team

**Files:**
- Modify: `src/pages/ProjectManagement.tsx`

- [ ] **Step 1: Team list** — next to `const teamMembers = …` add:

```tsx
    // Lead, task assignees and members added by hand; ids now match employee
    // records because every login's employee record shares its id.
    const teamEmployees = projectTeamIds(project)
        .map(id => employees.find(e => e.id === id))
        .filter((e): e is Employee => !!e);
```

(import `projectTeamIds` from `@/lib/team`.) In the Team & HR tab, replace both `[...new Set([...employees.filter(e => … ), …])]` expressions with `teamEmployees` (the `.map(…)` rendering and the `.length === 0` empty check).

- [ ] **Step 2: Add Member list** — in the Add Member dialog, the choices are `employees.filter(e => e.status !== 'inactive' && !projectTeamIds(project).includes(e.id))`; clicking one calls `handleAddMember(e.id)` and closes the dialog.

- [ ] **Step 3: Check** — as admin on a project: Team & HR shows the lead and task assignees; Add Member adds someone, reload: still there; in a second session the member appears without a reload.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ProjectManagement.tsx
git commit -m "fix: Team & HR shows the project's real team, and Add Member is saved

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Say when a list failed to load

**Files:**
- Modify: `src/pages/Projects.tsx`, `src/pages/Tenders.tsx`, `src/pages/Employees.tsx`, `src/pages/Registrations.tsx`, `src/pages/Payments.tsx`, `src/pages/Partners.tsx`, `src/pages/Files.tsx`

- [ ] **Step 1: Each page** — get `loadErrors` from `useData()`; where the page renders its "No … found" text, render instead when `loadErrors.<collection>` is set:

```tsx
<p className="p-8 text-center text-destructive">Couldn't load {label}. Check your connection and refresh the page.</p>
```

with `label` = "projects", "tenders", "employees", "registrations", "payments" (Payments page: `loadErrors.payments || loadErrors.subscriptions` → "payments and subscriptions"), "partners", "files".

- [ ] **Step 2: Check** — with the app open on local data, stop the Firestore emulator, then reload a list page: the error text shows (not "No … found"). Start it again and reload: data returns.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Projects.tsx src/pages/Tenders.tsx src/pages/Employees.tsx src/pages/Registrations.tsx src/pages/Payments.tsx src/pages/Partners.tsx src/pages/Files.tsx
git commit -m "fix: list pages say when loading failed instead of showing an empty list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Two-person verification and docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Automated** — stop emulators; `npm run test:rules` (all pass), `npm run test:unit` (all pass), `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint` (0 errors), `npm run build`.

- [ ] **Step 2: Two sessions on one project** (emulators + seed + dev). Firebase keeps one signed-in user per browser profile, so the second person must be in a separate profile: the built-in browser pane for one person (`admin@acme.test`) and the user's Chrome (or a script using the Firebase JS SDK against the emulator) for the other (`manager@acme.test`).
  - Both open `/projects/prj-1` → Tasks. Both add a task within seconds: both tasks remain, and each appears in the other session without a refresh.
  - One changes a task's status while the other adds a document on `/projects`: both kept.
  - Two admins add an expense each at the same time: both kept, totals match in both.
  - One adds a team member: it appears in the other's Team & HR.
- [ ] **Step 3: README** — under the data/workspaces section add a short paragraph: lists are live (`listenCollection`); list fields inside records change through `changeRecordList` / `changeProjectCosts` transactions; every staff login has an employee record with the same id (`src/lib/team.ts`).
- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: live data, safe list edits and linked employees

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
