import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWrapEvidencePanel, validateWrapEvidence } from '../js/calloria-wrap-evidence-v711.js';
import { calloriaAfterContactEvidenceGatePluginV711 } from '../build/calloria-after-contact-evidence-gate-v711.mjs';

const baseValues = {
  category: 'payments_transactions',
  rootCause: 'process_delay',
  action: 'service_resolved',
  customerUnderstanding: 'confirmed',
  factsConfirmed: true
};

test('renders all five required evidence controls', () => {
  const html = renderWrapEvidencePanel({ disposition: 'resolved' });
  for (const id of ['wrapIssueCategory', 'wrapRootCause', 'wrapPrimaryAction', 'wrapCustomerUnderstanding', 'wrapFactsConfirmed']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});
test('preselects callback action and customer confirmation', () => {
  const html = renderWrapEvidencePanel({ disposition: 'callback' });
  assert.match(html, /value="callback_agreed" selected/);
  assert.match(html, /value="confirmed" selected/);
});
test('preselects no-contact evidence for an unanswered outbound attempt', () => {
  const html = renderWrapEvidencePanel({ disposition: 'no_answer', noConnectOutcome: true });
  assert.match(html, /value="no_contact" selected/);
  assert.match(html, /value="not_reached" selected/);
});
test('accepts structured evidence for a resolved case', () => {
  const result = validateWrapEvidence({ disposition: 'resolved', values: baseValues, notes: 'Customer confirmed the payment issue is resolved.' });
  assert.equal(result.ok, true);
  assert.equal(result.evidence.version, '7.11');
  assert.equal(result.evidence.issueCategory, 'payments_transactions');
});
test('rejects missing evidence and focuses the first missing field', () => {
  const result = validateWrapEvidence({ disposition: 'resolved', values: {}, notes: 'A sufficiently detailed factual note.' });
  assert.equal(result.ok, false);
  assert.equal(result.focusId, 'wrapIssueCategory');
});
test('rejects unconfirmed understanding on a completed resolution', () => {
  const result = validateWrapEvidence({ disposition: 'resolved', values: { ...baseValues, customerUnderstanding: 'not_confirmed' }, notes: 'Customer still needs clarification.' });
  assert.equal(result.ok, false);
  assert.equal(result.focusId, 'wrapCustomerUnderstanding');
});
test('requires specialist action for escalations and review cases', () => {
  const result = validateWrapEvidence({ disposition: 'escalated', values: { ...baseValues, action: 'service_resolved' }, notes: 'Issue requires specialist investigation.' });
  assert.equal(result.ok, false);
  assert.equal(result.focusId, 'wrapPrimaryAction');
});
test('requires callback agreement and customer confirmation', () => {
  const result = validateWrapEvidence({ disposition: 'callback', values: { ...baseValues, action: 'service_resolved' }, notes: 'Customer agreed to receive an update tomorrow.' });
  assert.equal(result.ok, false);
});
test('requires opt-out recording for an opt-out disposition', () => {
  const result = validateWrapEvidence({ disposition: 'opt_out', values: { ...baseValues, action: 'information_provided' }, notes: 'Customer requested no further campaign contact.' });
  assert.equal(result.ok, false);
});
test('requires no-contact evidence for no-answer / busy / voicemail', () => {
  const result = validateWrapEvidence({ disposition: 'no_answer', noConnectOutcome: true, values: { ...baseValues, action: 'service_resolved' }, notes: 'No answer; retry policy applied.' });
  assert.equal(result.ok, false);
});
test('requires factual notes acknowledgement', () => {
  const result = validateWrapEvidence({ disposition: 'resolved', values: { ...baseValues, factsConfirmed: false }, notes: 'Customer confirmed the service now works.' });
  assert.equal(result.ok, false);
  assert.equal(result.focusId, 'wrapFactsConfirmed');
});
test('persists stable labels and timestamps in the evidence object', () => {
  const result = validateWrapEvidence({ disposition: 'resolved', values: baseValues, notes: 'Resolution documented.', capturedAt: '2026-11-22T00:00:00.000Z' });
  assert.equal(result.evidence.issueCategoryLabel, 'Payments / transactions');
  assert.equal(result.evidence.primaryActionLabel, 'Issue resolved during contact');
  assert.equal(result.evidence.capturedAt, '2026-11-22T00:00:00.000Z');
});
test('Vite plugin injects panel, pre-save gate and persisted evidence for both directions', () => {
  const plugin = calloriaAfterContactEvidenceGatePluginV711();
  const fixture = `let THREE = null;
function renderWrapUp(){
  viewRoot.innerHTML=\`<div class="article-box"><h4>After-contact checklist</h4>\`;
}
function saveWrapUp(){
  if(!allowedDispositions.includes(disposition)){toast('Choose a permitted final disposition for this interaction.','error');return;}
  const createdAt=new Date().toISOString();
  const record={timeline:contact.timeline.slice()};state.cases.push(record);recordCustomerContinuityFromCase(record,
  state.outboundAttempts.push(attemptRecord);
  state.cases.push(outboundCase);
}`;
  const result = plugin.transform(fixture, '/project/js/main.js');
  assert.ok(result.code.includes("from './calloria-wrap-evidence-v711.js'"));
  assert.ok(result.code.includes('renderWrapEvidencePanel({ disposition: defaultDisposition, noConnectOutcome })'));
  assert.ok(result.code.includes('validateWrapEvidence({disposition,noConnectOutcome'));
  assert.ok(result.code.includes('record.wrapEvidence=qualityEvidence'));
  assert.ok(result.code.includes('attemptRecord.wrapEvidence=qualityEvidence'));
  assert.ok(result.code.includes('outboundCase.wrapEvidence=qualityEvidence'));
  assert.equal(plugin.transform(result.code, '/project/js/main.js'), null);
});
test('Vite plugin does not patch unrelated files', () => {
  const plugin = calloriaAfterContactEvidenceGatePluginV711();
  assert.equal(plugin.transform('not a main entry', '/project/js/operations-engine.js'), null);
});
test('Vite plugin fails closed when source anchors are missing or ambiguous', () => {
  const plugin = calloriaAfterContactEvidenceGatePluginV711();
  assert.throws(() => plugin.transform('let THREE = null;', '/project/js/main.js'), /source rebase failed/);
});
