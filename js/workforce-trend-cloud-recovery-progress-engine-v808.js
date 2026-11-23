/**
 * CALLORIA v8.8 — local, organisation-scoped progress tracking for cloud recovery runbooks.
 * Stores only fixed check identifiers and step indexes. It never stores organisation IDs,
 * error text, account details, employee/customer data or any cloud/database records.
 */
export const WORKFORCE_TREND_CLOUD_RECOVERY_PROGRESS_VERSION_V808 = '8.8.0';

const MAX_ORGANISATION_ID_LENGTH = 256;
const MAX_REMEDIATIONS = 12;
const MAX_STEPS_PER_REMEDIATION = 20;

/**
 * Produce a stable storage namespace without putting the raw organisation identifier in
 * browser storage keys or values. This is a namespace hash, not a security boundary.
 */
export function buildWorkforceTrendRecoveryStorageKeyV808(organisationId) {
  if (typeof organisationId !== 'string') return '';
  const value = organisationId.trim();
  if (!value || value.length > MAX_ORGANISATION_ID_LENGTH) return '';

  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0;
    hashB = Math.imul(hashB ^ (code + index), 0x85ebca6b) >>> 0;
  }
  const opaqueNamespace = `${hashA.toString(16).padStart(8, '0')}${hashB.toString(16).padStart(8, '0')}`;
  return `calloria:workforce-cloud-recovery:v808:${opaqueNamespace}`;
}

function allowedStepCounts(plan) {
  const allowed = new Map();
  for (const item of Array.isArray(plan) ? plan.slice(0, MAX_REMEDIATIONS) : []) {
    if (!item || typeof item.id !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(item.id)) continue;
    const count = Array.isArray(item.steps) ? Math.min(item.steps.length, MAX_STEPS_PER_REMEDIATION) : 0;
    if (count > 0) allowed.set(item.id, count);
  }
  return allowed;
}

/**
 * Accept only progress that maps to the current fixed remediation plan. Unknown IDs,
 * invalid indexes, duplicate indexes and stale steps are discarded.
 */
export function normaliseWorkforceTrendRecoveryProgressV808(raw, plan) {
  const allowed = allowedStepCounts(plan);
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const sourceChecks = source.checks && typeof source.checks === 'object' && !Array.isArray(source.checks)
    ? source.checks
    : source;
  const result = {};

  for (const [id, indexes] of Object.entries(sourceChecks).slice(0, MAX_REMEDIATIONS)) {
    const stepCount = allowed.get(id);
    if (!stepCount || !Array.isArray(indexes)) continue;
    const valid = [...new Set(indexes.filter(index => Number.isInteger(index) && index >= 0 && index < stepCount))].sort((a, b) => a - b);
    if (valid.length) result[id] = Object.freeze(valid);
  }
  return Object.freeze(result);
}

export function updateWorkforceTrendRecoveryProgressV808(progress, remediationId, stepIndex, completed, plan) {
  const allowed = allowedStepCounts(plan);
  const stepCount = allowed.get(remediationId);
  if (!stepCount || !Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex >= stepCount) {
    return normaliseWorkforceTrendRecoveryProgressV808(progress, plan);
  }

  const current = normaliseWorkforceTrendRecoveryProgressV808(progress, plan);
  const next = Object.fromEntries(Object.entries(current).map(([id, indexes]) => [id, [...indexes]]));
  const indexes = new Set(next[remediationId] || []);
  if (completed === true) indexes.add(stepIndex);
  else indexes.delete(stepIndex);
  const sorted = [...indexes].sort((a, b) => a - b);
  if (sorted.length) next[remediationId] = sorted;
  else delete next[remediationId];
  return normaliseWorkforceTrendRecoveryProgressV808(next, plan);
}

export function summariseWorkforceTrendRecoveryProgressV808(plan, progress) {
  const safeProgress = normaliseWorkforceTrendRecoveryProgressV808(progress, plan);
  return Object.freeze((Array.isArray(plan) ? plan : []).map(item => {
    const total = Array.isArray(item?.steps) ? item.steps.length : 0;
    const completed = Math.min(total, (safeProgress[item?.id] || []).length);
    return Object.freeze({
      id: item?.id || '',
      completed,
      total,
      allCompleted: total > 0 && completed === total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0
    });
  }));
}

/** Load local checklist state. Storage errors and malformed data safely return empty progress. */
export function loadWorkforceTrendRecoveryProgressV808(storage, storageKey, plan) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storageKey !== 'string' || !storageKey) {
    return Object.freeze({});
  }
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return Object.freeze({});
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== 1) return Object.freeze({});
    return normaliseWorkforceTrendRecoveryProgressV808(parsed.checks, plan);
  } catch {
    return Object.freeze({});
  }
}

/** Save only the small, allow-listed checklist state. No diagnostic or identity data is stored. */
export function saveWorkforceTrendRecoveryProgressV808(storage, storageKey, progress, plan) {
  if (!storage || typeof storage.setItem !== 'function' || typeof storageKey !== 'string' || !storageKey) {
    return false;
  }
  try {
    const checks = normaliseWorkforceTrendRecoveryProgressV808(progress, plan);
    storage.setItem(storageKey, JSON.stringify({ schemaVersion: 1, checks }));
    return true;
  } catch {
    return false;
  }
}
