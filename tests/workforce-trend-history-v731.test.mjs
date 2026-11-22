import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createWorkforceTrendSnapshot,
  normaliseWorkforceTrendSnapshot,
  normaliseWorkforceTrendHistory,
  appendWorkforceTrendSnapshot,
  compareWorkforceTrendSnapshots,
  workforceTrendHistoryCsv,
  WORKFORCE_TREND_HISTORY_LIMIT
} from '../js/workforce-trend-history-engine-v731.js';
import { calloriaWorkforceTrendHistoryPluginV731 } from '../build/calloria-workforce-trend-history-v731.mjs';
import { calloriaWorkforceCommandCentrePluginV730 } from '../build/calloria-workforce-command-centre-v730.mjs';
import { calloriaWorkforceIntelligencePluginV729 } from '../build/calloria-workforce-intelligence-v729.mjs';
import { calloriaDigitalCareerEvidencePluginV728 } from '../build/calloria-digital-career-evidence-v728.mjs';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from '../build/calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from '../build/calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from '../build/calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const makeBoard = (overrides = {}) => ({
  version: '7.30.0',
  evaluatedAt: '2026-11-22T08:00:00.000Z',
  summary: {
    digitalAgents: 4, completedReplies: 40, openDigitalWork: 12,
    overdueDigitalWork: 3, atRiskDigitalWork: 5, responseTargetRate: 88,
    workstreamsAvailable: 3, departmentsAvailable: 2,
    agentsNeedingSupervisorAttention: 2
  },
  workstreams: { rows: [
    { id: 'voice', label: 'Voice', available: true, completed: 10, responseTargetRate: null, open: null, overdue: null, atRisk: null },
    { id: 'email', label: 'Email', available: true, completed: 15, responseTargetRate: 90, open: 4, overdue: 1, atRisk: 2 },
    { id: 'live_chat', label: 'Live Chat', available: true, completed: 12, responseTargetRate: 86, open: 5, overdue: 2, atRisk: 2 },
    { id: 'social', label: 'Social', available: true, completed: 13, responseTargetRate: 88, open: 3, overdue: 0, atRisk: 1 },
    { id: 'unmapped', label: 'Unmapped', available: false, completed: 0, open: 0 }
  ] },
  departments: {
    coveragePercent: 75, mappedAgentCount: 3, identifiedAgentCount: 4,
    rows: [
      { department: 'Customer Care', agents: 2, completed: 24, responseTargetRate: 90, open: 6, overdue: 1, atRisk: 2 },
      { department: 'Digital Support', agents: 1, completed: 16, responseTargetRate: 84, open: 6, overdue: 2, atRisk: 3 }
    ]
  },
  ...overrides
});

const at = iso => new Date(iso).toISOString();

test('snapshot retains aggregate operational metrics and excludes employee/customer identifiers', () => {
  const rawBoard = makeBoard({
    employees: [{ employeeId: 'EMP-PRIVATE', fullName: 'Private Name' }],
    customer: { email: 'customer@example.test' },
    transcript: 'private transcript text'
  });
  const snapshot = createWorkforceTrendSnapshot(rawBoard, '2026-11-22T09:00:00.000Z');
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.sourceVersion, '7.30.0');
  assert.equal(snapshot.summary.completedReplies, 40);
  assert.equal(snapshot.summary.departmentCoveragePercent, 75);
  assert.equal(snapshot.workstreams.length, 5);
  assert.equal(snapshot.departments.length, 2);
  const serialised = JSON.stringify(snapshot);
  assert.doesNotMatch(serialised, /EMP-PRIVATE|Private Name|customer@example|transcript/i);
  assert.ok(!Object.hasOwn(snapshot, 'employees'));
  assert.ok(!Object.hasOwn(snapshot, 'customer'));
});

test('snapshot clamps counts and rates and ignores unapproved workstream identifiers', () => {
  const board = makeBoard({
    summary: { digitalAgents: -2, completedReplies: 8.8, openDigitalWork: 1, responseTargetRate: 130 },
    workstreams: { rows: [{ id: 'private_internal', label: 'Private', completed: 999 }, { id: 'email', label: 'Email', completed: 2, responseTargetRate: -10 }] },
    departments: { coveragePercent: 160, mappedAgentCount: 1, identifiedAgentCount: 1, rows: [{ department: 'Care', agents: 1 }] }
  });
  const snapshot = createWorkforceTrendSnapshot(board, '2026-11-22T09:01:00Z');
  assert.equal(snapshot.summary.digitalAgents, 0);
  assert.equal(snapshot.summary.completedReplies, 8);
  assert.equal(snapshot.summary.responseTargetRate, 100);
  assert.equal(snapshot.workstreams.length, 1);
  assert.equal(snapshot.workstreams[0].responseTargetRate, 0);
  assert.equal(snapshot.summary.departmentCoveragePercent, 100);
});

test('invalid dates and malformed snapshots are rejected without throwing', () => {
  assert.equal(createWorkforceTrendSnapshot(makeBoard(), 'not-a-date'), null);
  assert.equal(createWorkforceTrendSnapshot(null), null);
  assert.equal(normaliseWorkforceTrendSnapshot(null), null);
  assert.equal(normaliseWorkforceTrendSnapshot({ schemaVersion: 2, capturedAt: at('2026-11-22'), summary: {} }), null);
  assert.deepEqual(normaliseWorkforceTrendHistory({ not: 'an array' }), []);
});

test('normalisation reconstructs only the documented snapshot schema', () => {
  const clean = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-22T09:02:00Z'));
  const dirty = { ...clean, employeeEmail: 'secret@example.test', hiddenProperty: { secret: true } };
  const restored = normaliseWorkforceTrendSnapshot(dirty);
  assert.equal(restored.capturedAt, clean.capturedAt);
  assert.ok(!Object.hasOwn(restored, 'employeeEmail'));
  assert.ok(!Object.hasOwn(restored, 'hiddenProperty'));
});

test('overall comparison classifies completed increase and open/overdue reductions as improvements', () => {
  const earlier = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-21T09:00:00Z'));
  const later = createWorkforceTrendSnapshot(makeBoard({ summary: {
    ...makeBoard().summary, completedReplies: 52, openDigitalWork: 7,
    overdueDigitalWork: 1, atRiskDigitalWork: 2, responseTargetRate: 94
  } }), at('2026-11-22T09:00:00Z'));
  const result = compareWorkforceTrendSnapshots(earlier, later);
  assert.equal(result.summaryMetrics.find(row => row.key === 'completedReplies').delta, 12);
  assert.equal(result.summaryMetrics.find(row => row.key === 'completedReplies').trend, 'improved');
  assert.equal(result.summaryMetrics.find(row => row.key === 'openDigitalWork').delta, -5);
  assert.equal(result.summaryMetrics.find(row => row.key === 'openDigitalWork').trend, 'improved');
  assert.equal(result.summaryMetrics.find(row => row.key === 'responseTargetRate').delta, 6);
  assert.equal(result.summaryMetrics.find(row => row.key === 'responseTargetRate').suffix, ' pp');
});

test('comparison does not score missing values and identical values remain unchanged', () => {
  const earlier = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-21T09:00:00Z'));
  const laterBoard = makeBoard({ summary: { ...makeBoard().summary, responseTargetRate: null, completedReplies: 40 } });
  const later = createWorkforceTrendSnapshot(laterBoard, at('2026-11-22T09:00:00Z'));
  const result = compareWorkforceTrendSnapshots(earlier, later);
  assert.equal(result.summaryMetrics.find(row => row.key === 'completedReplies').trend, 'unchanged');
  assert.equal(result.summaryMetrics.find(row => row.key === 'responseTargetRate').trend, 'unscored');
  assert.equal(result.summaryMetrics.find(row => row.key === 'responseTargetRate').delta, null);
  assert.equal(compareWorkforceTrendSnapshots(null, later), null);
});

test('workstream comparisons match IDs and mark newly observed channels without invented deltas', () => {
  const earlierBoard = makeBoard({ workstreams: { rows: makeBoard().workstreams.rows.filter(row => row.id !== 'social') } });
  const earlier = createWorkforceTrendSnapshot(earlierBoard, at('2026-11-21T09:00:00Z'));
  const later = createWorkforceTrendSnapshot(makeBoard({ workstreams: { rows: [
    { id: 'email', label: 'Email', completed: 20, responseTargetRate: 92, open: 2, overdue: 0 },
    { id: 'social', label: 'Social', completed: 5, responseTargetRate: 80, open: 1 }
  ] } }), at('2026-11-22T09:00:00Z'));
  const result = compareWorkforceTrendSnapshots(earlier, later);
  const email = result.workstreams.find(row => row.id === 'email');
  const social = result.workstreams.find(row => row.id === 'social');
  assert.equal(email.status, 'continuing');
  assert.equal(email.metrics.find(row => row.key === 'open').delta, -2);
  assert.equal(social.status, 'new');
  assert.deepEqual(social.metrics, []);
});

test('department trends match exact department labels and identify new and removed groups', () => {
  const earlier = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-21T09:00:00Z'));
  const later = createWorkforceTrendSnapshot(makeBoard({ departments: {
    coveragePercent: 50, mappedAgentCount: 2, identifiedAgentCount: 4,
    rows: [
      { department: 'Customer Care', agents: 2, completed: 30, responseTargetRate: 92, open: 4, overdue: 0, atRisk: 1 },
      { department: 'Sales Support', agents: 1, completed: 5, responseTargetRate: 80, open: 2, overdue: 1, atRisk: 1 }
    ]
  } }), at('2026-11-22T09:00:00Z'));
  const result = compareWorkforceTrendSnapshots(earlier, later);
  assert.equal(result.departments.find(row => row.department === 'Customer Care').status, 'continuing');
  assert.equal(result.departments.find(row => row.department === 'Sales Support').status, 'new');
  assert.deepEqual(result.previousOnlyDepartments, ['Digital Support']);
});

test('history is chronological, deduplicated and capped at 90 snapshots', () => {
  const snapshots = Array.from({ length: 95 }, (_, index) => createWorkforceTrendSnapshot(
    makeBoard({ summary: { ...makeBoard().summary, completedReplies: index } }),
    new Date(Date.UTC(2026, 0, 1 + index)).toISOString()
  ));
  const history = normaliseWorkforceTrendHistory(snapshots);
  assert.equal(history.length, WORKFORCE_TREND_HISTORY_LIMIT);
  assert.equal(history[0].summary.completedReplies, 5);
  assert.equal(history.at(-1).summary.completedReplies, 94);
  const replacement = createWorkforceTrendSnapshot(makeBoard({ summary: { ...makeBoard().summary, completedReplies: 999 } }), history.at(-1).capturedAt);
  const updated = appendWorkforceTrendSnapshot(history, replacement);
  assert.equal(updated.length, 90);
  assert.equal(updated.at(-1).summary.completedReplies, 999);
  assert.deepEqual(updated.map(row => row.capturedAt), [...updated].map(row => row.capturedAt).sort());
});

test('history retention limit is bounded and invalid additions do not corrupt history', () => {
  const a = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-20T09:00:00Z'));
  const b = createWorkforceTrendSnapshot(makeBoard(), at('2026-11-21T09:00:00Z'));
  assert.equal(normaliseWorkforceTrendHistory([a, b], 0).length, 1);
  assert.equal(appendWorkforceTrendSnapshot([a], { bad: true }).length, 1);
});

test('CSV contains aggregate sections and neutralises formula-leading data', () => {
  const snapshot = createWorkforceTrendSnapshot(makeBoard({
    departments: { coveragePercent: 100, mappedAgentCount: 1, identifiedAgentCount: 1,
      rows: [{ department: '=HYPERLINK("x")', agents: 1, completed: 3, open: 1, overdue: 0, atRisk: 0 }] }
  }), at('2026-11-22T10:00:00Z'));
  const csv = workforceTrendHistoryCsv([snapshot]);
  assert.match(csv, /captured_at/);
  assert.match(csv, /summary/);
  assert.match(csv, /workstream/);
  assert.match(csv, /department/);
  assert.match(csv, /'=HYPERLINK/);
  assert.doesNotMatch(csv, /EMP-|customer@example|transcript/);
  assert.equal(workforceTrendHistoryCsv([]).split('\r\n').length, 1);
});

test('v7.31 plugin applies after v7.30, adds the trend panel and browser-local controls, and is idempotent', async () => {
  const base = [
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
  const plugins = [
    calloriaDigitalFollowUpSupervisorPluginV723,
    calloriaDigitalFollowUpPerformancePluginV724,
    calloriaDigitalFollowUpCoachingPluginV725,
    calloriaDigitalFollowUpCoachingOutcomesPluginV726,
    calloriaDigitalFollowUpCoachingCheckpointsPluginV727,
    calloriaDigitalCareerEvidencePluginV728,
    calloriaWorkforceIntelligencePluginV729,
    calloriaWorkforceCommandCentrePluginV730
  ];
  let code = base;
  for (const makePlugin of plugins) {
    const result = makePlugin().transform.call({ warn(message) { throw new Error(message); } }, code, '/repo/js/main.js');
    assert.ok(result?.code, `upstream ${makePlugin().name} did not transform`);
    code = result.code;
  }
  const plugin = calloriaWorkforceTrendHistoryPluginV731();
  const result = plugin.transform.call({ warn(message) { throw new Error(message); } }, code, '/repo/js/main.js');
  assert.ok(result?.code);
  for (const expected of [
    '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */',
    "from './workforce-trend-history-engine-v731.js';",
    "import '../styles/calloria-workforce-trend-history-v731.css';",
    'renderWorkforceTrendHistoryPanelV731(window.__CALLORIA_WORKFORCE_COMMAND_BOARD__)',
    '${workforceTrendHistoryPanel}',
    'data-workforce-trend-capture',
    'data-workforce-trend-export',
    'data-workforce-trend-clear',
    'calloria.workforce.trend-history.v731'
  ]) assert.ok(result.code.includes(expected), `missing v7.31 fragment: ${expected}`);
  assert.ok(result.code.indexOf('${workforceCommandCentrePanel}') < result.code.indexOf('${workforceTrendHistoryPanel}'));
  const tempDir = await mkdtemp(join(tmpdir(), 'calloria-v731-'));
  try {
    const generated = join(tempDir, 'main.js');
    await writeFile(generated, result.code);
    const syntax = spawnSync(process.execPath, ['--check', generated], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  assert.equal(plugin.transform.call({ warn() {} }, result.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call({ warn() {} }, code, '/repo/js/not-main.js'), null);
});

test('v7.31 skips safely when the v7.30 integration contract is missing or duplicated', () => {
  const warnings = [];
  const transform = calloriaWorkforceTrendHistoryPluginV731().transform;
  const missing = transform.call({ warn(message) { warnings.push(message); } }, '/* CALLORIA_V730_WORKFORCE_COMMAND_CENTRE */', '/repo/js/main.js');
  assert.equal(missing, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
});
