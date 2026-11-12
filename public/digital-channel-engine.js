(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaDigitalChannelEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.6.0';
  const EMAIL_TARGET_MINUTES = Object.freeze({ P1: 60, P2: 120, P3: 240, P4: 360 });
  const MAX_MESSAGES = 3;

  function date(value) {
    const result = value instanceof Date ? new Date(value) : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(result.getTime())) throw new Error('A valid date is required.');
    return result;
  }
  function clean(value, max = 3000) {
    return String(value == null ? '' : value)
      .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function cleanBody(value, max = 3000) {
    return String(value == null ? '' : value)
      .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/\r\n?/g, '\n')
      .split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
      .trim().slice(0, max);
  }
  function channelOf(contact) { return String(contact && contact.channel || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function isDigital(contact) { return ['email', 'live chat', 'livechat'].includes(channelOf(contact)); }
  function canonicalChannel(contact) { return channelOf(contact) === 'email' ? 'Email' : 'Live chat'; }
  function priorityCode(priority) {
    const match = String(priority || '').match(/P[1-4]/i);
    return match ? match[0].toUpperCase() : 'P3';
  }
  function targetFor(priority) { return EMAIL_TARGET_MINUTES[priorityCode(priority)]; }
  function createSession(contact, shiftMinute, now) {
    if (!isDigital(contact)) return null;
    const acceptedAt = date(now);
    const channel = canonicalChannel(contact);
    const base = {
      version: VERSION,
      contactId: String(contact.id || ''),
      reference: clean(contact.reference || contact.id || 'CONTACT', 80),
      channel,
      status: channel === 'Email' ? 'AWAITING_REPLY' : 'ACTIVE',
      acceptedAt: acceptedAt.toISOString(),
      acceptedShiftMinute: Math.max(0, Number(shiftMinute) || 0),
      sentAt: null,
      sentAtShiftMinute: null,
      responseSeconds: [],
      log: []
    };
    if (channel === 'Email') {
      base.emailTargetMinutes = targetFor(contact.priority);
      base.subject = `Re: ${clean(contact.subject || 'Customer enquiry', 140)}`;
      base.body = '';
      base.quality = null;
      base.slaBreached = false;
    } else {
      base.stageDrafts = {};
      base.stageSentAt = {};
      base.currentStage = 0;
      base.stageStartedAt = acceptedAt.toISOString();
      base.totalReplies = 0;
      base.lastPreparedAt = null;
    }
    return base;
  }
  function normaliseSession(raw, contact, shiftMinute, now) {
    if (!isDigital(contact)) return null;
    const fresh = createSession(contact, shiftMinute, now);
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || raw.contactId !== fresh.contactId || raw.channel !== fresh.channel) return fresh;
    if (fresh.channel === 'Email') {
      return {
        ...fresh, ...raw,
        emailTargetMinutes: targetFor(contact.priority),
        responseSeconds: Array.isArray(raw.responseSeconds) ? raw.responseSeconds.slice(0, 20).map((x) => Math.max(0, Number(x) || 0)) : [],
        log: Array.isArray(raw.log) ? raw.log.slice(0, 40) : []
      };
    }
    return {
      ...fresh, ...raw,
      stageDrafts: raw.stageDrafts && typeof raw.stageDrafts === 'object' ? { ...raw.stageDrafts } : {},
      stageSentAt: raw.stageSentAt && typeof raw.stageSentAt === 'object' ? { ...raw.stageSentAt } : {},
      responseSeconds: Array.isArray(raw.responseSeconds) ? raw.responseSeconds.slice(0, 20).map((x) => Math.max(0, Number(x) || 0)) : [],
      totalReplies: Math.max(0, Number(raw.totalReplies) || 0),
      currentStage: Math.max(0, Math.min(2, Number(raw.currentStage) || 0)),
      log: Array.isArray(raw.log) ? raw.log.slice(0, 40) : []
    };
  }
  function unsafeCredentialRequest(text) {
    const value = String(text || '').toLowerCase();
    const credential = '(?:password|passcode|one[ -]?time (?:password|code|pin)|otp|pin)';
    const action = /\b(send|share|provide|tell me|give me|reply with|confirm)\b/g;
    let match;
    while ((match = action.exec(value))) {
      const tail = value.slice(action.lastIndex, Math.min(value.length, action.lastIndex + 65));
      const credentialMatch = new RegExp('\\b' + credential + '\\b').exec(tail);
      if (!credentialMatch) continue;
      const prefix = value.slice(Math.max(0, match.index - 28), match.index);
      if (/\b(never|do not|don\u2019t|don't|not|must not)\b/.test(prefix)) continue;
      return true;
    }
    return false;
  }
  function emailReview(subject, body) {
    const title = clean(subject, 140);
    const text = cleanBody(body, 3000);
    const checks = [
      { id: 'subject', label: 'Clear subject line', passed: title.length >= 5, points: 10 },
      { id: 'greeting', label: 'Professional greeting', passed: /^(dear|hello|hi|good morning|good afternoon)\b/i.test(text), points: 10 },
      { id: 'acknowledgement', label: 'Acknowledge the customer and their issue', passed: /(thank you|thanks for|understand|sorry|apolog|appreciate|concern)/i.test(text), points: 15 },
      { id: 'action', label: 'State what was checked or what action is being taken', passed: /(check|review|confirm|investigat|record|raise|route|guide|provide|update|support|found|verified)/i.test(text), points: 25 },
      { id: 'next-step', label: 'Give a clear next step or update expectation', passed: /(next step|will update|update you|within|by [0-9]|\btoday\b|\btomorrow\b|business day|follow up|contact you|\bonce\b|if this continues|case reference)/i.test(text), points: 25 },
      { id: 'signoff', label: 'Professional sign-off', passed: /(regards|kind regards|best regards|sincerely|thank you,?\s*\n)/i.test(text), points: 10 },
      { id: 'length', label: 'Sufficient detail (at least 60 characters)', passed: text.length >= 60, points: 5 },
      { id: 'placeholders', label: 'No unfilled template placeholders', passed: !/\[[^\]]+\]/.test(text), points: 0 }
    ];
    const score = checks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
    const critical = unsafeCredentialRequest(text);
    const requiredIds = ['subject', 'greeting', 'acknowledgement', 'action', 'next-step', 'length', 'placeholders'];
    const requiredChecksPassed = checks.filter((item) => requiredIds.includes(item.id)).every((item) => item.passed);
    const missing = checks.filter((item) => requiredIds.includes(item.id) && !item.passed).map((item) => item.label.toLowerCase());
    return {
      score,
      checks,
      critical,
      canSend: !critical && requiredChecksPassed && score >= 80,
      feedback: critical ? 'Critical security failure: never ask a customer to send a password, PIN or one-time code.'
        : missing.length ? `Complete required checks: ${missing.join('; ')}.`
          : score < 80 ? 'Improve the reply quality score before sending.'
            : 'Reply meets the minimum simulated email quality standard.'
    };
  }
  function record(session, event, at, detail = '') {
    session.log = Array.isArray(session.log) ? session.log : [];
    session.log.unshift({ event, detail: clean(detail, 300), at: date(at).toISOString() });
    session.log = session.log.slice(0, 40);
  }
  function emailSlaSnapshot(session, currentShiftMinute) {
    if (!session || session.channel !== 'Email') throw new Error('An email session is required.');
    const elapsed = Math.max(0, (Number(currentShiftMinute) || 0) - session.acceptedShiftMinute);
    const remaining = Math.max(0, session.emailTargetMinutes - elapsed);
    const sent = session.status === 'SENT';
    return {
      targetMinutes: session.emailTargetMinutes,
      elapsedMinutes: elapsed,
      remainingMinutes: remaining,
      breached: sent ? !!session.slaBreached : elapsed > session.emailTargetMinutes,
      status: sent ? (session.slaBreached ? 'SENT · TARGET MISSED' : 'SENT · WITHIN TARGET') : elapsed > session.emailTargetMinutes ? 'TARGET MISSED' : 'WITHIN TARGET'
    };
  }
  function sendEmail(session, input, currentShiftMinute, now) {
    if (!session || session.version !== VERSION || session.channel !== 'Email') throw new Error('No active email session is available.');
    if (session.status === 'SENT') throw new Error('This email response has already been sent.');
    const subject = clean(input && input.subject, 140);
    const body = cleanBody(input && input.body, 3000);
    const quality = emailReview(subject, body);
    if (!quality.canSend) throw new Error(quality.feedback);
    const at = date(now);
    session.subject = subject;
    session.body = body;
    session.quality = quality;
    session.sentAt = at.toISOString();
    session.sentAtShiftMinute = Math.max(0, Number(currentShiftMinute) || 0);
    session.slaBreached = session.sentAtShiftMinute - session.acceptedShiftMinute > session.emailTargetMinutes;
    session.status = 'SENT';
    record(session, 'EMAIL_REPLY_SENT', at, `Quality ${quality.score}/100; ${session.slaBreached ? 'target missed' : 'within target'}.`);
    return { subject, body, quality, sla: emailSlaSnapshot(session, currentShiftMinute), sentAt: session.sentAt };
  }
  function prepareChatReply(session, stageIndex, body, now) {
    if (!session || session.version !== VERSION || session.channel !== 'Live chat') throw new Error('No active live-chat session is available.');
    const stage = Number(stageIndex);
    if (!Number.isInteger(stage) || stage < 0 || stage >= MAX_MESSAGES) throw new Error('Invalid live-chat stage.');
    if (session.stageSentAt[stage]) throw new Error('A response has already been recorded for this chat stage.');
    const text = clean(body, 700);
    if (text.length < 12) throw new Error('Write at least 12 characters so the customer receives a useful response.');
    if (unsafeCredentialRequest(text)) throw new Error('Security control: never ask a customer to send a password, PIN or one-time code.');
    const at = date(now);
    session.stageDrafts[stage] = text;
    session.lastPreparedAt = at.toISOString();
    record(session, 'CHAT_REPLY_PREPARED', at, `Stage ${stage + 1}; ${text.length} characters.`);
    return { stage, body: text, characterCount: text.length, preparedAt: session.lastPreparedAt };
  }
  function hasPreparedChatReply(session, stageIndex) {
    if (!session || session.channel !== 'Live chat') return false;
    return typeof session.stageDrafts[Number(stageIndex)] === 'string' && !!session.stageDrafts[Number(stageIndex)].trim() && !session.stageSentAt[Number(stageIndex)];
  }
  function commitChatReply(session, stageIndex, now) {
    if (!hasPreparedChatReply(session, stageIndex)) throw new Error('Prepare a customer-facing chat response before selecting the service action.');
    const stage = Number(stageIndex);
    const at = date(now);
    const started = date(session.stageStartedAt || session.acceptedAt);
    const responseSeconds = Math.max(0, Math.round((at.getTime() - started.getTime()) / 1000));
    const result = { stage, body: session.stageDrafts[stage], responseSeconds, sentAt: at.toISOString() };
    session.stageSentAt[stage] = at.toISOString();
    session.responseSeconds.push(responseSeconds);
    session.totalReplies += 1;
    session.currentStage = Math.min(MAX_MESSAGES - 1, stage + 1);
    record(session, 'CHAT_REPLY_SENT', at, `Stage ${stage + 1}; first response ${responseSeconds} seconds.`);
    return result;
  }
  function advanceChatStage(session, nextStageIndex, now) {
    if (!session || session.channel !== 'Live chat') return null;
    const next = Number(nextStageIndex);
    if (!Number.isInteger(next) || next < 0 || next > MAX_MESSAGES - 1) return null;
    session.currentStage = next;
    session.stageStartedAt = date(now).toISOString();
    return session.currentStage;
  }
  function finalise(session, currentShiftMinute, now) {
    if (!session || session.version !== VERSION) return null;
    if (session.channel === 'Email') {
      const sla = emailSlaSnapshot(session, currentShiftMinute);
      return {
        channel: 'Email', sent: session.status === 'SENT', qualityScore: session.quality ? session.quality.score : null,
        slaTargetMinutes: sla.targetMinutes, slaElapsedMinutes: sla.elapsedMinutes,
        slaBreached: sla.breached, sentAt: session.sentAt, log: (session.log || []).slice()
      };
    }
    const values = Array.isArray(session.responseSeconds) ? session.responseSeconds : [];
    return {
      channel: 'Live chat', replies: session.totalReplies,
      averageResponseSeconds: values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0,
      responseSeconds: values.slice(), allStagesAnswered: Object.keys(session.stageSentAt || {}).length === MAX_MESSAGES,
      log: (session.log || []).slice(), completedAt: date(now).toISOString()
    };
  }
  return Object.freeze({ VERSION, EMAIL_TARGET_MINUTES, isDigital, canonicalChannel, createSession, normaliseSession, emailReview, unsafeCredentialRequest, emailSlaSnapshot, sendEmail, prepareChatReply, hasPreparedChatReply, commitChatReply, advanceChatStage, finalise, clean, cleanBody });
});
