# Grow Plus CRM

Internal CRM for IT Grow Plus Technologies and Sadeem Energy. It tracks projects
(with tasks, costs and a timeline), tenders, company registrations, payments and
subscriptions, partners, employees and documents, and includes an in-browser
assistant that answers questions from the live data.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router
- **Backend:** Firebase: Authentication, Firestore, Storage and Hosting (project `crm-gpt-2026`)
- **Assistant:** `src/services/crmChatEngine.ts`, a rule-based engine that runs in the browser (no server or LLM)

## Getting started

Requires Node.js 20+ and Java 11+ (for the local Firebase emulators).

Local development runs against **local Firebase emulators**, not the live project,
so nothing you do on localhost touches real data. Use two terminals:

```bash
npm install
npm run emulators   # terminal 1: local Auth, Firestore, Storage (+ UI at http://localhost:4000)
npm run seed        # terminal 2, first time only: load sample data and test logins
npm run dev         # terminal 2: app at http://localhost:8080
```

`npm run seed` creates one login per role (admin, manager, two employees, two clients),
all sharing the test password defined as `TEST_PASSWORD` in `scripts/seed-emulator.mjs`.
Run it again any time to reset to clean sample data. Local data is saved to
`.emulator-data/` when you stop the emulators with Ctrl+C.

While the app uses local data, a **Local data** badge shows at the top of the screen.

| Command | What it does |
|---|---|
| `npm run emulators` | Start the local Firebase emulators |
| `npm run seed` | Reset the emulators to sample data |
| `npm run accounts` | Add or update your own logins from `scripts/local-accounts.json` (git-ignored; copy `local-accounts.example.json`). `seed` re-adds them too |
| `npm run dev` | Dev server using local emulator data |
| `npm run dev:live` | Dev server using the **live** Firebase project (careful) |
| `npm run build` | Production build into `dist/` (always uses the live project) |
| `npm run lint` | ESLint |
| `npm run test:rules` | Test the Firestore and Storage security rules against the emulators |

## Roles

Each signed-in person has a profile at `users/{uid}` with one of these roles:

| Role | Access |
|---|---|
| `admin` | Everything, including creating and removing users |
| `manager` | All business data and the employee directory |
| `user` (employee) | All business data; read-only employee directory |
| `client` | Only the projects linked to them (by `clientId` or `organizationId`) |

Accounts are created by an admin from **Settings → Registration portal**. A Firebase
Auth account without a `users/{uid}` profile gets no data access.

The UI hides pages by role (`ProtectedRoute` in `src/App.tsx`), but the real enforcement
lives in `firestore.rules` and `storage.rules`, so keep both in sync when you change
permissions and add a test in `tests/security-rules.test.mjs`.

## Project layout

```
src/
  pages/            One file per screen (Dashboard, Projects, Tenders, ...)
  components/       Forms, layout, shared UI (shadcn/ui lives in components/ui)
  contexts/         AuthContext (session + users), DataContext (all CRM data)
  services/         Firebase setup, Firestore CRUD, chat engine
  types/            Shared TypeScript types
firestore.rules     Database security rules
storage.rules       File storage security rules
tests/              Security rules tests (run against emulators)
scripts/            Local emulator launcher and sample-data seed
docs/               Product analysis, improvement notes, bug sheet
```

## Deploying

```bash
npm run build
npx firebase deploy --only hosting
npx firebase deploy --only firestore:rules,storage
```

`npx firebase` uses the project's own Firebase CLI, which also avoids the Windows
PowerShell "running scripts is disabled" error.
