// Resets the LOCAL Firebase emulators and fills them with sample CRM data.
//
//   npm run emulators   (in one terminal)
//   npm run seed        (in another)
//
// Only ever talks to 127.0.0.1 and the "demo-crm" project, so it cannot
// touch live data. Safe to re-run: it wipes the emulators first.
//
// Three demo customer companies (workspaces) prove that companies are isolated:
//   Acme Contracting  - active plan, two divisions (BLD, ENG), a full team, two clients
//   Noor Engineering  - on a trial (9 days left), no divisions, a small team, one client
//   Falcon Builders   - trial ended, so read-only
// Each also has sample sales data (companies, contacts and deals in every stage),
// plus one pending invite into Acme (the link is printed at the end).

import { AUTH, FIRESTORE, PROJECT, assertEmulatorsRunning, put, request, signUp } from './emulator-rest.mjs';
import { addLocalAccounts } from './local-accounts.mjs';

// Test logins (local emulator only). All share one password.
export const TEST_PASSWORD = 'Test@1234';

// ---------- helpers ----------

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ago = (days) => new Date(Date.now() - days * 86400000);

// A card summary as sign-up stores it (demo provider: never a full number).
const demoCard = (brand, last4) => ({ provider: 'demo', brand, last4, expMonth: 12, expYear: 2028 });

// Writes into workspaces/{ws}/{collection}/{id}.
const putIn = (ws, collection, id, data) => put(`workspaces/${ws}/${collection}`, id, data);

async function createWorkspace({ id, name, brandColor, divisions, people, billing }) {
  const founder = people.find((p) => p.role === 'admin');
  await put('workspaces', id, {
    name, brandColor, divisions, createdAt: ago(400),
    ...billing,
    staffCount: people.filter((p) => p.role !== 'client').length,
    contactName: founder?.name, contactEmail: founder?.email,
  });

  const person = {};
  for (const p of people) {
    const res = await signUp(p.email, TEST_PASSWORD, p.name);
    person[p.key] = { ...p, id: res.localId };
    await put('users', res.localId, {
      name: p.name, email: p.email, role: p.role, workspaceId: id,
      company: p.company, organizationId: p.organizationId,
    });
    // Staff directory: employee doc IDs match their login IDs so assignees line up.
    if (p.role !== 'client') {
      await putIn(id, 'employees', res.localId, {
        name: p.name, email: p.email, department: p.department, position: p.position, phone: p.phone,
        joinDate: day(-400 - Math.floor(Math.random() * 600)), status: 'active', createdAt: ago(300),
      });
    }
  }
  return person;
}

const task = (person, id, projectId, name, who, dueIn, status, priority) => ({
  id, projectId, name, description: `${name} for ${projectId}`, assignedTo: person[who].id,
  assignedToName: person[who].name, dueDate: day(dueIn), status, priority,
});
const cost = (id, projectId, description, amount, daysAgo, category, type = 'debit') =>
  ({ id, projectId, description, amount, date: day(-daysAgo), category, type });

async function putProjects(ws, person, projects) {
  for (const { id, who, client, ...p } of projects) {
    await putIn(ws, 'projects', id, {
      ...p,
      assignedTo: person[who].id, assignedToName: person[who].name,
      clientId: client ? person[client].id : '', clientName: client ? person[client].name : '',
      organizationId: client ? person[client].organizationId : '',
    });
  }
}

// Sales: companies, contacts and deals. History entries use ISO times
// (nested values aren't converted from Timestamps when the app reads them).
async function putSales(ws, person, { companies, contacts, deals }) {
  for (const { id, who, ...c } of companies) {
    await putIn(ws, 'companies', id, { ...c, ownerId: person[who].id, createdAt: ago(120) });
  }
  for (const { id, ...k } of contacts) {
    await putIn(ws, 'contacts', id, { ...k, createdAt: ago(90) });
  }
  for (const { id, who, activities = [], ...d } of deals) {
    await putIn(ws, 'deals', id, {
      nextFollowUp: null, lostReason: null, wonAt: null, closedAt: null, convertedTo: null,
      contactId: '', divisionId: '', source: '',
      ...d,
      ownerId: person[who].id,
      activities: activities.map(([aid, type, text, daysAgo, by]) => ({
        id: aid, type, text, at: ago(daysAgo).toISOString(), byId: person[by ?? who].id,
      })),
      createdAt: ago(Math.max(...activities.map((a) => a[3]), 1)),
    });
  }
}

// ---------- Acme Contracting (with divisions) ----------

async function seedAcme() {
  const ws = 'ws-acme';
  const BLD = 'div-bld';
  const ENG = 'div-eng';
  const person = await createWorkspace({
    id: ws,
    name: 'Acme Contracting',
    billing: { status: 'active', plan: 'business', staffLimit: 50, billingCycle: 'yearly', paymentMethod: demoCard('visa', '4242') },
    divisions: [
      { id: BLD, name: 'Building Systems', code: 'BLD' },
      { id: ENG, name: 'Energy', code: 'ENG' },
    ],
    people: [
      { key: 'admin', email: 'admin@acme.test', name: 'Aisha Rahman', role: 'admin', department: 'Management', position: 'Managing Director', phone: '+971 50 111 2233' },
      { key: 'manager', email: 'manager@acme.test', name: 'Omar Haddad', role: 'manager', department: 'Operations', position: 'Operations Manager', phone: '+971 50 222 3344' },
      { key: 'employee', email: 'employee@acme.test', name: 'Priya Nair', role: 'user', department: 'Engineering', position: 'Project Engineer', phone: '+971 55 333 4455' },
      { key: 'employee2', email: 'employee2@acme.test', name: 'Yusuf Khan', role: 'user', department: 'Sales', position: 'Tender Specialist', phone: '+971 55 444 5566' },
      { key: 'clientGulf', email: 'client@gulf.test', name: 'Gulf Facilities', role: 'client', company: 'Gulf Facilities LLC', organizationId: 'ORG-GF-001' },
      { key: 'clientDesert', email: 'client@desert.test', name: 'Desert Solar', role: 'client', company: 'Desert Solar FZE', organizationId: 'ORG-DS-001' },
    ],
  });
  await putIn(ws, 'employees', 'emp-former', {
    name: 'Daniel Mathew', email: 'daniel.m@acme.test', department: 'Engineering', position: 'Site Supervisor',
    phone: '+971 52 555 6677', joinDate: day(-900), status: 'inactive', createdAt: ago(400),
  });

  const t = (...args) => task(person, ...args);
  await putProjects(ws, person, [
    {
      id: 'prj-1', projectId: 'PRJ-BLD-001', name: 'Smart Building Automation', company: 'Gulf Facilities LLC',
      divisionId: BLD, status: 'in-progress', who: 'employee', deadline: day(45), budget: 185000,
      client: 'clientGulf', createdAt: ago(70),
      description: 'BMS integration and IoT sensors across three client sites.',
      tasks: [
        t('t-1', 'prj-1', 'Site survey', 'employee', -40, 'completed', 'high'),
        t('t-2', 'prj-1', 'Sensor procurement', 'manager', -5, 'completed', 'medium'),
        t('t-3', 'prj-1', 'BMS configuration', 'employee', 12, 'in-progress', 'high'),
        t('t-4', 'prj-1', 'Client handover training', 'employee2', 40, 'pending', 'low'),
      ],
      costs: [
        cost('c-1', 'prj-1', 'IoT sensors (batch 1)', 42000, 30, 'Material'),
        cost('c-2', 'prj-1', 'Installation labour', 18500, 15, 'Labor'),
        cost('c-3', 'prj-1', 'Supplier rebate', 3000, 10, 'Material', 'credit'),
      ],
    },
    {
      id: 'prj-2', projectId: 'PRJ-ENG-001', name: 'Rooftop Solar Phase 2', company: 'Desert Solar FZE',
      divisionId: ENG, status: 'running', who: 'manager', deadline: day(90), budget: 420000,
      client: 'clientDesert', createdAt: ago(40), companyId: 'co-desert', dealId: 'dl-6',
      description: '1.2 MW rooftop PV extension.',
      tasks: [
        t('t-5', 'prj-2', 'Structural assessment', 'employee', -10, 'completed', 'high'),
        t('t-6', 'prj-2', 'Panel delivery', 'manager', 20, 'in-progress', 'medium'),
      ],
      costs: [cost('c-4', 'prj-2', 'Structural engineer', 15000, 12, 'Consulting')],
    },
    {
      id: 'prj-3', projectId: 'PRJ-BLD-002', name: 'ERP Rollout', company: 'Gulf Trading Co.',
      divisionId: BLD, status: 'completed', who: 'employee2', deadline: day(-20), budget: 96000,
      createdAt: ago(150), description: 'Finance and inventory modules.',
      tasks: [t('t-7', 'prj-3', 'Go-live', 'employee2', -25, 'completed', 'high')],
      costs: [cost('c-5', 'prj-3', 'Licences', 30000, 120, 'Software')],
    },
    {
      id: 'prj-4', projectId: 'PRJ-BLD-003', name: 'Network Upgrade', company: 'Gulf Facilities LLC',
      divisionId: BLD, status: 'handed-over', who: 'employee', deadline: day(-60), budget: 54000,
      client: 'clientGulf', createdAt: ago(200), description: 'Core switches and Wi-Fi 6 rollout.',
      tasks: [], costs: [],
    },
    {
      id: 'prj-5', projectId: 'PRJ-ENG-002', name: 'Energy Audit — Warehouse', company: 'Desert Logistics',
      divisionId: ENG, status: 'running', who: 'employee2', deadline: day(8), budget: 22000,
      createdAt: ago(10), description: 'Baseline energy audit and savings report.',
      tasks: [t('t-8', 'prj-5', 'Data logging', 'employee', 3, 'in-progress', 'medium')],
      costs: [],
    },
  ]);

  const tenders = [
    ['tnd-1', 'Hospital IT Infrastructure', 'Dubai Health Authority', BLD, 'running', 'employee2', 14, 'RFQ-DHA-2291', 'Dubai eSupply'],
    ['tnd-2', 'Street Lighting Retrofit', 'Sharjah Municipality', ENG, 'submitted', 'manager', 25, 'SM-LGT-118', 'Sharjah Portal'],
    ['tnd-3', 'Campus CCTV Expansion', 'Gulf University', BLD, 'to-be-evaluated', 'employee2', 5, 'GU-SEC-07', 'Direct'],
    ['tnd-4', 'Solar Carports', 'Desert Solar FZE', ENG, 'awarded', 'manager', -15, 'DS-PV-022', 'Direct'],
    ['tnd-5', 'Data Centre Cooling', 'Emirates Data Hub', BLD, 'cancelled', 'employee', -30, 'EDH-DC-301', 'Tejari'],
  ];
  for (const [id, name, company, divisionId, status, who, dl, rfqCode, portal] of tenders) {
    await putIn(ws, 'tenders', id, {
      name, company, divisionId, status, rfqCode, portal, deadline: day(dl),
      assignedTo: person[who].id, assignedToName: person[who].name, clientId: '', clientName: '',
      description: `${name} tender for ${company}.`, createdAt: ago(Math.max(5, 30 - dl)),
    });
  }

  const registrations = [
    ['reg-1', 'Dubai Trade License', BLD, 'Trade License', -300, 65, 'active'],
    ['reg-2', 'VAT Registration', BLD, 'VAT Registration', -700, 1000, 'active'],
    ['reg-3', 'ISO 9001 Certificate', ENG, 'ISO 9001', -360, 20, 'active'],
    ['reg-4', 'Municipality License', ENG, 'Municipality License', -400, -35, 'expired'],
  ];
  for (const [id, name, divisionId, type, from, to, status] of registrations) {
    await putIn(ws, 'registrations', id, {
      name, company: 'Acme Contracting', divisionId, type, status, registrationDate: day(from), expiryDate: day(to),
      assignedTo: person.manager.id, assignedToName: person.manager.name, createdAt: ago(-from),
    });
  }

  const payments = [
    ['pay-1', 'Smart Building — milestone 2', 55000, 10, 'pending', 'Gulf Facilities LLC'],
    ['pay-2', 'ERP Rollout — final invoice', 28800, -12, 'overdue', 'Gulf Trading Co.'],
    ['pay-3', 'Network Upgrade — retention', 5400, -40, 'paid', 'Gulf Facilities LLC'],
    ['pay-4', 'Solar Phase 2 — advance', 126000, 3, 'pending', 'Desert Solar FZE'],
  ];
  for (const [id, description, amount, due, status, company] of payments) {
    await putIn(ws, 'payments', id, { description, amount, dueDate: day(due), status, company, createdAt: ago(20) });
  }

  const subscriptions = [
    ['sub-1', 'Microsoft 365 Business', 'Microsoft', 1450, 'monthly', 12, 'active'],
    ['sub-2', 'AutoCAD', 'Autodesk', 9800, 'yearly', 140, 'active'],
    ['sub-3', 'Zoom Pro', 'Zoom', 220, 'monthly', -5, 'cancelled'],
  ];
  for (const [id, name, provider, amount, billingCycle, next, status] of subscriptions) {
    await putIn(ws, 'subscriptions', id, { name, provider, amount, billingCycle, nextBillingDate: day(next), status, createdAt: ago(90) });
  }

  const partners = [
    ['ptn-1', 'Rashid Al Mansoori', 'Falcon Systems', 'rashid@falcon.test', 'Technology Partner', 'Technology', 'active'],
    ['ptn-2', 'Elena Petrova', 'BrightSun Panels', 'elena@brightsun.test', 'Distribution Partner', 'Operations', 'active'],
    ['ptn-3', 'Karim Saleh', 'Saleh & Co Legal', 'karim@saleh.test', 'Consulting Partner', 'Legal', 'inactive'],
  ];
  for (const [id, name, company, email, partnershipType, category, status] of partners) {
    await putIn(ws, 'partners', id, {
      name, company, email, phone: '+971 4 000 0000', partnershipType, category, status, since: day(-500), createdAt: ago(200),
    });
  }

  await putSales(ws, person, {
    companies: [
      { id: 'co-gulf', name: 'Gulf Facilities LLC', industry: 'Facilities management', phone: '+971 4 123 4567', email: 'info@gulffacilities.test', organizationId: 'ORG-GF-001', who: 'manager' },
      { id: 'co-desert', name: 'Desert Solar FZE', industry: 'Renewable energy', email: 'hello@desertsolar.test', organizationId: 'ORG-DS-001', who: 'manager' },
      { id: 'co-gtc', name: 'Gulf Trading Co.', industry: 'Trading', who: 'employee2' },
      { id: 'co-dha', name: 'Dubai Health Authority', industry: 'Healthcare', who: 'employee2' },
      { id: 'co-sharjah', name: 'Sharjah Municipality', industry: 'Government', who: 'manager' },
      { id: 'co-palm', name: 'Palm Hospitality Group', industry: 'Hospitality', website: 'palmhospitality.test', who: 'admin' },
    ],
    contacts: [
      { id: 'k-1', name: 'Hassan Ali', jobTitle: 'Facilities Director', email: 'hassan@gulffacilities.test', phone: '+971 50 900 1001', companyId: 'co-gulf' },
      { id: 'k-2', name: 'Mira Thomas', jobTitle: 'Procurement Lead', email: 'mira@gulffacilities.test', companyId: 'co-gulf' },
      { id: 'k-3', name: 'Faisal Noor', jobTitle: 'Project Director', email: 'faisal@desertsolar.test', companyId: 'co-desert' },
      { id: 'k-4', name: 'Anita Rao', jobTitle: 'IT Manager', email: 'anita@gtc.test', companyId: 'co-gtc' },
      { id: 'k-5', name: 'Dr. Salem Obaid', jobTitle: 'Head of Infrastructure', companyId: 'co-dha' },
      { id: 'k-6', name: 'Rashid Al Suwaidi', jobTitle: 'Lighting Engineer', companyId: 'co-sharjah' },
      { id: 'k-7', name: 'Claire Dubois', jobTitle: 'Group Engineering Manager', email: 'claire@palmhospitality.test', companyId: 'co-palm' },
      { id: 'k-8', name: 'Tariq Hamdan', jobTitle: 'Independent consultant', phone: '+971 55 900 1008' },
    ],
    deals: [
      { id: 'dl-1', title: 'Chiller plant retrofit', companyId: 'co-gulf', contactId: 'k-1', value: 185000, stage: 'proposal', divisionId: BLD, source: 'Existing client', expectedCloseDate: day(30), who: 'manager',
        nextFollowUp: { date: day(-2), note: 'Call Hassan about the revised quote' },
        activities: [['a1', 'stage', 'Created in Lead', 40], ['a2', 'meeting', 'Site walk-through with Hassan; two chillers past end of life.', 32], ['a3', 'stage', 'Moved to Proposal', 10], ['a4', 'email', 'Sent proposal v1.', 9]] },
      { id: 'dl-2', title: 'Solar carport extension', companyId: 'co-desert', contactId: 'k-3', value: 240000, stage: 'negotiation', divisionId: ENG, source: 'Existing client', expectedCloseDate: day(14), who: 'manager',
        nextFollowUp: { date: day(0), note: 'Send the final price' },
        activities: [['a1', 'stage', 'Created in Qualified', 50], ['a2', 'stage', 'Moved to Negotiation', 6], ['a3', 'call', 'Faisal asked for 5% off for a 3-year O&M bundle.', 2]] },
      { id: 'dl-3', title: 'BMS service contract', companyId: 'co-gulf', contactId: 'k-2', value: 60000, stage: 'qualified', divisionId: BLD, source: 'Existing client', expectedCloseDate: day(45), who: 'employee2',
        nextFollowUp: { date: day(5), note: 'Share service levels' },
        activities: [['a1', 'stage', 'Created in Lead', 20], ['a2', 'stage', 'Moved to Qualified', 8]] },
      { id: 'dl-4', title: 'ERP phase 2', companyId: 'co-gtc', contactId: 'k-4', value: 95000, stage: 'lead', divisionId: BLD, source: 'Referral', who: 'employee2',
        nextFollowUp: { date: day(-1), note: 'Book a discovery call with Anita' },
        activities: [['a1', 'stage', 'Created in Lead', 7]] },
      { id: 'dl-5', title: 'Clinic network cabling', companyId: 'co-dha', contactId: 'k-5', value: 120000, stage: 'lead', divisionId: BLD, source: 'Tender portal', who: 'employee2',
        activities: [['a1', 'stage', 'Created in Lead', 3], ['a2', 'note', 'Watch Dubai eSupply for the RFQ.', 3]] },
      { id: 'dl-6', title: 'Rooftop solar phase 2', companyId: 'co-desert', contactId: 'k-3', value: 310000, stage: 'won', divisionId: ENG, source: 'Existing client', who: 'manager',
        wonAt: ago(40), closedAt: ago(40), convertedTo: { kind: 'project', id: 'prj-2' },
        activities: [['a1', 'stage', 'Created in Proposal', 70], ['a2', 'stage', 'Moved to Won', 40], ['a3', 'note', 'Project created', 40]] },
      { id: 'dl-7', title: 'Hotel energy audit', companyId: 'co-palm', contactId: 'k-7', value: 35000, stage: 'won', divisionId: ENG, source: 'Website', who: 'admin',
        wonAt: ago(2), closedAt: ago(2),
        activities: [['a1', 'stage', 'Created in Lead', 25], ['a2', 'stage', 'Moved to Won', 2]] },
      { id: 'dl-8', title: 'Street lighting phase 2', companyId: 'co-sharjah', contactId: 'k-6', value: 150000, stage: 'lost', divisionId: ENG, source: 'Tender portal', who: 'manager',
        closedAt: ago(10), lostReason: 'Lost on price to a local contractor',
        activities: [['a1', 'stage', 'Created in Proposal', 45], ['a2', 'stage', 'Moved to Lost: Lost on price to a local contractor', 10]] },
    ],
  });
  return person;
}

// ---------- Noor Engineering (no divisions) ----------

async function seedNoor() {
  const ws = 'ws-noor';
  const person = await createWorkspace({
    id: ws,
    name: 'Noor Engineering',
    brandColor: '#2563eb',
    billing: {
      status: 'trial', plan: 'starter', staffLimit: 5, trialEndsAt: new Date(Date.now() + 9 * 86400000),
      billingCycle: 'monthly', paymentMethod: demoCard('mastercard', '4444'),
    },
    divisions: [],
    people: [
      { key: 'admin', email: 'admin@noor.test', name: 'Layla Saeed', role: 'admin', department: 'Management', position: 'General Manager', phone: '+971 50 777 1000' },
      { key: 'employee', email: 'employee@noor.test', name: 'Sam Joseph', role: 'user', department: 'Engineering', position: 'Site Engineer', phone: '+971 55 777 2000' },
      { key: 'clientHarbor', email: 'client@harbor.test', name: 'Harbor Logistics', role: 'client', company: 'Harbor Logistics LLC', organizationId: 'ORG-HL-001' },
    ],
  });

  const t = (...args) => task(person, ...args);
  await putProjects(ws, person, [
    {
      id: 'prj-1', projectId: 'PRJ-001', name: 'Warehouse Fire Alarm Upgrade', company: 'Harbor Logistics LLC',
      status: 'in-progress', who: 'employee', deadline: day(30), budget: 64000, client: 'clientHarbor', createdAt: ago(25),
      description: 'Addressable fire alarm system for two warehouses.',
      tasks: [t('t-1', 'prj-1', 'Panel installation', 'employee', 7, 'in-progress', 'high')],
      costs: [cost('c-1', 'prj-1', 'Fire alarm panels', 21000, 9, 'Material')],
    },
    {
      id: 'prj-2', projectId: 'PRJ-002', name: 'Office Fit-out MEP', company: 'Blue Lagoon Hotels',
      status: 'running', who: 'admin', deadline: day(75), budget: 140000, createdAt: ago(12),
      description: 'Mechanical, electrical and plumbing for a new head office.', tasks: [], costs: [],
    },
  ]);
  await putIn(ws, 'tenders', 'tnd-1', {
    name: 'Port Lighting Maintenance', company: 'Harbor Logistics LLC', status: 'running', rfqCode: 'HL-MNT-04',
    portal: 'Direct', deadline: day(10), assignedTo: person.admin.id, assignedToName: person.admin.name,
    clientId: '', clientName: '', description: 'Annual maintenance contract.', createdAt: ago(6),
  });
  await putIn(ws, 'registrations', 'reg-1', {
    name: 'Trade License', company: 'Noor Engineering', type: 'Trade License', status: 'active',
    registrationDate: day(-200), expiryDate: day(165), assignedTo: person.admin.id, assignedToName: person.admin.name, createdAt: ago(200),
  });
  await putIn(ws, 'payments', 'pay-1', {
    description: 'Fire alarm — advance', amount: 19200, dueDate: day(-3), status: 'overdue', company: 'Harbor Logistics LLC', createdAt: ago(15),
  });
  await putSales(ws, person, {
    companies: [
      { id: 'co-harbor', name: 'Harbor Logistics LLC', industry: 'Logistics', organizationId: 'ORG-HL-001', who: 'admin' },
      { id: 'co-lagoon', name: 'Blue Lagoon Hotels', industry: 'Hospitality', who: 'admin' },
    ],
    contacts: [
      { id: 'k-1', name: 'Joseph Mathai', jobTitle: 'Warehouse Manager', companyId: 'co-harbor' },
      { id: 'k-2', name: 'Sara Haddad', jobTitle: 'Projects Manager', companyId: 'co-lagoon' },
    ],
    deals: [
      { id: 'dl-1', title: 'Cold store fire alarm', companyId: 'co-harbor', contactId: 'k-1', value: 48000, stage: 'proposal', who: 'admin',
        nextFollowUp: { date: day(-1), note: 'Chase the signed quote' },
        activities: [['a1', 'stage', 'Created in Lead', 12], ['a2', 'stage', 'Moved to Proposal', 4]] },
      { id: 'dl-2', title: 'Lobby lighting upgrade', companyId: 'co-lagoon', contactId: 'k-2', value: 22000, stage: 'lead', who: 'employee',
        activities: [['a1', 'stage', 'Created in Lead', 2]] },
      { id: 'dl-3', title: 'Port lighting maintenance', companyId: 'co-harbor', value: 36000, stage: 'negotiation', who: 'admin',
        nextFollowUp: { date: day(3), note: 'Agree visit frequency' },
        activities: [['a1', 'stage', 'Created in Qualified', 15], ['a2', 'stage', 'Moved to Negotiation', 5]] },
    ],
  });
  return person;
}

// ---------- Falcon Builders (trial ended: read-only) ----------

async function seedFalcon() {
  const ws = 'ws-falcon';
  const person = await createWorkspace({
    id: ws,
    name: 'Falcon Builders',
    brandColor: '#ea580c',
    divisions: [],
    billing: { status: 'trial', plan: 'starter', staffLimit: 5, trialEndsAt: ago(2), billingCycle: 'monthly', paymentMethod: demoCard('visa', '1881') },
    people: [
      { key: 'admin', email: 'admin@falcon.test', name: 'Khalid Mansour', role: 'admin', department: 'Management', position: 'Owner', phone: '+971 50 888 1000' },
      { key: 'employee', email: 'employee@falcon.test', name: 'Rana Aziz', role: 'user', department: 'Projects', position: 'Site Supervisor', phone: '+971 55 888 2000' },
    ],
  });
  await putProjects(ws, person, [
    {
      id: 'prj-1', projectId: 'PRJ-001', name: 'Villa Renovation', company: 'Private Client',
      status: 'in-progress', who: 'employee', deadline: day(20), budget: 85000, createdAt: ago(20),
      description: 'Full interior renovation of a four-bedroom villa.', tasks: [], costs: [],
    },
  ]);
  await putSales(ws, person, {
    companies: [{ id: 'co-private', name: 'Private Client', who: 'admin' }],
    contacts: [],
    deals: [
      { id: 'dl-1', title: 'Garden annex', companyId: 'co-private', value: 60000, stage: 'qualified', who: 'admin',
        activities: [['a1', 'stage', 'Created in Lead', 30], ['a2', 'stage', 'Moved to Qualified', 20]] },
    ],
  });
  return person;
}

// ---------- A pending invite (open the link printed at the end) ----------

const SEED_INVITE = 'seed-invite-acme';

async function seedInvite(acme) {
  await put('invites', SEED_INVITE, {
    workspaceId: 'ws-acme', workspaceName: 'Acme Contracting', email: 'newhire@acme.test',
    name: 'Nadia Karim', role: 'user', status: 'pending', invitedBy: acme.admin.id,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000),
  });
}

// ---------- main ----------

async function main() {
  await assertEmulatorsRunning();

  console.log('Clearing local emulator data...');
  await request(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  await request(`${FIRESTORE}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });

  console.log('Creating demo companies...');
  const acme = await seedAcme();
  const noor = await seedNoor();
  const falcon = await seedFalcon();
  await seedInvite(acme);

  console.log(`\nDone. Local logins (password for all: see TEST_PASSWORD in scripts/seed-emulator.mjs):`);
  for (const [label, people] of [
    ['Acme Contracting (active)', acme],
    ['Noor Engineering (trial, 9 days left)', noor],
    ['Falcon Builders (trial ended: read-only)', falcon],
  ]) {
    console.log(`  ${label}`);
    for (const p of Object.values(people)) console.log(`    ${p.role.padEnd(8)} ${p.email}`);
  }
  console.log(`\nPending invite (Acme, employee newhire@acme.test): http://localhost:8080/join/${SEED_INVITE}`);

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
