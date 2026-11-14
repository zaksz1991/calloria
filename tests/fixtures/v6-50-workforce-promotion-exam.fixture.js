/* __CALLORIA_GUIDED_COACHING_PRACTICE_V647__ */
function calloriaEnsureQACoachingStateV646(){return state.coachingSessions;}
function renderCareer() {
  viewRoot.innerHTML = `<div class="career-banner"></div><div class="grid two"><section class="panel"><button class="btn outline small" data-action="reset-simulation">Reset local simulation data</button></section></div>`;
}

function renderWorkforce() {
  const currentBriefing = briefingFor(simulationDateNow());
  const metrics = {
    kpi: Math.min(100, Math.round((state.callsHandled + state.outboundCalls) * 5)),
    qa: state.qaCount ? Math.round(state.totalQA/state.qaCount) : 75,
    csat: state.csatCount ? Math.round(state.totalCSAT/state.csatCount) : 75,
    knowledge: Math.min(100, 70 + state.experience),
    compliance: state.incidents ? Math.max(0,100-state.incidents*12) : 95,
    leadership: Math.min(100, 60 + Math.floor(state.level*5))
  };
  const eligibility = promotionEligibility({metrics, attempts:state.promotionAttempts, minimumScore:75});
  viewRoot.innerHTML = `<section class="panel">
        <form id="promotionExamForm" class="form-stack" style="margin-top:12px">
          <label class="form-field">Simulated examination score (0–100)<input name="examScore" type="number" min="0" max="100" required></label>
          <button class="btn primary" type="submit" ${eligibility.eligible?'':'disabled'}>Sit annual promotion examination</button>
        </form>
      </section>`;
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='promotionExamForm'){
     e.preventDefault();
     const digitalMetricSet=digitalQueueMetrics(state.digitalQueue||[]);const completedDigital=digitalMetricSet.resolved+digitalMetricSet.escalated;const qaCount=state.qaCount+(digitalMetricSet.averageQA===null?0:(state.digitalQueue||[]).filter(x=>Number.isFinite(x.qaScore)).length);const metrics={kpi:Math.min(100,Math.round((state.callsHandled+state.outboundCalls+completedDigital)*5)),qa:qaCount?Math.round(((state.totalQA)+(digitalMetricSet.averageQA||0)*(qaCount-state.qaCount))/qaCount):75,csat:state.csatCount?Math.round(state.totalCSAT/state.csatCount):75,knowledge:Math.min(100,70+state.experience),compliance:state.incidents?Math.max(0,100-state.incidents*12):95,leadership:Math.min(100,60+Math.floor(state.level*5))};
     try{const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore:getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75,examScore:Number(new FormData(e.target).get('examScore'))});pushOperationEvent('promotion',item.id,`Annual promotion examination ${item.status}.`);saveState();renderView();toast(`Examination ${item.status.replace('_',' ')}.`,'success');}catch(err){toast(err.message,'warning');}
   }
});
