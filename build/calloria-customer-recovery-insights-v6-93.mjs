/**
 * CALLORIA v6.93 — Customer 360 recovery insights.
 * Adds evidence-led, read-only recovery guidance to the existing continuity card.
 */
const MAIN_TARGET = '/js/main.js';
const MAIN_MARKER = '__CALLORIA_CUSTOMER_RECOVERY_INSIGHTS_V693__';
const PANEL_ANCHOR = 'function renderCustomerContinuityPanel(customer, channel, identity = {}) {';
const RENDER_ANCHOR = 'function ensureInboundQueue(count = 6) {';
const CONTEXT_ANCHOR = '  const metrics = customerContinuityMetrics(state.customerContinuity);';
const HTML_ANCHOR = '</div>${openCases ?';

function count(source, anchor) {
  return String(source).split(anchor).length - 1;
}
function replaceExactlyOnce(source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    throw new Error(`CALLORIA v6.93 source rebase failed: ${label}; expected one anchor, found ${found}. No partial transform was applied.`);
  }
  return source.replace(anchor, replacement);
}

/** Pure classification function; it never changes CALLORIA save data. */
export function calloriaAnalyseCustomerRecoveryV693(context, now = Date.now()) {
  const profile = context?.profile || null;
  const interactions = (Array.isArray(profile?.interactions) ? profile.interactions : Array.isArray(context?.interactions) ? context.interactions : [])
    .filter(item => item && Number.isFinite(Date.parse(item.occurredAt)))
    .slice().sort((a,b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const recent24h = interactions.filter(item => now - Date.parse(item.occurredAt) >= 0 && now - Date.parse(item.occurredAt) <= 86400000);
  const recent72h = interactions.filter(item => now - Date.parse(item.occurredAt) >= 0 && now - Date.parse(item.occurredAt) <= 259200000);
  const recentChannels = new Set(recent72h.slice(0,3).map(item => String(item.channel || 'unknown')));
  const openCount = Array.isArray(context?.openCases) ? context.openCases.length : 0;
  const repeatWithin24h = recent24h.length >= 2;
  const channelBounce = recentChannels.size >= 2 && recent72h.length >= 2;
  const weakSentiment = interactions.slice(0,5).some(item => item.sentiment !== null && item.sentiment !== undefined && item.sentiment !== '' && Number.isFinite(Number(item.sentiment)) && Number(item.sentiment) <= 40);
  const weakQA = interactions.slice(0,5).some(item => item.qa !== null && item.qa !== undefined && item.qa !== '' && Number.isFinite(Number(item.qa)) && Number(item.qa) <= 60);
  const signals = [];
  if (repeatWithin24h) signals.push('More than one recorded contact in the last 24 hours.');
  if (channelBounce) signals.push('Recent contact history spans multiple channels.');
  if (openCount) signals.push(String(openCount) + ' recorded follow-up item(s) remain open.');
  if (weakSentiment) signals.push('A recent interaction recorded low customer sentiment.');
  if (weakQA) signals.push('A recent interaction has a QA score at or below 60%.');
  const high = (repeatWithin24h && openCount > 0) || openCount >= 2 || (repeatWithin24h && weakSentiment);
  const elevated = !high && (repeatWithin24h || (channelBounce && openCount > 0) || weakSentiment || weakQA || openCount > 0);
  const priority = high ? 'high' : elevated ? 'elevated' : 'routine';
  const effortScore = Math.min(100, (repeatWithin24h ? 25 : 0) + (channelBounce ? 20 : 0) + Math.min(30, openCount * 15) + (weakSentiment ? 15 : 0) + (weakQA ? 10 : 0));
  const actions = [];
  if (repeatWithin24h) actions.push('Acknowledge the repeat contact and summarise what has already been tried before asking new questions.');
  if (channelBounce) actions.push('Continue from the documented cross-channel history; confirm the reference instead of asking the customer to repeat the full story.');
  if (openCount) actions.push('Check the current owner, promised update and next due action for each open follow-up.');
  if (weakSentiment) actions.push('Acknowledge the impact and agree a useful next update; use supervisor support where policy requires it.');
  if (weakQA) actions.push('Review the prior QA evidence and approved knowledge before giving further advice.');
  if (!actions.length) actions.push('Capture the issue, preferred contact route and a specific next update so future agents can continue the case.');
  const confidence = context?.matchBasis === 'reference' ? 'REFERENCE MATCH' : context?.matchBasis === 'name' ? 'DISPLAY-NAME MATCH · VERIFY REFERENCE' : 'NO MATCHED HISTORY';
  return { priority, effortScore, signals, actions: actions.slice(0,4), repeatWithin24h, recent72h: recent72h.length, channelBounce, openCount, weakSentiment, weakQA, confidence, hasHistory: interactions.length > 0 };
}

/** HTML renderer is called only from the existing app's escaped Customer 360 context. */
export function calloriaRenderCustomerRecoveryV693(result) {
  const safe = value => escapeHTML(String(value ?? ''));
  const badge = result.priority === 'high' ? 'red' : result.priority === 'elevated' ? 'amber' : 'green';
  const title = result.priority === 'high' ? 'PRIORITY RECOVERY' : result.priority === 'elevated' ? 'RECOVERY ATTENTION' : 'ROUTINE CONTINUITY';
  const signals = result.signals.length
    ? '<ul class="calloria-recovery-signals">' + result.signals.map(item => '<li>'+safe(item)+'</li>').join('') + '</ul>'
    : '<p class="calloria-recovery-muted">No repeat-contact or unresolved-follow-up signal is present in the recorded history.</p>';
  const actions = result.actions.map((item,index) => '<li><b>'+String(index+1).padStart(2,'0')+'</b><span>'+safe(item)+'</span></li>').join('');
  const metrics = '<div class="calloria-recovery-metrics"><span><b>'+result.recent72h+'</b><small>CONTACTS · 72H</small></span><span><b>'+result.openCount+'</b><small>OPEN FOLLOW-UPS</small></span><span><b>'+result.effortScore+'</b><small>EFFORT SIGNAL</small></span></div>';
  const styleId = 'calloriaCustomerRecoveryStylesV693';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style'); style.id = styleId;
    style.textContent = '.calloria-recovery-brief{grid-column:1/-1;margin:12px 0 4px;padding:13px;border:1px solid rgba(148,163,184,.24);border-radius:12px;background:rgba(15,23,42,.035);min-width:0}.calloria-recovery-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.calloria-recovery-head h4{margin:0;font-size:13px}.calloria-recovery-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0}.calloria-recovery-metrics>span{display:block;min-width:0;padding:8px;border:1px solid rgba(148,163,184,.2);border-radius:9px}.calloria-recovery-metrics b{display:block;font-size:18px}.calloria-recovery-metrics small{display:block;font-size:9px;line-height:1.35;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-recovery-signals,.calloria-recovery-actions{margin:7px 0;padding-left:18px}.calloria-recovery-signals li{font-size:11px;line-height:1.45;margin:3px 0;overflow-wrap:anywhere}.calloria-recovery-actions{list-style:none;padding:0;display:grid;gap:6px}.calloria-recovery-actions li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:7px;font-size:11px;line-height:1.45}.calloria-recovery-actions li b{color:var(--muted,#94a3b8)}.calloria-recovery-muted,.calloria-recovery-foot{font-size:10px;line-height:1.45;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-recovery-foot{margin:9px 0 0}@media(max-width:520px){.calloria-recovery-brief{padding:10px}.calloria-recovery-metrics b{font-size:16px}.calloria-recovery-metrics small{font-size:8px}}';
    document.head.append(style);
  }
  return '<section class="calloria-recovery-brief" data-priority="'+safe(result.priority)+'" aria-label="Customer recovery guidance"><div class="calloria-recovery-head"><h4>Customer recovery brief</h4><span class="pill '+badge+'">'+title+'</span></div><p class="calloria-recovery-foot">History confidence: '+safe(result.confidence)+'. Read-only guidance based on recorded synthetic interactions.</p>'+metrics+signals+'<h4>Recommended handling</h4><ol class="calloria-recovery-actions">'+actions+'</ol><p class="calloria-recovery-foot">Signals support judgement; they do not authenticate identity, determine fault or replace approved service policy.</p></section>';
}

function runtimeHelpersV693() {
  return `${calloriaAnalyseCustomerRecoveryV693.toString()}\n${calloriaRenderCustomerRecoveryV693.toString()}`;
}

export function transformMainV693(source) {
  const input = String(source ?? '');
  if (input.includes(MAIN_MARKER)) return input;
  let code = input;
  const panelStart = code.indexOf(PANEL_ANCHOR);
  const nextFunction = code.indexOf(RENDER_ANCHOR, panelStart + PANEL_ANCHOR.length);
  if (panelStart < 0 || nextFunction < 0 || code.indexOf(PANEL_ANCHOR, panelStart + 1) >= 0) {
    throw new Error('CALLORIA v6.93 source rebase failed: unique customer continuity panel was not found. No partial transform was applied.');
  }
  let panel = code.slice(panelStart, nextFunction);
  panel = replaceExactlyOnce(panel, CONTEXT_ANCHOR,
    `${CONTEXT_ANCHOR}\n  const recovery = calloriaAnalyseCustomerRecoveryV693(context);\n  const recoveryPanel = calloriaRenderCustomerRecoveryV693(recovery);`,
    'customer continuity recovery analysis');
  panel = replaceExactlyOnce(panel, HTML_ANCHOR, '</div>${recoveryPanel}${openCases ?', 'Customer 360 recovery panel insertion');
  const helpers = runtimeHelpersV693();
  code = code.slice(0, panelStart) + `${helpers}\n${panel}` + code.slice(nextFunction);
  return `/* ${MAIN_MARKER} */\n${code}`;
}

export function calloriaCustomerRecoveryInsightsPluginV693() {
  return {
    name: 'calloria-customer-recovery-insights-v6-93',
    enforce: 'post',
    transform(code, id) {
      const normalized = String(id || '').replace(/\\/g, '/').replace(/[?#].*$/, '');
      if (!normalized.endsWith(MAIN_TARGET) || code.includes(MAIN_MARKER)) return null;
      try {
        return { code: transformMainV693(code), map: null };
      } catch (error) {
        this.error(error.message || String(error));
      }
    }
  };
}
