import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Could not locate source section: ${start}`);
  return source.slice(a, b);
}

test('main application imports the campaign worklist and dialler lifecycle engine', () => {
  assert.match(main, /from '\.\/campaign-operations-engine\.js'/);
  assert.match(main, /startCampaignContact/);
  assert.match(main, /resolveDialAttempt/);
  assert.match(main, /finishCampaignContact/);
});

test('legacy save migration includes the outbound worklist without removing existing campaign history', () => {
  assert.match(main, /outboundWorklist:\s*\[\]/);
  assert.match(main, /'outboundSuppressions','outboundAttempts','outboundWorklist','cases'/);
  assert.match(main, /legacyCallback\.campaignContactId\s*=\s*first\.id/);
  assert.match(main, /legacyAttempt\s*=\s*state\.outboundAttempts\.find/);
});

test('campaign desk now renders multi-contact campaign worklists and operational queue metrics', () => {
  const renderer = section(main, 'function renderOutbound() {', 'function caseRow(c)');
  assert.match(renderer, /ensureOutboundWorklist\(\)/);
  assert.match(renderer, /campaignWorklistMetrics/);
  assert.match(renderer, /data-contact-id=/);
  assert.match(renderer, /ELIGIBLE TO DIAL/);
  assert.match(renderer, /RETRY WAITING/);
  assert.match(renderer, /ATTEMPT LIMIT/);
  assert.match(renderer, /campaignContactStatusLabel/);
  assert.match(renderer, /contact\.status!==['"]callback_scheduled['"]/);
});

test('contact start validates shift availability, suppression, contact eligibility and attempt limits', () => {
  const start = section(main, 'function beginOutboundDial(id,contactId){', 'function completeOutbound(){');
  assert.match(start, /isContactSuppressed/);
  assert.match(start, /campaignContactEligibility/);
  assert.match(start, /startOutbound\(id,contact\.id\)/);
  assert.match(start, /shiftTimeAvailable/);
});

test('each dial stores a contact-level reference and deterministic answered/no-answer outcome', () => {
  const start = section(main, 'function startOutbound(id,contactId,callbackId=null){', 'function completeOutbound(){');
  assert.match(start, /startCampaignContact/);
  assert.match(start, /resolveDialAttempt/);
  assert.match(start, /campaignContactId:contact\.id/);
  assert.match(start, /attemptNumber:started\.attemptNumber/);
  assert.match(start, /connectionOutcome:dialResult\.outcome/);
});

test('no-answer, busy and voicemail produce a distinct dial-result screen and required after-contact record', () => {
  const renderer = section(main, 'function renderOutbound() {', 'function caseRow(c)');
  const wrap = section(main, 'function beginOutboundWrapUp(){', 'function renderWrapUp(){');
  const wrapRenderer = section(main, 'function renderWrapUp(){', 'function saveWrapUp(){');
  assert.match(renderer, /active\.connectionOutcome/);
  assert.match(renderer, /complete-outbound-step/);
  assert.match(wrap, /no_answer/);
  assert.match(wrapRenderer, /wrap\.connectionOutcome/);
  assert.match(wrapRenderer, /retry policy applied/);
});

test('wrap-up persists worklist outcomes, retry times, attempt count and campaign contact ID', () => {
  const save = section(main, 'function saveWrapUp(){', 'function toggleCallHold(){');
  assert.match(save, /finishCampaignContact/);
  assert.match(save, /campaignContactId:workItem\.id/);
  assert.match(save, /attemptNumber:active\.attemptNumber/);
  assert.match(save, /nextEligibleAt:worklistResult\.nextEligibleAt/);
  assert.match(save, /connectionOutcome:wrap\.connectionOutcome/);
  assert.match(save, /attemptsRemaining:worklistResult\.attemptsRemaining/);
});

test('callback records retain the campaign worklist contact and resume through eligibility checks', () => {
  const save = section(main, 'function saveWrapUp(){', 'function toggleCallHold(){');
  const resume = section(main, 'function resumeOutboundCallback(callbackId){', 'function cancelOutbound(){');
  assert.match(save, /campaignContactId:workItem\.id/);
  assert.match(resume, /callback\.campaignContactId/);
  assert.match(resume, /startOutbound\(callback\.campaignId,workItem\.id,callbackId\)/);
});

test('customer opt-out enters the suppression register and terminates that worklist contact', () => {
  const save = section(main, 'function saveWrapUp(){', 'function toggleCallHold(){');
  const render = section(main, 'function renderOutbound() {', 'function caseRow(c)');
  assert.match(save, /outcome:outboundOutcome/);
  assert.match(save, /disposition==='opt_out'/);
  assert.match(render, /isContactSuppressed\(contact\.customer,suppressed\)/);
});

test('cancelled dial attempts are referred for review and do not silently return to ready', () => {
  const cancel = section(main, 'function cancelOutbound(){', 'function beginOutboundDial(id,contactId){');
  assert.match(cancel, /outcome:'abandoned'/);
  assert.match(cancel, /contact referred for review/);
  assert.match(cancel, /callback\.status='completed'/);
});

test('existing live outbound conversation engine and main application transcript form remain connected', () => {
  assert.match(main, /from '\.\/outbound-campaign-engine\.js'/);
  assert.match(main, /submitOutboundTurn\(active\.conversation/);
  assert.match(main, /outboundCampaignReplyForm/);
  assert.match(main, /activeOutboundTask\(active\)/);
});

test('production syntax script checks the new campaign operations module', () => {
  assert.match(packageJson.scripts.check, /node --check js\/campaign-operations-engine\.js/);
  assert.match(packageJson.scripts.check, /node --check js\/outbound-campaign-engine\.js/);
});

test('mobile styles cover contact worklist rows, retry outcome panel and dial controls', () => {
  assert.match(css, /\.campaign-contact-row/);
  assert.match(css, /\.campaign-contact-list/);
  assert.match(css, /\.dialler-result-panel/);
  assert.match(css, /@media\(max-width:760px\).*campaign-contact-row/s);
});

