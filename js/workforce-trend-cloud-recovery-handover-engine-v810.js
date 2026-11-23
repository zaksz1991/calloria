/**
 * CALLORIA v8.10 — privacy-minimised recovery checklist handover report.
 * Records locally ticked checklist progress; it does not certify that a repair worked.
 */
export const WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_VERSION_V810 = '8.10.0';
export const WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_FORMAT_V810 = 'CALLORIA_WORKFORCE_RECOVERY_HANDOVER';
export const WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_MAX_ITEMS_V810 = 12;

const SCOPE_PATTERN = /^calloria:workforce-cloud-recovery:v808:[a-f0-9]{16}$/;
const ID_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
const MAX_STEPS_PER_ITEM = 20;
const LABELS = Object.freeze({
  workspace: 'Organisation workspace',
  auth_session: 'Authentication session',
  permissions: 'Minimum permissions',
  local_history: 'Local history recovery',
  snapshot_store: 'Cloud snapshot storage',
  conflict_archive: 'Conflict archive',
  backup_integrity: 'Backup integrity'
});

function requireScope(value) {
  if (typeof value !== 'string' || !SCOPE_PATTERN.test(value)) {
    throw new Error('Run the read-only cloud health check in the intended organisation workspace first.');
  }
}

function shapePlan(plan) {
  if (!Array.isArray(plan) || !plan.length || plan.length > WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_MAX_ITEMS_V810) {
    throw new Error('The current recovery checklist is unavailable. Run the read-only health check again.');
  }
  const seen = new Set();
  return plan.map(item => {
    const id = typeof item?.id === 'string' ? item.id : '';
    const count = Array.isArray(item?.steps) ? Math.min(item.steps.length, MAX_STEPS_PER_ITEM) : 0;
    if (!ID_PATTERN.test(id) || seen.has(id) || count < 1) {
      throw new Error('The current recovery checklist contains an unsupported item.');
    }
    seen.add(id);
    return Object.freeze({ id, label: LABELS[id] || id.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' '), stepCount: count });
  });
}

function safeProgress(progress, shape) {
  const allowed = new Map(shape.map(item => [item.id, item.stepCount]));
  const source = progress && typeof progress === 'object' && !Array.isArray(progress) ? progress : {};
  const result = {};
  for (const [id, indexes] of Object.entries(source).slice(0, WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_MAX_ITEMS_V810)) {
    const max = allowed.get(id);
    if (!max || !Array.isArray(indexes)) continue;
    const clean = [...new Set(indexes.filter(value => Number.isInteger(value) && value >= 0 && value < max))].sort((a, b) => a - b);
    if (clean.length) result[id] = clean;
  }
  return result;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function checksum(payload, cryptoObject) {
  if (!cryptoObject?.subtle?.digest || typeof TextEncoder !== 'function') {
    throw new Error('Secure browser cryptography is unavailable. Open CALLORIA through HTTPS in a supported browser.');
  }
  const bytes = new TextEncoder().encode(stableStringify(payload));
  const digest = await cryptoObject.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function isoTimestamp(value) {
  const date = new Date(value ?? '');
  if (!Number.isFinite(date.getTime())) throw new Error('The recovery handover report has an invalid timestamp.');
  return date.toISOString();
}

function buildText(payload, digest) {
  const lines = [
    'CALLORIA — WORKFORCE CLOUD RECOVERY HANDOVER',
    `Generated: ${payload.generatedAt}`,
    `Checklist status: ${payload.summary.status.toUpperCase()}`,
    `Progress: ${payload.summary.completedSteps}/${payload.summary.totalSteps} steps (${payload.summary.completionPercent}%)`,
    '',
    'RECOVERY AREAS'
  ];
  for (const item of payload.items) {
    lines.push(`- ${item.label}: ${item.completedSteps}/${item.totalSteps} steps · ${item.status}`);
  }
  lines.push(
    '',
    'IMPORTANT LIMITATION',
    'This report records checklist ticks on this device only. A checked step is not proof that a repair succeeded.',
    'Run the read-only cloud health diagnostics again and review their results before treating recovery as complete.',
    'The report contains no organisation ID, account details, database error text, employee records or customer records.',
    '',
    `SHA-256: ${digest}`,
    'This checksum detects accidental file changes; it is not a server signature or proof of authorship.'
  );
  return lines.join('\n');
}

/** Generate a local handover JSON + text report using only allow-listed checklist metadata. */
export async function createWorkforceTrendCloudRecoveryHandoverV810({
  organisationScopeKey,
  plan,
  progress,
  generatedAt = new Date().toISOString(),
  cryptoObject = globalThis.crypto
} = {}) {
  requireScope(organisationScopeKey);
  const shape = shapePlan(plan);
  const checked = safeProgress(progress, shape);
  const items = shape.map(item => {
    const completedSteps = (checked[item.id] || []).length;
    return Object.freeze({
      id: item.id,
      label: item.label,
      completedSteps,
      totalSteps: item.stepCount,
      status: completedSteps === item.stepCount ? 'complete' : completedSteps ? 'in_progress' : 'not_started'
    });
  });
  const completedSteps = items.reduce((sum, item) => sum + item.completedSteps, 0);
  const totalSteps = items.reduce((sum, item) => sum + item.totalSteps, 0);
  const completionPercent = Math.round((completedSteps / totalSteps) * 100);
  const status = completedSteps === totalSteps ? 'checklist_complete' : completedSteps ? 'in_progress' : 'not_started';
  const payload = Object.freeze({
    format: WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_FORMAT_V810,
    schemaVersion: 1,
    engineVersion: WORKFORCE_TREND_CLOUD_RECOVERY_HANDOVER_VERSION_V810,
    generatedAt: isoTimestamp(generatedAt),
    summary: Object.freeze({ status, completedSteps, totalSteps, completionPercent }),
    items: Object.freeze(items),
    limitation: 'Checklist progress only; checked steps do not prove repairs succeeded.'
  });
  const digest = await checksum(payload, cryptoObject);
  const json = JSON.stringify({ payload, checksum: digest }, null, 2);
  const text = buildText(payload, digest);
  const stamp = payload.generatedAt.replace(/[:.]/g, '-');
  return Object.freeze({
    json,
    text,
    checksum: digest,
    jsonFileName: `CALLORIA-recovery-handover-${stamp}.json`,
    textFileName: `CALLORIA-recovery-handover-${stamp}.txt`,
    completedSteps,
    totalSteps,
    completionPercent,
    status,
    sizeBytes: new TextEncoder().encode(json).byteLength
  });
}
