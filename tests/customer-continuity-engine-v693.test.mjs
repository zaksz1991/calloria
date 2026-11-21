import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMER_CONTINUITY_VERSION, createCustomerContinuityState, recordCustomerInteraction,
  getCustomerContinuityContext, customerContinuityMetrics, normalizeCustomerContinuityState
} from '../js/customer-continuity-engine.js';

const base = Date.parse('2026-11-21T10:00:00.000Z');
function add(state, data, offset = 0) {
  return recordCustomerInteraction(state, { customer: 'Amina Yusuf', interactionId: `INT-${offset}-${data.channel}`, occurredAt: new Date(base + offset).toISOString(), ...data });
}

test('first prior interaction is previous history, not a repeat customer', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Recorded' });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.found, true);
  assert.equal(context.repeatCustomer, false);
  assert.equal(customerContinuityMetrics(state).repeatCustomers, 0);
});

test('second distinct interaction is correctly classified as a repeat customer', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Recorded' }, 0);
  state = add(state, { channel: 'live_chat', status: 'Recorded' }, 60_000);
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.repeatCustomer, true);
  assert.equal(customerContinuityMetrics(state).repeatCustomers, 1);
  assert.equal(customerContinuityMetrics(state).crossChannelCustomers, 1);
});

test('generic recorded interaction is not miscounted as an open follow-up', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Recorded' });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.openCases.length, 0);
  assert.equal(customerContinuityMetrics(state).openFollowUps, 0);
});

test('explicit open and in-progress statuses count as follow-ups', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'In progress' });
  state = add(state, { channel: 'email', status: 'awaiting_customer' }, 60_000);
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.openCases.length, 2);
  assert.equal(customerContinuityMetrics(state).openFollowUps, 2);
});

test('resolved and closed outcomes do not remain open after follow-up', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Resolved after supervisor verification' });
  state = add(state, { channel: 'email', status: 'callback closed after supervisor review' }, 60_000);
  state = add(state, { channel: 'social', status: 'No further action' }, 120_000);
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.openCases.length, 0);
  assert.equal(customerContinuityMetrics(state).openFollowUps, 0);
});

test('reopened, escalated and callback-pending statuses remain open', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Reopened follow-up' });
  state = add(state, { channel: 'email', status: 'Escalated - awaiting review' }, 60_000);
  state = add(state, { channel: 'social', status: 'Callback pending' }, 120_000);
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.openCases.length, 3);
});

test('duplicate interaction identifiers do not inflate repeat counts', () => {
  let state = createCustomerContinuityState();
  const input = { customer: 'Amina Yusuf', interactionId: 'SAME-ID', channel: 'Voice', status: 'Recorded', occurredAt: new Date(base).toISOString() };
  state = recordCustomerInteraction(state, input);
  state = recordCustomerInteraction(state, input);
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.profile.totalInteractions, 1);
  assert.equal(context.repeatCustomer, false);
});

test('normalisation migrates older saved states without losing interaction history', () => {
  const old = { version: '6.68.0', profiles: { 'name:amina yusuf': { displayName: 'Amina Yusuf', interactions: [ { id: 'OLD-1', channel: 'Voice', status: 'Recorded', occurredAt: new Date(base).toISOString() } ] } } };
  const state = normalizeCustomerContinuityState(old);
  assert.equal(state.version, CUSTOMER_CONTINUITY_VERSION);
  assert.equal(state.profiles['name:amina yusuf'].interactions.length, 1);
  assert.equal(getCustomerContinuityContext(state, { customer: 'Amina Yusuf' }).repeatCustomer, false);
});

test('missing QA and sentiment values remain unknown, not zero', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Recorded' });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.lastInteraction.qa, null);
  assert.equal(context.lastInteraction.sentiment, null);
});

test('explicit QA and sentiment values are clamped to valid percentages', () => {
  let state = createCustomerContinuityState();
  state = add(state, { channel: 'Voice', status: 'Recorded', qa: 120, sentiment: -5 });
  const context = getCustomerContinuityContext(state, { customer: 'Amina Yusuf' });
  assert.equal(context.lastInteraction.qa, 100);
  assert.equal(context.lastInteraction.sentiment, 0);
});
