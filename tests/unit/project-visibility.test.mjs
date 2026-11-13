// Unit tests for who may see a project's internal money figures.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSeeProjectCosts } from '../../src/lib/project-visibility.ts';

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
