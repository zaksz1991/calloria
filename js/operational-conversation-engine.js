/**
 * CALLORIA live inbound simulation engine.
 * Deterministic synthetic customer dialogue for actual shift operations.
 * It is deliberately separate from recruitment assessments and Customer Lab practice.
 */
const PERSONAS = Object.freeze([
  { id: 'concerned', label: 'Concerned', patience: 58 },
  { id: 'frustrated', label: 'Frustrated', patience: 36 },
  { id: 'confused', label: 'Needs clear explanation', patience: 48 },
  { id: 'urgent', label: 'Time pressured', patience: 42 },
  { id: 'calm', label: 'Cooperative', patience: 78 }
]);

const RULES = Object.freeze({
  greeting: /\b(hello|good morning|good afternoon|good evening|thank you for calling|welcome)\b/i,
  empathy: /\b(understand|hear you|sorry|apolog|frustrat|concern|inconvenien|thank you for explaining|i appreciate)\b/i,
  ownership: /\b(i will|i can|i'll|let me|we will|we can|take ownership|assist you|help you|i am going to)\b/i,
  probe: /\b(when|what time|which|where|how much|reference|amount|date|merchant|beneficiary|transaction|location|error|case number)\b/i,
  nextStep: /\b(investigat|review|check|trace|case|reference|escalat|follow up|update|within|contact you|next step|specialist|dispute)\b/i,
  clarity: /\b(first|then|because|once|after|so that|for now|by|before)\b/i,
  credentialRequest: /\b(send|share|tell|provide|read out|give me|confirm)\b.{0,55}\b(pin|password|passcode|otp|one[- ]time password|verification code|cvv|security code)\b/i,
  cardDataRequest: /\b(send|share|tell|provide|read out|give me)\b.{0,45}\b(full|entire|complete)?\s*(card number|card details|cvv)\b/i,
  falsePromise: /\b(guarantee|guaranteed|definitely today|immediately reversed|will certainly be|100% sure|will be fixed today)\b/i,
  dismissive: /\b(not my problem|calm down|you should have|nothing i can do|just wait|that's your fault)\b/i
});

function choosePersona(seed) {
  const value = Math.abs(Number(seed) || 0);
  return PERSONAS[value % PERSONAS.length];
}
function safeText(value) { return String(value ?? '').trim().slice(0, 1200); }
function makeCustomerReply(conversation, outcome) {
  const p = conversation.persona.id;
  const reference = conversation.transactionReference;
  if (conversation.turn === 1) {
    if (outcome.empathy && outcome.ownership) {
      if (p === 'urgent') return `Thank you. I am short on time. The transaction reference is ${reference}; it happened earlier today.`;
      if (p === 'confused') return `Thank you for explaining. I can see the transaction alert, but I do not understand why the service did not complete. The reference is ${reference}.`;
      return `I appreciate you listening. The transaction reference is ${reference}. I can also confirm the approximate time and amount.`;
    }
    return p === 'frustrated'
      ? 'I have explained what happened already. Please listen and tell me exactly what you are checking.'
      : 'I am still worried. Can you explain what you need to establish before you can help?';
  }
  if (conversation.turn === 2) {
    if (outcome.probe) return `The reference is ${reference}. The amount and date are on the alert. I have not received a reversal or completion confirmation.`;
    return p === 'confused'
      ? 'I am not sure which details you need. Please ask me one thing at a time.'
      : 'What information do you need from me to trace this properly?';
  }
  if (conversation.turn >= 3) {
    if (outcome.nextStep && outcome.clarity && !outcome.falsePromise) {
      return 'I understand. Please record the case and tell me how I can follow up. I will wait for the confirmed update.';
    }
    if (p === 'frustrated') return 'I do not want another vague assurance. What action have you actually recorded, and what is the reference?';
    return 'Please explain the actual next step, the case reference and how I will receive an update.';
  }
  return 'Thank you for taking the time to review this. Please make sure the next step is recorded.';
}

export function createOperationalConversation({ id, scenario, seed = Date.now() } = {}) {
  if (!scenario || typeof scenario !== 'object') throw new TypeError('An inbound scenario is required.');
  const persona = choosePersona(seed);
  const reference = String(scenario.reference || id || `CALL-${Math.abs(Number(seed) || Date.now())}`);
  const opening = safeText(scenario.opening || scenario.issue || 'I need help with a recent service issue.');
  return {
    id: String(id || reference),
    type: 'live_inbound_customer_service',
    dataOrigin: 'synthetic_contact_centre_simulation',
    status: 'active',
    branch: 'opening',
    turn: 0,
    patience: persona.patience,
    persona: { ...persona },
    customer: String(scenario.customer || 'Simulated customer'),
    issue: String(scenario.issue || 'Customer enquiry'),
    transactionReference: reference,
    messages: [{ id: `${id || reference}-c0`, speaker: 'customer', text: opening, at: new Date().toISOString() }],
    scorecards: [],
    criticalBreaches: [],
    createdAt: new Date().toISOString(),
    completedAt: null,
    dispositionHint: 'resolved'
  };
}

export function evaluateOperationalResponse(text) {
  const response = safeText(text);
  if (response.length < 12) throw new RangeError('Customer responses must contain at least 12 characters.');
  const result = {
    greeting: RULES.greeting.test(response),
    empathy: RULES.empathy.test(response),
    ownership: RULES.ownership.test(response),
    probe: RULES.probe.test(response),
    nextStep: RULES.nextStep.test(response),
    clarity: response.length >= 35 && RULES.clarity.test(response),
    credentialRequest: RULES.credentialRequest.test(response),
    cardDataRequest: RULES.cardDataRequest.test(response),
    falsePromise: RULES.falsePromise.test(response),
    dismissive: RULES.dismissive.test(response)
  };
  result.criticalBreaches = [];
  if (result.credentialRequest) result.criticalBreaches.push('credential_solicitation');
  if (result.cardDataRequest) result.criticalBreaches.push('payment_card_data_solicitation');
  if (result.falsePromise) result.criticalBreaches.push('unverified_customer_promise');
  if (result.dismissive) result.criticalBreaches.push('dismissive_customer_treatment');
  const weights = { greeting: 8, empathy: 18, ownership: 16, probe: 18, nextStep: 25, clarity: 15 };
  const earned = Object.entries(weights).reduce((sum, [key, points]) => sum + (result[key] ? points : 0), 0);
  result.score = Math.max(0, earned - (result.criticalBreaches.length ? 45 : 0));
  result.customerReaction = result.criticalBreaches.length || (!result.empathy && !result.ownership)
    ? 'deteriorating' : result.empathy && result.ownership && result.nextStep ? 'improving' : 'steady';
  result.recommendations = [];
  if (!result.empathy) result.recommendations.push('Acknowledge the customer impact before moving into checks.');
  if (!result.ownership) result.recommendations.push('State the action you will personally take.');
  if (!result.probe) result.recommendations.push('Ask for relevant transaction facts without requesting security credentials.');
  if (!result.nextStep) result.recommendations.push('Explain a traceable case, investigation or approved specialist route.');
  if (!result.clarity) result.recommendations.push('Use plain language and explain the steps in order.');
  if (result.criticalBreaches.length) result.recommendations.unshift('Critical compliance review required.');
  return result;
}

export function submitOperationalTurn(conversation, text, now = Date.now()) {
  if (!conversation || conversation.type !== 'live_inbound_customer_service' || conversation.status !== 'active') {
    throw new Error('This inbound customer conversation is not active.');
  }
  const response = safeText(text);
  const evaluation = evaluateOperationalResponse(response);
  const at = new Date(now).toISOString();
  conversation.messages.push({ id: `${conversation.id}-a${conversation.turn + 1}`, speaker: 'agent', text: response, at });
  conversation.scorecards.push({ ...evaluation, at, turn: conversation.turn + 1 });
  conversation.turn += 1;
  conversation.patience = Math.max(0, Math.min(100, conversation.patience + (evaluation.customerReaction === 'improving' ? 12 : evaluation.customerReaction === 'deteriorating' ? -18 : -4)));
  if (evaluation.criticalBreaches.length) {
    conversation.criticalBreaches.push(...evaluation.criticalBreaches);
    conversation.status = 'escalated';
    conversation.branch = 'mandatory_review';
    conversation.dispositionHint = 'escalated';
    conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: 'I am uncomfortable continuing with this request. Please involve a supervisor and follow the formal security process.', at });
  } else {
    const customerText = makeCustomerReply(conversation, evaluation);
    const sufficientResolution = evaluation.nextStep && evaluation.clarity && !evaluation.falsePromise && (evaluation.probe || conversation.turn >= 3);
    if (sufficientResolution || conversation.turn >= 4 || conversation.patience <= 0) {
      conversation.status = 'ready_for_wrap_up';
      conversation.branch = sufficientResolution ? 'customer_acknowledged_next_step' : 'specialist_follow_up_required';
      conversation.dispositionHint = sufficientResolution ? 'resolved' : 'escalated';
      conversation.completedAt = at;
    }
    conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: customerText, at });
  }
  const averageScore = Math.round(conversation.scorecards.reduce((sum, item) => sum + item.score, 0) / conversation.scorecards.length);
  return {
    evaluation,
    averageScore,
    status: conversation.status,
    branch: conversation.branch,
    customerReaction: evaluation.customerReaction,
    recommendations: evaluation.recommendations,
    messageCount: conversation.messages.length
  };
}

export function operationalConversationSummary(conversation) {
  if (!conversation || conversation.type !== 'live_inbound_customer_service') throw new TypeError('Invalid operational conversation.');
  const cards = conversation.scorecards || [];
  return {
    turns: cards.length,
    averageScore: cards.length ? Math.round(cards.reduce((sum, item) => sum + item.score, 0) / cards.length) : 0,
    criticalBreaches: [...new Set(conversation.criticalBreaches || [])],
    status: conversation.status,
    branch: conversation.branch,
    recommendations: [...new Set(cards.flatMap(item => item.recommendations || []))]
  };
}
