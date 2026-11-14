import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { __calloriaV645Test as api } from '../build/calloria-inbound-qa-review-bridge-v6-45.mjs';
import { calloriaVoiceResponseWorkflowPlugin } from '../build/calloria-voice-response-workflow-v6-42.mjs';
import { calloriaInboundCustomerDialoguePlugin } from '../build/calloria-inbound-customer-dialogue-v6-43.mjs';
import { calloriaInboundConversationWrapUpPlugin } from '../build/calloria-inbound-conversation-wrapup-v6-44.mjs';

const base = await readFile(new URL('./fixtures/calloria-v6-45-main-anchors.fixture.js', import.meta.url), 'utf8');
const context = () => { const warnings=[]; return {warnings,warn:message=>warnings.push(String(message))}; };
function fullTransform(source=base) {
  const ctx=context();
  const a=calloriaVoiceResponseWorkflowPlugin().transform.call(ctx,source,'/project/js/main.js');
  assert.ok(a,'v6.42 must transform the current main.js anchors');
  const b=calloriaInboundCustomerDialoguePlugin().transform.call(ctx,a.code,'/project/js/main.js');
  assert.ok(b,'v6.43 must add live inbound dialogue');
  const c=calloriaInboundConversationWrapUpPlugin().transform.call(ctx,b.code,'/project/js/main.js');
  assert.ok(c,'v6.44 must add conversation-aware wrap-up');
  const d=api.transformMain(ctx,c.code);
  return {ctx,a,b,c,d};
}

test('requires the preceding voice, dialogue and wrap-up integrations',()=>{
  const ctx=context();
  assert.equal(api.transformMain(ctx,base),null);
  assert.equal(ctx.warnings.length,1);
  assert.match(ctx.warnings[0],/Install v6\.42–v6\.44/);
});

test('connects successfully saved inbound cases to the existing QA review register',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  assert.match(d.code,/calloriaQueueInboundQAV645\(\{wrap,call:state\.currentCall,contact,notes,disposition,createdAt\}\)/);
  assert.match(d.code,/sourceType:'inbound-operations'/);
  assert.match(d.code,/state\.customerQaHistory\.push\(item\)/);
  assert.match(d.code,/calloriaRenderInboundQAPendingV645\(pendingInboundReview\)/);
  assert.match(d.code,/PENDING · /);
});

test('routes reviewable contacts into the existing evidence selector and prioritises pending records',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  assert.match(d.code,/const reviewedInteractionIds=new Set\(\(state\.humanQaReviews\|\|\[\]\)\.map\(item=>item\.interactionId\)\)/);
  assert.match(d.code,/pendingReview\.at\(-1\) \|\| reviewable\.at\(-1\)/);
  assert.match(d.code,/Save human QA review/);
});

test('creates privacy-scrubbed transcript evidence from the opening, live dialogue and case notes',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  assert.match(d.code,/if\(scenario\?\.opening\)add\('customer',scenario\.opening/);
  assert.match(d.code,/call\?\.dialogueTurns/);
  assert.match(d.code,/add\('case-note','Factual case note: '\+notes/);
  assert.match(d.code,/\[email redacted\]/);
});

test('critical breaches enter mandatory-review state without generating an automatic employee score',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  const sandbox={
    document:{getElementById:()=>null,createElement:()=>({setAttribute(){},style:{},append(){}}),head:{append(){}},addEventListener(){}},
    state:{customerQaHistory:[],applicantName:'Test Agent'},
    inboundScenarios:[{id:'suspected-fraud',opening:'I have a suspicious transaction.',customer:'Test Customer',issue:'Suspected fraud'}],
    pushOperationEvent(){},
    escapeHTML:value=>String(value)
  };
  vm.runInNewContext(d.code+';globalThis.__queue=calloriaQueueInboundQAV645;',sandbox);
  const item=sandbox.__queue({
    wrap:{type:'inbound',scenarioId:'suspected-fraud',reference:'SEC-1',customer:'Test Customer',title:'Suspected fraud',qa:45,breach:true},
    call:{scenarioId:'suspected-fraud',breach:true,dialogueTurns:[{type:'agent',text:'Please share your OTP 123456.'},{type:'customer',text:'No.'}]},
    contact:{id:'CONTACT-1',timeline:[]},notes:'Escalated safely after customer refused credential sharing.',disposition:'escalated',createdAt:'2026-11-13T10:00:00.000Z'
  });
  assert.ok(item);
  assert.deepEqual(Array.from(item.criticalBreaches),['inbound_policy_or_security_breach']);
  assert.equal(item.reviewState,'pending');
  assert.equal(item.estimatedQA,45);
  assert.match(item.transcript[1].text,/OTP \[redacted\]/);
  assert.equal(item.transcript[0].speaker,'customer');
  assert.equal(item.transcript.at(-1).speaker,'case-note');
  assert.equal(item.humanScore,undefined);
});

test('does not enqueue outbound contacts and does not duplicate an already queued inbound case',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  const sandbox={document:{getElementById:()=>null,createElement:()=>({style:{},append(){}}),head:{append(){},},addEventListener(){}},state:{customerQaHistory:[],applicantName:'Agent'},inboundScenarios:[{id:'sample',opening:'Customer statement'}],pushOperationEvent(){},escapeHTML:String};
  vm.runInNewContext(d.code+';globalThis.__queue=calloriaQueueInboundQAV645;',sandbox);
  const outbound=sandbox.__queue({wrap:{type:'outbound'},contact:{id:'O-1'}});
  assert.equal(outbound,null);
  const args={wrap:{type:'inbound',scenarioId:'sample',qa:80},call:{scenarioId:'sample',dialogueTurns:[]},contact:{id:'C-1',timeline:[]},notes:'Reviewed case notes.',disposition:'resolved'};
  const first=sandbox.__queue(args);
  const second=sandbox.__queue(args);
  assert.equal(first.id,second.id);
  assert.equal(sandbox.state.customerQaHistory.length,1);
});

test('redacts credentials, long number sequences and email addresses',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  const sandbox={document:{getElementById:()=>null,createElement:()=>({style:{},append(){}}),head:{append(){},},addEventListener(){}},state:{customerQaHistory:[],applicantName:'Agent'},inboundScenarios:[],pushOperationEvent(){},escapeHTML:String};
  vm.runInNewContext(d.code+';globalThis.__scrub=calloriaScrubInboundQATextV645;',sandbox);
  const safe=sandbox.__scrub('My password is secret123; call me at user@example.com; ref 1234 5678 9012');
  assert.doesNotMatch(safe,/secret123|user@example\.com|1234 5678 9012/);
  assert.match(safe,/password \[redacted\]/);
  assert.match(safe,/\[email redacted\]/);
  assert.match(safe,/\[redacted number\]/);
});

test('transformation is idempotent and fails safely on changed main.js anchors',()=>{
  const {d}=fullTransform();
  assert.ok(d);
  assert.equal(api.transformMain(context(),d.code),null);
  const changed=base.replace('function renderQAWorkspace(){','function renderQAWorkspaceChanged(){');
  const prior=fullTransform(changed);
  assert.equal(prior.d,null);
  assert.equal(prior.ctx.warnings.length,1);
  assert.match(prior.ctx.warnings[0],/skipped safely/);
});
