/**
 * CALLORIA v6.41 — connect the existing inbound conversation workflow to the
 * existing GLB staff contact-dialogue runtime.
 *
 * This post-transform runs after v4.4, outbound workflow and mobile repairs.
 * It does not create a second audio engine or renderer. It uses only staff GLB
 * asset IDs actually returned by the production world's onAssetsReady callback.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_CONTACT_TO_STAFF_VOICE_V641__';

const WORLD_STATUS_ANCHOR = "const status=$('#assetStatus');if(status)status.textContent=label;";
const CALL_START_ANCHOR = 'state.currentCall.conversation=createOperationalConversation({id:contact.id,scenario,seed:acceptedAt});';
const AGENT_MESSAGE_ANCHOR = "const result=submitOperationalTurn(active.conversation,String(new FormData(e.target).get('reply')||''));";
const CUSTOMER_BUTTON_ANCHOR = `'>Play customer voice</button><button class="btn outline" data-action="open-crm">Open CRM</button>`;
const CUSTOMER_ACTION_ANCHOR = "case 'play-active-customer':{const latest=[...(state.currentCall?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}";
const HOLD_ANCHOR = "transitionContact(contact,CONTACT_STATUS.ON_HOLD,'Agent placed the customer on hold',Date.now());call.held=true;";
const RESUME_ANCHOR = "transitionContact(contact,CONTACT_STATUS.CONNECTED,'Agent resumed the customer conversation',Date.now());call.held=false;";
const WRAP_UP_ANCHOR = "  stopVoiceTools();\n  setAgentState('wrap-up','Inbound call entered after-contact work');";
const RETURN_QUEUE_ANCHOR = 'state.currentCall=null;stopVoiceTools();';
const INIT_WORLD_ANCHOR = "onAssetsReady:result=>{\n        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;";

const HELPERS = String.raw`
const calloriaContactVoiceSessions = new Map();
function calloriaContactVoiceAssetId(){
  const ids=Array.isArray(window.CalloriaWorldStaffAssetIds)?window.CalloriaWorldStaffAssetIds:[];
  return ids.find(id=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/i.test(id))||null;
}
function calloriaContactVoiceError(sessionId,action,error){
  const detail={sessionId:String(sessionId||''),action,message:String(error?.message||error||'Contact voice failed')};
  try{window.dispatchEvent(new CustomEvent('calloria:contact-voice-error',{detail}));}catch{}
}
function calloriaStartContactDialogue(sessionId){
  const api=window.CalloriaContactDialogue;
  const assetId=calloriaContactVoiceAssetId();
  const key=String(sessionId||'');
  if(!key||!api||typeof api.start!=='function'||!assetId)return false;
  const existing=calloriaContactVoiceSessions.get(key);
  if(existing)return true;
  const startPromise=Promise.resolve().then(()=>api.start({sessionId:key,assetId}));
  calloriaContactVoiceSessions.set(key,{assetId,promise:startPromise});
  startPromise.catch(error=>calloriaContactVoiceError(key,'start',error));
  return true;
}
function calloriaSpeakContactDialogue(sessionId,text){
  const api=window.CalloriaContactDialogue;
  const key=String(sessionId||'');
  const session=calloriaContactVoiceSessions.get(key);
  const line=String(text||'').trim().slice(0,2000);
  if(!session||!line||!api||typeof api.say!=='function')return false;
  Promise.resolve(session.promise)
    .then(()=>api.say({sessionId:key,text:line,lang:'en-NG',rate:0.96,pitch:1,intensity:0.72}))
    .catch(error=>calloriaContactVoiceError(key,'say',error));
  return true;
}
function calloriaHoldContactDialogue(sessionId){
  const api=window.CalloriaContactDialogue;const key=String(sessionId||'');
  if(!calloriaContactVoiceSessions.has(key)||!api||typeof api.hold!=='function')return false;
  Promise.resolve(api.hold(key)).catch(error=>calloriaContactVoiceError(key,'hold',error));return true;
}
function calloriaResumeContactDialogue(sessionId){
  const api=window.CalloriaContactDialogue;const key=String(sessionId||'');
  if(!calloriaContactVoiceSessions.has(key)||!api||typeof api.resume!=='function')return false;
  Promise.resolve(api.resume(key)).catch(error=>calloriaContactVoiceError(key,'resume',error));return true;
}
function calloriaEndContactDialogue(sessionId){
  const api=window.CalloriaContactDialogue;const key=String(sessionId||'');
  const session=calloriaContactVoiceSessions.get(key);
  if(!session)return false;
  calloriaContactVoiceSessions.delete(key);
  Promise.resolve(session.promise).then(()=>api?.end?.(key)).catch(error=>calloriaContactVoiceError(key,'end',error));
  return true;
}
`;

function count(source, needle) {
  return source.split(needle).length - 1;
}
function checkedReplace(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.41 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;

  const required = [
    [WORLD_STATUS_ANCHOR, 'world GLB status callback'],
    [CALL_START_ANCHOR, 'inbound conversation creation'],
    [AGENT_MESSAGE_ANCHOR, 'agent reply submission'],
    [CUSTOMER_BUTTON_ANCHOR, 'inbound call voice controls'],
    [CUSTOMER_ACTION_ANCHOR, 'customer voice replay action'],
    [HOLD_ANCHOR, 'inbound hold transition'],
    [RESUME_ANCHOR, 'inbound resume transition'],
    [WRAP_UP_ANCHOR, 'inbound wrap-up transition'],
    [RETURN_QUEUE_ANCHOR, 'return-to-queue cleanup'],
    [INIT_WORLD_ANCHOR, 'world asset readiness callback']
  ];
  const missing = required.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.41 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match the current post-v4.4 application source. No partial transform was applied.`);
    return null;
  }

  let code = original;
  code = checkedReplace(context, code, INIT_WORLD_ANCHOR,
    `${INIT_WORLD_ANCHOR}\n        const placedStaffIds=Array.isArray(result?.assetsInUse)?result.assetsInUse.filter(id=>typeof id==='string'&&/^[a-z0-9-]{1,80}$/i.test(id)):[];\n        window.CalloriaWorldStaffAssetIds=Object.freeze([...new Set(placedStaffIds)]);\n        window.dispatchEvent(new CustomEvent('calloria:world-staff-assets-ready',{detail:{staffAssetIds:window.CalloriaWorldStaffAssetIds,loaded:Number(result?.loaded)||0}}));
        if(state.currentCall?.queueContactId&&!state.currentCall.held)calloriaStartContactDialogue(state.currentCall.queueContactId);`,
    'world asset readiness callback');
  if (code === null) return null;

  code = checkedReplace(context, code, 'function startInboundCall(){',
    `${HELPERS}\nfunction startInboundCall(){`, 'inbound call function');
  if (code === null) return null;

  code = checkedReplace(context, code, CALL_START_ANCHOR,
    `${CALL_START_ANCHOR}\n  calloriaStartContactDialogue(contact.id);`, 'inbound conversation creation');
  if (code === null) return null;

  code = checkedReplace(context, code, "const latestCustomer=[...conversation.messages].reverse().find(item=>item.speaker==='customer');",
    "const latestCustomer=[...conversation.messages].reverse().find(item=>item.speaker==='customer');\n  const latestAgent=[...conversation.messages].reverse().find(item=>item.speaker==='agent');",
    'latest inbound transcript messages');
  if (code === null) return null;

  code = checkedReplace(context, code, CUSTOMER_BUTTON_ANCHOR,
    `'>Play customer voice</button><button class="btn outline" data-action="play-agent-last-reply" '+(latestAgent?'':'disabled')+'>Play agent voice</button><button class="btn outline" data-action="open-crm">Open CRM</button>`,
    'inbound call voice controls');
  if (code === null) return null;

  code = checkedReplace(context, code, CUSTOMER_ACTION_ANCHOR,
    `${CUSTOMER_ACTION_ANCHOR}\n    case 'play-agent-last-reply':{const active=state.currentCall;const latest=[...(active?.conversation?.messages||[])].reverse().find(item=>item.speaker==='agent');if(active&&latest)calloriaSpeakContactDialogue(active.queueContactId,latest.text);break;}`,
    'customer voice replay action');
  if (code === null) return null;

  code = checkedReplace(context, code, AGENT_MESSAGE_ANCHOR,
    `${AGENT_MESSAGE_ANCHOR}\n      const latestAgentReply=[...(active.conversation?.messages||[])].reverse().find(item=>item.speaker==='agent');\n      if(latestAgentReply)calloriaSpeakContactDialogue(active.queueContactId,latestAgentReply.text);`,
    'agent reply submission');
  if (code === null) return null;

  code = checkedReplace(context, code, HOLD_ANCHOR,
    `${HOLD_ANCHOR}calloriaHoldContactDialogue(call.queueContactId);`, 'inbound hold transition');
  if (code === null) return null;

  code = checkedReplace(context, code, RESUME_ANCHOR,
    `${RESUME_ANCHOR}calloriaResumeContactDialogue(call.queueContactId);`, 'inbound resume transition');
  if (code === null) return null;

  code = checkedReplace(context, code, WRAP_UP_ANCHOR,
    `  calloriaEndContactDialogue(call.queueContactId);\n${WRAP_UP_ANCHOR}`, 'inbound wrap-up transition');
  if (code === null) return null;

  code = checkedReplace(context, code, RETURN_QUEUE_ANCHOR,
    'calloriaEndContactDialogue(call.queueContactId);state.currentCall=null;stopVoiceTools();', 'return-to-queue cleanup');
  if (code === null) return null;

  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaContactVoiceIntegrationPlugin() {
  return {
    name: 'calloria-contact-to-staff-voice-v6-41',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __calloriaV641Test = Object.freeze({
  MARKER,
  WORLD_STATUS_ANCHOR,
  CALL_START_ANCHOR,
  AGENT_MESSAGE_ANCHOR,
  CUSTOMER_BUTTON_ANCHOR,
  CUSTOMER_ACTION_ANCHOR,
  HOLD_ANCHOR,
  RESUME_ANCHOR,
  WRAP_UP_ANCHOR,
  RETURN_QUEUE_ANCHOR,
  INIT_WORLD_ANCHOR,
  HELPERS,
  transformMain
});
