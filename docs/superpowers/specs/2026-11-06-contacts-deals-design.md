# Contacts, companies and deals: design

Sub-project 3 of the ProjectDesk redesign. Status: approved in chat on 2026-11-06.

## Goal

Give each workspace a sales side: a directory of the companies it sells to, the people
there, and a pipeline of deals. A deal that moves forward becomes a **tender** or a
**project**, both of which already exist, so the CRM covers the whole path from first
contact to delivered work.

## Decisions

| Question | Decision |
|---|---|
| How deals relate to existing records | A deal can become a tender ("Convert to tender") or, when won, a project ("Create project"). Tenders and projects themselves do not change. |
| Existing company names | New **Companies** directory. New records link to it by id. Old projects, tenders and payments keep their text `company` and are matched by name or `organizationId`. No migration. |
| Pipeline scope | Fixed stages, plus notes and follow-ups on each deal. |
| Out of scope | Custom stages, sending email, CSV import, a contact-level activity history, deal products or line items, multiple currencies. |

## Data model

All three collections live inside the workspace, next to `tenders` and `projects`.

### `workspaces/{ws}/companies/{id}`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required. Shown everywhere. |
| `industry` | string? | |
| `phone`, `email`, `website`, `address` | string? | |
| `notes` | string? | |
| `organizationId` | string? | Same format as client logins (`ORG-XX-NNN`). Set when the company first gets a client login or invite, then reused. |
| `ownerId` | string | uid of the staff member responsible. |
| `createdAt` | timestamp | |

### `workspaces/{ws}/contacts/{id}`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Required. |
| `email`, `phone`, `jobTitle`, `notes` | string? | |
| `companyId` | string? | A contact may have no company (e.g. a consultant). |
| `createdAt` | timestamp | |

### `workspaces/{ws}/deals/{id}`

| Field | Type | Notes |
|---|---|---|
| `title` | string | Required. |
| `value` | number | AED, ≥ 0. Required. |
| `stage` | `lead` \| `qualified` \| `proposal` \| `negotiation` \| `won` \| `lost` | |
| `companyId` | string | Required. |
| `contactId` | string? | |
| `ownerId` | string | uid. Defaults to whoever created the deal. |
| `divisionId` | string? | Only when the workspace has divisions. |
| `expectedCloseDate` | string? | `YYYY-MM-DD`, like other dates in the app. |
| `source` | string? | Free text, e.g. "Referral", "Website". |
| `nextFollowUp` | `{ date: string, note: string }`? | One open follow-up at a time. Removed when marked done. |
| `lostReason` | string? | Required when `stage` is `lost`. |
| `activities` | `Activity[]` | History, added with `arrayUnion`. |
| `convertedTo` | `{ kind: 'tender' \| 'project', id: string }`? | Set after conversion. |
| `wonAt`, `closedAt` | timestamp? | `closedAt` is set on won and on lost. Reopening a deal clears both. |
| `createdAt` | timestamp | |

`Activity` is `{ id, type: 'note' | 'call' | 'meeting' | 'email' | 'stage', text, at, byId }`.
Stage changes are written as `type: 'stage'` entries automatically ("Moved to Proposal").

**History size.** Activities live in the deal document, so one deal's history is limited by
Firestore's 1 MB document size. That holds roughly 2,000 short entries, which is enough for
one deal. If it ever isn't, they move to a subcollection without changing the screens.

### Stages and win chances

Fixed in `src/config/pipeline.ts`:

| Stage | Win chance |
|---|---|
| Lead | 10% |
| Qualified | 25% |
| Proposal | 50% |
| Negotiation | 75% |
| Won | 100% |
| Lost | 0% |

**Weighted value** = sum of `value × win chance` over open deals (every stage except won and lost).

### Links to existing records

- **Tender and project types** gain two optional fields: `companyId` and `dealId`.
- **Converting a deal** opens the existing Tender or Project form, pre-filled with:
  - name = the deal title;
  - `company` = the company name, and `organizationId` from the company;
  - `divisionId` and description from the deal.

  After a successful save, the deal records `convertedTo`. "Create project" also moves the deal to Won when it wasn't already.
- **"Earlier records"** on a company page lists projects, tenders and payments where any of these holds:
  - `companyId` matches;
  - `organizationId` matches (when both are set);
  - `company` equals the company name, ignoring case and surrounding spaces.
- **Client invites** (Settings → Team) suggest directory companies as you type the client company. Choosing one reuses its `organizationId`, or creates one and saves it on the company.

## Access

Same as tenders:
- Staff (admin, manager, employee) read and write all three collections.
- Clients have no access.
- Other workspaces have no access.
- A read-only workspace (trial ended or suspended) can read but not write.

In `firestore.rules`, add `companies`, `contacts` and `deals` to the staff-only collection list. The rules don't check field contents, as with tenders; the forms do. The read-only guard (moved into a shared `useWriteGuard()` hook used by `DataContext` and `SalesContext`) blocks writes in read-only workspaces.

## Screens

### Sidebar
A new **Sales** group, staff only: **Deals**, **Companies**, **Contacts**. It comes above Projects and Tenders.

### Deals (`/deals`)
- **Board view (default).** One column per stage, each headed by its deal count and total value.
  - **Cards** show the title, company, value, the owner's initials and the follow-up date (red when overdue).
  - **Moving deals.** Drag a card to another column with native HTML drag-and-drop (no new library). A **"Move to…"** menu on each card does the same and works on phones and with the keyboard.
  - Moving to **Lost** asks for a reason first. Moving to **Won** offers "Create project".
- **List view.** A table you can sort by value, expected close and follow-up.
- **Filters** on both views: owner, division (only when divisions exist), and a search on title and company name.
- **Summary bar:** open pipeline value, weighted value, and won this month (deals with `wonAt` in the current month).
- **New deal** dialog fields:
  - title, value, stage (an open stage, default Lead; Won and Lost are reached by moving the deal);
  - company: pick one, or "＋ New company" to type a name and create it on save;
  - contact, filtered by the company;
  - expected close, owner, division, source.

### Deal page (`/deals/:id`)
- **Header:** title, stage badge, value, company and contact links, owner.
- **Actions:**
  - Move stage, Mark won, Mark lost;
  - Convert to tender (hidden once converted);
  - Create project (hidden once converted to a project);
  - Edit, Delete (with confirm).
- **Next follow-up:** a date and a note, with **Done** (clears it and logs a note) and **Reschedule**.
- **History:**
  - a box to add a note, call, meeting or email;
  - entries listed newest first, each with who added it and when.
- **Converted:** a link to the tender or project.
- **Reopen:** a won or lost deal can be moved back to an open stage.

### Companies (`/companies`)
- **List:** name, industry, contacts count, open deals and their value; search.
- **Company page** (`/companies/:id`):
  - editable details;
  - contacts, with add and edit;
  - deals;
  - **Earlier records**, matched as described in "Links to existing records".
- **Delete:** blocked when deals or contacts use the company. The message says how many.

### Contacts (`/contacts`)
- **List:** search, plus the add and edit form (name, email, phone, job title, company).
- **Contact page** (`/contacts/:id`): details and the contact's deals.
- **Delete:** blocked when deals use the contact.

### Dashboard (staff)
- **Follow-ups due:** deals whose `nextFollowUp.date` is today or earlier, oldest first. Each links to its deal.
- **Pipeline:** open value, weighted value, won this month.

### Assistant
`crmChatEngine.ts` gains answers for:
- "deals in &lt;stage&gt;";
- "follow-ups today" (or "overdue follow-ups");
- "pipeline value";
- "deals for &lt;company&gt;".

## Code structure

| File | Responsibility |
|---|---|
| `src/config/pipeline.ts` | `STAGES` (id, label, win chance, open or closed), `stageById`. |
| `src/lib/pipeline.ts` (pure, no `@/` imports) | `pipelineTotals(deals)` → open, weighted, won this month. `isFollowUpDue(deal, today)`, `dueFollowUps(deals, today)`. `stageChange(deal, to, byId, now)` → the fields to write: stage, the stage activity, `wonAt`/`closedAt`, and clearing them on reopen; it rejects Lost without a reason. `sortActivities`, `matchesCompany(record, company)` for earlier records. |
| `src/types/index.ts` | `Company`, `Contact`, `Deal`, `Activity`, `DealStage`. `companyId?` and `dealId?` on Project and Tender. |
| `src/services/firestore.ts` | CRUD for the three collections, following the tender functions. `addDealActivity` uses `arrayUnion`. |
| `src/contexts/SalesContext.tsx` | `companies`, `contacts`, `deals` state and write functions, all through the shared `useWriteGuard()`. |
| `src/pages/Deals.tsx`, `DealDetail.tsx`, `Companies.tsx`, `CompanyDetail.tsx`, `Contacts.tsx`, `ContactDetail.tsx` | Screens. |
| `src/components/deals/` | `DealBoard`, `DealCard`, `DealForm`, `LostReasonDialog`, `ActivityTimeline`, `FollowUpBox`. |
| `src/components/companies/` | `CompanyForm`, `ContactForm`, `CompanyPicker` (with "＋ New company"). |
| `src/components/dashboard/` | `FollowUpsCard`, `PipelineCard`. |

All new forms await their save and keep the dialog open with a "Not saved" toast on failure, like the
project, tender and employee forms.

## Error handling

- **Required fields** show messages on the form (zod): title, value ≥ 0, company, and a lost reason when the stage is Lost.
- **Read-only workspace:** the existing guard shows the read-only toast. The board disables dragging and the "Move to…" menu.
- **Blocked deletes** say why: "3 deals use this company."
- **A deal whose company or contact was deleted** (e.g. by another person at the same moment) shows "Unknown company" instead of failing.

## Testing

- **Unit tests** (`tests/unit/pipeline.test.mjs`, added to `test:unit`):
  - stage table order and win chances;
  - `pipelineTotals`, including won this month;
  - due and overdue follow-ups;
  - `stageChange`: won, lost with and without a reason, reopening;
  - activity sorting and `matchesCompany`.
- **Rules tests** (`tests/security-rules.test.mjs`), for each new collection:
  - staff of the workspace can read and write;
  - a client can't read;
  - another workspace can't read or write;
  - a read-only workspace can read but can't write.
- **Browser run-through on the emulators:**
  1. create a company and a contact;
  2. create a deal, drag it through the stages and use "Move to…";
  3. add notes and a follow-up, then mark it done;
  4. mark a deal lost (the reason is required) and reopen it;
  5. mark a deal won and create a project, and check the links both ways;
  6. convert another deal to a tender;
  7. see the Dashboard cards and a company page with earlier records;
  8. check that a client login has no Sales pages and that Falcon (read-only) can't move deals.
- **Checks:** `tsc`, lint, build and all test suites stay green.

## Demo data (`npm run seed`)

- **Acme:** 6 companies (including the names its existing projects and tenders already use, so earlier records show up), 8 contacts, and 8 deals across every stage, two with overdue follow-ups and one already converted to a project.
- **Noor:** 2 companies and 3 deals.
- **Falcon:** 1 deal, to show read-only.
