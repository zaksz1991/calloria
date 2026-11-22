import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  assessDigitalResponseCycles,
  digitalResponseCycleMetrics,
  digitalResponseCycleDisplay
} from '../js/digital-response-cycle-engine-v721.js';
import { calloriaDigitalResponseCyclePluginV721 } from '../build/calloria-digital-response-cycle-v721.mjs';

const minute = 60_000;
const iso = minutes => new Date(Date.UTC(2026, 10, 22, 8, 0, 0) + minutes * minute).toISOString();
const now = Date.parse(iso(20));

function contact({ channel = 'email', slaMinutes, messages } = {}) {
  return { id: 'DIG-TEST-001', channel, slaMinutes, messages };
}
function baseMessages(extra = []) {
  return [
    { id: 'C1', type: 'customer', at: iso(0), text: 'Initial issue' },
    { id: 'A1', type: 'agent', at: iso(3), text: 'First response' },
    ...extra
  ];
}

test('first response is excluded; only later customer turns start reply cycles', () => {
  const report = assessDigitalResponseCycles(contact({ messages: baseMessages() }), now);
  assert.equal(report.cycles.length, 0);
  assert.equal(report.open, 0);
});

test('an open follow-up remains on track before 75 percent of its target', () => {
  const item = contact({ messages: baseMessages([{ id: 'C2', type: 'customer', at: iso(10), text: 'More detail' }]) });
  const cycle = assessDigitalResponseCycles(item, now).cycles[0];
  assert.equal(cycle.status, 'on_track');
  assert.equal(cycle.targetMinutes, 240);
  assert.equal(cycle.responded, false);
});

test('an open follow-up enters the risk window at 75 percent of its target', () => {
  const item = contact({ channel: 'live_chat', messages: baseMessages([{ id: 'C2', type: 'customer', at: iso(18.5), text: 'Still waiting' }]) });
  const cycle = assessDigitalResponseCycles(item, now).cycles[0];
  assert.equal(cycle.status, 'at_risk');
  assert.equal(cycle.targetMinutes, 2);
});

test('an open follow-up becomes overdue at its channel deadline', () => {
  const item = contact({ channel: 'live_chat', messages: baseMessages([{ id: 'C2', type: 'customer', at: iso(17), text: 'Still waiting' }]) });
  const cycle = assessDigitalResponseCycles(item, Date.parse(iso(20))).cycles[0];
  assert.equal(cycle.status, 'breached');
  assert.equal(cycle.responded, false);
  assert.equal(cycle.overdueMs, minute);
});

test('a subsequent agent reply is marked met when it arrives inside target', () => {
  const item = contact({ channel: 'live_chat', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' },
    { id: 'A2', type: 'agent', at: iso(11), text: 'Second response' }
  ]) });
  const cycle = assessDigitalResponseCycles(item, now).cycles[0];
  assert.equal(cycle.status, 'met');
  assert.equal(cycle.responseMinutes, 1);
  assert.equal(digitalResponseCycleDisplay(cycle), 'MET · 1m');
});

test('a subsequent agent reply is marked late when it arrives after target', () => {
  const item = contact({ channel: 'live_chat', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' },
    { id: 'A2', type: 'agent', at: iso(13), text: 'Late response' }
  ]) });
  const cycle = assessDigitalResponseCycles(item, now).cycles[0];
  assert.equal(cycle.status, 'breached');
  assert.equal(cycle.responded, true);
  assert.equal(cycle.overdueMs, minute);
});

test('consecutive customer messages share one pending response cycle', () => {
  const item = contact({ channel: 'social', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(5), text: 'First follow-up' },
    { id: 'C3', type: 'customer', at: iso(8), text: 'Second follow-up' }
  ]) });
  const report = assessDigitalResponseCycles(item, now);
  assert.equal(report.cycles.length, 1);
  assert.equal(report.cycles[0].id, 'C3');
  assert.equal(report.cycles[0].customerMessageCount, 2);
});

test('multiple customer turns form separate response cycles', () => {
  const item = contact({ channel: 'email', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(5), text: 'Follow-up one' },
    { id: 'A2', type: 'agent', at: iso(6), text: 'Reply one' },
    { id: 'C3', type: 'customer', at: iso(8), text: 'Follow-up two' }
  ]) });
  const report = assessDigitalResponseCycles(item, now);
  assert.equal(report.cycles.length, 2);
  assert.equal(report.met, 1);
  assert.equal(report.open, 1);
});

test('explicit SLA override is honoured within the safe bounds', () => {
  const item = contact({ channel: 'email', slaMinutes: 3, messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(18), text: 'Follow-up' }
  ]) });
  const cycle = assessDigitalResponseCycles(item, now).cycles[0];
  assert.equal(cycle.targetMinutes, 3);
  assert.equal(cycle.status, 'on_track');
});

test('invalid timestamps are ignored without crashing the report', () => {
  const item = contact({ messages: baseMessages([{ id: 'C2', type: 'customer', at: 'not-a-date', text: 'Bad timestamp' }]) });
  assert.deepEqual(assessDigitalResponseCycles(item, now).cycles, []);
});

test('queue metrics aggregate met, late and open cycles by channel', () => {
  const email = contact({ channel: 'email', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(5), text: 'Follow-up' },
    { id: 'A2', type: 'agent', at: iso(6), text: 'Reply' }
  ]) });
  const chat = contact({ channel: 'live_chat', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' }
  ]) });
  const metrics = digitalResponseCycleMetrics([email, chat], now);
  assert.equal(metrics.totalCycles, 2);
  assert.equal(metrics.met, 1);
  assert.equal(metrics.open, 1);
  assert.equal(metrics.byChannel.email.met, 1);
  assert.equal(metrics.byChannel.live_chat.open, 1);
});


test('response timestamps earlier than the customer turn are rejected as corrupt', () => {
  const item = contact({ channel: 'live_chat', messages: baseMessages([
    { id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' },
    { id: 'A2', type: 'agent', at: iso(9), text: 'Timestamp-corrupt response' }
  ]) });
  assert.equal(assessDigitalResponseCycles(item, now).cycles.length, 0);
});

test('response cycle channel is inherited from its parent digital contact', () => {
  const item = contact({ channel: 'social', messages: baseMessages([{ id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' }]) });
  assert.equal(assessDigitalResponseCycles(item, now).cycles[0].channel, 'social');
});

test('assessment does not mutate customer messages or contact state', () => {
  const item = contact({ messages: baseMessages([{ id: 'C2', type: 'customer', at: iso(10), text: 'Follow-up' }]) });
  const before = JSON.stringify(item);
  assessDigitalResponseCycles(item, now);
  assert.equal(JSON.stringify(item), before);
});

test('invalid contacts return a stable empty report', () => {
  assert.equal(assessDigitalResponseCycles(null, now).cycles.length, 0);
});

const sourceFixture = `import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';
function escapeHTML(value) { return String(value); }
function renderDigital() {
  const active = {};
  const digitalNow = Date.now();
  const activeSla = {};
    const activeSlaClass = activeSla.status === 'breached' ? 'breached' : activeSla.status === 'at_risk' ? 'at-risk' : activeSla.status === 'met' ? 'met' : 'on-track';
  const view = \
    \`<div class="digital-sla-banner \${activeSlaClass}"><div><strong>FIRST-RESPONSE SERVICE LEVEL</strong><small>First response</small></div><span>MET</span></div>
         <div class="digital-thread">\${messageRows}</div>\`;
  return view;
}
`;

test('Vite transform injects the independent response-cycle engine and panel', () => {
  const plugin = calloriaDigitalResponseCyclePluginV721();
  const warnings = [];
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, sourceFixture, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.equal(warnings.length, 0);
  assert.match(result.code, /digital-response-cycle-engine-v721\.js/);
  assert.match(result.code, /calloria-digital-response-cycle-v721\.css/);
  assert.match(result.code, /renderDigitalResponseCyclePanel\(active, digitalNow\)/);
  assert.match(result.code, /\$\{responseCyclePanel\}/);
});

test('Vite transform skips source drift without applying partial edits', () => {
  const plugin = calloriaDigitalResponseCyclePluginV721();
  const warnings = [];
  const changed = sourceFixture.replace("from './digital-sla-engine.js';", "from './renamed-sla-engine.js';");
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, changed, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});

test('Vite transform is limited to js/main.js', () => {
  const plugin = calloriaDigitalResponseCyclePluginV721();
  assert.equal(plugin.transform.call({ warn() {} }, sourceFixture, '/repo/customer-care.html'), null);
});

test('Vite transform is idempotent after its marker is present', () => {
  const plugin = calloriaDigitalResponseCyclePluginV721();
  const first = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  const second = plugin.transform.call({ warn() {} }, first.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('transformed application fixture passes Node syntax checking', async () => {
  const plugin = calloriaDigitalResponseCyclePluginV721();
  const result = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  const folder = await mkdtemp(join(tmpdir(), 'calloria-v721-'));
  const path = join(folder, 'main.mjs');
  try {
    await writeFile(path, result.code, 'utf8');
    const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
