(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaCustomerJourneyEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.4.0';
  const STORAGE_KEY = 'calloria.customer-journey.v54';
  const RELIABILITY_KEY = 'calloria.service-reliability.v53';
  const KNOWLEDGE_KEY = 'calloria.knowledge-operations.v52';
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app', 'Internal transfer'];
  const PRIORITIES = ['P1 - Urgent', 'P2 - High', 'P3 - Normal', 'P4 - Low'];
  const STATUSES = ['New', 'Open', 'Pending Customer', 'Pending Internal', 'Resolved', 'Closed'];
  const CATEGORIES = ['Account & access', 'Billing & payments', 'Product guidance', 'Technical support', 'Complaint & service recovery', 'Service disruption', 'Sales & service enquiry', 'Life & personal development', 'Other'];
  const PRODUCTS = [
    { id: 'general', name: 'General customer service' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
    { id: 'kano-run', name: 'Kano Run' },
    { id: 'kano-keke', name: 'Kano Keke' }
  ];
  const SLA_MINUTES = { 'P1 - Urgent': 240, 'P2 - High': 1440, 'P3 - Normal': 4320, 'P4 - Low': 7200 };
  const TRANSITIONS = {
    New: ['Open'],
    Open: ['Pending Customer', 'Pending Internal', 'Resolved'],
    'Pending Customer': ['Open', 'Resolved'],
    'Pending Internal': ['Open', 'Resolved'],
    Resolved: ['Closed', 'Open'],
    Closed: []
  };

  function clean(value, max = 800) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function validDate(value) { return !Number.isNaN(new Date(value).getTime()); }
  function iso(value) { const d = value instanceof Date ? value : new Date(value || Date.now()); if (!validDate(d)) throw new Error('Enter a valid date and time.'); return d.toISOString(); }
  function productName(productId) { return (PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0]).name; }
  function priorityIndex(priority) { return PRIORITIES.indexOf(priority); }
  function addMinutes(value, minutes) { return new Date(new Date(value).getTime() + minutes * 60000).toISOString(); }

  const DEMO_CUSTOMERS = [
    { id: 'CUS-1001', firstName: 'Amara', lastName: 'Bello', email: 'amara.bello@example.invalid', phone: '+234 000 000 1001', preferredChannel: 'Live chat', preferredName: 'Amara', status: 'Active', segment: 'Returning customer', services: ['ruffneck-lms', 'ruffneck-connect'], tags: ['learning', 'access support'], createdAt: '2026-10-18T09:00:00.000Z', lastContactAt: null, consent: { email: true, sms: false, marketing: false }, notes: [] },
    { id: 'CUS-1002', firstName: 'Musa', lastName: 'Garba', email: 'musa.garba@example.invalid', phone: '+234 000 000 1002', preferredChannel: 'Voice', preferredName: 'Musa', status: 'Active', segment: 'New customer', services: ['kano-run'], tags: ['player support'], createdAt: '2026-10-23T10:30:00.000Z', lastContactAt: null, consent: { email: true, sms: true, marketing: false }, notes: [] },
    { id: 'CUS-1003', firstName: 'Zainab', lastName: 'Yusuf', email: 'zainab.yusuf@example.invalid', phone: '+234 000 000 1003', preferredChannel: 'Email', preferredName: 'Zainab', status: 'Active', segment: 'Returning customer', services: ['ruffneck-social-hub'], tags: ['campaign support'], createdAt: '2026-09-12T12:00:00.000Z', lastContactAt: null, consent: { email: true, sms: false, marketing: true }, notes: [] },
    { id: 'CUS-1004', firstName: 'Ibrahim', lastName: 'Sani', email: 'ibrahim.sani@example.invalid', phone: '+234 000 000 1004', preferredChannel: 'Social', preferredName: 'Ibrahim', status: 'Active', segment: 'Returning customer', services: ['ruffneck-prospector', 'ruffneck-connect'], tags: ['workspace'], createdAt: '2026-08-02T08:15:00.000Z', lastContactAt: null, consent: { email: false, sms: false, marketing: false }, notes: [] },
    { id: 'CUS-1005', firstName: 'Fatima', lastName: 'Aliyu', email: 'fatima.aliyu@example.invalid', phone: '+234 000 000 1005', preferredChannel: 'In-app', preferredName: 'Fatima', status: 'Active', segment: 'New customer', services: ['kano-keke'], tags: ['game feedback'], createdAt: '2026-11-01T14:00:00.000Z', lastContactAt: null, consent: { email: false, sms: false, marketing: false }, notes: [] },
    { id: 'CUS-1006', firstName: 'Daniel', lastName: 'Okafor', email: 'daniel.okafor@example.invalid', phone: '+234 000 000 1006', preferredChannel: 'Email', preferredName: 'Daniel', status: 'Active', segment: 'Business enquiry', services: ['ruffneck-social-hub', 'kano-run'], tags: ['partnership'], createdAt: '2026-10-05T11:20:00.000Z', lastContactAt: null, consent: { email: true, sms: false, marketing: false }, notes: [] },
    { id: 'CUS-1007', firstName: 'Aisha', lastName: 'Mohammed', email: 'aisha.mohammed@example.invalid', phone: '+234 000 000 1007', preferredChannel: 'Live chat', preferredName: 'Aisha', status: 'Active', segment: 'Returning customer', services: ['general'], tags: ['service recovery'], createdAt: '2026-07-19T16:45:00.000Z', lastContactAt: null, consent: { email: true, sms: false, marketing: false }, notes: [] }
  ];

  function makeSeedCase(customerId, reference, input, now, ageHours) {
    const createdAt = new Date(new Date(now).getTime() - ageHours * 3600000).toISOString();
    const dueAt = addMinutes(createdAt, SLA_MINUTES[input.priority]);
    const item = {
      id: reference, reference, customerId, subject: input.subject, description: input.description,
      productId: input.productId, category: input.category, priority: input.priority,
      channel: input.channel, status: input.status, owner: input.owner, team: input.team,
      createdAt, updatedAt: createdAt, dueAt, pausedAt: input.status === 'Pending Customer' ? now : null,
      pausedMs: 0, resolvedAt: input.status === 'Resolved' ? now : null, closedAt: null,
      sourceIncidentId: null, sourceIncidentReference: null, interactions: [], tasks: [],
      timeline: [{ id: id('evt'), at: createdAt, type: 'created', text: 'Case opened from a synthetic demonstration contact.' }],
      resolution: input.status === 'Resolved' ? 'Demonstration case resolved with the customer informed of the outcome.' : null,
      satisfaction: null, tags: input.tags || []
    };
    return item;
  }

  function createEmptyState(now) {
    const current = iso(now);
    return { version: VERSION, customers: [], cases: [], activity: [], integration: { reliabilityKey: RELIABILITY_KEY, knowledgeKey: KNOWLEDGE_KEY, lastIncidentReadAt: null, lastKnowledgeReadAt: null } };
  }
  function createInitialState(now) {
    const current = iso(now);
    const customers = DEMO_CUSTOMERS.map((item) => ({ ...item, services: item.services.slice(), tags: item.tags.slice(), consent: { ...item.consent }, notes: [] }));
    const cases = [
      makeSeedCase('CUS-1001', 'CASE-54001', { subject: 'Course enrolment has not completed', description: 'Customer can access the learning area but the selected course does not appear after enrolment.', productId: 'ruffneck-lms', category: 'Technical support', priority: 'P2 - High', channel: 'Live chat', status: 'Open', owner: 'Nadia Ibrahim', team: 'Digital Support', tags: ['enrolment', 'repeat contact'] }, current, 2),
      makeSeedCase('CUS-1002', 'CASE-54002', { subject: 'Unable to access player account', description: 'Customer reports repeated sign-in failure and needs the account access route checked.', productId: 'kano-run', category: 'Account & access', priority: 'P1 - Urgent', channel: 'Voice', status: 'Pending Internal', owner: 'Sadiq Musa', team: 'Technical Support', tags: ['access'] }, current, 5),
      makeSeedCase('CUS-1003', 'CASE-54003', { subject: 'Campaign publishing guidance requested', description: 'Customer needs clarification about a scheduled social publishing workflow.', productId: 'ruffneck-social-hub', category: 'Product guidance', priority: 'P3 - Normal', channel: 'Email', status: 'Pending Customer', owner: 'Maryam Yusuf', team: 'Platform Support', tags: ['campaign'] }, current, 20),
      makeSeedCase('CUS-1004', 'CASE-54004', { subject: 'Prospector workspace investigation', description: 'Customer reports that a saved workspace view is not showing expected records.', productId: 'ruffneck-prospector', category: 'Technical support', priority: 'P2 - High', channel: 'Social', status: 'Open', owner: 'Emeka Nwosu', team: 'Technical Support', tags: ['workspace'] }, current, 30),
      makeSeedCase('CUS-1005', 'CASE-54005', { subject: 'Gameplay feedback follow-up', description: 'Customer shared feedback about a gameplay stage and requested an update.', productId: 'kano-keke', category: 'Complaint & service recovery', priority: 'P3 - Normal', channel: 'In-app', status: 'Resolved', owner: 'Hauwa Bello', team: 'Player Support', tags: ['feedback'] }, current, 72),
      makeSeedCase('CUS-1006', 'CASE-54006', { subject: 'Sponsorship enquiry routing', description: 'Business contact wants to understand the approved process for a sponsorship proposal.', productId: 'kano-run', category: 'Sales & service enquiry', priority: 'P4 - Low', channel: 'Email', status: 'New', owner: 'Unassigned', team: 'Partnerships', tags: ['commercial'] }, current, 10)
    ];
    customers.forEach((customer) => {
      const latest = cases.filter((item) => item.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      customer.lastContactAt = latest ? latest.createdAt : null;
    });
    return { version: VERSION, customers, cases, activity: [{ id: id('act'), at: current, message: 'Customer 360 and case operations demonstration data loaded.' }], integration: { reliabilityKey: RELIABILITY_KEY, knowledgeKey: KNOWLEDGE_KEY, lastIncidentReadAt: null, lastKnowledgeReadAt: null } };
  }
  function normaliseState(raw, now) {
    const fresh = createEmptyState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      customers: Array.isArray(raw.customers) ? raw.customers : [],
      cases: Array.isArray(raw.cases) ? raw.cases : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      integration: { ...fresh.integration, ...(raw.integration || {}) }
    };
  }
  function load(target, now) {
    if (!target || typeof target.getItem !== 'function') return createInitialState(now);
    try {
      const raw = JSON.parse(target.getItem(STORAGE_KEY) || 'null');
      return raw ? normaliseState(raw, now) : createInitialState(now);
    } catch (_) { return createInitialState(now); }
  }
  function save(state, target) {
    if (!target || typeof target.setItem !== 'function') return false;
    try { target.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; }
  }
  function log(state, message, at) {
    state.activity.unshift({ id: id('act'), at: iso(at), message: clean(message, 260) });
    state.activity = state.activity.slice(0, 200);
  }
  function getCustomer(state, customerId) { return state.customers.find((item) => item.id === customerId) || null; }
  function getCase(state, caseId) { return state.cases.find((item) => item.id === caseId || item.reference === caseId) || null; }
  function validateCustomer(input) {
    const firstName = clean(input && input.firstName, 70), lastName = clean(input && input.lastName, 70);
    if (firstName.length < 2 || lastName.length < 2) throw new Error('Enter a customer first name and last name.');
    const email = clean(input.email, 160).toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address or leave it blank.');
    const preferredChannel = input.preferredChannel || 'Email';
    if (!CHANNELS.includes(preferredChannel)) throw new Error('Choose a valid preferred channel.');
    return { firstName, lastName, email, phone: clean(input.phone, 40), preferredChannel, preferredName: clean(input.preferredName || firstName, 70), status: 'Active', segment: clean(input.segment || 'General', 60), services: Array.isArray(input.services) ? input.services.filter((x) => PRODUCTS.some((p) => p.id === x)) : ['general'], tags: Array.isArray(input.tags) ? input.tags.map((x) => clean(x, 40)).filter(Boolean).slice(0, 12) : [], consent: { email: !!(input.consent && input.consent.email), sms: !!(input.consent && input.consent.sms), marketing: !!(input.consent && input.consent.marketing) }, createdAt: iso(input.createdAt), lastContactAt: null, notes: [] };
  }
  function createCustomer(state, input, at) {
    const fields = validateCustomer({ ...input, createdAt: at || input.createdAt || new Date() });
    const duplicate = findPossibleDuplicateCustomer(state, fields);
    if (duplicate) throw new Error(`Possible duplicate customer: ${duplicate.id}. Review the existing profile before creating another.`);
    const customer = { id: id('CUS'), ...fields };
    state.customers.unshift(customer); log(state, `Customer profile created: ${customer.id}.`, at); return customer;
  }
  function findPossibleDuplicateCustomer(state, input) {
    const email = clean(input.email, 160).toLowerCase(); const phone = clean(input.phone, 40).replace(/\D/g, '');
    return state.customers.find((customer) => (email && customer.email && customer.email.toLowerCase() === email) || (phone.length >= 7 && customer.phone && customer.phone.replace(/\D/g, '') === phone)) || null;
  }
  function updateCustomer(state, customerId, patch, at) {
    const customer = getCustomer(state, customerId); if (!customer) throw new Error('Customer not found.');
    const allowed = ['email', 'phone', 'preferredChannel', 'preferredName', 'segment', 'status'];
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch || {}, key)) {
      if (key === 'preferredChannel' && !CHANNELS.includes(patch[key])) throw new Error('Choose a valid preferred channel.');
      if (key === 'email' && patch[key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch[key]))) throw new Error('Enter a valid email address.');
      if (key === 'status' && !['Active', 'Restricted', 'Inactive'].includes(patch[key])) throw new Error('Choose a valid customer status.');
      customer[key] = clean(patch[key], key === 'email' ? 160 : 100);
    }
    if (patch && patch.consent) customer.consent = { ...customer.consent, email: !!patch.consent.email, sms: !!patch.consent.sms, marketing: !!patch.consent.marketing };
    log(state, `Customer profile ${customer.id} updated.`, at); return customer;
  }
  function addCustomerNote(state, customerId, note, author, at) {
    const customer = getCustomer(state, customerId); if (!customer) throw new Error('Customer not found.');
    const text = clean(note, 900); if (text.length < 10) throw new Error('Customer note must contain at least 10 characters.');
    const record = { id: id('cnote'), at: iso(at), author: clean(author || 'Agent', 100), text };
    customer.notes = Array.isArray(customer.notes) ? customer.notes : []; customer.notes.unshift(record); customer.notes = customer.notes.slice(0, 100);
    log(state, `A note was added to ${customer.id}.`, at); return record;
  }
  function validateCaseInput(state, input) {
    if (!input || !getCustomer(state, input.customerId)) throw new Error('Choose an existing customer profile.');
    const subject = clean(input.subject, 160), description = clean(input.description, 1400);
    if (subject.length < 5) throw new Error('Case subject must contain at least five characters.');
    if (description.length < 20) throw new Error('Case description must contain at least 20 characters.');
    if (!PRODUCTS.some((p) => p.id === input.productId)) throw new Error('Choose a valid product or service.');
    if (!CATEGORIES.includes(input.category)) throw new Error('Choose a valid case category.');
    if (!PRIORITIES.includes(input.priority)) throw new Error('Choose a valid priority.');
    if (!CHANNELS.includes(input.channel)) throw new Error('Choose a valid contact channel.');
    return { customerId: input.customerId, subject, description, productId: input.productId, category: input.category, priority: input.priority, channel: input.channel, owner: clean(input.owner || 'Unassigned', 100), team: clean(input.team || 'Customer Care', 100), tags: Array.isArray(input.tags) ? input.tags.map((x) => clean(x, 40)).filter(Boolean).slice(0, 12) : [] };
  }
  function findPossibleDuplicateCase(state, input) {
    const subject = clean(input.subject, 160).toLowerCase();
    return state.cases.find((item) => item.customerId === input.customerId && !['Resolved', 'Closed'].includes(item.status) && item.category === input.category && item.subject.toLowerCase() === subject) || null;
  }
  function createCase(state, input, at) {
    const fields = validateCaseInput(state, input); const duplicate = findPossibleDuplicateCase(state, fields);
    if (duplicate) throw new Error(`Possible duplicate case: ${duplicate.reference}. Add to the existing case instead.`);
    const now = iso(at); const reference = `CASE-${new Date(now).getUTCFullYear()}-${Math.random().toString(10).slice(2, 8).padEnd(6, '0')}`;
    const item = { id: id('case'), reference, ...fields, status: 'New', createdAt: now, updatedAt: now, dueAt: addMinutes(now, SLA_MINUTES[fields.priority]), pausedAt: null, pausedMs: 0, resolvedAt: null, closedAt: null, sourceIncidentId: null, sourceIncidentReference: null, interactions: [], tasks: [], timeline: [{ id: id('evt'), at: now, type: 'created', text: 'Case created.' }], resolution: null, satisfaction: null };
    state.cases.unshift(item); const customer = getCustomer(state, item.customerId); customer.lastContactAt = now;
    log(state, `${item.reference} created for ${customer.firstName} ${customer.lastName}.`, now); return item;
  }
  function appendTimeline(item, type, text, at) { item.timeline.unshift({ id: id('evt'), at: iso(at), type: clean(type, 30), text: clean(text, 600) }); item.timeline = item.timeline.slice(0, 150); }
  function assignCase(state, caseId, owner, team, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    if (item.status === 'Closed') throw new Error('Closed cases cannot be reassigned.');
    const nextOwner = clean(owner, 100); if (nextOwner.length < 2 || nextOwner.toLowerCase() === 'unassigned') throw new Error('Enter a named case owner.');
    const previous = item.owner; item.owner = nextOwner; if (team) item.team = clean(team, 100);
    item.updatedAt = iso(at); appendTimeline(item, 'assignment', `Ownership changed from ${previous} to ${item.owner}.`, at); log(state, `${item.reference} assigned to ${item.owner}.`, at); return item;
  }
  function updateStatus(state, caseId, nextStatus, note, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    if (nextStatus === item.status) return item;
    if (!STATUSES.includes(nextStatus) || !TRANSITIONS[item.status].includes(nextStatus)) throw new Error(`Status cannot move from ${item.status} to ${nextStatus}.`);
    const now = iso(at);
    if (item.status === 'Pending Customer' && item.pausedAt && nextStatus !== 'Pending Customer') {
      item.pausedMs += Math.max(0, new Date(now).getTime() - new Date(item.pausedAt).getTime()); item.pausedAt = null;
    }
    if (nextStatus === 'Pending Customer') item.pausedAt = now;
    if (nextStatus === 'Resolved') {
      const resolution = clean(note, 700); if (resolution.length < 20) throw new Error('Enter a resolution summary of at least 20 characters before resolving.');
      item.resolution = resolution; item.resolvedAt = now;
    }
    if (item.status === 'Resolved' && nextStatus === 'Open') {
      const reason = clean(note, 700);
      if (reason.length < 20) throw new Error('Enter at least 20 characters explaining why the case is being reopened.');
      item.previousResolutions = Array.isArray(item.previousResolutions) ? item.previousResolutions : [];
      item.previousResolutions.unshift({ summary: item.resolution, resolvedAt: item.resolvedAt, reopenedAt: now, reason });
      item.resolution = null; item.resolvedAt = null;
    }
    if (nextStatus === 'Closed') {
      if (!item.resolution || item.resolution.length < 20) throw new Error('A case must have a recorded resolution before closure.');
      if (item.tasks.some((task) => task.status !== 'Complete')) throw new Error('Complete or cancel outstanding tasks before closing the case.');
      item.closedAt = now;
    }
    const prior = item.status; item.status = nextStatus; item.updatedAt = now;
    appendTimeline(item, 'status', `Status changed from ${prior} to ${nextStatus}${note ? `: ${clean(note, 300)}` : '.'}`, now);
    log(state, `${item.reference} moved to ${nextStatus}.`, now); return item;
  }
  function addInteraction(state, caseId, input, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    if (item.status === 'Closed') throw new Error('Closed cases cannot receive new interactions.');
    if (!CHANNELS.includes(input && input.channel)) throw new Error('Choose a valid channel.');
    const summary = clean(input.summary, 1000); if (summary.length < 15) throw new Error('Interaction summary must contain at least 15 characters.');
    const visibility = input.visibility || 'Internal'; if (!['Internal', 'Customer-facing'].includes(visibility)) throw new Error('Choose a valid visibility.');
    const interaction = { id: id('int'), at: iso(at), channel: input.channel, direction: input.direction === 'Outbound' ? 'Outbound' : 'Inbound', visibility, agent: clean(input.agent || item.owner, 100), summary };
    item.interactions.unshift(interaction); item.updatedAt = interaction.at; appendTimeline(item, 'interaction', `${interaction.direction} ${interaction.channel} interaction recorded (${visibility.toLowerCase()}).`, interaction.at);
    const customer = getCustomer(state, item.customerId); if (customer) customer.lastContactAt = interaction.at;
    log(state, `${interaction.channel} interaction added to ${item.reference}.`, interaction.at); return interaction;
  }
  function addTask(state, caseId, input, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    if (item.status === 'Closed') throw new Error('Closed cases cannot receive tasks.');
    const title = clean(input && input.title, 160), owner = clean(input && input.owner, 100), dueDate = String(input && input.dueDate || '');
    if (title.length < 5 || owner.length < 2) throw new Error('Enter a task and a named owner.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !validDate(`${dueDate}T00:00:00Z`)) throw new Error('Enter a valid task due date.');
    const task = { id: id('task'), title, owner, dueDate, status: 'Open', createdAt: iso(at), completedAt: null };
    item.tasks.unshift(task); appendTimeline(item, 'task', `Follow-up task created: ${title} (${owner}; due ${dueDate}).`, at); log(state, `${item.reference} task created.`, at); return task;
  }
  function completeTask(state, caseId, taskId, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    const task = item.tasks.find((entry) => entry.id === taskId); if (!task) throw new Error('Task not found.');
    if (task.status === 'Complete') throw new Error('Task is already complete.');
    task.status = 'Complete'; task.completedAt = iso(at); appendTimeline(item, 'task', `Task completed: ${task.title}.`, at); log(state, `${item.reference} task completed.`, at); return task;
  }
  function slaStatus(item, now) {
    if (['Resolved', 'Closed'].includes(item.status)) return { state: 'resolved', remainingMs: null, dueAt: item.dueAt, paused: false };
    const paused = item.status === 'Pending Customer' && !!item.pausedAt;
    const pauseMs = item.pausedMs + (paused ? Math.max(0, new Date(now).getTime() - new Date(item.pausedAt).getTime()) : 0);
    const due = new Date(item.dueAt).getTime() + pauseMs;
    const remainingMs = due - new Date(now).getTime();
    return { state: paused ? 'paused' : remainingMs < 0 ? 'breached' : remainingMs <= 4 * 3600000 ? 'due-soon' : 'on-track', remainingMs, dueAt: new Date(due).toISOString(), paused };
  }
  function getCustomerTimeline(state, customerId) {
    const customer = getCustomer(state, customerId); if (!customer) return [];
    const events = [];
    state.cases.filter((item) => item.customerId === customerId).forEach((item) => {
      events.push({ at: item.createdAt, type: 'case', title: `${item.reference}: ${item.subject}`, detail: `${item.status} · ${item.owner}`, caseId: item.id });
      item.interactions.forEach((entry) => events.push({ at: entry.at, type: 'interaction', title: `${entry.direction} ${entry.channel}`, detail: entry.summary, caseId: item.id }));
      item.timeline.filter((entry) => entry.type !== 'created').forEach((entry) => events.push({ at: entry.at, type: entry.type, title: entry.type, detail: entry.text, caseId: item.id }));
    });
    (customer.notes || []).forEach((note) => events.push({ at: note.at, type: 'note', title: `Note by ${note.author}`, detail: note.text, caseId: null }));
    return events.sort((a, b) => b.at.localeCompare(a.at));
  }
  function searchCustomers(state, query) {
    const q = clean(query, 120).toLowerCase(); if (!q) return state.customers.slice();
    return state.customers.filter((c) => [c.id, c.firstName, c.lastName, c.email, c.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  }
  function searchCases(state, filters = {}) {
    const q = clean(filters.query, 160).toLowerCase();
    return state.cases.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (filters.priority && item.priority !== filters.priority) return false;
      if (filters.owner && item.owner !== filters.owner) return false;
      if (filters.productId && item.productId !== filters.productId) return false;
      if (q) {
        const customer = getCustomer(state, item.customerId);
        const haystack = [item.reference, item.subject, item.description, item.owner, item.team, customer && `${customer.firstName} ${customer.lastName}`].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => priorityIndex(a.priority) - priorityIndex(b.priority) || a.createdAt.localeCompare(b.createdAt));
  }
  function getMetrics(state, now) {
    const active = state.cases.filter((item) => !['Resolved', 'Closed'].includes(item.status));
    const sla = active.map((item) => ({ item, result: slaStatus(item, now) }));
    return {
      customers: state.customers.length, totalCases: state.cases.length, activeCases: active.length,
      newCases: active.filter((item) => item.status === 'New').length,
      breached: sla.filter((entry) => entry.result.state === 'breached').length,
      dueSoon: sla.filter((entry) => entry.result.state === 'due-soon').length,
      pendingCustomer: active.filter((item) => item.status === 'Pending Customer').length,
      pendingInternal: active.filter((item) => item.status === 'Pending Internal').length,
      resolved: state.cases.filter((item) => item.status === 'Resolved' || item.status === 'Closed').length
    };
  }
  function readLinkedIncidents(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    try {
      const raw = JSON.parse(storage.getItem(RELIABILITY_KEY) || 'null');
      return raw && Array.isArray(raw.incidents) ? raw.incidents.filter((i) => i && !['Closed'].includes(i.status)).map((i) => ({ id: i.id, reference: i.reference || i.id, title: clean(i.title, 140), productId: PRODUCTS.some((p) => p.id === i.productId) ? i.productId : 'general', severity: clean(i.severity, 40), status: clean(i.status, 40), summary: clean(i.summary, 700), impact: clean(i.impact, 500), detectedAt: i.detectedAt })) : [];
    } catch (_) { return []; }
  }
  function createCaseFromIncident(state, incident, customerId, owner, at) {
    if (!incident || !incident.id || !incident.reference) throw new Error('Choose a valid reliability incident.');
    const priority = incident.severity === 'SEV 1 - Critical' ? 'P1 - Urgent' : incident.severity === 'SEV 2 - High' ? 'P2 - High' : incident.severity === 'SEV 3 - Moderate' ? 'P3 - Normal' : 'P4 - Low';
    const customer = getCustomer(state, customerId);
    if (!customer) throw new Error('Choose a customer profile to anchor the service-impact case.');
    const item = createCase(state, { customerId, subject: `Service incident follow-up: ${incident.title}`, description: `${incident.summary || incident.impact || 'A service incident requires a customer impact follow-up.'} Incident reference ${incident.reference}. Confirm the impact and agreed customer update.`, productId: incident.productId, category: 'Service disruption', priority, channel: 'Internal transfer', owner: owner || 'Service Recovery Queue', team: 'Service Recovery', tags: ['linked-incident', incident.reference] }, at);
    item.sourceIncidentId = incident.id; item.sourceIncidentReference = incident.reference;
    appendTimeline(item, 'incident-link', `Linked to reliability incident ${incident.reference}.`, at);
    return item;
  }
  function searchPublishedKnowledge(query, storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return [];
    const q = clean(query, 160).toLowerCase();
    try {
      const raw = JSON.parse(storage.getItem(KNOWLEDGE_KEY) || 'null');
      const articles = raw && Array.isArray(raw.articles) ? raw.articles : [];
      const date = new Date(now || Date.now()).toISOString().slice(0, 10);
      return articles.filter((article) => article && article.status === 'Published' && (!article.expiresAt || article.expiresAt >= date)).filter((article) => !q || [article.title, article.summary, article.keywords, article.productId, article.category].join(' ').toLowerCase().includes(q)).slice(0, 12).map((article) => ({ id: article.id, title: clean(article.title, 180), summary: clean(article.summary, 700), productId: article.productId, category: article.category, updatedAt: article.updatedAt, version: article.version }));
    } catch (_) { return []; }
  }
  function addArticleReference(state, caseId, article, at) {
    const item = getCase(state, caseId); if (!item) throw new Error('Case not found.');
    if (!article || !article.id || !article.title) throw new Error('Choose a published knowledge article.');
    item.tags = Array.isArray(item.tags) ? item.tags : [];
    const token = `kb:${article.id}`; if (!item.tags.includes(token)) item.tags.push(token);
    appendTimeline(item, 'knowledge-reference', `Knowledge article referenced: ${clean(article.title, 160)} (v${Number(article.version) || 1}).`, at);
    log(state, `Knowledge article ${article.id} linked to ${item.reference}.`, at); return item;
  }
  function exportCasesCsv(state) {
    const rows = [['Reference', 'Customer ID', 'Subject', 'Product', 'Category', 'Priority', 'Channel', 'Status', 'Owner', 'Team', 'Created', 'SLA due', 'Linked incident']];
    state.cases.forEach((item) => rows.push([item.reference, item.customerId, item.subject, productName(item.productId), item.category, item.priority, item.channel, item.status, item.owner, item.team, item.createdAt, item.dueAt, item.sourceIncidentReference || '']));
    return rows.map((row) => row.map((value) => {
      let text = String(value == null ? '' : value);
      if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    }).join(',')).join('\r\n');
  }

  return {
    VERSION, STORAGE_KEY, RELIABILITY_KEY, KNOWLEDGE_KEY, CHANNELS, PRIORITIES, STATUSES, CATEGORIES, PRODUCTS, SLA_MINUTES, DEMO_CUSTOMERS,
    clean, iso, createEmptyState, createInitialState, normaliseState, load, save, getCustomer, getCase, createCustomer,
    findPossibleDuplicateCustomer, updateCustomer, addCustomerNote, validateCaseInput, findPossibleDuplicateCase,
    createCase, assignCase, updateStatus, addInteraction, addTask, completeTask, slaStatus, getCustomerTimeline,
    searchCustomers, searchCases, getMetrics, readLinkedIncidents, createCaseFromIncident, searchPublishedKnowledge,
    addArticleReference, exportCasesCsv
  };
});
