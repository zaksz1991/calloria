import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { __calloriaV643Test as api } from '../build/calloria-inbound-customer-dialogue-v6-43.mjs';
import { calloriaVoiceResponseWorkflowPlugin } from '../build/calloria-voice-response-workflow-v6-42.mjs';

const baseFixture = await readFile(new URL('./fixtures/calloria-v6-43-main-anchors.fixture.js', import.meta.url), 'utf8');
const context = () => { const warnings=[]; return { warnings, warn: message => warnings.push(String(message)) }; };
const v642FixtureContext = context();
const v642FixtureResult = calloriaVoiceResponseWorkflowPlugin().transform.call(v642FixtureContext, baseFixture, '/project/js/main.js');
assert.ok(v642FixtureResult, v642FixtureContext.warnings.join('\n'));
const fixture = v642FixtureResult.code;

test('adds a live dialogue panel to the active inbound call, not the queue screen', () => {
  const ctx=context(); const result=api.transformMain(ctx,fixture);
  assert.ok(result,ctx.warnings.join('\n'));
  assert.match(result.code,/Live customer conversation/);
  assert.match(result.code,/inboundDialogueFormV643/);
  assert.match(result.code,/Send response to customer/);
  assert.match(result.code,/calloriaRenderInboundDialogueV643\(call,scenario\)/);
  assert.equal(ctx.warnings.length,0);
});

test('routes free-text replies and captured voice transcripts into the same customer conversation', () => {
  const result=api.transformMain(context(),fixture); assert.ok(result);
  assert.match(result.code,/e\.submitter\?\.value==='voice'\?voiceTranscript:formData\.get\('reply'/);
  assert.match(result.code,/calloriaSubmitInboundDialogueV643\(value\)/);
  assert.match(result.code,/Send captured voice transcript/);
});

test('scores communication quality and records both sides of the scripted exchange', () => {
  const result=api.transformMain(context(),fixture); assert.ok(result);
  assert.match(result.code,/markers\.push\('empathy'\)/);
  assert.match(result.code,/markers\.push\('ownership'\)/);
  assert.match(result.code,/markers\.push\('approved verification'\)/);
  assert.match(result.code,/markers\.push\('investigation'\)/);
  assert.match(result.code,/markers\.push\('clear next step'\)/);
  assert.match(result.code,/addCallTimeline\(call,'Live dialogue exchange recorded'/);
  assert.match(result.code,/call\.dialogueTurns\.push\(\{type:'customer',text:reply\.text/);
});

test('flags requests for authentication secrets once and keeps the local scripted boundary explicit', () => {
  const result=api.transformMain(context(),fixture); assert.ok(result);
  assert.match(result.code,/if\(review\.breach&&!call\.dialogueBreachV643\)/);
  assert.match(result.code,/state\.incidents\+\+/);
  assert.match(result.code,/no AI request or external call/);
});

test('skips safely when the current inbound rendering or submit anchors change', () => {
  const ctx=context();
  const result=api.transformMain(ctx,'function applyCallChoice(index){}');
  assert.equal(result,null);
  assert.equal(ctx.warnings.length,1);
  assert.match(ctx.warnings[0],/skipped safely/);
});

test('v6.42 voice-CRM patch and v6.43 dialogue patch can transform in sequence', async () => {
  const v642=calloriaVoiceResponseWorkflowPlugin();
  const first=v642.transform.call(context(),baseFixture,'/project/js/main.js');
  assert.ok(first,'v6.42 should transform the base anchors first');
  const second=api.transformMain(context(),first.code);
  assert.ok(second,'v6.43 should operate on the transformed current main.js');
  assert.match(second.code,/__CALLORIA_VOICE_RESPONSE_WORKFLOW_V642__/);
  assert.match(second.code,/__CALLORIA_INBOUND_CUSTOMER_DIALOGUE_V643__/);
});

test('does not apply the same transform twice', () => {
  const once=api.transformMain(context(),fixture); assert.ok(once);
  assert.equal(api.transformMain(context(),once.code),null);
});

test('the runtime rubric catches explicit secret requests without flagging protective warnings', async () => {
  const vm = await import('node:vm');
  const result=api.transformMain(context(),fixture); assert.ok(result);
  const sandbox={
    sanitizeTranscript:value=>String(value||''),
    document:{addEventListener(){}}
  };
  vm.runInNewContext(result.code+'\nglobalThis.__reviewV643=calloriaDialogueReviewV643;',sandbox);
  const direct=sandbox.__reviewV643('Could you tell me your PIN?');
  const polite=sandbox.__reviewV643('Please provide your one-time code.');
  const protective=sandbox.__reviewV643('Please never share your PIN or password with anyone.');
  assert.equal(direct.breach,true);
  assert.equal(polite.breach,true);
  assert.equal(protective.breach,false);
  assert.equal(direct.scoreDelta,-5);
});
