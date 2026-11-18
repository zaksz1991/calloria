/**
 * CALLORIA v6.67 campaign worklist and dial-attempt operations.
 * All contacts and dial outcomes are synthetic local gameplay records.
 */
export const CAMPAIGN_OPERATIONS_VERSION = '6.67.0';
export const DEFAULT_CONTACTS_PER_CAMPAIGN = 8;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = Object.freeze({
  no_answer: 15 * 60_000,
  busy: 30 * 60_000,
  voicemail: 2 * 60 * 60_000,
});
export const DIAL_OUTCOMES = Object.freeze(['answered', 'no_answer', 'busy', 'voicemail']);

const SYNTHETIC_NAMES = Object.freeze([
  'Aisha Bello', 'Chinedu Eze', 'Mariam Lawal', 'Tunde Adebayo', 'Zainab Musa',
  'Emeka Nwosu', 'Halima Sadiq', 'Bola Adeyemi', 'Fatima Garba', 'Kelechi Obi',
  'Ibrahim Yusuf', 'Amaka Okeke', 'Seyi Bakare', 'Maryam Abdullahi', 'Daniel Mensah',
  'Ngozi Chukwu', 'Abdulrahman Aliyu', 'Esther Boateng', 'Femi Ojo', 'Safiya Umar',
  'Adaeze Nnamdi', 'Samuel Asare', 'Hadiza Mohammed', 'Kunle Balogun', 'Chisom Umeh',
  'Rashida Ibrahim', 'Tariq Sule', 'Grace Owusu', 'Binta Shehu', 'Victor Ofori',
  'Nneka Ibe', 'Yusuf Danjuma', 'Lydia Okon', 'Oluwaseun Akin', 'Peter Ekanem',
  'Amina Yakubu', 'Tosin Afolabi', 'Ifeoma Nwachukwu', 'Musa Ibrahim', 'Joana Mensah',
]);

function clean(value, maximum = 120) {
  return String(value ?? '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, maximum);
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value ?? '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function initials(value) {
  return clean(value).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('') || 'CX';
}

function iso(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('A valid timestamp is required.');
  return date.toISOString();
}

function makeContact(campaign, sequence, customer, createdAt, maxAttempts) {
  const campaignId = clean(campaign.id, 80);
  const safeCustomer = clean(customer, 100);
  return {
    id: `CMP-${campaignId}-${String(sequence).padStart(3, '0')}`,
    campaignId,
    campaignTitle: clean(campaign.title, 140),
    campaignType: clean(campaign.type, 80),
    customer: safeCustomer,
    initials: initials(safeCustomer),
    sequence,
    origin: 'synthetic_campaign_contact',
    contactWindow: { timezone: 'Africa/Lagos', start: '08:00', end: '17:00' },
    status: 'ready',
    attempts: 0,
    maxAttempts,
    nextEligibleAt: iso(createdAt),
    callbackDueAt: null,
    lastAttemptAt: null,
    lastOutcome: null,
    lastAttemptId: null,
    attemptHistory: [],
    createdAt: iso(createdAt),
    updatedAt: iso(createdAt),
  };
}

export function createCampaignWorklist(campaigns = [], {
  day = 1,
  seed = 1,
  now = Date.now(),
  contactsPerCampaign = DEFAULT_CONTACTS_PER_CAMPAIGN,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
} = {}) {
  if (!Array.isArray(campaigns)) throw new TypeError('Campaign templates must be an array.');
  const count = Math.max(1, Math.min(30, Math.trunc(Number(contactsPerCampaign) || DEFAULT_CONTACTS_PER_CAMPAIGN)));
  const attemptLimit = Math.max(1, Math.min(5, Math.trunc(Number(maxAttempts) || DEFAULT_MAX_ATTEMPTS)));
  const createdAt = iso(now);
  const contacts = [];
  campaigns.forEach((campaign, campaignIndex) => {
    if (!campaign?.id) return;
    const baseName = clean(campaign.customer || `Synthetic customer ${campaignIndex + 1}`, 100);
    contacts.push(makeContact(campaign, 1, baseName, createdAt, attemptLimit));
    for (let sequence = 2; sequence <= count; sequence += 1) {
      const nameIndex = stableHash(`${campaign.id}:${day}:${seed}:${sequence}`) % SYNTHETIC_NAMES.length;
      let customer = SYNTHETIC_NAMES[nameIndex];
      if (customer === baseName || contacts.some(item => item.campaignId === campaign.id && item.customer === customer)) {
        customer = `${customer} ${String(sequence).padStart(2, '0')}`;
      }
      contacts.push(makeContact(campaign, sequence, customer, createdAt, attemptLimit));
    }
  });
  return contacts;
}

export function normalizeCampaignWorklist(value, campaigns = [], options = {}) {
  const existing = Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && item.id && item.campaignId) : [];
  const normalized = existing.map(item => ({
    ...item,
    id: clean(item.id, 100),
    campaignId: clean(item.campaignId, 80),
    customer: clean(item.customer || 'Synthetic customer', 100),
    initials: clean(item.initials || initials(item.customer), 4),
    status: ['ready', 'in_progress', 'retry_wait', 'callback_scheduled', 'completed', 'suppressed', 'review_required', 'exhausted'].includes(item.status) ? item.status : 'review_required',
    attempts: Math.max(0, Math.trunc(Number(item.attempts) || 0)),
    maxAttempts: Math.max(1, Math.min(5, Math.trunc(Number(item.maxAttempts) || DEFAULT_MAX_ATTEMPTS))),
    attemptHistory: Array.isArray(item.attemptHistory) ? item.attemptHistory.slice(-10) : [],
  }));
  const knownCampaigns = new Set(normalized.map(item => item.campaignId));
  const missing = campaigns.filter(campaign => campaign?.id && !knownCampaigns.has(String(campaign.id)));
  return normalized.concat(createCampaignWorklist(missing, options));
}

export function findCampaignContact(worklist = [], contactId) {
  return Array.isArray(worklist) ? worklist.find(item => item.id === contactId) || null : null;
}

export function campaignContactEligibility(contact, {
  now = Date.now(),
  suppressed = false,
  shiftOpen = true,
  agentAvailable = true,
} = {}) {
  if (!contact) return { allowed: false, reason: 'Campaign contact not found.' };
  if (suppressed || contact.status === 'suppressed') return { allowed: false, reason: 'Contact suppression is active.' };
  if (!shiftOpen) return { allowed: false, reason: 'The simulated outbound contact window is closed.' };
  if (!agentAvailable) return { allowed: false, reason: 'The agent must be Available before starting another dial attempt.' };
  if (contact.status === 'in_progress') return { allowed: false, reason: 'This contact already has an active attempt.' };
  if (contact.status === 'completed' || contact.status === 'review_required' || contact.status === 'exhausted') {
    return { allowed: false, reason: 'This contact is not eligible for another attempt.' };
  }
  if (contact.attempts >= contact.maxAttempts && !['callback_scheduled'].includes(contact.status)) {
    return { allowed: false, reason: 'The maximum attempt limit has been reached.' };
  }
  const dueAt = contact.status === 'callback_scheduled' ? contact.callbackDueAt : contact.nextEligibleAt;
  const due = !dueAt || Date.parse(dueAt) <= Number(now);
  if (!due) return { allowed: false, reason: 'The next permitted attempt time has not arrived.', dueAt };
  if (!['ready', 'retry_wait', 'callback_scheduled'].includes(contact.status)) {
    return { allowed: false, reason: 'The contact is not in a callable state.' };
  }
  return { allowed: true, reason: contact.status === 'callback_scheduled' ? 'Customer-requested callback is due.' : 'Contact is eligible for a simulated dial.' };
}

export function startCampaignContact(worklist, contactId, {
  attemptId,
  agentName = 'Customer Experience Agent',
  now = Date.now(),
  suppressed = false,
  shiftOpen = true,
  agentAvailable = true,
} = {}) {
  const contact = findCampaignContact(worklist, contactId);
  const eligibility = campaignContactEligibility(contact, { now, suppressed, shiftOpen, agentAvailable });
  if (!eligibility.allowed) throw new Error(eligibility.reason);
  const at = iso(now);
  const reference = clean(attemptId || `OUT-${stableHash(`${contact.id}:${contact.attempts + 1}:${at}`).toString(16)}`, 100);
  contact.attempts += 1;
  contact.status = 'in_progress';
  contact.lastAttemptAt = at;
  contact.lastAttemptId = reference;
  contact.updatedAt = at;
  contact.callbackDueAt = null;
  contact.attemptHistory = Array.isArray(contact.attemptHistory) ? contact.attemptHistory : [];
  contact.attemptHistory.push({
    attemptId: reference,
    attemptNumber: contact.attempts,
    agentName: clean(agentName, 100),
    startedAt: at,
    finishedAt: null,
    outcome: 'in_progress',
    nextEligibleAt: null,
  });
  contact.attemptHistory = contact.attemptHistory.slice(-10);
  return { contact, attemptId: reference, attemptNumber: contact.attempts, eligibility };
}

export function resolveDialAttempt(contact, { attemptNumber = contact?.attempts || 1, seed = '' } = {}) {
  if (!contact?.id) throw new TypeError('A campaign contact is required to resolve a dial attempt.');
  const bucket = stableHash(`${contact.id}:${attemptNumber}:${seed}`) % 100;
  if (bucket < 72) return { outcome: 'answered', label: 'Customer answered', connected: true, bucket };
  if (bucket < 84) return { outcome: 'no_answer', label: 'No answer', connected: false, bucket };
  if (bucket < 94) return { outcome: 'busy', label: 'Line busy', connected: false, bucket };
  return { outcome: 'voicemail', label: 'Voicemail', connected: false, bucket };
}

export function finishCampaignContact(worklist, contactId, {
  attemptId,
  outcome,
  now = Date.now(),
  callbackDueAt = null,
} = {}) {
  const contact = findCampaignContact(worklist, contactId);
  if (!contact) throw new Error('Campaign contact not found.');
  if (contact.status !== 'in_progress') throw new Error('Only an active campaign contact attempt can be completed.');
  const allowed = ['completed', 'declined', 'callback', 'opt_out', 'review', 'no_answer', 'busy', 'voicemail', 'abandoned'];
  if (!allowed.includes(outcome)) throw new RangeError('A supported outbound attempt outcome is required.');
  const at = iso(now);
  let nextEligibleAt = null;
  let callbackISO = null;
  contact.nextEligibleAt = null;
  if (outcome === 'callback') {
    if (!callbackDueAt || Date.parse(callbackDueAt) <= Number(now)) throw new RangeError('A customer-requested callback must have a valid future date and time.');
    callbackISO = iso(callbackDueAt);
    contact.status = 'callback_scheduled';
    contact.callbackDueAt = callbackISO;
  } else if (outcome === 'opt_out') {
    contact.status = 'suppressed';
    contact.callbackDueAt = null;
  } else if (outcome === 'review' || outcome === 'abandoned') {
    contact.status = 'review_required';
    contact.callbackDueAt = null;
  } else if (['no_answer', 'busy', 'voicemail'].includes(outcome)) {
    const delay = RETRY_DELAYS_MS[outcome];
    if (contact.attempts < contact.maxAttempts) {
      nextEligibleAt = new Date(Number(now) + delay).toISOString();
      contact.status = 'retry_wait';
      contact.nextEligibleAt = nextEligibleAt;
    } else {
      contact.status = 'exhausted';
      contact.nextEligibleAt = null;
    }
    contact.callbackDueAt = null;
  } else {
    contact.status = 'completed';
    contact.callbackDueAt = null;
  }
  contact.lastOutcome = outcome;
  contact.updatedAt = at;
  const history = Array.isArray(contact.attemptHistory) ? contact.attemptHistory : [];
  const last = [...history].reverse().find(item => !attemptId || item.attemptId === attemptId);
  if (last) {
    last.finishedAt = at;
    last.outcome = outcome;
    last.nextEligibleAt = nextEligibleAt || callbackISO;
  }
  return {
    contact,
    outcome,
    status: contact.status,
    nextEligibleAt,
    callbackDueAt: callbackISO,
    attemptsRemaining: Math.max(0, contact.maxAttempts - contact.attempts),
  };
}

export function campaignWorklistMetrics(worklist = [], { now = Date.now() } = {}) {
  const contacts = Array.isArray(worklist) ? worklist : [];
  const count = status => contacts.filter(item => item.status === status).length;
  const due = contacts.filter(item => {
    if (item.status === 'ready') return true;
    if (item.status === 'retry_wait') return !item.nextEligibleAt || Date.parse(item.nextEligibleAt) <= Number(now);
    if (item.status === 'callback_scheduled') return !!item.callbackDueAt && Date.parse(item.callbackDueAt) <= Number(now);
    return false;
  }).length;
  return {
    total: contacts.length,
    eligible: due,
    inProgress: count('in_progress'),
    retryWaiting: contacts.filter(item => item.status === 'retry_wait' && Date.parse(item.nextEligibleAt || 0) > Number(now)).length,
    callbacksScheduled: count('callback_scheduled'),
    callbacksDue: contacts.filter(item => item.status === 'callback_scheduled' && Date.parse(item.callbackDueAt || 0) <= Number(now)).length,
    completed: count('completed'),
    suppressed: count('suppressed'),
    reviewRequired: count('review_required'),
    exhausted: count('exhausted'),
    attempts: contacts.reduce((sum, item) => sum + (Number(item.attempts) || 0), 0),
  };
}

export function campaignContactStatusLabel(contact, now = Date.now()) {
  if (!contact) return 'Unavailable';
  if (contact.status === 'ready') return 'Ready';
  if (contact.status === 'in_progress') return 'In progress';
  if (contact.status === 'retry_wait') return Date.parse(contact.nextEligibleAt || 0) <= Number(now) ? 'Retry due' : 'Retry waiting';
  if (contact.status === 'callback_scheduled') return Date.parse(contact.callbackDueAt || 0) <= Number(now) ? 'Callback due' : 'Callback scheduled';
  if (contact.status === 'completed') return 'Completed';
  if (contact.status === 'suppressed') return 'Suppressed';
  if (contact.status === 'review_required') return 'Review required';
  if (contact.status === 'exhausted') return 'Attempt limit reached';
  return 'Unavailable';
}
