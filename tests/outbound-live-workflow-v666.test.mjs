import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Could not locate source section: ${start}`);
  return source.slice(a, b);
}

test('live agent application imports the actual outbound conversation engine', () => {
  assert.match(main, /import \{ createOutboundConversation, submitOutboundTurn, outboundConversationSummary \} from '\.\/outbound-campaign-engine\.js';/);
});

test('outbound workbench renders a live transcript and free-form agent response instead of quiz choices', () => {
  const renderer = section(main, 'function renderOutbound() {', 'function caseRow(c)');
  assert.match(renderer, /outboundCampaignReplyForm/);
  assert.match(renderer, /outbound-live-transcript/);
  assert.match(renderer, /outboundCampaignReplyForm/);
  assert.match(renderer, /Play customer voice/);
  assert.match(renderer, /Request supervisor/);
  assert.doesNotMatch(renderer, /data-outbound-choice/);
  assert.doesNotMatch(renderer, /step\.options\.map/);
});

test('agent replies update customer conversation state and enforce opt-out and critical-breach handling', () => {
  const submit = section(main, "if(e.target.id==='outboundCampaignReplyForm')", "if(e.target.id==='customerLabReplyForm')");
  assert.match(submit, /submitOutboundTurn\(active\.conversation/);
  assert.match(submit, /state\.incidents\+=newBreaches/);
  assert.match(submit, /addSuppression\(state\.outboundSuppressions/);
  assert.match(submit, /summary\.criticalBreaches/);
  assert.match(submit, /pushOperationEvent\('campaign'/);
});

test('outbound wrap-up persists the transcript, customer decision and QA scorecards into CRM and attempt history', () => {
  const save = section(main, 'function saveWrapUp(){', 'function toggleCallHold(){');
  assert.match(save, /messages:transcript/);
  assert.match(save, /scorecards/);
  assert.match(save, /customerDecision/);
  assert.match(save, /callbackRequested/);
  assert.match(save, /criticalBreaches/);
  assert.match(save, /customerDecision==='accepted'/);
  assert.match(save, /Outbound campaign conversation requires supervisor \/ compliance review/);
});

test('outbound wrap-up permits specialist review when the dialogue engine requests it', () => {
  const begin = section(main, 'function beginOutboundWrapUp(){', 'function renderWrapUp(){');
  const render = section(main, 'function renderWrapUp(){', 'function saveWrapUp(){');
  assert.match(begin, /outboundConversationSummary/);
  assert.match(begin, /defaultDisposition/);
  assert.match(render, /wrap\.defaultDisposition==='review'/);
});

test('outbound voice playback and supervisor assistance are connected to the live agent actions', () => {
  const actions = section(main, 'function handleAction(action,event={}){', "document.addEventListener('click'");
  assert.match(actions, /case 'play-outbound-customer'/);
  assert.match(actions, /case 'request-outbound-supervisor'/);
  assert.match(actions, /Outbound voice/);
});

test('Vite no longer relies on the obsolete v4.5 transform that skipped the current v6.65 main source', () => {
  assert.doesNotMatch(vite, /calloriaOutboundCampaignV45Plugin/);
  assert.match(packageJson.scripts.check, /node --check js\/outbound-campaign-engine\.js/);
});
