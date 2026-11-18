import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_CONTINUITY_VERSION,
  MAX_INTERACTIONS_PER_CUSTOMER,
  createCustomerContinuityState,
  normalizeCustomerContinuityState,
  resolveCustomerContinuityIdentity,
  recordCustomerInteraction,
  getCustomerContinuityContext,
  customerContinuityMetrics,
  listCustomerContinuityProfiles
} from '../js/customer-continuity-engine.js';

const at = '2026-11-18T08:00:00.000Z';
const next = '2026-11-18T09:00:00.000Z';

function add(state, input) {
  return recordCustomerInteraction(state, { customer: 'Amina Bello', channel: 'inbound_voice', direction: 'inbound', title: 'Payment status enquiry', status: 'Resolved', disposition: 'resolved', occurredAt: at, reference: 'CASE-001', ...input });
}

test('v6.68 exposes a versioned continuity state and stable name-based matching', () => {
  assert.equal(CUSTOMER_CONTINUITY_VERSION, '6.68.0');
  assert.equal(createCustomerContinuityState().version, CUSTOMER_CONTINUITY_VERSION);
  assert.equal(
    resolveCustomerContinuityIdentity({ customer: '  Amina   BELLO ' }).key,
    resolveCustomerContinuityIdentity({ customerName: 'amina bello' }).key
  );
});

test('explicit shared synthetic customer reference takes precedence over display name', () => {
  const first = resolveCustomerContinuityIdentity({ customer: 'Amina Bello', customerRef: 'CUS-001' });
  const second = resolveCustomerContinuityIdentity({ customer: 'A. Bello', customerId: 'cus-001' });
  assert.equal(first.key, 'ref:cus-001');
  assert.equal(second.key, first.key);
  assert.equal(first.matchBasis, 'reference');
});

test('different names do not silently merge when no shared reference is supplied', () => {
  assert.notEqual(resolveCustomerContinuityIdentity({ customer: 'Amina Bello' }).key, resolveCustomerContinuityIdentity({ customer: 'Amina Bala' }).key);
});

test('missing customer identity is safely rejected', () => {
  assert.equal(resolveCustomerContinuityIdentity({}), null);
  assert.equal(Object.keys(recordCustomerInteraction(createCustomerContinuityState(), {} ).profiles).length, 0);
});

test('first interaction creates a profile with minimal metadata only', () => {
  const state = add(createCustomerContinuityState(), { notes: 'Free-form notes must not be retained.', messages: [{ text: 'private transcript' }] });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Bello' });
  assert.equal(context.found, true);
  assert.equal(context.repeatCustomer, true);
  assert.equal(context.profile.totalInteractions, 1);
  assert.equal(context.lastInteraction.title, 'Payment status enquiry');
  assert.equal(JSON.stringify(state).includes('Free-form notes'), false);
  assert.equal(JSON.stringify(state).includes('private transcript'), false);
});

test('same customer is recognised across voice, email and outbound channels by shared name', () => {
  let state = add(createCustomerContinuityState(), { channel: 'inbound_voice', reference: 'CASE-001' });
  state = add(state, { channel: 'email', direction: 'inbound', occurredAt: next, reference: 'CASE-002', status: 'Pending customer' });
  state = add(state, { channel: 'outbound_voice', direction: 'outbound', occurredAt: '2026-11-18T10:00:00.000Z', reference: 'CASE-003', status: 'Completed' });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Bello' });
  assert.equal(context.repeatCustomer, true);
  assert.equal(context.profile.totalInteractions, 3);
  assert.deepEqual(context.previousChannels.sort(), ['email', 'inbound_voice', 'outbound_voice']);
  assert.equal(context.lastInteraction.reference, 'CASE-003');
});

test('cross-channel profiles distinguish an open follow-up from a closed case', () => {
  let state = add(createCustomerContinuityState(), { reference: 'CASE-CLOSED', status: 'Resolved' });
  state = add(state, { occurredAt: next, reference: 'CASE-OPEN', status: 'Callback scheduled' });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Bello' });
  assert.equal(context.openCases.length, 1);
  assert.equal(context.openCases[0].caseReference, 'CASE-OPEN');
});

test('duplicate interaction references are not counted twice', () => {
  let state = add(createCustomerContinuityState(), { reference: 'CASE-DUP' });
  state = add(state, { reference: 'CASE-DUP', occurredAt: next });
  assert.equal(getCustomerContinuityContext(state, { customer: 'Amina Bello' }).profile.totalInteractions, 1);
});

test('interaction list is bounded and retains the newest twenty records', () => {
  let state = createCustomerContinuityState();
  for (let index = 0; index < MAX_INTERACTIONS_PER_CUSTOMER + 5; index += 1) {
    state = add(state, { reference: `CASE-${index}`, interactionId: `INT-${index}`, occurredAt: new Date(Date.parse(at) + index * 60_000).toISOString() });
  }
  const context = getCustomerContinuityContext(state, { customer: 'Amina Bello' }, { limit: 10 });
  assert.equal(context.profile.interactions.length, MAX_INTERACTIONS_PER_CUSTOMER);
  assert.equal(context.profile.totalInteractions, MAX_INTERACTIONS_PER_CUSTOMER + 5);
  assert.equal(context.interactions.length, 10);
});

test('interaction metadata clamps QA and sentiment scores and strips unsafe markup', () => {
  const state = add(createCustomerContinuityState(), { title: '<script>bad</script> payment issue', qa: 140, sentiment: -10 });
  const item = getCustomerContinuityContext(state, { customer: 'Amina Bello' }).lastInteraction;
  assert.doesNotMatch(item.title, /<|>/);
  assert.equal(item.qa, 100);
  assert.equal(item.sentiment, 0);
});

test('legacy or malformed state normalises without throwing', () => {
  assert.deepEqual(normalizeCustomerContinuityState(null), createCustomerContinuityState());
  const normalized = normalizeCustomerContinuityState({ profiles: { bad: null, 'name:amina bello': { displayName: 'Amina', interactions: [{ id: 'I1', channel: 'Live chat', status: 'Resolved' }] } } });
  assert.equal(normalized.profiles['name:amina bello'].interactions[0].channel, 'live_chat');
});

test('metrics report repeat customers, channel returns, history volume and open work', () => {
  let state = add(createCustomerContinuityState(), { reference: 'ONE', status: 'Resolved' });
  state = add(state, { channel: 'email', occurredAt: next, reference: 'TWO', interactionId: 'TWO', status: 'Pending customer' });
  const metrics = customerContinuityMetrics(state);
  assert.deepEqual(metrics, { customers: 1, repeatCustomers: 1, crossChannelCustomers: 1, interactions: 2, openFollowUps: 1 });
});

test('profile list is sorted by most recent activity', () => {
  let state = add(createCustomerContinuityState(), { customer: 'Amina Bello', occurredAt: at, interactionId: 'A1' });
  state = add(state, { customer: 'Kelechi Obi', occurredAt: next, interactionId: 'K1' });
  assert.equal(listCustomerContinuityProfiles(state)[0].displayName, 'Kelechi Obi');
});
