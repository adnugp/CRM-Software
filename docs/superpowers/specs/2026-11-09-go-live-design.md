# Go-live preparation: design

**Date:** 9 November 2026
**Branch:** `redesign` (37 commits ahead of `main`, fast-forward possible)
**Goal:** Prepare everything needed to put the multi-company ProjectDesk on the live
Firebase project `crm-gpt-2026`, so that go-live is a short, checked list of commands.
Nothing touches live data or deploys until the user says so.

## Why now

The live database rules on `main` allow anyone, signed in or not, to read, change and
delete every record until 11 March 2027. The project address is public in every web page.
Deploying the new role-based rules closes that hole, but they deny the old top-level layout,
so the live data has to be moved into a workspace first.

## Decisions

| Question | Decision |
|---|---|
| Company name | The existing live data becomes the workspace **Grow Plus Technologies** (id `grow-plus`). |
| Old "belongs to" field (GPT / SDE) | **Dropped.** No divisions. `belongsTo` is removed from projects, tenders and registrations, and the old `company` field from files. Existing numbers such as `PRJ-GPT-001` stay on their records as text; new projects get `PRJ-001`, `PRJ-002`, … so they can't collide. |
| Web address | **One address**, `https://crm-gpt-2026.web.app`, as today. No second Hosting site or custom domain now. `VITE_APP_URL` stays unset, so invite links use that address. |
| Access for the migration | **No key.** The script uses the Firestore REST API without credentials while the old open rules still apply, then the new rules are deployed straight after. The user only needs `firebase login` for deploying. |
| Super admin | `mohamedismayil@gptechnologies.ae` (matched by email in `users`). |

## 1. Migration script

`scripts/migrate-live.mjs`, run as `npm run migrate -- <step> [args]`. It talks to Firestore
over REST, so the same code works against the emulator (`127.0.0.1:8085`, project `demo-crm`,
`Bearer owner`) and live (`firestore.googleapis.com`, project `crm-gpt-2026`, the public web
API key, no auth).

Pure conversion logic lives in `scripts/lib/migration.mjs` and is unit-tested. It works on
Firestore REST documents (`{ name, fields }`) directly, so dates, numbers and nested maps
pass through unchanged and the backup is lossless.

### Steps

- **`backup --source live|emulator`**: reads these top-level collections, with paging:
  `projects`, `tenders`, `employees`, `registrations`, `payments`, `subscriptions`,
  `partners`, `files`, `users`. Writes `backups/<source>-<YYYY-MM-DD-HHmm>.json`
  (`backups/` is git-ignored) with each collection's raw REST documents. It only reads.
- **`plan <backup-file>`**: dry run. Prints:
  - record counts per collection;
  - the workspace it will create, with the staff count;
  - each user's email, role and whether they become the super admin;
  - **warnings**: a client user with neither a matching `clientId` nor an
    `organizationId` on any project; a project linked to a client by neither field;
    a user with no role or an unknown role; records without `createdAt` (lists sort by it);
    the super admin email not found among users.

  Nothing is written.
- **`apply <backup-file> --target emulator|live [--emulator-logins]`**: writes, in
  batches of up to 500 through `documents:commit`:
  1. `workspaces/grow-plus`: `name: 'Grow Plus Technologies'`, `divisions: []`,
     `status: 'active'`, `plan: 'custom'`, `staffLimit: 0` (no limit),
     `staffCount` = users whose role is admin, manager or user, `createdAt` = now.
  2. Every record copied to `workspaces/grow-plus/<collection>/<same id>`, with
     `belongsTo` removed (and `company` removed from `files`). All other fields unchanged.
  3. Every `users/{uid}`: `workspaceId: 'grow-plus'` added (update mask, so the rest of the
     profile is untouched).
  4. `platformOwners/{uid}` for the super admin: `{ email, createdAt }`.

  `--target live` asks the user to type `crm-gpt-2026` before writing anything.
  Running `apply` twice is safe: it overwrites the same documents.
  `--emulator-logins` (emulator only) also creates a local login for every user with
  their real uid and email and the seed's `TEST_PASSWORD`, so the real data can be
  checked on localhost by signing in as each person.
- **The old top-level records are left in place.** The new rules hide them; they're the
  fallback if go-live is rolled back, and can be deleted a few weeks later.
- **Uploaded files are not moved.** Records store download URLs, which carry their own
  access token and keep working under the new storage rules.

### Error handling

- Any failed request stops the script with the HTTP status and message. Because `apply`
  is idempotent, the fix is to rerun it.
- `apply` refuses a backup file that doesn't contain all nine collections.
- Live mode never deletes anything.

## 2. Testing

- **Unit tests** (`tests/unit/migration.test.mjs`, added to `test:unit`): field removal per
  collection, the workspace document, staff count, user update, super admin lookup and each
  `plan` warning.
- **End to end on the emulators:**
  1. A fixture of old-layout data (`scripts/fixtures/old-layout.mjs`) is written to the
     emulator's top level: a few records per collection, GPT and SDE `belongsTo` values,
     a client user and project, one record without `createdAt`.
  2. `backup --source emulator` → `plan` → `apply --target emulator --emulator-logins`.
  3. Sign in as the migrated admin and client, check that lists, project numbers, the
     client's projects and Settings → Team (staff count) are right.
- **A copy of the real data** (after the user runs `firebase login`): `backup --source live`
  (read-only), then `apply` it to the emulators with `--emulator-logins`, so the user can
  click through their real data on localhost before go-live.

## 3. Other preparation

- **Forms that close before saving:** project costs, tasks, partners, payments, and any
  other form found doing the same (subscriptions, registrations, files are checked). Apply
  the pattern already used by the project, tender and employee forms: `await` the save,
  show "Not saved" and keep the form open on failure.
- **Go-live checklist:** `docs/go-live.md` with the exact commands and order:
  1. `npx firebase login` (the user).
  2. Checks: `npm run lint`, `npm run test:unit`, `npm run test:rules`, `npx tsc --noEmit`,
     `npm run build`.
  3. Merge `redesign` into `main` (fast-forward).
  4. At a quiet time: `backup --source live`, `plan`, `apply --target live`.
  5. **Straight away:** `npx firebase deploy --only firestore:rules,storage,hosting`.
     Edits made in the old app between steps 4 and 5 would be lost, so these run minutes apart.
  6. Smoke test on the live address: sign in as admin, open projects and tenders, check a
     client login, Settings → Team, the Platform page.
  7. Rollback: Hosting → previous release in the Firebase console, plus redeploying the old
     rules. The old top-level data is untouched, so the old app works again.
- **TODO.md and README:** update the go-live section to match these decisions and point to
  `docs/go-live.md`.

## Out of scope

- A second Hosting site or custom domain.
- Deleting the old top-level records.
- Moving old files in Storage.
- Stripe, emails and removing logins (they need the Blaze plan).

## Approvals still needed at go-live

The merge into `main`, the live `backup`, the live `apply` and every deploy each need the
user's go-ahead at the time.
