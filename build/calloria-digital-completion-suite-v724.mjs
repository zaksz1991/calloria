/**
 * CALLORIA v7.24 — completes digital-suite activation and restores the intended
 * general Customer Experience default for new applicants.
 *
 * v7.22 is kept as the preceding Vite plugin. This plugin applies v7.23's
 * Customer 360 recovery panel after the v7.22 transforms, then changes only
 * the fresh-state defaults in js/main.js. Existing saved profiles are retained.
 */
import { transformCustomerRecoveryPlanV723 } from './calloria-customer-recovery-plan-v723.mjs';

const PLUGIN_NAME = 'calloria-digital-completion-suite-v7-24';
const MAIN_SUFFIX = '/js/main.js';
const DEFAULT_MARKER = '/* CALLORIA_V724_GENERAL_CUSTOMER_EXPERIENCE_DEFAULT */';
const DEFAULT_TRACK_ANCHOR = "  selectedTrack: 'banking',";
const DEFAULT_DEPARTMENT_ANCHOR = "  department: 'Banking Operations',";
const DEFAULT_SALARY_ANCHOR = '  salary: 185000,';
const STATE_MIGRATION_ANCHOR = 'const migrated = { ...initialState(), ...parsed };';

function count(source, needle) {
  return source.split(needle).length - 1;
}

export function transformGeneralCustomerExperienceDefaultsV724(source) {
  const original = String(source ?? '');
  if (original.includes(DEFAULT_MARKER)) {
    return { code: original, changed: false, alreadyPatched: true, reason: null };
  }
  const checks = [
    ['new applicant career-track default', DEFAULT_TRACK_ANCHOR],
    ['new applicant department default', DEFAULT_DEPARTMENT_ANCHOR],
    ['new applicant starting salary default', DEFAULT_SALARY_ANCHOR],
    ['saved-profile migration merge', STATE_MIGRATION_ANCHOR]
  ];
  const mismatches = checks.filter(([, anchor]) => count(original, anchor) !== 1);
  if (mismatches.length) {
    return {
      code: original,
      changed: false,
      alreadyPatched: false,
      reason: `Expected exactly one anchor for: ${mismatches.map(([label]) => label).join(', ')}.`
    };
  }
  let code = original.replace(
    DEFAULT_TRACK_ANCHOR,
    `${DEFAULT_MARKER}\n  selectedTrack: 'service',`
  );
  code = code.replace(DEFAULT_DEPARTMENT_ANCHOR, "  department: 'Customer Experience',");
  code = code.replace(DEFAULT_SALARY_ANCHOR, '  salary: 170000,');
  code = code.replace(
    STATE_MIGRATION_ANCHOR,
    `${STATE_MIGRATION_ANCHOR}\n    if (parsed && typeof parsed === 'object' && !Object.prototype.hasOwnProperty.call(parsed, 'department')) {\n      const legacyDepartmentByTrack = { banking: 'Banking Operations', service: 'Customer Experience', technical: 'Technical Support', sales: 'Sales & Retention' };\n      migrated.department = legacyDepartmentByTrack[migrated.selectedTrack] || migrated.department;\n    }\n    if (parsed && typeof parsed === 'object' && !Object.prototype.hasOwnProperty.call(parsed, 'salary')) {\n      const legacySalaryByTrack = { banking: 185000, service: 170000, technical: 195000, sales: 180000 };\n      migrated.salary = legacySalaryByTrack[migrated.selectedTrack] || migrated.salary;\n    }`
  );
  return { code, changed: true, alreadyPatched: false, reason: null };
}

export function transformCalloriaDigitalCompletionV724(source) {
  const original = String(source ?? '');
  const recovery = transformCustomerRecoveryPlanV723(original);
  let code = recovery.code;
  const defaults = transformGeneralCustomerExperienceDefaultsV724(code);
  code = defaults.code;
  return {
    code,
    changed: recovery.changed || defaults.changed,
    recovery,
    defaults,
    alreadyPatched: recovery.alreadyPatched && defaults.alreadyPatched
  };
}

export function calloriaDigitalCompletionSuitePluginV724() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(source, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith(MAIN_SUFFIX)) return null;
      const result = transformCalloriaDigitalCompletionV724(source);
      if (result.alreadyPatched) return null;
      if (!result.recovery.changed && !result.recovery.alreadyPatched) {
        this.warn(`[${PLUGIN_NAME}] Customer 360 recovery panel skipped safely: ${result.recovery.reason}`);
      }
      if (!result.defaults.changed && !result.defaults.alreadyPatched) {
        this.warn(`[${PLUGIN_NAME}] general applicant defaults skipped safely: ${result.defaults.reason}`);
      }
      return result.changed ? { code: result.code, map: null } : null;
    }
  };
}
