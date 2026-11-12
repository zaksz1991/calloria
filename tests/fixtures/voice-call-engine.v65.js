(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaVoiceCallEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = '6.5.0';
  const STATES = Object.freeze({ CONNECTED: 'CONNECTED', ON_HOLD: 'ON HOLD', CONSULTING: 'CONSULTING', TRANSFERRED: 'TRANSFERRED' });
  const MAX_LOG = 50;

  function asDate(value) {
    const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(date.getTime())) throw new Error('A valid call timestamp is required.');
    return date;
  }
  function clean(value, max = 500) { return String(value == null ? '' : value).replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  function requireSession(session) { if (!session || session.version !== VERSION || !session.contactId) throw new Error('No valid voice-call session is active.'); }
  function appendLog(session, event, at, detail = '') {
    session.log = Array.isArray(session.log) ? session.log : [];
    session.log.unshift({ event, detail: clean(detail, 240), at: asDate(at).toISOString() });
    session.log = session.log.slice(0, MAX_LOG);
  }
  function elapsedMs(start, end) { return Math.max(0, asDate(end).getTime() - asDate(start).getTime()); }

  function createSession(contact, now) {
    if (!contact || !contact.id || String(contact.channel || '').toLowerCase() !== 'voice') return null;
    const at = asDate(now);
    return {
      version: VERSION,
      contactId: String(contact.id),
      reference: clean(contact.reference || contact.id, 80),
      channel: 'Voice',
      status: STATES.CONNECTED,
      startedAt: at.toISOString(),
      endedAt: null,
      holdStartedAt: null,
      heldMs: 0,
      muted: false,
      muteCount: 0,
      holdCount: 0,
      consultCount: 0,
      consult: null,
      transfer: null,
      log: [{ event: 'CALL_CONNECTED', detail: 'Customer voice contact accepted.', at: at.toISOString() }]
    };
  }

  function normaliseSession(raw, contact) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION) return createSession(contact, new Date());
    const fresh = createSession(contact, raw.startedAt || new Date());
    if (!fresh || raw.contactId !== fresh.contactId) return fresh;
    return {
      ...fresh,
      ...raw,
      log: Array.isArray(raw.log) ? raw.log.slice(0, MAX_LOG) : fresh.log,
      heldMs: Math.max(0, Number(raw.heldMs) || 0),
      muteCount: Math.max(0, Number(raw.muteCount) || 0),
      holdCount: Math.max(0, Number(raw.holdCount) || 0),
      consultCount: Math.max(0, Number(raw.consultCount) || 0)
    };
  }

  function assertConnected(session) {
    requireSession(session);
    if (session.status !== STATES.CONNECTED) throw new Error(`This action requires a connected call. Current state: ${session.status}.`);
  }
  function placeOnHold(session, reason, now) {
    assertConnected(session);
    const label = clean(reason, 120);
    if (label.length < 3) throw new Error('Select a reason before placing the customer on hold.');
    const at = asDate(now);
    session.status = STATES.ON_HOLD;
    session.holdStartedAt = at.toISOString();
    session.holdCount += 1;
    session.muted = false;
    session.holdReason = label;
    appendLog(session, 'CALL_HELD', at, label);
    return snapshot(session, at);
  }
  function resume(session, now) {
    requireSession(session);
    if (![STATES.ON_HOLD, STATES.CONSULTING].includes(session.status)) throw new Error('The call is not on hold.');
    const at = asDate(now);
    if (session.holdStartedAt) session.heldMs += elapsedMs(session.holdStartedAt, at);
    session.holdStartedAt = null;
    session.status = STATES.CONNECTED;
    session.muted = false;
    session.holdReason = null;
    appendLog(session, 'CALL_RESUMED', at, 'Customer returned to the agent.');
    return snapshot(session, at);
  }
  function toggleMute(session, now) {
    assertConnected(session);
    session.muted = !session.muted;
    if (session.muted) session.muteCount += 1;
    appendLog(session, session.muted ? 'MICROPHONE_MUTED' : 'MICROPHONE_UNMUTED', now, session.muted ? 'Agent microphone muted in simulation.' : 'Agent microphone unmuted in simulation.');
    return session.muted;
  }
  function beginConsult(session, input, now) {
    assertConnected(session);
    const reason = clean(input && input.reason, 120);
    const context = clean(input && input.context, 600);
    if (reason.length < 3) throw new Error('Select the reason for the supervisor consultation.');
    if (context.length < 20) throw new Error('Provide at least 20 characters of customer-safe context for the supervisor.');
    const at = asDate(now);
    session.status = STATES.CONSULTING;
    session.holdStartedAt = at.toISOString();
    session.holdCount += 1;
    session.muted = false;
    session.holdReason = `Supervisor consultation: ${reason}`;
    session.consult = {
      reason,
      context,
      startedAt: at.toISOString(),
      completedAt: null,
      guidance: guidanceFor(reason),
      status: 'IN PROGRESS'
    };
    session.consultCount += 1;
    appendLog(session, 'SUPERVISOR_CONSULT_STARTED', at, `${reason}. ${context}`);
    return { ...session.consult };
  }
  function guidanceFor(reason) {
    const text = String(reason || '').toLowerCase();
    if (text.includes('security') || text.includes('privacy')) return 'Stop sensitive activity, do not request passwords or one-time codes, verify identity only through the approved process, and follow the security escalation route.';
    if (text.includes('complaint') || text.includes('escalat')) return 'Acknowledge the customer impact, preserve the existing case, confirm an accountable owner and agree a realistic next-update point.';
    if (text.includes('policy') || text.includes('approval')) return 'Do not promise an exception. Confirm the applicable approved policy, record the decision owner and explain the next step without guessing.';
    if (text.includes('technical') || text.includes('product')) return 'Capture the exact product, affected step, observed error and checks already completed. Route unresolved product behaviour to the relevant specialist.';
    return 'Confirm the customer outcome, review the available approved guidance and document the decision owner before resuming the conversation.';
  }
  function completeConsult(session, now) {
    requireSession(session);
    if (session.status !== STATES.CONSULTING || !session.consult || session.consult.status !== 'IN PROGRESS') throw new Error('There is no supervisor consultation awaiting completion.');
    const at = asDate(now);
    session.consult.completedAt = at.toISOString();
    session.consult.status = 'COMPLETED';
    appendLog(session, 'SUPERVISOR_CONSULT_COMPLETED', at, session.consult.guidance);
    resume(session, at);
    return { ...session.consult };
  }
  function warmTransfer(session, input, now) {
    assertConnected(session);
    const destination = clean(input && input.destination, 100);
    const reason = clean(input && input.reason, 160);
    const handover = clean(input && input.handover, 700);
    if (destination.length < 3) throw new Error('Choose a specialist destination for the transfer.');
    if (reason.length < 5) throw new Error('Record why the transfer is required.');
    if (handover.length < 30) throw new Error('The handover summary must contain at least 30 characters.');
    const at = asDate(now);
    session.transfer = {
      destination,
      reason,
      handover,
      mode: 'WARM TRANSFER',
      status: 'COMPLETED',
      completedAt: at.toISOString()
    };
    session.status = STATES.TRANSFERRED;
    session.endedAt = at.toISOString();
    session.muted = false;
    appendLog(session, 'WARM_TRANSFER_COMPLETED', at, `${destination}: ${reason}. ${handover}`);
    return { ...session.transfer };
  }
  function snapshot(session, now) {
    requireSession(session);
    const at = asDate(now);
    const end = session.endedAt ? asDate(session.endedAt) : at;
    const totalMs = elapsedMs(session.startedAt, end);
    const currentHold = session.holdStartedAt ? elapsedMs(session.holdStartedAt, at) : 0;
    const heldMs = Math.min(totalMs, Math.max(0, (Number(session.heldMs) || 0) + currentHold));
    return {
      status: session.status,
      durationSeconds: Math.max(0, Math.floor((totalMs - heldMs) / 1000)),
      totalElapsedSeconds: Math.max(0, Math.floor(totalMs / 1000)),
      holdSeconds: Math.max(0, Math.floor(heldMs / 1000)),
      muted: !!session.muted,
      muteCount: Math.max(0, Number(session.muteCount) || 0),
      holdCount: Math.max(0, Number(session.holdCount) || 0),
      consultCount: Math.max(0, Number(session.consultCount) || 0),
      transferDestination: session.transfer && session.transfer.destination || null,
      transferred: session.status === STATES.TRANSFERRED
    };
  }
  function finalise(session, now) {
    requireSession(session);
    if ([STATES.ON_HOLD, STATES.CONSULTING].includes(session.status)) throw new Error('Resume the customer call before wrapping up.');
    if (session.status === STATES.CONNECTED) {
      session.endedAt = asDate(now).toISOString();
      appendLog(session, 'CALL_ENDED', now, 'Agent completed the simulated voice contact.');
    }
    const result = snapshot(session, now);
    result.endedAt = session.endedAt || asDate(now).toISOString();
    result.log = session.log.slice();
    if (session.consult) result.consultation = { reason: session.consult.reason, status: session.consult.status, guidance: session.consult.guidance };
    if (session.transfer) result.transfer = { ...session.transfer };
    return result;
  }
  function formatSeconds(value) {
    const seconds = Math.max(0, Math.floor(Number(value) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainder = seconds % 60;
    return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }
  return Object.freeze({ VERSION, STATES, createSession, normaliseSession, placeOnHold, resume, toggleMute, beginConsult, completeConsult, warmTransfer, snapshot, finalise, formatSeconds, guidanceFor, clean });
});
