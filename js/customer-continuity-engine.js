/**
 * CALLORIA v6.68 — cross-channel customer continuity for the fictional game simulation.
 * Stores minimal interaction metadata only; it never stores free-form notes or transcripts.
 */
export const CUSTOMER_CONTINUITY_VERSION = '6.68.0';
export const MAX_CUSTOMER_PROFILES = 500;
export const MAX_INTERACTIONS_PER_CUSTOMER = 20;

const CLOSED_STATUSES = new Set([
  'resolved', 'completed', 'customer declined', 'declined', 'opt-out recorded',
  'suppressed', 'closed', 'no further action'
]);

function clean(value, maximum = 140) {
  return String(value ?? '')
    .replace(/[<>\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximum);
}

function normalizedName(value) {
  return clean(value, 100).normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function validIso(value, fallback = Date.now()) {
  const parsed = value ? Date.parse(value) : (typeof fallback === 'string' ? Date.parse(fallback) : Number(fallback));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function safeChannel(value) {
  const source = clean(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    inbound: 'inbound_voice', voice: 'inbound_voice', 'inbound voice': 'inbound_voice',
    outbound: 'outbound_voice', 'outbound voice': 'outbound_voice',
    'live chat': 'live_chat', 'social media': 'social'
  };
  return aliases[source] || aliases[String(value || '').toLowerCase()] || source || 'unknown';
}

export function createCustomerContinuityState() {
  return { version: CUSTOMER_CONTINUITY_VERSION, profiles: {} };
}

export function normalizeCustomerContinuityState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createCustomerContinuityState();
  const profiles = {};
  for (const [rawKey, rawProfile] of Object.entries(value.profiles || {})) {
    if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) continue;
    const key = clean(rawKey, 180);
    if (!key) continue;
    const interactions = (Array.isArray(rawProfile.interactions) ? rawProfile.interactions : [])
      .filter(item => item && typeof item === 'object')
      .slice(-MAX_INTERACTIONS_PER_CUSTOMER)
      .map(item => ({
        id: clean(item.id, 100),
        reference: clean(item.reference, 100),
        caseReference: clean(item.caseReference, 100),
        channel: safeChannel(item.channel),
        direction: item.direction === 'outbound' ? 'outbound' : 'inbound',
        title: clean(item.title, 120),
        status: clean(item.status, 80),
        disposition: clean(item.disposition, 50),
        occurredAt: validIso(item.occurredAt),
        qa: Number.isFinite(Number(item.qa)) ? Math.max(0, Math.min(100, Number(item.qa))) : null,
        sentiment: Number.isFinite(Number(item.sentiment)) ? Math.max(0, Math.min(100, Number(item.sentiment))) : null
      }));
    if (!interactions.length) continue;
    profiles[key] = {
      key,
      displayName: clean(rawProfile.displayName || 'Customer', 100),
      matchBasis: rawProfile.matchBasis === 'reference' ? 'reference' : 'name',
      firstSeenAt: validIso(rawProfile.firstSeenAt, interactions[0].occurredAt),
      lastSeenAt: validIso(rawProfile.lastSeenAt, interactions.at(-1).occurredAt),
      totalInteractions: Math.max(interactions.length, Math.trunc(Number(rawProfile.totalInteractions) || interactions.length)),
      interactions
    };
  }
  const newest = Object.values(profiles).sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt)).slice(0, MAX_CUSTOMER_PROFILES);
  return { version: CUSTOMER_CONTINUITY_VERSION, profiles: Object.fromEntries(newest.map(profile => [profile.key, profile])) };
}

/**
 * Resolve a synthetic customer identity. Shared customer references take priority;
 * otherwise the simulation falls back to a normalised customer display name.
 */
export function resolveCustomerContinuityIdentity({ customer, customerName, customerRef, customerId } = {}) {
  const displayName = clean(customerName || customer || 'Customer', 100) || 'Customer';
  const reference = clean(customerRef || customerId, 100).toLocaleLowerCase('en').replace(/\s+/g, '');
  if (reference) return { key: `ref:${reference}`, displayName, matchBasis: 'reference' };
  const nameKey = normalizedName(customerName || customer);
  if (!nameKey) return null;
  return { key: `name:${nameKey}`, displayName, matchBasis: 'name' };
}

/** Records only minimal case metadata; free-form notes, message bodies and transcripts are excluded. */
export function recordCustomerInteraction(value, input = {}) {
  const state = normalizeCustomerContinuityState(value);
  const identity = resolveCustomerContinuityIdentity(input);
  if (!identity) return state;
  const at = validIso(input.occurredAt || input.createdAt || input.at);
  const interaction = {
    id: clean(input.interactionId || input.id || input.reference || `${identity.key}:${at}`, 100),
    reference: clean(input.reference || input.interactionId, 100),
    caseReference: clean(input.caseReference || input.reference, 100),
    channel: safeChannel(input.channel),
    direction: input.direction === 'outbound' ? 'outbound' : 'inbound',
    title: clean(input.title || input.summary || 'Customer interaction', 120),
    status: clean(input.status || 'Recorded', 80),
    disposition: clean(input.disposition, 50),
    occurredAt: at,
    qa: Number.isFinite(Number(input.qa)) ? Math.max(0, Math.min(100, Number(input.qa))) : null,
    sentiment: Number.isFinite(Number(input.sentiment)) ? Math.max(0, Math.min(100, Number(input.sentiment))) : null
  };
  const existing = state.profiles[identity.key] || {
    key: identity.key,
    displayName: identity.displayName,
    matchBasis: identity.matchBasis,
    firstSeenAt: at,
    lastSeenAt: at,
    totalInteractions: 0,
    interactions: []
  };
  if (existing.interactions.some(item => item.id === interaction.id)) return state;
  const interactions = [...existing.interactions, interaction]
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    .slice(-MAX_INTERACTIONS_PER_CUSTOMER);
  const profile = {
    ...existing,
    displayName: identity.displayName || existing.displayName,
    matchBasis: identity.matchBasis,
    firstSeenAt: existing.firstSeenAt || at,
    lastSeenAt: at,
    totalInteractions: existing.totalInteractions + 1,
    interactions
  };
  const profiles = { ...state.profiles, [identity.key]: profile };
  const retained = Object.values(profiles)
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, MAX_CUSTOMER_PROFILES);
  return { version: CUSTOMER_CONTINUITY_VERSION, profiles: Object.fromEntries(retained.map(item => [item.key, item])) };
}

export function getCustomerContinuityContext(value, identityInput, { limit = 5 } = {}) {
  const state = normalizeCustomerContinuityState(value);
  const identity = resolveCustomerContinuityIdentity(identityInput || {});
  const profile = identity ? state.profiles[identity.key] || null : null;
  if (!profile) {
    return {
      found: false,
      repeatCustomer: false,
      identity,
      profile: null,
      interactions: [],
      previousChannels: [],
      openCases: [],
      lastInteraction: null,
      matchBasis: identity?.matchBasis || 'unavailable'
    };
  }
  const interactions = profile.interactions.slice().sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const openCases = interactions.filter(item => !CLOSED_STATUSES.has(item.status.toLowerCase()));
  const previousChannels = [...new Set(interactions.map(item => item.channel))];
  return {
    found: true,
    repeatCustomer: profile.totalInteractions >= 1,
    identity,
    profile,
    interactions: interactions.slice(0, Math.max(1, Math.min(10, Math.trunc(Number(limit) || 5)))),
    previousChannels,
    openCases,
    lastInteraction: interactions[0] || null,
    matchBasis: profile.matchBasis
  };
}

export function customerContinuityMetrics(value) {
  const state = normalizeCustomerContinuityState(value);
  const profiles = Object.values(state.profiles);
  const repeatCustomers = profiles.filter(profile => profile.totalInteractions > 1);
  const crossChannelCustomers = profiles.filter(profile => new Set(profile.interactions.map(item => item.channel)).size > 1);
  const openFollowUps = profiles.reduce((sum, profile) => sum + profile.interactions.filter(item => !CLOSED_STATUSES.has(item.status.toLowerCase())).length, 0);
  return {
    customers: profiles.length,
    repeatCustomers: repeatCustomers.length,
    crossChannelCustomers: crossChannelCustomers.length,
    interactions: profiles.reduce((sum, profile) => sum + profile.totalInteractions, 0),
    openFollowUps
  };
}

export function listCustomerContinuityProfiles(value, { limit = 10 } = {}) {
  const state = normalizeCustomerContinuityState(value);
  return Object.values(state.profiles)
    .sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt))
    .slice(0, Math.max(1, Math.min(50, Math.trunc(Number(limit) || 10))));
}
