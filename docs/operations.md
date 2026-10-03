# CRM operations and release gates

Membership at workspaces/{workspaceId}/members/{uid} grants admin, manager, user or client access. users/{uid} contains personal profiles and must not grant authority. A legacy company describes a business/customer and never infers tenant/division.

## Verification

Use Node 24/Java 21. Install locked frontend/functions dependencies and run lint, typecheck, tests, builds and npm run test:rules. The rules suite requires emulator host variables and uses demo-crm-test; CI uses no real credentials, mail or model calls. Passing tests demonstrates checked behavior only. Deployment, billing, email, antivirus/OCR/model, migration and recovery remain unverified until staging evidence is recorded.

## Credentials

Separate staging/production projects. Browser Firebase config identifies a project; enforced rules/callable authorization protect data. VITE_FUNCTIONS_REGION configures callables; VITE_USE_EMULATORS=true is local only. Never put service account, model/OCR or mail secrets in VITE_* variables.

Admin scripts use Application Default Credentials and explicit project/workspace flags. Obtain scoped short-lived operator identity outside the repository. Admin SDK bypasses rules; operator access controls and exact target confirmation are mandatory. Exports, migration and uploads need different permissions. Scripts never select the repository default project.

Configure server-only AI_PROVIDER, AI_MODEL, AI_ENDPOINT and AI_API_KEY (hosted), plus AI_OCR_ENDPOINT/AI_OCR_API_KEY for scanned documents. Bind secrets in deployment; an example file is not deployment wiring. Verify authentication, timeouts, quotas and data processing approval before using customer content. CI must never call real models.

## Billing, mail and schedules

Initial billing is manual. An operator approves plan/status/limits using authorized server administration and records evidence. Automatic checkout/webhook/payment provisioning is not demonstrated. Migration disables AI quota pending approval.

Configure verified mail identity and secrets, then test a controlled inbox with authorization. Verify scheduler registration, timezone, deduplication, notification history, suppression and failure retries before production notifications.

## Scanning and OCR

Pending uploads use workspaces/{workspaceId}/documents/{fileId}/{versionId}/{filename}. Pending/rejected files must remain unreadable. Trusted scanning must process the exact generation, antivirus/type/size checks and approve only the matching version. Test rejection, outage, duplicate/stale events and generation replacement. Never manually mark clean to bypass a missing scanner.

OCR needs a separately configured service with size/time limits. A text extractor does not prove image-only PDF support. Test text/scanned PDFs in staging and preserve document version permissions for extraction/retrieval.

## Release evidence and monitoring

Capture emulator output, role matrix, cross-workspace denial, direct Firestore/Storage denial, client sharing, scans, audit records, invitation expiry/revocation, schedule/email deduplication, currency-separated report totals, AI unavailable/quota/provider failure and an actual restore drill. Historical root seed/fix/chat launchers predate tenancy safeguards and must not run on live projects.

Configure alerts for callable errors/latency, tenant denials, model/OCR timeout/spend, scan backlog/rejections, scheduler/mail failures. Logs omit secrets, message bodies/file bytes. Record owner/on-call and alert delivery evidence; budget alerts do not enforce quotas.

Release requires approved staging evidence, rules/indexes, bound secrets, verified schedules/monitoring, affected-workspace export and tested recovery. Review exact project before deployment. Operations scripts do not deploy automatically.

## Server service configuration

| Service | Server variables/secrets | Staging proof required |
| --- | --- | --- |
| Chat model | AI_PROVIDER (hosted or ollama), AI_MODEL, AI_ENDPOINT, AI_API_KEY for hosted | Authorized tools, unavailable/provider timeout/quota, bounded tenant conversation |
| Embeddings | AI_EMBEDDING_ENDPOINT, AI_EMBEDDING_MODEL; AI_EMBEDDING_AUTH=separate and AI_EMBEDDING_API_KEY when using a separate secret | Reindex corpus, model/dimension consistency, authorized retrieval and citations |
| Malware scanner | DOCUMENT_SCAN_ENDPOINT, DOCUMENT_SCAN_API_KEY | Pending remains unreadable, clean/rejected/missing-scanner/generation checks |
| OCR | AI_OCR_ENDPOINT, AI_OCR_API_KEY | Image-only PDF, bounded authenticated adapter, failures remain explicit |
| Mail | SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM | Verified sender, controlled recipient, deduplication/retry and no accidental customer mail |
| Retention | AI_RETENTION_DAYS, AUDIT_RETENTION_DAYS | Scheduled cleanup, legal retention approval, deletion limited to intended records |

Use HTTPS endpoints; local Ollama permits loopback HTTP. Secret binding must match callable deployment configuration. No example values or unit tests prove actual service delivery. `npm run test:integration` runs callable handlers with real Auth/Firestore emulator transactions and an in-process fake model; it does not validate production HTTP/auth middleware, real model/OCR/scanning/mail delivery, or deployment.

The server alert scheduler checks hourly and targets 09:00 in each workspace timezone. Delivery uses a leased outbox with at most three retries. Missing SMTP configuration must produce explicit non-delivery, not success. SMTP_PASSWORD is a bound function secret; SMTP_HOST/SMTP_USER/SMTP_FROM/SMTP_PORT remain server configuration. Audit retention defaults to 3650 days with a minimum of 365; align AUDIT_RETENTION_DAYS and AI_RETENTION_DAYS with approved legal/customer policy and verify cleanup in staging.

## Local onboarding
`npm run dev:local` starts isolated demo Auth/Firestore/Storage/Functions and the frontend. Local accounts differ from production accounts; emulator state exports on graceful shutdown. For a frontend already running, use `.env.example` as `.env.local` and `npm run dev:backend`. `npm run test:onboarding` verifies signup, workspace creation/list/members using the Firebase client and actual local HTTP middleware; it never targets production. Hosted workspace listing requires the collection-group members uid/active index in firestore.indexes.json.

Local snapshots now run every minute; Windows uses a copy fallback when Java holds the completed export directory open. The last complete snapshot is tracked by `.ops-private/latest-snapshot.json` and imported by the local launcher; older snapshots remain private. Keep a terminal running; an abrupt stop can still lose changes since the last snapshot. `node scripts/local-snapshots.mjs --once` explicitly saves a snapshot.
