import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { __calloriaV642Test as api } from '../build/calloria-voice-response-workflow-v6-42.mjs';

const fixtureUrl = new URL('./fixtures/calloria-v6-42-main-anchors.fixture.js', import.meta.url);
const fixture = await readFile(fixtureUrl, 'utf8');
const context = () => {
  const warnings = [];
  return { warnings, warn: (message) => warnings.push(String(message)) };
};

test('connects the existing voice-consent panel to an explicit CRM response action', () => {
  const ctx = context();
  const result = api.transformMain(ctx, fixture);
  assert.ok(result, ctx.warnings.join('\n'));
  assert.match(result.code, /data-action="log-voice-response"/);
  assert.match(result.code, /A transcript is saved to this contact's case history only when I explicitly log it/);
  assert.match(result.code, /Microphone audio stays in this page's memory and is not saved/);
  assert.equal(ctx.warnings.length, 0);
});

test('adds communication rubric scoring and security-request escalation to active inbound calls', () => {
  const result = api.transformMain(context(), fixture);
  assert.ok(result);
  assert.match(result.code, /calloriaReviewVoiceResponseV642/);
  assert.match(result.code, /markers\.push\('empathy'\)/);
  assert.match(result.code, /markers\.push\('ownership'\)/);
  assert.match(result.code, /markers\.push\('clear next step'\)/);
  assert.match(result.code, /if\(review\.breach\)\{call\.breach=true;state\.incidents\+\+;\}/);
  assert.match(result.code, /case 'log-voice-response':calloriaLogVoiceResponseV642\(\);break;/);
});

test('writes explicitly logged agent statements into the permanent inbound CRM case transcript', () => {
  const result = api.transformMain(context(), fixture);
  assert.ok(result);
  assert.match(result.code, /messages:\(state\.currentCall\?\.voiceReplies\|\|\[\]\)\.map/);
  assert.match(result.code, /type:'agent',text:item\.text,at:item\.at,quality:item\.quality/);
  assert.match(result.code, /addCallTimeline\(call,'Agent response logged to the contact transcript'/);
});

test('skips safely if current application anchors have changed', () => {
  const ctx = context();
  const result = api.transformMain(ctx, 'function applyCallChoice(index){}');
  assert.equal(result, null);
  assert.equal(ctx.warnings.length, 1);
  assert.match(ctx.warnings[0], /skipped safely/);
});

test('does not apply the transform twice', () => {
  const ctx = context();
  const once = api.transformMain(ctx, fixture);
  assert.ok(once);
  const twice = api.transformMain(ctx, once.code);
  assert.equal(twice, null);
});
