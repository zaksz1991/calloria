import test from 'node:test';
import assert from 'node:assert/strict';
import F from '../public/live-floor-engine.js';
import E from '../public/agent-workbench-engine.js';
import C from '../public/customer-journey-engine.js';

class MemoryStorage {
  constructor() { this.data = new Map(); }
  getItem(key) { return this.data.has(key) ? this.data.get(key) : null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}
function makeHarness() {
  const storage = new MemoryStorage();
  const proxy = {
    getItem(key) { return key === E.STORAGE_KEY ? storage.getItem(F.AGENT_STORAGE_KEY) : storage.getItem(key); },
    setItem(key, value) { return key === E.STORAGE_KEY ? storage.setItem(F.AGENT_STORAGE_KEY, value) : storage.setItem(key, value); },
    removeItem(key) { return key === E.STORAGE_KEY ? storage.removeItem(F.AGENT_STORAGE_KEY) : storage.removeItem(key); }
  };
  const at = new Date('2026-11-11T07:20:00');
  const state = F.createInitialState(at);
  const agent = E.createInitialState(at);
  F.startShift(state, agent, E, { name: 'Test Agent', team: 'Customer Care' }, at);
  return { storage, proxy, state, agent, at };
}
function attendMorning(h) { F.attendEvent(h.state, 'morningBriefing', h.at); }
function playScenario(h, ref = 'CT-55001', picks = ['best', 'best', 'best']) {
  const contact = h.agent.contacts.find((item) => item.reference === ref);
  assert.ok(contact, `Missing test contact ${ref}`);
  F.beginContact(h.state, h.agent, E, contact.id, h.at);
  picks.forEach((pick) => F.chooseResponse(h.state, h.agent, E, pick, h.at));
  return contact;
}

test('creates a fresh shift with the 07:30 briefing due', () => {
  const h = makeHarness();
  assert.equal(h.state.shift.status, 'On shift');
  assert.equal(h.state.shift.minutes, F.START_MINUTES);
  assert.equal(F.dueEvent(h.state).id, 'morningBriefing');
  assert.equal(h.agent.agent.name, 'Test Agent');
});

test('blocks customer contacts until the morning briefing is attended', () => {
  const h = makeHarness();
  assert.throws(() => F.beginContact(h.state, h.agent, E, 'CT-55001', h.at), /briefing/);
  attendMorning(h);
  assert.equal(F.dueEvent(h.state), null);
  assert.doesNotThrow(() => F.beginContact(h.state, h.agent, E, 'CT-55001', h.at));
});

test('runs a three-stage customer interaction and records its transcript', () => {
  const h = makeHarness(); attendMorning(h);
  const contact = playScenario(h);
  assert.equal(h.state.active.readyToWrap, true);
  assert.equal(contact.messages.filter((item) => item.direction === 'Outbound').length, 3);
  assert.equal(contact.status, 'Active');
});

test('blocks scheduled breaks while a customer interaction is still active', () => {
  const h = makeHarness(); attendMorning(h);
  F.beginContact(h.state, h.agent, E, 'CT-55001', h.at);
  h.state.shift.minutes = 640;
  assert.equal(F.dueEvent(h.state), null);
});

test('records a customer note and a linked Customer 360 case at wrap-up', () => {
  const h = makeHarness(); attendMorning(h);
  const contact = playScenario(h);
  const result = F.finishContact(h.state, h.agent, E, C, h.storage, {
    disposition: 'Case created', summary: 'Confirmed missing course enrolment and routed the confirmation evidence for investigation.',
    caseAction: 'create', category: 'Technical support', priority: 'P2 - High', caseSubject: 'Course enrolment mismatch'
  }, h.at);
  assert.equal(result.completed.status, 'Completed');
  assert.ok(result.linkedCase);
  assert.equal(h.state.metrics.completed, 1);
  assert.equal(h.state.metrics.fcr, 0, 'A newly created case must not count as first-contact resolution.');
  const db = C.load(h.storage);
  assert.ok(db.cases.some((item) => item.id === result.linkedCase.id));
  assert.ok(db.customers.find((item) => item.id === contact.customerId).notes.length > 0);
});

test('knowledge use is attached to the interaction and adds a small QA credit', () => {
  const h = makeHarness(); attendMorning(h);
  playScenario(h, 'CT-55003', ['neutral', 'best', 'best']);
  F.markKnowledgeUsed(h.state, 'kb-published-test', h.at);
  const result = F.finishContact(h.state, h.agent, E, C, h.storage, {
    disposition: 'Guidance provided', summary: 'Confirmed draft, review and scheduling sequence; customer will verify the schedule before confirmation.',
    caseAction: 'skip', category: 'Product guidance'
  }, h.at);
  assert.equal(result.record.knowledgeUsed, true);
  assert.equal(h.state.metrics.knowledgeUses, 1);
  assert.equal(result.record.qa, 97);
});

test('unsafe password or one-time-code request creates a critical compliance breach', () => {
  const h = makeHarness(); attendMorning(h);
  playScenario(h, 'CT-55002', ['best', 'unsafe', 'best']);
  const result = F.finishContact(h.state, h.agent, E, C, h.storage, {
    disposition: 'Escalated to specialist', summary: 'Account access issue referred for secure recovery after unsafe credential handling was detected.',
    caseAction: 'skip', category: 'Account & access'
  }, h.at);
  assert.equal(result.record.complianceBreach, true);
  assert.equal(h.state.metrics.complianceBreaches, 1);
  assert.equal(result.record.qa, 0);
  assert.equal(result.record.score, 25);
});

test('scheduled routine runs in morning break, lunch and afternoon briefing order', () => {
  const h = makeHarness(); attendMorning(h);
  h.state.shift.minutes = 630;
  assert.equal(F.dueEvent(h.state).id, 'morningBreak');
  F.attendEvent(h.state, 'morningBreak', h.at);
  h.state.shift.minutes = 750;
  assert.equal(F.dueEvent(h.state).id, 'lunchBreak');
  F.attendEvent(h.state, 'lunchBreak', h.at);
  h.state.shift.minutes = 840;
  assert.equal(F.dueEvent(h.state).id, 'afternoonBriefing');
  F.attendEvent(h.state, 'afternoonBriefing', h.at);
  assert.equal(F.dueEvent(h.state), null);
});

test('does not allow shift closure with an active interaction or due floor event', () => {
  const h = makeHarness();
  assert.throws(() => F.endShift(h.state, h.agent, E, h.at), /briefing/);
  attendMorning(h);
  F.beginContact(h.state, h.agent, E, 'CT-55001', h.at);
  assert.throws(() => F.endShift(h.state, h.agent, E, h.at), /active customer/);
});

test('ends shift and produces clear performance totals', () => {
  const h = makeHarness(); attendMorning(h);
  playScenario(h);
  F.finishContact(h.state, h.agent, E, C, h.storage, {
    disposition: 'Resolved on first contact', summary: 'Confirmed the course enrolment issue and recorded the customer guidance and follow-up evidence.',
    caseAction: 'skip', category: 'Product guidance'
  }, h.at);
  h.state.shift.minutes = 900;
  F.attendEvent(h.state, 'morningBreak', h.at);
  F.attendEvent(h.state, 'lunchBreak', h.at);
  F.attendEvent(h.state, 'afternoonBriefing', h.at);
  const report = F.endShift(h.state, h.agent, E, h.at);
  assert.equal(h.state.shift.status, 'Ended');
  assert.equal(report.completed, 1);
  assert.equal(report.attendedMorningBriefing, true);
  assert.equal(report.attendedAfternoonBriefing, true);
});

test('starts another shift with a fresh queue and archives the prior shift report', () => {
  const h = makeHarness(); attendMorning(h);
  playScenario(h);
  F.finishContact(h.state, h.agent, E, C, h.storage, {
    disposition: 'Information provided', summary: 'Recorded the product enquiry and provided the approved service information route to the customer.',
    caseAction: 'skip', category: 'Product guidance'
  }, h.at);
  h.state.shift.minutes = 900;
  F.attendEvent(h.state, 'morningBreak', h.at);
  F.attendEvent(h.state, 'lunchBreak', h.at);
  F.attendEvent(h.state, 'afternoonBriefing', h.at);
  F.endShift(h.state, h.agent, E, h.at);
  F.startShift(h.state, h.agent, E, { name: 'Test Agent', team: 'Customer Care' }, new Date('2026-11-12T07:20:00'));
  assert.equal(h.state.shift.status, 'On shift');
  assert.equal(h.state.completedContacts.length, 0);
  assert.equal(h.state.pastShifts.length, 1);
  assert.equal(E.queuedContacts(h.agent).length, E.DEMO_CONTACTS.length);
});
