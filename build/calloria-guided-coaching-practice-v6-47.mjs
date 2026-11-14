/**
 * CALLORIA v6.47 — guided, criterion-based coaching practice.
 * Adds short role-play exercises to v6.46 QA coaching plans. Results are
 * formative practice feedback only; only a human reviewer can record QA
 * follow-up, verify improvement or close a coaching action.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_GUIDED_COACHING_PRACTICE_V647__';

const HELPERS = String.raw`
function calloriaCoachingPracticeScenarioV647(item){
  const key=(String(item?.criterionId||'')+' '+String(item?.topic||'')+' '+String(item?.actionPlan||'')).toLowerCase();
  if(/compliance|credential|security|privacy|otp|pin|password|authentication/.test(key))return {
    type:'compliance',title:'Secure verification practice',
    customer:'“I am in a hurry. I can read my one-time code and password to you so you can make the change for me.”',
    goal:'Protect the customer’s credentials, explain the approved verification route and offer a safe next step.',
    checks:[
      {label:'Clearly refuse to request or receive the secret code/password',test:t=>/(never|do not|don.t|cannot|can.t|won.t|will not).{0,55}(ask|request|share|take|accept|provide|tell).{0,35}(otp|pin|password|code|credential)?/i.test(t)||/(never ask|won.t ask|will not ask|do not share|don.t share)/i.test(t)},
      {label:'Direct the customer to an approved or secure verification route',test:t=>/(approved|official|secure|verification|authentication|trusted channel|app)/i.test(t)},
      {label:'Offer escalation or a safe alternative without bypassing controls',test:t=>/(supervisor|security team|escalat|official app|secure channel|approved process|safe alternative)/i.test(t)}
    ]
  };
  if(/empathy|listening|listen|acknowledg|customer tone/.test(key))return {
    type:'empathy',title:'Listening and empathy practice',
    customer:'“I have explained this problem twice already. Nobody has helped me, and I am tired of repeating myself.”',
    goal:'Acknowledge the customer’s frustration, clarify the unresolved issue and explain what you will do next.',
    checks:[
      {label:'Acknowledge the customer’s feeling or inconvenience',test:t=>/(understand|hear you|sorry|apolog|frustrat|upset|concern|inconvenien|thank you for explaining)/i.test(t)},
      {label:'Ask a focused question or confirm the exact problem',test:t=>/(could you|may i|can i|what happened|which|when did|confirm|just to make sure|is that correct)/i.test(t)},
      {label:'State a helpful next action',test:t=>/(check|review|investigat|look into|resolve|help|take a look|work on)/i.test(t)}
    ]
  };
  if(/ownership|follow.?up|resolution|complaint/.test(key))return {
    type:'ownership',title:'Ownership and resolution practice',
    customer:'“The last agent promised to call me back yesterday. I have received no update. Who is actually handling this?”',
    goal:'Take responsibility, state the next action and set a realistic update timeframe.',
    checks:[
      {label:'Accept responsibility or clearly take ownership',test:t=>/(i will|i.ll|i can handle|take ownership|i am responsible|let me take|i will follow)/i.test(t)},
      {label:'Name a concrete action',test:t=>/(check|review|contact|escalat|investigat|update|arrange|follow up|resolve)/i.test(t)},
      {label:'Give a timeframe or a specific update commitment',test:t=>/(within|by today|today|tomorrow|minute|hour|business day|before|at \d|update you)/i.test(t)}
    ]
  };
  if(/crm|documentation|logging|case note|record keeping/.test(key))return {
    type:'documentation',title:'CRM documentation practice',
    customer:'“My payment failed at 10:42 this morning. The amount was ₦18,500, but my account was debited.”',
    goal:'Confirm the important facts, explain the case record and avoid claiming that an unverified refund is complete.',
    checks:[
      {label:'Confirm the issue and key transaction details',test:t=>/(payment|debit|amount|transaction|reference|time|date|failed)/i.test(t)},
      {label:'State that the interaction or case will be recorded',test:t=>/(record|log|document|case|ticket|reference number|interaction notes)/i.test(t)},
      {label:'Explain a next step without promising an unverified result',test:t=>/(investigat|check|trace|review|reference|update|timeframe|follow up)/i.test(t)}
    ]
  };
  if(/accuracy|knowledge|product information|policy/.test(key))return {
    type:'accuracy',title:'Knowledge accuracy practice',
    customer:'“Does this service guarantee that my request will be completed today? Another person gave me a different answer.”',
    goal:'Avoid guessing, verify the approved source and explain what is known and what still needs confirmation.',
    checks:[
      {label:'Commit to checking an approved source before advising',test:t=>/(knowledge base|approved article|official information|policy|check|verify|confirm|review)/i.test(t)},
      {label:'Avoid guessing or making an unsupported guarantee',test:t=>/(rather than guess|won.t guess|do not assume|not assume|cannot guarantee|confirm before|avoid promising)/i.test(t)},
      {label:'Explain how the customer will receive a confirmed update',test:t=>/(update|let you know|contact you|follow up|once confirmed|after checking|next step)/i.test(t)}
    ]
  };
  if(/sales|cross.?sell|offer|conversion/.test(key))return {
    type:'sales',title:'Customer-led offer practice',
    customer:'“I only contacted you to solve my issue. Are you going to try to sell me something else?”',
    goal:'Resolve the original reason for contact first, ask permission before a relevant offer and respect a refusal.',
    checks:[
      {label:'Prioritise the customer’s original request',test:t=>/(first|original issue|resolve your issue|help with that|address your concern)/i.test(t)},
      {label:'Ask permission and explain a relevant customer benefit',test:t=>/(would you like|may i|if you are interested|benefit|help you|save|feature)/i.test(t)},
      {label:'Make it clear that there is no pressure or obligation',test:t=>/(no pressure|no obligation|your choice|entirely up to you|you can decline|if not, that is fine)/i.test(t)}
    ]
  };
  return {
    type:'general',title:'Customer-care response practice',
    customer:'“I have contacted support because my issue is still unresolved. What will happen now?”',
    goal:'Acknowledge the issue, take a clear next step and set a realistic expectation.',
    checks:[
      {label:'Acknowledge the customer’s concern',test:t=>/(understand|hear you|sorry|concern|frustrat|inconvenien|thank you)/i.test(t)},
      {label:'Give a specific next action',test:t=>/(check|review|investigat|resolve|help|follow up|escalat|update)/i.test(t)},
      {label:'Set a timeframe or explain the next update',test:t=>/(within|today|tomorrow|minute|hour|business day|update you|follow up|once i)/i.test(t)}
    ]
  };
}
function calloriaRedactPracticeTextV647(value){
  return String(value||'')
    .replace(/\b(pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|card number)\s*(?:is|:|=)\s*[A-Za-z0-9-]{2,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){4,}\b/g,'[number redacted]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
    .replace(/\s+/g,' ').trim().slice(0,1200);
}
function calloriaOpenQACoachingPracticeV647(id){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||record.status==='verified')return false;
  record.practiceOpen=!record.practiceOpen;
  return true;
}
function calloriaEvaluateQACoachingPracticeV647({id,response}){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||record.status==='verified')throw new Error('This coaching action is not available for practice.');
  const text=String(response||'').trim();
  if(text.length<20||text.length>1200)throw new RangeError('Practice response must contain 20 to 1,200 characters.');
  const scenario=calloriaCoachingPracticeScenarioV647(record);
  const checks=scenario.checks.map(check=>({label:check.label,passed:Boolean(check.test(text))}));
  const passed=checks.filter(check=>check.passed).length;
  const score=Math.round(passed/checks.length*100);
  const failed=checks.filter(check=>!check.passed).map(check=>check.label);
  const level=score===100?'All practice points demonstrated':score>=67?'Developing — refine the missed point':'More guided practice recommended';
  const attempt={
    id:'PRACTICE-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase(),
    attemptedAt:new Date().toISOString(),scenarioType:scenario.type,score,level,
    checks,responseRedacted:calloriaRedactPracticeTextV647(text),
    feedback:failed.length?'Work on: '+failed.join('; ')+'.':'All scenario checklist points were present in this response.'
  };
  record.practiceAttempts=Array.isArray(record.practiceAttempts)?record.practiceAttempts:[];
  record.practiceAttempts.push(attempt);
  record.practiceOpen=false;
  pushOperationEvent('coaching',record.id,'Guided practice completed ('+score+'% checklist match).','practice_completed',{sourceReviewId:record.sourceReviewId,criterionId:record.criterionId,practiceAttemptId:attempt.id,score});
  return attempt;
}
function calloriaRenderQACoachingPracticeV647(item){
  const attempts=Array.isArray(item.practiceAttempts)?item.practiceAttempts:[];
  const latest=attempts.at(-1);
  const scenario=calloriaCoachingPracticeScenarioV647(item);
  const button=item.status==='verified'?'':'<button class="btn outline" type="button" data-action="qa-coaching-practice-open" data-coaching-id="'+escapeHTML(item.id)+'">'+(item.practiceOpen?'Close guided practice':'Launch guided practice')+'</button>';
  const form=item.practiceOpen?'<form class="calloria-qa-practice-form" data-qa-coaching-practice><input type="hidden" name="coachingId" value="'+escapeHTML(item.id)+'"><div class="calloria-qa-practice-scenario"><strong>'+escapeHTML(scenario.title)+'</strong><p>'+escapeHTML(scenario.customer)+'</p><small>Practice goal: '+escapeHTML(scenario.goal)+'</small></div><label>YOUR RESPONSE<textarea name="practiceResponse" minlength="20" maxlength="1200" required placeholder="Write the response you would give this customer..."></textarea></label><button class="btn primary" type="submit">Check practice response</button></form>':'';
  const result=latest?'<div class="calloria-qa-practice-result"><div><strong>Latest practice · '+latest.score+'% checklist match</strong><span class="pill '+(latest.score===100?'green':latest.score>=67?'amber':'red')+'">'+escapeHTML(latest.level)+'</span></div><p>'+escapeHTML(latest.feedback)+'</p><ul>'+latest.checks.map(check=>'<li class="'+(check.passed?'passed':'missed')+'">'+(check.passed?'✓ ':'• ')+escapeHTML(check.label)+'</li>').join('')+'</ul><details><summary>View redacted practice response</summary><p>'+escapeHTML(latest.responseRedacted)+'</p></details></div>':'';
  return '<div class="calloria-qa-practice">'+button+form+result+'<small>Practice feedback is formative only. It does not change the QA score, employee rating or coaching status. A supervisor must still review the follow-up evidence.</small></div>';
}
function calloriaEnsureQACoachingPracticeStylesV647(){
  if(document.getElementById('calloriaQACoachingPracticeStylesV647'))return;
  const style=document.createElement('style');style.id='calloriaQACoachingPracticeStylesV647';
  style.textContent='.calloria-qa-practice{display:grid;gap:9px;padding-top:8px;border-top:1px solid rgba(148,163,184,.17)}.calloria-qa-practice>small{font-size:10px;color:var(--muted,#94a3b8)}.calloria-qa-practice-form{display:grid;gap:9px;padding:11px;border:1px solid rgba(59,130,246,.25);border-radius:10px;background:rgba(59,130,246,.045)}.calloria-qa-practice-scenario{display:grid;gap:5px}.calloria-qa-practice-scenario p{margin:0;font-size:13px}.calloria-qa-practice-scenario small{color:var(--muted,#94a3b8);font-size:11px}.calloria-qa-practice-form label{display:grid;gap:5px;font-size:10px;letter-spacing:.06em;color:var(--muted,#94a3b8)}.calloria-qa-practice-form textarea{width:100%;min-height:100px;resize:vertical;padding:10px;border:1px solid var(--border,rgba(148,163,184,.3));border-radius:8px;background:var(--panel,transparent);color:inherit;font:inherit}.calloria-qa-practice-form button{justify-self:start}.calloria-qa-practice-result{display:grid;gap:7px;padding:10px;border-radius:9px;background:rgba(148,163,184,.06)}.calloria-qa-practice-result>div{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.calloria-qa-practice-result p{margin:0;font-size:12px}.calloria-qa-practice-result ul{display:grid;gap:4px;margin:0;padding-left:18px;font-size:11px}.calloria-qa-practice-result li.passed{color:var(--success,#22c55e)}.calloria-qa-practice-result li.missed{color:var(--muted,#94a3b8)}.calloria-qa-practice-result details{font-size:11px;color:var(--muted,#94a3b8)}.calloria-qa-practice-result details p{margin-top:5px;overflow-wrap:anywhere}@media(max-width:620px){.calloria-qa-practice-result>div{align-items:flex-start;flex-direction:column}}';
  document.head.append(style);
}
`;

function count(source, anchor) { return source.split(anchor).length - 1; }
function replaceOnce(ctx, source, anchor, replacement, label) {
  const found=count(source,anchor);
  if(found!==1){ctx.warn(`CALLORIA v6.47 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);return null;}
  return source.replace(anchor,replacement);
}

export function transformMain(ctx,input){
  const original=String(input||'').replace(/\r\n?/g,'\n');
  if(original.includes(MARKER))return null;
  if(!original.includes('__CALLORIA_QA_COACHING_FOLLOWTHROUGH_V646__')){
    ctx.warn('CALLORIA v6.47 skipped safely: v6.46 QA coaching follow-through is missing. Install v6.46 first.');return null;
  }
  const anchors=[
    ['function calloriaEnsureQACoachingStateV646(){','QA coaching helper insertion'],
    ["    return '<article class=\"calloria-qa-coaching-card\">",'QA coaching card renderer'],
    ["+follow+delivery+verify+'</article>';",'QA coaching practice insertion'],
    ["    case 'qa-coaching-delivered':",'QA coaching practice action'],
    ["  if(e.target.matches('[data-qa-coaching-followup]')){",'QA coaching practice form handler'],
    ['  calloriaEnsureQACoachingStylesV646();','QA coaching style activation']
  ];
  const missing=anchors.filter(([anchor])=>count(original,anchor)!==1);
  if(missing.length){ctx.warn(`CALLORIA v6.47 skipped safely: ${missing.map(([,label])=>label).join(', ')} did not match. No partial transform was applied.`);return null;}
  let code=original;
  code=replaceOnce(ctx,code,'function calloriaEnsureQACoachingStateV646(){',`${HELPERS}\nfunction calloriaEnsureQACoachingStateV646(){`,'QA coaching helper insertion');
  if(code===null)return null;
  code=replaceOnce(ctx,code,'    return \'<article class="calloria-qa-coaching-card">',`    const practice=calloriaRenderQACoachingPracticeV647(item);\n    return '<article class="calloria-qa-coaching-card">`,'QA coaching card renderer');
  if(code===null)return null;
  code=replaceOnce(ctx,code,"+follow+delivery+verify+'</article>';","+follow+delivery+practice+verify+'</article>';",'QA coaching practice insertion');
  if(code===null)return null;
  code=replaceOnce(ctx,code,"    case 'qa-coaching-delivered':",`    case 'qa-coaching-practice-open':{if(calloriaOpenQACoachingPracticeV647(event.coachingId)){saveState();renderView();}else toast('This coaching plan is no longer available for practice.','warning');break;}\n    case 'qa-coaching-delivered':`,'QA coaching practice action');
  if(code===null)return null;
  code=replaceOnce(ctx,code,"  if(e.target.matches('[data-qa-coaching-followup]')){",`  if(e.target.matches('[data-qa-coaching-practice]')){\n    e.preventDefault();\n    try{const f=new FormData(e.target);const attempt=calloriaEvaluateQACoachingPracticeV647({id:f.get('coachingId'),response:f.get('practiceResponse')});saveState();renderView();toast('Practice feedback recorded: '+attempt.score+'% checklist match. This is not a final QA score.','success');}\n    catch(error){toast(error.message,'warning');}\n    return;\n  }\n  if(e.target.matches('[data-qa-coaching-followup]')){`,'QA coaching practice form handler');
  if(code===null)return null;
  code=replaceOnce(ctx,code,'  calloriaEnsureQACoachingStylesV646();','  calloriaEnsureQACoachingStylesV646();\n  calloriaEnsureQACoachingPracticeStylesV647();','QA coaching style activation');
  if(code===null)return null;
  return {code:`/* ${MARKER} */\n${code}`,map:null};
}

export function calloriaGuidedCoachingPracticePlugin(){
  return {name:'calloria-guided-coaching-practice-v6-47',enforce:'post',transform(source,id){
    const target=String(id||'').split('?')[0].replaceAll('\\','/');
    if(target.endsWith(TARGET))return transformMain(this,source);
    return null;
  }};
}
export const __calloriaV647Test={transformMain,MARKER};
