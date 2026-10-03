import test from 'node:test';
import assert from 'node:assert/strict';
import { planMigration, fingerprint } from '../migration-plan.mjs';
const config = { workspaceId: 'legacy', workspaceName: 'Legacy CRM', migrationId: 'initial', actorUid: 'admin1', divisions: [{ id: 'grow', name: 'Grow Plus' }, { id: 'sadeem', name: 'Sadeem' }], members: { admin1: { role: 'admin', active: true } }, recordDivisions: { 'projects/original': 'grow' } };
const source = { projects: [{ id: 'original', data: { name: 'Project', company: 'Sadeem' } }] };
test('requires every record mapped explicitly without company inference', () => {
  const plan = planMigration(source, { ...config, recordDivisions: {} });
  assert.deepEqual(plan.errors, ['Missing division mapping projects/original']);
});
test('preserves IDs and explicit division regardless of legacy company', () => {
  const entry = planMigration(source, config).writes.find(w => w.path.endsWith('/projects/original'));
  assert.equal(entry.data.divisionId, 'grow');
  assert.equal(entry.data.company, 'Sadeem');
});
test('idempotent replay skips migration-owned unchanged data', () => {
  const first = planMigration(source, config);
  const existing = Object.fromEntries(first.writes.map(w => [w.path, w.data]));
  const second = planMigration(source, config, existing);
  assert.equal(second.errors.length, 0);
  assert.equal(second.writes.length, 0);
  assert.equal(second.counts.skipped, first.writes.length);
});
test('preserves existing and subsequently changed data as conflicts', () => {
  const first = planMigration(source, config), existing = Object.fromEntries(first.writes.map(w => [w.path, w.data]));
  existing['workspaces/legacy/projects/original'].name = 'Changed after migration';
  assert.ok(planMigration(source, config, existing).errors.includes('Conflict at workspaces/legacy/projects/original'));
  assert.ok(planMigration(source, config, { 'workspaces/legacy': { name: 'Unrelated' } }).errors.length);
});
test('invalid mappings fail and source file download/base64 data is quarantined', () => {
  assert.throws(() => planMigration(source, { ...config, members: { admin1: { role: 'owner', active: true } } }));
  const files = { files: [{ id: 'f1', data: { name: 'Unsafe', url: 'public-link', base64: 'secret', versions: [{ quarantine: 'clean' }] } }] };
  const plan = planMigration(files, { ...config, recordDivisions: { 'files/f1': 'grow' } });
  const file = plan.writes.find(w => w.path.endsWith('/files/f1')).data;
  assert.equal(file.quarantine, 'pending');
  assert.equal(file.url, undefined); assert.equal(file.base64, undefined); assert.equal(file.versions, undefined);
});
test('hash is stable regardless of key ordering', () => assert.equal(fingerprint({ b: 2, a: 1 }), fingerprint({ a: 1, b: 2 })));
