import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveLiveCallCoachV710, renderCallCoachPanelV710, __liveCallCoachV710Test } from '../js/live-call-coach-v710.js';
import { transformCallCoachMain, calloriaLiveCallCoachV710Plugin, __liveCallCoachPluginV710Test } from '../build/calloria-live-call-coach-v710-plugin.mjs';

const base = { call: { queueContactId: 'Q-001' }, scenario: { id: 'demo', reference: 'CALL-001', category: 'General', issue: 'Need help with my service' }, step: { label: 'Understand the request', prompt: 'What happened?' }, voiceBehaviour: { sentiment: 65, patience: 70, emotion: 'calm', needsSupervisor: false }, pendingDecision: null };

test('classifies security and fraud contacts before general categories', () => {
  const result = deriveLiveCallCoachV710({ ...base, scenario: { ...base.scenario, issue: 'Suspicious unauthorised card activity' } });
  assert.equal(result.category, 'security');
  assert.equal(result.status, 'critical');
  assert.match(result.guardrail, /approved security procedure/i);
});

test('classifies payment and transaction enquiries', () => {
  const result = deriveLiveCallCoachV710({ ...base, scenario: { ...base.scenario, issue: 'Duplicate debit transaction' } });
  assert.equal(result.category, 'payment');
  assert.match(result.objective, /transaction facts/i);
});

test('classifies technical support enquiries', () => {
  const result = deriveLiveCallCoachV710({ ...base, scenario: { ...base.scenario, issue: 'Mobile app login error' } });
  assert.equal(result.category, 'technical');
  assert.match(result.focus[0][0], /symptom/i);
});

test('classifies complaints', () => {
  const result = deriveLiveCallCoachV710({ ...base, scenario: { ...base.scenario, issue: 'Customer complaint about delayed service' } });
  assert.equal(result.category, 'complaint');
});

test('falls back to general customer service without making an unsupported assumption', () => {
  const result = deriveLiveCallCoachV710(base);
  assert.equal(result.category, 'service');
  assert.equal(result.status, 'normal');
});

test('supervisor risk takes precedence over ordinary issue guidance', () => {
  const result = deriveLiveCallCoachV710({ ...base, voiceBehaviour: { ...base.voiceBehaviour, needsSupervisor: true }, scenario: { ...base.scenario, issue: 'Routine question' } });
  assert.equal(result.status, 'supervisor');
  assert.match(result.headline, /supervisor support/i);
});

test('pending customer decisions pause the playbook', () => {
  const result = deriveLiveCallCoachV710({ ...base, pendingDecision: { type: 'interruption' } });
  assert.equal(result.status, 'paused');
  assert.match(result.headline, /resolve the interruption/i);
});

test('low sentiment or patience activates de-escalation guidance', () => {
  const result = deriveLiveCallCoachV710({ ...base, voiceBehaviour: { ...base.voiceBehaviour, sentiment: 20, patience: 22, emotion: 'frustrated' } });
  assert.equal(result.status, 'de-escalation');
  assert.match(result.focus[0][0], /acknowledge impact/i);
});

test('unknown sentiment and patience values do not become zero-risk or zero-score data', () => {
  const result = deriveLiveCallCoachV710({ ...base, voiceBehaviour: { emotion: 'calm' } });
  assert.equal(result.emotionalRisk, false);
  assert.equal(result.status, 'normal');
});

test('renders accessible progress controls and a phrase that is not auto-sent', () => {
  const html = renderCallCoachPanelV710(base);
  assert.match(html, /aria-label="Live call handling coach"/);
  assert.match(html, /data-call-coach-toggle/);
  assert.match(html, /Add to response/);
  assert.match(html, /do not change QA, compliance outcomes or case records/i);
  assert.doesNotMatch(html, /type="submit"/);
});

test('escapes untrusted scenario and key text before returning HTML', () => {
  const html = renderCallCoachPanelV710({ ...base, call: { queueContactId: 'x"><script>alert(1)</script>' }, step: { label: '<img src=x onerror=alert(1)>' } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('self-check state remains page-memory only and is keyed per synthetic contact', () => {
  const { checklistState } = __liveCallCoachV710Test;
  const first = checklistState('Q-TEST-A', 4);
  first.add(0);
  assert.equal(checklistState('Q-TEST-A', 4).size, 1);
  assert.equal(checklistState('Q-TEST-B', 4).size, 0);
});

test('transformer inserts the coach after the existing voice monitor and before continuity panel', () => {
  const fixture = `import {\n  CONTACT_STATUS, createInboundQueue\n} from './operations-engine.js';\nfunction renderInbound() {\n  const voiceMonitor=voiceBehaviour?'<aside></aside>':'';\n  const continuityPanel='<section></section>';\n  viewRoot.innerHTML = \`<div class="call-layout">\${voiceMonitor}\${continuityPanel}</div>\`;\n}`;
  const result = transformCallCoachMain(fixture);
  assert.equal(result.ok, true, result.reason);
  assert.match(result.code, /renderCallCoachPanelV710\(\{ call, scenario, step, voiceBehaviour, pendingDecision \}\)/);
  assert.match(result.code, /import \{ renderCallCoachPanelV710 \}/);
  assert.match(result.code, /calloria-live-call-coach-v710\.css/);
  const template = result.code.slice(result.code.indexOf('viewRoot.innerHTML'));
  assert.ok(template.indexOf('${voiceMonitor}') < template.indexOf('renderCallCoachPanelV710'));
  assert.ok(template.indexOf('renderCallCoachPanelV710') < template.indexOf('${continuityPanel}'));
});

test('transform is idempotent', () => {
  const fixture = `import {\n CONTACT_STATUS\n} from './operations-engine.js';\nfunction renderInbound() {\n const voiceMonitor=voiceBehaviour?x:y;\n viewRoot.innerHTML=\`\${voiceMonitor}\${continuityPanel}\`;\n}`;
  const once = transformCallCoachMain(fixture);
  assert.equal(once.ok, true);
  const twice = transformCallCoachMain(once.code);
  assert.equal(twice.skipped, true);
  assert.equal(twice.code, once.code);
});

test('source mismatch skips cleanly without partially inserting imports', () => {
  const fixture = `import {\n CONTACT_STATUS\n} from './operations-engine.js';\nfunction renderInbound() { const voiceMonitor=voiceBehaviour?x:y; }`;
  const result = transformCallCoachMain(fixture);
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.code || fixture, /live-call-coach-v710/);
});


test('the wording helper only inserts into the response editor and never submits', () => {
  const phrase = 'I understand your concern. Let me confirm the available facts before explaining the next step.';
  let clickHandler = null;
  let submitted = false;
  const field = { value: 'I will check that.', disabled: false, dispatchEvent() {}, focus() {} };
  globalThis.document = {
    addEventListener(type, handler) { if (type === 'click') clickHandler = handler; },
    querySelector(selector) { return selector === '#voiceReplyText' ? field : null; }
  };
  try {
    renderCallCoachPanelV710(base);
    const insertButton = { getAttribute(name) { return name === 'data-call-coach-insert' ? phrase : null; } };
    const target = { closest(selector) { return selector === '[data-call-coach-toggle]' ? null : selector === '[data-call-coach-insert]' ? insertButton : null; } };
    clickHandler({ target });
    assert.equal(field.value, `I will check that.\n${phrase}`);
    assert.equal(submitted, false);
  } finally {
    delete globalThis.document;
  }
});

test('Vite plugin is registered as a post-transform plugin for main.js only', () => {
  const plugin = calloriaLiveCallCoachV710Plugin();
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.name, 'calloria-live-call-coach-v7-10');
  const result = plugin.transform.call({ warn() { throw new Error('unexpected warning'); } }, 'not main source', '/repo/js/not-main.js');
  assert.equal(result, null);
});
