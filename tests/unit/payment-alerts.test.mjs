// Unit tests for which payments the notification bell warns about.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentAlert } from '../../src/lib/payment-alerts.ts';

const today = new Date(2026, 10, 16, 15, 30); // 16 Nov 2026, mid-afternoon local time

test('a paid payment never raises an alert, even past its due date', () => {
  assert.equal(paymentAlert({ status: 'paid', dueDate: '2026-10-01' }, today), null);
  assert.equal(paymentAlert({ status: 'paid', dueDate: '2026-11-18' }, today), null);
});

test('a pending payment past its due date is overdue', () => {
  assert.deepEqual(paymentAlert({ status: 'pending', dueDate: '2026-11-15' }, today), { kind: 'overdue' });
});

test('a payment marked overdue is overdue', () => {
  assert.deepEqual(paymentAlert({ status: 'overdue', dueDate: '2026-12-31' }, today), { kind: 'overdue' });
});

test('a pending payment due today or within 7 days is due soon', () => {
  assert.deepEqual(paymentAlert({ status: 'pending', dueDate: '2026-11-16' }, today), { kind: 'due-soon', days: 0 });
  assert.deepEqual(paymentAlert({ status: 'pending', dueDate: '2026-11-23' }, today), { kind: 'due-soon', days: 7 });
});

test('a pending payment due later than 7 days raises nothing', () => {
  assert.equal(paymentAlert({ status: 'pending', dueDate: '2026-11-24' }, today), null);
});

test('a missing or broken due date raises nothing unless marked overdue', () => {
  assert.equal(paymentAlert({ status: 'pending', dueDate: '' }, today), null);
  assert.equal(paymentAlert({ status: 'pending', dueDate: 'not a date' }, today), null);
  assert.deepEqual(paymentAlert({ status: 'overdue', dueDate: '' }, today), { kind: 'overdue' });
});
