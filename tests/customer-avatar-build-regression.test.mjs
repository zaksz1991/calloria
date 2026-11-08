import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

function assertSyntax(source, filename) {
  const dir = mkdtempSync(join(tmpdir(), 'calloria-avatar-build-'));
  try {
    const file = join(dir, filename);
    writeFileSync(file, source);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stderr || result.stdout}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('main transform accepts CRLF source and mounts inside the customer renderer', () => {
  const crlf = mainFixture.replace(/\n/g, '\r\n');
  const result = transform(crlf, '/repo/js/main.js');
  assert.ok(result?.code.includes("from './customer-avatar-stage.js'"));
  assert.ok(result.code.includes('data-calloria-customer-stage'));
  assert.ok(result.code.includes('mountCalloriaCustomerAvatar(customerAvatarHost).catch'));
  const mountIndex = result.code.indexOf('const customerAvatarHost');
  const rendererClose = result.code.indexOf('\n}\nfunction activeAICloudContext');
  assert.ok(mountIndex > 0);
  assert.ok(rendererClose > mountIndex, 'mount code must remain inside renderCustomerIntelligence');
  assertSyntax(result.code, 'main-transformed.mjs');
});

test('main transform remains idempotent', () => {
  const first = transform(mainFixture, '/repo/js/main.js');
  assert.ok(first?.code);
  assert.equal(transform(first.code, '/repo/js/main.js'), null);
});

test('customer-engine transform adds profiles and valid escaped multiline follow-ups', () => {
  const crlf = engineFixture.replace(/\n/g, '\r\n');
  const result = transform(crlf, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result.code.includes("id\":\"happy\""));
  assert.ok(result.code.includes('I am worried I may lose access.\\nCan you guide me one step at a time?'));
  assert.ok(result.code.includes('I am overwhelmed.\\nPlease slow down and tell me the first thing I should do.'));
  assert.doesNotMatch(result.code, /access\.\nCan you guide/);
  assertSyntax(result.code, 'engine-transformed.mjs');
});

test('stale main source still fails safely', () => {
  assert.throws(
    () => transform('function renderCustomerIntelligence() {}', '/repo/js/main.js'),
    /expected exactly one/
  );
});
