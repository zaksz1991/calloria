import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { __calloriaV35Test } from '../build/calloria-first-working-shift-v3-5-plugin.mjs';
import { __calloriaV36Test } from '../build/calloria-live-inbound-conversation-v3-6-plugin.mjs';

const mainSource = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const htmlSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function transformMain() {
  const v35 = __calloriaV35Test.transformMain({ error(message) { throw new Error(message); } }, mainSource);
  return __calloriaV36Test.transformMain({ error(message) { throw new Error(message); } }, v35.code).code;
}

test('v3.6 transforms the current application entry and preserves existing shift logic', () => {
  const output = transformMain();
  assert.ok(output.includes("from './operational-conversation-engine.js'"));
  assert.ok(output.includes('function renderOperationalInboundCall'));
  assert.ok(output.includes('state.currentCall.conversation=createOperationalConversation'));
  assert.ok(output.includes('function startShift()'));
  assert.ok(output.includes('function saveWrapUp()'));
});

test('inbound workspace is no longer rendered as multiple-choice call steps', () => {
  const output = transformMain();
  const start = output.indexOf('function renderInbound() {');
  const end = output.indexOf('function ensureDigitalQueue(', start);
  const inbound = output.slice(start, end);
  assert.ok(inbound.includes('renderOperationalInboundCall(call,scenario,contact,supervisorOpen)'));
  assert.ok(!inbound.includes('data-call-choice'));
  assert.ok(!inbound.includes('call-options'));
});

test('agent free-text replies update operational score, event history and wrap-up route', () => {
  const output = transformMain();
  assert.ok(output.includes("if(e.target.id==='operationalCallReplyForm')"));
  assert.ok(output.includes('active.score=Math.round((summary.averageScore-70)/5)'));
  assert.ok(output.includes("active.breach=summary.criticalBreaches.length>0"));
  assert.ok(output.includes("call.conversation?.dispositionHint==='escalated'"));
  assert.ok(output.includes('conversation:state.currentCall?.conversation'));
});

test('a changed source contract fails closed rather than partially changing the app', () => {
  const broken = mainSource.replace("case 'answer-call':startInboundCall();break;", "case 'answer-call':openInbound();break;");
  const v35 = __calloriaV35Test.transformMain({ error(message) { throw new Error(message); } }, broken);
  assert.throws(() => __calloriaV36Test.transformMain({ error(message) { throw new Error(message); } }, v35.code), /inbound call action anchor/);
});

test('HTML injects responsive customer conversation styling exactly once', () => {
  const first = __calloriaV36Test.transformHtml(htmlSource);
  const second = __calloriaV36Test.transformHtml(first);
  assert.ok(first.includes('v36-transcript'));
  assert.equal((second.match(/__CALLORIA_LIVE_INBOUND_CONVERSATION_V36__-CSS/g) || []).length, 1);
});
