/**
 * CALLORIA v6.50 — Scenario-based annual promotion examination.
 * Replaces the unsafe self-entered numeric score with scored service scenarios,
 * records the calculated result through the existing Workforce exam engine,
 * and aligns Workforce/readiness calculations for digital contacts.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_SCENARIO_BASED_PROMOTION_EXAM_V650__';
const PREREQUISITE = '__CALLORIA_PROMOTION_READINESS_DOSSIER_V649__';
const WORKFORCE_ANCHOR = 'function renderWorkforce() {';
const RENDER_EXAM_ANCHOR = `        <form id="promotionExamForm" class="form-stack" style="margin-top:12px">\n          <label class="form-field">Simulated examination score (0–100)<input name="examScore" type="number" min="0" max="100" required></label>\n          <button class="btn primary" type="submit" \${eligibility.eligible?'':'disabled'}>Sit annual promotion examination</button>\n        </form>`;
const SUBMIT_ANCHOR = "  if(e.target.id==='promotionExamForm'){\n     e.preventDefault();";
const RECORD_ANCHOR = "const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore:getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75,examScore:Number(new FormData(e.target).get('examScore'))});";
const WORKFORCE_METRICS_ANCHOR = `  const metrics = {\n    kpi: Math.min(100, Math.round((state.callsHandled + state.outboundCalls) * 5)),\n    qa: state.qaCount ? Math.round(state.totalQA/state.qaCount) : 75,\n    csat: state.csatCount ? Math.round(state.totalCSAT/state.csatCount) : 75,\n    knowledge: Math.min(100, 70 + state.experience),\n    compliance: state.incidents ? Math.max(0,100-state.incidents*12) : 95,\n    leadership: Math.min(100, 60 + Math.floor(state.level*5))\n  };`;

export const PROMOTION_EXAM_QUESTIONS_V650 = Object.freeze([
  { id:'q01', category:'Security & privacy', prompt:'A caller reports an unauthorised change to their customer profile and asks you to disclose the registered contact details before verification. What is the correct first action?', options:[
    {score:10,text:'Complete the approved identity checks before discussing personal or account-specific information, then follow the security process.'},
    {score:7,text:'Begin a non-sensitive issue intake while keeping personal profile details restricted until verification is complete.'},
    {score:3,text:'Share only the registered email, because the caller already knows about the profile change.'},
    {score:0,text:'Read out the profile details to calm the caller, then verify later.'}
  ]},
  { id:'q02', category:'Security & privacy', prompt:'A customer says a supervisor told them to send their one-time password so you can stop a transaction. What should you do?', options:[
    {score:0,text:'Ask them to send the OTP through the chat so you can investigate.'},
    {score:10,text:'Tell them never to disclose an OTP, do not request or record it, and use the approved secure verification/escalation route.'},
    {score:3,text:'Ask for only the first three OTP digits.'},
    {score:7,text:'Stop the disclosure and direct the customer to the approved security channel, without collecting the secret.'}
  ]},
  { id:'q03', category:'Customer communication', prompt:'A customer is angry because they have repeated the same complaint three times. Which response best demonstrates ownership?', options:[
    {score:7,text:'Apologise, acknowledge the repeated effort and explain that you will review the history before deciding the next action.'},
    {score:10,text:'Acknowledge the impact, take ownership, review prior contacts, agree the next action and give a realistic update time.'},
    {score:3,text:'Tell the customer the other agents should have resolved it.'},
    {score:0,text:'Ask the customer to call again and start from the beginning.'}
  ]},
  { id:'q04', category:'Operational judgement', prompt:'A service outage is affecting many customers. The knowledge base has an approved incident notice. What should you tell callers?', options:[
    {score:10,text:'Confirm the known impact, share only the approved update and next communication point, and avoid promising an unconfirmed restoration time.'},
    {score:7,text:'Explain that an incident is being investigated and give the official reference, while checking whether new approved information exists.'},
    {score:3,text:'Estimate a restoration time based on previous outages.'},
    {score:0,text:'Tell callers the service will be restored within the hour to reduce queue pressure.'}
  ]},
  { id:'q05', category:'Case ownership', prompt:'You cannot resolve a complaint within your authority. What is the best next step?', options:[
    {score:3,text:'Transfer the caller without explaining why or recording the contact.'},
    {score:10,text:'Explain the limitation, record accurate facts and actions, route to the correct team with a reference, and set an appropriate expectation.'},
    {score:7,text:'Escalate to the correct team and give the customer the available case reference.'},
    {score:0,text:'Close the interaction as resolved so the queue target is protected.'}
  ]},
  { id:'q06', category:'Customer communication', prompt:'A customer appears confused by a technical explanation and says they have difficulty following the steps. How should you adapt?', options:[
    {score:10,text:'Use plain language, give one step at a time, check understanding and offer an approved alternative support route if needed.'},
    {score:7,text:'Slow down, simplify the wording and ask the customer to confirm each step.'},
    {score:3,text:'Repeat the same technical explanation more loudly.'},
    {score:0,text:'End the call because the customer cannot follow the normal process.'}
  ]},
  { id:'q07', category:'CRM & documentation', prompt:'Which CRM note is most suitable after an unresolved customer contact?', options:[
    {score:7,text:'Customer upset; escalated to operations.'},
    {score:10,text:'Record the verified issue, customer-reported facts, checks performed, actions taken, disposition, owner/reference and next update expectation—without speculation.'},
    {score:3,text:'Customer was difficult and probably misunderstood the product.'},
    {score:0,text:'No note is needed because the call recording exists.'}
  ]},
  { id:'q08', category:'Ethical sales', prompt:'A customer contacts you to report a failed payment. You notice they may qualify for another paid service. What is the appropriate approach?', options:[
    {score:10,text:'Resolve or progress the service issue first; only raise a relevant offer when appropriate, explain material terms and obtain permission without pressure.'},
    {score:7,text:'Ask whether they would like information about a relevant service after addressing the payment issue.'},
    {score:3,text:'Present the offer before investigating the failed payment so the opportunity is not missed.'},
    {score:0,text:'Tell the customer the issue will be prioritised only if they accept the offer.'}
  ]},
  { id:'q09', category:'Security & privacy', prompt:'A person claiming to be a customer’s spouse asks you to confirm the customer’s service history and personal details. They know the customer’s name and phone number. What do you do?', options:[
    {score:3,text:'Confirm whether a service record exists but do not disclose its contents.'},
    {score:10,text:'Do not confirm or disclose account-specific information; explain the authorised-access requirement and provide the permitted route.'},
    {score:7,text:'Ask the caller to have the customer contact the organisation through an approved channel.'},
    {score:0,text:'Provide the details because spouses normally share financial information.'}
  ]},
  { id:'q10', category:'Operational judgement', prompt:'The approved customer platform is unavailable. A colleague suggests using a personal messaging account to send customer records to the team. What is the correct response?', options:[
    {score:10,text:'Decline the unapproved channel, follow the authorised continuity process and log/report the system incident.'},
    {score:7,text:'Wait for the approved system or ask a supervisor for an authorised workaround.'},
    {score:3,text:'Send only a screenshot with the account number partly hidden.'},
    {score:0,text:'Send the full record because speed is more important during an outage.'}
  ]},
  { id:'q11', category:'Leadership & teamwork', prompt:'A team member repeatedly misses a required security step. You are asked to support improvement. What is the most effective response?', options:[
    {score:10,text:'Raise any immediate risk through the required route, then provide private, specific, evidence-based coaching and arrange a follow-up check.'},
    {score:7,text:'Remind the colleague of the required step and ask them to review the procedure.'},
    {score:3,text:'Correct the colleague publicly during a live customer contact.'},
    {score:0,text:'Ignore it because quality assurance is another department’s responsibility.'}
  ]},
  { id:'q12', category:'Leadership & teamwork', prompt:'At shift handover, there are open cases that may affect customers after your shift ends. What should you do?', options:[
    {score:7,text:'Tell the next agent that some cases remain open and ask them to check the CRM.'},
    {score:10,text:'Update the case records, identify urgent customer impact, confirm ownership/next actions and communicate the handover through the approved process.'},
    {score:3,text:'Leave a verbal message without updating the case history.'},
    {score:0,text:'Close the cases so they do not appear in your queue tomorrow.'}
  ]}
]);

export function scorePromotionExamAnswersV650(answers = {}) {
  if (!answers || typeof answers !== 'object') return null;
  let earned = 0;
  const max = PROMOTION_EXAM_QUESTIONS_V650.length * 10;
  const categoryTotals = new Map();
  const responses = [];
  for (const question of PROMOTION_EXAM_QUESTIONS_V650) {
    const raw = answers[question.id];
    if (raw === undefined || raw === null || raw === '') return null;
    const score = Number(raw);
    if (!question.options.some(option => option.score === score)) return null;
    earned += score;
    const current = categoryTotals.get(question.category) || { earned:0, max:0, count:0 };
    current.earned += score;
    current.max += 10;
    current.count += 1;
    categoryTotals.set(question.category, current);
    responses.push({ questionId:question.id, category:question.category, points:score });
  }
  const breakdown = Object.fromEntries([...categoryTotals.entries()].map(([category, value]) => [category, {
    score:Math.round(value.earned / value.max * 100), questions:value.count
  }]));
  return { score:Math.round(earned / max * 100), earned, maximum:max, answered:PROMOTION_EXAM_QUESTIONS_V650.length, total:PROMOTION_EXAM_QUESTIONS_V650.length, breakdown, responses };
}

const HELPER_SOURCE = `
const PROMOTION_EXAM_QUESTIONS_V650 = ${JSON.stringify(PROMOTION_EXAM_QUESTIONS_V650)};
${scorePromotionExamAnswersV650.toString()}
function calloriaEnsurePromotionExamStylesV650(){
  if(document.getElementById('calloriaPromotionExamStylesV650'))return;
  const style=document.createElement('style');style.id='calloriaPromotionExamStylesV650';
  style.textContent='.calloria-exam-instructions{padding:12px;border:1px solid rgba(56,189,248,.24);border-radius:10px;background:rgba(56,189,248,.07);font-size:12px;line-height:1.5}.calloria-exam-question{margin:12px 0;padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:12px;min-width:0}.calloria-exam-question legend{padding:0 5px;font-size:13px;font-weight:700;line-height:1.5}.calloria-exam-options{display:grid;gap:7px;margin-top:9px}.calloria-exam-option{display:flex;align-items:flex-start;gap:9px;padding:9px 10px;border:1px solid rgba(148,163,184,.16);border-radius:9px;background:rgba(148,163,184,.045);font-size:12px;line-height:1.45;cursor:pointer}.calloria-exam-option:has(input:checked){border-color:var(--accent,#38bdf8);background:rgba(56,189,248,.09)}.calloria-exam-option input{margin-top:2px;flex:0 0 auto}.calloria-exam-submit{position:sticky;bottom:8px;padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:12px;background:var(--panel,#111827);box-shadow:0 8px 22px rgba(0,0,0,.2)}.calloria-exam-locked{padding:12px;border:1px solid rgba(245,158,11,.22);border-radius:10px;background:rgba(245,158,11,.07);font-size:12px;line-height:1.5}@media(max-width:640px){.calloria-exam-question{padding:10px}.calloria-exam-option{font-size:11px}}';
  document.head.append(style);
}
function calloriaRenderPromotionExamV650(eligible){
  calloriaEnsurePromotionExamStylesV650();
  if(!eligible)return '<div class="calloria-exam-locked"><strong>Annual examination locked.</strong><br>Meet the organisation promotion threshold, and observe the one-attempt-per-year and three-attempt lifetime rules shown above. The exam cannot be started yet.</div>';
  const questions=PROMOTION_EXAM_QUESTIONS_V650.map((question,index)=>'<fieldset class="calloria-exam-question"><legend>Scenario '+(index+1)+' of '+PROMOTION_EXAM_QUESTIONS_V650.length+' · '+escapeHTML(question.category)+'<br>'+escapeHTML(question.prompt)+'</legend><div class="calloria-exam-options">'+question.options.map(option=>'<label class="calloria-exam-option"><input type="radio" name="answer_'+question.id+'" value="'+option.score+'" required><span>'+escapeHTML(option.text)+'</span></label>').join('')+'</div></fieldset>').join('');
  return '<form id="promotionExamForm" class="form-stack calloria-promotion-exam-v650"><div class="calloria-exam-instructions"><strong>Annual promotion examination · 12 scenarios</strong><br>Select one response for every scenario. The system calculates the score from your decisions; you cannot enter or change the result manually. Passing mark: 70%. Submitting records your one permitted examination attempt for this calendar year.</div>'+questions+'<div class="calloria-exam-submit"><button class="btn primary" type="submit">Submit annual promotion examination</button></div></form>';
}
function calloriaEvaluatePromotionExamV650(form){
  const data=new FormData(form);
  const answers=Object.fromEntries(PROMOTION_EXAM_QUESTIONS_V650.map(question=>[question.id,data.get('answer_'+question.id)]));
  return scorePromotionExamAnswersV650(answers);
}
`;

function count(source, anchor) { return source.split(anchor).length - 1; }
function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.50 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;
  if (!original.includes(PREREQUISITE)) {
    context.warn('CALLORIA v6.50 skipped safely: v6.49 promotion readiness dossier is missing. Install the cumulative v6.50 overlay.');
    return null;
  }
  const anchors = [
    [WORKFORCE_ANCHOR, 'Workforce renderer'],
    [WORKFORCE_METRICS_ANCHOR, 'Workforce promotion metrics block'],
    [RENDER_EXAM_ANCHOR, 'numeric promotion exam form'],
    [SUBMIT_ANCHOR, 'promotion exam submit handler'],
    [RECORD_ANCHOR, 'existing promotion exam recording call']
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.50 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }
  let code = original;
  code = replaceOnce(context, code, WORKFORCE_ANCHOR, `${HELPER_SOURCE}\n${WORKFORCE_ANCHOR}`, 'scenario exam helper insertion');
  if (code === null) return null;
  const digitalMetricsBlock = `  const digitalMetricSet = digitalQueueMetrics(state.digitalQueue || []);\n  const completedDigital = digitalMetricSet.resolved + digitalMetricSet.escalated;\n  const digitalQaCount = digitalMetricSet.averageQA === null ? 0 : (state.digitalQueue || []).filter(x => Number.isFinite(x.qaScore)).length;\n  const combinedQaCount = state.qaCount + digitalQaCount;\n  const combinedTotalQA = state.totalQA + (digitalMetricSet.averageQA || 0) * digitalQaCount;\n  const metrics = {\n    kpi: Math.min(100, Math.round((state.callsHandled + state.outboundCalls + completedDigital) * 5)),\n    qa: combinedQaCount ? Math.round(combinedTotalQA / combinedQaCount) : 75,\n    csat: state.csatCount ? Math.round(state.totalCSAT/state.csatCount) : 75,\n    knowledge: Math.min(100, 70 + state.experience),\n    compliance: state.incidents ? Math.max(0,100-state.incidents*12) : 95,\n    leadership: Math.min(100, 60 + Math.floor(state.level*5))\n  };`;
  code = replaceOnce(context, code, WORKFORCE_METRICS_ANCHOR, digitalMetricsBlock, 'Workforce promotion metrics block');
  if (code === null) return null;
  code = replaceOnce(context, code, RENDER_EXAM_ANCHOR, '${calloriaRenderPromotionExamV650(eligibility.eligible)}', 'numeric promotion exam form');
  if (code === null) return null;
  code = replaceOnce(context, code, SUBMIT_ANCHOR, `${SUBMIT_ANCHOR}\n     const examEvaluation=calloriaEvaluatePromotionExamV650(e.target);\n     if(!examEvaluation){toast('Answer all 12 examination scenarios before submitting.','warning');return;}\n     let examScoreField=e.target.querySelector('input[name="examScore"]');\n     if(!examScoreField){examScoreField=document.createElement('input');examScoreField.type='hidden';examScoreField.name='examScore';e.target.append(examScoreField);}\n     examScoreField.value=String(examEvaluation.score);`, 'promotion exam submit handler');
  if (code === null) return null;
  const recordReplacement = `const item=recordPromotionExam(state.promotionAttempts,{metrics,minimumScore:getActiveOrganization(state.organizationWorkspace)?.policy?.promotionThreshold ?? 75,examScore:Number(new FormData(e.target).get('examScore'))});Object.assign(item,{examVersion:'scenario-based-v6.50',examAnswered:examEvaluation.answered,examTotal:examEvaluation.total,examBreakdown:examEvaluation.breakdown,examResponses:examEvaluation.responses});`;
  code = replaceOnce(context, code, RECORD_ANCHOR, recordReplacement, 'existing promotion exam recording call');
  if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaScenarioBasedPromotionExamPlugin() {
  return {
    name:'calloria-scenario-based-promotion-exam-v6-50',
    enforce:'post',
    transform(source,id){
      const target=String(id||'').split('?')[0].replaceAll('\\','/');
      if(target.endsWith(TARGET))return transformMain(this,source);
      return null;
    }
  };
}

export const __calloriaV650Test = {
  transformMain,
  score:scorePromotionExamAnswersV650,
  questions:PROMOTION_EXAM_QUESTIONS_V650,
  MARKER,
  PREREQUISITE,
  WORKFORCE_METRICS_ANCHOR,
  RENDER_EXAM_ANCHOR,
  SUBMIT_ANCHOR,
  RECORD_ANCHOR
};
