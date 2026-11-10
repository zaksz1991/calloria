function calloriaCreateOJTProfile() {
  return {
    version: 1,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    industryPack: ({ banking: 'banking', technical: 'technology', service: 'general-customer-experience', sales: 'general-customer-experience' })[state?.selectedTrack] || 'general-customer-experience',
    progress: { knowledge: false, logging: false, shadowing: false, supervised: false },
    shadowingStep: 0,
    shadowingSession: null,
    supervisedSession: null,
    evidence: {}
  };
}
function calloriaEnsureOJTProfile() {
  if (!state?.hired) return;
  if (state.onboarding && state.onboarding.status === 'certified') return;
  if (!state.onboarding) {
    const hasPriorWork = Number(state.callsHandled || 0) > 0 || Number(state.outboundCalls || 0) > 0 ||
      (Array.isArray(state.shiftHistory) && state.shiftHistory.length > 0) ||
      (Boolean(state.shiftActive) && Boolean(state.shiftRecord));
    if (hasPriorWork) {
      state.onboarding = { ...calloriaCreateOJTProfile(), status: 'certified', completedAt: new Date().toISOString(), grandfathered: true };
    } else {
      state.onboarding = calloriaCreateOJTProfile();
    }
    saveState();
  }
  if (!state.onboarding.progress) state.onboarding.progress = { knowledge: false, logging: false, shadowing: false, supervised: false };
  for (const key of ['knowledge','logging','shadowing','supervised']) {
    if (typeof state.onboarding.progress[key] !== 'boolean') state.onboarding.progress[key] = false;
  }
}
function calloriaOJTRequired() {
  return Boolean(state?.hired && (!state.onboarding || state.onboarding.status !== 'certified'));
}
function calloriaOJTIndustryLabel(value) {
  const names = {
    'general-customer-experience': 'General customer experience', banking: 'Banking & financial services',
    telecoms: 'Telecommunications', retail: 'Retail & e-commerce', utilities: 'Utilities & energy',
    logistics: 'Logistics & delivery', travel: 'Travel & hospitality', insurance: 'Insurance',
    healthcare: 'Healthcare administration (non-clinical)', technology: 'Technology & SaaS support',
    public: 'Public-service information'
  };
  return names[value] || names['general-customer-experience'];
}
function calloriaOJTTrackLabel() {
  return ({service:'General customer experience & service', banking:'Banking & financial services', technical:'Technical support & helpdesk', sales:'Sales, retention & customer engagement'})[state.selectedTrack] || 'General customer experience & service';
}

function calloriaEnsureOJTShadowingSession(onboarding) {
  if (!onboarding.shadowingSession || onboarding.shadowingSession.version !== 1) {
    const previouslyCompleted = onboarding.progress?.shadowing === true;
    onboarding.shadowingSession = {
      version: 1,
      step: previouslyCompleted ? 'complete' : 'queue',
      acceptedAt: null,
      greetingObservedAt: null,
      crmRecord: null,
      knowledgeDecision: null,
      wrapUp: null,
      events: []
    };
  }
  return onboarding.shadowingSession;
}
function calloriaOJTShadowingTransition(current, event) {
  const session = {
    version: 1,
    step: String(current?.step || 'queue'),
    acceptedAt: current?.acceptedAt || null,
    greetingObservedAt: current?.greetingObservedAt || null,
    crmRecord: current?.crmRecord ? { ...current.crmRecord } : null,
    knowledgeDecision: current?.knowledgeDecision ? { ...current.knowledgeDecision } : null,
    wrapUp: current?.wrapUp ? { ...current.wrapUp } : null,
    completedAt: current?.completedAt || null,
    events: Array.isArray(current?.events) ? [...current.events] : []
  };
  const fail = (message) => ({ ok: false, message, session: current });
  const record = (type, evidence = {}) => session.events.push({ type, at: new Date().toISOString(), ...evidence });
  if (!event || typeof event !== 'object') return fail('A shadowing action is required.');

  if (session.step === 'queue' && event.type === 'accept-contact') {
    session.acceptedAt = new Date().toISOString();
    session.step = 'greeting';
    record('contact-accepted', { queue: 'general-customer-experience', customer: 'Amina Yusuf', reference: 'TRN-24018' });
    return { ok: true, message: 'Contact accepted. Observe how the experienced agent opens the conversation.', session };
  }
  if (session.step === 'greeting' && event.type === 'observe-greeting') {
    session.greetingObservedAt = new Date().toISOString();
    session.step = 'crm';
    record('greeting-and-listening-observed', { skills: ['approved-greeting', 'preferred-name', 'active-listening', 'contact-reason'] });
    return { ok: true, message: 'Greeting and call-picking sequence observed. Continue to the CRM record.', session };
  }
  if (session.step === 'crm' && event.type === 'save-crm') {
    const contactReason = String(event.contactReason || '').trim();
    const actionTaken = String(event.actionTaken || '').trim();
    const nextStep = String(event.nextStep || '').trim();
    if (contactReason.length < 15 || actionTaken.length < 15 || nextStep.length < 12) {
      return fail('The CRM training record needs a factual contact reason, investigation/action and next step.');
    }
    session.crmRecord = { contactReason, actionTaken, nextStep, recordType: 'training-only', savedAt: new Date().toISOString() };
    session.step = 'knowledge';
    record('crm-training-record-saved', { recordType: 'training-only' });
    return { ok: true, message: 'Training CRM record saved. The experienced agent now checks the approved knowledge base.', session };
  }
  if (session.step === 'knowledge' && event.type === 'check-knowledge') {
    if (event.articleReviewed !== true) return fail('Open and review the approved procedure before deciding the next action.');
    const route = String(event.route || '');
    if (!['case-required', 'resolved-after-checks', 'specialist-referral'].includes(route)) {
      return fail('Select the action supported by the customer record and approved procedure.');
    }
    session.knowledgeDecision = { articleReviewed: true, route, checkedAt: new Date().toISOString() };
    session.step = 'wrapup';
    record('approved-knowledge-article-reviewed', { route });
    return { ok: true, message: 'Knowledge check recorded. Observe the agent complete the interaction and disposition.', session };
  }
  if (session.step === 'wrapup' && event.type === 'complete-wrapup') {
    const disposition = String(event.disposition || '');
    const summary = String(event.summary || '').trim();
    const expected = {
      'case-required': 'case-created',
      'resolved-after-checks': 'resolved',
      'specialist-referral': 'referred'
    }[session.knowledgeDecision?.route];
    if (!expected || disposition !== expected) return fail('The disposition must match the action selected after the knowledge-base check.');
    if (summary.length < 20) return fail('Add a factual wrap-up note covering the action and the customer’s next step.');
    session.wrapUp = { disposition, summary, completedAt: new Date().toISOString() };
    session.step = 'complete';
    session.completedAt = session.wrapUp.completedAt;
    record('after-contact-work-completed', { disposition, recordType: 'training-only' });
    return { ok: true, message: 'The experienced agent has completed the contact, CRM record and disposition. Shadowing is complete.', session };
  }
  return fail('That action is not available at this stage of the shadowing session.');
}
function calloriaOJTShadowingPanel(scenario, onboarding) {
  const session = calloriaEnsureOJTShadowingSession(onboarding);
  const stages = ['queue', 'greeting', 'crm', 'knowledge', 'wrapup', 'complete'];
  const stage = stages.indexOf(session.step);
  const stepLabel = stage < 0 ? 'QUEUE' : session.step.toUpperCase();
  const progress = Math.max(0, Math.min(5, stage));
  const header = `<div class="panel-head"><div><span class="subtle-label">SENIOR AGENT DESK · LIVE SHADOW SIMULATION</span><h3>Follow one customer contact from queue to wrap-up</h3><p>Watch the experienced agent pick the call, greet the customer, record the interaction, consult approved guidance and complete the right disposition.</p></div><span class="pill blue">${progress} / 5</span></div>`;
  let content = '';
  if (session.step === 'queue') {
    content = `<div class="data-row"><span><strong>INBOUND QUEUE · OFFERED CONTACT</strong><small>General service queue · Amina Yusuf · ${escapeHTML(scenario.label)} · 00:18 waiting · Reference TRN-24018</small></span><span class="pill amber">OFFERED</span></div><p><strong>Customer:</strong> ${escapeHTML(scenario.opening)}</p><p class="muted-note">The experienced agent checks the queue offer, confirms the correct skill group and accepts the contact. A declined/ignored offer is not counted as a picked call.</p><button type="button" class="btn primary" data-calloria-shadowing-event="accept-contact">Observe agent accept / pick the call →</button>`;
  } else if (session.step === 'greeting') {
    content = `<div class="data-row"><span><strong>CONTACT CONNECTED · CUSTOMER CONTEXT OPEN</strong><small>Call timer started · Customer record loaded · Recording/consent notice follows organisation policy</small></span><span class="pill green">CONNECTED</span></div><div class="panel" style="background:var(--surface-soft,#f5f7f8);padding:12px;margin:10px 0"><strong>Customer</strong><p>${escapeHTML(scenario.opening)}</p><strong>Experienced agent</strong><p>“Good morning, you’re speaking with the Customer Experience team. My name is Daniel. May I confirm how you would like me to address you? I’ll listen carefully and check the service record before advising you.”</p></div><p class="muted-note">Observe the agent's approved greeting, preferred-name check, listening and contact-reason confirmation. The simulation does not use a real telephone line.</p><button type="button" class="btn primary" data-calloria-shadowing-event="observe-greeting">I observed the greeting and call-picking procedure →</button>`;
  } else if (session.step === 'crm') {
    content = `<div class="data-row"><span><strong>CRM · CUSTOMER 360 · INTERACTION LOG</strong><small>Training customer Amina Yusuf · TRN-24018 · Previous contact found</small></span><span class="pill blue">CRM PRACTICE</span></div><p><strong>Customer follow-up:</strong> “I already contacted you about this. Please make sure the next person can see what happened.”</p><form class="form-stack" data-calloria-shadowing-form="crm"><label class="form-field">Contact reason<textarea name="contactReason" rows="2" minlength="15" required placeholder="What did the customer report and what outcome do they need?"></textarea></label><label class="form-field">Checks and action taken<textarea name="actionTaken" rows="2" minlength="15" required placeholder="What record and approved guidance did the agent check?"></textarea></label><label class="form-field">Next step / owner<textarea name="nextStep" rows="2" minlength="12" required placeholder="Who owns the next action and what happens next?"></textarea></label><button class="btn primary" type="submit">Save the observed CRM interaction →</button></form><p class="muted-note">Training-only record. It does not create a production customer case or affect agent KPIs.</p>`;
  } else if (session.step === 'knowledge') {
    content = `<div class="data-row"><span><strong>KNOWLEDGE BASE · APPROVED PROCEDURE</strong><small>${escapeHTML(scenario.record)} · Current published guidance</small></span><span class="pill blue">ARTICLE OPEN</span></div><div class="panel" style="background:var(--surface-soft,#f5f7f8);padding:12px;margin:10px 0"><strong>Procedure summary</strong><ul class="muted-note"><li>Confirm the contact reason and relevant record before giving an answer.</li><li>Use only verified status and authorised actions.</li><li>When unresolved, create or update a case with an accountable owner and next-update expectation.</li><li>Never promise an outcome or deadline that the system has not confirmed.</li></ul></div><form class="form-stack" data-calloria-shadowing-form="knowledge"><label class="form-field"><input type="checkbox" name="articleReviewed" value="yes" required> I reviewed the current approved procedure with the experienced agent.</label><label class="form-field">What does the verified record support?<select name="route" required><option value="">Select the action</option><option value="case-required">Issue remains open — create/update a case and assign an owner</option><option value="resolved-after-checks">Checks confirm the issue is resolved — explain the verified result</option><option value="specialist-referral">Needs specialist authority — refer with complete notes</option></select></label><button class="btn primary" type="submit">Record the knowledge-base decision →</button></form>`;
  } else if (session.step === 'wrapup') {
    const selected = session.knowledgeDecision?.route || '';
    const disposition = selected === 'case-required' ? 'case-created' : selected === 'resolved-after-checks' ? 'resolved' : 'referred';
    const dispositionLabel = disposition === 'case-created' ? 'Case created / follow-up owner assigned' : disposition === 'resolved' ? 'Resolved after verified checks' : 'Specialist referral completed';
    content = `<div class="data-row"><span><strong>AFTER-CONTACT WORK · DISPOSITION</strong><small>Customer: ${escapeHTML(scenario.followup)}</small></span><span class="pill amber">WRAP-UP</span></div><p class="muted-note">The experienced agent summarises the result, confirms the next step with the customer and completes the disposition that matches the knowledge-base decision.</p><form class="form-stack" data-calloria-shadowing-form="wrapup"><label class="form-field">Required disposition<input name="dispositionLabel" value="${escapeHTML(dispositionLabel)}" readonly><input type="hidden" name="disposition" value="${escapeHTML(disposition)}"></label><label class="form-field">Interaction summary<textarea name="summary" rows="3" minlength="20" required placeholder="Record the verified action, owner and customer next step…"></textarea></label><button class="btn primary" type="submit">Complete the observed wrap-up →</button></form>`;
  } else {
    content = `<div class="pill green">SHADOWING COMPLETED</div><p>The queue offer was accepted, greeting observed, CRM record saved, approved knowledge checked and wrap-up disposition completed.</p><p class="muted-note">This is a training observation only. It has not increased production calls handled, AHT, CSAT, QA or salary.</p>`;
  }
  return `<section class="panel"><div>${header}</div><div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 12px">${['QUEUE','GREETING','CRM','KNOWLEDGE','WRAP-UP'].map((label,index)=>`<span class="pill ${index<progress?'green':index===progress?'blue':''}">${index+1}. ${label}</span>`).join('')}</div><div style="background:var(--surface-2,#f5f7f9);margin-top:10px;border:1px solid var(--line,#dce3e8);border-radius:10px;padding:12px"><div class="subtle-label">CURRENT DESK VIEW · ${stepLabel}</div>${content}</div><p class="muted-note">Training simulation · Synthetic customer reference · No real customer call, external telephone or production KPI is affected.</p></section>`;
}

function calloriaSupervisedPracticeScenario(industryPack) {
  const scenarios = {
    'general-customer-experience': { title:'Uncompleted service request', customer:'I contacted your team previously about a service request. It is still not completed, and I do not know who is handling it.', record:'Service request SR-4821 is open. The last contact is recorded, but no completion event or owner update is present.' },
    banking: { title:'Transaction status enquiry', customer:'I reported a transfer issue earlier. I still need a clear update and do not want to repeat the whole story.', record:'The synthetic transaction trace remains pending review. No confirmed completion or reversal is recorded.' },
    telecoms: { title:'Mobile service interruption', customer:'My data service is still not working after I contacted support. I need someone to take ownership of this.', record:'The synthetic service record shows an open connectivity incident. No network restoration event is recorded.' },
    retail: { title:'Delayed order', customer:'My order has not arrived, even though I contacted the team before. Please check what is happening.', record:'The synthetic order is marked delayed. No proof of delivery or completed refund is recorded.' },
    utilities: { title:'Billing investigation', customer:'I queried a charge on my bill, but I still have no proper explanation. Can you check the case?', record:'The synthetic billing query remains open. A review is pending and no adjustment has been authorised.' },
    logistics: { title:'Shipment exception', customer:'My shipment tracking has not moved. I contacted you already and I need to know who is investigating it.', record:'The synthetic shipment has an unresolved tracking exception. No delivery scan or authorised claim outcome is recorded.' },
    travel: { title:'Booking service request', customer:'I asked about changing my booking and still have no confirmed options. Please check before advising me.', record:'The synthetic booking-change request is open. Supplier conditions have not yet been confirmed.' },
    insurance: { title:'Claim status enquiry', customer:'I submitted a claim and contacted you before. I still need to know what happens next.', record:'The synthetic claim is awaiting authorised review. No approval or rejection decision is recorded.' },
    healthcare: { title:'Appointment administration', customer:'I asked about an appointment and have not received a confirmation. Can you check the request?', record:'The synthetic appointment request is open. No confirmed appointment slot is recorded; clinical advice is outside this desk.' },
    technology: { title:'Technical incident follow-up', customer:'I reported an access problem and it is still happening. I need to know who is working on it.', record:'The synthetic access incident remains open. The last diagnostic attempt did not confirm resolution.' },
    public: { title:'Application status enquiry', customer:'I submitted an application and still do not know its status. I have already contacted the helpdesk once.', record:'The synthetic application enquiry is awaiting review by the authorised service team. No statutory decision is recorded.' }
  };
  return scenarios[industryPack] || scenarios['general-customer-experience'];
}
function calloriaEnsureSupervisedPracticeSession(onboarding) {
  if (!onboarding.supervisedSession || onboarding.supervisedSession.version !== 1) {
    if (onboarding.progress?.supervised === true) {
      onboarding.supervisedSession = {
        version: 1, stage: 'complete', completedAt: onboarding.evidence?.supervised?.completedAt || null,
        score: null, legacyCompleted: true, transcript: [], rubric: {}, events: [], feedback: 'Previously completed supervised practice retained.'
      };
    } else {
      const scenario = calloriaSupervisedPracticeScenario(onboarding.industryPack || 'general-customer-experience');
      onboarding.supervisedSession = {
        version: 1, stage: 'opening', startedAt: new Date().toISOString(), completedAt: null,
        score: 0, rubric: {}, transcript: [{ speaker: 'customer', text: scenario.customer, at: new Date().toISOString() }],
        events: [], attempts: { opening: 0, investigation: 0, nextStep: 0, wrapup: 0 }, feedback: ''
      };
    }
  }
  if (!Array.isArray(onboarding.supervisedSession.transcript)) onboarding.supervisedSession.transcript = [];
  if (!Array.isArray(onboarding.supervisedSession.events)) onboarding.supervisedSession.events = [];
  if (!onboarding.supervisedSession.attempts) onboarding.supervisedSession.attempts = { opening: 0, investigation: 0, nextStep: 0, wrapup: 0 };
  return onboarding.supervisedSession;
}
function calloriaSupervisedPracticeTransition(current, event, industryPack = 'general-customer-experience') {
  const session = {
    version: 1, stage: String(current?.stage || 'opening'), startedAt: current?.startedAt || new Date().toISOString(),
    completedAt: current?.completedAt || null, score: Number(current?.score || 0),
    rubric: { ...(current?.rubric || {}) },
    transcript: Array.isArray(current?.transcript) ? current.transcript.map(item => ({ ...item })) : [],
    events: Array.isArray(current?.events) ? [...current.events] : [],
    attempts: { opening: 0, investigation: 0, nextStep: 0, wrapup: 0, ...(current?.attempts || {}) },
    feedback: String(current?.feedback || ''), evidence: current?.evidence ? { ...current.evidence } : null
  };
  const scenario = calloriaSupervisedPracticeScenario(industryPack);
  const stamp = () => new Date().toISOString();
  const add = (speaker, text) => session.transcript.push({ speaker, text: String(text), at: stamp() });
  const record = (type, evidence = {}) => session.events.push({ type, at: stamp(), ...evidence });
  const review = (stage, message) => {
    session.attempts[stage] = Number(session.attempts[stage] || 0) + 1;
    session.feedback = message;
    record('trainer-coaching', { stage, attempt: session.attempts[stage], message });
    return { ok: true, advanced: false, message, session };
  };
  const fail = message => ({ ok: false, advanced: false, message, session: current });
  if (!event || typeof event !== 'object') return fail('A supervised practice action is required.');
  if (session.stage === 'complete') return fail('This supervised practice session is already complete.');

  if (session.stage === 'opening' && event.type === 'opening-response') {
    const response = String(event.response || '').trim();
    if (response.length < 35) return review('opening', 'Your response needs a complete greeting and acknowledgement. Introduce yourself, recognise the inconvenience and take ownership of checking the issue.');
    const unsafe = /\b(send|share|tell|provide|read out|give me|confirm)\b.{0,35}\b(pin|password|otp|one.?time passcode|cvv|security code)\b/i.test(response);
    if (unsafe) return review('opening', 'Stop. Never request a PIN, password, OTP or full security code. Use only the organisation-approved identity checks.');
    const unsupported = /\b(guarantee|promise you|definitely (?:be )?(?:fixed|resolved|completed)|will (?:be )?(?:fixed|resolved|completed) today)\b/i.test(response);
    if (unsupported) return review('opening', 'Do not guarantee an outcome before checking the service record. Acknowledge the concern and explain that you will investigate.');
    const empathy = /\b(understand|sorry|apolog|appreciate|frustrat|inconvenien|thank you|concern|upset)\b/i.test(response);
    const ownership = /\b(i will|i'll|let me|i can|we can|i am going to|i'm going to)\b/i.test(response);
    const investigation = /\b(check|review|look into|investigat|trace|confirm|verify)\b/i.test(response);
    if (!empathy || !ownership || !investigation) return review('opening', 'The customer needs to hear three things: acknowledgement, ownership and a clear explanation that you will check the relevant record. Revise your response.');
    add('agent', response);
    session.rubric.opening = { passed: true, points: 25, evidence: ['acknowledgement', 'ownership', 'investigation intent'] };
    session.score = 25; session.stage = 'investigation'; session.feedback = 'Good opening. The trainer confirms that you acknowledged the customer and took ownership.';
    add('customer', 'Thank you. I have already explained this once, so please check the previous interaction and make sure the team knows what has happened.');
    record('supervised-opening-passed', { points: 25 });
    return { ok: true, advanced: true, message: session.feedback, session };
  }

  if (session.stage === 'investigation' && event.type === 'investigation-review') {
    const reviewed = event.customerRecord === true && event.priorContact === true && event.knowledgeBase === true;
    const finding = String(event.finding || '').trim();
    if (!reviewed) return review('investigation', 'Review the customer/service record, the previous interaction and the current approved knowledge article before deciding what to do.');
    if (finding.length < 30) return review('investigation', 'Record a factual finding from the simulated screens. State what is confirmed and what is still unknown; do not guess.');
    const speculative = /\b(definitely (?:fixed|resolved)|completed successfully|refund approved|claim approved|delivered)\b/i.test(finding);
    if (speculative) return review('investigation', 'That outcome is not supported by the simulated record. The case is still open. Separate confirmed facts from assumptions.');
    session.rubric.investigation = { passed: true, points: 25, checks: ['customer-record', 'prior-interaction', 'approved-knowledge'], finding };
    session.score = 50; session.stage = 'nextStep'; session.feedback = 'Investigation complete. The record confirms that the request remains open and needs an accountable follow-up owner.';
    add('agent', `Investigation note: ${finding}`);
    add('customer', 'Please explain who will take responsibility and how I will receive the next update. I do not want to start again with another agent.');
    record('supervised-investigation-passed', { points: 25, checks: 3 });
    return { ok: true, advanced: true, message: session.feedback, session };
  }

  if (session.stage === 'nextStep' && event.type === 'explain-next-step') {
    const response = String(event.response || '').trim();
    if (response.length < 30) return review('nextStep', 'Explain the next step in complete language. The customer needs a clear owner and an update route.');
    const hasOwner = /\b(owner|team|assigned|responsible|case|specialist|service team)\b/i.test(response);
    const hasUpdate = /\b(update|contact|follow.?up|reference|call|message|notify)\b/i.test(response);
    const unsupported = /\b(guarantee|promise you|definitely|today for sure|tomorrow for sure|within \d+ minutes)\b/i.test(response);
    if (unsupported) return review('nextStep', 'Do not invent a resolution or deadline. Explain the owner and agreed update route without promising an unconfirmed time.');
    if (!hasOwner || !hasUpdate) return review('nextStep', 'Your explanation must identify who owns the next action and how the customer will receive an update.');
    session.rubric.nextStep = { passed: true, points: 25, evidence: ['accountable-owner', 'customer-update-route', 'no-unverified-guarantee'] };
    session.score = 75; session.stage = 'wrapup'; session.feedback = 'The customer has been given a safe next step. Complete the interaction record before closing.';
    add('agent', response);
    add('customer', 'That is clearer. Please give me the reference and make sure the notes show what I have already reported.');
    record('supervised-next-step-passed', { points: 25 });
    return { ok: true, advanced: true, message: session.feedback, session };
  }

  if (session.stage === 'wrapup' && event.type === 'complete-training-wrapup') {
    const reason = String(event.contactReason || '').trim();
    const action = String(event.actionTaken || '').trim();
    const owner = String(event.owner || '').trim();
    const next = String(event.nextStep || '').trim();
    if (reason.length < 20 || action.length < 20 || owner.length < 3 || next.length < 15) {
      return review('wrapup', 'The training CRM record is incomplete. Record the reason, checks/actions, named team or role responsible, and the customer’s next update route.');
    }
    const summary = { contactReason: reason, actionTaken: action, owner, nextStep: next, disposition: 'case-created', recordType: 'training-only', savedAt: stamp() };
    session.evidence = summary;
    session.rubric.wrapup = { passed: true, points: 25, evidence: ['factual-reason', 'action-recorded', 'owner-recorded', 'next-step-recorded', 'case-disposition'] };
    session.score = Object.values(session.rubric).reduce((total, item) => total + Number(item.points || 0), 0);
    session.stage = 'complete'; session.completedAt = stamp();
    session.feedback = 'Trainer review passed. You completed a customer conversation, checked records and approved guidance, explained a safe next step and saved the training case.';
    add('agent', `After-contact work completed. Training case created; owner: ${owner}.`);
    record('supervised-training-wrapup-completed', { points: 25, disposition: 'case-created', recordType: 'training-only' });
    return { ok: true, advanced: true, message: session.feedback, session };
  }
  return fail('That action is not available at this stage of supervised practice.');
}
function calloriaSupervisedPracticePanel(onboarding) {
  const session = calloriaEnsureSupervisedPracticeSession(onboarding);
  const scenario = calloriaSupervisedPracticeScenario(onboarding.industryPack || 'general-customer-experience');
  const labels = { opening: 'CUSTOMER OPENING', investigation: 'INVESTIGATE', nextStep: 'EXPLAIN THE NEXT STEP', wrapup: 'CRM & CASE WRAP-UP', complete: 'TRAINER REVIEW PASSED' };
  const order = ['opening', 'investigation', 'nextStep', 'wrapup', 'complete'];
  const index = Math.max(0, order.indexOf(session.stage));
  const transcript = session.transcript.map(item => `<div class="data-row" style="align-items:flex-start"><span><strong>${item.speaker === 'customer' ? 'CUSTOMER' : 'YOU · TRAINEE AGENT'}</strong><small>${escapeHTML(item.text)}</small></span><span class="pill ${item.speaker === 'customer' ? 'blue' : 'green'}">${item.speaker === 'customer' ? 'CUSTOMER' : 'AGENT'}</span></div>`).join('');
  let form = '';
  if (session.stage === 'opening') {
    form = `<form data-calloria-ojt-form="supervised" class="form-stack"><label class="form-field">Respond to the customer<textarea name="response" rows="4" minlength="35" maxlength="900" required placeholder="Acknowledge the previous contact, take ownership and explain what you will check…"></textarea></label><button class="btn primary" type="submit">Send response to the customer →</button></form>`;
  } else if (session.stage === 'investigation') {
    form = `<div class="panel" style="background:var(--surface-soft,#f5f7f8);padding:12px;margin:10px 0"><strong>SIMULATED CUSTOMER / SERVICE RECORD</strong><p>${escapeHTML(scenario.record)}</p><p class="muted-note">Training screens show an open request, a previous interaction and a current approved procedure. No external customer system is connected.</p></div><form data-calloria-ojt-form="supervised" class="form-stack"><label class="form-field"><input type="checkbox" name="customerRecord" value="yes" required> I reviewed the customer / service record.</label><label class="form-field"><input type="checkbox" name="priorContact" value="yes" required> I reviewed the previous interaction history.</label><label class="form-field"><input type="checkbox" name="knowledgeBase" value="yes" required> I checked the current approved knowledge article.</label><label class="form-field">Factual investigation finding<textarea name="finding" rows="3" minlength="30" required placeholder="What is confirmed, what remains open, and what is not yet known?"></textarea></label><button class="btn primary" type="submit">Save investigation and continue →</button></form>`;
  } else if (session.stage === 'nextStep') {
    form = `<form data-calloria-ojt-form="supervised" class="form-stack"><label class="form-field">Explain the next step to the customer<textarea name="response" rows="4" minlength="30" maxlength="900" required placeholder="Explain who owns the follow-up and how the customer will receive an update. Do not invent a deadline…"></textarea></label><button class="btn primary" type="submit">Send next-step explanation →</button></form>`;
  } else if (session.stage === 'wrapup') {
    form = `<form data-calloria-ojt-form="supervised" class="form-stack"><label class="form-field">Contact reason<textarea name="contactReason" rows="2" minlength="20" required placeholder="Factual reason for the customer’s contact…"></textarea></label><label class="form-field">Checks and action taken<textarea name="actionTaken" rows="2" minlength="20" required placeholder="Records and approved guidance checked; action taken…"></textarea></label><label class="form-field">Next-action owner<input name="owner" minlength="3" required placeholder="Responsible service team / case owner"></label><label class="form-field">Customer next step<textarea name="nextStep" rows="2" minlength="15" required placeholder="How the customer will receive the next update…"></textarea></label><label class="form-field">Disposition<input value="Case created · training-only" readonly></label><button class="btn primary" type="submit">Save training case and submit to trainer →</button></form>`;
  } else {
    form = `<div class="pill green">TRAINER REVIEW PASSED · ${session.score === null ? 'LEGACY COMPLETION' : `${session.score}/100`}</div><p>Your supervised interaction is complete. This evidence unlocks trainer sign-off when the other onboarding modules are complete.</p><ul class="muted-note">${Object.entries(session.rubric || {}).map(([key,value]) => `<li>${escapeHTML(key)}: ${Number(value.points || 0)} points</li>`).join('')}</ul>`;
  }
  const feedback = session.feedback ? `<div class="panel" style="border-left:4px solid var(--viz-accent,#0c9d8b);padding:10px;margin:10px 0" role="status"><strong>TRAINER FEEDBACK</strong><p>${escapeHTML(session.feedback)}</p></div>` : '';
  return `<div class="panel" style="background:var(--surface-2,#f5f7f9);padding:12px;margin-top:10px"><div class="panel-head"><div><span class="subtle-label">SUPERVISED CONTACT SIMULATION · ${escapeHTML(scenario.title.toUpperCase())}</span><h4>${labels[session.stage] || 'SUPERVISED PRACTICE'}</h4><p class="muted-note">Respond as the employee. The customer replies, the simulated records provide evidence, and the trainer gives coaching at each stage.</p></div><span class="pill ${session.stage === 'complete' ? 'green' : 'blue'}">${session.stage === 'complete' ? 'PASSED' : `${index + 1} / 4`}</span></div><div style="display:flex;gap:5px;flex-wrap:wrap;margin:8px 0 12px">${['OPENING','INVESTIGATE','NEXT STEP','WRAP-UP'].map((label, i) => `<span class="pill ${i < index || session.stage === 'complete' ? 'green' : i === index ? 'blue' : ''}">${i + 1}. ${label}</span>`).join('')}</div><div style="display:grid;gap:8px;margin:10px 0">${transcript}</div>${feedback}${form}<p class="muted-note">Training-only synthetic scenario. It does not place a real call, create a production case or update live calls handled, QA, CSAT, AHT, adherence, salary or incentives.</p></div>`;
}

function calloriaRenderOJT() {
  const o = state.onboarding;
  const p = o.progress;
  const steps = [
    ['knowledge','Product & service knowledge','Learn your organisation, sector, products, service boundaries and approved customer guidance.'],
    ['logging','Systems & interaction logging','Practise recording contact reasons, actions taken, outcomes and next steps in the simulated CRM.'],
    ['shadowing','Agent shadowing','Observe an experienced agent receive a contact, manage the conversation and document the work.'],
    ['supervised','Supervised practice','Handle a simulated customer issue with a trainer reviewing your response and disposition.']
  ];
  const done = steps.filter(([key]) => p[key]).length;
  const selectedIndustry = o.industryPack || 'general-customer-experience';
  const shadowScenarios = {
    'general-customer-experience': { label:'Service request follow-up', opening:'“I requested help yesterday, but I have not received an update. Can you check what is happening?”', followup:'“Who owns the next update, and when should I expect to hear back?”', record:'Customer service request · Previous contact · Follow-up owner' },
    banking: { label:'Unsuccessful transfer enquiry', opening:'“I transferred ₦150,000 yesterday, but the beneficiary has not received it. Can you investigate?”', followup:'“Please tell me the case reference and when I will receive an update.”', record:'Transfer trace · Transaction reference · Complaint case' },
    telecoms: { label:'Mobile service interruption', opening:'“My data bundle is active, but I cannot connect to the network. I need this checked.”', followup:'“What troubleshooting has been done, and who will update me if it remains unresolved?”', record:'Mobile service · Network checks · Technical escalation' },
    retail: { label:'Online order not received', opening:'“My order was due today, but it has not arrived. Can you check the delivery?”', followup:'“Please record this and tell me who is responsible for the next update.”', record:'Order history · Delivery status · Returns / case policy' },
    utilities: { label:'Unexpected bill enquiry', opening:'“My latest bill is much higher than usual. I need someone to explain the charges.”', followup:'“Please give me a reference and explain what happens if the reading is incorrect.”', record:'Customer account · Meter / billing record · Billing review' },
    logistics: { label:'Delayed shipment', opening:'“The tracking page has not changed since yesterday. Where is my package?”', followup:'“Who will investigate the delivery exception and contact me?”', record:'Shipment tracking · Scan history · Delivery exception case' },
    travel: { label:'Booking change request', opening:'“I need to change my travel date. Please check the booking conditions before telling me the options.”', followup:'“Please confirm the permitted options and any cost before making a change.”', record:'Booking record · Fare / supplier rules · Change request' },
    insurance: { label:'Claim status enquiry', opening:'“I submitted a claim and have not heard back. Can you check its current status?”', followup:'“Please explain the next review step without promising that the claim is approved.”', record:'Policy record · Claim status · Claims-team referral' },
    healthcare: { label:'Appointment administration', opening:'“I need to confirm whether my appointment request has been received.”', followup:'“Please tell me the administrative next step. I understand you cannot give clinical advice.”', record:'Appointment request · Administrative status · Authorised clinic route' },
    technology: { label:'Account access incident', opening:'“I cannot sign in to the service, and the usual password reset has not worked.”', followup:'“Please record the diagnostic steps and tell me which support team owns this next.”', record:'User account · Access diagnostics · Technical incident' },
    public: { label:'Public-service application enquiry', opening:'“I submitted an application and need to know whether it has been received and what happens next.”', followup:'“Please explain the official process and where the authorised review sits.”', record:'Application reference · Submission status · Authorised service route' }
  };
  const shadowScenario = shadowScenarios[selectedIndustry] || shadowScenarios['general-customer-experience'];
  calloriaEnsureOJTShadowingSession(o);
  const industryOptions = [
    ['general-customer-experience','General customer experience / multi-industry service'],['banking','Banking & financial services'],
    ['telecoms','Telecommunications'],['retail','Retail & e-commerce'],['utilities','Utilities & energy'],
    ['logistics','Logistics & delivery'],['travel','Travel & hospitality'],['insurance','Insurance'],
    ['healthcare','Healthcare administration (non-clinical)'],['technology','Technology & SaaS support'],['public','Public-service information']
  ];
  const industrySummary = {
    'general-customer-experience':'Customers may contact the organisation about a service, order, appointment, account or complaint. Confirm the actual organisation and use its approved information; do not assume every contact is a bank enquiry.',
    banking:'Use the bank-approved authentication and disclosure procedures. Never ask for a PIN, password or one-time passcode. Follow the bank’s approved transaction, card and complaint workflows.',
    telecoms:'Understand service plans, billing, SIM/network support and complaint ownership. Follow identity and SIM-swap controls defined by the operator.',
    retail:'Understand orders, payments, refunds, returns, stock and delivery rules. Confirm the order and apply the retailer’s authorised refund/returns policy.',
    utilities:'Understand service connections, billing, meter readings, outages and fault reporting. Do not promise restoration times unless confirmed by operations.',
    logistics:'Understand tracking, proof of delivery, missed deliveries, damaged items and claims. Verify shipment details and record evidence before routing a case.',
    travel:'Understand bookings, itinerary changes, cancellations and service disruption. Apply the actual fare, supplier and booking conditions.',
    insurance:'Understand policy servicing, claims intake and coverage boundaries. Never promise that a claim is covered or approved before authorised review.',
    healthcare:'Handle administrative enquiries only, protect personal information and route clinical questions to qualified personnel. Do not give medical advice.',
    technology:'Understand account access, product configuration, incident triage and troubleshooting. Record diagnostic steps and escalate outside your authority.',
    public:'Provide accurate public-service information, explain the correct process and route sensitive or statutory decisions to authorised officers.'
  };
  viewRoot.innerHTML = `
    <section class="panel" style="border-top:4px solid #0c9d8b">
      <div class="panel-head"><div><span class="subtle-label">EMPLOYEE ON-THE-JOB ONBOARDING · NOT RECRUITMENT</span><h2>Welcome to your first days at work, ${escapeHTML(state.applicantName || 'colleague')}.</h2><p>You have been hired. Before you receive your own operating desk, you will learn the products and services, practise system logging, shadow experienced agents and complete supervised customer work.</p></div><span class="pill amber">TRAINING BEFORE LIVE DESK</span></div>
      <div class="grid two" style="margin-top:12px;align-items:start">
        <div><div class="metric-label">YOUR CAREER TRACK</div><h3>${escapeHTML(calloriaOJTTrackLabel())}</h3><p class="muted-note">This is a multi-industry contact-centre career. Banking is one optional industry pack, not the default job.</p></div>
        <div><label class="form-field"><span class="metric-label">INDUSTRY / SERVICE PACK FOR YOUR TRAINING</span><select id="calloriaOJTIndustry">${industryOptions.map(([value,label])=>`<option value="${value}" ${selectedIndustry===value?'selected':''}>${label}</option>`).join('')}</select></label><p class="muted-note">Selected pack: ${escapeHTML(calloriaOJTIndustryLabel(selectedIndustry))}</p></div>
      </div>
      <div style="margin:14px 0 8px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><strong>Onboarding progress</strong><strong>${done} / 4 modules signed off</strong></div>
      <div style="height:9px;background:var(--line,#e5e7eb);border-radius:99px;overflow:hidden"><div style="height:100%;width:${done*25}%;background:#0c9d8b;border-radius:99px"></div></div>
      <div class="step-list" style="margin-top:14px">${steps.map(([key,title,desc],i)=>`<div class="step-row ${p[key]?'done':(!steps.slice(0,i).some(([prior])=>!p[prior])?'active':'')}" style="align-items:flex-start"><div class="step-number">${p[key]?'✓':String(i+1).padStart(2,'0')}</div><div class="step-copy"><strong>${title}</strong><small>${desc}</small></div><span class="step-state">${p[key]?'COMPLETE':'REQUIRED'}</span></div>`).join('')}</div>
    </section>
    <div class="grid two" style="margin-top:14px;align-items:start">
      <section class="panel"><div class="panel-head"><div><span class="subtle-label">MODULE 01</span><h3>Product & service knowledge</h3><p>Understand what the organisation provides and where your authority ends.</p></div><span class="pill ${p.knowledge?'green':'amber'}">${p.knowledge?'PASSED':'REQUIRED'}</span></div>
        <p>${escapeHTML(industrySummary[selectedIndustry] || industrySummary['general-customer-experience'])}</p>
        <ul class="muted-note"><li>Listen and identify the actual reason for contact.</li><li>Consult the approved knowledge base instead of guessing.</li><li>Protect customer information and use the sector’s approved checks.</li><li>Record what happened and explain a valid next step.</li></ul>
        <form data-calloria-ojt-form="knowledge" class="form-stack">
          <label class="form-field">1. Where should you confirm product rules and current procedures?<select name="source" required><option value="">Select an answer</option><option value="memory">Rely on memory or assumptions</option><option value="approved">The organisation’s approved knowledge base and current procedures</option><option value="customer">Ask the customer to decide the policy</option></select></label>
          <label class="form-field">2. What must your interaction notes contain?<select name="notes" required><option value="">Select an answer</option><option value="factual">Accurate facts, actions taken, outcome and next step</option><option value="opinion">Personal opinions about the customer</option><option value="minimal">Only the customer’s name</option></select></label>
          <label class="form-field">3. How should you handle a request outside your authority?<select name="escalation" required><option value="">Select an answer</option><option value="promise">Promise the result to calm the customer</option><option value="approved">Explain the limit and follow the approved escalation route</option><option value="ignore">Ignore the request</option></select></label>
          <button class="btn primary" type="submit">Complete knowledge check</button>
        </form>
      </section>
      <section class="panel"><div class="panel-head"><div><span class="subtle-label">MODULE 02</span><h3>Systems & interaction logging</h3><p>Practise the record that follows a customer contact.</p></div><span class="pill ${p.logging?'green':'amber'}">${p.logging?'COMPLETE':'REQUIRED'}</span></div>
        <div class="panel" style="background:var(--surface-soft,#f5f7f8);padding:12px;margin:10px 0"><strong>TRAINING CONTACT · ${escapeHTML(calloriaOJTIndustryLabel(selectedIndustry).toUpperCase())}</strong><p style="margin:6px 0 0">Customer: Amina Yusuf · Reference: TRN-24018</p><p style="margin:6px 0 0">Reason: Customer reports that a paid service/order/appointment has not been completed as expected. They want an update and a reliable next step.</p></div>
        <form data-calloria-ojt-form="logging" class="form-stack">
          <label class="form-field">Contact reason<textarea name="reason" rows="2" required minlength="15" placeholder="Summarise what the customer reported…"></textarea></label>
          <label class="form-field">Action taken<textarea name="action" rows="2" required minlength="15" placeholder="Describe the system and knowledge checks completed…"></textarea></label>
          <label class="form-field">Outcome / next step<textarea name="next" rows="2" required minlength="12" placeholder="Record the outcome, owner or promised follow-up…"></textarea></label>
          <button class="btn primary" type="submit">Save training CRM record</button>
        </form>
        <p class="muted-note">This is a practice record only. It does not create a production customer case or add to your live performance totals.</p>
      </section>
      <section class="panel"><div class="panel-head"><div><span class="subtle-label">MODULE 03</span><h3>Shadow an experienced agent</h3><p>Observe an actual sequence of agent actions, including accepting the queue offer, greeting, CRM logging, knowledge checks and disposition.</p></div><span class="pill ${p.shadowing?'green':'amber'}">${p.shadowing?'COMPLETE':'REQUIRED'}</span></div>
        ${calloriaOJTShadowingPanel(shadowScenario,o)}
      </section>
      </section>
      <section class="panel"><div class="panel-head"><div><span class="subtle-label">MODULE 04</span><h3>Supervised practice</h3><p>Handle a simulated issue while your trainer reviews your method.</p></div><span class="pill ${p.supervised?'green':'amber'}">${p.supervised?'PASSED':'REQUIRED'}</span></div>
        ${calloriaSupervisedPracticePanel(o)}
      </section>
    </div>
    <section class="panel" style="margin-top:14px;border-top:3px solid #0c9d8b"><div class="panel-head"><div><span class="subtle-label">TRAINER SIGN-OFF</span><h3>Desk allocation readiness</h3><p>Own-desk access remains locked until all four onboarding modules are complete and the trainer signs you off.</p></div><span class="pill ${done===4?'green':'amber'}">${done===4?'READY FOR SIGN-OFF':'TRAINING IN PROGRESS'}</span></div>
      ${done===4?'<p>All required learning, logging, shadowing and supervised practice evidence has been recorded.</p><button type="button" class="btn primary" data-calloria-ojt-action="signoff">Trainer sign-off & allocate my workstation →</button>':'<p class="muted-note">Complete the modules in sequence: product/service knowledge → systems logging → agent shadowing → supervised practice. Your progress is saved to this browser employment profile.</p>'}
    </section>
    <p class="muted-note" style="margin-top:10px">On-the-job onboarding is part of employment, not a second recruitment exam. Your live shift, queue allocation, customer KPIs and performance scoring begin only after trainer sign-off and the scheduled workforce briefing.</p>`;
}
function calloriaSaveOJTStep(key, evidence) {
  calloriaEnsureOJTProfile();
  if (!calloriaOJTRequired()) return;
  state.onboarding.progress[key] = true;
  state.onboarding.evidence = state.onboarding.evidence || {};
  state.onboarding.evidence[key] = { completedAt: new Date().toISOString(), ...evidence };
  state.onboarding.industryPack = document.getElementById('calloriaOJTIndustry')?.value || state.onboarding.industryPack || 'general-customer-experience';
  saveState();
  renderView();
  toast('Onboarding evidence saved.','success');
}
document.addEventListener('change', event => {
  if (event.target?.id === 'calloriaOJTIndustry' && calloriaOJTRequired()) {
    state.onboarding.industryPack = event.target.value;
    saveState();
  }
}, true);
document.addEventListener('submit', event => {
  const form = event.target?.closest?.('[data-calloria-ojt-form]');
  if (!form || !calloriaOJTRequired()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = new FormData(form);
  const step = form.dataset.calloriaOjtForm;
  const prerequisites = { logging: 'knowledge', supervised: 'shadowing' };
  const prerequisite = prerequisites[step];
  if (prerequisite && state.onboarding?.progress?.[prerequisite] !== true) { toast(step === 'logging' ? 'Complete product and service knowledge first.' : 'Complete the experienced-agent shadowing session before supervised practice.','warning'); return; }
  if (step === 'knowledge') {
    if (data.get('source') !== 'approved' || data.get('notes') !== 'factual' || data.get('escalation') !== 'approved') {
      toast('Knowledge check not passed. Review the approved procedures and retry.','warning'); return;
    }
    calloriaSaveOJTStep('knowledge',{industryPack:document.getElementById('calloriaOJTIndustry')?.value||'general-customer-experience',score:3}); return;
  }
  if (step === 'logging') {
    const reason=String(data.get('reason')||'').trim();
    const action=String(data.get('action')||'').trim();
    const next=String(data.get('next')||'').trim();
    if (reason.length < 15 || action.length < 15 || next.length < 12) { toast('Complete all three factual CRM fields before saving.','warning'); return; }
    calloriaSaveOJTStep('logging',{contactReason:reason,actionTaken:action,nextStep:next,recordType:'training-only'}); return;
  }
  if (step === 'supervised') {
    const session = calloriaEnsureSupervisedPracticeSession(state.onboarding);
    let payload;
    if (session.stage === 'opening') {
      payload = { type: 'opening-response', response: data.get('response') };
    } else if (session.stage === 'investigation') {
      payload = {
        type: 'investigation-review',
        customerRecord: data.get('customerRecord') === 'yes',
        priorContact: data.get('priorContact') === 'yes',
        knowledgeBase: data.get('knowledgeBase') === 'yes',
        finding: data.get('finding')
      };
    } else if (session.stage === 'nextStep') {
      payload = { type: 'explain-next-step', response: data.get('response') };
    } else if (session.stage === 'wrapup') {
      payload = {
        type: 'complete-training-wrapup', contactReason: data.get('contactReason'),
        actionTaken: data.get('actionTaken'), owner: data.get('owner'), nextStep: data.get('nextStep')
      };
    } else {
      toast('This supervised practice session is already complete.','warning'); return;
    }
    const result = calloriaSupervisedPracticeTransition(session, payload, state.onboarding.industryPack || 'general-customer-experience');
    if (!result.ok) { toast(result.message,'warning'); return; }
    state.onboarding.supervisedSession = result.session;
    if (result.session.stage === 'complete') {
      calloriaSaveOJTStep('supervised', {
        trainingScenario: calloriaSupervisedPracticeScenario(state.onboarding.industryPack || 'general-customer-experience').title,
        trainerReview: 'passed', score: result.session.score, rubric: result.session.rubric,
        transcript: result.session.transcript, trainingCase: result.session.evidence,
        attempts: result.session.attempts, recordType: 'training-only'
      });
      return;
    }
    saveState();
    renderView();
    toast(result.message, result.advanced ? 'success' : 'warning');
    return;
  }
}, true);
document.addEventListener('submit', event => {
  const form = event.target?.closest?.('[data-calloria-shadowing-form]');
  if (!form || !calloriaOJTRequired()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (state.onboarding?.progress?.knowledge !== true || state.onboarding?.progress?.logging !== true) {
    toast('Complete product/service knowledge and CRM logging practice before shadowing an agent.','warning'); return;
  }
  const data = new FormData(form);
  const formStep = form.dataset.calloriaShadowingForm;
  let payload;
  if (formStep === 'crm') {
    payload = { type:'save-crm', contactReason:data.get('contactReason'), actionTaken:data.get('actionTaken'), nextStep:data.get('nextStep') };
  } else if (formStep === 'knowledge') {
    payload = { type:'check-knowledge', articleReviewed:data.get('articleReviewed') === 'yes', route:data.get('route') };
  } else if (formStep === 'wrapup') {
    payload = { type:'complete-wrapup', disposition:data.get('disposition'), summary:data.get('summary') };
  } else return;
  const result = calloriaOJTShadowingTransition(calloriaEnsureOJTShadowingSession(state.onboarding), payload);
  if (!result.ok) { toast(result.message,'warning'); return; }
  state.onboarding.shadowingSession = result.session;
  if (result.session.step === 'complete') {
    calloriaSaveOJTStep('shadowing', {
      observedStages: 5,
      acceptedQueueOffer: true,
      greetingObserved: true,
      crmRecord: result.session.crmRecord,
      knowledgeDecision: result.session.knowledgeDecision,
      wrapUp: result.session.wrapUp,
      workflow: ['queue-offer-accepted','approved-greeting-and-listening','training-crm-record','approved-knowledge-base-check','wrap-up-and-disposition'],
      recordType: 'training-only'
    });
  } else {
    saveState();
    renderView();
    toast(result.message,'success');
  }
}, true);
document.addEventListener('click', event => {
  const button = event.target?.closest?.('[data-calloria-shadowing-event]');
  if (!button || !calloriaOJTRequired()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (state.onboarding?.progress?.knowledge !== true || state.onboarding?.progress?.logging !== true) {
    toast('Complete product/service knowledge and CRM logging practice before shadowing an agent.','warning'); return;
  }
  const type = button.dataset.calloriaShadowingEvent;
  const result = calloriaOJTShadowingTransition(calloriaEnsureOJTShadowingSession(state.onboarding), { type });
  if (!result.ok) { toast(result.message,'warning'); return; }
  state.onboarding.shadowingSession = result.session;
  saveState();
  renderView();
  toast(result.message,'success');
}, true);
document.addEventListener('click', event => {
  const button=event.target?.closest?.('[data-calloria-ojt-action="signoff"]');
  if (!button || !calloriaOJTRequired()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const required=['knowledge','logging','shadowing','supervised'];
  if (!required.every(key => state.onboarding?.progress?.[key] === true)) { toast('Trainer sign-off is locked until every onboarding module is complete.','warning'); return; }
  state.onboarding.status='certified';
  state.onboarding.completedAt=new Date().toISOString();
  state.onboarding.trainer={name:'Simulated Onboarding Trainer',decision:'approved',at:state.onboarding.completedAt};
  state.currentView='overview';
  saveState();
  renderView();
  toast('Trainer sign-off complete. Your workstation is now eligible for allocation. Attend the scheduled operations briefing before starting a shift.','success');
}, true);
