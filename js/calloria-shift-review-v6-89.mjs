/**
 * CALLORIA v6.89 — end-of-shift performance review.
 * Runs beside the existing application entry point and observes saved state
 * transitions. It does not modify the core agent state or the shift engine.
 */

export const SHIFT_REVIEW_VERSION = '6.89.0';
const BASELINE_PREFIX = 'calloria.shift-review.v6.89:';

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const count = value => Array.isArray(value) ? value.length : 0;

export function readShiftMetrics(state = {}) {
  const commitments = state.customerCommitments?.commitments;
  return {
    callsHandled: number(state.callsHandled),
    outboundCalls: number(state.outboundCalls),
    resolutions: number(state.resolutions),
    sales: number(state.sales),
    cases: count(state.cases),
    commitments: count(commitments),
    totalQA: number(state.totalQA),
    qaCount: number(state.qaCount),
    totalCSAT: number(state.totalCSAT),
    csatCount: number(state.csatCount),
    day: Math.max(1, Math.floor(number(state.day) || 1)),
    shiftStartedAt: state.shiftRecord?.startedAt || null,
    shiftElapsedMinutes: number(state.shiftElapsedMinutes)
  };
}

const delta = (after, before) => Math.max(0, number(after) - number(before));

function averageDelta(afterTotal, afterCount, beforeTotal, beforeCount) {
  const n = delta(afterCount, beforeCount);
  if (!n) return null;
  const total = delta(afterTotal, beforeTotal);
  return total / n;
}

function readAdherence(state = {}) {
  const record = state.shiftRecord;
  const direct = record?.adherence?.adherence ?? record?.adherence;
  if (Number.isFinite(Number(direct))) return Number(direct);
  const history = Array.isArray(state.shiftHistory) ? state.shiftHistory : [];
  const row = history.slice().reverse().find(item => Number(item.day) === Number(state.day));
  return Number.isFinite(Number(row?.adherence)) ? Number(row.adherence) : null;
}

export function summariseShift(beforeState = {}, afterState = {}, options = {}) {
  const before = beforeState.metrics || readShiftMetrics(beforeState);
  const after = readShiftMetrics(afterState);
  const safeDelta = key => delta(after[key], before[key]);
  const start = afterState.shiftRecord?.startedAt || before.shiftStartedAt || null;
  const end = afterState.shiftRecord?.endedAt || afterState.shiftRecord?.closedAt || null;
  const elapsed = Math.max(
    0,
    number(afterState.shiftRecord?.elapsedMinutes) ||
    number(afterState.shiftElapsedMinutes) ||
    (number(after.shiftElapsedMinutes) - number(before.shiftElapsedMinutes))
  );
  return {
    version: SHIFT_REVIEW_VERSION,
    day: after.day || before.day || 1,
    partial: options.partial === true,
    startedAt: start,
    endedAt: end,
    elapsedMinutes: elapsed,
    inbound: safeDelta('callsHandled'),
    outbound: safeDelta('outboundCalls'),
    resolutions: safeDelta('resolutions'),
    sales: safeDelta('sales'),
    newCases: safeDelta('cases'),
    newCommitments: safeDelta('commitments'),
    qaAverage: averageDelta(after.totalQA, after.qaCount, before.totalQA, before.qaCount),
    csatAverage: averageDelta(after.totalCSAT, after.csatCount, before.totalCSAT, before.csatCount),
    adherence: readAdherence(afterState)
  };
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function formatDuration(minutes) {
  const value = Math.max(0, Math.round(number(minutes)));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return hours ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`;
}

function formatTimestamp(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not recorded';
}

function metric(label, value, note = '') {
  return `<article class="calloria-shift-review-metric"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong>${note ? `<small>${escapeHTML(note)}</small>` : ''}</article>`;
}

export function buildShiftReportHTML(summary) {
  const qa = summary.qaAverage === null ? '—' : `${Math.round(summary.qaAverage)}%`;
  const csat = summary.csatAverage === null ? '—' : `${summary.csatAverage.toFixed(1)} / 5`;
  const adherence = summary.adherence === null ? '—' : `${Math.round(summary.adherence)}%`;
  const totalContacts = summary.inbound + summary.outbound;
  const heading = totalContacts > 0
    ? `${totalContacts} customer contact${totalContacts === 1 ? '' : 's'} handled`
    : 'Shift closed';
  const note = summary.partial
    ? 'Tracking resumed after a page reload. Earlier activity in this shift may not be included in the change totals.'
    : 'This report is calculated from the employee save immediately before and after the shift.';
  return `
    <div class="calloria-shift-review-backdrop" data-shift-review-backdrop>
      <section class="calloria-shift-review-dialog" role="dialog" aria-modal="true" aria-labelledby="calloriaShiftReviewTitle" tabindex="-1">
        <button class="calloria-shift-review-close" type="button" data-shift-review-close aria-label="Close shift report">×</button>
        <div class="calloria-shift-review-kicker">CALLORIA · SHIFT CLOSE-OUT</div>
        <h2 id="calloriaShiftReviewTitle">Your shift report</h2>
        <p class="calloria-shift-review-lead">${escapeHTML(heading)}</p>
        <div class="calloria-shift-review-meta">Workday ${escapeHTML(summary.day)} <span>·</span> ${escapeHTML(formatTimestamp(summary.startedAt))}–${escapeHTML(formatTimestamp(summary.endedAt))} <span>·</span> ${escapeHTML(formatDuration(summary.elapsedMinutes))}</div>
        <div class="calloria-shift-review-grid">
          ${metric('INBOUND CONTACTS', summary.inbound)}
          ${metric('OUTBOUND CONTACTS', summary.outbound)}
          ${metric('RESOLUTIONS', summary.resolutions)}
          ${metric('SALES', summary.sales)}
          ${metric('NEW CRM CASES', summary.newCases)}
          ${metric('CUSTOMER PROMISES', summary.newCommitments)}
          ${metric('AVERAGE QA', qa, 'Based on QA reviews recorded during this shift')}
          ${metric('AVERAGE CSAT', csat, 'Based on customer feedback recorded during this shift')}
        </div>
        <div class="calloria-shift-review-footer">
          <div><span>SHIFT ADHERENCE</span><strong>${escapeHTML(adherence)}</strong></div>
          <p>${escapeHTML(note)}</p>
        </div>
        <button class="calloria-shift-review-done" type="button" data-shift-review-close>Close report</button>
        <small class="calloria-shift-review-disclaimer">Simulation performance only. This is not an employment decision or a real contact-centre payroll record.</small>
      </section>
    </div>`;
}

function parseSavedState(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && typeof parsed.shiftActive === 'boolean'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function getSaveKeys(storage) {
  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && (key.startsWith('calloria.save.') || key === 'floorshift3d.save.v1')) keys.push(key);
    }
  } catch { /* Storage can be blocked by browser privacy settings. */ }
  return keys;
}

export function installShiftReviewRuntime(windowRef = globalThis.window, documentRef = globalThis.document) {
  if (!windowRef || !documentRef || !windowRef.localStorage) return () => {};
  if (windowRef.__CALLORIA_SHIFT_REVIEW_V689__) return () => {};

  const storage = windowRef.localStorage;
  const session = windowRef.sessionStorage;
  const storagePrototype = windowRef.Storage?.prototype || Object.getPrototypeOf(storage);
  const originalSetItem = storagePrototype?.setItem;
  if (typeof originalSetItem !== 'function') return () => {};

  const lastStateByKey = new Map();
  const baselineByKey = new Map();
  let activeDialog = null;
  let activeKeyHandler = null;
  let previousFocus = null;

  const baselineKey = key => `${BASELINE_PREFIX}${encodeURIComponent(key)}`;
  const readBaseline = key => {
    try {
      const value = session?.getItem(baselineKey(key));
      return value ? JSON.parse(value) : baselineByKey.get(key) || null;
    } catch { return baselineByKey.get(key) || null; }
  };
  const writeBaseline = (key, value) => {
    baselineByKey.set(key, value);
    try { session?.setItem(baselineKey(key), JSON.stringify(value)); } catch { /* Session storage is optional. */ }
  };
  const clearBaseline = key => {
    baselineByKey.delete(key);
    try { session?.removeItem(baselineKey(key)); } catch { /* Session storage is optional. */ }
  };

  const closeDialog = () => {
    activeDialog?.remove();
    activeDialog = null;
    if (activeKeyHandler) documentRef.removeEventListener('keydown', activeKeyHandler);
    activeKeyHandler = null;
    if (previousFocus?.isConnected) previousFocus.focus?.();
    previousFocus = null;
  };

  const showReport = summary => {
    closeDialog();
    previousFocus = documentRef.activeElement || null;
    const host = documentRef.createElement('div');
    host.innerHTML = buildShiftReportHTML(summary);
    activeDialog = host.firstElementChild;
    if (!activeDialog) return;
    documentRef.body.append(activeDialog);
    const dialog = activeDialog.querySelector('.calloria-shift-review-dialog');
    const closeButtons = activeDialog.querySelectorAll('[data-shift-review-close]');
    closeButtons.forEach(button => button.addEventListener('click', closeDialog));
    activeDialog.addEventListener('click', event => {
      if (event.target === activeDialog) closeDialog();
    });
    dialog?.focus({ preventScroll: true });
    activeKeyHandler = event => {
      if (event.key === 'Escape' && activeDialog) closeDialog();
    };
    documentRef.addEventListener('keydown', activeKeyHandler);
  };

  for (const key of getSaveKeys(storage)) {
    const parsed = parseSavedState(storage.getItem(key));
    if (!parsed) continue;
    lastStateByKey.set(key, parsed);
    if (parsed.shiftActive) {
      const stored = readBaseline(key);
      if (!stored) writeBaseline(key, { metrics: readShiftMetrics(parsed), partial: true });
    }
  }

  const onSavedState = (key, value) => {
    if (!(key.startsWith('calloria.save.') || key === 'floorshift3d.save.v1')) return;
    const next = parseSavedState(value);
    if (!next) return;
    const previous = lastStateByKey.get(key) || null;

    if (next.shiftActive && !previous?.shiftActive) {
      writeBaseline(key, {
        metrics: readShiftMetrics(previous || next),
        partial: !previous
      });
    } else if (!next.shiftActive && previous?.shiftActive) {
      const baseline = readBaseline(key) || {
        metrics: readShiftMetrics(previous),
        partial: true
      };
      const summary = summariseShift({ metrics: baseline.metrics }, next, { partial: baseline.partial });
      clearBaseline(key);
      windowRef.setTimeout(() => showReport(summary), 180);
    }

    if (next.shiftActive && !readBaseline(key)) {
      writeBaseline(key, { metrics: readShiftMetrics(next), partial: true });
    }
    lastStateByKey.set(key, next);
  };

  const wrappedSetItem = function(key, value) {
    const result = originalSetItem.call(this, key, value);
    if (this === storage) onSavedState(String(key), String(value));
    return result;
  };

  try {
    storagePrototype.setItem = wrappedSetItem;
  } catch {
    return () => {};
  }

  const onPageHide = () => {
    // Keep the session baseline so a reload during an active shift can continue
    // with a clearly marked partial report.
  };
  windowRef.addEventListener?.('pagehide', onPageHide);
  windowRef.__CALLORIA_SHIFT_REVIEW_V689__ = true;

  return () => {
    if (storagePrototype.setItem === wrappedSetItem) storagePrototype.setItem = originalSetItem;
    windowRef.removeEventListener?.('pagehide', onPageHide);
    closeDialog();
    delete windowRef.__CALLORIA_SHIFT_REVIEW_V689__;
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installShiftReviewRuntime(window, document);
}
