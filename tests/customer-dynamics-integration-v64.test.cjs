const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('./fixtures/agent-workbench-engine.js');
const C = require('./fixtures/customer-journey-engine.js');
const F = require('./fixtures/live-floor-engine.js');
const D = require('../public/customer-dynamics-engine.js');

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values
  };
}

function startTestShift() {
  const now = new Date('2026-11-12T07:30:00');
  const state = F.createInitialState(now);
  const agentState = E.createInitialState(now);
  F.startShift(state, agentState, E, { name: 'Test Agent', team: 'Customer Care' }, now);
  F.attendEvent(state, 'morningBriefing', new Date(now.getTime() + 15 * 60000));
  return { now, state, agentState, storage: memoryStorage() };
}

function handleThreeBestResponses(fixture, contactId) {
  const { state, agentState, now } = fixture;
  const contact = F.beginContact(state, agentState, E, contactId, new Date(now.getTime() + 16 * 60000));
  const reactions = [];
  for (let index = 0; index < 3; index += 1) {
    const active = F.getActiveScenario(state, agentState, E);
    const best = active.stage.options.find((option) => option.id === 'best');
    assert.ok(best, `best response exists for ${active.stage.key}`);
    const response = F.chooseResponse(state, agentState, E, best.id, new Date(now.getTime() + (17 + index) * 60000));
    reactions.push(response.customerDynamics);
  }
  return { contact, reactions };
}

// Use the v6.0 base shift engine fixtures because v6.3 intentionally retains these engine contracts.
// The v6.4 overlay adds its extension without replacing those dependencies.

test('full shift engine integration persists and scores adaptive customer reactions', () => {
  if (!F.__customerDynamicsV64) assert.equal(D.install(F), true);
  const fixture = startTestShift();
  const { contact, reactions } = handleThreeBestResponses(fixture, 'CT-55002');
  assert.equal(fixture.state.active.readyToWrap, true);
  assert.equal(fixture.state.active.dynamics.history.length, 3);
  assert.equal(reactions[0].archetype, 'Frustrated customer');
  assert.equal(reactions[2].emotion, 'Settling');
  assert.ok(contact.messages.some((message) => message.direction === 'Inbound' && /I understand|Thank you/.test(message.body)));

  const result = F.finishContact(
    fixture.state, fixture.agentState, E, C, fixture.storage,
    { disposition: 'Guidance provided', summary: 'Confirmed the access issue, completed safe checks, gave the recovery route and explained the next update.', caseAction: 'skip' },
    new Date(fixture.now.getTime() + 25 * 60000)
  );
  assert.equal(result.record.customerExperience.profile, 'Frustrated customer');
  assert.equal(result.record.customerExperience.history.length, 3);
  assert.ok(result.record.customerExperience.rapport > 32);
  assert.equal(result.record.qa, 100);
  assert.equal(fixture.state.completedContacts[0].customerExperience.finalMood, 'Settling');
});

test('supervisor-support evidence is included in the completed contact record', () => {
  if (!F.__customerDynamicsV64) assert.equal(D.install(F), true);
  const fixture = startTestShift();
  const contact = F.beginContact(fixture.state, fixture.agentState, E, 'CT-55007', new Date(fixture.now.getTime() + 16 * 60000));
  D.requestSupervisor(fixture.state.active, 'Complaint is escalating', contact);
  E.addInternalNote(fixture.agentState, contact.id, 'Floor-supervisor assistance requested: complaint is escalating. Local simulation record only.', new Date());
  for (let index = 0; index < 3; index += 1) {
    const active = F.getActiveScenario(fixture.state, fixture.agentState, E);
    const option = active.stage.options.find((item) => item.id === 'best');
    F.chooseResponse(fixture.state, fixture.agentState, E, option.id, new Date(fixture.now.getTime() + (17 + index) * 60000));
  }
  const result = F.finishContact(
    fixture.state, fixture.agentState, E, C, fixture.storage,
    { disposition: 'Case created', summary: 'Previous complaint checked and linked, customer updated and supervisor assistance documented for continuity.', caseAction: 'create', category: 'Complaint & service recovery', priority: 'P2 - High', caseSubject: 'Previous complaint update' },
    new Date(fixture.now.getTime() + 25 * 60000)
  );
  assert.equal(result.record.customerExperience.supervisorAssistanceRequested, true);
  assert.ok(contact.internalNotes[0].text.includes('Floor-supervisor assistance requested'));
});
