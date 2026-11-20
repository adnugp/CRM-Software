# Live data, safe concurrent edits, and the team list

Date: 2026-11-20 · Status: approved design, awaiting spec review

## Why

Partner companies are about to test ProjectDesk with whole teams. Two problems
would hurt them in the first session:

1. **Changes overwrite each other.** Every list is loaded once at sign-in and
   never refreshed. Project tasks, documents and costs are lists stored inside
   one record, and each change saves the *whole list* as this browser last saw
   it. Two people working on the same project silently erase each other's
   work, and nobody sees anyone else's changes without reloading.
2. **Team & HR is always empty.** Tasks and projects are assigned to *logins*
   (`users/{uid}`), but Team & HR and the Registrations assignee filter look
   for *employee records* (`workspaces/{ws}/employees/{id}`), a separate list
   with different ids. Signing up or joining never creates an employee record.
   "Add Member" on Team & HR is kept only in the page's memory.

## Decisions

- **Approach A** (chosen over moving tasks/costs/documents into their own
  records, or refusing stale saves): keep the data where it is, make every list
  live, and save each change as a small edit applied to the newest version.
- **Employees** (owner's choice): every staff login appears in Employees
  automatically; admins can still add people without logins.

## Design

### 1. Live lists

- `src/services/firestore.ts` gains listener functions that call back with the
  current list and return an unsubscribe function:
  `listenCollection(ws, name, onData, onError)` (newest first, same ordering
  and `createdAt` fallback as `getCollection` today),
  `listenProjectsForClient(ws, uid, org, onData, onError)` (merges the
  `clientId` and `organizationId` queries), and
  `listenProjectCosts(ws, projectId, onData, onError)`.
- `DataContext` replaces its one-off `Promise.all` load with listeners for the
  same collections and roles as today (clients: their own projects only).
  Listeners start when a user and workspace are known and stop on sign-out,
  workspace change or unmount. Its public API (lists, `loading`, add / update /
  delete functions) stays the same, so pages keep working.
- Add, update and delete stop patching local state by hand: the listener
  delivers the result (Firestore applies local writes to listeners at once, so
  the screen still updates immediately).
- `AuthContext.refreshUsers` becomes a live listener on the company's people
  (`users` where `workspaceId == ws`), so a colleague who joins shows up
  without a reload. Clients keep reading only their own profile.
- **Load errors**: `DataContext` exposes `loadErrors` (per collection). The
  Projects, Tenders, Employees, Registrations, Payments, Partners and Files
  pages show "Couldn't load … Check your connection and refresh" instead of
  their "No … found" text when a load failed.
- The one-off move of old-style costs (`moveLegacyProjectCosts`) keeps running
  once per session for admins and managers, triggered by the first projects
  snapshot.

### 2. Safe edits to lists inside a project

- New pure module `src/lib/project-lists.ts` (no imports, unit-tested):
  `addItem(list, item)`, `updateItem(list, id, patch)`,
  `removeItem(list, id)` for lists keyed by `id` (tasks, costs), and
  `addDocuments(list, docs)` / `removeDocument(list, url)` for documents, which
  have no `id` and are keyed by their download URL (`data`).
- New service `changeRecordList(ws, collection, id, field, change)` for a list
  field on one record: `tasks`, `documents` and `teamMembers` on projects, and
  `documents` on tenders and files. And `changeProjectCosts(ws, projectId,
  change)` for `projects/{id}/private/costs`. Each runs a Firestore
  transaction: read the newest record, apply `change` (one of the helpers
  above), write only that field. A document change also keeps the legacy
  first-document fields equal to the first document, as today (`documentFile`
  and `document` on projects and tenders, `document` on files).
- `MultiDocumentUpload` reports changes instead of a whole new list:
  `onAdd(docs)` after uploads finish and `onRemove(doc)`. Projects, Tenders and
  Files pass these to `changeRecordList`. (Forms that collect documents before
  a record exists, like the Files upload dialog, keep a local list as today.)
- Every place that saves a whole list switches to these: task add / edit /
  status / delete and task attachments (`ProjectManagement.tsx`), expense add /
  edit / delete, documents on projects, tenders and files, and team members.
- **Project edit form**: `updateProject` from the form sends only the form's
  fields; it never includes `tasks`, `documents`, `teamMembers` or costs.
- **No writes from viewing**: the project page's "profile sync" effect, which
  rewrites task assignee names whenever someone opens a project, is removed.
  Assignee names are looked up from the current people list when shown,
  falling back to the stored name.

### 3. Employees linked to logins

- An employee record for a login has **the same id as the login** and a
  `userId` field equal to it. Records added by hand (people without logins)
  have no `userId`, as today. `Employee` gains `userId?: string`.
- **Created on sign-up and on joining**: `createCompanyRecords` and
  `acceptInviteRecords` (staff roles only) add
  `employees/{uid}` = `{ userId, name, email, department: '', position: '',
  phone: '', joinDate: today, status: 'active', createdAt }` to their existing
  batch. Rules (`employees/{employeeId}` create) also allow this when
  `employeeId == request.auth.uid`, the same batch creates the caller's own
  staff profile in that workspace (`!exists` before, `existsAfter`), and only
  those fields are written.
- **Existing companies are filled in**: when an admin's or manager's session
  has both the people list and the employees list, any staff login without an
  employee record gets one (same shape). Linked records whose login has a
  different name or email are updated to match (the login is the source of
  truth for name and email). This runs again whenever either list changes.
- **Removing a person** marks their linked employee record `inactive` in the
  same batch that removes the profile (records are never deleted
  automatically, so history stays readable).
- **Employees page**: name and email of linked records are read-only there,
  with a note "Linked to a login: change it in their profile". Department,
  position, phone, join date and status stay editable. Linked records can't be
  deleted from Employees (remove the person in Settings → Team instead).
- **Team & HR**: shows the project lead, everyone with a task on the project,
  and members added by hand, each once. "Add Member" / remove save to the
  project's `teamMembers` (list of employee ids) through `changeRecordList`.
  `Project` gains `teamMembers?: string[]`.
- **Registrations** assignee filter needs no change: ids now match.

## Error handling

- A failed listener sets that collection's load error and logs it; the rest of
  the app keeps working. Listeners recover by themselves when the connection
  returns (Firestore behaviour); the error clears on the next snapshot.
- A failed edit transaction rejects as today, so `trySave` shows "Not saved"
  and keeps what was typed. A read-only company is refused by the rules as now.
- The employee fill-in skips silently if the company is read-only (it is a
  convenience, not required for the app to work).

## Testing

- **Unit** (`tests/unit/project-lists.test.mjs`): add / update / remove keep
  other items untouched; updating or removing a missing id changes nothing;
  documents add without duplicating a URL and remove by URL. Plus the pure
  rule that picks which logins need an employee record or a name/email update
  (`src/lib/team.ts`, `tests/unit/team.test.mjs`).
- **Security rules**: a new founder and a new staff invitee can create only
  their own employee record in their joining batch, with only the allowed
  fields; a client can't; nobody can create someone else's linked record that
  way; admins and managers keep full access to employees; project updates
  with `teamMembers` work for staff and not clients.
- **Browser, local data, two signed-in sessions on the same project**: both
  add a task at the same moment and both tasks remain; one changes a task's
  status while the other adds a document and both are kept; each change
  appears in the other session without a refresh; expenses likewise for two
  admins. New sign-up and new invitee appear in Employees and in Team & HR;
  Add Member survives a reload; the Registrations filter matches people;
  removing a person marks them inactive. Failed load shows the error text
  (emulator stopped).

## Out of scope

- Sales lists (deals, companies, contacts) stay loaded once for now.
- Two projects created at the same moment can still get the same number.
- Notifications that return after dismissal, client-view improvements, and
  the other items from the 16 November review.
