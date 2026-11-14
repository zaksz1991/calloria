/**
 * CALLORIA v6.52 — RuffNeck platform support case desk.
 * Turns the v6.51 reference directory into a local, evidence-based support-ticket
 * workflow with SLA targets, CRM case records and escalation/closure history.
 * All records are synthetic and remain in the current browser save.
 */
import { PLATFORM_SUPPORT_CATALOG_V651 } from './calloria-ruffneck-platform-support-v6-51.mjs';

const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_PLATFORM_SUPPORT_CASE_DESK_V652__';
const STATE_ANCHOR = "applicantName: '',";
const GUIDE_ANCHOR = '${calloriaRenderPlatformGuideV651()}';
const QA_CELL_ANCHOR = '<td>${c.qa}%</td>';
const CRM_ISSUE_ANCHOR = '<p><strong>Issue:</strong> ${escapeHTML(c.title)}</p>';
const SUBMIT_LISTENER_ANCHOR = "document.addEventListener('submit',async e=>{";
const WORKFORCE_RENDER_ANCHOR = 'function renderWorkforce() {\n  calloriaEnsurePlatformSupportStylesV651();';

function count(source, anchor) { return source.split(anchor).length - 1; }

function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.52 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function redactPlatformSupportTextV652(value) {
  return String(value ?? '')
    .slice(0, 1400)
    .replace(/\b(pin|password|passcode|otp|one[\s-]?time code)\b(\s*(?:is|:|=)?\s*)([^\s,;]+)/gi, (_match, label, separator) => `${label}${separator}[REDACTED]`)
    .replace(/\b(?:\d[ -]?){12,19}\b/g, '[REDACTED NUMBER]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/(?<![\w])\+?\d[\d\s().-]{8,}\d(?![\w])/g, '[REDACTED PHONE]')
    .trim();
}

export function createPlatformSupportCaseRecordV652(input, now, catalog) {
  const value = input && typeof input === 'object' ? input : {};
  const platformId = String(value.platformId || '');
  const guide = catalog?.[platformId];
  if (!guide) throw new TypeError('Select a supported RuffNeck service.');

  const customerReference = String(value.customerReference || '').trim().toUpperCase();
  if (!/^CUS-SIM-[A-Z0-9-]{2,28}$/.test(customerReference)) {
    throw new TypeError('Use a synthetic customer reference such as CUS-SIM-001.');
  }

  const customerName = String(value.customerName || `Customer ${customerReference.slice(-3)}`).trim().slice(0, 48);
  if (!/^(?:Customer|Learner|Player|Prospect|Tester)\s+[A-Z0-9-]{1,24}$/i.test(customerName)) {
    throw new TypeError('Use a synthetic label such as Customer 001, Learner 001 or Player 001.');
  }

  const requestType = String(value.requestType || '');
  if (!guide.requests.includes(requestType)) throw new TypeError('Select a request type listed for this service.');

  const priority = String(value.priority || 'normal').toLowerCase();
  const slaMinutesByPriority = { low: 2880, normal: 1440, high: 120, critical: 30 };
  if (!(priority in slaMinutesByPriority)) throw new TypeError('Select a valid support priority.');

  const details = redactPlatformSupportTextV652(value.details);
  if (details.length < 12) throw new TypeError('Enter at least 12 characters describing the issue and checks already performed.');

  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const sequence = Math.max(1, Math.floor(Number(value.sequence) || 1));
  const createdAt = new Date(timestamp).toISOString();
  const slaMinutes = slaMinutesByPriority[priority];
  const status = priority === 'critical' ? 'Escalated' : 'Open';
  const reference = `RNS-${timestamp.toString(36).toUpperCase()}-${String(sequence).padStart(3, '0')}`;
  const id = `RNS-ID-${timestamp.toString(36).toUpperCase()}-${sequence}`;
  const initialNote = 'Support case opened from the Workforce platform-support directory.';

  return {
    id,
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
    owner: String(value.owner || 'Agent').trim().slice(0, 48) || 'Agent',
    channel: 'Platform Support',
    qa: null,
    qaEligible: false,
    slaMinutes,
    slaDueAt: new Date(timestamp + slaMinutes * 60_000).toISOString(),
    createdAt,
    updatedAt: createdAt,
    resolvedAt: null,
    escalationReason: priority === 'critical' ? 'Critical-priority request requires specialist review.' : '',
    history: [{ status, note: initialNote, recordedAt: createdAt }],
    messages: [],
    source: 'calloria-platform-support-case-desk-v652',
  };
}

export function updatePlatformSupportCaseRecordV652(item, input, now) {
  if (!item || typeof item !== 'object' || !item.reference) throw new TypeError('The selected support case is unavailable.');
  const value = input && typeof input === 'object' ? input : {};
  const status = String(value.status || '');
  if (!['Open', 'In Progress', 'Escalated', 'Resolved'].includes(status)) throw new TypeError('Select a valid case status.');
  const note = redactPlatformSupportTextV652(value.note);
  const minimum = status === 'Resolved' ? 12 : 8;
  if (note.length < minimum) throw new TypeError(status === 'Resolved' ? 'A resolution note of at least 12 characters is required.' : 'Enter an update note of at least 8 characters.');

  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const recordedAt = new Date(timestamp).toISOString();
  if (!Array.isArray(item.history)) item.history = [];
  item.history.push({ status, note, recordedAt });
  item.history = item.history.slice(-40);
  item.status = status;
  item.disposition = status.toLowerCase().replaceAll(' ', '_');
  item.updatedAt = recordedAt;
  item.notes = `${String(item.notes || '').trim()}\n\n${status}: ${note}`.trim().slice(-2400);
  if (status === 'Resolved') item.resolvedAt = recordedAt;
  else item.resolvedAt = null;
  if (status === 'Escalated') item.escalationReason = note;
  else if (status === 'In Progress') item.escalationReason = item.priority === 'critical' ? item.escalationReason : '';
  return item;
}

const HELPER_SOURCE = `
const CALLORIA_PLATFORM_SUPPORT_CATALOG_V652 = ${JSON.stringify(PLATFORM_SUPPORT_CATALOG_V651)};
${redactPlatformSupportTextV652.toString()}
${createPlatformSupportCaseRecordV652.toString()}
${updatePlatformSupportCaseRecordV652.toString()}
function calloriaEnsurePlatformCaseStylesV652() {
  if (document.getElementById('calloriaPlatformCaseDeskStylesV652')) return;
  const style=document.createElement('style');style.id='calloriaPlatformCaseDeskStylesV652';
  style.textContent='.calloria-platform-case-desk{margin-top:14px;padding:14px;border:1px solid rgba(56,189,248,.2);border-radius:12px;background:rgba(56,189,248,.035)}.calloria-platform-case-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:12px}.calloria-platform-case-form{display:grid;gap:9px}.calloria-platform-case-form .form-field{margin:0}.calloria-platform-case-form input,.calloria-platform-case-form select,.calloria-platform-case-form textarea,.calloria-platform-case-update select,.calloria-platform-case-update textarea{width:100%;max-width:100%;box-sizing:border-box}.calloria-platform-case-list{display:grid;gap:9px}.calloria-platform-case{padding:11px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(148,163,184,.035);min-width:0}.calloria-platform-case-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap}.calloria-platform-case strong{font-size:12px}.calloria-platform-case p{font-size:11px;line-height:1.5;overflow-wrap:anywhere}.calloria-platform-case-meta{display:flex;gap:7px;flex-wrap:wrap;margin:7px 0}.calloria-platform-case-update{display:grid;grid-template-columns:minmax(110px,.7fr) minmax(0,1.3fr) auto;gap:7px;align-items:end;margin-top:10px}.calloria-platform-case-update label{display:grid;gap:4px;font-size:10px;color:var(--muted,#94a3b8)}.calloria-platform-case-update textarea{min-height:38px;resize:vertical}.calloria-platform-case-empty{padding:16px;border:1px dashed rgba(148,163,184,.25);border-radius:10px;color:var(--muted,#94a3b8);font-size:12px}.calloria-platform-case-note{font-size:10px;color:var(--muted,#94a3b8)}.calloria-platform-case-desk .ops-summary-grid{margin:10px 0}.calloria-platform-case-desk .metric-card strong{font-size:20px}@media(max-width:760px){.calloria-platform-case-grid{grid-template-columns:1fr}.calloria-platform-case-update{grid-template-columns:1fr}.calloria-platform-case-desk{padding:10px}}';
  document.head.append(style);
}
function calloriaRenderPlatformCaseDeskV652() {
  if (!Array.isArray(state.platformSupportCases)) state.platformSupportCases=[];
  const platformId=String(state.activePlatformId||'');
  const guide=CALLORIA_PLATFORM_SUPPORT_CATALOG_V652[platformId];
  if(!guide) return '<section class="calloria-platform-case-desk"><strong>RuffNeck support case desk</strong><p class="calloria-platform-case-note">Select one of the six RuffNeck services above to open a synthetic customer-support case and track its progress in CRM.</p></section>';
  const records=state.platformSupportCases.filter(item=>item&&item.platformId===platformId).slice().reverse();
  const open=records.filter(item=>item.status!=='Resolved').length;
  const escalated=records.filter(item=>item.status==='Escalated').length;
  const resolved=records.filter(item=>item.status==='Resolved').length;
  const requestOptions=guide.requests.map(item=>'<option value="'+escapeHTML(item)+'">'+escapeHTML(item)+'</option>').join('');
  const cases=records.length?records.map(item=>{
    const overdue=item.status!=='Resolved'&&Date.parse(item.slaDueAt)<Date.now();
    const statusClass=item.status==='Resolved'?'green':item.status==='Escalated'||overdue?'red':'amber';
    const updateForm=item.status==='Resolved'?'<span class="pill green">CLOSED</span>':'<form class="calloria-platform-case-update" data-platform-case-update><input type="hidden" name="reference" value="'+escapeHTML(item.reference)+'"><label>Update status<select name="status"><option>In Progress</option><option>Escalated</option><option>Resolved</option></select></label><label>Action / resolution note<textarea name="note" minlength="8" maxlength="500" required placeholder="Record checks performed, escalation owner or confirmed resolution."></textarea></label><button class="btn small outline" type="submit">Save update</button></form>';
    return '<article class="calloria-platform-case"><div class="calloria-platform-case-top"><div><strong>'+escapeHTML(item.reference)+'</strong><p>'+escapeHTML(item.customerName)+' · '+escapeHTML(item.customerReference)+'</p></div><span class="pill '+statusClass+'">'+escapeHTML(item.status.toUpperCase())+'</span></div><div class="calloria-platform-case-meta"><span class="pill">'+escapeHTML(item.priority.toUpperCase())+'</span><span class="pill">SLA '+escapeHTML(String(item.slaMinutes))+' MIN</span><span class="pill">'+(overdue?'OVERDUE':'DUE '+escapeHTML(new Date(item.slaDueAt).toLocaleString()))+'</span></div><p><strong>'+escapeHTML(item.requestType)+'</strong></p><p>'+escapeHTML(item.details)+'</p>'+updateForm+'</article>';
  }).join(''):'<div class="calloria-platform-case-empty">No support cases have been opened for this service in the current browser save.</div>';
  return '<section class="calloria-platform-case-desk"><div class="panel-head"><div><span class="subtle-label">WORKFORCE · SERVICE OPERATIONS</span><h3>RuffNeck support case desk</h3><p>Open, triage, escalate and resolve synthetic customer issues for '+escapeHTML(guide.name)+'.</p></div><span class="pill green">LOCAL SIMULATION</span></div><div class="ops-summary-grid"><article class="metric-card"><span>OPEN / IN PROGRESS</span><strong>'+open+'</strong><small>Awaiting closure</small></article><article class="metric-card"><span>ESCALATED</span><strong>'+escalated+'</strong><small>Specialist attention</small></article><article class="metric-card"><span>RESOLVED</span><strong>'+resolved+'</strong><small>Closed records</small></article></div><div class="calloria-platform-case-grid"><div><form id="platformSupportCaseForm" class="calloria-platform-case-form"><input type="hidden" name="platformId" value="'+escapeHTML(platformId)+'"><div class="form-field"><label>SYNTHETIC CUSTOMER REFERENCE</label><input name="customerReference" required maxlength="40" pattern="CUS-SIM-[A-Za-z0-9-]{2,28}" placeholder="CUS-SIM-001"><small class="calloria-platform-case-note">Use a fictional training identifier only. Do not enter real customer personal data.</small></div><div class="form-field"><label>CUSTOMER LABEL</label><input value="Customer 001" disabled><small class="calloria-platform-case-note">A synthetic label is generated from the customer reference.</small></div><div class="form-field"><label>REQUEST TYPE</label><select name="requestType" required>'+requestOptions+'</select></div><div class="form-field"><label>PRIORITY</label><select name="priority"><option value="normal">Normal · 24 hours</option><option value="low">Low · 48 hours</option><option value="high">High · 2 hours</option><option value="critical">Critical · 30 minutes and auto-escalate</option></select></div><div class="form-field"><label>ISSUE AND CHECKS ALREADY PERFORMED</label><textarea name="details" required minlength="12" maxlength="1000" rows="4" placeholder="Describe the fault, visible status, device/browser and checks already performed."></textarea></div><button class="btn primary" type="submit">Open support case →</button></form></div><div><div class="calloria-platform-case-list">'+cases+'</div></div></div><p class="calloria-platform-case-note">SLA values are simulated training targets, not live service commitments. Cases are stored in this browser save and copied to the local CRM case list; no RuffNeck production platform is contacted.</p></section>';
}
`;

const SUBMIT_HANDLER = `
document.addEventListener('submit',e=>{
  const form=e.target;
  if(form?.id==='platformSupportCaseForm'){
    e.preventDefault();
    const values=new FormData(form);
    try{
      const platformId=String(values.get('platformId')||'');
      const guide=CALLORIA_PLATFORM_SUPPORT_CATALOG_V652[platformId];
      if(!guide)throw new Error('Select a valid RuffNeck service before opening a case.');
      state.platformSupportCases=Array.isArray(state.platformSupportCases)?state.platformSupportCases:[];
      state.cases=Array.isArray(state.cases)?state.cases:[];
      const record=createPlatformSupportCaseRecordV652({platformId,customerReference:values.get('customerReference'),requestType:values.get('requestType'),priority:values.get('priority'),details:values.get('details'),sequence:state.platformSupportCases.length+1,owner:state.applicantName||'Agent'},Date.now(),CALLORIA_PLATFORM_SUPPORT_CATALOG_V652);
      state.platformSupportCases.push(record);
      state.platformSupportCases=state.platformSupportCases.slice(-300);
      state.cases.push({reference:record.reference,customer:record.customer,title:record.title,channel:'Platform Support',disposition:record.disposition,status:record.status,qa:null,qaEligible:false,owner:record.owner,notes:record.notes,createdAt:record.createdAt,messages:[],platformId:record.platformId,platformName:record.platformName,priority:record.priority,slaDueAt:record.slaDueAt});
      state.cases=state.cases.slice(-200);
      state.activePlatformId=platformId;
      createSystemEvent(state.systemEvents,platformId,'Opened platform support case',record.reference);
      pushOperationEvent('platform-support',record.reference,record.platformName+' case opened · '+record.requestType+'.',record.status.toLowerCase().replaceAll(' ','_'),{priority:record.priority,slaDueAt:record.slaDueAt});
      saveState();renderView();toast('Support case '+record.reference+' opened and added to CRM.','success');
    }catch(error){toast(error.message,'warning');}
    return;
  }
  if(form?.matches?.('[data-platform-case-update]')){
    e.preventDefault();
    const values=new FormData(form);
    const reference=String(values.get('reference')||'');
    const record=(state.platformSupportCases||[]).find(item=>item.reference===reference);
    if(!record){toast('The selected platform-support case could not be found.','error');return;}
    try{
      updatePlatformSupportCaseRecordV652(record,{status:values.get('status'),note:values.get('note')},Date.now());
      const mirror=(state.cases||[]).find(item=>item.reference===reference);
      if(mirror){mirror.status=record.status;mirror.disposition=record.disposition;mirror.notes=record.notes;mirror.slaDueAt=record.slaDueAt;}
      createSystemEvent(state.systemEvents,record.platformId,'Updated platform support case · '+record.status,record.reference);
      pushOperationEvent('platform-support',record.reference,'Support case '+record.status.toLowerCase()+'.',record.status.toLowerCase().replaceAll(' ','_'),{priority:record.priority});
      saveState();renderView();toast('Support case '+record.reference+' updated.','success');
    }catch(error){toast(error.message,'warning');}
    return;
  }
});
`;

export function transformMain(context, input) {
  const original = String(input || '');
  if (original.includes(MARKER)) return null;
  const anchors = [
    [STATE_ANCHOR, 'platform case save state'],
    [GUIDE_ANCHOR, 'platform support directory render point'],
    [QA_CELL_ANCHOR, 'CRM quality eligibility cell'],
    [CRM_ISSUE_ANCHOR, 'CRM case detail issue row'],
    [SUBMIT_LISTENER_ANCHOR, 'existing submit handler insertion point'],
    [WORKFORCE_RENDER_ANCHOR, 'v6.51 Workforce style activation'],
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.52 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }

  let code = original;
  code = replaceOnce(context, code, STATE_ANCHOR, `${STATE_ANCHOR}\n  platformSupportCases: [],`,'platform case save state'); if (code === null) return null;
  code = replaceOnce(context, code, WORKFORCE_RENDER_ANCHOR, `${HELPER_SOURCE}\nfunction renderWorkforce() {\n  calloriaEnsurePlatformSupportStylesV651();\n  calloriaEnsurePlatformCaseStylesV652();`,'v6.51 Workforce style activation'); if (code === null) return null;
  code = replaceOnce(context, code, GUIDE_ANCHOR, `${GUIDE_ANCHOR}\${calloriaRenderPlatformCaseDeskV652()}`,'platform support directory render point'); if (code === null) return null;
  code = replaceOnce(context, code, QA_CELL_ANCHOR, "<td>${c.qaEligible===false?'N/A':`${c.qa??0}%`}</td>",'CRM quality eligibility cell'); if (code === null) return null;
  const crmDetails = CRM_ISSUE_ANCHOR + '${c.platformName ? `<p><strong>Platform:</strong> ${escapeHTML(c.platformName)} · <strong>Priority:</strong> ${escapeHTML(String(c.priority||"normal").toUpperCase())} · <strong>SLA due:</strong> ${escapeHTML(c.slaDueAt ? new Date(c.slaDueAt).toLocaleString() : "—")}</p>` : ""}';
  code = replaceOnce(context, code, CRM_ISSUE_ANCHOR, crmDetails,'CRM case detail issue row'); if (code === null) return null;
  code = replaceOnce(context, code, SUBMIT_LISTENER_ANCHOR, `${SUBMIT_HANDLER}\n${SUBMIT_LISTENER_ANCHOR}`,'existing submit handler insertion point'); if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaPlatformSupportCaseDeskPluginV652() {
  return {
    name: 'calloria-platform-support-case-desk-v6-52',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!target.endsWith(MAIN_TARGET)) return null;
      return transformMain(this, source);
    },
  };
}

export const __calloriaV652Test = {
  transformMain,
  redact: redactPlatformSupportTextV652,
  create: (input, now=Date.now()) => createPlatformSupportCaseRecordV652(input, now, PLATFORM_SUPPORT_CATALOG_V651),
  update: updatePlatformSupportCaseRecordV652,
  catalog: PLATFORM_SUPPORT_CATALOG_V651,
  anchors: { STATE_ANCHOR, GUIDE_ANCHOR, QA_CELL_ANCHOR, CRM_ISSUE_ANCHOR, SUBMIT_LISTENER_ANCHOR, WORKFORCE_RENDER_ANCHOR },
  marker: MARKER,
};
