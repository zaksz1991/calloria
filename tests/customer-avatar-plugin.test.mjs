import test from 'node:test';
import assert from 'node:assert/strict';
import { calloriaCustomerAvatarPlugin } from '../build/calloria-customer-avatar-plugin.js';

function transform(source, id) {
  const plugin = calloriaCustomerAvatarPlugin();
  const context = { error(message) { throw new Error(message); } };
  return plugin.transform.call(context, source, id);
}

const engineFixture = `
export const CUSTOMER_PERSONAS = Object.freeze([
  { id: 'business', label: 'Business customer under time pressure', patience: 35, emotion: 'urgent', style: 'concise' }
]);
const followUps = {
    calm: ['Thank you. What should I expect after this conversation?', 'That is clear. Please confirm the reference and next step.']
};
`;

const mainFixture = `
import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';
function renderCustomerIntelligence() {
  const session = state.customerLabSession;
  if (session) {
    const latest = session.scorecards?.at(-1);
    const activePanel = \`<span class="pill">TURN \u0024{session.turn}/3</span></div><div class="article-box"><div class="subtle-label">CUSTOMER STATEMENT</div>\`;
  }
  viewRoot.innerHTML = 'test';
}

function activeAICloudContext() {
  return null;
}
`;

test('engine transform adds realistic non-derogatory customer behaviour profiles and lines', () => {
  const result = transform(engineFixture, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result.code.includes("id: 'happy'"));
  assert.ok(result.code.includes("id: 'playful'"));
  assert.ok(result.code.includes("id: 'hostile'"));
  assert.ok(result.code.includes('I am overwhelmed'));
});

test('main transform inserts a synthetic 3D customer stage and lifecycle mount', () => {
  const result = transform(mainFixture, '/repo/js/main.js');
  assert.ok(result.code.includes("from './customer-avatar-stage.js'"));
  assert.ok(result.code.includes('data-calloria-customer-stage'));
  assert.ok(result.code.includes('mountCalloriaCustomerAvatar(customerAvatarHost).catch'));
  assert.ok(result.code.includes('const avatarStageMarkup = `<div'));
  assert.ok(result.code.includes('${escapeHTML(session.persona.id)}'));
});

test('main transform refuses stale source rather than silently skipping integration', () => {
  assert.throws(() => transform('function renderCustomerIntelligence() {}', '/repo/js/main.js'), /expected exactly one/);
});
