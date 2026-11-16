// Unit tests for folding a project's older costs into its staff-only record.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeCosts } from '../../src/lib/project-costs.ts';

const cost = (id, amount) => ({ id, projectId: 'p1', description: id, amount, date: '2026-01-01', category: 'Material' });

test('older costs are added to a record that has none', () => {
  assert.deepEqual(mergeCosts([], [cost('c1', 10), cost('c2', 20)]), [cost('c1', 10), cost('c2', 20)]);
});

test('costs already in the record win and are not duplicated', () => {
  const current = [cost('c1', 99), cost('c2', 5)];
  assert.deepEqual(mergeCosts(current, [cost('c1', 10), cost('c3', 7)]), [cost('c1', 99), cost('c2', 5), cost('c3', 7)]);
});

test('with no older costs the record is unchanged', () => {
  const current = [cost('c1', 99)];
  assert.deepEqual(mergeCosts(current, []), current);
  assert.deepEqual(mergeCosts(current, undefined), current);
});
