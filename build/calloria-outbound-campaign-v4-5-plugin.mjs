/** CALLORIA v4.5 — conversational outbound campaigns, callbacks and follow-up. */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_OUTBOUND_CAMPAIGN_OPERATIONS_V45__';
const V44_IMPORT_ANCHOR = "import { createOperationalConversation, submitOperationalTurn, operationalConversationSummary } from './operational-conversation-engine.js';";
const SUBMIT_ANCHOR = "document.addEventListener('submit',async e=>{";
const ACTION_ANCHOR = "    case 'open-outbound':state.currentView='outbound';renderView();break;";
const CASE_RECORD_ANCHOR = "state.cases.push({reference:wrap.reference,contactId:wrap.contactId,customer:task.customer,title:task.title,channel:'Outbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent'});";
const ATTEMPT_RECORD_ANCHOR = "state.outboundAttempts.push({id:wrap.contactId,customer:task.customer,campaignId:task.id,outcome:status,createdAt,suppressed:disposition==='opt_out'});";
const RENDER_START_ANCHOR = 'function renderOutbound() {';
const RENDER_END_ANCHOR = 'function caseRow(c)';
const SALES_CREDIT_ANCHOR = "if(good&&task.id==='product-offer')state.sales++;";
const WRAP_UI_ANCHOR = ": (wrap.breach ? [['review','Compliance / quality review']] : [['completed','Completed'],['callback','Customer requested callback'],['declined','Customer declined'],...(wrap.suppressionRequested?[['opt_out','Do not contact — suppression required']]:[])]);";
const WRAP_SAVE_ANCHOR = ": (wrap.breach?['review']:['completed','callback','declined',...(wrap.suppressionRequested?['opt_out']:[])]);";

const HELPER = String.raw`
function renderOutboundCampaignDeskV45(){
  if(state.wrapUp?.type==='outbound'){renderWrapUp();return;}
  if(!state.shiftActive){viewRoot.innerHTML=renderShiftEntryPanel('Start your shift first','Outbound campaign operations require an active working shift.');return;}
  const active=state.activeOutbound;
  if(active){
    const task=outboundCampaigns.find(item=>item.id===active.campaignId);
    if(!task){viewRoot.innerHTML='<div class="panel empty-state"><h3>Campaign record unavailable</h3><p>The active outbound interaction has not been changed or silently closed.</p><button class="btn secondary" data-action="end-outbound">End simulated attempt safely</button></div>';return;}
    if(!active.conversation){
      active.conversation=createOutboundConversation({id:active.attemptId,campaign:task,agentName:state.applicantName||'Customer Experience Agent',seed:active.attemptId});
      if(active.conversation.suppressionRequested){
        active.suppressionRequested=true;active.disposition='opt_out';
        if(!isContactSuppressed(task.customer,state.outboundSuppressions)){
          addSuppression(state.outboundSuppressions,task.customer,'Customer requested no further campaign contact',Date.now());
          pushOperationEvent('campaign',active.attemptId,'Customer do-not-contact request added to suppression register.','suppressed',{campaignId:task.id});
        }
      }
      saveState();
    }
    const conversation=active.conversation;
    const summary=outboundConversationSummary(conversation);
    const messages=conversation.messages.map(item=>'<article class="v45-message '+(item.speaker==='customer'?'customer':'agent')+'"><header><strong>'+(item.speaker==='customer'?escapeHTML(task.customer):'YOU · AGENT')+'</strong><time>'+escapeHTML(new Date(item.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))+'</time></header><p>'+escapeHTML(item.text)+'</p></article>').join('');
    const latest=[...conversation.messages].reverse().find(item=>item.speaker==='customer');
    const ready=conversation.status==='ready_for_wrap_up'||conversation.status==='escalated';
    const stateLabel=conversation.status==='escalated'?'SUPERVISOR / COMPLIANCE REVIEW':conversation.suppressionRequested?'DO NOT CONTACT · SUPPRESSION REQUIRED':conversation.callbackRequested?'CUSTOMER CALLBACK REQUESTED':ready?'READY FOR AFTER-CONTACT WORK':conversation.permissionToContinue?'CUSTOMER AGREED TO CONTINUE':'INTRODUCTION & PERMISSION';
    const responseForm=ready?'':'<form id="outboundCampaignReplyForm" class="v45-reply-form"><label for="v45OutboundReply">YOUR OUTBOUND RESPONSE</label><textarea id="v45OutboundReply" name="reply" rows="3" minlength="12" maxlength="1000" required placeholder="Identify yourself, explain the exact reason for the call and ask whether this is a convenient time. Respect any refusal or opt-out."></textarea><div class="v45-reply-foot"><small>Synthetic campaign contact only. Do not request credentials, make unsupported claims, pressure the customer or continue after an opt-out.</small><button class="btn primary" type="submit">Send response →</button></div></form>';
    const outcome=ready?'<div class="call-feedback '+(conversation.status==='escalated'?'bad':conversation.suppressionRequested?'neutral':'good')+'"><strong>'+escapeHTML(stateLabel)+'</strong><p>'+escapeHTML(String(conversation.dispositionHint||'review').replaceAll('_',' '))+'</p><small>Complete accurate notes and choose only the permitted final disposition.</small></div>':'';
    viewRoot.innerHTML='<div class="call-layout v45-outbound-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>OUTBOUND CAMPAIGN · CONVERSATIONAL DIALER</strong><small>'+escapeHTML(task.type)+' · '+escapeHTML(task.title)+' · '+escapeHTML(active.attemptId)+'</small></div><span class="pill '+(ready?'amber':'green')+'">'+(ready?'WRAP-UP READY':'SIMULATED CONTACT')+'</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">'+escapeHTML(task.initials||'CX')+'</div><div class="customer-info"><strong>'+escapeHTML(task.customer)+'</strong><small>Fictional campaign contact · '+escapeHTML(task.type)+'</small></div><span class="pill">OUTBOUND</span></div><div class="subtle-label">CONTACT PURPOSE</div><p class="call-prompt">'+escapeHTML(task.objective||task.title)+'</p><p class="call-context">'+escapeHTML(task.context||'Approved synthetic campaign scenario.')+'</p><div class="v45-outbound-meta"><span>Customer preference <b>'+escapeHTML(conversation.preference.replaceAll('_',' '))+'</b></span><span>Patience <b>'+conversation.patience+'%</b></span><span>Turns <b>'+summary.turns+'</b></span><span>Interaction QA <b>'+(summary.averageScore===null?'PENDING':summary.averageScore+'%')+'</b></span></div><section class="v45-transcript" aria-label="Outbound customer conversation">'+messages+'</section>'+outcome+responseForm+'<div class="v45-actions"><button class="btn outline" data-action="play-outbound-customer" '+(latest?'':'disabled')+'>Play customer voice</button><button class="btn outline" data-action="request-outbound-supervisor">Request supervisor</button>'+(ready?'<button class="btn primary" data-action="complete-outbound-step">Proceed to after-contact work</button>':'')+'</div></div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Campaign & customer record</h3><p>Outbound contact context.</p></div><span class="pill">SIMULATED CRM</span></div><div class="data-list"><div class="data-row"><span>Campaign</span><strong>'+escapeHTML(task.title)+'</strong></div><div class="data-row"><span>Contact</span><strong>'+escapeHTML(task.customer)+'</strong></div><div class="data-row"><span>Purpose</span><strong>'+escapeHTML(task.type)+'</strong></div><div class="data-row"><span>Attempt reference</span><strong>'+escapeHTML(active.attemptId)+'</strong></div><div class="data-row"><span>Permission to continue</span><strong>'+(summary.permissionToContinue?'Recorded':'Not established')+'</strong></div><div class="data-row"><span>Callback request</span><strong>'+(summary.callbackRequested?'Requested':'None recorded')+'</strong></div><div class="data-row"><span>Suppression</span><strong>'+(summary.suppressionRequested?'Required':'Not requested')+'</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Outbound contact rules</h3><p>Required conduct throughout the contact.</p></div></div><ul class="v45-policy-list"><li>Identify yourself and the organisation honestly.</li><li>State the real reason for the call.</li><li>Ask whether the customer can speak now.</li><li>Respect refusal and do-not-contact requests immediately.</li><li>Never request PINs, passwords, OTPs or full card details.</li><li>Record callbacks only when the customer requests or agrees.</li></ul><p class="muted-note">This is a synthetic game simulation. It does not place calls or establish legal consent for real campaigns.</p><button class="btn outline" style="width:100%" data-action="end-outbound">End attempt without completion credit</button></section></aside></div>';
    return;
  }
  const suppressed=Array.isArray(state.outboundSuppressions)?state.outboundSuppressions:[];
  const attempts=Array.isArray(state.outboundAttempts)?state.outboundAttempts:[];
  const callbacks=(state.callbacks||[]).filter(item=>item.type==='outbound'&&item.status==='scheduled').sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  const dueCount=callbacks.filter(item=>Date.parse(item.dueAt)<=Date.now()).length;
  const cards=outboundCampaigns.map(c=>{
    const blocked=isContactSuppressed(c.customer,suppressed);
    const completed=(state.outboundDone||[]).includes(c.id);
    const attemptCount=attempts.filter(item=>item.campaignId===c.id).length;
    const status=blocked?'CONTACT SUPPRESSED':completed?'ATTEMPT COMPLETED':attemptCount?'PREVIOUS ATTEMPT RECORDED':'READY · SIMULATED CONTACT';
    const disabled=blocked||completed||state.agentStatus!=='available'||!shiftTimeAvailable()||state.currentCall||state.activeOutbound||state.wrapUp||state.digitalActiveId;
    return '<article class="panel v45-campaign-card"><div class="subtle-label">'+escapeHTML(c.type)+'</div><h3>'+escapeHTML(c.title)+'</h3><p class="muted-note">'+escapeHTML(c.context||'Synthetic campaign scenario.')+'</p><div class="data-row"><span>Contact</span><strong>'+escapeHTML(c.customer)+'</strong></div><div class="data-row"><span>Attempts recorded</span><strong>'+attemptCount+'</strong></div><div class="campaign-status '+(blocked?'blocked':'')+'">'+status+'</div><button class="btn '+(disabled?'outline':'primary')+'" style="width:100%;margin-top:12px" data-start-campaign="'+escapeHTML(c.id)+'" '+(disabled?'disabled':'')+'>'+(blocked?'Suppressed':completed?'Completed':'Start simulated contact →')+'</button></article>';
  }).join('');
  const callbackRows=callbacks.length?callbacks.map(item=>{const due=Date.parse(item.dueAt)<=Date.now();const blocked=isContactSuppressed(item.customer,suppressed);return '<div class="case-item"><div class="case-symbol">◷</div><div class="case-copy"><strong>'+escapeHTML(item.customer)+'</strong><small>'+escapeHTML(item.issue||'Customer callback')+' · '+escapeHTML(new Date(item.dueAt).toLocaleString())+'</small></div><button class="btn small secondary" data-action="resume-outbound-callback" data-callback-id="'+escapeHTML(item.id)+'" '+(due&&!blocked&&state.agentStatus==='available'&&shiftTimeAvailable()?'':'disabled')+'>'+(blocked?'Suppressed':due?'Call back':'Scheduled')+'</button></div>';}).join(''):'<p class="muted-note">No outbound callbacks scheduled.</p>';
  const history=attempts.slice(-8).reverse().map(item=>'<div class="timeline-row"><time>'+escapeHTML(new Date(item.createdAt).toLocaleTimeString())+'</time><div><strong>'+escapeHTML(item.customer)+' · '+escapeHTML(item.outcome)+'</strong><small>'+escapeHTML(item.id)+' · '+escapeHTML(item.campaignId)+'</small></div></div>').join('')||'<p class="muted-note">No outbound attempts recorded yet.</p>';
  viewRoot.innerHTML='<section class="panel v45-campaign-header"><div class="panel-head"><div><h3>Outbound campaign operations</h3><p>Run follow-up, service, retention and authorised campaign simulations during an active shift.</p></div><span class="pill green">SHIFT OPERATIONS</span></div><div class="ops-summary-grid">'+metricCard('ATTEMPTS RECORDED',attempts.length,'Completed or dispositioned simulated attempts','↗')+metricCard('SUPPRESSED CONTACTS',suppressed.length,'Do-not-contact preferences retained','⊘')+metricCard('SCHEDULED CALLBACKS',callbacks.length,'Outbound customer follow-ups','◷')+metricCard('CALLBACKS DUE',dueCount,'Eligible for the active agent','✓')+'</div></section><div class="grid three v45-campaign-grid" style="margin-top:14px">'+cards+'</div><div class="grid two" style="margin-top:14px"><section class="panel"><div class="panel-head"><div><h3>Customer callbacks & follow-up</h3><p>Due callbacks can be resumed; future appointments remain blocked until due.</p></div><span class="pill '+(dueCount?'amber':'green')+'">'+dueCount+' DUE</span></div>'+callbackRows+'</section><section class="panel"><div class="panel-head"><div><h3>Recent outbound activity</h3><p>Recorded attempt outcomes and references.</p></div></div>'+history+'</section></div>'+(suppressed.length?'<section class="panel" style="margin-top:14px"><div class="panel-head"><div><h3>Do-not-contact suppression register</h3><p>Suppressed campaign contacts are blocked before the next dial attempt.</p></div><span class="pill amber">'+suppressed.length+' RECORDS</span></div>'+suppressed.map(item=>'<div class="data-row"><span>'+escapeHTML(item.contactKey)+'</span><strong>'+escapeHTML(item.reason)+'</strong></div>').join('')+'</section>':'')+'<p class="muted-note" style="margin-top:14px">All contacts are fictional. Real-world outbound programmes require organisation-approved purpose, lawful contact basis, contact-hour limits, frequency controls and verified suppression lists. CALLORIA does not initiate external calls.</p>';
}
`;

const CSS = String.raw`
.v45-outbound-layout{align-items:start}.v45-outbound-meta{display:flex;flex-wrap:wrap;gap:8px 16px;padding:10px 12px;margin:12px 0;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:10px;background:var(--surface-2,rgba(120,150,170,.06));font-size:12px}.v45-outbound-meta span{display:flex;gap:5px;color:var(--muted,#81909c)}.v45-outbound-meta b{color:var(--text,#e9f1f5)}.v45-transcript{display:flex;flex-direction:column;gap:10px;max-height:min(42dvh,440px);overflow:auto;padding:4px 2px 12px}.v45-message{max-width:min(92%,620px);padding:10px 12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.06));overflow-wrap:anywhere}.v45-message.customer{align-self:flex-start;border-top-left-radius:4px}.v45-message.agent{align-self:flex-end;border-top-right-radius:4px;background:rgba(30,150,135,.12)}.v45-message header{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--muted,#81909c)}.v45-message p{margin:7px 0 0;line-height:1.5;font-size:13px;color:var(--text,#e9f1f5)}.v45-reply-form{margin-top:10px;padding:12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.05))}.v45-reply-form label{display:block;margin-bottom:8px;font-size:10px;font-weight:800;letter-spacing:.1em}.v45-reply-form textarea{display:block;width:100%;min-height:92px;resize:vertical;padding:11px;border:1px solid var(--line,rgba(120,150,170,.25));border-radius:9px;background:var(--surface,rgba(5,20,30,.5));color:var(--text,inherit);font:inherit;box-sizing:border-box}.v45-reply-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:9px}.v45-reply-foot small{max-width:65%;font-size:10px;line-height:1.4;color:var(--muted,#81909c)}.v45-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.v45-policy-list{padding-left:19px;font-size:12px;line-height:1.65;color:var(--muted,#81909c)}.v45-campaign-grid{align-items:stretch}.v45-campaign-card{display:flex;flex-direction:column;min-width:0}.v45-campaign-card button{margin-top:auto!important}.v45-campaign-header{padding:14px}.v45-campaign-header .panel-head{margin-bottom:10px}@media(max-width:760px){.v45-transcript{max-height:34dvh}.v45-message{max-width:96%}.v45-reply-foot{align-items:stretch;flex-direction:column}.v45-reply-foot small{max-width:none}.v45-reply-foot .btn{width:100%;min-height:46px}.v45-actions{display:grid;grid-template-columns:1fr 1fr}.v45-actions .btn{width:100%;font-size:11px}.v45-campaign-grid{grid-template-columns:1fr}.v45-campaign-header .ops-summary-grid{grid-template-columns:1fr 1fr}}
`;

function count(source, needle) { return source.split(needle).length - 1; }
function exactlyOnce(context, source, anchor, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v4.5 skipped the outbound integration safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return false;
  }
  return true;
}
function transformMain(context, input) {
  if (input.includes(MARKER)) return null;
  let code = String(input).replace(/\r\n?/g, '\n');
  const anchors = [
    [V44_IMPORT_ANCHOR, 'v4.4 live inbound engine import'],
    [RENDER_START_ANCHOR, 'outbound renderer start'],
    [RENDER_END_ANCHOR, 'outbound renderer end'],
    [SUBMIT_ANCHOR, 'application submit listener'],
    [ACTION_ANCHOR, 'outbound navigation action'],
    [CASE_RECORD_ANCHOR, 'outbound CRM case record'],
    [ATTEMPT_RECORD_ANCHOR, 'outbound attempt record'],
    [SALES_CREDIT_ANCHOR, 'outbound sales credit rule'],
    [WRAP_UI_ANCHOR, 'outbound wrap-up disposition choices'],
    [WRAP_SAVE_ANCHOR, 'outbound wrap-up validation'],
  ];
  for (const [anchor, label] of anchors) if (!exactlyOnce(context, code, anchor, label)) return null;
  const renderStart = code.indexOf('function renderOutbound() {');
  const renderEnd = code.indexOf('function caseRow(c)', renderStart);
  if (renderStart < 0 || renderEnd < 0 || renderEnd <= renderStart) {
    context.warn('CALLORIA v4.5 skipped safely: outbound renderer boundaries changed.');
    return null;
  }
  code = code.slice(0, renderStart) + `${HELPER}\nfunction renderOutbound(){renderOutboundCampaignDeskV45();}\n` + code.slice(renderEnd);
  code = code.replace(V44_IMPORT_ANCHOR, `${V44_IMPORT_ANCHOR}\nimport { createOutboundConversation, submitOutboundTurn, outboundConversationSummary } from './outbound-campaign-engine.js';`);
  code = code.replace(ACTION_ANCHOR, `${ACTION_ANCHOR}
    case 'play-outbound-customer':{const latest=[...(state.activeOutbound?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}
    case 'request-outbound-supervisor':{const active=state.activeOutbound;if(!active)break;const open=state.supervisorRequests.some(item=>item.contactId===active.attemptId&&item.status==='open');if(!open){const task=outboundCampaigns.find(item=>item.id===active.campaignId);state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:active.attemptId,reference:active.attemptId,customer:task?.customer||'Synthetic customer',reason:'Outbound campaign assistance requested',status:'open',createdAt:new Date().toISOString()});pushOperationEvent('supervisor',active.attemptId,'Agent requested supervisor assistance during outbound contact.','open');saveState();toast('Outbound supervisor assistance requested.','success');}renderView();break;}`);
  const submitHandler = `${SUBMIT_ANCHOR}
  if(e.target.id==='outboundCampaignReplyForm'){
    e.preventDefault();
    const active=state.activeOutbound;
    if(!active||!active.conversation||active.conversation.status!=='active'){toast('There is no active outbound conversation to reply to.','warning');return;}
    try{
      const result=submitOutboundTurn(active.conversation,String(new FormData(e.target).get('reply')||''));
      const summary=outboundConversationSummary(active.conversation);
      active.score=Number(active.score||0)+Number(result.points||0);
      active.breach=summary.criticalBreaches.length>0;
      active.customerDecision=active.conversation.customerDecision||'not_applicable';
      if(result.suppressionRequested){active.suppressionRequested=true;active.disposition='opt_out';}
      else if(result.disposition)active.disposition=result.disposition;
      if(result.criticalBreaches.length)state.incidents+=result.criticalBreaches.length;
      pushOperationEvent('campaign',active.attemptId,'Outbound customer conversation turn recorded · QA '+summary.averageScore+'%',active.breach?'review':'in_progress',{turns:summary.turns,preference:summary.preference,permissionToContinue:summary.permissionToContinue,callbackRequested:summary.callbackRequested,suppressionRequested:summary.suppressionRequested,criticalBreaches:summary.criticalBreaches});
      saveState();renderView();
      if(result.status==='escalated')toast('Outbound compliance issue. Stop the campaign and require supervisor review.','error');
      else if(result.suppressionRequested)toast('Customer do-not-contact request recorded. No further campaign contact is permitted.','warning');
      else if(result.callbackRequested)toast('Customer callback requested. Complete wrap-up and record an agreed future time.','success');
      else if(result.status==='ready_for_wrap_up')toast('Outbound conversation complete. Record the truthful outcome.','success');
    }catch(error){toast(error.message,'warning');}
    return;
  }`;
  code = code.replace(SUBMIT_ANCHOR, submitHandler);
  const caseReplacement = "state.cases.push({reference:wrap.reference,contactId:wrap.contactId,customer:task.customer,title:task.title,channel:'Outbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',conversation:active?.conversation?{...active.conversation,messages:active.conversation.messages.map(item=>({...item})),scorecards:active.conversation.scorecards.map(item=>({...item}))}:null});";
  code = code.replace(CASE_RECORD_ANCHOR, caseReplacement);
  const attemptReplacement = "state.outboundAttempts.push({id:wrap.contactId,customer:task.customer,campaignId:task.id,outcome:status,createdAt,suppressed:disposition==='opt_out',conversation:active?.conversation?{id:active.conversation.id,preference:active.conversation.preference,turns:active.conversation.turn,permissionToContinue:active.conversation.permissionToContinue,customerDecision:active.conversation.customerDecision,callbackRequested:active.conversation.callbackRequested,suppressionRequested:active.conversation.suppressionRequested,criticalBreaches:[...active.conversation.criticalBreaches],messages:active.conversation.messages.map(item=>({...item})),scorecards:active.conversation.scorecards.map(item=>({...item}))}:null});";
  code = code.replace(ATTEMPT_RECORD_ANCHOR, attemptReplacement);
  code = code.replace(SALES_CREDIT_ANCHOR, "if(good&&task.id==='product-offer'&&active.conversation?.customerDecision==='accepted')state.sales++;");
  code = code.replace(WRAP_UI_ANCHOR, ": (wrap.breach ? [['review','Compliance / quality review']] : [['completed','Completed'],['callback','Customer requested callback'],['declined','Customer declined'],...(wrap.defaultDisposition==='review'?[['review','Review required / specialist follow-up']]:[]),...(wrap.suppressionRequested?[['opt_out','Do not contact — suppression required']]:[])]);");
  code = code.replace(WRAP_SAVE_ANCHOR, ": (wrap.breach?['review']:['completed','callback','declined',...(wrap.defaultDisposition==='review'?['review']:[]),...(wrap.suppressionRequested?['opt_out']:[])]);");
  const caseRecordWithReview = `${caseReplacement}\n     if(disposition==='review'){state.supervisorRequests.push({id:makeCallReference('SUP'),contactId:wrap.contactId,reference:wrap.reference,customer:task.customer,reason:'Outbound campaign outcome requires supervisor review',status:'open',createdAt});}`;
  code = code.replace(caseReplacement, caseRecordWithReview);
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}
function transformHtml(html) {
  if (!html.includes('</head>') || html.includes(`${MARKER}-CSS`)) return html;
  return html.replace('</head>', `<style id="${MARKER}-CSS">${CSS}</style>\n</head>`);
}
export function calloriaOutboundCampaignV45Plugin() {
  return {
    name: 'calloria-outbound-campaign-operations-v4-5',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    },
    transformIndexHtml: transformHtml,
  };
}
export const __calloriaV45Test = Object.freeze({
  MARKER, V44_IMPORT_ANCHOR, RENDER_START_ANCHOR, RENDER_END_ANCHOR, SUBMIT_ANCHOR, ACTION_ANCHOR, CASE_RECORD_ANCHOR, ATTEMPT_RECORD_ANCHOR, SALES_CREDIT_ANCHOR, WRAP_UI_ANCHOR, WRAP_SAVE_ANCHOR,
  HELPER, CSS, transformMain, transformHtml,
});
