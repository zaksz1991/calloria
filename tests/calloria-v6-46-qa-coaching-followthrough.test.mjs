import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { __calloriaV646Test as api } from '../build/calloria-qa-coaching-followthrough-v6-46.mjs';
import { calloriaVoiceResponseWorkflowPlugin } from '../build/calloria-voice-response-workflow-v6-42.mjs';
import { calloriaInboundCustomerDialoguePlugin } from '../build/calloria-inbound-customer-dialogue-v6-43.mjs';
import { calloriaInboundConversationWrapUpPlugin } from '../build/calloria-inbound-conversation-wrapup-v6-44.mjs';
import { __calloriaV645Test as qaApi } from '../build/calloria-inbound-qa-review-bridge-v6-45.mjs';

const base = await readFile(new URL('./fixtures/calloria-v6-45-main-anchors.fixture.js', import.meta.url), 'utf8');
const context = () => { const warnings=[]; return {warnings,warn:message=>warnings.push(String(message))}; };
function transformed(source=base) {
  const ctx=context();
  const a=calloriaVoiceResponseWorkflowPlugin().transform.call(ctx,source,'/project/js/main.js');
  assert.ok(a,'v6.42 transform must match');
  const b=calloriaInboundCustomerDialoguePlugin().transform.call(ctx,a.code,'/project/js/main.js');
  assert.ok(b,'v6.43 transform must match');
  const c=calloriaInboundConversationWrapUpPlugin().transform.call(ctx,b.code,'/project/js/main.js');
  assert.ok(c,'v6.44 transform must match');
  const d=qaApi.transformMain(ctx,c.code);
  assert.ok(d,'v6.45 transform must match');
  const e=api.transformMain(ctx,d.code);
  return {ctx,a,b,c,d,e};
}
function runtime(code) {
  const coaching=[];
  const events=[];
  const state={coachingSessions:coaching,applicantName:'QA reviewer'};
  const sandbox={
    state,
    document:{getElementById:()=>null,createElement:()=>({style:{},append(){}}),head:{append(){}},addEventListener(){}},
    createCoachingRecord(records,input){
      const item={id:`COACH-${records.length+1}`,...input,recordedAt:'2026-11-14T09:00:00.000Z',status:'action_plan_open'};
      records.push(item);return item;
    },
    pushOperationEvent(...args){events.push(args);},
    escapeHTML:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'),
    console,
    Date,
    documentDate:Date
  };
  vm.runInNewContext(code+';globalThis.__create=calloriaCreateQACoachingPlansV646;globalThis.__deliver=calloriaUpdateQACoachingDeliveryV646;globalThis.__follow=calloriaRecordQACoachingFollowUpV646;globalThis.__render=calloriaRenderQACoachingFollowThroughV646;',sandbox);
  return {sandbox,coaching,events};
}

test('requires v6.45 and all review, rendering and form anchors; skips safely otherwise',()=>{
  const ctx=context();
  assert.equal(api.transformMain(ctx,base),null);
  assert.match(ctx.warnings[0],/Install v6\.45 first/);
  const full=transformed();
  assert.ok(full.e);
  const broken=full.d.code.replace("state.humanQaReviews.push(review);",'state.humanQaReviews.push(item);');
  const changed=context();
  assert.equal(api.transformMain(changed,broken),null);
  assert.match(changed.warnings[0],/skipped safely/);
});

test('human QA reviews generate linked action plans for low-rated criteria and critical compliance flags',()=>{
  const {e}=transformed();
  assert.ok(e);
  assert.match(e.code,/calloriaCreateQACoachingPlansV646\(review\)/);
  assert.match(e.code,/QA coaching follow-through/);
  const {sandbox,coaching}=runtime(e.code);
  const review={id:'HQA-101',interactionId:'INB-101',reviewer:'Reviewer One',createdAt:'2026-11-14T09:00:00.000Z',criticalBreaches:['credential_request'],coaching:[{criterionId:'listening',criterion:'Listening and acknowledgement',rating:2,evidence:'I understand your issue.',action:'Acknowledge the full customer concern before probing.'}]};
  const created=sandbox.__create(review);
  assert.equal(created.length,2);
  assert.equal(coaching.length,2);
  assert.equal(created[0].sourceReviewId,'HQA-101');
  assert.equal(created[0].sourceInteractionId,'INB-101');
  assert.equal(created[0].status,'action_plan_open');
  assert.equal(created[0].followUpDate,'2026-11-21');
  assert.equal(created[1].priority,'critical');
  assert.match(created[1].topic,/compliance remediation/i);
  assert.equal(sandbox.__create(review).length,2,'repeated creation for one review must not duplicate plans');
  assert.equal(coaching.length,2);
});

test('delivery must be recorded before a follow-up can be verified',()=>{
  const {e}=transformed();
  const {sandbox,coaching,events}=runtime(e.code);
  const [plan]=sandbox.__create({id:'HQA-102',interactionId:'INB-102',reviewer:'Reviewer Two',createdAt:'2026-11-14T09:00:00.000Z',coaching:[{criterion:'Ownership',rating:3,evidence:'I will take responsibility.',action:'Explain the next action and timeframe.'}]});
  assert.equal(sandbox.__deliver(plan.id),true);
  assert.equal(plan.status,'delivered');
  assert.equal(plan.deliveredBy,'Reviewer Two');
  assert.equal(sandbox.__deliver(plan.id),false,'already delivered records cannot be marked delivered twice');
  assert.throws(()=>sandbox.__follow({id:plan.id,outcome:'improved',note:'Too short',reviewer:'Reviewer Two'}),/20 to 600 characters/);
  const completed=sandbox.__follow({id:plan.id,outcome:'improved',note:'Observed the agent complete a second practice interaction with clear ownership and a specific resolution timeframe.',reviewer:'Reviewer Two'});
  assert.equal(completed.status,'verified');
  assert.equal(completed.followUp.outcome,'improved');
  assert.equal(events.length,3,'plan creation, delivery and follow-up should all be in the operations timeline');
});

test('follow-up requiring further practice reopens the action plan',()=>{
  const {e}=transformed();
  const {sandbox}=runtime(e.code);
  const [plan]=sandbox.__create({id:'HQA-103',interactionId:'INB-103',reviewer:'Reviewer Three',createdAt:'2026-11-14T09:00:00.000Z',coaching:[{criterion:'Accuracy',rating:1,evidence:'I think this may be correct.',action:'Use the approved knowledge article before advising.'}]});
  sandbox.__deliver(plan.id);
  sandbox.__follow({id:plan.id,outcome:'needs_more_practice',note:'The repeat interaction still contained unsupported product information; another guided knowledge-base practice is required.',reviewer:'Reviewer Three'});
  assert.equal(plan.status,'reopened');
  assert.equal(plan.followUp.outcome,'needs_more_practice');
  assert.equal(plan.followUps.length,1);
  assert.equal(sandbox.__render().includes('Mark coaching delivered'),true);
  sandbox.__deliver(plan.id);
  sandbox.__follow({id:plan.id,outcome:'improved',note:'A later role-play correctly used the approved product guidance and accurately explained the next step to the customer.',reviewer:'Reviewer Three'});
  assert.equal(plan.status,'verified');
  assert.equal(plan.followUps.length,2,'follow-up evidence must be retained as a history');
});

test('workspace includes mobile-friendly review follow-up controls and escapes stored content',()=>{
  const {e}=transformed();
  const {sandbox}=runtime(e.code);
  const [plan]=sandbox.__create({id:'HQA-104',interactionId:'INB-104',reviewer:'Reviewer Four',createdAt:'2026-11-14T09:00:00.000Z',coaching:[{criterion:'Empathy',rating:2,evidence:'<script>unsafe</script>',action:'Demonstrate acknowledgement.'}]});
  const html=sandbox.__render();
  assert.match(html,/QA coaching follow-through/);
  assert.match(html,/Mark coaching delivered/);
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>unsafe/);
  assert.match(html,/Follow-up due/);
});

test('plugin is idempotent and transforms only js/main.js',()=>{
  const {e}=transformed();
  assert.ok(e);
  assert.equal(api.transformMain(context(),e.code),null);
  assert.equal(api.transformMain(context(),base),null);
});

test('transformed application source remains valid JavaScript and Vite registers v6.46 after v6.45',async()=>{
  const {e}=transformed();
  assert.ok(e);
  assert.doesNotThrow(()=>new vm.Script(e.code));
  const config=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');
  assert.match(config,/import \{ calloriaQACoachingFollowThroughPlugin \} from '\.\/build\/calloria-qa-coaching-followthrough-v6-46\.mjs';/);
  assert.ok(config.indexOf('calloriaInboundQAReviewBridgePlugin()')<config.indexOf('calloriaQACoachingFollowThroughPlugin()'));
});
