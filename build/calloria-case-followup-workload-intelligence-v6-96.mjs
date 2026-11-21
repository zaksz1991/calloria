/**
 * CALLORIA v6.96 — CRM follow-up ownership and workload visibility.
 * Adds a read-only owner distribution panel to the existing CRM view.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_CASE_FOLLOWUP_WORKLOAD_V696__';

function count(source, anchor) {
  return String(source).split(anchor).length - 1;
}

function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    throw new Error(`CALLORIA v6.96 source rebase failed: ${label}; expected exactly one anchor, found ${found}. No partial transform was applied.`);
  }
  return String(source).replace(anchor, replacement);
}

export function transformCalloriaMainV696(source) {
  const original = String(source ?? '');
  if (original.includes(MARKER)) return original;

  const caseImport = "import { normalizeCaseLifecycle, caseReopenEligibility, reopenCase, caseFollowUpRisk, startCaseFollowUp, completeCaseFollowUp, reviewCaseFollowUp, caseFollowUpMetrics, formatCaseClock } from './case-lifecycle-engine.js';";
  const additions = [
    "import { summariseCaseFollowUpWorkload, renderCaseFollowUpWorkloadPanel } from './case-followup-workload-engine-v696.js';",
    "import './case-followup-workload-v696.css';"
  ].join('\n');
  let code = replaceExactlyOnce(original, caseImport, `${caseImport}\n${additions}`, 'case lifecycle import anchor');

  const metricsAnchor = '  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());';
  const metricsReplacement = [
    metricsAnchor,
    '  const caseFollowUpWorkload = summariseCaseFollowUpWorkload(followUpMetrics.rows);',
    '  const followUpWorkloadPanel = renderCaseFollowUpWorkloadPanel(caseFollowUpWorkload, { escapeHTML, formatCaseClock });'
  ].join('\n');
  code = replaceExactlyOnce(code, metricsAnchor, metricsReplacement, 'CRM follow-up metrics anchor');

  const viewAnchor = '</div><section class="panel case-followup-queue" style="margin-top:14px">';
  const viewReplacement = '</div>${followUpWorkloadPanel}<section class="panel case-followup-queue" style="margin-top:14px">';
  code = replaceExactlyOnce(code, viewAnchor, viewReplacement, 'CRM follow-up panel insertion anchor');

  return `/* ${MARKER} */\n${code}`;
}

export function calloriaCaseFollowUpWorkloadIntelligencePluginV696() {
  return {
    name: 'calloria-case-followup-workload-intelligence-v6-96',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(TARGET) || String(code).includes(MARKER)) return null;
      try {
        return { code: transformCalloriaMainV696(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    }
  };
}
