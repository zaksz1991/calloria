/**
 * CALLORIA v6.64 — adaptive synthetic digital-customer behaviour.
 * Customer reactions are deterministic game dialogue; no live customer data,
 * external AI service or provider connection is used.
 */

export const DIGITAL_CUSTOMER_BEHAVIOUR_VERSION = '6.64.0';
export const DIGITAL_CUSTOMER_BEHAVIOUR_POLICY = Object.freeze({
  maxCustomerTurns: 3,
  supervisorSentimentThreshold: 28,
  repeatedNegativeThreshold: 2
});

export const DIGITAL_CUSTOMER_PERSONAS = Object.freeze({
  cooperative: Object.freeze({ label: 'Cooperative', initialSentiment: 76, initialPatience: 78, tone: 'Calm and constructive' }),
  frustrated: Object.freeze({ label: 'Frustrated', initialSentiment: 38, initialPatience: 34, tone: 'Direct and dissatisfied' }),
  confused: Object.freeze({ label: 'Uncertain', initialSentiment: 54, initialPatience: 50, tone: 'Needs clear explanations' }),
  security_cautious: Object.freeze({ label: 'Security-conscious', initialSentiment: 58, initialPatience: 62, tone: 'Guarded about personal information' }),
  time_pressured: Object.freeze({ label: 'Time-pressured', initialSentiment: 52, initialPatience: 36, tone: 'Needs concise action and timing' }),
  repeat_complainant: Object.freeze({ label: 'Repeat complainant', initialSentiment: 26, initialPatience: 22, tone: 'Expects ownership of previous failures' })
});

const OPEN_STATUSES = new Set(['queued', 'active', 'awaiting_customer']);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || 'CALLORIA')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function cleanText(value, max = 900) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function personaFor(contact) {
  const choices = contact?.priority === 'critical'
    ? ['security_cautious', 'repeat_complainant', 'frustrated']
    : contact?.channel === 'social'
      ? ['frustrated', 'repeat_complainant', 'cooperative']
      : contact?.channel === 'live_chat'
        ? ['confused', 'time_pressured', 'cooperative', 'frustrated']
        : ['cooperative', 'frustrated', 'confused', 'security_cautious', 'time_pressured'];
  return choices[stableHash(contact?.id) % choices.length];
}

function moodFor(sentiment) {
  if (sentiment >= 72) return 'reassured';
  if (sentiment >= 52) return 'calm';
  if (sentiment >= 34) return 'concerned';
  if (sentiment >= 20) return 'frustrated';
  return 'angry';
}

function riskReason(behaviour) {
  if (behaviour.sentiment <= DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.supervisorSentimentThreshold) {
    return 'Customer sentiment is critically low; supervisor intervention is recommended.';
  }
  if (behaviour.negativeStreak >= DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.repeatedNegativeThreshold) {
    return 'Repeated unsatisfactory responses have increased escalation risk.';
  }
  return '';
}

/** Add a stable persona and relationship state to a legacy or new contact. */
export function ensureDigitalCustomerBehaviour(contact) {
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    throw new TypeError('A digital contact is required.');
  }
  const existing = contact.customerBehaviour;
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    const personaId = Object.hasOwn(DIGITAL_CUSTOMER_PERSONAS, existing.personaId)
      ? existing.personaId : personaFor(contact);
    const persona = DIGITAL_CUSTOMER_PERSONAS[personaId];
    contact.customerBehaviour = {
      version: DIGITAL_CUSTOMER_BEHAVIOUR_VERSION,
      personaId,
      personaLabel: persona.label,
      sentiment: clamp(existing.sentiment ?? persona.initialSentiment),
      patience: clamp(existing.patience ?? persona.initialPatience),
      mood: String(existing.mood || moodFor(clamp(existing.sentiment ?? persona.initialSentiment))),
      turns: Math.min(DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.maxCustomerTurns, Math.max(0, Math.floor(Number(existing.turns) || 0))),
      maxTurns: DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.maxCustomerTurns,
      negativeStreak: Math.max(0, Math.floor(Number(existing.negativeStreak) || 0)),
      needsSupervisor: existing.needsSupervisor === true,
      supervisorReason: cleanText(existing.supervisorReason, 220),
      lastReaction: cleanText(existing.lastReaction, 80) || 'neutral',
      pendingResponse: cleanText(existing.pendingResponse, 900),
      history: Array.isArray(existing.history) ? existing.history.slice(-12) : [],
      exhausted: existing.exhausted === true
    };
    return contact.customerBehaviour;
  }

  const personaId = personaFor(contact);
  const persona = DIGITAL_CUSTOMER_PERSONAS[personaId];
  contact.customerBehaviour = {
    version: DIGITAL_CUSTOMER_BEHAVIOUR_VERSION,
    personaId,
    personaLabel: persona.label,
    sentiment: persona.initialSentiment,
    patience: persona.initialPatience,
    mood: moodFor(persona.initialSentiment),
    turns: 0,
    maxTurns: DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.maxCustomerTurns,
    negativeStreak: 0,
    needsSupervisor: false,
    supervisorReason: '',
    lastReaction: 'initial',
    pendingResponse: contact.status === 'awaiting_customer' && contact.followUpDelivered !== true ? cleanText(contact.followUp, 900) : '',
    history: [],
    exhausted: false
  };
  return contact.customerBehaviour;
}

function buildCustomerReply(personaId, dimensions, mood, turn) {
  if (!dimensions.acknowledgement) {
    if (personaId === 'repeat_complainant') return 'I have already raised this more than once. Please acknowledge the previous complaint and tell me who is taking ownership.';
    if (personaId === 'security_cautious') return 'I am still not comfortable with this process. Please explain the official secure route before I share any case information.';
    return 'I do not feel that my concern has been acknowledged yet. Please address the problem I described before moving on.';
  }
  if (!dimensions.ownership) {
    if (personaId === 'time_pressured') return 'I understand the explanation, but who is actually handling this and what action is being taken now?';
    if (personaId === 'repeat_complainant') return 'I have heard similar explanations before. Which team or person is responsible for getting this resolved?';
    return 'Thank you for acknowledging it. I still need to know who will take responsibility for the next action.';
  }
  if (personaId === 'security_cautious' && !dimensions.secureExplanation) {
    return 'Before I continue, please explain the official secure route and confirm that you will not ask for my password, PIN or one-time code.';
  }
  if (!dimensions.nextStep) {
    if (personaId === 'confused') return 'I am still unsure what happens after this. Can you explain the next step in simple order?';
    if (personaId === 'time_pressured') return 'Please be specific. What happens next, and when should I expect the update?';
    return 'Thank you for looking into it. What exactly happens next, and how will I receive an update?';
  }
  if (!dimensions.clarity && (personaId === 'confused' || personaId === 'security_cautious')) {
    return personaId === 'security_cautious'
      ? 'I appreciate the help. Please clarify which details are safe to share and which information you will never ask me to disclose.'
      : 'I appreciate your help, but could you break that down into simpler steps so I know exactly what to do?';
  }
  if (mood === 'frustrated' || mood === 'angry') {
    return 'I have noted what you said, but I am still dissatisfied. Please review the case history and make sure the next update is concrete.';
  }
  if (personaId === 'security_cautious') return 'Thank you for explaining the secure process. I will use the official channel and keep my password, PIN and one-time codes private.';
  if (personaId === 'time_pressured') return 'That is clearer. Please confirm the case reference and the expected time for the next update.';
  if (personaId === 'repeat_complainant') return 'Thank you for taking ownership. Please link this to my earlier complaint so I do not have to start again.';
  if (personaId === 'confused') return 'I understand the steps now. Please confirm the reference I should use if I need to follow up.';
  return turn === 0
    ? 'Thank you for the explanation. Please confirm the reference and the next update I should expect.'
    : 'That answers my question. I will wait for the update through the agreed channel.';
}

/** Evaluate the customer's reaction to the latest agent reply and prepare the next turn. */
export function evaluateDigitalCustomerReaction(contact, quality, message, now = Date.now()) {
  const behaviour = ensureDigitalCustomerBehaviour(contact);
  const text = cleanText(message, 1200);
  const dimensions = quality?.dimensions && typeof quality.dimensions === 'object' ? quality.dimensions : {};
  const acknowledgement = dimensions.acknowledgement === true;
  const ownership = dimensions.ownership === true;
  const nextStep = dimensions.nextStep === true;
  const safe = dimensions.privacy !== false;
  const clarity = /\b(simple|simply|step by step|first|then|because|once|after|in order|plain language|to clarify)\b/i.test(text);
  const secureExplanation = /\b(secure|official|verified|private|protect|approved channel|never ask|will not ask)\b/i.test(text);

  let delta = (acknowledgement ? 12 : -14)
    + (ownership ? 9 : -10)
    + (nextStep ? 11 : -12)
    + (safe ? 5 : -16)
    + (clarity ? 4 : -3);
  if (behaviour.personaId === 'security_cautious') delta += secureExplanation ? 7 : -5;
  if (behaviour.personaId === 'time_pressured') delta += /\b(within|by\s+\d|today|tomorrow|minutes|hours|time|update)\b/i.test(text) ? 5 : -3;
  if (behaviour.personaId === 'repeat_complainant') delta += /\b(previous|earlier|existing|history|case reference|complaint)\b/i.test(text) ? 5 : -6;
  if (behaviour.personaId === 'frustrated' && acknowledgement) delta += 4;

  const before = behaviour.sentiment;
  behaviour.sentiment = clamp(before + delta);
  behaviour.patience = clamp(behaviour.patience + (acknowledgement && nextStep ? 7 : -8) + (clarity ? 2 : 0));
  const improved = behaviour.sentiment > before;
  behaviour.negativeStreak = improved ? 0 : behaviour.negativeStreak + 1;
  behaviour.mood = moodFor(behaviour.sentiment);
  behaviour.lastReaction = improved ? 'improving' : delta < 0 ? 'deteriorating' : 'steady';
  behaviour.needsSupervisor = behaviour.sentiment <= DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.supervisorSentimentThreshold
    || behaviour.negativeStreak >= DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.repeatedNegativeThreshold;
  behaviour.supervisorReason = behaviour.needsSupervisor ? riskReason(behaviour) : '';

  const hasMoreTurns = behaviour.turns < behaviour.maxTurns && behaviour.sentiment > 8;
  behaviour.pendingResponse = hasMoreTurns
    ? buildCustomerReply(behaviour.personaId, { acknowledgement, ownership, nextStep, safe, clarity, secureExplanation }, behaviour.mood, behaviour.turns)
    : '';
  behaviour.exhausted = !hasMoreTurns;
  const event = {
    at: new Date(Number.isFinite(Number(now)) ? Math.max(0, Number(now)) : Date.now()).toISOString(),
    before,
    after: behaviour.sentiment,
    delta,
    reaction: behaviour.lastReaction,
    mood: behaviour.mood,
    needsSupervisor: behaviour.needsSupervisor,
    turn: behaviour.turns
  };
  behaviour.history.push(event);
  behaviour.history = behaviour.history.slice(-12);
  contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : [];
  contact.timeline.push({ at: event.at, event: `Customer reaction ${event.reaction}: ${event.mood}`, status: behaviour.needsSupervisor ? 'customer_escalation_risk' : 'customer_reaction', details: { sentiment: behaviour.sentiment, delta, persona: behaviour.personaId } });
  return { behaviour, event, dimensions: { acknowledgement, ownership, nextStep, safe, clarity, secureExplanation }, pendingResponse: behaviour.pendingResponse };
}

/** Deliver one generated customer response and return the digital thread to active agent work. */
export function deliverAdaptiveDigitalCustomerResponse(contact, now = Date.now()) {
  if (!contact || typeof contact !== 'object') throw new TypeError('A digital contact is required.');
  if (contact.status !== 'awaiting_customer') throw new Error('The digital contact is not waiting for a customer response.');
  const behaviour = ensureDigitalCustomerBehaviour(contact);
  if (!behaviour.pendingResponse) throw new Error('No further simulated customer response is available.');
  const at = new Date(Number.isFinite(Number(now)) ? Math.max(0, Number(now)) : Date.now()).toISOString();
  const sequence = behaviour.turns + 2;
  const response = {
    id: `${String(contact.id || 'DIG').slice(0, 60)}-C${sequence}`,
    type: 'customer',
    text: behaviour.pendingResponse,
    at,
    behaviour: { persona: behaviour.personaId, mood: behaviour.mood, sentiment: behaviour.sentiment }
  };
  contact.messages = Array.isArray(contact.messages) ? contact.messages : [];
  contact.messages.push(response);
  behaviour.turns += 1;
  behaviour.pendingResponse = '';
  behaviour.exhausted = behaviour.turns >= behaviour.maxTurns;
  contact.followUpDelivered = true;
  contact.status = 'active';
  contact.timeline = Array.isArray(contact.timeline) ? contact.timeline : [];
  contact.timeline.push({ at, event: 'Adaptive simulated customer response received', status: 'active', details: { persona: behaviour.personaId, mood: behaviour.mood, sentiment: behaviour.sentiment, turn: behaviour.turns } });
  return { contact, response, behaviour };
}

export function digitalCustomerBehaviourSnapshot(contact) {
  if (!contact || typeof contact !== 'object') return null;
  const behaviour = contact.customerBehaviour && typeof contact.customerBehaviour === 'object'
    ? contact.customerBehaviour : ensureDigitalCustomerBehaviour(contact);
  const persona = DIGITAL_CUSTOMER_PERSONAS[behaviour.personaId] || DIGITAL_CUSTOMER_PERSONAS.cooperative;
  return {
    personaId: behaviour.personaId,
    personaLabel: persona.label,
    tone: persona.tone,
    sentiment: clamp(behaviour.sentiment),
    patience: clamp(behaviour.patience),
    mood: behaviour.mood || moodFor(behaviour.sentiment),
    turns: Math.max(0, Math.floor(Number(behaviour.turns) || 0)),
    maxTurns: DIGITAL_CUSTOMER_BEHAVIOUR_POLICY.maxCustomerTurns,
    lastReaction: behaviour.lastReaction || 'neutral',
    needsSupervisor: behaviour.needsSupervisor === true,
    supervisorReason: cleanText(behaviour.supervisorReason, 220),
    hasPendingResponse: Boolean(behaviour.pendingResponse),
    exhausted: behaviour.exhausted === true
  };
}

export function digitalCustomerBehaviourRiskItems(queue) {
  return (Array.isArray(queue) ? queue : [])
    .filter(contact => contact && OPEN_STATUSES.has(contact.status) && contact.customerBehaviour?.needsSupervisor === true)
    .map(contact => ({ contact, behaviour: digitalCustomerBehaviourSnapshot(contact) }))
    .sort((a, b) => a.behaviour.sentiment - b.behaviour.sentiment || String(a.contact.id).localeCompare(String(b.contact.id)));
}

export function digitalCustomerBehaviourMetrics(queue) {
  const items = (Array.isArray(queue) ? queue : []).filter(contact => contact && contact.customerBehaviour && typeof contact.customerBehaviour === 'object');
  const open = items.filter(contact => OPEN_STATUSES.has(contact.status));
  const snapshots = items.map(contact => digitalCustomerBehaviourSnapshot(contact));
  const risks = digitalCustomerBehaviourRiskItems(queue);
  const sentimentTotal = snapshots.reduce((sum, item) => sum + item.sentiment, 0);
  return {
    totalTracked: items.length,
    openTracked: open.length,
    averageSentiment: snapshots.length ? Math.round(sentimentTotal / snapshots.length) : null,
    averageOpenSentiment: open.length ? Math.round(open.reduce((sum, item) => sum + digitalCustomerBehaviourSnapshot(item).sentiment, 0) / open.length) : null,
    frustratedOpen: open.filter(item => ['frustrated', 'angry', 'concerned'].includes(digitalCustomerBehaviourSnapshot(item).mood)).length,
    supervisorRecommended: risks.length,
    riskItems: risks.slice(0, 10).map(({ contact, behaviour }) => ({ id: contact.id, customer: contact.customer, subject: contact.subject, channel: contact.channel, mood: behaviour.mood, sentiment: behaviour.sentiment, reason: behaviour.supervisorReason }))
  };
}
