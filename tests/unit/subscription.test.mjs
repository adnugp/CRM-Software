// Unit tests for plans and trial/seat/invite helpers. Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStaffRole, addDays, workspaceAccess, staffSeatsLeft, inviteState,
  accessLabel, readOnlyMessage, extendedTrialEnd,
} from '../../src/lib/subscription.ts';
import { PLANS, planById, TRIAL_DAYS, INVITE_DAYS } from '../../src/config/plans.ts';

const now = new Date('2026-11-05T10:00:00Z');

test('admins, managers and employees use staff places; clients do not', () => {
  assert.equal(isStaffRole('admin'), true);
  assert.equal(isStaffRole('manager'), true);
  assert.equal(isStaffRole('user'), true);
  assert.equal(isStaffRole('client'), false);
  assert.equal(isStaffRole(undefined), false);
});

test('a company with no status is active (older companies)', () => {
  assert.deepEqual(workspaceAccess({}, now), { state: 'active', canWrite: true, daysLeft: null });
  assert.deepEqual(workspaceAccess(null, now), { state: 'active', canWrite: true, daysLeft: null });
});

test('a running trial can write and reports whole days left, rounded up', () => {
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: addDays(now, 9) }, now),
    { state: 'trial', canWrite: true, daysLeft: 9 });
  assert.equal(workspaceAccess({ status: 'trial', trialEndsAt: new Date(now.getTime() + 60_000) }, now).daysLeft, 1);
});

test('an ended trial, or one with no end date, is read-only', () => {
  const ended = { state: 'trial-ended', canWrite: false, daysLeft: 0 };
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: now }, now), ended);
  assert.deepEqual(workspaceAccess({ status: 'trial', trialEndsAt: addDays(now, -3) }, now), ended);
  assert.deepEqual(workspaceAccess({ status: 'trial' }, now), ended);
});

test('a suspended company is read-only', () => {
  assert.deepEqual(workspaceAccess({ status: 'suspended' }, now), { state: 'suspended', canWrite: false, daysLeft: null });
});

test('staff places left count members and pending staff invites; limit 0 = unlimited', () => {
  assert.equal(staffSeatsLeft({ staffLimit: 5, staffCount: 3 }, 1), 1);
  assert.equal(staffSeatsLeft({ staffLimit: 5, staffCount: 5 }, 2), 0);
  assert.equal(staffSeatsLeft({ staffLimit: 0, staffCount: 40 }, 3), null);
  assert.equal(staffSeatsLeft(null, 0), null);
});

test('a pending invite past its expiry shows as expired', () => {
  assert.equal(inviteState({ status: 'pending', expiresAt: addDays(now, 1) }, now), 'pending');
  assert.equal(inviteState({ status: 'pending', expiresAt: addDays(now, -1) }, now), 'expired');
  assert.equal(inviteState({ status: 'accepted', expiresAt: addDays(now, -1) }, now), 'accepted');
  assert.equal(inviteState({ status: 'revoked', expiresAt: addDays(now, 1) }, now), 'revoked');
});

test('labels for the plan status', () => {
  assert.equal(accessLabel({ state: 'active', canWrite: true, daysLeft: null }), 'Active');
  assert.equal(accessLabel({ state: 'trial', canWrite: true, daysLeft: 9 }), 'Trial · 9 days left');
  assert.equal(accessLabel({ state: 'trial', canWrite: true, daysLeft: 1 }), 'Trial · 1 day left');
  assert.equal(accessLabel({ state: 'trial-ended', canWrite: false, daysLeft: 0 }), 'Trial ended');
  assert.equal(accessLabel({ state: 'suspended', canWrite: false, daysLeft: null }), 'Suspended');
  assert.match(readOnlyMessage('trial-ended'), /trial has ended/);
  assert.match(readOnlyMessage('suspended'), /suspended/);
});

test('extending a trial adds days from today, or from the current end if later', () => {
  assert.deepEqual(extendedTrialEnd(addDays(now, -5), now, 14), addDays(now, 14));
  assert.deepEqual(extendedTrialEnd(addDays(now, 3), now, 14), addDays(now, 17));
  assert.deepEqual(extendedTrialEnd(undefined, now, 14), addDays(now, 14));
});

test('plans config', () => {
  assert.deepEqual(PLANS.map((p) => p.id), ['starter', 'team', 'business']);
  assert.deepEqual(PLANS.map((p) => p.staffLimit), [5, 20, 50]);
  assert.equal(planById('team')?.name, 'Team');
  assert.equal(planById('nope'), undefined);
  assert.equal(TRIAL_DAYS, 14);
  assert.equal(INVITE_DAYS, 7);
});
