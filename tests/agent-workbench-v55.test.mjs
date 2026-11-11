import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const E = require('../public/agent-workbench-engine.js');
const C = require('./fixtures/customer-journey-engine.v54.js');

function memoryStorage(seed = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function activeState() {
  const now = new Date('2026-11-11T10:00:00.000Z');
  const state = E.createInitialState(now);
  E.startShift(state, 'Test Agent', 'Customer Care', now);
  const contact = E.acceptContact(state, state.contacts[0].id, new Date(now.getTime() + 1000));
  return { state, contact, now };
}

test('version and supported channels are declared', () => {
  assert.equal(E.VERSION, '5.5.0');
  assert.deepEqual(E.CHANNELS, ['Voice', 'Email', 'Live chat', 'Social', 'SMS', 'In-app']);
  assert.equal(E.DISPOSITIONS.length, 9);
});

test('initial state contains a synthetic multichannel inbound queue', () => {
  const state = E.createInitialState(new Date('2026-11-11T10:00:00Z'));
  assert.equal(state.contacts.length, 10);
  assert.equal(new Set(state.contacts.map((item) => item.channel)).size, 6);
  assert.ok(state.contacts.every((item) => item.status === 'Queued' && item.messages.length === 1));
});

test('normalisation protects malformed persisted collections', () => {
  const state = E.normaliseState({ contacts: [{ id: 'X', status: 'untrusted' }], metrics: { completed: 4 } });
  assert.equal(state.contacts[0].status, 'Queued');
  assert.deepEqual(state.contacts[0].messages, []);
  assert.equal(state.metrics.completed, 4);
  assert.ok(Array.isArray(state.activity));
});

test('load and save persist state safely', () => {
  const storage = memoryStorage();
  const state = E.createInitialState(new Date('2026-11-11T10:00:00Z'));
  assert.equal(E.save(state, storage), true);
  assert.equal(E.load(storage).contacts.length, 10);
  assert.equal(E.save(state, null), false);
});

test('shift start requires an agent name and sets Available presence', () => {
  const state = E.createInitialState();
  assert.throws(() => E.startShift(state, 'A', 'Customer Care'), /agent name/i);
  E.startShift(state, 'Amina Yusuf', 'Digital Support', new Date('2026-11-11T08:00:00Z'));
  assert.equal(state.agent.name, 'Amina Yusuf');
  assert.equal(state.agent.presence, 'Available');
  assert.equal(E.isOnShift(state), true);
});

test('cannot start a second shift while one is active', () => {
  const state = E.createInitialState();
  E.startShift(state, 'Agent One', 'Customer Care');
  assert.throws(() => E.startShift(state, 'Agent Two', 'Customer Care'), /already active/i);
});

test('presence changes require an active shift', () => {
  const state = E.createInitialState();
  assert.throws(() => E.setPresence(state, 'Available'), /start a shift/i);
  E.startShift(state, 'Agent One', 'Customer Care');
  assert.equal(E.setPresence(state, 'Break'), 'Break');
  assert.throws(() => E.acceptContact(state, state.contacts[0].id), /Available/i);
});

test('contact acceptance requires an active available agent and one active contact maximum', () => {
  const state = E.createInitialState();
  assert.throws(() => E.acceptContact(state, state.contacts[0].id), /start the agent shift/i);
  E.startShift(state, 'Agent One', 'Customer Care');
  const contact = E.acceptContact(state, state.contacts[0].id);
  assert.equal(contact.status, 'Active');
  assert.equal(state.activeContactId, contact.id);
  assert.throws(() => E.acceptContact(state, state.contacts[1].id), /active contact/i);
});

test('cannot accept a contact twice', () => {
  const { state, contact } = activeState();
  assert.throws(() => E.acceptContact(state, contact.id), /active contact first/i);
});

test('queue filtering supports channel and query', () => {
  const state = E.createInitialState();
  const email = E.queuedContacts(state, { channel: 'Email' });
  assert.ok(email.length >= 1);
  assert.ok(email.every((item) => item.channel === 'Email'));
  assert.equal(E.queuedContacts(state, { query: 'CUS-1002' }).length, 1);
});

test('declining a queue item requires a reason and preserves it in queue', () => {
  const state = E.createInitialState(); const contact = state.contacts[0];
  assert.throws(() => E.declineContact(state, contact.id, 'no'), /enter a reason/i);
  E.declineContact(state, contact.id, 'Skill mismatch; re-route to specialist.');
  assert.equal(contact.status, 'Queued');
  assert.match(contact.internalNotes[0].text, /Skill mismatch/);
});

test('agent responses are stored as outbound transcript entries', () => {
  const { state, contact } = activeState();
  assert.throws(() => E.sendReply(state, contact.id, ' '), /enter a customer response/i);
  const message = E.sendReply(state, contact.id, 'I will check the enrolment status and explain the next step.');
  assert.equal(message.direction, 'Outbound');
  assert.equal(message.author, 'Test Agent');
  assert.equal(state.metrics.replies, 1);
  assert.equal(contact.messages.length, 2);
});

test('customer replies follow deterministic scripted contact turns', () => {
  const { state, contact } = activeState();
  E.sendReply(state, contact.id, 'I will check the enrolment status and explain the next step.');
  const response = E.simulateCustomerResponse(state, contact.id);
  assert.equal(response.direction, 'Inbound');
  assert.equal(response.author, 'Customer');
  assert.match(response.body, /course|confirmation/i);
  assert.equal(contact.simulatedReplies, 1);
  E.sendReply(state, contact.id, 'The next step is recorded in your support case.');
  assert.ok(E.simulateCustomerResponse(state, contact.id));
  assert.equal(E.simulateCustomerResponse(state, contact.id), null);
});

test('agent cannot reply to a contact that is not active', () => {
  const state = E.createInitialState();
  assert.throws(() => E.sendReply(state, state.contacts[0].id, 'Hello there.'), /active contact/i);
});

test('internal notes are separate from customer-visible messages', () => {
  const { state, contact } = activeState();
  assert.throws(() => E.addInternalNote(state, contact.id, 'bad'), /at least five/i);
  const note = E.addInternalNote(state, contact.id, 'Customer verification completed in the approved flow.');
  assert.equal(contact.messages.length, 1);
  assert.equal(contact.internalNotes[0].id, note.id);
});

test('transfer requires a different team and meaningful reason', () => {
  const { state, contact } = activeState();
  assert.throws(() => E.transferContact(state, contact.id, 'Customer Care', 'Needs help.'), /different receiving team/i);
  assert.throws(() => E.transferContact(state, contact.id, 'Technical Support', 'Short'), /at least 10/i);
  const moved = E.transferContact(state, contact.id, 'Technical Support', 'Requires specialist investigation of account access logs.');
  assert.equal(moved.status, 'Transferred');
  assert.equal(moved.transferTeam, 'Technical Support');
  assert.equal(state.activeContactId, null);
  assert.equal(state.metrics.transferred, 1);
});

test('wrap-up validates disposition and summary before completing the contact', () => {
  const { state, contact, now } = activeState();
  assert.throws(() => E.completeContact(state, contact.id, { disposition: 'Unknown', summary: 'This is a sufficiently detailed outcome summary.' }), /valid contact disposition/i);
  assert.throws(() => E.completeContact(state, contact.id, { disposition: E.DISPOSITIONS[0], summary: 'Too brief' }), /at least 20/i);
  const complete = E.completeContact(state, contact.id, { disposition: E.DISPOSITIONS[0], summary: 'Customer received the correct guidance and confirmed the enrolment next step.' }, new Date(now.getTime() + 60000));
  assert.equal(complete.status, 'Completed');
  assert.equal(state.activeContactId, null);
  assert.equal(state.metrics.completed, 1);
  assert.ok(complete.completedAt);
});

test('only queued contacts can be marked missed', () => {
  const state = E.createInitialState();
  assert.equal(E.recordMissed(state, state.contacts[0].id, 'Queue timeout').status, 'Missed');
  assert.throws(() => E.recordMissed(state, state.contacts[0].id), /only a queued contact/i);
});

test('ending shift is blocked while a contact is active', () => {
  const { state } = activeState();
  assert.throws(() => E.endShift(state), /active contact/i);
});

test('completed contact history exports safe CSV', () => {
  const { state, contact } = activeState();
  E.completeContact(state, contact.id, { disposition: E.DISPOSITIONS[0], summary: 'Customer was guided through the approved access checks successfully.' });
  const csv = E.exportInteractionsCsv(state);
  assert.match(csv, /Contact reference/);
  assert.match(csv, /CT-55001/);
  assert.match(csv, /Resolved on first contact/);
});

test('knowledge search returns only published unexpired articles for product', () => {
  const storage = memoryStorage({ [E.KNOWLEDGE_KEY]: JSON.stringify({ articles: [
    { id: 'A1', title: 'LMS access', summary: 'Help with access', category: 'Access', productId: 'ruffneck-lms', keywords: 'login', status: 'Published', version: 2, steps: ['Check account', 'Reset access'] },
    { id: 'A2', title: 'Draft LMS article', summary: 'Not approved', productId: 'ruffneck-lms', status: 'Draft' },
    { id: 'A3', title: 'Expired article', summary: 'Old', productId: 'ruffneck-lms', status: 'Published', expiresAt: '2026-01-01' },
    { id: 'A4', title: 'Kano Run guide', summary: 'Player access', productId: 'kano-run', status: 'Published' }
  ] }) });
  const results = E.searchKnowledge(storage, 'login', 'ruffneck-lms', new Date('2026-11-11T00:00:00Z'));
  assert.deepEqual(results.map((item) => item.id), ['A1']);
});

test('customer journey bridge validates customer and exposes open cases', () => {
  const storage = memoryStorage(); const customerState = C.createInitialState(); C.save(customerState, storage);
  const bridge = E.readCustomerJourney(storage);
  assert.ok(E.customerById(bridge, 'CUS-1001'));
  assert.ok(E.openCasesForCustomer(bridge, 'CUS-1001').length >= 1);
});

test('metrics count queue, completed work and average handling time', () => {
  const { state, contact, now } = activeState();
  E.completeContact(state, contact.id, { disposition: E.DISPOSITIONS[0], summary: 'The requested information was provided and confirmed by the customer.' }, new Date(now.getTime() + 120000));
  const metrics = E.getMetrics(state);
  assert.equal(metrics.handled, 1);
  assert.equal(metrics.averageHandleMinutes, 2);
  assert.equal(metrics.queued, 9);
});

test('agent wrap-up creates a Customer 360 case and writes interaction plus customer note', () => {
  const storage = memoryStorage();
  const customerState = C.createInitialState(new Date('2026-11-11T10:00:00Z'));
  C.save(customerState, storage);
  const { state, contact, now } = activeState();
  E.sendReply(state, contact.id, 'I checked the enrolment route and explained the next verification step.');
  const linked = E.commitToCustomerJourney(state, contact.id, {
    disposition: 'Case created', summary: 'Customer needs a follow-up investigation into the selected course enrolment.',
    caseAction: 'create', category: 'Technical support', priority: 'P2 - High', caseSubject: 'Investigate course enrolment follow-up'
  }, C, storage, new Date(now.getTime() + 2 * 60000));
  assert.ok(linked && linked.reference);
  const saved = C.load(storage);
  const savedCase = C.getCase(saved, linked.id);
  assert.equal(savedCase.interactions.length, 1);
  assert.equal(saved.customers.find((item) => item.id === contact.customerId).notes.length, 1);
  assert.equal(contact.linkedCaseId, linked.id);
});

test('agent wrap-up can add transcript to an existing open Customer 360 case', () => {
  const storage = memoryStorage(); const customerState = C.createInitialState(); C.save(customerState, storage);
  const { state, contact } = activeState();
  const caseId = 'CASE-54001';
  const linked = E.commitToCustomerJourney(state, contact.id, {
    disposition: 'Information provided', summary: 'Explained the existing enrolment case and the next customer update.',
    caseAction: 'existing', existingCaseId: caseId
  }, C, storage, new Date('2026-11-11T10:10:00Z'));
  assert.equal(linked.id, caseId);
  const saved = C.load(storage);
  assert.equal(C.getCase(saved, caseId).interactions.length, 1);
});

test('note-only wrap-up still updates the customer journey without creating a case', () => {
  const storage = memoryStorage(); const customerState = C.createInitialState(); C.save(customerState, storage);
  const { state, contact } = activeState(); const before = customerState.cases.length;
  const linked = E.commitToCustomerJourney(state, contact.id, {
    disposition: 'Information provided', summary: 'General service information provided; no investigation or follow-up case is required.',
    caseAction: 'note-only'
  }, C, storage, new Date('2026-11-11T10:10:00Z'));
  const saved = C.load(storage);
  assert.equal(linked, null);
  assert.equal(saved.cases.length, before);
  assert.equal(saved.customers.find((item) => item.id === contact.customerId).notes.length, 1);
});

test('Customer 360 sync fails safely when customer profile is missing', () => {
  const storage = memoryStorage({ [C.STORAGE_KEY]: JSON.stringify({ version: '5.4.0', customers: [], cases: [], activity: [] }) });
  const { state, contact } = activeState();
  assert.throws(() => E.commitToCustomerJourney(state, contact.id, {
    disposition: 'Information provided', summary: 'A complete enough outcome note for a valid test record.', caseAction: 'note-only'
  }, C, storage), /not present in Customer 360/i);
  assert.equal(state.activeContactId, contact.id);
});
