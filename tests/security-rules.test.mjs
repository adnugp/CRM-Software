// Security rules tests. Run with `npm run test:rules`, which starts the local
// Firestore + Storage emulators (demo project, never touches production).
//
// Two workspaces (companies), wsA and wsB, prove that one company can never
// see or change another company's data. wsT (trial ended) and wsS (suspended)
// are read-only; `owner` is the product's super admin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { PLANS } from '../src/config/plans.ts';

let env;

const profiles = {
  admin: { name: 'Admin', email: 'admin@a.dev', role: 'admin', workspaceId: 'wsA' },
  manager: { name: 'Manager', email: 'manager@a.dev', role: 'manager', workspaceId: 'wsA' },
  employee: { name: 'Employee', email: 'employee@a.dev', role: 'user', workspaceId: 'wsA' },
  clientA: { name: 'Client A', email: 'a@client.dev', role: 'client', workspaceId: 'wsA', company: 'Acme', organizationId: 'ORG-ACM-001' },
  clientA2: { name: 'Client A2', email: 'a2@client.dev', role: 'client', workspaceId: 'wsA', company: 'Beta', organizationId: 'ORG-BET-002' },
  adminB: { name: 'Admin B', email: 'admin@b.dev', role: 'admin', workspaceId: 'wsB' },
  employeeB: { name: 'Employee B', email: 'employee@b.dev', role: 'user', workspaceId: 'wsB' },
  adminT: { name: 'Admin T', email: 'admin@t.dev', role: 'admin', workspaceId: 'wsT' }, // trial ended
  adminS: { name: 'Admin S', email: 'admin@s.dev', role: 'admin', workspaceId: 'wsS' }, // suspended
  owner: { name: 'Owner', email: 'owner@p.dev', role: 'admin', workspaceId: 'wsO' }, // super admin
};

const inDays = (n) => new Date(Date.now() + n * 86400000);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
// A signed-in context whose token carries an email (needed for sign-up and invites).
const as = (uid, email) => env.authenticatedContext(uid, { email }).firestore();

const workspaces = {
  wsA: { name: 'Company A', divisions: [], status: 'active', plan: 'team', staffLimit: 5, staffCount: 3 },
  wsB: { name: 'Company B', divisions: [], status: 'active', plan: 'custom', staffLimit: 0, staffCount: 2 },
  wsT: { name: 'Trial over', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1, trialEndsAt: inDays(-1) },
  wsS: { name: 'Suspended', divisions: [], status: 'suspended', plan: 'starter', staffLimit: 5, staffCount: 1 },
  wsO: { name: 'Owner Co', divisions: [], status: 'active', plan: 'custom', staffLimit: 0, staffCount: 1 },
};

const invite = (over) => ({
  workspaceId: 'wsA', workspaceName: 'Company A', name: 'Invitee', status: 'pending',
  invitedBy: 'admin', createdAt: new Date(), expiresAt: inDays(7), ...over,
});
const invites = {
  'inv-mgr': invite({ role: 'manager', email: 'new@a.dev', name: 'New Manager' }),
  'inv-client': invite({ role: 'client', email: 'gamma@client.dev', name: 'Gamma', company: 'Gamma LLC', organizationId: 'ORG-GL-001' }),
  'inv-expired': invite({ role: 'user', email: 'late@a.dev', expiresAt: inDays(-1) }),
  'inv-revoked': invite({ role: 'user', email: 'gone@a.dev', status: 'revoked' }),
  'inv-t': invite({ workspaceId: 'wsT', workspaceName: 'Trial over', role: 'user', email: 't@t.dev' }),
};

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const storage = (uid) => (uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage());
const ws = (uid, id) => db(uid).collection('workspaces').doc(id);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-crm',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: '127.0.0.1', port: 9199 },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const fs = ctx.firestore();
    for (const [uid, data] of Object.entries(profiles)) {
      await fs.collection('users').doc(uid).set(data);
    }
    for (const [id, data] of Object.entries(workspaces)) {
      await fs.collection('workspaces').doc(id).set(data);
    }
    const a = fs.collection('workspaces').doc('wsA');
    await a.collection('projects').doc('p-by-client').set({ name: 'Linked by clientId', clientId: 'clientA' });
    await a.collection('projects').doc('p-by-org').set({ name: 'Linked by org', organizationId: 'ORG-ACM-001' });
    await a.collection('projects').doc('p-other').set({ name: 'Someone else', clientId: 'clientA2', organizationId: 'ORG-BET-002' });
    await a.collection('tenders').doc('t1').set({ name: 'Tender' });
    await a.collection('private').doc('billing').set({
      contactName: 'Admin', contactEmail: 'admin@a.dev', billingCycle: 'yearly',
      paymentMethod: { provider: 'demo', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 },
    });
    await a.collection('employees').doc('e1').set({ name: 'Emp' });
    await a.collection('companies').doc('c1').set({ name: 'Gulf Facilities LLC', ownerId: 'admin' });
    await a.collection('contacts').doc('k1').set({ name: 'Omar', companyId: 'c1' });
    await a.collection('deals').doc('d1').set({ title: 'Chiller retrofit', stage: 'lead', value: 1000, companyId: 'c1' });
    await fs.collection('workspaces').doc('wsT').collection('deals').doc('d-t').set({ title: 'Old deal' });
    await fs.collection('workspaces').doc('wsS').collection('deals').doc('d-s').set({ title: 'Paused deal' });
    const b = fs.collection('workspaces').doc('wsB');
    await b.collection('projects').doc('pb').set({ name: 'B project', clientId: 'clientA' });
    await b.collection('tenders').doc('tb').set({ name: 'B tender' });
    await fs.collection('workspaces').doc('wsT').collection('projects').doc('p-t').set({ name: 'Old project' });
    await fs.collection('platformOwners').doc('owner').set({ email: 'owner@p.dev' });
    for (const [id, data] of Object.entries(invites)) {
      await fs.collection('invites').doc(id).set(data);
    }
  });
});

describe('signed-out and unregistered accounts', () => {
  it('signed-out visitors cannot read anything', async () => {
    await assertFails(ws(null, 'wsA').get());
    await assertFails(ws(null, 'wsA').collection('projects').get());
    await assertFails(db(null).collection('users').doc('admin').get());
  });

  it('an Auth account with no profile gets no data', async () => {
    await assertFails(ws('stranger', 'wsA').get());
    await assertFails(ws('stranger', 'wsA').collection('projects').get());
    await assertSucceeds(db('stranger').collection('users').doc('stranger').get()); // own (missing) profile
  });

  it('cannot create its own profile to join a workspace', async () => {
    await assertFails(db('stranger').collection('users').doc('stranger').set({ name: 'x', email: 'x', role: 'admin', workspaceId: 'wsA' }));
  });
});

describe('workspace isolation', () => {
  it("staff cannot read another workspace's data or settings", async () => {
    await assertFails(ws('admin', 'wsB').get());
    await assertFails(ws('admin', 'wsB').collection('projects').get());
    await assertFails(ws('employee', 'wsB').collection('tenders').doc('tb').get());
    await assertFails(ws('adminB', 'wsA').collection('projects').get());
  });

  it("staff cannot write into another workspace", async () => {
    await assertFails(ws('admin', 'wsB').collection('tenders').add({ name: 'Injected' }));
    await assertFails(ws('admin', 'wsB').collection('projects').doc('pb').update({ name: 'Hijacked' }));
    await assertFails(ws('admin', 'wsB').update({ name: 'Renamed' }));
  });

  it('a client linked by id cannot reach a project in another workspace', async () => {
    await assertFails(ws('clientA', 'wsB').collection('projects').doc('pb').get());
  });

  it('staff cannot create or delete a workspace', async () => {
    await assertFails(ws('admin', 'wsNew').set({ name: 'New' }));
    await assertFails(ws('admin', 'wsA').delete());
  });
});

describe('sales: companies, contacts and deals', () => {
  const SALES = { companies: 'c1', contacts: 'k1', deals: 'd1' };

  it('staff can read and write all three', async () => {
    for (const uid of ['admin', 'manager', 'employee']) {
      for (const [coll, id] of Object.entries(SALES)) {
        await assertSucceeds(ws(uid, 'wsA').collection(coll).get());
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(id).update({ notes: uid }));
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(`new-${uid}`).set({ name: 'x' }));
        await assertSucceeds(ws(uid, 'wsA').collection(coll).doc(`new-${uid}`).delete());
      }
    }
  });

  it('clients cannot read or write them', async () => {
    for (const [coll, id] of Object.entries(SALES)) {
      await assertFails(ws('clientA', 'wsA').collection(coll).doc(id).get());
      await assertFails(ws('clientA', 'wsA').collection(coll).get());
      await assertFails(ws('clientA', 'wsA').collection(coll).doc('x').set({ name: 'x' }));
    }
  });

  it('another company cannot read or write them', async () => {
    for (const [coll, id] of Object.entries(SALES)) {
      await assertFails(ws('adminB', 'wsA').collection(coll).doc(id).get());
      await assertFails(ws('adminB', 'wsA').collection(coll).doc(id).update({ notes: 'b' }));
    }
  });

  it('read-only companies can read deals but not change them', async () => {
    for (const [uid, wsId, id] of [['adminT', 'wsT', 'd-t'], ['adminS', 'wsS', 'd-s']]) {
      const deals = ws(uid, wsId).collection('deals');
      await assertSucceeds(deals.doc(id).get());
      await assertFails(deals.doc(id).update({ stage: 'won' }));
      await assertFails(deals.doc('new').set({ title: 'x' }));
      await assertFails(deals.doc(id).delete());
    }
  });
});

describe('workspace settings', () => {
  it('every member can read their own workspace (branding)', async () => {
    await assertSucceeds(ws('employee', 'wsA').get());
    await assertSucceeds(ws('clientA', 'wsA').get());
  });

  it('only an admin of the workspace can change its settings', async () => {
    await assertSucceeds(ws('admin', 'wsA').update({ name: 'Company A Ltd', brandColor: '#2563eb' }));
    await assertFails(ws('manager', 'wsA').update({ name: 'Nope' }));
    await assertFails(ws('clientA', 'wsA').update({ name: 'Nope' }));
  });

  it('billing details are readable by the company admin only', async () => {
    const billing = (uid, id = 'wsA') => ws(uid, id).collection('private').doc('billing');
    await assertSucceeds(billing('admin').get());
    await assertFails(billing('manager').get());
    await assertFails(billing('employee').get());
    await assertFails(billing('clientA').get());
    await assertFails(billing('adminB', 'wsA').get());
    await assertFails(billing(null).get());
  });

  it('nobody changes billing details from the app', async () => {
    const billing = ws('admin', 'wsA').collection('private').doc('billing');
    await assertFails(billing.update({ billingCycle: 'monthly' }));
    await assertFails(billing.delete());
  });
});

describe('staff inside a workspace', () => {
  it('employees can read and write business data', async () => {
    await assertSucceeds(ws('employee', 'wsA').collection('projects').get());
    await assertSucceeds(ws('employee', 'wsA').collection('tenders').add({ name: 'New' }));
    await assertSucceeds(ws('employee', 'wsA').collection('payments').add({ amount: 1 }));
    await assertSucceeds(ws('employee', 'wsA').collection('projects').doc('p-other').update({ status: 'running' }));
  });

  it('employees can read but not edit the employee directory', async () => {
    await assertSucceeds(ws('employee', 'wsA').collection('employees').get());
    await assertFails(ws('employee', 'wsA').collection('employees').doc('e1').update({ name: 'Changed' }));
  });

  it('managers can edit the employee directory', async () => {
    await assertSucceeds(ws('manager', 'wsA').collection('employees').doc('e1').update({ name: 'Changed' }));
  });

  it('unknown collections are denied', async () => {
    await assertFails(ws('admin', 'wsA').collection('secrets').add({ x: 1 }));
  });
});

describe('user profiles', () => {
  it('staff list only their own workspace users', async () => {
    await assertSucceeds(db('employee').collection('users').where('workspaceId', '==', 'wsA').get());
    await assertFails(db('employee').collection('users').get());
    await assertFails(db('employee').collection('users').where('workspaceId', '==', 'wsB').get());
    await assertFails(db('admin').collection('users').doc('adminB').get());
  });

  it('nobody creates profiles directly: people join by sign-up or invite', async () => {
    await assertFails(db('admin').collection('users').doc('new').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
    await assertFails(db('manager').collection('users').doc('new5').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
  });

  it('admins manage users of their own workspace only', async () => {
    await assertSucceeds(db('admin').collection('users').doc('employee').update({ role: 'manager' }));
    await assertFails(db('admin').collection('users').doc('employee').update({ workspaceId: 'wsB' }));
    await assertFails(db('admin').collection('users').doc('employeeB').update({ role: 'manager' }));
    await assertFails(db('admin').collection('users').doc('employeeB').delete());
  });

  it('users can edit their own name/avatar but not their role or workspace', async () => {
    await assertSucceeds(db('employee').collection('users').doc('employee').set({ name: 'Renamed', avatar: 'u' }, { merge: true }));
    await assertFails(db('employee').collection('users').doc('employee').update({ role: 'admin' }));
    await assertFails(db('employee').collection('users').doc('employee').update({ workspaceId: 'wsB' }));
    await assertFails(db('clientA').collection('users').doc('clientA').update({ organizationId: 'ORG-BET-002' }));
  });

  it('a profile email can only follow the real sign-in email', async () => {
    const asEmployee = env.authenticatedContext('employee', { email: 'emp@a.dev' }).firestore();
    await assertFails(asEmployee.collection('users').doc('employee').update({ email: 'owner@p.dev' }));
    await assertSucceeds(asEmployee.collection('users').doc('employee').update({ email: 'emp@a.dev' }));
  });

  it('clients can read only their own profile', async () => {
    await assertSucceeds(db('clientA').collection('users').doc('clientA').get());
    await assertFails(db('clientA').collection('users').doc('employee').get());
    await assertFails(db('clientA').collection('users').where('workspaceId', '==', 'wsA').get());
  });
});

describe('clients', () => {
  it('can query their projects by clientId and by organizationId', async () => {
    const projects = ws('clientA', 'wsA').collection('projects');
    const byClient = await assertSucceeds(projects.where('clientId', '==', 'clientA').get());
    const byOrg = await assertSucceeds(projects.where('organizationId', '==', 'ORG-ACM-001').get());
    if (byClient.size !== 1 || byOrg.size !== 1) throw new Error(`unexpected sizes ${byClient.size}/${byOrg.size}`);
  });

  it("cannot read another client's project or list all projects", async () => {
    const projects = ws('clientA', 'wsA').collection('projects');
    await assertFails(projects.doc('p-other').get());
    await assertFails(projects.get());
    await assertFails(projects.where('organizationId', '==', 'ORG-BET-002').get());
  });

  it('cannot write projects or read staff-only data', async () => {
    await assertFails(ws('clientA', 'wsA').collection('projects').doc('p-by-client').update({ budget: 1 }));
    await assertFails(ws('clientA', 'wsA').collection('tenders').get());
    await assertFails(ws('clientA', 'wsA').collection('employees').get());
    await assertFails(ws('clientA', 'wsA').collection('payments').get());
  });
});

describe('storage', () => {
  const pdf = new Uint8Array([37, 80, 68, 70]);
  const png = new Uint8Array([137, 80, 78, 71]);
  const put = (uid, path, data, contentType) => storage(uid).ref(path).put(data, { contentType });

  it('staff upload documents only into their own workspace', async () => {
    await assertSucceeds(put('employee', 'workspaces/wsA/documents/a.pdf', pdf, 'application/pdf'));
    await assertSucceeds(put('employee', 'workspaces/wsA/task-attachments/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('employee', 'workspaces/wsB/documents/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('clientA', 'workspaces/wsA/documents/b.pdf', pdf, 'application/pdf'));
    await assertFails(put(null, 'workspaces/wsA/documents/c.pdf', pdf, 'application/pdf'));
    await assertFails(put('employee', 'documents/legacy.pdf', pdf, 'application/pdf'));
  });

  it('only staff of the workspace can read or list its documents', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.storage().ref('workspaces/wsA/documents/contract.pdf').put(pdf, { contentType: 'application/pdf' });
    });
    await assertSucceeds(storage('employee').ref('workspaces/wsA/documents/contract.pdf').getMetadata());
    await assertSucceeds(storage('employee').ref('workspaces/wsA/documents').listAll());
    await assertFails(storage('employeeB').ref('workspaces/wsA/documents/contract.pdf').getMetadata());
    await assertFails(storage('employeeB').ref('workspaces/wsA/documents').listAll());
    await assertFails(storage('clientA').ref('workspaces/wsA/documents/contract.pdf').getMetadata());
  });

  it('branding: members read, only the admin uploads small images', async () => {
    await assertSucceeds(put('admin', 'workspaces/wsA/branding/logo.png', png, 'image/png'));
    await assertFails(put('manager', 'workspaces/wsA/branding/logo.png', png, 'image/png'));
    await assertFails(put('adminB', 'workspaces/wsA/branding/logo.png', png, 'image/png'));
    await assertFails(put('admin', 'workspaces/wsA/branding/logo.pdf', pdf, 'application/pdf'));
    await assertSucceeds(storage('clientA').ref('workspaces/wsA/branding/logo.png').getMetadata());
    await assertFails(storage('employeeB').ref('workspaces/wsA/branding/logo.png').getMetadata());
  });

  it('read-only companies cannot upload', async () => {
    await assertFails(put('adminT', 'workspaces/wsT/documents/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('adminT', 'workspaces/wsT/task-attachments/a.pdf', pdf, 'application/pdf'));
    await assertFails(put('adminS', 'workspaces/wsS/branding/logo.png', png, 'image/png'));
  });

  it('accounts without a profile cannot upload avatars', async () => {
    await assertFails(put('stranger', 'avatars/stranger_1_me.png', png, 'image/png'));
  });

  it('avatars can only be uploaded under your own uid', async () => {
    await assertSucceeds(put('clientA', 'avatars/clientA_1_me.png', png, 'image/png'));
    await assertFails(put('clientA', 'avatars/employee_1_me.png', png, 'image/png'));
    await assertFails(put('clientA', 'avatars/clientA_2_x.pdf', pdf, 'application/pdf'));
  });
});

describe('company sign-up', () => {
  const founder = () => as('founder', 'founder@new.dev');
  const card = { provider: 'demo', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 };
  const newCompany = (over = {}) => ({
    name: 'New Co', divisions: [], status: 'trial', plan: 'starter', staffLimit: 5, staffCount: 1,
    trialEndsAt: inDays(14), createdBy: 'founder', createdAt: new Date(),
    ...over,
  });
  // Billing lives apart from the company record, so members and clients can't read it.
  const newBilling = (over = {}) => ({
    contactName: 'Fay', contactEmail: 'founder@new.dev', billingCycle: 'monthly', paymentMethod: card, ...over,
  });
  const founderProfile = (over = {}) => ({ name: 'Fay', email: 'founder@new.dev', role: 'admin', workspaceId: 'wsNew', ...over });
  const signUp = (fs, { company = {}, billing = {}, profile = {}, wsId = 'wsNew', withBilling = true } = {}) => {
    const batch = fs.batch();
    const wsRef = fs.collection('workspaces').doc(wsId);
    batch.set(wsRef, newCompany(company));
    if (withBilling) batch.set(wsRef.collection('private').doc('billing'), newBilling(billing));
    batch.set(fs.collection('users').doc('founder'), founderProfile({ workspaceId: wsId, ...profile }));
    return batch.commit();
  };

  it('creates a trial company with its founder as admin, who can then work in it', async () => {
    await assertSucceeds(signUp(founder()));
    await assertSucceeds(ws('founder', 'wsNew').get());
    await assertSucceeds(ws('founder', 'wsNew').collection('tenders').add({ name: 'First' }));
  });

  it('cannot skip the trial or choose its own staff limit', async () => {
    await assertFails(signUp(founder(), { company: { status: 'active' } }));
    await assertFails(signUp(founder(), { company: { staffLimit: 500 } }));
    await assertFails(signUp(founder(), { company: { plan: 'custom', staffLimit: 0 } }));
    await assertFails(signUp(founder(), { company: { trialEndsAt: inDays(60) } }));
    await assertFails(signUp(founder(), { company: { staffCount: 0 } }));
  });

  it('must use the login email, be the creator and be the admin', async () => {
    await assertFails(signUp(founder(), { profile: { email: 'someone@else.dev' } }));
    await assertFails(signUp(founder(), { company: { createdBy: 'admin' } }));
    await assertFails(signUp(founder(), { profile: { role: 'manager' } }));
  });

  it('needs a card summary and a billing period', async () => {
    await assertSucceeds(signUp(founder(), { billing: { billingCycle: 'yearly' } }));
  });

  it('rejects a missing card, a full card number or an unknown billing period', async () => {
    await assertFails(signUp(founder(), { withBilling: false }));
    await assertFails(signUp(founder(), { billing: { paymentMethod: null } }));
    await assertFails(signUp(founder(), { billing: { paymentMethod: { ...card, number: '4242424242424242' } } }));
    await assertFails(signUp(founder(), { billing: { paymentMethod: { ...card, cvc: '123' } } }));
    await assertFails(signUp(founder(), { billing: { paymentMethod: { ...card, last4: '42424242' } } }));
    await assertFails(signUp(founder(), { billing: { billingCycle: 'weekly' } }));
  });

  it('keeps billing off the company record that every member reads', async () => {
    await assertFails(signUp(founder(), { company: { paymentMethod: card } }));
    await assertFails(signUp(founder(), { company: { contactEmail: 'founder@new.dev' } }));
  });

  it('billing must carry the login email', async () => {
    await assertFails(signUp(founder(), { billing: { contactEmail: 'someone@else.dev' } }));
  });

  it("billing can't be added to an existing company", async () => {
    await assertFails(as('admin', 'admin@a.dev').collection('workspaces').doc('wsA')
      .collection('private').doc('billing').set(newBilling({ contactEmail: 'admin@a.dev' })));
  });

  it('cannot join an existing company', async () => {
    await assertFails(signUp(founder(), { wsId: 'wsA' }));
    await assertFails(founder().collection('users').doc('founder').set(founderProfile({ workspaceId: 'wsA' })));
  });

  it('only works for a login with no profile yet', async () => {
    const fs = as('admin', 'admin@a.dev');
    await assertFails(fs.collection('workspaces').doc('wsSecond').set(newCompany({ createdBy: 'admin' })));
  });

  it('a company without its founder profile is rejected', async () => {
    await assertFails(founder().collection('workspaces').doc('wsNew').set(newCompany()));
  });
});

describe('invites', () => {
  const newInvite = (over = {}) => invite({ email: 'hire@a.dev', name: 'Hire', role: 'user', ...over });
  const accept = (uid, token, { email = invites[token].email, profile = {}, staffCount } = {}) => {
    const inv = invites[token];
    const fs = as(uid, email);
    const batch = fs.batch();
    batch.set(fs.collection('users').doc(uid), clean({
      name: inv.name, email: inv.email, role: inv.role, workspaceId: inv.workspaceId,
      company: inv.company, organizationId: inv.organizationId, inviteId: token, ...profile,
    }));
    batch.update(fs.collection('invites').doc(token), { status: 'accepted', acceptedBy: uid, acceptedAt: new Date() });
    if (staffCount !== undefined) batch.update(fs.collection('workspaces').doc(inv.workspaceId), { staffCount });
    return batch.commit();
  };

  it('only an admin creates invites, for their own company', async () => {
    await assertSucceeds(db('admin').collection('invites').add(newInvite()));
    await assertFails(db('manager').collection('invites').add(newInvite({ invitedBy: 'manager' })));
    await assertFails(db('adminB').collection('invites').add(newInvite({ invitedBy: 'adminB' })));
    await assertFails(db('admin').collection('invites').add(newInvite({ expiresAt: inDays(30) })));
    await assertFails(db('admin').collection('invites').add(newInvite({ email: 'Hire@A.dev' })));
    await assertFails(db('admin').collection('invites').add(newInvite({ status: 'accepted' })));
  });

  it('anyone with the link can open one invite, but nobody can browse them', async () => {
    await assertSucceeds(db(null).collection('invites').doc('inv-mgr').get());
    await assertFails(db(null).collection('invites').get());
    await assertSucceeds(db('admin').collection('invites').where('workspaceId', '==', 'wsA').get());
    await assertFails(db('adminB').collection('invites').where('workspaceId', '==', 'wsA').get());
    await assertFails(db('employee').collection('invites').where('workspaceId', '==', 'wsA').get());
  });

  it('admins can revoke a pending invite of their own company', async () => {
    await assertFails(db('employee').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
    await assertFails(db('adminB').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
    await assertSucceeds(db('admin').collection('invites').doc('inv-mgr').update({ status: 'revoked' }));
  });

  it('a staff invite is accepted with the invited email and takes one staff place', async () => {
    await assertSucceeds(accept('newbie', 'inv-mgr', { staffCount: 4 }));
    await assertSucceeds(ws('newbie', 'wsA').collection('projects').get());
  });

  it('a staff invite cannot skip the staff count', async () => {
    await assertFails(accept('newbie', 'inv-mgr'));
  });

  it('a client invite does not touch the staff count', async () => {
    await assertFails(accept('gamma', 'inv-client', { staffCount: 4 }));
    await assertSucceeds(accept('gamma', 'inv-client'));
  });

  it('the login email must match the invite', async () => {
    await assertFails(accept('newbie', 'inv-mgr', { email: 'other@a.dev', staffCount: 4 }));
  });

  it('expired, revoked and used invites cannot be accepted', async () => {
    await assertFails(accept('late', 'inv-expired', { staffCount: 4 }));
    await assertFails(accept('gone', 'inv-revoked', { staffCount: 4 }));
    await assertSucceeds(accept('newbie', 'inv-mgr', { staffCount: 4 }));
    await assertFails(accept('again', 'inv-mgr', { staffCount: 5 }));
  });

  it('the profile must copy the invite (no role or company escalation)', async () => {
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 4, profile: { role: 'admin' } }));
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 4, profile: { workspaceId: 'wsB' } }));
    await assertFails(accept('gamma', 'inv-client', { profile: { organizationId: 'ORG-ACM-001' } }));
  });

  it('a full company cannot take more staff', async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().collection('workspaces').doc('wsA').update({ staffCount: 5 }));
    await assertFails(accept('newbie', 'inv-mgr', { staffCount: 6 }));
  });

  it('only a brand-new profile can use up an invite', async () => {
    // An existing member pointing their own profile at someone else's invite.
    const fs = as('admin', 'admin@a.dev');
    const batch = fs.batch();
    batch.update(fs.collection('users').doc('admin'), { inviteId: 'inv-mgr' });
    batch.update(fs.collection('invites').doc('inv-mgr'), { status: 'accepted', acceptedBy: 'admin', acceptedAt: new Date() });
    await assertFails(batch.commit());
    await assertFails(db('admin').collection('users').doc('employee').update({ inviteId: 'inv-mgr' }));
  });

  it('a read-only company cannot take new people', async () => {
    await assertFails(accept('tnew', 'inv-t', { staffCount: 2 }));
  });
});

describe('read-only companies (trial ended or suspended)', () => {
  it('can still read their data', async () => {
    await assertSucceeds(ws('adminT', 'wsT').get());
    await assertSucceeds(ws('adminT', 'wsT').collection('projects').get());
    await assertSucceeds(ws('adminS', 'wsS').collection('tenders').get());
  });

  it('cannot change anything', async () => {
    await assertFails(ws('adminT', 'wsT').collection('projects').add({ name: 'x' }));
    await assertFails(ws('adminT', 'wsT').collection('projects').doc('p-t').update({ name: 'y' }));
    await assertFails(ws('adminT', 'wsT').update({ name: 'Renamed' }));
    await assertFails(ws('adminS', 'wsS').collection('tenders').add({ name: 'x' }));
    await assertFails(ws('adminS', 'wsS').collection('employees').add({ name: 'x' }));
    await assertFails(db('adminT').collection('invites').add(invite({ workspaceId: 'wsT', workspaceName: 'Trial over', email: 'n@t.dev', role: 'user', invitedBy: 'adminT' })));
  });
});

describe('super admin', () => {
  it('lists every company', async () => {
    await assertSucceeds(db('owner').collection('workspaces').get());
    await assertFails(db('admin').collection('workspaces').get());
  });

  it('changes plan and status, nothing else', async () => {
    await assertSucceeds(ws('owner', 'wsA').update({ status: 'suspended' }));
    await assertSucceeds(ws('owner', 'wsA').update({ plan: 'business', staffLimit: 50 }));
    await assertSucceeds(ws('owner', 'wsT').update({ trialEndsAt: inDays(14) }));
    await assertFails(ws('owner', 'wsA').update({ name: 'Taken over' }));
    await assertFails(ws('owner', 'wsA').update({ status: 'deleted' }));
    await assertFails(ws('owner', 'wsA').update({ staffCount: 0 }));
  });

  it("cannot read any company's records or people", async () => {
    await assertFails(ws('owner', 'wsA').collection('projects').get());
    await assertFails(db('owner').collection('users').doc('admin').get());
  });

  it('owner status is set by script only', async () => {
    await assertSucceeds(db('owner').collection('platformOwners').doc('owner').get());
    await assertFails(db('admin').collection('platformOwners').doc('owner').get());
    await assertFails(db('admin').collection('platformOwners').doc('admin').set({ email: 'admin@a.dev' }));
  });

  it('reads any company billing details but cannot change them', async () => {
    const billing = (uid) => ws(uid, 'wsA').collection('private').doc('billing');
    await assertSucceeds(billing('owner').get());
    await assertFails(billing('owner').update({ billingCycle: 'yearly' }));
  });

  it('company admins cannot change their own plan, status or count', async () => {
    await assertFails(ws('admin', 'wsA').update({ plan: 'business', staffLimit: 50 }));
    await assertFails(ws('admin', 'wsA').update({ staffCount: 0 }));
    await assertFails(ws('admin', 'wsA').update({ status: 'trial' }));
    await assertFails(ws('adminT', 'wsT').update({ status: 'active' }));
    await assertFails(ws('adminT', 'wsT').update({ trialEndsAt: inDays(30) }));
  });
});

describe('removing people and changing roles', () => {
  const removeStaff = (uid, staffCount, removedUid = uid) => {
    const fs = db('admin');
    const batch = fs.batch();
    batch.delete(fs.collection('users').doc(uid));
    batch.update(fs.collection('workspaces').doc('wsA'), { staffCount, removedUid });
    return batch.commit();
  };

  it('removing staff frees exactly one place', async () => {
    await assertFails(db('admin').collection('users').doc('employee').delete());
    await assertFails(removeStaff('employee', 1));
    await assertSucceeds(removeStaff('employee', 2));
  });

  it('the freed place must belong to the person removed', async () => {
    await assertFails(removeStaff('employee', 2, 'manager'));
    await assertFails(db('admin').collection('workspaces').doc('wsA').update({ staffCount: 2, removedUid: 'manager' }));
  });

  it('removing a client needs no count change', async () => {
    await assertSucceeds(db('admin').collection('users').doc('clientA').delete());
  });

  it("admins can't switch people between staff and client (re-invite instead)", async () => {
    await assertFails(db('admin').collection('users').doc('clientA').update({ role: 'user' }));
    await assertFails(db('admin').collection('users').doc('employee').update({ role: 'client' }));
    await assertSucceeds(db('admin').collection('users').doc('employee').update({ role: 'manager' }));
  });
});

describe('plans', () => {
  it('plan limits in firestore.rules match src/config/plans.ts', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    const match = rules.match(/function planLimits\(\) \{\s*return (\{[^}]*\});/);
    assert.ok(match, 'planLimits() not found in firestore.rules');
    const inRules = JSON.parse(match[1].replace(/'/g, '"'));
    assert.deepEqual(inRules, Object.fromEntries(PLANS.map((p) => [p.id, p.staffLimit])));
  });
});
