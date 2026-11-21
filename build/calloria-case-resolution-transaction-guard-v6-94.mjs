/**
 * CALLORIA v6.94 — transactional case-resolution validation.
 * Prevents failed closure attempts from partially mutating follow-up records.
 */
const TARGET = '/js/case-lifecycle-engine.js';
const MARKER = '__CALLORIA_CASE_RESOLUTION_TRANSACTION_GUARD_V694__';

function occurrences(source, anchor) {
  return String(source).split(anchor).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = occurrences(source, anchor);
  if (found !== 1) {
    throw new Error(`CALLORIA v6.94 source rebase failed: ${label}; expected exactly one anchor, found ${found}. No partial transform was applied.`);
  }
  return String(source).replace(anchor, replacement);
}

export function transformCaseLifecycleV694(source) {
  const input = String(source ?? '');
  if (input.includes(MARKER)) return input;

  const agentGuardAnchor = [
    "  const summary = clean(input.summary, 1000);",
    "  if (summary.length < 30) throw new Error('Record at least 30 characters of factual follow-up evidence.');",
    '  const now = safeNow(options.now);',
    '  followUp.attempts += 1;'
  ].join('\n');
  const agentGuardReplacement = [
    "  const summary = clean(input.summary, 1000);",
    "  if (summary.length < 30) throw new Error('Record at least 30 characters of factual follow-up evidence.');",
    "  if (outcome === 'resolved' && input.customerConfirmed !== true) throw new Error('Customer confirmation is required before closing a reopened case as resolved.');",
    '  const now = safeNow(options.now);',
    '  followUp.attempts += 1;'
  ].join('\n');
  const agentInnerGuardAnchor = [
    "  if (outcome === 'resolved') {",
    "    if (input.customerConfirmed !== true) throw new Error('Customer confirmation is required before closing a reopened case as resolved.');",
    "    followUp.status = 'complete';"
  ].join('\n');
  const agentInnerGuardReplacement = [
    "  if (outcome === 'resolved') {",
    "    followUp.status = 'complete';"
  ].join('\n');

  const supervisorGuardAnchor = [
    '  const summary = clean(input.summary, 1000);',
    "  if (summary.length < 30) throw new Error('Document at least 30 characters of supervisor review evidence.');",
    '  const now = safeNow(options.now);',
    '  followUp.reviewedBy = reviewer;'
  ].join('\n');
  const supervisorGuardReplacement = [
    '  const summary = clean(input.summary, 1000);',
    "  if (summary.length < 30) throw new Error('Document at least 30 characters of supervisor review evidence.');",
    "  if (decision === 'close_after_review' && input.customerConfirmed !== true) throw new Error('Customer confirmation is required before a supervisor closes the reopened case.');",
    '  const now = safeNow(options.now);',
    '  followUp.reviewedBy = reviewer;'
  ].join('\n');
  const supervisorInnerGuardAnchor = [
    "  if (decision === 'close_after_review') {",
    "    if (input.customerConfirmed !== true) throw new Error('Customer confirmation is required before a supervisor closes the reopened case.');",
    "    followUp.status = 'complete';"
  ].join('\n');
  const supervisorInnerGuardReplacement = [
    "  if (decision === 'close_after_review') {",
    "    followUp.status = 'complete';"
  ].join('\n');

  let code = input;
  code = replaceExactlyOnce(code, agentGuardAnchor, agentGuardReplacement, 'agent case-resolution preflight');
  code = replaceExactlyOnce(code, agentInnerGuardAnchor, agentInnerGuardReplacement, 'agent case-resolution branch');
  code = replaceExactlyOnce(code, supervisorGuardAnchor, supervisorGuardReplacement, 'supervisor case-resolution preflight');
  code = replaceExactlyOnce(code, supervisorInnerGuardAnchor, supervisorInnerGuardReplacement, 'supervisor case-resolution branch');
  return `/* ${MARKER} */\n${code}`;
}

export function calloriaCaseResolutionTransactionGuardPluginV694() {
  return {
    name: 'calloria-case-resolution-transaction-guard-v6-94',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(TARGET) || String(code).includes(MARKER)) return null;
      try {
        return { code: transformCaseLifecycleV694(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    }
  };
}
