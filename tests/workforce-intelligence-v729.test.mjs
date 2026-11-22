import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { workforceIntelligenceBoard } from '../js/workforce-intelligence-engine-v729.js';
import { calloriaWorkforceIntelligencePluginV729 } from '../build/calloria-workforce-intelligence-v729.mjs';
import { calloriaDigitalCareerEvidencePluginV728 } from '../build/calloria-digital-career-evidence-v728.mjs';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from '../build/calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const now = '2026-11-22T13:30:00.000Z';
const profileState = (overrides = {}) => ({
  applicantName: 'Amina Bello', nameInitials: 'AB',
  callsHandled: 20, outboundCalls: 5, resolutions: 16,
  totalHandleMinutes: 300, totalQA: 1760, qaCount: 20,
  totalCSAT: 86, csatCount: 20, incidents: 0,
  shiftHistory: [
    { id: 'S1', status: 'completed', adherence: 92 },
    { id: 'S2', status: 'completed', adherence: 96 }
  ],
  cases: [], ...overrides
});
const performance = (agents = []) => ({
  totalCycles: agents.reduce((sum, row) => sum + (row.totalCycles || 0), 0),
  completed: agents.reduce((sum, row) => sum + (row.completed || 0), 0),
  overdue: agents.reduce((sum, row) => sum + (row.overdue || 0), 0),
  atRisk: agents.reduce((sum, row) => sum + (row.atRisk || 0), 0),
  open: agents.reduce((sum, row) => sum + (row.open || 0), 0),
  responseTargetRate: 90,
  agents
});
const agent = (overrides = {}) => ({
  agentId: 'EMP-AB', totalCycles: 12, completed: 10, met: 9, late: 1,
  responseTargetRate: 90, averageResponseMinutes: 8.5, open: 2, onTrack: 1,
  atRisk: 1, overdue: 0, ...overrides
});

test('joins voice, QA, CSAT, shift and digital evidence only on the exact employee key', () => {
  const board = workforceIntelligenceBoard(profileState(), performance([agent()]), [], [], now);
  const profile = board.profile;
  assert.equal(profile.employeeId, 'EMP-AB');
  assert.equal(profile.displayName, 'Amina Bello');
  assert.equal(profile.voice.totalInteractions, 25);
  assert.equal(profile.voice.resolutionRate, 80);
  assert.equal(profile.quality.averageScore, 88);
  assert.equal(profile.quality.samples, 20);
  assert.equal(profile.satisfaction.averageScore, 4.3);
  assert.equal(profile.shifts.averageAdherence, 94);
  assert.equal(profile.digital.matched, true);
  assert.equal(profile.digital.completed, 10);
  assert.equal(profile.digital.responseTargetRate, 90);
  assert.equal(profile.serviceIndex.value, 89);
  assert.equal(profile.serviceIndex.coveragePercent, 100);
  assert.equal(profile.career.readinessStatus, 'ready_for_review');
});

test('does not merge another agent digital data into the current employee profile', () => {
  const board = workforceIntelligenceBoard(profileState(), performance([agent({ agentId: 'EMP-OTHER' })]), [], [], now);
  assert.equal(board.profile.digital.matched, false);
  assert.equal(board.profile.digital.responseTargetRate, null);
  assert.equal(board.profile.career, null);
  assert.equal(board.digitalOperations.completedReplies, 10);
  assert.equal(board.digitalAgents[0].agentId, 'EMP-OTHER');
});

test('missing dimensions remain unscored instead of being treated as zero', () => {
  const board = workforceIntelligenceBoard({ nameInitials: 'XY' }, performance([]), [], [], now);
  assert.equal(board.profile.quality.averageScore, null);
  assert.equal(board.profile.satisfaction.averageScore, null);
  assert.equal(board.profile.shifts.averageAdherence, null);
  assert.equal(board.profile.serviceIndex.value, null);
  assert.equal(board.profile.serviceIndex.label, 'Insufficient evidence');
  assert.equal(board.profile.compliance.status, 'Not available');
});

test('one available index dimension is insufficient; two allow a coverage-labelled index', () => {
  const one = workforceIntelligenceBoard(profileState({ qaCount: 0, csatCount: 0, shiftHistory: [], callsHandled: 0, outboundCalls: 0 }), performance([agent()]), [], [], now);
  assert.equal(one.profile.serviceIndex.value, null);
  assert.equal(one.profile.serviceIndex.dimensionsAvailable, 1);
  const two = workforceIntelligenceBoard(profileState({ qaCount: 10, totalQA: 800, csatCount: 0, totalCSAT: 0, shiftHistory: [] }), performance([agent()]), [], [], now);
  assert.equal(two.profile.serviceIndex.dimensionsAvailable, 2);
  assert.notEqual(two.profile.serviceIndex.value, null);
  assert.equal(two.profile.serviceIndex.coveragePercent, 55);
});

test('shift adherence is computed only from retained numeric shift records', () => {
  const board = workforceIntelligenceBoard(profileState({
    shiftHistory: [{ adherence: 80 }, { adherence: '100' }, { adherence: null }, { status: 'active' }]
  }), performance([]), [], [], now);
  assert.equal(board.profile.shifts.recordedShifts, 4);
  assert.equal(board.profile.shifts.adherenceSamples, 2);
  assert.equal(board.profile.shifts.averageAdherence, 90);
  assert.equal(board.profile.shifts.completedShifts, 3);
});

test('compliance risk reflects recorded incidents and critical voice flags', () => {
  const incidents = workforceIntelligenceBoard(profileState({ incidents: 2 }), performance([]), [], [], now);
  assert.equal(incidents.profile.compliance.status, 'Supervisor review required');
  const breach = workforceIntelligenceBoard(profileState({ cases: [{ voiceQualityFlags: ['critical_handling_breach'] }] }), performance([]), [], [], now);
  assert.equal(breach.profile.compliance.criticalVoiceFlags, 1);
  assert.equal(breach.profile.compliance.status, 'Supervisor review required');
});

test('digital operations totals remain separate from the current employee profile', () => {
  const board = workforceIntelligenceBoard(profileState(), performance([
    agent(), agent({ agentId: 'EMP-BC', completed: 4, overdue: 2, atRisk: 3 })
  ]), [], [], now);
  assert.equal(board.digitalOperations.agents, 2);
  assert.equal(board.digitalOperations.completedReplies, 14);
  assert.equal(board.digitalOperations.overdue, 2);
  assert.equal(board.digitalOperations.atRisk, 4);
  assert.equal(board.profile.digital.completed, 10);
});

test('unassigned and aggregate agent rows are excluded and ranking prioritises risk', () => {
  const board = workforceIntelligenceBoard(profileState(), performance([
    agent({ agentId: 'EMP-C', completed: 30, overdue: 0, atRisk: 0, responseTargetRate: 99 }),
    agent({ agentId: 'EMP-B', completed: 4, overdue: 3, atRisk: 2, responseTargetRate: 60 }),
    agent({ agentId: 'UNASSIGNED' }), agent({ agentId: 'ALL_AGENTS' })
  ]), [], [], now);
  assert.equal(board.digitalAgents.length, 2);
  assert.equal(board.digitalAgents[0].agentId, 'EMP-B');
});

test('digital operation totals exclude unassigned and aggregate records', () => {
  const board = workforceIntelligenceBoard(profileState(), {
    totalCycles: 50, completed: 40, overdue: 5, atRisk: 5, open: 10,
    agents: [
      agent({ agentId: 'EMP-AB', completed: 8, met: 6, totalCycles: 10, overdue: 1, atRisk: 2, open: 2 }),
      agent({ agentId: 'UNASSIGNED', completed: 30, met: 20, totalCycles: 35, overdue: 4, atRisk: 3, open: 6 }),
      agent({ agentId: 'ALL_AGENTS', completed: 2, met: 2, totalCycles: 5 })
    ]
  }, [], [], now);
  assert.equal(board.digitalOperations.completedReplies, 8);
  assert.equal(board.digitalOperations.totalCycles, 10);
  assert.equal(board.digitalOperations.overdue, 1);
  assert.equal(board.digitalOperations.atRisk, 2);
  assert.equal(board.digitalOperations.responseTargetRate, 75);
});

test('source coverage identifies available and missing evidence areas', () => {
  const board = workforceIntelligenceBoard(profileState(), performance([agent()]), [], [], now);
  assert.equal(board.sourceCoverage.total, 6);
  assert.equal(board.sources.find(item => item.id === 'voice').available, true);
  assert.equal(board.sources.find(item => item.id === 'digital').available, true);
  assert.equal(board.sources.find(item => item.id === 'compliance').available, true);
});

test('invalid and partial input is handled as an empty unscored board', () => {
  const board = workforceIntelligenceBoard(null, null, null, null, 'invalid-date');
  assert.equal(board.version, '7.29.0');
  assert.equal(board.profile.serviceIndex.value, null);
  assert.deepEqual(board.digitalAgents, []);
  assert.equal(board.digitalOperations.completedReplies, 0);
});

test('plugin appends a read-only workforce panel after the v7.28 career evidence panel', async () => {
  const beforeV723 = [
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
  const s723 = call(calloriaDigitalFollowUpSupervisorPluginV723, beforeV723);
  const s724 = call(calloriaDigitalFollowUpPerformancePluginV724, s723.code);
  const s725 = call(calloriaDigitalFollowUpCoachingPluginV725, s724.code);
  const s726 = call(calloriaDigitalFollowUpCoachingOutcomesPluginV726, s725.code);
  const s727 = call(calloriaDigitalFollowUpCoachingCheckpointsPluginV727, s726.code);
  const s728 = call(calloriaDigitalCareerEvidencePluginV728, s727.code);
  const result = calloriaWorkforceIntelligencePluginV729().transform.call({ warn(message) { throw new Error(message); } }, s728.code, '/repo/js/main.js');
  assert.ok(result?.code);
  for (const expected of [
    '/* CALLORIA_V729_WORKFORCE_INTELLIGENCE */',
    "from './workforce-intelligence-engine-v729.js';",
    "import '../styles/calloria-workforce-intelligence-v729.css';",
    'Workforce performance intelligence',
    '${workforceIntelligencePanel}',
    'workforceIntelligenceBoard(stateSnapshot, digitalPerformance, coachingPlans, careerPackets, now)',
  ]) assert.ok(result.code.includes(expected), `missing v7.29 integration fragment: ${expected}`);
  assert.ok(result.code.indexOf('${digitalCareerEvidencePanel}') < result.code.indexOf('${workforceIntelligencePanel}'));
  const tempDir = await mkdtemp(join(tmpdir(), 'calloria-v729-'));
  try {
    const generated = join(tempDir, 'main.js');
    await writeFile(generated, result.code);
    const syntax = spawnSync(process.execPath, ['--check', generated], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(calloriaWorkforceIntelligencePluginV729().transform.call({ warn() {} }, result.code, '/repo/js/main.js'), null);
  assert.equal(calloriaWorkforceIntelligencePluginV729().transform.call({ warn() {} }, s728.code, '/repo/js/not-main.js'), null);
});

test('plugin skips safely when the v7.28 contract has drifted', () => {
  const warnings = [];
  const result = calloriaWorkforceIntelligencePluginV729().transform.call(
    { warn(message) { warnings.push(message); } },
    '/* CALLORIA_V728_DIGITAL_CAREER_EVIDENCE */',
    '/repo/js/main.js'
  );
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});
