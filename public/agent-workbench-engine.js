(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaAgentWorkbenchEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.5.0';
  const STORAGE_KEY = 'calloria.agent-workbench.v55';
  const CUSTOMER_KEY = 'calloria.customer-journey.v54';
  const KNOWLEDGE_KEY = 'calloria.knowledge-operations.v52';
  const RELIABILITY_KEY = 'calloria.service-reliability.v53';
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app'];
  const PRESENCES = ['Available', 'Break', 'Offline'];
  const CONTACT_STATUSES = ['Queued', 'Active', 'Completed', 'Transferred', 'Missed'];
  const DISPOSITIONS = [
    'Resolved on first contact', 'Information provided', 'Guidance provided', 'Case created',
    'Escalated to specialist', 'Callback agreed', 'Pending customer', 'Service issue acknowledged', 'No response / abandoned'
  ];
  const PRIORITIES = ['P1 - Urgent', 'P2 - High', 'P3 - Normal', 'P4 - Low'];
  const PRODUCTS = [
    { id: 'general', name: 'General customer service' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
    { id: 'kano-run', name: 'Kano Run' },
    { id: 'kano-keke', name: 'Kano Keke' }
  ];
  const CATEGORIES = [
    'Account & access', 'Billing & payments', 'Product guidance', 'Technical support',
    'Complaint & service recovery', 'Service disruption', 'Sales & service enquiry',
    'Life & personal development', 'Other'
  ];

  function clean(value, max = 1000) {
    return String(value == null ? '' : value)
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
  function toIso(value) {
    const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value);
    if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.');
    return date.toISOString();
  }
  function productName(id) { return (PRODUCTS.find((item) => item.id === id) || PRODUCTS[0]).name; }
  function channelMinutes(channel) { return channel === 'Voice' ? 20 : channel === 'Live chat' ? 45 : 240; }

  const DEMO_CONTACTS = [
    { id: 'CT-55001', customerId: 'CUS-1001', channel: 'Live chat', productId: 'ruffneck-lms', priority: 'P2 - High', subject: 'Course enrolment is not appearing', message: 'I signed in and selected a course, but it is still missing from my learning area. Can you check what happened?', customerTone: 'Concerned', replyHint: 'Confirm the course, ask when enrolment was submitted, and explain the next check.', customerReplies: ['I selected the course yesterday and received the confirmation email, but the learning area is still empty.', 'Thank you. Will the case reference and next update be sent to my email?'] },
    { id: 'CT-55002', customerId: 'CUS-1002', channel: 'Voice', productId: 'kano-run', priority: 'P1 - Urgent', subject: 'Unable to sign in to Kano Run', message: 'I cannot get into my player account. I have tried several times and need help before I lose my progress.', customerTone: 'Frustrated', replyHint: 'Acknowledge the impact, verify the account safely, and do not ask for a password or one-time code.', customerReplies: ['I can confirm my account email, but I am not comfortable sharing my password or a one-time code.', 'Thank you for explaining the safe checks. I can wait while the access issue is investigated.'] },
    { id: 'CT-55003', customerId: 'CUS-1003', channel: 'Email', productId: 'ruffneck-social-hub', priority: 'P3 - Normal', subject: 'How do I schedule a campaign?', message: 'Please explain how to prepare and schedule a social publishing campaign. I do not want it to publish immediately.', customerTone: 'Neutral', replyHint: 'Explain draft, review, schedule and publish controls without promising unverified features.', customerReplies: ['Can I save it as a draft while another team member reviews the content?', 'Understood. I will confirm the schedule before expecting it to publish.'] },
    { id: 'CT-55004', customerId: 'CUS-1004', channel: 'Social', productId: 'ruffneck-prospector', priority: 'P2 - High', subject: 'Saved workspace is showing incomplete results', message: 'My saved view is not showing the records I expected. Is there a filter or refresh step I should check?', customerTone: 'Impatient', replyHint: 'Clarify the saved view, filters and time range before escalating.', customerReplies: ['I checked the filters and date range. The records are still missing from the view.', 'I can share the saved view name if the specialist needs it.'] },
    { id: 'CT-55005', customerId: 'CUS-1005', channel: 'In-app', productId: 'kano-keke', priority: 'P3 - Normal', subject: 'Gameplay stage feedback', message: 'I enjoyed the game but one stage felt confusing. Is there a way to send detailed feedback?', customerTone: 'Positive', replyHint: 'Thank the player and capture the exact stage and observed behaviour.', customerReplies: ['It was stage four. The instructions did not explain the next objective clearly.', 'That is the feedback I wanted to send. Thank you for recording it.'] },
    { id: 'CT-55006', customerId: 'CUS-1006', channel: 'Email', productId: 'kano-run', priority: 'P4 - Low', subject: 'Sponsorship and advertising enquiry', message: 'Our organisation wants to understand the approved sponsorship and advertising enquiry process.', customerTone: 'Formal', replyHint: 'Explain that a proposal can be routed for review; do not quote invented rates or availability.', customerReplies: ['Can we submit a proposal first without agreeing to a price or campaign date?', 'That works. Please confirm which details the proposal should contain.'] },
    { id: 'CT-55007', customerId: 'CUS-1007', channel: 'SMS', productId: 'general', priority: 'P2 - High', subject: 'Previous complaint follow-up', message: 'I contacted support earlier and do not know what is happening with my complaint. Please update me.', customerTone: 'Upset', replyHint: 'Acknowledge the previous contact and check for an existing case before creating another.', customerReplies: ['I think the reference was CASE-54007. I mainly need to know when I will hear back.', 'Thank you. Please make sure the earlier complaint is not treated as a new one.'] },
    { id: 'CT-55008', customerId: 'CUS-1001', channel: 'Voice', productId: 'ruffneck-connect', priority: 'P3 - Normal', subject: 'Getting started with Connect', message: 'I need someone to walk me through the initial setup and where to find help if I get stuck.', customerTone: 'Curious', replyHint: 'Discover the setup step and guide one step at a time.', customerReplies: ['I am on the setup screen now. Which step should I complete first?', 'I have completed that step and can see the next section.'] },
    { id: 'CT-55009', customerId: 'CUS-1003', channel: 'Live chat', productId: 'ruffneck-social-hub', priority: 'P2 - High', subject: 'Scheduled post did not appear', message: 'A post I expected to go out is not visible. I need to understand whether it was saved, scheduled or failed.', customerTone: 'Concerned', replyHint: 'Ask for the schedule time and post status; do not claim a publish event without evidence.', customerReplies: ['It was scheduled for 10 AM today, but there is no status message on the post.', 'I can send the post reference if the team needs to investigate.'] },
    { id: 'CT-55010', customerId: 'CUS-1006', channel: 'Social', productId: 'general', priority: 'P4 - Low', subject: 'General service information', message: 'Where can I find the official information about the RuffNeck services?', customerTone: 'Neutral', replyHint: 'Identify the service of interest and share only approved public service information.', customerReplies: ['I am looking for information about the LMS and Connect services.', 'Thanks. I will review those official service pages.'] }
  ];

  function makeContact(seed, index, now) {
    const createdAt = new Date(new Date(now).getTime() - (index * 3 + 1) * 60000).toISOString();
    return {
      ...seed,
      reference: seed.id,
      status: 'Queued',
      createdAt,
      acceptedAt: null,
      completedAt: null,
      assignedTo: null,
      slaDueAt: new Date(new Date(createdAt).getTime() + channelMinutes(seed.channel) * 60000).toISOString(),
      messages: [{ id: makeId('msg'), at: createdAt, direction: 'Inbound', body: seed.message, author: 'Customer' }],
      internalNotes: [],
      linkedCaseId: null,
      disposition: null,
      wrapUp: null,
      transferTeam: null,
      transferReason: null,
      replyCount: 0,
      simulatedReplies: 0,
      customerReplies: Array.isArray(seed.customerReplies) ? seed.customerReplies.slice() : []
    };
  }
  function createInitialState(now) {
    const current = toIso(now);
    return {
      version: VERSION,
      agent: { name: 'Agent Trainee', team: 'Customer Care', presence: 'Offline', shiftStartedAt: null, shiftEndedAt: null },
      contacts: DEMO_CONTACTS.map((item, index) => makeContact(item, index, current)),
      activeContactId: null,
      completed: [],
      activity: [{ id: makeId('act'), at: current, message: 'Synthetic demonstration contact queue loaded.' }],
      metrics: { accepted: 0, completed: 0, transferred: 0, replies: 0, totalHandleMs: 0 },
      integration: { customerKey: CUSTOMER_KEY, knowledgeKey: KNOWLEDGE_KEY, reliabilityKey: RELIABILITY_KEY, lastCustomerSyncAt: null, lastKnowledgeReadAt: null }
    };
  }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    const contacts = Array.isArray(raw.contacts) ? raw.contacts : fresh.contacts;
    return {
      ...fresh, ...raw,
      agent: { ...fresh.agent, ...(raw.agent || {}) },
      contacts: contacts.map((item) => ({
        ...item,
        messages: Array.isArray(item.messages) ? item.messages : [],
        internalNotes: Array.isArray(item.internalNotes) ? item.internalNotes : [],
        status: CONTACT_STATUSES.includes(item.status) ? item.status : 'Queued'
      })),
      completed: Array.isArray(raw.completed) ? raw.completed : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      metrics: { ...fresh.metrics, ...(raw.metrics || {}) },
      integration: { ...fresh.integration, ...(raw.integration || {}) },
      activeContactId: raw.activeContactId || null
    };
  }
  function load(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState(now);
    try {
      const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      return raw ? normaliseState(raw, now) : createInitialState(now);
    } catch (_) { return createInitialState(now); }
  }
  function save(state, storage) {
    if (!storage || typeof storage.setItem !== 'function') return false;
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function activity(state, message, at) {
    state.activity.unshift({ id: makeId('act'), at: toIso(at), message: clean(message, 260) });
    state.activity = state.activity.slice(0, 200);
  }
  function getContact(state, id) { return state.contacts.find((item) => item.id === id) || null; }
  function getActiveContact(state) { return state.activeContactId ? getContact(state, state.activeContactId) : null; }
  function queuedContacts(state, filters = {}) {
    return state.contacts.filter((item) => item.status === 'Queued')
      .filter((item) => !filters.channel || item.channel === filters.channel)
      .filter((item) => !filters.query || [item.reference, item.subject, item.message, item.customerId, item.channel, item.productId].join(' ').toLowerCase().includes(clean(filters.query, 160).toLowerCase()))
      .sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority) || a.createdAt.localeCompare(b.createdAt));
  }
  function startShift(state, name, team, at) {
    const agentName = clean(name, 100), agentTeam = clean(team || 'Customer Care', 100);
    if (agentName.length < 2) throw new Error('Enter the agent name before starting a shift.');
    if (state.agent.shiftStartedAt && !state.agent.shiftEndedAt) throw new Error('The current shift is already active.');
    if (state.activeContactId) throw new Error('Complete or transfer the active contact before starting another shift.');
    const now = toIso(at);
    state.agent = { name: agentName, team: agentTeam, presence: 'Available', shiftStartedAt: now, shiftEndedAt: null };
    activity(state, `${agentName} started a ${agentTeam} shift.`, now);
    return state.agent;
  }
  function isOnShift(state) { return !!(state.agent.shiftStartedAt && !state.agent.shiftEndedAt); }
  function setPresence(state, presence, at) {
    if (!PRESENCES.includes(presence)) throw new Error('Choose a valid agent presence.');
    if (!isOnShift(state) && presence !== 'Offline') throw new Error('Start a shift before changing to an available or break status.');
    if (state.activeContactId && presence !== 'Available') throw new Error('Complete or transfer the active contact before changing presence.');
    state.agent.presence = presence;
    activity(state, `Agent presence changed to ${presence}.`, at);
    return presence;
  }
  function endShift(state, at) {
    if (!isOnShift(state)) throw new Error('There is no active shift to end.');
    if (state.activeContactId) throw new Error('Complete or transfer the active contact before ending the shift.');
    const now = toIso(at); state.agent.presence = 'Offline'; state.agent.shiftEndedAt = now;
    activity(state, `${state.agent.name} ended the shift.`, now); return state.agent;
  }
  function acceptContact(state, contactId, at) {
    const contact = getContact(state, contactId);
    if (!contact) throw new Error('Contact not found.');
    if (!isOnShift(state)) throw new Error('Start the agent shift before accepting contacts.');
    if (state.agent.presence !== 'Available') throw new Error('Set agent presence to Available before accepting contacts.');
    if (state.activeContactId) throw new Error('Complete or transfer the active contact first.');
    if (contact.status !== 'Queued') throw new Error('This contact is no longer in the queue.');
    const now = toIso(at); contact.status = 'Active'; contact.acceptedAt = now; contact.assignedTo = state.agent.name;
    state.activeContactId = contact.id; state.metrics.accepted += 1;
    activity(state, `${contact.reference} accepted from ${contact.channel} queue.`, now); return contact;
  }
  function declineContact(state, contactId, reason, at) {
    const contact = getContact(state, contactId);
    if (!contact || contact.status !== 'Queued') throw new Error('Only a queued contact can be declined.');
    const why = clean(reason, 240); if (why.length < 5) throw new Error('Enter a reason for declining the contact.');
    const now = toIso(at); contact.internalNotes.unshift({ id: makeId('note'), at: now, author: state.agent.name, text: `Queue decline: ${why}` });
    contact.status = 'Queued'; contact.createdAt = now;
    activity(state, `${contact.reference} returned to the queue: ${why}.`, now); return contact;
  }
  function sendReply(state, contactId, body, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Open the active contact before replying.');
    const text = clean(body, 2000); if (text.length < 2) throw new Error('Enter a customer response.');
    const now = toIso(at);
    const message = { id: makeId('msg'), at: now, direction: 'Outbound', body: text, author: state.agent.name };
    contact.messages.push(message); contact.replyCount += 1; state.metrics.replies += 1;
    activity(state, `Agent response sent in ${contact.reference}.`, now); return message;
  }
  function simulateCustomerResponse(state, contactId, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Open the active contact before advancing the customer conversation.');
    const scripts = Array.isArray(contact.customerReplies) ? contact.customerReplies : [];
    const index = Number(contact.simulatedReplies) || 0;
    if (index >= scripts.length) return null;
    const now = toIso(at);
    const message = { id: makeId('msg'), at: now, direction: 'Inbound', body: clean(scripts[index], 1800), author: 'Customer', simulated: true };
    contact.messages.push(message); contact.simulatedReplies = index + 1;
    activity(state, `Simulated customer follow-up received in ${contact.reference}.`, now);
    return message;
  }
  function addInternalNote(state, contactId, body, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Open the active contact before adding a note.');
    const text = clean(body, 1000); if (text.length < 5) throw new Error('Internal note must contain at least five characters.');
    const note = { id: makeId('note'), at: toIso(at), author: state.agent.name, text };
    contact.internalNotes.unshift(note); activity(state, `Internal note added to ${contact.reference}.`, at); return note;
  }
  function transferContact(state, contactId, team, reason, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Open the active contact before transferring it.');
    const nextTeam = clean(team, 100), why = clean(reason, 300);
    if (nextTeam.length < 2 || nextTeam === state.agent.team) throw new Error('Choose a different receiving team.');
    if (why.length < 10) throw new Error('Enter at least 10 characters explaining the transfer.');
    const now = toIso(at); contact.status = 'Transferred'; contact.transferTeam = nextTeam; contact.transferReason = why; contact.completedAt = now;
    contact.wrapUp = { disposition: 'Escalated to specialist', summary: why, at: now, agent: state.agent.name };
    state.activeContactId = null; state.metrics.transferred += 1;
    activity(state, `${contact.reference} transferred to ${nextTeam}.`, now); return contact;
  }
  function completeContact(state, contactId, input, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Open the active contact before wrapping it up.');
    const disposition = clean(input && input.disposition, 80), summary = clean(input && input.summary, 900);
    if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a valid contact disposition.');
    if (summary.length < 20) throw new Error('Enter a wrap-up summary of at least 20 characters.');
    const now = toIso(at); const duration = Math.max(0, new Date(now).getTime() - new Date(contact.acceptedAt).getTime());
    contact.status = 'Completed'; contact.completedAt = now;
    contact.disposition = disposition; contact.wrapUp = { disposition, summary, at: now, agent: state.agent.name, linkedCaseId: input.linkedCaseId || null, caseAction: input.caseAction || 'note-only' };
    state.activeContactId = null; state.completed.unshift(contact.id); state.metrics.completed += 1; state.metrics.totalHandleMs += duration;
    activity(state, `${contact.reference} completed: ${disposition}.`, now); return contact;
  }
  function recordMissed(state, contactId, reason, at) {
    const contact = getContact(state, contactId);
    if (!contact || contact.status !== 'Queued') throw new Error('Only a queued contact can be marked missed.');
    const why = clean(reason || 'Queue timeout in simulation.', 200); const now = toIso(at);
    contact.status = 'Missed'; contact.completedAt = now; contact.transferReason = why;
    activity(state, `${contact.reference} marked missed.`, now); return contact;
  }
  function searchKnowledge(storage, query, productId, now) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      const raw = JSON.parse(storage.getItem(KNOWLEDGE_KEY) || 'null');
      const articles = raw && Array.isArray(raw.articles) ? raw.articles : [];
      const today = toIso(now).slice(0, 10), q = clean(query, 180).toLowerCase();
      return articles.filter((article) => article && article.status === 'Published' && (!article.expiresAt || article.expiresAt >= today))
        .filter((article) => !productId || productId === 'all' || article.productId === productId || article.productId === 'general')
        .filter((article) => !q || [article.title, article.summary, article.category, article.productId, article.keywords, ...(article.steps || [])].join(' ').toLowerCase().includes(q))
        .slice(0, 12).map((article) => ({ id: article.id, title: clean(article.title, 160), summary: clean(article.summary, 700), productId: article.productId, category: article.category, version: article.version, updatedAt: article.updatedAt, steps: Array.isArray(article.steps) ? article.steps.map((step) => clean(step, 260)) : [] }));
    } catch (_) { return []; }
  }
  function readCustomerJourney(storage) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
      const raw = JSON.parse(storage.getItem(CUSTOMER_KEY) || 'null');
      if (!raw || !Array.isArray(raw.customers) || !Array.isArray(raw.cases)) return null;
      return raw;
    } catch (_) { return null; }
  }
  function customerById(customerState, customerId) {
    return customerState && Array.isArray(customerState.customers) ? customerState.customers.find((item) => item.id === customerId) || null : null;
  }
  function openCasesForCustomer(customerState, customerId) {
    return customerState && Array.isArray(customerState.cases) ? customerState.cases.filter((item) => item.customerId === customerId && !['Resolved', 'Closed'].includes(item.status)) : [];
  }
  function commitToCustomerJourney(state, contactId, input, customerEngine, storage, at) {
    const contact = getActiveContact(state);
    if (!contact || contact.id !== contactId) throw new Error('Complete the active contact before syncing its customer record.');
    if (!customerEngine || typeof customerEngine.load !== 'function' || typeof customerEngine.save !== 'function') throw new Error('Customer 360 v5.4 engine is not available.');
    const disposition = clean(input && input.disposition, 80);
    const summary = clean(input && input.summary, 900);
    if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a valid contact disposition.');
    if (summary.length < 20) throw new Error('Enter a wrap-up summary of at least 20 characters.');
    const caseAction = input && input.caseAction;
    if (!['create', 'existing', 'note-only'].includes(caseAction)) throw new Error('Choose a valid case action.');
    const now = toIso(at);
    const db = customerEngine.load(storage);
    const customer = typeof customerEngine.getCustomer === 'function' ? customerEngine.getCustomer(db, contact.customerId) : null;
    if (!customer) throw new Error(`Customer ${contact.customerId} is not present in Customer 360 v5.4.`);
    let linkedCase = null;
    if (caseAction === 'existing') {
      linkedCase = typeof customerEngine.getCase === 'function' ? customerEngine.getCase(db, input.existingCaseId) : null;
      if (!linkedCase || linkedCase.customerId !== customer.id || ['Resolved', 'Closed'].includes(linkedCase.status)) throw new Error('Choose an open case belonging to this customer.');
    } else if (caseAction === 'create') {
      linkedCase = customerEngine.createCase(db, {
        customerId: customer.id,
        subject: input.caseSubject || contact.subject,
        description: `${summary} Contact reference ${contact.reference}. Product: ${productName(contact.productId)}.`,
        productId: contact.productId,
        category: input.category,
        priority: input.priority,
        channel: contact.channel,
        owner: state.agent.name,
        team: state.agent.team,
        tags: ['agent-workbench', contact.reference]
      }, now);
    }
    const transcriptSummary = contact.messages.slice(-6).map((message) => `${message.author}: ${message.body}`).join(' | ').slice(0, 820);
    if (linkedCase) {
      customerEngine.addInteraction(db, linkedCase.id, {
        channel: contact.channel,
        direction: 'Inbound',
        visibility: 'Internal',
        agent: state.agent.name,
        summary: `Agent desk wrap-up (${contact.reference}). ${summary}. Transcript: ${transcriptSummary}`.slice(0, 1000)
      }, now);
      if (typeof customerEngine.addArticleReference === 'function') {
        const selectedIds = Array.isArray(contact.knowledgeReferences) ? contact.knowledgeReferences : [];
        searchKnowledge(storage, '', contact.productId, now).filter((article) => selectedIds.includes(article.id)).forEach((article) => customerEngine.addArticleReference(db, linkedCase.id, article, now));
      }
    }
    const customerNote = `Agent contact ${contact.reference} via ${contact.channel}. Disposition: ${disposition}. ${summary}`;
    customerEngine.addCustomerNote(db, customer.id, customerNote, state.agent.name, now);
    customer.lastContactAt = now;
    if (!customerEngine.save(db, storage)) throw new Error('Customer 360 could not save the linked interaction. Contact remains active.');
    if (linkedCase) contact.linkedCaseId = linkedCase.id;
    return linkedCase;
  }
  function getMetrics(state) {
    const completed = state.contacts.filter((item) => item.status === 'Completed');
    const transferred = state.contacts.filter((item) => item.status === 'Transferred');
    const active = getActiveContact(state);
    const totalDuration = completed.reduce((sum, item) => sum + Math.max(0, new Date(item.completedAt) - new Date(item.acceptedAt)), 0);
    const channelCounts = Object.fromEntries(CHANNELS.map((channel) => [channel, state.contacts.filter((item) => item.status === 'Completed' && item.channel === channel).length]));
    return {
      queued: state.contacts.filter((item) => item.status === 'Queued').length,
      active: active ? 1 : 0,
      handled: completed.length,
      transferred: transferred.length,
      averageHandleMinutes: completed.length ? Math.round(totalDuration / completed.length / 60000 * 10) / 10 : 0,
      replyCount: state.metrics.replies,
      channelCounts
    };
  }
  function exportInteractionsCsv(state) {
    const rows = [['Contact reference', 'Customer ID', 'Channel', 'Product', 'Subject', 'Status', 'Agent', 'Accepted at', 'Completed at', 'Disposition', 'Wrap-up summary', 'Linked case']];
    state.contacts.forEach((item) => rows.push([item.reference, item.customerId, item.channel, productName(item.productId), item.subject, item.status, item.assignedTo || '', item.acceptedAt || '', item.completedAt || '', item.disposition || '', item.wrapUp && item.wrapUp.summary || '', item.wrapUp && item.wrapUp.linkedCaseId || item.linkedCaseId || '']));
    return rows.map((row) => row.map((value) => {
      let text = String(value == null ? '' : value);
      if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, CUSTOMER_KEY, KNOWLEDGE_KEY, RELIABILITY_KEY, CHANNELS, PRESENCES, CONTACT_STATUSES,
    DISPOSITIONS, PRIORITIES, PRODUCTS, CATEGORIES, DEMO_CONTACTS, clean, toIso, createInitialState,
    normaliseState, load, save, activity, getContact, getActiveContact, queuedContacts, startShift,
    isOnShift, setPresence, endShift, acceptContact, declineContact, sendReply, simulateCustomerResponse, addInternalNote,
    transferContact, completeContact, recordMissed, searchKnowledge, readCustomerJourney,
    customerById, openCasesForCustomer, commitToCustomerJourney, getMetrics, exportInteractionsCsv
  };
});
