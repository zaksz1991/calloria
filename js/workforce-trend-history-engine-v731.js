/**
 * CALLORIA v7.31 — aggregate workforce trend snapshots.
 *
 * Snapshots intentionally exclude employee identifiers, customer data, case
 * references and raw interaction transcripts. Persistence is handled by the
 * browser-only supervisor UI; this module remains a pure transformation layer.
 */

export const WORKFORCE_TREND_HISTORY_VERSION = '7.31.0';
export const WORKFORCE_TREND_HISTORY_LIMIT = 90;

const ALLOWED_WORKSTREAMS = new Set(['voice', 'email', 'live_chat', 'social', 'unmapped']);

function text(value, max = 100) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}
function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function count(value) {
  const number = finite(value);
  return number === null ? 0 : Math.max(0, Math.floor(number));
}
function round(value, places = 1) {
  const number = finite(value);
  if (number === null) return null;
  const factor = 10 ** places;
  return Math.round(number * factor) / factor;
}
function timestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function nullablePercent(value) {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(100, round(number, 1)));
}

/** Create a privacy-minimised snapshot from the v7.30 command-centre board. */
export function createWorkforceTrendSnapshot(board = {}, capturedAt = Date.now()) {
  if (!board || typeof board !== 'object') return null;
  const captured = timestamp(capturedAt);
  if (!captured) return null;
  const summary = board.summary && typeof board.summary === 'object' ? board.summary : {};
  const sourceWorkstreams = Array.isArray(board.workstreams?.rows) ? board.workstreams.rows : [];
  const sourceDepartments = Array.isArray(board.departments?.rows) ? board.departments.rows : [];

  const workstreams = sourceWorkstreams
    .filter(row => row && typeof row === 'object' && ALLOWED_WORKSTREAMS.has(text(row.id, 30)))
    .map(row => ({
      id: text(row.id, 30),
      label: text(row.label, 60),
      available: Boolean(row.available),
      completed: count(row.completed),
      responseTargetRate: nullablePercent(row.responseTargetRate),
      open: count(row.open),
      overdue: count(row.overdue),
      atRisk: count(row.atRisk)
    }));

  const departments = sourceDepartments
    .filter(row => row && typeof row === 'object' && text(row.department, 100))
    .slice(0, 100)
    .map(row => ({
      department: text(row.department, 100),
      agents: count(row.agents),
      completed: count(row.completed),
      responseTargetRate: nullablePercent(row.responseTargetRate),
      open: count(row.open),
      overdue: count(row.overdue),
      atRisk: count(row.atRisk)
    }));

  return {
    schemaVersion: 1,
    capturedAt: captured,
    sourceVersion: text(board.version, 20) || 'unknown',
    summary: {
      digitalAgents: count(summary.digitalAgents),
      completedReplies: count(summary.completedReplies),
      openDigitalWork: count(summary.openDigitalWork),
      overdueDigitalWork: count(summary.overdueDigitalWork),
      atRiskDigitalWork: count(summary.atRiskDigitalWork),
      responseTargetRate: nullablePercent(summary.responseTargetRate),
      workstreamsAvailable: count(summary.workstreamsAvailable),
      departmentsAvailable: count(summary.departmentsAvailable),
      agentsNeedingSupervisorAttention: count(summary.agentsNeedingSupervisorAttention),
      departmentCoveragePercent: nullablePercent(board.departments?.coveragePercent),
      mappedDepartmentAgents: count(board.departments?.mappedAgentCount),
      identifiedDigitalAgents: count(board.departments?.identifiedAgentCount)
    },
    workstreams,
    departments
  };
}

/** Validate and minimise a stored snapshot before it is reused or exported. */
export function normaliseWorkforceTrendSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || raw.schemaVersion !== 1) return null;
  const capturedAt = timestamp(raw.capturedAt);
  if (!capturedAt || !raw.summary || typeof raw.summary !== 'object') return null;
  const boardLike = {
    version: raw.sourceVersion,
    summary: raw.summary,
    workstreams: { rows: Array.isArray(raw.workstreams) ? raw.workstreams : [] },
    departments: {
      rows: Array.isArray(raw.departments) ? raw.departments : [],
      coveragePercent: raw.summary.departmentCoveragePercent,
      mappedAgentCount: raw.summary.mappedDepartmentAgents,
      identifiedAgentCount: raw.summary.identifiedDigitalAgents
    }
  };
  return createWorkforceTrendSnapshot(boardLike, capturedAt);
}

/** Return a validated, chronologically ordered history, bounded to 90 entries. */
export function normaliseWorkforceTrendHistory(raw, limit = WORKFORCE_TREND_HISTORY_LIMIT) {
  const max = Math.min(WORKFORCE_TREND_HISTORY_LIMIT, Math.max(1, Math.floor(finite(limit) ?? WORKFORCE_TREND_HISTORY_LIMIT)));
  if (!Array.isArray(raw)) return [];
  const byTimestamp = new Map();
  for (const candidate of raw) {
    const snapshot = normaliseWorkforceTrendSnapshot(candidate);
    if (snapshot) byTimestamp.set(snapshot.capturedAt, snapshot);
  }
  return [...byTimestamp.values()]
    .sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt))
    .slice(-max);
}

/** Add or replace a timestamp-identical snapshot and apply bounded retention. */
export function appendWorkforceTrendSnapshot(history, snapshot, limit = WORKFORCE_TREND_HISTORY_LIMIT) {
  const valid = normaliseWorkforceTrendSnapshot(snapshot);
  if (!valid) return normaliseWorkforceTrendHistory(history, limit);
  return normaliseWorkforceTrendHistory([...normaliseWorkforceTrendHistory(history, limit), valid], limit);
}

function deltaMetric(label, key, previous, current, higherIsBetter = null, suffix = '') {
  const from = finite(previous?.[key]);
  const to = finite(current?.[key]);
  if (from === null || to === null) {
    return { label, key, previous: from, current: to, delta: null, suffix, trend: 'unscored' };
  }
  const delta = round(to - from, key === 'responseTargetRate' ? 1 : 0);
  let trend = 'unchanged';
  if (delta !== 0 && higherIsBetter !== null) {
    const positive = higherIsBetter ? delta > 0 : delta < 0;
    trend = positive ? 'improved' : 'worsened';
  }
  return { label, key, previous: from, current: to, delta, suffix, trend };
}

/** Compare two aggregate snapshots; no metric is inferred when either side is missing. */
export function compareWorkforceTrendSnapshots(previousRaw, currentRaw) {
  const previous = normaliseWorkforceTrendSnapshot(previousRaw);
  const current = normaliseWorkforceTrendSnapshot(currentRaw);
  if (!previous || !current) return null;

  const summaryMetrics = [
    deltaMetric('Completed replies', 'completedReplies', previous.summary, current.summary, true),
    deltaMetric('Open digital work', 'openDigitalWork', previous.summary, current.summary, false),
    deltaMetric('Overdue digital work', 'overdueDigitalWork', previous.summary, current.summary, false),
    deltaMetric('At-risk digital work', 'atRiskDigitalWork', previous.summary, current.summary, false),
    deltaMetric('Response-target rate', 'responseTargetRate', previous.summary, current.summary, true, ' pp')
  ];

  const previousChannels = new Map(previous.workstreams.map(row => [row.id, row]));
  const workstreams = current.workstreams.map(row => {
    const prior = previousChannels.get(row.id);
    if (!prior) return { id: row.id, label: row.label, status: 'new', metrics: [] };
    return {
      id: row.id,
      label: row.label,
      status: 'continuing',
      metrics: [
        deltaMetric('Completed', 'completed', prior, row, true),
        deltaMetric('Open', 'open', prior, row, false),
        deltaMetric('Overdue', 'overdue', prior, row, false),
        deltaMetric('On target', 'responseTargetRate', prior, row, true, ' pp')
      ]
    };
  });

  const previousDepartments = new Map(previous.departments.map(row => [row.department.toLocaleLowerCase(), row]));
  const currentKeys = new Set(current.departments.map(row => row.department.toLocaleLowerCase()));
  const departments = current.departments.map(row => {
    const prior = previousDepartments.get(row.department.toLocaleLowerCase());
    if (!prior) return { department: row.department, status: 'new', metrics: [] };
    return {
      department: row.department,
      status: 'continuing',
      metrics: [
        deltaMetric('Completed', 'completed', prior, row, true),
        deltaMetric('Open', 'open', prior, row, false),
        deltaMetric('Overdue', 'overdue', prior, row, false),
        deltaMetric('At risk', 'atRisk', prior, row, false),
        deltaMetric('On target', 'responseTargetRate', prior, row, true, ' pp')
      ]
    };
  });
  const previousOnlyDepartments = previous.departments
    .filter(row => !currentKeys.has(row.department.toLocaleLowerCase()))
    .map(row => row.department);

  return {
    from: previous.capturedAt,
    to: current.capturedAt,
    summaryMetrics,
    workstreams,
    departments,
    previousOnlyDepartments
  };
}

function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Export only aggregated history; never emits agent IDs or customer records. */
export function workforceTrendHistoryCsv(rawHistory = []) {
  const history = normaliseWorkforceTrendHistory(rawHistory);
  const rows = [[
    'captured_at', 'section', 'name', 'agents', 'completed',
    'response_target_percent', 'open', 'overdue', 'at_risk', 'department_coverage_percent'
  ]];
  for (const snapshot of history) {
    const s = snapshot.summary;
    rows.push([
      snapshot.capturedAt, 'summary', 'All attributed digital work', s.digitalAgents,
      s.completedReplies, s.responseTargetRate ?? '', s.openDigitalWork,
      s.overdueDigitalWork, s.atRiskDigitalWork, s.departmentCoveragePercent ?? ''
    ]);
    for (const row of snapshot.workstreams) {
      rows.push([
        snapshot.capturedAt, 'workstream', row.label, '', row.completed,
        row.responseTargetRate ?? '', row.open, row.overdue, row.atRisk, ''
      ]);
    }
    for (const row of snapshot.departments) {
      rows.push([
        snapshot.capturedAt, 'department', row.department, row.agents, row.completed,
        row.responseTargetRate ?? '', row.open, row.overdue, row.atRisk, ''
      ]);
    }
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}
