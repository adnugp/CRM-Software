# Workspaces and neutral branding — design

Date: 2026-11-04 · Branch: `redesign` · Status: awaiting review

## Goal

Turn the internal Sadeem Energy / Grow Plus Technologies CRM into a product that can
be sold to many companies. This first sub-project:

1. removes both company names (and the GP logo) from the code, and
2. gives every customer company its own isolated **workspace**, with its own
   branding and its own list of **divisions** (what `belongsTo` used to hardcode).

## Decisions already made

| Question | Decision |
|---|---|
| Target buyer | Project and contracting firms. Projects, Tenders and Registrations stay the core. |
| Product name | Placeholder **ProjectDesk**, defined in one file so renaming is one line. |
| Tenancy | One shared app and database; one workspace per customer company. |
| Membership | One workspace per login. |
| Storage layout | Each workspace's records live under `workspaces/{wsId}/…` (path-based isolation). |

## Scope

**In:** product brand config, workspace data model, divisions, per-workspace
branding (name, logo, colour) edited in Settings, workspace-scoped Firestore and
Storage rules with tests, all app reads and writes moved under the workspace, seed
data with two demo workspaces.

**Out (later sub-projects):** self-serve company sign-up and invites (#3), contacts
and a deals pipeline (#4), plans, billing and a product-owner console (#5), a
workspace switcher, and migrating the live `crm-gpt-2026` data (a pre-deploy task,
see the last section).

## Data model

```
workspaces/{wsId}
  name: string                     "Acme Contracting"
  logoUrl?: string                 Storage download URL
  brandColor?: string              "#16a34a"
  divisions: { id, name, code }[]  [] when the company has none
  createdAt: timestamp

  /projects/{id}       /tenders/{id}        /registrations/{id}
  /payments/{id}       /subscriptions/{id}  /partners/{id}
  /employees/{id}      /files/{id}

users/{uid}                        (top level, so sign-in can find the workspace)
  name, email, role, workspaceId, company?, organizationId?, avatar?
```

- **Divisions.** `id` is a generated stable key, `name` is free text, and `code`
  is 2–4 uppercase letters used in record numbers. Records store `divisionId`
  (replacing `belongsTo`). A division can be renamed at any time; it **cannot be
  deleted while any record uses it** (Settings shows how many do).
- **No divisions.** If a workspace has no divisions, every division picker,
  filter and badge is hidden, and records save without `divisionId`.
- **Project numbers.** `PRJ-{code}-001` per division, or `PRJ-001` with no
  division. The next number is the highest existing number in that series + 1
  (same rule as today). Changing a code later does not renumber old projects.
- **Client organisation IDs.** `ORG-{initials}-{nnn}`, counted within the
  workspace (the `SAD`/`GP` prefix and its picker are removed).
- **Roles** are unchanged (`admin`, `manager`, `user` = employee, `client`) and
  apply within the user's own workspace.

## Security rules

Helpers: `me()` = the caller's `users/{uid}` profile; `inWs(ws)` =
`me().workspaceId == ws`.

**Firestore**

| Path | Read | Write |
|---|---|---|
| `workspaces/{ws}` | any member of `ws` (clients need the branding) | update by an `admin` of `ws`; create and delete not allowed from the app |
| `workspaces/{ws}/projects/{id}` | staff of `ws`; a client of `ws` whose `clientId` or `organizationId` matches | staff of `ws` |
| `workspaces/{ws}/employees/{id}` | staff of `ws` | admin or manager of `ws` |
| other `workspaces/{ws}/*` | staff of `ws` | staff of `ws` |
| `users/{uid}` | self, or staff of the same workspace | create, update and delete by an admin of the same workspace, and only with `workspaceId` equal to the admin's own; self may edit `name`, `email` and `avatar` only; nobody can change `workspaceId` |

**Storage:** uploads move from `documents/…` and `task-attachments/…` to
`workspaces/{ws}/documents/…` and `workspaces/{ws}/task-attachments/…` (staff of
`ws` only), plus `workspaces/{ws}/branding/…` (read by members, write by an admin,
images under 2 MB). `avatars/` is unchanged. Download URLs already saved on
records keep working because they carry their own token.

Staff listing users now queries `where('workspaceId', '==', myWs)`, since the
rules reject a query that could return another company's users.

## App changes

- **`src/config/product.ts`**: `PRODUCT_NAME`, tagline and a neutral SVG logo.
  `gp-logo.png` is deleted. Used by `index.html`, the login page and the sidebar
  fallback.
- **`WorkspaceContext`** (new): loads `workspaces/{user.workspaceId}`, exposes
  `workspace`, `divisions`, `divisionById()` and `updateWorkspace()`, and applies
  `brandColor` to the theme's primary-colour CSS variables. Signed-in users with
  no workspace see a "your account isn't linked to a company" screen, not an
  empty CRM.
- **`firestore.ts`**: every helper takes the workspace ID and builds paths under
  `workspaces/{wsId}`. `DataContext` passes it from `WorkspaceContext`; the rest of
  the app's calls are unchanged.
- **`AuthContext`**: `refreshUsers` filters by workspace, and `addUser` writes
  `workspaceId`. The unused self-`register` function is removed (nothing calls it,
  and it would create users without a workspace).
- **Divisions in the UI**: `ProjectForm`, `TenderForm` and `RegistrationForm` get
  a division select fed by the workspace. The Projects, Tenders and Registrations
  filters and badges, the Files company filter, the project-detail badge, the PDF
  footer and the chatbot use division names from the workspace. Badge colours
  come from a fixed palette by division order.
- **Settings → Company** (new tab, admin only; managers see it read-only):
  company name, logo upload, brand colour, and a divisions editor (add, rename,
  change code, delete when unused).
- **Branding**: the sidebar shows the workspace logo and name, falling back to
  the product brand. The login page always shows the product brand, since the
  workspace is unknown before sign-in.
- **Leftovers removed**: the `admin@gptechnologies.ae` placeholder in
  `EmailAlertSettings` and the "Grow Plus / Sadeem" chatbot examples.

## Local development and seed

- `npm run seed` creates two demo workspaces:
  - **Acme Contracting**: two divisions ("Building Systems" BLD and
    "Energy" ENG), a full set of staff and two clients.
  - **Noor Engineering**: no divisions, a smaller team and one client.
  
  Together they prove isolation and the no-divisions layout.
- `scripts/local-accounts.json` gains a `workspace` block (name and divisions) so
  your own logins get their own workspace. That file is git-ignored, so your
  company names stay out of the code.

## Testing

- **Rules tests** (`npm run test:rules`), updated and extended. They prove that:
  - an admin of workspace A cannot read A's neighbour B, create users in B, or
    move a user to B;
  - a user cannot change their own `workspaceId`;
  - clients see only their projects inside their own workspace;
  - Storage paths are isolated per workspace;
  - users without a workspace get nothing.
- `tsc`, `lint` and `build` stay clean, and the production bundle contains no
  "Sadeem", "Grow Plus" or "GPT" strings (checked with grep).
- **Browser check on localhost:**
  - sign in as each demo workspace's admin and confirm different data and
    branding;
  - add a project and confirm `PRJ-BLD-001` vs `PRJ-001`;
  - edit company settings;
  - confirm a client only sees their own projects.

## Live data migration (pre-deploy, not built now)

Before the first deploy, a one-time script will create a workspace for the
current company with divisions **Grow Plus Technologies (GPT)** and **Sadeem
Energy (SDE)**. With those codes, existing `PRJ-GPT-…` and `PRJ-SDE-…` numbers
stay valid. The script will:

- copy each top-level collection under that workspace,
- map `belongsTo` to `divisionId`,
- set `workspaceId` on every user, and
- move Storage files only if needed (old URLs keep working).

This is tracked in `TODO.md`.
