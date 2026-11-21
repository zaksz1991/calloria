import { DEFAULT_QA_SCORECARD, createScorecard, createHumanQAReview, createQADispute, resolveQADispute, createCalibrationSession, humanQAMetrics } from './qa-workspace-engine.js';
function renderQAWorkspace() {
  const reviews = state.humanQaReviews || [];
  const disputes = state.qaDisputes || [];
  const calibrations = state.qaCalibrations || [];
  const metrics = humanQAMetrics(reviews, disputes, calibrations);
  const calibratable = [...new Set(reviews.filter(item => reviews.some(other => other.id !== item.id && other.interactionId === item.interactionId && other.scorecardId === item.scorecardId)).map(item => `${item.interactionId}::${item.scorecardId}`))];
  viewRoot.innerHTML = `
    <section class="panel"><div class="panel-head"><div><h3>Human QA review register</h3></div></div><div class="qa-review-list">${reviewCards}</div></section>
     <div class="grid two qa-workspace-grid" style="margin-top:14px">
       <section class="panel"><div class="panel-head"><div><h3>Agent score dispute</h3><p>Submit a reasoned challenge to a completed human review.</p></div></div>
       </section>
    `;
}
