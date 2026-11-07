import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WFM_ACTIVITIES, calculateScheduleAdherence, cleanWfmText, currentActivity,
  isUuid, localDateTimeToIso, validateBriefingDate, validatePlanBlocks, validateShift
} from '../js/wfm-engine.js';

const userId = '78d5a45c-b19c-4e26-9a0d-77f4e42f5fd1';
const startAt = '2026-11-10T08:00:00.000Z';
const endAt = '2026-11-10T17:00:00.000Z';

test('department-scoped shift validation accepts a valid shift', () => {
  const shift = validateShift({ staffId: userId, department: 'Email and Written Support', startAt, endAt }, ['Email and Written Support'], Date.parse('2026-11-07T12:00:00Z'));
  assert.equal(shift.staffId, userId);
  assert.equal(shift.department, 'Email and Written Support');
});

test('shift validation rejects an unauthorised department', () => {
  assert.throws(() => validateShift({ staffId: userId, department: 'Technical Support and IT', startAt, endAt }, ['Email and Written Support'], Date.parse('2026-11-07T12:00:00Z')), /permission/);
});

test('shift validation enforces four-to-sixteen-hour duration', () => {
  assert.throws(() => validateShift({ staffId: userId, department: 'Email and Written Support', startAt, endAt: '2026-11-10T10:00:00Z' }, ['Email and Written Support'], Date.parse('2026-11-07T12:00:00Z')), /four hours/);
});

test('planned activity blocks default to customer operations', () => {
  const blocks = validatePlanBlocks([], startAt, endAt);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].activity, 'customer_work');
});

test('planned activity blocks reject overlaps and off-shift times', () => {
  assert.throws(() => validatePlanBlocks([
    { activity: 'customer_work', startAt, endAt: '2026-11-10T12:00:00Z' },
    { activity: 'break', startAt: '2026-11-10T11:55:00Z', endAt: '2026-11-10T12:15:00Z' }
  ], startAt, endAt), /must not overlap/);
  assert.throws(() => validatePlanBlocks([
    { activity: 'break', startAt: '2026-11-10T07:45:00Z', endAt: '2026-11-10T08:00:00Z' }
  ], startAt, endAt), /inside the shift/);
});

test('adherence is calculated from matched planned and recorded activity minutes', () => {
  const plan = [{ activity: 'customer_work', start_at: '2026-11-10T08:00:00Z', end_at: '2026-11-10T09:00:00Z' }];
  const actual = [{ activity: 'customer_work', started_at: '2026-11-10T08:00:00Z', ended_at: '2026-11-10T08:30:00Z' }];
  const result = calculateScheduleAdherence(plan, actual, Date.parse('2026-11-10T09:00:00Z'));
  assert.equal(result.plannedMinutes, 60);
  assert.equal(result.matchedMinutes, 30);
  assert.equal(result.adherence, 50);
  assert.equal(result.deviationMinutes, 30);
});

test('open actual activity intervals are measured only to the current time', () => {
  const plan = [{ activity: 'break', start_at: '2026-11-10T10:00:00Z', end_at: '2026-11-10T10:30:00Z' }];
  const actual = [{ activity: 'break', started_at: '2026-11-10T10:00:00Z', ended_at: null }];
  assert.equal(calculateScheduleAdherence(plan, actual, Date.parse('2026-11-10T10:15:00Z')).adherence, 100);
});

test('current activity returns only an interval active at the supplied time', () => {
  const actual = [
    { activity: 'customer_work', started_at: '2026-11-10T08:00:00Z', ended_at: '2026-11-10T09:00:00Z' },
    { activity: 'break', started_at: '2026-11-10T09:00:00Z', ended_at: null }
  ];
  assert.equal(currentActivity(actual, Date.parse('2026-11-10T09:15:00Z')).activity, 'break');
});

test('briefing dates reject invalid calendar dates', () => {
  assert.equal(validateBriefingDate('2026-11-10'), '2026-11-10');
  assert.throws(() => validateBriefingDate('2026-02-31'), /valid briefing date/);
});

test('local datetime conversion preserves local browser timezone offset', () => {
  const iso = localDateTimeToIso('2026-11-10', '07:30');
  assert.equal(new Date(iso).getHours(), 7);
  assert.equal(new Date(iso).getMinutes(), 30);
});

test('safe text and UUID validation reject malformed identifiers', () => {
  assert.equal(cleanWfmText('  morning\n briefing  '), 'morning briefing');
  assert.equal(isUuid(userId), true);
  assert.equal(isUuid('staff-12'), false);
  assert.equal(WFM_ACTIVITIES.includes('offline'), false);
});
