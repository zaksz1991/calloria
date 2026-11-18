import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAMPAIGN_OPERATIONS_VERSION,
  DEFAULT_CONTACTS_PER_CAMPAIGN,
  RETRY_DELAYS_MS,
  createCampaignWorklist,
  normalizeCampaignWorklist,
  findCampaignContact,
  campaignContactEligibility,
  startCampaignContact,
  resolveDialAttempt,
  finishCampaignContact,
  campaignWorklistMetrics,
  campaignContactStatusLabel,
} from '../js/campaign-operations-engine.js';

const campaigns = [
  { id: 'welcome', title: 'New customer welcome', type: 'ONBOARDING', customer: 'David Eze' },
  { id: 'retention', title: 'Service retention follow-up', type: 'RETENTION', customer: 'Ngozi Umeh' },
];
const baseNow = Date.parse('2026-11-18T08:00:00.000Z');

function makeList(options = {}) {
  return createCampaignWorklist(campaigns, { now: baseNow, day: 4, seed: 81, ...options });
}

test('v6.67 exports a versioned campaign operations contract', () => {
  assert.equal(CAMPAIGN_OPERATIONS_VERSION, '6.67.0');
  assert.equal(DEFAULT_CONTACTS_PER_CAMPAIGN, 8);
  assert.equal(RETRY_DELAYS_MS.no_answer, 15 * 60_000);
});

test('worklist creates a multi-contact pool while retaining each campaign template customer first', () => {
  const list = makeList();
  assert.equal(list.length, 16);
  assert.equal(list.filter(item => item.campaignId === 'welcome').length, 8);
  assert.equal(list.filter(item => item.campaignId === 'retention').length, 8);
  assert.equal(findCampaignContact(list, 'CMP-welcome-001').customer, 'David Eze');
  assert.equal(findCampaignContact(list, 'CMP-retention-001').customer, 'Ngozi Umeh');
  assert.ok(list.every(item => item.origin === 'synthetic_campaign_contact'));
});

test('worklist generation is deterministic for the same day and seed', () => {
  const first = makeList();
  const second = makeList();
  assert.deepEqual(first.map(item => [item.id, item.customer]), second.map(item => [item.id, item.customer]));
});

test('normalization preserves prior outcomes and adds newly introduced campaign lists', () => {
  const list = makeList();
  list[0].status = 'completed';
  list[0].attempts = 1;
  const normalized = normalizeCampaignWorklist(list, [...campaigns, { id: 'survey', title: 'Survey', customer: 'Grace Ofori' }], { now: baseNow });
  assert.equal(findCampaignContact(normalized, 'CMP-welcome-001').status, 'completed');
  assert.ok(normalized.some(item => item.campaignId === 'survey'));
  assert.equal(normalized.filter(item => item.campaignId === 'survey').length, 8);
});

test('eligibility blocks suppression, closed shifts and unavailable agents', () => {
  const contact = makeList()[0];
  assert.equal(campaignContactEligibility(contact, { now: baseNow, suppressed: true }).allowed, false);
  assert.equal(campaignContactEligibility(contact, { now: baseNow, shiftOpen: false }).allowed, false);
  assert.equal(campaignContactEligibility(contact, { now: baseNow, agentAvailable: false }).allowed, false);
  assert.equal(campaignContactEligibility(contact, { now: baseNow }).allowed, true);
});

test('starting a campaign contact reserves it and records the attempt owner and reference', () => {
  const list = makeList();
  const result = startCampaignContact(list, 'CMP-welcome-001', { attemptId: 'OUT-100', agentName: 'Agent One', now: baseNow });
  assert.equal(result.attemptNumber, 1);
  assert.equal(result.contact.status, 'in_progress');
  assert.equal(result.contact.attemptHistory[0].attemptId, 'OUT-100');
  assert.equal(result.contact.attemptHistory[0].agentName, 'Agent One');
  assert.equal(campaignContactEligibility(result.contact, { now: baseNow }).allowed, false);
});

test('dial outcomes are deterministic for a campaign contact and attempt number', () => {
  const contact = makeList()[0];
  const first = resolveDialAttempt(contact, { attemptNumber: 1, seed: 4 });
  const repeat = resolveDialAttempt(contact, { attemptNumber: 1, seed: 4 });
  const nextAttempt = resolveDialAttempt(contact, { attemptNumber: 2, seed: 4 });
  assert.deepEqual(first, repeat);
  assert.ok(['answered', 'no_answer', 'busy', 'voicemail'].includes(first.outcome));
  assert.ok(['answered', 'no_answer', 'busy', 'voicemail'].includes(nextAttempt.outcome));
});

test('no-answer disposition schedules a 15-minute retry instead of completing the contact', () => {
  const list = makeList();
  const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: 'OUT-101', now: baseNow });
  const result = finishCampaignContact(list, contact.id, { attemptId: 'OUT-101', outcome: 'no_answer', now: baseNow });
  assert.equal(result.status, 'retry_wait');
  assert.equal(Date.parse(result.nextEligibleAt) - baseNow, RETRY_DELAYS_MS.no_answer);
  assert.equal(contact.attemptHistory[0].outcome, 'no_answer');
});

test('busy and voicemail outcomes have separate cooling-off periods', () => {
  for (const [outcome, delay] of [['busy', RETRY_DELAYS_MS.busy], ['voicemail', RETRY_DELAYS_MS.voicemail]]) {
    const list = makeList();
    const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: `OUT-${outcome}`, now: baseNow });
    const result = finishCampaignContact(list, contact.id, { attemptId: `OUT-${outcome}`, outcome, now: baseNow });
    assert.equal(Date.parse(result.nextEligibleAt) - baseNow, delay);
  }
});

test('retry remains blocked before the due time and becomes eligible afterwards', () => {
  const list = makeList();
  const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: 'OUT-102', now: baseNow });
  const result = finishCampaignContact(list, contact.id, { attemptId: 'OUT-102', outcome: 'no_answer', now: baseNow });
  assert.equal(campaignContactEligibility(contact, { now: baseNow + 14 * 60_000 }).allowed, false);
  assert.equal(campaignContactEligibility(contact, { now: Date.parse(result.nextEligibleAt) }).allowed, true);
  assert.equal(campaignContactStatusLabel(contact, baseNow + 1), 'Retry waiting');
});

test('maximum attempts exhausts unanswered work and blocks another redial', () => {
  const list = makeList({ maxAttempts: 2 });
  let contact = findCampaignContact(list, 'CMP-welcome-001');
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const now = attempt === 1 ? baseNow : Date.parse(contact.nextEligibleAt);
    const started = startCampaignContact(list, contact.id, { attemptId: `OUT-${attempt}`, now });
    const result = finishCampaignContact(list, contact.id, { attemptId: started.attemptId, outcome: 'no_answer', now });
    if (attempt === 2) assert.equal(result.status, 'exhausted');
  }
  assert.equal(campaignContactEligibility(contact, { now: baseNow + 24 * 60 * 60_000 }).allowed, false);
});

test('callback requires a future time and becomes callable only when due', () => {
  const list = makeList();
  const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: 'OUT-103', now: baseNow });
  assert.throws(() => finishCampaignContact(list, contact.id, { attemptId: 'OUT-103', outcome: 'callback', now: baseNow, callbackDueAt: new Date(baseNow - 1).toISOString() }), /future/);
  contact.nextEligibleAt = new Date(baseNow - 5 * 60_000).toISOString();
  const due = baseNow + 60 * 60_000;
  const result = finishCampaignContact(list, contact.id, { attemptId: 'OUT-103', outcome: 'callback', now: baseNow, callbackDueAt: due });
  assert.equal(result.status, 'callback_scheduled');
  assert.equal(contact.nextEligibleAt, null);
  assert.equal(campaignContactEligibility(contact, { now: due - 1 }).allowed, false);
  assert.equal(campaignContactEligibility(contact, { now: due }).allowed, true);
});

test('customer opt-out permanently suppresses the worklist contact', () => {
  const list = makeList();
  const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: 'OUT-104', now: baseNow });
  const result = finishCampaignContact(list, contact.id, { attemptId: 'OUT-104', outcome: 'opt_out', now: baseNow });
  assert.equal(result.status, 'suppressed');
  assert.equal(campaignContactEligibility(contact, { now: baseNow + 999_999_999 }).allowed, false);
  assert.equal(campaignContactStatusLabel(contact, baseNow), 'Suppressed');
});

test('completed, declined and review dispositions enter their own terminal worklist states', () => {
  const expected = [['completed', 'completed'], ['declined', 'completed'], ['review', 'review_required']];
  for (const [outcome, expectedStatus] of expected) {
    const list = makeList();
    const { contact } = startCampaignContact(list, 'CMP-welcome-001', { attemptId: `OUT-${outcome}`, now: baseNow });
    assert.equal(finishCampaignContact(list, contact.id, { attemptId: `OUT-${outcome}`, outcome, now: baseNow }).status, expectedStatus);
  }
});

test('metrics distinguish eligible, waiting, callback, completed, suppressed and exhausted contacts', () => {
  const list = makeList({ contactsPerCampaign: 4, maxAttempts: 3 });
  const ready = findCampaignContact(list, 'CMP-welcome-001');
  const retry = findCampaignContact(list, 'CMP-welcome-002');
  const callback = findCampaignContact(list, 'CMP-welcome-003');
  const completed = findCampaignContact(list, 'CMP-welcome-004');
  startCampaignContact(list, ready.id, { attemptId: 'OUT-ready', now: baseNow });
  const retryStart = startCampaignContact(list, retry.id, { attemptId: 'OUT-retry', now: baseNow });
  finishCampaignContact(list, retry.id, { attemptId: retryStart.attemptId, outcome: 'no_answer', now: baseNow });
  const callbackStart = startCampaignContact(list, callback.id, { attemptId: 'OUT-callback', now: baseNow });
  finishCampaignContact(list, callback.id, { attemptId: callbackStart.attemptId, outcome: 'callback', now: baseNow, callbackDueAt: baseNow + 30 * 60_000 });
  const completedStart = startCampaignContact(list, completed.id, { attemptId: 'OUT-completed', now: baseNow });
  finishCampaignContact(list, completed.id, { attemptId: completedStart.attemptId, outcome: 'completed', now: baseNow });
  const metrics = campaignWorklistMetrics(list, { now: baseNow });
  assert.equal(metrics.total, 8);
  assert.equal(metrics.inProgress, 1);
  assert.equal(metrics.retryWaiting, 1);
  assert.equal(metrics.callbacksScheduled, 1);
  assert.equal(metrics.completed, 1);
  assert.equal(metrics.attempts, 4);
});
