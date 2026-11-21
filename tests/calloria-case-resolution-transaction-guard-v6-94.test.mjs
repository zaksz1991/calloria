import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformCaseLifecycleV694, calloriaCaseResolutionTransactionGuardPluginV694 } from '../build/calloria-case-resolution-transaction-guard-v6-94.mjs';

const fixture = await readFile(new URL('./fixtures/case-lifecycle-before-v694.mjs', import.meta.url), 'utf8');
const now = new Date('2026-11-21T12:00:00.000Z');
const activeClock = { day: 3, minutes: 600, active: true };
const evidence = 'Checked the service record, confirmed the correction with the customer and explained the next step.';

async function loadTransformed() {
  const transformed = transformCaseLifecycleV694(fixture);
  const url = `data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`;
  return import(url);
}
function agentCase() {
  return {
    reference: 'CASE-AGENT-1', status: 'Reopened · follow-up in progress', owner: 'Agent One',
    lifecycle: { version: '6.71.0', reopenCount: 1, history: [], followUp: {
      id: 'CFU-CASE-AGENT-1-1', status: 'in_progress', priority: 'normal', dueDay: 3, dueMinute: 720,
      owner: 'Agent One', openedBy: 'Agent One', reasonCategory: 'customer-says-unresolved', reason: 'Customer reports the issue is still unresolved.',
      attempts: 0, claimedBy: 'Agent One', claimedAt: now.toISOString(), history: [], lastOutcome: '', lastSummary: ''
    } }
  };
}
function supervisorCase() {
  return {
    reference: 'CASE-SUP-1', status: 'Reopened case · supervisor review', owner: 'Agent One',
    lifecycle: { version: '6.71.0', reopenCount: 1, history: [], followUp: {
      id: 'CFU-CASE-SUP-1-1', status: 'supervisor_review', priority: 'urgent', dueDay: 3, dueMinute: 630,
      owner: 'Agent One', openedBy: 'Agent One', reasonCategory: 'service-failure', reason: 'A service failure requires independent review.',
      attempts: 1, claimedBy: '', history: [], lastOutcome: 'escalated', lastSummary: evidence,
      reviewReason: evidence, reviewedBy: '', reviewedAt: null, reviewNotes: ''
    } }
  };
}

test('transform is idempotent and injects one marker', () => {
  const once = transformCaseLifecycleV694(fixture);
  const twice = transformCaseLifecycleV694(once);
  assert.equal(twice, once);
  assert.equal((once.match(/__CALLORIA_CASE_RESOLUTION_TRANSACTION_GUARD_V694__/g) || []).length, 1);
});

test('plugin only transforms the intended case lifecycle module', () => {
  const plugin = calloriaCaseResolutionTransactionGuardPluginV694();
  const context = { error(message) { throw new Error(message); } };
  assert.equal(plugin.transform.call(context, fixture, '/repo/js/main.js'), null);
  const output = plugin.transform.call(context, fixture, '/repo/js/case-lifecycle-engine.js');
  assert.match(output.code, /__CALLORIA_CASE_RESOLUTION_TRANSACTION_GUARD_V694__/);
});

test('agent resolution without customer confirmation leaves outcome fields untouched', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const before = structuredClone(record);
  assert.throws(() => completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'resolved', customerConfirmed: false, summary: evidence }, activeClock, { now }), /Customer confirmation is required/);
  assert.equal(record.lifecycle.followUp.attempts, before.lifecycle.followUp.attempts);
  assert.equal(record.lifecycle.followUp.lastOutcome, before.lifecycle.followUp.lastOutcome);
  assert.equal(record.lifecycle.followUp.lastSummary, before.lifecycle.followUp.lastSummary);
  assert.equal(record.lifecycle.followUp.status, before.lifecycle.followUp.status);
  assert.equal(record.lifecycle.followUp.completedAt, undefined);
  assert.equal(record.status, before.status);
});

test('confirmed agent resolution still completes and records evidence', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const result = completeCaseFollowUp(record, { actor: 'Agent One', outcome: 'resolved', customerConfirmed: true, summary: evidence }, activeClock, { now });
  assert.equal(result.followUp.status, 'complete');
  assert.equal(result.followUp.attempts, 1);
  assert.equal(result.followUp.customerConfirmed, true);
  assert.equal(result.followUp.resolutionEvidence, evidence);
  assert.equal(result.caseRecord.status, 'Resolved after reopened follow-up');
});

test('supervisor closure without customer confirmation leaves review metadata untouched', async () => {
  const { reviewCaseFollowUp } = await loadTransformed();
  const record = supervisorCase();
  const before = structuredClone(record);
  assert.throws(() => reviewCaseFollowUp(record, { reviewer: 'Supervisor Two', decision: 'close_after_review', customerConfirmed: false, summary: evidence }, activeClock, { now }), /Customer confirmation is required/);
  assert.equal(record.lifecycle.followUp.status, before.lifecycle.followUp.status);
  assert.equal(record.lifecycle.followUp.reviewedBy, before.lifecycle.followUp.reviewedBy);
  assert.equal(record.lifecycle.followUp.reviewedAt, before.lifecycle.followUp.reviewedAt);
  assert.equal(record.lifecycle.followUp.reviewNotes, before.lifecycle.followUp.reviewNotes);
  assert.equal(record.lifecycle.followUp.completedAt, undefined);
  assert.equal(record.status, before.status);
});

test('independently confirmed supervisor closure still records the review', async () => {
  const { reviewCaseFollowUp } = await loadTransformed();
  const record = supervisorCase();
  const result = reviewCaseFollowUp(record, { reviewer: 'Supervisor Two', decision: 'close_after_review', customerConfirmed: true, summary: evidence }, activeClock, { now });
  assert.equal(result.followUp.status, 'complete');
  assert.equal(result.followUp.reviewedBy, 'Supervisor Two');
  assert.equal(result.followUp.customerConfirmed, true);
  assert.equal(result.caseRecord.status, 'Resolved after supervisor verification');
});

test('same-owner supervisor review remains rejected before review metadata is written', async () => {
  const { reviewCaseFollowUp } = await loadTransformed();
  const record = supervisorCase();
  assert.throws(() => reviewCaseFollowUp(record, { reviewer: 'Agent One', decision: 'return_to_agent', summary: evidence, returnTo: 'Agent One' }, activeClock, { now }), /independent of the original case owner/);
  assert.equal(record.lifecycle.followUp.reviewedBy, '');
});

test('pending-customer and escalation outcomes are not blocked by the closure guard', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const pending = agentCase();
  const pendingResult = completeCaseFollowUp(pending, { actor: 'Agent One', outcome: 'pending_customer', customerConfirmed: false, summary: evidence }, activeClock, { now });
  assert.equal(pendingResult.followUp.status, 'open');
  assert.equal(pendingResult.followUp.customerConfirmed, false);
  const escalated = agentCase();
  const escalationResult = completeCaseFollowUp(escalated, { actor: 'Agent One', outcome: 'escalated', customerConfirmed: false, summary: evidence }, activeClock, { now });
  assert.equal(escalationResult.followUp.status, 'supervisor_review');
});

test('missing source anchors fail closed instead of emitting a partial transform', () => {
  const broken = fixture.replace("  if (input.customerConfirmed !== true) throw new Error('Customer confirmation is required before closing a reopened case as resolved.');", '');
  assert.throws(() => transformCaseLifecycleV694(broken), /source rebase failed/);
});
