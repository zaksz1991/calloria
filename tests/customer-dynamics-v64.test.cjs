const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../public/customer-dynamics-engine.js');

function createHarness() {
  const state = { active: null, completedContacts: [], activity: [] };
  const agentState = { activeContactId: 'contact-1' };
  const contact = { id: 'contact-1', reference: 'CT-TEST-01', customerTone: 'Frustrated', messages: [] };
  const agentEngine = {
    getActiveContact() { return contact; },
    addInternalNote(_state, _id, body) { contact.internalNote = body; return { text: body }; }
  };
  const engine = {
    beginContact(s) { s.active = { contactId: 'contact-1', stageResults: [], stageIndex: 0 }; return contact; },
    chooseResponse(s, _agentState, _agentEngine, option) {
      const result = { stage: 'acknowledge', score: option.score, qa: option.qa, complianceBreach: !!option.complianceBreach };
      s.active.stageResults.push(result);
      return { result, customerReply: { body: 'I have explained my concern.' }, complete: false };
    },
    finishContact(s) {
      const score = Math.round(s.active.stageResults.reduce((n, x) => n + x.score, 0) / s.active.stageResults.length);
      const record = { score, qa: 84, csat: 4 };
      s.completedContacts.unshift(record);
      s.active = null;
      return { record };
    },
    log(s, message) { s.activity.unshift({ message }); }
  };
  assert.equal(D.install(engine), true);
  return { state, agentState, contact, agentEngine, engine };
}

test('customer tone selects a deterministic customer profile', () => {
  assert.equal(D.profileKey('Frustrated'), 'frustrated');
  assert.equal(D.profileKey('Impatient'), 'impatient');
  assert.equal(D.profileKey('Concerned'), 'concerned');
  assert.equal(D.profileKey('Positive'), 'positive');
  assert.equal(D.profileKey('Formal'), 'formal');
  assert.equal(D.profileKey('Unknown tone'), 'neutral');
});

test('contact acceptance initializes rapport, patience and needs from customer tone', () => {
  const h = createHarness();
  const contact = h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date('2026-11-12T07:45:00Z'));
  const d = D.snapshot(h.state.active, contact);
  assert.equal(d.archetype, 'Frustrated customer');
  assert.equal(d.rapport, 32);
  assert.equal(d.patience, 42);
  assert.match(d.needs, /Acknowledgement/);
  assert.equal(d.emotion, 'Frustrated');
});

test('a strong service response improves rapport, trust and customer emotion', () => {
  const h = createHarness();
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  const out = h.engine.chooseResponse(h.state, h.agentState, h.agentEngine, { score: 100, qa: 100 }, new Date());
  assert.equal(out.customerDynamics.rapport, 43);
  assert.equal(out.customerDynamics.trust, 46);
  assert.equal(out.customerDynamics.patience, 47);
  assert.equal(out.result.score, 100);
  assert.equal(out.result.qa, 100);
  assert.match(out.customerReply.body, /still concerned|keep me updated/);
  assert.equal(h.state.active.dynamics.history.length, 1);
});

test('poor service decisions reduce patience and apply an experience penalty without changing QA', () => {
  const h = createHarness();
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  const out = h.engine.chooseResponse(h.state, h.agentState, h.agentEngine, { score: 20, qa: 15 }, new Date());
  assert.equal(out.customerDynamics.rapport, 18);
  assert.equal(out.customerDynamics.patience, 27);
  assert.equal(out.customerDynamics.emotion, 'Escalation risk');
  assert.equal(out.result.score, 12);
  assert.equal(out.result.qa, 15);
  assert.match(out.customerDynamics.coachingCue, /supervisor support/);
});

test('critical compliance breaches cannot be repaired by positive customer rapport', () => {
  const h = createHarness();
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  const out = h.engine.chooseResponse(h.state, h.agentState, h.agentEngine, { score: 100, qa: 100, complianceBreach: true }, new Date());
  assert.equal(out.result.score, 0);
  assert.equal(out.result.qa, 100);
  assert.equal(out.customerDynamics.emotion, 'Escalation risk');
  assert.equal(out.customerDynamics.rapport, 0);
});

test('supervisor support request requires a reason and cannot be duplicated', () => {
  const h = createHarness();
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  assert.throws(() => D.requestSupervisor(h.state.active, 'No', h.contact), /clear reason/);
  const d = D.requestSupervisor(h.state.active, 'Complaint is escalating', h.contact);
  assert.equal(d.supervisorSuggested, true);
  assert.throws(() => D.requestSupervisor(h.state.active, 'Complaint is escalating', h.contact), /already been recorded/);
});

test('end-of-contact sentiment adjusts customer experience score but not QA', () => {
  const h = createHarness();
  h.contact.customerTone = 'Positive';
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  h.engine.chooseResponse(h.state, h.agentState, h.agentEngine, { score: 85, qa: 96 }, new Date());
  const before = h.state.active.stageResults[0].score;
  const out = h.engine.finishContact(h.state, h.agentState, h.agentEngine);
  assert.equal(out.record.score, Math.min(100, before + 4));
  assert.equal(out.record.qa, 84);
  assert.equal(out.record.customerExperience.rapport, 78);
  assert.equal(out.record.customerExperience.finalMood, 'Reassured');
  assert.equal(h.state.active, null);
});

test('low customer rapport lowers the final customer experience score', () => {
  const h = createHarness();
  h.engine.beginContact(h.state, h.agentState, h.agentEngine, 'contact-1', new Date());
  h.engine.chooseResponse(h.state, h.agentState, h.agentEngine, { score: 20, qa: 90 }, new Date());
  const before = h.state.active.stageResults[0].score;
  const out = h.engine.finishContact(h.state, h.agentState, h.agentEngine);
  assert.equal(out.record.score, Math.max(0, before - 9));
  assert.equal(out.record.customerExperience.finalMood, 'Escalation risk');
});

test('older active shift records are upgraded lazily without losing stage history', () => {
  const legacy = { stageIndex: 2, stageResults: [{ score: 70 }], readyToWrap: false };
  const d = D.snapshot(legacy, { customerTone: 'Formal' });
  assert.equal(d.archetype, 'Detail-focused customer');
  assert.equal(d.decisions, 0);
  assert.equal(legacy.stageIndex, 2);
  assert.equal(legacy.stageResults.length, 1);
});

test('engine installation is idempotent and rejects incomplete engines', () => {
  const h = createHarness();
  assert.equal(D.install(h.engine), false);
  assert.equal(D.install({}), false);
});

test('completed interaction record carries customer experience evidence', () => {
  const record = { reference: 'CT-TEST-02' };
  const attached = D.attachOutcome(record, {
    archetype: 'Concerned customer', openingMood: 'Concerned', emotion: 'Settling',
    rapport: 62, patience: 55, trust: 60, supervisorSuggested: true, history: [{ decision: 1 }]
  });
  assert.equal(attached.customerExperience.profile, 'Concerned customer');
  assert.equal(attached.customerExperience.supervisorAssistanceRequested, true);
  assert.equal(attached.customerExperience.history.length, 1);
});

test('live-floor page loads dynamics after its base engine and exposes the signals panel', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/live-floor.html'), 'utf8');
  assert.ok(html.indexOf('/live-floor-engine.js') < html.indexOf('/customer-dynamics-engine.js'));
  assert.ok(html.indexOf('/customer-dynamics-engine.js') < html.indexOf('/live-floor.js'));
  for (const id of ['customer-dynamics', 'dynamics-profile', 'dynamics-mood', 'dynamics-rapport-bar', 'dynamics-patience-bar', 'dynamics-trust-bar', 'dynamics-reaction', 'dynamics-coaching', 'request-supervisor']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('live-floor controller renders dynamics and records local supervisor assistance', () => {
  const js = fs.readFileSync(path.join(__dirname, '../public/live-floor.js'), 'utf8');
  assert.match(js, /function renderCustomerDynamics\(active\)/);
  assert.match(js, /D\.requestSupervisor\(state\.active, reason, contact\)/);
  assert.match(js, /No live supervisor was notified/);
  assert.match(js, /request-supervisor.*addEventListener/);
});
