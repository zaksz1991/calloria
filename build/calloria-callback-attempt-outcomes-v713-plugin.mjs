/** CALLORIA v7.13 — strict source-aware callback attempt outcome repair. */
const MARKER = '__CALLORIA_CALLBACK_ATTEMPT_OUTCOMES_V713__';
const count = (source, needle) => source.split(needle).length - 1;

const transforms = [
  {
    name: 'inbound callback completion',
    needle: 'completeActiveCallback(state.callbacks,{contactId:contact.id},Date.now());',
    replacement: "recordCallbackAttemptOutcome(state.callbacks,{contactId:contact.id,outcome:'contact_reached',reason:'Inbound customer interaction completed.'},Date.now());"
  },
  {
    name: 'outbound callback completion',
    needle: 'completeActiveCallback(state.callbacks,{callbackId:active.callbackId},Date.now());',
    replacement: "if(active.callbackId)recordCallbackAttemptOutcome(state.callbacks,{callbackId:active.callbackId,outcome:noConnectOutcome?wrap.connectionOutcome:'contact_reached',reason:noConnectOutcome?'Outbound dial did not reach the customer.':'Outbound customer interaction completed.'},Date.now());"
  },
  {
    name: 'inbound return-to-queue callback state',
    needle: "state.currentCall=null;stopVoiceTools();if(state.shiftActive)setAgentState('available','Contact returned to queue');",
    replacement: "recordCallbackAttemptOutcome(state.callbacks,{contactId:contact.id,outcome:'returned_to_queue',reason:'Active callback returned to the inbound queue without closing the customer promise.'},Date.now());state.currentCall=null;stopVoiceTools();\n   if(state.shiftActive)setAgentState('available','Contact returned to queue');"
  },
  {
    name: 'outbound cancellation callback state',
    needle: "if(active.callbackId){const callback=state.callbacks.find(item=>item.id===active.callbackId);if(callback)callback.status='completed';}",
    replacement: "if(active.callbackId){recordCallbackAttemptOutcome(state.callbacks,{callbackId:active.callbackId,outcome:active.connectionOutcome==='answered'?'interrupted_after_connection':'cancelled_before_contact',reason:'Outbound attempt was cancelled before a verified after-contact outcome.'},Date.now());if(active.commitmentId&&!state.supervisorRequests.some(item=>item.commitmentId===active.commitmentId&&item.status==='open')){state.supervisorRequests.push({id:makeCallReference('SUP'),commitmentId:active.commitmentId,contactId:active.attemptId||active.campaignContactId,reference:active.attemptId||active.campaignContactId,customer:workItem?.customer||active.contactSnapshot?.customer||'Customer',reason:'Outbound callback attempt was interrupted before a verified customer outcome. Review and arrange the open promise without marking it complete.',status:'open',createdAt:new Date().toISOString(),channel:'Callback attempt integrity'});}}"
  },
  {
    name: 'retry callback due-time alignment',
    needle: "if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=new Date(Date.now()+60_000).toISOString();}",
    replacement: "if(workItem){workItem.status='callback_scheduled';workItem.nextEligibleAt=null;workItem.callbackDueAt=callback.dueAt;}"
  }
];

export function calloriaCallbackAttemptOutcomesPluginV713() {
  return {
    name: 'calloria-callback-attempt-outcomes-v7-13',
    enforce: 'post',
    transform(source, id) {
      if (!/[/\\]js[/\\]main\.js(?:\?.*)?$/.test(id) || source.includes(MARKER)) return null;
      const counts = transforms.map(item => count(source, item.needle));
      if (counts.some(value => value !== 1)) {
        this.warn(`[${this.name}] skipped safely: ${transforms.map((item, index) => `${item.name}=${counts[index]}`).join(', ')}. No partial transform was applied.`);
        return null;
      }
      let code = `/* ${MARKER} */\nimport { recordCallbackAttemptOutcome } from './callback-attempt-outcome-engine-v713.js';\n` + source;
      for (const item of transforms) code = code.replace(item.needle, item.replacement);
      if (transforms.some(item => count(code, item.needle) !== 0)) {
        this.error(`[${this.name}] internal replacement check failed; refusing transformed output.`);
      }
      return { code, map: null };
    }
  };
}
