/**
 * CALLORIA Customer Intelligence Engine.
 * Synthetic scenario generation and transparent, deterministic practice QA.
 * No external AI provider, live customer data or production contact systems are used.
 */

export const CUSTOMER_PERSONAS = Object.freeze([
  { id: 'calm', label: 'Calm and cooperative', patience: 82, emotion: 'calm', style: 'clear' },
  { id: 'angry', label: 'Angry and frustrated', patience: 28, emotion: 'angry', style: 'direct' },
  { id: 'confused', label: 'Confused and uncertain', patience: 48, emotion: 'confused', style: 'repetitive' },
  { id: 'elderly', label: 'Older customer needing a slower pace', patience: 58, emotion: 'uncertain', style: 'careful' },
  { id: 'technical', label: 'Technically challenged', patience: 52, emotion: 'confused', style: 'plain-language' },
  { id: 'suspicious', label: 'Suspicious security-conscious customer', patience: 45, emotion: 'guarded', style: 'questioning' },
  { id: 'repeat', label: 'Repeat complainant', patience: 18, emotion: 'angry', style: 'history-focused' },
  { id: 'business', label: 'Business customer under time pressure', patience: 35, emotion: 'urgent', style: 'concise' }
]);

export const CUSTOMER_ISSUES = Object.freeze([
  { id: 'duplicate-debit', category: 'Payments', title: 'Possible duplicate debit', risk: 'high', goal: 'Review both transaction references and open a traceable dispute without promising an outcome.', opener: 'I was charged twice for one purchase. The merchant says they only received one payment.' },
  { id: 'mobile-access', category: 'Digital access', title: 'Mobile app access failure', risk: 'normal', goal: 'Establish the error and device context, then guide the customer through approved recovery without collecting credentials.', opener: 'I changed my phone and cannot sign in to the app. I need to make a payment.' },
  { id: 'suspected-fraud', category: 'Fraud and security', title: 'Suspected account compromise', risk: 'critical', goal: 'Prioritise protective action, authenticate safely and route immediately through the approved fraud process.', opener: 'I have received alerts for transactions I did not make. I am worried someone has access to my account.' },
  { id: 'failed-transfer', category: 'Transfers', title: 'Transfer not received', risk: 'high', goal: 'Capture the transaction trace details, confirm only verified status and set an accurate next step.', opener: 'My account was debited, but the person I sent the money to has not received it.' },
  { id: 'service-information', category: 'General service', title: 'Product or service information', risk: 'low', goal: 'Clarify the customer need, explain relevant information accurately and avoid unsuitable selling.', opener: 'I want to understand the service options and any charges before I decide.' },
  { id: 'repeat-complaint', category: 'Complaints', title: 'Unresolved repeat complaint', risk: 'high', goal: 'Acknowledge previous effort, review the existing case and take ownership of a clear escalation.', opener: 'I have contacted you twice already. Nobody has resolved this issue or explained what is happening.' }
]);

const PATTERNS = Object.freeze({
  greeting: /\b(hello|good morning|good afternoon|good evening|thank you for contacting|welcome)\b/i,
  acknowledge: /\b(understand|hear you|acknowledge|sorry|apolog|inconvenien|frustrat|concern|thank you for explaining)\b/i,
  ownership: /\b(i will|i can|let me|i'll|we will|we can|take ownership|assist you|help you)\b/i,
  probing: /\b(when|what time|which|where|how|reference|amount|date|error|case number|transaction)\b/i,
  nextStep: /\b(next step|investigat|review|check|trace|case|reference|escalat|follow up|update|within|contact you)\b/i,
  clarity: /\b(please|first|then|because|once|after|so that)\b/i,
  credentialRequest: /\b(send|share|tell|provide|read out|give me)\b.{0,45}\b(pin|password|passcode|otp|one[- ]time password|verification code|cvv|security code)\b/i,
  cardNumberRequest: /\b(full|entire|complete)\b.{0,30}\b(card|debit|credit)\b.{0,25}\b(number|details)\b/i,
  falsePromise: /\b(guarantee|guaranteed|definitely today|immediately reversed|will certainly be|100% sure)\b/i,
  dismissive: /\b(not my problem|calm down|you should have|there is nothing i can do|just wait)\b/i,
  optOutIgnore: /\b(keep calling|call you again|continue the offer|you must listen)\b/i
});

function hasUnnegatedMatch(text, pattern) {
  const source = String(text || '');
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  let match;
  while ((match = matcher.exec(source))) {
    const before = source.slice(Math.max(0, match.index - 28), match.index);
    if (!/\b(don't|do not|never|must not|should not|cannot|can't|avoid)\b/i.test(before)) return true;
    if (match[0].length === 0) matcher.lastIndex++;
  }
  return false;
}

function pick(list, seed, offset = 0) {
  const n = Math.abs(Math.floor(Number(seed) || 0) + offset * 17);
  return list[n % list.length];
}

export function createCustomerScenario({ seed = Date.now(), personaId = null, issueId = null, channel = 'Voice' } = {}) {
  const persona = CUSTOMER_PERSONAS.find(item => item.id === personaId) || pick(CUSTOMER_PERSONAS, seed, 1);
  const issue = CUSTOMER_ISSUES.find(item => item.id === issueId) || pick(CUSTOMER_ISSUES, seed, 2);
  const id = `CIL-${Math.abs(Math.floor(Number(seed) || Date.now())).toString(36).toUpperCase()}`;
  const followUps = {
    angry: ['I have heard apologies before. What are you actually going to do?', 'I do not want another vague answer. Explain the action you are taking.'],
    confused: ['I am not sure I understand. Can you explain that more simply?', 'What exactly do I need to do next?'],
    suspicious: ['How do I know this is an official process? I will not share my password or code.', 'Can you explain why you need that information and how it is protected?'],
    uncertain: ['Please take your time and explain one step at a time.', 'Could you repeat the next step slowly?'],
    urgent: ['I have limited time. What information do you need first?', 'Please give me the action and expected follow-up clearly.'],
    calm: ['Thank you. What should I expect after this conversation?', 'That is clear. Please confirm the reference and next step.']
  };
  return {
    id, seed: Number(seed), channel: String(channel), persona: { ...persona }, issue: { ...issue },
    customer: pick(['Aisha Bello', 'Daniel Okoro', 'Fatima Sani', 'Ibrahim Musa', 'Ngozi Eze', 'Samuel Adeyemi', 'Zainab Garba', 'Peter James'], seed, 3),
    turn: 0, patience: persona.patience, status: 'active', scorecards: [], transcript: [],
    statement: issue.opener,
    followUps: followUps[persona.emotion] || followUps.calm,
    branch: 'opening', createdAt: new Date(Number(seed) || Date.now()).toISOString()
  };
}

export function evaluateCustomerResponse(text, scenario, { requireGreeting = true } = {}) {
  const response = String(text || '').trim();
  if (!scenario || !scenario.issue) throw new TypeError('A valid customer scenario is required.');
  if (response.length < 12) throw new RangeError('Response must contain at least 12 characters.');
  const evidence = {
    greeting: !requireGreeting || PATTERNS.greeting.test(response),
    acknowledgement: PATTERNS.acknowledge.test(response),
    ownership: PATTERNS.ownership.test(response),
    probing: PATTERNS.probing.test(response),
    nextStep: PATTERNS.nextStep.test(response),
    clarity: response.length >= 45 && PATTERNS.clarity.test(response)
  };
  const criticalBreaches = [];
  if (hasUnnegatedMatch(response, PATTERNS.credentialRequest)) criticalBreaches.push('credential_solicitation');
  if (hasUnnegatedMatch(response, PATTERNS.cardNumberRequest)) criticalBreaches.push('payment_card_data_solicitation');
  if (hasUnnegatedMatch(response, PATTERNS.falsePromise)) criticalBreaches.push('unverified_guarantee');
  if (hasUnnegatedMatch(response, PATTERNS.dismissive)) criticalBreaches.push('dismissive_language');
  if (scenario.persona?.id === 'repeat' && !evidence.acknowledgement) evidence.acknowledgement = false;
  const weights = { greeting: 10, acknowledgement: 20, ownership: 15, probing: 15, nextStep: 25, clarity: 15 };
  const earned = Object.entries(evidence).reduce((sum, [key, passed]) => sum + (passed ? weights[key] : 0), 0);
  const penalty = criticalBreaches.length ? 40 + (criticalBreaches.length - 1) * 15 : 0;
  const score = Math.max(0, Math.min(100, earned - penalty));
  const customerDelta = (evidence.acknowledgement ? 10 : -12) + (evidence.ownership ? 8 : -8) + (evidence.nextStep ? 6 : -10) - criticalBreaches.length * 18;
  const customerReaction = customerDelta >= 15 ? 'improving' : customerDelta <= -10 ? 'deteriorating' : 'steady';
  const recommendations = [];
  if (!evidence.acknowledgement) recommendations.push('Acknowledge the customer’s concern before moving into checks.');
  if (!evidence.ownership) recommendations.push('State what you will do and retain ownership of the next action.');
  if (!evidence.probing) recommendations.push('Ask a focused question to establish the facts needed for investigation.');
  if (!evidence.nextStep) recommendations.push('Explain a specific, verified next step and how the customer will receive an update.');
  if (!evidence.clarity) recommendations.push('Use short, ordered sentences and plain language.');
  for (const breach of criticalBreaches) recommendations.unshift(`Critical review required: ${breach.replaceAll('_', ' ')}.`);
  return {
    score, evidence, criticalBreaches, customerReaction,
    customerPatience: Math.max(0, Math.min(100, Number(scenario.patience ?? 50) + customerDelta)),
    recommendations, evaluatedAt: new Date().toISOString(),
    label: criticalBreaches.length ? 'critical_review' : score >= 80 ? 'strong' : score >= 60 ? 'developing' : 'coaching_required'
  };
}

export function submitCustomerTurn(scenario, response, now = Date.now()) {
  if (!scenario || scenario.status !== 'active') throw new Error('This customer interaction is not active.');
  const result = evaluateCustomerResponse(response, scenario, { requireGreeting: scenario.turn === 0 });
  scenario.scorecards.push(result);
  scenario.transcript.push({ speaker: 'agent', text: String(response).trim(), at: new Date(now).toISOString(), qa: result });
  scenario.patience = result.customerPatience;
  scenario.turn += 1;
  if (result.criticalBreaches.length) {
    scenario.status = 'escalated';
    scenario.branch = 'mandatory_review';
    scenario.statement = 'The interaction requires immediate supervisor or compliance review under the simulated policy.';
  } else if (scenario.turn >= 3 || scenario.patience <= 0) {
    scenario.status = 'completed';
    scenario.branch = 'wrap_up';
    scenario.statement = 'The customer interaction is ready for factual notes and an explicit disposition.';
  } else {
    scenario.branch = result.customerReaction === 'deteriorating' ? 'recovery_needed' : result.customerReaction === 'improving' ? 'progressing' : 'clarification';
    scenario.statement = scenario.followUps[(scenario.turn - 1) % scenario.followUps.length];
  }
  return { result, scenario };
}

export function finalizeCustomerScenario(scenario) {
  if (!scenario || !['completed', 'escalated'].includes(scenario.status)) throw new Error('Complete or escalate the interaction before finalising QA.');
  const cards = scenario.scorecards || [];
  const average = cards.length ? Math.round(cards.reduce((sum, item) => sum + item.score, 0) / cards.length) : 0;
  const breaches = cards.flatMap(item => item.criticalBreaches || []);
  return {
    id: scenario.id, issueId: scenario.issue.id, personaId: scenario.persona.id,
    channel: scenario.channel, status: scenario.status, turns: cards.length,
    averageScore: average, criticalBreaches: [...new Set(breaches)],
    outcome: breaches.length ? 'mandatory_review' : average >= 80 ? 'strong' : average >= 60 ? 'coaching' : 'remediation',
    dimensions: Object.keys(cards[0]?.evidence || {}).reduce((out, key) => {
      const total = cards.filter(card => card.evidence[key]).length;
      out[key] = cards.length ? Math.round(total / cards.length * 100) : 0;
      return out;
    }, {}),
    recommendations: [...new Set(cards.flatMap(item => item.recommendations || []))],
    completedAt: new Date().toISOString()
  };
}

export function customerIntelligenceMetrics(history = []) {
  const records = Array.isArray(history) ? history : [];
  const completed = records.filter(item => Number.isFinite(item.averageScore));
  const scores = completed.map(item => item.averageScore);
  const breaches = completed.reduce((sum, item) => sum + (item.criticalBreaches?.length || 0), 0);
  return {
    interactions: completed.length,
    averageQA: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    strong: completed.filter(item => item.outcome === 'strong').length,
    coaching: completed.filter(item => ['coaching', 'remediation'].includes(item.outcome)).length,
    mandatoryReview: completed.filter(item => item.outcome === 'mandatory_review').length,
    criticalBreaches: breaches
  };
}
