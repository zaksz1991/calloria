import test from 'node:test';
import assert from 'node:assert/strict';
import {
  digitalFollowUpCoachingBoard,
  createDigitalFollowUpCoachingPlan,
  transitionDigitalFollowUpCoachingPlan
} from '../js/digital-followup-coaching-engine-v725.js';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const NOW = Date.parse('2026-11-22T12:00:00.000Z');
const scorecard = (overrides = {}) => ({
  agentId: 'EMP-100', totalCycles: 8, completed: 5, met: 3, late: 2,
  responseTargetRate: 60, averageResponseMinutes: 14, open: 3,
  onTrack: 0, atRisk: 1, overdue: 2, byChannel: {}, ...overrides
});
const performanceBoard = (...agents) => ({ agents, totalCycles: agents.reduce((n, item) => n + item.totalCycles, 0) });

// ---------- Recommendation engine ----------
test('overdue follow-up work creates a high-priority recovery recommendation with evidence', () => {
  const board = digitalFollowUpCoachingBoard(performanceBoard(scorecard({ overdue: 3 })), [], NOW);
  assert.equal(board.recommendations.length, 1);
  assert.equal(board.recommendations[0].focus, 'overdue_recovery');
  assert.equal(board.recommendations[0].priority, 'high');
  assert.equal(board.recommendations[0].baseline.overdue, 3);
  assert.equal(board.recommendations[0].target.overdue, 0);
});

test('at-risk work is prioritised before response-rate coaching when no overdue work remains', () => {
  const board = digitalFollowUpCoachingBoard(performanceBoard(scorecard({ overdue: 0, atRisk: 2 })), [], NOW);
  assert.equal(board.recommendations[0].focus, 'at_risk_prevention');
  assert.equal(board.recommendations[0].target.atRisk, 0);
});

test('response-rate coaching requires a minimum completed sample and proposes a measurable target', () => {
  const lowSample = digitalFollowUpCoachingBoard(performanceBoard(scorecard({ completed: 2, responseTargetRate: 0, overdue: 0, atRisk: 0 })), [], NOW);
  assert.equal(lowSample.recommendations.length, 0);
  const sufficient = digitalFollowUpCoachingBoard(performanceBoard(scorecard({ completed: 5, responseTargetRate: 60, overdue: 0, atRisk: 0 })), [], NOW);
  assert.equal(sufficient.recommendations[0].focus, 'response_sla_consistency');
  assert.equal(sufficient.recommendations[0].target.responseTargetRate, 85);
});

test('one strongest recommendation is produced per agent and unassigned rows are excluded', () => {
  const board = digitalFollowUpCoachingBoard(performanceBoard(
    scorecard({ agentId: 'EMP-A', overdue: 1, atRisk: 4 }),
    scorecard({ agentId: 'EMP-B', overdue: 0, atRisk: 3 }),
    scorecard({ agentId: 'UNASSIGNED', overdue: 9 })
  ), [], NOW);
  assert.deepEqual(board.recommendations.map(item => item.agentId), ['EMP-A', 'EMP-B']);
  assert.equal(board.recommendations[0].focus, 'overdue_recovery');
});

test('an agent with an open or in-progress plan is suppressed from duplicate recommendations', () => {
  const plans = [{ id: 'P-1', agentId: 'EMP-100', status: 'open', createdAt: new Date(NOW).toISOString() }];
  const board = digitalFollowUpCoachingBoard(performanceBoard(scorecard()), plans, NOW);
  assert.equal(board.recommendations.length, 0);
  assert.equal(board.counts.active, 1);
});

test('malformed legacy plan statuses do not suppress fresh coaching recommendations', () => {
  const plans = [{ id: 'BROKEN', agentId: 'EMP-100', status: 'unknown' }];
  const board = digitalFollowUpCoachingBoard(performanceBoard(scorecard()), plans, NOW);
  assert.equal(board.recommendations.length, 1);
  assert.equal(board.plans[0].status, 'cancelled');
});

test('completed coaching plans do not suppress a later evidence-based recommendation', () => {
  const plans = [{ id: 'P-1', agentId: 'EMP-100', status: 'completed', createdAt: new Date(NOW - 1000).toISOString() }];
  const board = digitalFollowUpCoachingBoard(performanceBoard(scorecard()), plans, NOW);
  assert.equal(board.recommendations.length, 1);
  assert.equal(board.counts.completed, 1);
});

test('invalid agents, malformed boards and malformed plan collections are handled safely', () => {
  const board = digitalFollowUpCoachingBoard({ agents: [null, {}, scorecard({ agentId: ' ' }), scorecard({ agentId: 'ALL_AGENTS' })] }, null, NOW);
  assert.equal(board.recommendations.length, 0);
  assert.equal(board.plans.length, 0);
  assert.equal(digitalFollowUpCoachingBoard(null, [], NOW).recommendations.length, 0);
});

// ---------- Plan creation and lifecycle ----------
test('plan creation validates agent/focus and sets a seven-day due date by default', () => {
  const recommendation = digitalFollowUpCoachingBoard(performanceBoard(scorecard({ overdue: 1 })), [], NOW).recommendations[0];
  const plan = createDigitalFollowUpCoachingPlan(recommendation, { id: 'PLAN-1', createdAt: new Date(NOW).toISOString() });
  assert.equal(plan.id, 'PLAN-1');
  assert.equal(plan.agentId, 'EMP-100');
  assert.equal(plan.status, 'open');
  assert.equal(Date.parse(plan.dueAt) - Date.parse(plan.createdAt), 7 * 24 * 60 * 60 * 1000);
  assert.equal(createDigitalFollowUpCoachingPlan(null), null);
  assert.equal(createDigitalFollowUpCoachingPlan({ agentId: 'UNASSIGNED', focus: 'overdue_recovery' }), null);
  assert.equal(createDigitalFollowUpCoachingPlan({ agentId: 'EMP-1', focus: 'unknown' }), null);
});

test('plan creation rejects due dates that are not later than creation', () => {
  const recommendation = digitalFollowUpCoachingBoard(performanceBoard(scorecard()), [], NOW).recommendations[0];
  const plan = createDigitalFollowUpCoachingPlan(recommendation, {
    id: 'PLAN-BAD', createdAt: new Date(NOW).toISOString(), dueAt: new Date(NOW - 1).toISOString()
  });
  assert.equal(plan, null);
});

test('plan transitions are immutable and enforce open → in progress → completed', () => {
  const initial = [{ id: 'PLAN-2', agentId: 'EMP-100', status: 'open' }];
  const started = transitionDigitalFollowUpCoachingPlan(initial, 'PLAN-2', 'in_progress', new Date(NOW).toISOString());
  assert.notEqual(started, initial);
  assert.equal(initial[0].status, 'open');
  assert.equal(started[0].status, 'in_progress');
  assert.ok(started[0].startedAt);
  const completed = transitionDigitalFollowUpCoachingPlan(started, 'PLAN-2', 'completed', new Date(NOW + 1000).toISOString());
  assert.equal(completed[0].status, 'completed');
  assert.ok(completed[0].completedAt);
  const noReopen = transitionDigitalFollowUpCoachingPlan(completed, 'PLAN-2', 'in_progress', new Date(NOW + 2000).toISOString());
  assert.equal(noReopen[0], completed[0]);
});

test('unknown plan IDs and invalid transitions do not alter records', () => {
  const initial = [{ id: 'PLAN-3', status: 'open' }];
  const missing = transitionDigitalFollowUpCoachingPlan(initial, 'NOPE', 'completed', new Date(NOW).toISOString());
  const invalid = transitionDigitalFollowUpCoachingPlan(initial, 'PLAN-3', 'completed', new Date(NOW).toISOString());
  assert.equal(missing[0], initial[0]);
  assert.equal(invalid[0], initial[0]);
});

// ---------- Vite integration ----------
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

test('v7.25 transforms only a v7.24 performance panel and is idempotent', () => {
  const supervisor = calloriaDigitalFollowUpSupervisorPluginV723();
  const performance = calloriaDigitalFollowUpPerformancePluginV724();
  const coaching = calloriaDigitalFollowUpCoachingPluginV725();
  const first = supervisor.transform.call({ warn(message) { throw new Error(message); } }, sourceBeforeV723, '/repo/js/main.js');
  const second = performance.transform.call({ warn(message) { throw new Error(message); } }, first.code, '/repo/js/main.js');
  const third = coaching.transform.call({ warn(message) { throw new Error(message); } }, second.code, '/repo/js/main.js');
  assert.ok(third?.code);
  for (const fragment of [
    V725_MARKER_TEXT,
    "from './digital-followup-coaching-engine-v725.js';",
    "import '../styles/calloria-digital-followup-coaching-v725.css';",
    'renderDigitalFollowUpCoachingPanelV725',
    'Digital follow-up coaching',
    '${digitalFollowUpCoachingPanel}',
    'create-digital-followup-coaching',
    'start-digital-followup-coaching',
    'complete-digital-followup-coaching',
    'state.digitalFollowUpCoachingPlans ||= []'
  ]) assert.ok(third.code.includes(fragment), `missing integration fragment: ${fragment}`);
  assert.ok(third.code.indexOf('${digitalFollowUpCoachingPanel}') < third.code.indexOf('${digitalFollowUpPerformancePanel}'));
  assert.equal(coaching.transform.call({ warn() {} }, third.code, '/repo/js/main.js'), null);
  assert.equal(coaching.transform.call({ warn() {} }, second.code, '/repo/js/other.js'), null);
});

const V725_MARKER_TEXT = '/* CALLORIA_V725_DIGITAL_FOLLOWUP_COACHING */';

test('v7.25 skips safely when the upstream v7.24 anchor set has drifted', () => {
  const plugin = calloriaDigitalFollowUpCoachingPluginV725();
  const warnings = [];
  const source = '/* CALLORIA_V724_DIGITAL_FOLLOWUP_PERFORMANCE */\nfunction renderSupervisor(){ return true; }';
  const result = plugin.transform.call({ warn(message) { warnings.push(message); } }, source, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
  assert.ok(!source.includes('digital-followup-coaching-engine-v725.js'));
});
