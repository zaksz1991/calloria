/** CALLORIA v8.6 — read-only organisation workforce-history health diagnostics. */
export const WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806 = '8.6.0';

const CHECKS = new Set([
  'workspace',
  'auth_session',
  'permissions',
  'local_history',
  'snapshot_store',
  'conflict_archive',
  'backup_integrity'
]);
const STATUSES = new Set(['passed', 'warning', 'failed']);

function cleanText(value, max = 180) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(90, Math.floor(number))) : null;
}

function validDate(value) {
  const date = new Date(value ?? '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

/**
 * Build a presentation-safe report. Only fixed check IDs and bounded counts are
 * accepted; raw database errors, organisation IDs and customer/employee data
 * must never be passed to this function.
 */
export function buildWorkforceTrendCloudHealthReportV806({ checks = [], checkedAt = new Date().toISOString() } = {}) {
  const normalised = [];
  const seen = new Set();
  for (const raw of Array.isArray(checks) ? checks : []) {
    if (!raw || typeof raw !== 'object') continue;
    const id = cleanText(raw.id, 32);
    if (!CHECKS.has(id) || seen.has(id)) continue;
    const status = cleanText(raw.status, 16);
    if (!STATUSES.has(status)) continue;
    seen.add(id);
    normalised.push(Object.freeze({
      id,
      label: cleanText(raw.label, 72),
      status,
      detail: cleanText(raw.detail, 180),
      count: raw.count == null ? null : safeCount(raw.count)
    }));
  }
  const failed = normalised.filter(item => item.status === 'failed').length;
  const warnings = normalised.filter(item => item.status === 'warning').length;
  const overall = failed ? 'blocked' : warnings ? 'attention' : normalised.length === CHECKS.size ? 'healthy' : 'incomplete';
  return Object.freeze({
    version: WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806,
    checkedAt: validDate(checkedAt),
    overall,
    passed: normalised.filter(item => item.status === 'passed').length,
    warnings,
    failed,
    checks: Object.freeze(normalised)
  });
}

export function workforceTrendCloudHealthOverallLabelV806(value) {
  return value === 'healthy' ? 'All checks passed' :
    value === 'attention' ? 'Review warnings' :
    value === 'blocked' ? 'Cloud history is not ready' : 'Check incomplete';
}
