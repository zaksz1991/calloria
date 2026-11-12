(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaCustomerDynamics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '6.4.0';
  const PROFILES = {
    concerned: { archetype: 'Concerned customer', openingMood: 'Concerned', rapport: 44, patience: 62, trust: 48, needs: 'Clear evidence, realistic expectations and a named next step.' },
    frustrated: { archetype: 'Frustrated customer', openingMood: 'Frustrated', rapport: 32, patience: 42, trust: 38, needs: 'Acknowledgement, ownership and visible progress.' },
    impatient: { archetype: 'Time-pressured customer', openingMood: 'Impatient', rapport: 38, patience: 34, trust: 42, needs: 'Concise questions, efficient checks and a clear time expectation.' },
    upset: { archetype: 'Complaint-driven customer', openingMood: 'Upset', rapport: 28, patience: 36, trust: 30, needs: 'Recognition of the previous failure, continuity and accountability.' },
    positive: { archetype: 'Appreciative customer', openingMood: 'Positive', rapport: 72, patience: 82, trust: 68, needs: 'A helpful answer and a simple way to provide feedback.' },
    formal: { archetype: 'Detail-focused customer', openingMood: 'Formal', rapport: 55, patience: 70, trust: 58, needs: 'Accurate information, clear process steps and written confirmation.' },
    curious: { archetype: 'Exploratory customer', openingMood: 'Curious', rapport: 58, patience: 76, trust: 54, needs: 'A guided explanation and time to clarify the options.' },
    neutral: { archetype: 'Information-seeking customer', openingMood: 'Neutral', rapport: 50, patience: 64, trust: 50, needs: 'Relevant answers without unnecessary steps.' }
  };

  function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
  function clean(value, max = 240) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function profileKey(tone) {
    const value = String(tone || '').toLowerCase();
    if (value.includes('frustrat')) return 'frustrated';
    if (value.includes('impatient')) return 'impatient';
    if (value.includes('upset') || value.includes('angry') || value.includes('complaint')) return 'upset';
    if (value.includes('concern') || value.includes('anxious') || value.includes('worried')) return 'concerned';
    if (value.includes('positive') || value.includes('appreciat')) return 'positive';
    if (value.includes('formal')) return 'formal';
    if (value.includes('curious')) return 'curious';
    return 'neutral';
  }
  function emotionFor(rapport, patience, breach) {
    if (breach || rapport < 20 || patience < 15) return 'Escalation risk';
    if (rapport >= 78 && patience >= 45) return 'Reassured';
    if (rapport >= 58) return 'Settling';
    if (rapport >= 38) return 'Concerned';
    return 'Frustrated';
  }
  function reactionFor(emotion, stageKey) {
    const stage = stageKey === 'resolve' ? 'the next step' : 'the checks';
    if (emotion === 'Reassured') return `I feel more confident now. I understand ${stage} and what will happen next.`;
    if (emotion === 'Settling') return `Thank you for explaining that. Please keep me updated on ${stage}.`;
    if (emotion === 'Concerned') return `I understand, but I am still concerned. Please make the next step clear.`;
    if (emotion === 'Escalation risk') return 'I am not comfortable with how this is going. I need a clear owner or a supervisor to review it.';
    return 'I am still frustrated. Please show me what will change and when I will hear back.';
  }
  function coachingFor(emotion, needs) {
    if (emotion === 'Escalation risk') return 'Pause, acknowledge the impact, avoid defensiveness and seek floor-supervisor support.';
    if (emotion === 'Frustrated') return 'Acknowledge the customer impact before asking another diagnostic question.';
    if (emotion === 'Concerned') return 'Explain what the evidence confirms, what remains unknown and the next update point.';
    if (emotion === 'Settling') return 'Maintain ownership and confirm the customer understands the agreed next step.';
    return needs || 'Confirm the customer’s intended outcome before proceeding.';
  }
  function begin(active, contact, at) {
    if (!active || typeof active !== 'object') throw new Error('An active interaction is required to start customer dynamics.');
    const key = profileKey(contact && contact.customerTone);
    const base = PROFILES[key];
    active.dynamics = {
      version: VERSION,
      profileKey: key,
      archetype: base.archetype,
      needs: base.needs,
      openingMood: base.openingMood,
      emotion: base.openingMood,
      rapport: base.rapport,
      patience: base.patience,
      trust: base.trust,
      decisions: 0,
      supervisorSuggested: false,
      finalAdjustmentApplied: false,
      lastReaction: 'Listen to the customer’s opening message and confirm the outcome they need.',
      coachingCue: coachingFor(base.openingMood, base.needs),
      history: [],
      startedAt: at instanceof Date ? at.toISOString() : new Date(at || Date.now()).toISOString()
    };
    return active.dynamics;
  }
  function ensure(active, contact) {
    if (!active) return null;
    if (!active.dynamics || active.dynamics.version !== VERSION) begin(active, contact, new Date());
    const d = active.dynamics;
    d.history = Array.isArray(d.history) ? d.history : [];
    d.rapport = clamp(d.rapport, 0, 100);
    d.patience = clamp(d.patience, 0, 100);
    d.trust = clamp(d.trust, 0, 100);
    return d;
  }
  function snapshot(active, contact) {
    const d = ensure(active, contact);
    if (!d) return null;
    return {
      archetype: d.archetype,
      needs: d.needs,
      openingMood: d.openingMood,
      emotion: d.emotion,
      rapport: d.rapport,
      patience: d.patience,
      trust: d.trust,
      decisions: d.decisions,
      supervisorSuggested: d.supervisorSuggested,
      lastReaction: d.lastReaction,
      coachingCue: d.coachingCue,
      history: d.history.slice()
    };
  }
  function applyDecision(active, result, customerReply, contact, at) {
    const d = ensure(active, contact);
    if (!d || !result) throw new Error('The customer interaction state is incomplete.');
    const rawScore = clamp(result.score, 0, 100);
    const priorEmotion = d.emotion;
    let rapportChange = rawScore >= 90 ? 11 : rawScore >= 75 ? 6 : rawScore >= 50 ? -5 : -14;
    let patienceChange = rawScore >= 90 ? 5 : rawScore >= 75 ? 2 : rawScore >= 50 ? -6 : -15;
    let trustChange = rawScore >= 90 ? 8 : rawScore >= 75 ? 4 : rawScore >= 50 ? -4 : -14;
    if (result.complianceBreach) {
      rapportChange = -32;
      patienceChange = -28;
      trustChange = -35;
    }
    d.rapport = clamp(d.rapport + rapportChange, 0, 100);
    d.patience = clamp(d.patience + patienceChange, 0, 100);
    d.trust = clamp(d.trust + trustChange, 0, 100);
    d.decisions += 1;
    d.emotion = emotionFor(d.rapport, d.patience, !!result.complianceBreach);
    const experienceDelta = result.complianceBreach ? -12 : d.emotion === 'Reassured' ? 4 : d.emotion === 'Settling' ? 2 : d.emotion === 'Escalation risk' ? -8 : d.emotion === 'Frustrated' ? -5 : 0;
    result.baseCustomerScore = rawScore;
    result.customerExperienceDelta = experienceDelta;
    result.score = result.complianceBreach ? 0 : clamp(rawScore + experienceDelta, 0, 100);
    d.lastReaction = reactionFor(d.emotion, result.stage);
    d.coachingCue = coachingFor(d.emotion, d.needs);
    d.history.push({
      decision: d.decisions,
      stage: clean(result.stage, 40),
      baseScore: rawScore,
      customerExperienceDelta: experienceDelta,
      rapport: d.rapport,
      patience: d.patience,
      trust: d.trust,
      fromEmotion: priorEmotion,
      toEmotion: d.emotion,
      at: at instanceof Date ? at.toISOString() : new Date(at || Date.now()).toISOString()
    });
    d.history = d.history.slice(-3);
    if (customerReply && typeof customerReply.body === 'string') {
      customerReply.body = `${customerReply.body} ${d.lastReaction}`.slice(0, 1800);
    }
    return snapshot(active, contact);
  }
  function requestSupervisor(active, reason, contact) {
    const d = ensure(active, contact);
    if (!d) throw new Error('There is no active customer interaction.');
    if (d.supervisorSuggested) throw new Error('Supervisor assistance has already been recorded for this interaction.');
    const why = clean(reason, 240);
    if (why.length < 8) throw new Error('Provide a clear reason for supervisor assistance.');
    d.supervisorSuggested = true;
    d.supervisorReason = why;
    d.lastReaction = 'The customer has been told that floor-supervisor support is being requested. Do not promise a response time that has not been confirmed.';
    d.coachingCue = 'Keep the customer informed, document the reason and maintain ownership until the handover is accepted.';
    d.rapport = clamp(d.rapport + 3, 0, 100);
    return snapshot(active, contact);
  }
  function applyFinalAdjustment(active) {
    const d = active && active.dynamics;
    if (!d || d.finalAdjustmentApplied || !Array.isArray(active.stageResults) || !active.stageResults.length) return 0;
    const delta = d.rapport >= 82 ? 7 : d.rapport >= 68 ? 4 : d.rapport < 22 ? -9 : d.rapport < 38 ? -5 : 0;
    const last = active.stageResults[active.stageResults.length - 1];
    if (last && !last.complianceBreach) last.score = clamp(Number(last.score) + delta, 0, 100);
    d.finalAdjustmentApplied = true;
    d.finalScoreAdjustment = delta;
    return delta;
  }
  function attachOutcome(record, activeSnapshot) {
    if (!record || !activeSnapshot) return record;
    record.customerExperience = {
      profile: activeSnapshot.archetype,
      openingMood: activeSnapshot.openingMood,
      finalMood: activeSnapshot.emotion,
      rapport: activeSnapshot.rapport,
      patience: activeSnapshot.patience,
      trust: activeSnapshot.trust,
      supervisorAssistanceRequested: !!activeSnapshot.supervisorSuggested,
      history: activeSnapshot.history
    };
    return record;
  }
  function install(engine) {
    if (!engine || engine.__customerDynamicsV64) return false;
    const originalBegin = engine.beginContact;
    const originalChoose = engine.chooseResponse;
    const originalFinish = engine.finishContact;
    if (![originalBegin, originalChoose, originalFinish].every((fn) => typeof fn === 'function')) return false;

    engine.beginContact = function (state, agentState, agentEngine, contactId, at) {
      const contact = originalBegin.apply(this, arguments);
      begin(state.active, contact, at);
      return contact;
    };
    engine.chooseResponse = function (state, agentState, agentEngine, optionId, at) {
      const outcome = originalChoose.apply(this, arguments);
      const contact = agentEngine && typeof agentEngine.getActiveContact === 'function' ? agentEngine.getActiveContact(agentState) : null;
      const dynamics = applyDecision(state.active, outcome.result, outcome.customerReply, contact, at);
      outcome.customerDynamics = dynamics;
      if (typeof engine.log === 'function') engine.log(state, `Customer response: ${dynamics.emotion.toLowerCase()} · rapport ${dynamics.rapport}/100.`, at);
      return outcome;
    };
    engine.finishContact = function (state, agentState, agentEngine, customerEngine, storage, input, at) {
      const dynamicsBeforeClose = snapshot(state.active, agentEngine && agentEngine.getActiveContact ? agentEngine.getActiveContact(agentState) : null);
      applyFinalAdjustment(state.active);
      const outcome = originalFinish.apply(this, arguments);
      attachOutcome(outcome && outcome.record, dynamicsBeforeClose);
      outcome.customerExperience = dynamicsBeforeClose;
      if (typeof engine.log === 'function' && dynamicsBeforeClose) engine.log(state, `Customer outcome recorded: ${dynamicsBeforeClose.emotion.toLowerCase()} · rapport ${dynamicsBeforeClose.rapport}/100.`, at);
      return outcome;
    };
    engine.__customerDynamicsV64 = true;
    return true;
  }

  return { VERSION, PROFILES, clamp, clean, profileKey, begin, ensure, snapshot, applyDecision, requestSupervisor, applyFinalAdjustment, attachOutcome, install };
});
