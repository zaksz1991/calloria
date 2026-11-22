import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessCustomerRecoveryPlan } from '../js/customer-recovery-plan-engine-v723.js';
import { transformCustomerRecoveryPlanV723, calloriaCustomerRecoveryPlanPluginV723 } from '../build/calloria-customer-recovery-plan-v723.mjs';

const now = Date.parse('2026-11-22T10:00:00.000Z');
const interaction = (overrides = {}) => ({
  id: 'CASE-1', reference: 'CASE-1', caseReference: 'CASE-1', channel: 'email',
  title: 'Card payment query', status: 'Resolved', occurredAt: '2026-11-22T09:30:00.000Z',
  qa: 88, sentiment: 80, ...overrides
});
const context = (overrides = {}) => ({
  found: true, repeatCustomer: true,
  profile: { totalInteractions: 2, interactions: [interaction()] },
  interactions: [interaction()], previousChannels: ['email'], openCases: [],
  lastInteraction: interaction(), ...overrides
});

test('first contact receives standard handling and no artificial recovery signal', () => {
  const plan = assessCustomerRecoveryPlan({ found: false, profile: null, interactions: [], openCases: [] }, { channel: 'live_chat', now });
  assert.equal(plan.level, 'standard');
  assert.equal(plan.recentRepeatCount, 0);
  assert.equal(plan.openFollowUpCount, 0);
  assert.equal(plan.isReadOnly, true);
});

test('an outstanding escalated case creates urgent review priority', () => {
  const plan = assessCustomerRecoveryPlan(context({ openCases: [interaction({ status: 'Escalated - review required' })] }), { channel: 'social', now });
  assert.equal(plan.level, 'urgent');
  assert.equal(plan.urgentOpenCount, 1);
  assert.ok(plan.actions.some(action => action.includes('escalation or review owner')));
});

test('multiple outstanding cases create urgent priority', () => {
  const plan = assessCustomerRecoveryPlan(context({ openCases: [interaction({ status: 'Open' }), interaction({ id: 'CASE-2', reference: 'CASE-2', caseReference: 'CASE-2', status: 'Open' })] }), { channel: 'email', now });
  assert.equal(plan.level, 'urgent');
  assert.equal(plan.openFollowUpCount, 2);
});

test('one open follow-up creates priority recovery and avoids duplicate case advice', () => {
  const plan = assessCustomerRecoveryPlan(context({ openCases: [interaction({ status: 'Pending customer' })] }), { channel: 'live_chat', now });
  assert.equal(plan.level, 'priority');
  assert.ok(plan.actions.some(action => action.includes('duplicate')));
});

test('recent repeat contact is detected using supplied simulated clock', () => {
  const plan = assessCustomerRecoveryPlan(context(), { channel: 'email', now, repeatWindowMs: 24 * 60 * 60 * 1000 });
  assert.equal(plan.recentRepeatCount, 1);
  assert.equal(plan.level, 'priority');
});

test('old interactions outside the repeat window do not inflate recent repeats', () => {
  const old = interaction({ occurredAt: '2026-11-19T08:00:00.000Z' });
  const plan = assessCustomerRecoveryPlan(context({ profile: { totalInteractions: 3, interactions: [old] }, interactions: [old] }), { channel: 'email', now });
  assert.equal(plan.recentRepeatCount, 0);
  assert.equal(plan.level, 'watch');
});

test('cross-channel history is identified and prompts context carry-forward', () => {
  const plan = assessCustomerRecoveryPlan(context(), { channel: 'live_chat', now });
  assert.equal(plan.crossChannel, true);
  assert.ok(plan.actions.some(action => action.includes('previous channel history')));
});

test('low prior QA and sentiment increase recovery priority without inventing missing scores', () => {
  const weak = interaction({ qa: 62, sentiment: 25 });
  const plan = assessCustomerRecoveryPlan(context({ profile: { totalInteractions: 2, interactions: [weak] }, interactions: [weak] }), { channel: 'email', now });
  assert.equal(plan.level, 'priority');
  assert.equal(plan.lastQa, 62);
  assert.equal(plan.lastSentiment, 25);
});

test('missing QA and sentiment stay unavailable rather than becoming zero', () => {
  const noScores = interaction({ qa: null, sentiment: null });
  const plan = assessCustomerRecoveryPlan(context({ profile: { totalInteractions: 1, interactions: [noScores] }, interactions: [noScores], repeatCustomer: false }), { channel: 'email', now });
  assert.equal(plan.lastQa, null);
  assert.equal(plan.lastSentiment, null);
});

test('future-dated records do not count as recent repeats', () => {
  const future = interaction({ occurredAt: '2026-11-22T11:00:00.000Z' });
  const plan = assessCustomerRecoveryPlan(context({ profile: { totalInteractions: 2, interactions: [future] }, interactions: [future] }), { channel: 'email', now });
  assert.equal(plan.recentRepeatCount, 0);
});

test('duplicate open case references are counted once', () => {
  const item = interaction({ status: 'Open' });
  const plan = assessCustomerRecoveryPlan(context({ openCases: [item, { ...item, title: 'Duplicate copy' }] }), { channel: 'email', now });
  assert.equal(plan.openFollowUpCount, 1);
});

test('invalid input is handled safely', () => {
  const plan = assessCustomerRecoveryPlan(null, { channel: null, now: Number.NaN });
  assert.equal(plan.level, 'standard');
  assert.equal(plan.customerFound, false);
  assert.equal(plan.reasons.length, 0);
});

test('frozen continuity history remains unchanged after assessment', () => {
  const item = Object.freeze(interaction({ status: 'Pending customer' }));
  const profile = Object.freeze({ totalInteractions: 3, interactions: Object.freeze([item]) });
  const input = Object.freeze({ found: true, repeatCustomer: true, profile, interactions: Object.freeze([item]), previousChannels: Object.freeze(['email']), openCases: Object.freeze([item]) });
  const plan = assessCustomerRecoveryPlan(input, { channel: 'social', now });
  assert.equal(plan.level, 'priority');
  assert.equal(input.profile.interactions.length, 1);
  assert.equal(input.openCases.length, 1);
});

test('repeated low-quality contacts raise urgent recovery only when the evidence threshold is met', () => {
  const weak = interaction({ qa: 60, sentiment: 30 });
  const repeated = [
    weak,
    { ...weak, id: 'CASE-2', reference: 'CASE-2', caseReference: 'CASE-2', occurredAt: '2026-11-22T09:40:00.000Z' },
    { ...weak, id: 'CASE-3', reference: 'CASE-3', caseReference: 'CASE-3', occurredAt: '2026-11-22T09:50:00.000Z' }
  ];
  const plan = assessCustomerRecoveryPlan(context({ profile: { totalInteractions: 3, interactions: repeated }, interactions: repeated }), { channel: 'live_chat', now });
  assert.equal(plan.level, 'urgent');
  assert.equal(plan.recentRepeatCount, 3);
});

const sourceFixture = readFileSync(new URL('./fixtures/customer-continuity-panel.fixture.js', import.meta.url), 'utf8');

test('source transform injects the recovery module, stylesheet and panel exactly once', () => {
  const result = transformCustomerRecoveryPlanV723(sourceFixture);
  assert.equal(result.changed, true);
  assert.match(result.code, /customer-recovery-plan-engine-v723\.js/);
  assert.match(result.code, /customer-recovery-plan-v723\.css/);
  assert.match(result.code, /assessCustomerRecoveryPlan\(context, \{ channel, now: queueSimulationNowMs\(\) \}\)/);
  assert.match(result.code, /\$\{recoveryPlanHtml\}/);
  assert.match(result.code, /CUSTOMER_RECOVERY_PLAN/);
});

test('source transform is idempotent', () => {
  const once = transformCustomerRecoveryPlanV723(sourceFixture);
  const twice = transformCustomerRecoveryPlanV723(once.code);
  assert.equal(twice.alreadyPatched, true);
  assert.equal(twice.changed, false);
  assert.equal(twice.code, once.code);
});

test('source drift refuses a partial transform', () => {
  const changed = sourceFixture.replace('function renderCustomerContinuityPanel', 'function renamedCustomerPanel');
  const result = transformCustomerRecoveryPlanV723(changed);
  assert.equal(result.changed, false);
  assert.match(result.reason, /Customer 360 panel function/);
  assert.equal(result.code, changed);
});

test('plugin only transforms main.js and reports safely on source drift', () => {
  const plugin = calloriaCustomerRecoveryPlanPluginV723();
  assert.equal(plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/other.js'), null);
  const transformed = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  assert.ok(transformed?.code.includes('CALLORIA_V723_CUSTOMER_RECOVERY_PLAN'));
  let warning = '';
  const skipped = plugin.transform.call({ warn(message) { warning = message; } }, 'export const changed = true;', '/repo/js/main.js');
  assert.equal(skipped, null);
  assert.match(warning, /skipped safely/);
});
