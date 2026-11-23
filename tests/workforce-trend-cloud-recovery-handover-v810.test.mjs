import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_VERSION_V810,
  WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_FORMAT_V810,
  createWorkforceTrendCloudRecoveryHandoverV810
} from '../js/workforce-trend-cloud-recovery-handover-engine-v810.js';

const scope = 'calloria:workforce-cloud-recovery:v808:abcdef0123456789';
const plan = [
  { id: 'workspace', steps: ['Confirm workspace', 'Confirm membership'] },
  { id: 'auth_session', steps: ['Refresh session', 'Run diagnostics'] },
  { id: 'local_history', steps: ['Protect local history', 'Restore source'] }
];

async function make(overrides = {}) {
  return createWorkforceTrendCloudRecoveryHandoverV810({
    organisationScopeKey: scope,
    plan,
    progress: { workspace: [0], auth_session: [0, 1], local_history: [0, 1], unknown: [99] },
    generatedAt: '2026-11-23T21:00:00.000Z',
    cryptoObject: webcrypto,
    ...overrides
  });
}

test('v8.10 publishes a stable handover format and engine version', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_VERSION_V810, '8.10.0');
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_FORMAT_V810, 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER');
});

test('handover report counts only valid checked indexes and labels completion as checklist progress', async () => {
  const report = await make();
  assert.equal(report.completedSteps, 5);
  assert.equal(report.totalSteps, 6);
  assert.equal(report.completionPercent, 83);
  assert.equal(report.status, 'in_progress');
  const parsed = JSON.parse(report.json);
  assert.equal(parsed.payload.summary.status, 'in_progress');
  assert.equal(parsed.payload.items[1].status, 'complete');
  assert.match(report.text, /not proof that a repair succeeded/i);
  assert.match(report.textFileName, /\.txt$/);
});

test('report excludes the organisation scope key and arbitrary injected values', async () => {
  const report = await make({ progress: { workspace: [0], auth_session: [1], local_history: [0], injected: ['secret@example.com'] } });
  assert.equal(report.json.includes(scope), false);
  assert.equal(report.json.includes('secret@example.com'), false);
  assert.equal(report.json.includes('customer'), false);
});

test('report checksum matches the canonical payload', async () => {
  const report = await make();
  const parsed = JSON.parse(report.json);
  const stable = value => Array.isArray(value)
    ? `[${value.map(stable).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
      : JSON.stringify(value);
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(parsed.payload)));
  const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  assert.equal(parsed.checksum, checksum);
  assert.equal(report.checksum, checksum);
});

test('invalid organisation scope, duplicate plan ids and empty plans are rejected', async () => {
  await assert.rejects(make({ organisationScopeKey: 'org-real-id-123' }), /intended organisation workspace/);
  await assert.rejects(make({ plan: [...plan, { id: 'workspace', steps: ['duplicate'] }] }), /unsupported item/);
  await assert.rejects(make({ plan: [] }), /checklist is unavailable/);
});

test('no completed ticks produces not_started rather than implying successful recovery', async () => {
  const report = await make({ progress: {} });
  assert.equal(report.status, 'not_started');
  assert.equal(report.completionPercent, 0);
});

test('missing secure cryptography blocks report generation', async () => {
  await assert.rejects(make({ cryptoObject: null }), /Secure browser cryptography is unavailable/);
});
