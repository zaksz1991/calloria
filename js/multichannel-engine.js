/**
 * CALLORIA Multi-channel Operations Engine.
 * Deterministic, synthetic email, live-chat and social-media workflow logic.
 * This module never connects to real inboxes, social accounts or customers.
 */

export const DIGITAL_CHANNELS = Object.freeze({
  email: Object.freeze({ label: 'Email', icon: '✉', slaMinutes: 240, description: 'Written case response and documented follow-up.' }),
  live_chat: Object.freeze({ label: 'Live chat', icon: '▣', slaMinutes: 2, description: 'Near-real-time conversation with concise, safe guidance.' }),
  social: Object.freeze({ label: 'Social media', icon: '◎', slaMinutes: 20, description: 'Public acknowledgement and privacy-safe private support.' })
});

export const DIGITAL_STATUS = Object.freeze({
  QUEUED: 'queued',
  ACTIVE: 'active',
  AWAITING_CUSTOMER: 'awaiting_customer',
  PENDING_CUSTOMER: 'pending_customer',
  RESOLVED: 'resolved',
  ESCALATED: 'escalated'
});

const PRIORITY_WEIGHT = Object.freeze({ critical: 3, high: 2, normal: 1, low: 0 });
const TERMINAL_STATUS = new Set([DIGITAL_STATUS.RESOLVED, DIGITAL_STATUS.ESCALATED]);

export const DIGITAL_SCENARIOS = Object.freeze([
  Object.freeze({
    id: 'email-debit-reversal', channel: 'email', customer: 'Amina Yusuf', initials: 'AY',
    subject: 'Card debit has not been reversed', priority: 'high', routeGroup: 'Cards & Payments',
    preview: 'I was charged twice for one purchase. The merchant says only one payment arrived.',
    opening: 'I was charged twice for one purchase. The merchant says only one payment arrived. Please help me understand what happens next.',
    followUp: 'Thank you. I can provide the transaction date and the reference from my receipt through your approved secure process.',
    guidance: ['Acknowledge the inconvenience without promising an automatic refund.', 'Explain that the transaction must be checked in the approved system.', 'Request only permitted reference details through an approved secure process.', 'Give a traceable case reference and a confirmed next step.'],
    keywords: ['understand', 'review', 'trace', 'reference', 'update']
  }),
  Object.freeze({
    id: 'email-transfer-delay', channel: 'email', customer: 'Emeka Nwosu', initials: 'EN',
    subject: 'Transfer recipient has not received funds', priority: 'normal', routeGroup: 'Transfers Support',
    preview: 'My transfer is showing successful, but the beneficiary says it is not reflecting.',
    opening: 'My transfer is showing successful, but the beneficiary says it is not reflecting. I need a clear update.',
    followUp: 'I have the date and transaction reference. Please confirm the appropriate investigation route.',
    guidance: ['Acknowledge the concern and avoid declaring the transfer final without checking.', 'Explain the trace or investigation process at a high level.', 'Avoid requesting full account credentials or payment secrets.', 'Record the reference, owner and expected update process.'],
    keywords: ['check', 'trace', 'investigate', 'reference', 'update']
  }),
  Object.freeze({
    id: 'chat-mobile-access', channel: 'live_chat', customer: 'Chinwe Okafor', initials: 'CO',
    subject: 'Cannot sign in to mobile banking', priority: 'high', routeGroup: 'Digital Support',
    preview: 'The app keeps returning an error after I enter my details.',
    opening: 'The app keeps returning an error after I enter my details. I need help getting back in.',
    followUp: 'The error appears after the app loads. I have not shared my password or one-time code.',
    guidance: ['Acknowledge the access problem and use a calm, concise response.', 'Never request a password, PIN or one-time passcode.', 'Use approved troubleshooting and ask for a non-sensitive error description.', 'Escalate suspected account compromise through the secure route.'],
    keywords: ['understand', 'help', 'error', 'check', 'secure']
  }),
  Object.freeze({
    id: 'chat-card-status', channel: 'live_chat', customer: 'Tunde Bello', initials: 'TB',
    subject: 'Replacement card status', priority: 'normal', routeGroup: 'Cards & Payments',
    preview: 'I requested a replacement card and want to know whether it is ready.',
    opening: 'I requested a replacement card and want to know whether it is ready for collection.',
    followUp: 'I can confirm the request reference using your approved verification process.',
    guidance: ['Confirm the reason for contact and use the permitted verification process.', 'Check the simulated card-request status rather than guessing.', 'Do not expose full card details in chat.', 'Explain the verified collection or follow-up step.'],
    keywords: ['check', 'request', 'status', 'confirm', 'collection']
  }),
  Object.freeze({
    id: 'social-pos-complaint', channel: 'social', customer: 'Bola Adeyemi', initials: 'BA',
    subject: 'Public complaint about a POS debit', priority: 'critical', routeGroup: 'Fraud & Payments',
    preview: 'Your POS terminal debited my account and the shop says the payment failed. This is unacceptable.',
    opening: 'Your POS terminal debited my account and the shop says the payment failed. This is unacceptable.',
    followUp: 'I have sent a message through the verified private support route. Please advise the next step there.',
    guidance: ['Acknowledge the public complaint without disclosing account information.', 'Do not request account numbers, card data or transaction secrets publicly.', 'Invite the customer to an approved verified private support channel.', 'Create a traceable case and route suspected duplicate or failed transactions correctly.'],
    keywords: ['sorry', 'understand', 'private', 'message', 'case']
  }),
  Object.freeze({
    id: 'social-branch-wait', channel: 'social', customer: 'Samuel Eze', initials: 'SE',
    subject: 'Long wait at a service location', priority: 'low', routeGroup: 'Customer Experience',
    preview: 'I have been waiting too long at the branch. Does anyone manage service quality?',
    opening: 'I have been waiting too long at the branch. Does anyone manage service quality?',
    followUp: 'Thank you for acknowledging this. I would like the feedback to reach the appropriate service team.',
    guidance: ['Acknowledge the experience and avoid arguing publicly.', 'Do not ask the customer to publish personal details.', 'Move any account-specific conversation to an official private channel.', 'Log service feedback for the correct team and explain the next step.'],
    keywords: ['acknowledge', 'sorry', 'feedback', 'service', 'team']
  })
]);

function makeId(sequence, now) {
  return `DIG-${Number(now).toString(36).toUpperCase()}-${Number(sequence).toString(36).toUpperCase().padStart(3, '0')}`;
}

function requiredString(value, label, maxLength = 1200) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required.`);
  if (text.length > maxLength) throw new RangeError(`${label} must be ${maxLength} characters or fewer.`);
  return text;
}

export function findDigitalContact(queue, id) {
  return (Array.isArray(queue) ? queue : []).find(item => item?.id === id) || null;
}

export function createDigitalQueue(scenarios = DIGITAL_SCENARIOS, count = 6, options = {}) {
  const source = Array.isArray(scenarios) ? scenarios.filter(item => item && DIGITAL_CHANNELS[item.channel]) : [];
  if (!source.length || !Number.isFinite(count) || count <= 0) return [];
  const now = Number(options.now ?? Date.now());
  const sequence = Math.max(0, Math.floor(Number(options.sequence ?? 0)));
  const total = Math.min(30, Math.floor(count));
  return Array.from({ length: total }, (_, index) => {
    const scenario = source[(sequence + index) % source.length];
    const receivedAt = now - (total - index) * 45000;
    return {
      id: makeId(sequence + index + 1, now),
      scenarioId: scenario.id,
      channel: scenario.channel,
      channelLabel: DIGITAL_CHANNELS[scenario.channel].label,
      customer: scenario.customer,
      initials: scenario.initials,
      subject: scenario.subject,
      preview: scenario.preview,
      opening: scenario.opening,
      followUp: scenario.followUp || '',
      guidance: [...(scenario.guidance || [])],
      keywords: [...(scenario.keywords || [])],
      priority: scenario.priority || 'normal',
      routeGroup: scenario.routeGroup || 'Customer Services',
      slaMinutes: DIGITAL_CHANNELS[scenario.channel].slaMinutes,
      status: DIGITAL_STATUS.QUEUED,
      receivedAt: new Date(receivedAt).toISOString(),
      acceptedAt: null,
      firstResponseAt: null,
      completedAt: null,
      assignedTo: null,
      replyCount: 0,
      followUpDelivered: false,
      messages: [{ id: `${makeId(sequence + index + 1, now)}-C1`, type: 'customer', text: scenario.opening, at: new Date(receivedAt).toISOString() }],
      qaScore: null,
      disposition: null,
      notes: '',
      timeline: [{ at: new Date(receivedAt).toISOString(), event: 'Synthetic digital contact received', status: DIGITAL_STATUS.QUEUED }]
    };
  });
}

export function sortDigitalQueue(queue, { channel = 'all', now = Date.now() } = {}) {
  return (Array.isArray(queue) ? queue : [])
    .filter(item => item?.status === DIGITAL_STATUS.QUEUED && (channel === 'all' || item.channel === channel))
    .slice()
    .sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 1) - (PRIORITY_WEIGHT[a.priority] ?? 1)
      || Date.parse(a.receivedAt || 0) - Date.parse(b.receivedAt || 0)
      || String(a.id).localeCompare(String(b.id)))
    .map(item => ({ ...item, waitSeconds: Math.max(0, Math.floor((now - Date.parse(item.receivedAt || now)) / 1000)) }));
}

export function acceptDigitalContact(queue, contactId, agentId, now = Date.now()) {
  const contact = findDigitalContact(queue, contactId);
  if (!contact) throw new Error('Digital contact was not found.');
  if (contact.status !== DIGITAL_STATUS.QUEUED) throw new Error('Only a queued digital contact can be accepted.');
  contact.status = DIGITAL_STATUS.ACTIVE;
  contact.acceptedAt = new Date(now).toISOString();
  contact.assignedTo = requiredString(agentId, 'Agent reference', 80);
  contact.timeline.push({ at: contact.acceptedAt, event: 'Digital contact accepted by agent', status: contact.status });
  return contact;
}

function unsafeCredentialRequest(message) {
  let text = String(message || '').toLowerCase();
  // Explicit safety prohibitions must not be misclassified as credential requests.
  text = text.replace(/\b(?:never|do not|don't|will not|won't)\s+(?:ask(?: you)? to|request|share|send|provide|disclose|tell|give)\b[^.!?]{0,120}/gi, ' ');
  const credential = '(?:pin|password|otp|one[- ]time (?:password|passcode)|cvv|cvc|security code)';
  const action = '(?:send|share|provide|tell me|type|enter|confirm|disclose)';
  const request = new RegExp(`\\b${action}\\b.{0,45}\\b${credential}\\b|\\b${credential}\\b.{0,45}\\b${action}\\b`, 'i');
  const longNumber = /\b(?:\d[ -]*?){13,19}\b/;
  return request.test(text) || longNumber.test(text);
}

export function evaluateDigitalReply(contact, message) {
  const text = String(message || '').toLowerCase();
  const dimensions = {
    acknowledgement: /\b(understand|sorry|apolog|appreciate|thank you|acknowledge|recognise|recognize)\b/.test(text),
    ownership: /\b(check|review|trace|investigate|assist|help|look into|support|confirm)\b/.test(text),
    nextStep: /\b(next step|update|reference|case|follow up|follow-up|within|contact you|process|team)\b/.test(text),
    privacy: !unsafeCredentialRequest(text)
  };
  if (contact?.channel === 'social' && !contact.followUpDelivered) dimensions.privacy = dimensions.privacy && /\b(private|direct message|dm|verified|official channel|secure channel)\b/.test(text);
  const achieved = Object.values(dimensions).filter(Boolean).length;
  return { score: Math.round((achieved / Object.keys(dimensions).length) * 100), dimensions, method: 'deterministic-rule-based-practice-check' };
}

export function recordDigitalReply(queue, contactId, message, agentId, now = Date.now()) {
  const contact = findDigitalContact(queue, contactId);
  if (!contact) throw new Error('Digital contact was not found.');
  if (contact.status !== DIGITAL_STATUS.ACTIVE) throw new Error('The digital contact must be active before replying.');
  const text = requiredString(message, 'Reply', 1200);
  if (text.length < 12) throw new RangeError('Reply must contain at least 12 characters.');
  if (unsafeCredentialRequest(text)) throw new Error('Unsafe reply blocked: never ask for credentials, one-time codes or full payment-card numbers.');
  const at = new Date(now).toISOString();
  const score = evaluateDigitalReply(contact, text);
  const reply = {
    id: `${contact.id}-A${contact.replyCount + 1}`,
    type: 'agent',
    text,
    at,
    agentId: requiredString(agentId, 'Agent reference', 80),
    quality: score
  };
  contact.messages.push(reply);
  contact.replyCount += 1;
  contact.qaScore = contact.qaScore === null ? score.score : Math.round((contact.qaScore * (contact.replyCount - 1) + score.score) / contact.replyCount);
  contact.firstResponseAt ||= at;
  contact.status = DIGITAL_STATUS.AWAITING_CUSTOMER;
  contact.timeline.push({ at, event: 'Agent reply recorded', status: contact.status, details: { qualityScore: score.score } });
  return { contact, reply, quality: score };
}

export function deliverDigitalFollowUp(queue, contactId, now = Date.now()) {
  const contact = findDigitalContact(queue, contactId);
  if (!contact) throw new Error('Digital contact was not found.');
  if (contact.status !== DIGITAL_STATUS.AWAITING_CUSTOMER) throw new Error('The contact is not awaiting a customer response.');
  if (contact.followUpDelivered || !contact.followUp) throw new Error('No further simulated customer response is available.');
  const at = new Date(now).toISOString();
  contact.messages.push({ id: `${contact.id}-C2`, type: 'customer', text: contact.followUp, at });
  contact.followUpDelivered = true;
  contact.status = DIGITAL_STATUS.ACTIVE;
  contact.timeline.push({ at, event: 'Simulated customer follow-up received', status: contact.status });
  return contact;
}

export function completeDigitalContact(queue, contactId, { disposition, notes } = {}, now = Date.now()) {
  const contact = findDigitalContact(queue, contactId);
  if (!contact) throw new Error('Digital contact was not found.');
  if (![DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(contact.status)) {
    throw new Error('Only an active digital contact can be completed or escalated.');
  }
  if (contact.replyCount < 1) throw new Error('Record at least one agent reply before completing this contact.');
  const safeNotes = requiredString(notes, 'Factual case notes', 1200);
  if (safeNotes.length < 12) throw new RangeError('Factual case notes must contain at least 12 characters.');
  const allowed = new Set(['resolved', 'pending_customer', 'escalated']);
  if (!allowed.has(disposition)) throw new TypeError('Choose a valid digital-contact disposition.');
  const at = new Date(now).toISOString();
  contact.status = disposition;
  contact.disposition = disposition;
  contact.notes = safeNotes;
  contact.completedAt = at;
  contact.timeline.push({ at, event: `Digital contact disposition recorded: ${disposition}`, status: disposition });
  return contact;
}

export function digitalQueueMetrics(queue, now = Date.now()) {
  const items = Array.isArray(queue) ? queue : [];
  const waiting = items.filter(item => item.status === DIGITAL_STATUS.QUEUED);
  const active = items.filter(item => [DIGITAL_STATUS.ACTIVE, DIGITAL_STATUS.AWAITING_CUSTOMER].includes(item.status));
  const responded = items.filter(item => item.firstResponseAt);
  const qa = items.filter(item => Number.isFinite(item.qaScore));
  const channelCounts = Object.fromEntries(Object.keys(DIGITAL_CHANNELS).map(key => [key, {
    waiting: waiting.filter(item => item.channel === key).length,
    active: active.filter(item => item.channel === key).length,
    resolved: items.filter(item => item.channel === key && item.status === DIGITAL_STATUS.RESOLVED).length,
    escalated: items.filter(item => item.channel === key && item.status === DIGITAL_STATUS.ESCALATED).length
  }]));
  const atRisk = waiting.filter(item => {
    const elapsed = Math.max(0, now - Date.parse(item.receivedAt || now));
    return elapsed >= item.slaMinutes * 60000;
  }).length;
  const responseMillis = responded.map(item => Math.max(0, Date.parse(item.firstResponseAt) - Date.parse(item.receivedAt)));
  return {
    waiting: waiting.length,
    active: active.length,
    resolved: items.filter(item => item.status === DIGITAL_STATUS.RESOLVED).length,
    escalated: items.filter(item => item.status === DIGITAL_STATUS.ESCALATED).length,
    awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length,
    slaAtRisk: atRisk,
    averageFirstResponseMinutes: responseMillis.length ? Math.round(responseMillis.reduce((sum, value) => sum + value, 0) / responseMillis.length / 60000 * 10) / 10 : 0,
    averageQA: qa.length ? Math.round(qa.reduce((sum, item) => sum + item.qaScore, 0) / qa.length) : null,
    channelCounts
  };
}

export function appendDigitalEvent(events, event, now = Date.now()) {
  const list = Array.isArray(events) ? events : [];
  const item = {
    id: `DVE-${Number(now).toString(36).toUpperCase()}-${(list.length + 1).toString(36).toUpperCase()}`,
    at: new Date(now).toISOString(),
    contactId: String(event?.contactId || ''),
    channel: String(event?.channel || ''),
    type: String(event?.type || 'activity'),
    message: String(event?.message || ''),
    status: String(event?.status || 'recorded')
  };
  list.push(item);
  if (list.length > 300) list.splice(0, list.length - 300);
  return item;
}
