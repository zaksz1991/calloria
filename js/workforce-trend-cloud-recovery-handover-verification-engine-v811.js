/**
 * CALLORIA v8.11 — offline integrity verification for recovery handover reports.
 * A valid checksum confirms that the report matches its payload; it does not
 * authenticate the author or prove that a cloud repair succeeded.
 */
export const WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_VERSION_V811 = '8.11.0';
export const WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_FORMAT_V811 = 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER';
export const WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811 = 256 * 1024;

const EXPECTED_ENGINE_VERSION = '8.10.0';
const MAX_ITEMS = 12;
const MAX_STEPS_PER_ITEM = 20;
const ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const CHECKSUM_PATTERN = /^[a-f0-9]{64}$/;
const LABELS = Object.freeze({
  workspace: 'Organisation workspace',
  auth_session: 'Authentication session',
  permissions: 'Minimum permissions',
  local_history: 'Local history recovery',
  snapshot_store: 'Cloud snapshot storage',
  conflict_archive: 'Conflict archive',
  backup_integrity: 'Backup integrity'
});
const PAYLOAD_KEYS = ['format', 'schemaVersion', 'engineVersion', 'generatedAt', 'summary', 'items', 'limitation'];
const SUMMARY_KEYS = ['status', 'completedSteps', 'totalSteps', 'completionPercent'];
const ITEM_KEYS = ['id', 'label', 'completedSteps', 'totalSteps', 'status'];
const LIMITATION = 'Checklist progress only; checked steps do not prove repairs succeeded.';

function exactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function parseInput(input) {
  if (typeof input !== 'string') throw new Error('Select a CALLORIA JSON handover report.');
  const byteLength = new TextEncoder().encode(input).byteLength;
  if (byteLength > WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811) {
    throw new Error('The handover report exceeds the 256 KiB verification limit.');
  }
  let parsed;
  try { parsed = JSON.parse(input); }
  catch { throw new Error('The selected file is not valid JSON.'); }
  if (!exactKeys(parsed, ['payload', 'checksum'])) throw new Error('The handover file has an unsupported outer structure.');
  return parsed;
}

function expectedLabel(id) {
  return LABELS[id] || id.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function validatePayload(payload) {
  if (!exactKeys(payload, PAYLOAD_KEYS)) throw new Error('The handover payload contains missing or unsupported fields.');
  if (payload.format !== WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_FORMAT_V811 || payload.schemaVersion !== 1) {
    throw new Error('The handover report format or schema version is not supported.');
  }
  if (payload.engineVersion !== EXPECTED_ENGINE_VERSION) throw new Error('This verifier supports v8.10 handover reports only.');
  if (typeof payload.generatedAt !== 'string') throw new Error('The handover report timestamp is invalid.');
  const parsedDate = new Date(payload.generatedAt);
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString() !== payload.generatedAt) {
    throw new Error('The handover report timestamp is invalid.');
  }
  if (payload.limitation !== LIMITATION) throw new Error('The handover report limitation notice is missing or altered.');
  if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > MAX_ITEMS) {
    throw new Error('The handover report contains an unsupported number of recovery areas.');
  }
  const seen = new Set();
  let completedSteps = 0;
  let totalSteps = 0;
  const items = payload.items.map(item => {
    if (!exactKeys(item, ITEM_KEYS)) throw new Error('A recovery area contains missing or unsupported fields.');
    if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id) || seen.has(item.id)) {
      throw new Error('A recovery area identifier is invalid or duplicated.');
    }
    seen.add(item.id);
    if (item.label !== expectedLabel(item.id)) throw new Error('A recovery area label does not match its identifier.');
    if (!Number.isInteger(item.totalSteps) || item.totalSteps < 1 || item.totalSteps > MAX_STEPS_PER_ITEM ||
        !Number.isInteger(item.completedSteps) || item.completedSteps < 0 || item.completedSteps > item.totalSteps) {
      throw new Error('A recovery area has invalid step counts.');
    }
    const expectedStatus = item.completedSteps === item.totalSteps ? 'complete' : item.completedSteps ? 'in_progress' : 'not_started';
    if (item.status !== expectedStatus) throw new Error('A recovery area status does not match its step counts.');
    completedSteps += item.completedSteps;
    totalSteps += item.totalSteps;
    return Object.freeze({
      id: item.id,
      label: item.label,
      completedSteps: item.completedSteps,
      totalSteps: item.totalSteps,
      status: item.status
    });
  });
  if (!exactKeys(payload.summary, SUMMARY_KEYS)) throw new Error('The handover summary contains missing or unsupported fields.');
  const expectedStatus = completedSteps === totalSteps ? 'checklist_complete' : completedSteps ? 'in_progress' : 'not_started';
  const expectedPercent = Math.round((completedSteps / totalSteps) * 100);
  if (payload.summary.status !== expectedStatus ||
      payload.summary.completedSteps !== completedSteps ||
      payload.summary.totalSteps !== totalSteps ||
      payload.summary.completionPercent !== expectedPercent) {
    throw new Error('The handover summary does not match the recovery area details.');
  }
  return Object.freeze({
    generatedAt: payload.generatedAt,
    status: expectedStatus,
    completedSteps,
    totalSteps,
    completionPercent: expectedPercent,
    items: Object.freeze(items)
  });
}

async function digestPayload(payload, cryptoObject) {
  if (!cryptoObject?.subtle?.digest || typeof TextEncoder !== 'function') {
    throw new Error('Secure browser cryptography is unavailable. Open CALLORIA through HTTPS in a supported browser.');
  }
  const bytes = new TextEncoder().encode(stableStringify(payload));
  const digest = await cryptoObject.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a v8.10 JSON handover locally. This function does not upload, import,
 * persist, or apply any checklist data.
 */
export async function verifyWorkforceTrendCloudRecoveryHandoverV811(input, { cryptoObject = globalThis.crypto } = {}) {
  const parsed = parseInput(input);
  if (typeof parsed.checksum !== 'string' || !CHECKSUM_PATTERN.test(parsed.checksum)) {
    throw new Error('The handover report checksum is missing or malformed.');
  }
  const summary = validatePayload(parsed.payload);
  const actualChecksum = await digestPayload(parsed.payload, cryptoObject);
  if (actualChecksum !== parsed.checksum) throw new Error('The handover report checksum does not match. The file may have been changed.');
  return Object.freeze({
    integrity: 'verified',
    checksum: actualChecksum,
    generatedAt: summary.generatedAt,
    status: summary.status,
    completedSteps: summary.completedSteps,
    totalSteps: summary.totalSteps,
    completionPercent: summary.completionPercent,
    items: summary.items,
    note: 'Checksum verified. This does not prove authorship or successful repairs.'
  });
}
