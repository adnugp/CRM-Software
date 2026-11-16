// Unit tests for who may see a project's internal money figures.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeProjectCosts, canViewProject } from '../../src/lib/project-visibility.ts';

const client = { id: 'c1', role: 'client', organizationId: 'ORG-1', company: 'Gulf Facilities LLC' };

test('a client opens a project linked to them directly, even with another organisation on it', () => {
  assert.equal(canViewProject(client, { id: 'p', clientId: 'c1', organizationId: 'ORG-OTHER' }), true);
});

test("a client opens their organisation's projects", () => {
  assert.equal(canViewProject(client, { id: 'p', clientId: 'someone-else', organizationId: 'ORG-1' }), true);
});

test("a client cannot open another client's project", () => {
  assert.equal(canViewProject(client, { id: 'p', clientId: 'c2', organizationId: 'ORG-2', company: 'Desert Solar FZE' }), false);
});

test('staff open every project; nobody signed out opens any', () => {
  for (const role of ['admin', 'manager', 'user']) assert.equal(canViewProject({ id: 'u', role }, { id: 'p' }), true);
  assert.equal(canViewProject(null, { id: 'p' }), false);
});

test("clients never see a project's costs or profit", () => {
  assert.equal(canSeeProjectCosts('client'), false);
});

test('employees do not see costs or profit', () => {
  assert.equal(canSeeProjectCosts('user'), false);
});

test('admins and managers see costs and profit', () => {
  assert.equal(canSeeProjectCosts('admin'), true);
  assert.equal(canSeeProjectCosts('manager'), true);
});

test('a missing or unknown role sees no costs', () => {
  assert.equal(canSeeProjectCosts(undefined), false);
  assert.equal(canSeeProjectCosts('owner'), false);
});
