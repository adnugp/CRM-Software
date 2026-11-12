# Going live

How to put the multi-company ProjectDesk on the live Firebase project `crm-gpt-2026`.
Do the steps in order. Design: `docs/superpowers/specs/2026-11-09-go-live-design.md`.

**Why it can't wait.** The live database rules still allow anyone, signed in or not, to
read, change and delete every record. Deploying the new rules closes that, but they hide the
old top-level layout, so the data has to be moved into the workspace first.

**What the move does.**
- Creates the workspace **Grow Plus Technologies** (`workspaces/grow-plus`): active, plan "custom", no staff limit, no divisions.
- Copies every project, tender, employee, registration, payment, subscription, partner and file into it with the same IDs, removing the old "belongs to" (GPT / SDE) tag.
- Adds the workspace to every user, and makes you super admin.
- Old project numbers such as `PRJ-GPT-001` stay as they are. New projects get `PRJ-001`, `PRJ-002`, and so on.
- **The old records are not deleted**, and uploaded files are not moved: their links keep working.

## 1. Before the day

1. Sign in to the Firebase CLI. This opens a browser to pick your Google account:

   ```bash
   npx firebase login
   ```

2. Check the project is listed:

   ```bash
   npx firebase projects:list
   ```

3. Find your **UID**: Firebase console → Authentication → Users → the row for
   mohamedismayil@gptechnologies.ae → "User UID". You'll pass it as `--owner-uid`.

   It is taken from Authentication, not from the database, because anyone could have written
   to the database while the old rules were open.

## 2. Rehearse with a copy of the real data

This only **reads** live data. Everything is written to the local emulators.

```bash
npm run emulators
```

In a second terminal:

```bash
npm run migrate -- backup --source live
npm run migrate -- plan backups/live-<date>.json
```

Read the `plan` output carefully:
- **People:** every email, role and UID should be someone you know. Compare them with
  Authentication → Users. Delete anyone you don't recognise in the old app or the Firebase
  console before going live.
- **Warnings:**
  - clients with no linked project (they would see nothing);
  - users with no role;
  - records with no created date (lists sort by it, so they don't show, which was already
    true in the old app);
  - two profiles with the same email.

Then load the copy into the emulators. `--fresh` wipes them first (the demo data has a login
with your email that would clash), and `--emulator-logins` adds a local login for everyone:

```bash
npm run migrate -- apply backups/live-<date>.json --target emulator --owner-uid <your UID> --fresh --emulator-logins
npm run dev
```

Open http://localhost:8080 and sign in as yourself, as a manager and as a client. Every local
login uses the test password (`TEST_PASSWORD` in `scripts/emulator-rest.mjs`). Check projects,
tenders, payments, files, Settings → Team and the Platform page. Afterwards, put the demo
data back:

```bash
npm run seed
```

## 3. Checks

Stop the emulators first, because `test:rules` starts its own.

```bash
npm run lint
npm run test:unit
npm run test:rules
npx tsc --noEmit -p tsconfig.app.json
npm run build
```

Expected: no lint errors, all tests passing, no type errors, and a build in `dist/`.

## 4. Merge

```bash
git checkout main
git merge --ff-only redesign
```

## 5. Go live

Pick a quiet time and do all of this in one sitting. Anything someone edits in the old app
between "apply" and "deploy" would be lost, so these run a few minutes apart.

```bash
npm run migrate -- backup --source live
npm run migrate -- plan backups/live-<date>.json
npm run migrate -- apply backups/live-<date>.json --target live --owner-uid <your UID>
```

`apply --target live` asks you to type `crm-gpt-2026` before it writes anything. It needs the
old open rules, so it must run **before** the deploy. If it stops part-way, fix the cause and
run the same command again: it overwrites the same records.

**Straight away:**

```bash
npm run build
npx firebase deploy --only firestore:rules,storage,hosting
```

This deploys `storage.rules` for the first time. Live Storage currently uses whatever rules
are set in the console. Old file links keep working, because each carries its own access token.

## 6. Smoke test

On https://crm-gpt-2026.web.app (refresh with Ctrl+F5):
- Sign in as yourself: the company name shows, and projects, tenders, payments and files are there.
- Settings → Team shows the plan and staff count. The Platform page lists Grow Plus Technologies.
- Create a test partner, then delete it.
- Sign in as a client: they see only their own projects.
- Someone signed out can't read data. Try opening the app in a private window.

## 7. If something is badly wrong: roll back

> **Update, 11 November 2026:** the old top-level records were deleted on request, together
> with the old business records inside Grow Plus Technologies (copy in
> `backups/live-before-cleanup-2026-11-11-1139.json`). Rolling back to the old app is no longer
> possible; the steps below are kept for reference only.

1. Firebase console → Hosting → release history → roll back to the previous release.
2. Put the old rules back:

   ```bash
   git show 5eac3ff:firestore.rules > firestore.rules
   npx firebase deploy --only firestore:rules
   git checkout firestore.rules
   ```

The old top-level records were never changed, so the old app works again. **This reopens the
database to everyone**, so fix the problem and go live again as soon as you can.

## 8. Afterwards

- Keep the `backups/live-…json` files somewhere safe and private: they hold all business data
  (they are git-ignored, so they never go into the repository).
- The old top-level collections were deleted on 11 November 2026 (see section 7).
- On 12 November 2026 the uploaded file behind the deleted "Sadeem energy files" record
  (`documents/1787035429637_Sadeem Energy Profile.pdf`) was deleted from Storage; a copy is in
  `backups/storage/`. Older uploads that no record points to are still in Storage.
- New people join through Settings → Team invites. Anyone with a login but no profile sees no data.
