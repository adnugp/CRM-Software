# ProjectDesk

A multi-company CRM for project and contracting firms. Each customer company gets its
own isolated **workspace** and tracks projects (with tasks, costs and a timeline),
tenders, company registrations, payments and subscriptions, partners, employees and
documents. An in-browser assistant answers questions from the live data.

"ProjectDesk" is a working name, set in `src/config/product.ts` (and the `<title>`
in `index.html`).

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

`npm run seed` creates three demo companies, each with sample companies, contacts and deals, all logins sharing the test password defined
as `TEST_PASSWORD` in `scripts/emulator-rest.mjs`:

| Company | Plan | Divisions | Logins |
|---|---|---|---|
| Acme Contracting | Business, active | Building Systems (BLD), Energy (ENG) | admin@ / manager@ / employee@ / employee2@acme.test, clients client@gulf.test and client@desert.test |
| Noor Engineering | Starter, trial (9 days left) | none | admin@ / employee@noor.test, client client@harbor.test |
| Falcon Builders | Starter, trial ended (read-only) | none | admin@ / employee@falcon.test |

It also prints a pending invite link into Acme (`/join/seed-invite-acme`). Run it again any time to reset to clean sample data. Local data is saved to
`.emulator-data/` when you stop the emulators with Ctrl+C.

While the app uses local data, a **Local data** badge shows at the top of the screen.

| Command | What it does |
|---|---|
| `npm run emulators` | Start the local Firebase emulators |
| `npm run seed` | Reset the emulators to sample data |
| `npm run accounts` | Add or update your own company and logins from `scripts/local-accounts.json` (git-ignored; copy `local-accounts.example.json`). `"platformOwner": true` on an account makes it the super admin. `seed` re-adds them too |
| `npm run migrate -- <step>` | One-time move of the old single-company live data into a workspace: `backup`, `plan`, `apply` (see `docs/go-live.md`) |
| `npm run migrate:fixture` | Put old-layout sample data in the emulators to rehearse the move (wipes them; `seed` restores) |
| `npm run dev` | Dev server using local emulator data |
| `npm run dev:live` | Dev server using the **live** Firebase project (careful) |
| `npm run build` | Production build into `dist/` (always uses the live project) |
| `npm run lint` | ESLint |
| `npm run test:unit` | Unit tests for the pure helpers (numbering, divisions, theme, plans and trials, pipeline, assistant sales answers, data migration) |
| `npm run test:rules` | Test the Firestore and Storage security rules against the emulators (stop `npm run emulators` first: they share ports) |

## Workspaces and divisions

Every customer company is a workspace. `workspaces/{wsId}` holds its name, logo, brand
colour and **divisions**, and all of its records live underneath it
(`workspaces/{wsId}/projects`, `…/tenders`, …). A login belongs to exactly one workspace
through `users/{uid}.workspaceId`, and the security rules never let it reach another.

Divisions are optional business units (e.g. "Energy", code `ENG`). Records can be tagged
with one, and project numbers use its code (`PRJ-ENG-001`, or `PRJ-001` without a
division). Admins manage the name, logo, colour and divisions in **Settings → Company**.

## Sign-up, plans and invites

- **Sign-up.** A new company signs up at `/signup` (linked from the home page, which is also where people sign in): it picks a
  plan and monthly or yearly billing, enters a card, and gets a 14-day trial; the person
  signing up becomes its admin. Plans, prices and trial length are in `src/config/plans.ts`;
  the staff limits are mirrored in `firestore.rules` (`planLimits`), and a rules test fails
  if they differ.
- **Payment (demo for now).** The card is checked in the browser by
  `src/services/billing.ts` and nothing is charged. Only the card type, last 4 digits and
  expiry are stored. Use 4242 4242 4242 4242 to succeed and 4000 0000 0000 0002 to see a
  decline (any future expiry, any CVC). Stripe will replace that one file.
- **Staff limit.** Admins, managers and employees count against the plan's staff limit
  (`staffCount` / `staffLimit` on the workspace). Clients are free.
- **Read-only.** When a trial ends, or the company is suspended, it becomes read-only: people
  can still see everything, but nothing can be changed until it's activated.
- **Invites.** Admins add people from **Settings → Team**: enter email, name and role, then
  copy the one-time link (valid 7 days) and send it. The person opens it, picks a password
  and joins. The app doesn't send invite emails itself yet.
- **Email confirmation.** Signing up a company or joining by invite creates the login, then
  Firebase emails a confirmation link; nothing else is written until it's clicked (the rules
  require `email_verified`). Existing logins sign in as before. Locally no email is sent:
  the link is in the Emulator UI (http://localhost:4000 → Authentication) or at
  http://127.0.0.1:9099/emulator/v1/projects/demo-crm/oobCodes.
- **Billing details** (contact, card summary, billing period) are kept in
  `workspaces/{id}/private/billing`, readable only by that company's admins and the super admin.
- **Super admin.** The product owner (a login listed in `platformOwners`, set with
  `"platformOwner": true` in `local-accounts.json`) sees every company on the **Platform**
  page and can change its plan, extend a trial, activate it or suspend it. They can't see any
  company's data.

## Sales: deals, companies and contacts

Staff see a **Sales** group in the sidebar.

- **Deals** is the pipeline: Lead → Qualified → Proposal → Negotiation → Won / Lost.
  - Win chances are 10 / 25 / 50 / 75 / 100 / 0 %, giving the weighted value. They're set in `src/config/pipeline.ts`.
  - Drag cards between columns, or use "Move to…". Lost asks for a reason.
  - Each deal has a history (notes, calls, meetings, emails and stage changes) and one next follow-up.
- **Converting:** "Convert to tender" or "Create project" opens the usual form, pre-filled. The deal then links to the record it became.
- **Companies:** each company page lists its contacts and deals. It also lists earlier projects, tenders and payments whose company name or organisation ID matches.
- **Deleting** a company or contact is blocked while something uses it.
- **Rules:** the pipeline rules are pure functions in `src/lib/pipeline.ts`, unit-tested in `tests/unit/pipeline.test.mjs`.
- **Access:** clients can't see any of it (see `firestore.rules`).
- **Dashboard and assistant:** the Dashboard shows follow-ups due and pipeline totals. The assistant answers "pipeline value", "deals in proposal" or "follow-ups today".

## Roles

Each signed-in person has a profile at `users/{uid}` with a `workspaceId` and one of
these roles, which apply inside their own workspace:

| Role | Access |
|---|---|
| `admin` | Everything, including inviting and removing people |
| `manager` | All business data and the employee directory |
| `user` (employee) | All business data; read-only employee directory |
| `client` | Only the projects linked to them (by `clientId` or `organizationId`) |

People join through an invite link from **Settings → Team**, or by signing up a new
company. A Firebase Auth account without a `users/{uid}` profile (or without a workspace)
gets no data access.

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
tests/              Security rules tests (run against emulators) and unit tests
scripts/            Emulator launcher, sample-data seed and the live-data migration
docs/               Product analysis, improvement notes, bug sheet
```

## Deploying

**The first deploy of this multi-company version** needs the live data moved first. Follow
[`docs/go-live.md`](docs/go-live.md) step by step.

After that, updates are deployed with:

```bash
npm run build
npx firebase deploy --only hosting
npx firebase deploy --only firestore:rules,storage
```

`npx firebase` uses the project's own Firebase CLI, which also avoids the Windows
PowerShell "running scripts is disabled" error.
