// tests/unit/migration.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTIONS, WORKSPACE_ID, OWNER_EMAIL, docId, checkBackup, convertRecord, countStaff,
  findOwners, resolveOwner, workspaceFields, buildWrites, planReport,
} from '../../scripts/lib/migration.mjs';

const s = (v) => ({ stringValue: v });
const doc = (col, id, fields) => ({ name: `projects/x/databases/(default)/documents/${col}/${id}`, fields });
const backupWith = (over = {}) => ({
  source: 'test', takenAt: '2026-11-09T10:00:00.000Z',
  collections: Object.fromEntries(COLLECTIONS.map((c) => [c, over[c] ?? []])),
});
const NOW = new Date('2026-11-09T10:00:00.000Z');
const users = [
  doc('users', 'u-owner', { email: s(OWNER_EMAIL.toUpperCase()), role: s('admin'), name: s('Owner') }),
  doc('users', 'u-man', { email: s('m@x.com'), role: s('manager') }),
  doc('users', 'u-emp', { email: s('e@x.com'), role: s('user') }),
  doc('users', 'u-cli', { email: s('c@client.com'), role: s('client'), organizationId: s('ORG-1') }),
];

test('docId takes the last path segment', () => {
  assert.equal(docId(doc('projects', 'abc', {})), 'abc');
});

test('checkBackup rejects a backup missing a collection', () => {
  const b = backupWith();
  delete b.collections.files;
  assert.throws(() => checkBackup(b), /files/);
  assert.doesNotThrow(() => checkBackup(backupWith()));
});

test('convertRecord drops belongsTo everywhere and company only from files', () => {
  const p = convertRecord('projects', doc('projects', 'p1', { name: s('A'), belongsTo: s('Sadeem Energy') }));
  assert.deepEqual(p, { name: s('A') });
  const f = convertRecord('files', doc('files', 'f1', { name: s('F'), company: s('Grow Plus Technologies') }));
  assert.deepEqual(f, { name: s('F') });
  const pay = convertRecord('payments', doc('payments', 'x', { company: s('Client LLC') }));
  assert.deepEqual(pay, { company: s('Client LLC') });
});

test('convertRecord keeps other fields unchanged and tolerates no fields', () => {
  const ts = { timestampValue: '2026-01-01T00:00:00Z' };
  assert.deepEqual(convertRecord('tenders', doc('tenders', 't', { createdAt: ts })), { createdAt: ts });
  assert.deepEqual(convertRecord('tenders', { name: 'a/b/tenders/t' }), {});
});

test('countStaff counts admins, managers and employees, not clients', () => {
  assert.equal(countStaff(users), 3);
});

test('findOwners matches the email case-insensitively', () => {
  assert.deepEqual(findOwners(users).map(docId), ['u-owner']);
  assert.deepEqual(findOwners(users, 'nobody@x.com'), []);
});

test('resolveOwner needs an explicit uid whose profile has the owner email, and only one such profile', () => {
  assert.equal(docId(resolveOwner(users, 'u-owner')), 'u-owner');
  assert.throws(() => resolveOwner(users, undefined), /--owner-uid/);
  assert.throws(() => resolveOwner(users, 'u-ghost'), /u-ghost/);
  assert.throws(() => resolveOwner(users, 'u-man'), /m@x\.com/);
  const impostor = doc('users', 'u-fake', { email: s(OWNER_EMAIL), role: s('admin') });
  assert.throws(() => resolveOwner([...users, impostor], 'u-owner'), /2 profiles/);
});

test('workspaceFields describes an active, unlimited, custom-plan company', () => {
  const w = workspaceFields(users, NOW);
  assert.deepEqual(w.name, s('Grow Plus Technologies'));
  assert.deepEqual(w.divisions, { arrayValue: {} });
  assert.deepEqual(w.status, s('active'));
  assert.deepEqual(w.plan, s('custom'));
  assert.deepEqual(w.staffLimit, { integerValue: '0' });
  assert.deepEqual(w.staffCount, { integerValue: '3' });
  assert.deepEqual(w.createdAt, { timestampValue: NOW.toISOString() });
});

test('buildWrites creates the workspace, copies records, tags users and adds the owner', () => {
  const backup = backupWith({
    users,
    projects: [doc('projects', 'p1', { name: s('A'), belongsTo: s('Grow Plus Technologies') })],
  });
  const writes = buildWrites(backup, { project: 'demo-crm', now: NOW, ownerUid: 'u-owner' });
  const base = 'projects/demo-crm/databases/(default)/documents';
  const byName = Object.fromEntries(writes.map((w) => [w.update.name, w]));

  const ws = byName[`${base}/workspaces/${WORKSPACE_ID}`];
  assert.deepEqual(ws.updateMask.fieldPaths.sort(), Object.keys(workspaceFields(users, NOW)).sort());

  assert.deepEqual(byName[`${base}/workspaces/${WORKSPACE_ID}/projects/p1`].update.fields, { name: s('A') });
  assert.equal(byName[`${base}/workspaces/${WORKSPACE_ID}/projects/p1`].updateMask, undefined);

  const u = byName[`${base}/users/u-emp`];
  assert.deepEqual(u.update.fields, { workspaceId: s(WORKSPACE_ID) });
  assert.deepEqual(u.updateMask, { fieldPaths: ['workspaceId'] });

  const owner = byName[`${base}/platformOwners/u-owner`];
  assert.deepEqual(owner.update.fields.email, s(OWNER_EMAIL));

  assert.equal(writes.length, 1 + 1 + users.length + 1);
});

test('buildWrites refuses to run without a valid owner uid', () => {
  assert.throws(() => buildWrites(backupWith({ users }), { project: 'p', now: NOW }), /--owner-uid/);
  assert.throws(() => buildWrites(backupWith({ users: users.slice(1) }), { project: 'p', now: NOW, ownerUid: 'u-owner' }), /u-owner/);
});

test('planReport counts records and finds the owner', () => {
  const r = planReport(backupWith({ users, projects: [doc('projects', 'p1', { createdAt: { timestampValue: 'x' } })] }));
  assert.equal(r.counts.projects, 1);
  assert.equal(r.counts.users, 4);
  assert.equal(r.staffCount, 3);
  assert.deepEqual(r.owners, [{ uid: 'u-owner', email: OWNER_EMAIL.toUpperCase() }]);
  assert.equal(r.users.find((u) => u.email === 'm@x.com').role, 'manager');
});

test('planReport warns about unlinked clients, unknown roles, missing createdAt and owner', () => {
  const r = planReport(backupWith({
    users: [
      doc('users', 'u-cli', { email: s('c@client.com'), role: s('client') }),
      doc('users', 'u-odd', { email: s('odd@x.com'), role: s('boss') }),
      doc('users', 'u-none', { email: s('none@x.com') }),
    ],
    projects: [doc('projects', 'p1', { clientName: s('Someone') })],
  }));
  const text = r.warnings.join('\n');
  assert.match(text, /c@client\.com/);
  assert.match(text, /odd@x\.com.*boss/);
  assert.match(text, /none@x\.com/);
  assert.match(text, /projects: 1 record/);
  assert.match(text, /p1.*client/i);
  assert.match(text, new RegExp(OWNER_EMAIL.replace(/\./g, '\\.')));
});

test('planReport warns when several profiles share an email (e.g. the owner email)', () => {
  const impostor = doc('users', 'u-fake', { email: s(OWNER_EMAIL), role: s('admin') });
  const twin = doc('users', 'u-twin', { email: s('E@x.com'), role: s('user') });
  const text = planReport(backupWith({ users: [...users, impostor, twin] })).warnings.join(' | ');
  assert.match(text, /2 profiles use .*gptechnologies/);
  assert.match(text, /2 profiles use e@x\.com/);
});

test('planReport: a client linked by clientId or organizationId is fine', () => {
  const r = planReport(backupWith({
    users,
    projects: [doc('projects', 'p1', { organizationId: s('ORG-1'), createdAt: { timestampValue: 'x' } })],
  }));
  assert.deepEqual(r.warnings, []);
});
