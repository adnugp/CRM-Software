// Unit tests for the card checks used by the (demo) payment step and for plan prices.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  digitsOnly, luhnValid, cardBrand, formatCardNumber, formatExpiry, parseExpiry,
  validateCard, summarizeCard, cardLabel, DECLINED_TEST_CARD,
} from '../../src/lib/payment.ts';
import { PLANS, planPrice, formatPrice } from '../../src/config/plans.ts';

const now = new Date('2026-11-05T10:00:00Z');
const goodCard = { name: 'Fay Owner', number: '4242 4242 4242 4242', expiry: '12/28', cvc: '123' };

test('Luhn checksum', () => {
  assert.equal(luhnValid('4242424242424242'), true);
  assert.equal(luhnValid('5555555555554444'), true);
  assert.equal(luhnValid('378282246310005'), true);
  assert.equal(luhnValid('4242424242424241'), false);
  assert.equal(luhnValid(''), false);
});

test('card brand from the first digits', () => {
  assert.equal(cardBrand('4242'), 'visa');
  assert.equal(cardBrand('5555 5555'), 'mastercard');
  assert.equal(cardBrand('2221000000000009'), 'mastercard');
  assert.equal(cardBrand('3782'), 'amex');
  assert.equal(cardBrand('3482'), 'amex');
  assert.equal(cardBrand('6011'), 'unknown');
});

test('card number is grouped as you type (Amex 4-6-5, others 4-4-4-4)', () => {
  assert.equal(formatCardNumber('4242424242424242'), '4242 4242 4242 4242');
  assert.equal(formatCardNumber('4242-4242 42'), '4242 4242 42');
  assert.equal(formatCardNumber('378282246310005'), '3782 822463 10005');
  assert.equal(formatCardNumber('42424242424242424242'), '4242 4242 4242 4242 424'); // max 19 digits
  assert.equal(digitsOnly('4242 4242'), '42424242');
});

test('expiry is typed as MM/YY', () => {
  assert.equal(formatExpiry('1'), '1');
  assert.equal(formatExpiry('12'), '12/');
  assert.equal(formatExpiry('1228'), '12/28');
  assert.equal(formatExpiry('12/284'), '12/28');
  assert.deepEqual(parseExpiry('12/28'), { month: 12, year: 2028 });
  assert.equal(parseExpiry('13/28'), null);
  assert.equal(parseExpiry('1/28'), null);
});

test('a good card has no errors', () => {
  assert.deepEqual(validateCard(goodCard, now), {});
  assert.deepEqual(validateCard({ ...goodCard, number: '3782 822463 10005', cvc: '1234' }, now), {});
});

test('card problems are reported per field', () => {
  assert.ok(validateCard({ ...goodCard, name: ' ' }, now).name);
  assert.ok(validateCard({ ...goodCard, number: '4242 4242 4242 4241' }, now).number);
  assert.ok(validateCard({ ...goodCard, number: '6011 1111 1111 1117' }, now).number); // unsupported brand
  assert.ok(validateCard({ ...goodCard, number: '4242 4242 4242' }, now).number); // too short
  assert.ok(validateCard({ ...goodCard, expiry: '10/26' }, now).expiry); // expired last month
  assert.deepEqual(validateCard({ ...goodCard, expiry: '11/26' }, now), {}); // this month is still fine
  assert.ok(validateCard({ ...goodCard, expiry: '1/2' }, now).expiry);
  assert.ok(validateCard({ ...goodCard, cvc: '12' }, now).cvc);
  assert.ok(validateCard({ ...goodCard, number: '3782 822463 10005', cvc: '123' }, now).cvc); // Amex needs 4
});

test('only a summary of the card is kept', () => {
  assert.deepEqual(summarizeCard(goodCard), { provider: 'demo', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2028 });
  assert.equal(cardLabel({ brand: 'visa', last4: '4242' }), 'Visa ••4242');
  assert.equal(cardLabel(undefined), '');
  assert.equal(luhnValid(DECLINED_TEST_CARD), true); // passes the checks, then the demo provider declines it
});

test('yearly is 10 months for 12', () => {
  assert.deepEqual(PLANS.map((p) => planPrice(p, 'monthly')), [99, 299, 599]);
  assert.deepEqual(PLANS.map((p) => planPrice(p, 'yearly')), [990, 2990, 5990]);
  assert.equal(formatPrice(PLANS[1], 'monthly'), 'AED 299 / month');
  assert.equal(formatPrice(PLANS[1], 'yearly'), 'AED 2,990 / year');
});
