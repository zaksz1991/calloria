import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV651Test as v651 } from '../build/calloria-ruffneck-platform-support-v6-51.mjs';
import { __calloriaV652Test as v652 } from '../build/calloria-platform-support-case-desk-v6-52.mjs';
import { __calloriaV653Test as v653, calloriaSupportSlaCommandCentrePluginV653 } from '../build/calloria-support-sla-command-centre-v6-53.mjs';

const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });
const fixturePath = new URL('./fixtures/v6-51-platform-support.fixture.js', import.meta.url);
const baseRecord = (overrides = {}) => ({
  reference: 'RNS-TEST-001', platformId: 'ruffneck-lms', platformName: 'RuffNeck LMS',
  customerReference: 'CUS-SIM-001', customerName: 'Learner 001', requestType: 'Progress records',
  priority: 'normal', status: 'Open', disposition: 'open', createdAt: new Date(1_800_000_000_000).toISOString(),
  slaMinutes: 60, slaDueAt: new Date(1_800_000_000_000 + 3_600_000).toISOString(), history: [],
  ...overrides,
});
function transformedSource(source) {
  const prior = v651.transformMain(context(), source);
  assert.ok(prior, 'v6.51 must transform first');
  const second = v652.transformMain(context(), prior.code);
  assert.ok(second, 'v6.52 must transform after v6.51');
  return v653.transformMain(context(), second.code);
}

test('classifies on-track, due-soon, breached, resolved and invalid SLA clocks', () => {
  const item = baseRecord();
  const due = Date.parse(item.slaDueAt);
  assert.equal(v653.classify(item, due - 30 * 60_000).state, 'on_track');
  assert.equal(v653.classify(item, due - 10 * 60_000).state, 'due_soon');
  assert.equal(v653.classify(item, due + 1).state, 'overdue');
  assert.equal(v653.classify({ ...item, status: 'Resolved' }, due + 10_000).state, 'resolved');
  assert.equal(v653.classify({ ...item, slaDueAt: 'bad-date' }, due).state, 'invalid');
});

test('uses a minimum five-minute due-soon window for short response targets', () => {
  const item = baseRecord({ slaMinutes: 10, slaDueAt: new Date(1_800_000_000_000 + 600_000).toISOString() });
  assert.equal(v653.classify(item, Date.parse(item.slaDueAt) - 4 * 60_000).state, 'due_soon');
  assert.equal(v653.classify(item, Date.parse(item.slaDueAt) - 6 * 60_000).state, 'on_track');
});

test('formats remaining and overdue times without hiding negative values', () => {
  assert.equal(v653.formatTime(90 * 60_000), '1h 30m remaining');
  assert.equal(v653.formatTime(-125 * 60_000), '2h 5m overdue');
  assert.equal(v653.formatTime(Number.NaN), 'Time unavailable');
});

test('computes command-centre totals and per-platform workload counts', () => {
  const now = 1_800_000_000_000 + 70 * 60_000;
  const records = [
    baseRecord(),
    baseRecord({ reference: 'RNS-002', status: 'Escalated', platformId: 'ruffneck-prospector', createdAt: new Date(now - 120 * 60_000).toISOString(), slaDueAt: new Date(now - 10 * 60_000).toISOString() }),
    baseRecord({ reference: 'RNS-003', status: 'Resolved', resolvedAt: new Date(now).toISOString() }),
  ];
  const result = v653.metrics(records, now);
  assert.equal(result.total, 3);
  assert.equal(result.active, 2);
  assert.equal(result.overdue, 2);
  assert.equal(result.escalated, 1);
  assert.equal(result.resolved, 1);
  assert.equal(result.byPlatform['ruffneck-lms'].total, 2);
  assert.equal(result.byPlatform['ruffneck-prospector'].escalated, 1);
});

test('automatically escalates overdue active cases and mirrors the new status into CRM', () => {
  const created = 1_800_000_000_000;
  const item = baseRecord({ createdAt: new Date(created).toISOString(), slaDueAt: new Date(created + 3_600_000).toISOString() });
  const state = { platformSupportCases: [item], cases: [{ reference: item.reference, status: 'Open', notes: item.notes || '' }], systemEvents: [] };
  const escalated = v653.escalate(state, created + 3_600_001);
  assert.equal(escalated.length, 1);
  assert.equal(item.status, 'Escalated');
  assert.ok(item.slaBreachAt);
  assert.equal(item.history.at(-1).source, 'sla-watchdog-v653');
  assert.equal(state.cases[0].status, 'Escalated');
  assert.equal(state.systemEvents.at(-1).status, 'simulated_only');
});

test('does not escalate cases before their deadline and escalates each breach only once', () => {
  const item = baseRecord();
  const state = { platformSupportCases: [item], cases: [], systemEvents: [] };
  assert.equal(v653.escalate(state, Date.parse(item.slaDueAt) - 1).length, 0);
  assert.equal(item.status, 'Open');
  assert.equal(v653.escalate(state, Date.parse(item.slaDueAt) + 1).length, 1);
  assert.equal(v653.escalate(state, Date.parse(item.slaDueAt) + 60_000).length, 0);
  assert.equal(item.history.length, 1);
});

test('preserves resolved and already-escalated records without adding duplicate breach events', () => {
  const resolved = baseRecord({ reference: 'RNS-RESOLVED', status: 'Resolved' });
  const critical = baseRecord({ reference: 'RNS-CRITICAL', status: 'Escalated' });
  const state = { platformSupportCases: [resolved, critical], cases: [], systemEvents: [] };
  assert.equal(v653.escalate(state, Date.parse(resolved.slaDueAt) + 100_000).length, 0);
  assert.equal(resolved.status, 'Resolved');
  assert.equal(critical.status, 'Escalated');
  assert.equal(state.systemEvents.length, 0);
});

test('rejects missing simulation state instead of silently creating detached records', () => {
  assert.throws(() => v653.escalate(null, 1000), /valid simulation state/);
});

test('supports all six RuffNeck service queues in the dashboard data source', () => {
  assert.equal(v653.platforms.length, 6);
  assert.deepEqual(v653.platforms.map(item => item.id), ['ruffneck-lms', 'ruffneck-prospector', 'ruffneck-connect', 'ruffneck-social-hub', 'kano-run', 'kano-keke']);
});

test('adds the cross-platform SLA command centre after the v6.52 service case desk', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.ok(result);
  assert.match(result.code, new RegExp(v653.marker));
  const deskAt = result.code.indexOf('${calloriaRenderPlatformCaseDeskV652()}');
  const commandAt = result.code.indexOf('${calloriaRenderSupportCommandCentreV653()}');
  assert.ok(deskAt >= 0 && commandAt > deskAt);
  assert.match(result.code, /Support SLA command centre/);
  assert.match(result.code, /platformSupportQueueFilters/);
  assert.match(result.code, /Nearest SLA first/);
});

test('runs the breach watcher and refreshes the queue at thirty-second intervals', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.match(result.code, /calloriaInstallSupportSlaWatchdogV653\(\)/);
  assert.match(result.code, /window\.setInterval\(\(\)=>\{if\(document\.visibilityState!==\'hidden\'\)run\(\);\},30000\)/);
  assert.match(result.code, /visibilitychange/);
  assert.match(result.code, /pushOperationEvent\('platform-support-sla'/);
});

test('persists service, status, priority and sort filters in the browser save', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.match(result.code, /platformSupportQueueFilters: \{ service: 'all', status: 'active', priority: 'all', sort: 'sla' \}/);
  assert.match(result.code, /state\.platformSupportQueueFilters\[select\.name\]=select\.value/);
  assert.match(result.code, /saveState\(\);renderView\(\)/);
});

test('activates responsive command-centre styling in the Workforce view', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.match(result.code, /calloriaEnsureSupportCommandStylesV653\(\)/);
  assert.match(result.code, /@media\(max-width:520px\)/);
  assert.match(result.code, /repeat\(5,minmax\(0,1fr\)\)/);
});

test('fails closed if any v6.52 integration anchor has drifted', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const prior = v651.transformMain(context(), source);
  const second = v652.transformMain(context(), prior.code);
  const changed = context();
  const result = v653.transformMain(changed, second.code.replace('${calloriaRenderPlatformCaseDeskV652()}', '${calloriaRenderDifferentDesk()}'));
  assert.equal(result, null);
  assert.match(changed.warnings.join(' '), /service case desk render point/);
});

test('transformed main.js remains valid JavaScript after all three support integrations', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.ok(result);
  const directory = await mkdtemp(join(tmpdir(), 'calloria-v653-'));
  const output = join(directory, 'main-v653.mjs');
  try {
    await writeFile(output, result.code);
    const check = spawnSync(process.execPath, ['--check', output], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('registers v6.53 after v6.52 and preserves the cumulative plugin chain', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-support-sla-command-centre-v6-53\.mjs/);
  assert.ok(config.indexOf('calloriaPlatformSupportCaseDeskPluginV652()') < config.indexOf('calloriaSupportSlaCommandCentrePluginV653()'));
  for (const plugin of ['calloriaVoiceResponseWorkflowPlugin()', 'calloriaInboundQAReviewBridgePlugin()', 'calloriaScenarioBasedPromotionExamPlugin()', 'calloriaRuffNeckPlatformSupportPlugin()']) {
    assert.match(config, new RegExp(plugin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('plugin transforms only js/main.js and does not apply twice', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const first = v651.transformMain(context(), source);
  const second = v652.transformMain(context(), first.code);
  const plugin = calloriaSupportSlaCommandCentrePluginV653();
  assert.equal(plugin.transform.call(context(), second.code, '/repo/js/workforce-engine.js'), null);
  const applied = plugin.transform.call(context(), second.code, '/repo/js/main.js');
  assert.ok(applied);
  assert.equal(plugin.transform.call(context(), applied.code, '/repo/js/main.js'), null);
});
