/** CALLORIA v6.97 — source-aware post-transform for the v6.96 CRM planner. */
const TARGET = '/js/main.js';
const V696_MARKER = '__CALLORIA_CASE_FOLLOWUP_WORKLOAD_V696__';
const MARKER = '__CALLORIA_CASE_RECOVERY_PLANNER_V697__';

function count(source, anchor) {
  return String(source).split(anchor).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    throw new Error(`CALLORIA v6.97 source rebase failed: ${label}; expected exactly one anchor, found ${found}. No partial transform was applied.`);
  }
  return String(source).replace(anchor, replacement);
}

export function transformCalloriaMainV697(source) {
  const original = String(source ?? '');
  if (original.includes(MARKER)) return original;
  if (!original.includes(V696_MARKER)) {
    throw new Error('CALLORIA v6.97 requires the v6.96 Case Follow-up Workload transform. Register calloriaCaseFollowUpWorkloadIntelligencePluginV696() before v6.97.');
  }

  const importAnchor = "import { summariseCaseFollowUpWorkload, renderCaseFollowUpWorkloadPanel } from './case-followup-workload-engine-v696.js';";
  const importReplacement = [
    importAnchor,
    "import { buildCaseRecoveryPlan, renderCaseRecoveryPlanPanel } from './case-recovery-planner-engine-v697.js';",
    "import './case-recovery-planner-v697.css';"
  ].join('\n');
  let code = replaceExactlyOnce(original, importAnchor, importReplacement, 'v6.96 workload import anchor');

  const renderAnchor = '  const followUpWorkloadPanel = renderCaseFollowUpWorkloadPanel(caseFollowUpWorkload, { escapeHTML, formatCaseClock });';
  const renderReplacement = [
    renderAnchor,
    '  const caseRecoveryPlan = buildCaseRecoveryPlan(followUpMetrics.rows, { limit: 8 });',
    '  const caseRecoveryPlanPanel = renderCaseRecoveryPlanPanel(caseRecoveryPlan, { escapeHTML, formatCaseClock });'
  ].join('\n');
  code = replaceExactlyOnce(code, renderAnchor, renderReplacement, 'CRM recovery-plan render anchor');

  const viewAnchor = '</div>${followUpWorkloadPanel}<section class="panel case-followup-queue" style="margin-top:14px">';
  const viewReplacement = '</div>${followUpWorkloadPanel}${caseRecoveryPlanPanel}<section class="panel case-followup-queue" style="margin-top:14px">';
  code = replaceExactlyOnce(code, viewAnchor, viewReplacement, 'CRM recovery-plan panel insertion anchor');

  return `/* ${MARKER} */\n${code}`;
}

export function calloriaCaseRecoveryPlannerPluginV697() {
  return {
    name: 'calloria-case-recovery-planner-v6-97',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(TARGET) || String(code).includes(MARKER)) return null;
      try {
        return { code: transformCalloriaMainV697(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    }
  };
}
