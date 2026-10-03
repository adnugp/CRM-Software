import { createHash } from 'node:crypto';

export const collections = ['projects', 'tenders', 'employees', 'registrations', 'payments', 'subscriptions', 'partners', 'files', 'customers', 'contacts', 'invoices', 'milestones', 'comments', 'renewals', 'tasks'];
export const safeId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export function fingerprint(value) {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical(v[k])])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function planMigration(source, config, existing = {}) {
  if (!safeId(config.workspaceId) || !safeId(config.migrationId)) throw Error('Explicit workspaceId and migrationId required');
  if (!Array.isArray(config.divisions) || config.divisions.length !== 2 || config.divisions.some(d => !safeId(d.id) || !d.name) || new Set(config.divisions.map(d => d.id)).size !== 2) throw Error('Exactly two explicit divisions required');
  const roles = ['admin', 'manager', 'user', 'client'];
  if (!config.members || !Object.keys(config.members).length || !Object.values(config.members).some(m => m.role === 'admin' && m.active)) throw Error('Explicit member mapping with active admin required');
  if (!safeId(config.actorUid) || config.members[config.actorUid]?.role !== 'admin' || !config.members[config.actorUid]?.active) throw Error('actorUid must name mapped active admin');
  const writes = [], errors = [], counts = {};
  function add(path, data) {
    const hash = fingerprint(data), old = existing[path];
    if (old) {
      const { _migration, ...content } = old;
      if (_migration?.id === config.migrationId && _migration.fingerprint === hash && fingerprint(content) === hash) { counts.skipped = (counts.skipped || 0) + 1; return; }
      errors.push(`Conflict at ${path}`); return;
    }
    writes.push({ path, data: { ...data, _migration: { id: config.migrationId, fingerprint: hash } } });
  }
  const recordCount = collections.reduce((total, name) => total + (source[name] || []).length, 0);
  add(`workspaces/${config.workspaceId}`, { name: config.workspaceName || config.workspaceId, status: 'active', billing: { plan: 'manual', status: 'active', limits: { members: Object.keys(config.members).length, records: Math.max(recordCount, 10000), aiMessages: 0 } }, recordCount, divisions: config.divisions, currency: config.currency || 'AED', timezone: config.timezone || 'Asia/Dubai' });
  for (const [uid, member] of Object.entries(config.members)) {
    if (!safeId(uid) || !roles.includes(member.role) || typeof member.active !== 'boolean') { errors.push(`Invalid membership ${uid}`); continue; }
    add(`workspaces/${config.workspaceId}/members/${uid}`, { role: member.role, active: member.active });
  }
  for (const collection of collections) {
    counts[collection] = (source[collection] || []).length;
    for (const { id, data } of source[collection] || []) {
      if (!safeId(id) || data._migration) { errors.push(`Invalid or previously marked source ${collection}/${id}`); continue; }
      const divisionId = config.recordDivisions?.[`${collection}/${id}`];
      if (!config.divisions.some(d => d.id === divisionId)) { errors.push(`Missing division mapping ${collection}/${id}`); continue; }
      const cleaned = { ...data, workspaceId: config.workspaceId, divisionId, version: 1, createdBy: config.actorUid, updatedBy: config.actorUid };
      // No legacy URL is a trusted download link. Scan approval must precede access.
      if (collection === 'files') {
        for (const field of ['url', 'downloadURL', 'downloadUrl', 'data', 'base64', 'content', 'fileData', 'versions', 'currentVersionId', 'storagePath']) delete cleaned[field];
        cleaned.quarantine = 'pending'; cleaned.storageStatus = 'missing';
        if (!cleaned.recordCollection || !cleaned.recordId) { cleaned.recordCollection = 'files'; cleaned.recordId = id; }
      }
      add(`workspaces/${config.workspaceId}/${collection}/${id}`, cleaned);
    }
  }
  return { workspaceId: config.workspaceId, migrationId: config.migrationId, counts, errors, writes };
}
