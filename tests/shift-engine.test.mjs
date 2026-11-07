import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_STATES, DEFAULT_SHIFT_PLAN, createShiftRecord, recordAgentState,
  expectedShiftMode, calculateShiftAdherence, nextScheduledBreak,
  closeShift, createCoachingRecord
} from '../js/shift-engine.js';

test('shift state catalogue and default work schedule are coherent', () => {
  assert.deepEqual(AGENT_STATES, ['available', 'busy', 'wrap-up', 'break', 'offline']);
  assert.equal(DEFAULT_SHIFT_PLAN.startMinute, 480);
  assert.equal(DEFAULT_SHIFT_PLAN.endMinute, 1020);
  assert.deepEqual(DEFAULT_SHIFT_PLAN.breaks.map(x => [x.startMinute, x.endMinute]), [[600, 615], [750, 780], [900, 915]]);
});

test('shift transitions record valid states and reject backward event time', () => {
  const shift = createShiftRecord({ day: 4, startedAt: Date.UTC(2026, 10, 6, 8) });
  recordAgentState(shift, 'busy', 8, 'Customer call');
  recordAgentState(shift, 'wrap-up', 24, 'After-contact work');
  assert.equal(shift.events.length, 3);
  assert.throws(() => recordAgentState(shift, 'available', 20), /cannot move backwards/);
  assert.throws(() => recordAgentState(shift, 'unknown', 25), /Unknown agent state/);
});

test('scheduled break detection and adherence score reward matching agent states', () => {
  const shift = createShiftRecord({ startedAt: Date.UTC(2026, 10, 6, 8) });
  assert.equal(expectedShiftMode(shift, 0), 'working');
  assert.equal(expectedShiftMode(shift, 120), 'break');
  assert.equal(expectedShiftMode(shift, 540), 'off-duty');
  recordAgentState(shift, 'break', 120, 'Morning break');
  assert.equal(nextScheduledBreak(shift, 125).active, true);
  recordAgentState(shift, 'available', 135, 'Returned from break');
  const score = calculateShiftAdherence(shift, 150);
  assert.equal(score.adherence, 100);
  assert.equal(score.breakMinutes, 15);
  assert.equal(score.matchedMinutes, 150);
});

test('late start is counted as schedule deviation', () => {
  const shift = createShiftRecord({ startedAt: Date.UTC(2026, 10, 6, 8, 5) });
  shift.events = [{ status: 'offline', elapsedMinute: 0, at: shift.startedAt, reason: 'Before start' }];
  recordAgentState(shift, 'available', 5, 'Late start');
  const result = calculateShiftAdherence(shift, 30);
  assert.equal(result.adherence, 83.3);
  assert.equal(result.deviations, 5);
});

test('shift closure blocks active calls and stores final adherence', () => {
  const shift = createShiftRecord({ startedAt: Date.UTC(2026, 10, 6, 8) });
  recordAgentState(shift, 'busy', 10, 'Active call');
  assert.throws(() => closeShift(shift, Date.UTC(2026, 10, 6, 9), 20), /Complete the customer interaction/);
  recordAgentState(shift, 'available', 15, 'Call completed');
  recordAgentState(shift, 'offline', 20, 'Shift closed');
  const closed = closeShift(shift, Date.UTC(2026, 10, 6, 9), 20);
  assert.equal(closed.status, 'completed');
  assert.equal(closed.elapsedMinutes, 20);
  assert.equal(typeof closed.adherence.adherence, 'number');
});

test('coaching record validates required fields and creates a bounded action plan', () => {
  const records = [];
  assert.throws(() => createCoachingRecord(records, { coach: ' ', topic: 'Quality', actionPlan: 'Improve' }), /required/);
  const item = createCoachingRecord(records, { coach: 'Supervisor', topic: 'Call control', feedback: 'Observed long holds', actionPlan: 'Explain hold reason and check back every 60 seconds.', score: 5 }, Date.UTC(2026, 10, 6));
  assert.equal(item.coach, 'Supervisor');
  assert.equal(item.score, 5);
  assert.equal(item.status, 'action_plan_open');
  assert.equal(records.length, 1);
});

test('shift plan rejects overlapping or out-of-window breaks', () => {
  const plan = { startMinute: 480, endMinute: 1020, breaks: [
    { id: 'a', label: 'A', startMinute: 600, endMinute: 630 },
    { id: 'b', label: 'B', startMinute: 620, endMinute: 640 }
  ] };
  assert.throws(() => createShiftRecord({ plan }), /Invalid scheduled break/);
});
