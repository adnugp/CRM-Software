# One-workspace migration and recovery

Rehearse in staging. migrate-workspace.mjs copies allowlisted legacy root records to workspaces/{workspaceId}/{collection}/{originalId}, preserving IDs and business fields. Root data stays untouched. Exactly two explicitly mapped divisions are required; company names never infer division or tenant.

Explicitly map authenticated UIDs to admin, manager, user or client with active boolean. Review a legacy owner before mapping to admin and employee/member before mapping to user. Resolve ambiguous roles manually. Existing profiles are not rewritten or trusted for role authority. The mapped actorUid must be an active admin and already exist in target Auth. Review assignedTo/assignedUserIds/sharedWith against real UIDs before cutover.

Private mapping example:

```json
{"workspaceId":"legacy-crm","workspaceName":"Legacy CRM","migrationId":"legacy-v1","actorUid":"REPLACE_AUTH_UID","currency":"AED","timezone":"Asia/Dubai","divisions":[{"id":"grow-plus","name":"Grow Plus"},{"id":"sadeem","name":"Sadeem Energy"}],"members":{"REPLACE_AUTH_UID":{"role":"admin","active":true}},"recordDivisions":{"projects/ORIGINAL_ID":"grow-plus"}}
```

Every source collection/id needs recordDivisions mapping, including files/financial records. Allowlist: projects,tenders,employees,registrations,payments,subscriptions,partners,files,customers,contacts,invoices,milestones,comments,renewals,tasks.

1. Freeze legacy writes operationally; take managed export when available and secure encrypted storage/retention. Sequential reads are not a point-in-time snapshot.
2. Preview with `node scripts/migrate-workspace.mjs --project TARGET_PROJECT --workspace legacy-crm --mapping PRIVATE_MAPPING.json --output PRIVATE_DRY_RUN.json`. Default is read-only. Output must not exist and contains source data/pre-migration target.
3. Review counts, every missing mapping/conflict, references and target. Errors block writes. Apply with a new output filename and `--apply --confirm-project TARGET_PROJECT`.
4. Copy reviewed local files, verify scanning/permissions/counts in staging, then cut over.

Writes are create-only. Existing non-migration data conflicts even if equal. Same migration/mapping skips owned unchanged records. Concurrent changes fail safely and may leave partial migration. Snapshot stores planned records and per-document created checkpoint. Replay detects ownership even after death between write/checkpoint. Never change migration ID to evade conflicts; changed records need review.

Rollback preview: `node scripts/rollback-migration.mjs --project TARGET_PROJECT --workspace legacy-crm --snapshot PRIVATE_APPLY.json`. Apply adds matching confirmation/apply flags. Only unchanged child documents with matching migration ID/fingerprint are deleted transactionally. Workspace metadata, Storage objects, modified/new/non-migration records and profiles remain. Uploaded/scanned file metadata needs manual reconciliation. No recursive delete occurs.

## Local uploads

File metadata strips embedded/base64 bytes and legacy URLs, defaults pending quarantine/missing bytes. Legacy public links do not become trusted downloads. Private manifest example:

```json
{"projectId":"TARGET_PROJECT","workspaceId":"legacy-crm","migrationId":"legacy-v1","files":[{"recordId":"ORIGINAL_FILE_ID","versionId":"legacy-v1","relativePath":"reviewed/report.pdf","mimeType":"application/pdf"}]}
```

Preview: `node scripts/copy-legacy-uploads.mjs --project TARGET_PROJECT --workspace legacy-crm --bucket TARGET_BUCKET --root LOCAL_APPROVED_ROOT --manifest PRIVATE_FILES.json --output PRIVATE_UPLOAD_PLAN.json`. Real paths/symlinks must stay within approved root. Review hashes/sizes/paths, choose new output filename and append apply/project confirmation plus `--confirm-bucket TARGET_BUCKET`.

Copies are create-only/pending, without download tokens. Matching migration-owned object/hash can skip on replay; conflicting object/version stops. Partial upload/scanner changes need operator reconciliation. Only reviewed local bytes are copied: no decoding embedded data or fetching remote URLs. Scan/download evidence is required before considering files migrated.

## Backup and restore

`node scripts/backup-workspace.mjs --project TARGET_PROJECT --workspace WORKSPACE_ID --output PRIVATE_BACKUP.json` recursively exports workspace Firestore records, retaining Timestamp/GeoPoint/reference/byte types. It excludes Auth, Storage bytes, rules/indexes/secrets/project settings: export separately. Use encrypted/access-controlled retention. Never commit snapshots/manifests.

`node scripts/restore-workspace.mjs --project TARGET_PROJECT --workspace WORKSPACE_ID --snapshot PRIVATE_BACKUP.json` verifies project/workspace/version and previews missing/conflicting records. Apply needs matching confirmation. Equal existing records remain; differences block writes; missing records are create-only. No overwrite/delete or cross-project restore. For a drill, back up and restore in that same staging project. Cross-project move needs reviewed Auth/reference/Storage transformation. Record actual readback/types/counts/permissions before claiming recovery verified.

## Server export and tenant deletion

The application export flow queues `workspaceExport` and returns a job ID/status. Poll `workspaceExportStatus`; completion returns a one-minute gzip JSONL download URL. The export contains tenant Firestore rows and Storage manifest entries `{type: 'storage', path, backupPath}`. Bytes are copied under `backups/{workspaceId}/{backupId}/objects`, outside the live tenant deletion prefix. Operator scripts above export Firestore only; keep that distinction in recovery planning. Verify a real staging export's Storage byte manifest/readback before relying on it.

Tenant deletion requires admin membership, authentication within five minutes, exact workspace-name confirmation and a latest unchanged backup no older than 24 hours. Purge is queued and scoped to the tenant; global Auth identities and backup objects remain. Do not initiate deletion without a reviewed staging recovery drill, backup checksum/readback evidence and retention approval. This runbook describes the implemented queue contract; production queue execution and recovery remain release gates.
