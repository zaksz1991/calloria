import test from 'node:test';
import assert from 'node:assert/strict';
import { transformMainV693, calloriaAnalyseCustomerRecoveryV693 } from '../build/calloria-customer-recovery-insights-v6-93.mjs';

const fixture = `function renderCustomerContinuityPanel(customer, channel, identity = {}) {
  const context = getCustomerContinuityContext(state.customerContinuity, { customer, customerRef: identity.customerRef || identity.customerId });
  const metrics = customerContinuityMetrics(state.customerContinuity);
  const last = context.lastInteraction;
  const matchLabel = context.matchBasis === 'reference' ? 'Shared synthetic customer reference' : 'Synthetic display-name match';
  const history = context.interactions.map(item => \`<div class="data-row"><span>\${escapeHTML(item.title)}<small>\${escapeHTML(item.channel.replaceAll('_', ' '))} · \${new Date(item.occurredAt).toLocaleString()}</small></span><strong>\${escapeHTML(item.status)}</strong></div>\`).join('');
  const openCases = context.openCases.slice(0, 3).map(item => \`<div class="data-row"><span>\${escapeHTML(item.caseReference || item.reference || 'Open follow-up')}<small>\${escapeHTML(item.title)}</small></span><strong>\${escapeHTML(item.status)}</strong></div>\`).join('');
  return \`<section class="panel customer-continuity-panel"><div class="panel-head"><div><h3>Customer 360 continuity</h3><p>Previous contacts across voice, email, live chat and social.</p></div><span class="pill \${context.repeatCustomer ? 'amber' : 'green'}">\${context.repeatCustomer ? 'RETURNING CUSTOMER' : context.found ? 'PREVIOUS CONTACT' : 'FIRST RECORDED CONTACT'}</span></div><div class="data-list"><div class="data-row"><span>Recorded interactions</span><strong>\${context.profile?.totalInteractions || 0}</strong></div><div class="data-row"><span>Previous channels</span><strong>\${context.previousChannels.length ? context.previousChannels.map(item => escapeHTML(item.replaceAll('_', ' '))).join(', ') : 'None recorded'}</strong></div><div class="data-row"><span>Open follow-ups</span><strong>\${context.openCases.length}</strong></div><div class="data-row"><span>Last contact</span><strong>\${last ? new Date(last.occurredAt).toLocaleString() : 'No history'}</strong></div></div>\${openCases ? '<h4>Outstanding customer work</h4>'+openCases : ''}\${history ? '<h4>Recent interaction history</h4>'+history : '<p>No earlier customer interaction is recorded.</p>'}</section>\`;
}
function ensureInboundQueue(count = 6) { return count; }
`;

test('injects recovery brief once into current Customer 360 template', () => {
  const result = transformMainV693(fixture);
  assert.match(result, /__CALLORIA_CUSTOMER_RECOVERY_INSIGHTS_V693__/);
  assert.match(result, /calloriaAnalyseCustomerRecoveryV693\(context\)/);
  assert.match(result, /calloriaRenderCustomerRecoveryV693\(recovery\)/);
  assert.match(result, /\$\{recoveryPanel\}/);
  assert.match(result, /aria-label="Customer recovery guidance"/);
  assert.doesNotThrow(() => new Function(result), 'transformed panel JavaScript must parse');
});

test('transform is idempotent', () => {
  const once = transformMainV693(fixture);
  const twice = transformMainV693(once);
  assert.equal(twice, once);
});

test('refuses changed source without returning a partial transform', () => {
  assert.throws(() => transformMainV693('function somethingElse() {}'), /No partial transform was applied/);
});


test('repeat contact plus open follow-up is prioritised for recovery', () => {
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const context = {
    matchBasis: 'reference',
    profile: { interactions: [
      { id: '2', occurredAt: new Date(now - 60_000).toISOString(), channel: 'live_chat', qa: null, sentiment: null },
      { id: '1', occurredAt: new Date(now - 120_000).toISOString(), channel: 'inbound_voice', qa: null, sentiment: null }
    ] },
    openCases: [{ status: 'in_progress' }]
  };
  const result = calloriaAnalyseCustomerRecoveryV693(context, now);
  assert.equal(result.priority, 'high');
  assert.equal(result.repeatWithin24h, true);
  assert.equal(result.channelBounce, true);
  assert.equal(result.openCount, 1);
  assert.equal(result.confidence, 'REFERENCE MATCH');
  assert.ok(result.actions.some(item => item.includes('repeat contact')));
});

test('one contact and no outstanding work remains routine', () => {
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const result = calloriaAnalyseCustomerRecoveryV693({
    matchBasis: 'name',
    profile: { interactions: [{ id: '1', occurredAt: new Date(now - 5_000).toISOString(), channel: 'inbound_voice', qa: null, sentiment: null }] },
    openCases: []
  }, now);
  assert.equal(result.priority, 'routine');
  assert.equal(result.effortScore, 0);
  assert.equal(result.weakQA, false);
  assert.equal(result.weakSentiment, false);
});

test('contacts outside the 72-hour window do not create cross-channel bounce signals', () => {
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const result = calloriaAnalyseCustomerRecoveryV693({
    matchBasis: 'name',
    profile: { interactions: [
      { id: '2', occurredAt: new Date(now - 5 * 86400000).toISOString(), channel: 'social', qa: null, sentiment: null },
      { id: '1', occurredAt: new Date(now - 6 * 86400000).toISOString(), channel: 'inbound_voice', qa: null, sentiment: null }
    ] },
    openCases: []
  }, now);
  assert.equal(result.channelBounce, false);
  assert.equal(result.recent72h, 0);
});

test('low recorded sentiment raises an attention flag but unknown sentiment does not', () => {
  const now = Date.parse('2026-11-21T12:00:00.000Z');
  const low = calloriaAnalyseCustomerRecoveryV693({
    profile: { interactions: [{ id: '1', occurredAt: new Date(now - 1_000).toISOString(), channel: 'email', sentiment: 25, qa: null }] },
    openCases: [], matchBasis: 'reference'
  }, now);
  assert.equal(low.weakSentiment, true);
  assert.equal(low.priority, 'elevated');
  const unknown = calloriaAnalyseCustomerRecoveryV693({
    profile: { interactions: [{ id: '1', occurredAt: new Date(now - 1_000).toISOString(), channel: 'email', sentiment: null, qa: null }] },
    openCases: [], matchBasis: 'reference'
  }, now);
  assert.equal(unknown.weakSentiment, false);
  assert.equal(unknown.weakQA, false);
});
