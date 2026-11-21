import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAgentHandoverPreflight,
  buildAgentHandoverAuditMarkdown,
  renderAgentHandoverPreflightHTML
} from '../js/calloria-agent-handover-preflight-v6-92.mjs';

const baseState = (overrides = {}) => ({
  applicantName: 'Amina Yusuf',
  nameInitials: 'AY',
  day: 4,
  shiftActive: true,
  agentStatus: 'available',
  currentCall: null,
  activeOutbound: null,
  wrapUp: null,
  customerCommitments: { commitments: [] },
  cases: [],
  digitalQueue: [],
  callbacks: [],
  agentHandovers: [],
  ...overrides
});

const fakeEngine = {
  collectAgentHandoverCandidates(resources, actor, actorId, handovers) {
    const rows = [];
    for (const item of resources.digitalQueue) {
      if (['active', 'awaiting_customer'].includes(item.status) && item.assignedTo === actorId) {
        rows.push({ type: 'digital_contact', itemId: item.id, reference: item.id, customer: item.customer, subject: item.subject, channel: item.channel, priority: item.priority || 'normal', dueLabel: '', callbackIds: [] });
      }
    }
    for (const item of resources.commitments) {
      if (item.status === 'Open' && item.owner.toLowerCase() === actor.toLowerCase()) {
        rows.push({ type: 'customer_commitment', itemId: item.id, reference: item.caseId || item.id, customer: item.customerName, subject: item.commitment, channel: item.preferredChannel || 'Callback', priority: 'high', dueLabel: item.dueDate || '', callbackIds: item.callbackIds || [] });
      }
    }
    for (const item of resources.cases) {
      if (item.lifecycle?.followUp?.status === 'supervisor_review') continue;
      if (item.lifecycle?.followUp && ['open', 'in_progress'].includes(item.lifecycle.followUp.status) && item.lifecycle.followUp.owner === actor) {
        rows.push({ type: 'case_followup', itemId: item.reference, reference: item.reference, customer: item.customer, subject: item.title, channel: item.channel || 'Case follow-up', priority: item.lifecycle.followUp.priority || 'normal', dueLabel: 'Day 4', callbackIds: [] });
      } else if (item.owner === actor && !['resolved', 'closed', 'completed'].includes(String(item.status).toLowerCase())) {
        rows.push({ type: 'open_case', itemId: item.reference, reference: item.reference, customer: item.customer, subject: item.title, channel: item.channel || 'CRM', priority: 'normal', dueLabel: '', callbackIds: [] });
      }
    }
    const pending = new Set(handovers.filter(row => row.status === 'pending_acceptance').flatMap(row => row.items.filter(item => item.status === 'pending').map(item => `${item.type}:${item.itemId}`)));
    return rows.filter(row => !pending.has(`${row.type}:${row.itemId}`));
  },
  normalizeAgentHandovers(rows = []) { return Array.isArray(rows) ? rows : []; },
  agentShiftHandoverMetrics(rows = []) {
    const items = rows.flatMap(row => row.items || []);
    return {
      pending: rows.filter(row => row.status === 'pending_acceptance').length,
      transferredItems: items.filter(row => row.status === 'transferred').length,
      staleItems: items.filter(row => row.status === 'stale').length
    };
  }
};

test('counts owned digital, customer promise, reopened follow-up and open CRM items', () => {
  const state = baseState({
    digitalQueue: [{ id: 'D-1', status: 'active', assignedTo: 'EMP-AY', customer: 'Customer A', subject: 'Login help', channel: 'email' }],
    customerCommitments: { commitments: [{ id: 'P-1', status: 'Open', owner: 'Amina Yusuf', customerName: 'Customer B', commitment: 'Call back' }] },
    cases: [
      { reference: 'C-1', status: 'Open', owner: 'Amina Yusuf', customer: 'Customer C', title: 'Refund query' },
      { reference: 'C-2', status: 'Open', owner: 'Amina Yusuf', customer: 'Customer D', title: 'Reopened issue', lifecycle: { followUp: { status: 'in_progress', owner: 'Amina Yusuf' } } }
    ]
  });
  const report = buildAgentHandoverPreflight(state, fakeEngine);
  assert.equal(report.actorId, 'EMP-AY');
  assert.equal(report.candidateCount, 4);
  assert.deepEqual(report.typeCounts, { digital_contact: 1, customer_commitment: 1, case_followup: 1, open_case: 1 });
  assert.equal(report.readiness, 'ready');
});

test('blocks preparation when inbound voice is active', () => {
  const report = buildAgentHandoverPreflight(baseState({ currentCall: { id: 'CALL-1' } }), fakeEngine);
  assert.equal(report.readiness, 'blocked');
  assert.deepEqual(report.activeBlockers, ['inbound']);
});

test('blocks preparation when outbound or after-contact work is active', () => {
  const outbound = buildAgentHandoverPreflight(baseState({ activeOutbound: { id: 'OUT-1' } }), fakeEngine);
  const wrap = buildAgentHandoverPreflight(baseState({ wrapUp: { id: 'WRAP-1' } }), fakeEngine);
  assert.deepEqual(outbound.activeBlockers, ['outbound']);
  assert.deepEqual(wrap.activeBlockers, ['afterContact']);
  assert.equal(outbound.readiness, 'blocked');
  assert.equal(wrap.readiness, 'blocked');
});

test('reports supervisor-review work and digital contacts owned by others outside agent transfer', () => {
  const state = baseState({
    digitalQueue: [
      { id: 'D-2', status: 'active', assignedTo: 'EMP-OTHER' },
      { id: 'D-3', status: 'queued', assignedTo: '' }
    ],
    cases: [{ reference: 'C-3', status: 'Open', owner: 'Amina Yusuf', lifecycle: { followUp: { status: 'supervisor_review' } } }]
  });
  const report = buildAgentHandoverPreflight(state, fakeEngine);
  assert.equal(report.digitalNotOwned, 1);
  assert.equal(report.queuedDigital, 1);
  assert.equal(report.supervisorReviewCases, 1);
  assert.equal(report.candidateCount, 0);
  assert.equal(report.readiness, 'no-work');
});

test('excludes already-pending items from the eligible count and reports incoming/outgoing transfers', () => {
  const state = baseState({
    digitalQueue: [{ id: 'D-4', status: 'active', assignedTo: 'EMP-AY', customer: 'Customer E' }],
    agentHandovers: [
      { id: 'H-1', status: 'pending_acceptance', fromAgentId: 'EMP-OTHER', toAgentId: 'EMP-AY', items: [{ type: 'digital_contact', itemId: 'D-4', status: 'pending' }] },
      { id: 'H-2', status: 'pending_acceptance', fromAgentId: 'EMP-AY', toAgentId: 'EMP-NK', items: [{ type: 'open_case', itemId: 'C-5', status: 'pending' }] }
    ]
  });
  const report = buildAgentHandoverPreflight(state, fakeEngine);
  assert.equal(report.candidateCount, 0);
  assert.equal(report.pendingIncoming, 1);
  assert.equal(report.pendingOutgoing, 1);
});

test('uses fallback initials when a saved employee reference is missing', () => {
  const report = buildAgentHandoverPreflight(baseState({ nameInitials: '' }), fakeEngine);
  assert.equal(report.actorId, 'EMP-AY');
});

test('does not mutate the employee save', () => {
  const state = baseState({
    digitalQueue: [{ id: 'D-1', status: 'active', assignedTo: 'EMP-AY' }],
    agentHandovers: []
  });
  const before = JSON.stringify(state);
  buildAgentHandoverPreflight(state, fakeEngine);
  assert.equal(JSON.stringify(state), before);
});

test('exports every candidate with explicit non-transfer and identity limitations', () => {
  const report = buildAgentHandoverPreflight(baseState({
    digitalQueue: [{ id: 'D-7', status: 'active', assignedTo: 'EMP-AY', customer: 'Customer Z', subject: 'Need a callback', channel: 'email' }]
  }), fakeEngine);
  const markdown = buildAgentHandoverAuditMarkdown(report, new Date('2026-11-21T12:00:00Z'));
  assert.match(markdown, /D-7/);
  assert.match(markdown, /read-only/);
  assert.match(markdown, /not enterprise identity authentication/);
  assert.match(markdown, /Callback records are not transferred as separate work items/);
});

test('escapes markdown table separators and line breaks in exported text', () => {
  const report = buildAgentHandoverPreflight(baseState({
    digitalQueue: [{ id: 'D|8', status: 'active', assignedTo: 'EMP-AY', customer: 'A\nB', subject: 'Subject' }]
  }), fakeEngine);
  const markdown = buildAgentHandoverAuditMarkdown(report, new Date('2026-11-21T12:00:00Z'));
  assert.match(markdown, /D\\\|8/);
  assert.doesNotMatch(markdown, /Customer: A\nB/);
});

test('renders accessible preflight states, counts and local audit actions', () => {
  const report = buildAgentHandoverPreflight(baseState({ currentCall: { id: 'CALL-2' } }), fakeEngine);
  const html = renderAgentHandoverPreflightHTML(report);
  assert.match(html, /aria-label="Handover readiness preflight"/);
  assert.match(html, /role="status"/);
  assert.match(html, /ACTIVE WORK BLOCKS HANDOVER/);
  assert.match(html, /data-handover-audit-download/);
  assert.match(html, /data-handover-audit-copy/);
});
