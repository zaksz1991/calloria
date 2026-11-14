/**
 * CALLORIA v6.46 — human-QA coaching follow-through.
 * A completed human QA review creates evidence-linked coaching action plans
 * for low-rated criteria and mandatory compliance breaches. The reviewer then
 * records delivery and a documented follow-up outcome. No automated employee
 * score, discipline or promotion decision is made.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_QA_COACHING_FOLLOWTHROUGH_V646__';
const REVIEW_SAVE_ANCHOR = 'state.humanQaReviews.push(review);';
const HTML_INSERT_ANCHOR = '      ${calloriaRenderInboundQAPendingV645(pendingInboundReview)}\n     <div class="grid two qa-workspace-grid">';
const ACTION_INSERT_ANCHOR = "    case 'back-knowledge':state.viewedArticle=null;renderView();break;";
const CLICK_FORWARD_ANCHOR = 'handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus});';
const SUBMIT_INSERT_ANCHOR = "  if(e.target.id==='customerLabReplyForm')";

const HELPERS = String.raw`
function calloriaEnsureQACoachingStateV646(){
  if(!Array.isArray(state.coachingSessions))state.coachingSessions=[];
  return state.coachingSessions;
}
function calloriaCreateQACoachingPlansV646(review){
  if(!review?.id)return [];
  const records=calloriaEnsureQACoachingStateV646();
  const existing=records.filter(item=>item?.source==='qa-human-review-v646'&&item.sourceReviewId===review.id);
  if(existing.length)return existing;
  const tasks=(Array.isArray(review.coaching)?review.coaching:[]).map(item=>({
    criterionId:String(item.criterionId||''),
    topic:'QA improvement · '+String(item.criterion||'Customer interaction standard').slice(0,90),
    feedback:'Interaction '+String(review.interactionId||'unknown')+' · '+String(item.evidence||'Evidence recorded in the human QA review.').slice(0,420),
    actionPlan:String(item.action||'Practise this criterion using the approved procedure, then review a new interaction with a supervisor.').slice(0,600),
    score:Math.max(1,Math.min(5,Number(item.rating)||3)),
    evidenceQuote:String(item.evidence||'').slice(0,500),
    priority:'standard'
  }));
  const breaches=Array.isArray(review.criticalBreaches)?review.criticalBreaches:[];
  if(breaches.length)tasks.push({
    criterionId:'compliance-remediation',
    topic:'Mandatory compliance remediation',
    feedback:'Critical review flag(s): '+breaches.join(', ')+'. Interaction '+String(review.interactionId||'unknown')+'.',
    actionPlan:'Review the approved authentication, privacy and information-handling procedure with a supervisor. Practise the correct response and document the safe escalation route.',
    score:1,evidenceQuote:'Critical breach flagged for human review.',priority:'critical'
  });
  if(!tasks.length)return [];
  const createdAt=Date.parse(review.createdAt)||Date.now();
  const followUpDate=new Date(createdAt+7*24*60*60*1000).toISOString().slice(0,10);
  const created=[];
  for(const task of tasks.slice(0,13)){
    try{
      const record=createCoachingRecord(records,{coach:String(review.reviewer||'QA reviewer').slice(0,80),topic:task.topic,feedback:task.feedback,actionPlan:task.actionPlan,score:task.score,followUpDate});
      Object.assign(record,{source:'qa-human-review-v646',sourceReviewId:review.id,sourceInteractionId:String(review.interactionId||''),criterionId:task.criterionId,evidenceQuote:task.evidenceQuote,priority:task.priority,status:'action_plan_open',deliveredAt:null,deliveredBy:'',followUp:null,deliveryHistory:[],followUps:[]});
      created.push(record);
      pushOperationEvent('coaching',record.id,'QA action plan created: '+record.topic+'.',record.priority==='critical'?'mandatory_remediation':'action_plan_open',{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId,criterionId:record.criterionId});
    }catch(error){console.warn('CALLORIA QA coaching plan could not be created:',error);}
  }
  return created;
}
function calloriaUpdateQACoachingDeliveryV646(id){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||!['action_plan_open','reopened'].includes(record.status))return false;
  record.status='delivered';record.deliveredAt=new Date().toISOString();record.deliveredBy=String(record.coach||'Reviewer').slice(0,80);
  record.deliveryHistory=Array.isArray(record.deliveryHistory)?record.deliveryHistory:[];record.deliveryHistory.push({deliveredAt:record.deliveredAt,deliveredBy:record.deliveredBy});
  pushOperationEvent('coaching',record.id,'QA-directed coaching delivery recorded.','delivered',{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId});
  return true;
}
function calloriaRecordQACoachingFollowUpV646({id,outcome,note,reviewer}){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||record.status!=='delivered')throw new Error('Only delivered QA coaching plans can receive a follow-up outcome.');
  const cleanNote=String(note||'').trim();
  const reviewerName=String(reviewer||'').trim();
  if(cleanNote.length<20||cleanNote.length>600)throw new RangeError('Follow-up evidence must contain 20 to 600 characters.');
  if(reviewerName.length<2||reviewerName.length>80)throw new RangeError('Reviewer name must contain 2 to 80 characters.');
  if(!['improved','needs_more_practice'].includes(outcome))throw new TypeError('Choose a valid follow-up outcome.');
  record.followUp={outcome,note:cleanNote,reviewer:reviewerName,recordedAt:new Date().toISOString()};
  record.followUps=Array.isArray(record.followUps)?record.followUps:[];record.followUps.push(record.followUp);
  record.status=outcome==='improved'?'verified':'reopened';
  pushOperationEvent('coaching',record.id,outcome==='improved'?'QA coaching follow-up verified improvement.':'QA coaching follow-up requires further practice.',record.status,{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId});
  return record;
}
function calloriaRenderQACoachingFollowThroughV646(){
  const records=calloriaEnsureQACoachingStateV646().filter(item=>item?.source==='qa-human-review-v646');
  const open=records.filter(item=>['action_plan_open','reopened'].includes(item.status)).length;
  const delivered=records.filter(item=>item.status==='delivered').length;
  const verified=records.filter(item=>item.status==='verified').length;
  const cards=records.slice().reverse().slice(0,16).map(item=>{
    const critical=item.priority==='critical';
    const status=String(item.status||'action_plan_open').replaceAll('_',' ').toUpperCase();
    const dueDate=item.followUpDate?new Date(item.followUpDate+'T00:00:00'):null;
    const overdue=dueDate&&dueDate.getTime()<new Date(new Date().toDateString()).getTime()&&item.status!=='verified';
    const due=dueDate?dueDate.toLocaleDateString()+(overdue?' · OVERDUE':''):'Not scheduled';
    const history=Array.isArray(item.followUps)?item.followUps:(item.followUp?[item.followUp]:[]);
    const follow=history.map(entry=>'<div class="calloria-qa-followup-result"><strong>'+(entry.outcome==='improved'?'IMPROVEMENT VERIFIED':'FURTHER PRACTICE REQUIRED')+'</strong><p>'+escapeHTML(entry.note)+'</p><small>'+escapeHTML(entry.reviewer||'Reviewer')+' · '+escapeHTML(new Date(entry.recordedAt).toLocaleString())+'</small></div>').join('');
    const delivery=['action_plan_open','reopened'].includes(item.status)?('<button class="btn outline" type="button" data-action="qa-coaching-delivered" data-coaching-id="'+escapeHTML(item.id)+'">Mark coaching delivered</button>'):'';
    const verify=item.status==='delivered'?('<form class="calloria-qa-followup-form" data-qa-coaching-followup><input type="hidden" name="coachingId" value="'+escapeHTML(item.id)+'"><label>FOLLOW-UP OUTCOME<select name="outcome"><option value="improved">Improvement demonstrated</option><option value="needs_more_practice">Further practice required</option></select></label><label>FOLLOW-UP EVIDENCE<textarea name="note" minlength="20" maxlength="600" required placeholder="Describe the practice check, observed behaviour and evidence."></textarea></label><label>REVIEWER<input name="reviewer" minlength="2" maxlength="80" required value="'+escapeHTML(state.applicantName||'')+'"></label><button class="btn primary" type="submit">Record follow-up result</button></form>'):'';
    return '<article class="calloria-qa-coaching-card"><div class="calloria-qa-coaching-head"><div><strong>'+escapeHTML(item.topic||'QA coaching action')+'</strong><small>Review '+escapeHTML(item.sourceReviewId||'')+' · '+escapeHTML(item.sourceInteractionId||'')+' · Follow-up due '+escapeHTML(due)+'</small></div><span class="pill '+(critical?'red':item.status==='verified'?'green':item.status==='delivered'?'amber':'blue')+'">'+(critical?'CRITICAL · ':'')+escapeHTML(status)+'</span></div><p>'+escapeHTML(item.actionPlan||'')+'</p>'+(item.evidenceQuote?'<small class="calloria-qa-coaching-evidence">Evidence: “'+escapeHTML(item.evidenceQuote)+'”</small>':'')+follow+delivery+verify+'</article>';
  }).join('');
  return '<section class="panel calloria-qa-coaching-panel"><div class="panel-head"><div><h3>QA coaching follow-through</h3><p>Evidence-linked plans created after a human QA review. Record delivery and document the follow-up check.</p></div><span class="pill '+(open?'amber':'green')+'">'+open+' OPEN · '+delivered+' FOLLOW-UP DUE · '+verified+' VERIFIED</span></div>'+(cards?'<div class="calloria-qa-coaching-list">'+cards+'</div>':'<p class="muted-note">No coaching action plans have been generated. Save a human QA review with low-rated criteria or a mandatory compliance flag to create one.</p>')+'<p class="muted-note">A plan is not considered complete when delivered. A reviewer must record a practice-check outcome and supporting notes. “Further practice required” reopens the action.</p></section>';
}
function calloriaEnsureQACoachingStylesV646(){
  if(document.getElementById('calloriaQACoachingStylesV646'))return;
  const style=document.createElement('style');style.id='calloriaQACoachingStylesV646';
  style.textContent='.calloria-qa-coaching-panel{margin:14px 0}.calloria-qa-coaching-list{display:grid;gap:10px}.calloria-qa-coaching-card{display:grid;gap:9px;padding:13px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(148,163,184,.055)}.calloria-qa-coaching-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.calloria-qa-coaching-head>div{display:grid;gap:4px;min-width:0}.calloria-qa-coaching-head small,.calloria-qa-coaching-evidence{font-size:11px;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-qa-coaching-card>p{margin:0;font-size:13px}.calloria-qa-followup-result{border-left:3px solid var(--success,#22c55e);padding:8px 10px;background:rgba(34,197,94,.06)}.calloria-qa-followup-result p{margin:5px 0;font-size:13px}.calloria-qa-followup-result small{font-size:11px;color:var(--muted,#94a3b8)}.calloria-qa-followup-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding-top:8px;border-top:1px solid rgba(148,163,184,.18)}.calloria-qa-followup-form label{display:grid;gap:5px;font-size:10px;letter-spacing:.06em;color:var(--muted,#94a3b8)}.calloria-qa-followup-form label:nth-child(2){grid-column:1/-1}.calloria-qa-followup-form textarea{min-height:68px;resize:vertical}.calloria-qa-followup-form input,.calloria-qa-followup-form select,.calloria-qa-followup-form textarea{width:100%;padding:9px;border:1px solid var(--border,rgba(148,163,184,.3));border-radius:8px;background:var(--panel,transparent);color:inherit;font:inherit}.calloria-qa-followup-form button{justify-self:start}@media(max-width:620px){.calloria-qa-coaching-head{flex-direction:column}.calloria-qa-followup-form{grid-template-columns:1fr}.calloria-qa-followup-form label:nth-child(2){grid-column:auto}}';
  document.head.append(style);
}
`

function occurrences(source, needle) { return source.split(needle).length - 1; }
function replaceOnce(context, source, anchor, replacement, label) {
  const found=occurrences(source,anchor);
  if(found!==1){context.warn(`CALLORIA v6.46 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);return null;}
  return source.replace(anchor,replacement);
}

export function transformMain(context,input){
  const original=String(input||'').replace(/\r\n?/g,'\n');
  if(original.includes(MARKER))return null;
  const prerequisite=['__CALLORIA_INBOUND_QA_REVIEW_BRIDGE_V645__','v6.45 inbound QA review bridge'];
  if(!original.includes(prerequisite[0])){context.warn(`CALLORIA v6.46 skipped safely: ${prerequisite[1]} is missing. Install v6.45 first.`);return null;}
  const required=[
    [REVIEW_SAVE_ANCHOR,'human QA review save'],
    [HTML_INSERT_ANCHOR,'QA workspace coaching panel insertion'],
    [ACTION_INSERT_ANCHOR,'QA coaching delivery action'],
    [CLICK_FORWARD_ANCHOR,'delegated action data forwarding'],
    [SUBMIT_INSERT_ANCHOR,'QA coaching follow-up form handler']
  ];
  const missing=required.filter(([anchor])=>occurrences(original,anchor)!==1);
  if(missing.length){context.warn(`CALLORIA v6.46 skipped safely: ${missing.map(([,label])=>label).join(', ')} did not match. No partial transform was applied.`);return null;}
  let code=original;
  code=replaceOnce(context,code,'function renderQAWorkspace() {',`${HELPERS}\nfunction renderQAWorkspace(){`,'QA workspace renderer');
  if(code===null)return null;
  code=replaceOnce(context,code,'  const reviewable = (state.customerQaHistory || []).filter(item => Array.isArray(item.transcript) && item.transcript.length);',`  const reviewable = (state.customerQaHistory || []).filter(item => Array.isArray(item.transcript) && item.transcript.length);\n  calloriaEnsureQACoachingStylesV646();`,'QA reviewable interaction list');
  if(code===null)return null;
  code=replaceOnce(context,code,HTML_INSERT_ANCHOR,`      \${calloriaRenderInboundQAPendingV645(pendingInboundReview)}\n      \${calloriaRenderQACoachingFollowThroughV646()}\n     <div class="grid two qa-workspace-grid">`,'QA workspace coaching panel insertion');
  if(code===null)return null;
  code=replaceOnce(context,code,REVIEW_SAVE_ANCHOR,`${REVIEW_SAVE_ANCHOR}calloriaCreateQACoachingPlansV646(review);`,'human QA review save');
  if(code===null)return null;
  code=replaceOnce(context,code,ACTION_INSERT_ANCHOR,`    case 'qa-coaching-delivered':{if(calloriaUpdateQACoachingDeliveryV646(event.coachingId)){saveState();renderView();toast('QA coaching delivery recorded. A documented follow-up is still required.','success');}else toast('This coaching plan is not awaiting delivery.','warning');break;}\n${ACTION_INSERT_ANCHOR}`,'QA coaching delivery action');
  if(code===null)return null;
  code=replaceOnce(context,code,CLICK_FORWARD_ANCHOR,`handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus,coachingId:action.dataset.coachingId});`,'delegated action data forwarding');
  if(code===null)return null;
  code=replaceOnce(context,code,SUBMIT_INSERT_ANCHOR,`  if(e.target.matches('[data-qa-coaching-followup]')){\n    e.preventDefault();\n    try{const f=new FormData(e.target);const record=calloriaRecordQACoachingFollowUpV646({id:f.get('coachingId'),outcome:f.get('outcome'),note:f.get('note'),reviewer:f.get('reviewer')});saveState();renderView();toast(record.status==='verified'?'QA coaching improvement verified.':'Further practice required; coaching plan reopened.','success');}\n    catch(error){toast(error.message,'warning');}\n    return;\n  }\n  ${SUBMIT_INSERT_ANCHOR}`,'QA coaching follow-up form handler');
  if(code===null)return null;
  return {code:`/* ${MARKER} */\n${code}`,map:null};
}

export function calloriaQACoachingFollowThroughPlugin(){
  return {name:'calloria-qa-coaching-followthrough-v6-46',enforce:'post',transform(source,id){
    const target=String(id||'').split('?')[0].replaceAll('\\','/');
    if(target.endsWith(TARGET))return transformMain(this,source);
    return null;
  }};
}

export const __calloriaV646Test={transformMain,MARKER};
