import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDigitalFollowUpCoachingOutcome,
  recordDigitalFollowUpCoachingOutcome,
  digitalFollowUpCoachingOutcomeBoard
} from '../js/digital-followup-coaching-outcomes-engine-v726.js';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const NOW = '2026-11-22T12:00:00.000Z';
const plan = (overrides = {}) => ({
  id: 'COACH-1', agentId: 'EMP-100', status: 'completed', focus: 'overdue_recovery',
  focusLabel: 'Overdue follow-up recovery', baseline: { overdue: 3, atRisk: 2, completed: 5, late: 2, responseTargetRate: 60 },
  target: { overdue: 0 }, completedAt: NOW, ...overrides
});
const scorecard = (overrides = {}) => ({
  agentId: 'EMP-100', overdue: 0, atRisk: 1, completed: 8, late: 2, responseTargetRate: 75, ...overrides
});
const performance = (...agents) => ({ agents });

test('overdue recovery records achieved when current overdue workload reaches zero', () => {
  const review = assessDigitalFollowUpCoachingOutcome(plan(), scorecard({ overdue: 0 }), { reviewedAt: NOW });
  assert.equal(review.status, 'achieved');
  assert.equal(review.metric, 'overdue');
  assert.equal(review.before, 3);
  assert.equal(review.current, 0);
  assert.equal(review.target, 0);
  assert.equal(review.delta, 3);
  assert.match(review.evidenceScope, /not isolated to the coaching period/);
});

test('overdue and at-risk reviews distinguish improvement from no improvement', () => {
  const improved = assessDigitalFollowUpCoachingOutcome(plan(), scorecard({ overdue: 1 }));
  const unchanged = assessDigitalFollowUpCoachingOutcome(plan(), scorecard({ overdue: 4 }));
  const riskPlan = plan({ focus: 'at_risk_prevention', baseline: { atRisk: 4 }, target: { atRisk: 0 } });
  const riskReview = assessDigitalFollowUpCoachingOutcome(riskPlan, scorecard({ overdue: 0, atRisk: 2 }));
  assert.equal(improved.status, 'improving');
  assert.equal(unchanged.status, 'not_improved');
  assert.equal(riskReview.status, 'improving');
  assert.equal(riskReview.metric, 'atRisk');
});

test('response target review requires a comparable completed sample and checks target attainment', () => {
  const responsePlan = plan({
    focus: 'response_sla_consistency',
    baseline: { overdue: 0, atRisk: 0, completed: 5, responseTargetRate: 60 },
    target: { responseTargetRate: 85 }
  });
  assert.equal(assessDigitalFollowUpCoachingOutcome(responsePlan, scorecard({ responseTargetRate: 90, completed: 4 })).status, 'achieved');
  assert.equal(assessDigitalFollowUpCoachingOutcome(responsePlan, scorecard({ responseTargetRate: 75, completed: 4 })).status, 'improving');
  assert.equal(assessDigitalFollowUpCoachingOutcome(responsePlan, scorecard({ responseTargetRate: 50, completed: 4 })).status, 'not_improved');
  assert.equal(assessDigitalFollowUpCoachingOutcome(responsePlan, scorecard({ responseTargetRate: 90, completed: 2 })).status, 'insufficient_data');
});

test('assessments reject active plans, mismatched agents, invalid plans and previously reviewed plans', () => {
  assert.equal(assessDigitalFollowUpCoachingOutcome(plan({ status: 'in_progress' }), scorecard()), null);
  assert.equal(assessDigitalFollowUpCoachingOutcome(plan(), scorecard({ agentId: 'EMP-OTHER' })), null);
  assert.equal(assessDigitalFollowUpCoachingOutcome(null, scorecard()), null);
  assert.equal(assessDigitalFollowUpCoachingOutcome(plan({ outcomeReview: { status: 'achieved' } }), scorecard()), null);
});

test('recording an outcome immutably updates exactly one completed plan and prevents duplicates', () => {
  const initial = [plan(), plan({ id: 'COACH-2', status: 'in_progress' })];
  const updated = recordDigitalFollowUpCoachingOutcome(initial, 'COACH-1', performance(scorecard()), { reviewedAt: NOW, reviewedBy: 'SUP-1' });
  assert.notEqual(updated, initial);
  assert.equal(initial[0].outcomeReview, undefined);
  assert.equal(updated[0].outcomeReview.status, 'achieved');
  assert.equal(updated[0].outcomeReview.reviewedBy, 'SUP-1');
  assert.equal(updated[1], initial[1]);
  const duplicate = recordDigitalFollowUpCoachingOutcome(updated, 'COACH-1', performance(scorecard()), { reviewedAt: NOW });
  assert.equal(duplicate[0], updated[0]);
  assert.equal(recordDigitalFollowUpCoachingOutcome(initial, 'missing', performance(scorecard()))[0], initial[0]);
});

test('outcome board counts reviewed states and keeps newest completed plans first', () => {
  const plans = [
    { ...plan({ id: 'OLDER', completedAt: '2026-11-20T00:00:00.000Z' }), outcomeReview: { status: 'achieved', reviewedAt: NOW, label: 'Target achieved' } },
    plan({ id: 'NEWER', completedAt: '2026-11-21T00:00:00.000Z' })
  ];
  const board = digitalFollowUpCoachingOutcomeBoard(plans, performance(scorecard()));
  assert.equal(board.total, 2);
  assert.equal(board.reviewed, 1);
  assert.equal(board.achieved, 1);
  assert.equal(board.awaitingReview, 1);
  assert.equal(board.rows[0].planId, 'NEWER');
});

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

test('v7.26 adds outcome panel and review action after v7.25, and transform is idempotent', () => {
  const s723 = calloriaDigitalFollowUpSupervisorPluginV723().transform.call({ warn(message) { throw new Error(message); } }, sourceBeforeV723, '/repo/js/main.js');
  const s724 = calloriaDigitalFollowUpPerformancePluginV724().transform.call({ warn(message) { throw new Error(message); } }, s723.code, '/repo/js/main.js');
  const s725 = calloriaDigitalFollowUpCoachingPluginV725().transform.call({ warn(message) { throw new Error(message); } }, s724.code, '/repo/js/main.js');
  const plugin = calloriaDigitalFollowUpCoachingOutcomesPluginV726();
  const s726 = plugin.transform.call({ warn(message) { throw new Error(message); } }, s725.code, '/repo/js/main.js');
  assert.ok(s726?.code);
  for (const fragment of [
    '/* CALLORIA_V726_DIGITAL_FOLLOWUP_COACHING_OUTCOMES */',
    "from './digital-followup-coaching-outcomes-engine-v726.js';",
    "import '../styles/calloria-digital-followup-coaching-outcomes-v726.css';",
    'renderDigitalFollowUpCoachingOutcomePanelV726',
    'Coaching outcome reviews',
    '${digitalFollowUpCoachingOutcomePanel}',
    'review-digital-followup-coaching-outcome',
    'recordDigitalFollowUpCoachingOutcome'
  ]) assert.ok(s726.code.includes(fragment), `missing integration fragment: ${fragment}`);
  assert.ok(s726.code.indexOf('${digitalFollowUpCoachingOutcomePanel}') < s726.code.indexOf('${digitalFollowUpCoachingPanel}'));
  assert.equal(plugin.transform.call({ warn() {} }, s726.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call({ warn() {} }, s725.code, '/repo/js/not-main.js'), null);
});

test('v7.26 safely skips when upstream v7.25 anchors drift', () => {
  const warnings = [];
  const result = calloriaDigitalFollowUpCoachingOutcomesPluginV726().transform.call({ warn(message) { warnings.push(message); } }, '/* CALLORIA_V725_DIGITAL_FOLLOWUP_COACHING */', '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});

test('plans without comparable evidence are shown as waiting, not counted as ready for review', () => {
  const responsePlan = plan({
    focus: 'response_sla_consistency',
    baseline: { completed: 4, responseTargetRate: 55 },
    target: { responseTargetRate: 85 }
  });
  const board = digitalFollowUpCoachingOutcomeBoard([responsePlan], performance(scorecard({ completed: 1, responseTargetRate: null })));
  assert.equal(board.awaitingReview, 0);
  assert.equal(board.rows[0].preview.status, 'insufficient_data');
  assert.equal(board.rows[0].reviewed, false);
});

test('missing metric fields are treated as insufficient evidence instead of zero', () => {
  const review = assessDigitalFollowUpCoachingOutcome(plan(), scorecard({ overdue: undefined }));
  assert.equal(review.status, 'insufficient_data');
  assert.equal(review.current, null);
});
