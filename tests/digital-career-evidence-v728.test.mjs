import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  digitalCareerEvidenceBoard,
  createDigitalCareerReviewPacket,
  reviewDigitalCareerReviewPacket
} from '../js/digital-career-evidence-engine-v728.js';
import { calloriaDigitalCareerEvidencePluginV728 } from '../build/calloria-digital-career-evidence-v728.mjs';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from '../build/calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const now = '2026-11-22T12:00:00.000Z';
const baseAgent = (overrides = {}) => ({
  agentId: 'EMP-100', completed: 12, totalCycles: 13, responseTargetRate: 92,
  overdue: 0, atRisk: 1, late: 1, open: 1, ...overrides
});
const board = (...agents) => ({ agents });
const completedCoachingPlan = (overrides = {}) => ({
  id: 'COACH-100', agentId: 'EMP-100', status: 'completed',
  outcomeReview: { status: 'achieved', reviewedAt: '2026-10-01T12:00:00.000Z' },
  followUpCheckpoints: [{
    id: 'COACH-100-DAY_30', key: 'day_30', status: 'recorded',
    review: { status: 'target_maintained', recordedAt: '2026-10-31T12:00:00.000Z' }
  }],
  ...overrides
});

 test('eligible scorecards produce a clear human-review readiness dossier', () => {
  const result = digitalCareerEvidenceBoard(board(baseAgent()), [], [], now);
  assert.equal(result.totalAgents, 1);
  assert.equal(result.readyForReview, 1);
  assert.equal(result.agents[0].readinessStatus, 'ready_for_review');
  assert.equal(result.agents[0].readinessScore, 100);
  assert.deepEqual(result.agents[0].blocks, []);
  assert.equal(result.agents[0].canPreparePacket, true);
});

test('minimum completed response sample is enforced without treating missing rates as zero', () => {
  const lowSample = digitalCareerEvidenceBoard(board(baseAgent({ completed: 9 })), [], [], now).agents[0];
  const noRate = digitalCareerEvidenceBoard(board(baseAgent({ responseTargetRate: null })), [], [], now).agents[0];
  assert.equal(lowSample.readinessStatus, 'insufficient_evidence');
  assert.match(lowSample.blocks.join(' '), /At least 10 completed/);
  assert.equal(noRate.readinessStatus, 'insufficient_evidence');
  assert.match(noRate.blocks.join(' '), /not yet available/);
});

test('low SLA, overdue work, at-risk work and active coaching require development', () => {
  const plans = [{ id: 'COACH-A', agentId: 'EMP-100', status: 'in_progress' }];
  const result = digitalCareerEvidenceBoard(
    board(baseAgent({ responseTargetRate: 70, overdue: 2, atRisk: 3 })), plans, [], now
  ).agents[0];
  assert.equal(result.readinessStatus, 'development_required');
  assert.equal(result.coaching.activeCount, 1);
  assert.match(result.blocks.join(' '), /response-target rate/i);
  assert.match(result.blocks.join(' '), /overdue follow-up/);
  assert.match(result.blocks.join(' '), /active coaching plan/);
});

test('completed coaching requires an outcome review and positive 30-day sustainment', () => {
  const pending = completedCoachingPlan({ followUpCheckpoints: [{ id: 'D30', key: 'day_30', status: 'pending', review: null }] });
  const pendingRow = digitalCareerEvidenceBoard(board(baseAgent()), [pending], [], now).agents[0];
  assert.equal(pendingRow.readinessStatus, 'sustainment_pending');
  assert.equal(pendingRow.coaching.sustainmentPending, 1);

  const positiveRow = digitalCareerEvidenceBoard(board(baseAgent()), [completedCoachingPlan()], [], now).agents[0];
  assert.equal(positiveRow.readinessStatus, 'ready_for_review');
  assert.equal(positiveRow.coaching.day30Recorded, 1);
});

test('coaching regression and negative outcome review block career review readiness', () => {
  const regressionPlan = completedCoachingPlan({ followUpCheckpoints: [{
    id: 'D30', key: 'day_30', status: 'recorded', review: { status: 'regressed' }
  }] });
  const regression = digitalCareerEvidenceBoard(board(baseAgent()), [regressionPlan], [], now).agents[0];
  assert.equal(regression.readinessStatus, 'development_required');
  assert.equal(regression.coaching.regressions, 1);

  const concern = digitalCareerEvidenceBoard(board(baseAgent()), [completedCoachingPlan({ outcomeReview: { status: 'not_improved' } })], [], now).agents[0];
  assert.equal(concern.readinessStatus, 'development_required');
  assert.match(concern.blocks.join(' '), /outcome review/);
});

test('unassigned and aggregate rows are excluded and the board preserves separate counts', () => {
  const result = digitalCareerEvidenceBoard(board(
    baseAgent(), baseAgent({ agentId: 'UNASSIGNED' }), baseAgent({ agentId: 'ALL_AGENTS' }),
    baseAgent({ agentId: 'EMP-200', completed: 2 })
  ), [], [], now);
  assert.equal(result.totalAgents, 2);
  assert.equal(result.readyForReview, 1);
  assert.equal(result.insufficientEvidence, 1);
});

test('career review packet creation is gated, immutable and duplicate-safe', () => {
  const ready = digitalCareerEvidenceBoard(board(baseAgent()), [], [], now).agents[0];
  const notReady = digitalCareerEvidenceBoard(board(baseAgent({ completed: 1 })), [], [], now).agents[0];
  const initial = [];
  assert.equal(createDigitalCareerReviewPacket(initial, notReady, { now }).length, 0);
  const once = createDigitalCareerReviewPacket(initial, ready, { now, createdBy: 'Floor Supervisor' });
  const twice = createDigitalCareerReviewPacket(once, ready, { now, createdBy: 'Floor Supervisor' });
  assert.equal(initial.length, 0);
  assert.equal(once.length, 1);
  assert.equal(once[0].status, 'pending_review');
  assert.equal(once[0].evidenceSnapshot.completedCycles, 12);
  assert.equal(twice.length, 1);
  assert.equal(once[0].createdBy, 'Floor Supervisor');
});

test('supervisor decision requires a valid choice, named reviewer and evidence note', () => {
  const ready = digitalCareerEvidenceBoard(board(baseAgent()), [], [], now).agents[0];
  const packet = createDigitalCareerReviewPacket([], ready, { now });
  assert.throws(() => reviewDigitalCareerReviewPacket(packet, packet[0].id, { decision: 'promote', reviewer: 'A', reason: 'Not enough.' }, { now }), /valid supervisor/);
  assert.throws(() => reviewDigitalCareerReviewPacket(packet, packet[0].id, { decision: 'defer', reviewer: 'A', reason: 'This is a sufficiently long reason.' }, { now }), /reviewing supervisor/);
  assert.throws(() => reviewDigitalCareerReviewPacket(packet, packet[0].id, { decision: 'defer', reviewer: 'Supervisor A', reason: 'Too brief.' }, { now }), /at least 20 characters/);
});

test('formal exam referral is only a referral and cannot be repeated', () => {
  const ready = digitalCareerEvidenceBoard(board(baseAgent()), [], [], now).agents[0];
  const packet = createDigitalCareerReviewPacket([], ready, { now, createdBy: 'Supervisor' });
  const reviewed = reviewDigitalCareerReviewPacket(packet, packet[0].id, {
    decision: 'refer_to_formal_exam', reviewer: 'Supervisor A',
    reason: 'Twelve completed responses, 92 percent target achievement and no open overdue follow-ups.'
  }, { now });
  assert.equal(reviewed[0].status, 'referred_to_exam_review');
  assert.match(reviewed[0].review.boundary, /formal promotion eligibility rules/);
  assert.throws(() => reviewDigitalCareerReviewPacket(reviewed, packet[0].id, {
    decision: 'defer', reviewer: 'Supervisor A', reason: 'Decision cannot be repeated for this packet.'
  }, { now }), /pending career review packet/);
});

test('defer and not-recommended decisions are recorded as review outcomes, not employment actions', () => {
  const ready = digitalCareerEvidenceBoard(board(baseAgent()), [], [], now).agents[0];
  for (const [decision, expected] of [['defer', 'deferred'], ['not_recommended', 'not_recommended']]) {
    const packet = createDigitalCareerReviewPacket([], ready, { now });
    const reviewed = reviewDigitalCareerReviewPacket(packet, packet[0].id, {
      decision, reviewer: 'Supervisor B', reason: 'The supporting performance record needs another review cycle.'
    }, { now });
    assert.equal(reviewed[0].status, expected);
    assert.match(reviewed[0].review.boundary, /does not change employment status/);
  }
});

test('plugin adds the v7.28 workforce panel, safe action and supervisor review form', async () => {
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
    'function handleAction(action,event){ switch (event.action) {',
    "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;",
    '    default: break;',
    '} }',
    'document.addEventListener("click",e=>{const action=e.target.closest("[data-action]");if(action){handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,commitmentId:action.dataset.commitmentId,caseReference:action.dataset.caseReference,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus,mode:action.dataset.mode,optionId:action.dataset.optionId,section:action.dataset.assessmentSection,index:action.dataset.assessmentIndex});return;}});',
    "document.addEventListener('submit',async e=>{if(e.target.id==='otherForm')return;});"
  ].join('\n');
  const call = (plugin, source) => plugin().transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  const s723 = call(calloriaDigitalFollowUpSupervisorPluginV723, sourceBeforeV723);
  const s724 = call(calloriaDigitalFollowUpPerformancePluginV724, s723.code);
  const s725 = call(calloriaDigitalFollowUpCoachingPluginV725, s724.code);
  const s726 = call(calloriaDigitalFollowUpCoachingOutcomesPluginV726, s725.code);
  const s727 = call(calloriaDigitalFollowUpCoachingCheckpointsPluginV727, s726.code);
  const plugin = calloriaDigitalCareerEvidencePluginV728();
  const s728 = plugin.transform.call({ warn(message) { throw new Error(message); } }, s727.code, '/repo/js/main.js');
  assert.ok(s728?.code);
  for (const fragment of [
    '/* CALLORIA_V728_DIGITAL_CAREER_EVIDENCE */',
    "from './digital-career-evidence-engine-v728.js';",
    "import '../styles/calloria-digital-career-evidence-v728.css';",
    'Workforce career evidence',
    '${digitalCareerEvidencePanel}',
    'prepare-digital-career-review',
    'data-digital-career-review-form',
    'reviewDigitalCareerReviewPacket',
    'data-agent-id',
    'agentId:action.dataset.agentId',
    'packetId:action.dataset.packetId'
  ]) assert.ok(s728.code.includes(fragment), `missing v7.28 integration fragment: ${fragment}`);
  assert.ok(s728.code.indexOf('${digitalFollowUpCoachingCheckpointPanel}') < s728.code.indexOf('${digitalCareerEvidencePanel}'));
  const tempDir = await mkdtemp(join(tmpdir(), 'calloria-v728-'));
  try {
    const generated = join(tempDir, 'main.js');
    await writeFile(generated, s728.code);
    const syntax = spawnSync(process.execPath, ['--check', generated], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(plugin.transform.call({ warn() {} }, s728.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call({ warn() {} }, s727.code, '/repo/js/not-main.js'), null);
});

test('plugin skips safely when an integration contract has drifted', () => {
  const warnings = [];
  const result = calloriaDigitalCareerEvidencePluginV728().transform.call(
    { warn(message) { warnings.push(message); } },
    '/* CALLORIA_V727_DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS */',
    '/repo/js/main.js'
  );
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});
