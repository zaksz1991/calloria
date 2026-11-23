import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809,
  WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_FORMAT_V809,
  WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809,
  createWorkforceTrendRecoveryProgressBackupV809,
  verifyWorkforceTrendRecoveryProgressBackupV809,
  mergeWorkforceTrendRecoveryProgressV809
} from '../js/workforce-trend-cloud-recovery-portability-engine-v809.js';

const scopeA = 'calloria:workforce-cloud-recovery:v808:abcdef0123456789';
const scopeB = 'calloria:workforce-cloud-recovery:v808:0123456789abcdef';
const plan = [
  { id: 'local_history', steps: ['Protect local history', 'Verify the backup', 'Recover the source browser'] },
  { id: 'auth_session', steps: ['Refresh the session', 'Run diagnostics'] }
];

async function makeBackup(overrides = {}) {
  return createWorkforceTrendRecoveryProgressBackupV809({
    organisationScopeKey: scopeA,
    plan,
    progress: { local_history: [0, 2], auth_session: [1], unknown_check: [0] },
    exportedAt: '2026-11-23T20:00:00.000Z',
    cryptoObject: webcrypto,
    ...overrides
  });
}

test('v8.9 exports a pinned portability engine version and format', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809, '8.9.0');
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_FORMAT_V809, 'CALLORIA_WORKFORCE_RECOVERY_PROGRESS');
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809, 256 * 1024);
});

test('backup contains only allow-listed progress and does not expose raw organisation identifiers', async () => {
  const backup = await makeBackup();
  const document = JSON.parse(backup.json);
  assert.deepEqual(document.payload.checks, { local_history: [0, 2], auth_session: [1] });
  assert.equal(document.payload.organisationScopeKey, scopeA);
  assert.equal(backup.completedSteps, 3);
  assert.equal(backup.totalSteps, 5);
  assert.match(backup.fileName, /^CALLORIA-recovery-checklist-/);
  assert.equal(backup.json.includes('org-ruffneck-private-id'), false);
});

test('verified backup restores only valid step indexes for the matching organisation and plan', async () => {
  const backup = await makeBackup();
  const result = await verifyWorkforceTrendRecoveryProgressBackupV809(backup.json, {
    expectedOrganisationScopeKey: scopeA,
    plan,
    cryptoObject: webcrypto
  });
  assert.deepEqual(result.progress, { local_history: [0, 2], auth_session: [1] });
  assert.equal(result.completedSteps, 3);
  assert.equal(result.totalSteps, 5);
  assert.equal(result.exportedAt, '2026-11-23T20:00:00.000Z');
});

test('checksum alteration is rejected before checklist import', async () => {
  const backup = await makeBackup();
  const document = JSON.parse(backup.json);
  document.payload.checks.local_history = [0];
  await assert.rejects(
    verifyWorkforceTrendRecoveryProgressBackupV809(JSON.stringify(document), {
      expectedOrganisationScopeKey: scopeA, plan, cryptoObject: webcrypto
    }),
    /SHA-256 integrity check/
  );
});

test('backup cannot be imported into a different organisation workspace', async () => {
  const backup = await makeBackup();
  await assert.rejects(
    verifyWorkforceTrendRecoveryProgressBackupV809(backup.json, {
      expectedOrganisationScopeKey: scopeB, plan, cryptoObject: webcrypto
    }),
    /different organisation workspace/
  );
});

test('stale backup with a different checklist shape is rejected', async () => {
  const backup = await makeBackup();
  const changedPlan = [
    { id: 'local_history', steps: ['Protect local history', 'Verify the backup'] },
    { id: 'auth_session', steps: ['Refresh the session', 'Run diagnostics'] }
  ];
  await assert.rejects(
    verifyWorkforceTrendRecoveryProgressBackupV809(backup.json, {
      expectedOrganisationScopeKey: scopeA, plan: changedPlan, cryptoObject: webcrypto
    }),
    /checklist has changed/
  );
});

test('oversized, malformed and unsupported files are rejected', async () => {
  await assert.rejects(
    verifyWorkforceTrendRecoveryProgressBackupV809('x'.repeat(WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809 + 1), {
      expectedOrganisationScopeKey: scopeA, plan, cryptoObject: webcrypto
    }),
    /256 KiB/
  );
  await assert.rejects(
    verifyWorkforceTrendRecoveryProgressBackupV809('{bad json', {
      expectedOrganisationScopeKey: scopeA, plan, cryptoObject: webcrypto
    }),
    /not valid JSON/
  );
});

test('merge unions valid imported ticks and retains existing local progress', () => {
  const merged = mergeWorkforceTrendRecoveryProgressV809(
    { local_history: [0], auth_session: [0], stale: [1] },
    { local_history: [1, 2], auth_session: [0, 1], injected: ['<script>'] },
    plan
  );
  assert.deepEqual(merged, { local_history: [0, 1, 2], auth_session: [0, 1] });
  assert.equal(Object.isFrozen(merged), true);
});

test('missing secure cryptography prevents export instead of creating an unchecked file', async () => {
  await assert.rejects(makeBackup({ cryptoObject: null }), /Secure browser cryptography is unavailable/);
});
