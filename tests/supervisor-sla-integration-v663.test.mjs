import test from 'node:test';
import assert from 'node:assert/strict';
import { supervisorQueueBoard } from '../js/supervisor-queue-engine.js';
import { DIGITAL_STATUS } from '../js/multichannel-engine.js';

const START = Date.parse('2026-11-17T09:00:00.000Z');
const digitalItem = (id, minutesAgo, extra = {}) => ({
  id, status: DIGITAL_STATUS.QUEUED, channel: 'live_chat', channelLabel: 'Live chat',
  receivedAt: new Date(START - minutesAgo * 60_000).toISOString(),
  slaMinutes: 10, priority: 'normal', routeGroup: 'Digital Support', timeline: [], ...extra
});

test('supervisor board labels a digital queue item on track with remaining first-response time', () => {
  const board = supervisorQueueBoard({ digitalQueue: [digitalItem('D1', 2)], digitalNow: START });
  assert.equal(board.digital[0].slaStatus, 'on_track');
  assert.equal(board.digital[0].slaAtRisk, false);
  assert.match(board.digital[0].slaDisplay, /LEFT/);
  assert.equal(board.digitalSlaBreached, 0);
});

test('supervisor board isolates the 75 percent SLA risk window', () => {
  const board = supervisorQueueBoard({ digitalQueue: [digitalItem('D1', 8)], digitalNow: START });
  assert.equal(board.digital[0].slaStatus, 'at_risk');
  assert.equal(board.digital[0].slaAtRisk, true);
  assert.equal(board.digitalSlaAtRisk, 1);
});

test('supervisor board separately counts breached digital response targets', () => {
  const board = supervisorQueueBoard({ digitalQueue: [digitalItem('D1', 13)], digitalNow: START });
  assert.equal(board.digital[0].slaStatus, 'breached');
  assert.equal(board.digital[0].slaBreached, true);
  assert.equal(board.digitalSlaBreached, 1);
  assert.equal(board.slaAtRisk, 1);
});

test('supervisor board distinguishes a completed timely first response from an open queue breach', () => {
  const completedLate = {
    ...digitalItem('D-LATE', 20, { status: DIGITAL_STATUS.AWAITING_CUSTOMER, firstResponseAt: new Date(START - 19 * 60_000).toISOString() }),
    assignedTo: 'EMP-AGENT'
  };
  const queue = [digitalItem('D-OPEN', 13), completedLate];
  const board = supervisorQueueBoard({ digitalQueue: queue, digitalNow: START });
  assert.equal(board.digitalWaiting, 1);
  assert.equal(board.digitalSlaBreached, 1);
  assert.equal(board.digital[0].id, 'D-OPEN');
});


test('supervisor risk and breach totals include active digital work as well as waiting contacts', () => {
  const activeRisk = digitalItem('D-ACTIVE-RISK', 8, { status: DIGITAL_STATUS.ACTIVE });
  const activeBreach = digitalItem('D-ACTIVE-BREACH', 13, { status: DIGITAL_STATUS.ACTIVE });
  const board = supervisorQueueBoard({ digitalQueue: [activeRisk, activeBreach], digitalNow: START });
  assert.equal(board.digitalWaiting, 0);
  assert.equal(board.digitalSlaAtRisk, 1);
  assert.equal(board.digitalSlaBreached, 1);
  assert.equal(board.slaAtRisk, 2);
});
