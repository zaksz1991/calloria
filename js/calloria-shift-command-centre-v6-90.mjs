/**
 * CALLORIA v6.90 — live shift command centre.
 * Read-only operational overlay. It derives priorities from the application's
 * existing local save and routes the agent to existing work views.
 */
export const SHIFT_COMMAND_VERSION = '6.91.0';
const SAVE_PREFIX = 'calloria.save.';
const LEGACY_SAVE_KEY = 'floorshift3d.save.v1';
const PRIORITY_WEIGHT = Object.freeze({ critical: 100, overdue: 96, supervisor: 92, high: 84, breached: 88, due_soon: 78, at_risk: 74, normal: 62, low: 48, active: 42 });
const ACTIVE_DIGITAL = new Set(['queued', 'active', 'awaiting_customer']);
const ACTIVE_FOLLOWUPS = new Set(['open', 'in_progress', 'supervisor_review']);

// Mirrors the public v6.63 digital-sla-engine policy for an independent read-only
// summary, so the overlay does not require a second registration or runtime hook.
function assessDigitalSla(contact, nowMs) {
  const receivedAt = isoTime(contact?.receivedAt);
  const channelTargets = { email: 240, live_chat: 2, social: 20 };
  const configuredTarget = Number(contact?.slaMinutes);
  const targetMinutes = Math.min(10080, Math.max(1,
    Number.isFinite(configuredTarget) && configuredTarget > 0
      ? configuredTarget
      : (channelTargets[contact?.channel] || 20)));
  if (receivedAt === null) return { status: 'unavailable', label: 'No receipt time', overdueMs: 0, remainingMs: null };
  const dueAt = isoTime(contact?.slaDueAt) ?? (receivedAt + targetMinutes * 60_000);
  const firstResponse = isoTime(contact?.firstResponseAt);
  if (firstResponse !== null) {
    const responseMs = Math.max(0, firstResponse - receivedAt);
    const met = responseMs <= dueAt - receivedAt;
    const overdueMs = met ? 0 : Math.max(0, responseMs - (dueAt - receivedAt));
    return { status: met ? 'met' : 'breached', label: met ? 'Met target' : 'First response late', overdueMs, remainingMs: 0 };
  }
  const elapsedMs = Math.max(0, finite(nowMs, Date.now()) - receivedAt);
  const remainingMs = dueAt - finite(nowMs, Date.now());
  const status = remainingMs <= 0 ? 'breached' : elapsedMs >= targetMinutes * 60_000 * 0.75 ? 'at_risk' : 'on_track';
  const label = status === 'breached' ? 'SLA breached' : status === 'at_risk' ? 'Due soon' : 'On track';
  return { status, label, overdueMs: Math.max(0, -remainingMs), remainingMs: Math.max(0, remainingMs) };
}

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const list = value => Array.isArray(value) ? value : [];
const isoTime = value => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : null;
};

function shiftClock(state = {}) {
  const day = Math.max(1, Math.floor(finite(state.day, 1)));
  const seconds = Math.min(86399, Math.max(0, finite(state.simulationClockSeconds, 7 * 3600)));
  return { day, minutes: Math.floor(seconds / 60), active: state.shiftActive === true };
}

/**
 * Read-only shift plan summary. Mirrors the public shift-engine schedule and
 * adherence calculation without writing to or normalising the saved record.
 */
export function buildShiftRhythmSnapshot(state = {}) {
  const active = state.shiftActive === true;
  const record = state.shiftRecord && typeof state.shiftRecord === 'object' ? state.shiftRecord : {};
  const sourcePlan = record.plan && typeof record.plan === 'object' ? record.plan : {};
  const startMinute = Number.isFinite(Number(sourcePlan.startMinute))
    ? Math.max(0, Math.min(1439, Number(sourcePlan.startMinute))) : 8 * 60;
  const endMinute = Number.isFinite(Number(sourcePlan.endMinute))
    ? Math.max(startMinute + 1, Math.min(1440, Number(sourcePlan.endMinute))) : 17 * 60;
  const rawBreaks = Array.isArray(sourcePlan.breaks) ? sourcePlan.breaks : [
    { id: 'morning-break', label: 'Morning break', startMinute: 10 * 60, endMinute: 10 * 60 + 15 },
    { id: 'lunch-break', label: 'Lunch break', startMinute: 12 * 60 + 30, endMinute: 13 * 60 },
    { id: 'afternoon-break', label: 'Afternoon break', startMinute: 15 * 60, endMinute: 15 * 60 + 15 }
  ];
  const breaks = rawBreaks.map((item, index) => ({
    id: String(item?.id || `break-${index + 1}`).slice(0, 60),
    label: String(item?.label || `Break ${index + 1}`).slice(0, 60),
    startMinute: finite(item?.startMinute, -1),
    endMinute: finite(item?.endMinute, -1)
  })).filter(item => item.startMinute >= startMinute && item.endMinute > item.startMinute && item.endMinute <= endMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  const elapsedMinutes = Math.max(0, finite(state.shiftElapsedMinutes));
  const absoluteMinute = startMinute + elapsedMinutes;
  const currentBreak = breaks.find(item => absoluteMinute >= item.startMinute && absoluteMinute < item.endMinute) || null;
  const nextBreak = currentBreak || breaks.find(item => item.startMinute > absoluteMinute) || null;
  const expectedMode = absoluteMinute >= endMinute ? 'off-duty' : currentBreak ? 'break' : 'working';
  const events = list(record.events).filter(item => Number.isFinite(Number(item?.elapsedMinute)) && typeof item?.status === 'string')
    .slice().sort((a, b) => Number(a.elapsedMinute) - Number(b.elapsedMinute));
  const actualStatus = String(events.at(-1)?.status || state.agentStatus || 'offline');

  const total = Math.max(0, Math.min(1440, Math.floor(elapsedMinutes)));
  let eventIndex = 0;
  let actual = events[0]?.status || actualStatus;
  let matchedMinutes = 0;
  let plannedMinutes = 0;
  let deviations = 0;
  for (let minute = 0; minute < total; minute += 1) {
    while (eventIndex + 1 < events.length && Number(events[eventIndex + 1].elapsedMinute) <= minute) {
      eventIndex += 1;
      actual = events[eventIndex].status;
    }
    const atMinute = startMinute + minute;
    const scheduledBreak = breaks.some(item => atMinute >= item.startMinute && atMinute < item.endMinute);
    const expected = atMinute >= endMinute ? 'off-duty' : scheduledBreak ? 'break' : 'working';
    if (expected === 'working') {
      plannedMinutes += 1;
      if (['available', 'busy', 'wrap-up'].includes(actual)) matchedMinutes += 1;
      else deviations += 1;
    } else if (expected === 'break') {
      plannedMinutes += 1;
      if (actual === 'break') matchedMinutes += 1;
      else deviations += 1;
    }
  }
  const adherence = plannedMinutes ? Math.round((matchedMinutes / plannedMinutes) * 1000) / 10 : 100;

  const digitalIds = new Set([...list(state.digitalActiveIds), state.digitalActiveId].filter(Boolean).map(String));
  const activeWork = Number(Boolean(state.currentCall)) + Number(Boolean(state.activeOutbound)) + Number(Boolean(state.wrapUp)) + digitalIds.size;
  const breakReady = expectedMode === 'break' && actualStatus !== 'break' && activeWork === 0;
  const minutesToBreak = nextBreak ? (currentBreak ? 0 : Math.max(0, Math.ceil(nextBreak.startMinute - absoluteMinute))) : null;
  const breakLabel = currentBreak
    ? `${currentBreak.label} · ends ${clockLabel(currentBreak.endMinute)} (${Math.max(0, Math.ceil(currentBreak.endMinute - absoluteMinute))}m left)`
    : nextBreak
      ? `${nextBreak.label} · ${clockLabel(nextBreak.startMinute)} (${minutesToBreak}m)`
      : 'No scheduled breaks remaining';
  const statusLabel = expectedMode === 'break'
    ? actualStatus === 'break' ? 'ON SCHEDULED BREAK' : activeWork ? 'BREAK WINDOW · FINISH CUSTOMER WORK' : 'SCHEDULED BREAK READY'
    : expectedMode === 'off-duty' ? 'SHIFT WINDOW ENDED'
      : actualStatus === 'offline' ? 'OFFLINE DURING WORK HOURS'
        : actualStatus === 'break' ? 'BREAK OUTSIDE SCHEDULE' : 'ON DUTY';
  const guidance = expectedMode === 'break'
    ? actualStatus === 'break'
      ? `Scheduled break is in progress. Return by ${clockLabel(currentBreak.endMinute)}.`
      : activeWork
        ? 'The scheduled break window is open. Finish or safely close active customer work before taking the break.'
        : 'The scheduled break window is open. Use the existing scheduled-break control when ready.'
    : expectedMode === 'off-duty'
      ? 'The planned shift window has ended. Close the shift through the existing Workforce controls.'
      : actualStatus === 'offline'
        ? 'Your agent state is offline during planned working time. Restore the appropriate state in the application.'
        : actualStatus === 'break'
          ? 'The current agent state is break outside the scheduled break window.'
          : nextBreak
            ? `${nextBreak.label} starts at ${clockLabel(nextBreak.startMinute)}. Complete active work and keep your agent state accurate.`
            : `The planned shift ends at ${clockLabel(endMinute)}.`;

  return {
    active,
    startLabel: clockLabel(startMinute),
    endLabel: clockLabel(endMinute),
    expectedMode,
    actualStatus,
    statusLabel,
    adherence,
    matchedMinutes,
    plannedMinutes,
    deviations,
    activeWork,
    breakReady,
    breakLabel,
    minutesToBreak,
    shiftRemainingMinutes: Math.max(0, Math.ceil(endMinute - absoluteMinute)),
    guidance,
    breaks: breaks.map(item => ({
      ...item,
      state: absoluteMinute >= item.endMinute ? 'completed' : absoluteMinute >= item.startMinute ? 'active' : 'upcoming'
    }))
  };
}

function queueNow(state = {}, now = Date.now()) {
  const epoch = Number(state.shiftSimulationEpochMs);
  const elapsed = Math.max(0, finite(state.shiftElapsedMinutes));
  return state.shiftActive === true && Number.isFinite(epoch)
    ? epoch + elapsed * 60_000
    : now;
}

function priorityForQueueItem(item, waitSeconds) {
  const weight = PRIORITY_WEIGHT[String(item?.priority || 'normal').toLowerCase()] ?? PRIORITY_WEIGHT.normal;
  return weight + Math.min(20, Math.floor(Math.max(0, waitSeconds) / 30));
}

function followUpTiming(followUp, clock) {
  const dueDay = Math.max(1, Math.floor(finite(followUp?.dueDay, clock.day)));
  const dueMinute = Math.min(1439, Math.max(0, Math.floor(finite(followUp?.dueMinute))));
  const deltaMinutes = (dueDay - clock.day) * 1440 + dueMinute - clock.minutes;
  return {
    deltaMinutes,
    state: deltaMinutes < 0 ? 'overdue' : deltaMinutes <= 15 ? 'due_soon' : 'on_track'
  };
}

function callbackDue(callback, state, nowMs, options = {}) {
  const engine = options.commitmentEngine || options.windowRef?.CalloriaCommitmentEngine || globalThis.window?.CalloriaCommitmentEngine;
  if (callback?.commitmentId && engine?.getCommitment && engine?.classify) {
    try {
      const item = engine.getCommitment(state.customerCommitments, callback.commitmentId);
      if (item) {
        const clock = shiftClock(state);
        const date = new Date();
        date.setDate(date.getDate() + Math.max(0, clock.day - 1));
        date.setHours(Math.floor(clock.minutes / 60), clock.minutes % 60, 0, 0);
        const snapshot = { date: engine.dateText?.(date) || date.toISOString().slice(0, 10), minutes: clock.minutes };
        const classification = engine.classify(item, snapshot);
        return ['Due', 'Overdue'].includes(classification?.state);
      }
    } catch { /* Fall back to the callback's persisted due timestamp. */ }
  }
  const dueAt = isoTime(callback?.dueAt);
  return dueAt !== null && dueAt <= nowMs;
}

function createTask({ id, kind, title, customer = '', detail = '', targetView, status = 'OPEN', severity = 'normal', score, meta = {} }) {
  return {
    id: String(id || `${kind}-${title}`).slice(0, 180),
    kind,
    title: String(title || 'Operational task').slice(0, 120),
    customer: String(customer || '').slice(0, 100),
    detail: String(detail || '').slice(0, 220),
    targetView,
    status: String(status || 'OPEN').slice(0, 40),
    severity,
    score: Number.isFinite(Number(score)) ? Number(score) : (PRIORITY_WEIGHT[severity] ?? PRIORITY_WEIGHT.normal),
    meta
  };
}

/** Pure, read-only snapshot of outstanding work in one active shift. */
export function buildShiftCommandSnapshot(state = {}, options = {}) {
  const clock = shiftClock(state);
  const nowMs = queueNow(state, finite(options.now, Date.now()));
  const snapshot = {
    version: SHIFT_COMMAND_VERSION,
    active: state.shiftActive === true,
    day: clock.day,
    clockMinutes: clock.minutes,
    elapsedMinutes: Math.max(0, finite(state.shiftElapsedMinutes)),
    agentStatus: String(state.agentStatus || (state.shiftActive ? 'available' : 'offline')),
    rhythm: buildShiftRhythmSnapshot(state),
    tasks: [],
    metrics: {
      inboundWaiting: 0,
      digitalWaiting: 0,
      callbacksDue: 0,
      caseFollowUps: 0,
      supervisorRequests: 0,
      totalPriorities: 0
    },
    recommendation: state.shiftActive ? 'Maintain availability and monitor the next customer arrival.' : 'Start a shift to open the live command centre.'
  };

  if (!snapshot.active) return snapshot;

  const tasks = [];
  const inbound = list(state.inboundQueueItems).filter(item => item?.status === 'queued');
  snapshot.metrics.inboundWaiting = inbound.length;
  for (const item of inbound) {
    const queuedAt = isoTime(item.queuedAt || item.createdAt);
    const waitSeconds = queuedAt === null ? 0 : Math.max(0, Math.floor((nowMs - queuedAt) / 1000));
    const severity = ['critical', 'high', 'normal', 'low'].includes(String(item.priority).toLowerCase())
      ? String(item.priority).toLowerCase() : 'normal';
    const score = priorityForQueueItem(item, waitSeconds);
    tasks.push(createTask({
      id: item.id,
      kind: 'inbound',
      title: 'Inbound customer waiting',
      customer: item.customer,
      detail: `${item.issue || item.category || 'Customer enquiry'} · ${item.routeGroup || 'General'} · waiting ${waitSeconds}s`,
      targetView: 'queue',
      status: waitSeconds >= 60 ? 'WAIT TARGET EXCEEDED' : 'WAITING',
      severity,
      score,
      meta: { waitSeconds, priority: severity }
    }));
  }

  const digital = list(state.digitalQueue).filter(item => {
    if (!item || !ACTIVE_DIGITAL.has(item.status)) return false;
    if (item.status === 'queued') return true;
    const employeeId = `EMP-${state.nameInitials || 'AGENT'}`;
    const assigned = item.assignedTo === employeeId;
    const activeIds = list(state.digitalActiveIds);
    return assigned || activeIds.includes(item.id) || item.id === state.digitalActiveId;
  });
  for (const item of digital) {
    let sla = { status: 'unavailable', label: 'SLA not available', overdueMs: 0, remainingMs: null };
    try { sla = assessDigitalSla(item, nowMs); } catch { /* Keep the item visible without an SLA estimate. */ }
    const waiting = item.status === 'queued';
    const severity = sla.status === 'breached' ? 'breached' : sla.status === 'at_risk' ? 'at_risk' : (item.priority || 'normal');
    const urgency = sla.status === 'breached' ? 88 : sla.status === 'at_risk' ? 74 : (PRIORITY_WEIGHT[String(item.priority || 'normal').toLowerCase()] ?? 62);
    tasks.push(createTask({
      id: item.id,
      kind: 'digital',
      title: waiting ? `${item.channelLabel || item.channel || 'Digital'} contact waiting` : 'Continue assigned digital conversation',
      customer: item.customer,
      detail: `${item.subject || item.preview || 'Customer message'} · ${sla.label || 'SLA status unavailable'}`,
      targetView: 'digital',
      status: sla.label || (waiting ? 'WAITING' : 'ACTIVE'),
      severity,
      score: urgency,
      meta: { slaStatus: sla.status, channel: item.channel, waiting }
    }));
  }
  snapshot.metrics.digitalWaiting = digital.filter(item => item.status === 'queued').length;

  const callbacks = list(state.callbacks).filter(item => item?.status === 'scheduled');
  const dueCallbacks = callbacks.filter(item => callbackDue(item, state, nowMs, options));
  snapshot.metrics.callbacksDue = dueCallbacks.length;
  for (const item of dueCallbacks) {
    const outbound = item.type === 'outbound';
    tasks.push(createTask({
      id: item.id,
      kind: 'callback',
      title: outbound ? 'Outbound callback due' : 'Customer callback due',
      customer: item.customer,
      detail: item.issue || 'Return the call at the agreed time and record the outcome.',
      targetView: outbound ? 'outbound' : 'queue',
      status: 'DUE NOW',
      severity: 'overdue',
      score: 90,
      meta: { dueAt: item.dueAt, type: item.type || 'inbound' }
    }));
  }

  for (const record of list(state.cases)) {
    const followUp = record?.lifecycle?.followUp;
    if (!followUp || !ACTIVE_FOLLOWUPS.has(followUp.status)) continue;
    snapshot.metrics.caseFollowUps += 1;
    const timing = followUpTiming(followUp, clock);
    const severity = followUp.status === 'supervisor_review' ? 'supervisor'
      : timing.state === 'overdue' ? 'overdue'
      : followUp.priority === 'urgent' ? 'critical'
      : timing.state === 'due_soon' ? 'due_soon' : 'normal';
    const deltaLabel = timing.deltaMinutes < 0
      ? `${Math.abs(timing.deltaMinutes)} simulated min overdue`
      : timing.deltaMinutes === 0 ? 'due now' : `due in ${timing.deltaMinutes} simulated min`;
    tasks.push(createTask({
      id: followUp.id || record.reference,
      kind: 'case-followup',
      title: followUp.status === 'supervisor_review' ? 'Case requires supervisor review' : 'Reopened case follow-up',
      customer: record.customer,
      detail: `${record.reference || 'Case'} · ${record.title || record.subject || 'Customer case'} · ${deltaLabel}`,
      targetView: 'crm',
      status: timing.state === 'overdue' ? 'OVERDUE' : timing.state === 'due_soon' ? 'DUE SOON' : followUp.status.replaceAll('_', ' ').toUpperCase(),
      severity,
      score: (PRIORITY_WEIGHT[severity] ?? 62) + (followUp.priority === 'urgent' ? 4 : 0),
      meta: { dueDay: followUp.dueDay, dueMinute: followUp.dueMinute, owner: followUp.owner }
    }));
  }

  const supervisorRequests = list(state.supervisorRequests).filter(item => item?.status === 'open');
  snapshot.metrics.supervisorRequests = supervisorRequests.length;
  for (const item of supervisorRequests) {
    tasks.push(createTask({
      id: item.id,
      kind: 'supervisor',
      title: 'Open supervisor request',
      customer: item.customer,
      detail: item.reason || item.reference || 'Supervisor action is awaiting review.',
      targetView: 'supervisor',
      status: 'REVIEW OPEN',
      severity: 'supervisor',
      score: 92,
      meta: { createdAt: item.createdAt, channel: item.channel }
    }));
  }

  if (state.wrapUp) {
    tasks.push(createTask({ id: 'active-wrap-up', kind: 'active-interaction', title: 'Complete after-contact work', detail: 'Record the contact disposition and required notes before accepting more work.', targetView: 'inbound', severity: 'critical', score: 150, status: 'ACTION REQUIRED' }));
  } else if (state.currentCall) {
    tasks.push(createTask({ id: 'active-inbound-call', kind: 'active-interaction', title: 'Continue active inbound conversation', detail: 'Complete the customer conversation before accepting another contact.', targetView: 'inbound', severity: 'active', score: 145, status: 'IN PROGRESS' }));
  } else if (state.activeOutbound) {
    tasks.push(createTask({ id: 'active-outbound-call', kind: 'active-interaction', title: 'Continue active outbound conversation', detail: 'Complete the current campaign conversation and disposition.', targetView: 'outbound', severity: 'active', score: 145, status: 'IN PROGRESS' }));
  }

  tasks.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  snapshot.tasks = tasks.slice(0, 12);
  snapshot.metrics.totalPriorities = tasks.length;
  if (tasks.length) {
    const first = tasks[0];
    snapshot.recommendation = `${first.title}${first.customer ? ` — ${first.customer}` : ''}. Open ${first.targetView} to continue.`;
  }
  return snapshot;
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function clockLabel(minutes) {
  const value = Math.max(0, Math.min(1439, Math.floor(finite(minutes))));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function taskHTML(task, index) {
  const severity = task.severity === 'critical' || task.severity === 'overdue' || task.severity === 'breached' || task.severity === 'supervisor' ? 'urgent'
    : task.severity === 'high' || task.severity === 'due_soon' || task.severity === 'at_risk' ? 'watch' : 'normal';
  return `<article class="calloria-command-task ${severity}">
    <div class="calloria-command-task-top"><span class="calloria-command-task-index">${index + 1}</span><span class="calloria-command-task-kind">${escapeHTML(task.kind.replaceAll('-', ' '))}</span><span class="calloria-command-task-status">${escapeHTML(task.status)}</span></div>
    <strong>${escapeHTML(task.title)}</strong>
    ${task.customer ? `<span class="calloria-command-task-customer">${escapeHTML(task.customer)}</span>` : ''}
    <p>${escapeHTML(task.detail)}</p>
    <button type="button" data-command-navigate="${escapeHTML(task.targetView)}">Open ${escapeHTML(task.targetView === 'crm' ? 'cases' : task.targetView === 'queue' ? 'inbound queue' : task.targetView === 'digital' ? 'digital desk' : task.targetView === 'supervisor' ? 'supervisor desk' : task.targetView === 'inbound' ? 'inbound desk' : task.targetView)}</button>
  </article>`;
}

function shiftRhythmHTML(rhythm) {
  if (!rhythm?.active) return '';
  const statusTone = ['SCHEDULED BREAK READY', 'OFFLINE DURING WORK HOURS', 'BREAK OUTSIDE SCHEDULE', 'BREAK WINDOW · FINISH CUSTOMER WORK'].includes(rhythm.statusLabel) ? 'attention' : 'steady';
  const adherence = Math.max(0, Math.min(100, finite(rhythm.adherence)));
  const breakItems = list(rhythm.breaks).map(item => `<span class="calloria-rhythm-break ${escapeHTML(item.state)}"><i></i><b>${escapeHTML(item.label)}</b><small>${escapeHTML(clockLabel(item.startMinute))}–${escapeHTML(clockLabel(item.endMinute))}</small></span>`).join('');
  const activeWorkLabel = `${rhythm.activeWork} active work item${rhythm.activeWork === 1 ? '' : 's'}`;
  const shiftTimeLabel = rhythm.shiftRemainingMinutes > 0 ? `${Math.floor(rhythm.shiftRemainingMinutes / 60)}h ${String(rhythm.shiftRemainingMinutes % 60).padStart(2, '0')}m left` : 'planned end reached';
  return `<section class="calloria-command-rhythm" aria-label="Shift schedule and adherence" aria-live="polite">
    <div class="calloria-rhythm-heading"><div><span>SHIFT RHYTHM</span><strong>${adherence.toFixed(1)}% adherence</strong></div><b class="calloria-rhythm-state ${statusTone}">${escapeHTML(rhythm.statusLabel)}</b></div>
    <div class="calloria-rhythm-progress" role="progressbar" aria-label="Shift schedule adherence" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${adherence.toFixed(1)}"><span style="width:${adherence}%"></span></div>
    <div class="calloria-rhythm-facts"><div><small>NEXT BREAK</small><strong>${escapeHTML(rhythm.breakLabel)}</strong></div><div><small>SHIFT WINDOW</small><strong>${escapeHTML(rhythm.startLabel)}–${escapeHTML(rhythm.endLabel)} · ${escapeHTML(shiftTimeLabel)}</strong></div><div><small>WORKLOAD</small><strong>${escapeHTML(activeWorkLabel)} · ${escapeHTML(rhythm.actualStatus.replaceAll('-', ' '))}</strong></div></div>
    <div class="calloria-rhythm-timeline">${breakItems || '<span class="calloria-rhythm-no-breaks">No scheduled breaks on this shift plan.</span>'}</div>
    <p class="calloria-rhythm-guidance">${escapeHTML(rhythm.guidance)}${rhythm.deviations ? ` · ${rhythm.deviations} schedule deviation minute${rhythm.deviations === 1 ? '' : 's'} recorded.` : ''}</p>
  </section>`;
}

export function buildShiftCommandPanelHTML(snapshot) {
  if (!snapshot?.active) return '';
  const metrics = snapshot.metrics;
  const taskCount = metrics.totalPriorities;
  const empty = '<div class="calloria-command-empty"><strong>No outstanding priority work</strong><span>Keep your status accurate and monitor new arrivals.</span></div>';
  return `<div class="calloria-command-backdrop" data-command-backdrop>
    <section class="calloria-command-panel" role="dialog" aria-modal="true" aria-labelledby="calloriaCommandTitle" tabindex="-1">
      <header class="calloria-command-header">
        <div><span class="calloria-command-eyebrow">CALLORIA · LIVE OPERATIONS</span><h2 id="calloriaCommandTitle">Shift command centre</h2><p>Prioritised work from your active employee save.</p></div>
        <button type="button" class="calloria-command-close" data-command-close aria-label="Close shift command centre">×</button>
      </header>
      <div class="calloria-command-statusbar"><span class="calloria-command-live-dot"></span><strong>${escapeHTML(snapshot.agentStatus.replaceAll('-', ' ').toUpperCase())}</strong><span>DAY ${escapeHTML(snapshot.day)}</span><span>${escapeHTML(clockLabel(snapshot.clockMinutes))} SIM TIME</span></div>
      ${shiftRhythmHTML(snapshot.rhythm)}
      <div class="calloria-command-metrics">
        <div><strong>${metrics.inboundWaiting}</strong><span>VOICE WAITING</span></div>
        <div><strong>${metrics.digitalWaiting}</strong><span>DIGITAL WAITING</span></div>
        <div><strong>${metrics.callbacksDue}</strong><span>CALLBACKS DUE</span></div>
        <div><strong>${metrics.caseFollowUps}</strong><span>CASE FOLLOW-UPS</span></div>
        <div><strong>${metrics.supervisorRequests}</strong><span>SUPERVISOR</span></div>
      </div>
      <div class="calloria-command-recommendation"><span>RECOMMENDED NEXT ACTION</span><strong>${escapeHTML(snapshot.recommendation)}</strong></div>
      <div class="calloria-command-tasklist">${snapshot.tasks.length ? snapshot.tasks.map(taskHTML).join('') : empty}</div>
      <footer class="calloria-command-footer"><span>${taskCount} outstanding item${taskCount === 1 ? '' : 's'} · read-only operational overview</span><span>All customers and work items are simulated.</span></footer>
    </section>
  </div>`;
}

function isSaveKey(key) {
  return typeof key === 'string' && (key.startsWith(SAVE_PREFIX) || key === LEGACY_SAVE_KEY);
}

function parseState(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function getInitialSavedState(storage) {
  const keys = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (isSaveKey(key)) keys.push(key);
    }
  } catch { return null; }
  keys.sort((a, b) => (a === 'calloria.save.v1' ? -1 : b === 'calloria.save.v1' ? 1 : 0));
  for (const key of keys) {
    const parsed = parseState(storage.getItem(key));
    if (parsed) return { key, state: parsed };
  }
  return null;
}

export function installShiftCommandRuntime(windowRef = globalThis.window, documentRef = globalThis.document) {
  if (!windowRef || !documentRef || !windowRef.localStorage || !documentRef.body) return () => {};
  if (windowRef.__CALLORIA_SHIFT_COMMAND_V691__) return () => {};

  const storage = windowRef.localStorage;
  const proto = windowRef.Storage?.prototype || Object.getPrototypeOf(storage);
  const originalSetItem = proto?.setItem;
  if (typeof originalSetItem !== 'function') return () => {};

  let activeKey = null;
  let panelBackdrop = null;
  let previousFocus = null;
  let keyHandler = null;
  let refreshTimer = null;
  let lastSnapshot = null;
  let closed = false;

  const root = documentRef.createElement('div');
  root.id = 'calloriaShiftCommandRoot';
  root.innerHTML = `<button type="button" class="calloria-command-launcher" data-command-open aria-label="Open shift command centre"><span class="calloria-command-launcher-icon">≡</span><span class="calloria-command-launcher-copy"><strong>SHIFT CONTROL</strong><small>LIVE PRIORITIES</small></span><b data-command-count>0</b></button>`;
  documentRef.body.append(root);
  const launcher = root.querySelector('[data-command-open]');
  const countBadge = root.querySelector('[data-command-count]');

  const readActiveState = () => {
    if (activeKey) {
      const found = parseState(storage.getItem(activeKey));
      if (found) return found;
    }
    const found = getInitialSavedState(storage);
    if (found) {
      activeKey = found.key;
      return found.state;
    }
    return null;
  };

  const closePanel = ({ restoreFocus = true } = {}) => {
    panelBackdrop?.remove();
    panelBackdrop = null;
    if (keyHandler) documentRef.removeEventListener('keydown', keyHandler);
    keyHandler = null;
    if (refreshTimer !== null) windowRef.clearInterval(refreshTimer);
    refreshTimer = null;
    if (restoreFocus && previousFocus?.isConnected) previousFocus.focus?.({ preventScroll: true });
    previousFocus = null;
  };

  const navigate = view => {
    const button = documentRef.querySelector(`.nav-item[data-view="${String(view).replace(/[^a-zA-Z]/g, '')}"]`);
    if (button) button.click();
    closePanel();
  };

  const paintLauncher = snapshot => {
    lastSnapshot = snapshot;
    root.hidden = !snapshot?.active;
    if (!snapshot?.active) {
      closePanel({ restoreFocus: false });
      return;
    }
    const urgent = snapshot.tasks.filter(task => ['critical', 'overdue', 'supervisor', 'breached'].includes(task.severity)).length;
    countBadge.textContent = String(Math.min(99, urgent || snapshot.metrics.totalPriorities));
    launcher.classList.toggle('has-urgent', urgent > 0);
    launcher.setAttribute('aria-label', `Open shift command centre. ${snapshot.metrics.totalPriorities} outstanding items, ${urgent} urgent.`);
    if (panelBackdrop) renderPanel(snapshot);
  };

  const refresh = stateOverride => {
    if (closed) return;
    const state = stateOverride || readActiveState();
    if (!state || typeof state !== 'object') {
      paintLauncher(null);
      return;
    }
    const snapshot = buildShiftCommandSnapshot(state, { now: Date.now(), windowRef });
    paintLauncher(snapshot);
  };

  const renderPanel = snapshot => {
    if (!panelBackdrop || !snapshot?.active) return;
    const oldDialog = panelBackdrop.querySelector('.calloria-command-panel');
    const oldList = panelBackdrop.querySelector('.calloria-command-tasklist');
    const oldFocus = documentRef.activeElement;
    const hadFocusInside = Boolean(oldDialog?.contains(oldFocus));
    const focusView = oldFocus?.dataset?.commandNavigate || null;
    const focusClose = oldFocus?.hasAttribute?.('data-command-close') || false;
    const scrollTop = oldList?.scrollTop || 0;
    const wrapper = documentRef.createElement('div');
    wrapper.innerHTML = buildShiftCommandPanelHTML(snapshot);
    const next = wrapper.firstElementChild;
    if (!next) return;
    panelBackdrop.replaceWith(next);
    panelBackdrop = next;
    panelBackdrop.addEventListener('click', event => {
      if (event.target === panelBackdrop) closePanel();
    });
    panelBackdrop.querySelectorAll('[data-command-close]').forEach(button => button.addEventListener('click', () => closePanel()));
    panelBackdrop.querySelectorAll('[data-command-navigate]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.commandNavigate)));
    const nextList = panelBackdrop.querySelector('.calloria-command-tasklist');
    if (nextList) nextList.scrollTop = scrollTop;
    if (hadFocusInside) {
      const focusTarget = focusClose
        ? panelBackdrop.querySelector('[data-command-close]')
        : focusView
          ? [...panelBackdrop.querySelectorAll('[data-command-navigate]')].find(button => button.dataset.commandNavigate === focusView)
          : panelBackdrop.querySelector('.calloria-command-panel');
      focusTarget?.focus({ preventScroll: true });
    }
  };

  const openPanel = () => {
    refresh();
    if (!lastSnapshot?.active) return;
    closePanel({ restoreFocus: false });
    previousFocus = documentRef.activeElement || launcher;
    const wrapper = documentRef.createElement('div');
    wrapper.innerHTML = buildShiftCommandPanelHTML(lastSnapshot);
    panelBackdrop = wrapper.firstElementChild;
    if (!panelBackdrop) return;
    documentRef.body.append(panelBackdrop);
    panelBackdrop.addEventListener('click', event => {
      if (event.target === panelBackdrop) closePanel();
    });
    panelBackdrop.querySelectorAll('[data-command-close]').forEach(button => button.addEventListener('click', () => closePanel()));
    panelBackdrop.querySelectorAll('[data-command-navigate]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.commandNavigate)));
    panelBackdrop.querySelector('.calloria-command-panel')?.focus({ preventScroll: true });
    keyHandler = event => {
      if (!panelBackdrop) return;
      if (event.key === 'Escape') {
        closePanel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...panelBackdrop.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (documentRef.activeElement === first || !panelBackdrop.contains(documentRef.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    documentRef.addEventListener('keydown', keyHandler);
    refreshTimer = windowRef.setInterval(() => refresh(), 5000);
  };

  launcher.addEventListener('click', openPanel);

  const onSaved = (key, value) => {
    if (!isSaveKey(key)) return;
    const parsed = parseState(value);
    if (!parsed) return;
    activeKey = key;
    refresh(parsed);
  };

  const patchedSetItem = function (key, value) {
    const result = originalSetItem.call(this, key, value);
    if (this === storage && isSaveKey(String(key))) onSaved(String(key), String(value));
    return result;
  };
  proto.setItem = patchedSetItem;

  const storageHandler = event => {
    if (event.storageArea === storage && isSaveKey(event.key)) {
      if (event.newValue) onSaved(event.key, event.newValue);
      else refresh();
    }
  };
  const visibilityHandler = () => { if (!documentRef.hidden) refresh(); };
  windowRef.addEventListener('storage', storageHandler);
  documentRef.addEventListener('visibilitychange', visibilityHandler);
  const initial = getInitialSavedState(storage);
  if (initial) {
    activeKey = initial.key;
    refresh(initial.state);
  } else {
    root.hidden = true;
  }

  windowRef.__CALLORIA_SHIFT_COMMAND_V691__ = true;
  return () => {
    closed = true;
    closePanel({ restoreFocus: false });
    windowRef.removeEventListener('storage', storageHandler);
    documentRef.removeEventListener('visibilitychange', visibilityHandler);
    if (proto.setItem === patchedSetItem) proto.setItem = originalSetItem;
    root.remove();
    delete windowRef.__CALLORIA_SHIFT_COMMAND_V691__;
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  installShiftCommandRuntime(window, document);
}
