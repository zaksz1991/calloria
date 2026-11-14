/**
 * CALLORIA v6.45 — completed inbound contacts enter the human QA workspace.
 *
 * Runs after the v6.42 voice transcript, v6.43 dialogue and v6.44 wrap-up
 * transforms. It converts a completed inbound contact into an evidence-bearing
 * review record for the existing QA workspace. It does not score or fail an
 * employee automatically: a human reviewer must rate each criterion and select
 * exact transcript evidence using the existing QA engine.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_INBOUND_QA_REVIEW_BRIDGE_V645__';

const QA_RENDER_ANCHOR = 'function renderQAWorkspace() {';
const REVIEWABLE_ANCHOR = "  const reviewable = (state.customerQaHistory || []).filter(item => Array.isArray(item.transcript) && item.transcript.length);";
const SELECTED_ANCHOR = '  const selectedInteraction = reviewable.find(item => item.id === state.qaSelectedInteractionId) || reviewable.at(-1) || null;';
const OPTIONS_ANCHOR = '  const interactionOptions = reviewable.map(item => `<option value="${escapeHTML(item.id)}" ${item.id === selectedInteraction?.id ? \'selected\' : \'\'}>${escapeHTML(item.id)} · ${escapeHTML(item.issueId)} · ${escapeHTML(item.channel)}</option>`).join(\'\');';
const AI_PANEL_ANCHOR = '      ${renderAIAssistPanel(reviewable)}';
const CRM_PUSH_ANCHOR = '    state.cases.push(record);';

const HELPERS = String.raw`
function calloriaScrubInboundQATextV645(value){
  return String(value??'')
    .replace(/\b(pin|password|passcode|otp|one[-\s]?time\s+(?:password|code)|security\s+code|cvv)\s*(?:(?:is|:|=)\s*)?[A-Za-z0-9-]{2,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){8,}\b/g,'[redacted number]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
    .replace(/\s+/g,' ').trim().slice(0,1000);
}
function calloriaBuildInboundQATranscriptV645({wrap,call,contact,scenario,notes}){
  const transcript=[];
  const add=(speaker,text,at)=>{
    const safe=calloriaScrubInboundQATextV645(text);
    if(!safe)return;
    if(transcript.some(line=>line.speaker===speaker&&line.text===safe))return;
    transcript.push({speaker,text:safe,at:at||null});
  };
  if(scenario?.opening)add('customer',scenario.opening,scenario.createdAt||null);
  const turns=Array.isArray(call?.dialogueTurns)?call.dialogueTurns:[];
  if(turns.length){
    for(const turn of turns)add(turn?.type==='agent'?'agent':'customer',turn?.text,turn?.at);
  }
  const replies=Array.isArray(call?.voiceReplies)?call.voiceReplies:[];
  for(const reply of replies)add('agent',reply?.text,reply?.at);
  if(!turns.length&&!replies.length){
    const timeline=Array.isArray(contact?.timeline)?contact.timeline:[];
    for(const item of timeline){
      const event=String(item?.event||'');
      if(event.startsWith('Agent selected:'))add('agent',event.replace(/^Agent selected:\s*/,''),item.at);
      if(item?.agentMessage)add('agent',item.agentMessage,item.at);
      if(item?.customerReply)add('customer',item.customerReply,item.at);
    }
  }
  if(notes)add('case-note','Factual case note: '+notes,new Date().toISOString());
  return transcript.slice(-40);
}
function calloriaQueueInboundQAV645({wrap,call,contact,notes,disposition,createdAt}){
  if(!wrap||wrap.type!=='inbound'||!contact?.id)return null;
  if(!Array.isArray(state.customerQaHistory))state.customerQaHistory=[];
  const id='INB-QA-'+String(contact.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,72);
  const existing=state.customerQaHistory.find(item=>item.id===id||item.sourceCaseId===contact.id);
  if(existing)return existing;
  const scenario=inboundScenarios.find(item=>item.id===(wrap.scenarioId||call?.scenarioId));
  const transcript=calloriaBuildInboundQATranscriptV645({wrap,call,contact,scenario,notes});
  if(!transcript.length)return null;
  const breached=Boolean(wrap.breach||call?.breach||call?.dialogueBreachV643);
  const item={
    id,sourceCaseId:contact.id,sourceType:'inbound-operations',
    issueId:scenario?.id||wrap.scenarioId||'inbound-contact',
    personaId:'',channel:'Voice',customer:wrap.customer||scenario?.customer||'Customer',
    caseReference:wrap.reference||'',caseTitle:wrap.title||scenario?.issue||'Inbound customer contact',
    caseNotes:calloriaScrubInboundQATextV645(notes||''),
    disposition:String(disposition||''),estimatedQA:Math.max(0,Math.min(100,Number(wrap.qa)||0)),
    criticalBreaches:breached?['inbound_policy_or_security_breach']:[],
    transcript,createdAt:createdAt||new Date().toISOString(),outcome:String(disposition||'completed'),
    reviewState:'pending',owner:state.applicantName||'Agent'
  };
  state.customerQaHistory.push(item);
  state.customerQaHistory=state.customerQaHistory.slice(-200);
  pushOperationEvent('qa-queue',id,'Completed inbound contact added to the human QA review queue.',breached?'mandatory_review':'pending',{contactId:contact.id,issueId:item.issueId,transcriptLines:transcript.length,criticalBreaches:item.criticalBreaches});
  return item;
}
function calloriaRenderInboundQAPendingV645(items){
  const inbound=(Array.isArray(items)?items:[]).filter(item=>item?.sourceType==='inbound-operations');
  const rows=inbound.slice().reverse().slice(0,8).map(item=>{
    const critical=Array.isArray(item.criticalBreaches)&&item.criticalBreaches.length>0;
    const date=item.createdAt?new Date(item.createdAt).toLocaleString():'Time not recorded';
    return '<article class="calloria-qa-pending-item"><div><strong>'+escapeHTML(item.customer||'Customer')+'</strong><small>'+escapeHTML(item.caseTitle||item.issueId||'Inbound contact')+' · '+escapeHTML(item.caseReference||item.id)+'</small><small>'+escapeHTML(date)+' · '+(Number(item.transcript?.length)||0)+' evidence lines</small></div><span class="pill '+(critical?'red':'amber')+'">'+(critical?'MANDATORY REVIEW':'PENDING QA')+'</span></article>';
  }).join('');
  const criticalCount=inbound.filter(item=>Array.isArray(item.criticalBreaches)&&item.criticalBreaches.length).length;
  return '<section class="panel calloria-qa-pending-panel"><div class="panel-head"><div><h3>Inbound interaction review queue</h3><p>Completed inbound calls are routed here for evidence-based human review.</p></div><span class="pill '+(criticalCount?'red':'amber')+'">'+inbound.length+' AWAITING · '+criticalCount+' CRITICAL</span></div>'+(rows?'<div class="calloria-qa-pending-list">'+rows+'</div>':'<p class="muted-note">No completed inbound calls are awaiting review. Finish an inbound call and save its case record to populate this queue.</p>')+'<p class="muted-note">The interaction QA estimate is not a human score. Reviewers must select ratings and exact transcript evidence before a formal training review is saved.</p></section>';
}
function calloriaEnsureInboundQAStylesV645(){
  if(document.getElementById('calloriaInboundQAStylesV645'))return;
  const style=document.createElement('style');style.id='calloriaInboundQAStylesV645';
  style.textContent='.calloria-qa-pending-panel{margin:14px 0}.calloria-qa-pending-list{display:grid;gap:8px}.calloria-qa-pending-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(148,163,184,.06)}.calloria-qa-pending-item>div{display:grid;gap:3px;min-width:0}.calloria-qa-pending-item strong{font-size:13px}.calloria-qa-pending-item small{font-size:11px;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-qa-pending-item .pill{flex-shrink:0}@media(max-width:600px){.calloria-qa-pending-item{align-items:flex-start;flex-direction:column}}';
  document.head.append(style);
}
`;

function count(source, needle) { return source.split(needle).length - 1; }
function checkedReplace(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.45 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original=String(input||'').replace(/\r\n?/g,'\n');
  if(original.includes(MARKER))return null;
  const prerequisites=[
    ['__CALLORIA_VOICE_RESPONSE_WORKFLOW_V642__','v6.42 voice response integration'],
    ['__CALLORIA_INBOUND_CUSTOMER_DIALOGUE_V643__','v6.43 live dialogue integration'],
    ['__CALLORIA_INBOUND_CONVERSATION_WRAPUP_V644__','v6.44 conversation wrap-up integration']
  ];
  const missingPrerequisites=prerequisites.filter(([needle])=>!original.includes(needle));
  if(missingPrerequisites.length){
    context.warn(`CALLORIA v6.45 skipped safely: ${missingPrerequisites.map(([,label])=>label).join(', ')} is missing. Install v6.42–v6.44 first.`);
    return null;
  }
  const required=[
    [QA_RENDER_ANCHOR,'human QA workspace renderer'],
    [REVIEWABLE_ANCHOR,'QA reviewable-interaction list'],
    [SELECTED_ANCHOR,'QA selected-interaction default'],
    [OPTIONS_ANCHOR,'QA interaction selector'],
    [AI_PANEL_ANCHOR,'QA workspace insertion point'],
    [CRM_PUSH_ANCHOR,'successful inbound case save']
  ];
  const missing=required.filter(([anchor])=>count(original,anchor)!==1);
  if(missing.length){
    context.warn(`CALLORIA v6.45 skipped safely: ${missing.map(([,label])=>label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }
  let code=original;
  code=checkedReplace(context,code,QA_RENDER_ANCHOR,`${HELPERS}\n${QA_RENDER_ANCHOR}`,'human QA workspace renderer');
  if(code===null)return null;
  code=checkedReplace(context,code,REVIEWABLE_ANCHOR,
    `${REVIEWABLE_ANCHOR}\n  const reviewedInteractionIds=new Set((state.humanQaReviews||[]).map(item=>item.interactionId));\n  const pendingReview=reviewable.filter(item=>!reviewedInteractionIds.has(item.id));\n  const pendingInboundReview=pendingReview.filter(item=>item.sourceType==='inbound-operations');\n  calloriaEnsureInboundQAStylesV645();`,
    'QA reviewable-interaction list');
  if(code===null)return null;
  code=checkedReplace(context,code,SELECTED_ANCHOR,
    '  const selectedInteraction = reviewable.find(item => item.id === state.qaSelectedInteractionId) || pendingReview.at(-1) || reviewable.at(-1) || null;',
    'QA selected-interaction default');
  if(code===null)return null;
  code=checkedReplace(context,code,OPTIONS_ANCHOR,
    '  const interactionOptions = reviewable.map(item => `<option value="${escapeHTML(item.id)}" ${item.id===state.qaSelectedInteractionId?\'selected\':\'\'}>${pendingReview.some(pending=>pending.id===item.id)?\'PENDING · \':\'\'}${escapeHTML(item.id)} · ${escapeHTML(item.issueId)} · ${escapeHTML(item.channel)}</option>`).join(\'\');',
    'QA interaction selector');
  if(code===null)return null;
  code=checkedReplace(context,code,AI_PANEL_ANCHOR,
    '      ${renderAIAssistPanel(reviewable)}\n      ${calloriaRenderInboundQAPendingV645(pendingInboundReview)}',
    'QA workspace insertion point');
  if(code===null)return null;
  code=checkedReplace(context,code,CRM_PUSH_ANCHOR,
    `${CRM_PUSH_ANCHOR}\n    calloriaQueueInboundQAV645({wrap,call:state.currentCall,contact,notes,disposition,createdAt});`,
    'successful inbound case save');
  if(code===null)return null;
  code=code.replace('<strong>Human review workspace · synthetic training records</strong>','<strong>Human review workspace · simulated contact-centre records</strong>')
    .replace('Review synthetic interaction evidence, coach agents, calibrate reviewers and resolve score disputes.','Review inbound operations and customer-practice evidence, coach agents, calibrate reviewers and resolve score disputes.');
  return {code:`/* ${MARKER} */\n${code}`,map:null};
}

export function calloriaInboundQAReviewBridgePlugin(){
  return {name:'calloria-inbound-qa-review-bridge-v6-45',enforce:'post',transform(source,id){
    const target=String(id||'').split('?')[0].replaceAll('\\','/');
    if(target.endsWith(TARGET))return transformMain(this,source);
    return null;
  }};
}

export const __calloriaV645Test={transformMain,MARKER};
