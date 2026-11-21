/**
 * CALLORIA v6.88 — evidence-linked career development and scenario promotion.
 *
 * Replaces the stale v6.42–v6.50 transform chain. Native voice handling and
 * inbound wrap-up remain in main.js; this plugin bridges completed inbound
 * case transcripts into the existing human QA workspace and adds evidence-led
 * coaching actions, guided practice, a competency passport and a scenario exam.
 * All interactions and records are synthetic local gameplay data.
 */
const MAIN_TARGET = '/js/main.js';
const MAIN_MARKER = '__CALLORIA_CAREER_DEVELOPMENT_V688__';
const WORKFORCE_ANCHOR = 'function renderWorkforce() {';
const CASE_PUSH_ANCHOR = 'state.cases.push(record);recordCustomerContinuityFromCase(record,{customerRef:contact?.customerRef});';
const QA_REVIEW_PUSH_ANCHOR = 'state.humanQaReviews.push(review);state.humanQaReviews=state.humanQaReviews.slice(-300);';
const CUSTOMER_CARE_ANCHOR = `      <section class="panel">\n        <div class="panel-head"><div><h3>Customer care, cross-selling and commendations</h3>`;
const VOICE_FALLBACK_ANCHOR = "  if(e.target.id==='voiceFallbackForm'){";

export const CAREER_COMPETENCIES_V688 = Object.freeze([
  { id: 'opening', label: 'Professional opening & privacy', short: 'Opening', practice: 'opening' },
  { id: 'listening', label: 'Listening & empathy', short: 'Listening', practice: 'listening' },
  { id: 'probing', label: 'Verification & discovery', short: 'Probing', practice: 'probing' },
  { id: 'accuracy', label: 'Product & policy accuracy', short: 'Accuracy', practice: 'accuracy' },
  { id: 'ownership', label: 'Case ownership & resolution', short: 'Ownership', practice: 'ownership' },
  { id: 'closing', label: 'Expectations & follow-up', short: 'Closing', practice: 'closing' },
]);

export const PROMOTION_SCENARIOS_V688 = Object.freeze([
  {
    id: 'identity',
    title: 'Identity protection',
    prompt: 'A caller says they are in a hurry and offers to read their one-time code to you. What is the correct response?',
    options: [
      { id: 'accept', text: 'Accept the code to speed up the call.', correct: false },
      { id: 'secure', text: 'Stop the disclosure and use only the approved secure verification process.', correct: true },
      { id: 'transfer', text: 'Ask the caller to send the code through social media.', correct: false },
    ],
  },
  {
    id: 'ownership',
    title: 'Case ownership',
    prompt: 'A customer reports a failed service after trying twice. The final cause is not yet known. What should you do?',
    options: [
      { id: 'promise', text: 'Promise an exact resolution time without checking the process.', correct: false },
      { id: 'dismiss', text: 'Tell the customer to try again later and close the interaction.', correct: false },
      { id: 'record', text: 'Investigate the approved workflow, create a traceable case and explain the next update.', correct: true },
    ],
  },
  {
    id: 'accuracy',
    title: 'Policy accuracy',
    prompt: 'The knowledge article does not cover the customer’s exact situation. What is the safest next step?',
    options: [
      { id: 'guess', text: 'Give the answer that seems most likely.', correct: false },
      { id: 'verify', text: 'Check an authorised source or seek specialist guidance before advising.', correct: true },
      { id: 'guarantee', text: 'Guarantee the requested outcome to reassure the customer.', correct: false },
    ],
  },
  {
    id: 'listening',
    title: 'Listening and empathy',
    prompt: 'A frustrated customer explains that they have contacted support before. What is the best opening response?',
    options: [
      { id: 'interrupt', text: 'Interrupt and immediately repeat the standard troubleshooting script.', correct: false },
      { id: 'blame', text: 'Explain that the previous agent was responsible.', correct: false },
      { id: 'acknowledge', text: 'Acknowledge the repeated effort, summarise the issue and confirm what remains unresolved.', correct: true },
    ],
  },
  {
    id: 'closing',
    title: 'Expectation setting',
    prompt: 'A specialist team must investigate the case. What should the customer hear before the contact ends?',
    options: [
      { id: 'vague', text: 'The team will handle it; there is nothing else to explain.', correct: false },
      { id: 'next', text: 'The case reference, responsible route, expected update window and how to follow up.', correct: true },
      { id: 'guaranteed', text: 'A guaranteed resolution time that has not been approved.', correct: false },
    ],
  },
]);

export const GUIDED_PRACTICE_V688 = Object.freeze({
  opening: {
    title: 'Professional opening',
    prompt: 'A new caller has not explained the reason for contact. Choose the best opening.',
    options: [
      { id: 'a', text: 'Greet the caller, identify the service team and invite them to explain the reason for contact.', correct: true },
      { id: 'b', text: 'Ask for their password before hearing the enquiry.', correct: false },
      { id: 'c', text: 'Tell them to explain quickly because the queue is busy.', correct: false },
    ],
  },
  listening: {
    title: 'Listening and empathy',
    prompt: 'A customer says the same issue has disrupted their work for two days. What should happen first?',
    options: [
      { id: 'a', text: 'Tell the customer that delays are normal.', correct: false },
      { id: 'b', text: 'Acknowledge the impact and summarise the problem to confirm understanding.', correct: true },
      { id: 'c', text: 'Transfer the customer without explaining why.', correct: false },
    ],
  },
  probing: {
    title: 'Verification and discovery',
    prompt: 'You need to establish what happened before investigating an account-access problem. What is appropriate?',
    options: [
      { id: 'a', text: 'Ask the customer to disclose their PIN or one-time code.', correct: false },
      { id: 'b', text: 'Skip verification because the customer sounds genuine.', correct: false },
      { id: 'c', text: 'Use the approved verification process and ask focused questions about the error and timing.', correct: true },
    ],
  },
  accuracy: {
    title: 'Product and policy accuracy',
    prompt: 'You are unsure whether a feature is available on the customer’s plan. What should you do?',
    options: [
      { id: 'a', text: 'Check the current approved knowledge source before confirming availability.', correct: true },
      { id: 'b', text: 'Assume all plans have the feature.', correct: false },
      { id: 'c', text: 'Invent a workaround so the customer can proceed.', correct: false },
    ],
  },
  ownership: {
    title: 'Case ownership',
    prompt: 'The issue requires another team. Which action demonstrates ownership?',
    options: [
      { id: 'a', text: 'Tell the customer to find the other team themselves.', correct: false },
      { id: 'b', text: 'Record the issue, route it to the right team and explain the hand-off and next step.', correct: true },
      { id: 'c', text: 'Close the case before the hand-off is accepted.', correct: false },
    ],
  },
  closing: {
    title: 'Expectation setting and closing',
    prompt: 'The investigation remains open. What is the strongest close?',
    options: [
      { id: 'a', text: 'End the call once the customer stops asking questions.', correct: false },
      { id: 'b', text: 'Promise that it will be fixed immediately.', correct: false },
      { id: 'c', text: 'Summarise the action, share the reference and confirm the agreed update route and timeframe.', correct: true },
    ],
  },
});

export function evaluatePromotionScenarioV688(answers, questions = PROMOTION_SCENARIOS_V688) {
  const values = answers && typeof answers === 'object' ? answers : {};
  const details = questions.map(question => {
    const selected = String(values[question.id] ?? '');
    const option = question.options.find(item => item.id === selected) || null;
    return { questionId: question.id, title: question.title, selected, correct: option?.correct === true, correctOption: question.options.find(item => item.correct)?.id || null };
  });
  const correct = details.filter(item => item.correct).length;
  return { score: Math.round(correct / questions.length * 100), correct, total: questions.length, details };
}

export function mapInboundCaseToQAInteractionV688(record) {
  if (!record || !record.reference) return null;
  const transcript = (Array.isArray(record.voiceTranscript) ? record.voiceTranscript : [])
    .map(item => ({ speaker: String(item?.speaker || 'unknown'), text: sanitizeInboundTranscriptTextV688(item?.text), at: item?.at || null }))
    .filter(item => item.text);
  if (!transcript.length) return null;
  const flags = Array.isArray(record.voiceQualityFlags) ? record.voiceQualityFlags : [];
  const criticalBreaches = record.voiceSecurityBreach || flags.some(flag => ['prohibited_secret_request', 'critical_handling_breach'].includes(flag))
    ? [...new Set([...flags.filter(flag => ['prohibited_secret_request', 'critical_handling_breach'].includes(flag)), 'inbound_voice_security_review'])]
    : [];
  return {
    id: String(record.reference),
    issueId: String(record.title || 'Inbound customer enquiry'),
    personaId: String(record.customerPersona || ''),
    channel: 'Inbound Voice',
    transcript,
    criticalBreaches,
    createdAt: record.createdAt || new Date().toISOString(),
    source: 'inbound_case',
  };
}

export function calculateCompetencyPassportV688(reviews = [], practiceRecords = []) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const practice = Array.isArray(practiceRecords) ? practiceRecords : [];
  return CAREER_COMPETENCIES_V688.map(skill => {
    const ratings = rows.flatMap(review => (Array.isArray(review?.criteria) ? review.criteria : [])
      .filter(item => item.criterionId === skill.id && Number.isFinite(Number(item.rating)))
      .map(item => Number(item.rating)));
    const skillPractice = practice.filter(item => item.criterionId === skill.id);
    const score = ratings.length ? Math.round(ratings.reduce((sum, value) => sum + value, 0) / ratings.length * 20) : null;
    const level = score === null ? 'awaiting evidence' : score >= 80 ? 'demonstrated' : score >= 60 ? 'developing' : 'development required';
    return {
      ...skill,
      score,
      level,
      qaEvidence: ratings.length,
      practiceAttempts: skillPractice.length,
      practicePasses: skillPractice.filter(item => item.passed === true).length,
    };
  });
}

export function createCoachingActionsV688(review, existing = [], now = Date.now()) {
  if (!review?.id) return [];
  const actions = Array.isArray(existing) ? existing : [];
  const created = [];
  for (const item of Array.isArray(review.coaching) ? review.coaching : []) {
    if (Number(item.rating) > 3) continue;
    if (actions.some(action => action.reviewId === review.id && action.criterionId === item.criterionId)) continue;
    const id = `COACH-${Number(now).toString(36).toUpperCase()}-${String(actions.length + created.length + 1).padStart(3, '0')}`;
    const action = {
      id,
      reviewId: review.id,
      interactionId: review.interactionId || '',
      criterionId: String(item.criterionId || ''),
      criterion: String(item.criterion || 'Customer service competency').slice(0, 100),
      rating: Math.max(0, Math.min(5, Number(item.rating) || 0)),
      evidence: String(item.evidence || '').slice(0, 500),
      action: String(item.action || 'Practise the approved procedure and request a coach review.').slice(0, 500),
      status: 'open',
      createdAt: new Date(Number(now)).toISOString(),
      dueAt: new Date(Number(now) + 7 * 86400000).toISOString(),
      practiceRecordId: null,
      coachSignoff: null,
    };
    actions.push(action);
    created.push(action);
  }
  return created;
}

export function evaluateGuidedPracticeV688(criterionId, answerId, now = Date.now(), practiceBank = GUIDED_PRACTICE_V688) {
  const skill = String(criterionId || '');
  const scenario = practiceBank[skill];
  if (!scenario) throw new TypeError('Select a supported competency for guided practice.');
  const selected = scenario.options.find(item => item.id === String(answerId || ''));
  if (!selected) throw new TypeError('Choose one response before submitting practice.');
  return {
    id: `PRACTICE-${Number(now).toString(36).toUpperCase()}`,
    criterionId: skill,
    title: scenario.title,
    selectedOptionId: selected.id,
    passed: selected.correct === true,
    score: selected.correct === true ? 100 : 0,
    feedback: selected.correct === true ? 'Correct. The response follows the expected customer-care control.' : `Review the expected control: ${scenario.options.find(item => item.correct)?.text || 'Use the approved procedure.'}`,
    completedAt: new Date(Number(now)).toISOString(),
    source: 'guided_coaching_practice',
  };
}

function sanitizeInboundTranscriptTextV688(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b(pin|otp|one[- ]time (?:password|code)|password|passcode)\s*(?:is|:|=|-)?\s*[a-z0-9]{3,16}\b/gi, '$1 [REDACTED CREDENTIAL]')
    .replace(/\b(cvv|cvc|card number|security code)\s*(?:is|:|=|-|#)?\s*(?:\d[ -]?){3,19}\b/gi, '$1 [REDACTED FINANCIAL DETAIL]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED PAYMENT CARD]')
    .slice(0, 520);
}
function count(source, anchor) { return String(source).split(anchor).length - 1; }
function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) throw new Error(`CALLORIA v6.88 source rebase failed: ${label}; expected one anchor, found ${found}. No partial transform was applied.`);
  return source.replace(anchor, replacement);
}

function runtimeHelpersV688() {
  const defs = JSON.stringify(CAREER_COMPETENCIES_V688);
  const exam = JSON.stringify(PROMOTION_SCENARIOS_V688);
  const practice = JSON.stringify(GUIDED_PRACTICE_V688);
  return String.raw`
const CALLORIA_CAREER_COMPETENCIES_V688 = ${defs};
const CALLORIA_PROMOTION_SCENARIOS_V688 = ${exam};
const CALLORIA_GUIDED_PRACTICE_V688 = ${practice};
function calloriaEnsureCareerPathwayV688(){
  if(!state.careerPathway||typeof state.careerPathway!=='object')state.careerPathway={version:'6.88.0',coachingActions:[],practiceRecords:[],exams:[]};
  for(const key of ['coachingActions','practiceRecords','exams'])if(!Array.isArray(state.careerPathway[key]))state.careerPathway[key]=[];
  state.careerPathway.version='6.88.0';
  return state.careerPathway;
}
function calloriaCreateCoachingActionsV688(review,existing=[],now=Date.now()){
  if(!review?.id)return [];
  const actions=Array.isArray(existing)?existing:[];const created=[];
  for(const item of Array.isArray(review.coaching)?review.coaching:[]){
    if(Number(item.rating)>3)continue;
    if(actions.some(action=>action.reviewId===review.id&&action.criterionId===item.criterionId))continue;
    const action={id:'COACH-'+Number(now).toString(36).toUpperCase()+'-'+String(actions.length+created.length+1).padStart(3,'0'),reviewId:review.id,interactionId:review.interactionId||'',criterionId:String(item.criterionId||''),criterion:String(item.criterion||'Customer service competency').slice(0,100),rating:Math.max(0,Math.min(5,Number(item.rating)||0)),evidence:String(item.evidence||'').slice(0,500),action:String(item.action||'Practise the approved procedure and request a coach review.').slice(0,500),status:'open',createdAt:new Date(Number(now)).toISOString(),dueAt:new Date(Number(now)+7*86400000).toISOString(),practiceRecordId:null,coachSignoff:null};
    actions.push(action);created.push(action);
  }
  return created;
}
function calloriaRecordQADevelopmentActionsV688(review){
  const pathway=calloriaEnsureCareerPathwayV688();
  const created=calloriaCreateCoachingActionsV688(review,pathway.coachingActions,Date.now());
  if(created.length)pushOperationEvent('career-coaching',review.id,created.length+' evidence-linked coaching action(s) opened from human QA review.','open',{actionIds:created.map(item=>item.id)});
}
function calloriaMapInboundCaseToQAInteractionV688(record){
  if(!record||!record.reference)return null;
  const transcript=(Array.isArray(record.voiceTranscript)?record.voiceTranscript:[]).map(item=>({speaker:String(item?.speaker||'unknown'),text:sanitizeVoiceCustomerText(String(item?.text||'')).trim().slice(0,520),at:item?.at||null})).filter(item=>item.text);
  if(!transcript.length)return null;
  const flags=Array.isArray(record.voiceQualityFlags)?record.voiceQualityFlags:[];
  const criticalBreaches=record.voiceSecurityBreach||flags.some(flag=>['prohibited_secret_request','critical_handling_breach'].includes(flag))?[...new Set([...flags.filter(flag=>['prohibited_secret_request','critical_handling_breach'].includes(flag)),'inbound_voice_security_review'])]:[];
  return {id:String(record.reference),issueId:String(record.title||'Inbound customer enquiry'),personaId:String(record.customerPersona||''),channel:'Inbound Voice',transcript,criticalBreaches,createdAt:record.createdAt||new Date().toISOString(),source:'inbound_case'};
}
function calloriaAddInboundCaseToQAV688(record){
  const item=calloriaMapInboundCaseToQAInteractionV688(record);if(!item)return;
  state.customerQaHistory=Array.isArray(state.customerQaHistory)?state.customerQaHistory:[];
  if(state.customerQaHistory.some(existing=>existing.id===item.id))return;
  state.customerQaHistory.push(item);state.customerQaHistory=state.customerQaHistory.slice(-300);
  pushOperationEvent('human-qa',item.id,'Completed inbound voice transcript added to the human QA review register.','reviewable',{source:'inbound_case',transcriptLines:item.transcript.length,criticalBreaches:item.criticalBreaches.length});
}
function calloriaCalculateCompetencyPassportV688(reviews=[],practiceRecords=[]){
  const rows=Array.isArray(reviews)?reviews:[],practice=Array.isArray(practiceRecords)?practiceRecords:[];
  return CALLORIA_CAREER_COMPETENCIES_V688.map(skill=>{
    const ratings=rows.flatMap(review=>(Array.isArray(review?.criteria)?review.criteria:[]).filter(item=>item.criterionId===skill.id&&Number.isFinite(Number(item.rating))).map(item=>Number(item.rating)));
    const attempts=practice.filter(item=>item.criterionId===skill.id);const score=ratings.length?Math.round(ratings.reduce((sum,value)=>sum+value,0)/ratings.length*20):null;
    return {...skill,score,level:score===null?'awaiting evidence':score>=80?'demonstrated':score>=60?'developing':'development required',qaEvidence:ratings.length,practiceAttempts:attempts.length,practicePasses:attempts.filter(item=>item.passed===true).length};
  });
}
function calloriaPickCareerPracticeV688(){
  const pathway=calloriaEnsureCareerPathwayV688();
  const task=pathway.coachingActions.find(item=>item.status==='open');
  if(task&&CALLORIA_GUIDED_PRACTICE_V688[task.criterionId])return {skill:task.criterionId,action:task};
  const rows=calloriaCalculateCompetencyPassportV688(state.humanQaReviews,pathway.practiceRecords).filter(item=>item.score!==null).sort((a,b)=>a.score-b.score);
  const skill=rows[0]?.id||'listening';return {skill,action:null};
}
function calloriaRenderScenarioExamV688(eligible){
  const questions=CALLORIA_PROMOTION_SCENARIOS_V688;
  if(!eligible)return '<div class="calloria-career-note">The scenario examination is locked until the existing organisation performance eligibility rules are met.</div>';
  return '<form id="careerScenarioExamFormV688" class="calloria-career-exam">'+questions.map((question,index)=>'<fieldset class="calloria-career-question"><legend><b>'+String(index+1).padStart(2,'0')+'. '+escapeHTML(question.title)+'</b><span>'+escapeHTML(question.prompt)+'</span></legend>'+question.options.map(option=>'<label><input type="radio" name="'+escapeHTML(question.id)+'" value="'+escapeHTML(option.id)+'" required><span>'+escapeHTML(option.text)+'</span></label>').join('')+'</fieldset>').join('')+'<p class="calloria-career-note">Five operational scenarios · scored automatically · no self-entered marks. The existing three-total-attempt and one-per-calendar-year policy remains in force.</p><button class="btn primary" type="submit">Submit scenario examination</button></form>';
}
function calloriaCurrentPromotionMetricsV688(){
  return {kpi:Math.min(100,Math.round((state.callsHandled+state.outboundCalls)*5)),qa:state.qaCount?Math.round(state.totalQA/state.qaCount):75,csat:state.csatCount?Math.round(state.totalCSAT/state.csatCount):75,knowledge:Math.min(100,70+state.experience),compliance:state.incidents?Math.max(0,100-state.incidents*12):95,leadership:Math.min(100,60+Math.floor(state.level*5))};
}
function calloriaEvaluatePromotionScenarioV688(formData){
  const rows=CALLORIA_PROMOTION_SCENARIOS_V688.map(question=>{const selected=String(formData.get(question.id)||'');const option=question.options.find(item=>item.id===selected);return {questionId:question.id,title:question.title,selected,correct:option?.correct===true,correctOption:question.options.find(item=>item.correct)?.id||null};});
  const correct=rows.filter(item=>item.correct).length;return {score:Math.round(correct/rows.length*100),correct,total:rows.length,details:rows};
}
function calloriaRenderCareerDevelopmentV688(metrics,eligibility){
  const pathway=calloriaEnsureCareerPathwayV688();const skills=calloriaCalculateCompetencyPassportV688(state.humanQaReviews,pathway.practiceRecords);
  const actions=pathway.coachingActions.slice().reverse().slice(0,8);
  const open=pathway.coachingActions.filter(item=>!['coach_signed_off'].includes(item.status)).length;
  const practiced=pathway.practiceRecords.length;const passed=pathway.practiceRecords.filter(item=>item.passed).length;
  const skillCards=skills.map(item=>'<article class="calloria-competency-card"><div><strong>'+escapeHTML(item.label)+'</strong><span class="pill '+(item.score===null?'amber':item.score>=80?'green':'amber')+'">'+escapeHTML(item.level.toUpperCase())+'</span></div><b>'+(item.score===null?'—':item.score+'%')+'</b><small>'+item.qaEvidence+' human QA rating(s) · '+item.practicePasses+'/'+item.practiceAttempts+' practice passes</small></article>').join('');
  const actionRows=actions.map(item=>'<article class="calloria-coaching-action"><div><strong>'+escapeHTML(item.criterion)+'</strong><span class="pill '+(item.status==='coach_signed_off'?'green':item.status==='practice_completed_pending_signoff'?'amber':'red')+'">'+escapeHTML(item.status.replaceAll('_',' ').toUpperCase())+'</span></div><p>'+escapeHTML(item.action)+'</p><small>QA evidence: “'+escapeHTML(item.evidence)+'” · Due '+new Date(item.dueAt).toLocaleDateString()+'</small></article>').join('')||'<p class="calloria-career-note">No evidence-linked coaching actions yet. Complete a human QA review to open targeted development tasks.</p>';
  const next=calloriaPickCareerPracticeV688();const practice=CALLORIA_GUIDED_PRACTICE_V688[next.skill];
  const lastPractice=pathway.practiceRecords.slice().reverse()[0];
  const practiceFeedback=lastPractice?'<div class=\"calloria-practice-feedback '+(lastPractice.passed?'is-pass':'is-repeat')+'\"><strong>'+(lastPractice.passed?'Practice passed':'Practice needs another attempt')+'</strong><p>'+escapeHTML(lastPractice.feedback)+'</p><small>'+escapeHTML(lastPractice.title)+' · '+new Date(lastPractice.completedAt).toLocaleString()+'</small></div>':'';
  const practiceForm=practiceFeedback+'<form id="careerPracticeFormV688" class="calloria-practice-form"><input type="hidden" name="criterionId" value="'+escapeHTML(next.skill)+'"><input type="hidden" name="actionId" value="'+escapeHTML(next.action?.id||'')+'"><div class="calloria-practice-head"><div><span class="subtle-label">GUIDED COACHING PRACTICE</span><h4>'+escapeHTML(practice.title)+'</h4></div><span class="pill">'+escapeHTML(next.skill.toUpperCase())+'</span></div><p>'+escapeHTML(practice.prompt)+'</p>'+practice.options.map(option=>'<label><input type="radio" name="answerId" value="'+escapeHTML(option.id)+'" required><span>'+escapeHTML(option.text)+'</span></label>').join('')+'<button class="btn outline" type="submit">Submit practice response</button><small>Practice results are recorded separately; they do not replace human QA or coach approval.</small></form>';
  const pending=pathway.coachingActions.filter(item=>item.status==='practice_completed_pending_signoff');
  const signoff=pending.length?'<form id="careerActionSignoffFormV688" class="calloria-signoff-form"><h4>Coach verification</h4><label>COACH / TEAM LEADER<input name="coach" required minlength="2" maxlength="80" placeholder="Coach name"></label><label>COMPLETED PRACTICE TASK<select name="actionId">'+pending.map(item=>'<option value="'+escapeHTML(item.id)+'">'+escapeHTML(item.criterion)+' · '+escapeHTML(item.id)+'</option>').join('')+'</select></label><label>DECISION<select name="decision"><option value="approved">Competency demonstrated — sign off</option><option value="repeat">Further practice required</option></select></label><label>COACH NOTES<textarea name="notes" required minlength="12" maxlength="500" placeholder="Record the observed evidence and next step."></textarea></label><button class="btn outline" type="submit">Record coach decision</button></form>':'<p class="calloria-career-note">Coach sign-off appears after a targeted practice task is completed.</p>';
  const recent=pathway.exams.slice().reverse().slice(0,3).map(item=>'<div class="data-row"><span>'+escapeHTML(item.year+' · '+item.correct+'/'+item.total+' correct')+'</span><strong>'+item.score+'% · '+(item.status==='passed'?'PASSED':'NOT PASSED')+'</strong></div>').join('')||'<p class="calloria-career-note">No scenario examination attempt recorded.</p>';
  return '<section class="panel calloria-career-development" aria-label="Career competency passport and coaching"><div class="panel-head"><div><h3>Career competency passport</h3><p>Human QA evidence, targeted practice and coach sign-off.</p></div><span class="pill">EVIDENCE LED</span></div><div class="calloria-career-stats"><article><strong>'+state.humanQaReviews.length+'</strong><small>HUMAN QA REVIEWS</small></article><article><strong>'+open+'</strong><small>OPEN DEVELOPMENT TASKS</small></article><article><strong>'+passed+'/'+practiced+'</strong><small>PRACTICE PASSES</small></article><article><strong>'+eligibility.score+'%</strong><small>PROMOTION READINESS</small></article></div><div class="calloria-competency-grid">'+skillCards+'</div><div class="calloria-career-columns"><section><h4>Evidence-linked coaching queue</h4><div class="calloria-coaching-list">'+actionRows+'</div>'+signoff+'</section><section>'+practiceForm+'<div class="calloria-exam-history"><h4>Scenario examination history</h4>'+recent+'</div></section></div><p class="calloria-career-note">Promotion eligibility still follows the organisation KPI policy. The passport is a development record, not an automatic employment decision. QA ratings require a human reviewer and exact transcript evidence.</p></section>';
}
function calloriaEnsureCareerStylesV688(){
  if(document.getElementById('calloriaCareerStylesV688'))return;
  const style=document.createElement('style');style.id='calloriaCareerStylesV688';
  style.textContent='.calloria-career-development{grid-column:1/-1;min-width:0;margin-top:0}.calloria-career-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.calloria-career-stats article,.calloria-competency-card,.calloria-coaching-action{min-width:0;border:1px solid rgba(148,163,184,.2);border-radius:11px;background:rgba(148,163,184,.035);padding:10px}.calloria-career-stats strong{display:block;font-size:20px}.calloria-career-stats small,.calloria-competency-card small,.calloria-coaching-action small{display:block;color:var(--muted,#94a3b8);font-size:10px;line-height:1.45;overflow-wrap:anywhere}.calloria-competency-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.calloria-competency-card>div,.calloria-coaching-action>div{display:flex;align-items:flex-start;justify-content:space-between;gap:7px;flex-wrap:wrap}.calloria-competency-card strong,.calloria-coaching-action strong{font-size:12px}.calloria-competency-card>b{display:block;font-size:19px;margin:7px 0 3px}.calloria-career-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:14px}.calloria-career-columns>section{min-width:0}.calloria-career-columns h4,.calloria-exam-history h4{font-size:13px;margin:0 0 9px}.calloria-coaching-list{display:grid;gap:7px}.calloria-coaching-action p{font-size:11px;line-height:1.45;overflow-wrap:anywhere}.calloria-practice-form,.calloria-signoff-form{display:grid;gap:9px;border:1px solid rgba(148,163,184,.2);border-radius:11px;padding:11px;min-width:0}.calloria-practice-feedback{margin:0 0 8px;padding:10px;border:1px solid rgba(148,163,184,.25);border-radius:10px}.calloria-practice-feedback.is-pass{border-color:rgba(34,197,94,.45)}.calloria-practice-feedback.is-repeat{border-color:rgba(245,158,11,.45)}.calloria-practice-feedback p{font-size:11px;line-height:1.45;margin:5px 0}.calloria-practice-feedback small{color:var(--muted,#94a3b8);font-size:10px}.calloria-practice-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.calloria-practice-head h4{margin:4px 0}.calloria-practice-form>label{display:flex;align-items:flex-start;gap:8px;font-size:11px;line-height:1.45}.calloria-practice-form input[type=radio]{margin-top:3px;flex:0 0 auto}.calloria-practice-form small,.calloria-career-note{color:var(--muted,#94a3b8);font-size:10px;line-height:1.5;overflow-wrap:anywhere}.calloria-signoff-form label{display:grid;gap:4px;font-size:10px}.calloria-signoff-form input,.calloria-signoff-form select,.calloria-signoff-form textarea{width:100%;max-width:100%;min-width:0;box-sizing:border-box}.calloria-signoff-form textarea{min-height:62px}.calloria-exam-history{margin-top:14px}.calloria-career-exam{display:grid;gap:9px;margin-top:10px}.calloria-career-question{min-width:0;border:1px solid rgba(148,163,184,.2);border-radius:10px;padding:10px}.calloria-career-question legend{display:grid;gap:5px;max-width:100%;font-size:11px;line-height:1.45}.calloria-career-question legend span{font-weight:400}.calloria-career-question label{display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:11px;line-height:1.4;overflow-wrap:anywhere}.calloria-career-question input{margin-top:2px;flex:0 0 auto}@media(max-width:760px){.calloria-career-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-competency-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-career-columns{grid-template-columns:1fr}}@media(max-width:420px){.calloria-competency-grid{grid-template-columns:1fr}.calloria-career-development{padding:11px}.calloria-career-stats strong{font-size:17px}}';
  document.head.append(style);
}
function calloriaApplyGuidedPracticeV688(form){
  const pathway=calloriaEnsureCareerPathwayV688();const data=new FormData(form);const criterionId=String(data.get('criterionId')||'');const bank=CALLORIA_GUIDED_PRACTICE_V688[criterionId];if(!bank)throw new Error('Select a valid competency for practice.');
  const selected=bank.options.find(item=>item.id===String(data.get('answerId')||''));if(!selected)throw new Error('Choose one practice response.');
  const now=Date.now();const record={id:'PRACTICE-'+now.toString(36).toUpperCase(),criterionId,title:bank.title,selectedOptionId:selected.id,passed:selected.correct===true,score:selected.correct?100:0,feedback:selected.correct?'Correct. The response follows the expected customer-care control.':'Review the expected control: '+(bank.options.find(item=>item.correct)?.text||'Use the approved procedure.'),completedAt:new Date(now).toISOString(),source:'guided_coaching_practice'};
  pathway.practiceRecords.push(record);pathway.practiceRecords=pathway.practiceRecords.slice(-300);
  const actionId=String(data.get('actionId')||'');const action=pathway.coachingActions.find(item=>item.id===actionId);
  if(action){action.practiceRecordId=record.id;action.status=record.passed?'practice_completed_pending_signoff':'open';action.lastPracticeAt=record.completedAt;}
  pushOperationEvent('career-practice',record.id,record.passed?'Guided competency practice passed.':'Guided competency practice requires another attempt.',record.passed?'passed':'repeat_required',{criterionId,actionId:action?.id||null,score:record.score});
  return record;
}
function calloriaApplyCoachSignoffV688(form){
  const pathway=calloriaEnsureCareerPathwayV688();const data=new FormData(form);const action=pathway.coachingActions.find(item=>item.id===String(data.get('actionId')||''));if(!action||action.status!=='practice_completed_pending_signoff')throw new Error('Select a practice task awaiting coach sign-off.');
  const coach=String(data.get('coach')||'').trim();const notes=String(data.get('notes')||'').trim();const decision=String(data.get('decision')||'');if(coach.length<2)throw new Error('Enter the coach or team leader name.');if(notes.length<12)throw new Error('Enter at least 12 characters of observed evidence or next steps.');if(!['approved','repeat'].includes(decision))throw new Error('Select a valid coach decision.');
  action.coachSignoff={coach,decision,notes:notes.slice(0,500),recordedAt:new Date().toISOString()};action.status=decision==='approved'?'coach_signed_off':'open';
  pushOperationEvent('career-coaching',action.id,decision==='approved'?'Coach verified the competency practice.':'Coach returned the competency for further practice.',action.status,{coach,reviewId:action.reviewId,criterionId:action.criterionId});return action;
}
`;
}

export function transformMainV688(source) {
  const input = String(source ?? '');
  if (input.includes(MAIN_MARKER)) return input;
  let code = input;
  const helperSource = runtimeHelpersV688();
  code = replaceExactlyOnce(code, WORKFORCE_ANCHOR, `${helperSource}\n${WORKFORCE_ANCHOR}\n  calloriaEnsureCareerPathwayV688();\n  calloriaEnsureCareerStylesV688();`, 'Workforce render function');
  const promotionFormStart = '<form id="promotionExamForm" class="form-stack" style="margin-top:12px">';
  const formStart = code.indexOf(promotionFormStart);
  if (formStart < 0 || count(code, promotionFormStart) !== 1) throw new Error(`CALLORIA v6.88 source rebase failed: promotion examination form; expected one anchor, found ${count(code, promotionFormStart)}.`);
  const formEnd = code.indexOf('</form>', formStart);
  if (formEnd < 0) throw new Error('CALLORIA v6.88 source rebase failed: promotion examination form closing tag was not found.');
  code = code.slice(0, formStart) + '${calloriaRenderScenarioExamV688(eligibility.eligible)}' + code.slice(formEnd + '</form>'.length);
  code = replaceExactlyOnce(code, CUSTOMER_CARE_ANCHOR, `      \${calloriaRenderCareerDevelopmentV688(metrics,eligibility)}\n${CUSTOMER_CARE_ANCHOR}`, 'Workforce career-development insertion point');
  code = replaceExactlyOnce(code, CASE_PUSH_ANCHOR, `state.cases.push(record);calloriaAddInboundCaseToQAV688(record);recordCustomerContinuityFromCase(record,{customerRef:contact?.customerRef});`, 'completed inbound case / QA bridge');
  code = replaceExactlyOnce(code, QA_REVIEW_PUSH_ANCHOR, `state.humanQaReviews.push(review);calloriaRecordQADevelopmentActionsV688(review);state.humanQaReviews=state.humanQaReviews.slice(-300);`, 'human QA review / coaching follow-through');
  const promotionStart = "  if(e.target.id==='promotionExamForm'){";
  const promotionNext = "  if(e.target.id==='crossSellForm'){";
  const pStart = code.indexOf(promotionStart);
  const pEnd = code.indexOf(promotionNext, pStart + promotionStart.length);
  if (pStart < 0 || pEnd < 0 || count(code, promotionStart) !== 1) throw new Error('CALLORIA v6.88 source rebase failed: promotion examination submit handler; no unique current handler was found.');
  const replacementHandler = `  if(e.target.id==='careerScenarioExamFormV688'){\n    e.preventDefault();\n    try{\n      const result=calloriaEvaluatePromotionScenarioV688(new FormData(e.target));\n      const metrics=calloriaCurrentPromotionMetricsV688();\n      const minimumScore=getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75;\n      const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore,examScore:result.score});\n      const pathway=calloriaEnsureCareerPathwayV688();\n      pathway.exams.push({...result,id:item.id,year:item.year,status:item.status,performanceScore:item.performanceScore,recordedAt:item.recordedAt});\n      pathway.exams=pathway.exams.slice(-30);\n      pushOperationEvent('promotion',item.id,'Scenario-based annual promotion examination '+item.status+'.',item.status,{score:result.score,correct:result.correct,total:result.total,details:result.details});\n      saveState();renderView();toast('Scenario examination recorded: '+result.score+'%. '+(item.status==='passed'?'Pass':'Further development required.'),item.status==='passed'?'success':'warning');\n    }catch(error){toast(error.message||'Scenario examination could not be recorded.','warning');}\n    return;\n  }\n`;
  code = code.slice(0, pStart) + replacementHandler + code.slice(pEnd);
  const addPracticeHandlers = `  if(e.target.id==='careerPracticeFormV688'){\n    e.preventDefault();try{const result=calloriaApplyGuidedPracticeV688(e.target);saveState();renderView();toast(result.passed?'Guided practice passed.':'Practice recorded. Review the feedback and try again.',result.passed?'success':'warning');}catch(error){toast(error.message||'Practice could not be recorded.','warning');}return;\n  }\n  if(e.target.id==='careerActionSignoffFormV688'){\n    e.preventDefault();try{const action=calloriaApplyCoachSignoffV688(e.target);saveState();renderView();toast(action.status==='coach_signed_off'?'Coach sign-off recorded.':'Further practice assigned.','success');}catch(error){toast(error.message||'Coach decision could not be saved.','warning');}return;\n  }\n`;
  code = replaceExactlyOnce(code, VOICE_FALLBACK_ANCHOR, `${addPracticeHandlers}${VOICE_FALLBACK_ANCHOR}`, 'guided practice and coach sign-off form handlers');
  return `/* ${MAIN_MARKER} */\n${code}`;
}

export function calloriaCareerDevelopmentPluginV688() {
  return {
    name: 'calloria-career-development-v6-88',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(MAIN_TARGET)) return null;
      if (code.includes(MAIN_MARKER)) return null;
      try {
        return { code: transformMainV688(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    },
  };
}
