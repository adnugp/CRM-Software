// scripts/lib/migration.mjs
// Pure helpers for moving the old single-company layout (top-level collections)
// into one workspace. They work on Firestore REST documents ({ name, fields }),
// so dates, numbers and maps pass through untouched.

export const BUSINESS_COLLECTIONS = [
  'projects', 'tenders', 'employees', 'registrations', 'payments', 'subscriptions', 'partners', 'files',
];
export const COLLECTIONS = [...BUSINESS_COLLECTIONS, 'users'];
export const WORKSPACE_ID = 'grow-plus';
export const WORKSPACE_NAME = 'Grow Plus Technologies';
export const OWNER_EMAIL = 'mohamedismayil@gptechnologies.ae';
export const STAFF_ROLES = ['admin', 'manager', 'user'];
export const ROLES = [...STAFF_ROLES, 'client'];

export const docId = (doc) => doc.name.split('/').pop();
export const str = (doc, field) => doc.fields?.[field]?.stringValue;
const sv = (v) => ({ stringValue: v });

export function checkBackup(backup) {
  const missing = COLLECTIONS.filter((c) => !Array.isArray(backup?.collections?.[c]));
  if (missing.length) throw new Error(`Backup is missing: ${missing.join(', ')}`);
}

/** The record's fields without the old company tag. */
export function convertRecord(collection, doc) {
  const fields = { ...(doc.fields ?? {}) };
  delete fields.belongsTo;
  if (collection === 'files') delete fields.company;
  return fields;
}

export const countStaff = (users) => users.filter((u) => STAFF_ROLES.includes(str(u, 'role'))).length;

export const findOwner = (users, email = OWNER_EMAIL) =>
  users.find((u) => (str(u, 'email') ?? '').toLowerCase() === email.toLowerCase());

export function workspaceFields(users, now) {
  return {
    name: sv(WORKSPACE_NAME),
    divisions: { arrayValue: {} },
    status: sv('active'),
    plan: sv('custom'),
    staffLimit: { integerValue: '0' },
    staffCount: { integerValue: String(countStaff(users)) },
    createdAt: { timestampValue: now.toISOString() },
  };
}

/** Every write for documents:commit, in order. Safe to run twice. */
export function buildWrites(backup, { project, now }) {
  checkBackup(backup);
  const base = `projects/${project}/databases/(default)/documents`;
  const ws = `${base}/workspaces/${WORKSPACE_ID}`;
  const users = backup.collections.users;
  const wsFields = workspaceFields(users, now);

  // The mask keeps a logo or colour set after a first run.
  const writes = [{ update: { name: ws, fields: wsFields }, updateMask: { fieldPaths: Object.keys(wsFields) } }];
  for (const col of BUSINESS_COLLECTIONS) {
    for (const d of backup.collections[col]) {
      writes.push({ update: { name: `${ws}/${col}/${docId(d)}`, fields: convertRecord(col, d) } });
    }
  }
  for (const u of users) {
    writes.push({
      update: { name: `${base}/users/${docId(u)}`, fields: { workspaceId: sv(WORKSPACE_ID) } },
      updateMask: { fieldPaths: ['workspaceId'] },
    });
  }
  const owner = findOwner(users);
  if (owner) {
    writes.push({
      update: {
        name: `${base}/platformOwners/${docId(owner)}`,
        fields: { email: sv(OWNER_EMAIL), createdAt: { timestampValue: now.toISOString() } },
      },
    });
  }
  return writes;
}

/** What apply would do, plus anything that would break after the move. */
export function planReport(backup) {
  checkBackup(backup);
  const { users, projects } = backup.collections;
  const owner = findOwner(users);
  const warnings = [];

  for (const u of users) {
    const role = str(u, 'role');
    const email = str(u, 'email') ?? docId(u);
    if (!role) warnings.push(`${email} has no role (they will see no data).`);
    else if (!ROLES.includes(role)) warnings.push(`${email} has role "${role}", which is not one of ${ROLES.join(', ')}.`);
    if (role === 'client') {
      const org = str(u, 'organizationId');
      const linked = projects.some((p) => str(p, 'clientId') === docId(u) || (org && str(p, 'organizationId') === org));
      if (!linked) warnings.push(`Client ${email} has no linked projects (they will see none).`);
    }
  }
  for (const p of projects) {
    if (str(p, 'clientName') && !str(p, 'clientId') && !str(p, 'organizationId')) {
      warnings.push(`Project ${docId(p)} names a client but isn't linked to one (no clientId or organizationId).`);
    }
  }
  for (const col of BUSINESS_COLLECTIONS) {
    const n = backup.collections[col].filter((d) => !d.fields?.createdAt).length;
    if (n) warnings.push(`${col}: ${n} record${n === 1 ? '' : 's'} without createdAt (lists sort by it, so they won't show).`);
  }
  if (!owner) warnings.push(`Super admin ${OWNER_EMAIL} was not found among users.`);

  return {
    counts: Object.fromEntries(COLLECTIONS.map((c) => [c, backup.collections[c].length])),
    staffCount: countStaff(users),
    owner: owner ? str(owner, 'email') : null,
    users: users.map((u) => ({ email: str(u, 'email') ?? docId(u), role: str(u, 'role') ?? '', owner: u === owner })),
    warnings,
  };
}
