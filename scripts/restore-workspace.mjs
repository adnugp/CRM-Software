import { readFile } from 'node:fs/promises';
import { args, connect, decode, encode } from './admin-common.mjs';
import { fingerprint } from './migration-plan.mjs';
const options = args();
const { db } = connect(options);
const backup = JSON.parse(await readFile(options.snapshot, 'utf8'));
if (backup.version !== 1 || backup.projectId !== options.project || backup.workspaceId !== options.workspace || !Array.isArray(backup.documents)) throw Error('Backup project/workspace/version mismatch');
const paths = new Set();
const missing = [], conflicts = [];
for (const entry of backup.documents) {
  if ((entry.path !== `workspaces/${options.workspace}` && !entry.path.startsWith(`workspaces/${options.workspace}/`)) || entry.path.split('/').length % 2 || paths.has(entry.path)) throw Error('Invalid or duplicated backup path');
  paths.add(entry.path);
  const snap = await db.doc(entry.path).get();
  if (!snap.exists) missing.push(entry);
  else if (fingerprint(encode(snap.data())) !== fingerprint(entry.data)) conflicts.push(entry.path);
}
console.log(JSON.stringify({ dryRun: !options.apply, create: missing.map(d => d.path), conflicts }, null, 2));
if (conflicts.length) process.exitCode = 1;
else if (options.apply) for (const entry of missing) await db.doc(entry.path).create(decode(entry.data, db));
