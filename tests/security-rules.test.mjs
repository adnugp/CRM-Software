// Security rules tests. Run with `npm run test:rules`, which starts the local
// Firestore + Storage emulators (demo project, never touches production).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';

let env;

const profiles = {
  admin: { name: 'Admin', email: 'admin@test.dev', role: 'admin' },
  manager: { name: 'Manager', email: 'manager@test.dev', role: 'manager' },
  employee: { name: 'Employee', email: 'employee@test.dev', role: 'user' },
  clientA: { name: 'Client A', email: 'a@client.dev', role: 'client', company: 'Acme', organizationId: 'ORG-ACM-001' },
  clientB: { name: 'Client B', email: 'b@client.dev', role: 'client', company: 'Beta', organizationId: 'ORG-BET-002' },
};

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const storage = (uid) => (uid ? env.authenticatedContext(uid).storage() : env.unauthenticatedContext().storage());

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
    const admin = ctx.firestore();
    for (const [uid, data] of Object.entries(profiles)) {
      await admin.collection('users').doc(uid).set(data);
    }
    await admin.collection('projects').doc('p-by-client').set({ name: 'Linked by clientId', clientId: 'clientA' });
    await admin.collection('projects').doc('p-by-org').set({ name: 'Linked by org', organizationId: 'ORG-ACM-001' });
    await admin.collection('projects').doc('p-other').set({ name: 'Someone else', clientId: 'clientB', organizationId: 'ORG-BET-002' });
    await admin.collection('tenders').doc('t1').set({ name: 'Tender' });
    await admin.collection('employees').doc('e1').set({ name: 'Emp' });
  });
});

describe('signed-out and unregistered accounts', () => {
  it('signed-out visitors cannot read anything', async () => {
    await assertFails(db(null).collection('projects').get());
    await assertFails(db(null).collection('users').get());
    await assertFails(db(null).collection('tenders').doc('t1').get());
  });

  it('an Auth account with no profile gets no data', async () => {
    await assertFails(db('stranger').collection('projects').get());
    await assertFails(db('stranger').collection('tenders').get());
    await assertSucceeds(db('stranger').collection('users').doc('stranger').get()); // own (missing) profile
  });

  it('cannot create its own profile to grant itself a role', async () => {
    await assertFails(db('stranger').collection('users').doc('stranger').set({ name: 'x', email: 'x', role: 'admin' }));
  });
});

describe('staff', () => {
  it('employees can read and write business data', async () => {
    await assertSucceeds(db('employee').collection('projects').get());
    await assertSucceeds(db('employee').collection('tenders').add({ name: 'New' }));
    await assertSucceeds(db('employee').collection('payments').add({ amount: 1 }));
    await assertSucceeds(db('employee').collection('projects').doc('p-other').update({ status: 'running' }));
  });

  it('employees can read but not edit the employee directory', async () => {
    await assertSucceeds(db('employee').collection('employees').get());
    await assertFails(db('employee').collection('employees').doc('e1').update({ name: 'Changed' }));
  });

  it('managers can edit the employee directory', async () => {
    await assertSucceeds(db('manager').collection('employees').doc('e1').update({ name: 'Changed' }));
  });
});

describe('user profiles', () => {
  it('only admins create or delete profiles', async () => {
    await assertSucceeds(db('admin').collection('users').doc('new').set({ name: 'N', email: 'n@x', role: 'user' }));
    await assertFails(db('manager').collection('users').doc('new2').set({ name: 'N', email: 'n@x', role: 'user' }));
    await assertFails(db('manager').collection('users').doc('employee').delete());
  });

  it('users can edit their own name/avatar but not their role', async () => {
    await assertSucceeds(db('employee').collection('users').doc('employee').set({ name: 'Renamed', avatar: 'u' }, { merge: true }));
    await assertFails(db('employee').collection('users').doc('employee').update({ role: 'admin' }));
    await assertFails(db('clientA').collection('users').doc('clientA').update({ organizationId: 'ORG-BET-002' }));
  });

  it('clients can read only their own profile', async () => {
    await assertSucceeds(db('clientA').collection('users').doc('clientA').get());
    await assertFails(db('clientA').collection('users').doc('employee').get());
    await assertFails(db('clientA').collection('users').get());
  });
});

describe('clients', () => {
  it('can query their projects by clientId and by organizationId', async () => {
    const byClient = await assertSucceeds(db('clientA').collection('projects').where('clientId', '==', 'clientA').get());
    const byOrg = await assertSucceeds(db('clientA').collection('projects').where('organizationId', '==', 'ORG-ACM-001').get());
    if (byClient.size !== 1 || byOrg.size !== 1) throw new Error(`unexpected sizes ${byClient.size}/${byOrg.size}`);
  });

  it("cannot read another client's project or list all projects", async () => {
    await assertFails(db('clientA').collection('projects').doc('p-other').get());
    await assertFails(db('clientA').collection('projects').get());
    await assertFails(db('clientA').collection('projects').where('organizationId', '==', 'ORG-BET-002').get());
  });

  it('cannot write projects or read staff-only data', async () => {
    await assertFails(db('clientA').collection('projects').doc('p-by-client').update({ budget: 1 }));
    await assertFails(db('clientA').collection('tenders').get());
    await assertFails(db('clientA').collection('employees').get());
    await assertFails(db('clientA').collection('payments').get());
  });
});

describe('storage', () => {
  const pdf = new Uint8Array([37, 80, 68, 70]);
  const png = new Uint8Array([137, 80, 78, 71]);

  it('staff can upload documents; clients and visitors cannot', async () => {
    await assertSucceeds(storage('employee').ref('documents/a.pdf').put(pdf, { contentType: 'application/pdf' }));
    await assertFails(storage('clientA').ref('documents/b.pdf').put(pdf, { contentType: 'application/pdf' }));
    await assertFails(storage(null).ref('documents/c.pdf').put(pdf, { contentType: 'application/pdf' }));
  });

  it('avatars can only be uploaded under your own uid', async () => {
    await assertSucceeds(storage('clientA').ref('avatars/clientA_1_me.png').put(png, { contentType: 'image/png' }));
    await assertFails(storage('clientA').ref('avatars/employee_1_me.png').put(png, { contentType: 'image/png' }));
    await assertFails(storage('clientA').ref('avatars/clientA_2_x.pdf').put(pdf, { contentType: 'application/pdf' }));
  });
});
