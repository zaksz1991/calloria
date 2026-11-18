/**
 * CALLORIA v6.65 — adaptive customer behaviour for simulated inbound voice.
 * All callers, dialogue and outcomes are fictional game data. This module does
 * not connect to a telephone network or send audio/transcripts to a provider.
 */

export const VOICE_CUSTOMER_BEHAVIOUR_VERSION = '6.65.0';
export const VOICE_CUSTOMER_BEHAVIOUR_POLICY = Object.freeze({
  maxAgentTurns: 8,
  maxTranscriptEntries: 24,
  maxHistoryEntries: 32,
  maxInterruptions: 2,
  supervisorSentimentThreshold: 28,
  lowPatienceThreshold: 18,
  criticalEmotionThreshold: 90
});

const PERSONAS = Object.freeze({
  cooperative: { label: 'Cooperative', tone: 'Calm and constructive', sentiment: 76, patience: 82, emotion: 'calm' },
  frustrated: { label: 'Frustrated', tone: 'Impatient and direct', sentiment: 42, patience: 34, emotion: 'frustrated' },
  anxious: { label: 'Anxious', tone: 'Worried and seeking reassurance', sentiment: 48, patience: 43, emotion: 'concerned' },
  confused: { label: 'Confused', tone: 'Needs simple explanations', sentiment: 57, patience: 54, emotion: 'concerned' },
  time_pressured: { label: 'Time-pressured', tone: 'Needs concise action and timing', sentiment: 53, patience: 31, emotion: 'frustrated' },
  repeat_complainant: { label: 'Repeat complainant', tone: 'Expects ownership of earlier failures', sentiment: 31, patience: 24, emotion: 'frustrated' }
});

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
const clean = (value, max = 480) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const toIso = value => {
  const millis = typeof value === 'number' ? value : Date.parse(value);
  return new Date(Number.isFinite(millis) ? millis : Date.now()).toISOString();
};

function stableHash(value) {
  let hash = 2166136261;
  for (const character of String(value || 'CALLORIA')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function choosePersona(contact, scenario) {
  const source = `${scenario?.issue || contact?.issue || ''} ${scenario?.opening || ''} ${scenario?.category || ''}`.toLowerCase();
  if (/repeat|again|previous complaint|several times|still not|days ago|already reported/.test(source)) return 'repeat_complainant';
  if (/fraud|unauthori[sz]ed|security|missing money|debit|charged twice|failed transfer|atm/.test(source)) return 'anxious';
  if (/cannot sign|can't sign|confus|not understand|app access/.test(source)) return 'confused';
  if (/urgent|today|waiting|time.?pressured|salary|deadline/.test(source)) return 'time_pressured';
  const personaIds = Object.keys(PERSONAS);
  return personaIds[stableHash(contact?.id || scenario?.id) % personaIds.length];
}

function emotionFor(sentiment, patience, critical = false) {
  if (critical || sentiment <= 14 || patience <= 7) return 'angry';
  if (sentiment >= 78 && patience >= 58) return 'reassured';
  if (sentiment >= 62 && patience >= 42) return 'calm';
  if (sentiment <= 38 || patience <= 28) return 'frustrated';
  return 'concerned';
}

function sanitizeText(value) {
  return clean(value)
    .replace(/\b(pin|otp|one[- ]time (?:password|code)|password|passcode)\s*(?:is|:|=|-)?\s*[a-z0-9]{3,16}\b/gi, '$1 [REDACTED CREDENTIAL]')
    .replace(/\b(cvv|cvc|card number|security code)\s*(?:is|:|=|-|#)?\s*(?:\d[ -]?){3,19}\b/gi, '$1 [REDACTED FINANCIAL DETAIL]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED PAYMENT CARD]');
}

export function sanitizeVoiceCustomerText(value) {
  return sanitizeText(value);
}

function addTranscript(state, speaker, text, type, now) {
  const item = { speaker, text: sanitizeText(text), type, at: toIso(now), turn: state.turns || 0 };
  state.transcript.push(item);
  if (state.transcript.length > VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxTranscriptEntries) {
    state.transcript.splice(0, state.transcript.length - VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxTranscriptEntries);
  }
  return item;
}

function addHistory(state, entry) {
  state.history.push(entry);
  if (state.history.length > VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxHistoryEntries) {
    state.history.splice(0, state.history.length - VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxHistoryEntries);
  }
}

function credentialRequest(text) {
  const credential = '(?:password|passcode|one[- ]time (?:password|code|pin)|otp|pin|cvv|cvc|security code|full card number)';
  const request = new RegExp(`(?:\\b(?:ask|tell|read|share|send|provide|give|repeat|confirm|disclose)\\b.{0,90}\\b${credential}\\b)|(?:\\b${credential}\\b.{0,90}\\b(?:to me|with me|over the phone|on this call|read it|say it|tell me)\\b)`, 'i');
  const protectiveInstruction = /\b(?:will not|won't|never|do not|don't|should not|shouldn't|must not|mustn't)\s+(?:ask|request|need|require|share|tell|read|send|provide|repeat|disclose)\b/i;
  return String(text || '').split(/[.!?;,\n]+/).some(sentence => {
    const part = sentence.trim();
    return part.length > 0 && !protectiveInstruction.test(part) && request.test(part);
  });
}

function analyse(textValue) {
  const original = clean(textValue, 520);
  const text = sanitizeText(original);
  const acknowledgement = /\b(i understand|i hear you|i appreciate|i am sorry|i'm sorry|sorry about|acknowledge|your concern|the impact|thank you for explaining|let me listen)\b/i.test(text);
  const ownership = /\b(take ownership|take responsibility|i will (?:check|review|investigate|trace|record|log|follow)|i'll (?:check|review|investigate|trace|record|log)|review the case|open a case|case reference|escalate|raise this|i can check)\b/i.test(text);
  const secure = /\b(approved (?:process|procedure|secure)|secure verification|authenticate|verification process|never ask|will not ask|won't ask|do not share|don't share|keep your (?:pin|password)|protect your details)\b/i.test(text);
  const nextStep = /\b(next step|case reference|reference number|update|follow.?up|working day|once confirmed|after review|investigation|specialist|what happens next|i will contact)\b/i.test(text);
  const plainLanguage = text.length >= 24 && text.length <= 400 && !/\b(hereinafter|aforementioned|pursuant|notwithstanding)\b/i.test(text);
  const dismissive = /\b(calm down|not my problem|not our problem|nothing i can do|you should have|stop complaining|call back later|your fault|that is your fault|just wait)\b/i.test(text);
  const promise = /\b(guarantee|guaranteed|promise|definitely|certainly|immediately|instantly|in ten minutes|in 10 minutes|by tomorrow|today)\b/i.test(text)
    && !/\b(cannot guarantee|can't guarantee|not guarantee|cannot promise|can't promise|not promise|subject to|once confirmed|after review|if approved|not confirmed)\b/i.test(text);
  const remedy = /\b(refund|reversal|reverse|compensation|waive|waiver|chargeback|replacement|remedy|credit)\b/i.test(text);
  const conditional = /\b(subject to|if approved|once confirmed|after review|after i review|after i check|after i investigate|check the approved|within my authority|approval|eligible|authorised|authorized|verified)\b/i.test(text);
  const confirmed = /\b(approved (?:record|outcome|remedy|option)|verified (?:record|outcome|remedy)|confirmed (?:eligible|option|approval)|authorised (?:option|remedy)|authorized (?:option|remedy)|eligible for the (?:stated|approved|confirmed))\b/i.test(text);
  const secretRequest = credentialRequest(original);
  return { text, acknowledgement, ownership, secure, nextStep, plainLanguage, dismissive, promise, remedy, conditional, confirmed, secretRequest };
}

function createDecision(type) {
  if (type === 'interruption') {
    return {
      type,
      title: 'CUSTOMER INTERRUPTS THE CALL',
      prompt: 'The customer speaks over the explanation. Choose how to restore a constructive conversation.',
      options: [
        { id: 'listen', label: 'Stop speaking, let the customer finish and acknowledge the concern', description: 'Listen without interrupting, then summarise what you heard.' },
        { id: 'own', label: 'Acknowledge the impact and take ownership of the next action', description: 'State what you will check and what you can genuinely control.' },
        { id: 'defend', label: 'Tell the customer to calm down and follow the process', description: 'Dismisses the emotion and risks further escalation.' },
        { id: 'supervisor', label: 'Offer a supervisor review and explain the hand-off', description: 'Use when the customer needs additional authority or confidence.' }
      ]
    };
  }
  return {
    type: 'negotiation',
    title: 'SERVICE-RECOVERY NEGOTIATION',
    prompt: 'The customer asks for a firm remedy. Respond within your authority; do not invent a refund, waiver or completion time.',
    options: [
      { id: 'explain_options', label: 'Explain the verified process, available options and what is not yet confirmed', description: 'Be transparent about what can and cannot be promised.' },
      { id: 'check_authority', label: 'Check the approved remedy and escalate any decision outside your authority', description: 'Keep ownership while respecting approval limits.' },
      { id: 'promise_now', label: 'Promise an immediate refund, compensation or fixed completion time', description: 'An unsupported commitment damages trust and quality.' },
      { id: 'dismiss', label: 'Say there is nothing you can do and close the discussion', description: 'Leaves the customer without an owned next step.' },
      { id: 'supervisor', label: 'Request a supervisor to review the available service-recovery options', description: 'Appropriate when authority or customer confidence is exhausted.' }
    ]
  };
}

function safeDecisionNeeded(scenario, stepIndex, dimensions, state) {
  const issue = `${scenario?.category || ''} ${scenario?.issue || ''} ${scenario?.opening || ''}`;
  const recoveryEligible = /dispute|debit|charge|payment|transfer|refund|reversal|delay|failed|complaint|cancel|claim|compensation|service outage|shipment/i.test(issue);
  return recoveryEligible && stepIndex >= 1 && dimensions.remedy && dimensions.conditional && state.negotiationCount === 0;
}

function customerReply(state, dimensions, outcome) {
  if (outcome.criticalBreach) return 'I will not share my PIN, password, one-time code or payment security details. Please stop that request and involve the approved security team.';
  if (outcome.unverifiedPromise) return 'You have promised a specific result. Is that recorded and authorised, or is it still awaiting confirmation?';
  if (outcome.interrupted) {
    if (state.personaId === 'repeat_complainant') return 'Please let me finish. I have explained this before, and I still need someone to take ownership.';
    if (state.personaId === 'time_pressured') return 'I need to interrupt. I have limited time, so please tell me the actual next step.';
    if (state.personaId === 'confused') return 'Please let me finish. I am having trouble following the explanation and need one step at a time.';
    return 'Please let me finish explaining the problem before we move on.';
  }
  if (state.pendingDecision?.type === 'negotiation' || outcome.negotiationStarted) return 'What is confirmed, what still needs approval, and who will own the decision?';
  if (dimensions.dismissive) return 'That response feels dismissive. I still need the problem to be acknowledged and a clear next step.';
  if (dimensions.acknowledgement && dimensions.ownership && dimensions.nextStep) {
    if (state.personaId === 'repeat_complainant') return 'I appreciate you taking ownership. Please link this to my earlier complaint and keep me updated.';
    if (state.personaId === 'time_pressured') return 'That is clearer. Please keep the next step brief and tell me when I should expect an update.';
    return 'Thank you for explaining that. I understand the next step and will wait for the agreed update.';
  }
  if (state.personaId === 'confused') return 'I am not sure I understand. Could you explain that in a simpler order, one step at a time?';
  if (state.personaId === 'repeat_complainant') return 'This sounds like the explanation I received before. Who is responsible for resolving it this time?';
  if (state.personaId === 'time_pressured') return 'I need a direct answer. What is happening now, and what happens next?';
  if (state.personaId === 'anxious') return 'I am still worried about the effect on my account. Please explain what is safe and what happens next.';
  return 'I do not feel that my main concern has been addressed yet. Please listen to the problem I described.';
}

export function ensureVoiceCustomerBehaviour(call, contact, scenario, now = Date.now()) {
  if (!call || typeof call !== 'object') throw new TypeError('An active inbound call is required.');
  if (!contact || typeof contact !== 'object') throw new TypeError('The inbound customer contact is required.');
  const prior = call.voiceBehaviour && typeof call.voiceBehaviour === 'object' ? call.voiceBehaviour : {};
  const personaId = Object.hasOwn(PERSONAS, prior.personaId) ? prior.personaId : choosePersona(contact, scenario);
  const persona = PERSONAS[personaId];
  const opening = sanitizeText(scenario?.opening || contact.issue || 'How can you help me with this enquiry?');
  let transcript = Array.isArray(prior.transcript) ? prior.transcript.slice(-VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxTranscriptEntries) : Array.isArray(prior.messages) ? prior.messages.map(item => ({ speaker: item.speaker || 'customer', text: sanitizeText(item.text), type: item.type || 'legacy', at: item.at || toIso(now), turn: Number(item.turn) || 0 })).slice(-VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxTranscriptEntries) : [];
  if (!transcript.length) transcript = [{ speaker: 'customer', text: opening, type: 'opening', at: toIso(now), turn: 0 }];
  const flags = Array.isArray(prior.qualityFlags) ? [...new Set(prior.qualityFlags.map(item => clean(item, 80)).filter(Boolean))] : [];
  const state = {
    ...prior,
    version: VOICE_CUSTOMER_BEHAVIOUR_VERSION,
    personaId,
    personaLabel: persona.label,
    tone: persona.tone,
    sentiment: clamp(prior.sentiment ?? persona.sentiment),
    patience: clamp(prior.patience ?? persona.patience),
    emotion: prior.emotion || emotionFor(prior.sentiment ?? persona.sentiment, prior.patience ?? persona.patience, flags.includes('prohibited_secret_request')),
    interruptionCount: Math.max(0, Math.floor(Number(prior.interruptionCount ?? prior.interruptions) || 0)),
    negotiationCount: Math.max(0, Math.floor(Number(prior.negotiationCount) || 0)),
    negotiationResolved: prior.negotiationResolved === true,
    needsSupervisor: prior.needsSupervisor === true,
    supervisorReason: clean(prior.supervisorReason, 260),
    qualityFlags: flags,
    transcript,
    history: Array.isArray(prior.history) ? prior.history.slice(-VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxHistoryEntries) : [],
    turns: Math.max(0, Math.floor(Number(prior.turns) || transcript.filter(item => item.speaker === 'agent').length)),
    pendingDecision: prior.pendingDecision && ['interruption', 'negotiation'].includes(prior.pendingDecision.type) ? prior.pendingDecision : null,
    lastCustomerMessage: clean(prior.lastCustomerMessage || [...transcript].reverse().find(item => item.speaker === 'customer')?.text || opening),
    issue: clean(scenario?.issue || contact.issue || '', 320),
    createdAt: prior.createdAt || toIso(now)
  };
  state.emotion = emotionFor(state.sentiment, state.patience, state.qualityFlags.includes('prohibited_secret_request'));
  call.voiceBehaviour = state;
  return state;
}

export function evaluateVoiceCustomerTurn(behaviour, option, { scenario, stepIndex = 0, now = Date.now() } = {}) {
  if (!behaviour || !option || !scenario) throw new TypeError('Voice behaviour, agent response and scenario are required.');
  if (behaviour.pendingDecision) throw new Error('Resolve the customer interruption or service-recovery decision before continuing the call.');
  if ((Number(behaviour.turns) || 0) >= VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns) {
    throw new Error(`Maximum conversation turns (${VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxAgentTurns}) reached. Complete the call or request supervisor support.`);
  }
  const dimensions = analyse(option.text || option.label || '');
  if (dimensions.text.length < 4) throw new Error('Enter a short response before sending it to the customer.');
  const priorSentiment = clamp(behaviour.sentiment);
  const priorPatience = clamp(behaviour.patience);
  const optionScore = Number(option.score) || 0;
  const criticalBreach = dimensions.secretRequest;
  const breach = option.breach === true;
  const unsupportedPromise = dimensions.promise;
  const positiveCount = [dimensions.acknowledgement, dimensions.ownership, dimensions.secure, dimensions.nextStep, dimensions.plainLanguage].filter(Boolean).length;
  let sentimentDelta = 0;
  let patienceDelta = 0;
  let scoreDelta = 0;
  let qualityFlag = '';

  if (criticalBreach) {
    sentimentDelta = -34; patienceDelta = -32; scoreDelta = -2; qualityFlag = 'prohibited_secret_request';
    if (!behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'A prohibited request for a PIN, password, one-time code or payment security detail was detected.';
  } else if (breach) {
    sentimentDelta = -25; patienceDelta = -22; scoreDelta = -2; qualityFlag = 'critical_handling_breach';
    if (!behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'A critical call-handling or compliance breach requires supervisor review.';
  } else if (unsupportedPromise) {
    sentimentDelta = -14; patienceDelta = -12; scoreDelta = -1; qualityFlag = 'unverified_commitment';
    if (!behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'An unsupported outcome or timing commitment requires supervisor and quality review.';
  } else if (dimensions.dismissive || optionScore <= -2) {
    sentimentDelta = -13; patienceDelta = -14; scoreDelta = -1; qualityFlag = dimensions.dismissive ? 'dismissive_customer_handling' : '';
    if (qualityFlag && !behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
  } else if (optionScore >= 2 || positiveCount >= 4) {
    sentimentDelta = 11 + (dimensions.acknowledgement ? 3 : 0) + (dimensions.ownership ? 2 : 0);
    patienceDelta = 12 + (dimensions.nextStep ? 3 : 0);
    scoreDelta = 1;
  } else if (optionScore > 0 || positiveCount >= 2) {
    sentimentDelta = 6; patienceDelta = 6; scoreDelta = 1;
  } else {
    sentimentDelta = -3; patienceDelta = -4;
  }

  const interruption = !criticalBreach && !breach && !unsupportedPromise
    && behaviour.interruptionCount < VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxInterruptions
    && (dimensions.dismissive || (priorSentiment <= 42 && priorPatience <= 34 && !dimensions.acknowledgement));
  if (interruption) {
    behaviour.interruptionCount += 1;
    sentimentDelta -= 3;
    patienceDelta -= 5;
  }

  const negotiationStarted = safeDecisionNeeded(scenario, stepIndex, dimensions, behaviour);
  if (negotiationStarted) behaviour.negotiationCount += 1;

  behaviour.turns = (Number(behaviour.turns) || 0) + 1;
  behaviour.sentiment = clamp(priorSentiment + sentimentDelta);
  behaviour.patience = clamp(priorPatience + patienceDelta);
  behaviour.emotion = emotionFor(behaviour.sentiment, behaviour.patience, criticalBreach || breach);

  addTranscript(behaviour, 'agent', dimensions.text, 'agent_response', now);
  let decision = null;
  if (interruption) decision = createDecision('interruption');
  else if (negotiationStarted) decision = createDecision('negotiation');
  behaviour.pendingDecision = decision;

  const reply = customerReply(behaviour, dimensions, { criticalBreach: criticalBreach || breach, unsupportedPromise, interrupted: interruption, negotiationStarted });
  const replyType = criticalBreach || breach ? 'security_objection' : interruption ? 'interruption' : unsupportedPromise ? 'unsupported_commitment' : negotiationStarted ? 'negotiation_request' : 'reaction';
  addTranscript(behaviour, 'customer', reply, replyType, now);
  behaviour.lastCustomerMessage = sanitizeText(reply);
  behaviour.lastAgentAction = dimensions.text;
  if (behaviour.sentiment <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.supervisorSentimentThreshold || behaviour.patience <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.lowPatienceThreshold) {
    behaviour.needsSupervisor = true;
    if (!behaviour.supervisorReason) behaviour.supervisorReason = 'Customer sentiment or patience has fallen below the intervention threshold.';
  }
  if (behaviour.qualityFlags.length && !behaviour.supervisorReason) behaviour.supervisorReason = 'A voice quality flag requires supervisor review.';

  const event = { type: criticalBreach || breach ? 'critical_voice_risk' : interruption ? 'customer_interruption' : negotiationStarted ? 'service_recovery_negotiation' : 'customer_reaction', turn: behaviour.turns, at: toIso(now), sentiment: behaviour.sentiment, patience: behaviour.patience, emotion: behaviour.emotion };
  addHistory(behaviour, { ...event, agentText: dimensions.text, customerText: sanitizeText(reply), scoreDelta, qualityFlag });
  return {
    behaviour,
    event,
    decision,
    pendingDecision: decision,
    customerMessage: sanitizeText(reply),
    sentimentDelta,
    patienceDelta,
    scoreDelta,
    qualityFlag,
    criticalBreach,
    breach,
    interrupted: interruption,
    needsSupervisor: behaviour.needsSupervisor,
    supervisorReason: behaviour.supervisorReason,
    dimensions,
    unsupportedPromise
  };
}

export function evaluateVoiceAgentUtterance(behaviour, utterance, options = {}) {
  const dimensions = analyse(utterance);
  const positiveCount = [dimensions.acknowledgement, dimensions.ownership, dimensions.secure, dimensions.nextStep, dimensions.plainLanguage].filter(Boolean).length;
  let score = positiveCount >= 4 ? 2 : positiveCount >= 2 ? 1 : positiveCount === 1 ? 0 : -1;
  if (dimensions.dismissive || dimensions.promise) score = -2;
  if (dimensions.secretRequest) score = -5;
  const result = evaluateVoiceCustomerTurn(behaviour, {
    text: dimensions.text,
    score,
    breach: dimensions.secretRequest,
    feedback: 'Free-form agent response evaluated for acknowledgement, ownership, security and next-step quality.'
  }, options);
  result.freeResponse = true;
  result.criticalBreach = dimensions.secretRequest || result.criticalBreach;
  result.unsupportedPromise = dimensions.promise;
  result.scoreDelta = dimensions.secretRequest ? -2 : dimensions.promise || dimensions.dismissive ? -1 : positiveCount >= 3 ? 1 : 0;
  result.dimensions = dimensions;
  return result;
}

export function resolveVoiceCustomerDecision(behaviour, optionId, { now = Date.now() } = {}) {
  const decision = behaviour?.pendingDecision;
  if (!decision) throw new Error('There is no customer interruption or service-recovery decision to resolve.');
  const option = decision.options.find(item => item.id === optionId);
  if (!option) throw new Error('Choose a valid customer-response option.');
  const decisionType = decision.type;
  let sentimentDelta = 0;
  let patienceDelta = 0;
  let scoreDelta = 0;
  let qualityFlag = '';
  let customerMessage = '';

  if (decisionType === 'interruption') {
    if (optionId === 'listen') {
      sentimentDelta = 15; patienceDelta = 17; scoreDelta = 1;
      customerMessage = 'Thank you for letting me finish. That is the main issue I have been trying to explain.';
    } else if (optionId === 'own') {
      sentimentDelta = 13; patienceDelta = 14; scoreDelta = 1;
      customerMessage = 'I appreciate you taking responsibility. Please explain the action you can take now.';
    } else if (optionId === 'defend') {
      sentimentDelta = -16; patienceDelta = -18; scoreDelta = -2; qualityFlag = 'dismissive_interruption_handling';
      customerMessage = 'I am trying to explain a problem. Telling me to calm down does not help.';
    } else {
      sentimentDelta = 2; patienceDelta = 2;
      behaviour.needsSupervisor = true;
      behaviour.supervisorReason = 'Agent offered supervisor assistance after a customer interruption.';
      customerMessage = 'Please bring the supervisor in, but make sure they understand what I have already explained.';
    }
  } else if (optionId === 'explain_options') {
    sentimentDelta = 9; patienceDelta = 9; scoreDelta = 1;
    customerMessage = 'Thank you. Please separate what is confirmed from what still needs approval, and explain the next review step.';
  } else if (optionId === 'check_authority') {
    sentimentDelta = 12; patienceDelta = 11; scoreDelta = 1;
    behaviour.negotiationResolved = true;
    customerMessage = 'That is fair. Please confirm the approved option and any conditions before taking action.';
  } else if (optionId === 'promise_now') {
    sentimentDelta = -20; patienceDelta = -18; scoreDelta = -2; qualityFlag = 'unverified_commitment';
    if (!behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'An unsupported remedy or completion-time commitment was made during service recovery.';
    customerMessage = 'I will rely on that promise. Please make sure it is actually authorised and recorded.';
  } else if (optionId === 'dismiss') {
    sentimentDelta = -17; patienceDelta = -16; scoreDelta = -2; qualityFlag = 'dismissive_service_recovery';
    if (!behaviour.qualityFlags.includes(qualityFlag)) behaviour.qualityFlags.push(qualityFlag);
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'The customer was dismissed during a service-recovery request.';
    customerMessage = 'That does not resolve the problem. I want a supervisor to review this complaint.';
  } else {
    sentimentDelta = 3; patienceDelta = 2;
    behaviour.needsSupervisor = true;
    behaviour.supervisorReason = 'Agent requested supervisor review of the service-recovery options.';
    customerMessage = 'Please make sure the supervisor reviews the history and explains the options available.';
  }

  behaviour.pendingDecision = null;
  behaviour.sentiment = clamp(behaviour.sentiment + sentimentDelta);
  behaviour.patience = clamp(behaviour.patience + patienceDelta);
  behaviour.emotion = emotionFor(behaviour.sentiment, behaviour.patience, behaviour.qualityFlags.includes('prohibited_secret_request'));
  if (behaviour.sentiment <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.supervisorSentimentThreshold || behaviour.patience <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.lowPatienceThreshold) {
    behaviour.needsSupervisor = true;
    if (!behaviour.supervisorReason) behaviour.supervisorReason = 'Customer sentiment or patience has fallen below the intervention threshold.';
  }
  addTranscript(behaviour, 'agent', option.label, 'decision_response', now);
  addTranscript(behaviour, 'customer', customerMessage, 'decision_reaction', now);
  behaviour.lastCustomerMessage = sanitizeText(customerMessage);
  const event = { type: `${decisionType === 'interruption' ? 'customer_interruption' : 'service_recovery_negotiation'}_resolved`, at: toIso(now), optionId, sentiment: behaviour.sentiment, patience: behaviour.patience };
  addHistory(behaviour, { ...event, agentText: option.label, customerText: sanitizeText(customerMessage), scoreDelta, qualityFlag });
  return { behaviour, option, event, customerMessage, sentimentDelta, patienceDelta, scoreDelta, qualityFlag, pendingDecision: behaviour.pendingDecision };
}

export function voiceCustomerBehaviourSnapshot(behaviour) {
  if (!behaviour || typeof behaviour !== 'object') return null;
  return {
    version: behaviour.version || VOICE_CUSTOMER_BEHAVIOUR_VERSION,
    personaId: behaviour.personaId,
    personaLabel: clean(behaviour.personaLabel || PERSONAS[behaviour.personaId]?.label || 'Customer', 80),
    tone: clean(behaviour.tone || 'Customer response profile', 120),
    emotion: behaviour.emotion || emotionFor(behaviour.sentiment, behaviour.patience, behaviour.qualityFlags?.includes('prohibited_secret_request')),
    sentiment: clamp(behaviour.sentiment),
    patience: clamp(behaviour.patience),
    interruptionCount: Math.max(0, Number(behaviour.interruptionCount) || 0),
    negotiationCount: Math.max(0, Number(behaviour.negotiationCount) || 0),
    negotiationResolved: behaviour.negotiationResolved === true,
    needsSupervisor: behaviour.needsSupervisor === true,
    supervisorReason: clean(behaviour.supervisorReason, 260),
    qualityFlags: Array.isArray(behaviour.qualityFlags) ? [...new Set(behaviour.qualityFlags)] : [],
    transcript: Array.isArray(behaviour.transcript) ? behaviour.transcript.slice(-VOICE_CUSTOMER_BEHAVIOUR_POLICY.maxTranscriptEntries) : [],
    turns: Math.max(0, Number(behaviour.turns) || 0),
    pendingDecision: behaviour.pendingDecision || null
  };
}

export function voiceCustomerOutcome(behaviour) {
  if (!behaviour) return { outcome: 'not_recorded', label: 'Not recorded', defaultDisposition: 'resolved', customerSatisfaction: 3.4 };
  const snapshot = voiceCustomerBehaviourSnapshot(behaviour);
  if (snapshot.needsSupervisor || snapshot.qualityFlags.length || snapshot.sentiment <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.supervisorSentimentThreshold || snapshot.patience <= VOICE_CUSTOMER_BEHAVIOUR_POLICY.lowPatienceThreshold || snapshot.pendingDecision || (snapshot.negotiationCount > 0 && !snapshot.negotiationResolved)) {
    return { outcome: 'escalation_required', label: 'Supervisor / specialist review required', defaultDisposition: 'escalated', customerSatisfaction: 2.1 };
  }
  if (snapshot.sentiment >= 72 && snapshot.patience >= 48) {
    return { outcome: 'reassured', label: 'Customer reassured', defaultDisposition: 'resolved', customerSatisfaction: 4.7 };
  }
  if (snapshot.sentiment >= 48) {
    return { outcome: 'engaged', label: 'Customer engaged; next step agreed', defaultDisposition: 'resolved', customerSatisfaction: 3.8 };
  }
  return { outcome: 'at_risk', label: 'Customer remains dissatisfied', defaultDisposition: 'escalated', customerSatisfaction: 2.7 };
}
