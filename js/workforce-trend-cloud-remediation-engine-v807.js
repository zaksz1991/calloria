/**
 * CALLORIA v8.7 — deterministic, privacy-safe remediation guidance for v8.6 cloud diagnostics.
 * This module creates advice only. It never performs cloud, storage, auth or database writes.
 */
export const WORKFORCE_TREND_CLOUD_REMEDIATION_VERSION_V807 = '8.7.0';

const REMEDIATIONS = Object.freeze({
  workspace: Object.freeze({
    title: 'Restore the organisation workspace',
    priority: 'blocked',
    summary: 'The current browser session does not have a usable CALLORIA organisation context.',
    steps: Object.freeze([
      'Sign in with the account that belongs to the intended CALLORIA organisation.',
      'Open the organisation switcher and select the correct organisation workspace.',
      'Return to Workforce History and run the read-only health check again.'
    ]),
    action: 'sign_in'
  }),
  auth_session: Object.freeze({
    title: 'Refresh the Supabase sign-in session',
    priority: 'attention',
    summary: 'The organisation context is present, but Supabase did not confirm an active user session.',
    steps: Object.freeze([
      'Use Refresh sign-in session below. This asks Supabase to refresh the current user session.',
      'If refresh is rejected or no session is returned, sign out and sign in again.',
      'Run the read-only health check again before synchronising any history.'
    ]),
    action: 'refresh_session'
  }),
  permissions: Object.freeze({
    title: 'Request the minimum workforce reporting permission',
    priority: 'blocked',
    summary: 'The signed-in organisation membership does not currently pass the workforce reports:read permission check.',
    steps: Object.freeze([
      'Ask the organisation owner or administrator to review your CALLORIA membership role.',
      'Request only the reports:read capability needed for workforce trend history.',
      'Do not use a broad administrator or service-role credential as a workaround.',
      'After the organisation administrator updates your access, sign in again and rerun diagnostics.'
    ]),
    action: 'contact_admin'
  }),
  local_history: Object.freeze({
    title: 'Protect and recover browser-local history',
    priority: 'blocked',
    summary: 'CALLORIA could not read the local workforce history on this browser.',
    steps: Object.freeze([
      'Do not clear browser storage, site data or the browser profile while recovery is unresolved.',
      'If you previously exported a CALLORIA recovery backup, use Verify / restore backup and confirm its integrity before restoring.',
      'If the history belongs to another device or browser profile, open that original profile and export a verified backup there.',
      'Rerun the health check after the local history is available.'
    ]),
    action: 'verify_backup'
  }),
  snapshot_store: Object.freeze({
    title: 'Check organisation snapshot storage',
    priority: 'blocked',
    summary: 'The organisation snapshot table could not be read within the active organisation scope.',
    steps: Object.freeze([
      'Ask the Supabase project administrator to confirm migration 202611220001_calloria_workforce_trend_cloud_history.sql is recorded as applied.',
      'Confirm the table calloria_workforce_trend_snapshots exists and row-level security is enabled.',
      'Confirm the signed-in membership is mapped to the active organisation and allowed to read reports.',
      'Do not disable row-level security or expose a service-role key in Vercel or browser code.',
      'Rerun the read-only health check after the administrator confirms the schema and access policy.'
    ]),
    action: 'admin_database_review'
  }),
  conflict_archive: Object.freeze({
    title: 'Check durable conflict archive access',
    priority: 'blocked',
    summary: 'The organisation conflict archive could not be read. Keep both original snapshot copies until this is repaired.',
    steps: Object.freeze([
      'Before changing anything, export a verified workforce recovery backup from the browser that contains the local history.',
      'Ask the Supabase project administrator to confirm migration 202611220003_calloria_workforce_trend_conflict_archive.sql is recorded as applied.',
      'Confirm calloria_workforce_trend_conflicts exists, row-level security is enabled and the intended organisation-scoped read policy is active.',
      'Do not manually delete archive rows or resolve conflicts while the archive is unavailable.',
      'Rerun diagnostics, then review each archived conflict and explicitly choose the canonical copy.'
    ]),
    action: 'admin_database_review'
  }),
  backup_integrity: Object.freeze({
    title: 'Restore verified backup capability',
    priority: 'blocked',
    summary: 'The backup engine or browser SHA-256 capability is unavailable.',
    steps: Object.freeze([
      'Open CALLORIA through its HTTPS production or preview URL rather than an insecure page context.',
      'Use a current browser with Web Crypto support enabled.',
      'Do not restore an unverified or edited JSON file. The backup verification step must pass before restore is enabled.',
      'Rerun the read-only health check after changing to a supported browser context.'
    ]),
    action: 'secure_context'
  })
});

const VALID_STATUSES = new Set(['warning', 'failed']);

/**
 * Return an ordered runbook for non-passing health checks.
 * Output is built from fixed templates; untrusted diagnostic detail is never copied.
 */
export function buildWorkforceTrendCloudRemediationPlanV807(report) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const seen = new Set();
  const plan = [];
  for (const check of checks) {
    if (!check || typeof check !== 'object') continue;
    const id = typeof check.id === 'string' ? check.id : '';
    if (!Object.hasOwn(REMEDIATIONS, id) || seen.has(id) || !VALID_STATUSES.has(check.status)) continue;
    seen.add(id);
    const template = REMEDIATIONS[id];
    plan.push(Object.freeze({
      id,
      title: template.title,
      priority: template.priority,
      summary: template.summary,
      steps: template.steps,
      action: template.action
    }));
  }
  plan.sort((a, b) => (a.priority === b.priority ? 0 : a.priority === 'blocked' ? -1 : 1));
  return Object.freeze(plan);
}

export function workforceTrendCloudRemediationActionLabelV807(action) {
  const labels = {
    sign_in: 'Sign in and select organisation',
    refresh_session: 'Refresh sign-in session',
    contact_admin: 'Organisation administrator review',
    verify_backup: 'Verify a recovery backup',
    admin_database_review: 'Supabase administrator review',
    secure_context: 'Use a supported HTTPS browser'
  };
  return labels[action] || 'Review recommended steps';
}
