const test = require('node:test');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST, 'Run only with Auth/Firestore emulators');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-crm-test');
const requireFunctions = createRequire(require('node:path').resolve('functions/package.json'));
const api = requireFunctions('./lib/index.js');
const {getFirestore} = requireFunctions('firebase-admin/firestore');
const {getAuth} = requireFunctions('firebase-admin/auth');
const db = getFirestore(), auth = getAuth();
const call = (name, uid, data) => api[name].run({auth: uid ? {uid} : undefined, data});
test.before(async () => {
  for (const uid of ['integration-admin', 'integration-user', 'integration-client']) {
    await auth.createUser({uid});
  }
  await db.doc('workspaces/integration').set({name: 'Integration', divisions: [{id: 'one', name: 'One'}, {id: 'two', name: 'Two'}], recordCount: 0, billing: {status: 'active', limits: {records: 100, aiMessages: 10}}});
  for (const [uid, role] of [['integration-admin', 'admin'], ['integration-user', 'user'], ['integration-client', 'client']]) await db.doc(`workspaces/integration/members/${uid}`).set({role, active: true});
});
test('callable handlers reject absent membership and redact staff fields', async () => {
  await assert.rejects(call('crmList', null, {workspaceId: 'integration', collection: 'projects'}), /Sign in/);
  await assert.rejects(call('crmList', 'integration-admin', {workspaceId: 'foreign', collection: 'projects'}), /membership/);
  await call('crmMutate', 'integration-admin', {workspaceId: 'integration', collection: 'projects', action: 'create', id: 'assigned', data: {name: 'Assigned', assignedTo: 'integration-user', sharedWith: ['integration-client'], budget: 10}});
  await db.doc('workspaces/integration/projects/assigned').update({internalNotes: 'legacy private field'});
  const staff = await call('crmList', 'integration-user', {workspaceId: 'integration', collection: 'projects'});
  assert.equal(staff.records.length, 1); assert.equal(staff.records[0].budget, undefined); assert.equal(staff.records[0].internalNotes, undefined);
  const client = await call('crmList', 'integration-client', {workspaceId: 'integration', collection: 'projects'});
  assert.equal(client.records.length, 1);
  await assert.rejects(call('crmList', 'integration-user', {workspaceId: 'integration', collection: 'invoices'}), /Finance/);
});
test('awarded tender conversion and payment receipts are idempotent', async () => {
  const awarded = {workspaceId: 'integration', collection: 'tenders', action: 'create', id: 'award', requestId: 'award-request', data: {name: 'Award', status: 'awarded', divisionId: 'one'}};
  const first = await call('crmMutate', 'integration-admin', awarded);
  assert.deepEqual(await call('crmMutate', 'integration-admin', awarded), first);
  assert.equal((await db.doc('workspaces/integration/projects/tender_award').get()).data().sourceTenderId, 'award');
  await call('crmMutate', 'integration-admin', {workspaceId: 'integration', collection: 'invoices', action: 'create', id: 'invoice', data: {name: 'Invoice', amountMinor: 10000, paidAmountMinor: 0, currency: 'AED', status: 'draft'}});
  const payment = {workspaceId: 'integration', invoiceId: 'invoice', amountMinor: 2500, date: '2026-09-30', requestId: 'receipt'};
  const receipt = await call('recordPayment', 'integration-admin', payment);
  assert.deepEqual(await call('recordPayment', 'integration-admin', payment), receipt);
  assert.equal((await db.doc('workspaces/integration/invoices/invoice').get()).data().paidAmountMinor, 2500);
  await assert.rejects(call('recordPayment', 'integration-user', payment), /Management/);
  await assert.rejects(call('recordPayment', 'integration-admin', {...payment, requestId: 'overpay', amountMinor: 9000}), /exceeds/);
});
test('AI uses an in-process fake provider and confirmations retain tenant/user binding', async () => {
  const provider = requireFunctions('./lib/ai/provider.js');
  const original = provider.complete;
  let calls = 0;
  provider.complete = async () => {calls++; return {content: 'Fake provider response'};};
  try {
    const reply = await call('aiChat', 'integration-admin', {workspaceId: 'integration', message: 'Hello'});
    assert.equal(reply.response, 'Fake provider response'); assert.equal(calls, 1);
    await db.doc('workspaces/integration/aiProposals/bound').set({uid: 'integration-admin', workspaceId: 'integration', tool: 'createTask', args: {collection: 'tasks', action: 'create', data: {name: 'Confirmed task'}}, expiresAt: Date.now() + 60000});
    await assert.rejects(call('aiConfirm', 'integration-user', {workspaceId: 'integration', proposalId: 'bound'}), /proposal|Proposal|unavailable|another/);
    const first = await call('aiConfirm', 'integration-admin', {workspaceId: 'integration', proposalId: 'bound'});
    const second = await call('aiConfirm', 'integration-admin', {workspaceId: 'integration', proposalId: 'bound'});
    assert.deepEqual(second.result, first.result); assert.equal(second.duplicate, true);
    assert.equal((await db.collection('workspaces/integration/tasks').get()).size, 1);
  } finally {provider.complete = original;}
});
