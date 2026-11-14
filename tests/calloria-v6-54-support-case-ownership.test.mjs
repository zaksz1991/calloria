import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { __calloriaV651Test as v651 } from '../build/calloria-ruffneck-platform-support-v6-51.mjs';
import { __calloriaV652Test as v652 } from '../build/calloria-platform-support-case-desk-v6-52.mjs';
import { __calloriaV653Test as v653 } from '../build/calloria-support-sla-command-centre-v6-53.mjs';
import { __calloriaV654Test as v654, calloriaSupportCaseOwnershipPluginV654 } from '../build/calloria-support-case-ownership-v6-54.mjs';

const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });
const fixturePath = new URL('./fixtures/v6-51-platform-support.fixture.js', import.meta.url);
const created = Date.parse('2026-11-14T10:00:00.000Z');
const baseRecord = (overrides = {}) => ({
  reference: 'RNS-TEST-001', platformId: 'ruffneck-lms', platformName: 'RuffNeck LMS',
  customerReference: 'CUS-SIM-001', customerName: 'Learner 001', requestType: 'Course access',
  priority: 'normal', status: 'Open', disposition: 'open', owner: 'Agent',
  createdAt: new Date(created).toISOString(), updatedAt: new Date(created).toISOString(),
  slaMinutes: 1440, slaDueAt: new Date(created + 86_400_000).toISOString(), history: [],
  ...overrides,
});
const stateWith = (item = baseRecord()) => ({ platformSupportCases: [item], cases: [{ reference: item.reference, owner: item.owner, status: item.status, notes: item.notes || '' }], systemEvents: [] });

async function transformedSource(source) {
  const first = v651.transformMain(context(), source);
  assert.ok(first, 'v6.51 must transform first');
  const second = v652.transformMain(context(), first.code);
  assert.ok(second, 'v6.52 must transform after v6.51');
  const third = v653.transformMain(context(), second.code);
  assert.ok(third, 'v6.53 must transform after v6.52');
  return v654.transformMain(context(), third.code);
}

test('maps every RuffNeck service to its specialist operating team', () => {
  assert.equal(v654.getTeam('ruffneck-lms'), 'Learning Platform Support');
  assert.equal(v654.getTeam('ruffneck-prospector'), 'Business Tools Support');
  assert.equal(v654.getTeam('ruffneck-connect'), 'Connectivity Support');
  assert.equal(v654.getTeam('ruffneck-social-hub'), 'Social & Community Support');
  assert.equal(v654.getTeam('kano-run'), 'Kano Run Game Support');
  assert.equal(v654.getTeam('kano-keke'), 'Kano Keke Game Support');
  assert.equal(v654.getTeam('unknown-service'), 'Platform Support Generalist Queue');
});

test('migrates existing records into explicit ownership without changing active case status', () => {
  const named = baseRecord({ reference: 'RNS-NAMED', owner: 'Ada Agent' });
  const fallback = baseRecord({ reference: 'RNS-LEGACY', owner: 'Agent' });
  const critical = baseRecord({ reference: 'RNS-CRITICAL', priority: 'critical', status: 'Escalated', owner: 'Agent' });
  const state = { platformSupportCases: [named, fallback, critical] };
  assert.equal(v654.ensure(state, created), true);
  assert.equal(named.assigneeType, 'agent');
  assert.equal(named.owner, 'Ada Agent');
  assert.equal(named.assignedTeam, 'Learning Platform Support');
  assert.equal(fallback.assigneeType, 'unassigned');
  assert.equal(fallback.owner, 'Unassigned');
  assert.equal(critical.assigneeType, 'supervisor');
  assert.equal(critical.assignedTeam, 'Supervisor Escalations');
  assert.equal(critical.status, 'Escalated');
});

test('ownership migration is idempotent and does not duplicate assignment history', () => {
  const state = stateWith();
  assert.equal(v654.ensure(state, created), true);
  const length = state.platformSupportCases[0].assignmentHistory.length;
  assert.equal(v654.ensure(state, created + 1000), false);
  assert.equal(state.platformSupportCases[0].assignmentHistory.length, length);
});

test('claims a case for the current player and mirrors ownership into CRM', () => {
  const state = stateWith(baseRecord({ owner: 'Unassigned', assigneeType: 'unassigned' }));
  const item = v654.assign(state, 'RNS-TEST-001', 'claim', 'Ada Player', created + 1000);
  assert.equal(item.owner, 'Ada Player');
  assert.equal(item.assigneeType, 'agent');
  assert.equal(item.assignedTeam, 'Learning Platform Support');
  assert.equal(state.cases[0].owner, 'Ada Player');
  assert.equal(state.cases[0].assigneeType, 'agent');
  assert.equal(item.assignmentHistory.at(-1).action, 'claim');
});

test('routes a case to the matching specialist queue without changing its SLA deadline', () => {
  const item = baseRecord({ platformId: 'kano-run', slaDueAt: new Date(created + 3600000).toISOString() });
  const originalDue = item.slaDueAt;
  const state = stateWith(item);
  v654.assign(state, item.reference, 'specialist', 'Ada Player', created + 2000);
  assert.equal(item.assigneeType, 'specialist');
  assert.equal(item.assignedTeam, 'Kano Run Game Support');
  assert.equal(item.owner, 'Kano Run Game Support Specialist Queue');
  assert.equal(item.slaDueAt, originalDue);
});

test('routes a case to supervisor ownership and marks it escalated', () => {
  const state = stateWith();
  const item = v654.assign(state, 'RNS-TEST-001', 'supervisor', 'Ada Player', created + 3000);
  assert.equal(item.owner, 'Supervisor Queue');
  assert.equal(item.assigneeType, 'supervisor');
  assert.equal(item.assignedTeam, 'Supervisor Escalations');
  assert.equal(item.status, 'Escalated');
  assert.equal(state.cases[0].status, 'Escalated');
  assert.ok(item.slaEscalatedAt);
});

test('releases a case back to its mapped specialist intake queue', () => {
  const state = stateWith(baseRecord({ owner: 'Ada Player', assigneeType: 'agent' }));
  const item = v654.assign(state, 'RNS-TEST-001', 'release', 'Ada Player', created + 4000);
  assert.equal(item.owner, 'Unassigned');
  assert.equal(item.assigneeType, 'unassigned');
  assert.equal(item.assignedTeam, 'Learning Platform Support');
  assert.equal(item.assignedAt, null);
});

test('records previous and new ownership in an append-only bounded history', () => {
  const item = baseRecord({ owner: 'Previous Agent', assigneeType: 'agent', assignmentHistory: [] });
  const state = stateWith(item);
  v654.assign(state, item.reference, 'claim', 'Current Agent', created + 5000);
  const record = item.assignmentHistory.at(-1);
  assert.equal(record.from.owner, 'Previous Agent');
  assert.equal(record.to.owner, 'Current Agent');
  assert.equal(record.assignedBy, 'Current Agent');
  assert.equal(record.source, 'support-case-ownership-v654');
  assert.equal(item.history.at(-1).source, 'support-case-ownership-v654');
});

test('rejects invalid actions, missing cases and resolved cases', () => {
  const state = stateWith();
  assert.throws(() => v654.assign(state, 'RNS-TEST-001', 'delete', 'Agent', created), /valid case-ownership action/);
  assert.throws(() => v654.assign(state, 'RNS-NOT-FOUND', 'claim', 'Agent', created), /could not be found/);
  const resolved = stateWith(baseRecord({ status: 'Resolved' }));
  assert.throws(() => v654.assign(resolved, 'RNS-TEST-001', 'claim', 'Agent', created), /Resolved cases cannot be reassigned/);
});

test('rejects missing state and sanitizes the player label', () => {
  assert.throws(() => v654.ensure(null, created), /valid simulation state/);
  const state = stateWith(baseRecord({ owner: 'Unassigned', assigneeType: 'unassigned' }));
  const item = v654.assign(state, 'RNS-TEST-001', 'claim', '<b>Ada</b>', created + 6000);
  assert.equal(item.owner, 'bAda/b');
});

test('adds case ownership controls after the SLA command centre render', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = await transformedSource(source);
  assert.ok(result);
  assert.match(result.code, new RegExp(v654.marker));
  const commandAt = result.code.indexOf('${calloriaRenderSupportCommandCentreV653()}');
  const ownershipAt = result.code.indexOf('${calloriaRenderSupportOwnershipDeskV654()}');
  assert.ok(commandAt >= 0 && ownershipAt > commandAt);
  assert.match(result.code, /Case ownership and routing/);
  assert.match(result.code, /Supervisor review/);
  assert.match(result.code, /Owned by me/);
});

test('adds assignment controls, queue filtering and CRM-operation audit bridge', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = await transformedSource(source);
  assert.match(result.code, /data-support-assignment-v654/);
  assert.match(result.code, /platformSupportAssignmentFilterV654/);
  assert.match(result.code, /pushOperationEvent\('platform-support-assignment'/);
  assert.match(result.code, /assignmentHistory/);
});

test('fails closed if any v6.53 integration anchor has drifted', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const first = v651.transformMain(context(), source);
  const second = v652.transformMain(context(), first.code);
  const third = v653.transformMain(context(), second.code);
  const changed = context();
  const result = v654.transformMain(changed, third.code.replace('${calloriaRenderSupportCommandCentreV653()}', '${calloriaDifferentQueue()}'));
  assert.equal(result, null);
  assert.match(changed.warnings.join(' '), /command-centre render call/);
});

test('transformed main.js remains valid JavaScript after v6.51–v6.54 integrations', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = await transformedSource(source);
  const directory = await mkdtemp(join(tmpdir(), 'calloria-v654-'));
  const output = join(directory, 'main-v654.mjs');
  try {
    await writeFile(output, result.code);
    const check = spawnSync(process.execPath, ['--check', output], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});


test('inlined ownership desk renders and migrates a legacy case at runtime', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = await transformedSource(source);
  const styleHost = { append() {} };
  const document = {
    visibilityState: 'hidden',
    addEventListener() {},
    getElementById() { return null; },
    createElement() { return { id: '', textContent: '' }; },
    head: styleHost,
  };
  const contextObject = {
    document,
    window: { setInterval() { return 1; } },
    Date,
    setTimeout,
    clearTimeout,
    console,
    escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, ''); },
    saveState() {},
    renderView() {},
    toast() {},
    pushOperationEvent() {},
    createSystemEvent() {},
  };
  runInNewContext(result.code, contextObject);
  const runtimeRecord = baseRecord({ owner: 'Agent' });
  runInNewContext(`state.applicantName='Ada Player'; state.platformSupportCases=[${JSON.stringify(runtimeRecord)}]; state.cases=[];`, contextObject);
  const html = runInNewContext(`calloriaRenderSupportOwnershipDeskV654(${created})`, contextObject);
  assert.match(html, /Case ownership and routing/);
  assert.match(html, /RNS-TEST-001/);
  assert.match(html, /Learning Platform Support/);
  assert.match(html, /Supervisor review/);
});

test('registers v6.54 after v6.53 and preserves the cumulative plugin chain', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-support-case-ownership-v6-54\.mjs/);
  assert.ok(config.indexOf('calloriaSupportSlaCommandCentrePluginV653()') < config.indexOf('calloriaSupportCaseOwnershipPluginV654()'));
  for (const plugin of ['calloriaVoiceResponseWorkflowPlugin()', 'calloriaInboundQAReviewBridgePlugin()', 'calloriaScenarioBasedPromotionExamPlugin()', 'calloriaRuffNeckPlatformSupportPlugin()', 'calloriaPlatformSupportCaseDeskPluginV652()']) {
    assert.match(config, new RegExp(plugin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('plugin transforms only js/main.js and does not apply twice', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const first = v651.transformMain(context(), source);
  const second = v652.transformMain(context(), first.code);
  const third = v653.transformMain(context(), second.code);
  const plugin = calloriaSupportCaseOwnershipPluginV654();
  assert.equal(plugin.transform.call(context(), third.code, '/repo/js/workforce-engine.js'), null);
  const applied = plugin.transform.call(context(), third.code, '/repo/js/main.js');
  assert.ok(applied);
  assert.equal(plugin.transform.call(context(), applied.code, '/repo/js/main.js'), null);
});
