import { readFile, writeFile } from 'node:fs/promises';
import { args, connect, encode, decode, readTree } from './admin-common.mjs';
import { collections, planMigration } from './migration-plan.mjs';

const options = args();
const { db } = connect(options);
if (typeof options.mapping !== 'string' || typeof options.output !== 'string') throw Error('--mapping and --output required (output is an exclusive backup/checkpoint file)');
const config = JSON.parse(await readFile(options.mapping, 'utf8'));
if (config.workspaceId !== options.workspace) throw Error('Workspace differs from mapping');
const source = {};
for (const name of collections) source[name] = (await db.collection(name).get()).docs.map(d => ({ id: d.id, data: encode(d.data()) }));
const target = await readTree(db, `workspaces/${options.workspace}`);
const plan = planMigration(source, config, Object.fromEntries(target.map(d => [d.path, d.data])));
const backup = { version: 1, projectId: options.project, workspaceId: options.workspace, migrationId: config.migrationId, source, target, planned: plan.writes, created: [] };
await writeFile(options.output, JSON.stringify(backup, null, 2), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ dryRun: !options.apply, ...plan, writes: plan.writes.map(w => w.path) }, null, 2));
if (plan.errors.length) process.exitCode = 1;
else if (options.apply) {
  for (const entry of plan.writes) {
    await db.doc(entry.path).create(decode(entry.data, db)); // Never overwrite concurrent or non-migration data.
    backup.created.push(entry.path);
    await writeFile(options.output, JSON.stringify(backup, null, 2), { mode: 0o600 });
  }
}
