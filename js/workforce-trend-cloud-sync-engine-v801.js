export const WORKFORCE_TREND_CLOUD_SYNC_VERSION = '8.1.0';
export const WORKFORCE_TREND_CLOUD_TABLE = 'calloria_workforce_trend_snapshots';
export const WORKFORCE_TREND_CLOUD_SAVE_RPC = 'calloria_save_workforce_trend_snapshots';
export const WORKFORCE_TREND_CLOUD_LIMIT = 90;
const ALLOWED_WORKSTREAMS = new Set(['voice', 'email', 'live_chat', 'social', 'unmapped']);

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function cleanText(value, max = 100) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function count(value) {
  const number = finite(value);
  return number === null ? 0 : Math.max(0, Math.min(1000000, Math.floor(number)));
}
function percent(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(100, Math.round(number * 100) / 100));
}

/** Revalidate the strict aggregate snapshot schema before any browser/cloud merge. */
export function normaliseCloudWorkforceTrendSnapshotV801(raw) {
  if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 1) return null;
  const captured = new Date(raw.capturedAt ?? '');
  if (!Number.isFinite(captured.getTime()) || !raw.summary || typeof raw.summary !== 'object') return null;
  const summary = raw.summary;
  const workstreams = (Array.isArray(raw.workstreams) ? raw.workstreams : [])
    .filter(row => row && typeof row === 'object' && ALLOWED_WORKSTREAMS.has(cleanText(row.id, 30)))
    .slice(0, 5)
    .map(row => ({
      id: cleanText(row.id, 30),
      label: cleanText(row.label, 60),
      available: Boolean(row.available),
      completed: count(row.completed),
      responseTargetRate: percent(row.responseTargetRate),
      open: count(row.open),
      overdue: count(row.overdue),
      atRisk: count(row.atRisk)
    }));
  const departments = (Array.isArray(raw.departments) ? raw.departments : [])
    .filter(row => row && typeof row === 'object' && cleanText(row.department, 100))
    .slice(0, 100)
    .map(row => ({
      department: cleanText(row.department, 100),
      agents: count(row.agents),
      completed: count(row.completed),
      responseTargetRate: percent(row.responseTargetRate),
      open: count(row.open),
      overdue: count(row.overdue),
      atRisk: count(row.atRisk)
    }));
  return {
    schemaVersion: 1,
    capturedAt: captured.toISOString(),
    sourceVersion: cleanText(raw.sourceVersion, 20) || 'unknown',
    summary: {
      digitalAgents: count(summary.digitalAgents),
      completedReplies: count(summary.completedReplies),
      openDigitalWork: count(summary.openDigitalWork),
      overdueDigitalWork: count(summary.overdueDigitalWork),
      atRiskDigitalWork: count(summary.atRiskDigitalWork),
      responseTargetRate: percent(summary.responseTargetRate),
      workstreamsAvailable: count(summary.workstreamsAvailable),
      departmentsAvailable: count(summary.departmentsAvailable),
      agentsNeedingSupervisorAttention: count(summary.agentsNeedingSupervisorAttention),
      departmentCoveragePercent: percent(summary.departmentCoveragePercent),
      mappedDepartmentAgents: count(summary.mappedDepartmentAgents),
      identifiedDigitalAgents: count(summary.identifiedDigitalAgents)
    },
    workstreams,
    departments
  };
}

function normaliseHistory(history) {
  const entries = new Map();
  for (const candidate of Array.isArray(history) ? history : []) {
    const snapshot = normaliseCloudWorkforceTrendSnapshotV801(candidate);
    if (snapshot) entries.set(snapshot.capturedAt, snapshot);
  }
  return [...entries.values()]
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    .slice(-WORKFORCE_TREND_CLOUD_LIMIT);
}

/** Extract only validated aggregate snapshots from Supabase rows. */
export function cloudTrendRowsToSnapshotsV801(rows) {
  if (!Array.isArray(rows)) return [];
  return normaliseHistory(rows.map(row => row && typeof row === 'object' ? row.snapshot : null));
}

/**
 * Merge cloud and local histories without duplicate capture times.
 * Local entries take precedence at an identical timestamp so unsynchronised
 * local edits are not silently overwritten during a load/merge operation.
 */
export function mergeWorkforceTrendCloudHistoryV801(localHistory, cloudRows) {
  const cloud = cloudTrendRowsToSnapshotsV801(cloudRows);
  const local = normaliseHistory(localHistory);
  return normaliseHistory([...cloud, ...local]);
}

/** Prepare a bounded, schema-validated payload for the sanitising database RPC. */
export function prepareWorkforceTrendCloudPayloadV801(history) {
  return normaliseHistory(history);
}
