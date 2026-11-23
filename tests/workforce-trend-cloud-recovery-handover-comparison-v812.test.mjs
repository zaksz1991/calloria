import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  WORKFORCE_TREND_CLOUD_HANDOVER_COMPARISON_VERSION_V812,
  compareWorkforceTrendCloudRecoveryHandoversV812
} from '../js/workforce-trend-cloud-recovery-handover-comparison-engine-v812.js';

const stable = value => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

async function report({ generatedAt, workspace = 1, auth = 1, local = 0, snapshot = 0 } = {}) {
  const items = [
    { id: 'workspace', label: 'Organisation workspace', completedSteps: workspace, totalSteps: 2 },
    { id: 'auth_session', label: 'Authentication session', completedSteps: auth, totalSteps: 2 },
    { id: 'local_history', label: 'Local history recovery', completedSteps: local, totalSteps: 2 },
    { id: 'snapshot_store', label: 'Cloud snapshot storage', completedSteps: snapshot, totalSteps: 2 }
  ].map(item => ({ ...item, status: item.completedSteps === item.totalSteps ? 'complete' : item.completedSteps ? 'in_progress' : 'not_started' }));
  const completedSteps = items.reduce((sum, item) => sum + item.completedSteps, 0);
  const totalSteps = items.reduce((sum, item) => sum + item.totalSteps, 0);
  const payload = {
    format: 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER',
    schemaVersion: 1,
    engineVersion: '8.10.0',
    generatedAt,
    summary: {
      status: completedSteps === totalSteps ? 'checklist_complete' : completedSteps ? 'in_progress' : 'not_started',
      completedSteps,
      totalSteps,
      completionPercent: Math.round(completedSteps / totalSteps * 100)
    },
    items,
    limitation: 'Checklist progress only; checked steps do not prove repairs succeeded.'
  };
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(payload)));
  const checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return JSON.stringify({ payload, checksum });
}

test('v8.12 exposes the expected comparison engine version', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_HANDOVER_COMPARISON_VERSION_V812, '8.12.0');
});

test('two valid reports compare chronologically and return per-area movement', async () => {
  const older = await report({ generatedAt: '2026-11-23T18:00:00.000Z', workspace: 1, auth: 1 });
  const newer = await report({ generatedAt: '2026-11-23T19:00:00.000Z', workspace: 2, auth: 1, local: 1, snapshot: 1 });
  const result = await compareWorkforceTrendCloudRecoveryHandoversV812(newer, older, { cryptoObject: webcrypto });
  assert.equal(result.integrity, 'both_verified');
  assert.equal(result.outcome, 'improved');
  assert.equal(result.before.generatedAt, '2026-11-23T18:00:00.000Z');
  assert.equal(result.after.generatedAt, '2026-11-23T19:00:00.000Z');
  assert.equal(result.completedStepDelta, 3);
  assert.equal(result.completionPercentDelta, 38);
  assert.equal(result.improvedAreas, 3);
  assert.equal(result.regressedAreas, 0);
  assert.equal(result.items.find(item => item.id === 'workspace').delta, 1);
});

test('regressions are surfaced instead of being hidden by aggregate percentage', async () => {
  const older = await report({ generatedAt: '2026-11-23T18:00:00.000Z', workspace: 2, auth: 2, local: 1, snapshot: 1 });
  const newer = await report({ generatedAt: '2026-11-23T19:00:00.000Z', workspace: 1, auth: 2, local: 2, snapshot: 1 });
  const result = await compareWorkforceTrendCloudRecoveryHandoversV812(older, newer, { cryptoObject: webcrypto });
  assert.equal(result.outcome, 'mixed');
  assert.equal(result.completedStepDelta, 0);
  assert.equal(result.improvedAreas, 1);
  assert.equal(result.regressedAreas, 1);
  assert.equal(result.items.find(item => item.id === 'workspace').direction, 'regressed');
  assert.equal(result.items.find(item => item.id === 'local_history').direction, 'improved');
});

test('a wholly lower later checklist is classified as regressed', async () => {
  const older = await report({ generatedAt: '2026-11-23T18:00:00.000Z', workspace: 2, auth: 2, local: 2, snapshot: 2 });
  const newer = await report({ generatedAt: '2026-11-23T19:00:00.000Z', workspace: 1, auth: 1, local: 1, snapshot: 1 });
  const result = await compareWorkforceTrendCloudRecoveryHandoversV812(older, newer, { cryptoObject: webcrypto });
  assert.equal(result.outcome, 'regressed');
  assert.equal(result.completedStepDelta, -4);
  assert.equal(result.completionPercentDelta, -50);
});

test('tampered or invalid reports are rejected before comparison', async () => {
  const good = await report({ generatedAt: '2026-11-23T18:00:00.000Z' });
  const tampered = JSON.parse(good);
  tampered.payload.summary.completedSteps = 99;
  await assert.rejects(compareWorkforceTrendCloudRecoveryHandoversV812(good, JSON.stringify(tampered), { cryptoObject: webcrypto }), /summary does not match|checksum does not match/i);
});

test('different checklist definitions are rejected', async () => {
  const one = await report({ generatedAt: '2026-11-23T18:00:00.000Z' });
  const twoObj = JSON.parse(await report({ generatedAt: '2026-11-23T19:00:00.000Z' }));
  twoObj.payload.items.pop();
  const payload = twoObj.payload;
  payload.summary.totalSteps = payload.items.reduce((n, item) => n + item.totalSteps, 0);
  payload.summary.completedSteps = payload.items.reduce((n, item) => n + item.completedSteps, 0);
  payload.summary.completionPercent = Math.round(payload.summary.completedSteps / payload.summary.totalSteps * 100);
  payload.summary.status = payload.summary.completedSteps ? 'in_progress' : 'not_started';
  const digest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(payload)));
  twoObj.checksum = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  await assert.rejects(compareWorkforceTrendCloudRecoveryHandoversV812(one, JSON.stringify(twoObj), { cryptoObject: webcrypto }), /different recovery areas/);
});

test('result explicitly disclaims organisation identity and repair success', async () => {
  const first = await report({ generatedAt: '2026-11-23T18:00:00.000Z' });
  const second = await report({ generatedAt: '2026-11-23T19:00:00.000Z' });
  const result = await compareWorkforceTrendCloudRecoveryHandoversV812(first, second, { cryptoObject: webcrypto });
  assert.match(result.limitation, /do not identify an organisation/i);
  assert.match(result.limitation, /does not prove that repairs succeeded/i);
  assert.equal(Object.hasOwn(result, 'organisationScopeKey'), false);
});

test('equal timestamps are reported as ambiguous chronology', async () => {
  const same = await report({ generatedAt: '2026-11-23T18:00:00.000Z', workspace: 1 });
  const other = await report({ generatedAt: '2026-11-23T18:00:00.000Z', workspace: 2 });
  const result = await compareWorkforceTrendCloudRecoveryHandoversV812(same, other, { cryptoObject: webcrypto });
  assert.equal(result.sameTimestamp, true);
});
