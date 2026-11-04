// Security rules tests. Run with `npm run test:rules`, which starts the local
// Firestore + Storage emulators (demo project, never touches production).
//
// Two workspaces (companies), wsA and wsB, prove that one company can never
// see or change another company's data.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

let env;

const profiles = {
  admin: { name: 'Admin', email: 'admin@a.dev', role: 'admin', workspaceId: 'wsA' },
  manager: { name: 'Manager', email: 'manager@a.dev', role: 'manager', workspaceId: 'wsA' },
  employee: { name: 'Employee', email: 'employee@a.dev', role: 'user', workspaceId: 'wsA' },
  clientA: { name: 'Client A', email: 'a@client.dev', role: 'client', workspaceId: 'wsA', company: 'Acme', organizationId: 'ORG-ACM-001' },
  clientA2: { name: 'Client A2', email: 'a2@client.dev', role: 'client', workspaceId: 'wsA', company: 'Beta', organizationId: 'ORG-BET-002' },
  adminB: { name: 'Admin B', email: 'admin@b.dev', role: 'admin', workspaceId: 'wsB' },
  employeeB: { name: 'Employee B', email: 'employee@b.dev', role: 'user', workspaceId: 'wsB' },
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
    await fs.collection('workspaces').doc('wsA').set({ name: 'Company A', divisions: [] });
    await fs.collection('workspaces').doc('wsB').set({ name: 'Company B', divisions: [] });
    const a = fs.collection('workspaces').doc('wsA');
    await a.collection('projects').doc('p-by-client').set({ name: 'Linked by clientId', clientId: 'clientA' });
    await a.collection('projects').doc('p-by-org').set({ name: 'Linked by org', organizationId: 'ORG-ACM-001' });
    await a.collection('projects').doc('p-other').set({ name: 'Someone else', clientId: 'clientA2', organizationId: 'ORG-BET-002' });
    await a.collection('tenders').doc('t1').set({ name: 'Tender' });
    await a.collection('employees').doc('e1').set({ name: 'Emp' });
    const b = fs.collection('workspaces').doc('wsB');
    await b.collection('projects').doc('pb').set({ name: 'B project', clientId: 'clientA' });
    await b.collection('tenders').doc('tb').set({ name: 'B tender' });
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

  it('nobody can create or delete a workspace from the app', async () => {
    await assertFails(ws('admin', 'wsNew').set({ name: 'New' }));
    await assertFails(ws('admin', 'wsA').delete());
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

  it('only admins create users, and only in their own workspace', async () => {
    await assertSucceeds(db('admin').collection('users').doc('new').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
    await assertFails(db('admin').collection('users').doc('new2').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsB' }));
    await assertFails(db('admin').collection('users').doc('new3').set({ name: 'N', email: 'n@x', role: 'user' }));
    await assertFails(db('admin').collection('users').doc('new4').set({ name: 'N', email: 'n@x', role: 'owner', workspaceId: 'wsA' }));
    await assertFails(db('manager').collection('users').doc('new5').set({ name: 'N', email: 'n@x', role: 'user', workspaceId: 'wsA' }));
  });

  it('admins manage users of their own workspace only', async () => {
    await assertSucceeds(db('admin').collection('users').doc('employee').update({ role: 'manager' }));
    await assertFails(db('admin').collection('users').doc('employee').update({ workspaceId: 'wsB' }));
    await assertFails(db('admin').collection('users').doc('employeeB').update({ role: 'client' }));
    await assertFails(db('admin').collection('users').doc('employeeB').delete());
    await assertSucceeds(db('admin').collection('users').doc('employee').delete());
  });

  it('users can edit their own name/avatar but not their role or workspace', async () => {
    await assertSucceeds(db('employee').collection('users').doc('employee').set({ name: 'Renamed', avatar: 'u' }, { merge: true }));
    await assertFails(db('employee').collection('users').doc('employee').update({ role: 'admin' }));
    await assertFails(db('employee').collection('users').doc('employee').update({ workspaceId: 'wsB' }));
    await assertFails(db('clientA').collection('users').doc('clientA').update({ organizationId: 'ORG-BET-002' }));
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

  it('accounts without a profile cannot upload avatars', async () => {
    await assertFails(put('stranger', 'avatars/stranger_1_me.png', png, 'image/png'));
  });

  it('avatars can only be uploaded under your own uid', async () => {
    await assertSucceeds(put('clientA', 'avatars/clientA_1_me.png', png, 'image/png'));
    await assertFails(put('clientA', 'avatars/employee_1_me.png', png, 'image/png'));
    await assertFails(put('clientA', 'avatars/clientA_2_x.pdf', pdf, 'application/pdf'));
  });
});
