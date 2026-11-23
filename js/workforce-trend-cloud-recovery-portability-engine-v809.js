/**
 * CALLORIA v8.9 — verified, organisation-scoped portability for recovery checklists.
 * The backup contains allow-listed step indexes only. It never contains organisation IDs,
 * account details, database errors, employee/customer data or workforce history records.
 */
export const WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809 = '8.9.0';

export const WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_FORMAT_V809 = 'CALLORIA_WORKFORCE_RECOVERY_PROGRESS';
export const WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809 = 256 * 1024;

const MAX_ORGANISATION_SCOPE_KEY_LENGTH = 128;
const MAX_REMEDIATIONS = 12;
const MAX_STEPS_PER_REMEDIATION = 20;
const ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const EXPECTED_SCOPE_PATTERN = /^calloria:workforce-cloud-recovery:v808:[a-f0-9]{16}$/;

function assertScopeKey(value) {
  if (typeof value !== 'string' || value.length > MAX_ORGANISATION_SCOPE_KEY_LENGTH || !EXPECTED_SCOPE_PATTERN.test(value)) {
    throw new Error('A valid active organisation recovery scope is required.');
  }
  return value;
}

function planShape(plan) {
  if (!Array.isArray(plan) || !plan.length || plan.length > MAX_REMEDIATIONS) {
    throw new Error('The current recovery checklist is unavailable. Run the read-only health check again.');
  }
  const seen = new Set();
  return plan.map(item => {
    const id = typeof item?.id === 'string' ? item.id : '';
    const stepCount = Array.isArray(item?.steps) ? Math.min(item.steps.length, MAX_STEPS_PER_REMEDIATION) : 0;
    if (!ID_PATTERN.test(id) || seen.has(id) || stepCount < 1) {
      throw new Error('The current recovery checklist contains an unsupported item.');
    }
    seen.add(id);
    return Object.freeze({ id, stepCount });
  });
}

function normaliseChecks(rawChecks, shape) {
  const allowed = new Map(shape.map(item => [item.id, item.stepCount]));
  const source = rawChecks && typeof rawChecks === 'object' && !Array.isArray(rawChecks) ? rawChecks : {};
  const result = {};
  for (const [id, rawIndexes] of Object.entries(source).slice(0, MAX_REMEDIATIONS)) {
    const max = allowed.get(id);
    if (!max || !Array.isArray(rawIndexes)) continue;
    const indexes = [...new Set(rawIndexes.filter(value => Number.isInteger(value) && value >= 0 && value < max))].sort((a, b) => a - b);
    if (indexes.length) result[id] = Object.freeze(indexes);
  }
  return Object.freeze(result);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(value, cryptoObject) {
  if (!cryptoObject?.subtle?.digest || typeof TextEncoder !== 'function') {
    throw new Error('Secure browser cryptography is unavailable. Open CALLORIA using its HTTPS address in a supported browser.');
  }
  const digest = await cryptoObject.subtle.digest('SHA-256', new TextEncoder().encode(stableStringify(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function countCompleted(progress) {
  return Object.values(progress).reduce((sum, indexes) => sum + indexes.length, 0);
}

function validTimestamp(value) {
  const date = new Date(value ?? '');
  if (!Number.isFinite(date.getTime())) throw new Error('The recovery checklist backup has an invalid export date.');
  return date.toISOString();
}

function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

/** Create a SHA-256 checked JSON export for the active organisation and current checklist. */
export async function createWorkforceTrendRecoveryProgressBackupV809({
  organisationScopeKey,
  plan,
  progress,
  exportedAt = new Date().toISOString(),
  cryptoObject = globalThis.crypto
} = {}) {
  const scopeKey = assertScopeKey(organisationScopeKey);
  const shape = planShape(plan);
  const safeProgress = normaliseChecks(progress, shape);
  const payload = Object.freeze({
    format: WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_FORMAT_V809,
    schemaVersion: 1,
    engineVersion: WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809,
    organisationScopeKey: scopeKey,
    exportedAt: validTimestamp(exportedAt),
    planShape: Object.freeze(shape),
    checks: safeProgress
  });
  const checksum = await sha256Hex(payload, cryptoObject);
  const document = Object.freeze({ payload, checksum });
  const json = JSON.stringify(document, null, 2);
  const completedSteps = countCompleted(safeProgress);
  const totalSteps = shape.reduce((sum, item) => sum + item.stepCount, 0);
  const datePart = payload.exportedAt.replace(/[:.]/g, '-');
  return Object.freeze({
    json,
    fileName: `CALLORIA-recovery-checklist-${datePart}.json`,
    checksum,
    completedSteps,
    totalSteps,
    sizeBytes: new TextEncoder().encode(json).byteLength
  });
}

/** Verify file size, checksum, active organisation scope and exact checklist shape before use. */
export async function verifyWorkforceTrendRecoveryProgressBackupV809(text, {
  expectedOrganisationScopeKey,
  plan,
  cryptoObject = globalThis.crypto,
  maxBytes = WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809
} = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Select a CALLORIA recovery checklist backup file.');
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error('The selected recovery checklist backup exceeds the 256 KiB file limit.');

  let document;
  try { document = JSON.parse(text); } catch { throw new Error('The selected recovery checklist backup is not valid JSON.'); }
  if (!document || typeof document !== 'object' || !document.payload || typeof document.payload !== 'object') {
    throw new Error('The selected file is not a CALLORIA recovery checklist backup.');
  }
  const payload = document.payload;
  const requiredKeys = ['checks', 'engineVersion', 'exportedAt', 'format', 'organisationScopeKey', 'planShape', 'schemaVersion'];
  if (Object.keys(payload).sort().join('|') !== requiredKeys.sort().join('|') ||
      payload.format !== WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_FORMAT_V809 ||
      payload.schemaVersion !== 1 ||
      payload.engineVersion !== WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809 ||
      typeof document.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(document.checksum)) {
    throw new Error('The selected file has an unsupported CALLORIA recovery checklist format.');
  }

  const expectedScope = assertScopeKey(expectedOrganisationScopeKey);
  if (payload.organisationScopeKey !== expectedScope) {
    throw new Error('This checklist backup belongs to a different organisation workspace. No progress was imported.');
  }

  const currentShape = planShape(plan);
  const incomingShape = Array.isArray(payload.planShape) ? payload.planShape : [];
  if (stableStringify(incomingShape) !== stableStringify(currentShape)) {
    throw new Error('The recovery checklist has changed since this backup was exported. Run diagnostics and export a backup from the current checklist.');
  }

  const expectedChecksum = await sha256Hex(payload, cryptoObject);
  if (!constantTimeEqual(expectedChecksum, document.checksum)) {
    throw new Error('The recovery checklist backup failed its SHA-256 integrity check. No progress was imported.');
  }

  const progress = normaliseChecks(payload.checks, currentShape);
  const completedSteps = countCompleted(progress);
  const totalSteps = currentShape.reduce((sum, item) => sum + item.stepCount, 0);
  return Object.freeze({
    progress,
    exportedAt: validTimestamp(payload.exportedAt),
    completedSteps,
    totalSteps,
    checksum: expectedChecksum
  });
}

/** Merge verified checklist ticks without replacing progress already recorded on this browser. */
export function mergeWorkforceTrendRecoveryProgressV809(current, imported, plan) {
  const shape = planShape(plan);
  const safeCurrent = normaliseChecks(current, shape);
  const safeImported = normaliseChecks(imported, shape);
  const merged = {};
  for (const item of shape) {
    const indexes = [...new Set([...(safeCurrent[item.id] || []), ...(safeImported[item.id] || [])])].sort((a, b) => a - b);
    if (indexes.length) merged[item.id] = Object.freeze(indexes);
  }
  return Object.freeze(merged);
}
