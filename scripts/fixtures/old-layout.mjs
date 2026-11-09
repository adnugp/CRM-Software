// scripts/fixtures/old-layout.mjs
// Puts sample data in the OLD single-company layout (top-level collections,
// belongsTo = parent company) into the local emulator, to rehearse the migration.
// Wipes the emulator first; run `npm run seed` afterwards to get the demo data back.
import { assertEmulatorsRunning, clearEmulators, put } from '../emulator-rest.mjs';

const day = (n) => new Date(Date.now() + n * 86400000);
const GPT = 'Grow Plus Technologies';
const SDE = 'Sadeem Energy';

await assertEmulatorsRunning();
await clearEmulators();

const users = [
  ['old-admin', 'mohamedismayil@gptechnologies.ae', 'Mohamed Ismayil', 'admin', {}],
  ['old-manager', 'manager@old.test', 'Old Manager', 'manager', {}],
  ['old-employee', 'employee@old.test', 'Old Employee', 'user', {}],
  ['old-client', 'client@oldclient.test', 'Old Client', 'client', { company: 'Old Client LLC', organizationId: 'ORG-OC-001' }],
];
for (const [id, email, name, role, extra] of users) await put('users', id, { email, name, role, ...extra });

await put('projects', 'op-1', { projectId: 'PRJ-GPT-001', name: 'Villa fit-out', belongsTo: GPT, status: 'active',
  clientId: 'old-client', clientName: 'Old Client', organizationId: 'ORG-OC-001', budget: 250000, startDate: '2026-01-10',
  deadline: '2026-12-20', tasks: [], costs: [{ id: 'c1', projectId: 'op-1', description: 'Tiles', amount: 12000, date: '2026-02-01', category: 'Materials', type: 'debit' }],
  createdAt: day(-200) });
await put('projects', 'op-2', { projectId: 'PRJ-SDE-001', name: 'Solar farm', belongsTo: SDE, status: 'active',
  budget: 900000, startDate: '2026-03-01', deadline: '2027-03-01', tasks: [], costs: [], createdAt: day(-150) });
await put('projects', 'op-3', { projectId: 'PRJ-GPT-002', name: 'No date project', belongsTo: GPT, status: 'planning', budget: 1000 });
await put('tenders', 'ot-1', { name: 'Mall HVAC', company: 'Mall LLC', belongsTo: GPT, status: 'submitted', deadline: '2026-12-01', createdAt: day(-30) });
await put('registrations', 'or-1', { name: 'Trade License', belongsTo: SDE, type: 'Trade License', status: 'active', expiryDate: '2027-05-01', createdAt: day(-300) });
await put('employees', 'oe-1', { name: 'Old Employee', email: 'employee@old.test', position: 'Engineer', status: 'active', createdAt: day(-400) });
await put('payments', 'opay-1', { description: 'Milestone 1', amount: 50000, dueDate: '2026-12-15', status: 'pending', company: 'Old Client LLC', createdAt: day(-20) });
await put('subscriptions', 'os-1', { name: 'Office 365', provider: 'Microsoft', amount: 300, billingCycle: 'monthly', nextBillingDate: '2026-12-01', status: 'active', createdAt: day(-90) });
await put('partners', 'opt-1', { name: 'Gulf Supplies', partnershipType: 'Supplier', status: 'active', createdAt: day(-60) });
await put('files', 'of-1', { name: 'Contract.pdf', company: GPT, url: 'https://example.com/contract.pdf', createdAt: day(-10) });

console.log('Old-layout sample data written to the emulator (top level). Next: npm run migrate -- backup --source emulator');
