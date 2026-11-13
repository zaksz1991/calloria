import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { __calloriaV644Test as api } from '../build/calloria-inbound-conversation-wrapup-v6-44.mjs';
import { calloriaInboundCustomerDialoguePlugin } from '../build/calloria-inbound-customer-dialogue-v6-43.mjs';
import { calloriaVoiceResponseWorkflowPlugin } from '../build/calloria-voice-response-workflow-v6-42.mjs';

const base = await readFile(new URL('./fixtures/calloria-v6-44-main-anchors.fixture.js', import.meta.url), 'utf8');
const context = () => { const warnings=[]; return { warnings, warn: message => warnings.push(String(message)) }; };
function fullTransform(source=base) {
  const a=calloriaVoiceResponseWorkflowPlugin().transform.call(context(),source,'/project/js/main.js');
  assert.ok(a,'v6.42 must transform the base workflow');
  const b=calloriaInboundCustomerDialoguePlugin().transform.call(context(),a.code,'/project/js/main.js');
  assert.ok(b,'v6.43 must transform the inbound conversation');
  const c=api.transformMain(context(),b.code);
  return {a,b,c};
}

test('requires the v6.43 dialogue bridge and safely skips an unprepared source',()=>{
  const ctx=context();
  assert.equal(api.transformMain(ctx,base),null);
  assert.equal(ctx.warnings.length,1);
  assert.match(ctx.warnings[0],/Install v6.42 and v6.43/);
});

test('adds a conversation review panel only to inbound after-contact work',()=>{
  const {c}=fullTransform();
  assert.ok(c);
  assert.match(c.code,/Conversation record/);
  assert.match(c.code,/Build case-note draft from conversation/);
  assert.match(c.code,/Review transcript/);
  assert.match(c.code,/wrap\.type==='inbound'\?/);
  assert.match(c.code,/Conversation entries/);
});

test('adds a wrap-up action that creates an editable draft without saving automatically',()=>{
  const {c}=fullTransform();
  assert.ok(c);
  assert.match(c.code,/case 'draft-dialogue-notes':calloriaDraftDialogueNotesV644\(\);break;/);
  assert.match(c.code,/field\.value=joined\.slice\(0,1200\)/);
  assert.match(c.code,/Review and correct it before saving/);
});

test('persists privacy-scrubbed dialogue, summary and quality metrics in inbound CRM cases',()=>{
  const {c}=fullTransform();
  assert.ok(c);
  assert.match(c.code,/text:calloriaScrubDialogueValueV644\(item\.text\)/);
  assert.match(c.code,/conversationSummary:calloriaDialogueSummaryTextV644/);
  assert.match(c.code,/conversationMetrics:calloriaReviewDialogueV644/);
});

test('routes note drafting through the existing action dispatcher and preserves existing save action',()=>{
  const {c}=fullTransform();
  assert.ok(c);
  assert.match(c.code,/case 'draft-dialogue-notes':calloriaDraftDialogueNotesV644\(\);break;\s+case 'save-wrap-up':saveWrapUp\(\);break;/);
});

test('scrubs secrets, long numeric strings and email addresses from transcript copies',async()=>{
  const vm=await import('node:vm');
  const {c}=fullTransform();
  assert.ok(c);
  const sandbox={document:{addEventListener(){}},escapeHTML:value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))};
  vm.runInNewContext(c.code+';globalThis.__scrub=calloriaScrubDialogueValueV644;globalThis.__review=calloriaReviewDialogueV644;',sandbox);
  const safe=sandbox.__scrub('My PIN is 4821 and email me at sample@example.com, ref 1234567890');
  assert.doesNotMatch(safe,/4821|sample@example\.com|1234567890/);
  assert.match(safe,/\[redacted\]/);
  assert.match(safe,/\[email redacted\]/);
  assert.match(safe,/\[redacted number\]/);
});

test('dialogue metrics count both speakers, average response score and compliance flags',async()=>{
  const vm=await import('node:vm');
  const {c}=fullTransform();
  assert.ok(c);
  const sandbox={document:{addEventListener(){}},escapeHTML:value=>String(value)};
  vm.runInNewContext(c.code+';globalThis.__review=calloriaReviewDialogueV644;',sandbox);
  const stats=sandbox.__review([
    {type:'agent',quality:{scoreDelta:2,markers:['empathy','ownership']}},
    {type:'customer',mood:'calmer'},
    {type:'agent',quality:{scoreDelta:-5,markers:[],breach:true}}
  ],'guarded');
  assert.equal(stats.turnCount,3);
  assert.equal(stats.agentTurns,2);
  assert.equal(stats.customerTurns,1);
  assert.equal(stats.averageScore,-1.5);
  assert.equal(stats.breachCount,1);
  assert.equal(stats.lastCustomerMood,'guarded');
});

test('transformation is idempotent and skips safely if the wrap-up markup changes',()=>{
  const {c}=fullTransform();
  assert.ok(c);
  assert.equal(api.transformMain(context(),c.code),null);
  const changed=base+'\nfunction renderWrapUp(){ /* changed */ }';
  const pre=fullTransform(changed);
  assert.ok(pre.b,'upstream transforms should still be able to run');
  const ctx=context();
  assert.equal(api.transformMain(ctx,pre.b.code),null);
  assert.equal(ctx.warnings.length,1);
  assert.match(ctx.warnings[0],/skipped safely/);
});
