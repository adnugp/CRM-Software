// Unit tests for changing one item in a list stored on a record.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addItem, updateItem, removeItem, addDocuments, removeDocument, addId, removeId } from '../../src/lib/project-lists.ts';

const a = { id: 'a', name: 'A', status: 'pending' };
const b = { id: 'b', name: 'B', status: 'pending' };

test('addItem appends and leaves the others alone', () => {
  assert.deepEqual(addItem([a], b), [a, b]);
  assert.deepEqual(addItem(undefined, a), [a]);
});

test('addItem does not add an id twice', () => {
  assert.deepEqual(addItem([a, b], { ...a, name: 'again' }), [a, b]);
});

test('updateItem changes only the matching item', () => {
  assert.deepEqual(updateItem([a, b], 'b', { status: 'completed' }), [a, { ...b, status: 'completed' }]);
});

test('updateItem removes keys patched to undefined', () => {
  const withFile = { ...a, fileAttachment: { name: 'f', data: 'u' } };
  assert.deepEqual(updateItem([withFile], 'a', { fileAttachment: undefined }), [a]);
});

test('updating or removing a missing id changes nothing', () => {
  assert.deepEqual(updateItem([a], 'zz', { name: 'x' }), [a]);
  assert.deepEqual(removeItem([a], 'zz'), [a]);
});

test('removeItem removes only the matching item', () => {
  assert.deepEqual(removeItem([a, b], 'a'), [b]);
});

test('documents are added without duplicating a URL and removed by URL', () => {
  const d1 = { name: 'one.pdf', size: 1, type: 'application/pdf', data: 'u1' };
  const d2 = { name: 'two.pdf', size: 2, type: 'application/pdf', data: 'u2' };
  assert.deepEqual(addDocuments([d1], [d1, d2]), [d1, d2]);
  assert.deepEqual(addDocuments(undefined, [d2]), [d2]);
  assert.deepEqual(removeDocument([d1, d2], 'u1'), [d2]);
});

test('ids are added once and removed', () => {
  assert.deepEqual(addId(['x'], 'y'), ['x', 'y']);
  assert.deepEqual(addId(['x'], 'x'), ['x']);
  assert.deepEqual(removeId(['x', 'y'], 'x'), ['y']);
  assert.deepEqual(addId(undefined, 'x'), ['x']);
});
