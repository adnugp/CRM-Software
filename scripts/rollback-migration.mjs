import { readFile } from 'node:fs/promises';
import { args, connect, encode } from './admin-common.mjs';
import { fingerprint } from './migration-plan.mjs';
const options = args();
const { db } = connect(options);
const backup = JSON.parse(await readFile(options.snapshot, 'utf8'));
if (backup.projectId !== options.project || backup.workspaceId !== options.workspace || !backup.migrationId) throw Error('Snapshot target mismatch');
const results = [];
// Parent metadata and divisions remain for safety; no recursive delete or Storage delete.
for (const entry of [...backup.planned].reverse()) {
  if (!entry.path.startsWith(`workspaces/${options.workspace}/`) || entry.path.includes('/divisions/')) continue;
  await db.runTransaction(async tx => {
    const ref = db.doc(entry.path), snap = await tx.get(ref);
    if (!snap.exists) { results.push({ path: entry.path, status: 'absent' }); return; }
    const { _migration, ...content } = encode(snap.data());
    if (_migration?.id !== backup.migrationId || _migration.fingerprint !== entry.data._migration.fingerprint || fingerprint(content) !== _migration.fingerprint) {
      results.push({ path: entry.path, status: 'preserved-conflict' }); return;
    }
    results.push({ path: entry.path, status: options.apply ? 'deleted-owned-unchanged' : 'would-delete-owned-unchanged' });
    if (options.apply) tx.delete(ref);
  });
}
console.log(JSON.stringify(results, null, 2));
