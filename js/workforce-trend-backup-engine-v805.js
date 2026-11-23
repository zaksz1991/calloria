import { normaliseCloudWorkforceTrendSnapshotV801 } from './workforce-trend-cloud-sync-engine-v801.js';
import { normaliseWorkforceTrendConflictArchiveRowV803 } from './workforce-trend-cloud-sync-engine-v803.js';

export const WORKFORCE_TREND_BACKUP_VERSION_V805 = '8.5.0';
export const WORKFORCE_TREND_BACKUP_SCHEMA_V805 = 'calloria.workforce-trend-backup';
export const WORKFORCE_TREND_BACKUP_MAX_HISTORY_V805 = 90;
export const WORKFORCE_TREND_BACKUP_MAX_CONFLICTS_V805 = 90;
export const WORKFORCE_TREND_BACKUP_MAX_BYTES_V805 = 12 * 1024 * 1024;

const TOP_LEVEL_KEYS = Object.freeze([
  'schema', 'version', 'exportedAt', 'organizationFingerprint',
  'organizationLabel', 'localHistory', 'organisationHistory',
  'conflictArchive', 'integrity'
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
// Only objects returned by this module's successful verification step may be restored.
const verifiedBackups = new WeakSet();

function cleanText(value, max = 100) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function isoDate(value, label) {
  const date = new Date(value ?? '');
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} is not a valid timestamp.`);
  return date.toISOString();
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function bytes(value) {
  return new TextEncoder().encode(value);
}

async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof subtle.digest !== 'function') {
    throw new Error('SHA-256 verification requires a browser with Web Crypto support.');
  }
  const digest = await subtle.digest('SHA-256', bytes(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function normaliseSnapshotArray(raw, label) {
  if (!Array.isArray(raw)) throw new Error(`${label} must be an array.`);
  if (raw.length > WORKFORCE_TREND_BACKUP_MAX_HISTORY_V805) {
    throw new Error(`${label} exceeds the ${WORKFORCE_TREND_BACKUP_MAX_HISTORY_V805}-snapshot limit.`);
  }
  const result = [];
  const timestamps = new Set();
  for (const item of raw) {
    const snapshot = normaliseCloudWorkforceTrendSnapshotV801(item);
    if (!snapshot) throw new Error(`${label} contains a snapshot outside the approved aggregate schema.`);
    if (timestamps.has(snapshot.capturedAt)) throw new Error(`${label} contains duplicate capture timestamps.`);
    timestamps.add(snapshot.capturedAt);
    result.push(snapshot);
  }
  return result.sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
}

function normaliseConflictArray(raw) {
  if (!Array.isArray(raw)) throw new Error('Conflict archive must be an array.');
  if (raw.length > WORKFORCE_TREND_BACKUP_MAX_CONFLICTS_V805) {
    throw new Error(`Conflict archive exceeds the ${WORKFORCE_TREND_BACKUP_MAX_CONFLICTS_V805}-record limit.`);
  }
  const result = [];
  const ids = new Set();
  for (const item of raw) {
    const row = normaliseWorkforceTrendConflictArchiveRowV803(item);
    if (!row) throw new Error('Conflict archive contains an invalid or unsupported record.');
    if (ids.has(row.id)) throw new Error('Conflict archive contains duplicate record IDs.');
    ids.add(row.id);
    result.push(row);
  }
  return result.sort((a, b) => Date.parse(a.detectedAt) - Date.parse(b.detectedAt));
}

function assertEnvelopeKeys(value) {
  const actual = Object.keys(value).sort();
  const expected = [...TOP_LEVEL_KEYS].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error('Backup envelope contains missing or unrecognised top-level fields.');
  }
}

/** A one-way fingerprint binds a backup to its source organisation without exporting its raw UUID. */
export async function workforceTrendBackupOrgFingerprintV805(organizationId) {
  const id = String(organizationId ?? '').trim();
  if (!UUID.test(id)) throw new Error('A valid active organisation ID is required to create or restore this backup.');
  return sha256Hex(`CALLORIA:WORKFORCE-TREND-ORGANISATION:v1:${id.toLowerCase()}`);
}

/** Create a privacy-minimised, SHA-256-verifiable portable recovery document. */
export async function createWorkforceTrendBackupV805({
  organizationId,
  organizationLabel,
  localHistory = [],
  cloudRows = [],
  conflictRows = [],
  exportedAt = new Date().toISOString()
} = {}) {
  const cloudHistory = Array.isArray(cloudRows)
    ? cloudRows.map(row => row && typeof row === 'object' ? row.snapshot : null).filter(Boolean)
    : [];
  const payload = {
    schema: WORKFORCE_TREND_BACKUP_SCHEMA_V805,
    version: 1,
    exportedAt: isoDate(exportedAt, 'Export timestamp'),
    organizationFingerprint: await workforceTrendBackupOrgFingerprintV805(organizationId),
    organizationLabel: cleanText(organizationLabel, 100) || 'CALLORIA organisation',
    localHistory: normaliseSnapshotArray(localHistory, 'Local history'),
    organisationHistory: normaliseSnapshotArray(cloudHistory, 'Organisation history'),
    conflictArchive: normaliseConflictArray(conflictRows)
  };
  const document = {
    ...payload,
    integrity: {
      algorithm: 'SHA-256',
      digest: await sha256Hex(canonicalJson(payload))
    }
  };
  const serialised = JSON.stringify(document, null, 2);
  if (bytes(serialised).byteLength > WORKFORCE_TREND_BACKUP_MAX_BYTES_V805) {
    throw new Error('The recovery backup exceeds the 12 MiB file limit. Export a smaller history range.');
  }
  return Object.freeze({ document: Object.freeze(document), json: serialised });
}

/** Parse and verify a backup before any local or cloud state can be modified. */
export async function verifyWorkforceTrendBackupV805(input) {
  let source;
  if (typeof input === 'string') source = input;
  else {
    try { source = JSON.stringify(input); }
    catch { throw new Error('The selected backup cannot be read as JSON.'); }
  }
  if (typeof source !== 'string' || !source.trim()) throw new Error('The selected backup file is empty.');
  if (bytes(source).byteLength > WORKFORCE_TREND_BACKUP_MAX_BYTES_V805) {
    throw new Error('The selected backup exceeds the 12 MiB file limit.');
  }

  let raw;
  try { raw = JSON.parse(source); }
  catch { throw new Error('The selected file is not valid JSON.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The backup must be a JSON object.');
  assertEnvelopeKeys(raw);
  if (raw.schema !== WORKFORCE_TREND_BACKUP_SCHEMA_V805 || raw.version !== 1) {
    throw new Error('This is not a supported CALLORIA workforce recovery backup.');
  }
  if (!raw.integrity || raw.integrity.algorithm !== 'SHA-256' || !SHA256.test(String(raw.integrity.digest ?? ''))) {
    throw new Error('The backup integrity declaration is missing or unsupported.');
  }
  if (!SHA256.test(String(raw.organizationFingerprint ?? ''))) throw new Error('The backup has no valid organisation fingerprint.');

  const payload = { ...raw };
  delete payload.integrity;
  const actualDigest = await sha256Hex(canonicalJson(payload));
  if (actualDigest.toLowerCase() !== raw.integrity.digest.toLowerCase()) {
    throw new Error('Backup integrity check failed. The file may have changed or been damaged. No history was restored.');
  }

  const exportedAt = isoDate(raw.exportedAt, 'Backup export timestamp');
  const localHistory = normaliseSnapshotArray(raw.localHistory, 'Local history');
  const organisationHistory = normaliseSnapshotArray(raw.organisationHistory, 'Organisation history');
  const conflictArchive = normaliseConflictArray(raw.conflictArchive);
  const verified = Object.freeze({
    schema: WORKFORCE_TREND_BACKUP_SCHEMA_V805,
    version: 1,
    exportedAt,
    organizationFingerprint: raw.organizationFingerprint.toLowerCase(),
    organizationLabel: cleanText(raw.organizationLabel, 100) || 'CALLORIA organisation',
    localHistory: Object.freeze(localHistory),
    organisationHistory: Object.freeze(organisationHistory),
    conflictArchive: Object.freeze(conflictArchive),
    integrity: Object.freeze({ algorithm: 'SHA-256', digest: actualDigest })
  });
  verifiedBackups.add(verified);
  return verified;
}

/** Restore only into this browser. Existing local values win; no Supabase write is performed. */
export function mergeWorkforceTrendBackupForLocalRestoreV805(currentHistory, backup) {
  if (!backup || !verifiedBackups.has(backup)) {
    throw new Error('A verified CALLORIA v8.5 backup is required.');
  }
  const groups = [
    backup.organisationHistory,
    backup.conflictArchive.flatMap(row => [row.cloudSnapshot, row.localSnapshot]),
    backup.localHistory,
    normaliseSnapshotArray(currentHistory, 'Current local history')
  ];
  const byTime = new Map();
  const seenVariants = new Map();
  for (const group of groups) {
    for (const raw of group) {
      const snapshot = normaliseCloudWorkforceTrendSnapshotV801(raw);
      if (!snapshot) continue;
      const existing = seenVariants.get(snapshot.capturedAt);
      if (existing && JSON.stringify(existing) !== JSON.stringify(snapshot)) seenVariants.set(`${snapshot.capturedAt}#conflict`, true);
      else if (!existing) seenVariants.set(snapshot.capturedAt, snapshot);
      // Later groups have priority: backup-local values beat cloud/archive values,
      // and the current browser's values are never overwritten by imported data.
      byTime.set(snapshot.capturedAt, snapshot);
    }
  }
  const snapshots = [...byTime.values()]
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    .slice(-WORKFORCE_TREND_BACKUP_MAX_HISTORY_V805);
  const existingTimes = new Set(normaliseSnapshotArray(currentHistory, 'Current local history').map(item => item.capturedAt));
  const added = snapshots.filter(item => !existingTimes.has(item.capturedAt)).length;
  const collisionCount = [...seenVariants.keys()].filter(key => key.endsWith('#conflict')).length;
  return Object.freeze({
    snapshots: Object.freeze(snapshots),
    added,
    retainedExisting: snapshots.length - added,
    conflictCount: Math.min(90, Math.max(collisionCount, backup.conflictArchive.length))
  });
}
