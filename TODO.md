# TODO

## Before the first deploy of the multi-company version
The live project (`crm-gpt-2026`) still has the old single-company layout: top-level
`projects`, `tenders`, … with `belongsTo` set to a company name. The new rules deny all of it
until it is migrated. Write and run a one-time migration script (Admin SDK) that:
- [ ] Creates `workspaces/{id}` for the current company with divisions
      **Grow Plus Technologies (GPT)** and **Sadeem Energy (SDE)**, so existing
      `PRJ-GPT-…` / `PRJ-SDE-…` numbers stay valid.
- [ ] Copies every top-level business collection under `workspaces/{id}/…`, mapping
      `belongsTo` → `divisionId` (Files: `company` → `divisionId`).
- [ ] Sets `workspaceId` on every `users/{uid}` and gives everyone a `role`.
- [ ] Sets `status: 'active'`, `plan: 'custom'`, `staffLimit: 0` and `staffCount` (number of
      staff users) on the existing company, or invites and staff removal will be rejected.
- [ ] Creates `platformOwners/{owner uid}` for the product owner (Admin SDK; the app can't).
- [ ] Checks that client projects have `clientId` or `organizationId` set.
- [ ] Is tested against an emulator copy of the live data first.
- [ ] Then deploys: `npx firebase deploy --only firestore:rules,storage,hosting`.
- [ ] Two Hosting sites: the main domain for `/signup` (and later a landing page), an `app.`
      domain for the app. Set `VITE_APP_URL` to the app address so invite links point there.

## Product (later sub-projects)
- [ ] Card payment with Stripe (Cloud Functions, Blaze plan): replace the demo
      `savePaymentMethod` in `src/services/billing.ts`, charge when the trial ends,
      send invite and sign-up emails, and verify sign-up email addresses.

## Known gaps
- [ ] The project "Executive Briefing" PDF (`ProjectManagement.tsx`) prints a fixed
      risk paragraph ("financial leakage ≈ 1.8%", "self-fundable") that is not calculated
      from the project. Replace it with real figures or remove it before selling.
- [ ] Removing a user deletes their profile but not their Firebase Auth login (needs a Cloud
      Function with the Admin SDK). They can still sign in but see no data.
- [ ] Replacing a company logo leaves the old file in Storage.
- [ ] "Email alert" settings are stored only in the browser (localStorage) and nothing sends emails.
- [ ] Plan names, prices and `SALES_EMAIL` in `src/config/plans.ts` are placeholders.
- [ ] Some forms (project costs, tasks, partners, payments …) still close before the save
      finishes, so a failed save shows no "not saved" message there. Projects, tenders and
      employees were fixed; apply the same pattern to the rest.
- [ ] Turn on TypeScript `strict` mode gradually. Form data types are loose because it's off.
