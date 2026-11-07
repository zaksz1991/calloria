import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateWorkItem, validateTransition, validateWrapUp, queueCounts,
  dueState, formatDuration, DEPARTMENTS
} from '../js/agent-desk-engine.js';

const valid = {
  department: DEPARTMENTS[0], channel: 'voice', direction: 'inbound', priority: 'normal',
  subject: 'Customer cannot access course', summary: 'Customer reports an access issue with a course dashboard.',
  platformId: 'ruffneck-learn', caseReference: 'CC-261107-ABC234'
};

test('validates multichannel work items and preserves supported product references', () => {
  assert.equal(validateWorkItem(valid).platformId, 'ruffneck-learn');
  assert.equal(validateWorkItem(valid).caseReference, 'CC-261107-ABC234');
  assert.equal(validateWorkItem({ ...valid, channel: 'back_office' }).channel, 'back_office');
});

test('blocks a user from creating work in departments outside their grant', () => {
  assert.throws(() => validateWorkItem(valid, [DEPARTMENTS[1]]), /do not have access/);
});

test('rejects unsupported channels, malformed CRM IDs and missing summaries', () => {
  assert.throws(() => validateWorkItem({ ...valid, channel: 'carrier_pigeon' }), /channel/);
  assert.throws(() => validateWorkItem({ ...valid, crmCustomerId: '123' }), /valid record ID/);
  assert.throws(() => validateWorkItem({ ...valid, caseReference: 'broken' }), /case reference/);
  assert.throws(() => validateWorkItem({ ...valid, summary: 'short' }), /at least eight/);
  assert.throws(() => validateWorkItem({ ...valid, summary: 'Customer email is a.person@example.com' }), /credentials/);
  assert.throws(() => validateWorkItem({ ...valid, summary: 'Call back on +234 803 123 4567 for the update.' }), /credentials/);
});

test('blocks credentials and payment secrets from interaction summaries', () => {
  assert.throws(() => validateWorkItem({ ...valid, summary: 'Customer shared their OTP 123456 for login.' }), /credentials/);
});

test('enforces the interaction state machine and agent ownership', () => {
  assert.equal(validateTransition('active', 'on_hold', { assignedToCurrentAgent: true }), 'on_hold');
  assert.throws(() => validateTransition('pending', 'resolved', { assignedToCurrentAgent: true }), /Invalid status/);
  assert.throws(() => validateTransition('active', 'on_hold'), /assigned agent/);
  assert.equal(validateTransition('escalated', 'claimed', { supervisor: true }), 'claimed');
});

test('requires a valid wrap-up disposition and non-sensitive summary', () => {
  assert.equal(validateWrapUp({ disposition: 'information_provided', summary: 'Explained the current account recovery steps.' }).disposition, 'information_provided');
  assert.throws(() => validateWrapUp({ disposition: 'guess', summary: 'Some result that was explained.' }), /disposition/);
  assert.throws(() => validateWrapUp({ disposition: 'information_provided', summary: 'Customer PIN code is 1234.' }), /credentials/);
});

test('calculates status counts without inventing missing statuses', () => {
  assert.equal(queueCounts([{ status: 'pending' }, { status: 'pending' }, { status: 'resolved' }]).pending, 2);
  assert.equal(queueCounts([{ status: 'pending' }]).resolved, 0);
});

test('computes SLA state and formats elapsed time', () => {
  const now = Date.parse('2026-11-07T10:00:00Z');
  assert.equal(dueState('2026-11-07T09:00:00Z', now), 'overdue');
  assert.equal(dueState('2026-11-07T10:10:00Z', now), 'due_soon');
  assert.equal(dueState('2026-11-07T11:00:00Z', now), 'on_track');
  assert.equal(formatDuration(3661), '61:01');
});
