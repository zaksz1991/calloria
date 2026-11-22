const MAX_CONTACTS = 30;
const MAX_CASES = 50;
const MAX_COACHING_EVENTS = 20;
const MIN_QUALIFYING_QA = 70;
const REQUIRED_CLEAN_CASES = 2;

function safeText(value, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function safeIso(value, fallback = new Date().toISOString()) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
}

function cloneList(value, limit) {
  return Array.isArray(value) ? value.slice(-limit).map(item => ({ ...item })) : [];
}

function normalizeBase(record) {
  const source = record && typeof record === 'object' ? record : {};
  const allowed = new Set(['supervised', 'review_pending', 'completed', 'started']);
  const rawStatus = allowed.has(source.status) ? source.status : 'supervised';
  const status = rawStatus === 'started' ? 'supervised' : rawStatus;
  const cases = cloneList(source.cases, MAX_CASES);
  const contacts = cloneList(source.connectedContacts, MAX_CONTACTS);
  const coachingEvents = cloneList(source.coachingEvents, MAX_COACHING_EVENTS);
  const completedCaseRefs = new Set(cases.map(item => safeText(item.reference, 100)).filter(Boolean));
  const normalizedCases = cases.filter(item => item.reference && completedCaseRefs.has(safeText(item.reference, 100)));
  return {
    version: 1,
    status,
    startedAt: safeIso(source.startedAt),
    monitoringStartedAt: source.monitoringStartedAt ? safeIso(source.monitoringStartedAt) : null,
    day: Math.max(1, Math.floor(Number(source.day) || 1)),
    monitoringDay: source.monitoringDay == null ? null : Math.max(1, Math.floor(Number(source.monitoringDay) || 1)),
    workstationId: safeText(source.workstationId, 40) || null,
    queueSkill: safeText(source.queueSkill, 80) || 'customer-care',
    source: 'first-independent-working-shift',
    mentor: safeText(source.mentor, 100) || 'Miriam Okafor (simulated mentor)',
    connectedContacts: contacts,
    cases: normalizedCases,
    coachingEvents,
    qualifiedSinceCoaching: Math.max(0, Math.floor(Number(source.qualifiedSinceCoaching) || 0)),
    coachingPending: Boolean(source.coachingPending),
    coachingReason: safeText(source.coachingReason, 300) || null,
    reviewRequest: source.reviewRequest && typeof source.reviewRequest === 'object'
      ? { requestedAt: safeIso(source.reviewRequest.requestedAt), reviewer: safeText(source.reviewRequest.reviewer, 100) || 'Miriam Okafor (simulated mentor)' }
      : null,
    mentorReview: source.mentorReview && typeof source.mentorReview === 'object'
      ? { ...source.mentorReview }
      : null,
    completedAt: source.completedAt ? safeIso(source.completedAt) : null
  };
}

export function createFirstShiftMentorRecord({ day = 1, workstationId = null, queueSkill = 'customer-care', startedAt = new Date().toISOString(), mentor = 'Miriam Okafor (simulated mentor)' } = {}) {
  return normalizeBase({
    version: 1,
    status: 'supervised',
    startedAt,
    monitoringStartedAt: startedAt,
    day,
    monitoringDay: day,
    workstationId,
    queueSkill,
    mentor,
    connectedContacts: [],
    cases: [],
    coachingEvents: [],
    qualifiedSinceCoaching: 0,
    coachingPending: false,
    coachingReason: null,
    reviewRequest: null,
    mentorReview: null,
    completedAt: null
  });
}

export function normalizeFirstShiftMentorRecord(record) {
  if (!record || typeof record !== 'object') return null;
  return normalizeBase(record);
}

export function recordMentorCallConnected(record, detail = {}, now = new Date().toISOString()) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current || current.status !== 'supervised') return { ok: false, record: current, reason: 'not-supervised' };
  const contactId = safeText(detail.contactId, 100);
  if (!contactId) return { ok: false, record: current, reason: 'missing-contact-id' };
  if (current.connectedContacts.some(item => item.contactId === contactId)) return { ok: true, duplicate: true, record: current };
  current.connectedContacts.push({ contactId, connectedAt: safeIso(now), priority: safeText(detail.priority, 40) || null });
  current.connectedContacts = current.connectedContacts.slice(-MAX_CONTACTS);
  return { ok: true, duplicate: false, record: current };
}

export function recordMentorCaseSaved(record, detail = {}, now = new Date().toISOString(), minQa = MIN_QUALIFYING_QA) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current || !['supervised', 'review_pending'].includes(current.status)) return { ok: false, record: current, reason: 'not-supervised' };
  const reference = safeText(detail.reference, 100);
  if (!reference) return { ok: false, record: current, reason: 'missing-case-reference' };
  if (current.cases.some(item => item.reference === reference)) return { ok: true, duplicate: true, record: current };
  // A new interaction after a review request reopens supervision; the evidence is never discarded.
  if (current.status === 'review_pending') {
    current.status = 'supervised';
    current.reviewRequest = null;
  }
  const parsedQa = detail.qa === null || detail.qa === undefined || detail.qa === '' ? null : Number(detail.qa);
  const qa = Number.isFinite(parsedQa) && parsedQa >= 0 && parsedQa <= 100 ? parsedQa : null;
  const breach = Boolean(detail.breach);
  const disposition = safeText(detail.disposition, 60) || 'not recorded';
  let outcome = 'unscored';
  let issue = null;
  if (breach) {
    outcome = 'coaching-required';
    issue = 'A compliance or safe-conduct breach was recorded. Mentor coaching is required.';
  } else if (qa === null) {
    outcome = 'coaching-required';
    issue = 'QA evidence is missing or invalid. Mentor review is required before sign-off.';
  } else if (qa < minQa) {
    outcome = 'coaching-required';
    issue = `QA score ${qa}/100 is below the ${minQa}/100 first-shift standard.`;
  } else if (detail.resolved === true || disposition === 'resolved') {
    outcome = 'qualified';
  } else {
    outcome = 'recorded';
  }
  const item = { reference, savedAt: safeIso(now), disposition, qa, breach, resolved: Boolean(detail.resolved), outcome, issue };
  current.cases.push(item);
  current.cases = current.cases.slice(-MAX_CASES);
  if (outcome === 'coaching-required') {
    current.coachingPending = true;
    current.coachingReason = issue;
    current.qualifiedSinceCoaching = 0;
  } else if (outcome === 'qualified' && !current.coachingPending) {
    current.qualifiedSinceCoaching += 1;
  }
  return { ok: true, duplicate: false, record: current, case: item };
}

export function acknowledgeMentorCoaching(record, reflection, reviewer = 'Miriam Okafor (simulated mentor)', now = new Date().toISOString()) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current || current.status !== 'supervised') return { ok: false, record: current, reason: 'not-supervised' };
  if (!current.coachingPending) return { ok: false, record: current, reason: 'no-coaching-pending' };
  const note = safeText(reflection, 1200);
  if (note.length < 20) return { ok: false, record: current, reason: 'reflection-too-short' };
  current.coachingEvents.push({
    acknowledgedAt: safeIso(now),
    reviewer: safeText(reviewer, 100) || 'Miriam Okafor (simulated mentor)',
    reflection: note,
    reason: current.coachingReason
  });
  current.coachingEvents = current.coachingEvents.slice(-MAX_COACHING_EVENTS);
  current.coachingPending = false;
  current.coachingReason = null;
  current.qualifiedSinceCoaching = 0;
  return { ok: true, record: current };
}

export function requestMentorReview(record, now = new Date().toISOString()) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current || current.status !== 'supervised') return { ok: false, record: current, reason: 'not-supervised' };
  if (current.coachingPending) return { ok: false, record: current, reason: 'coaching-pending' };
  if (current.qualifiedSinceCoaching < REQUIRED_CLEAN_CASES) return { ok: false, record: current, reason: 'insufficient-clean-cases' };
  current.status = 'review_pending';
  current.reviewRequest = { requestedAt: safeIso(now), reviewer: current.mentor };
  return { ok: true, record: current };
}

export function approveMentorReview(record, attestations = {}, reviewer = 'Miriam Okafor (simulated mentor)', now = new Date().toISOString()) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current || current.status !== 'review_pending') return { ok: false, record: current, reason: 'review-not-pending' };
  if (current.coachingPending) return { ok: false, record: current, reason: 'coaching-pending' };
  if (current.qualifiedSinceCoaching < REQUIRED_CLEAN_CASES) return { ok: false, record: current, reason: 'insufficient-clean-cases' };
  const required = ['evidenceReviewed', 'customerCareReady', 'safeConductConfirmed', 'crmAccuracyConfirmed'];
  if (!required.every(key => attestations[key] === true)) return { ok: false, record: current, reason: 'attestations-incomplete' };
  const completedAt = safeIso(now);
  current.status = 'completed';
  current.completedAt = completedAt;
  current.mentorReview = {
    reviewer: safeText(reviewer, 100) || 'Miriam Okafor (simulated mentor)',
    completedAt,
    simulated: true,
    attestations: Object.fromEntries(required.map(key => [key, true]))
  };
  current.reviewRequest = null;
  return { ok: true, record: current };
}

export function firstShiftMentorSnapshot(record) {
  const current = normalizeFirstShiftMentorRecord(record);
  if (!current) return null;
  const scored = current.cases.filter(item => Number.isFinite(item.qa));
  const latest = current.cases.at(-1) || null;
  return {
    status: current.status,
    callsConnected: current.connectedContacts.length,
    casesSaved: current.cases.length,
    qualifiedSinceCoaching: current.qualifiedSinceCoaching,
    requiredCleanCases: REQUIRED_CLEAN_CASES,
    coachingPending: current.coachingPending,
    coachingReason: current.coachingReason,
    latestQa: latest?.qa ?? null,
    latestCase: latest,
    averageQa: scored.length ? Math.round(scored.reduce((sum, item) => sum + item.qa, 0) / scored.length) : null,
    completedAt: current.completedAt,
    mentorReview: current.mentorReview
  };
}

export const FIRST_SHIFT_MENTOR_RULES = Object.freeze({ MIN_QUALIFYING_QA, REQUIRED_CLEAN_CASES, MAX_CONTACTS, MAX_CASES });
