import {
  cloudTrendRowsToSnapshotsV801,
  mergeWorkforceTrendCloudHistoryV801,
  prepareWorkforceTrendCloudPayloadV801
} from './workforce-trend-cloud-sync-engine-v801.js';

export const WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802 = '8.3.0';
export const WORKFORCE_TREND_CLOUD_SYNC_RPC_V802 = 'calloria_sync_workforce_trend_snapshots_v802';

function cleanCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(90, Math.floor(number))) : 0;
}

function stableSnapshot(snapshot) {
  // Both sides have already passed the same allow-list normaliser, which emits
  // keys in a deterministic order. JSON serialization is therefore suitable
  // for exact semantic comparison of the accepted snapshot shape.
  return JSON.stringify(snapshot);
}

/**
 * Compare browser-local and organisation history before merging.
 * Same-timestamp differences are reported rather than silently discarded.
 * No customer data, employee identifiers or raw unvalidated objects are returned.
 */
export function inspectWorkforceTrendCloudConflictsV802(localHistory, cloudRows) {
  const local = prepareWorkforceTrendCloudPayloadV801(localHistory);
  const cloud = cloudTrendRowsToSnapshotsV801(cloudRows);
  const localByTime = new Map(local.map(snapshot => [snapshot.capturedAt, snapshot]));
  const cloudByTime = new Map(cloud.map(snapshot => [snapshot.capturedAt, snapshot]));
  const localOnly = [];
  const cloudOnly = [];
  const identical = [];
  const conflicting = [];

  for (const [capturedAt, localSnapshot] of localByTime) {
    const cloudSnapshot = cloudByTime.get(capturedAt);
    if (!cloudSnapshot) localOnly.push(capturedAt);
    else if (stableSnapshot(localSnapshot) === stableSnapshot(cloudSnapshot)) identical.push(capturedAt);
    else conflicting.push(capturedAt);
  }
  for (const capturedAt of cloudByTime.keys()) {
    if (!localByTime.has(capturedAt)) cloudOnly.push(capturedAt);
  }

  return Object.freeze({
    localCount: local.length,
    cloudCount: cloud.length,
    localOnlyCount: localOnly.length,
    cloudOnlyCount: cloudOnly.length,
    identicalCount: identical.length,
    conflictCount: conflicting.length,
    conflictCapturedAt: Object.freeze(conflicting.slice(0, 90)),
    localOnlyCapturedAt: Object.freeze(localOnly.slice(0, 90)),
    cloudOnlyCapturedAt: Object.freeze(cloudOnly.slice(0, 90))
  });
}

/**
 * Preserve v8.1's local-wins merge behaviour, but require the caller to inspect
 * and report timestamp conflicts before persisting the merged local history.
 */
export function mergeWorkforceTrendCloudHistoryV802(localHistory, cloudRows) {
  return mergeWorkforceTrendCloudHistoryV801(localHistory, cloudRows);
}

/** Validate the structured JSONB response returned by the v8.3 sync RPC. */
export function parseWorkforceTrendCloudSyncResultV802(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The organisation sync service returned an invalid result.');
  }
  const conflictCapturedAt = (Array.isArray(value.conflictCapturedAt) ? value.conflictCapturedAt : [])
    .map(item => {
      const parsed = new Date(String(item ?? ''));
      return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
    })
    .filter(Boolean)
    .slice(0, 90);
  return Object.freeze({
    inserted: cleanCount(value.inserted),
    unchanged: cleanCount(value.unchanged),
    conflicts: cleanCount(value.conflicts),
    conflictCapturedAt: Object.freeze(conflictCapturedAt)
  });
}
