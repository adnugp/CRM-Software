// Adds your own logins to the LOCAL emulators, without wiping anything.
//
//   npm run accounts
//
// Accounts come from scripts/local-accounts.json (git-ignored, because it holds
// passwords). Copy scripts/local-accounts.example.json to start one.
// Running it again is safe: existing logins get their role, name and password reset.
// `npm run seed` also runs this at the end, so a reset never loses your logins.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertEmulatorsRunning, put, upsertLogin } from './emulator-rest.mjs';

const FILE = fileURLToPath(new URL('./local-accounts.json', import.meta.url));
const ROLES = ['admin', 'manager', 'user', 'client'];

export async function addLocalAccounts() {
  if (!existsSync(FILE)) return [];
  const { password: sharedPassword, accounts = [] } = JSON.parse(readFileSync(FILE, 'utf8'));

  const added = [];
  for (const a of accounts) {
    if (!ROLES.includes(a.role)) {
      throw new Error(`${a.email}: role must be one of ${ROLES.join(', ')} (got "${a.role}")`);
    }
    const uid = await upsertLogin(a.email, a.password ?? sharedPassword, a.name);
    await put('users', uid, {
      name: a.name, email: a.email, role: a.role, company: a.company, organizationId: a.organizationId,
    });
    // Staff also appear in the employee directory (doc ID = login ID, so task assignees line up).
    if (a.role !== 'client') {
      await put('employees', uid, {
        name: a.name, email: a.email, department: a.department ?? '', position: a.position ?? '',
        phone: a.phone ?? '', joinDate: new Date().toISOString().slice(0, 10), status: 'active', createdAt: new Date(),
      });
    }
    added.push(a);
  }
  return added;
}

// Run directly (npm run accounts), not when imported by the seed script.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await assertEmulatorsRunning();
  if (!existsSync(FILE)) {
    console.error('No scripts/local-accounts.json yet. Copy scripts/local-accounts.example.json to create it.');
    process.exit(1);
  }
  const added = await addLocalAccounts();
  console.log('Local accounts ready:');
  for (const a of added) console.log(`  ${a.role.padEnd(8)} ${a.email}`);
}
