// Resets the LOCAL Firebase emulators and fills them with sample CRM data.
//
//   npm run emulators   (in one terminal)
//   npm run seed        (in another)
//
// Only ever talks to 127.0.0.1 and the "demo-crm" project, so it cannot
// touch live data. Safe to re-run: it wipes the emulators first.

import { AUTH, FIRESTORE, PROJECT, assertEmulatorsRunning, put, request, signUp } from './emulator-rest.mjs';
import { addLocalAccounts } from './local-accounts.mjs';

// Test logins (local emulator only). All share one password.
export const TEST_PASSWORD = 'Test@1234';
const PEOPLE = [
  { key: 'admin', email: 'admin@crm.test', name: 'Aisha Rahman', role: 'admin', department: 'Management', position: 'Managing Director', phone: '+971 50 111 2233' },
  { key: 'manager', email: 'manager@crm.test', name: 'Omar Haddad', role: 'manager', department: 'Operations', position: 'Operations Manager', phone: '+971 50 222 3344' },
  { key: 'employee', email: 'employee@crm.test', name: 'Priya Nair', role: 'user', department: 'Engineering', position: 'Project Engineer', phone: '+971 55 333 4455' },
  { key: 'employee2', email: 'employee2@crm.test', name: 'Yusuf Khan', role: 'user', department: 'Sales', position: 'Tender Specialist', phone: '+971 55 444 5566' },
  { key: 'clientAcme', email: 'client@acme.test', name: 'Acme Facilities', role: 'client', company: 'Acme Facilities LLC', organizationId: 'ORG-ACM-001' },
  { key: 'clientNoor', email: 'client@noor.test', name: 'Noor Energy', role: 'client', company: 'Noor Energy FZE', organizationId: 'ORG-NOO-002' },
];

// ---------- helpers ----------

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (days) => new Date(Date.now() - days * 86400000);

// ---------- main ----------

async function main() {
  await assertEmulatorsRunning();

  console.log('Clearing local emulator data...');
  await request(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await request(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });

  console.log('Creating test logins...');
  const uid = {};
  for (const p of PEOPLE) {
    const res = await signUp(p.email, TEST_PASSWORD, p.name);
    uid[p.key] = res.localId;
    await put('users', res.localId, {
      name: p.name, email: p.email, role: p.role, company: p.company, organizationId: p.organizationId,
    });
  }
  const person = Object.fromEntries(PEOPLE.map(p => [p.key, { ...p, id: uid[p.key] }]));

  console.log('Adding sample data...');
  // Staff directory: employee doc IDs match their login IDs so assignees line up.
  for (const p of PEOPLE.filter(p => p.role !== 'client')) {
    await put('employees', uid[p.key], {
      name: p.name, email: p.email, department: p.department, position: p.position, phone: p.phone,
      joinDate: day(-400 - Math.floor(Math.random() * 600)), status: 'active', createdAt: ago(300),
    });
  }
  await put('employees', 'emp-former', {
    name: 'Daniel Mathew', email: 'daniel.m@crm.test', department: 'Engineering', position: 'Site Supervisor',
    phone: '+971 52 555 6677', joinDate: day(-900), status: 'inactive', createdAt: ago(400),
  });

  const task = (id, projectId, name, who, dueIn, status, priority) => ({
    id, projectId, name, description: `${name} for ${projectId}`, assignedTo: person[who].id,
    assignedToName: person[who].name, dueDate: day(dueIn), status, priority,
  });
  const cost = (id, projectId, description, amount, daysAgo, category, type = 'debit') =>
    ({ id, projectId, description, amount, date: day(-daysAgo), category, type });

  const projects = [
    {
      id: 'prj-1', projectId: 'PRJ-GPT-001', name: 'Smart Building Automation', company: 'Acme Facilities LLC',
      belongsTo: 'Grow Plus Technologies', status: 'in-progress', who: 'employee', deadline: day(45), budget: 185000,
      client: 'clientAcme', createdAt: ago(70),
      description: 'BMS integration and IoT sensors across three Acme sites.',
      tasks: [
        task('t-1', 'prj-1', 'Site survey', 'employee', -40, 'completed', 'high'),
        task('t-2', 'prj-1', 'Sensor procurement', 'manager', -5, 'completed', 'medium'),
        task('t-3', 'prj-1', 'BMS configuration', 'employee', 12, 'in-progress', 'high'),
        task('t-4', 'prj-1', 'Client handover training', 'employee2', 40, 'pending', 'low'),
      ],
      costs: [
        cost('c-1', 'prj-1', 'IoT sensors (batch 1)', 42000, 30, 'Material'),
        cost('c-2', 'prj-1', 'Installation labour', 18500, 15, 'Labor'),
        cost('c-3', 'prj-1', 'Supplier rebate', 3000, 10, 'Material', 'credit'),
      ],
    },
    {
      id: 'prj-2', projectId: 'PRJ-SDE-001', name: 'Rooftop Solar Phase 2', company: 'Noor Energy FZE',
      belongsTo: 'Sadeem Energy', status: 'running', who: 'manager', deadline: day(90), budget: 420000,
      client: 'clientNoor', createdAt: ago(40),
      description: '1.2 MW rooftop PV extension.',
      tasks: [
        task('t-5', 'prj-2', 'Structural assessment', 'employee', -10, 'completed', 'high'),
        task('t-6', 'prj-2', 'Panel delivery', 'manager', 20, 'in-progress', 'medium'),
      ],
      costs: [cost('c-4', 'prj-2', 'Structural engineer', 15000, 12, 'Consulting')],
    },
    {
      id: 'prj-3', projectId: 'PRJ-GPT-002', name: 'ERP Rollout', company: 'Gulf Trading Co.',
      belongsTo: 'Grow Plus Technologies', status: 'completed', who: 'employee2', deadline: day(-20), budget: 96000,
      createdAt: ago(150), description: 'Finance and inventory modules.',
      tasks: [task('t-7', 'prj-3', 'Go-live', 'employee2', -25, 'completed', 'high')],
      costs: [cost('c-5', 'prj-3', 'Licences', 30000, 120, 'Software')],
    },
    {
      id: 'prj-4', projectId: 'PRJ-GPT-003', name: 'Network Upgrade', company: 'Acme Facilities LLC',
      belongsTo: 'Grow Plus Technologies', status: 'handed-over', who: 'employee', deadline: day(-60), budget: 54000,
      client: 'clientAcme', createdAt: ago(200), description: 'Core switches and Wi-Fi 6 rollout.',
      tasks: [], costs: [],
    },
    {
      id: 'prj-5', projectId: 'PRJ-SDE-002', name: 'Energy Audit — Warehouse', company: 'Desert Logistics',
      belongsTo: 'Sadeem Energy', status: 'running', who: 'employee2', deadline: day(8), budget: 22000,
      createdAt: ago(10), description: 'Baseline energy audit and savings report.',
      tasks: [task('t-8', 'prj-5', 'Data logging', 'employee', 3, 'in-progress', 'medium')],
      costs: [],
    },
  ];
  for (const { id, who, client, ...p } of projects) {
    await put('projects', id, {
      ...p,
      assignedTo: person[who].id, assignedToName: person[who].name,
      clientId: client ? person[client].id : '', clientName: client ? person[client].name : '',
      organizationId: client ? person[client].organizationId : '',
    });
  }

  const tenders = [
    ['tnd-1', 'Hospital IT Infrastructure', 'Dubai Health Authority', 'Grow Plus Technologies', 'running', 'employee2', 14, 'RFQ-DHA-2291', 'Dubai eSupply'],
    ['tnd-2', 'Street Lighting Retrofit', 'Sharjah Municipality', 'Sadeem Energy', 'submitted', 'manager', 25, 'SM-LGT-118', 'Sharjah Portal'],
    ['tnd-3', 'Campus CCTV Expansion', 'Gulf University', 'Grow Plus Technologies', 'to-be-evaluated', 'employee2', 5, 'GU-SEC-07', 'Direct'],
    ['tnd-4', 'Solar Carports', 'Noor Energy FZE', 'Sadeem Energy', 'awarded', 'manager', -15, 'NE-PV-022', 'Direct'],
    ['tnd-5', 'Data Centre Cooling', 'Emirates Data Hub', 'Grow Plus Technologies', 'cancelled', 'employee', -30, 'EDH-DC-301', 'Tejari'],
  ];
  for (const [id, name, company, belongsTo, status, who, dl, rfqCode, portal] of tenders) {
    await put('tenders', id, {
      name, company, belongsTo, status, rfqCode, portal, deadline: day(dl),
      assignedTo: person[who].id, assignedToName: person[who].name, clientId: '', clientName: '',
      description: `${name} tender for ${company}.`, createdAt: ago(Math.max(5, 30 - dl)),
    });
  }

  const registrations = [
    ['reg-1', 'Dubai Trade License', 'Grow Plus Technologies', 'Grow Plus Technologies', 'Trade License', -300, 65, 'active'],
    ['reg-2', 'VAT Registration', 'Grow Plus Technologies', 'Grow Plus Technologies', 'VAT Registration', -700, 1000, 'active'],
    ['reg-3', 'ISO 9001 Certificate', 'Sadeem Energy', 'Sadeem Energy', 'ISO 9001', -360, 20, 'active'],
    ['reg-4', 'Municipality License', 'Sadeem Energy', 'Sadeem Energy', 'Municipality License', -400, -35, 'expired'],
  ];
  for (const [id, name, company, belongsTo, type, from, to, status] of registrations) {
    await put('registrations', id, {
      name, company, belongsTo, type, status, registrationDate: day(from), expiryDate: day(to),
      assignedTo: person.manager.id, assignedToName: person.manager.name, createdAt: ago(-from),
    });
  }

  const payments = [
    ['pay-1', 'Smart Building — milestone 2', 55000, 10, 'pending', 'Acme Facilities LLC'],
    ['pay-2', 'ERP Rollout — final invoice', 28800, -12, 'overdue', 'Gulf Trading Co.'],
    ['pay-3', 'Network Upgrade — retention', 5400, -40, 'paid', 'Acme Facilities LLC'],
    ['pay-4', 'Solar Phase 2 — advance', 126000, 3, 'pending', 'Noor Energy FZE'],
  ];
  for (const [id, description, amount, due, status, company] of payments) {
    await put('payments', id, { description, amount, dueDate: day(due), status, company, createdAt: ago(20) });
  }

  const subscriptions = [
    ['sub-1', 'Microsoft 365 Business', 'Microsoft', 1450, 'monthly', 12, 'active'],
    ['sub-2', 'AutoCAD', 'Autodesk', 9800, 'yearly', 140, 'active'],
    ['sub-3', 'Zoom Pro', 'Zoom', 220, 'monthly', -5, 'cancelled'],
  ];
  for (const [id, name, provider, amount, billingCycle, next, status] of subscriptions) {
    await put('subscriptions', id, { name, provider, amount, billingCycle, nextBillingDate: day(next), status, createdAt: ago(90) });
  }

  const partners = [
    ['ptn-1', 'Rashid Al Mansoori', 'Falcon Systems', 'rashid@falcon.test', 'Technology Partner', 'Technology', 'active'],
    ['ptn-2', 'Elena Petrova', 'BrightSun Panels', 'elena@brightsun.test', 'Distribution Partner', 'Operations', 'active'],
    ['ptn-3', 'Karim Saleh', 'Saleh & Co Legal', 'karim@saleh.test', 'Consulting Partner', 'Legal', 'inactive'],
  ];
  for (const [id, name, company, email, partnershipType, category, status] of partners) {
    await put('partners', id, {
      name, company, email, phone: '+971 4 000 0000', partnershipType, category, status, since: day(-500), createdAt: ago(200),
    });
  }

  console.log('\nDone. Local logins (password for all: see TEST_PASSWORD in scripts/seed-emulator.mjs):');
  for (const p of PEOPLE) console.log(`  ${p.role.padEnd(8)} ${p.email}`);
  const mine = await addLocalAccounts();
  if (mine.length) {
    console.log('\nYour accounts (from scripts/local-accounts.json):');
    for (const a of mine) console.log(`  ${a.role.padEnd(8)} ${a.email}`);
  }
  console.log('\nOpen http://localhost:8080 (npm run dev).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
