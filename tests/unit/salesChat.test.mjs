// Unit tests for the assistant's sales answers.
// Run: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerSalesQuestion } from '../../src/lib/salesChat.ts';

const now = new Date(2026, 10, 6, 10, 0);
const data = {
  companies: [{ id: 'c1', name: 'Gulf Facilities LLC' }, { id: 'c2', name: 'Harbor Logistics' }],
  deals: [
    { id: 'd1', title: 'Chiller retrofit', companyId: 'c1', value: 40000, stage: 'proposal', nextFollowUp: { date: '2026-11-05', note: 'Call Omar' } },
    { id: 'd2', title: 'CCTV upgrade', companyId: 'c2', value: 10000, stage: 'lead', nextFollowUp: null },
    { id: 'd3', title: 'Old win', companyId: 'c1', value: 5000, stage: 'won', wonAt: new Date(2026, 10, 1) },
  ],
};

test('leaves non-sales questions to the main engine', () => {
  assert.equal(answerSalesQuestion('how many tenders are running', data, now), null);
});

test('follow-ups due', () => {
  assert.match(answerSalesQuestion('follow-ups today', data, now), /Follow-ups due \(1\)[\s\S]*Chiller retrofit[\s\S]*Call Omar/);
  assert.match(answerSalesQuestion('any overdue follow ups?', { ...data, deals: [] }, now), /No follow-ups are due/);
});

test('deals by stage, by company, and open deals', () => {
  assert.match(answerSalesQuestion('deals in proposal', data, now), /Deals in Proposal \(1\)[\s\S]*Chiller retrofit/);
  assert.match(answerSalesQuestion('show deals for harbor logistics', data, now), /Deals for Harbor Logistics \(1\)[\s\S]*CCTV upgrade/);
  assert.match(answerSalesQuestion('list my deals', data, now), /Open deals \(2\)/);
  assert.match(answerSalesQuestion('deals in negotiation', data, now), /No deals in Negotiation/);
});

test('pipeline value', () => {
  assert.match(
    answerSalesQuestion('pipeline value', data, now),
    /2 open deals worth AED 50,000 \(weighted AED 21,000\)\. Won this month: AED 5,000 from 1 deal\./,
  );
});
