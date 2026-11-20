// Unit tests for linking logins to employee records and building a project team.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { employeeSync, newEmployeeRecord, projectTeamIds } from '../../src/lib/team.ts';

const people = [
  { id: 'u1', name: 'Aisha', email: 'aisha@a.test', role: 'admin' },
  { id: 'u2', name: 'Priya', email: 'priya@a.test', role: 'user' },
  { id: 'c1', name: 'Client Co', email: 'c@c.test', role: 'client' },
];

test('staff logins without a record are created; clients never', () => {
  const { create } = employeeSync(people, [{ id: 'u1', name: 'Aisha', email: 'aisha@a.test', userId: 'u1' }]);
  assert.deepEqual(create.map(p => p.id), ['u2']);
});

test('a linked record follows the login name and email', () => {
  const { update } = employeeSync(people, [
    { id: 'u1', name: 'Old Name', email: 'aisha@a.test', userId: 'u1' },
    { id: 'u2', name: 'Priya', email: 'priya@a.test', userId: 'u2' },
  ]);
  assert.deepEqual(update, [{ id: 'u1', name: 'Aisha', email: 'aisha@a.test' }]);
});

test('records added by hand are left alone', () => {
  const { create, update } = employeeSync(people, [
    { id: 'u1', name: 'Hand made', email: 'x@x.test' },
    { id: 'u2', name: 'Priya', email: 'priya@a.test', userId: 'u2' },
    { id: 'e9', name: 'Site worker', email: '' },
  ]);
  assert.deepEqual(create, []);
  assert.deepEqual(update, []);
});

test('a new record carries the login and empty HR fields', () => {
  assert.deepEqual(newEmployeeRecord({ id: 'u2', name: 'Priya', email: 'priya@a.test' }, '2026-11-20'), {
    userId: 'u2', name: 'Priya', email: 'priya@a.test', department: '', position: '', phone: '', joinDate: '2026-11-20', status: 'active',
  });
});

test('a project team is the lead, task assignees and members, each once', () => {
  assert.deepEqual(
    projectTeamIds({ assignedTo: 'u1', tasks: [{ assignedTo: 'u2' }, { assignedTo: 'u1' }, { assignedTo: '' }], teamMembers: ['e9', 'u2'] }),
    ['u1', 'u2', 'e9'],
  );
  assert.deepEqual(projectTeamIds({}), []);
});
