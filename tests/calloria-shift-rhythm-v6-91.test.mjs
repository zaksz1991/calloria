import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShiftRhythmSnapshot, buildShiftCommandSnapshot, buildShiftCommandPanelHTML } from '../js/calloria-shift-command-centre-v6-90.mjs';

const stateAt = (elapsed, overrides = {}) => ({
  shiftActive: true,
  shiftElapsedMinutes: elapsed,
  agentStatus: 'available',
  shiftRecord: {
    status: 'active',
    plan: {
      startMinute: 480,
      endMinute: 1020,
      breaks: [
        { id: 'morning-break', label: 'Morning break', startMinute: 600, endMinute: 615 },
        { id: 'lunch-break', label: 'Lunch break', startMinute: 750, endMinute: 780 },
        { id: 'afternoon-break', label: 'Afternoon break', startMinute: 900, endMinute: 915 }
      ]
    },
    events: [{ status: 'available', elapsedMinute: 0 }]
  },
  digitalActiveIds: [],
  ...overrides
});

test('previews the next scheduled break from the saved shift plan', () => {
  const rhythm = buildShiftRhythmSnapshot(stateAt(60));
  assert.equal(rhythm.breakLabel, 'Morning break · 10:00 (60m)');
  assert.equal(rhythm.minutesToBreak, 60);
  assert.equal(rhythm.statusLabel, 'ON DUTY');
  assert.equal(rhythm.shiftRemainingMinutes, 480);
});

test('recognises an active scheduled break and confirms when it is available', () => {
  const rhythm = buildShiftRhythmSnapshot(stateAt(120));
  assert.equal(rhythm.expectedMode, 'break');
  assert.equal(rhythm.statusLabel, 'SCHEDULED BREAK READY');
  assert.equal(rhythm.breakReady, true);
  assert.equal(rhythm.breakLabel, 'Morning break · ends 10:15 (15m left)');
  assert.equal(rhythm.breaks[0].state, 'active');
});

test('does not mark a scheduled break ready while customer work is active', () => {
  const rhythm = buildShiftRhythmSnapshot(stateAt(120, {
    currentCall: { id: 'CALL-1' },
    digitalActiveIds: ['DIG-1']
  }));
  assert.equal(rhythm.activeWork, 2);
  assert.equal(rhythm.breakReady, false);
  assert.equal(rhythm.statusLabel, 'BREAK WINDOW · FINISH CUSTOMER WORK');
  assert.match(rhythm.guidance, /Finish or safely close active customer work/);
});

test('calculates live adherence from the saved schedule and state events', () => {
  const rhythm = buildShiftRhythmSnapshot(stateAt(150, {
    shiftRecord: {
      status: 'active',
      plan: {
        startMinute: 480, endMinute: 1020,
        breaks: [{ id: 'morning-break', label: 'Morning break', startMinute: 600, endMinute: 615 }]
      },
      events: [
        { status: 'available', elapsedMinute: 0 },
        { status: 'break', elapsedMinute: 125 }
      ]
    },
    agentStatus: 'break'
  }));
  assert.equal(rhythm.deviations, 20);
  assert.equal(rhythm.adherence, 86.7);
  assert.equal(rhythm.plannedMinutes, 150);
});

test('respects a custom shift plan instead of hard-coding default break times', () => {
  const rhythm = buildShiftRhythmSnapshot(stateAt(45, {
    shiftRecord: {
      status: 'active',
      plan: { startMinute: 540, endMinute: 1080, breaks: [{ id: 'custom', label: 'Team pause', startMinute: 630, endMinute: 645 }] },
      events: [{ status: 'available', elapsedMinute: 0 }]
    }
  }));
  assert.equal(rhythm.startLabel, '09:00');
  assert.equal(rhythm.endLabel, '18:00');
  assert.equal(rhythm.breakLabel, 'Team pause · 10:30 (45m)');
});

test('does not mutate saved shift data', () => {
  const state = stateAt(120);
  const before = JSON.stringify(state);
  buildShiftRhythmSnapshot(state);
  buildShiftCommandSnapshot(state);
  assert.equal(JSON.stringify(state), before);
});

test('renders shift rhythm details in the accessible command panel', () => {
  const snapshot = buildShiftCommandSnapshot(stateAt(120));
  const html = buildShiftCommandPanelHTML(snapshot);
  assert.match(html, /Shift schedule and adherence/);
  assert.match(html, /SCHEDULED BREAK READY/);
  assert.match(html, /Morning break/);
  assert.match(html, /role="progressbar"/);
});

test('keeps the rhythm monitor inactive when no shift is active', () => {
  const rhythm = buildShiftRhythmSnapshot({ shiftActive: false });
  assert.equal(rhythm.active, false);
});
