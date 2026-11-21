import { normalizeCaseLifecycle, caseReopenEligibility, reopenCase, caseFollowUpRisk, startCaseFollowUp, completeCaseFollowUp, reviewCaseFollowUp, caseFollowUpMetrics, formatCaseClock } from './case-lifecycle-engine.js';
function escapeHTML(value) { return String(value ?? '').replace(/[<>]/g, ''); }
function caseLifecycleClock() { return { day: 1, minutes: 500, active: true }; }
function renderCRM(){
  state.cases=(Array.isArray(state.cases)?state.cases:[]).map(row=>{try{return normalizeCaseLifecycle(row);}catch(_){return row;}});
  const followUpMetrics=caseFollowUpMetrics(state.cases,caseLifecycleClock());
  const followUpCards=followUpMetrics.rows.map(({caseRecord,followUp,risk})=>{
    return `<div>${escapeHTML(caseRecord.reference)} · ${escapeHTML(followUp.owner)}</div>`;
  }).join('');
  viewRoot.innerHTML=`<div class="ops-summary-grid case-followup-metrics">metrics</div><section class="panel case-followup-queue" style="margin-top:14px">${followUpCards}</section>`;
}
