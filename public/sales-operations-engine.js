(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.CalloriaSalesOperationsEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = '5.7.0';
  const STORAGE_KEY = 'calloria.sales-operations.v57';
  const CUSTOMER_KEY = 'calloria.customer-journey.v54';
  const WORKBENCH_KEY = 'calloria.agent-workbench.v55';
  const CHANNELS = ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app', 'Video meeting'];
  const TYPES = ['Cross-sell', 'New business', 'Renewal', 'Sponsorship', 'Advertising', 'Partnership'];
  const SOURCES = ['Inbound enquiry', 'Existing customer need', 'Completed service contact', 'Customer referral', 'Approved campaign', 'Partner referral'];
  const STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost', 'Disqualified'];
  const ACTIVE_STAGES = ['New', 'Qualified', 'Proposal', 'Negotiation'];
  const LOSS_REASONS = ['Customer declined', 'No current need', 'Budget unavailable', 'Timing not suitable', 'Competitor selected', 'No response after agreed follow-up', 'Service fit not suitable', 'Other'];
  const PRODUCTS = [
    { id: 'general', name: 'General customer service', group: 'Service' },
    { id: 'ruffneck-lms', name: 'RuffNeck LMS', group: 'RuffNeck platform' },
    { id: 'ruffneck-prospector', name: 'RuffNeck Prospector', group: 'RuffNeck platform' },
    { id: 'ruffneck-connect', name: 'RuffNeck Connect', group: 'RuffNeck platform' },
    { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub', group: 'RuffNeck platform' },
    { id: 'kano-run', name: 'Kano Run', group: 'Game' },
    { id: 'kano-keke', name: 'Kano Keke', group: 'Game' },
    { id: 'sponsorship', name: 'Sponsorship proposal', group: 'Commercial' },
    { id: 'advertising', name: 'Advertising opportunity', group: 'Commercial' },
    { id: 'other-service', name: 'Other approved service', group: 'Service' }
  ];
  const TRANSITIONS = {
    New: ['Qualified', 'Disqualified'],
    Qualified: ['Proposal', 'Lost', 'Disqualified'],
    Proposal: ['Negotiation', 'Won', 'Lost'],
    Negotiation: ['Won', 'Lost'],
    Won: [], Lost: [], Disqualified: []
  };

  function clean(value, max = 800) {
    return String(value == null ? '' : value).replace(/[<>]/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function id(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function iso(value) { const date = value instanceof Date ? value : new Date(value == null ? Date.now() : value); if (Number.isNaN(date.getTime())) throw new Error('Enter a valid date and time.'); return date.toISOString(); }
  function addHours(value, hours) { return new Date(new Date(value).getTime() + hours * 3600000).toISOString(); }
  function productName(productId) { return (PRODUCTS.find((item) => item.id === productId) || PRODUCTS[0]).name; }
  function getOpportunity(state, opportunityId) { return state.opportunities.find((item) => item.id === opportunityId || item.reference === opportunityId) || null; }
  function getProduct(productId) { return PRODUCTS.find((item) => item.id === productId) || null; }
  function validBoolean(value) { return value === true || value === 'true' || value === 1; }
  function moneyValue(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1e12) throw new Error('Estimated value must be a valid non-negative amount.');
    return Math.round(number * 100) / 100;
  }

  function demoOpportunities(now) {
    const t = new Date(now).getTime();
    const seeds = [
      { id: 'OPP-57001', reference: 'SO-2026-570001', customerId: 'CUS-1006', customerName: 'Daniel Okafor', type: 'Sponsorship', productId: 'sponsorship', source: 'Inbound enquiry', channel: 'Email', stage: 'Qualified', owner: 'Partnerships Desk', need: 'The organisation wants to explore a possible player engagement sponsorship opportunity.', fit: 'A proposal review can assess audience fit and campaign objectives without promising reach or inventory.', permission: true, permissionNote: 'Customer requested a proposal discussion.', estimatedValue: 0, currency: 'NGN', nextAction: 'Confirm proposal requirements and approved review contact.', followUpAt: addHours(new Date(t).toISOString(), 20), createdHoursAgo: 4, demo: true },
      { id: 'OPP-57002', reference: 'SO-2026-570002', customerId: 'CUS-1003', customerName: 'Zainab Yusuf', type: 'Cross-sell', productId: 'ruffneck-connect', source: 'Existing customer need', channel: 'Live chat', stage: 'New', need: 'Customer asked how to coordinate updates across the social workspace and connected service.', fit: 'A guided demonstration can establish whether the Connect workflow meets the stated coordination need.', permission: false, permissionNote: '', estimatedValue: null, currency: 'NGN', nextAction: 'Ask whether the customer wants a separate product discussion.', followUpAt: addHours(new Date(t).toISOString(), 30), createdHoursAgo: 1, demo: true },
      { id: 'OPP-57003', reference: 'SO-2026-570003', customerId: 'CUS-1002', customerName: 'Musa Garba', type: 'Cross-sell', productId: 'ruffneck-lms', source: 'Completed service contact', channel: 'Voice', stage: 'Lost', need: 'Customer asked about learning resources for a group.', fit: 'LMS information was relevant but timing did not suit the customer.', permission: true, permissionNote: 'Customer agreed to discuss the service during the inbound call.', estimatedValue: 0, currency: 'NGN', nextAction: 'No further action requested.', followUpAt: null, createdHoursAgo: 60, lostReason: 'Timing not suitable', demo: true }
    ];
    return seeds.map((seed) => { const { createdHoursAgo, ...rest } = seed; const createdAt = new Date(t - createdHoursAgo * 3600000).toISOString(); return { ...rest, createdAt, updatedAt: createdAt, proposal: null, followUps: [], notes: [], outcome: null, timeline: [{ id: id('evt'), at: createdAt, text: 'Demonstration opportunity loaded.' }] }; });
  }

  function createInitialState(now) {
    const current = iso(now);
    return {
      version: VERSION,
      opportunities: demoOpportunities(current),
      suppression: [],
      activity: [{ id: id('act'), at: current, message: 'Sales and partnership demonstration workspace loaded.' }],
      integration: { customerKey: CUSTOMER_KEY, workbenchKey: WORKBENCH_KEY, lastCustomerReadAt: null, lastContactReadAt: null }
    };
  }
  function normaliseState(raw, now) {
    const fresh = createInitialState(now);
    if (!raw || typeof raw !== 'object') return fresh;
    return {
      ...fresh, ...raw,
      opportunities: Array.isArray(raw.opportunities) ? raw.opportunities.map((item) => ({
        ...item,
        followUps: Array.isArray(item.followUps) ? item.followUps : [],
        notes: Array.isArray(item.notes) ? item.notes : [],
        timeline: Array.isArray(item.timeline) ? item.timeline : [],
        proposal: item.proposal && typeof item.proposal === 'object' ? item.proposal : null
      })) : fresh.opportunities,
      suppression: Array.isArray(raw.suppression) ? raw.suppression : [],
      activity: Array.isArray(raw.activity) ? raw.activity : [],
      integration: { ...fresh.integration, ...(raw.integration || {}) }
    };
  }
  function load(storage, now) {
    if (!storage || typeof storage.getItem !== 'function') return createInitialState(now);
    try { const raw = JSON.parse(storage.getItem(STORAGE_KEY) || 'null'); return raw ? normaliseState(raw, now) : createInitialState(now); }
    catch (_) { return createInitialState(now); }
  }
  function save(state, storage) { if (!storage || typeof storage.setItem !== 'function') return false; try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (_) { return false; } }
  function log(state, message, at) { state.activity.unshift({ id: id('act'), at: iso(at), message: clean(message, 260) }); state.activity = state.activity.slice(0, 250); }
  function appendEvent(item, text, at) { item.timeline.unshift({ id: id('evt'), at: iso(at), text: clean(text, 500) }); item.timeline = item.timeline.slice(0, 100); }
  function isSuppressed(state, customerId) { return state.suppression.some((row) => row.customerId === customerId && row.active); }
  function activeServiceRisk(customerState, customerId) {
    if (!customerState || !Array.isArray(customerState.cases)) return false;
    return customerState.cases.some((item) => item.customerId === customerId && !['Resolved', 'Closed'].includes(item.status) && (String(item.category || '').toLowerCase().includes('complaint') || String(item.category || '').toLowerCase().includes('recovery') || String(item.priority || '').startsWith('P1')));
  }
  function validateOpportunity(input) {
    if (!input || typeof input !== 'object') throw new Error('Opportunity details are required.');
    const customerId = clean(input.customerId, 80);
    if (customerId && !/^[A-Za-z0-9_-]{3,80}$/.test(customerId)) throw new Error('Enter a valid customer reference.');
    const customerName = clean(input.customerName, 140);
    if (!customerId && customerName.length < 3) throw new Error('Enter a customer or prospect name.');
    if (!TYPES.includes(input.type)) throw new Error('Choose a valid opportunity type.');
    if (!getProduct(input.productId)) throw new Error('Choose a valid product or commercial opportunity.');
    if (!SOURCES.includes(input.source)) throw new Error('Choose a valid opportunity source.');
    if (!CHANNELS.includes(input.channel)) throw new Error('Choose a valid contact channel.');
    const need = clean(input.need, 1000); if (need.length < 20) throw new Error('Customer need must contain at least 20 characters.');
    const fit = clean(input.fit, 1000); if (fit.length < 20) throw new Error('Product-fit evidence must contain at least 20 characters.');
    const owner = clean(input.owner || 'Unassigned', 100); if (owner.length < 2) throw new Error('Enter an opportunity owner.');
    const nextAction = clean(input.nextAction, 400); if (nextAction.length < 8) throw new Error('Enter a specific next action.');
    const followUpAt = input.followUpAt ? iso(input.followUpAt) : null;
    if (ACTIVE_STAGES.includes(input.stage || 'New') && !followUpAt) throw new Error('Active opportunities require a dated next action.');
    return {
      customerId: customerId || null, customerName, type: input.type, productId: input.productId,
      source: input.source, channel: input.channel, owner, team: clean(input.team || 'Sales & Partnerships', 100),
      need, fit, permission: validBoolean(input.permission), permissionNote: clean(input.permissionNote, 500),
      estimatedValue: moneyValue(input.estimatedValue), currency: 'NGN', nextAction, followUpAt,
      marketingConsent: validBoolean(input.marketingConsent), serviceRiskAcknowledged: validBoolean(input.serviceRiskAcknowledged)
    };
  }
  function createOpportunity(state, input, at) {
    const fields = validateOpportunity(input);
    if (fields.customerId && isSuppressed(state, fields.customerId)) throw new Error('This customer is on the do-not-contact register. Do not create a new sales opportunity.');
    const now = iso(at);
    const reference = `SO-${new Date(now).getUTCFullYear()}-${Math.random().toString(10).slice(2, 8).padEnd(6, '0')}`;
    const item = { id: id('opp'), reference, ...fields, stage: 'New', createdAt: now, updatedAt: now, proposal: null, followUps: [], notes: [], outcome: null, timeline: [{ id: id('evt'), at: now, text: 'Opportunity created.' }], demo: false };
    state.opportunities.unshift(item); log(state, `${reference} created for ${item.customerName}.`, now); return item;
  }
  function qualifyOpportunity(state, opportunityId, context, at) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    if (item.stage !== 'New') throw new Error('Only new opportunities can be qualified.');
    if (item.customerId && isSuppressed(state, item.customerId)) throw new Error('Customer is suppressed from sales contact.');
    if (!item.permission || item.permissionNote.length < 8) throw new Error('Record the customer\'s explicit permission and how it was obtained before qualification.');
    if (!item.need || item.need.length < 20 || !item.fit || item.fit.length < 20) throw new Error('Document the customer need and evidence of product fit.');
    if (!context || context.suitabilityConfirmed !== true) throw new Error('Confirm product suitability with the customer before qualification.');
    if (context.customerState && item.customerId) {
      const customer = context.customerState.customers && context.customerState.customers.find((row) => row.id === item.customerId);
      if (customer && customer.status !== 'Active') throw new Error('This customer profile is not active. Resolve the customer status before qualification.');
      if (activeServiceRisk(context.customerState, item.customerId) && context.serviceRiskAcknowledged !== true) throw new Error('An open complaint, service-recovery case or urgent P1 case exists. Resolve it first or record a supervisor-approved service-risk review.');
    }
    if (context.serviceRiskAcknowledged === true && !clean(context.serviceRiskReason, 20)) throw new Error('A service-risk override requires a documented supervisor review of at least 20 characters.');
    const now = iso(at); item.stage = 'Qualified'; item.serviceRiskAcknowledged = context.serviceRiskAcknowledged === true; item.serviceRiskReason = clean(context.serviceRiskReason, 500); item.updatedAt = now;
    appendEvent(item, 'Opportunity qualified after permission, customer need, fit and suitability checks.', now); log(state, `${item.reference} qualified.`, now); return item;
  }
  function createProposal(state, opportunityId, input, at) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    if (!['Qualified', 'Proposal'].includes(item.stage)) throw new Error('A proposal can only be prepared for a qualified opportunity.');
    const summary = clean(input && input.summary, 1000); const terms = clean(input && input.terms, 1200); const disclosures = clean(input && input.disclosures, 1000);
    if (summary.length < 20 || terms.length < 20 || disclosures.length < 20) throw new Error('Proposal summary, terms and limitations/disclosures must each contain at least 20 characters.');
    const value = moneyValue(input && input.estimatedValue);
    const discount = Number(input && input.discountPercent || 0);
    if (!Number.isFinite(discount) || discount < 0 || discount > 50) throw new Error('Discount must be from 0% to 50%.');
    if (discount > 20 && input.supervisorApproved !== true) throw new Error('Discounts above 20% require supervisor approval.');
    const now = iso(at);
    item.proposal = { summary, terms, disclosures, estimatedValue: value, currency: 'NGN', discountPercent: discount, supervisorApproved: input.supervisorApproved === true, basis: clean(input.basis || 'Approved internal estimate', 100), preparedAt: now, preparedBy: clean(input.preparedBy || item.owner, 100), status: 'Draft for review' };
    item.stage = 'Proposal'; item.updatedAt = now; appendEvent(item, 'Proposal prepared as a draft for customer review; no price or availability is committed.', now); log(state, `Proposal prepared for ${item.reference}.`, now); return item;
  }
  function transitionStage(state, opportunityId, nextStage, detail, at) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    if (!STAGES.includes(nextStage) || !TRANSITIONS[item.stage].includes(nextStage)) throw new Error(`Stage cannot move from ${item.stage} to ${nextStage}.`);
    const now = iso(at); let outcome = null;
    if (nextStage === 'Won') {
      const evidence = clean(detail && detail.evidence, 40); if (evidence.length < 20) throw new Error('A won opportunity requires at least 20 characters of customer acceptance or order evidence.');
      outcome = { type: 'Won', evidence, recordedAt: now, recordedBy: clean(detail.recordedBy || item.owner, 100) };
    }
    if (nextStage === 'Lost' || nextStage === 'Disqualified') {
      const reason = clean(detail && detail.reason, 500); if (reason.length < 10) throw new Error('Record a clear reason before closing this opportunity.');
      if (nextStage === 'Lost' && !LOSS_REASONS.includes(detail.lossReason)) throw new Error('Choose a valid loss reason.');
      outcome = { type: nextStage, reason, lossReason: detail.lossReason || null, recordedAt: now, recordedBy: clean(detail.recordedBy || item.owner, 100) };
    }
    const previous = item.stage; item.stage = nextStage; item.updatedAt = now; if (outcome) item.outcome = outcome;
    appendEvent(item, `Stage changed from ${previous} to ${nextStage}${outcome ? `: ${outcome.reason || outcome.evidence}` : ''}.`, now); log(state, `${item.reference} moved to ${nextStage}.`, now); return item;
  }
  function addFollowUp(state, opportunityId, input, at, customerState) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    if (!ACTIVE_STAGES.includes(item.stage)) throw new Error('Follow-ups can only be added to active opportunities.');
    if (item.customerId && isSuppressed(state, item.customerId)) throw new Error('Customer is suppressed from sales contact.');
    if (!item.permission) throw new Error('Customer permission is required before scheduling a sales follow-up.');
    const channel = input && input.channel; if (!CHANNELS.includes(channel)) throw new Error('Choose a valid follow-up channel.');
    if (input.marketingMessage === true) {
      const customer = customerState && Array.isArray(customerState.customers) ? customerState.customers.find((row) => row.id === item.customerId) : null;
      if (!customer || !(customer.consent && customer.consent.marketing)) throw new Error('Marketing follow-ups require an existing Customer 360 profile with marketing consent recorded.');
    }
    const dueAt = iso(input && input.dueAt); const action = clean(input && input.action, 400); if (action.length < 8) throw new Error('Enter a clear follow-up action.');
    const now = iso(at); const followUp = { id: id('fu'), channel, dueAt, action, owner: clean(input.owner || item.owner, 100), marketingMessage: input.marketingMessage === true, status: 'Scheduled', createdAt: now };
    item.followUps.unshift(followUp); item.followUpAt = dueAt; item.nextAction = action; item.updatedAt = now;
    appendEvent(item, `Follow-up scheduled for ${dueAt} via ${channel}.`, now); log(state, `Follow-up scheduled for ${item.reference}.`, now); return followUp;
  }
  function completeFollowUp(state, opportunityId, followUpId, outcome, at) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    const followUp = item.followUps.find((row) => row.id === followUpId); if (!followUp) throw new Error('Follow-up not found.');
    if (followUp.status !== 'Scheduled') throw new Error('Only scheduled follow-ups can be completed.');
    const summary = clean(outcome, 15); if (!['Completed', 'Customer declined', 'No response', 'Rescheduled'].includes(summary)) throw new Error('Choose a valid follow-up outcome.');
    const now = iso(at); followUp.status = summary; followUp.completedAt = now;
    appendEvent(item, `Follow-up ${summary.toLowerCase()} via ${followUp.channel}.`, now); item.updatedAt = now; log(state, `${item.reference} follow-up ${summary.toLowerCase()}.`, now); return followUp;
  }
  function setDoNotContact(state, customerId, reason, at) {
    const customer = clean(customerId, 80); if (!customer) throw new Error('Customer reference is required.');
    const note = clean(reason, 500); if (note.length < 10) throw new Error('Record why the customer requested no further sales contact.');
    const now = iso(at); let row = state.suppression.find((item) => item.customerId === customer);
    if (!row) { row = { customerId: customer, active: true, reason: note, createdAt: now, updatedAt: now }; state.suppression.unshift(row); }
    else { row.active = true; row.reason = note; row.updatedAt = now; }
    log(state, `${customer} added to the sales do-not-contact register.`, now); return row;
  }
  function addNote(state, opportunityId, text, author, at) {
    const item = getOpportunity(state, opportunityId); if (!item) throw new Error('Opportunity not found.');
    const note = clean(text, 1000); if (note.length < 10) throw new Error('Note must contain at least 10 characters.');
    const row = { id: id('note'), at: iso(at), author: clean(author || item.owner, 100), text: note };
    item.notes.unshift(row); item.notes = item.notes.slice(0, 100); item.updatedAt = row.at; appendEvent(item, `Note added by ${row.author}.`, at); return row;
  }
  function importCustomers(customerState) {
    if (!customerState || !Array.isArray(customerState.customers)) return [];
    return customerState.customers.map((customer) => ({ id: customer.id, name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(), status: customer.status || 'Unknown', preferredChannel: customer.preferredChannel || '', marketingConsent: !!(customer.consent && customer.consent.marketing), services: Array.isArray(customer.services) ? customer.services.slice() : [] }));
  }
  function importCompletedContacts(workbenchState) {
    if (!workbenchState || !Array.isArray(workbenchState.contacts)) return [];
    return workbenchState.contacts.filter((item) => item && item.status === 'Completed').map((item) => ({ id: item.id, customerId: item.customerId || '', customerName: item.customerName || '', contactRef: item.reference || item.id, productId: getProduct(item.productId) ? item.productId : 'general', channel: CHANNELS.includes(item.channel) ? item.channel : 'Voice', subject: clean(item.subject || '', 180), source: 'Completed service contact' }));
  }
  function buildDashboard(state, now) {
    const timestamp = new Date(now == null ? Date.now() : now).getTime();
    const active = state.opportunities.filter((item) => ACTIVE_STAGES.includes(item.stage));
    const won = state.opportunities.filter((item) => item.stage === 'Won');
    const lost = state.opportunities.filter((item) => item.stage === 'Lost');
    const dueFollowUps = [];
    state.opportunities.forEach((item) => (item.followUps || []).forEach((followUp) => { if (followUp.status === 'Scheduled') dueFollowUps.push({ ...followUp, opportunityId: item.id, reference: item.reference, customerName: item.customerName, overdue: new Date(followUp.dueAt).getTime() < timestamp }); }));
    const estimatedPipeline = active.reduce((sum, item) => sum + (Number(item.proposal && item.proposal.estimatedValue != null ? item.proposal.estimatedValue : item.estimatedValue) || 0), 0);
    const wonEstimate = won.reduce((sum, item) => sum + (Number(item.proposal && item.proposal.estimatedValue != null ? item.proposal.estimatedValue : item.estimatedValue) || 0), 0);
    const outcomes = won.length + lost.length;
    return {
      total: state.opportunities.length, active: active.length, qualified: state.opportunities.filter((item) => ['Qualified', 'Proposal', 'Negotiation'].includes(item.stage)).length,
      proposals: state.opportunities.filter((item) => item.stage === 'Proposal' || item.stage === 'Negotiation').length,
      won: won.length, lost: lost.length, conversionPercent: outcomes ? Math.round(won.length / outcomes * 1000) / 10 : 0,
      estimatedPipeline, wonEstimate, openFollowUps: dueFollowUps.length, overdueFollowUps: dueFollowUps.filter((item) => item.overdue).length,
      doNotContact: state.suppression.filter((item) => item.active).length, dueFollowUps
    };
  }
  function toCsv(rows, columns) {
    const cell = (value) => { let text = String(value == null ? '' : value); if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    return [columns.map((column) => cell(column.label)).join(','), ...rows.map((row) => columns.map((column) => cell(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(','))].join('\r\n');
  }
  return {
    VERSION, STORAGE_KEY, CUSTOMER_KEY, WORKBENCH_KEY, CHANNELS, TYPES, SOURCES, STAGES, ACTIVE_STAGES, LOSS_REASONS, PRODUCTS, TRANSITIONS,
    clean, iso, addHours, productName, getProduct, getOpportunity, isSuppressed, activeServiceRisk,
    createInitialState, normaliseState, load, save, validateOpportunity, createOpportunity, qualifyOpportunity,
    createProposal, transitionStage, addFollowUp, completeFollowUp, setDoNotContact, addNote,
    importCustomers, importCompletedContacts, buildDashboard, toCsv
  };
});
