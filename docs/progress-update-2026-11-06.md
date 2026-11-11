# ProjectDesk progress update (6 November 2026)

Between 4 and 6 November 2026 the CRM was fixed, secured and rebuilt into **ProjectDesk**: one product that many companies can sign up for, now with a sales pipeline. All 37 changes are on the `redesign` branch and tested on local data. Nothing is live yet: the live site and its data are unchanged.

"ProjectDesk" is a working name and can be changed in one place.

## What was removed

| Removed | Why / what replaces it |
|---|---|
| Sadeem Energy / Grow Plus branding and the GP logo | Neutral ProjectDesk brand. Each company sets its own name, logo and colour. |
| The fixed two-company "belongs to" field (GPT / SDE) | Optional **divisions** that each company defines for itself. |
| The old self-registration page and the admin "add user" screen | Company sign-up, plus invite links from Settings → Team. |
| Open database rules (any signed-in person could read or change everything) | Role-based rules that keep each company's data separate. |
| The retired chatbot backend and its start script | The assistant now runs entirely in the browser. |
| About 30 one-off test scripts (`test-*.cjs`, `.html`, `.ps1`), `fix-tenders.js`, `seed-firestore.js` | Proper automated tests and a sample-data script. |
| Unused Firebase Data Connect and Cloud Functions scaffolding | Nothing used them. |
| Unused packages (`firebase-admin`, `ws`, `i`, the Data Connect client), unused images and a mock data service | Nothing used them. |

In total, 85 unused files were deleted.

## What was added

| Feature | What it does |
|---|---|
| Multi-company workspaces | Every customer company gets its own separate data. Staff never see another company's records. |
| Company settings | Company name, logo, brand colour (re-themes the app in light and dark mode) and a divisions editor. Project numbers use the division code: PRJ-ENG-001, or PRJ-001 without divisions. |
| Company sign-up (`/signup`) | A new company picks a plan by staff count, monthly or yearly billing, and enters a card. It gets a 14-day free trial, and the person signing up becomes its admin. |
| Plans | Starter (5 staff) AED 99, Team (20) AED 299, Business (50) AED 599 per month. Yearly costs 10 months. Clients are free. Prices are placeholders. |
| Demo payment step | Card checks in test mode; nothing is charged. Only the card type, last 4 digits and expiry are stored, never the full number. Stripe will replace it later. |
| Invite links (Settings → Team) | Admins invite employees, managers, admins and clients with a one-time link, valid 7 days. The plan's staff limit is enforced. Invites can be revoked. |
| Join page (`/join/…`) | The invited person opens the link, sets a password and joins the right company with the right role. |
| Read-only mode | When a trial ends or a company is suspended, everyone can still see their data but nothing can be changed. A banner explains why. |
| Super admin Platform page | The product owner sees every company's plan, billing, staff count and status. They can change the plan, extend a trial, activate or suspend a company. They can't see any company's data. |
| Sales: Deals board | Six stages (Lead → Qualified → Proposal → Negotiation → Won / Lost) with win chances of 10 / 25 / 50 / 75 / 100 / 0 %. Drag cards between stages or use "Move to…". Lost asks for a reason. Totals show the open pipeline, the weighted value and the wins this month. A list view adds sorting and owner and division filters. |
| Sales: Deal page | A history of notes, calls, meetings, emails and stage changes, plus one next follow-up. A deal can be marked won or lost and reopened. "Convert to tender" and "Create project" open the usual form already filled in, and link the new record to the deal. |
| Sales: Companies and Contacts | A directory of the companies you sell to and their people. Each company page shows its contacts, its deals and its earlier projects, tenders and payments. A company or contact can't be deleted while deals use it. |
| Dashboard cards | "Follow-ups due" (overdue in red) and "Pipeline" totals. |
| Assistant | Also answers "pipeline value", "deals in proposal" and "follow-ups today". |
| Local test environment | Development runs on local copies of the database, logins and file storage, so testing never touches live data. A "Local data" badge shows on screen. One command loads 3 demo companies with sample data. |
| Automated tests | 52 unit tests of the business rules and 63 security tests of who can read and change what. |

## What was fixed and improved

**Bugs fixed**
- The Employees page and the project page crashed when data finished loading.
- Dashboard trends, burn rate and the project timeline showed "Invalid Date" or NaN.
- New project numbers could repeat. They now follow the highest existing number.
- Search boxes crashed on records with empty fields.
- Changing a password now checks the current password first.
- Data from the previous user stayed on screen after logout.
- Chatbot images were broken in the live build.
- Wrong redirects after sign-in for users without access.
- Pop-up messages weren't shown at all. With them restored, the project, tender and employee forms now wait for the save. On failure they say "Not saved" and stay open, instead of claiming success.
- Clients from the same company now share one organisation ID, so they all see their company's projects.

**Security**
- Role-based database and file-storage rules: each company is isolated, and clients see only their own projects.
- Sign-up and invites are checked by the database rules, not just the screens. A gap found in a security review was fixed: an invite could be used up without joining.
- Card numbers and security codes are never stored.

**Speed and upkeep**
- The first download dropped from 2.5 MB to 76 KB, because pages now load when opened.
- README and TODO were rewritten. Lint errors and an invalid TypeScript setting were fixed.

## Status and next steps

**Where it stands.** The work is on the `redesign` branch (37 commits). It is not merged into `main` and not deployed.

**Checks.** All of these pass:
- 52 unit tests and 63 security tests;
- type check, lint (0 errors) and the production build;
- a hand test of every flow on local data.

**Before going live**
- Move the live data into the new multi-company layout with a one-time script, tested on a copy first.
- Set up the hosting addresses: the main site for sign-up and an app address for everything else.

**Next work**
- Real card payments with Stripe. This needs the Firebase Blaze plan. It would also send invite and sign-up emails.
- Make the remaining forms (costs, tasks, partners, payments) wait for the save the same way.
- Replace the fixed risk paragraph in the project's Executive Briefing PDF with real figures.
- Set the final plan names, prices and sales email.
- Removing a user should also remove their login. This needs a server function.
