import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const W = require('../public/workforce-control-engine.js');

function state() { return W.createInitialState('2026-11-11'); }

test('initial state contains workforce, shifts, forecast and intraday records', () => {
  const s = state();
  assert.equal(s.version, 48);
  assert.equal(s.agents.length, 8);
  assert.equal(s.shifts.length, 8);
  assert.ok(s.forecast.length >= 12);
  assert.equal(s.simulatedTime, '10:30');
});

test('valid 24-hour time parsing rejects malformed values', () => {
  assert.equal(W.timeToMinutes('08:30'), 510);
  assert.equal(W.timeToMinutes('24:00'), Number.NaN);
  assert.equal(W.timeToMinutes('8:30'), Number.NaN);
  assert.equal(W.minutesToTime(510), '08:30');
});

test('planned status respects shift boundaries and scheduled breaks', () => {
  const shift = { start: '08:00', end: '16:00', breakStart: '10:30', breakEnd: '10:45' };
  assert.equal(W.getPlannedStatus(shift, '07:59'), 'Off duty');
  assert.equal(W.getPlannedStatus(shift, '10:30'), 'Break');
  assert.equal(W.getPlannedStatus(shift, '10:45'), 'Working');
  assert.equal(W.getPlannedStatus(shift, '16:00'), 'Off duty');
});

test('forecast workload converts to a non-negative staffing requirement', () => {
  assert.equal(W.calculateRequiredAgents({ voice: 0, chat: 0, email: 0, social: 0 }, .82), 0);
  assert.ok(W.calculateRequiredAgents({ voice: 10, chat: 10, email: 8, social: 3 }, .82) > 0);
});

test('coverage reports a workforce gap without negative values', () => {
  const s = state();
  const coverage = W.calculateIntervalCoverage(s, '10:30');
  assert.ok(coverage.required >= 0);
  assert.ok(coverage.scheduled >= coverage.available);
  assert.ok(coverage.gap >= 0);
  assert.ok(['Covered', 'Under-covered', 'Over-covered'].includes(coverage.status));
});

test('intraday adherence compares actual state with planned work and breaks', () => {
  const s = state();
  s.simulatedTime = '10:30';
  const result = W.deriveIntraday(s);
  const amina = result.roster.find((agent) => agent.id === 'ag-104');
  assert.equal(amina.planned, 'Break');
  assert.equal(amina.actual, 'Available');
  assert.equal(amina.adherent, false);
  assert.equal(result.adherence, Math.round(result.roster.filter((agent) => agent.adherent).length / result.roster.length * 100));
});

test('shift validation accepts a skilled agent with a contained 15-minute break', () => {
  const s = state();
  const result = W.validateShift({ agentId: 'ag-104', date: s.date, channel: 'Voice', start: '16:00', end: '22:00', breakStart: '19:00', breakEnd: '19:15' }, s.shifts, s.agents);
  assert.equal(result.valid, true);
});

test('shift validation rejects unsupported skills and overlapping shifts', () => {
  const s = state();
  const unskilled = W.validateShift({ agentId: 'ag-104', date: s.date, channel: 'Social', start: '16:00', end: '22:00', breakStart: '19:00', breakEnd: '19:15' }, s.shifts, s.agents);
  assert.equal(unskilled.valid, false);
  assert.ok(unskilled.errors.some((message) => message.includes('not marked as skilled')));
  const overlap = W.validateShift({ agentId: 'ag-104', date: s.date, channel: 'Voice', start: '15:00', end: '22:00', breakStart: '18:00', breakEnd: '18:15' }, s.shifts, s.agents);
  assert.ok(overlap.errors.some((message) => message.includes('overlapping')));
});

test('shift validation rejects invalid break and duration ranges', () => {
  const s = state();
  const bad = W.validateShift({ agentId: 'ag-108', date: s.date, channel: 'Voice', start: '16:00', end: '23:30', breakStart: '15:00', breakEnd: '15:10' }, s.shifts, s.agents);
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 2);
});

test('addShift creates a draft only after validation', () => {
  const s = state();
  const result = W.addShift(s, { id: 'sh-test', agentId: 'ag-104', date: s.date, channel: 'Voice', start: '16:00', end: '22:00', breakStart: '19:00', breakEnd: '19:15' });
  assert.equal(result.ok, true);
  assert.equal(result.shift.status, 'Draft');
  assert.equal(s.shifts.at(-1).id, 'sh-test');
  const invalid = W.addShift(s, { agentId: 'ag-104', date: s.date, channel: 'Voice', start: '15:00', end: '22:00', breakStart: '19:00', breakEnd: '19:15' });
  assert.equal(invalid.ok, false);
});

test('actual status update validates agent and allowed state', () => {
  const s = state();
  assert.equal(W.updateActualStatus(s, 'ag-104', 'On contact').ok, true);
  assert.equal(s.actualStates['ag-104'], 'On contact');
  assert.equal(W.updateActualStatus(s, 'missing', 'Available').ok, false);
  assert.equal(W.updateActualStatus(s, 'ag-104', 'Invisible').ok, false);
});

test('forecast updates reject fractional, negative and excessive counts', () => {
  const s = state();
  assert.equal(W.updateForecast(s, '10:30', { voice: 15, chat: 14 }).ok, true);
  assert.equal(s.forecast.find((row) => row.time === '10:30').voice, 15);
  assert.equal(W.updateForecast(s, '10:30', { voice: -1 }).ok, false);
  assert.equal(W.updateForecast(s, '10:30', { email: 3.5 }).ok, false);
});

test('publishing changes only the selected date shifts', () => {
  const s = state();
  const result = W.publishSchedule(s);
  assert.equal(result.ok, true);
  assert.equal(result.count, 8);
  assert.ok(s.shifts.filter((shift) => shift.date === s.date).every((shift) => shift.status === 'Published'));
});

test('CSV export escapes fields and exports only the active date', () => {
  const s = state();
  s.agents[0].name = 'Amina "A" Yusuf';
  s.shifts.push({ id: 'other-day', agentId: 'ag-104', date: '2026-11-12', channel: 'Voice', start: '08:00', end: '16:00', breakStart: '12:00', breakEnd: '12:15', status: 'Draft' });
  const csv = W.toCsv(s);
  assert.ok(csv.includes('"Amina ""A"" Yusuf"'));
  assert.ok(!csv.includes('2026-11-12'));
});

test('state persists and reloads with versioned local storage key', () => {
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) || null, setItem: (key, value) => store.set(key, value) };
  const s = state();
  s.simulatedTime = '11:00';
  assert.equal(W.saveState(s, storage), true);
  const restored = W.loadState(storage);
  assert.equal(restored.simulatedTime, '11:00');
  assert.equal(restored.version, 48);
  assert.equal(W.STORAGE_KEY, 'calloria.workforce-control.v48');
});
