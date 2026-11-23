import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_VERSION_V811,
  WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_FORMAT_V811,
  WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811,
  verifyWorkforceTrendCloudRecoveryHandoverV811
} from '../js/workforce-trend-cloud-recovery-handover-verification-engine-v811.js';
const stable = value => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);

async function validReport() {
  const payload = {
    format: 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER',
    schemaVersion: 1,
    engineVersion: '8.10.0',
    generatedAt: '2026-11-23T21:00:00.000Z',
    summary: { status: 'in_progress', completedSteps: 5, totalSteps: 6, completionPercent: 83 },
    items: [
      { id: 'workspace', label: 'Organisation workspace', completedSteps: 1, totalSteps: 2, status: 'in_progress' },
      { id: 'auth_session', label: 'Authentication session', completedSteps: 2, totalSteps: 2, status: 'complete' },
      { id: 'local_history', label: 'Local history recovery', completedSteps: 2, totalSteps: 2, status: 'complete' }
    ],
    limitation: 'Checklist progress only; checked steps do not prove repairs succeeded.'
  };
  const checksumBytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(payload)));
  const checksum = [...new Uint8Array(checksumBytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return JSON.stringify({ payload, checksum });
}

test('v8.11 exposes a bounded local handover verifier', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_VERSION_V811, '8.11.0');
  assert.equal(WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_FORMAT_V811, 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER');
  assert.equal(WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811, 262144);
});

test('valid v8.10 handover passes checksum and summary verification', async () => {
  const result = await verifyWorkforceTrendCloudRecoveryHandoverV811(await validReport(), { cryptoObject: webcrypto });
  assert.equal(result.integrity, 'verified');
  assert.equal(result.completedSteps, 5);
  assert.equal(result.totalSteps, 6);
  assert.equal(result.completionPercent, 83);
  assert.equal(result.status, 'in_progress');
  assert.match(result.note, /does not prove authorship or successful repairs/i);
});

test('tampering with report payload is detected', async () => {
  const parsed = JSON.parse(await validReport());
  parsed.payload.summary.completionPercent = 100;
  await assert.rejects(
    verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(parsed), { cryptoObject: webcrypto }),
    /summary does not match|checksum does not match/i
  );
});

test('unsupported outer or payload fields are rejected', async () => {
  const parsed = JSON.parse(await validReport());
  parsed.unexpected = 'extra';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(parsed), { cryptoObject: webcrypto }), /outer structure/);
  const second = JSON.parse(await validReport());
  second.payload.email = 'person@example.com';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(second), { cryptoObject: webcrypto }), /payload contains/);
});

test('unsupported engine version and altered limitation statement are rejected', async () => {
  const wrongVersion = JSON.parse(await validReport());
  wrongVersion.payload.engineVersion = '8.9.0';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(wrongVersion), { cryptoObject: webcrypto }), /v8.10/);
  const noDisclaimer = JSON.parse(await validReport());
  noDisclaimer.payload.limitation = 'Everything repaired.';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(noDisclaimer), { cryptoObject: webcrypto }), /limitation notice/);
});

test('duplicate IDs, inconsistent item status and inconsistent totals are rejected', async () => {
  const duplicate = JSON.parse(await validReport());
  duplicate.payload.items[1].id = 'workspace';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(duplicate), { cryptoObject: webcrypto }), /invalid or duplicated/);
  const badStatus = JSON.parse(await validReport());
  badStatus.payload.items[0].status = 'complete';
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(badStatus), { cryptoObject: webcrypto }), /status does not match/);
  const badTotals = JSON.parse(await validReport());
  badTotals.payload.summary.totalSteps += 1;
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(JSON.stringify(badTotals), { cryptoObject: webcrypto }), /summary does not match/);
});

test('invalid JSON, wrong input type and oversized files are rejected', async () => {
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811('{broken', { cryptoObject: webcrypto }), /valid JSON/);
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811({ payload: {} }, { cryptoObject: webcrypto }), /Select a CALLORIA/);
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(' '.repeat(WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811 + 1), { cryptoObject: webcrypto }), /exceeds the 256 KiB/);
});

test('missing secure cryptography blocks verification', async () => {
  await assert.rejects(verifyWorkforceTrendCloudRecoveryHandoverV811(await validReport(), { cryptoObject: null }), /Secure browser cryptography is unavailable/);
});

test('verified report contains no organisation key and performs no import side effects', async () => {
  const input = await validReport();
  const result = await verifyWorkforceTrendCloudRecoveryHandoverV811(input, { cryptoObject: webcrypto });
  assert.equal(JSON.stringify(result).includes('abcdef0123456789'), false);
  assert.equal(Object.hasOwn(result, 'progress'), false);
  assert.equal(Object.hasOwn(result, 'save'), false);
});
