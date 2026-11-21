// Focused, literal source-anchor fixture taken from public main.js at c8a48d6.
const state = { cases: [], humanQaReviews: [], customerQaHistory: [], promotionAttempts: [], digitalQueue: [], callsHandled: 0, outboundCalls: 0, qaCount: 0, totalQA: 0, csatCount: 0, totalCSAT: 0, experience: 0, incidents: 0, level: 1 };
const viewRoot = { innerHTML: '' };
const briefingFor = () => null;
const simulationDateNow = () => '2026-11-21';
const escapeHTML = value => String(value ?? '');
const getActiveOrganization = () => ({ policy: { promotionThreshold: 75 } });
const pushOperationEvent = () => {};
const saveState = () => {};
const renderView = () => {};
const toast = () => {};
const recordPromotionExam = (attempts, input) => ({ id: 'EXAM-1', year: 2026, status: input.examScore >= 70 ? 'passed' : 'failed', performanceScore: 80, recordedAt: new Date().toISOString() });
function renderWorkforce() {
  const currentBriefing = briefingFor(simulationDateNow());
  const metrics = { kpi: 50, qa: 75, csat: 75, knowledge: 70, compliance: 95, leadership: 65 };
  const eligibility = { eligible: true, score: 80, attemptsRemaining: 3 };
  viewRoot.innerHTML = `
    <div class="grid two">
      <section class="panel">
        <form id="promotionExamForm" class="form-stack" style="margin-top:12px">
          <label class="form-field">Simulated examination score (0–100)<input name="examScore" type="number" min="0" max="100" required></label>
          <button class="btn primary" type="submit" ${eligibility.eligible?'':'disabled'}>Sit annual promotion examination</button>
        </form>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>Customer care, cross-selling and commendations</h3>
        <form id="crossSellForm" class="form-stack"></form>
      </section>
    </div>`;
}
function saveWrapUp(record) {
  state.cases.push(record);recordCustomerContinuityFromCase(record,{customerRef:contact?.customerRef});
}
function recordCustomerContinuityFromCase() {}
const contact = {};
function recordReview(review) {
  state.humanQaReviews.push(review);state.humanQaReviews=state.humanQaReviews.slice(-300);
}
function recordPromotionExamHandler(e) {
  if(e.target.id==='promotionExamForm'){
    e.preventDefault();
    const digitalMetricSet=digitalQueueMetrics(state.digitalQueue||[]);const completedDigital=digitalMetricSet.resolved+digitalMetricSet.escalated;const qaCount=state.qaCount+(digitalMetricSet.averageQA===null?0:(state.digitalQueue||[]).filter(x=>Number.isFinite(x.qaScore)).length);const metrics={kpi:Math.min(100,Math.round((state.callsHandled+state.outboundCalls+completedDigital)*5)),qa:qaCount?Math.round(((state.totalQA)+(digitalMetricSet.averageQA||0)*(qaCount-state.qaCount))/qaCount):75,csat:state.csatCount?Math.round(state.totalCSAT/state.csatCount):75,knowledge:Math.min(100,70+state.experience),compliance:state.incidents?Math.max(0,100-state.incidents*12):95,leadership:Math.min(100,60+Math.floor(state.level*5))};
    try{const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore:getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75,examScore:Number(new FormData(e.target).get('examScore'))});pushOperationEvent('promotion',item.id,`Annual promotion examination ${item.status}.`);saveState();renderView();toast(`Examination ${item.status.replace('_',' ')}.`,'success');}catch(err){toast(err.message,'warning');}
  }
  if(e.target.id==='crossSellForm'){
    e.preventDefault();
  }
  if(e.target.id==='voiceFallbackForm'){
    e.preventDefault();
  }
}
