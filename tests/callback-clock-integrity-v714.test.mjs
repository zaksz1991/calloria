import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  CALLBACK_OUTCOMES_V714,
  recordCallbackAttemptOutcomeV714,
  alignCallbackWorkItemToPromise
} from '../js/callback-attempt-outcome-engine-v714.js';
import {
  transformCalloriaMainV714,
  transformCampaignOperationsV714
} from '../build/calloria-simulated-callback-clock-v714-plugin.mjs';

const MAIN_FIXTURE = `
function completeInbound(contact){ completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now()); }
function completeOutbound(active,wrap,noConnectOutcome){ completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now()); }
function returnCallToQueue(contact){ state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue'); }
function cancelOutbound(){ const active=state.activeOutbound; const workItem=findCampaignContact(state.outboundWorklist,active.campaignContactId); if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='completed';} }
function retryCommitment(item,source){ const callback=createCallbackRecordFromCommitment(item,source); if(callback.type==='outbound'){ const workItem=findCampaignContact(state.outboundWorklist,callback.campaignContactId); if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();} } }
function resumeOutboundCallback(callbackId){
 const callback=state.callbacks.find(item=>item.id===callbackId&&item.type==='outbound'&&item.status==='scheduled');
 const workItem=findCampaignContact(state.outboundWorklist,callback.campaignContactId);
 if(workItem.status==='ready'&&workItem.attempts>0){workItem.status='callback_scheduled';workItem.callbackDueAt=new Date(Date.now()-1000).toISOString();}
 if(workItem.status==='callback_scheduled')workItem.callbackDueAt=new Date(Date.now()-1000).toISOString();
 callback.campaignContactId=workItem.id;
 callback.status='in_progress';callback.attemptedAt=new Date().toISOString();
 startOutbound(callback.campaignId,workItem.id,callbackId);
}
function startOutbound(id,contactId,callbackId=null){
 try{
 started=startCampaignContact(worklist,contact.id,{attemptId,agentName:state.applicantName||'Customer Experience Agent',now:Date.now(),suppressed,shiftOpen:shiftTimeAvailable(),agentAvailable:state.agentStatus==='available'});
 }catch(error){toast(error.message||'The campaign contact could not be started.','warning');return;}
}
function saveWrapUp(disposition,callbackDueISO,worklistCallbackDueISO,createdCommitment,wrap,task,workItem,active,outboundOutcome){
 worklistCallbackDueISO=new Date(Date.now()+60_000).toISOString();
 finishCampaignContact(state.outboundWorklist,workItem.id,{
  attemptId:active.attemptId,
  outcome:outboundOutcome,
  now:Date.now(),
  callbackDueAt:worklistCallbackDueISO
 });
 createCallbackRecordFromCommitment(createdCommitment,{type:'outbound',contactId:wrap.contactId,campaignContactId:workItem.id,customer:task.customer,campaignId:task.id,issue:task.title});
 workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=worklistCallbackDueISO;
}
`;

const CAMPAIGN_FIXTURE = `
export function campaignContactEligibility(contact, {
  now = Date.now(),
  suppressed = false,
  shiftOpen = true,
  agentAvailable = true,
} = {}) {
  const dueAt = contact.status === 'callback_scheduled' ? contact.callbackDueAt : contact.nextEligibleAt;
  const due = !dueAt || Date.parse(dueAt) <= Number(now);
  return due;
}
export function startCampaignContact(worklist, contactId, {
  attemptId,
  agentName = 'Customer Experience Agent',
  now = Date.now(),
  suppressed = false,
  shiftOpen = true,
  agentAvailable = true,
} = {}) {
  const contact = worklist.find(row => row.id === contactId);
  const eligibility = campaignContactEligibility(contact, { now, suppressed, shiftOpen, agentAvailable });
  return eligibility;
}
export function finishCampaignContact(worklist, contactId, {
  attemptId,
  outcome,
  now = Date.now(),
  callbackDueAt = null,
} = {}) {
  if (!callbackDueAt || Date.parse(callbackDueAt) <= Number(now)) throw new RangeError('A customer-requested callback must have a valid future date and time.');
  return true;
}
`;

function syntaxCheck(source, filename) {
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v714-'));
  const path = join(dir, filename);
  try {
    writeFileSync(path, source);
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('outcome catalogue is explicit and bounded', () => {
  assert.deepEqual(CALLBACK_OUTCOMES_V714, [
    'contact_reached','no_answer','busy','voicemail',
    'cancelled_before_contact','interrupted_after_connection','returned_to_queue'
  ]);
});

test('only verified customer contact completes an active callback', () => {
  const callbacks = [{ id: 'CB-1', contactId: 'IN-1', status: 'in_progress', attemptedAt: '2026-11-22T08:00:00.000Z' }];
  const result = recordCallbackAttemptOutcomeV714(callbacks, { callbackId: 'CB-1', outcome: 'contact_reached' }, Date.parse('2026-11-22T08:05:00.000Z'));
  assert.equal(result.changed, true);
  assert.equal(callbacks[0].status, 'completed');
  assert.equal(callbacks[0].attemptHistory[0].outcome, 'contact_reached');
  assert.equal(callbacks[0].completedAt, '2026-11-22T08:05:00.000Z');
});

test('no-answer/busy/voicemail and interrupted attempts never fulfil a promise', () => {
  for (const outcome of ['no_answer','busy','voicemail','cancelled_before_contact','interrupted_after_connection']) {
    const callbacks = [{ id: `CB-${outcome}`, contactId: 'IN-2', status: 'in_progress' }];
    const result = recordCallbackAttemptOutcomeV714(callbacks, { callbackId: `CB-${outcome}`, outcome }, 1000);
    assert.equal(result.resultingStatus, 'attempt_failed');
    assert.equal(callbacks[0].status, 'attempt_failed');
    assert.equal(callbacks[0].completedAt, null);
  }
});

test('returned-to-queue remains queued, and duplicate finalisation is a no-op', () => {
  const callbacks = [{ id: 'CB-3', contactId: 'IN-3', status: 'in_progress' }];
  const first = recordCallbackAttemptOutcomeV714(callbacks, { callbackId: 'CB-3', outcome: 'returned_to_queue' }, 2000);
  const second = recordCallbackAttemptOutcomeV714(callbacks, { callbackId: 'CB-3', outcome: 'contact_reached' }, 3000);
  assert.equal(first.resultingStatus, 'queued');
  assert.equal(callbacks[0].status, 'queued');
  assert.equal(second.changed, false);
  assert.equal(callbacks[0].attemptHistory.length, 1);
});

test('rejects invalid outcome and requires an identifier', () => {
  assert.throws(() => recordCallbackAttemptOutcomeV714([], { outcome: 'done' }), /Unsupported/);
  assert.throws(() => recordCallbackAttemptOutcomeV714([], { outcome: 'contact_reached' }), /callback ID or contact ID/);
});

test('promise and campaign work item keep one canonical due timestamp', () => {
  const callback = { dueAt: '2026-11-23T09:30:00.000Z' };
  const workItem = { status: 'retry_wait', callbackDueAt: '2026-11-22T09:30:00.000Z', nextEligibleAt: 'later' };
  const first = alignCallbackWorkItemToPromise(callback, workItem);
  assert.equal(first.changed, true);
  assert.equal(workItem.status, 'callback_scheduled');
  assert.equal(workItem.callbackDueAt, callback.dueAt);
  assert.equal(workItem.nextEligibleAt, null);
  assert.equal(alignCallbackWorkItemToPromise(callback, workItem).changed, false);
});

test('main transform removes wall-clock callback backdating and preserves the promise time', () => {
  const result = transformCalloriaMainV714(MAIN_FIXTURE);
  assert.equal(result.changed, true, result.error);
  assert.match(result.code, /worklistCallbackDueISO=callbackDueISO/);
  assert.match(result.code, /callbackPrevalidated:Boolean\(callbackId\)/);
  assert.match(result.code, /workItem\.callbackDueAt=new Date\(promiseDue\)\.toISOString\(\)/);
  assert.match(result.code, /callbackDueAt:worklistCallbackDueISO,\s*callbackPrevalidated:disposition==='callback'/);
  assert.match(result.code, /scheduledOutboundCallback\.dueAt/);
  assert.doesNotMatch(result.code, /Date\.now\(\)-1000/);
  assert.doesNotMatch(result.code, /callback\)callback\.status='completed'/);
  syntaxCheck(result.code, 'main-fixture.mjs');
});

test('main transform is idempotent', () => {
  const once = transformCalloriaMainV714(MAIN_FIXTURE);
  const twice = transformCalloriaMainV714(once.code);
  assert.equal(twice.changed, false);
  assert.equal(twice.alreadyPatched, true);
  assert.equal(twice.code, once.code);
});

test('main transform refuses a drifted source without partial changes', () => {
  const result = transformCalloriaMainV714(MAIN_FIXTURE.replace('callback.status=\'completed\'', 'callback.status=\'done\''));
  assert.equal(result.changed, false);
  assert.match(result.error, /cancelled outbound callback=0/);
  assert.equal(result.code.includes('__CALLORIA_SIMULATED_CALLBACK_CLOCK_V714__'), false);
});

test('main transform supports a v7.13 callback-attempt transform already installed', () => {
  const v713 = MAIN_FIXTURE
    .replace('completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());', "recordCallbackAttemptOutcome(state.callbacks,{contactId:contact.id,outcome:'contact_reached'},Date.now());")
    .replace('completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());', "recordCallbackAttemptOutcome(state.callbacks,{callbackId:active.callbackId,outcome:'contact_reached'},Date.now());")
    .replace("state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');", "recordCallbackAttemptOutcome(state.callbacks,{contactId:contact.id,outcome:'returned_to_queue'},Date.now());state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');")
    .replace("if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='completed';}", "recordCallbackAttemptOutcome(state.callbacks,{callbackId:active.callbackId,outcome:'interrupted_after_connection'},Date.now());")
    .replace("if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();}", "if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=callback.dueAt;}")
    .replace('function completeInbound', '/* __CALLORIA_CALLBACK_ATTEMPT_OUTCOMES_V713__ */\nfunction completeInbound');
  const result = transformCalloriaMainV714(v713);
  assert.equal(result.changed, true, result.error);
  assert.doesNotMatch(result.code, /Date\.now\(\)-1000/);
  assert.match(result.code, /worklistCallbackDueISO=callbackDueISO/);
  syntaxCheck(result.code, 'main-v713-fixture.mjs');
});

test('campaign engine supports an explicit simulated-clock prevalidation flag', () => {
  const result = transformCampaignOperationsV714(CAMPAIGN_FIXTURE);
  assert.equal(result.changed, true, result.error);
  assert.equal((result.code.match(/callbackPrevalidated = false/g) || []).length, 3);
  assert.match(result.code, /callbackPrevalidated && contact\.status === 'callback_scheduled'/);
  assert.match(result.code, /agentAvailable, callbackPrevalidated/);
  assert.match(result.code, /!callbackPrevalidated && Date\.parse\(callbackDueAt\) <= Number\(now\)/);
  syntaxCheck(result.code, 'campaign-fixture.mjs');
});

test('campaign transform is idempotent and refuses changed source anchors', () => {
  const once = transformCampaignOperationsV714(CAMPAIGN_FIXTURE);
  const twice = transformCampaignOperationsV714(once.code);
  assert.equal(twice.changed, false);
  assert.equal(twice.alreadyPatched, true);
  const drifted = transformCampaignOperationsV714(CAMPAIGN_FIXTURE.replace('agentAvailable = true', 'agentAvailable = false'));
  assert.equal(drifted.changed, false);
  assert.match(drifted.error, /campaign engine anchors/);
});


test('simulated due-time prevalidation bypasses wall clock only for promise callbacks', async () => {
  const transformed = transformCampaignOperationsV714(CAMPAIGN_FIXTURE);
  assert.equal(transformed.changed, true, transformed.error);
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v714-runtime-'));
  const file = join(dir, 'campaign-runtime-fixture.mjs');
  try {
    writeFileSync(file, transformed.code);
    const engine = await import(pathToFileURL(file).href);
    const futureCallback = { status: 'callback_scheduled', callbackDueAt: '2099-01-01T00:00:00.000Z' };
    assert.equal(engine.campaignContactEligibility(futureCallback, { now: 1000, callbackPrevalidated: true }), true);
    assert.equal(engine.campaignContactEligibility(futureCallback, { now: 1000, callbackPrevalidated: false }), false);
    const futureOrdinaryRetry = { status: 'retry_wait', nextEligibleAt: '2099-01-01T00:00:00.000Z' };
    assert.equal(engine.campaignContactEligibility(futureOrdinaryRetry, { now: 1000, callbackPrevalidated: true }), false);
    assert.equal(engine.finishCampaignContact([], 'x', { callbackDueAt: '2020-01-01T00:00:00.000Z', callbackPrevalidated: true, now: Date.parse('2021-01-01T00:00:00.000Z') }), true);
    assert.throws(() => engine.finishCampaignContact([], 'x', { callbackDueAt: '2020-01-01T00:00:00.000Z', callbackPrevalidated: false, now: Date.parse('2021-01-01T00:00:00.000Z') }), /valid future date/);
    assert.throws(() => engine.finishCampaignContact([], 'x', { callbackDueAt: 'not-a-date', callbackPrevalidated: true, now: 5000 }), /valid future date/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
