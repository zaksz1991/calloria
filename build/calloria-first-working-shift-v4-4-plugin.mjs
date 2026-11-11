/** CALLORIA v4.4 — replace quiz-like inbound choices with live simulated work. */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_FIRST_INDEPENDENT_SHIFT_V44__';
const IMPORT_ANCHOR = "import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';";
const CALL_START_ANCHOR = "  state.currentCall={scenarioId:scenario.id,queueContactId:contact.id,stepIndex:0,score:0,feedback:null,feedbackType:'neutral',breach:false,held:false,startedAt:acceptedAt,waitSeconds};";
const SUBMIT_ANCHOR = "document.addEventListener('submit',async e=>{";
const ACTION_ANCHOR = "    case 'answer-call':startInboundCall();break;";
const DEFAULT_DISPOSITION_ANCHOR = "defaultDisposition:transferred||call.breach?'escalated':'resolved'";
const CASE_RECORD_ANCHOR = 'timeline:contact.timeline.slice()};';

const HELPER = String.raw`
function renderOperationalInboundCall(call,scenario,contact,supervisorOpen){
  if(!call.conversation||call.conversation.type!=='live_inbound_customer_service'){
    call.conversation=createOperationalConversation({id:call.queueContactId,scenario,seed:call.startedAt||Date.now()});
    saveState();
  }
  const conversation=call.conversation;
  const transcript=conversation.messages.map(message=>{
    const customer=message.speaker==='customer';
    return '<article class="v44-message '+(customer?'customer':'agent')+'"><header><strong>'+(customer?escapeHTML(scenario.customer):'YOU · AGENT')+'</strong><time>'+escapeHTML(new Date(message.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))+'</time></header><p>'+escapeHTML(message.text)+'</p></article>';
  }).join('');
  const summary=operationalConversationSummary(conversation);
  const ready=conversation.status==='ready_for_wrap_up'||conversation.status==='escalated';
  const latestCustomer=[...conversation.messages].reverse().find(item=>item.speaker==='customer');
  const customerReaction=conversation.status==='escalated'?'SUPERVISOR REVIEW':conversation.patience<35?'CUSTOMER PATIENCE LOW':conversation.patience>70?'CUSTOMER CALM':'CUSTOMER WAITING';
  return '<div class="call-layout v44-call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>LIVE INBOUND CUSTOMER WORK</strong><small>'+escapeHTML(scenario.category)+' · '+escapeHTML(scenario.reference)+' · '+escapeHTML(conversation.persona.label)+'</small></div><span class="pill '+(call.held?'amber':ready?'green':'green')+'">'+(call.held?'ON HOLD':ready?'READY FOR WRAP-UP':'CONNECTED')+'</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">'+escapeHTML(scenario.initials)+'</div><div class="customer-info"><strong>'+escapeHTML(scenario.customer)+'</strong><small>'+escapeHTML(scenario.profile)+'</small></div><div class="customer-tags"><span class="pill">'+escapeHTML(scenario.tag)+'</span></div></div><div class="v44-live-meta"><span>Customer patience <b>'+Math.round(conversation.patience)+'%</b></span><span>Turns <b>'+summary.turns+'</b></span><span>Interaction QA <b>'+(summary.turns?summary.averageScore+'%':'PENDING')+'</b></span><span>'+customerReaction+'</span></div><section class="v44-transcript" aria-label="Customer and agent conversation">'+transcript+'</section>'+(call.held?'<div class="call-feedback neutral"><strong>Customer is on hold.</strong> Resume the conversation before responding.</div>':ready?'<div class="call-feedback '+(conversation.status==='escalated'?'bad':'good')+'"><strong>'+(conversation.status==='escalated'?'Supervisor / compliance review required.':'Customer conversation ready for after-contact work.')+'</strong><p>'+escapeHTML(conversation.branch.replaceAll('_',' '))+'</p><small>Complete factual CRM notes and select the truthful disposition before saving.</small></div>':'<form id="operationalCallReplyForm" class="v44-reply-form"><label for="v44AgentReply">YOUR RESPONSE TO THE CUSTOMER</label><textarea id="v44AgentReply" name="reply" rows="3" minlength="12" maxlength="1200" required placeholder="Respond in your own words. Acknowledge the issue, take ownership, ask relevant questions and explain the verified next step."></textarea><div class="v44-reply-foot"><small>Live shift interaction · synthetic customer · rule-based persona reactions. Never request PINs, passwords, OTPs or full payment-card details.</small><button class="btn primary" type="submit">Send response →</button></div></form>')+'<div class="v44-call-actions"><button class="btn outline" data-action="play-active-customer" '+(latestCustomer?'':'disabled')+'>Play customer voice</button><button class="btn outline" data-action="open-crm">Open CRM</button><button class="btn outline" data-action="open-knowledge">Knowledge base</button>'+(ready?'<button class="btn primary" data-action="complete-call">Proceed to after-contact work</button>':'')+'</div></div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Customer 360 · CRM</h3><p>Operational customer record linked to this interaction.</p></div><span class="pill">CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>'+escapeHTML(scenario.customer)+'</strong></div><div class="data-row"><span>Case / service reference</span><strong>'+escapeHTML(scenario.reference)+'</strong></div><div class="data-row"><span>Reported issue</span><strong>'+escapeHTML(scenario.issue)+'</strong></div><div class="data-row"><span>Location</span><strong>'+escapeHTML(scenario.location||'Not supplied')+'</strong></div><div class="data-row"><span>Queue route</span><strong>'+(contact?escapeHTML(contact.routeGroup):'General Customer Care')+'</strong></div><div class="data-row"><span>Queue wait</span><strong>'+formatWait(call.waitSeconds||0)+'</strong></div><div class="data-row"><span>Conversation branch</span><strong>'+escapeHTML(conversation.branch.replaceAll('_',' '))+'</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Supervisor & call controls</h3><p>Operational contact lifecycle.</p></div></div><div class="ops-control-stack"><button class="btn outline" data-action="toggle-call-hold">'+(call.held?'Resume customer':'Place on hold')+'</button><button class="btn outline" data-action="request-supervisor" '+(supervisorOpen?'disabled':'')+'>'+(supervisorOpen?'Supervisor requested':'Request supervisor assistance')+'</button><label class="subtle-label" for="transferTarget">TRANSFER DESTINATION</label><select id="transferTarget"><option>Specialist Support</option><option>Technical Support</option><option>Complaints Management</option><option>Orders & Fulfilment</option><option>Fraud & Security</option><option>Payments Specialist</option></select><button class="btn secondary" data-action="transfer-call" '+(call.held?'disabled':'')+'>Transfer to specialist</button><button class="btn outline" data-action="return-call-to-queue">Return contact to queue</button></div><p class="muted-note" style="margin-top:12px">Hold, transfer, supervisor assistance, CRM notes, wrap-up and case history remain part of this simulated shift record.</p></section></aside></div>';
}
`;

const CSS = String.raw`
.v44-call-layout{align-items:start}.v44-live-meta{display:flex;flex-wrap:wrap;gap:8px 16px;padding:10px 12px;margin:12px 0;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:10px;background:var(--surface-2,rgba(120,150,170,.06));font-size:12px}.v44-live-meta span{display:flex;gap:5px;color:var(--muted,#81909c)}.v44-live-meta b{color:var(--text,#e9f1f5)}.v44-transcript{display:flex;flex-direction:column;gap:10px;max-height:min(44dvh,460px);overflow:auto;padding:4px 2px 12px;scroll-behavior:smooth}.v44-message{max-width:min(90%,620px);padding:10px 12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.06));overflow-wrap:anywhere}.v44-message.customer{align-self:flex-start;border-top-left-radius:4px}.v44-message.agent{align-self:flex-end;border-top-right-radius:4px;background:rgba(30,150,135,.12)}.v44-message header{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--muted,#81909c)}.v44-message p{margin:7px 0 0;line-height:1.5;font-size:13px;color:var(--text,#e9f1f5)}.v44-reply-form{margin-top:10px;padding:12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.05))}.v44-reply-form label{display:block;margin-bottom:8px;font-size:10px;font-weight:800;letter-spacing:.1em}.v44-reply-form textarea{display:block;width:100%;min-height:92px;resize:vertical;padding:11px;border:1px solid var(--line,rgba(120,150,170,.25));border-radius:9px;background:var(--surface,rgba(5,20,30,.5));color:var(--text,inherit);font:inherit;box-sizing:border-box}.v44-reply-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:9px}.v44-reply-foot small{max-width:65%;font-size:10px;line-height:1.4;color:var(--muted,#81909c)}.v44-call-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.v44-call-actions .btn{min-height:40px}@media(max-width:760px){.v44-transcript{max-height:36dvh}.v44-message{max-width:96%}.v44-reply-foot{align-items:stretch;flex-direction:column}.v44-reply-foot small{max-width:none}.v44-reply-foot .btn{width:100%;min-height:46px}.v44-call-actions{display:grid;grid-template-columns:1fr 1fr}.v44-call-actions .btn{width:100%;font-size:11px}}
`;

function count(source, needle) { return source.split(needle).length - 1; }
function exactlyOnce(context, source, anchor, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v4.4 skipped the live inbound integration safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return false;
  }
  return true;
}
function transformMain(context, input) {
  if (input.includes(MARKER)) return null;
  let code = String(input).replace(/\r\n?/g, '\n');
  const anchors = [
    [IMPORT_ANCHOR, 'customer-intelligence import'],
    [CALL_START_ANCHOR, 'inbound contact creation'],
    [SUBMIT_ANCHOR, 'application submit listener'],
    [ACTION_ANCHOR, 'inbound acceptance action'],
    [DEFAULT_DISPOSITION_ANCHOR, 'inbound wrap-up disposition'],
    [CASE_RECORD_ANCHOR, 'inbound CRM case record']
  ];
  for (const [anchor, label] of anchors) if (!exactlyOnce(context, code, anchor, label)) return null;

  const renderStart = code.indexOf('function renderInbound() {');
  const digitalStart = code.indexOf('function ensureDigitalQueue(', renderStart);
  if (renderStart < 0 || digitalStart < 0) {
    context.warn('CALLORIA v4.4 skipped safely: inbound renderer boundaries changed.');
    return null;
  }
  const renderBlock = code.slice(renderStart, digitalStart);
  const assignmentStart = renderBlock.indexOf('  viewRoot.innerHTML = `<div class="call-layout">');
  const assignmentEnd = renderBlock.lastIndexOf('`;');
  if (assignmentStart < 0 || assignmentEnd <= assignmentStart) {
    context.warn('CALLORIA v4.4 skipped safely: inbound call workspace template changed.');
    return null;
  }
  const absoluteStart = renderStart + assignmentStart;
  const absoluteEnd = renderStart + assignmentEnd + 2;
  code = code.slice(0, absoluteStart) + '  viewRoot.innerHTML = renderOperationalInboundCall(call,scenario,contact,supervisorOpen);' + code.slice(absoluteEnd);
  code = code.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport { createOperationalConversation, submitOperationalTurn, operationalConversationSummary } from './operational-conversation-engine.js';`);
  code = code.replace('function renderInbound() {', `${HELPER}\nfunction renderInbound() {`);
  code = code.replace(CALL_START_ANCHOR, `${CALL_START_ANCHOR}\n  state.currentCall.conversation=createOperationalConversation({id:contact.id,scenario,seed:acceptedAt});`);
  code = code.replace(ACTION_ANCHOR, `${ACTION_ANCHOR}\n    case 'play-active-customer':{const latest=[...(state.currentCall?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}`);
  code = code.replace(DEFAULT_DISPOSITION_ANCHOR, "defaultDisposition:transferred||call.breach||call.conversation?.dispositionHint==='escalated'?'escalated':'resolved'");
  // If the dialogue engine marked the interaction unresolved, wrap-up must not
  // offer a false-resolved option. Enforce the same restriction in the UI and save path.
  const uiEscalationAnchor = '((wrap.breach || wrap.transferred)';
  const saveEscalationAnchor = '((wrap.breach||wrap.transferred)';
  if (count(code, uiEscalationAnchor) === 1) code = code.replace(uiEscalationAnchor, "((wrap.breach || wrap.transferred || wrap.defaultDisposition==='escalated')");
  else context.warn('CALLORIA v4.4 could not find the wrap-up disposition UI guard; verify wrap-up choices manually.');
  if (count(code, saveEscalationAnchor) === 1) code = code.replace(saveEscalationAnchor, "((wrap.breach||wrap.transferred||wrap.defaultDisposition==='escalated')");
  else context.warn('CALLORIA v4.4 could not find the wrap-up save guard; verify disposition validation manually.');
  code = code.replace(CASE_RECORD_ANCHOR, "conversation:state.currentCall?.conversation?{...state.currentCall.conversation,messages:state.currentCall.conversation.messages.map(item=>({type:item.speaker,text:item.text,at:item.at})),scorecards:state.currentCall.conversation.scorecards.map(item=>({...item}))}:null,timeline:contact.timeline.slice()};");

  const submitHandler = `${SUBMIT_ANCHOR}
  if(e.target.id==='operationalCallReplyForm'){
    e.preventDefault();
    const active=state.currentCall;
    const contact=active?findQueueContact(active.queueContactId):null;
    if(!active||!contact||active.held){toast('Resume the active inbound customer call before responding.','warning');return;}
    try{
      const result=submitOperationalTurn(active.conversation,String(new FormData(e.target).get('reply')||''));
      const summary=operationalConversationSummary(active.conversation);
      if(result.evaluation.criticalBreaches.length)state.incidents+=result.evaluation.criticalBreaches.length;
      active.operationalQa=summary.averageScore;
      active.breach=summary.criticalBreaches.length>0;
      addCallTimeline(active,'Agent sent a live customer response.',{turn:summary.turns,qaScore:summary.averageScore,customerReaction:result.customerReaction,branch:result.branch,criticalBreaches:summary.criticalBreaches});
      pushOperationEvent('call',contact.id,'Customer conversation turn recorded · QA '+summary.averageScore+'%',active.breach?'review':'in_progress',{turn:summary.turns,branch:result.branch,qaScore:summary.averageScore});
      saveState();renderView();
      if(result.status==='escalated')toast('Critical compliance issue. Supervisor review is required.','error');
      else if(result.status==='ready_for_wrap_up')toast('Customer conversation completed. Record factual notes and the final disposition.','success');
    }catch(error){toast(error.message,'warning');}
    return;
  }`;
  code = code.replace(SUBMIT_ANCHOR, submitHandler);
  const oldQa = 'const qa=Math.max(0,Math.min(100,Math.round(70+call.score*5-(call.breach?35:0))));';
  if (count(code, oldQa) === 1) {
    code = code.replace(oldQa, 'const qa=Number.isFinite(call.operationalQa)?Math.max(0,Math.min(100,Math.round(call.operationalQa))):Math.max(0,Math.min(100,Math.round(70+call.score*5-(call.breach?35:0))));');
  } else {
    context.warn('CALLORIA v4.4 could not find the single inbound QA calculation; live conversation will use the existing QA calculation.');
  }
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

function transformHtml(html) {
  if (!html.includes('</head>') || html.includes(`${MARKER}-CSS`)) return html;
  return html.replace('</head>', `<style id="${MARKER}-CSS">${CSS}</style>\n</head>`);
}

export function calloriaFirstWorkingShiftV44Plugin() {
  return {
    name: 'calloria-first-independent-shift-v4-4',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    },
    transformIndexHtml: transformHtml
  };
}

export const __calloriaV44Test = Object.freeze({
  MARKER, IMPORT_ANCHOR, CALL_START_ANCHOR, SUBMIT_ANCHOR, ACTION_ANCHOR,
  DEFAULT_DISPOSITION_ANCHOR, CASE_RECORD_ANCHOR, HELPER, CSS,
  transformMain, transformHtml
});
