import {
  cloudTrendRowsToSnapshotsV801,
  normaliseCloudWorkforceTrendSnapshotV801,
  prepareWorkforceTrendCloudPayloadV801
} from './workforce-trend-cloud-sync-engine-v801.js';
import { inspectWorkforceTrendCloudConflictsV802 } from './workforce-trend-cloud-sync-engine-v802.js';

export const WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 = '8.4.0';
export const WORKFORCE_TREND_CLOUD_CONFLICT_ARCHIVE_TABLE_V803 = 'calloria_workforce_trend_conflicts';
export const WORKFORCE_TREND_CLOUD_CONFLICT_RECORD_RPC_V803 = 'calloria_record_workforce_trend_conflicts_v803';
export const WORKFORCE_TREND_CLOUD_CONFLICT_RESOLVE_RPC_V803 = 'calloria_resolve_workforce_trend_conflict_v803';
export const WORKFORCE_TREND_CLOUD_CONFLICT_LIMIT_V803 = 90;

const RESOLUTIONS = new Set(['keep_local', 'keep_cloud']);
const STATUSES = new Set(['open', 'resolved']);
const METRICS = Object.freeze([
  ['completedReplies', 'Completed replies', 'count'],
  ['openDigitalWork', 'Open digital work', 'count'],
  ['overdueDigitalWork', 'Overdue digital work', 'count'],
  ['atRiskDigitalWork', 'At-risk digital work', 'count'],
  ['responseTargetRate', 'Response target achievement', 'percent'],
  ['agentsNeedingSupervisorAttention', 'Agents needing attention', 'count'],
  ['departmentCoveragePercent', 'Department coverage', 'percent']
]);

function safeDate(value) {
  const date = new Date(value ?? '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function safeText(value, max = 160) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function safeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(90, Math.floor(number))) : 0;
}
function safeId(value) {
  const id = String(value ?? '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/**
 * Produce only validated local/cloud pairs at capture times that genuinely
 * differ. Both snapshots pass the same strict aggregate allow-list used by
 * v8.1/v8.3 before they can be sent to the archive RPC.
 */
export function buildWorkforceTrendConflictArchivePayloadV803(localHistory, cloudRows) {
  const local = prepareWorkforceTrendCloudPayloadV801(localHistory);
  const cloud = cloudTrendRowsToSnapshotsV801(cloudRows);
  const localByTime = new Map(local.map(snapshot => [snapshot.capturedAt, snapshot]));
  const cloudByTime = new Map(cloud.map(snapshot => [snapshot.capturedAt, snapshot]));
  const comparison = inspectWorkforceTrendCloudConflictsV802(local, cloud.map(snapshot => ({ snapshot })));
  return comparison.conflictCapturedAt.slice(0, WORKFORCE_TREND_CLOUD_CONFLICT_LIMIT_V803)
    .map(capturedAt => ({
      capturedAt,
      localSnapshot: localByTime.get(capturedAt),
      cloudSnapshot: cloudByTime.get(capturedAt)
    }))
    .filter(pair => pair.localSnapshot && pair.cloudSnapshot &&
      JSON.stringify(pair.localSnapshot) !== JSON.stringify(pair.cloudSnapshot));
}

/** Validate a conflict archive row returned by Supabase before rendering it. */
export function normaliseWorkforceTrendConflictArchiveRowV803(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = safeId(raw.id);
  const capturedAt = safeDate(raw.captured_at ?? raw.capturedAt);
  const detectedAt = safeDate(raw.created_at ?? raw.detected_at ?? raw.detectedAt);
  const localSnapshot = normaliseCloudWorkforceTrendSnapshotV801(raw.local_snapshot ?? raw.localSnapshot);
  const cloudSnapshot = normaliseCloudWorkforceTrendSnapshotV801(raw.cloud_snapshot ?? raw.cloudSnapshot);
  const status = safeText(raw.status, 20);
  const resolution = raw.resolution == null ? null : safeText(raw.resolution, 30);
  const resolvedAt = raw.resolved_at == null ? null : safeDate(raw.resolved_at);
  if (!id || !capturedAt || !detectedAt || !localSnapshot || !cloudSnapshot ||
      !STATUSES.has(status) || localSnapshot.capturedAt !== capturedAt ||
      cloudSnapshot.capturedAt !== capturedAt ||
      JSON.stringify(localSnapshot) === JSON.stringify(cloudSnapshot)) return null;
  if (status === 'open' && (resolution !== null || resolvedAt !== null)) return null;
  if (status === 'resolved' && (!RESOLUTIONS.has(resolution) || !resolvedAt)) return null;
  return Object.freeze({
    id,
    capturedAt,
    detectedAt,
    status,
    resolution,
    resolvedAt,
    localSnapshot,
    cloudSnapshot
  });
}

/** Return a compact, presentation-safe metric comparison for one archived pair. */
export function compareWorkforceTrendConflictSnapshotsV803(localSnapshot, cloudSnapshot) {
  const local = normaliseCloudWorkforceTrendSnapshotV801(localSnapshot);
  const cloud = normaliseCloudWorkforceTrendSnapshotV801(cloudSnapshot);
  if (!local || !cloud || local.capturedAt !== cloud.capturedAt) return [];
  return METRICS.map(([key, label, kind]) => {
    const localValue = local.summary[key];
    const cloudValue = cloud.summary[key];
    const comparable = Number.isFinite(localValue) && Number.isFinite(cloudValue);
    return Object.freeze({
      key,
      label,
      kind,
      localValue,
      cloudValue,
      delta: comparable ? Math.round((localValue - cloudValue) * 100) / 100 : null
    });
  });
}

/** Validate the response from the append-only conflict archive RPC. */
export function parseWorkforceTrendConflictArchiveResultV803(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The conflict archive service returned an invalid result.');
  }
  return Object.freeze({ recorded: safeInteger(value.recorded), unchanged: safeInteger(value.unchanged) });
}

/** Accept only the two explicit, human-selected canonical-copy decisions. */
export function normaliseWorkforceTrendConflictResolutionV803(value) {
  const resolution = safeText(value, 30);
  return RESOLUTIONS.has(resolution) ? resolution : null;
}

export function workforceTrendConflictResolutionLabelV803(value) {
  const resolution = normaliseWorkforceTrendConflictResolutionV803(value);
  return resolution === 'keep_local' ? 'Local version selected' :
    resolution === 'keep_cloud' ? 'Organisation version retained' : 'Unresolved';
}
