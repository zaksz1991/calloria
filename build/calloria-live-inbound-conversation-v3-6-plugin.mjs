/** CALLORIA v3.6 — live inbound customer conversation, replacing quiz-like call choices. */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_LIVE_INBOUND_CONVERSATION_V36__';
const IMPORT_ANCHOR = "import { CUSTOMER_PERSONAS, CUSTOMER_ISSUES, createCustomerScenario, submitCustomerTurn, finalizeCustomerScenario, customerIntelligenceMetrics } from './customer-intelligence-engine.js';";
const CALL_START_ANCHOR = '  state.currentCall={scenarioId:scenario.id,queueContactId:contact.id,stepIndex:0,score:0,feedback:null,feedbackType:\'neutral\',breach:false,held:false,startedAt:acceptedAt,waitSeconds};';
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
    return '<article class="v36-message '+(customer?'customer':'agent')+'"><header><strong>'+(customer?escapeHTML(scenario.customer):'YOU · AGENT')+'</strong><time>'+escapeHTML(new Date(message.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))+'</time></header><p>'+escapeHTML(message.text)+'</p></article>';
  }).join('');
  const summary=operationalConversationSummary(conversation);
  const ready=conversation.status==='ready_for_wrap_up'||conversation.status==='escalated';
  const latestCustomer=[...conversation.messages].reverse().find(item=>item.speaker==='customer');
  return '<div class="call-layout v36-call-layout"><section class="panel call-console"><div class="call-console-head"><div><strong>LIVE INBOUND CUSTOMER CALL</strong><small>'+escapeHTML(scenario.category)+' · '+escapeHTML(scenario.reference)+' · '+escapeHTML(conversation.persona.label)+'</small></div><span class="pill '+(call.held?'amber':ready?'green':'green')+'">'+(call.held?'ON HOLD':ready?'READY FOR WRAP-UP':'CONNECTED')+'</span></div><div class="call-console-body"><div class="customer-strip"><div class="customer-avatar">'+escapeHTML(scenario.initials)+'</div><div class="customer-info"><strong>'+escapeHTML(scenario.customer)+'</strong><small>'+escapeHTML(scenario.profile)+'</small></div><div class="customer-tags"><span class="pill">'+escapeHTML(scenario.tag)+'</span><span class="pill amber">'+escapeHTML(scenario.amount)+'</span></div></div><div class="v36-live-meta"><span>Customer patience <b>'+Math.round(conversation.patience)+'%</b></span><span>Conversation turns <b>'+summary.turns+'</b></span><span>Current interaction QA <b>'+summary.averageScore+'%</b></span></div><section class="v36-transcript" aria-label="Customer and agent conversation">'+transcript+'</section>'+(call.held?'<div class="call-feedback neutral"><strong>Customer is on hold.</strong> Resume the call before responding.</div>':ready?'<div class="call-feedback '+(conversation.status==='escalated'?'bad':'good')+'"><strong>'+(conversation.status==='escalated'?'Supervisor / compliance review required.':'Customer conversation ready for after-contact work.')+'</strong><p>'+escapeHTML(conversation.branch.replaceAll('_',' '))+'</p><small>Complete CRM notes and select the truthful disposition before saving.</small></div>':'<form id="operationalCallReplyForm" class="v36-reply-form"><label for="v36AgentReply">YOUR RESPONSE TO THE CUSTOMER</label><textarea id="v36AgentReply" name="reply" rows="3" minlength="12" maxlength="1200" required placeholder="Respond naturally. Acknowledge the customer, take ownership, ask relevant questions and explain the verified next step."></textarea><div class="v36-reply-foot"><small>Customer dialogue is synthetic and follows deterministic persona branches. Never request PINs, passwords, OTPs or full card details.</small><button class="btn primary" type="submit">Send response →</button></div></form>')+'<div class="v36-call-actions"><button class="btn outline" data-action="play-active-customer" '+(latestCustomer?'':'disabled')+'>Play customer voice</button><button class="btn outline" data-action="open-crm">Open CRM</button><button class="btn outline" data-action="open-knowledge">Knowledge base</button>'+(ready?'<button class="btn primary" data-action="complete-call">Proceed to after-contact work</button>':'')+'</div></div></section><aside class="call-side-stack"><section class="panel"><div class="panel-head"><div><h3>Customer 360 · CRM</h3><p>Synthetic customer record linked to this call.</p></div><span class="pill">CRM</span></div><div class="data-list"><div class="data-row"><span>Customer</span><strong>'+escapeHTML(scenario.customer)+'</strong></div><div class="data-row"><span>Case / transaction ref</span><strong>'+escapeHTML(scenario.reference)+'</strong></div><div class="data-row"><span>Reported issue</span><strong>'+escapeHTML(scenario.issue)+'</strong></div><div class="data-row"><span>Location</span><strong>'+escapeHTML(scenario.location)+'</strong></div><div class="data-row"><span>Queue route</span><strong>'+(contact?escapeHTML(contact.routeGroup):'General')+'</strong></div><div class="data-row"><span>Queue wait</span><strong>'+formatWait(call.waitSeconds||0)+'</strong></div><div class="data-row"><span>Interaction branch</span><strong>'+escapeHTML(conversation.branch.replaceAll('_',' '))+'</strong></div></div></section><section class="panel"><div class="panel-head"><div><h3>Supervisor & call controls</h3><p>Operational contact lifecycle.</p></div></div><div class="ops-control-stack"><button class="btn outline" data-action="toggle-call-hold">'+(call.held?'Resume customer':'Place on hold')+'</button><button class="btn outline" data-action="request-supervisor" '+(supervisorOpen?'disabled':'')+'>'+(supervisorOpen?'Supervisor requested':'Request supervisor assistance')+'</button><label class="subtle-label" for="transferTarget">TRANSFER DESTINATION</label><select id="transferTarget"><option>Specialist Support</option><option>Fraud & Security</option><option>Cards & Payments</option><option>Technical Support</option><option>Complaints Management</option></select><button class="btn secondary" data-action="transfer-call" '+(call.held?'disabled':'')+'>Transfer to specialist</button><button class="btn outline" data-action="return-call-to-queue">Return contact to queue</button></div><p class="muted-note" style="margin-top:12px">The active conversation, hold events, transfers, CRM record and wrap-up remain part of the simulated shift record.</p></section></aside></div>';
}
`;

const CSS = String.raw`
.v36-call-layout{align-items:start}.v36-live-meta{display:flex;flex-wrap:wrap;gap:8px 16px;padding:10px 12px;margin:12px 0;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:10px;background:var(--surface-2,rgba(120,150,170,.06));font-size:12px}.v36-live-meta span{display:flex;gap:5px;color:var(--muted,#81909c)}.v36-live-meta b{color:var(--text,#e9f1f5)}.v36-transcript{display:flex;flex-direction:column;gap:10px;max-height:min(42dvh,440px);overflow:auto;padding:4px 2px 12px;scroll-behavior:smooth}.v36-message{max-width:min(90%,620px);padding:10px 12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.06));overflow-wrap:anywhere}.v36-message.customer{align-self:flex-start;border-top-left-radius:4px}.v36-message.agent{align-self:flex-end;border-top-right-radius:4px;background:rgba(30,150,135,.12)}.v36-message header{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:var(--muted,#81909c)}.v36-message p{margin:7px 0 0;line-height:1.5;font-size:13px;color:var(--text,#e9f1f5)}.v36-reply-form{margin-top:10px;padding:12px;border:1px solid var(--line,rgba(120,150,170,.2));border-radius:12px;background:var(--surface-2,rgba(120,150,170,.05))}.v36-reply-form label{display:block;margin-bottom:8px;font-size:10px;font-weight:800;letter-spacing:.1em}.v36-reply-form textarea{display:block;width:100%;min-height:88px;resize:vertical;padding:11px;border:1px solid var(--line,rgba(120,150,170,.25));border-radius:9px;background:var(--surface,rgba(5,20,30,.5));color:var(--text,inherit);font:inherit;box-sizing:border-box}.v36-reply-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:9px}.v36-reply-foot small{max-width:65%;font-size:10px;line-height:1.4;color:var(--muted,#81909c)}.v36-call-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.v36-call-actions .btn{min-height:38px}@media(max-width:760px){.v36-transcript{max-height:34dvh}.v36-message{max-width:96%}.v36-reply-foot{align-items:stretch;flex-direction:column}.v36-reply-foot small{max-width:none}.v36-reply-foot .btn{width:100%;min-height:44px}.v36-call-actions{display:grid;grid-template-columns:1fr 1fr}.v36-call-actions .btn{width:100%;font-size:11px}}
`;

function count(source, needle) { return source.split(needle).length - 1; }
function exactlyOnce(context, source, anchor, label) {
  const found = count(source, anchor);
  if (found !== 1) context.error(`CALLORIA v3.6 expected exactly one ${label} anchor; found ${found}. No partial transform applied.`);
}
function transformMain(context, input) {
  if (input.includes(MARKER)) return null;
  let code = String(input).replace(/\r\n?/g, '\n');
  exactlyOnce(context, code, IMPORT_ANCHOR, 'customer-intelligence import');
  exactlyOnce(context, code, CALL_START_ANCHOR, 'inbound call creation');
  exactlyOnce(context, code, SUBMIT_ANCHOR, 'submit listener');
  exactlyOnce(context, code, ACTION_ANCHOR, 'inbound call action');
  exactlyOnce(context, code, DEFAULT_DISPOSITION_ANCHOR, 'inbound wrap-up disposition');
  exactlyOnce(context, code, CASE_RECORD_ANCHOR, 'inbound CRM case record');
  const renderStart = code.indexOf('function renderInbound() {');
  const digitalStart = code.indexOf('function ensureDigitalQueue(', renderStart);
  if (renderStart < 0 || digitalStart < 0) context.error('CALLORIA v3.6 could not locate the inbound renderer boundaries.');
  const renderBlock = code.slice(renderStart, digitalStart);
  const assignmentStart = renderBlock.indexOf('  viewRoot.innerHTML = `<div class="call-layout">');
  const assignmentEnd = renderBlock.lastIndexOf('`;');
  if (assignmentStart < 0 || assignmentEnd <= assignmentStart) context.error('CALLORIA v3.6 could not locate the existing inbound call workspace template.');
  const absoluteStart = renderStart + assignmentStart;
  const absoluteEnd = renderStart + assignmentEnd + 2;
  const replacement = '  viewRoot.innerHTML = renderOperationalInboundCall(call,scenario,contact,supervisorOpen);';
  code = code.slice(0, absoluteStart) + replacement + code.slice(absoluteEnd);
  code = code.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport { createOperationalConversation, submitOperationalTurn, operationalConversationSummary } from './operational-conversation-engine.js';`);
  const helperAnchor = 'function renderInbound() {';
  code = code.replace(helperAnchor, `${HELPER}\n${helperAnchor}`);
  code = code.replace(CALL_START_ANCHOR, `${CALL_START_ANCHOR}\n  state.currentCall.conversation=createOperationalConversation({id:contact.id,scenario,seed:acceptedAt});`);
  code = code.replace(ACTION_ANCHOR, `${ACTION_ANCHOR}\n    case 'play-active-customer':{const latest=[...(state.currentCall?.conversation?.messages||[])].reverse().find(item=>item.speaker==='customer');if(latest)speakCustomerPrompt(latest.text);break;}`);
  code = code.replace(DEFAULT_DISPOSITION_ANCHOR, "defaultDisposition:transferred||call.breach||call.conversation?.dispositionHint==='escalated'?'escalated':'resolved'");
  code = code.replace(CASE_RECORD_ANCHOR, "conversation:state.currentCall?.conversation?{...state.currentCall.conversation,messages:state.currentCall.conversation.messages.map(item=>({...item})),scorecards:state.currentCall.conversation.scorecards.map(item=>({...item}))}:null,timeline:contact.timeline.slice()};");
  code = code.replace(SUBMIT_ANCHOR, `${SUBMIT_ANCHOR}\n  if(e.target.id==='operationalCallReplyForm'){\n    e.preventDefault();\n    const active=state.currentCall;\n    const contact=active?findQueueContact(active.queueContactId):null;\n    if(!active||!contact||active.held){toast('Resume the active inbound customer call before responding.','warning');return;}\n    try{\n      const result=submitOperationalTurn(active.conversation,String(new FormData(e.target).get('reply')||''));\n      const summary=operationalConversationSummary(active.conversation);\n      if(result.evaluation.criticalBreaches.length)state.incidents+=result.evaluation.criticalBreaches.length;\n      active.score=Math.round((summary.averageScore-70)/5);\n      active.breach=summary.criticalBreaches.length>0;\n      addCallTimeline(active,'Agent sent a live customer response.',{turn:summary.turns,qaScore:summary.averageScore,customerReaction:result.customerReaction,branch:result.branch,criticalBreaches:summary.criticalBreaches});\n      pushOperationEvent('call',contact.id,\`Customer conversation turn recorded · QA \${summary.averageScore}%\`,active.breach?'review':'in_progress',{turn:summary.turns,branch:result.branch,qaScore:summary.averageScore});\n      saveState();renderView();\n      if(result.status==='escalated')toast('Critical compliance issue. Supervisor review is required.','error');\n      else if(result.status==='ready_for_wrap_up')toast('Customer conversation completed. Record the case disposition and notes.','success');\n    }catch(error){toast(error.message,'warning');}\n    return;\n  }`);
  code = `/* ${MARKER} */\n${code}`;
  return { code, map: null };
}
function transformHtml(html) {
  if (!html.includes('</head>') || html.includes(`${MARKER}-CSS`)) return html;
  return html.replace('</head>', `<style id="${MARKER}-CSS">${CSS}</style>\n</head>`);
}
export function calloriaLiveInboundConversationV36Plugin() {
  return {
    name: 'calloria-live-inbound-conversation-v3-6',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    },
    transformIndexHtml: transformHtml
  };
}
export const __calloriaV36Test = Object.freeze({ MARKER, IMPORT_ANCHOR, CALL_START_ANCHOR, SUBMIT_ANCHOR, ACTION_ANCHOR, DEFAULT_DISPOSITION_ANCHOR, CASE_RECORD_ANCHOR, HELPER, CSS, transformMain, transformHtml });
