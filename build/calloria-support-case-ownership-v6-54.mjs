/**
 * CALLORIA v6.54 — Support Case Ownership and Routing.
 * Adds explicit case ownership, specialist-team routing, supervisor assignment,
 * an auditable assignment history and an actionable ownership queue.
 * All records remain synthetic and local to the current browser save.
 */
const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_SUPPORT_CASE_OWNERSHIP_V654__';
const STATE_ANCHOR = "platformSupportQueueFilters: { service: 'all', status: 'active', priority: 'all', sort: 'sla' },";
const HELPER_ANCHOR = 'function calloriaRenderSupportCommandCentreV653(now=Date.now()){';
const RENDER_ANCHOR = '${calloriaRenderSupportCommandCentreV653()}';
const WATCHDOG_ANCHOR = 'calloriaInstallSupportSlaWatchdogV653();';

const TEAM_BY_PLATFORM = Object.freeze({
  'ruffneck-lms': 'Learning Platform Support',
  'ruffneck-prospector': 'Business Tools Support',
  'ruffneck-connect': 'Connectivity Support',
  'ruffneck-social-hub': 'Social & Community Support',
  'kano-run': 'Kano Run Game Support',
  'kano-keke': 'Kano Keke Game Support',
});

function count(source, anchor) { return source.split(anchor).length - 1; }
function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.54 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function getSupportCaseTeamV654(platformId) {
  return TEAM_BY_PLATFORM[String(platformId || '')] || 'Platform Support Generalist Queue';
}

export function ensureSupportCaseOwnershipV654(state, now = Date.now()) {
  if (!state || typeof state !== 'object') throw new TypeError('A valid simulation state is required.');
  if (!Array.isArray(state.platformSupportCases)) state.platformSupportCases = [];
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const recordedAt = new Date(timestamp).toISOString();
  let changed = false;

  for (const item of state.platformSupportCases) {
    if (!item || typeof item !== 'object') continue;
    const team = getSupportCaseTeamV654(item.platformId);
    if (!item.assignedTeam) { item.assignedTeam = team; changed = true; }
    if (!item.assigneeType) {
      const legacyOwner = String(item.owner || '').trim();
      if (item.status === 'Escalated' || String(item.priority).toLowerCase() === 'critical') {
        item.assigneeType = 'supervisor';
        item.owner = 'Supervisor Queue';
        item.assignedTeam = 'Supervisor Escalations';
      } else if (legacyOwner && legacyOwner !== 'Agent' && legacyOwner !== 'Unassigned') {
        item.assigneeType = 'agent';
      } else {
        item.assigneeType = 'unassigned';
        item.owner = 'Unassigned';
      }
      changed = true;
    }
    if (!item.assignmentHistory || !Array.isArray(item.assignmentHistory)) {
      item.assignmentHistory = [{
        assigneeType: item.assigneeType,
        owner: String(item.owner || 'Unassigned'),
        team: String(item.assignedTeam || team),
        assignedAt: String(item.assignedAt || item.createdAt || recordedAt),
        assignedBy: 'CALLORIA migration',
        source: 'v6.54-migration',
      }];
      changed = true;
    }
    if (item.assignmentHistory.length > 30) item.assignmentHistory = item.assignmentHistory.slice(-30);
  }

  return changed;
}

export function assignSupportCaseV654(state, reference, action, currentAgent, now = Date.now()) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.platformSupportCases)) {
    throw new TypeError('The support case queue is unavailable.');
  }
  const item = state.platformSupportCases.find(entry => entry && entry.reference === String(reference || ''));
  if (!item) throw new TypeError('The selected support case could not be found.');
  if (item.status === 'Resolved') throw new TypeError('Resolved cases cannot be reassigned.');

  const selectedAction = String(action || '');
  if (!['claim', 'specialist', 'supervisor', 'release'].includes(selectedAction)) {
    throw new TypeError('Select a valid case-ownership action.');
  }

  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const recordedAt = new Date(timestamp).toISOString();
  const agent = String(currentAgent || 'Player Agent').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 48) || 'Player Agent';
  const queueTeam = getSupportCaseTeamV654(item.platformId);
  const previous = { owner: String(item.owner || 'Unassigned'), team: String(item.assignedTeam || queueTeam), type: String(item.assigneeType || 'unassigned') };

  if (selectedAction === 'claim') {
    item.owner = agent;
    item.assigneeType = 'agent';
    item.assignedTeam = queueTeam;
    item.assignedAt = recordedAt;
    item.assignedBy = agent;
  } else if (selectedAction === 'specialist') {
    item.owner = `${queueTeam} Specialist Queue`;
    item.assigneeType = 'specialist';
    item.assignedTeam = queueTeam;
    item.assignedAt = recordedAt;
    item.assignedBy = agent;
  } else if (selectedAction === 'supervisor') {
    item.owner = 'Supervisor Queue';
    item.assigneeType = 'supervisor';
    item.assignedTeam = 'Supervisor Escalations';
    item.assignedAt = recordedAt;
    item.assignedBy = agent;
    item.status = 'Escalated';
    item.disposition = 'escalated';
    item.escalationReason = 'Supervisor ownership requested from the support case queue.';
    item.slaEscalatedAt = item.slaEscalatedAt || recordedAt;
  } else {
    item.owner = 'Unassigned';
    item.assigneeType = 'unassigned';
    item.assignedTeam = queueTeam;
    item.assignedAt = null;
    item.assignedBy = agent;
  }

  item.updatedAt = recordedAt;
  const historyEntry = {
    action: selectedAction,
    from: previous,
    to: { owner: item.owner, team: item.assignedTeam, type: item.assigneeType },
    assignedAt: recordedAt,
    assignedBy: agent,
    source: 'support-case-ownership-v654',
  };
  if (!Array.isArray(item.assignmentHistory)) item.assignmentHistory = [];
  item.assignmentHistory.push(historyEntry);
  item.assignmentHistory = item.assignmentHistory.slice(-30);
  if (!Array.isArray(item.history)) item.history = [];
  item.history.push({
    status: item.status,
    note: `Ownership ${selectedAction}: ${previous.owner} → ${item.owner} (${item.assignedTeam}).`,
    recordedAt,
    source: 'support-case-ownership-v654',
  });
  item.history = item.history.slice(-40);
  item.notes = `${String(item.notes || '').trim()}\n\nOwnership: ${item.owner} · ${item.assignedTeam} · ${recordedAt}`.trim().slice(-2400);

  if (!Array.isArray(state.cases)) state.cases = [];
  const mirror = state.cases.find(entry => entry && entry.reference === item.reference);
  if (mirror) {
    mirror.owner = item.owner;
    mirror.assigneeType = item.assigneeType;
    mirror.assignedTeam = item.assignedTeam;
    mirror.assignedAt = item.assignedAt;
    mirror.assignedBy = item.assignedBy;
    mirror.assignmentHistory = item.assignmentHistory;
    mirror.status = item.status;
    mirror.disposition = item.disposition;
    mirror.notes = item.notes;
  }

  return item;
}

const HELPER_SOURCE = `
const CALLORIA_SUPPORT_TEAM_BY_PLATFORM_V654 = ${JSON.stringify(TEAM_BY_PLATFORM)};
function getSupportCaseTeamV654(platformId) { return CALLORIA_SUPPORT_TEAM_BY_PLATFORM_V654[String(platformId || '')] || 'Platform Support Generalist Queue'; }
${ensureSupportCaseOwnershipV654.toString()}
${assignSupportCaseV654.toString()}
function calloriaEnsureSupportOwnershipStylesV654(){
  if(document.getElementById('calloriaSupportOwnershipStylesV654'))return;
  const style=document.createElement('style');style.id='calloriaSupportOwnershipStylesV654';
  style.textContent='.calloria-support-ownership{margin:14px 0;padding:14px;border:1px solid rgba(167,139,250,.24);border-radius:13px;background:rgba(91,33,182,.055)}.calloria-support-ownership-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap}.calloria-support-ownership-head h3{margin:3px 0}.calloria-support-ownership-head p{font-size:11px;color:var(--muted,#94a3b8);margin:4px 0}.calloria-support-ownership-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.calloria-support-ownership-metric{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.035);min-width:0}.calloria-support-ownership-metric span{display:block;font-size:9px;letter-spacing:.08em;color:var(--muted,#94a3b8);text-transform:uppercase}.calloria-support-ownership-metric strong{display:block;font-size:21px;margin-top:4px}.calloria-support-ownership-filters{display:flex;gap:8px;align-items:end;flex-wrap:wrap;margin:10px 0}.calloria-support-ownership-filters label{display:grid;gap:4px;font-size:10px;color:var(--muted,#94a3b8)}.calloria-support-ownership-filters select{min-width:190px;max-width:100%;box-sizing:border-box}.calloria-support-ownership-list{display:grid;gap:8px}.calloria-support-ownership-item{padding:11px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.035);min-width:0}.calloria-support-ownership-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.calloria-support-ownership-item p{font-size:11px;line-height:1.45;margin:5px 0;overflow-wrap:anywhere}.calloria-support-ownership-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.calloria-support-ownership-actions button{font-size:10px}.calloria-support-ownership-foot{font-size:10px;color:var(--muted,#94a3b8);margin-top:10px}.calloria-support-ownership-empty{padding:14px;border:1px dashed rgba(148,163,184,.25);border-radius:10px;font-size:12px;color:var(--muted,#94a3b8)}@media(max-width:620px){.calloria-support-ownership{padding:10px}.calloria-support-ownership-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-support-ownership-filters label,.calloria-support-ownership-filters select{width:100%;min-width:0}.calloria-support-ownership-actions button{flex:1 1 42%}}';
  document.head.append(style);
}
function calloriaRenderSupportOwnershipDeskV654(now=Date.now()){
  if(!Array.isArray(state.platformSupportCases))state.platformSupportCases=[];
  const migrated=ensureSupportCaseOwnershipV654(state,now);
  if(migrated)saveState();
  const active=state.platformSupportCases.filter(item=>item&&item.status!=='Resolved');
  const currentAgent=String(state.applicantName||'Player Agent').trim()||'Player Agent';
  if(!['all','mine','unassigned','specialist','supervisor'].includes(state.platformSupportAssignmentFilterV654))state.platformSupportAssignmentFilterV654='all';
  const filter=state.platformSupportAssignmentFilterV654;
  const metrics={active:active.length,mine:0,unassigned:0,specialist:0,supervisor:0};
  for(const item of active){
    if(item.assigneeType==='agent'&&item.owner===currentAgent)metrics.mine++;
    if(item.assigneeType==='unassigned')metrics.unassigned++;
    if(item.assigneeType==='specialist')metrics.specialist++;
    if(item.assigneeType==='supervisor')metrics.supervisor++;
  }
  let records=active.filter(item=>filter==='all'||(filter==='mine'&&item.assigneeType==='agent'&&item.owner===currentAgent)||(filter==='unassigned'&&item.assigneeType==='unassigned')||(filter==='specialist'&&item.assigneeType==='specialist')||(filter==='supervisor'&&item.assigneeType==='supervisor'));
  records.sort((a,b)=>{
    const ad=Date.parse(a.slaDueAt),bd=Date.parse(b.slaDueAt);
    return (Number.isFinite(ad)?ad:Infinity)-(Number.isFinite(bd)?bd:Infinity);
  });
  const cards=records.slice(0,60).map(item=>{
    const team=escapeHTML(item.assignedTeam||getSupportCaseTeamV654(item.platformId));
    const owner=escapeHTML(item.owner||'Unassigned');
    const last=Array.isArray(item.assignmentHistory)?item.assignmentHistory.at(-1):null;
    const lastText=last?\`\${last.action||'assigned'} · \${last.assignedBy||'system'} · \${last.assignedAt||''}\`:'No assignment change recorded';
    const ownedByMe=item.assigneeType==='agent'&&item.owner===currentAgent;
    const allowClaim=!ownedByMe;
    const actions=(ownedByMe?'':'<button class="btn small outline" type="submit" data-assignment-action="claim">Claim for me</button>')+
      '<button class="btn small outline" type="submit" data-assignment-action="specialist">Route to specialist</button>'+
      '<button class="btn small outline" type="submit" data-assignment-action="supervisor">Supervisor review</button>'+
      (item.assigneeType==='unassigned'?'':'<button class="btn small outline" type="submit" data-assignment-action="release">Release</button>');
    const sla=typeof classifyPlatformSupportSlaV653==='function'?classifyPlatformSupportSlaV653(item,now):{state:'unknown'};
    const slaLabel=sla.state==='overdue'?'SLA BREACHED':sla.state==='due_soon'?'DUE SOON':sla.state==='on_track'?'ON TRACK':sla.state==='resolved'?'RESOLVED':'SLA UNKNOWN';
    return '<article class="calloria-support-ownership-item"><div class="calloria-support-ownership-top"><strong>'+escapeHTML(item.reference||'Support case')+'</strong><span class="pill '+(item.assigneeType==='supervisor'?'red':item.assigneeType==='unassigned'?'amber':'blue')+'">'+escapeHTML(String(item.assigneeType||'unassigned').toUpperCase())+'</span></div><p><strong>'+escapeHTML(item.platformName||item.platformId||'RuffNeck service')+'</strong> · '+escapeHTML(item.requestType||item.title||'Support request')+'</p><p>Owner: <strong>'+owner+'</strong> · Team: '+team+'</p><p>Priority: '+escapeHTML(String(item.priority||'normal').toUpperCase())+' · Case: '+escapeHTML(item.status||'Open')+' · '+slaLabel+'</p><p class="calloria-support-ownership-foot">Last assignment: '+escapeHTML(lastText)+'</p><form data-support-assignment-v654 data-reference="'+escapeHTML(item.reference||'')+'" class="calloria-support-ownership-actions">'+actions+'</form></article>';
  }).join('');
  const options=[['all','All active cases'],['mine','Owned by me'],['unassigned','Unassigned'],['specialist','Specialist queue'],['supervisor','Supervisor queue']].map(([value,label])=>'<option value="'+value+'" '+(filter===value?'selected':'')+'>'+label+'</option>').join('');
  return '<section class="calloria-support-ownership"><div class="calloria-support-ownership-head"><div><span class="subtle-label">WORKFORCE · CASE CONTROL</span><h3>Case ownership and routing</h3><p>Claim work, route product issues to specialist queues or request supervisor ownership.</p></div><span class="pill green">LOCAL SIMULATION</span></div><div class="calloria-support-ownership-metrics"><article class="calloria-support-ownership-metric"><span>Active cases</span><strong>'+metrics.active+'</strong></article><article class="calloria-support-ownership-metric"><span>Owned by me</span><strong>'+metrics.mine+'</strong></article><article class="calloria-support-ownership-metric"><span>Unassigned</span><strong>'+metrics.unassigned+'</strong></article><article class="calloria-support-ownership-metric"><span>Specialist / supervisor</span><strong>'+(metrics.specialist+metrics.supervisor)+'</strong></article></div><div class="calloria-support-ownership-filters"><label>Ownership queue<select id="platformSupportAssignmentFilterV654">'+options+'</select></label></div><div class="calloria-support-ownership-list">'+(cards||'<div class="calloria-support-ownership-empty">No active cases match this ownership queue.</div>')+'</div><p class="calloria-support-ownership-foot">Routing is simulated within this browser save. Specialist and supervisor queues are role queues, not live employee accounts or real RuffNeck service desks. SLA deadlines are not reset when ownership changes.</p></section>';
}
`;

const EVENT_BRIDGE = `
document.addEventListener('change',e=>{
  const select=e.target;
  if(!select||select.id!=='platformSupportAssignmentFilterV654')return;
  state.platformSupportAssignmentFilterV654=select.value;
  saveState();renderView();
});
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!form||!form.matches||!form.matches('[data-support-assignment-v654]'))return;
  e.preventDefault();
  const reference=String(form.dataset.reference||'');
  const action=String(e.submitter?.dataset?.assignmentAction||'');
  try{
    const was= (state.platformSupportCases||[]).find(item=>item&&item.reference===reference);
    const before=was?String(was.owner||'Unassigned'):'Unassigned';
    const item=assignSupportCaseV654(state,reference,action,state.applicantName||'Player Agent',Date.now());
    try{if(typeof pushOperationEvent==='function')pushOperationEvent('platform-support-assignment',reference,'Case ownership changed from '+before+' to '+item.owner+'.',item.status.toLowerCase().replaceAll(' ','_'),{team:item.assignedTeam,assigneeType:item.assigneeType,action});}catch{}
    saveState();renderView();
    if(typeof toast==='function')toast('Case '+reference+' routed to '+item.owner+'.','success');
  }catch(error){if(typeof toast==='function')toast(error.message,'warning');}
});
`;

export function transformMain(context, input) {
  const original = String(input || '');
  if (original.includes(MARKER)) return null;
  if (!original.includes('__CALLORIA_SUPPORT_SLA_COMMAND_CENTRE_V653__')) {
    context.warn('CALLORIA v6.54 skipped safely: v6.53 Support SLA Command Centre was not found. Install the cumulative v6.53 overlay first.');
    return null;
  }
  const anchors = [
    [STATE_ANCHOR, 'v6.53 support queue state'],
    [HELPER_ANCHOR, 'v6.53 support command-centre helper'],
    [RENDER_ANCHOR, 'v6.53 command-centre render call'],
    [WATCHDOG_ANCHOR, 'v6.53 support watchdog bridge'],
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.54 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }
  let code = original;
  code = replaceOnce(context, code, STATE_ANCHOR, `${STATE_ANCHOR}\n  platformSupportAssignmentFilterV654: 'all',`, 'v6.53 support queue state'); if (code === null) return null;
  code = replaceOnce(context, code, HELPER_ANCHOR, `${HELPER_SOURCE}\n${HELPER_ANCHOR}`, 'v6.53 support command-centre helper'); if (code === null) return null;
  code = replaceOnce(context, code, RENDER_ANCHOR, `${RENDER_ANCHOR}\${calloriaRenderSupportOwnershipDeskV654()}`, 'v6.53 command-centre render call'); if (code === null) return null;
  code = replaceOnce(context, code, WATCHDOG_ANCHOR, `${EVENT_BRIDGE}\n${WATCHDOG_ANCHOR}`, 'v6.53 support watchdog bridge'); if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaSupportCaseOwnershipPluginV654() {
  return {
    name: 'calloria-support-case-ownership-v6-54',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\\\', '/');
      if (!target.endsWith(MAIN_TARGET)) return null;
      return transformMain(this, source);
    },
  };
}

export const __calloriaV654Test = {
  transformMain,
  getTeam: getSupportCaseTeamV654,
  ensure: ensureSupportCaseOwnershipV654,
  assign: assignSupportCaseV654,
  teamMap: TEAM_BY_PLATFORM,
  anchors: { STATE_ANCHOR, HELPER_ANCHOR, RENDER_ANCHOR, WATCHDOG_ANCHOR },
  marker: MARKER,
};
