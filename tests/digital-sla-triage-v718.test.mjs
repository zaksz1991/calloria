import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DIGITAL_TRIAGE_POLICY,
  sortDigitalQueueBySla,
  digitalTriageSnapshot,
  digitalTriageExplanation,
  isDigitalTriageCandidate
} from '../js/digital-triage-engine-v718.js';
import { calloriaDigitalSlaTriagePluginV718, CALLORIA_V718_MARKER } from '../build/calloria-digital-sla-triage-v718.mjs';

const NOW = Date.parse('2026-11-22T10:00:00.000Z');
function contact(id, {
  channel = 'email', priority = 'normal', minutesOld = 5,
  slaMinutes = 240, status = 'queued', firstResponseAt = null
} = {}) {
  return {
    id, channel, priority, status, slaMinutes,
    receivedAt: new Date(NOW - minutesOld * 60_000).toISOString(),
    firstResponseAt, slaDueAt: new Date(NOW - minutesOld * 60_000 + slaMinutes * 60_000).toISOString()
  };
}
function baseSorter(queue, { channel = 'all', now = NOW } = {}) {
  return (Array.isArray(queue) ? queue : [])
    .filter(item => item?.status === 'queued' && (channel === 'all' || item.channel === channel))
    .map(item => ({ ...item, waitSeconds: Math.max(0, Math.floor((now - Date.parse(item.receivedAt || now)) / 1000)) }));
}
function slaAssessor(item, now = NOW) {
  const received = Date.parse(item?.receivedAt || '');
  if (!Number.isFinite(received)) return { status: 'unavailable' };
  const targetMs = Math.max(1, Number(item?.slaMinutes || 20)) * 60_000;
  const due = Date.parse(item?.slaDueAt || '') || received + targetMs;
  const elapsed = Math.max(0, now - received);
  return {
    status: now >= due ? 'breached' : elapsed >= targetMs * 0.75 ? 'at_risk' : 'on_track',
    remainingMs: due - now,
    targetMinutes: targetMs / 60_000
  };
}
const triageOptions = (extra = {}) => ({ now: NOW, baseSorter, slaAssessor, ...extra });

test('SLA breaches rank ahead of at-risk and on-track work', () => {
  const queue = [
    contact('on-track', { minutesOld: 2, slaMinutes: 240 }),
    contact('at-risk', { minutesOld: 2, slaMinutes: 2 }),
    contact('breached', { minutesOld: 8, slaMinutes: 2 })
  ];
  const ranked = sortDigitalQueueBySla(queue, triageOptions());
  assert.deepEqual(ranked.map(item => item.id), ['breached', 'at-risk', 'on-track']);
});

test('ageing boost is bounded and reduces starvation within the same SLA band', () => {
  const agedLow = contact('aged-low', { priority: 'low', minutesOld: 60, slaMinutes: 240 });
  const freshCritical = contact('fresh-critical', { priority: 'critical', minutesOld: 1, slaMinutes: 240 });
  const ranked = sortDigitalQueueBySla([freshCritical, agedLow], triageOptions());
  assert.equal(ranked[0].id, 'aged-low');
  assert.equal(ranked[0].triageAgingBoost, DIGITAL_TRIAGE_POLICY.maximumAgingBoost);
  assert.equal(ranked[1].triageAgingBoost, 0);
});

test('SLA urgency still outranks an ageing boost', () => {
  const oldOnTrack = contact('old-on-track', { priority: 'low', minutesOld: 90, slaMinutes: 240 });
  const atRisk = contact('at-risk-now', { priority: 'low', minutesOld: 2, slaMinutes: 2 });
  const ranked = sortDigitalQueueBySla([oldOnTrack, atRisk], triageOptions());
  assert.equal(ranked[0].id, 'at-risk-now');
});

test('queue sorter respects the selected channel filter', () => {
  const queue = [
    contact('email-1', { channel: 'email' }),
    contact('chat-1', { channel: 'live_chat', slaMinutes: 2 }),
    contact('social-1', { channel: 'social', slaMinutes: 20 })
  ];
  assert.deepEqual(sortDigitalQueueBySla(queue, triageOptions({ channel: 'social' })).map(item => item.id), ['social-1']);
});

test('sorter never mutates original queue or contact objects', () => {
  const queue = [contact('a', { minutesOld: 30 }), contact('b', { minutesOld: 2 })];
  const before = JSON.stringify(queue);
  const sorted = sortDigitalQueueBySla(queue, triageOptions());
  assert.notEqual(sorted, queue);
  assert.equal(JSON.stringify(queue), before);
  assert.equal(Object.hasOwn(queue[0], 'triageReason'), false);
});

test('snapshot counts waiting, SLA risk and aged work by channel', () => {
  const queue = [
    contact('breach-email', { channel: 'email', minutesOld: 5, slaMinutes: 2 }),
    contact('risk-chat', { channel: 'live_chat', minutesOld: 2, slaMinutes: 2.5 }),
    contact('standard-social', { channel: 'social', minutesOld: 1, slaMinutes: 20 })
  ];
  const snapshot = digitalTriageSnapshot(queue, triageOptions());
  assert.equal(snapshot.counts.waiting, 3);
  assert.equal(snapshot.counts.breached, 1);
  assert.equal(snapshot.counts.atRisk, 1);
  assert.equal(snapshot.byChannel.email.breached, 1);
  assert.equal(snapshot.next.id, 'breach-email');
  assert.equal(snapshot.topItems.length, 3);
});

test('same urgency uses stable oldest-first ordering after score ties', () => {
  const older = contact('older', { priority: 'normal', minutesOld: 7, slaMinutes: 240 });
  const newer = contact('newer', { priority: 'normal', minutesOld: 5, slaMinutes: 240 });
  const ranked = sortDigitalQueueBySla([newer, older], triageOptions());
  assert.equal(ranked[0].id, 'older');
});

test('explanation is safe for missing records and contains triage rationale', () => {
  assert.equal(digitalTriageExplanation(null), 'No triage details available.');
  const item = sortDigitalQueueBySla([contact('late', { minutesOld: 9, slaMinutes: 2 })], triageOptions())[0];
  assert.match(digitalTriageExplanation(item), /SLA breached/i);
  assert.match(digitalTriageExplanation(item), /waiting 9m 0s/i);
});

test('only supported queued channel contacts are triage candidates', () => {
  assert.equal(isDigitalTriageCandidate(contact('q')), true);
  assert.equal(isDigitalTriageCandidate(contact('done', { status: 'resolved' })), false);
  assert.equal(isDigitalTriageCandidate({ status: 'queued', channel: 'voice' }), false);
});

const badgeFixture = '<span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>';
const sourceFixture = [
  "import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';",
  'function renderDigital() {',
  "  const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);",
  "  const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });",
  '  const a = `' + badgeFixture + '`;',
  '  const b = `' + badgeFixture + '`;',
  '}'
].join('\n');

test('Vite transform installs SLA-aware ordering and queue explanations', () => {
  const plugin = calloriaDigitalSlaTriagePluginV718();
  const result = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  assert.ok(result?.code.includes(CALLORIA_V718_MARKER));
  assert.match(result.code, /import \{ sortDigitalQueueBySla \}/);
  assert.equal((result.code.match(/sortDigitalQueueBySla\(/g) || []).length, 2);
  assert.match(result.code, /baseSorter: sortDigitalQueue, slaAssessor: assessDigitalSla/);
  assert.equal((result.code.match(/triageReason/g) || []).length, 4);
});

test('Vite transform skips already patched sources idempotently', () => {
  const plugin = calloriaDigitalSlaTriagePluginV718();
  const first = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  const second = plugin.transform.call({ warn() {} }, first.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('Vite transform skips changed anchors without partial output', () => {
  const warnings = [];
  const plugin = calloriaDigitalSlaTriagePluginV718();
  const changed = sourceFixture.replace('const quickQueue = sortDigitalQueue', 'const quickQueue = legacyQueueSort');
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, changed, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});

test('Vite transform ignores non-main modules', () => {
  const plugin = calloriaDigitalSlaTriagePluginV718();
  assert.equal(plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/other.js'), null);
});

test('transformed queue fixture remains valid JavaScript', () => {
  const plugin = calloriaDigitalSlaTriagePluginV718();
  const result = plugin.transform.call({ warn() {} }, sourceFixture, '/repo/js/main.js');
  assert.ok(result?.code);
  const folder = mkdtempSync(join(tmpdir(), 'calloria-v718-'));
  const file = join(folder, 'main.mjs');
  try {
    writeFileSync(file, result.code);
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
