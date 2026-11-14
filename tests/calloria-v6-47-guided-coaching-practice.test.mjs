import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { __calloriaV647Test as api } from '../build/calloria-guided-coaching-practice-v6-47.mjs';

const base = await readFile(new URL('./fixtures/generated-v6-46-main.js', import.meta.url), 'utf8');
const makeContext = () => ({ warnings: [], warn(message) { this.warnings.push(String(message)); } });
function transformed(source = base) {
  const ctx = makeContext();
  const result = api.transformMain(ctx, source);
  assert.ok(result, ctx.warnings.join('\n') || 'Expected v6.47 transform to match v6.46 output.');
  return { ctx, code: result.code };
}
function runtime(code) {
  const records = [];
  const events = [];
  const sandbox = {
    state: { coachingSessions: records, applicantName: 'Supervisor' },
    pushOperationEvent(...args) { events.push(args); },
    escapeHTML(value) { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;'); },
    document: { getElementById: () => null, createElement: () => ({ style: {}, append() {} }), head: { append() {} }, addEventListener() {} },
    console
  };
  vm.runInNewContext(code + `;
    globalThis.__scenario=calloriaCoachingPracticeScenarioV647;
    globalThis.__redact=calloriaRedactPracticeTextV647;
    globalThis.__open=calloriaOpenQACoachingPracticeV647;
    globalThis.__evaluate=calloriaEvaluateQACoachingPracticeV647;
    globalThis.__render=calloriaRenderQACoachingPracticeV647;
  `, sandbox);
  return { sandbox, records, events };
}
function coaching(overrides = {}) {
  return { id: 'COACH-1', source: 'qa-human-review-v646', sourceReviewId: 'HQA-1', sourceInteractionId: 'INB-1', criterionId: 'ownership', topic: 'Ownership and follow-up', actionPlan: 'Take responsibility and give a clear timeframe.', status: 'delivered', ...overrides };
}

test('requires v6.46, installs after its QA renderer, and skips already transformed source', async () => {
  const ctx = makeContext();
  assert.equal(api.transformMain(ctx, 'function main(){}'), null);
  assert.match(ctx.warnings[0], /Install v6\.46 first/);
  const { code } = transformed();
  assert.match(code, /__CALLORIA_GUIDED_COACHING_PRACTICE_V647__/);
  assert.match(code, /Launch guided practice/);
  assert.match(code, /data-qa-coaching-practice/);
  assert.match(code, /qa-coaching-practice-open/);
  assert.match(code, /practice feedback is formative only/i);
  assert.equal(api.transformMain(makeContext(), code), null);
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloriaGuidedCoachingPracticePlugin/);
  assert.ok(config.indexOf('calloriaQACoachingFollowThroughPlugin()') < config.indexOf('calloriaGuidedCoachingPracticePlugin()'));
});

test('selects a criterion-specific role-play for compliance, empathy, ownership and documentation', () => {
  const { code } = transformed();
  const { sandbox } = runtime(code);
  assert.equal(sandbox.__scenario(coaching({ criterionId: 'credential_request', topic: 'Critical compliance remediation' })).type, 'compliance');
  assert.equal(sandbox.__scenario(coaching({ criterionId: 'listening', topic: 'Empathy and active listening' })).type, 'empathy');
  assert.equal(sandbox.__scenario(coaching({ criterionId: 'ownership', topic: 'Service recovery' })).type, 'ownership');
  assert.equal(sandbox.__scenario(coaching({ criterionId: 'crm-logging', topic: 'CRM documentation accuracy' })).type, 'documentation');
});

test('practice response receives checklist feedback and is stored without changing the QA coaching status', () => {
  const { code } = transformed();
  const { sandbox, records, events } = runtime(code);
  const record = coaching();
  records.push(record);
  assert.equal(sandbox.__open(record.id), true);
  assert.equal(record.practiceOpen, true);
  const attempt = sandbox.__evaluate({ id: record.id, response: "I will take ownership. I will check your case and update you within one business day." });
  assert.equal(attempt.score, 100);
  assert.equal(attempt.checks.every(item => item.passed), true);
  assert.equal(record.practiceAttempts.length, 1);
  assert.equal(record.status, 'delivered', 'practice must not verify or close a coaching plan');
  assert.equal(record.practiceOpen, false);
  assert.equal(events.length, 1);
  assert.match(events[0][2], /Guided practice completed/);
});

test('formative practice identifies missed points and keeps the response redacted', () => {
  const { code } = transformed();
  const { sandbox, records } = runtime(code);
  const record = coaching({ criterionId: 'compliance', topic: 'Critical compliance remediation', priority: 'critical' });
  records.push(record);
  const attempt = sandbox.__evaluate({ id: record.id, response: 'My password is abc123 and my email is sample@example.com. I will ask for the OTP and then check it.' });
  assert.ok(attempt.score < 100);
  assert.match(attempt.feedback, /Work on/);
  assert.match(attempt.responseRedacted, /password \[redacted\]/i);
  assert.match(attempt.responseRedacted, /\[email redacted\]/);
  assert.doesNotMatch(attempt.responseRedacted, /abc123|sample@example.com/);
});

test('rejects short responses, unknown plans and verified plans', () => {
  const { code } = transformed();
  const { sandbox, records } = runtime(code);
  assert.throws(() => sandbox.__evaluate({ id: 'missing', response: 'A sufficiently long response for the customer.' }), /not available/);
  const record = coaching();
  records.push(record);
  assert.throws(() => sandbox.__evaluate({ id: record.id, response: 'Too short' }), /20 to 1,200 characters/);
  record.status = 'verified';
  assert.equal(sandbox.__open(record.id), false);
  assert.throws(() => sandbox.__evaluate({ id: record.id, response: 'I will check the case and update you within one day.' }), /not available/);
});

test('renders practice feedback safely and preserves the human-review boundary', () => {
  const { code } = transformed();
  const { sandbox, records } = runtime(code);
  const record = coaching({ practiceOpen: true });
  records.push(record);
  const openHtml = sandbox.__render(record);
  assert.match(openHtml, /Secure|guided practice|Practice goal/i);
  assert.match(openHtml, /data-qa-coaching-practice/);
  const attempt = sandbox.__evaluate({ id: record.id, response: 'I will take ownership, check your case and update you within one business day.' });
  const resultHtml = sandbox.__render(record);
  assert.match(resultHtml, /Latest practice/);
  assert.match(resultHtml, new RegExp(String(attempt.score)));
  assert.match(resultHtml, /formative only/i);
  assert.equal(record.status, 'delivered');
});

test('transformed application remains valid JavaScript and leaves the existing follow-up handler intact', () => {
  const { code } = transformed();
  assert.doesNotThrow(() => new vm.Script(code));
  assert.match(code, /calloriaRecordQACoachingFollowUpV646\(/);
  assert.match(code, /Only delivered QA coaching plans can receive a follow-up outcome/);
  assert.match(code, /calloriaEvaluateQACoachingPracticeV647\(/);
});
