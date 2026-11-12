(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaSocialMessagingEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.7.0';
  const CHANNELS = Object.freeze(['Social', 'SMS', 'In-app']);
  const MAX_STAGES = 3;
  const LIMITS = Object.freeze({ Social: Object.freeze({ PUBLIC: 280, PRIVATE: 700 }), SMS: 459, 'In-app': 900 });

  function date(value) {
    const result = value instanceof Date ? new Date(value) : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(result.getTime())) throw new Error('A valid date is required.');
    return result;
  }
  function clean(value, max = 900) {
    return String(value == null ? '' : value)
      .replace(/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
      .replace(/\r\n?/g, '\n')
      .split('\n').map((line) => line.replace(/[ \t]+/g, ' ').trim()).join('\n')
      .trim().slice(0, max);
  }
  function channelOf(contactOrChannel) {
    const raw = typeof contactOrChannel === 'string'
      ? contactOrChannel
      : contactOrChannel && contactOrChannel.channel;
    const value = String(raw || '').toLowerCase().replace(/[ _]+/g, '-').trim();
    if (value === 'in-app' || value === 'inapp' || value === 'in app') return 'In-app';
    if (value === 'sms' || value === 'text' || value === 'text-message') return 'SMS';
    if (value === 'social' || value === 'social-media') return 'Social';
    return '';
  }
  function isSupported(contactOrChannel) { return CHANNELS.includes(channelOf(contactOrChannel)); }
  function visibilityFor(channel, stage) {
    const canonical = channelOf(channel);
    if (canonical === 'Social') return Number(stage) === 0 ? 'PUBLIC' : 'PRIVATE';
    if (canonical === 'SMS') return 'SMS';
    if (canonical === 'In-app') return 'IN-APP';
    return '';
  }
  function characterLimit(channel, stage, body = '') {
    const canonical = channelOf(channel);
    if (canonical === 'Social') return Number(stage) === 0 ? LIMITS.Social.PUBLIC : LIMITS.Social.PRIVATE;
    if (canonical === 'SMS') return smsSegments(body).encoding === 'Unicode' ? 201 : LIMITS.SMS;
    return LIMITS[canonical] || 0;
  }
  function hasUnsafeCredentialRequest(text) {
    const value = String(text || '').toLowerCase();
    const credential = '(?:password|passcode|one[ -]?time (?:password|code|pin)|otp|pin|security answer)';
    const action = /\b(send|share|provide|tell me|give me|reply with|confirm|type)\b/g;
    let match;
    while ((match = action.exec(value))) {
      const tail = value.slice(action.lastIndex, Math.min(value.length, action.lastIndex + 70));
      if (!new RegExp('\\b' + credential + '\\b').test(tail)) continue;
      const prefix = value.slice(Math.max(0, match.index - 32), match.index);
      if (/\b(never|do not|don’t|don't|not|must not|never share|never send)\b/.test(prefix)) continue;
      return true;
    }
    return false;
  }
  function containsPersonalData(text) {
    const value = String(text || '');
    const email = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value);
    const phone = /(?:\+?\d[\d ()-]{7,}\d)/.test(value);
    const accountRef = /\b(?:account|customer|case|reference|ticket)\s*(?:number|no\.?|id|ref(?:erence)?)?\s*[:#-]?\s*[A-Z0-9-]{6,}\b/i.test(value);
    const longDigits = /\b\d{8,}\b/.test(value);
    return email || phone || accountRef || longDigits;
  }
  function smsSegments(text) {
    const value = String(text || '');
    // Approximate SMS encoding: ASCII text uses GSM-like limits; non-ASCII uses Unicode limits.
    const unicode = /[^\x00-\x7f£€¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|]/.test(value);
    const single = unicode ? 70 : 160;
    const joined = unicode ? 67 : 153;
    const length = value.length; // UTF-16 code units, including surrogate pairs, are relevant to Unicode SMS limits.
    const segments = length === 0 ? 0 : length <= single ? 1 : Math.ceil(length / joined);
    return { encoding: unicode ? 'Unicode' : 'GSM-compatible', characters: length, segments, singleSegmentLimit: single, concatenatedSegmentLimit: joined };
  }
  function createSession(contact, now) {
    if (!isSupported(contact)) return null;
    const channel = channelOf(contact);
    const acceptedAt = date(now);
    const marketingConsent = !!(contact && (contact.smsMarketingConsent === true || (contact.consent && contact.consent.smsMarketing === true)));
    return {
      version: VERSION,
      contactId: String(contact && contact.id || ''),
      reference: clean(contact && (contact.reference || contact.id) || 'CONTACT', 80),
      channel,
      status: 'ACTIVE',
      acceptedAt: acceptedAt.toISOString(),
      stageDrafts: {},
      stageReviews: {},
      stagePreparedAt: {},
      stageSentAt: {},
      stageVisibility: {},
      responseSeconds: [],
      smsSegments: 0,
      totalReplies: 0,
      currentStage: 0,
      stageStartedAt: acceptedAt.toISOString(),
      marketingConsent,
      log: []
    };
  }
  function normaliseSession(raw, contact, now) {
    if (!isSupported(contact)) return null;
    const fresh = createSession(contact, now);
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || raw.contactId !== fresh.contactId || raw.channel !== fresh.channel) return fresh;
    const objectMap = (value) => value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
    return {
      ...fresh,
      ...raw,
      stageDrafts: objectMap(raw.stageDrafts),
      stageReviews: objectMap(raw.stageReviews),
      stagePreparedAt: objectMap(raw.stagePreparedAt),
      stageSentAt: objectMap(raw.stageSentAt),
      stageVisibility: objectMap(raw.stageVisibility),
      responseSeconds: Array.isArray(raw.responseSeconds) ? raw.responseSeconds.slice(0, MAX_STAGES).map((value) => Math.max(0, Number(value) || 0)) : [],
      smsSegments: Math.max(0, Number(raw.smsSegments) || 0),
      totalReplies: Math.max(0, Math.min(MAX_STAGES, Number(raw.totalReplies) || 0)),
      currentStage: Math.max(0, Math.min(MAX_STAGES - 1, Number(raw.currentStage) || 0)),
      marketingConsent: fresh.marketingConsent || raw.marketingConsent === true,
      log: Array.isArray(raw.log) ? raw.log.slice(0, 40) : []
    };
  }
  function reviewReply(channel, stage, body, marketingConsent) {
    const canonical = channelOf(channel);
    if (!CHANNELS.includes(canonical)) throw new Error('Social, SMS or In-app channel required.');
    const visibility = visibilityFor(canonical, stage);
    const text = clean(body, 2000);
    const limit = characterLimit(canonical, stage, text);
    const personalData = canonical === 'Social' && visibility === 'PUBLIC' && containsPersonalData(text);
    const credentialRequest = hasUnsafeCredentialRequest(text);
    const marketingContent = canonical === 'SMS' && /\b(marketing updates|promotional offer|special discount|subscribe for offers|new product promotions)\b/i.test(text);
    const actionable = canonical !== 'In-app' || Number(stage) === 0 || /\b(open|tap|select|choose|go to|navigate|settings|step|press|click|restart|refresh|check|update)\b/i.test(text);
    const checks = [
      { id: 'length', label: `Useful response within ${limit} characters`, passed: text.length >= 20 && text.length <= limit, points: 30 },
      { id: 'credential-safety', label: 'Does not request passwords, PINs or one-time codes', passed: !credentialRequest, points: 30 },
      { id: 'privacy', label: visibility !== 'PUBLIC' || !personalData ? 'No personal data disclosed publicly' : 'No personal data disclosed publicly', passed: !personalData, points: 25 },
      { id: 'action', label: canonical === 'In-app' ? 'Includes a clear in-product action' : canonical === 'Social' && visibility === 'PUBLIC' ? 'Public reply keeps case details private' : 'Customer-facing response is clear', passed: actionable && text.length >= 20, points: 10 },
      { id: 'marketing-consent', label: 'Promotional SMS has verified consent', passed: !marketingContent || !!marketingConsent, points: 5 }
    ];
    const score = checks.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
    const critical = credentialRequest || personalData || (marketingContent && !marketingConsent);
    const required = ['length', 'credential-safety', 'privacy', 'action', 'marketing-consent'];
    const canSend = !critical && checks.filter((item) => required.includes(item.id)).every((item) => item.passed);
    const failed = checks.filter((item) => !item.passed).map((item) => item.label.toLowerCase());
    const feedback = credentialRequest
      ? 'Critical security failure: never ask a customer to send a password, PIN or one-time code.'
      : personalData
        ? 'Privacy block: never publish customer email addresses, phone numbers, account details or references in a public social reply.'
        : marketingContent && !marketingConsent
          ? 'Consent block: promotional SMS requires verified marketing consent. Keep this response service-related.'
          : failed.length ? `Improve this response: ${failed.join('; ')}.`
            : 'Response meets the simulated channel safety and quality checks.';
    const sms = canonical === 'SMS' ? smsSegments(text) : null;
    return { channel: canonical, stage: Number(stage), visibility, limit, characterCount: text.length, score, checks, critical, canSend, feedback, marketingContent, sms };
  }
  function saveDraft(session, stage, body) {
    if (!session || session.version !== VERSION) throw new Error('No active social messaging session is available.');
    const index = Number(stage);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_STAGES) throw new Error('Invalid response stage.');
    if (session.stageSentAt[index]) throw new Error('A response has already been recorded for this stage.');
    if (session.stagePreparedAt[index]) throw new Error('This response is already prepared.');
    const draft = clean(body, 900);
    const limit = characterLimit(session.channel, index, draft);
    session.stageDrafts[index] = draft;
    delete session.stageReviews[index];
    return { draft, characterCount: draft.length, limit };
  }
  function hasPreparedReply(session, stage) {
    return !!(session && session.version === VERSION && session.stagePreparedAt && session.stagePreparedAt[Number(stage)] && !session.stageSentAt[Number(stage)]);
  }
  function prepareReply(session, stage, body, now) {
    if (!session || session.version !== VERSION) throw new Error('No active social messaging session is available.');
    const index = Number(stage);
    if (!Number.isInteger(index) || index < 0 || index >= MAX_STAGES) throw new Error('Invalid response stage.');
    if (session.stageSentAt[index]) throw new Error('A response has already been recorded for this stage.');
    if (session.stagePreparedAt[index]) throw new Error('This response is already prepared.');
    const saved = saveDraft(session, index, body);
    const review = reviewReply(session.channel, index, saved.draft, session.marketingConsent);
    session.stageReviews[index] = review;
    if (!review.canSend) return { ...review, prepared: false };
    const at = date(now);
    session.stagePreparedAt[index] = at.toISOString();
    session.stageVisibility[index] = review.visibility;
    session.log.unshift({ event: 'RESPONSE_PREPARED', stage: index + 1, visibility: review.visibility, at: at.toISOString(), detail: `${review.characterCount} characters; quality ${review.score}/100.` });
    session.log = session.log.slice(0, 40);
    return { ...review, prepared: true };
  }
  function commitReply(session, stage, now) {
    if (!hasPreparedReply(session, stage)) throw new Error('Prepare a safe customer-facing reply before selecting the service action.');
    const index = Number(stage);
    const at = date(now);
    const started = date(session.stageStartedAt || session.acceptedAt);
    const responseSeconds = Math.max(0, Math.round((at.getTime() - started.getTime()) / 1000));
    const visibility = session.stageVisibility[index] || visibilityFor(session.channel, index);
    const content = session.stageDrafts[index];
    const review = session.stageReviews[index];
    const sms = session.channel === 'SMS' ? smsSegments(content) : null;
    session.stageSentAt[index] = at.toISOString();
    session.responseSeconds.push(responseSeconds);
    session.totalReplies += 1;
    if (sms) session.smsSegments += sms.segments;
    session.log.unshift({ event: 'RESPONSE_RECORDED', stage: index + 1, visibility, at: at.toISOString(), detail: `${responseSeconds}s response time; ${review ? review.score : 0}/100.` });
    session.log = session.log.slice(0, 40);
    return { stage: index, visibility, body: content, responseSeconds, qualityScore: review ? review.score : 0, sms };
  }
  function advanceStage(session, nextStage, now) {
    if (!session || session.version !== VERSION) return null;
    const next = Number(nextStage);
    if (!Number.isInteger(next) || next < 0 || next >= MAX_STAGES) return null;
    if (!session.stageSentAt[next - 1]) return null;
    session.currentStage = next;
    session.stageStartedAt = date(now).toISOString();
    return next;
  }
  function finalise(session, now) {
    if (!session || session.version !== VERSION) return null;
    const sentStages = Object.keys(session.stageSentAt || {}).length;
    if (sentStages !== MAX_STAGES || session.totalReplies !== MAX_STAGES) throw new Error('All three Social, SMS or In-app customer replies must be recorded before wrap-up.');
    const times = Array.isArray(session.responseSeconds) ? session.responseSeconds : [];
    const averageResponseSeconds = times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0;
    const result = {
      channel: session.channel,
      replies: session.totalReplies,
      averageResponseSeconds,
      responseSeconds: times.slice(0, MAX_STAGES),
      qualityScores: Object.values(session.stageReviews || {}).map((review) => Number(review.score) || 0),
      averageQuality: Object.values(session.stageReviews || {}).length ? Math.round(Object.values(session.stageReviews).reduce((sum, review) => sum + (Number(review.score) || 0), 0) / Object.values(session.stageReviews).length) : 0,
      publicReplies: Object.values(session.stageVisibility || {}).filter((value) => value === 'PUBLIC').length,
      privateReplies: Object.values(session.stageVisibility || {}).filter((value) => value === 'PRIVATE').length,
      smsSegments: session.smsSegments || 0,
      log: (session.log || []).slice(),
      completedAt: date(now).toISOString()
    };
    session.status = 'COMPLETED';
    return result;
  }
  return Object.freeze({ VERSION, CHANNELS, MAX_STAGES, LIMITS, isSupported, channelOf, visibilityFor, characterLimit, hasUnsafeCredentialRequest, containsPersonalData, smsSegments, createSession, normaliseSession, reviewReply, saveDraft, hasPreparedReply, prepareReply, commitReply, advanceStage, finalise, clean });
});
