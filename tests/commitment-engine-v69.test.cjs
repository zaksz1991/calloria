const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../public/commitment-engine.js');

function makeStore() { return { getItem: () => null, setItem(key, value) { this.value = value; } }; }
function fixture(planId = '30-min', overrides = {}) {
  return {
    planId, customerId: 'CUS-1001', customerName: 'Amara Bello', contactReference: 'CT-55001',
    caseId: 'CASE-54001', subject: 'Course enrolment follow-up', productId: 'ruffneck-lms',
    preferredChannel: 'Live chat', owner: 'Agent One', team: 'Customer Care',
    commitment: 'Confirm whether the missing course is now visible.', ...overrides
  };
}
const shift = (date = '2026-11-12', minutes = 600) => ({ date, minutes });

test('creates a 30-minute callback relative to the simulated shift clock', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift(), new Date('2026-11-12T09:00:00'));
  assert.equal(item.dueDate, '2026-11-12');
  assert.equal(item.dueMinutes, 630);
  assert.equal(item.status, 'Open');
  assert.equal(item.attempts, 0);
});

test('moves same-shift callback past closing time to next working day at 09:00', () => {
  const item = B.makeDue(shift('2026-11-12', 950), '30-min');
  assert.equal(item.dueDate, '2026-11-13');
  assert.equal(item.dueMinutes, 540);
});

test('next working day scheduling skips Saturday and Sunday', () => {
  const friday = B.makeDue(shift('2026-11-13', 600), 'next-day');
  assert.equal(friday.dueDate, '2026-11-16');
  assert.equal(friday.dueMinutes, 540);
});

test('two working day plan skips weekend correctly', () => {
  const friday = B.makeDue(shift('2026-11-13', 600), 'two-days');
  assert.equal(friday.dueDate, '2026-11-17');
  assert.equal(friday.dueMinutes, 600);
});

test('rejects missing customer, owner, plan and incomplete commitment text', () => {
  const state = B.createState();
  assert.throws(() => B.createCommitment(state, fixture('nope'), shift()), /valid callback commitment time/i);
  assert.throws(() => B.createCommitment(state, fixture('30-min', { commitment: 'short' }), shift()), /at least 10 characters/i);
  assert.throws(() => B.createCommitment(state, fixture('30-min', { owner: '' }), shift()), /named callback owner/i);
  assert.throws(() => B.createCommitment(state, fixture('30-min', { customerId: '' }), shift()), /customer profile/i);
});

test('classifies scheduled, due-soon, due and overdue commitments', () => {
  const item = { dueDate: '2026-11-12', dueMinutes: 630, status: 'Open' };
  assert.equal(B.classify(item, shift('2026-11-12', 600)).state, 'Scheduled');
  assert.equal(B.classify(item, shift('2026-11-12', 620)).state, 'Due soon');
  assert.equal(B.classify(item, shift('2026-11-12', 630)).state, 'Due');
  assert.equal(B.classify(item, shift('2026-11-12', 661)).state, 'Overdue');
});

test('older dated commitments remain overdue on a later simulated workday', () => {
  const item = { dueDate: '2026-11-12', dueMinutes: 630, status: 'Open' };
  assert.equal(B.classify(item, shift('2026-11-13', 540)).state, 'Overdue');
});

test('filters open commitments by employee and sorts overdue work first', () => {
  const state = B.createState();
  B.createCommitment(state, fixture('30-min', { owner: 'Agent One', commitment: 'Check course enrolment result.' }), shift('2026-11-12', 600));
  B.createCommitment(state, fixture('next-day', { owner: 'Agent One', contactReference: 'CT-55002', commitment: 'Confirm account recovery status.' }), shift('2026-11-12', 600));
  B.createCommitment(state, fixture('30-min', { owner: 'Agent Two', contactReference: 'CT-55003' }), shift('2026-11-12', 600));
  const list = B.listForAgent(state, { name: 'Agent One' }, shift('2026-11-12', 670));
  assert.equal(list.length, 2);
  assert.equal(list[0].contactReference, 'CT-55001');
  assert.equal(list[0].timing.state, 'Overdue');
});

test('successful callback closes commitment and records customer outcome', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift(), new Date('2026-11-12T09:00:00'));
  const result = B.recordOutcome(state, item.id, { outcome: 'completed', summary: 'Customer confirmed the course is visible and enrolment is now complete.' }, shift('2026-11-12', 640), new Date('2026-11-12T10:40:00'));
  assert.equal(result.item.status, 'Complete');
  assert.equal(result.item.attempts, 1);
  assert.ok(result.item.completedAt);
});

test('no-answer outcome reschedules to the next working day', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift('2026-11-13', 650));
  const result = B.recordOutcome(state, item.id, { outcome: 'no-answer', summary: 'Outbound call attempted, but there was no answer. Retry is required.' }, shift('2026-11-13', 650));
  assert.equal(result.item.status, 'Open');
  assert.equal(result.item.dueDate, '2026-11-16');
  assert.equal(result.item.dueMinutes, 600);
  assert.equal(result.item.attempts, 1);
});

test('further-action outcome remains open and is rescheduled', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift('2026-11-12', 650));
  const result = B.recordOutcome(state, item.id, { outcome: 'further-action', summary: 'Customer reached, but the technical investigation is not complete yet.' }, shift('2026-11-12', 650));
  assert.equal(result.item.status, 'Open');
  assert.equal(result.item.dueDate, '2026-11-13');
  assert.equal(result.item.dueMinutes, 600);
});

test('second unsuccessful attempt escalates to supervisor review', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift('2026-11-12', 600));
  B.recordOutcome(state, item.id, { outcome: 'no-answer', summary: 'First outbound callback attempt received no answer from the customer.' }, shift('2026-11-12', 600));
  const result = B.recordOutcome(state, item.id, { outcome: 'no-answer', summary: 'Second outbound callback attempt also received no answer from the customer.' }, shift('2026-11-13', 600));
  assert.equal(result.item.status, 'Needs review');
  assert.equal(result.requiresReview, true);
  assert.throws(() => B.recordOutcome(state, item.id, { outcome: 'completed', summary: 'Attempting to bypass supervisor review with a direct close.' }, shift()), /supervisor must review/i);
});

test('supervisor review closes the item with a documented reason', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift('2026-11-12', 600));
  B.recordOutcome(state, item.id, { outcome: 'no-answer', summary: 'First outbound callback attempt received no answer from the customer.' }, shift('2026-11-12', 600));
  B.recordOutcome(state, item.id, { outcome: 'no-answer', summary: 'Second outbound callback attempt also received no answer from the customer.' }, shift('2026-11-13', 600));
  assert.throws(() => B.closeAfterReview(state, item.id, 'Manager One', 'too short', new Date(), 'Agent One'), /at least 20 characters/i);
  const closed = B.closeAfterReview(state, item.id, 'Manager One', 'Supervisor assigned a secure written update and confirmed the case owner will follow the customer.', new Date('2026-11-13T12:00:00'), 'Agent One');
  assert.equal(closed.status, 'Complete');
  assert.equal(closed.lastOutcome, 'supervisor-review');
  assert.equal(closed.reviewedBy, 'Manager One');
});

test('completed items do not appear in the open commitment queue', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift());
  B.recordOutcome(state, item.id, { outcome: 'completed', summary: 'Customer confirmed the requested information and accepted the final update.' }, shift());
  assert.equal(B.listForAgent(state, { name: 'Agent One' }, shift()).length, 0);
});

test('persists commitments and safely handles malformed stored data', () => {
  const store = makeStore();
  const state = B.createState();
  B.createCommitment(state, fixture(), shift());
  assert.equal(B.save(state, store), true);
  const loaded = B.normaliseState(JSON.parse(store.value));
  assert.equal(loaded.commitments.length, 1);
  assert.equal(loaded.commitments[0].customerName, 'Amara Bello');
  assert.equal(B.normaliseState({ commitments: 'invalid' }).commitments.length, 0);
});

test('sanitises notes and only accepts supported callback outcomes', () => {
  const state = B.createState();
  const item = B.createCommitment(state, fixture(), shift());
  assert.throws(() => B.recordOutcome(state, item.id, { outcome: 'made-up', summary: 'This is a sufficiently long outcome note for a test.' }, shift()), /valid callback outcome/i);
  const result = B.recordOutcome(state, item.id, { outcome: 'completed', summary: '<b>Customer</b> confirmed the action is complete and understood.' }, shift());
  assert.ok(!result.item.lastSummary.includes('<b>'));
});
