# ProjectDesk progress update (4–16 November 2026)

Between 4 and 16 November 2026 the CRM was fixed, secured and rebuilt into **ProjectDesk**: one product that many companies can sign up for, now with a sales pipeline. **It went live on 11 November** at https://crm-gpt-2026.web.app, with the existing data moved across, and was handed to the Grow Plus team on 16 November. All the work (about 60 saved changes) is on GitHub (`main`).

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

## Fixes before handing over to the team (13–16 November)

A full test pass (reading every source file and using the app as admin, employee, client and a read-only company, on desktop and phone) found about 90 problems, 8 of them serious. The ones that mattered before real use were fixed, tested and deployed on 16 November:

- **Clients can no longer see what a project costs us.** A client's project page showed "Current Costs" and "Project Profit" with the margin. Those cards and the financial tabs are now for admins and managers only. The cost figures were also moved out of the project record a client's browser receives into a separate record that only admins and managers can read, so they can't be found with browser tools either. Employees are kept out of it too.
- **Admins can open projects.** The open button on the Projects list was hidden for admins only, so they had no way into a project page.
- **Clients can open their projects.** The project name in the Projects list is now a link for everyone. A client linked to a project directly no longer gets sent back to the list, and a project with nobody assigned no longer gives the client a blank page.
- **Profile pictures can't be listed.** Any signed-in person of any company could list the shared profile-pictures folder, whose file names start with user IDs. Pictures now open only by their own link.
- **"Contact us" reaches a real person.** The links on the sign-up page and in the trial-ended banner went to a placeholder address; they now go to the owner's email.

The team was told about the remaining rough edges and how to work around them (see Status below).

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
| Automated tests | 78 unit tests of the business rules and the data move, and 82 security tests of who can read and change what. |

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
- Admins and clients had no way to open a project from the Projects list (see 13–16 November).

**Security**
- Role-based database and file-storage rules: each company is isolated, and clients see only their own projects.
- Sign-up and invites are checked by the database rules, not just the screens. A gap found in a security review was fixed: an invite could be used up without joining.
- Card numbers and security codes are never stored.
- **The live database was open to everyone**; it is now closed (see Go-live).
- **Billing details are private.** The card summary, billing period and contact email were readable by every member of a company, including outside clients. They are now kept apart, visible only to that company's admins and the product owner.
- **Email addresses are confirmed.** Before, anyone could sign up with an address they didn't own. Now the confirmation link must be clicked first, and the database itself enforces it.
- People can no longer put someone else's email on their own profile.
- The super admin for the move was taken from the login system, not from data anyone could have edited while the old database was open.
- **Project costs are staff-only.** Clients and employees can't read them, on screen or in the data their browser receives.
- The shared profile-pictures folder can no longer be listed.

**Speed and upkeep**
- The first download dropped from 2.5 MB to 76 KB, because pages now load when opened.
- README and TODO were rewritten. Lint errors and an invalid TypeScript setting were fixed.

## Status and next steps

**Where it stands.** Live at https://crm-gpt-2026.web.app since 11 November, with the home page since 12 November and the fixes above since 16 November. The Grow Plus team can start using it. It is not yet ready to sell to other companies (see Next work). GitHub (`main`) matches the live site.

**Checks.** All of these pass:
- 78 unit tests and 82 security tests;
- type check, lint (0 errors) and the production build;
- a hand test of each fix on local data as admin, manager, employee and client;
- the live website and its database and file rules are identical to what was tested.

**Workarounds given to the team**
- Upload one file at a time: several at once keeps only one.
- Don't edit the same project at the same moment as someone else; the last save wins.
- Amounts on projects show "$" but mean AED.
- The Executive Report figures and "Preview PDF" don't work yet.
- Admins shouldn't remove themselves from the team: nothing yet stops the last admin doing it.

**To check on live**
- The other three people sign in (on 16 November only the owner had signed in since go-live).
- Send a test invite to an address you can open, to confirm the email arrives (it comes from noreply@crm-gpt-2026.firebaseapp.com).

**Next work**
- Real card payments with Stripe. This needs the Firebase Blaze plan. It would also let the app send invite emails itself.
- Optionally a custom domain, with sign-up on the main domain and the app on `app.`.
- Fix the Executive Briefing PDF (it fails to generate) and replace its fixed risk paragraph and the Executive Report's invented figures with real ones.
- Work through the rest of the test findings, starting with: paid payments shown as overdue, no deadline alerts for running projects, text that can't be copied, multi-file upload, "Add Member" not saving, mixed $ and AED, and live updates when two people edit at once.
- Before selling: real payments instead of the test card form on the public sign-up page, and the final plan names and prices.
- Removing a user should also remove their login. This needs a server function.
