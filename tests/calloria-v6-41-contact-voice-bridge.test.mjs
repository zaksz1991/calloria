import test from 'node:test';
import assert from 'node:assert/strict';
import { __calloriaV641Test as api } from '../build/calloria-contact-voice-integration-v6-41.mjs';

const warnContext = () => {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(String(message)) };
};

function makePostV44Fixture() {
  return [
    "import { createOperationalConversation, submitOperationalTurn, operationalConversationSummary } from './operational-conversation-engine.js';",
    'function renderOperationalInboundCall(call,scenario,contact,supervisorOpen){',
    "  const latestCustomer=[...conversation.messages].reverse().find(item=>item.speaker==='customer');",
    `  return '<button class="btn outline" data-action="play-active-customer" '+(latestCustomer?'':'disabled')+'>Play customer voice</button><button class="btn outline" data-action="open-crm">Open CRM</button>';`,
    '}',
    "function startInboundCall(){\n  state.currentCall={scenarioId:scenario.id,queueContactId:contact.id,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,held:false,startedAt:acceptedAt,waitSeconds};\n  state.currentCall.conversation=createOperationalConversation({id:contact.id,scenario,seed:acceptedAt});\n}",
    'function submitListener(){',
    "document.addEventListener('submit',async e=>{",
    "      const result=submitOperationalTurn(active.conversation,String(new FormData(e.target).get('reply')||''));",
    '});',
    "function actionSwitch(){\n    case 'answer-call':startInboundCall();break;\n    case 'play-active-customer':{const latest=[...(state.currentCall?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}\n}",
    "function beginInboundWrapUp(){\n  const call=state.currentCall;\n  stopVoiceTools();\n  setAgentState('wrap-up','Inbound call entered after-contact work');\n}",
    "function toggleCallHold(){\ntransitionContact(contact,CONTACT_STATUS.ON_HOLD,'Agent placed the customer on hold',Date.now());call.held=true;\ntransitionContact(contact,CONTACT_STATUS.CONNECTED,'Agent resumed the customer conversation',Date.now());call.held=false;\n}",
    "function returnCallToQueue(){\nstate.currentCall=null;stopVoiceTools();\n}",
    "async function initWorld(){\n      productionWorld=await module.initProductionWorld(THREE,host,{\n       onAssetsReady:result=>{\n        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;\n       }\n      });\n}",
    ''
  ].join('\n');
}

test('injects runtime-confirmed GLB IDs and starts an agent dialogue session on inbound acceptance', () => {
  const context = warnContext();
  const result = api.transformMain(context, makePostV44Fixture());
  assert.ok(result, context.warnings.join('\n'));
  assert.match(result.code, /window\.CalloriaWorldStaffAssetIds=Object\.freeze/);
  assert.match(result.code, /calloriaStartContactDialogue\(contact\.id\)/);
  assert.match(result.code, /result\?\.assetsInUse/);
  assert.match(result.code, /if\(state\.currentCall\?\.queueContactId&&!state\.currentCall\.held\)calloriaStartContactDialogue/);
  assert.equal(context.warnings.length, 0);
});

test('speaks agent replies, adds a replay control and routes playback to the active contact session', () => {
  const result = api.transformMain(warnContext(), makePostV44Fixture());
  assert.ok(result);
  assert.match(result.code, /calloriaSpeakContactDialogue\(active\.queueContactId,latestAgentReply\.text\)/);
  assert.match(result.code, /data-action="play-agent-last-reply"/);
  assert.match(result.code, /case 'play-agent-last-reply'/);
  assert.match(result.code, /data-action="play-agent-last-reply" '\+\(latestAgent\?'':'disabled'\)/);
});

test('keeps speech lifecycle aligned with hold, resume, wrap-up and queue return', () => {
  const result = api.transformMain(warnContext(), makePostV44Fixture());
  assert.ok(result);
  assert.match(result.code, /calloriaHoldContactDialogue\(call\.queueContactId\)/);
  assert.match(result.code, /calloriaResumeContactDialogue\(call\.queueContactId\)/);
  assert.match(result.code, /calloriaEndContactDialogue\(call\.queueContactId\)/);
  assert.match(result.code, /calloriaEndContactDialogue\(call\.queueContactId\);state\.currentCall=null/);
});

test('fails closed when the post-v4.4 source contract has changed', () => {
  const context = warnContext();
  const result = api.transformMain(context, 'function startInboundCall(){}');
  assert.equal(result, null);
  assert.equal(context.warnings.length, 1);
  assert.match(context.warnings[0], /skipped safely/);
});

test('does not apply the transform twice', () => {
  const context = warnContext();
  const once = api.transformMain(context, makePostV44Fixture());
  assert.ok(once);
  const twice = api.transformMain(context, once.code);
  assert.equal(twice, null);
});
