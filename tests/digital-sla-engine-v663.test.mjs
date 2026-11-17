import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DIGITAL_SLA_VERSION,
  DEFAULT_DIGITAL_SLA_POLICY,
  assessDigitalSla,
  advanceDigitalSlaMonitor,
  digitalSlaDisplay,
  digitalSlaMetrics
} from '../js/digital-sla-engine.js';
import { DIGITAL_STATUS } from '../js/multichannel-engine.js';

const START = Date.parse('2026-11-17T09:00:00.000Z');
function contact(overrides = {}) {
  return {
    id: 'DIG-1', channel: 'live_chat', status: DIGITAL_STATUS.QUEUED,
    receivedAt: new Date(START).toISOString(), slaMinutes: 10,
    firstResponseAt: null, timeline: [], ...overrides
  };
}

test('v6.63 exposes a bounded digital first-response SLA policy', () => {
  assert.equal(DIGITAL_SLA_VERSION, '6.63.0');
  assert.equal(DEFAULT_DIGITAL_SLA_POLICY.riskThreshold, 0.75);
  assert.deepEqual(DEFAULT_DIGITAL_SLA_POLICY.channelTargetsMinutes, { email: 240, live_chat: 2, social: 20 });
});

test('new unresponded contact begins on track with its target deadline', () => {
  const item = contact();
  const result = assessDigitalSla(item, START);
  assert.equal(result.status, 'on_track');
  assert.equal(result.remainingMs, 600_000);
  assert.equal(result.dueAt, new Date(START + 600_000).toISOString());
});

test('risk window begins at the configured 75 percent threshold', () => {
  const result = assessDigitalSla(contact(), START + 450_000);
  assert.equal(result.status, 'at_risk');
  assert.equal(result.remainingMs, 150_000);
  assert.equal(digitalSlaDisplay(result), 'DUE 3m');
});

test('SLA breaches at the deadline and reports overdue time', () => {
  const result = assessDigitalSla(contact(), START + 720_000);
  assert.equal(result.status, 'breached');
  assert.equal(result.overdueMs, 120_000);
  assert.equal(digitalSlaDisplay(result), 'OVERDUE 2m');
});

test('a first response inside target meets SLA even when the assessment runs later', () => {
  const item = contact({ firstResponseAt: new Date(START + 540_000).toISOString(), status: DIGITAL_STATUS.AWAITING_CUSTOMER });
  const result = assessDigitalSla(item, START + 2_000_000);
  assert.equal(result.status, 'met');
  assert.equal(result.responseMinutes, 9);
  assert.equal(result.remainingMs, 0);
});

test('a late first response remains a recorded breach after the customer replies', () => {
  const item = contact({ firstResponseAt: new Date(START + 660_000).toISOString(), status: DIGITAL_STATUS.AWAITING_CUSTOMER });
  const result = assessDigitalSla(item, START + 3_000_000);
  assert.equal(result.status, 'breached');
  assert.equal(result.overdueMs, 60_000);
  assert.equal(digitalSlaDisplay(result), 'LATE 1m');
});

test('channel target is used when a saved contact has no valid explicit target', () => {
  const item = contact({ channel: 'email', slaMinutes: 0 });
  const result = assessDigitalSla(item, START);
  assert.equal(result.targetMinutes, 240);
  assert.equal(result.remainingMs, 14_400_000);
});

test('future receipt times do not create negative elapsed or overdue values', () => {
  const result = assessDigitalSla(contact(), START - 60_000);
  assert.equal(result.elapsedMs, 0);
  assert.equal(result.overdueMs, 0);
  assert.equal(result.status, 'on_track');
});

test('malformed receipt timestamps return unavailable rather than fabricated risk', () => {
  const result = assessDigitalSla(contact({ receivedAt: 'not-a-date' }), START);
  assert.equal(result.status, 'unavailable');
});

test('monitor records risk once and advances the contact status', () => {
  const item = contact();
  const first = advanceDigitalSlaMonitor([item], START + 450_000);
  assert.equal(first.newlyAtRisk.length, 1);
  assert.equal(item.slaTrackingStatus, 'at_risk');
  assert.equal(item.timeline.filter(row => row.status === 'sla_at_risk').length, 1);
  const second = advanceDigitalSlaMonitor([item], START + 470_000);
  assert.equal(second.newlyAtRisk.length, 0);
  assert.equal(item.timeline.filter(row => row.status === 'sla_at_risk').length, 1);
});

test('monitor records a breach once even when advanced repeatedly', () => {
  const item = contact();
  const first = advanceDigitalSlaMonitor([item], START + 700_000);
  const second = advanceDigitalSlaMonitor([item], START + 800_000);
  assert.equal(first.newlyBreached.length, 1);
  assert.equal(second.newlyBreached.length, 0);
  assert.equal(item.timeline.filter(row => row.status === 'sla_breached').length, 1);
  assert.ok(item.slaBreachRecordedAt);
});

test('a contact responded within target does not receive a breach event', () => {
  const item = contact({ firstResponseAt: new Date(START + 300_000).toISOString(), status: DIGITAL_STATUS.AWAITING_CUSTOMER });
  const result = advanceDigitalSlaMonitor([item], START + 900_000);
  assert.equal(result.newlyBreached.length, 0);
  assert.equal(item.slaTrackingStatus, 'met');
});

test('a late first response creates one breach audit event', () => {
  const item = contact({ firstResponseAt: new Date(START + 660_000).toISOString(), status: DIGITAL_STATUS.AWAITING_CUSTOMER });
  const result = advanceDigitalSlaMonitor([item], START + 1_000_000);
  assert.equal(result.newlyBreached.length, 1);
  assert.match(item.timeline.at(-1).event, /breached/i);
});

test('awaiting-customer contact with no first response is not monitored as an active response', () => {
  const item = contact({ status: DIGITAL_STATUS.AWAITING_CUSTOMER });
  const result = advanceDigitalSlaMonitor([item], START + 900_000);
  assert.equal(result.newlyBreached.length, 0);
  assert.equal(item.slaTrackingStatus, undefined);
  assert.equal(result.evaluated.length, 0);
});

test('metrics separate current open risk from completed first-response outcomes', () => {
  const queue = [
    contact({ id: 'on-track', slaMinutes: 10 }),
    contact({ id: 'at-risk', slaMinutes: 10, receivedAt: new Date(START - 8 * 60_000).toISOString() }),
    contact({ id: 'breached', slaMinutes: 10, receivedAt: new Date(START - 12 * 60_000).toISOString() }),
    contact({ id: 'met', firstResponseAt: new Date(START + 120_000).toISOString(), status: DIGITAL_STATUS.AWAITING_CUSTOMER })
  ];
  const result = digitalSlaMetrics(queue, START);
  assert.equal(result.open, 3);
  assert.equal(result.onTrack, 1);
  assert.equal(result.atRisk, 1);
  assert.equal(result.breached, 1);
  assert.equal(result.firstResponses, 1);
  assert.equal(result.firstResponsesMet, 1);
  assert.equal(result.firstResponseTargetRate, 100);
  assert.equal(result.channelCounts.live_chat.breached, 1);
});

test('customer follow-up does not restart an already recorded first-response SLA', () => {
  const item = contact({ firstResponseAt: new Date(START + 180_000).toISOString(), status: DIGITAL_STATUS.ACTIVE, followUpDelivered: true });
  const result = assessDigitalSla(item, START + 10_000_000);
  assert.equal(result.status, 'met');
  assert.equal(result.responseMinutes, 3);
});

test('completed and escalated contacts are excluded from the open response backlog', () => {
  const queue = [
    contact({ id: 'resolved', status: DIGITAL_STATUS.RESOLVED }),
    contact({ id: 'escalated', status: DIGITAL_STATUS.ESCALATED }),
    contact({ id: 'queued', status: DIGITAL_STATUS.QUEUED })
  ];
  const result = digitalSlaMetrics(queue, START + 1000);
  assert.equal(result.open, 1);
  assert.equal(result.onTrack, 1);
});
