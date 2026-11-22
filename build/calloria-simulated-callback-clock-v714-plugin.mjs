/**
 * CALLORIA v7.14 — align callback eligibility with the simulated shift clock.
 * Source-aware Vite post-transform. Strictly validates the current source shape.
 */
const MAIN_MARKER = '__CALLORIA_SIMULATED_CALLBACK_CLOCK_V714__';
const ENGINE_MARKER = '__CALLORIA_CAMPAIGN_CALLBACK_CLOCK_V714__';
const count = (source, needle) => source.split(needle).length - 1;

const MAIN_LIFECYCLE_PATCHES = [
  {
    name: 'inbound callback completion',
    needle: 'completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());',
    replacement: "recordCallbackAttemptOutcomeV714(state.callbacks,{contactId:contact.id,outcome:'contact_reached',reason:'Inbound customer interaction completed.'},Date.now());"
  },
  {
    name: 'outbound callback completion',
    needle: 'completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());',
    replacement: "recordCallbackAttemptOutcomeV714(state.callbacks,{callbackId:active.callbackId,outcome:noConnectOutcome?wrap.connectionOutcome:'contact_reached',reason:noConnectOutcome?'Outbound dial did not reach the customer.':'Outbound customer interaction completed.'},Date.now());"
  },
  {
    name: 'inbound callback returned to queue',
    needle: "state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');",
    replacement: "recordCallbackAttemptOutcomeV714(state.callbacks,{contactId:contact.id,outcome:'returned_to_queue',reason:'The active callback was returned to the inbound queue without fulfilling the promise.'},Date.now());state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');"
  },
  {
    name: 'cancelled outbound callback',
    needle: "if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='completed';}",
    replacement: "if(active.callbackId){recordCallbackAttemptOutcomeV714(state.callbacks,{callbackId:active.callbackId,outcome:active.connectionOutcome==='answered'?'interrupted_after_connection':'cancelled_before_contact',reason:'The outbound attempt ended before a verified after-contact outcome.'},Date.now());if(active.commitmentId&&!state.supervisorRequests.some(item=>item.commitmentId===active.commitmentId&&item.status==='open')){state.supervisorRequests.push({id:makeCallReference('SUP'),commitmentId:active.commitmentId,contactId:active.attemptId||active.campaignContactId,reference:active.attemptId||active.campaignContactId,customer:workItem?.customer||active.contactSnapshot?.customer||'Customer',reason:'The promised callback was interrupted before a verified customer outcome. Independent review is required; the promise remains open.',status:'open',createdAt:new Date().toISOString(),channel:'Callback attempt integrity'});}}"
  }
];

const MAIN_CLOCK_PATCHES = [
  {
    name: 'retry worklist promise timestamp',
    needle: "if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();}",
    replacement: "if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=callback.dueAt;}"
  },
  {
    name: 'commitment-based worklist due time',
    needle: 'worklistCallbackDueISO=new Date(Date.now()+60_000).toISOString();',
    replacement: 'worklistCallbackDueISO=callbackDueISO;'
  },
];

const CAMPAIGN_SIGNATURE = 'agentAvailable = true,\n} = {}) {';
const CAMPAIGN_DUE = 'const due = !dueAt || Date.parse(dueAt) <= Number(now);';
const CAMPAIGN_ELIGIBILITY_CALL = 'campaignContactEligibility(contact, { now, suppressed, shiftOpen, agentAvailable });';
const FINISH_SIGNATURE = 'callbackDueAt = null,\n} = {}) {';
const FINISH_DUE_CHECK = "if (!callbackDueAt || Date.parse(callbackDueAt) <= Number(now)) throw new RangeError('A customer-requested callback must have a valid future date and time.');";

export function transformCalloriaMainV714(source) {
  if (source.includes(MAIN_MARKER)) return { code: source, changed: false, alreadyPatched: true };
  let code = source;
  const hasV713 = code.includes('__CALLORIA_CALLBACK_ATTEMPT_OUTCOMES_V713__');

  if (!hasV713) {
    const missing = MAIN_LIFECYCLE_PATCHES.filter(item => count(code, item.needle) !== 1);
    if (missing.length) return { code: source, changed: false, error: `lifecycle anchors: ${missing.map(item => `${item.name}=${count(code, item.needle)}`).join(', ')}` };
    for (const item of MAIN_LIFECYCLE_PATCHES) code = code.replace(item.needle, item.replacement);
    code = `import { recordCallbackAttemptOutcomeV714 } from './callback-attempt-outcome-engine-v714.js';\n${code}`;
  }

  for (const item of MAIN_CLOCK_PATCHES) {
    if (count(code, item.replacement) === 1) continue; // v7.14 or a compatible earlier patch already did this.
    if (count(code, item.needle) !== 1) {
      return { code: source, changed: false, error: `${item.name}=${count(code, item.needle)} (expected 1)` };
    }
    code = code.replace(item.needle, item.replacement);
  }

  const resumePattern = /^([ \t]*)if\(workItem\.status==='ready'&&workItem\.attempts>0\)\{workItem\.status='callback_scheduled';workItem\.callbackDueAt=new Date\(Date\.now\(\)-1000\)\.toISOString\(\);\}\s*\n\s*if\(workItem\.status==='callback_scheduled'\)workItem\.callbackDueAt=new Date\(Date\.now\(\)-1000\)\.toISOString\(\);\s*\n\s*callback\.campaignContactId=workItem\.id;\s*\n\s*callback\.status='in_progress';callback\.attemptedAt=new Date\(\)\.toISOString\(\);\s*\n\s*startOutbound\(callback\.campaignId,workItem\.id,callbackId\);/gm;
  const startOutboundPattern = /agentAvailable:state\.agentStatus==='available'\}\);\s*\n([ \t]*)\}catch\(error\)\{toast\(error\.message\|\|'The campaign contact could not be started\.'/g;
  const resumeMatches = [...code.matchAll(resumePattern)];
  const resumeReplacement = (indent) => `${indent}if(!['ready','retry_wait','callback_scheduled'].includes(workItem.status)){toast('This campaign contact is not eligible for a callback attempt.','warning');return;}\n${indent}workItem.status='callback_scheduled';\n${indent}if(callback.dueAt){const promiseDue=Date.parse(callback.dueAt);if(!Number.isFinite(promiseDue)){toast('The agreed callback time is invalid. The customer promise was not changed.','error');return;}workItem.callbackDueAt=new Date(promiseDue).toISOString();}\n${indent}else if(!workItem.callbackDueAt){toast('The agreed callback time is missing. The customer promise was not changed.','error');return;}\n${indent}workItem.nextEligibleAt=null;\n${indent}callback.campaignContactId=workItem.id;\n${indent}startOutbound(callback.campaignId,workItem.id,callbackId);`;
  const alreadyClockSafe = code.includes("if(callback.dueAt){const promiseDue=Date.parse(callback.dueAt)") && !code.includes('Date.now()-1000');
  if (resumeMatches.length === 1) code = code.replace(resumePattern, (_, indent) => resumeReplacement(indent));
  else if (!(resumeMatches.length === 0 && alreadyClockSafe)) {
    return { code: source, changed: false, error: `callback resume without wall-clock backdating=${resumeMatches.length} (expected 1)` };
  }

  const outboundCallbackPattern = /^([ \t]*)createCallbackRecordFromCommitment\(createdCommitment,\{type:'outbound',contactId:wrap\.contactId,campaignContactId:workItem\.id,customer:task\.customer,campaignId:task\.id,issue:task\.title\}\);\s*\n[ \t]*workItem\.status='callback_scheduled';workItem\.nextEligibleAt=null;workItem\.callbackDueAt=worklistCallbackDueISO;/gm;
  const outboundCallbackMatches = [...code.matchAll(outboundCallbackPattern)];
  const outboundCallbackAlreadyAligned = code.includes('workItem.callbackDueAt=scheduledOutboundCallback.dueAt;');
  if (outboundCallbackMatches.length === 1) {
    code = code.replace(outboundCallbackPattern, (_, indent) => `${indent}const scheduledOutboundCallback=createCallbackRecordFromCommitment(createdCommitment,{type:'outbound',contactId:wrap.contactId,campaignContactId:workItem.id,customer:task.customer,campaignId:task.id,issue:task.title});\n${indent}workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=scheduledOutboundCallback.dueAt;`);
  } else if (!(outboundCallbackMatches.length === 0 && outboundCallbackAlreadyAligned)) {
    return { code: source, changed: false, error: `outbound callback task linked to commitment due time=${outboundCallbackMatches.length} (expected 1)` };
  }

  const finishCallbackDuePattern = /callbackDueAt:worklistCallbackDueISO\s*\n([ \t]*)\}\);/g;
  const finishCallbackDueMatches = [...code.matchAll(finishCallbackDuePattern)];
  const finishAlreadyPrevalidated = code.includes("callbackPrevalidated:disposition==='callback'");
  if (finishCallbackDueMatches.length === 1) {
    code = code.replace(finishCallbackDuePattern, (_, indent) => `callbackDueAt:worklistCallbackDueISO,\n${indent}callbackPrevalidated:disposition==='callback'\n${indent}});`);
  } else if (!(finishCallbackDueMatches.length === 0 && finishAlreadyPrevalidated)) {
    return { code: source, changed: false, error: `promise-aware campaign callback completion=${finishCallbackDueMatches.length} (expected 1)` };
  }

  const startMatches = [...code.matchAll(startOutboundPattern)];
  const alreadyPrevalidated = /callbackPrevalidated:Boolean\(callbackId\)/.test(code);
  if (startMatches.length === 1) code = code.replace(startOutboundPattern, "agentAvailable:state.agentStatus==='available',callbackPrevalidated:Boolean(callbackId)});\n$1}catch(error){toast(error.message||'The campaign contact could not be started.'");
  else if (!(startMatches.length === 0 && alreadyPrevalidated)) {
    return { code: source, changed: false, error: `callback-prevalidated outbound start=${startMatches.length} (expected 1)` };
  }

  return { code: `/* ${MAIN_MARKER} */\n${code}`, changed: true, alreadyPatched: false };
}

export function transformCampaignOperationsV714(source) {
  if (source.includes(ENGINE_MARKER)) return { code: source, changed: false, alreadyPatched: true };
  const signatureCount = count(source, CAMPAIGN_SIGNATURE);
  const finishSignatureCount = count(source, FINISH_SIGNATURE);
  const dueCount = count(source, CAMPAIGN_DUE);
  const eligibilityCount = count(source, CAMPAIGN_ELIGIBILITY_CALL);
  const finishDueCount = count(source, FINISH_DUE_CHECK);
  if (signatureCount !== 2 || finishSignatureCount !== 1 || dueCount !== 1 || eligibilityCount !== 1 || finishDueCount !== 1) {
    return {
      code: source,
      changed: false,
      error: `campaign engine anchors: option-signatures=${signatureCount}/2, finish-signature=${finishSignatureCount}/1, callback-due-check=${dueCount}/1, eligibility-call=${eligibilityCount}/1, finish-future-check=${finishDueCount}/1`
    };
  }

  let code = source
    .replaceAll(CAMPAIGN_SIGNATURE, 'agentAvailable = true,\n  callbackPrevalidated = false,\n} = {}) {')
    .replace(CAMPAIGN_DUE, "const due = (callbackPrevalidated && contact.status === 'callback_scheduled') || !dueAt || Date.parse(dueAt) <= Number(now);")
    .replace(CAMPAIGN_ELIGIBILITY_CALL, 'campaignContactEligibility(contact, { now, suppressed, shiftOpen, agentAvailable, callbackPrevalidated });')
    .replace(FINISH_SIGNATURE, 'callbackDueAt = null,\n  callbackPrevalidated = false,\n} = {}) {')
    .replace(FINISH_DUE_CHECK, "if (!callbackDueAt || !Number.isFinite(Date.parse(callbackDueAt)) || (!callbackPrevalidated && Date.parse(callbackDueAt) <= Number(now))) throw new RangeError('A customer-requested callback must have a valid future date and time.');");
  return { code: `/* ${ENGINE_MARKER} */\n${code}`, changed: true, alreadyPatched: false };
}

export function calloriaSimulatedCallbackClockV714Plugin() {
  return {
    name: 'calloria-simulated-callback-clock-v7-14',
    enforce: 'post',
    transform(source, id) {
      if (/[/\\]js[/\\]main\.js(?:\?.*)?$/.test(id)) {
        const result = transformCalloriaMainV714(source);
        if (result.error) {
          this.error(`[${this.name}] main.js transform refused: ${result.error}. No partial main.js transform was applied.`);
        }
        return result.changed ? { code: result.code, map: null } : null;
      }
      if (/[/\\]js[/\\]campaign-operations-engine\.js(?:\?.*)?$/.test(id)) {
        const result = transformCampaignOperationsV714(source);
        if (result.error) {
          this.error(`[${this.name}] campaign-operations-engine.js transform refused: ${result.error}. No partial engine transform was applied.`);
        }
        return result.changed ? { code: result.code, map: null } : null;
      }
      return null;
    }
  };
}
