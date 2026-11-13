/**
 * CALLORIA v6.44 — conversation-aware after-contact work.
 *
 * Requires the v6.42 voice response and v6.43 live dialogue transforms to run
 * first. Adds a visible transcript review to inbound wrap-up, a user-editable
 * factual case-note draft, privacy scrubbing for conversation data copied into
 * the CRM record, and structured dialogue metrics on the saved case.
 *
 * No network, AI, telephony or Supabase calls are introduced by this plugin.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_INBOUND_CONVERSATION_WRAPUP_V644__';

const WRAPUP_ANCHOR = 'function renderWrapUp(){';
const TRANSFER_LINE_ANCHOR = "  const transferLine=wrap.transferTarget?`<div class=\"data-row\"><span>Transfer destination</span><strong>${escapeHTML(wrap.transferTarget)}</strong></div>`:'';";
const CHECKLIST_ANCHOR = '<div class="article-box"><h4>After-contact checklist</h4>';
const ACTION_ANCHOR = "    case 'save-wrap-up':saveWrapUp();break;";
const CRM_DIALOGUE_ANCHOR = "dialogue:(state.currentCall?.dialogueTurns||[]).map(item=>({type:item.type,text:item.text,at:item.at,quality:item.quality||null})),timeline:contact.timeline.slice()";
const RIGHT_SUMMARY_ANCHOR = '${transferLine}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p>';

const HELPERS = String.raw`
function calloriaScrubDialogueValueV644(rawValue){
  return String(rawValue||'')
    .replace(/\b(pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\s*(?:is|:|=)\s*[A-Za-z0-9-]{2,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){4,}\b/g,'[redacted number]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
    .replace(/\s+/g,' ').trim().slice(0,260);
}
function calloriaReviewDialogueV644(turns,mood='not assessed'){
  const list=Array.isArray(turns)?turns.slice(-24):[];
  const agents=list.filter(item=>item?.type==='agent');
  const customers=list.filter(item=>item?.type==='customer');
  const markerCounts={};let scoreTotal=0;let breachCount=0;
  for(const item of agents){
    const quality=item?.quality||{};
    scoreTotal+=Number(quality.scoreDelta)||0;
    if(quality.breach)breachCount++;
    for(const marker of Array.isArray(quality.markers)?quality.markers:[])markerCounts[marker]=(markerCounts[marker]||0)+1;
  }
  const highlights=Object.entries(markerCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([label,count])=>({label,count}));
  return {turnCount:list.length,agentTurns:agents.length,customerTurns:customers.length,averageScore:agents.length?Math.round((scoreTotal/agents.length)*10)/10:0,breachCount,markers:markerCounts,highlights,lastCustomerMood:String(mood||'not assessed').slice(0,32)};
}
function calloriaDialogueSummaryTextV644(turns,mood='not assessed',issue='Customer enquiry'){
  const list=Array.isArray(turns)?turns:[];
  const customer=list.filter(item=>item?.type==='customer').slice(-2).map(item=>calloriaScrubDialogueValueV644(item.text)).filter(Boolean);
  const agent=list.filter(item=>item?.type==='agent').slice(-2).map(item=>calloriaScrubDialogueValueV644(item.text)).filter(Boolean);
  const sections=['Issue: '+(calloriaScrubDialogueValueV644(issue)||'Customer enquiry')+'.'];
  if(customer.length)sections.push('Customer statements: '+customer.join(' / ')+'.');
  if(agent.length)sections.push('Agent responses: '+agent.join(' / ')+'.');
  sections.push('Customer tone at end of dialogue: '+String(mood||'not assessed').slice(0,32)+'.');
  return sections.join(' ').slice(0,1120);
}
function calloriaRenderWrapUpDialogueV644(turns,review,mood,issue){
  const list=Array.isArray(turns)?turns:[];
  const preview=list.slice(-8).map(item=>'<div class="calloria-wrap-turn '+(item.type==='agent'?'agent':'customer')+'"><small>'+(item.type==='agent'?'AGENT':'CUSTOMER')+'</small><p>'+escapeHTML(calloriaScrubDialogueValueV644(item.text))+'</p></div>').join('');
  const markers=review.highlights.length?review.highlights.map(item=>escapeHTML(item.label)+' × '+item.count).join(' · '):'No communication markers recorded';
  return '<section class="article-box calloria-wrap-dialogue"><div class="calloria-wrap-dialogue-head"><div><h4>Conversation record</h4><p>'+review.agentTurns+' agent responses · '+review.customerTurns+' customer replies · tone '+escapeHTML(review.lastCustomerMood)+'</p></div><span class="pill '+(review.breachCount?'red':'green')+'">'+(review.breachCount?'SECURITY FLAG':'TRANSCRIPT REVIEW')+'</span></div><p class="muted-note">Communication indicators: '+markers+'. Average dialogue score: '+review.averageScore+'.</p><button class="btn small secondary" type="button" data-action="draft-dialogue-notes" '+(list.length?'':'disabled')+'>Build case-note draft from conversation</button><details class="calloria-wrap-transcript"><summary>Review transcript · '+review.turnCount+' entries</summary><div class="calloria-wrap-turn-list">'+(preview||'<p class="muted-note">No free-text conversation entries were recorded.</p>')+'</div></details></section>';
}
function calloriaDraftDialogueNotesV644(){
  const wrap=state.wrapUp;
  if(!wrap||wrap.type!=='inbound'||!state.currentCall){toast('There is no inbound conversation available for a case-note draft.','warning');return;}
  const turns=Array.isArray(state.currentCall.dialogueTurns)?state.currentCall.dialogueTurns:[];
  if(!turns.length){toast('No live dialogue has been recorded for this contact.','warning');return;}
  const field=$('#wrapNotes');
  if(!field){toast('The case-notes field is unavailable.','error');return;}
  const draft=calloriaDialogueSummaryTextV644(turns,state.currentCall.customerMood,wrap.title);
  const current=field.value.trim();
  const joined=current?current+'\n\n'+draft:draft;
  field.value=joined.slice(0,1200);
  field.focus();
  toast('Conversation-based draft inserted. Review and correct it before saving.','success');
}
function calloriaEnsureWrapUpDialogueStylesV644(){
  if(document.getElementById('calloriaWrapUpDialogueStylesV644'))return;
  const style=document.createElement('style');style.id='calloriaWrapUpDialogueStylesV644';
  style.textContent='.calloria-wrap-dialogue{margin-top:14px}.calloria-wrap-dialogue-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.calloria-wrap-dialogue-head h4{margin:0 0 4px}.calloria-wrap-dialogue-head p{margin:0;font-size:12px;color:var(--muted,#94a3b8)}.calloria-wrap-transcript{margin-top:12px;border-top:1px solid rgba(148,163,184,.2);padding-top:10px}.calloria-wrap-transcript summary{cursor:pointer;font-size:12px;font-weight:700}.calloria-wrap-turn-list{display:grid;gap:8px;margin-top:10px;max-height:260px;overflow:auto}.calloria-wrap-turn{padding:8px 10px;border-radius:10px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.18)}.calloria-wrap-turn.agent{margin-left:18px;background:rgba(59,130,246,.08)}.calloria-wrap-turn small{font-size:10px;letter-spacing:.08em;opacity:.7}.calloria-wrap-turn p{margin:4px 0 0;font-size:12px;line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}.calloria-wrap-dialogue .btn{margin-top:8px}';
  document.head.append(style);
}
`;

function count(source, needle) { return source.split(needle).length - 1; }
function checkedReplace(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.44 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;
  const prerequisites = [
    ['__CALLORIA_INBOUND_CUSTOMER_DIALOGUE_V643__', 'v6.43 live customer dialogue transform'],
    ['function calloriaSubmitInboundDialogueV643(', 'v6.43 dialogue submit function']
  ];
  const missingPrerequisite = prerequisites.filter(([needle]) => !original.includes(needle));
  if (missingPrerequisite.length) {
    context.warn(`CALLORIA v6.44 skipped safely: ${missingPrerequisite.map(([, label]) => label).join(', ')} is missing. Install v6.42 and v6.43 before v6.44.`);
    return null;
  }
  const required = [
    [WRAPUP_ANCHOR, 'after-contact rendering function'],
    [TRANSFER_LINE_ANCHOR, 'transfer summary line'],
    [CHECKLIST_ANCHOR, 'after-contact checklist placement'],
    [ACTION_ANCHOR, 'wrap-up action routing'],
    [CRM_DIALOGUE_ANCHOR, 'v6.43 CRM dialogue transcript field'],
    [RIGHT_SUMMARY_ANCHOR, 'interaction summary placement']
  ];
  const missing = required.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.44 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }

  let code = original;
  code = checkedReplace(context, code, WRAPUP_ANCHOR, `${HELPERS}\nfunction renderWrapUp(){`, 'after-contact rendering function');
  if (code === null) return null;

  code = checkedReplace(context, code, TRANSFER_LINE_ANCHOR,
    `${TRANSFER_LINE_ANCHOR}\n  const dialogueTurns=wrap.type==='inbound'&&Array.isArray(state.currentCall?.dialogueTurns)?state.currentCall.dialogueTurns:[];\n  const dialogueReview=calloriaReviewDialogueV644(dialogueTurns,state.currentCall?.customerMood);\n  const dialoguePanel=wrap.type==='inbound'?(calloriaEnsureWrapUpDialogueStylesV644(),calloriaRenderWrapUpDialogueV644(dialogueTurns,dialogueReview,state.currentCall?.customerMood,wrap.title)):'';\n  const dialogueSummaryRows=wrap.type==='inbound'?'<div class="data-row"><span>Conversation entries</span><strong>'+dialogueReview.turnCount+'</strong></div><div class="data-row"><span>Agent responses</span><strong>'+dialogueReview.agentTurns+'</strong></div><div class="data-row"><span>Customer replies</span><strong>'+dialogueReview.customerTurns+'</strong></div>':'';`,
    'transfer summary line');
  if (code === null) return null;

  code = checkedReplace(context, code, CHECKLIST_ANCHOR, '${dialoguePanel}<div class="article-box"><h4>After-contact checklist</h4>', 'after-contact checklist placement');
  if (code === null) return null;

  code = checkedReplace(context, code, RIGHT_SUMMARY_ANCHOR,
    '${transferLine}${dialogueSummaryRows}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p>',
    'interaction summary placement');
  if (code === null) return null;

  code = checkedReplace(context, code, ACTION_ANCHOR,
    `    case 'draft-dialogue-notes':calloriaDraftDialogueNotesV644();break;\n${ACTION_ANCHOR}`,
    'wrap-up action routing');
  if (code === null) return null;

  code = checkedReplace(context, code, CRM_DIALOGUE_ANCHOR,
    "dialogue:(state.currentCall?.dialogueTurns||[]).map(item=>({type:item.type,text:calloriaScrubDialogueValueV644(item.text),at:item.at,quality:item.quality||null})),conversationSummary:calloriaDialogueSummaryTextV644(state.currentCall?.dialogueTurns||[],state.currentCall?.customerMood,wrap.title),conversationMetrics:calloriaReviewDialogueV644(state.currentCall?.dialogueTurns||[],state.currentCall?.customerMood),timeline:contact.timeline.slice()",
    'v6.43 CRM dialogue transcript field');
  if (code === null) return null;

  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaInboundConversationWrapUpPlugin() {
  return {
    name: 'calloria-inbound-conversation-wrapup-v6-44',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __calloriaV644Test = { transformMain, MARKER };
