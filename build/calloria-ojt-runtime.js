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
        <p><strong>Customer says:</strong> “I expected this service today. It has not happened, and I have already contacted you once. I need to know what will happen next.”</p>
        <form data-calloria-ojt-form="supervised" class="form-stack">
          <label class="form-field">Write the response you would give the customer<textarea name="response" rows="5" required minlength="35" maxlength="900" placeholder="Acknowledge the impact, explain what you will check and give a clear next step…"></textarea></label>
          <label class="form-field">Select the best immediate action<select name="outcome" required><option value="">Select an answer</option><option value="investigate-case">Review the relevant record, document the contact and create / route a case if it cannot be resolved immediately</option><option value="promise">Promise completion today without checking</option><option value="close">Close the interaction without a record</option></select></label>
          <button class="btn primary" type="submit">Submit supervised practice to trainer</button>
        </form>
        <p class="muted-note">Trainer review checks acknowledgement, investigation, factual recording and a credible next step. This practice does not count as a live customer interaction.</p>
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
    const response=String(data.get('response')||'').trim();
    const acknowledges=/(understand|sorry|apolog|appreciate|frustrat|inconvenien|thank you for)/i.test(response);
    const investigates=/(check|review|investigat|look into|confirm|trace|verify)/i.test(response);
    const nextStep=/(update|follow.?up|case|reference|next step|contact you|route|escalat)/i.test(response);
    if (response.length < 35 || !acknowledges || !investigates || !nextStep || data.get('outcome') !== 'investigate-case') {
      toast('Trainer review not passed. Acknowledge the concern, explain the investigation and give a specific recorded next step.','warning'); return;
    }
    calloriaSaveOJTStep('supervised',{response,outcome:data.get('outcome'),trainerReview:'passed'}); return;
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
