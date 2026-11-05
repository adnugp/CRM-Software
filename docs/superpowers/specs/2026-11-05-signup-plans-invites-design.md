# Company sign-up, plans, invites and super admin — design

Date: 2026-11-05 · Branch: `redesign` · Status: awaiting review

## Goal

Let a new customer company start using ProjectDesk on its own: its admin signs up on
the main site, picks a plan by team size and gets a 14-day trial, then invites staff
and clients by link. The product owner (super admin) sees and manages every company
from a Platform page.

## Decisions already made

| Question | Decision |
|---|---|
| Who creates companies | Anyone, self-serve, from the main site's sign-up page. No approval step. |
| Payment in this version | Plan chosen by staff count + 14-day trial. Card payment (Stripe) is the next sub-project. |
| Super admin | The owner's existing login (`mohamedismayil@…`), which stays admin of GP Technologies and also gets a Platform page. Owner status is set by script only. |
| Adding people | One-time invite links (7 days). The admin-sets-a-password flow is removed. |
| Web addresses | Main site = landing + sign-up; everyone works at one app address (`app.…`). Same codebase, split into two Hosting sites at deploy time. Locally both are `localhost:8080`. |
| Backend | None. Browser writes guarded by Firestore/Storage rules (no Cloud Functions, no Blaze plan). |

## Scope

**In:** plans config, sign-up page, trial and staff limit enforced by rules, read-only
mode after the trial or when suspended, invites (create, copy link, revoke, accept),
Join page, Platform page, seed data and rules tests for all of it.

**Out:** Stripe payment and emails (next sub-project, needs Cloud Functions), the
two-site Hosting split (deploy task), a marketing landing page beyond the plan picker,
changing a member's role between staff and client, contacts/deals.

## Plans

`src/config/plans.ts` (placeholder names and prices, edited in one place):

| id | Name | Staff limit | Price label |
|---|---|---|---|
| `starter` | Starter | 5 | "AED 99 / month" |
| `team` | Team | 20 | "AED 299 / month" |
| `business` | Business | 50 | "AED 599 / month" |
| — | Enterprise | — | "Contact us" (mailto link, no sign-up) |

Also `TRIAL_DAYS = 14` and `INVITE_DAYS = 7`.

**Staff** = roles `admin`, `manager`, `user`. **Clients do not count** and are unlimited.
`firestore.rules` holds the same id → limit map; a rules test fails if they drift.

## Data model

```
workspaces/{wsId}                 (existing doc, new fields)
  status: 'trial' | 'active' | 'suspended'   missing = 'active' (old docs)
  plan: 'starter' | 'team' | 'business' | 'custom'
  staffLimit: number              0 = unlimited
  staffCount: number              staff members right now
  trialEndsAt: timestamp          only meaningful while status == 'trial'
  createdBy: uid                  set at sign-up
  createdAt: timestamp
  contactName, contactEmail       the admin who signed up (shown to the super admin)
  removedUid?: string             set only in the same write that removes a staff member

invites/{token}                   token = random Firestore id (20 chars)
  workspaceId, workspaceName      name is copied so the Join page can show it before sign-in
  email                           lowercase
  name, role
  company?, organizationId?       clients only (org id chosen as today)
  status: 'pending' | 'accepted' | 'revoked'
  invitedBy: uid, createdAt, expiresAt
  acceptedBy?: uid, acceptedAt?

platformOwners/{uid}              exists = super admin. Written by script only.

users/{uid}                       existing, plus inviteId? (the invite that created it)
```

## Who can do what (rules)

New helpers: `isOwner()` (platformOwners doc exists), `ws(ws)` (the workspace doc),
`writable(ws)` = status is `active`, or status is `trial` and `request.time < trialEndsAt`.

**Reading** stays as today (`inWs`), so expired and suspended companies keep read access.
**Every write** inside a workspace (projects, employees, other business data, workspace
settings, invites) additionally requires `writable(ws)`. Storage writes under
`workspaces/{ws}/…` get the same check via `firestore.get`.

**Sign-up** — one batch after creating the Auth login:
- `workspaces/{new}` create: caller signed in, has no profile; `createdBy == uid`;
  `status == 'trial'`; plan in the self-serve map and `staffLimit` equals its limit;
  `staffCount == 1`; `trialEndsAt` is after now and at most 14 days ahead;
  `divisions == []`; only allowed keys; and `getAfter(users/uid)` is an admin of this workspace.
- `users/{uid}` create (sign-up branch): own uid; `role == 'admin'`; email equals the
  login's email; `getAfter(workspaces/{wsId})` was created by this uid and did not exist
  before the batch.

So sign-up can never join an existing company, pick its own limit or skip the trial.

**Invites**
- create: admin of a writable workspace; `workspaceId == myWs()`; `status == 'pending'`;
  `invitedBy == uid`; `expiresAt` at most 7 days ahead; valid role; email lowercase.
- get: anyone, even signed out (knowing the token is the permission). list: admins, for
  `where('workspaceId', '==', myWs())` only.
- update by admin: `pending → revoked` only.
- **accept** — one batch after creating the Auth login with the invited email:
  - `users/{uid}` create (invite branch): own uid; invite is pending, not expired, its
    email equals the login's email; `workspaceId`, `role`, `company`, `organizationId`
    copied from the invite; workspace writable; `getAfter(invite).status == 'accepted'`.
  - `invites/{token}` update: `pending → accepted`, only `status/acceptedBy/acceptedAt`,
    `acceptedBy == uid`, and `getAfter(users/uid).inviteId == token`.
  - staff roles only: `workspaces/{ws}` update of `staffCount` alone, +1, and
    `staffLimit == 0 || staffCount <= staffLimit`, tied to the new profile via `getAfter`.
    The profile create also requires this +1 for staff roles, so neither can happen alone.
- delete: never (kept as an audit trail).

**Removing a staff member** — admin batch: delete `users/{x}` and update the workspace
with `staffCount - 1` and `removedUid == x`. Rules check `x` was staff before the batch
and is gone after it, both ways. Removing a client needs no counter change.

**Role changes** by admins are limited to staff ↔ staff (admin/manager/user); staff ↔
client is not allowed (re-invite instead), so the counter stays correct.

**Super admin**
- read every `workspaces/{ws}` doc (and list them). No access to anything under them.
- update only `status`, `plan`, `staffLimit`, `trialEndsAt`.
- `platformOwners/{uid}`: read own doc; no writes from the app.
- Company admins can no longer change `status`, `plan`, `staffLimit`, `staffCount`,
  `trialEndsAt` (their settings update stays limited to name/logo/colour/divisions).

## Screens and flows

**`/signup` (main site, signed out)** — `src/pages/Signup.tsx`
1. Plan cards (Starter / Team / Business, Enterprise = Contact us), "14-day free trial, no card".
2. Form: company name, your name, email, password (+ confirm). zod validation.
3. Submit: create login → sign-up batch → app opens in the new company as admin.
4. Errors: weak password, network, email already registered ("sign in instead" link).
   If the batch fails after the login was created, the page shows "Something went wrong,
   try again" and signs out. On the next attempt, "email already registered" is handled by
   signing in with the entered password: a login with no profile continues with the
   sign-up batch instead of failing, so a half-finished sign-up can always be completed.
Login page gets "New company? Start a free trial" → `/signup`.

**`/join/:token` (signed out)** — `src/pages/Join.tsx`
- Loads the invite. Shows "Join *Acme Contracting* as *Manager*", email fixed.
- Form: name (prefilled), password (+ confirm). Submit: create login → accept batch → app.
- States: not found, revoked, expired, already accepted ("sign in instead"), email
  already has a login ("this email already belongs to an account"), company full
  ("ask your admin to upgrade"), company read-only. A signed-in visitor is asked to sign out first.

**Settings → Team (admins)** — `src/components/settings/TeamSettings.tsx`, replaces the
Registration portal tab and `Register.tsx` (routes `/register`, `/registration/*` removed).
- Plan strip: "Team plan · Trial, 9 days left · 3 of 20 staff".
- Invite form: email, name, role; client role adds Client company (org id as today).
  The staff role options are disabled when `staffCount + pending staff invites >= staffLimit`.
- Invites list: email, role, status, expires; actions Copy link, Revoke.
- Staff and client lists stay; removing staff uses the counter batch.

**`/platform` (super admin only)** — `src/pages/Platform.tsx`, sidebar link "Platform".
- Table of companies: name, contact, plan, staff used/limit, status, trial ends, created.
  Filter by status, search by name.
- Row actions: Activate, Extend trial (+14 days), Change plan, Suspend / Reactivate.

**Read-only mode** — `WorkspaceContext` exposes `access = { state, canWrite, daysLeft }`
from a pure helper. When `canWrite` is false:
- a banner at the top of the app: "Your trial has ended — your data is read-only.
  Contact us to choose a plan." (or "This company is suspended…");
- Settings → Team hides invites; a write that still reaches Firestore gets a friendly
  toast instead of a raw permission error (DataContext).
- Admins also see a trial note in the sidebar ("Trial · 9 days left").

**Removed:** `addUser` and the secondary Firebase app, `Register.tsx`, the registration routes.

## Code units

| File | Responsibility |
|---|---|
| `src/config/plans.ts` | Plans, `TRIAL_DAYS`, `INVITE_DAYS` |
| `src/lib/subscription.ts` (pure, unit-tested) | `isStaffRole`, `workspaceAccess(ws, now)`, `staffSeatsLeft(ws, pendingStaffInvites)`, `trialEndDate(now)` |
| `src/services/signup.ts` | `createCompany({plan, companyName, name, email, password})` |
| `src/services/invites.ts` | `createInvite`, `listInvites`, `revokeInvite`, `getInvite`, `acceptInvite` |
| `src/services/platform.ts` | `listAllWorkspaces`, `updateWorkspacePlan` |
| `AuthContext` | `isOwner` (platformOwners check on sign-in), `removeUser` uses the counter batch |
| `WorkspaceContext` | `access` |

## Seed and local accounts

- Acme: `active`, `business`, limit 50. Noor: `trial`, `starter`, limit 5, 9 days left.
- New **Falcon Builders** (`ws-falcon`): trial ended → read-only. `admin@falcon.test`.
- One pending invite in Acme, link printed by the seed.
- `staffCount` computed from the seeded staff.
- `local-accounts.json`: GP Technologies `active`, plan `custom`, limit 0 (unlimited);
  an account flag `"platformOwner": true` creates `platformOwners/{uid}`
  (set on `mohamedismayil@…`).

## Testing

**Rules tests** (`tests/security-rules.test.mjs`), new cases:
- sign-up: valid batch passes; existing profile, `status: 'active'`, wrong limit,
  trial longer than 14 days, profile pointing at an existing workspace all fail.
- invites: admin creates, other company cannot list, signed-out get works, accept
  passes; wrong email, expired, revoked, over the staff limit fail; a client invite
  does not touch the counter.
- read-only: expired trial and suspended can read, cannot write (Firestore and Storage).
- super admin: lists companies, changes plan/status, cannot read projects; a company
  admin cannot change their own plan, limit or counter.
- removing staff: decrement must match a real deletion.
- plan limits in the rules equal `src/config/plans.ts`.

**Unit tests:** `subscription.ts` (states, days left, seats).

**In the browser:** sign up a new company, invite a manager and a client, join with both,
hit the staff limit, see Falcon read-only, approve/extend/suspend from Platform.

## Before deploying (added to TODO.md)

- Migration also sets `status: 'active'`, `plan: 'custom'`, `staffLimit: 0` and
  `staffCount` on the existing company, and creates `platformOwners/{owner uid}`.
- Two Hosting sites: main domain serves `/signup` (and later a landing page), `app.`
  serves the app; the Join links use the app address (`VITE_APP_URL`, falling back to
  the current origin, which is what localhost uses).

## Accepted limitations

- Nobody verifies that a sign-up email belongs to the person (no server). Invite links
  are secret and expire; email verification comes with Cloud Functions.
- A read-only company cannot invite or remove people until it is activated.
- Removing a person deletes their profile, not their Auth login (existing TODO).
