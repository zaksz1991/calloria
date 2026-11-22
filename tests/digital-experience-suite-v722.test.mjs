import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  calloriaDigitalExperienceSuitePluginV722,
  CALLORIA_DIGITAL_EXPERIENCE_ORDER_V722
} from '../build/calloria-digital-experience-suite-v722.mjs';
import { calloriaDigitalWorkflowSuitePluginV720 } from '../build/calloria-digital-workflow-suite-v720.mjs';

const V720 = '/* CALLORIA_V720_DIGITAL_DISPOSITION_INTEGRITY */';
const V721 = '/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */';

function mainFixture() {
  return [
    "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';",
    "import { ensureDigitalCustomerBehaviour, evaluateDigitalCustomerReaction, deliverAdaptiveDigitalCustomerResponse, digitalCustomerBehaviourSnapshot, digitalCustomerBehaviourMetrics } from './digital-customer-behaviour-engine.js';",
    "import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';",
    'function renderDigital() {',
    "  const active = { status: DIGITAL_STATUS.ACTIVE, channel: 'email' };",
    '  const digitalNow = Date.now();',
    '  const interactiveBlocked = false;',
    '  const metrics = { awaitingCustomer: 1 };',
    '  const activeSla = { status: \'on_track\' };',
    '  const thread = `         <div class=\"digital-thread\">${messageRows}</div>`;',
    "    const activeSlaClass = activeSla.status === 'breached' ? 'breached' : activeSla.status === 'at_risk' ? 'at-risk' : activeSla.status === 'met' ? 'met' : 'on-track';",
    '  const markup = `<div class="data-row"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div>`;',
    '  const queueMarkup = `<span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>`;',
    '  const secondQueueMarkup = `<span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>`;',
    "  const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);",
    "  const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });",
    '  const replyTemplate = `\\n        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class="digital-template-row">reply</div>` : \'\'}`;',
    '  const closeForm = `<label class="form-field">DISPOSITION<select name="disposition" ${interactiveBlocked ? \'disabled\' : \'\'}><option value="resolved">Resolved</option><option value="pending_customer">Pending customer response</option><option value="escalated">Escalated to specialist team</option></select></label><label class="form-field">CASE NOTES<textarea name="notes" rows="3" minlength="12" maxlength="1200" required placeholder="Issue, checks, action, owner and agreed next step." ${interactiveBlocked ? \'disabled\' : \'\'}></textarea>`;',
    '  return markup + queueMarkup + secondQueueMarkup + closeForm;',
    '}',
    'function finishDigitalContact(form) {',
    '  const contact = state.digitalActiveId ? findDigitalContact(state.digitalQueue, state.digitalActiveId) : null;',
    '  const values = new FormData(form);',
    "  const disposition = String(values.get('disposition') || '');",
    '  try {',
    "    const completed = completeDigitalContact(state.digitalQueue, contact.id, { disposition, notes: values.get('notes') }, queueSimulationNowMs());",
    '    const digitalCase = { reference, notes: completed.notes, createdAt: completed.completedAt, messages: contact.messages };',
    '    state.cases.push(digitalCase);recordCustomerContinuityFromCase(digitalCase,{customerRef:contact.customerRef});',
    '  } catch (error) {}',
    '}',
    'const supervisorCard = `<p>${escapeHTML(request.reason || \'Agent assistance requested.\')}</p><div class="supervisor-escalation-meta">`;',
    ''
  ].join('\n');
}

function engineFixture() {
  return `export const DIGITAL_STATUS = { AWAITING_CUSTOMER: 'awaiting_customer', PENDING_CUSTOMER: 'pending_customer' };\nexport function digitalQueueMetrics(items) { return { awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length, active: 0 }; }`;
}

function pluginContext(warnings = []) {
  return {
    warn(message) { warnings.push(String(message)); },
    error(message) { throw new Error(String(message)); }
  };
}

test('exports the complete deterministic v7.15-to-v7.21 order', () => {
  assert.deepEqual(CALLORIA_DIGITAL_EXPERIENCE_ORDER_V722, [
    'v7.15 digital response quality coach',
    'v7.16 digital customer-state integrity',
    'v7.17 specialist handoff',
    'v7.18 SLA-aware queue triage',
    'v7.20 digital disposition evidence',
    'v7.21 multi-turn follow-up response SLA'
  ]);
});

test('one plugin activates v7.20 workflow before v7.21 response-cycle UI', () => {
  const warnings = [];
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const result = plugin.transform.call(pluginContext(warnings), mainFixture(), '/repo/js/main.js');
  assert.ok(result?.code);
  assert.ok(result.code.includes(V720));
  assert.ok(result.code.includes(V721));
  assert.match(result.code, /digital-response-cycle-engine-v721\.js/);
  assert.match(result.code, /calloria-digital-response-cycle-v721\.css/);
  assert.match(result.code, /renderDigitalResponseCyclePanel\(active, digitalNow\)/);
  assert.match(result.code, /\$\{responseCyclePanel\}/);
  assert.match(result.code, /name="outcomeEvidence"/);
  assert.match(result.code, /specialistHandoffDraft/);
  assert.equal(warnings.length, 0);
});

test('v7.20 multichannel engine metrics are still transformed by the same registration', () => {
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const result = plugin.transform.call(pluginContext(), engineFixture(), '/repo/js/multichannel-engine.js');
  assert.ok(result?.code);
  assert.match(result.code, /digital-customer-state-metrics-v716\.js/);
  assert.match(result.code, /__CALLORIA_DIGITAL_STATE_METRICS_V716__/);
});

test('v7.21 does not partially activate when v7.20 anchors drift', () => {
  const warnings = [];
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const changed = mainFixture().replace("from './digital-customer-behaviour-engine.js';", "from './renamed-customer-behaviour-engine.js';");
  const result = plugin.transform.call(pluginContext(warnings), changed, '/repo/js/main.js');
  assert.ok(result?.code, 'earlier independent digital transforms may still apply');
  assert.equal(result.code.includes(V720), false);
  assert.equal(result.code.includes(V721), false);
  assert.equal(warnings.length >= 1, true);
  assert.match(warnings.join('\n'), /v7.20|skipped safely/);
});

test('v7.20 remains applied when only the v7.21 response-cycle anchors drift', () => {
  const warnings = [];
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const changed = mainFixture().replace('         <div class="digital-thread">${messageRows}</div>', '         <div class="renamed-digital-thread">${messageRows}</div>');
  const result = plugin.transform.call(pluginContext(warnings), changed, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.match(result.code, /CALLORIA_V720_DIGITAL_DISPOSITION_INTEGRITY/);
  assert.doesNotMatch(result.code, /CALLORIA_V721_DIGITAL_RESPONSE_CYCLE/);
  assert.match(warnings.join('\n'), /v7\.21 skipped safely|response-cycle UI was skipped safely/i);
});

test('the full transformed main fixture passes Node syntax validation', () => {
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const result = plugin.transform.call(pluginContext(), mainFixture(), '/repo/js/main.js');
  assert.ok(result?.code);
  const folder = mkdtempSync(join(tmpdir(), 'calloria-v722-'));
  const file = join(folder, 'main.mjs');
  try {
    writeFileSync(file, result.code, 'utf8');
    const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('adds v7.21 to a source where the v7.20 suite is already transformed', () => {
  const workflow = calloriaDigitalWorkflowSuitePluginV720();
  const suite = calloriaDigitalExperienceSuitePluginV722();
  const first = workflow.transform.call(pluginContext(), mainFixture(), '/repo/js/main.js');
  assert.ok(first?.code);
  assert.ok(first.code.includes(V720));
  assert.equal(first.code.includes(V721), false);
  const warnings = [];
  const second = suite.transform.call(pluginContext(warnings), first.code, '/repo/js/main.js');
  assert.ok(second?.code);
  assert.ok(second.code.includes(V720));
  assert.ok(second.code.includes(V721));
  assert.equal(warnings.length, 0);
});

test('the combined plugin is idempotent after both markers exist', () => {
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  const first = plugin.transform.call(pluginContext(), mainFixture(), '/repo/js/main.js');
  assert.ok(first?.code);
  const second = plugin.transform.call(pluginContext(), first.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('the combined plugin transforms only its intended application modules', () => {
  const plugin = calloriaDigitalExperienceSuitePluginV722();
  assert.equal(plugin.transform.call(pluginContext(), mainFixture(), '/repo/customer-care.html'), null);
  assert.equal(plugin.transform.call(pluginContext(), 'export const x = 1;', '/repo/js/other.js'), null);
});

test('replacement Vite config registers one suite plugin after existing visitor plugins', () => {
  const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.equal((config.match(/calloriaDigitalExperienceSuitePluginV722\(\)/g) || []).length, 1);
  assert.match(config, /calloriaTryItStudioPlugin\(\),\s*\/\/ Unified digital overlays[\s\S]*calloriaDigitalExperienceSuitePluginV722\(\)/);
  for (const preserved of [
    'calloriaGLBWorldPlugin()', 'calloriaOJTGLBActivationPlugin()',
    'calloriaMobileResponsiveRepairPlugin()', 'calloriaRuffNeckServiceOperationsPluginV686()',
    'calloriaCareerDevelopmentPluginV688()', 'calloriaTryItStudioPlugin()'
  ]) assert.ok(config.includes(preserved), `missing existing plugin ${preserved}`);
});

test('replacement Vite config parses as JavaScript', () => {
  const configPath = resolve(new URL('../vite.config.js', import.meta.url).pathname);
  const checked = spawnSync(process.execPath, ['--check', configPath], { encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});
