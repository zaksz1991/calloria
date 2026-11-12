import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const P = require('../public/career-progression-engine.js');

function strongReport(overrides = {}) {
  return {
    completed: 5,
    averageQa: 92,
    averageCsat: 4.6,
    fcrRate: 80,
    complianceBreaches: 0,
    knowledgeUses: 3,
    score: 92,
    attendedMorningBriefing: true,
    attendedAfternoonBriefing: true,
    attendedBreaks: true,
    ...overrides
  };
}
function endedShift(overrides = {}) {
  return {
    date: '2026-11-12', agentName: 'Amina Yusuf', team: 'Customer Care',
    startedAt: '2026-11-12T07:30:00.000Z', endedAt: '2026-11-12T16:00:00.000Z',
    report: strongReport(), ...overrides
  };
}

 test('rank thresholds progress in the intended order', () => {
  assert.equal(P.rankForXp(0).current.id, 'new-starter');
  assert.equal(P.rankForXp(300).current.id, 'associate');
  assert.equal(P.rankForXp(750).current.id, 'skilled-associate');
  assert.equal(P.rankForXp(7200).current.id, 'leadership-ready');
  assert.equal(P.rankForXp(8000).next, null);
});

test('rank progress exposes percentage and remaining XP', () => {
  const result = P.rankForXp(150);
  assert.equal(result.current.name, 'New Starter');
  assert.equal(result.next.name, 'Customer Care Associate');
  assert.equal(result.progressPct, 50);
  assert.equal(result.xpToNext, 150);
});

test('shift XP rewards contacts, service results, knowledge and shift discipline', () => {
  const award = P.calculateShiftXp(strongReport());
  assert.equal(award.xp, 126);
  assert.match(award.reason, /Career XP earned/);
});

test('no completed contacts earn no career XP', () => {
  assert.equal(P.calculateShiftXp(strongReport({ completed: 0 })).xp, 0);
});

test('a critical compliance breach blocks all career XP for the shift', () => {
  const award = P.calculateShiftXp(strongReport({ complianceBreaches: 1 }));
  assert.equal(award.xp, 0);
  assert.match(award.reason, /critical compliance breach/);
});

test('achievement bonuses unlock only once', () => {
  const state = P.createInitialState();
  const first = P.syncFromFloor(state, { pastShifts: [endedShift()] });
  const totalAfterFirst = P.getSummary(state, 'Amina Yusuf', 'Customer Care').totalXp;
  const second = P.syncFromFloor(state, { pastShifts: [endedShift()] });
  assert.equal(first.imported, 1);
  assert.equal(second.imported, 0);
  assert.equal(P.getSummary(state, 'Amina Yusuf', 'Customer Care').totalXp, totalAfterFirst);
});

test('strong shift awards first-contact, five-served, quality, CSAT, safety, routine and FCR badges', () => {
  const state = P.createInitialState();
  const result = P.syncFromFloor(state, { pastShifts: [endedShift()] });
  const ids = result.awards[0].unlockedBadges.map((badge) => badge.id);
  for (const id of ['first-contact', 'five-contacts', 'quality-standard', 'customer-champion', 'safe-handling', 'floor-routine', 'fcr-specialist']) {
    assert.ok(ids.includes(id), `Expected badge ${id}`);
  }
});

test('knowledge seeker badge uses cumulative approved-knowledge references', () => {
  const state = P.createInitialState();
  const first = endedShift({ report: strongReport({ knowledgeUses: 2 }) });
  const second = endedShift({ date: '2026-11-13', startedAt: '2026-11-13T07:30:00.000Z', endedAt: '2026-11-13T16:00:00.000Z', report: strongReport({ knowledgeUses: 3 }) });
  const result = P.syncFromFloor(state, { pastShifts: [second, first] });
  assert.equal(result.imported, 2);
  assert.ok(result.awards.some((award) => award.unlockedBadges.some((badge) => badge.id === 'knowledge-seeker')));
});

test('compliance breach prevents performance badges while retaining the shift record', () => {
  const state = P.createInitialState();
  const result = P.syncFromFloor(state, { pastShifts: [endedShift({ report: strongReport({ complianceBreaches: 1 }) })] });
  assert.equal(result.imported, 1);
  assert.equal(result.awards[0].earnedXp, 0);
  assert.equal(result.awards[0].unlockedBadges.length, 0);
  assert.equal(P.getSummary(state, 'Amina Yusuf', 'Customer Care').totalShifts, 1);
});

test('shift history imports in chronological order even if source history is newest first', () => {
  const state = P.createInitialState();
  const older = endedShift({ date: '2026-11-10', startedAt: '2026-11-10T07:30:00.000Z', endedAt: '2026-11-10T16:00:00.000Z' });
  const newer = endedShift({ date: '2026-11-11', startedAt: '2026-11-11T07:30:00.000Z', endedAt: '2026-11-11T16:00:00.000Z' });
  P.syncFromFloor(state, { pastShifts: [newer, older] });
  const summary = P.getSummary(state, 'Amina Yusuf', 'Customer Care');
  assert.equal(summary.totalShifts, 2);
  assert.equal(summary.lastAward.date, '2026-11-11');
});

test('current ended shift is imported and its report is calculated from live-floor state', () => {
  const state = P.createInitialState();
  const floor = {
    shift: { status: 'Ended', date: '2026-11-12', agentName: 'Amina Yusuf', team: 'Customer Care', startedAt: '2026-11-12T07:30:00Z', endedAt: '2026-11-12T16:00:00Z' },
    events: { morningBriefing: true, afternoonBriefing: true, morningBreak: true, lunchBreak: true },
    completedContacts: [{}, {}, {}],
    metrics: { completed: 3, qaTotal: 276, csatTotal: 14, fcr: 2, complianceBreaches: 0, knowledgeUses: 2, totalHandleMinutes: 90 }
  };
  const result = P.syncFromFloor(state, floor);
  assert.equal(result.imported, 1);
  assert.equal(result.awards[0].completed, 3);
  assert.ok(result.awards[0].earnedXp > 0);
});

test('archived shifts keep separate employee profiles by employee and team', () => {
  const state = P.createInitialState();
  const a = endedShift({ agentName: 'Amina Yusuf', team: 'Customer Care' });
  const b = endedShift({ agentName: 'Amina Yusuf', team: 'Digital Support', date: '2026-11-13', startedAt: '2026-11-13T07:30:00Z', endedAt: '2026-11-13T16:00:00Z' });
  P.syncFromFloor(state, { pastShifts: [a, b] });
  assert.equal(P.getSummary(state, 'Amina Yusuf', 'Customer Care').totalShifts, 1);
  assert.equal(P.getSummary(state, 'Amina Yusuf', 'Digital Support').totalShifts, 1);
});

test('shift identity is stable across current and archived shift representations', () => {
  const shift = endedShift();
  const current = { ...shift, report: undefined };
  assert.equal(P.shiftIdentity(shift), P.shiftIdentity(current));
});

test('shift objectives show live progress and blocked compliance', () => {
  const objectives = P.getShiftObjectives({
    shift: { status: 'On shift' },
    metrics: { completed: 3, qaTotal: 270, knowledgeUses: 1, complianceBreaches: 1 },
    events: { morningBriefing: true, afternoonBriefing: false, morningBreak: true, lunchBreak: false }
  });
  assert.equal(objectives.find((item) => item.id === 'contacts').done, true);
  assert.equal(objectives.find((item) => item.id === 'quality').done, true);
  assert.equal(objectives.find((item) => item.id === 'safety').status, 'Blocked');
  assert.equal(objectives.find((item) => item.id === 'briefings').done, false);
});

test('profile identifiers are normalised and HTML characters are stripped from display names', () => {
  assert.equal(P.profileKey(' Amina <Yusuf> ', 'Customer Care'), 'amina-yusuf::customer-care');
  const state = P.createInitialState();
  const profile = P.getProfile(state, '<Amina>', 'Customer Care');
  assert.equal(profile.agentName, 'Amina');
});

test('browser storage round-trip preserves progression without touching live-floor storage keys', () => {
  const map = new Map();
  const storage = { getItem: (key) => map.get(key) || null, setItem: (key, value) => map.set(key, value) };
  const state = P.createInitialState();
  P.syncFromFloor(state, { pastShifts: [endedShift()] });
  assert.equal(P.save(state, storage), true);
  const loaded = P.load(storage);
  assert.equal(P.getSummary(loaded, 'Amina Yusuf', 'Customer Care').totalShifts, 1);
  assert.equal(map.has('calloria.live-floor.v60'), false);
});

test('corrupt progression storage safely falls back to a clean state', () => {
  const storage = { getItem: () => '{invalid', setItem: () => {} };
  assert.equal(P.load(storage).version, P.VERSION);
});

test('progression state caps archived records and badge catalogue is fixed', () => {
  const state = P.createInitialState();
  assert.equal(P.BADGES.length, 8);
  assert.ok(P.RANKS.length >= 7);
  const profile = P.getProfile(state, 'Amina Yusuf', 'Customer Care');
  profile.shiftHistory = Array.from({ length: 120 }, (_, index) => ({ id: index }));
  const normal = P.normaliseState(state);
  assert.equal(normal.profiles[P.profileKey('Amina Yusuf', 'Customer Care')].shiftHistory.length, 100);
});

test('live-floor archives prior shift identity and career progression imports it on the next sign-in', () => {
  const F = require('../public/live-floor-engine.js');
  const floor = F.createInitialState(new Date('2026-11-12T07:00:00.000Z'));
  floor.shift = {
    status: 'Ended', date: '2026-11-11', minutes: 960,
    startedAt: '2026-11-11T07:30:00.000Z', endedAt: '2026-11-11T16:00:00.000Z',
    agentName: 'Amina Yusuf', team: 'Customer Care'
  };
  floor.events = { morningBriefing: true, afternoonBriefing: true, morningBreak: true, lunchBreak: true };
  floor.metrics = { completed: 5, qaTotal: 460, csatTotal: 23, fcr: 4, complianceBreaches: 0, knowledgeUses: 5, totalHandleMinutes: 150 };
  floor.completedContacts = Array.from({ length: 5 }, (_, index) => ({ id: index }));
  const agentState = { activeContactId: null, agent: { shiftStartedAt: null, shiftEndedAt: '2026-11-11T16:00:00.000Z' } };
  const agentEngine = {
    createInitialState() { return { activeContactId: null, agent: { shiftStartedAt: null, shiftEndedAt: null } }; },
    startShift(state, name, team, at) { state.agent = { shiftStartedAt: at.toISOString(), shiftEndedAt: null, name, team }; }
  };
  F.startShift(floor, agentState, agentEngine, { name: 'Amina Yusuf', team: 'Customer Care' }, new Date('2026-11-12T07:30:00.000Z'));
  assert.equal(floor.pastShifts[0].team, 'Customer Care');
  assert.equal(floor.pastShifts[0].startedAt, '2026-11-11T07:30:00.000Z');
  const career = P.createInitialState();
  const sync = P.syncFromFloor(career, floor);
  assert.equal(sync.imported, 1);
  assert.equal(P.getSummary(career, 'Amina Yusuf', 'Customer Care').totalShifts, 1);
});
