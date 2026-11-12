# ProjectDesk progress update (4–12 November 2026)

Between 4 and 12 November 2026 the CRM was fixed, secured and rebuilt into **ProjectDesk**: one product that many companies can sign up for, now with a sales pipeline. **It went live on 11 November** at https://crm-gpt-2026.web.app, with the existing data moved across. All the work (about 50 saved changes) is on GitHub (`main`).

## Go-live (11 November)

- **Why it was urgent.** The old database rules let anyone on the internet, signed in or not, read, change and delete every record. That is now closed: a signed-out request is refused.
- **Data moved.** The existing data became the company **Grow Plus Technologies**: 4 people (2 admins, 2 employees), 3 employees, 3 payments, 2 subscriptions and 1 file. Nothing was lost in the move. The old "belongs to" (GPT / SDE) tag was dropped, as agreed.
- **Rehearsed first.** A read-only copy of the live data was loaded on a local computer and checked screen by screen before anything changed on live. The real move matched the rehearsal exactly.
- **Safety net.** A full backup was taken just before the move. On request, the old hidden copies and the old test records (employees, payments, subscriptions and the file) were then deleted, so Grow Plus Technologies starts clean. A copy is kept in a private backup.
- **Deployed together.** The data move, the new database and file rules and the new app went out within minutes of each other. The live site was then checked.
- **Two security fixes** found by an automated review were deployed the same day (see Security below).

## Clean start and home page (12 November)

- **Uploaded files deleted.** On request, all 46 files in file storage were deleted (about 140 MB). They were the Sadeem Energy Profile behind the deleted file record, plus older documents, repeat uploads, profile pictures and a task attachment. No record used any of them, so nothing in the app broke. Copies are kept in a private backup. Old download links no longer work.
- **What is left on live.** The Grow Plus Technologies company, its 4 people and their logins. There are no business records and no files, so the company starts clean.
- **New home page.** Signed-out visitors now see what ProjectDesk does, a "Start your 14-day free trial" button and the sign-in form, on one page. The old `/login` address still works and leads there.

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
| Home page | The first page signed-out visitors see: what the product does, six feature cards, a free-trial button and the sign-in form. Works on phones. |
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
| Email confirmation | Signing up a company or joining by invite sends a confirmation link. Nothing is created until it's clicked, so nobody can use an email address that isn't theirs. Existing accounts sign in as before. |
| Live-data move tool | Backs up the live data, shows a dry run with every person and any problems, then moves it. Tested on sample data and on a copy of the real data first. |
| Local test environment | Development runs on local copies of the database, logins and file storage, so testing never touches live data. A "Local data" badge shows on screen. One command loads 3 demo companies with sample data. |
| Automated tests | 67 unit tests of the business rules and the data move, and 72 security tests of who can read and change what. |

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
- Pop-up messages weren't shown at all. With them restored, every form (projects, tenders, employees, costs, tasks, partners, payments, subscriptions, registrations) now waits for the save. On failure it says "Not saved" in plain words and keeps what was typed, instead of claiming success.
- The side menu crashed, leaving a blank screen, for a person whose profile had no name.
- Clients from the same company now share one organisation ID, so they all see their company's projects.

**Security**
- Role-based database and file-storage rules: each company is isolated, and clients see only their own projects.
- Sign-up and invites are checked by the database rules, not just the screens. A gap found in a security review was fixed: an invite could be used up without joining.
- Card numbers and security codes are never stored.
- **The live database was open to everyone**; it is now closed (see Go-live).
- **Billing details are private.** The card summary, billing period and contact email were readable by every member of a company, including outside clients. They are now kept apart, visible only to that company's admins and the product owner.
- **Email addresses are confirmed.** Before, anyone could sign up with an address they didn't own. Now the confirmation link must be clicked first, and the database itself enforces it.
- People can no longer put someone else's email on their own profile.
- The super admin for the move was taken from the login system, not from data anyone could have edited while the old database was open.

**Speed and upkeep**
- The first download dropped from 2.5 MB to 76 KB, because pages now load when opened.
- README and TODO were rewritten. Lint errors and an invalid TypeScript setting were fixed.

## Status and next steps

**Where it stands.** Live at https://crm-gpt-2026.web.app since 11 November, with both security fixes and, since 12 November, the new home page. The live database and file storage hold only the company and its people. GitHub (`main`) matches the live site.

**Checks.** All of these pass:
- 67 unit tests and 72 security tests;
- type check, lint (0 errors) and the production build;
- a hand test of every flow on local data, and a rehearsal with a copy of the real data.

**To check on live**
- Sign in, and have the other three people sign in.
- Send a test invite to an address you can open, to confirm the email arrives (it comes from noreply@crm-gpt-2026.firebaseapp.com).

**Next work**
- Real card payments with Stripe. This needs the Firebase Blaze plan. It would also let the app send invite emails itself.
- Optionally a custom domain, with sign-up on the main domain and the app on `app.`.
- Replace the fixed risk paragraph in the project's Executive Briefing PDF with real figures.
- Set the final plan names, prices and sales email.
- Removing a user should also remove their login. This needs a server function.
