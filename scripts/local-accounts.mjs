// Adds your own company and logins to the LOCAL emulators, without wiping anything.
//
//   npm run accounts
//
// Everything comes from scripts/local-accounts.json (git-ignored, because it
// holds passwords and your company details). Copy
// scripts/local-accounts.example.json to start one. Running it again is safe:
// the workspace's name and divisions, and each login's role, name and
// password, are reset to what the file says.
// `npm run seed` also runs this at the end, so a reset never loses your logins.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { assertEmulatorsRunning, put, upsertLogin } from './emulator-rest.mjs';

const FILE = fileURLToPath(new URL('./local-accounts.json', import.meta.url));
const ROLES = ['admin', 'manager', 'user', 'client'];
const CODE = /^[A-Z]{2,4}$/;

export async function addLocalAccounts() {
  if (!existsSync(FILE)) return [];
  const { password: sharedPassword, workspace, accounts = [] } = JSON.parse(readFileSync(FILE, 'utf8'));

  if (!workspace?.id || !workspace?.name) {
    throw new Error('scripts/local-accounts.json needs a "workspace": { "id", "name" } block (see local-accounts.example.json).');
  }
  const divisions = (workspace.divisions ?? []).map((d) => {
    if (!CODE.test(d.code)) throw new Error(`Division "${d.name}": code must be 2-4 capital letters (got "${d.code}")`);
    return { id: d.id ?? `div-${d.code.toLowerCase()}`, name: d.name, code: d.code };
  });
  await put('workspaces', workspace.id, {
    name: workspace.name, brandColor: workspace.brandColor, divisions, createdAt: new Date(),
  });

  const added = [];
  for (const a of accounts) {
    if (!ROLES.includes(a.role)) {
      throw new Error(`${a.email}: role must be one of ${ROLES.join(', ')} (got "${a.role}")`);
    }
    const uid = await upsertLogin(a.email, a.password ?? sharedPassword, a.name);
    await put('users', uid, {
      name: a.name, email: a.email, role: a.role, workspaceId: workspace.id,
      company: a.company, organizationId: a.organizationId,
    });
    // Staff also appear in the employee directory (doc ID = login ID, so task assignees line up).
    if (a.role !== 'client') {
      await put(`workspaces/${workspace.id}/employees`, uid, {
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
