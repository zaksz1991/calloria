import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  digitalCustomerStateMetrics
} from '../js/digital-customer-state-metrics-v716.js';
import {
  transformDigitalQueueMetricsSource,
  transformDigitalQueueUiSource,
  calloriaDigitalStateIntegrityPluginV716,
  CALLORIA_DIGITAL_STATE_METRICS_MARKER,
  CALLORIA_DIGITAL_STATE_UI_MARKER
} from '../build/calloria-digital-state-integrity-v716.mjs';

const statuses = Object.freeze({ AWAITING_CUSTOMER: 'awaiting_customer', PENDING_CUSTOMER: 'pending_customer' });
const engineFixture = `/** CALLORIA Multi-channel Operations Engine. */\nexport const DIGITAL_STATUS = Object.freeze({ AWAITING_CUSTOMER: 'awaiting_customer', PENDING_CUSTOMER: 'pending_customer' });\nexport function digitalQueueMetrics(queue) {\n const items = Array.isArray(queue) ? queue : [];\n return {\n   awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length,\n   resolved: 0\n };\n}\n`;
const ENGINE_METRIC_ANCHOR = 'awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length,';
const uiAnchor = '<div class="data-row"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div>';
const uiFixture = `const markup = \`<section>${uiAnchor}</section>\`;`;

test('active threads awaiting a customer are counted separately from CRM pending-customer cases', () => {
  const rows = [
    { status: statuses.AWAITING_CUSTOMER },
    { status: statuses.AWAITING_CUSTOMER },
    { status: statuses.PENDING_CUSTOMER },
    { status: 'active' },
    null,
    'invalid'
  ];
  assert.deepEqual(digitalCustomerStateMetrics(rows, statuses), {
    awaitingCustomer: 2,
    pendingCustomerCases: 1
  });
});

test('helper handles missing or invalid inputs without throwing', () => {
  assert.deepEqual(digitalCustomerStateMetrics(null, statuses), { awaitingCustomer: 0, pendingCustomerCases: 0 });
  assert.deepEqual(digitalCustomerStateMetrics([{ status: 'unknown' }], statuses), { awaitingCustomer: 0, pendingCustomerCases: 0 });
});

test('helper does not mutate the queue or its records', () => {
  const rows = Object.freeze([Object.freeze({ status: statuses.AWAITING_CUSTOMER }), Object.freeze({ status: statuses.PENDING_CUSTOMER })]);
  assert.deepEqual(digitalCustomerStateMetrics(rows, statuses), { awaitingCustomer: 1, pendingCustomerCases: 1 });
  assert.equal(rows.length, 2);
});

test('engine transform replaces the ambiguous count with the two explicit counts', () => {
  const result = transformDigitalQueueMetricsSource(engineFixture);
  assert.equal(result.changed, true);
  assert.match(result.code, /\.\.\.calloriaDigitalCustomerStateMetrics\(items, DIGITAL_STATUS\)/);
  assert.match(result.code, new RegExp(CALLORIA_DIGITAL_STATE_METRICS_MARKER));
  assert.match(result.code, /digital-customer-state-metrics-v716\.js/);
});

test('engine transform is idempotent', () => {
  const first = transformDigitalQueueMetricsSource(engineFixture);
  const second = transformDigitalQueueMetricsSource(first.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.changed, false);
  assert.equal(second.code, first.code);
});

test('engine transform refuses missing or duplicate anchors without partial edits', () => {
  const missing = transformDigitalQueueMetricsSource('export const x = 1;');
  assert.equal(missing.changed, false);
  assert.equal(missing.code, 'export const x = 1;');
  const duplicate = transformDigitalQueueMetricsSource(`${engineFixture}\n${ENGINE_METRIC_ANCHOR}`);
  assert.equal(duplicate.changed, false);
  assert.match(duplicate.reason, /matched 2 times/);
});

test('UI transform adds separate active-thread and CRM-follow-up rows', () => {
  const result = transformDigitalQueueUiSource(uiFixture);
  assert.equal(result.changed, true);
  assert.match(result.code, /Active threads awaiting customer/);
  assert.match(result.code, /CRM cases pending customer/);
  assert.match(result.code, /metrics\.pendingCustomerCases/);
  assert.match(result.code, new RegExp(CALLORIA_DIGITAL_STATE_UI_MARKER));
});

test('UI transform is idempotent and refuses source drift', () => {
  const first = transformDigitalQueueUiSource(uiFixture);
  const second = transformDigitalQueueUiSource(first.code);
  assert.equal(second.alreadyPatched, true);
  assert.equal(second.changed, false);
  const drift = transformDigitalQueueUiSource('const markup = "new layout";');
  assert.equal(drift.changed, false);
  assert.match(drift.reason, /matched 0 times/);
});

test('Vite plugin only transforms the two intended modules', () => {
  const plugin = calloriaDigitalStateIntegrityPluginV716();
  const warnings = [];
  const context = { warn: message => warnings.push(message) };
  const engine = plugin.transform.call(context, engineFixture, '/repo/js/multichannel-engine.js');
  const main = plugin.transform.call(context, uiFixture, '/repo/js/main.js');
  const other = plugin.transform.call(context, 'export const x = 1;', '/repo/js/other.js');
  assert.match(engine.code, /calloriaDigitalCustomerStateMetrics/);
  assert.match(main.code, /CRM cases pending customer/);
  assert.equal(other, null);
  assert.equal(warnings.length, 0);
});

test('Vite plugin warns and safely skips a module with changed anchors', () => {
  const plugin = calloriaDigitalStateIntegrityPluginV716();
  const warnings = [];
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, 'export const x = 1;', '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /not modified/);
});


test('transformed digital performance UI fixture passes Node syntax validation', () => {
  const transformed = transformDigitalQueueUiSource(uiFixture);
  assert.equal(transformed.changed, true);
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v716-ui-'));
  try {
    writeFileSync(join(dir, 'digital-ui.mjs'), `const metrics = { awaitingCustomer: 2, pendingCustomerCases: 1 };\n${transformed.code}\n`);
    const check = spawnSync(process.execPath, ['--check', join(dir, 'digital-ui.mjs')], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('transformed engine fixture passes Node syntax validation', () => {
  const transformed = transformDigitalQueueMetricsSource(engineFixture);
  assert.equal(transformed.changed, true);
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v716-'));
  try {
    writeFileSync(join(dir, 'digital-customer-state-metrics-v716.js'), 'export function digitalCustomerStateMetrics(items, status) { return { awaitingCustomer: 0, pendingCustomerCases: 0 }; }\n');
    writeFileSync(join(dir, 'multichannel-engine.mjs'), transformed.code.replace("from './digital-customer-state-metrics-v716.js'", "from './digital-customer-state-metrics-v716.js'"));
    const check = spawnSync(process.execPath, ['--check', join(dir, 'multichannel-engine.mjs')], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
