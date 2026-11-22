import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scheduleDigitalFollowUpCoachingCheckpoints,
  assessDigitalFollowUpCoachingCheckpoint,
  recordDigitalFollowUpCoachingCheckpoint,
  digitalFollowUpCoachingCheckpointBoard
} from '../js/digital-followup-coaching-checkpoints-engine-v727.js';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from '../build/calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const REVIEWED_AT = '2026-11-01T12:00:00.000Z';
const DUE_7 = '2026-11-08T12:00:00.000Z';
const plan = (overrides = {}) => ({
  id: 'COACH-1', agentId: 'EMP-100', status: 'completed', focus: 'overdue_recovery',
  focusLabel: 'Overdue follow-up recovery', target: { overdue: 0 },
  outcomeReview: {
    status: 'achieved', reviewedAt: REVIEWED_AT, current: 0,
    evidence: { overdue: 0, atRisk: 1, completed: 5, late: 1, responseTargetRate: 80 }
  },
  ...overrides
});
const scorecard = (overrides = {}) => ({
  agentId: 'EMP-100', overdue: 0, atRisk: 1, completed: 6, late: 1, responseTargetRate: 80, ...overrides
});
const performance = (...agents) => ({ agents });
const scheduledPlan = () => scheduleDigitalFollowUpCoachingCheckpoints([plan()], 'COACH-1')[0];

test('schedules 7-day and 30-day checks from the outcome review timestamp', () => {
  const scheduled = scheduledPlan();
  assert.equal(scheduled.followUpCheckpoints.length, 2);
  assert.equal(scheduled.followUpCheckpoints[0].key, 'day_7');
  assert.equal(scheduled.followUpCheckpoints[0].dueAt, DUE_7);
  assert.equal(scheduled.followUpCheckpoints[1].key, 'day_30');
  assert.equal(scheduled.followUpCheckpoints[1].dueAt, '2026-12-01T12:00:00.000Z');
});

test('checkpoint scheduling is immutable, idempotent and rejects ineligible plans', () => {
  const initial = [plan()];
  const once = scheduleDigitalFollowUpCoachingCheckpoints(initial, 'COACH-1');
  const twice = scheduleDigitalFollowUpCoachingCheckpoints(once, 'COACH-1');
  assert.equal(initial[0].followUpCheckpoints, undefined);
  assert.equal(once[0].followUpCheckpoints.length, 2);
  assert.equal(twice[0], once[0]);
  assert.equal(scheduleDigitalFollowUpCoachingCheckpoints([plan({ status: 'in_progress' })], 'COACH-1')[0].followUpCheckpoints, undefined);
  assert.equal(scheduleDigitalFollowUpCoachingCheckpoints([plan({ outcomeReview: null })], 'COACH-1')[0].followUpCheckpoints, undefined);
  assert.equal(scheduleDigitalFollowUpCoachingCheckpoints(initial, 'missing')[0], initial[0]);
});

test('checkpoint assessment refuses early attempts and mismatched agent scorecards', () => {
  const p = scheduledPlan();
  const cp = p.followUpCheckpoints[0];
  assert.equal(assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard(), { now: '2026-11-08T11:59:59.000Z', recordedAt: DUE_7 }), null);
  assert.equal(assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard({ agentId: 'EMP-OTHER' }), { now: DUE_7, recordedAt: DUE_7 }), null);
});

test('maintained target, further improvement and regression are differentiated', () => {
  const p = scheduledPlan();
  const cp = p.followUpCheckpoints[0];
  const maintained = assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard({ overdue: 0 }), { now: DUE_7, recordedAt: DUE_7 });
  const regressed = assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard({ overdue: 2 }), { now: DUE_7, recordedAt: DUE_7 });
  const improving = assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard({ overdue: 0 }), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(maintained.status, 'target_maintained');
  assert.equal(regressed.status, 'regressed');
  assert.equal(improving.status, 'target_maintained');
  const targetNewlyReachedPlan = plan({ outcomeReview: { ...plan().outcomeReview, status: 'improving' } });
  const scheduledForNewlyReached = scheduleDigitalFollowUpCoachingCheckpoints([targetNewlyReachedPlan], 'COACH-1')[0];
  const newlyReached = assessDigitalFollowUpCoachingCheckpoint(scheduledForNewlyReached, scheduledForNewlyReached.followUpCheckpoints[0], scorecard({ overdue: 0 }), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(newlyReached.status, 'target_reached');
  assert.match(newlyReached.label, /reached at this checkpoint/);
  const riskPlan = plan({ focus: 'at_risk_prevention', target: { atRisk: 0 }, outcomeReview: { status: 'improving', reviewedAt: REVIEWED_AT, current: 3, evidence: { atRisk: 3, completed: 5 } } });
  const scheduledRiskPlan = scheduleDigitalFollowUpCoachingCheckpoints([riskPlan], 'COACH-1')[0];
  const improved = assessDigitalFollowUpCoachingCheckpoint(scheduledRiskPlan, scheduledRiskPlan.followUpCheckpoints[0], scorecard({ atRisk: 2 }), { now: DUE_7, recordedAt: DUE_7 });
  const stable = assessDigitalFollowUpCoachingCheckpoint(scheduledRiskPlan, scheduledRiskPlan.followUpCheckpoints[0], scorecard({ atRisk: 3 }), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(improved.status, 'improved');
  assert.equal(stable.status, 'stable');
  assert.equal(regressed.reference, 0);
  assert.equal(regressed.current, 2);
});

test('insufficient new workload is recorded as insufficient evidence, not zero', () => {
  const p = scheduledPlan();
  const cp = p.followUpCheckpoints[0];
  const review = assessDigitalFollowUpCoachingCheckpoint(p, cp, scorecard({ completed: 5 }), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(review.status, 'insufficient_data');
  assert.equal(review.current, 0);
  assert.match(review.label, /at least 1 new completed follow-up/);
});

test('response-rate checkpoint requires three new completed follow-ups', () => {
  const p = plan({
    focus: 'response_sla_consistency', focusLabel: 'Response target consistency', target: { responseTargetRate: 85 },
    outcomeReview: { status: 'improving', reviewedAt: REVIEWED_AT, current: 80, evidence: { responseTargetRate: 80, completed: 10 } }
  });
  const scheduled = scheduleDigitalFollowUpCoachingCheckpoints([p], 'COACH-1')[0];
  const cp = scheduled.followUpCheckpoints[0];
  const insufficient = assessDigitalFollowUpCoachingCheckpoint(scheduled, cp, scorecard({ completed: 12, responseTargetRate: 90 }), { now: DUE_7, recordedAt: DUE_7 });
  const achieved = assessDigitalFollowUpCoachingCheckpoint(scheduled, cp, scorecard({ completed: 13, responseTargetRate: 88 }), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(insufficient.status, 'insufficient_data');
  assert.equal(achieved.status, 'target_reached');
  assert.equal(achieved.newCompleted, 3);
});

test('records a due checkpoint once and preserves the source plan', () => {
  const initial = [scheduledPlan()];
  const cp = initial[0].followUpCheckpoints[0];
  const updated = recordDigitalFollowUpCoachingCheckpoint(initial, 'COACH-1', cp.id, performance(scorecard()), { now: DUE_7, recordedAt: DUE_7, recordedBy: 'SUP-1' });
  assert.notEqual(updated, initial);
  assert.equal(initial[0].followUpCheckpoints[0].review, null);
  assert.equal(updated[0].followUpCheckpoints[0].review.status, 'target_maintained');
  assert.equal(updated[0].followUpCheckpoints[0].review.recordedBy, 'SUP-1');
  const duplicate = recordDigitalFollowUpCoachingCheckpoint(updated, 'COACH-1', cp.id, performance(scorecard()), { now: DUE_7, recordedAt: DUE_7 });
  assert.equal(duplicate[0], updated[0]);
});

test('checkpoint board reports due, overdue, recorded and legacy unscheduled plans', () => {
  const p = scheduledPlan();
  const recorded = { ...p, followUpCheckpoints: p.followUpCheckpoints.map((cp, index) => index ? ({ ...cp, dueAt: DUE_7 }) : ({ ...cp, status: 'recorded', review: { status: 'insufficient_data', recordedAt: DUE_7 } })) };
  const board = digitalFollowUpCoachingCheckpointBoard([recorded, plan({ id: 'LEGACY' })], performance(scorecard()), '2026-11-10T12:00:00.000Z');
  assert.equal(board.total, 2);
  assert.equal(board.recorded, 1);
  assert.equal(board.due, 1);
  assert.equal(board.overdue, 1);
  assert.equal(board.unscheduledPlans.length, 1);
  assert.equal(board.unscheduledPlans[0].planId, 'LEGACY');
});

test('plugin adds checkpoint panel and actions after v7.26, safely and idempotently', async () => {
  const sourceBeforeV723 = [
    "import { assessDigitalResponseCycles, digitalResponseCycleDisplay } from './digital-response-cycle-engine-v721.js';",
    '/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */',
    'function renderSupervisor(){',
    '  const nowVoice=queueSimulationNowMs();',
    '  const digitalLive=digitalLiveQueueSnapshot(state.digitalLiveQueueSimulation,state.shiftElapsedMinutes);',
    '  viewRoot.innerHTML=`',
    '    <section class="panel supervisor-escalation-desk"',
    '  `;',
    '}',
    'function handleAction(){ switch (event.action) {',
    "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;",
    '    default: break;',
    '} }'
  ].join('\n');
  const call = (plugin, source) => plugin().transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  const s723 = call(calloriaDigitalFollowUpSupervisorPluginV723, sourceBeforeV723);
  const s724 = call(calloriaDigitalFollowUpPerformancePluginV724, s723.code);
  const s725 = call(calloriaDigitalFollowUpCoachingPluginV725, s724.code);
  const s726 = call(calloriaDigitalFollowUpCoachingOutcomesPluginV726, s725.code);
  const plugin = calloriaDigitalFollowUpCoachingCheckpointsPluginV727();
  const s727 = plugin.transform.call({ warn(message) { throw new Error(message); } }, s726.code, '/repo/js/main.js');
  assert.ok(s727?.code);
  for (const fragment of [
    '/* CALLORIA_V727_DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS */',
    "from './digital-followup-coaching-checkpoints-engine-v727.js';",
    "import '../styles/calloria-digital-followup-coaching-checkpoints-v727.css';",
    'Coaching sustainment checkpoints',
    '${digitalFollowUpCoachingCheckpointPanel}',
    'schedule-digital-followup-coaching-checkpoints',
    'record-digital-followup-coaching-checkpoint',
    'scheduleDigitalFollowUpCoachingCheckpoints',
    'recordDigitalFollowUpCoachingCheckpoint'
  ]) assert.ok(s727.code.includes(fragment), `missing integration fragment: ${fragment}`);
  assert.ok(s727.code.indexOf('${digitalFollowUpCoachingOutcomePanel}') < s727.code.indexOf('${digitalFollowUpCoachingCheckpointPanel}'));
  const outcomeAction = s727.code.indexOf('const outcome = plan?.outcomeReview;');
  const scheduleAfterOutcome = s727.code.indexOf('state.digitalFollowUpCoachingPlans = scheduleDigitalFollowUpCoachingCheckpoints', outcomeAction);
  const outcomeTimeline = s727.code.indexOf('Digital follow-up coaching outcome reviewed.', scheduleAfterOutcome);
  assert.ok(outcomeAction >= 0 && scheduleAfterOutcome > outcomeAction && outcomeTimeline > scheduleAfterOutcome, 'new outcome reviews must schedule their follow-through checkpoints automatically');
  const tempDir = await mkdtemp(join(tmpdir(), 'calloria-v727-'));
  try {
    const generated = join(tempDir, 'main.js');
    await writeFile(generated, s727.code);
    const syntax = spawnSync(process.execPath, ['--check', generated], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(plugin.transform.call({ warn() {} }, s727.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call({ warn() {} }, s726.code, '/repo/js/not-main.js'), null);
});

test('plugin skips safely if any required v7.26 integration anchor has drifted', () => {
  const warnings = [];
  const result = calloriaDigitalFollowUpCoachingCheckpointsPluginV727().transform.call({ warn(message) { warnings.push(message); } }, '/* CALLORIA_V726_DIGITAL_FOLLOWUP_COACHING_OUTCOMES */', '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});
