// Unit tests for the deals pipeline rules (stages, totals, follow-ups, history).
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, OPEN_STAGES, stageById } from '../../src/config/pipeline.ts';
import {
  pipelineTotals, stageTotals, isFollowUpDue, isFollowUpOverdue, dueFollowUps, stageChange,
  newActivity, sortActivities, sortDeals, matchesCompany, companyInUse, contactInUse, localDate, formatAed,
} from '../../src/lib/pipeline.ts';

const now = new Date(2026, 10, 6, 10, 0); // 6 Nov 2026, local time
let n = 0;
const makeId = () => `id-${++n}`;
const deal = (over) => ({ stage: 'lead', value: 0, wonAt: null, closedAt: null, nextFollowUp: null, ...over });

test('stages are in order with their win chances', () => {
  assert.deepEqual(STAGES.map(s => [s.id, s.winChance]), [
    ['lead', 0.1], ['qualified', 0.25], ['proposal', 0.5], ['negotiation', 0.75], ['won', 1], ['lost', 0],
  ]);
  assert.deepEqual(OPEN_STAGES, ['lead', 'qualified', 'proposal', 'negotiation']);
  assert.equal(stageById('proposal').label, 'Proposal');
  assert.equal(stageById('nope'), undefined);
});

test('pipeline totals: open deals, weighted value, and wins this month', () => {
  const t = pipelineTotals([
    deal({ stage: 'lead', value: 1000 }),
    deal({ stage: 'negotiation', value: 2000 }),
    deal({ stage: 'won', value: 5000, wonAt: new Date(2026, 10, 2) }),
    deal({ stage: 'won', value: 9000, wonAt: new Date(2026, 9, 30) }),
    deal({ stage: 'lost', value: 7000 }),
  ], now);
  assert.deepEqual(t, { openCount: 2, openValue: 3000, weightedValue: 1600, wonThisMonth: 5000, wonThisMonthCount: 1 });
});

test('stage totals per board column', () => {
  const t = stageTotals([deal({ stage: 'lead', value: 10 }), deal({ stage: 'lead', value: 5 }), deal({ stage: 'won', value: 1 })]);
  assert.deepEqual(t.lead, { count: 2, value: 15 });
  assert.deepEqual(t.won, { count: 1, value: 1 });
  assert.deepEqual(t.lost, { count: 0, value: 0 });
});

test('local date and money format', () => {
  assert.equal(localDate(now), '2026-11-06');
  assert.equal(formatAed(12500.4), 'AED 12,500');
  assert.equal(formatAed(0), 'AED 0');
});

test('follow-ups: due today or earlier, overdue before today, only on open deals', () => {
  const today = '2026-11-06';
  const a = deal({ nextFollowUp: { date: '2026-11-04', note: 'Call' } });
  const b = deal({ nextFollowUp: { date: '2026-11-06', note: 'Send quote' } });
  const c = deal({ nextFollowUp: { date: '2026-11-09', note: 'Later' } });
  const d = deal({ stage: 'won', nextFollowUp: { date: '2026-11-01', note: 'Closed' } });
  const e = deal({});
  assert.deepEqual([a, b, c, d, e].map(x => isFollowUpDue(x, today)), [true, true, false, false, false]);
  assert.deepEqual([a, b, c].map(x => isFollowUpOverdue(x, today)), [true, false, false]);
  assert.deepEqual(dueFollowUps([c, b, d, a, e], today), [a, b]);
});

test('stageChange: winning sets both dates and logs the move', () => {
  const won = stageChange(deal({ stage: 'proposal' }), 'won', { byId: 'u1', now, makeId });
  assert.equal(won.stage, 'won');
  assert.equal(won.wonAt, now);
  assert.equal(won.closedAt, now);
  assert.equal(won.lostReason, null);
  assert.deepEqual(won.activity, { id: won.activity.id, type: 'stage', text: 'Moved to Won', at: now.toISOString(), byId: 'u1' });
});

test('stageChange: losing needs a reason', () => {
  assert.throws(() => stageChange(deal({}), 'lost', { byId: 'u1', now, makeId }), /reason/);
  assert.throws(() => stageChange(deal({}), 'lost', { byId: 'u1', now, makeId, lostReason: '   ' }), /reason/);
  const lost = stageChange(deal({ stage: 'negotiation' }), 'lost', { byId: 'u1', now, makeId, lostReason: ' Price too high ' });
  assert.equal(lost.wonAt, null);
  assert.equal(lost.closedAt, now);
  assert.equal(lost.lostReason, 'Price too high');
  assert.equal(lost.activity.text, 'Moved to Lost: Price too high');
});

test('stageChange: reopening clears the close fields; same stage is refused', () => {
  const reopened = stageChange(deal({ stage: 'lost', closedAt: now, lostReason: 'x' }), 'proposal', { byId: 'u1', now, makeId });
  assert.deepEqual([reopened.stage, reopened.wonAt, reopened.closedAt, reopened.lostReason], ['proposal', null, null, null]);
  assert.throws(() => stageChange(deal({ stage: 'lead' }), 'lead', { byId: 'u1', now, makeId }), /already/);
});

test('history is shown newest first without changing the original list', () => {
  const list = [
    newActivity('note', 'a', 'u1', new Date('2026-11-01T10:00:00Z'), '1'),
    newActivity('call', 'b', 'u1', new Date('2026-11-05T10:00:00Z'), '2'),
    newActivity('email', 'c', 'u1', new Date('2026-11-03T10:00:00Z'), '3'),
  ];
  assert.deepEqual(sortActivities(list).map(a => a.id), ['2', '3', '1']);
  assert.deepEqual(list.map(a => a.id), ['1', '2', '3']);
});

test('deal list sorting', () => {
  const x = deal({ value: 5, expectedCloseDate: '2026-12-01', nextFollowUp: { date: '2026-11-10', note: '' } });
  const y = deal({ value: 9, expectedCloseDate: '2026-11-20' });
  const z = deal({ value: 1, nextFollowUp: { date: '2026-11-07', note: '' } });
  assert.deepEqual(sortDeals([x, y, z], 'value'), [y, x, z]);
  assert.deepEqual(sortDeals([x, y, z], 'close'), [y, x, z]);
  assert.deepEqual(sortDeals([x, y, z], 'followUp'), [z, x, y]);
});

test('earlier records match by link, organisation id or name', () => {
  const co = { id: 'co1', name: 'Gulf Facilities LLC', organizationId: 'ORG-GF-001' };
  assert.equal(matchesCompany({ companyId: 'co1', company: 'Other' }, co), true);
  assert.equal(matchesCompany({ organizationId: 'ORG-GF-001', company: 'Renamed' }, co), true);
  assert.equal(matchesCompany({ company: '  gulf facilities llc ' }, co), true);
  assert.equal(matchesCompany({ company: 'Gulf Trading Co.' }, co), false);
  assert.equal(matchesCompany({ organizationId: '', company: 'x' }, { id: 'c2', name: 'y', organizationId: '' }), false);
});

test('deleting is blocked while something still uses the record', () => {
  assert.equal(companyInUse('co1', [], []), null);
  assert.equal(companyInUse('co1', [{ companyId: 'co1' }], []), '1 deal uses this company.');
  assert.equal(
    companyInUse('co1', [{ companyId: 'co1' }, { companyId: 'co1' }, { companyId: 'x' }], [{ companyId: 'co1' }]),
    '2 deals and 1 contact use this company.',
  );
  assert.equal(contactInUse('k1', []), null);
  assert.equal(contactInUse('k1', [{ contactId: 'k1' }]), '1 deal uses this contact.');
});
