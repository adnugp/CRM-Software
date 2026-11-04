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
- [ ] Checks that client projects have `clientId` or `organizationId` set.
- [ ] Is tested against an emulator copy of the live data first.
- [ ] Then deploys: `npx firebase deploy --only firestore:rules,storage,hosting`.

## Product (later sub-projects)
- [ ] Company sign-up and team invites (today a workspace is created by script).
- [ ] Contacts, companies and a deals pipeline.
- [ ] Plans/billing and an owner console to manage all workspaces.

## Known gaps
- [ ] The project "Executive Briefing" PDF (`ProjectManagement.tsx`) prints a fixed
      risk paragraph ("financial leakage ≈ 1.8%", "self-fundable") that is not calculated
      from the project. Replace it with real figures or remove it before selling.
- [ ] Removing a user deletes their profile but not their Firebase Auth login (needs a Cloud
      Function with the Admin SDK). They can still sign in but see no data.
- [ ] Replacing a company logo leaves the old file in Storage.
- [ ] "Email alert" settings are stored only in the browser (localStorage) and nothing sends emails.
- [ ] Turn on TypeScript `strict` mode gradually. Form data types are loose because it's off.
