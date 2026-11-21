import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  transformCaseLifecycleV695,
  calloriaCaseSlaClockAccuracyPluginV695
} from '../build/calloria-case-sla-clock-accuracy-v6-95.mjs';

const fixture = await readFile(new URL('./fixtures/case-lifecycle-before-v694.mjs', import.meta.url), 'utf8');
const now = new Date('2026-11-21T12:00:00.000Z');
const evidence = 'Checked the service record, confirmed the next step with the customer and documented the expected response window.';
const activeClock = (day, minutes) => ({ day, minutes, active: true });

function agentCase() {
  return {
    reference: 'CASE-SLA-95', status: 'Reopened · follow-up in progress', owner: 'Agent One',
    lifecycle: { version: '6.71.0', reopenCount: 1, history: [], followUp: {
      id: 'CFU-CASE-SLA-95-1', status: 'in_progress', priority: 'normal', dueDay: 3, dueMinute: 720,
      owner: 'Agent One', openedBy: 'Agent One', reasonCategory: 'customer-says-unresolved',
      reason: 'Customer reports the issue is still unresolved.', attempts: 0, claimedBy: 'Agent One',
      claimedAt: now.toISOString(), history: [], lastOutcome: '', lastSummary: ''
    } }
  };
}

async function loadTransformed() {
  const transformed = transformCaseLifecycleV695(fixture);
  const url = `data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`;
  return import(url);
}

test('v6.95 composes the v6.94 transactional guard and is idempotent', () => {
  const once = transformCaseLifecycleV695(fixture);
  const twice = transformCaseLifecycleV695(once);
  assert.equal(twice, once);
  assert.match(once, /__CALLORIA_CASE_RESOLUTION_TRANSACTION_GUARD_V694__/);
  assert.match(once, /__CALLORIA_CASE_SLA_CLOCK_ACCURACY_V695__/);
  assert.equal((once.match(/__CALLORIA_CASE_SLA_CLOCK_ACCURACY_V695__/g) || []).length, 1);
});

test('Vite plugin transforms only the case lifecycle module', () => {
  const plugin = calloriaCaseSlaClockAccuracyPluginV695();
  const context = { error(message) { throw new Error(message); } };
  assert.equal(plugin.transform.call(context, fixture, '/repo/js/main.js'), null);
  const queriedOutput = plugin.transform.call(context, fixture, '/repo/js/case-lifecycle-engine.js?import');
  assert.match(queriedOutput.code, /__CALLORIA_CASE_SLA_CLOCK_ACCURACY_V695__/);
  const output = plugin.transform.call(context, fixture, '/repo/js/case-lifecycle-engine.js');
  assert.match(output.code, /__CALLORIA_CASE_SLA_CLOCK_ACCURACY_V695__/);
});

test('pending-customer deadline is consistently next simulated day at 10:00 after an early shift contact', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'pending_customer', customerConfirmed: false, summary: evidence
  }, activeClock(3, 540), { now });
  assert.deepEqual(result.due, { day: 4, minutes: 600 });
  assert.equal(result.followUp.dueDay, 4);
  assert.equal(result.followUp.dueMinute, 600);
});

test('pending-customer deadline does not drift when completed late in the simulated day', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'pending_customer', customerConfirmed: false, summary: evidence
  }, activeClock(3, 1380), { now });
  assert.deepEqual(result.due, { day: 4, minutes: 600 });
  assert.equal(result.followUp.dueDay, 4);
  assert.equal(result.followUp.dueMinute, 600);
});

test('pending-customer deadline and history carry the same due day and clock', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'pending_customer', customerConfirmed: false, summary: evidence
  }, activeClock(8, 1100), { now });
  const event = result.followUp.history[0];
  assert.equal(event.dueDay, result.due.day);
  assert.equal(event.dueMinute, result.due.minutes);
  assert.equal(result.followUp.dueMinute, event.dueMinute);
});

test('confirmed resolution remains protected by the v6.94 guard without partial mutation', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const before = structuredClone(record);
  assert.throws(() => completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'resolved', customerConfirmed: false, summary: evidence
  }, activeClock(3, 600), { now }), /Customer confirmation is required/);
  assert.equal(record.lifecycle.followUp.attempts, before.lifecycle.followUp.attempts);
  assert.equal(record.lifecycle.followUp.lastOutcome, before.lifecycle.followUp.lastOutcome);
  assert.equal(record.lifecycle.followUp.lastSummary, before.lifecycle.followUp.lastSummary);
  assert.equal(record.lifecycle.followUp.status, before.lifecycle.followUp.status);
  assert.equal(record.status, before.status);
});

test('escalation remains unaffected by the due-time correction', async () => {
  const { completeCaseFollowUp } = await loadTransformed();
  const record = agentCase();
  const result = completeCaseFollowUp(record, {
    actor: 'Agent One', outcome: 'escalated', customerConfirmed: false, summary: evidence
  }, activeClock(3, 600), { now });
  assert.equal(result.followUp.status, 'supervisor_review');
  assert.equal(result.outcome, 'escalated');
});

test('source anchor drift fails closed without returning a partial transform', () => {
  const broken = fixture.replace('    followUp.dueMinute = 600;', '    followUp.dueMinute = 630;');
  assert.throws(() => transformCaseLifecycleV695(broken), /pending-customer SLA due-time calculation/);
});
