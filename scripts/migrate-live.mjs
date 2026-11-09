// scripts/migrate-live.mjs
// One-time move of the old single-company data into the "Grow Plus Technologies"
// workspace. See docs/go-live.md for when and how to run each step.
//
//   npm run migrate -- backup --source live|emulator
//   npm run migrate -- plan <backup.json>
//   npm run migrate -- apply <backup.json> --target emulator|live --owner-uid <uid> [--emulator-logins]
//
// --owner-uid is the super admin's UID, copied from Firebase console → Authentication.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { COLLECTIONS, buildWrites, checkBackup, docId, planReport, str } from './lib/migration.mjs';
import { commit, listAll, target } from './lib/firestore-rest.mjs';
import { TEST_PASSWORD, assertEmulatorsRunning, upsertLoginWithUid } from './emulator-rest.mjs';

const [step, ...rest] = process.argv.slice(2);
const flag = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};
// The first argument that is neither a flag nor a flag's value.
const VALUE_FLAGS = ['--source', '--target', '--owner-uid'];
const file = rest.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(rest[i - 1]));
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const load = (path) => {
  if (!path) throw new Error('Give the backup file, e.g. backups/live-2026-11-09-1030.json');
  const backup = JSON.parse(readFileSync(path, 'utf8'));
  checkBackup(backup);
  return backup;
};

async function backup() {
  const t = target(flag('source') ?? '');
  if (t.name === 'emulator') await assertEmulatorsRunning();
  const collections = {};
  for (const c of COLLECTIONS) {
    collections[c] = await listAll(t, c);
    console.log(`  ${c.padEnd(14)} ${collections[c].length}`);
  }
  mkdirSync('backups', { recursive: true });
  const path = `backups/${t.name}-${stamp()}.json`;
  writeFileSync(path, JSON.stringify({ source: t.name, takenAt: new Date().toISOString(), collections }, null, 1));
  console.log(`\nSaved ${path}. Nothing was changed.`);
}

function plan() {
  const r = planReport(load(file));
  console.log('Records to copy into workspaces/grow-plus:');
  for (const [c, n] of Object.entries(r.counts)) console.log(`  ${c.padEnd(14)} ${n}`);
  console.log(`\nWorkspace: Grow Plus Technologies, active, plan custom, no staff limit, ${r.staffCount} staff.`);
  console.log('\nPeople:');
  for (const u of r.users) console.log(`  ${(u.role || '(none)').padEnd(8)} ${u.email.padEnd(40)} ${u.uid}${u.owner ? '  ← super admin' : ''}`);
  console.log('\nCheck every person and UID above against Firebase console → Authentication:');
  console.log("anyone you don't recognise could have been added while the old rules were open.");
  if (r.owners.length === 1) console.log(`Then apply with --owner-uid ${r.owners[0].uid} if that is your UID there.`);
  console.log(r.warnings.length ? `\nWarnings (${r.warnings.length}):` : '\nNo warnings.');
  for (const w of r.warnings) console.log(`  ! ${w}`);
  console.log('\nThis was a dry run. Nothing was changed.');
}

async function apply() {
  const t = target(flag('target') ?? '');
  const data = load(file);
  if (t.name === 'emulator') await assertEmulatorsRunning();
  // Built first so a wrong or missing --owner-uid stops us before anything is written.
  const writes = buildWrites(data, { project: t.project, now: new Date(), ownerUid: flag('owner-uid') });
  if (t.name === 'live') {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(`This writes to the LIVE project. Type ${t.project} to continue: `);
    rl.close();
    if (answer.trim() !== t.project) return console.log('Stopped. Nothing was changed.');
  }
  await commit(t, writes, (done, total) => console.log(`  wrote ${done} / ${total}`));
  console.log(`\nDone: ${writes.length} writes to ${t.name}.`);

  if (rest.includes('--emulator-logins')) {
    if (t.name !== 'emulator') throw new Error('--emulator-logins only works with --target emulator.');
    for (const u of data.collections.users) {
      const email = str(u, 'email');
      if (email) await upsertLoginWithUid(docId(u), email, TEST_PASSWORD, str(u, 'name') ?? email);
    }
    console.log(`Local logins created for ${data.collections.users.length} people (password: TEST_PASSWORD in scripts/emulator-rest.mjs).`);
  }
}

const steps = { backup, plan, apply };
if (!steps[step]) {
  console.log('Usage: npm run migrate -- backup --source live|emulator | plan <file> | apply <file> --target emulator|live --owner-uid <uid> [--emulator-logins]');
  process.exit(1);
}
Promise.resolve(steps[step]()).catch((err) => {
  console.error(`\nFailed: ${err.message}\nNothing after this point was written. Fix the cause and run the same command again.`);
  process.exit(1);
});
