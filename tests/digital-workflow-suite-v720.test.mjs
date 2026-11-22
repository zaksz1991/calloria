import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { calloriaDigitalWorkflowSuitePluginV720, CALLORIA_DIGITAL_WORKFLOW_TRANSFORM_ORDER_V720 } from '../build/calloria-digital-workflow-suite-v720.mjs';
import { validateDigitalDispositionEvidence } from '../js/digital-disposition-integrity-v719.js';

const DIGITAL_IMPORT = "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';";
const BEHAVIOUR_IMPORT = "import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';";
const notes = 'Reviewed the customer issue, checked the simulated record, explained the action and recorded the agreed next step.';

function mainFixture() {
  return [
    "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';",
    "import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';",
"import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';",
    "function renderDigital() {",
    "  const active = { status: DIGITAL_STATUS.ACTIVE, channel: 'email' };",
    "  const interactiveBlocked = false;",
    "  const metrics = { awaitingCustomer: 1 };",
    "  const markup = `<div class=\"data-row\"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div>`;",
    "  const queueMarkup = `<span class=\"digital-sla-pill ${assessDigitalSla(item, digitalNow).status}\">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>`;",
    "  const secondQueueMarkup = `<span class=\"digital-sla-pill ${assessDigitalSla(item, digitalNow).status}\">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>`;",
    "  const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);",
    "  const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });",
"  const replyTemplate = `\n        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class=\"digital-template-row\">reply</div>` : ''}`;", 
    "  const closeForm = `<label class=\"form-field\">DISPOSITION<select name=\"disposition\" ${interactiveBlocked ? 'disabled' : ''}><option value=\"resolved\">Resolved</option><option value=\"pending_customer\">Pending customer response</option><option value=\"escalated\">Escalated to specialist team</option></select></label><label class=\"form-field\">CASE NOTES<textarea name=\"notes\" rows=\"3\" minlength=\"12\" maxlength=\"1200\" required placeholder=\"Issue, checks, action, owner and agreed next step.\" ${interactiveBlocked ? 'disabled' : ''}></textarea>`;",
    "  return markup + queueMarkup + secondQueueMarkup + closeForm;",
    "}",
    "function finishDigitalContact(form) {",
    "  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;",
    "  const values = new FormData(form);",
    "  const disposition = String(values.get('disposition') || '');",
    "  try {",
    "    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());",
    "    const digitalCase = { reference, notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages };",
    "    state.cases.push(digitalCase);recordCustomerContinuityFromCase(digitalCase,{customerRef:contact.customerRef});",
    "  } catch (error) {}",
    "}",
    "const supervisorCard = `<p>${escapeHTML(request.reason || 'Agent assistance requested.')}</p><div class=\"supervisor-escalation-meta\">`;"
  ].join('\n');
}

function engineFixture() {
  return `export const DIGITAL_STATUS = { AWAITING_CUSTOMER: 'awaiting_customer', PENDING_CUSTOMER: 'pending_customer' };\nexport function digitalQueueMetrics(items) { return { awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length, active: 0 }; }`;
}

function contact(overrides = {}) {
  return {
    id: 'DIG-TEST-001', status: 'awaiting_customer', replyCount: 1,
    messages: [
      { type: 'customer', text: 'I need help with this issue.' },
      { type: 'agent', text: 'I have reviewed the issue and explained the next step.' }
    ], customerBehaviour: { pendingResponse: '', needsSupervisor: false },
    ...overrides
  };
}

test('suite exports the fixed deterministic transform order', () => {
  assert.deepEqual(CALLORIA_DIGITAL_WORKFLOW_TRANSFORM_ORDER_V720, [
    'v7.15 digital response coach',
    'v7.16 digital customer-state metrics',
    'v7.17 specialist handoff',
    'v7.18 SLA-aware queue triage',
    'v7.20 disposition evidence integrity (v7.19 anchor compatibility repair)'
  ]);
});

test('complete digital suite transforms main.js through v7.15-v7.20 in one pass', () => {
  const plugin = calloriaDigitalWorkflowSuitePluginV720();
  const warnings = [];
  const errors = [];
  const context = {
    warn: message => warnings.push(String(message)),
    error: message => { errors.push(String(message)); throw new Error(String(message)); }
  };
  const transformed = plugin.transform.call(context, mainFixture(), '/repo/js/main.js');
  assert.ok(transformed);
  assert.match(transformed.code, /CALLORIA_DIGITAL_RESPONSE_QUALITY_V715/);
  assert.match(transformed.code, /CALLORIA_DIGITAL_STATE_UI_V716/);
  assert.match(transformed.code, /CALLORIA_DIGITAL_SPECIALIST_HANDOFF_V717/);
  assert.match(transformed.code, /CALLORIA_V718_DIGITAL_SLA_TRIAGE/);
  assert.match(transformed.code, /CALLORIA_V720_DIGITAL_DISPOSITION_INTEGRITY/);
  assert.match(transformed.code, /name="outcomeEvidence"/);
  assert.match(transformed.code, /typeof specialistHandoffDraft !== 'undefined' && Boolean\(specialistHandoffDraft\)/);
  assert.match(transformed.code, /dispositionEvidence: completed\.dispositionEvidence/);
  assert.match(transformed.code, /sortDigitalQueueBySla\(state\.digitalQueue/);
  assert.equal(warnings.length, 0);
  assert.equal(errors.length, 0);
});


test('fully transformed main.js fixture passes Node syntax validation', () => {
  const plugin = calloriaDigitalWorkflowSuitePluginV720();
  const context = { warn() {}, error(message) { throw new Error(message); } };
  const transformed = plugin.transform.call(context, mainFixture(), '/repo/js/main.js');
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v720-'));
  const file = join(dir, 'main.mjs');
  try {
    writeFileSync(file, transformed.code, 'utf8');
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, `${checked.stdout || ''}${checked.stderr || ''}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('suite separates active awaiting-customer threads from pending-customer CRM cases', () => {
  const plugin = calloriaDigitalWorkflowSuitePluginV720();
  const result = plugin.transform.call({ warn() {}, error(message) { throw new Error(message); } }, engineFixture(), '/repo/js/multichannel-engine.js');
  assert.ok(result);
  assert.match(result.code, /digitalCustomerStateMetrics as calloriaDigitalCustomerStateMetrics/);
  assert.match(result.code, /\.\.\.calloriaDigitalCustomerStateMetrics\(items, DIGITAL_STATUS\)/);
});

test('suite is idempotent after all digital transforms have been applied', () => {
  const plugin = calloriaDigitalWorkflowSuitePluginV720();
  const context = { warn() {}, error(message) { throw new Error(message); } };
  const first = plugin.transform.call(context, mainFixture(), '/repo/js/main.js');
  const second = plugin.transform.call(context, first.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('suite leaves unrelated source files untouched', () => {
  const plugin = calloriaDigitalWorkflowSuitePluginV720();
  assert.equal(plugin.transform.call({ warn() {}, error() {} }, 'export const value = 1;', '/repo/js/other.js'), null);
});

test('new specialist handoff draft qualifies as a linked referral during the same completion transaction', () => {
  // v7.17 creates the draft before completion; v7.20 includes it in the
  // supervisor-request gate before the draft is committed to the request ledger.
  const transformed = calloriaDigitalWorkflowSuitePluginV720().transform.call(
    { warn() {}, error(message) { throw new Error(message); } }, mainFixture(), '/repo/js/main.js'
  ).code;
  assert.match(transformed, /supervisorRequestOpen = relatedRequests\.some\(item => item\.status === 'open'\) \|\| \(typeof specialistHandoffDraft !== 'undefined' && Boolean\(specialistHandoffDraft\)\)/);
  assert.match(transformed, /state\.supervisorRequests\.push\(specialistHandoffDraft\)/);
});

test('helper rejects customer-confirmed resolution without a customer reply after an agent response', () => {
  const result = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'resolved', evidenceType: 'customer_confirmed', notes });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /customer has replied/i);
});

test('helper permits customer-confirmed resolution after a subsequent customer message', () => {
  const item = contact({ messages: [...contact().messages, { type: 'customer', text: 'Thank you, that is resolved.' }] });
  const result = validateDigitalDispositionEvidence({ contact: item, disposition: 'resolved', evidenceType: 'customer_confirmed', notes });
  assert.equal(result.allowed, true);
  assert.equal(result.customerReplyObserved, true);
});

test('helper blocks one-touch resolution when a customer response is still pending', () => {
  const result = validateDigitalDispositionEvidence({
    contact: contact({ status: 'active', customerBehaviour: { pendingResponse: 'Please clarify.', needsSupervisor: false } }),
    disposition: 'resolved', evidenceType: 'one_touch_resolution', notes
  });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /response pending/i);
});

test('helper requires explicit evidence for pending-customer and escalation outcomes', () => {
  const pending = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'pending_customer', evidenceType: 'customer_information_pending', notes });
  const escalatedMissing = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'escalated', evidenceType: 'specialist_referral_created', notes });
  const escalatedLinked = validateDigitalDispositionEvidence({ contact: contact(), disposition: 'escalated', evidenceType: 'specialist_referral_created', notes, supervisorRequestOpen: true });
  assert.equal(pending.allowed, true);
  assert.equal(escalatedMissing.allowed, false);
  assert.equal(escalatedLinked.allowed, true);
});

// Keep exact public-main import strings in this test: an accidental rename in
// the base application should make the suite's strict source guard visible.
test('fixture includes the expected digital source baselines', () => {
  const fixture = mainFixture();
  assert.equal(fixture.split(DIGITAL_IMPORT).length - 1, 1);
  assert.equal(fixture.split(BEHAVIOUR_IMPORT).length - 1, 1);
});
