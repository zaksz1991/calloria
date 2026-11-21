/**
 * CALLORIA v6.92 — Agent handover preflight and reconciliation.
 * Read-only companion for the existing Agent shift handover workspace.
 * It uses the existing handover engine and local save; it never transfers work.
 */
import {
  collectAgentHandoverCandidates,
  normalizeAgentHandovers,
  agentShiftHandoverMetrics
} from './agent-handover-engine.js';

export const AGENT_HANDOVER_PREFLIGHT_VERSION = '6.92.0';
const SAVE_PREFIX = 'calloria.save.';
const LEGACY_SAVE_KEY = 'floorshift3d.save.v1';
const TYPE_LABELS = Object.freeze({
  digital_contact: 'Digital conversation',
  customer_commitment: 'Customer callback promise',
  case_followup: 'Reopened case follow-up',
  open_case: 'Open CRM case'
});

const asArray = value => Array.isArray(value) ? value : [];
const cleanText = (value, max = 240) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[ch]);
const safeDateLabel = value => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

function initialsFor(name) {
  return cleanText(name, 100).split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'AP';
}

/**
 * Creates a read-only eligibility and readiness report using the same engine
 * functions as the current Agent shift handover view.
 */
export function buildAgentHandoverPreflight(state = {}, engine = {}) {
  const collect = engine.collectAgentHandoverCandidates || collectAgentHandoverCandidates;
  const normalise = engine.normalizeAgentHandovers || normalizeAgentHandovers;
  const metricsFor = engine.agentShiftHandoverMetrics || agentShiftHandoverMetrics;
  const actor = cleanText(state.applicantName || 'Customer Experience Agent', 100);
  const initials = cleanText(state.nameInitials || initialsFor(actor), 12).toUpperCase();
  const actorId = `EMP-${initials}`;
  const commitmentsState = state.customerCommitments && typeof state.customerCommitments === 'object'
    ? state.customerCommitments : {};
  const resources = {
    cases: asArray(state.cases),
    commitments: asArray(commitmentsState.commitments),
    commitmentState: commitmentsState,
    digitalQueue: asArray(state.digitalQueue),
    callbacks: asArray(state.callbacks)
  };
  const handovers = normalise(asArray(state.agentHandovers));
  const candidates = collect(resources, actor, actorId, handovers);
  const metrics = metricsFor(handovers);
  const activeInteraction = {
    inbound: Boolean(state.currentCall),
    outbound: Boolean(state.activeOutbound),
    afterContact: Boolean(state.wrapUp)
  };
  const activeBlockers = Object.entries(activeInteraction).filter(([, value]) => value).map(([key]) => key);
  const pendingIncoming = handovers.filter(item => item.status === 'pending_acceptance' && item.toAgentId === actorId).length;
  const pendingOutgoing = handovers.filter(item => item.status === 'pending_acceptance' && item.fromAgentId === actorId).length;
  const typeCounts = Object.fromEntries(Object.keys(TYPE_LABELS).map(type => [
    type, candidates.filter(item => item.type === type).length
  ]));
  const supervisorReviewCases = resources.cases.filter(record => record?.lifecycle?.followUp?.status === 'supervisor_review').length;
  const digitalNotOwned = resources.digitalQueue.filter(item =>
    ['active', 'awaiting_customer'].includes(item?.status) && item?.assignedTo && item.assignedTo !== actorId
  ).length;
  const queuedDigital = resources.digitalQueue.filter(item => item?.status === 'queued').length;
  const linkedCallbackIds = [...new Set(candidates.flatMap(item => asArray(item.callbackIds).map(String)))];
  const readiness = activeBlockers.length ? 'blocked' : candidates.length ? 'ready' : 'no-work';
  const message = readiness === 'blocked'
    ? 'Complete the live voice/outbound interaction and after-contact work before preparing a handover.'
    : readiness === 'ready'
      ? 'Eligible owned work is available. Review the list, write a clear next-step note and name the incoming agent.'
      : 'No eligible open work is currently owned by this agent. Check the queue and ownership records before closing the shift.';

  return {
    version: AGENT_HANDOVER_PREFLIGHT_VERSION,
    actor,
    actorId,
    day: Math.max(1, Math.floor(Number(state.day) || 1)),
    shiftActive: state.shiftActive === true,
    agentStatus: cleanText(state.agentStatus || (state.shiftActive ? 'available' : 'offline'), 40),
    readiness,
    message,
    activeInteraction,
    activeBlockers,
    candidates,
    typeCounts,
    metrics,
    pendingIncoming,
    pendingOutgoing,
    supervisorReviewCases,
    digitalNotOwned,
    queuedDigital,
    linkedCallbackCount: linkedCallbackIds.length,
    candidateCount: candidates.length,
    generatedAt: new Date().toISOString()
  };
}

function markdownCell(value) {
  return cleanText(value, 500).replace(/[|]/g, '\\|').replace(/\r?\n/g, ' ');
}

export function buildAgentHandoverAuditMarkdown(report, generatedAt = new Date()) {
  if (!report || typeof report !== 'object') throw new TypeError('A handover preflight report is required.');
  const date = generatedAt instanceof Date ? generatedAt : new Date(generatedAt);
  const generatedLabel = Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
  const readinessLabel = report.readiness === 'ready' ? 'READY TO PREPARE'
    : report.readiness === 'blocked' ? 'BLOCKED BY ACTIVE INTERACTION' : 'NO ELIGIBLE WORK';
  const rows = asArray(report.candidates).length
    ? report.candidates.map((item, index) => `${index + 1}. **${markdownCell(item.priority).toUpperCase()} — ${markdownCell(TYPE_LABELS[item.type] || 'Customer work')}**\n   - Customer: ${markdownCell(item.customer)}\n   - Reference: ${markdownCell(item.reference)}\n   - Channel: ${markdownCell(item.channel)}\n   - Subject: ${markdownCell(item.subject)}\n   - Due: ${markdownCell(item.dueLabel || 'Not supplied')}\n   - Linked callback references: ${asArray(item.callbackIds).length}`).join('\n')
    : 'No currently eligible work items were found.';
  const blockers = report.activeBlockers.length
    ? report.activeBlockers.map(item => `- ${item.replaceAll('-', ' ')}`).join('\n')
    : '- None';
  return [
    '# CALLORIA — Agent Shift Handover Preflight',
    '',
    `Generated: ${generatedLabel}`,
    `Employee: ${markdownCell(report.actor)} (${markdownCell(report.actorId)})`,
    `Simulation day: ${report.day}`,
    `Shift status: ${report.shiftActive ? 'Active' : 'Off shift'}`,
    `Agent state: ${markdownCell(report.agentStatus)}`,
    `Preflight: ${readinessLabel}`,
    '',
    '## Readiness',
    markdownCell(report.message),
    '',
    '## Work eligible for two-party handover',
    `Total: ${report.candidateCount}`,
    `- Digital conversations: ${report.typeCounts.digital_contact}`,
    `- Customer callback promises: ${report.typeCounts.customer_commitment}`,
    `- Reopened case follow-ups: ${report.typeCounts.case_followup}`,
    `- Open CRM cases: ${report.typeCounts.open_case}`,
    '',
    rows,
    '',
    '## Pending handover history',
    `- Incoming handovers awaiting this agent: ${report.pendingIncoming}`,
    `- Outgoing handovers awaiting acceptance: ${report.pendingOutgoing}`,
    `- Previously transferred items: ${report.metrics.transferredItems}`,
    `- Stale or skipped items: ${report.metrics.staleItems}`,
    '',
    '## Items requiring a different route or review',
    `- Active digital conversations owned by another employee: ${report.digitalNotOwned}`,
    `- Queued digital contacts not yet assigned: ${report.queuedDigital}`,
    `- CRM follow-ups awaiting supervisor review: ${report.supervisorReviewCases}`,
    `- Active voice/outbound/wrap-up blockers: ${report.activeBlockers.length}`,
    blockers,
    '',
    '## Handover controls',
    '- The preflight is read-only. It does not transfer, close, accept, reassign or edit work.',
    '- The existing workflow keeps ownership with the outgoing agent until the named incoming agent accepts.',
    '- Callback records are not transferred as separate work items; linked IDs remain references to the eligible promise/case.',
    '- The incoming agent name acknowledgement is local simulation behaviour, not enterprise identity authentication.',
    '- Review the actual handover form and record customer risk, actions completed, due times and the next required step.',
    '',
    'CALLORIA · SIMULATED OPERATIONS · NO REAL CUSTOMER RECORDS',
    ''
  ].join('\n');
}

export function renderAgentHandoverPreflightHTML(report) {
  const stateClass = report.readiness === 'ready' ? 'ready' : report.readiness === 'blocked' ? 'blocked' : 'empty';
  const statusLabel = report.readiness === 'ready' ? 'READY TO PREPARE'
    : report.readiness === 'blocked' ? 'ACTIVE WORK BLOCKS HANDOVER' : 'NO ELIGIBLE WORK';
  const breakdown = [
    ['Digital conversations', report.typeCounts.digital_contact],
    ['Customer promises', report.typeCounts.customer_commitment],
    ['Case follow-ups', report.typeCounts.case_followup],
    ['Open CRM cases', report.typeCounts.open_case]
  ].map(([label, count]) => `<div class="calloria-handover-preflight-row"><span>${label}</span><strong>${count}</strong></div>`).join('');
  return `<section class="panel calloria-handover-preflight" data-calloria-handover-preflight aria-label="Handover readiness preflight">
    <div class="calloria-handover-preflight-head"><div><span class="calloria-handover-preflight-kicker">CALLORIA · SHIFT CONTINUITY</span><h3>Handover preflight & reconciliation</h3><p>Independent read-only check using the current two-party handover rules.</p></div><span class="calloria-handover-preflight-state ${stateClass}" role="status">${statusLabel}</span></div>
    <p class="calloria-handover-preflight-message">${escapeHTML(report.message)}</p>
    <div class="calloria-handover-preflight-grid">
      <div class="calloria-handover-preflight-box"><span>ELIGIBLE OWNED WORK</span><strong>${report.candidateCount}</strong><small>Work items currently eligible for transfer</small>${breakdown}</div>
      <div class="calloria-handover-preflight-box"><span>HANDOVER CONTROLS</span><div class="calloria-handover-preflight-row"><span>Incoming handovers awaiting you</span><strong>${report.pendingIncoming}</strong></div><div class="calloria-handover-preflight-row"><span>Your outgoing handovers awaiting acceptance</span><strong>${report.pendingOutgoing}</strong></div><div class="calloria-handover-preflight-row"><span>Previously transferred items</span><strong>${report.metrics.transferredItems}</strong></div><div class="calloria-handover-preflight-row"><span>Stale / skipped items</span><strong>${report.metrics.staleItems}</strong></div></div>
    </div>
    <details class="calloria-handover-preflight-exclusions"><summary>Review work outside this handover (${report.supervisorReviewCases + report.digitalNotOwned + report.queuedDigital + report.activeBlockers.length})</summary><div class="calloria-handover-preflight-exclusion-grid">
      <div><strong>${report.activeBlockers.length}</strong><span>Live voice, outbound or after-contact blockers</span></div>
      <div><strong>${report.supervisorReviewCases}</strong><span>Follow-ups awaiting supervisor review</span></div>
      <div><strong>${report.digitalNotOwned}</strong><span>Active digital work owned by another agent</span></div>
      <div><strong>${report.queuedDigital}</strong><span>Unassigned digital queue contacts</span></div>
    </div><p>These records are not counted as this employee's transferable owned work. Use their appropriate live queue, ownership or supervisor workflow; do not treat them as lost.</p></details>
    <div class="calloria-handover-preflight-actions"><button type="button" class="btn small outline" data-handover-audit-download>Download handover audit (.md)</button><button type="button" class="btn small secondary" data-handover-audit-copy>Copy handover audit</button></div>
    <p class="calloria-handover-preflight-feedback" data-handover-audit-feedback aria-live="polite">${report.linkedCallbackCount} linked callback reference(s) are associated with eligible items. Callback records are not transferred as separate work items.</p>
  </section>`;
}

function parseSave(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw);
    return state && typeof state === 'object' && !Array.isArray(state) ? state : null;
  } catch { return null; }
}

function readCurrentState(storage, preferredKey = '') {
  if (preferredKey) {
    const preferred = parseSave(storage, preferredKey);
    if (preferred) return { key: preferredKey, state: preferred };
  }
  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key === LEGACY_SAVE_KEY || (typeof key === 'string' && key.startsWith(SAVE_PREFIX))) keys.push(key);
    }
  } catch { return null; }
  keys.sort((a, b) => (a === 'calloria.save.v1' ? -1 : b === 'calloria.save.v1' ? 1 : a.includes('.cloud.') ? -1 : b.includes('.cloud.') ? 1 : 0));
  for (const key of keys) {
    const state = parseSave(storage, key);
    if (state && (state.stage === 'employee' || state.hired === true || state.applicantName)) return { key, state };
  }
  return null;
}

function safeSlug(value) {
  return cleanText(value, 50).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'employee';
}

export function installAgentHandoverPreflight(windowRef = globalThis.window, documentRef = globalThis.document) {
  if (!windowRef || !documentRef || !documentRef.body || !windowRef.localStorage) return () => {};
  if (windowRef.__CALLORIA_AGENT_HANDOVER_PREFLIGHT_V692__) return () => {};
  const viewRoot = documentRef.querySelector('#viewRoot');
  const pageTitle = documentRef.querySelector('#pageTitle');
  if (!viewRoot || !pageTitle) return () => {};

  let activeKey = '';
  let lastSignature = '';
  let timer = null;
  let observer = null;
  let scheduled = false;
  let disposed = false;
  const storage = windowRef.localStorage;
  const storageProto = windowRef.Storage?.prototype || Object.getPrototypeOf(storage);
  const originalSetItem = storageProto?.setItem;
  let patchedSetItem = null;

  const setFeedback = message => {
    const feedback = viewRoot.querySelector('[data-handover-audit-feedback]');
    if (feedback) feedback.textContent = message;
  };

  const buildReport = () => {
    const current = readCurrentState(windowRef.localStorage, activeKey);
    if (!current) return null;
    activeKey = current.key;
    return buildAgentHandoverPreflight(current.state);
  };

  const render = () => {
    scheduled = false;
    if (disposed) return;
    const isHandoverView = cleanText(pageTitle.textContent, 100).toLowerCase() === 'agent shift handover';
    const existing = viewRoot.querySelector('[data-calloria-handover-preflight]');
    if (!isHandoverView) {
      existing?.remove();
      lastSignature = '';
      return;
    }
    const report = buildReport();
    if (!report) return;
    const signature = JSON.stringify({
      readiness: report.readiness, actor: report.actor, actorId: report.actorId,
      activeInteraction: report.activeInteraction, candidates: report.candidates,
      metrics: report.metrics, pendingIncoming: report.pendingIncoming,
      pendingOutgoing: report.pendingOutgoing, supervisorReviewCases: report.supervisorReviewCases,
      digitalNotOwned: report.digitalNotOwned, queuedDigital: report.queuedDigital,
      linkedCallbackCount: report.linkedCallbackCount
    });
    if (existing && signature === lastSignature) return;
    const wrapper = documentRef.createElement('div');
    wrapper.innerHTML = renderAgentHandoverPreflightHTML(report);
    const panel = wrapper.firstElementChild;
    if (!panel) return;
    if (existing) existing.replaceWith(panel);
    else {
      const metrics = viewRoot.querySelector('.agent-handover-metrics');
      if (metrics?.nextSibling) metrics.parentNode.insertBefore(panel, metrics.nextSibling);
      else viewRoot.insertBefore(panel, viewRoot.firstChild);
    }
    lastSignature = signature;
  };

  const scheduleRender = () => {
    if (scheduled || disposed) return;
    scheduled = true;
    const request = windowRef.requestAnimationFrame || (callback => windowRef.setTimeout(callback, 0));
    request(render);
  };

  if (typeof originalSetItem === 'function') {
    patchedSetItem = function (key, value) {
      const result = originalSetItem.call(this, key, value);
      const savedKey = String(key);
      if (this === storage && (savedKey === LEGACY_SAVE_KEY || savedKey.startsWith(SAVE_PREFIX))) {
        const saved = parseSave(storage, savedKey);
        if (saved) { activeKey = savedKey; scheduleRender(); }
      }
      return result;
    };
    storageProto.setItem = patchedSetItem;
  }
  const storageHandler = event => {
    if (event.storageArea !== storage || !(event.key === LEGACY_SAVE_KEY || (typeof event.key === 'string' && event.key.startsWith(SAVE_PREFIX)))) return;
    if (event.newValue) { activeKey = event.key; scheduleRender(); }
    else if (activeKey === event.key) { activeKey = ''; scheduleRender(); }
  };
  windowRef.addEventListener('storage', storageHandler);

  const makeReportText = () => {
    const report = buildReport();
    return report ? buildAgentHandoverAuditMarkdown(report, new Date()) : '';
  };

  const downloadReport = () => {
    const report = buildReport();
    if (!report) return setFeedback('The employee save could not be read. No file was created.');
    const text = buildAgentHandoverAuditMarkdown(report, new Date());
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = documentRef.createElement('a');
    link.href = url;
    link.download = `CALLORIA-handover-audit-day-${report.day}-${safeSlug(report.actor)}.md`;
    documentRef.body.append(link);
    link.click();
    link.remove();
    windowRef.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback('Handover audit downloaded. It contains local simulated work references and was not uploaded.');
  };

  const copyReport = async () => {
    const text = makeReportText();
    if (!text) return setFeedback('The employee save could not be read. Nothing was copied.');
    try {
      if (windowRef.navigator?.clipboard?.writeText) {
        await windowRef.navigator.clipboard.writeText(text);
      } else {
        const textarea = documentRef.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        documentRef.body.append(textarea);
        textarea.select();
        const copied = documentRef.execCommand?.('copy');
        textarea.remove();
        if (!copied) throw new Error('Clipboard access is unavailable. Use the download button.');
      }
      setFeedback('Handover audit copied. It remains on this device unless you share it.');
    } catch {
      setFeedback('Clipboard access was blocked. Use Download handover audit instead.');
    }
  };

  const clickHandler = event => {
    const download = event.target.closest?.('[data-handover-audit-download]');
    const copy = event.target.closest?.('[data-handover-audit-copy]');
    if (download) downloadReport();
    else if (copy) void copyReport();
  };
  documentRef.addEventListener('click', clickHandler);
  observer = new MutationObserver(scheduleRender);
  observer.observe(viewRoot, { childList: true, subtree: true });
  observer.observe(pageTitle, { childList: true, characterData: true, subtree: true });
  timer = windowRef.setInterval(scheduleRender, 4000);
  scheduleRender();
  windowRef.__CALLORIA_AGENT_HANDOVER_PREFLIGHT_V692__ = true;

  return () => {
    disposed = true;
    if (timer !== null) windowRef.clearInterval(timer);
    observer?.disconnect();
    documentRef.removeEventListener('click', clickHandler);
    windowRef.removeEventListener('storage', storageHandler);
    if (patchedSetItem && storageProto.setItem === patchedSetItem) storageProto.setItem = originalSetItem;
    viewRoot.querySelector('[data-calloria-handover-preflight]')?.remove();
    delete windowRef.__CALLORIA_AGENT_HANDOVER_PREFLIGHT_V692__;
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installAgentHandoverPreflight(window, document);
}
