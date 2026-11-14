/**
 * CALLORIA v6.53 — Support SLA Command Centre.
 * Extends the synthetic v6.52 RuffNeck case desk with a cross-platform queue,
 * live SLA ageing, due-soon alerts and auditable automatic breach escalation.
 * All records remain browser-local simulation data.
 */
import { PLATFORM_SUPPORT_CATALOG_V651 } from './calloria-ruffneck-platform-support-v6-51.mjs';

const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_SUPPORT_SLA_COMMAND_CENTRE_V653__';
const STATE_ANCHOR = 'platformSupportCases: [],';
const RENDER_ANCHOR = '${calloriaRenderPlatformCaseDeskV652()}';
const WORKFORCE_ANCHOR = 'function renderWorkforce() {\n  calloriaEnsurePlatformSupportStylesV651();\n  calloriaEnsurePlatformCaseStylesV652();';
const SUBMIT_ANCHOR = "document.addEventListener('submit',e=>{\n  const form=e.target;\n  if(form?.id==='platformSupportCaseForm'){";

const SUPPORT_PLATFORMS = Object.entries(PLATFORM_SUPPORT_CATALOG_V651).map(([id, item]) => ({ id, name: item.name }));

function count(source, anchor) { return source.split(anchor).length - 1; }
function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.53 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function classifyPlatformSupportSlaV653(item, now = Date.now()) {
  if (!item || typeof item !== 'object') return { state: 'invalid', remainingMs: null, elapsedPercent: 0 };
  if (item.status === 'Resolved') return { state: 'resolved', remainingMs: null, elapsedPercent: 100 };
  const created = Date.parse(item.createdAt);
  const due = Date.parse(item.slaDueAt);
  if (!Number.isFinite(created) || !Number.isFinite(due) || due <= created) {
    return { state: 'invalid', remainingMs: null, elapsedPercent: 0 };
  }
  const duration = due - created;
  const remainingMs = due - Number(now);
  const elapsedPercent = Math.max(0, Math.min(100, ((Number(now) - created) / duration) * 100));
  if (remainingMs <= 0) return { state: 'overdue', remainingMs, elapsedPercent };
  const dueSoonThreshold = Math.max(5 * 60_000, duration * 0.2);
  if (remainingMs <= dueSoonThreshold) return { state: 'due_soon', remainingMs, elapsedPercent };
  return { state: 'on_track', remainingMs, elapsedPercent };
}

export function formatPlatformSupportTimeV653(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value)) return 'Time unavailable';
  const absolute = Math.abs(value);
  const totalMinutes = Math.floor(absolute / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return value < 0 ? `${parts.join(' ')} overdue` : `${parts.join(' ')} remaining`;
}

export function getPlatformSupportCommandMetricsV653(records = [], now = Date.now()) {
  const safe = Array.isArray(records) ? records.filter(item => item && typeof item === 'object') : [];
  const metrics = { total: safe.length, active: 0, dueSoon: 0, overdue: 0, escalated: 0, resolved: 0, invalidSla: 0, byPlatform: {} };
  for (const item of safe) {
    const sla = classifyPlatformSupportSlaV653(item, now);
    if (!metrics.byPlatform[item.platformId]) metrics.byPlatform[item.platformId] = { total: 0, active: 0, dueSoon: 0, overdue: 0, escalated: 0, resolved: 0 };
    const platform = metrics.byPlatform[item.platformId];
    platform.total += 1;
    if (item.status === 'Resolved') { metrics.resolved += 1; platform.resolved += 1; continue; }
    metrics.active += 1; platform.active += 1;
    if (item.status === 'Escalated') { metrics.escalated += 1; platform.escalated += 1; }
    if (sla.state === 'due_soon') { metrics.dueSoon += 1; platform.dueSoon += 1; }
    if (sla.state === 'overdue') { metrics.overdue += 1; platform.overdue += 1; }
    if (sla.state === 'invalid') metrics.invalidSla += 1;
  }
  return metrics;
}

export function escalateBreachedPlatformSupportCasesV653(state, now = Date.now()) {
  if (!state || typeof state !== 'object') throw new TypeError('A valid simulation state is required.');
  if (!Array.isArray(state.platformSupportCases)) state.platformSupportCases = [];
  if (!Array.isArray(state.cases)) state.cases = [];
  if (!Array.isArray(state.systemEvents)) state.systemEvents = [];
  const timestamp = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  const recordedAt = new Date(timestamp).toISOString();
  const escalated = [];

  for (const item of state.platformSupportCases) {
    if (!item || item.status === 'Resolved' || item.status === 'Escalated') continue;
    const sla = classifyPlatformSupportSlaV653(item, timestamp);
    if (sla.state !== 'overdue') continue;
    const note = `Automatic SLA breach escalation at ${recordedAt}; the case exceeded its ${Math.max(0, Number(item.slaMinutes) || 0)}-minute simulated response target.`;
    item.status = 'Escalated';
    item.disposition = 'escalated';
    item.updatedAt = recordedAt;
    item.slaBreachAt = recordedAt;
    item.slaEscalatedAt = recordedAt;
    item.escalationReason = note;
    if (!Array.isArray(item.history)) item.history = [];
    item.history.push({ status: 'Escalated', note, recordedAt, source: 'sla-watchdog-v653' });
    item.history = item.history.slice(-40);
    item.notes = `${String(item.notes || '').trim()}\n\nEscalated: ${note}`.trim().slice(-2400);

    const mirror = state.cases.find(entry => entry && entry.reference === item.reference);
    if (mirror) {
      mirror.status = 'Escalated';
      mirror.disposition = 'escalated';
      mirror.notes = item.notes;
      mirror.slaDueAt = item.slaDueAt;
      mirror.slaBreachAt = recordedAt;
    }
    state.systemEvents.push({
      id: `SYS-SLA-${timestamp}-${escalated.length + 1}`,
      systemId: item.platformId,
      action: 'Automatic SLA breach escalation',
      reference: item.reference,
      at: recordedAt,
      dataClass: 'synthetic',
      status: 'simulated_only',
    });
    state.systemEvents = state.systemEvents.slice(-300);
    escalated.push({ reference: item.reference, platformId: item.platformId, platformName: item.platformName || item.platformId, priority: item.priority || 'normal', slaDueAt: item.slaDueAt, recordedAt });
  }
  return escalated;
}

const HELPER_SOURCE = `
const CALLORIA_SUPPORT_PLATFORMS_V653 = ${JSON.stringify(SUPPORT_PLATFORMS)};
${classifyPlatformSupportSlaV653.toString()}
${formatPlatformSupportTimeV653.toString()}
${getPlatformSupportCommandMetricsV653.toString()}
${escalateBreachedPlatformSupportCasesV653.toString()}
function calloriaEnsureSupportCommandStylesV653(){
  if(document.getElementById('calloriaSupportCommandStylesV653'))return;
  const style=document.createElement('style');style.id='calloriaSupportCommandStylesV653';
  style.textContent='.calloria-support-command{margin:14px 0;padding:14px;border:1px solid rgba(56,189,248,.22);border-radius:13px;background:rgba(15,23,42,.24)}.calloria-support-command-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.calloria-support-command-head h3{margin:3px 0}.calloria-support-command-head p{font-size:11px;color:var(--muted,#94a3b8);margin:4px 0}.calloria-support-command-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:12px 0}.calloria-support-command-metric{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.035);min-width:0}.calloria-support-command-metric span{display:block;font-size:9px;letter-spacing:.08em;color:var(--muted,#94a3b8);text-transform:uppercase}.calloria-support-command-metric strong{display:block;font-size:22px;margin-top:4px}.calloria-support-command-filters{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.calloria-support-command-filters label{display:grid;gap:4px;font-size:10px;color:var(--muted,#94a3b8)}.calloria-support-command-filters select{width:100%;min-width:0;box-sizing:border-box}.calloria-support-queue{display:grid;gap:8px}.calloria-support-queue-item{padding:10px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.035);min-width:0}.calloria-support-queue-top{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.calloria-support-queue-item p{font-size:11px;line-height:1.45;margin:5px 0;overflow-wrap:anywhere}.calloria-support-queue-meta{display:flex;gap:6px;flex-wrap:wrap;margin:7px 0}.calloria-support-sla-track{height:6px;border-radius:10px;background:rgba(148,163,184,.18);overflow:hidden;margin:8px 0}.calloria-support-sla-track i{display:block;height:100%;border-radius:10px;background:var(--accent,#38bdf8)}.calloria-support-sla-track i.due{background:#f59e0b}.calloria-support-sla-track i.breach{background:#ef4444}.calloria-support-queue-empty{padding:16px;border:1px dashed rgba(148,163,184,.25);border-radius:10px;color:var(--muted,#94a3b8);font-size:12px}.calloria-support-command-foot{font-size:10px;color:var(--muted,#94a3b8);margin:10px 0 0}@media(max-width:820px){.calloria-support-command-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-support-command-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:520px){.calloria-support-command{padding:10px}.calloria-support-command-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.calloria-support-command-filters{grid-template-columns:1fr}}';
  document.head.append(style);
}
function calloriaRenderSupportCommandCentreV653(now=Date.now()){
  if(!Array.isArray(state.platformSupportCases))state.platformSupportCases=[];
  if(!state.platformSupportQueueFilters||typeof state.platformSupportQueueFilters!=='object')state.platformSupportQueueFilters={service:'all',status:'active',priority:'all',sort:'sla'};
  const filters=state.platformSupportQueueFilters;
  const records=state.platformSupportCases.filter(item=>item&&typeof item==='object');
  const metrics=getPlatformSupportCommandMetricsV653(records,now);
  const serviceOptions='<option value="all">All RuffNeck services</option>'+CALLORIA_SUPPORT_PLATFORMS_V653.map(item=>'<option value="'+escapeHTML(item.id)+'" '+(filters.service===item.id?'selected':'')+'>'+escapeHTML(item.name)+'</option>').join('');
  const statusOptions=[['active','Active cases'],['due_soon','Due soon'],['overdue','Overdue'],['escalated','Escalated'],['resolved','Resolved'],['all','All statuses']].map(([value,label])=>'<option value="'+value+'" '+(filters.status===value?'selected':'')+'>'+label+'</option>').join('');
  const priorityOptions=[['all','All priorities'],['critical','Critical'],['high','High'],['normal','Normal'],['low','Low']].map(([value,label])=>'<option value="'+value+'" '+(filters.priority===value?'selected':'')+'>'+label+'</option>').join('');
  const sortOptions=[['sla','Nearest SLA first'],['newest','Newest first'],['oldest','Oldest first']].map(([value,label])=>'<option value="'+value+'" '+(filters.sort===value?'selected':'')+'>'+label+'</option>').join('');
  let list=records.filter(item=>{
    if(filters.service!=='all'&&item.platformId!==filters.service)return false;
    if(filters.priority!=='all'&&String(item.priority||'normal').toLowerCase()!==filters.priority)return false;
    const sla=classifyPlatformSupportSlaV653(item,now);
    if(filters.status==='active'&&item.status==='Resolved')return false;
    if(filters.status==='due_soon'&&sla.state!=='due_soon')return false;
    if(filters.status==='overdue'&&sla.state!=='overdue')return false;
    if(filters.status==='escalated'&&item.status!=='Escalated')return false;
    if(filters.status==='resolved'&&item.status!=='Resolved')return false;
    return true;
  });
  list.sort((a,b)=>{
    if(filters.sort==='newest')return Date.parse(b.createdAt)-Date.parse(a.createdAt);
    if(filters.sort==='oldest')return Date.parse(a.createdAt)-Date.parse(b.createdAt);
    const ad=a.status==='Resolved'?Infinity:Date.parse(a.slaDueAt);const bd=b.status==='Resolved'?Infinity:Date.parse(b.slaDueAt);return ad-bd;
  });
  const cards=list.slice(0,80).map(item=>{
    const sla=classifyPlatformSupportSlaV653(item,now);
    const label=sla.state==='resolved'?'RESOLVED':sla.state==='overdue'?'SLA BREACHED':sla.state==='due_soon'?'DUE SOON':sla.state==='invalid'?'SLA UNKNOWN':'ON TRACK';
    const pill=sla.state==='overdue'||item.status==='Escalated'?'red':sla.state==='due_soon'?'amber':sla.state==='resolved'?'green':'blue';
    const progressClass=sla.state==='overdue'?'breach':sla.state==='due_soon'?'due':'';
    const time=sla.state==='resolved'?'Resolved '+escapeHTML(item.resolvedAt?new Date(item.resolvedAt).toLocaleString():'') : sla.state==='invalid'?'Response target unavailable':formatPlatformSupportTimeV653(sla.remainingMs);
    return '<article class="calloria-support-queue-item"><div class="calloria-support-queue-top"><strong>'+escapeHTML(item.reference||'Support case')+'</strong><span class="pill '+pill+'">'+label+'</span></div><p><strong>'+escapeHTML(item.platformName||item.platformId||'RuffNeck service')+'</strong> · '+escapeHTML(item.customerName||item.customerReference||'Synthetic customer')+'</p><p>'+escapeHTML(item.requestType||item.title||'Support request')+'</p><div class="calloria-support-queue-meta"><span class="pill">'+escapeHTML(String(item.priority||'normal').toUpperCase())+'</span><span class="pill">'+escapeHTML(item.status||'Open')+'</span><span class="pill">'+escapeHTML(time)+'</span></div><div class="calloria-support-sla-track"><i class="'+progressClass+'" style="width:'+Math.round(sla.elapsedPercent)+'%"></i></div><p class="calloria-support-command-foot">Created '+escapeHTML(item.createdAt?new Date(item.createdAt).toLocaleString():'—')+' · SLA due '+escapeHTML(item.slaDueAt?new Date(item.slaDueAt).toLocaleString():'—')+'</p></article>';
  }).join('');
  return '<section class="calloria-support-command"><div class="calloria-support-command-head"><div><span class="subtle-label">SUPERVISOR · MULTI-PLATFORM OPERATIONS</span><h3>Support SLA command centre</h3><p>One queue across all six RuffNeck services, sorted by response deadline.</p></div><span class="pill green">SIMULATED CASES</span></div><div class="calloria-support-command-metrics"><article class="calloria-support-command-metric"><span>Active cases</span><strong>'+metrics.active+'</strong></article><article class="calloria-support-command-metric"><span>Due soon</span><strong>'+metrics.dueSoon+'</strong></article><article class="calloria-support-command-metric"><span>Overdue</span><strong>'+metrics.overdue+'</strong></article><article class="calloria-support-command-metric"><span>Escalated</span><strong>'+metrics.escalated+'</strong></article><article class="calloria-support-command-metric"><span>Resolved</span><strong>'+metrics.resolved+'</strong></article></div><div id="platformSupportQueueFilters" class="calloria-support-command-filters"><label>Service<select name="service">'+serviceOptions+'</select></label><label>Queue view<select name="status">'+statusOptions+'</select></label><label>Priority<select name="priority">'+priorityOptions+'</select></label><label>Sort order<select name="sort">'+sortOptions+'</select></label></div><div class="calloria-support-queue">'+(cards||'<div class="calloria-support-queue-empty">No cases match these filters. New service tickets opened above will appear here automatically.</div>')+'</div><p class="calloria-support-command-foot">'+list.length+' matching case(s) · '+metrics.invalidSla+' case(s) with invalid SLA timestamps. The queue refreshes every 30 seconds while this browser tab is active.</p></section>';
}
function calloriaInstallSupportSlaWatchdogV653(){
  if(window.__CALLORIA_SUPPORT_SLA_WATCHDOG_V653__)return;
  window.__CALLORIA_SUPPORT_SLA_WATCHDOG_V653__=true;
  const run=()=>{
    const changes=escalateBreachedPlatformSupportCasesV653(state,Date.now());
    if(!changes.length)return;
    saveState();
    for(const item of changes){
      try{if(typeof pushOperationEvent==='function')pushOperationEvent('platform-support-sla',item.reference,'Response target breached; case automatically escalated for supervisor attention.','escalated',{platformId:item.platformId,priority:item.priority,slaDueAt:item.slaDueAt});}catch{}
    }
    try{if(typeof toast==='function')toast(changes.length+' platform support case(s) automatically escalated after SLA breach.','warning');}catch{}
    if(state.currentView==='workforce')renderView();
  };
  window.setInterval(()=>{if(document.visibilityState!=='hidden')run();},30000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run();});
  run();
}
`;

const TOP_LEVEL_BRIDGE = `
calloriaInstallSupportSlaWatchdogV653();
document.addEventListener('change',e=>{
  const select=e.target;
  if(!select||!select.closest||!select.closest('#platformSupportQueueFilters'))return;
  if(!['service','status','priority','sort'].includes(select.name))return;
  state.platformSupportQueueFilters=state.platformSupportQueueFilters||{};
  state.platformSupportQueueFilters[select.name]=select.value;
  saveState();renderView();
});
`;

export function transformMain(context, input) {
  const original = String(input || '');
  if (original.includes(MARKER)) return null;
  const anchors = [
    [STATE_ANCHOR, 'support queue filter save state'],
    [RENDER_ANCHOR, 'v6.52 service case desk render point'],
    [WORKFORCE_ANCHOR, 'v6.52 Workforce case-desk activation'],
    [SUBMIT_ANCHOR, 'v6.52 support case submit listener'],
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.53 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }
  let code = original;
  code = replaceOnce(context, code, STATE_ANCHOR, `${STATE_ANCHOR}\n  platformSupportQueueFilters: { service: 'all', status: 'active', priority: 'all', sort: 'sla' },`, 'support queue filter save state'); if (code === null) return null;
  code = replaceOnce(context, code, WORKFORCE_ANCHOR, `${HELPER_SOURCE}\n${WORKFORCE_ANCHOR}\n  calloriaEnsureSupportCommandStylesV653();\n  const calloriaSlaEscalationsV653=escalateBreachedPlatformSupportCasesV653(state,Date.now());\n  if(calloriaSlaEscalationsV653.length)saveState();`, 'v6.52 Workforce case-desk activation'); if (code === null) return null;
  code = replaceOnce(context, code, RENDER_ANCHOR, `${RENDER_ANCHOR}\${calloriaRenderSupportCommandCentreV653()}`, 'v6.52 service case desk render point'); if (code === null) return null;
  code = replaceOnce(context, code, SUBMIT_ANCHOR, `${TOP_LEVEL_BRIDGE}\n${SUBMIT_ANCHOR}`, 'v6.52 support case submit listener'); if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaSupportSlaCommandCentrePluginV653() {
  return {
    name: 'calloria-support-sla-command-centre-v6-53',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!target.endsWith(MAIN_TARGET)) return null;
      return transformMain(this, source);
    },
  };
}

export const __calloriaV653Test = {
  transformMain,
  classify: classifyPlatformSupportSlaV653,
  formatTime: formatPlatformSupportTimeV653,
  metrics: getPlatformSupportCommandMetricsV653,
  escalate: escalateBreachedPlatformSupportCasesV653,
  platforms: SUPPORT_PLATFORMS,
  anchors: { STATE_ANCHOR, RENDER_ANCHOR, WORKFORCE_ANCHOR, SUBMIT_ANCHOR },
  marker: MARKER,
};
