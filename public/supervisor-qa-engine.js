(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CalloriaSupervisorQAEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'calloria.supervisor-qa.v47';
  const QA_CRITERIA = [
    { id: 'professionalism', label: 'Greeting and professionalism', weight: 20, critical: false },
    { id: 'verification', label: 'Customer verification and data protection', weight: 20, critical: true },
    { id: 'listening', label: 'Listening and needs discovery', weight: 15, critical: false },
    { id: 'accuracy', label: 'Information accuracy and policy compliance', weight: 20, critical: true },
    { id: 'resolution', label: 'Ownership and resolution', weight: 15, critical: false },
    { id: 'closure', label: 'Recap and professional close', weight: 10, critical: false }
  ];

  const seedAgents = [
    { id: 'ag-104', name: 'Amina Yusuf', team: 'General CX', skill: 'Voice · Email', status: 'On contact', handled: 31, qa: 92, adherence: 96, supervisor: 'M. Bello' },
    { id: 'ag-108', name: 'Daniel Okafor', team: 'Retail Support', skill: 'Voice · Chat', status: 'On contact', handled: 28, qa: 84, adherence: 91, supervisor: 'M. Bello' },
    { id: 'ag-112', name: 'Chiamaka Nwosu', team: 'Telecom Care', skill: 'Chat · Social', status: 'Available', handled: 35, qa: 96, adherence: 98, supervisor: 'S. Garba' },
    { id: 'ag-119', name: 'Ibrahim Musa', team: 'General CX', skill: 'Voice · Email', status: 'Wrap-up', handled: 24, qa: 78, adherence: 88, supervisor: 'S. Garba' },
    { id: 'ag-123', name: 'Fatima Abdullahi', team: 'Utilities Desk', skill: 'Voice · Chat', status: 'Available', handled: 29, qa: 89, adherence: 94, supervisor: 'M. Bello' }
  ];

  const seedInteractions = [
    {
      id: 'cx-74021', agentId: 'ag-104', agent: 'Amina Yusuf', customer: 'Musa A.', channel: 'Voice', subject: 'Payment confirmation not received', status: 'Active', priority: 'High', elapsed: '06:42', started: '09:14', sentiment: 'Concerned', monitored: false, assistance: false, escalationId: null,
      transcript: [
        ['09:14:02', 'Agent', 'Thank you for contacting the service desk. My name is Amina. How may I help you today?'],
        ['09:14:19', 'Customer', 'I made a payment this morning, but I have not received the confirmation message.'],
        ['09:14:38', 'Agent', 'I can check that for you. Before I access the account, may I confirm the registered phone number and the last four digits of your reference?'],
        ['09:15:01', 'Customer', 'The number ends in 2048. I have the reference here.'],
        ['09:15:27', 'Agent', 'Thank you. I can see the transaction is still being reconciled. I will explain the expected update window and log a trace request.'],
        ['09:16:04', 'Customer', 'Please make sure someone follows up. I have been waiting since this morning.']
      ]
    },
    {
      id: 'cx-74018', agentId: 'ag-108', agent: 'Daniel Okafor', customer: 'Grace T.', channel: 'Live chat', subject: 'Delivery status and address correction', status: 'Active', priority: 'Normal', elapsed: '04:18', started: '09:16', sentiment: 'Neutral', monitored: false, assistance: false, escalationId: null,
      transcript: [
        ['09:16:10', 'Agent', 'Welcome to support. I am Daniel. I will review the delivery details with you.'],
        ['09:16:33', 'Customer', 'The tracking page says delivered, but nothing came to my address.'],
        ['09:17:01', 'Agent', 'I understand. Please confirm the order reference. Do not send your card or account password in this chat.'],
        ['09:17:26', 'Customer', 'Order 88219. I also need to correct the apartment number.'],
        ['09:18:02', 'Agent', 'I will check the proof of delivery first, then confirm whether the address can still be amended.']
      ]
    },
    {
      id: 'cx-74011', agentId: 'ag-112', agent: 'Chiamaka Nwosu', customer: 'Peter E.', channel: 'Email', subject: 'Plan change request', status: 'Wrap-up', priority: 'Low', elapsed: '11:05', started: '09:02', sentiment: 'Positive', monitored: true, assistance: false, escalationId: null,
      transcript: [
        ['09:02:11', 'Customer', 'Please move my account to the monthly plan from the next billing date.'],
        ['09:05:43', 'Agent', 'I have checked the available plans and the effective date. The change will take effect on your next billing date.'],
        ['09:07:09', 'Customer', 'That is fine. Please confirm by email.'],
        ['09:12:54', 'Agent', 'The request has been recorded. I have sent the confirmation and included the reference number.']
      ]
    },
    {
      id: 'cx-74004', agentId: 'ag-119', agent: 'Ibrahim Musa', customer: 'Halima S.', channel: 'Voice', subject: 'Repeated service interruption', status: 'Active', priority: 'Urgent', elapsed: '09:31', started: '08:57', sentiment: 'Frustrated', monitored: false, assistance: true, escalationId: 'es-301',
      transcript: [
        ['08:57:03', 'Agent', 'Good morning. You are speaking with Ibrahim. I will take ownership of the issue.'],
        ['08:57:30', 'Customer', 'This is the third interruption this week. I need a clear explanation.'],
        ['08:58:02', 'Agent', 'I am sorry this has happened repeatedly. I will review the incident notes and check the service status for your area.'],
        ['09:00:17', 'Customer', 'The last agent promised a callback and nobody called.'],
        ['09:01:10', 'Agent', 'I can see the previous callback was not completed. I am asking my supervisor to review the case and confirm the next update.']
      ]
    },
    {
      id: 'cx-73997', agentId: 'ag-123', agent: 'Fatima Abdullahi', customer: 'John K.', channel: 'Social', subject: 'Public complaint about billing', status: 'Active', priority: 'High', elapsed: '03:56', started: '09:18', sentiment: 'Frustrated', monitored: false, assistance: false, escalationId: 'es-302',
      transcript: [
        ['09:18:03', 'Customer', 'You charged me twice. I have posted about this because nobody is responding.'],
        ['09:18:42', 'Agent', 'We are sorry for the experience. Please do not post personal or payment details publicly. I have sent a private message so we can verify the account securely.']
      ]
    }
  ];

  const seedEscalations = [
    { id: 'es-301', interactionId: 'cx-74004', agent: 'Ibrahim Musa', customer: 'Halima S.', reason: 'Missed callback and repeat service interruption', priority: 'Urgent', status: 'Open', owner: 'Samuel Garba', created: '09:03', resolution: '' },
    { id: 'es-302', interactionId: 'cx-73997', agent: 'Fatima Abdullahi', customer: 'John K.', reason: 'Public billing complaint', priority: 'High', status: 'In review', owner: 'Maryam Bello', created: '09:19', resolution: '' },
    { id: 'es-298', interactionId: 'cx-73972', agent: 'Daniel Okafor', customer: 'Mary O.', reason: 'Delivery dispute requiring fulfilment review', priority: 'Normal', status: 'Resolved', owner: 'Maryam Bello', created: '08:31', resolution: 'Fulfilment team confirmed a replacement delivery.' }
  ];

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createInitialState() {
    return {
      version: 47,
      agents: deepClone(seedAgents),
      interactions: deepClone(seedInteractions),
      evaluations: [],
      coaching: [],
      escalations: deepClone(seedEscalations),
      activity: [
        { id: 'act-1', time: '09:19', text: 'Escalation ES-302 assigned to M. Bello.' },
        { id: 'act-2', time: '09:12', text: 'Email interaction CX-74011 moved to wrap-up.' },
        { id: 'act-3', time: '09:03', text: 'Urgent escalation ES-301 opened.' }
      ]
    };
  }

  function calculateQaScore(responses) {
    const normalized = {};
    QA_CRITERIA.forEach((criterion) => {
      const value = Number(responses && responses[criterion.id]);
      normalized[criterion.id] = Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : 1;
    });
    const rawScore = QA_CRITERIA.reduce((total, criterion) => total + (normalized[criterion.id] / 5) * criterion.weight, 0);
    const criticalPass = QA_CRITERIA.filter((criterion) => criterion.critical).every((criterion) => normalized[criterion.id] >= 3);
    const score = Math.round(criticalPass ? rawScore : Math.min(rawScore, 49));
    return {
      score,
      rawScore: Math.round(rawScore),
      criticalPass,
      outcome: !criticalPass || score < 70 ? 'Fail' : score >= 85 ? 'Pass' : 'Coaching required',
      responses: normalized
    };
  }

  function createEvaluation(input) {
    if (!input || !input.interactionId || !input.agentId) throw new Error('An interaction and agent are required.');
    const result = calculateQaScore(input.responses || {});
    return {
      id: input.id || `qa-${Date.now()}`,
      interactionId: input.interactionId,
      agentId: input.agentId,
      agent: input.agent || 'Unassigned agent',
      channel: input.channel || 'Voice',
      evaluator: input.evaluator || 'Supervisor',
      date: input.date || new Date().toISOString(),
      score: result.score,
      rawScore: result.rawScore,
      criticalPass: result.criticalPass,
      outcome: result.outcome,
      responses: result.responses,
      notes: String(input.notes || '').trim()
    };
  }

  function createEscalation(input) {
    if (!input || !input.interactionId) throw new Error('An interaction is required.');
    return {
      id: input.id || `es-${Date.now()}`,
      interactionId: input.interactionId,
      agent: input.agent || 'Unassigned agent',
      customer: input.customer || 'Customer',
      reason: String(input.reason || '').trim() || 'Supervisor review requested',
      priority: ['Urgent', 'High', 'Normal', 'Low'].includes(input.priority) ? input.priority : 'Normal',
      status: 'Open',
      owner: input.owner || 'Unassigned',
      created: input.created || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      resolution: ''
    };
  }

  function deriveMetrics(state) {
    const active = state.interactions.filter((item) => item.status === 'Active').length;
    const waiting = state.interactions.filter((item) => item.status === 'Waiting').length;
    const openEscalations = state.escalations.filter((item) => item.status !== 'Resolved').length;
    const qa = state.evaluations.length
      ? Math.round(state.evaluations.reduce((sum, item) => sum + item.score, 0) / state.evaluations.length)
      : Math.round(state.agents.reduce((sum, item) => sum + item.qa, 0) / Math.max(1, state.agents.length));
    const handled = state.agents.reduce((sum, item) => sum + item.handled, 0);
    return { active, waiting, openEscalations, qa, handled, agents: state.agents.length };
  }

  function filterInteractions(interactions, filters) {
    const query = String(filters && filters.query || '').trim().toLowerCase();
    const channel = filters && filters.channel || 'All channels';
    const status = filters && filters.status || 'All statuses';
    const priority = filters && filters.priority || 'All priorities';
    return interactions.filter((item) => {
      const matchesQuery = !query || [item.id, item.agent, item.customer, item.subject].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesChannel = channel === 'All channels' || item.channel === channel;
      const matchesStatus = status === 'All statuses' || item.status === status;
      const matchesPriority = priority === 'All priorities' || item.priority === priority;
      return matchesQuery && matchesChannel && matchesStatus && matchesPriority;
    });
  }

  function loadState(storage) {
    const source = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!source) return createInitialState();
    try {
      const raw = source.getItem(STORAGE_KEY);
      if (!raw) return createInitialState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 47 || !Array.isArray(parsed.interactions) || !Array.isArray(parsed.agents)) return createInitialState();
      return {
        ...createInitialState(),
        ...parsed,
        agents: parsed.agents,
        interactions: parsed.interactions,
        evaluations: Array.isArray(parsed.evaluations) ? parsed.evaluations : [],
        coaching: Array.isArray(parsed.coaching) ? parsed.coaching : [],
        escalations: Array.isArray(parsed.escalations) ? parsed.escalations : [],
        activity: Array.isArray(parsed.activity) ? parsed.activity : []
      };
    } catch (_) {
      return createInitialState();
    }
  }

  function saveState(state, storage) {
    const target = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!target) return false;
    try {
      target.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (_) {
      return false;
    }
  }

  function addActivity(state, text, time) {
    state.activity.unshift({ id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: String(text) });
    state.activity = state.activity.slice(0, 30);
  }

  return {
    STORAGE_KEY,
    QA_CRITERIA,
    createInitialState,
    calculateQaScore,
    createEvaluation,
    createEscalation,
    deriveMetrics,
    filterInteractions,
    loadState,
    saveState,
    addActivity
  };
});
