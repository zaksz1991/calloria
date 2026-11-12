const test = require('node:test');
const assert = require('node:assert/strict');
const Voice = require('./fixtures/voice-call-engine.v65.js');

const contact = { id: 'contact-voice-1', reference: 'CT-VOICE-01', channel: 'Voice' };
const at = (seconds) => new Date(Date.UTC(2026, 10, 12, 8, 0, seconds));

 test('only voice contacts create voice call sessions', () => {
  const session = Voice.createSession(contact, at(0));
  assert.equal(session.status, Voice.STATES.CONNECTED);
  assert.equal(session.reference, 'CT-VOICE-01');
  assert.equal(Voice.createSession({ ...contact, channel: 'Email' }, at(0)), null);
});

test('hold requires a reason and moves the call out of connected state', () => {
  const session = Voice.createSession(contact, at(0));
  assert.throws(() => Voice.placeOnHold(session, '', at(5)), /Select a reason/);
  Voice.placeOnHold(session, 'Check existing case', at(5));
  assert.equal(session.status, Voice.STATES.ON_HOLD);
  assert.equal(session.holdCount, 1);
  assert.throws(() => Voice.toggleMute(session, at(8)), /requires a connected call/);
});

test('resume accumulates hold duration without counting it as connected talk time', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.placeOnHold(session, 'Check existing case', at(10));
  Voice.resume(session, at(70));
  const result = Voice.snapshot(session, at(100));
  assert.equal(result.totalElapsedSeconds, 100);
  assert.equal(result.holdSeconds, 60);
  assert.equal(result.durationSeconds, 40);
  assert.equal(result.status, Voice.STATES.CONNECTED);
});

test('microphone mute toggles and counts mute activations only', () => {
  const session = Voice.createSession(contact, at(0));
  assert.equal(Voice.toggleMute(session, at(2)), true);
  assert.equal(Voice.toggleMute(session, at(3)), false);
  assert.equal(session.muteCount, 1);
});

test('supervisor consultation validates context and holds the caller', () => {
  const session = Voice.createSession(contact, at(0));
  assert.throws(() => Voice.beginConsult(session, { reason: 'Policy', context: 'too short' }, at(5)), /at least 20 characters/);
  const consult = Voice.beginConsult(session, { reason: 'Security or privacy concern', context: 'Customer reports that a verification message may have been exposed.' }, at(10));
  assert.equal(session.status, Voice.STATES.CONSULTING);
  assert.match(consult.guidance, /passwords or one-time codes/);
  assert.equal(session.consultCount, 1);
});

test('completed supervisor consultation resumes the customer and records guidance', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.beginConsult(session, { reason: 'Escalating complaint', context: 'Customer has repeated contact and no prior update.' }, at(10));
  const result = Voice.completeConsult(session, at(50));
  assert.equal(result.status, 'COMPLETED');
  assert.match(result.guidance, /existing case/);
  assert.equal(session.status, Voice.STATES.CONNECTED);
  assert.equal(Voice.snapshot(session, at(60)).holdSeconds, 40);
});

test('consult completion cannot be called without an active consultation', () => {
  const session = Voice.createSession(contact, at(0));
  assert.throws(() => Voice.completeConsult(session, at(1)), /no supervisor consultation/);
});

test('warm transfer validates destination, reason and handover detail', () => {
  const session = Voice.createSession(contact, at(0));
  assert.throws(() => Voice.warmTransfer(session, { destination: '', reason: 'Route', handover: 'A sufficiently long handover summary is supplied.' }, at(10)), /Choose a specialist destination/);
  assert.throws(() => Voice.warmTransfer(session, { destination: 'Technical Support', reason: 'Route', handover: 'short' }, at(10)), /at least 30 characters/);
});

test('warm transfer closes the simulated agent call and records the destination', () => {
  const session = Voice.createSession(contact, at(0));
  const handover = 'Customer cannot complete account setup after the approved checks; please verify the next step and update the existing case.';
  const result = Voice.warmTransfer(session, { destination: 'Technical Support', reason: 'Specialist investigation required', handover }, at(75));
  assert.equal(result.status, 'COMPLETED');
  assert.equal(session.status, Voice.STATES.TRANSFERRED);
  assert.equal(session.transfer.destination, 'Technical Support');
  assert.equal(Voice.snapshot(session, at(100)).transferred, true);
});

test('warm transfer cannot occur while a call is held or in consultation', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.placeOnHold(session, 'Check a record', at(10));
  assert.throws(() => Voice.warmTransfer(session, { destination: 'Support', reason: 'Need specialist', handover: 'This handover contains more than thirty characters.' }, at(20)), /requires a connected call/);
});

test('persisted voice sessions restore counters, state and log', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.toggleMute(session, at(2));
  Voice.placeOnHold(session, 'Reviewing a case', at(3));
  const restored = Voice.normaliseSession(JSON.parse(JSON.stringify(session)), contact);
  assert.equal(restored.status, Voice.STATES.ON_HOLD);
  assert.equal(restored.muteCount, 1);
  assert.equal(restored.holdCount, 1);
  assert.equal(restored.log.length, 3);
});

test('finalising a held call is blocked until the customer is resumed', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.placeOnHold(session, 'Necessary system check', at(10));
  assert.throws(() => Voice.finalise(session, at(20)), /Resume the customer call/);
  Voice.resume(session, at(30));
  const result = Voice.finalise(session, at(40));
  assert.equal(result.status, Voice.STATES.CONNECTED);
  assert.equal(result.holdSeconds, 20);
  assert.ok(result.endedAt);
});

test('formatSeconds handles minute, hour and invalid inputs', () => {
  assert.equal(Voice.formatSeconds(0), '00:00');
  assert.equal(Voice.formatSeconds(65), '01:05');
  assert.equal(Voice.formatSeconds(3661), '01:01:01');
  assert.equal(Voice.formatSeconds(-4), '00:00');
});

test('live hold timer updates before the call is resumed', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.placeOnHold(session, 'Review approved guidance', at(10));
  const result = Voice.snapshot(session, at(35));
  assert.equal(result.holdSeconds, 25);
  assert.equal(result.durationSeconds, 10);
  assert.equal(result.status, Voice.STATES.ON_HOLD);
});

test('transferred calls cannot be muted, held or resumed again', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.warmTransfer(session, {
    destination: 'Technical Support',
    reason: 'Technical investigation required',
    handover: 'Customer cannot proceed after approved checks; specialist team must investigate the reported setup failure.'
  }, at(40));
  assert.throws(() => Voice.toggleMute(session, at(41)), /requires a connected call/);
  assert.throws(() => Voice.placeOnHold(session, 'Check record', at(41)), /requires a connected call/);
  assert.throws(() => Voice.resume(session, at(41)), /not on hold/);
});

test('finalising a transferred call preserves the warm handoff evidence', () => {
  const session = Voice.createSession(contact, at(0));
  Voice.warmTransfer(session, {
    destination: 'Service Recovery',
    reason: 'Complaint needs specialist ownership',
    handover: 'Customer has repeated contact without an update; review the existing complaint and confirm an accountable owner.'
  }, at(90));
  const result = Voice.finalise(session, at(100));
  assert.equal(result.transferred, true);
  assert.equal(result.transfer.destination, 'Service Recovery');
  assert.ok(result.log.some((item) => item.event === 'WARM_TRANSFER_COMPLETED'));
});

test('normalising an unrelated or obsolete session creates a fresh matching voice session', () => {
  const restored = Voice.normaliseSession({ version: '6.4.0', contactId: 'old-id', status: 'ON HOLD' }, contact);
  assert.equal(restored.contactId, contact.id);
  assert.equal(restored.status, Voice.STATES.CONNECTED);
});

test('policy consultation guidance avoids promising an unapproved exception', () => {
  const guidance = Voice.guidanceFor('Policy or approval guidance');
  assert.match(guidance, /Do not promise an exception/);
  assert.match(guidance, /approved policy/);
});
