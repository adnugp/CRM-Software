# Workspace-specific demo data

CRM business records, including employees, live under
`workspaces/{workspaceId}/{collection}`. Company/customer labels and operating
divisions do not grant access to another workspace. Member lists are requested for
the active workspace. Switching workspaces clears the member list and remounts the
data provider; old requests are discarded. The frontend also rejects record pages
whose workspace IDs differ from the requested workspace.

The original seed duplicated samples into both demo workspaces. The local-only
`scripts/separate-local-demo.mjs` now normalizes only known demo IDs, saves private
backups first, and creates a distinct Sadeem sample team. It preserves user-created
records and the shared demo administrator. Former Grow Plus sample staff have their
Sadeem memberships revoked after replacing their Sadeem demo assignments. Each demo
workspace has only its own operating division available in record forms.

Verification: `node scripts/verify-local-workspaces.mjs LOCAL_DEMO_ADMIN_EMAIL`
checks workspace IDs across every business collection, distinct sample employees,
and denial of Sadeem access for a Grow Plus-only sample account. It calls only local
demo emulators and never consumes AI provider quota.
