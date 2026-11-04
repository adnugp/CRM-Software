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

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:8080
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | ESLint |
| `npm run test:rules` | Test the Firestore and Storage security rules against the local emulators (needs the Firebase CLI and Java) |

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
docs/               Product analysis, improvement notes, bug sheet
```

## Deploying

```bash
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules,storage
```
