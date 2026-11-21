/**
 * CALLORIA v6.86 — re-based RuffNeck service operations integration.
 *
 * Replaces the stale v6.51–v6.54 main.js transform chain with one source-aware
 * plugin. The existing v6.51 catalogue remains the source of service content.
 * All customer references and case records created here are synthetic/local.
 */
import { PLATFORM_SUPPORT_CATALOG_V651 } from './calloria-ruffneck-platform-support-v6-51.mjs';

const MAIN_TARGET = '/js/main.js';
const WORKFORCE_TARGET = '/js/workforce-engine.js';
const MAIN_MARKER = '__CALLORIA_RUFFNECK_SERVICE_OPERATIONS_V686__';
const WORKFORCE_MARKER = '__CALLORIA_RUFFNECK_SYSTEMS_V686__';
const SYSTEMS_START = 'export const SYSTEMS = [';
const TRACK_ANCHOR = "selectedTrack: 'banking',";
const DEPARTMENT_ANCHOR = "department: 'Banking Operations',";
const ROLE_TITLE_ANCHOR = "roleTitle: 'Customer Experience Associate',";
const SALARY_ANCHOR = 'salary: 185000,';
const MIGRATION_ANCHOR = 'const migrated = { ...initialState(), ...parsed };';
const WORKFORCE_RENDER_ANCHOR = 'function renderWorkforce() {';
const WORKFORCE_INSERT_ANCHOR = '</div>\n         <h4 style="margin-top:16px">System activity</h4>';
const SYSTEM_LAUNCH_GUARD = 'if(!system)break;';
const CLICK_TEMPLATE_ANCHOR = "  const template=e.target.closest('[data-digital-template]');";
const CRM_QA_ANCHOR = '<td>${Number(c.qa)||0}%</td>';
const CRM_ISSUE_ANCHOR = '<p><strong>Issue:</strong> ${escapeHTML(c.title)}</p>';
const SYSTEM_EVENT_ANCHOR = 'state.systemEvents.slice(-8)';
const BANKING_ONLY_SANDBOX_COPY = 'Connected workflow practice using synthetic records only. No real banking systems or transactions.';

const SYSTEMS_V686 = [
  { id: 'icc', name: 'ICC', purpose: 'Interaction control, queue events and customer satisfaction' },
  { id: 'crm', name: 'CRM', purpose: 'Customer profile, interaction history and cases' },
  { id: 'firstmobile', name: 'FirstMobile', purpose: 'Optional banking-industry digital banking support scenarios' },
  { id: 'ussd', name: 'USSD', purpose: 'Optional banking-industry short-code support scenarios' },
  { id: 'postilion', name: 'Postilion', purpose: 'Optional card and payment-switching investigation scenarios' },
  { id: 'jira', name: 'JIRA', purpose: 'Technical incidents and service requests' },
  { id: 'fcqa', name: 'FCQA', purpose: 'Quality evaluation and interaction review' },
  { id: 'ruffneck-lms', name: 'RuffNeck LMS', purpose: 'Learning content, learner access, course progress and training support' },
  { id: 'ruffneck-prospector', name: 'RuffNeck Prospector', purpose: 'Prospect research, lead discovery, qualification and follow-up' },
  { id: 'ruffneck-connect', name: 'RuffNeck Connect', purpose: 'Messaging, communication workflows and delivery support' },
  { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub', purpose: 'Social account connections, publishing, campaigns and analytics support' },
  { id: 'kano-run', name: 'Kano Run', purpose: 'Player access, gameplay controls, progress and game-session support' },
  { id: 'kano-keke', name: 'Kano Keke', purpose: 'Keke-driving gameplay, control configuration and player-session support' },
];

const TEAM_BY_PLATFORM = Object.freeze({
  'ruffneck-lms': 'Learning Platform Support',
  'ruffneck-prospector': 'Business Tools Support',
  'ruffneck-connect': 'Connectivity Support',
  'ruffneck-social-hub': 'Social & Community Support',
  'kano-run': 'Kano Run Game Support',
  'kano-keke': 'Kano Keke Game Support',
});
const PRIORITY_SLA_MINUTES = Object.freeze({ low: 2880, normal: 1440, high: 120, critical: 30 });

function count(source, anchor) {
  return String(source).split(anchor).length - 1;
}

function replaceExactlyOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.error(`CALLORIA v6.86 expected one ${label} anchor; found ${found}. No partial source transform was applied.`);
  }
  return source.replace(anchor, replacement);
}

export function redactSupportCaseTextV686(value) {
  return String(value ?? '')
    .slice(0, 1400)
    .replace(/\b(pin|password|passcode|otp|one[\s-]?time code|security code)\b(\s*(?:is|:|=)?\s*)([^\s,;]+)/gi, (_m, label, separator) => `${label}${separator}[REDACTED]`)
    .replace(/\b(?:\d[ -]?){12,19}\b/g, '[REDACTED NUMBER]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/(?<![\w])\+?\d[\d\s().-]{8,}\d(?![\w])/g, '[REDACTED PHONE]')
    .trim();
}

export function createSupportCaseV686(input, now = Date.now(), catalog = PLATFORM_SUPPORT_CATALOG_V651) {
  const value = input && typeof input === 'object' ? input : {};
  const platformId = String(value.platformId || '');
  const guide = catalog?.[platformId];
  if (!guide) throw new TypeError('Select a supported RuffNeck service.');
  const requestType = String(value.requestType || '').trim();
  if (!guide.requests?.includes(requestType)) throw new TypeError('Select a request type listed for the chosen service.');
  const customerReference = String(value.customerReference || '').trim().toUpperCase();
  if (!/^CUS-SIM-[A-Z0-9-]{2,28}$/.test(customerReference)) {
    throw new TypeError('Use a synthetic reference such as CUS-SIM-001.');
  }
  const priority = String(value.priority || 'normal').toLowerCase();
  if (!Object.hasOwn(PRIORITY_SLA_MINUTES, priority)) throw new TypeError('Select a valid support priority.');
  const details = redactSupportCaseTextV686(value.details);
  if (details.length < 12) throw new TypeError('Enter at least 12 characters describing the issue and checks already performed.');
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const sequence = Math.max(1, Math.floor(Number(value.sequence) || 1));
  const createdAt = new Date(timestamp).toISOString();
  const slaMinutes = PRIORITY_SLA_MINUTES[priority];
  const status = priority === 'critical' ? 'Escalated' : 'Open';
  const customerName = String(value.customerName || `Customer ${customerReference.slice(-3)}`).trim().slice(0, 48);
  const team = TEAM_BY_PLATFORM[platformId] || 'RuffNeck Product Support';
  const owner = String(value.owner || 'Agent').trim().slice(0, 48) || 'Agent';
  const reference = `RNS-${timestamp.toString(36).toUpperCase()}-${String(sequence).padStart(3, '0')}`;
  return {
    id: `RNS-ID-${timestamp.toString(36).toUpperCase()}-${sequence}`,
    reference,
    platformId,
    platformName: guide.name,
    customerReference,
    customerName,
    customer: `${customerName} (${customerReference})`,
    requestType,
    title: requestType,
    priority,
    details,
    notes: details,
    status,
    disposition: status.toLowerCase().replaceAll(' ', '_'),
    owner,
    assignedTo: owner,
    team,
    channel: 'Platform Support',
    qa: null,
    qaEligible: false,
    slaMinutes,
    slaDueAt: new Date(timestamp + slaMinutes * 60_000).toISOString(),
    createdAt,
    updatedAt: createdAt,
    resolvedAt: null,
    escalationReason: priority === 'critical' ? 'Critical-priority request requires specialist review.' : '',
    assignmentHistory: [{ owner, team, recordedAt: createdAt, actor: owner }],
    history: [{ status, note: 'Support case opened from the Workforce service directory.', recordedAt: createdAt }],
    messages: [],
    source: 'calloria-ruffneck-service-operations-v686',
  };
}

export function scoreSupportScenarioV686(platformId, optionId, catalog = PLATFORM_SUPPORT_CATALOG_V651) {
  const platform = catalog?.[String(platformId || '')];
  if (!platform?.scenario) return null;
  const option = platform.scenario.options?.find(item => item.id === String(optionId || ''));
  if (!option) return null;
  return {
    platformId,
    platformName: platform.name,
    scenarioId: platform.scenario.id,
    optionId: option.id,
    score: Number(option.score) || 0,
    feedback: String(option.feedback || ''),
    correct: Number(option.score) >= 100,
  };
}

export function updateSupportCaseV686(record, input, now = Date.now()) {
  if (!record || typeof record !== 'object' || !record.reference) throw new TypeError('The selected support case is unavailable.');
  const value = input && typeof input === 'object' ? input : {};
  const status = String(value.status || '');
  if (!['Open', 'In Progress', 'Escalated', 'Resolved'].includes(status)) throw new TypeError('Select a valid case status.');
  const note = redactSupportCaseTextV686(value.note);
  if (note.length < (status === 'Resolved' ? 12 : 8)) throw new TypeError('Enter a meaningful action or resolution note.');
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const recordedAt = new Date(timestamp).toISOString();
  const nextOwner = String(value.assignedTo || record.assignedTo || record.owner || 'Unassigned').trim().slice(0, 48) || 'Unassigned';
  const nextTeam = String(value.team || record.team || 'RuffNeck Product Support').trim().slice(0, 70);
  if (nextOwner !== record.assignedTo || nextTeam !== record.team) {
    if (!Array.isArray(record.assignmentHistory)) record.assignmentHistory = [];
    record.assignmentHistory.push({ owner: nextOwner, team: nextTeam, recordedAt, actor: String(value.actor || 'Agent').slice(0, 48) });
    record.assignmentHistory = record.assignmentHistory.slice(-40);
  }
  if (!Array.isArray(record.history)) record.history = [];
  record.history.push({ status, note, recordedAt, owner: nextOwner, team: nextTeam });
  record.history = record.history.slice(-40);
  record.status = status;
  record.disposition = status.toLowerCase().replaceAll(' ', '_');
  record.updatedAt = recordedAt;
  record.owner = nextOwner;
  record.assignedTo = nextOwner;
  record.team = nextTeam;
  record.notes = `${String(record.notes || '').trim()}\n\n${status}: ${note}`.trim().slice(-2400);
  if (status === 'Resolved') record.resolvedAt = recordedAt;
  else record.resolvedAt = null;
  if (status === 'Escalated') record.escalationReason = note;
  else if (status === 'In Progress') record.escalationReason = '';
  return record;
}

function buildHelperSource() {
  const catalog = JSON.stringify(PLATFORM_SUPPORT_CATALOG_V651);
  const teams = JSON.stringify(TEAM_BY_PLATFORM);
  const sla = JSON.stringify(PRIORITY_SLA_MINUTES);
  return String.raw`
const CALLORIA_PLATFORM_SUPPORT_CATALOG_V686 = ${catalog};
const CALLORIA_PLATFORM_SUPPORT_TEAMS_V686 = ${teams};
const CALLORIA_SUPPORT_PRIORITY_SLA_MINUTES_V686 = ${sla};
${redactSupportCaseTextV686.toString()}
${createSupportCaseV686.toString().replace('catalog = PLATFORM_SUPPORT_CATALOG_V651', 'catalog = CALLORIA_PLATFORM_SUPPORT_CATALOG_V686').replaceAll('TEAM_BY_PLATFORM', 'CALLORIA_PLATFORM_SUPPORT_TEAMS_V686').replaceAll('PRIORITY_SLA_MINUTES', 'CALLORIA_SUPPORT_PRIORITY_SLA_MINUTES_V686')}
${scoreSupportScenarioV686.toString().replace('catalog = PLATFORM_SUPPORT_CATALOG_V651', 'catalog = CALLORIA_PLATFORM_SUPPORT_CATALOG_V686')}
${updateSupportCaseV686.toString()}
function calloriaSupportNowV686(){
  try{if(typeof simulationDateNow==='function')return simulationDateNow().getTime();}catch{}
  return Date.now();
}
function calloriaSupportSlaStateV686(record, now=calloriaSupportNowV686()){
  if(record?.status==='Resolved')return {state:'resolved',remainingMs:null,label:'RESOLVED'};
  const due=Date.parse(record?.slaDueAt||'');
  if(!Number.isFinite(due))return {state:'invalid',remainingMs:null,label:'SLA UNKNOWN'};
  const remainingMs=due-now;
  if(remainingMs<=0)return {state:'breached',remainingMs,label:'SLA BREACHED'};
  if(remainingMs<=2*60*60*1000)return {state:'due-soon',remainingMs,label:'DUE SOON'};
  return {state:'on-track',remainingMs,label:'ON TRACK'};
}
function calloriaEnsureSupportStylesV686(){
  if(document.getElementById('calloriaSupportOperationsStylesV686'))return;
  const style=document.createElement('style');style.id='calloriaSupportOperationsStylesV686';
  style.textContent='.calloria-v686-wrap{margin-top:15px;display:grid;gap:14px;min-width:0}.calloria-v686-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.calloria-v686-service{min-width:0;padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(148,163,184,.035)}.calloria-v686-service h4{margin:5px 0;font-size:13px}.calloria-v686-service p{font-size:11px;line-height:1.5;overflow-wrap:anywhere}.calloria-v686-service ul{padding-left:17px;margin:7px 0}.calloria-v686-service li{font-size:10px;line-height:1.45;margin:3px 0}.calloria-v686-case-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.4fr);gap:12px}.calloria-v686-form{display:grid;gap:9px;min-width:0}.calloria-v686-form label{display:grid;gap:5px;font-size:10px;color:var(--muted,#94a3b8)}.calloria-v686-form input,.calloria-v686-form select,.calloria-v686-form textarea{width:100%;max-width:100%;box-sizing:border-box}.calloria-v686-form textarea{min-height:82px;resize:vertical}.calloria-v686-case-list{display:grid;gap:9px;min-width:0}.calloria-v686-case{min-width:0;padding:11px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(148,163,184,.035)}.calloria-v686-case-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}.calloria-v686-case p{margin:5px 0;font-size:11px;line-height:1.5;overflow-wrap:anywhere}.calloria-v686-meta{display:flex;flex-wrap:wrap;gap:6px;margin:7px 0}.calloria-v686-meta span{font-size:9px}.calloria-v686-case-update{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:10px}.calloria-v686-case-update label{display:grid;gap:4px;font-size:10px}.calloria-v686-case-update input,.calloria-v686-case-update select,.calloria-v686-case-update textarea{width:100%;min-width:0;box-sizing:border-box}.calloria-v686-case-update textarea{grid-column:1/-1;min-height:54px}.calloria-v686-case-update button{grid-column:1/-1;justify-self:start}.calloria-v686-practice-options{display:grid;gap:6px;margin:8px 0}.calloria-v686-practice-options button{white-space:normal;text-align:left;line-height:1.35}.calloria-v686-empty{padding:14px;border:1px dashed rgba(148,163,184,.24);border-radius:10px;color:var(--muted,#94a3b8);font-size:12px}.calloria-v686-note{font-size:10px;color:var(--muted,#94a3b8)}@media(max-width:900px){.calloria-v686-services{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-v686-case-grid{grid-template-columns:1fr}}@media(max-width:580px){.calloria-v686-services{grid-template-columns:1fr}.calloria-v686-case-update{grid-template-columns:1fr}.calloria-v686-case-update textarea,.calloria-v686-case-update button{grid-column:1}.calloria-v686-wrap .panel{padding:11px}}';
  document.head.append(style);
}
function calloriaInstallSupportWatchdogV686(){
  if(window.__CALLORIA_SUPPORT_WATCHDOG_V686__)return;
  window.__CALLORIA_SUPPORT_WATCHDOG_V686__=true;
  window.setInterval(()=>{
    if(!Array.isArray(state.platformSupportCases))return;
    const now=calloriaSupportNowV686();
    let changed=false;
    for(const item of state.platformSupportCases){
      if(!item||item.status==='Resolved'||item.status==='Escalated')continue;
      const due=Date.parse(item.slaDueAt||'');
      if(!Number.isFinite(due)||due>now)continue;
      item.status='Escalated';item.disposition='escalated';item.updatedAt=new Date(now).toISOString();
      item.escalationReason='Automatic escalation: the recorded support SLA expired before resolution.';
      if(!Array.isArray(item.history))item.history=[];
      item.history.push({status:'Escalated',note:item.escalationReason,recordedAt:item.updatedAt,source:'sla-watchdog'});
      const mirror=(state.cases||[]).find(row=>row.reference===item.reference);
      if(mirror){mirror.status='Escalated';mirror.disposition='escalated';mirror.notes=item.notes;mirror.owner=item.owner;mirror.team=item.team;}
      pushOperationEvent('platform-support',item.reference,'RuffNeck support case automatically escalated after its SLA expired.','sla_breached',{platformId:item.platformId,team:item.team,owner:item.owner});
      changed=true;
    }
    if(changed){saveState();if(state.currentView==='workforce')renderView();}
  },30000);
}
function calloriaRenderPlatformOperationsV686(){
  state.platformSupportCases=Array.isArray(state.platformSupportCases)?state.platformSupportCases:[];
  const entries=Object.entries(CALLORIA_PLATFORM_SUPPORT_CATALOG_V686);
  const records=state.platformSupportCases.slice().reverse();
  const now=calloriaSupportNowV686();
  const open=records.filter(item=>item.status!=='Resolved').length;
  const escalated=records.filter(item=>item.status==='Escalated').length;
  const breached=records.filter(item=>calloriaSupportSlaStateV686(item,now).state==='breached').length;
  const resolved=records.filter(item=>item.status==='Resolved').length;
  const selected=CALLORIA_PLATFORM_SUPPORT_CATALOG_V686[state.activePlatformId]?state.activePlatformId:entries[0]?.[0];
  const serviceOptions=entries.map(([id,item])=>'<option value="'+escapeHTML(id)+'" '+(id===selected?'selected':'')+'>'+escapeHTML(item.name)+'</option>').join('');
  const selectedGuide=CALLORIA_PLATFORM_SUPPORT_CATALOG_V686[selected];
  const requestOptions=(selectedGuide?.requests||[]).map(request=>'<option value="'+escapeHTML(selected+'::'+request)+'">'+escapeHTML(request)+'</option>').join('');
  state.platformSupportPracticeHistory=Array.isArray(state.platformSupportPracticeHistory)?state.platformSupportPracticeHistory:[];
  const serviceCards=entries.map(([id,item])=>{
    const topics=item.requests.slice(0,4).map(topic=>'<li>'+escapeHTML(topic)+'</li>').join('');
    const selfService=item.selfService.slice(0,3).map(step=>'<li>'+escapeHTML(step)+'</li>').join('');
    const agentSteps=(item.agentSteps||[]).map(step=>'<li>'+escapeHTML(step)+'</li>').join('');
    const recommendation=item.recommendation?'<p><strong>Relevant hand-off:</strong> '+escapeHTML(item.recommendation)+'</p>':'';
    const scenario=item.scenario;
    const scenarioButtons=scenario?.options?.map(option=>'<button class="btn small outline" type="button" data-platform-scenario data-platform-id="'+escapeHTML(id)+'" data-option-id="'+escapeHTML(option.id)+'">'+escapeHTML(option.label)+'</button>').join('')||'';
    const lastPractice=state.platformSupportPracticeHistory.slice().reverse().find(row=>row.platformId===id);
    const practiceSummary=lastPractice?'<p class="calloria-v686-note">Latest practice: '+Number(lastPractice.score)+'% · '+escapeHTML(lastPractice.correct?'Correct response':'Review required')+'</p>':'';
    const practice=scenario?'<details><summary style="font-size:10px;cursor:pointer">Agent scenario practice</summary><p>'+escapeHTML(scenario.prompt)+'</p><div class="calloria-v686-practice-options">'+scenarioButtons+'</div>'+practiceSummary+'</details>':'';
    return '<article class="calloria-v686-service"><span class="subtle-label">'+escapeHTML(item.category.toUpperCase())+'</span><h4>'+escapeHTML(item.name)+'</h4><p>'+escapeHTML(item.summary)+'</p><strong style="font-size:10px">COMMON ENQUIRIES</strong><ul>'+topics+'</ul><details><summary style="font-size:10px;cursor:pointer">Customer self-service checks</summary><ul>'+selfService+'</ul></details><details><summary style="font-size:10px;cursor:pointer">Agent handling and escalation guide</summary><ol>'+agentSteps+'</ol><p><strong>Escalate when:</strong> '+escapeHTML(item.escalate||'The issue remains unresolved after authorised checks.')+'</p>'+recommendation+'</details>'+practice+'<div class="button-row"><button class="btn small outline" type="button" data-platform-choice data-platform-id="'+escapeHTML(id)+'">Use this service</button><a class="btn small outline" href="'+escapeHTML(item.url)+'" target="_blank" rel="noopener noreferrer">Open official platform ↗</a></div></article>'; 
  }).join('');
  const caseCards=records.length?records.map(item=>{
    const sla=calloriaSupportSlaStateV686(item,now);
    const tone=item.status==='Resolved'?'green':item.status==='Escalated'||sla.state==='breached'?'red':sla.state==='due-soon'?'amber':'green';
    const history=(item.history||[]).slice(-3).reverse().map(row=>'<li>'+escapeHTML(row.status)+' · '+escapeHTML(row.note)+' · '+escapeHTML(new Date(row.recordedAt).toLocaleString())+'</li>').join('');
    const updateForm=item.status==='Resolved'?'<span class="pill green">CLOSED</span>':'<form class="calloria-v686-case-update" data-calloria-support-update-v686><input type="hidden" name="reference" value="'+escapeHTML(item.reference)+'"><label>CASE STATUS<select name="status"><option '+(item.status==='Open'?'selected':'')+'>Open</option><option '+(item.status==='In Progress'?'selected':'')+'>In Progress</option><option '+(item.status==='Escalated'?'selected':'')+'>Escalated</option><option>Resolved</option></select></label><label>ASSIGNED AGENT<input name="assignedTo" maxlength="48" value="'+escapeHTML(item.assignedTo||item.owner||'Agent')+'" required></label><label>SPECIALIST TEAM<select name="team">'+Object.values(CALLORIA_PLATFORM_SUPPORT_TEAMS_V686).map(team=>'<option '+(team===item.team?'selected':'')+'>'+escapeHTML(team)+'</option>').join('')+'</select></label><label>ACTION / RESOLUTION EVIDENCE<textarea name="note" minlength="8" maxlength="500" required placeholder="Checks completed, next owner or verified resolution."></textarea></label><button class="btn small outline" type="submit">Save case update</button></form>';
    return '<article class="calloria-v686-case"><div class="calloria-v686-case-head"><div><strong>'+escapeHTML(item.reference)+'</strong><p>'+escapeHTML(item.platformName)+' · '+escapeHTML(item.customerName)+' · '+escapeHTML(item.customerReference)+'</p></div><span class="pill '+tone+'">'+escapeHTML(item.status.toUpperCase())+'</span></div><div class="calloria-v686-meta"><span class="pill">'+escapeHTML(item.priority.toUpperCase())+'</span><span class="pill">'+escapeHTML(item.team||'Unassigned team')+'</span><span class="pill">'+escapeHTML(sla.label)+'</span><span class="pill">DUE '+escapeHTML(new Date(item.slaDueAt).toLocaleString())+'</span></div><p><strong>'+escapeHTML(item.requestType)+'</strong></p><p>'+escapeHTML(item.details)+'</p><p class="calloria-v686-note">Owner: '+escapeHTML(item.assignedTo||item.owner||'Unassigned')+' · Last updated '+escapeHTML(new Date(item.updatedAt||item.createdAt).toLocaleString())+'</p><details><summary style="font-size:10px;cursor:pointer">Recent case history</summary><ul>'+history+'</ul></details>'+updateForm+'</article>';
  }).join(''):'<div class="calloria-v686-empty">No RuffNeck support cases have been recorded in this browser save.</div>';
  return '<section class="calloria-v686-wrap"><div class="panel"><div class="panel-head"><div><span class="subtle-label">RUFFNECK · PRODUCT SUPPORT</span><h3>Service directory and customer-care playbooks</h3><p>Six RuffNeck products, their common customer issues and safe first-line checks.</p></div><span class="pill green">SIMULATED WORKFLOW</span></div><div class="calloria-v686-services">'+serviceCards+'</div><p class="calloria-v686-note">Live platform links open separately. CALLORIA does not access their customer accounts, production databases or payment systems.</p></div><div class="panel"><div class="panel-head"><div><span class="subtle-label">WORKFORCE · CASE OWNERSHIP</span><h3>RuffNeck support case desk</h3><p>Open synthetic cases, assign specialist ownership, track service targets and record resolution evidence.</p></div><span class="pill">'+records.length+' CASES</span></div><div class="ops-summary-grid"><article class="metric-card"><span>OPEN CASES</span><strong>'+open+'</strong><small>Awaiting resolution</small></article><article class="metric-card"><span>ESCALATED</span><strong>'+escalated+'</strong><small>Supervisor / specialist attention</small></article><article class="metric-card"><span>SLA BREACHED</span><strong>'+breached+'</strong><small>Overdue unresolved cases</small></article><article class="metric-card"><span>RESOLVED</span><strong>'+resolved+'</strong><small>Closed support records</small></article></div><div class="calloria-v686-case-grid"><div><form id="calloriaPlatformSupportCaseFormV686" class="calloria-v686-form"><label>SERVICE<select name="platformId" id="calloriaSupportPlatformV686">'+serviceOptions+'</select></label><label>REQUEST TYPE<select name="requestType" id="calloriaSupportRequestV686">'+requestOptions+'</select></label><label>SYNTHETIC CUSTOMER REFERENCE<input name="customerReference" required maxlength="40" pattern="CUS-SIM-[A-Za-z0-9-]{2,28}" placeholder="CUS-SIM-001"><small class="calloria-v686-note">Training reference only. Do not enter real customer personal data.</small></label><label>PRIORITY<select name="priority"><option value="normal">Normal · 24 hours</option><option value="low">Low · 48 hours</option><option value="high">High · 2 hours</option><option value="critical">Critical · 30 minutes and automatic escalation</option></select></label><label>ISSUE AND CHECKS ALREADY PERFORMED<textarea name="details" required minlength="12" maxlength="1000" placeholder="Describe the reported issue, visible status, device/browser and checks already performed."></textarea></label><button class="btn primary" type="submit">Open support case →</button></form></div><div class="calloria-v686-case-list">'+caseCards+'</div></div><p class="calloria-v686-note">SLA targets are simulated training values, not contractual service commitments. The SLA clock follows the in-game clock. Critical cases are escalated on creation; other unresolved cases are escalated automatically when their due time passes. Records are saved with the CALLORIA profile and follow its enabled cloud-employment sync. No RuffNeck production account or customer database is accessed.</p></div></section>';
}
function calloriaInstallSupportSubmitHandlersV686(){
  if(window.__CALLORIA_SUPPORT_SUBMIT_V686__)return;
  window.__CALLORIA_SUPPORT_SUBMIT_V686__=true;
  document.addEventListener('submit',event=>{
    const form=event.target;
    if(form?.id==='calloriaPlatformSupportCaseFormV686'){
      event.preventDefault();
      try{
        const values=new FormData(form);
        const requestKey=String(values.get('requestType')||'');
        const separator=requestKey.indexOf('::');
        if(separator<1)throw new Error('Select a valid service request type.');
        const platformId=requestKey.slice(0,separator);
        const requestType=requestKey.slice(separator+2);
        if(String(values.get('platformId')||'')!==platformId)throw new Error('The request type does not match the selected service.');
        state.platformSupportCases=Array.isArray(state.platformSupportCases)?state.platformSupportCases:[];
        state.cases=Array.isArray(state.cases)?state.cases:[];
        const record=createSupportCaseV686({platformId,requestType,customerReference:values.get('customerReference'),priority:values.get('priority'),details:values.get('details'),sequence:state.platformSupportCases.length+1,owner:state.applicantName||'Agent'},calloriaSupportNowV686(),CALLORIA_PLATFORM_SUPPORT_CATALOG_V686);
        state.platformSupportCases.push(record);state.platformSupportCases=state.platformSupportCases.slice(-300);
        state.cases.push({reference:record.reference,customer:record.customer,title:record.title,channel:'Platform Support',disposition:record.disposition,status:record.status,qa:null,qaEligible:false,owner:record.owner,team:record.team,notes:record.notes,createdAt:record.createdAt,messages:[],platformId:record.platformId,platformName:record.platformName,priority:record.priority,slaDueAt:record.slaDueAt});
        state.cases=state.cases.slice(-200);state.activePlatformId=platformId;
        createSystemEvent(state.systemEvents,platformId,'Opened RuffNeck support case',record.reference);
        pushOperationEvent('platform-support',record.reference,record.platformName+' support case opened · '+record.requestType+'.',record.status.toLowerCase().replaceAll(' ','_'),{priority:record.priority,slaDueAt:record.slaDueAt,team:record.team,owner:record.owner});
        saveState();renderView();toast('Support case '+record.reference+' opened and routed to '+record.team+'.','success');
      }catch(error){toast(error.message||'Support case could not be opened.','warning');}
      return;
    }
    if(form?.matches?.('[data-calloria-support-update-v686]')){
      event.preventDefault();
      try{
        const values=new FormData(form);const reference=String(values.get('reference')||'');
        const record=(state.platformSupportCases||[]).find(item=>item.reference===reference);
        if(!record)throw new Error('The selected support case could not be found.');
        updateSupportCaseV686(record,{status:values.get('status'),assignedTo:values.get('assignedTo'),team:values.get('team'),note:values.get('note'),actor:state.applicantName||'Agent'},calloriaSupportNowV686());
        const mirror=(state.cases||[]).find(item=>item.reference===reference);
        if(mirror){mirror.status=record.status;mirror.disposition=record.disposition;mirror.notes=record.notes;mirror.owner=record.owner;mirror.team=record.team;}
        createSystemEvent(state.systemEvents,record.platformId,'Updated RuffNeck support case · '+record.status,record.reference);
        pushOperationEvent('platform-support',reference,'Support case updated · '+record.status+'.',record.status.toLowerCase().replaceAll(' ','_'),{team:record.team,owner:record.owner});
        saveState();renderView();toast('Support case '+reference+' updated.','success');
      }catch(error){toast(error.message||'Support case update could not be saved.','warning');}
      return;
    }
  });
}
function calloriaInstallSupportRequestOptionsV686(){
  if(window.__CALLORIA_SUPPORT_REQUEST_CHANGE_V686__)return;
  window.__CALLORIA_SUPPORT_REQUEST_CHANGE_V686__=true;
  document.addEventListener('change',event=>{
    if(event.target?.id!=='calloriaSupportPlatformV686')return;
    const platformId=String(event.target.value||'');
    const guide=CALLORIA_PLATFORM_SUPPORT_CATALOG_V686[platformId];
    const select=document.getElementById('calloriaSupportRequestV686');
    if(!guide||!select)return;
    select.innerHTML=guide.requests.map(request=>'<option value="'+escapeHTML(platformId+'::'+request)+'">'+escapeHTML(request)+'</option>').join('');
  });
}
`;
}

export function transformWorkforceV686(context, input) {
  const source = String(input || '').replace(/\r\n?/g, '\n');
  if (source.includes(WORKFORCE_MARKER) || source.includes('__CALLORIA_RUFFNECK_PLATFORM_SUPPORT_V651__')) return null;
  const start = source.indexOf(SYSTEMS_START);
  if (start < 0 || source.indexOf(SYSTEMS_START, start + 1) >= 0) {
    context.error('CALLORIA v6.86 could not identify one Workforce SYSTEMS registry.');
  }
  const end = source.indexOf('];', start + SYSTEMS_START.length);
  if (end < 0) context.error('CALLORIA v6.86 found an incomplete Workforce SYSTEMS registry.');
  const originalBlock = source.slice(start, end + 2);
  if (!/id\s*:\s*['"]finacle['"]/.test(originalBlock)) {
    context.error('CALLORIA v6.86 expected the unrelated Finacle entry in the current Workforce registry.');
  }
  const replacement = `export const SYSTEMS = ${JSON.stringify(SYSTEMS_V686, null, 2)};`;
  const code = source.slice(0, start) + replacement + source.slice(end + 2);
  return { code: `/* ${WORKFORCE_MARKER} */\n${code}`, map: null };
}

export function transformMainV686(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MAIN_MARKER) || original.includes('__CALLORIA_RUFFNECK_PLATFORM_SUPPORT_V651__')) return null;
  const required = [
    [TRACK_ANCHOR, 'applicant default track'],
    [DEPARTMENT_ANCHOR, 'applicant default department'],
    [ROLE_TITLE_ANCHOR, 'applicant default role title'],
    [SALARY_ANCHOR, 'applicant default salary'],
    [MIGRATION_ANCHOR, 'legacy applicant default migration point'],
    [WORKFORCE_RENDER_ANCHOR, 'Workforce renderer'],
    [WORKFORCE_INSERT_ANCHOR, 'Workforce systems directory insertion point'],
    [SYSTEM_LAUNCH_GUARD, 'simulated system launch guard'],
    [CLICK_TEMPLATE_ANCHOR, 'existing digital template click handler'],
    [CRM_QA_ANCHOR, 'CRM quality cell'],
    [CRM_ISSUE_ANCHOR, 'CRM case issue row'],
    [BANKING_ONLY_SANDBOX_COPY, 'banking-only Workforce sandbox wording'],
  ];
  const missing = required.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.error(`CALLORIA v6.86 source rebase failed: ${missing.map(([, label]) => label).join(', ')}. No partial transform was applied.`);
  }
  let code = original;
  code = replaceExactlyOnce(context, code, TRACK_ANCHOR, "selectedTrack: 'service',", 'applicant default track');
  code = replaceExactlyOnce(context, code, DEPARTMENT_ANCHOR, "department: 'Customer Experience',", 'applicant default department');
  code = replaceExactlyOnce(context, code, ROLE_TITLE_ANCHOR, "roleTitle: 'Customer Service Associate',", 'applicant default role title');
  code = replaceExactlyOnce(context, code, SALARY_ANCHOR, 'salary: 170000,', 'applicant default salary');
  code = replaceExactlyOnce(context, code, MIGRATION_ANCHOR, `${MIGRATION_ANCHOR}\n    if (!migrated.applicationSubmitted && migrated.stage === 'applicant' && !migrated.hired && !String(migrated.applicantName || '').trim() && migrated.selectedTrack === 'banking' && migrated.department === 'Banking Operations') { migrated.selectedTrack='service'; migrated.department='Customer Experience'; migrated.roleTitle='Customer Service Associate'; migrated.salary=170000; }`, 'legacy applicant default migration point');
  code = replaceExactlyOnce(context, code, WORKFORCE_RENDER_ANCHOR, `${buildHelperSource()}\n${WORKFORCE_RENDER_ANCHOR}\n  calloriaEnsureSupportStylesV686();\n  calloriaInstallSupportWatchdogV686();\n  calloriaInstallSupportSubmitHandlersV686();\n  calloriaInstallSupportRequestOptionsV686();`, 'Workforce renderer');
  code = replaceExactlyOnce(context, code, WORKFORCE_INSERT_ANCHOR, `</div>\n         \${calloriaRenderPlatformOperationsV686()}\n         <h4 style="margin-top:16px">System activity</h4>`, 'Workforce systems directory insertion point');
  code = replaceExactlyOnce(context, code, SYSTEM_LAUNCH_GUARD, `${SYSTEM_LAUNCH_GUARD}\n       if (CALLORIA_PLATFORM_SUPPORT_CATALOG_V686[system.id]) state.activePlatformId=system.id;`, 'simulated system launch guard');
  code = replaceExactlyOnce(context, code, CLICK_TEMPLATE_ANCHOR, `  const platformScenario=e.target.closest('[data-platform-scenario]');
  if(platformScenario){
    const platformId=String(platformScenario.dataset.platformId||'');
    const optionId=String(platformScenario.dataset.optionId||'');
    const result=scoreSupportScenarioV686(platformId,optionId,CALLORIA_PLATFORM_SUPPORT_CATALOG_V686);
    if(!result){toast('That practice choice is unavailable.','warning');return;}
    state.platformSupportPracticeHistory=Array.isArray(state.platformSupportPracticeHistory)?state.platformSupportPracticeHistory:[];
    const record={...result,recordedAt:new Date().toISOString(),agent:state.applicantName||'Agent'};
    state.platformSupportPracticeHistory.push(record);state.platformSupportPracticeHistory=state.platformSupportPracticeHistory.slice(-150);
    createSystemEvent(state.systemEvents,platformId,'Completed RuffNeck product-support practice',result.scenarioId);
    pushOperationEvent('platform-support-practice',result.scenarioId,result.platformName+' practice scored '+result.score+'%.',result.correct?'passed':'review_required',{optionId:result.optionId});
    saveState();renderView();toast(result.feedback,result.correct?'success':'warning');return;
  }
  const platformPractice=e.target.closest('[data-platform-choice]');
  if(platformPractice){
    const platformId=String(platformPractice.dataset.platformId||'');
    const guide=CALLORIA_PLATFORM_SUPPORT_CATALOG_V686[platformId];
    if(!guide){toast('That RuffNeck service is unavailable.','warning');return;}
    state.activePlatformId=platformId;
    renderView();
    return;
  }
${CLICK_TEMPLATE_ANCHOR}`, 'existing digital template click handler');
  code = replaceExactlyOnce(context, code, CRM_QA_ANCHOR, '<td>${c.qaEligible===false?\'N/A\':`${Number(c.qa)||0}%`}</td>', 'CRM quality cell');
  code = replaceExactlyOnce(context, code, CRM_ISSUE_ANCHOR, CRM_ISSUE_ANCHOR + '${c.platformName ? `<p><strong>Platform:</strong> ${escapeHTML(c.platformName)} · <strong>Priority:</strong> ${escapeHTML(String(c.priority||\"normal\").toUpperCase())} · <strong>SLA due:</strong> ${escapeHTML(c.slaDueAt ? new Date(c.slaDueAt).toLocaleString() : \"—\")}</p>` : \"\"}', 'CRM case issue row');
  code = replaceExactlyOnce(context, code, SYSTEM_EVENT_ANCHOR, "state.systemEvents.filter(e=>e.systemId!=='finacle').slice(-8)", 'system activity history');
  code = replaceExactlyOnce(context, code, BANKING_ONLY_SANDBOX_COPY, 'Connected workflow practice using synthetic records only. No live service-platform accounts, customer records or transactions.', 'banking-only Workforce sandbox wording');
  return { code: `/* ${MAIN_MARKER} */\n${code}`, map: null };
}

export function calloriaRuffNeckServiceOperationsPluginV686() {
  return {
    name: 'calloria-ruffneck-service-operations-v6-86',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(MAIN_TARGET)) return transformMainV686(this, source);
      if (target.endsWith(WORKFORCE_TARGET)) return transformWorkforceV686(this, source);
      return null;
    },
  };
}

export const __calloriaV686Test = Object.freeze({
  transformMain: transformMainV686,
  transformWorkforce: transformWorkforceV686,
  redact: redactSupportCaseTextV686,
  create: createSupportCaseV686,
  score: scoreSupportScenarioV686,
  update: updateSupportCaseV686,
  systems: SYSTEMS_V686,
  teams: TEAM_BY_PLATFORM,
  markers: { MAIN_MARKER, WORKFORCE_MARKER },
});
