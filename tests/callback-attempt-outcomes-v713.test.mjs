import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { recordCallbackAttemptOutcome, alignCampaignCallbackDueAt } from '../js/callback-attempt-outcome-engine-v713.js';
import { auditCallbackIntegrity } from '../js/callback-integrity-engine-v712.js';
import { calloriaCallbackAttemptOutcomesPluginV713 } from '../build/calloria-callback-attempt-outcomes-v713-plugin.mjs';
import { calloriaCallbackIntegrityPluginV712 } from '../build/calloria-callback-integrity-v712-plugin.mjs';

const makeCallback = (patch = {}) => ({
  id: 'CBK-001', commitmentId: 'PROM-001', contactId: 'INB-001', status: 'in_progress',
  dueAt: '2026-11-22T10:00:00.000Z', attemptedAt: '2026-11-22T09:55:00.000Z', ...patch
});

test('contact reached is the only outcome that marks callback completed', () => {
  const rows = [makeCallback()];
  const result = recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'contact_reached' }, Date.parse('2026-11-22T10:01:00Z'));
  assert.equal(result.changed, true);
  assert.equal(rows[0].status, 'completed');
  assert.equal(rows[0].lastAttemptOutcome, 'contact_reached');
  assert.equal(rows[0].completedAt, '2026-11-22T10:01:00.000Z');
  assert.equal(rows[0].attemptHistory.length, 1);
});

test('no-answer attempt is recorded as failed, not completed', () => {
  const rows = [makeCallback()];
  recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'no_answer' }, Date.parse('2026-11-22T10:02:00Z'));
  assert.equal(rows[0].status, 'attempt_failed');
  assert.equal(rows[0].completedAt, null);
  assert.equal(rows[0].failedAt, '2026-11-22T10:02:00.000Z');
  assert.equal(rows[0].lastAttemptOutcome, 'no_answer');
});

test('busy and voicemail outcomes remain retry/audit evidence', () => {
  for (const outcome of ['busy', 'voicemail']) {
    const rows = [makeCallback()];
    recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome }, Date.now());
    assert.equal(rows[0].status, 'attempt_failed');
    assert.equal(rows[0].lastAttemptOutcome, outcome);
  }
});

test('inbound callback returned to queue remains an active queued task', () => {
  const rows = [makeCallback()];
  recordCallbackAttemptOutcome(rows, { contactId: 'INB-001', outcome: 'returned_to_queue' }, Date.parse('2026-11-22T10:03:00Z'));
  assert.equal(rows[0].status, 'queued');
  assert.equal(rows[0].queuedAt, '2026-11-22T10:03:00.000Z');
  assert.equal(rows[0].completedAt, null);
});

test('cancellation before contact and interruption after connection are not completions', () => {
  for (const outcome of ['cancelled_before_contact', 'interrupted_after_connection']) {
    const rows = [makeCallback()];
    recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome }, Date.now());
    assert.equal(rows[0].status, 'attempt_failed');
    assert.equal(rows[0].completedAt, null);
    assert.equal(rows[0].lastAttemptOutcome, outcome);
  }
});

test('finalisation is idempotent and cannot rewrite a non-active callback', () => {
  const rows = [makeCallback()];
  const first = recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'no_answer' }, 1000);
  const snapshot = structuredClone(rows[0]);
  const second = recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'contact_reached' }, 2000);
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.deepEqual(rows[0], snapshot);
});

test('a missing or non-active callback is not mutated', () => {
  const rows = [makeCallback({ status: 'scheduled' })];
  const result = recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'contact_reached' }, Date.now());
  assert.equal(result.changed, false);
  assert.equal(rows[0].status, 'scheduled');
});

test('rejects invalid outcome, missing identity and invalid timestamp', () => {
  assert.throws(() => recordCallbackAttemptOutcome([], { outcome: 'maybe' }), /Unsupported/);
  assert.throws(() => recordCallbackAttemptOutcome([], { outcome: 'contact_reached' }), /ID/);
  assert.throws(() => recordCallbackAttemptOutcome([makeCallback()], { callbackId: 'CBK-001' }, 'not-a-date'), /timestamp/);
});

test('attempt history is bounded and sanitised', () => {
  const rows = [makeCallback({ attemptHistory: Array.from({ length: 12 }, (_, i) => ({ outcome: `old-${i}` })) })];
  recordCallbackAttemptOutcome(rows, { callbackId: 'CBK-001', outcome: 'cancelled_before_contact', reason: '<unsafe>\nreason' }, Date.now());
  assert.equal(rows[0].attemptHistory.length, 12);
  assert.equal(rows[0].attemptHistory.at(-1).reason, 'unsafe reason');
});

test('campaign retry timestamp aligns to the formal callback promise', () => {
  const callback = { dueAt: '2026-11-22T11:15:00.000Z' };
  const workItem = { status: 'review_required', nextEligibleAt: 'old', callbackDueAt: 'old' };
  assert.equal(alignCampaignCallbackDueAt(callback, workItem), true);
  assert.equal(workItem.status, 'callback_scheduled');
  assert.equal(workItem.callbackDueAt, callback.dueAt);
  assert.equal(workItem.nextEligibleAt, null);
  assert.equal(alignCampaignCallbackDueAt(callback, workItem), false);
  assert.equal(alignCampaignCallbackDueAt({}, workItem), false);
});

test('v7.12 integrity audit recognises attempt_failed as terminal evidence', () => {
  const result = auditCallbackIntegrity({ commitments: [{ id: 'PROM-001', status: 'Open', customerName: 'A. Customer', owner: 'Agent', dueDate: '2026-11-22', dueMinutes: 600 }] }, [makeCallback({ status: 'attempt_failed' })]);
  assert.equal(result.summary.missingTasks, 1);
  assert.match(result.issues[0].detail, /Only terminal callback attempts remain/);
});

function runPlugin(plugin, source, id) {
  const warnings = [];
  const context = { warn: message => warnings.push(message), error: message => { throw new Error(message); } };
  return { result: plugin.transform.call(context, source, id), warnings };
}

const mainFixture = [
  'function renderPromiseControl(){',
  ' const dashboard=PromiseControlEngine.buildPortfolio(commitmentStore(),commitmentShiftSnapshot(),state.callbacks,state.supervisorRequests);',
  ' const metrics=dashboard.metrics;',
  ' viewRoot.innerHTML=`',
  '     <div class=\"ops-summary-grid promise-control-metrics\">',
  '     `;',
  '}',
  'function saveInboundWrapUp(){completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());}',
  'function saveOutboundWrapUp(){const noConnectOutcome=[\'no_answer\',\'busy\',\'voicemail\'].includes(wrap.connectionOutcome);completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());}',
  'function returnCallToQueue(){state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState(\'available\',\'Contact returned to queue\');}',
  'function cancelOutbound(){const active=state.activeOutbound;if(!active)return;const workItem=findCampaignContact(state.outboundWorklist,active.campaignContactId);if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status=\'completed\';}}',
  'function scheduleRetryForCommitment(item,source){const callback=createCallbackRecordFromCommitment(item,retrySource);if(callback.type===\'outbound\'){const workItem=findCampaignContact(state.outboundWorklist,callback.campaignContactId);if(workItem){workItem.status=\'callback_scheduled\';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();}}}'
].join('\n');

test('Vite transform applies every callback integrity repair exactly once', () => {
  const v712 = runPlugin(calloriaCallbackIntegrityPluginV712(), mainFixture, '/repo/js/main.js');
  assert.ok(v712.result?.code);
  const v713 = runPlugin(calloriaCallbackAttemptOutcomesPluginV713(), v712.result.code, '/repo/js/main.js');
  assert.ok(v713.result?.code);
  assert.match(v713.result.code, /CALLORIA_CALLBACK_ATTEMPT_OUTCOMES_V713/);
  assert.match(v713.result.code, /outcome:noConnectOutcome\?wrap\.connectionOutcome:'contact_reached'/);
  assert.match(v713.result.code, /outcome:'returned_to_queue'/);
  assert.match(v713.result.code, /outcome:active\.connectionOutcome==='answered'\?'interrupted_after_connection':'cancelled_before_contact'/);
  assert.match(v713.result.code, /workItem\.callbackDueAt=callback\.dueAt/);
  assert.doesNotMatch(v713.result.code, /callback\.status='completed'/);
});

test('combined v7.12 and v7.13 transformed fixture passes Node syntax validation', async () => {
  const v712 = runPlugin(calloriaCallbackIntegrityPluginV712(), mainFixture, '/repo/js/main.js').result;
  const v713 = runPlugin(calloriaCallbackAttemptOutcomesPluginV713(), v712.code, '/repo/js/main.js').result;
  const directory = await mkdtemp(join(tmpdir(), 'calloria-v713-syntax-'));
  const file = join(directory, 'transformed-main.mjs');
  try {
    await writeFile(file, v713.code, 'utf8');
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Vite transform is idempotent', () => {
  const first = runPlugin(calloriaCallbackAttemptOutcomesPluginV713(), mainFixture, '/repo/js/main.js').result;
  const second = runPlugin(calloriaCallbackAttemptOutcomesPluginV713(), first.code, '/repo/js/main.js').result;
  assert.equal(second, null);
});

test('Vite transform skips safely when any required source anchor drifts', () => {
  const broken = mainFixture.replace("if(callback)callback.status='completed';", "if(callback)callback.status='done';");
  const { result, warnings } = runPlugin(calloriaCallbackAttemptOutcomesPluginV713(), broken, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /No partial transform was applied/);
});

test('the v7.12 terminal-status set includes the new failed-attempt status', async () => {
  const source = await readFile(new URL('../js/callback-integrity-engine-v712.js', import.meta.url), 'utf8');
  assert.match(source, /'attempt_failed'/);
});
