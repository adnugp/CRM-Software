# Workspaces and Neutral Branding: Implementation Plan

> Executed inline in the session that wrote it (the user asked to build straight
> away). Each task ends with `tsc` + `lint` + the relevant tests green and a commit.

**Goal:** Remove the Sadeem Energy and Grow Plus Technologies names from the code
and isolate each customer company in its own workspace, with its own divisions and
branding.

**Architecture:** Business data moves under `workspaces/{wsId}/…`.
`users/{uid}.workspaceId` links a login to its workspace. A new
`WorkspaceContext` loads the workspace (branding and divisions) between
`AuthProvider` and `DataProvider`. `belongsTo` becomes `divisionId`, which looks
up the workspace's divisions.

**Tech stack:** React 18, TypeScript, Vite, Firebase JS SDK 12, Firestore and
Storage rules, `@firebase/rules-unit-testing` v5, `node --test`. Node 24 runs `.ts`
files directly, which is how the pure helpers are unit-tested.

**Spec:** `docs/superpowers/specs/2026-11-04-workspaces-and-branding-design.md`

## Global constraints

- **Product name:** placeholder `ProjectDesk`, defined only in `src/config/product.ts`.
- **No company names in the code:** no `Sadeem`, `Grow Plus`, `SadeemGPT`, `gp-logo` or
  `gptechnologies` anywhere under `src/`, `index.html` or `public/` (checked with grep).
- **Roles stay** `admin | manager | user | client`.
- **Division `code`:** 2–4 uppercase letters. Project numbers are `PRJ-{code}-NNN`,
  or `PRJ-NNN` when there's no division.
- **Client organisation IDs:** `ORG-{initials}-NNN`, counted within the workspace.
- **Local only:** never deploy, never use `dev:live`.

---

### Task 1: Workspace-scoped security rules (TDD)

**Files:**
- Modify: `tests/security-rules.test.mjs`
- Modify: `firestore.rules`
- Modify: `storage.rules`

- [ ] **Rewrite the tests for workspace paths.** Profiles get `workspaceId: 'wsA'`,
  plus `adminB` in `wsB`. Data goes under `workspaces/wsA/...` and `workspaces/wsB/...`.
  Add these cases:
  - admin of A cannot read B's projects or B's workspace document;
  - admin of A cannot create a user with `workspaceId: 'wsB'`;
  - admin of A cannot move a user to B;
  - a user cannot change their own `workspaceId`;
  - staff listing users must filter by workspace (an unfiltered list fails);
  - a client can read their own workspace document but not update it;
  - an admin can update their workspace's branding but not B's;
  - Storage: `workspaces/wsA/documents` is staff of A only;
  - Storage: `workspaces/wsA/branding` is readable by members and writable by an admin, images under 2 MB.
- [ ] **Run** `npm run test:rules` and confirm it FAILS (the rules still use top-level paths).
- [ ] **Rewrite** `firestore.rules`:
  - helpers `me()` and `inWs(ws)`, plus the role helpers;
  - `match /workspaces/{ws}` and `match /workspaces/{ws}/{coll}/{id}`, with special cases for `projects` and `employees`;
  - `users`: same-workspace checks and an immutable `workspaceId`.
- [ ] **Rewrite** `storage.rules` with `workspaces/{ws}/documents|task-attachments|branding`; `avatars` stays.
- [ ] **Run** `npm run test:rules` and confirm it PASSES.
- [ ] **Commit:** `feat(rules): isolate data per workspace`

### Task 2: Pure helpers for divisions and numbering (TDD)

**Files:**
- Create: `src/lib/workspace.ts` (no imports, so Node can run it directly)
- Create: `tests/unit/workspace.test.mjs`
- Modify: `package.json` (add a `test:unit` script)

**Interfaces (produced):**
```ts
export interface Division { id: string; name: string; code: string }
export const DIVISION_CODE = /^[A-Z]{2,4}$/;
export function nextProjectNumber(existing: (string | undefined)[], code?: string): string
  // nextProjectNumber(['PRJ-BLD-001','PRJ-BLD-004'], 'BLD') === 'PRJ-BLD-005'
  // nextProjectNumber(['PRJ-001'], undefined) === 'PRJ-002'
export function nextOrganizationId(clientName: string, existing: (string | undefined)[]): string
  // nextOrganizationId('Acme Facilities LLC', ['ORG-AFL-001']) === 'ORG-AFL-002'
export function divisionColor(index: number): string   // Tailwind classes from a fixed palette
export function newDivisionId(): string
```

- [ ] Write the tests, run them and see them fail, implement, run them and see them pass, then **commit:** `feat: division and numbering helpers`.

### Task 3: Workspace plumbing (data layer and auth)

**Files:**
- Modify: `src/types/index.ts`:
  - add `Workspace`;
  - add `workspaceId` to `User`;
  - replace `ParentCompany`/`belongsTo` with `divisionId?: string` on Project, Tender and Registration;
  - add `divisionId` to FileRecord, replacing its company field.
- Modify: `src/services/firestore.ts`: every function takes `wsId` first and uses
  `collection(db, 'workspaces', wsId, name)`. Add `getWorkspace(wsId)` and `updateWorkspace(wsId, data)`.
- Create: `src/contexts/WorkspaceContext.tsx`:
  - `useWorkspace()` returns `{ workspace, workspaceId, divisions, divisionById, updateWorkspace, loading }`;
  - applies the brand colour to `--primary`, `--ring` and `--sidebar-primary`.
- Modify: `src/contexts/AuthContext.tsx`:
  - `refreshUsers` uses `where('workspaceId','==',ws)`;
  - `addUser` writes `workspaceId`;
  - remove the unused `register`.
- Modify: `src/contexts/DataContext.tsx`:
  - use `workspaceId`;
  - use `nextProjectNumber` with the division code;
  - carry `divisionId` from an awarded tender to the project it creates.
- Modify: the storage paths in `DocumentUpload.tsx`, `MultiDocumentUpload.tsx` and `ProjectManagement.tsx` become `workspaces/{ws}/…`.
- Modify: `src/App.tsx`: add `WorkspaceProvider`, plus a "not linked to a company" screen for signed-in users with no `workspaceId`.

### Task 4: Divisions replace Sadeem / Grow Plus in the UI

**Files:**
- **Forms:** `ProjectForm`, `TenderForm` and `RegistrationForm` get an optional
  division select, hidden when there are no divisions.
- **Pages:**
  - `Projects`, `Tenders` and `Registrations`: division filter and badge, hidden without divisions;
  - `Files`: division filter and upload field;
  - `ProjectManagement`: badge, and a PDF footer using the workspace name and `PRODUCT_NAME`;
  - `Register`: remove the SAD/GP picker and use `nextOrganizationId`.
- **Chatbot:** `crmChatEngine.ts` takes divisions in its data input, matches them by name or code, and uses generic example prompts. `AIChatbotWidget` passes divisions in.
- **Notifications:** `EmailAlertSettings` gets a neutral placeholder.

### Task 5: Product brand and the Settings → Company tab

**Files:**
- Create: `src/config/product.ts` (`PRODUCT_NAME`, `PRODUCT_TAGLINE`) and `src/components/brand/BrandMark.tsx` (inline SVG).
- Modify: `index.html` (title, SVG favicon). Create `public/favicon.svg`. Delete `public/gp-logo.png` and `src/assets/gp-logo.png`.
- Modify: `Sidebar.tsx` (workspace logo and name, falling back to the product brand) and `Login.tsx` (product brand).
- Create: `src/components/settings/CompanySettings.tsx`:
  - name, logo upload to `workspaces/{ws}/branding/`, brand colour, and a divisions editor;
  - the editor blocks deleting a division that's in use and shows the usage count;
  - managers see it read-only.
- Modify: `Settings.tsx` to add the **Company** tab.

### Task 6: Seed, local accounts, docs and verification

- `scripts/seed-emulator.mjs`: two workspaces. `wsAcme` has divisions BLD and ENG, staff and two clients. `wsNoor` has no divisions, a manager, an employee and a client.
- `scripts/local-accounts.mjs` and the example file: a `workspace` block `{ id, name, divisions }`, written to `workspaces/{id}`, with `workspaceId` set on each user.
- README (workspaces, divisions, product name) and TODO (the live-data migration).
- **Verify:**
  - `test:rules`, `test:unit`, `tsc`, `lint` and `build` all pass;
  - the grep for company names in `src`, `dist` and `index.html` returns nothing;
  - browser check on localhost:
    - each workspace's admin sees only their own data;
    - project numbers come out right;
    - the Company tab saves;
    - a client sees only their own projects;
    - the brand colour applies.
