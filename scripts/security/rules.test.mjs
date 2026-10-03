import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

// Explicit demo project and emulator hosts: this suite must never contact production.
const projectId = 'demo-crm-test';
assert.ok(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST, 'Run through Firebase emulators:exec');
const env = await initializeTestEnvironment({ projectId, firestore: { rules: fs.readFileSync('firestore.rules', 'utf8') }, storage: { rules: fs.readFileSync('storage.rules', 'utf8') } });
test.after(async () => env.cleanup());
await env.withSecurityRulesDisabled(async context => {
  const db = context.firestore();
  await setDoc(doc(db, 'workspaces/one'), { name: 'One' });
  for (const [uid, role, active] of [['admin', 'admin', true], ['manager', 'manager', true], ['user', 'user', true], ['client', 'client', true], ['revoked', 'admin', false]]) {
    await setDoc(doc(db, `workspaces/one/members/${uid}`), { role, active });
  }
  await setDoc(doc(db, 'workspaces/one/projects/assigned'), { assignedTo: 'user', sharedWith: ['client'] });
  await setDoc(doc(db, 'workspaces/one/projects/private'), { assignedTo: 'someone', sharedWith: [] });
  await setDoc(doc(db, 'workspaces/one/payments/finance'), { assignedTo: 'user', sharedWith: ['client'], amount: 100 });
  await setDoc(doc(db, 'workspaces/one/files/pending'), { recordCollection: 'projects', recordId: 'assigned', assignedTo: 'user', sharedWith: ['client'], quarantine: 'pending', currentVersionId: 'v1', size:6, mimeType:'text/plain' });
  await setDoc(doc(db, 'workspaces/one/files/clean'), { recordCollection: 'projects', recordId: 'assigned', assignedTo: 'user', sharedWith: ['client'], quarantine: 'clean', currentVersionId: 'v1' });
  await uploadBytes(ref(context.storage(), 'workspaces/one/documents/pending/v1/test.txt'), new TextEncoder().encode('pending'), { contentType: 'text/plain' });
  await uploadBytes(ref(context.storage(), 'workspaces/one/documents/clean/v1/test.txt'), new TextEncoder().encode('clean'), { contentType: 'text/plain' });
  await uploadBytes(ref(context.storage(), 'workspaces/one/documents/clean/old/test.txt'), new TextEncoder().encode('old pending'), { contentType: 'text/plain' });
});
test('tenant isolation and revocation block reads; assignments and shares are scoped', async () => {
  for (const uid of ['outsider', 'revoked']) await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'workspaces/one/projects/assigned')));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'workspaces/one/projects/assigned')));
  for (const uid of ['admin', 'manager']) await assertSucceeds(getDoc(doc(env.authenticatedContext(uid).firestore(), 'workspaces/one/projects/assigned')));
  for (const uid of ['user', 'client']) await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'workspaces/one/projects/assigned')));
  for (const uid of ['user', 'client']) await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'workspaces/one/projects/private')));
  await assertFails(getDoc(doc(env.authenticatedContext('admin').firestore(), 'workspaces/two/projects/assigned')));
});
test('financial confidentiality and server mutation boundary', async () => {
  for (const uid of ['user', 'client']) await assertFails(getDoc(doc(env.authenticatedContext(uid).firestore(), 'workspaces/one/payments/finance')));
  await assertSucceeds(getDoc(doc(env.authenticatedContext('manager').firestore(), 'workspaces/one/payments/finance')));
  const db = env.authenticatedContext('admin').firestore();
  await assertFails(updateDoc(doc(db, 'workspaces/one/members/user'), { role: 'admin' }));
  await assertFails(setDoc(doc(db, 'workspaces/one/projects/created'), { assignedTo: 'admin' }));
  await assertFails(setDoc(doc(db, 'users/admin'), { role: 'admin' }));
});
test('pending Storage is unreadable and client uploads are blocked', async () => {
  for (const uid of ['admin', 'user', 'client']) await assertFails(getBytes(ref(env.authenticatedContext(uid).storage(), 'workspaces/one/documents/pending/v1/test.txt')));
  await assertSucceeds(getBytes(ref(env.authenticatedContext('client').storage(), 'workspaces/one/documents/clean/v1/test.txt')));
  await assertFails(getBytes(ref(env.authenticatedContext('client').storage(), 'workspaces/one/documents/clean/old/test.txt')));
  await assertFails(getBytes(ref(env.authenticatedContext('outsider').storage(), 'workspaces/one/documents/clean/v1/test.txt')));
  const bytes = new TextEncoder().encode('upload');
  await assertFails(uploadBytes(ref(env.authenticatedContext('client').storage(), 'workspaces/one/documents/pending/v1/new.txt'), bytes, { contentType: 'text/plain' }));
  await assertSucceeds(uploadBytes(ref(env.authenticatedContext('user').storage(), 'workspaces/one/documents/pending/v1/new.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(env.authenticatedContext('user').storage(), 'workspaces/one/documents/pending/v1/new.txt'), bytes, { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(env.authenticatedContext('user').storage(), 'workspaces/one/documents/pending/wrong/new.txt'), bytes, { contentType: 'text/plain' }));
  await env.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), 'workspaces/one/projects/assigned'), {sharedWith: []}));
  await assertFails(getBytes(ref(env.authenticatedContext('client').storage(), 'workspaces/one/documents/clean/v1/test.txt')));
});

test('platform suspension immediately denies existing tokens and cannot be cleared by profile edit',async()=>{
 await env.withSecurityRulesDisabled(async context=>setDoc(doc(context.firestore(),'users/manager'),{disabled:true,name:'Manager'}));
 const context=env.authenticatedContext('manager');
 await assertFails(getDoc(doc(context.firestore(),'workspaces/one/projects/assigned')));
 await assertFails(getBytes(ref(context.storage(),'workspaces/one/documents/clean/v1/test.txt')));
 await assertFails(updateDoc(doc(context.firestore(),'users/manager'),{disabled:false}));
});
