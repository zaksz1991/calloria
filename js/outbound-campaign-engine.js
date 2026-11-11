/**
 * CALLORIA v4.5 outbound campaign conversation engine.
 * Deterministic synthetic contacts only. It never places a real telephone call.
 */
const TEXT_LIMIT = 1000;
const PERSONAS = Object.freeze([
  { id: 'open', label: 'Open to a brief conversation', patience: 76 },
  { id: 'busy', label: 'Busy / time limited', patience: 48 },
  { id: 'callback', label: 'Requested a follow-up', patience: 62 },
  { id: 'declined', label: 'Not interested', patience: 42 },
  { id: 'opt_out', label: 'Do not contact preference', patience: 35 },
]);
const RULES = Object.freeze({
  identity: /\b(this is|my name is|i am|i'm|calling from|with)\b/i,
  purpose: /\b(calling about|calling regarding|regarding|about your|following up|follow[- ]?up|service review|customer feedback|requested information|payment reminder|appointment|delivery|renewal|campaign)\b/i,
  permission: /\b(is now (a )?(good|convenient) time|convenient time|do you have a moment|may i (speak|continue|take)|can we (speak|talk)|is it okay to (talk|continue)|are you available to talk)\b/i,
  empathy: /\b(understand|appreciate|thank you for letting me know|no problem|i hear you|sorry to interrupt)\b/i,
  probe: /\b(would you|are you|what|which|when|how|may i ask|could you confirm)\b/i,
  clarity: /\b(the reason|the purpose|the next step|there is no obligation|no pressure|you can decline|you can opt out|i can arrange|i will record)\b/i,
  callback: /\b(call (you )?back|callback|another time|later today|tomorrow|a better time|reschedule)\b/i,
  respectfulDecline: /\b(no problem|i respect that|i will record your decision|won't proceed|will not proceed|no further pitch|thank you for your time)\b/i,
  acknowledgeOptOut: /\b(remove (your|the) (number|contact|details)|suppress|do not contact|no further calls|no further contact|honour your request|honor your request|stop future calls|stop contacting)\b/i,
  optOutRequest: /\b(do not call|don't call|stop calling|remove me|take me off|unsubscribe|no more calls|do not contact|don't contact me|no further contact)\b/i,
  credentialRequest: /\b(send|share|tell|provide|read out|give me|confirm)\b.{0,55}\b(pin|password|passcode|otp|one[- ]time password|verification code|cvv|security code)\b/i,
  falsePromise: /\b(guarantee|guaranteed|definitely approved|certainly approved|100% approved|will certainly|no risk at all|guaranteed savings)\b/i,
  pressure: /\b(you must|you have to|you cannot refuse|don't miss out or else|i will keep calling|you have no choice)\b/i,
});
function safeText(value) { return String(value ?? '').trim().slice(0, TEXT_LIMIT); }
function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value || '')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
function choosePreference(campaign, seed) {
  const explicit = String(campaign?.contactPreference || '').toLowerCase();
  if (['open', 'busy', 'callback', 'declined', 'opt_out'].includes(explicit)) return explicit;
  const bucket = stableHash(`${campaign?.id || ''}:${campaign?.customer || ''}:${seed}`) % 10;
  if (bucket === 0) return 'opt_out';
  if (bucket === 1 || bucket === 2) return 'busy';
  if (bucket === 3) return 'callback';
  if (bucket === 4) return 'declined';
  return 'open';
}
function openingFor(preference, customer) {
  if (preference === 'opt_out') return `Hello. I do not want further campaign calls. Please remove my contact from this campaign and do not call again.`;
  if (preference === 'busy') return `Hello, ${customer} speaking. I am in the middle of something. Who is calling and what is this about?`;
  if (preference === 'callback') return `Hello, ${customer} here. I was expecting a follow-up, but I only have a short moment. Can you explain why you called?`;
  if (preference === 'declined') return `Hello. Before you continue, I should say I am not looking for another offer or service at the moment.`;
  return `Hello, this is ${customer}. Who is calling, please?`;
}
export function createOutboundConversation({ id, campaign, agentName = 'Customer Experience Agent', seed = Date.now(), now = Date.now() } = {}) {
  if (!campaign || typeof campaign !== 'object') throw new TypeError('An outbound campaign template is required.');
  const customer = safeText(campaign.customer || 'Synthetic customer');
  const preference = choosePreference(campaign, seed);
  const conversation = {
    id: String(id || `OUT-${stableHash(`${customer}:${seed}`).toString(16)}`),
    type: 'outbound_campaign_conversation',
    dataOrigin: 'synthetic_campaign_contact',
    status: 'active',
    campaignId: safeText(campaign.id),
    campaignTitle: safeText(campaign.title),
    campaignPurpose: safeText(campaign.objective || campaign.type || campaign.title),
    customer,
    agentName: safeText(agentName || 'Customer Experience Agent'),
    preference,
    turn: 0,
    patience: PERSONAS.find(item => item.id === preference)?.patience ?? 70,
    permissionToContinue: false,
    callbackRequested: false,
    suppressionRequested: preference === 'opt_out',
    dispositionHint: preference === 'opt_out' ? 'opt_out' : preference === 'callback' ? 'callback' : preference === 'declined' ? 'declined' : null,
    customerDecision: campaign.id === 'product-offer' ? 'pending' : 'not_applicable',
    messages: [{ id: `${id || 'out'}-c0`, speaker: 'customer', text: openingFor(preference, customer), at: new Date(now).toISOString() }],
    scorecards: [],
    criticalBreaches: [],
    createdAt: new Date(now).toISOString(),
    completedAt: preference === 'opt_out' ? new Date(now).toISOString() : null,
  };
  if (preference === 'opt_out') conversation.status = 'ready_for_wrap_up';
  return conversation;
}
export function evaluateOutboundResponse(text, conversation) {
  const response = safeText(text);
  if (response.length < 12) throw new RangeError('Outbound responses must contain at least 12 characters.');
  const flags = {
    identity: RULES.identity.test(response),
    purpose: RULES.purpose.test(response),
    permission: RULES.permission.test(response),
    empathy: RULES.empathy.test(response),
    probe: RULES.probe.test(response),
    clarity: RULES.clarity.test(response),
    callback: RULES.callback.test(response),
    respectfulDecline: RULES.respectfulDecline.test(response),
    acknowledgeOptOut: RULES.acknowledgeOptOut.test(response),
    credentialRequest: RULES.credentialRequest.test(response),
    falsePromise: RULES.falsePromise.test(response),
    pressure: RULES.pressure.test(response),
  };
  const criticalBreaches = [];
  if (flags.credentialRequest) criticalBreaches.push('credential_solicitation');
  if (flags.falsePromise) criticalBreaches.push('unverified_campaign_claim');
  if (flags.pressure) criticalBreaches.push('coercive_outbound_pressure');
  if (conversation?.preference === 'opt_out' && !flags.acknowledgeOptOut) criticalBreaches.push('continued_contact_after_opt_out');
  let points = 0;
  if (flags.identity && flags.purpose) points += 1.5;
  if (flags.permission) points += 1.5;
  if (flags.empathy || flags.respectfulDecline) points += 0.75;
  if (flags.probe) points += 0.75;
  if (flags.clarity) points += 1;
  const recommendations = [];
  if (!flags.identity) recommendations.push('Identify yourself and the organisation accurately before discussing the campaign.');
  if (!flags.purpose) recommendations.push('Explain the specific reason for this contact in plain language.');
  if (!flags.permission) recommendations.push('Ask whether it is a convenient time and accept the answer.');
  if (!flags.empathy && conversation?.preference !== 'open') recommendations.push('Acknowledge the customer preference without pressure.');
  if (flags.credentialRequest) recommendations.unshift('Never ask for PINs, passwords, OTPs or full payment-card details.');
  if (flags.falsePromise) recommendations.unshift('Do not promise outcomes, approval, savings or benefits that are not verified.');
  if (flags.pressure) recommendations.unshift('Stop coercive language and respect the customer decision.');
  return { ...flags, criticalBreaches, points, recommendations };
}
function customerReply(conversation, evaluation) {
  if (conversation.preference === 'busy') return 'I cannot discuss this properly right now. Please suggest a time when you can call back, and I will decide whether I am available.';
  if (conversation.preference === 'callback') return 'I appreciate the follow-up. I cannot continue now. Please record a callback at a time I agree to; do not keep retrying before then.';
  if (conversation.preference === 'declined') return 'Thank you. I am not interested. Please record that decision and do not continue with the offer.';
  if (conversation.turn === 1) {
    if (evaluation.identity && evaluation.purpose && evaluation.permission) return 'Thank you for explaining. I can speak briefly. Please tell me the relevant details and any conditions I should understand.';
    return 'I still do not know clearly who you represent or why you are calling. Please explain before asking me anything else.';
  }
  if (conversation.turn === 2) {
    if (evaluation.clarity && !evaluation.falsePromise && !evaluation.pressure) return 'That explanation is clearer. Are there any conditions, costs or follow-up actions I should consider before deciding?';
    return 'I need a clearer explanation of the actual terms. Please do not assume that I have agreed to anything.';
  }
  return 'Thank you. I have enough information to make my decision. Please record the outcome accurately.';
}
export function submitOutboundTurn(conversation, text, now = Date.now()) {
  if (!conversation || conversation.type !== 'outbound_campaign_conversation' || conversation.status !== 'active') {
    throw new Error('This outbound campaign conversation is not active.');
  }
  const response = safeText(text);
  const evaluation = evaluateOutboundResponse(response, conversation);
  const at = new Date(now).toISOString();
  conversation.turn += 1;
  conversation.messages.push({ id: `${conversation.id}-a${conversation.turn}`, speaker: 'agent', text: response, at });
  conversation.scorecards.push({ ...evaluation, at, turn: conversation.turn });
  conversation.patience = Math.max(0, Math.min(100, conversation.patience + (evaluation.criticalBreaches.length ? -35 : evaluation.empathy ? 8 : -5)));
  conversation.criticalBreaches.push(...evaluation.criticalBreaches.filter(item => !conversation.criticalBreaches.includes(item)));
  if (evaluation.criticalBreaches.length) {
    conversation.status = 'escalated';
    conversation.dispositionHint = 'review';
    conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: 'I am uncomfortable continuing. Stop the campaign discussion and refer this interaction for supervisor and compliance review.', at });
  } else if (conversation.preference === 'opt_out') {
    conversation.suppressionRequested = true;
    conversation.status = 'ready_for_wrap_up';
    conversation.dispositionHint = 'opt_out';
    conversation.completedAt = at;
    conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: 'Thank you for confirming that my preference will be respected. Please record the suppression.', at });
  } else if (conversation.preference === 'busy' || conversation.preference === 'callback') {
    if (evaluation.callback || evaluation.permission || evaluation.empathy) {
      conversation.callbackRequested = true;
      conversation.status = 'ready_for_wrap_up';
      conversation.dispositionHint = 'callback';
      conversation.completedAt = at;
      conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: 'Please record the callback request. I have not agreed to any further campaign conversation today.', at });
    } else {
      conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: customerReply(conversation, evaluation), at });
      if (conversation.turn >= 2) {
        conversation.status = 'ready_for_wrap_up';
        conversation.dispositionHint = 'callback';
        conversation.callbackRequested = true;
        conversation.completedAt = at;
      }
    }
  } else if (conversation.preference === 'declined') {
    if (evaluation.respectfulDecline || evaluation.empathy) {
      conversation.status = 'ready_for_wrap_up';
      conversation.dispositionHint = 'declined';
      conversation.completedAt = at;
    }
    conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: customerReply(conversation, evaluation), at });
  } else {
    if (!conversation.permissionToContinue && evaluation.identity && evaluation.purpose && evaluation.permission) {
      conversation.permissionToContinue = true;
    }
    if (conversation.turn >= 2 && !conversation.permissionToContinue) {
      conversation.patience = Math.max(0, conversation.patience - 14);
    }
    const hasAccurateNextStep = evaluation.clarity && !evaluation.falsePromise && !evaluation.pressure;
    const hasClearTerms = evaluation.probe || evaluation.clarity;
    const asksForOfferDecision = conversation.campaignId === 'product-offer' && /\b(would you like to proceed|may i proceed|would you like to accept|would you like to sign up|would you like to activate|shall i continue)\b/i.test(response);
    if (conversation.permissionToContinue && conversation.turn >= 3 && hasAccurateNextStep && hasClearTerms && asksForOfferDecision) {
      conversation.customerDecision = 'accepted';
      conversation.status = 'ready_for_wrap_up';
      conversation.dispositionHint = 'completed';
      conversation.completedAt = at;
      conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: 'Yes, I would like to proceed. Please explain the approved next steps and any final conditions.', at });
    } else {
      if (conversation.permissionToContinue && conversation.turn >= 3 && hasAccurateNextStep && hasClearTerms) {
        conversation.status = 'ready_for_wrap_up';
        conversation.dispositionHint = 'completed';
        conversation.completedAt = at;
      } else if (conversation.turn >= 4 || conversation.patience <= 0) {
        conversation.status = 'ready_for_wrap_up';
        conversation.dispositionHint = conversation.permissionToContinue ? 'review' : 'declined';
        conversation.completedAt = at;
      }
      conversation.messages.push({ id: `${conversation.id}-c${conversation.turn}`, speaker: 'customer', text: customerReply(conversation, evaluation), at });
    }
  }
  const averageScore = Math.round(conversation.scorecards.reduce((sum, item) => sum + item.points * (100 / 6), 0) / conversation.scorecards.length);
  return {
    evaluation,
    points: evaluation.points,
    averageScore,
    status: conversation.status,
    disposition: conversation.dispositionHint,
    callbackRequested: conversation.callbackRequested,
    suppressionRequested: conversation.suppressionRequested,
    criticalBreaches: [...conversation.criticalBreaches],
    recommendations: [...evaluation.recommendations],
  };
}
export function outboundConversationSummary(conversation) {
  if (!conversation || conversation.type !== 'outbound_campaign_conversation') throw new TypeError('An outbound campaign conversation is required.');
  const turns = Array.isArray(conversation.scorecards) ? conversation.scorecards : [];
  return {
    turns: turns.length,
    averageScore: turns.length ? Math.round(turns.reduce((sum, item) => sum + item.points * (100 / 6), 0) / turns.length) : null,
    status: conversation.status,
    preference: conversation.preference,
    permissionToContinue: !!conversation.permissionToContinue,
    callbackRequested: !!conversation.callbackRequested,
    suppressionRequested: !!conversation.suppressionRequested,
    criticalBreaches: [...(conversation.criticalBreaches || [])],
  };
}
