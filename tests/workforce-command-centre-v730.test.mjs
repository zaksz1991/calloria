import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  workforceCommandCentreBoard,
  workforceCommandCentreCsv
} from '../js/workforce-command-centre-engine-v730.js';
import { calloriaWorkforceCommandCentrePluginV730 } from '../build/calloria-workforce-command-centre-v730.mjs';
import { calloriaWorkforceIntelligencePluginV729 } from '../build/calloria-workforce-intelligence-v729.mjs';
import { calloriaDigitalCareerEvidencePluginV728 } from '../build/calloria-digital-career-evidence-v728.mjs';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from '../build/calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const now = '2026-11-22T13:30:00.000Z';
const channel = (overrides = {}) => ({ total: 0, completed: 0, met: 0, late: 0, open: 0, overdue: 0, ...overrides });
const agent = (overrides = {}) => ({
  agentId: 'EMP-AB', totalCycles: 12, completed: 10, met: 9, late: 1,
  responseTargetRate: 90, averageResponseMinutes: 8.5, open: 2, onTrack: 1,
  atRisk: 1, overdue: 0,
  byChannel: {
    email: channel({ total: 6, completed: 5, met: 4, late: 1, open: 1, overdue: 0 }),
    live_chat: channel({ total: 4, completed: 3, met: 3, open: 1, overdue: 0 }),
    social: channel({ total: 2, completed: 2, met: 2 })
  },
  ...overrides
});
const performance = (agents = []) => ({
  totalCycles: agents.reduce((sum, row) => sum + (row.totalCycles || 0), 0),
  completed: agents.reduce((sum, row) => sum + (row.completed || 0), 0),
  overdue: agents.reduce((sum, row) => sum + (row.overdue || 0), 0),
  atRisk: agents.reduce((sum, row) => sum + (row.atRisk || 0), 0),
  open: agents.reduce((sum, row) => sum + (row.open || 0), 0),
  agents
});
const state = (overrides = {}) => ({
  applicantName: 'Amina Bello', nameInitials: 'AB', department: '',
  callsHandled: 20, outboundCalls: 5, resolutions: 16,
  totalHandleMinutes: 300, totalQA: 1760, qaCount: 20,
  totalCSAT: 86, csatCount: 20, incidents: 0,
  shiftHistory: [{ id: 'S1', status: 'completed', adherence: 92 }],
  cases: [],
  ...overrides
});

test('workstreams compare voice profile and separately attributed email, chat and social cycles', () => {
  const board = workforceCommandCentreBoard(state(), performance([agent()]), {}, now);
  const email = board.workstreams.rows.find(row => row.id === 'email');
  const chat = board.workstreams.rows.find(row => row.id === 'live_chat');
  const social = board.workstreams.rows.find(row => row.id === 'social');
  const voice = board.workstreams.rows.find(row => row.id === 'voice');
  assert.equal(voice.total, 25);
  assert.equal(voice.resolutionRate, 80);
  assert.equal(email.completed, 5);
  assert.equal(email.responseTargetRate, 80);
  assert.equal(email.open, 1);
  assert.equal(chat.responseTargetRate, 100);
  assert.equal(social.completed, 2);
  assert.equal(board.summary.workstreamsAvailable, 3);
});

test('department comparisons use explicit department values and exact employee roster matches only', () => {
  const rows = [
    agent({ agentId: 'EMP-AB' }),
    agent({ agentId: 'EMP-CD', completed: 4, met: 2, responseTargetRate: 50, open: 3, overdue: 2, atRisk: 1,
      byChannel: { email: channel({ total: 4, completed: 4, met: 2, open: 3, overdue: 2 }) } }),
    agent({ agentId: 'EMP-UNMAPPED', completed: 8 })
  ];
  const board = workforceCommandCentreBoard(state({
    departments: [{ id: 'CC', name: 'Customer Care' }],
    workforceRoster: [{ employeeId: 'EMP-AB', departmentId: 'CC' }]
  }), performance(rows), {}, now);
  assert.equal(board.departments.available, true);
  assert.equal(board.departments.rows.length, 1);
  assert.equal(board.departments.rows[0].department, 'Customer Care');
  assert.equal(board.departments.rows[0].agents, 1);
  assert.equal(board.departments.rows[0].completed, 10);
  assert.equal(board.departments.mappedAgentCount, 1);
  assert.equal(board.departments.coveragePercent, 33);
});

test('current employee department is mapped only to the exact EMP-initials identifier', () => {
  const board = workforceCommandCentreBoard(state({ department: 'Customer Care' }), performance([agent({ agentId: 'EMP-AB' })]), {}, now);
  assert.equal(board.departments.rows[0].department, 'Customer Care');
  assert.equal(board.departments.rows[0].agents, 1);
});

test('agent-level explicit department names work without a separate roster', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ agentId: 'EMP-AB', departmentName: 'Customer Experience' }),
    agent({ agentId: 'EMP-CD', department: 'Digital Support' })
  ]), {}, now);
  assert.deepEqual(board.departments.rows.map(row => row.department).sort(), ['Customer Experience', 'Digital Support']);
});

test('unknown departments remain unassigned rather than being inferred from agent names', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ agentId: 'EMP-AB' }), agent({ agentId: 'EMP-CD' })
  ]), {}, now);
  assert.equal(board.departments.available, false);
  assert.equal(board.departments.rows.length, 0);
  assert.equal(board.departments.coveragePercent, 0);
});

test('capacity scenarios calculate a visible gap from editable planning assumptions', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ open: 8, atRisk: 3, overdue: 2,
      byChannel: { email: channel({ total: 12, completed: 4, met: 3, open: 8, overdue: 2 }) } })
  ]), { plannedSeats: 1, maxOpenItemsPerSeat: 4 }, now);
  assert.equal(board.capacity.isForecast, false);
  assert.equal(board.capacity.backlog, 8);
  assert.equal(board.capacity.scenarios[0].projectedBacklog, 7);
  assert.equal(board.capacity.scenarios[0].requiredSeats, 2);
  assert.equal(board.capacity.scenarios[0].staffingGap, 1);
  assert.equal(board.capacity.scenarios[1].requiredSeats, 2);
  assert.equal(board.capacity.scenarios[2].projectedBacklog, 11);
  assert.equal(board.capacity.scenarios[2].requiredSeats, 3);
  assert.match(board.capacity.scenarios[2].status, /2 seat\(s\) short/);
});

test('capacity planner does not invent a staffing gap when planned seats are omitted', () => {
  const board = workforceCommandCentreBoard(state(), performance([agent()]), {}, now);
  assert.equal(board.capacity.plannedSeats, null);
  assert.ok(board.capacity.scenarios.every(row => row.staffingGap === null));
  assert.ok(board.capacity.scenarios.every(row => row.status === 'Add planned seats to compare'));
});

test('missing channel breakdown is retained as unattributed backlog instead of disappearing', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ open: 4, completed: 6, totalCycles: 10, byChannel: undefined })
  ]), {}, now);
  const unmapped = board.workstreams.rows.find(row => row.id === 'unmapped');
  assert.equal(unmapped.open, 4);
  assert.equal(unmapped.completed, 6);
  assert.equal(board.capacity.backlog, 4);
});

test('unassigned and aggregate rows do not inflate digital command-centre totals', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ agentId: 'EMP-AB' }),
    agent({ agentId: 'UNASSIGNED', completed: 100, open: 100, overdue: 100 }),
    agent({ agentId: 'ALL_AGENTS', completed: 200, open: 200, overdue: 200 })
  ]), {}, now);
  assert.equal(board.summary.digitalAgents, 1);
  assert.equal(board.summary.completedReplies, 10);
  assert.equal(board.summary.openDigitalWork, 2);
  assert.equal(board.summary.overdueDigitalWork, 0);
});

test('supervisor queue ranks overdue and at-risk agents and gives evidence-linked next steps', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ agentId: 'EMP-LOW', completed: 10, met: 5, responseTargetRate: 50, overdue: 0, atRisk: 0, open: 1 }),
    agent({ agentId: 'EMP-RISK', overdue: 2, atRisk: 3, open: 5 }),
    agent({ agentId: 'EMP-CLEAR', overdue: 0, atRisk: 0, responseTargetRate: 99 })
  ]), {}, now);
  assert.equal(board.riskAgents[0].agentId, 'EMP-RISK');
  assert.equal(board.riskAgents[0].priority.severity, 'high');
  assert.equal(board.riskAgents[1].agentId, 'EMP-LOW');
  assert.match(board.riskAgents[1].priority.action, /missed targets/);
});

test('capacity assumptions are clamped and malformed state produces an unscored empty board', () => {
  const board = workforceCommandCentreBoard(null, null, { plannedSeats: -4, maxOpenItemsPerSeat: 999 }, 'bad-time');
  assert.equal(board.version, '7.30.0');
  assert.equal(board.capacity.plannedSeats, 0);
  assert.equal(board.capacity.maxOpenItemsPerSeat, 50);
  assert.equal(board.capacity.backlog, 0);
  assert.equal(board.departments.available, false);
  assert.equal(board.riskAgents.length, 0);
});

test('command-centre CSV exports workstreams, explicit departments and risk rows with safe quoting', () => {
  const board = workforceCommandCentreBoard(state(), performance([
    agent({ agentId: 'EMP-AB', departmentName: 'Care, Quality' })
  ]), {}, now);
  const csv = workforceCommandCentreCsv(board);
  assert.match(csv, /"section","name"/);
  assert.match(csv, /"department","Care, Quality"/);
  assert.match(csv, /"workstream","Email"/);
  assert.match(csv, /"agent_risk"/);
  assert.match(csv, /"Care, Quality"/);
  const escaped = workforceCommandCentreCsv({ workstreams: { rows: [{ label: '=SUM(1,1)', completed: 0 }] }, departments: {}, riskAgents: [] });
  assert.match(escaped, /'=SUM\(1,1\)/);
});

test('v7.30 transform appends command centre after v7.29 and registers session-only form/export handlers', async () => {
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
  let code = beforeV723;
  for (const plugin of [
    calloriaDigitalFollowUpSupervisorPluginV723,
    calloriaDigitalFollowUpPerformancePluginV724,
    calloriaDigitalFollowUpCoachingPluginV725,
    calloriaDigitalFollowUpCoachingOutcomesPluginV726,
    calloriaDigitalFollowUpCoachingCheckpointsPluginV727,
    calloriaDigitalCareerEvidencePluginV728,
    calloriaWorkforceIntelligencePluginV729
  ]) code = call(plugin, code).code;
  const result = calloriaWorkforceCommandCentrePluginV730().transform.call({ warn(message) { throw new Error(message); } }, code, '/repo/js/main.js');
  assert.ok(result?.code);
  for (const expected of [
    '/* CALLORIA_V730_WORKFORCE_COMMAND_CENTRE */',
    "from './workforce-command-centre-engine-v730.js';",
    "import '../styles/calloria-workforce-command-centre-v730.css';",
    'Workforce intelligence command centre',
    '${workforceCommandCentrePanel}',
    'workforceCommandCentreBoard(stateSnapshot, digitalPerformance, assumptions)',
    '#workforce-command-centre-form',
    '[data-workforce-command-export]',
    'workforceCommandCentreCsv(board)'
  ]) assert.ok(result.code.includes(expected), `missing v7.30 fragment: ${expected}`);
  assert.ok(result.code.indexOf('${workforceIntelligencePanel}') < result.code.indexOf('${workforceCommandCentrePanel}'));
  const tempDir = await mkdtemp(join(tmpdir(), 'calloria-v730-'));
  try {
    const generated = join(tempDir, 'main.js');
    await writeFile(generated, result.code);
    const syntax = spawnSync(process.execPath, ['--check', generated], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(calloriaWorkforceCommandCentrePluginV730().transform.call({ warn() {} }, result.code, '/repo/js/main.js'), null);
  assert.equal(calloriaWorkforceCommandCentrePluginV730().transform.call({ warn() {} }, code, '/repo/js/not-main.js'), null);
});

test('v7.30 skips safely when the v7.29 source contract has changed', () => {
  const warnings = [];
  const result = calloriaWorkforceCommandCentrePluginV730().transform.call(
    { warn(message) { warnings.push(message); } },
    '/* CALLORIA_V729_WORKFORCE_INTELLIGENCE */',
    '/repo/js/main.js'
  );
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});
