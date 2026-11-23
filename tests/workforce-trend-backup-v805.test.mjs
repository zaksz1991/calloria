import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  createWorkforceTrendBackupV805,
  verifyWorkforceTrendBackupV805,
  mergeWorkforceTrendBackupForLocalRestoreV805,
  workforceTrendBackupOrgFingerprintV805,
  WORKFORCE_TREND_BACKUP_SCHEMA_V805,
  WORKFORCE_TREND_BACKUP_VERSION_V805,
  WORKFORCE_TREND_BACKUP_MAX_BYTES_V805
} from '../js/workforce-trend-backup-engine-v805.js';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from '../build/calloria-workforce-trend-cloud-sync-v801.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORG_A = '3f0b4f2a-2f2b-4c2f-9e1a-111111111111';
const ORG_B = '4f0b4f2a-2f2b-4c2f-9e1a-222222222222';
const capturedAt = '2026-11-22T10:00:00.000Z';

function snapshot(overrides = {}) {
  return {
    schemaVersion: 1,
    capturedAt,
    sourceVersion: 'v7.31',
    summary: {
      digitalAgents: 6,
      completedReplies: 120,
      openDigitalWork: 8,
      overdueDigitalWork: 2,
      atRiskDigitalWork: 1,
      responseTargetRate: 94,
      workstreamsAvailable: 3,
      departmentsAvailable: 2,
      agentsNeedingSupervisorAttention: 1,
      departmentCoveragePercent: 90,
      mappedDepartmentAgents: 5,
      identifiedDigitalAgents: 6
    },
    workstreams: [{ id: 'email', label: 'Email', available: true, completed: 40, responseTargetRate: 95, open: 3, overdue: 1, atRisk: 0 }],
    departments: [{ department: 'Customer Care', agents: 6, completed: 120, responseTargetRate: 94, open: 8, overdue: 2, atRisk: 1 }],
    ...overrides
  };
}
function conflictingSnapshot() {
  const item = snapshot();
  item.summary.completedReplies = 99;
  return item;
}
function conflictRow() {
  return {
    id: '6f0b4f2a-2f2b-4c2f-9e1a-333333333333',
    captured_at: capturedAt,
    local_snapshot: snapshot(),
    cloud_snapshot: conflictingSnapshot(),
    status: 'open',
    resolution: null,
    created_at: '2026-11-22T10:05:00.000Z',
    resolved_at: null
  };
}

async function sampleBackup() {
  return createWorkforceTrendBackupV805({
    organizationId: ORG_A,
    organizationLabel: 'RuffNeck Support',
    localHistory: [snapshot()],
    cloudRows: [{ snapshot: conflictingSnapshot(), captured_at: capturedAt }],
    conflictRows: [conflictRow()],
    exportedAt: '2026-11-22T11:00:00.000Z'
  });
}

test('v8.5 backup release identity and size limit are stable', () => {
  assert.equal(WORKFORCE_TREND_BACKUP_VERSION_V805, '8.5.0');
  assert.equal(WORKFORCE_TREND_BACKUP_SCHEMA_V805, 'calloria.workforce-trend-backup');
  assert.equal(WORKFORCE_TREND_BACKUP_MAX_BYTES_V805, 12 * 1024 * 1024);
});

test('organisation fingerprint is stable, distinct and does not expose the raw organisation ID', async () => {
  const a1 = await workforceTrendBackupOrgFingerprintV805(ORG_A);
  const a2 = await workforceTrendBackupOrgFingerprintV805(ORG_A);
  const b = await workforceTrendBackupOrgFingerprintV805(ORG_B);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.match(a1, /^[0-9a-f]{64}$/);
  await assert.rejects(workforceTrendBackupOrgFingerprintV805('not-a-uuid'), /valid active organisation ID/);
});

test('export contains local, organisation and conflict evidence with a SHA-256 integrity digest', async () => {
  const backup = await sampleBackup();
  assert.equal(backup.document.localHistory.length, 1);
  assert.equal(backup.document.organisationHistory.length, 1);
  assert.equal(backup.document.conflictArchive.length, 1);
  assert.equal(backup.document.integrity.algorithm, 'SHA-256');
  assert.match(backup.document.integrity.digest, /^[0-9a-f]{64}$/);
  assert.equal(backup.json.includes(ORG_A), false);
  assert.equal(backup.json.includes('RuffNeck Support'), true);
  assert.equal(backup.json.includes('customerName'), false);
  assert.equal(backup.json.includes('transcript'), false);
});

test('backup verifies and normalises before returning a recovery object', async () => {
  const exported = await sampleBackup();
  const verified = await verifyWorkforceTrendBackupV805(exported.json);
  assert.equal(verified.organizationLabel, 'RuffNeck Support');
  assert.equal(verified.localHistory[0].summary.completedReplies, 120);
  assert.equal(verified.organisationHistory[0].summary.completedReplies, 99);
  assert.equal(verified.conflictArchive[0].status, 'open');
  assert.equal(verified.integrity.digest, exported.document.integrity.digest);
});

test('tampered backup fails integrity verification without returning history', async () => {
  const exported = await sampleBackup();
  const tampered = JSON.parse(exported.json);
  tampered.localHistory[0].summary.completedReplies = 9999;
  await assert.rejects(verifyWorkforceTrendBackupV805(tampered), /integrity check failed/);
});

test('backup for another organisation is detectable before restore', async () => {
  const exported = await sampleBackup();
  const verified = await verifyWorkforceTrendBackupV805(exported.json);
  const activeFingerprint = await workforceTrendBackupOrgFingerprintV805(ORG_B);
  assert.notEqual(verified.organizationFingerprint, activeFingerprint);
});

test('restore merges history locally, keeps current local values and does not call cloud services', async () => {
  const exported = await sampleBackup();
  const verified = await verifyWorkforceTrendBackupV805(exported.json);
  const current = [snapshot({ summary: { ...snapshot().summary, completedReplies: 140 } })];
  const result = mergeWorkforceTrendBackupForLocalRestoreV805(current, verified);
  assert.equal(result.snapshots.length, 1);
  assert.equal(result.snapshots[0].summary.completedReplies, 140, 'current local value must win on timestamp collisions');
  assert.equal(result.added, 0);
  assert.equal(result.retainedExisting, 1);
  assert.ok(result.conflictCount >= 1);
});

test('restore recovers non-conflicting older snapshots and enforces the 90-row limit', async () => {
  const backup = await createWorkforceTrendBackupV805({
    organizationId: ORG_A,
    organizationLabel: 'RuffNeck Support',
    localHistory: Array.from({ length: 90 }, (_, index) => snapshot({
      capturedAt: new Date(Date.parse(capturedAt) + index * 60_000).toISOString()
    })),
    cloudRows: []
  });
  const verified = await verifyWorkforceTrendBackupV805(backup.json);
  const result = mergeWorkforceTrendBackupForLocalRestoreV805([], verified);
  assert.equal(result.snapshots.length, 90);
  assert.equal(result.added, 90);
});

test('invalid schemas, duplicate timestamps, bad conflict rows and oversized files are rejected', async () => {
  const exported = await sampleBackup();
  const unknown = JSON.parse(exported.json);
  unknown.unexpected = true;
  await assert.rejects(verifyWorkforceTrendBackupV805(unknown), /unrecognised top-level fields/);

  const duplicate = JSON.parse(exported.json);
  duplicate.localHistory.push(snapshot());
  await assert.rejects(verifyWorkforceTrendBackupV805(duplicate), /integrity check failed/);

  await assert.rejects(verifyWorkforceTrendBackupV805('x'.repeat(WORKFORCE_TREND_BACKUP_MAX_BYTES_V805 + 1)), /12 MiB/);
  await assert.rejects(verifyWorkforceTrendBackupV805('{bad json'), /valid JSON/);
});

test('export refuses more archived conflict rows than the backup schema can retain', async () => {
  const rows = Array.from({ length: 91 }, (_, index) => {
    const at = new Date(Date.parse(capturedAt) + index * 60_000).toISOString();
    const local = snapshot({ capturedAt: at });
    const cloud = snapshot({ capturedAt: at, summary: { ...snapshot().summary, completedReplies: 200 + index } });
    return {
      id: `${String(index + 1).padStart(8, '0')}-2f2b-4c2f-9e1a-333333333333`,
      captured_at: at,
      local_snapshot: local,
      cloud_snapshot: cloud,
      status: 'open',
      resolution: null,
      created_at: at,
      resolved_at: null
    };
  });
  await assert.rejects(createWorkforceTrendBackupV805({ organizationId: ORG_A, conflictRows: rows }), /exceeds the 90-record limit/);
});

test('restore rejects forged, unverified or unsupported backup objects', async () => {
  assert.throws(() => mergeWorkforceTrendBackupForLocalRestoreV805([], { schema: 'other', version: 1 }), /verified CALLORIA v8.5 backup/);
  assert.throws(() => mergeWorkforceTrendBackupForLocalRestoreV805([], {
    schema: 'calloria.workforce-trend-backup', version: 1, localHistory: [], organisationHistory: [],
    conflictArchive: [], integrity: { algorithm: 'SHA-256', digest: 'a'.repeat(64) }
  }), /verified CALLORIA v8.5 backup/);
  const exported = await sampleBackup();
  const verified = await verifyWorkforceTrendBackupV805(exported.json);
  assert.doesNotThrow(() => mergeWorkforceTrendBackupForLocalRestoreV805([], verified));
});

test('cloud sync plugin injects accessible recovery controls and safe local-only restore handlers', () => {
  const marker = '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */';
  const importLine = "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';";
  const statusAnchor = '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>';
  const source = `${marker}\n${importLine}\n${statusAnchor}\n`;
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const result = plugin.transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.match(result.code, /data-workforce-trend-backup-export/);
  assert.match(result.code, /data-workforce-trend-backup-import/);
  assert.match(result.code, /data-workforce-trend-backup-file/);
  assert.match(result.code, /verifyWorkforceTrendBackupV805/);
  assert.match(result.code, /No Supabase records were changed/);
  assert.match(result.code, /workforceTrendBackupOrgFingerprintV805/);
  const temporary = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v805-')), 'transformed.js');
  fs.writeFileSync(temporary, result.code);
  const check = spawnSync(process.execPath, ['--check', temporary], { encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test('build preflight and integration audit require the new backup engine, test and controls', () => {
  const preflight = fs.readFileSync(path.join(projectRoot, 'tools/calloria-build-preflight.mjs'), 'utf8');
  const audit = fs.readFileSync(path.join(projectRoot, 'tools/calloria-v8-integration-audit.mjs'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.match(preflight, /js\/workforce-trend-backup-engine-v805\.js/);
  assert.match(preflight, /tests\/workforce-trend-backup-v805\.test\.mjs/);
  assert.match(audit, /data-workforce-trend-backup-export/);
  assert.match(audit, /data-workforce-trend-backup-import/);
  assert.equal(pkg.scripts['verify:workforce-backup'], 'node --test tests/workforce-trend-backup-v805.test.mjs');
});

test('plugin skips a second transformation when the recovery marker is present', () => {
  const plugin = calloriaWorkforceTrendCloudSyncPluginV801();
  const result = plugin.transform.call({ warn() {} }, '/* CALLORIA_V805_WORKFORCE_RECOVERY_BACKUP */', '/repo/js/main.js');
  assert.equal(result, null);
});
