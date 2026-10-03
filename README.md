# Workspace CRM

React/TypeScript CRM with Firebase authentication, workspace memberships, server-authorized mutations and quarantined file storage. Records live under workspaces/{workspaceId}. Roles are admin, manager, user and client; personal profiles do not grant authority.

Use Node 24 and Java 21. Run `npm ci` and `npm --prefix functions ci`, then `npm run dev:local` to run the frontend and Auth/Firestore/Storage/Functions emulators together. Open http://localhost:8080 and create a local account/workspace. Emulator snapshots are saved under `.ops-private` every minute, with a Windows copy fallback and a pointer to the last complete snapshot. Local accounts are separate from production accounts.

For an already-running frontend: copy `.env.example` to `.env.local`, start `npm run dev:backend` in a second terminal, and reload the app. Frontend-only `npm run dev` does not start the workspace backend. For hosted use, configure a real project and region with `VITE_USE_EMULATORS=false`, and deploy functions/rules/indexes explicitly after release approval.

Verify with npm run lint, npm run typecheck, npm test, npm run build, functions build/tests and npm run test:rules. Java 21 is required for emulator tests.

Read [operations and release gates](docs/operations.md) and [migration, backup and restore](docs/migration.md). Credentials, manual billing, scanner/OCR/model services, mail, monitoring and a staging restore drill require operator setup and evidence. A build does not prove those integrations.

Historical WebSocket chatbot documentation and root seed/fix/test launchers describe the previous architecture and are not production setup instructions.

## Demo data and assistant
`node scripts/seed-local-demo.mjs <local-admin-email> <workspace-id>` inserts synthetic records through the authorized local API and skips existing demo IDs. It never connects to production. The assistant uses clearly labelled CRM quick answers in the emulator when no AI_MODEL is configured; hosted/Ollama model chat remains available when configured. Try a workspace overview, unpaid invoices, upcoming deadlines, or a draft checklist for a named tender. Task proposals require exact project/employee names and explicit confirmation. Document content requires scanning and indexing; seeded files remain quarantined.
