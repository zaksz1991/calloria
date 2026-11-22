import test from 'node:test';
import assert from 'node:assert/strict';
import {
  digitalFollowUpPerformanceBoard,
  digitalFollowUpPerformanceDisplay
} from '../js/digital-followup-performance-engine-v724.js';
import { calloriaDigitalFollowUpPerformancePluginV724 } from '../build/calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const NOW = Date.parse('2026-11-22T12:00:00.000Z');
function atAgo(minutes) { return new Date(NOW - minutes * 60_000).toISOString(); }
function contact({
  id = 'DIG-1', channel = 'live_chat', assignedTo = 'EMP-CURRENT', targetMinutes = 10,
  messages = []
} = {}) {
  return {
    id, channel, channelLabel: channel === 'live_chat' ? 'Live chat' : channel,
    status: 'resolved', customer: `Customer ${id}`, subject: `Subject ${id}`,
    assignedTo, slaMinutes: targetMinutes, messages
  };
}

function cycleMessages(id, { customerAgo, responseAgo = null, responseAgent = null }) {
  const rows = [
    { id: `${id}-C1`, type: 'customer', text: 'Initial request', at: atAgo(60) },
    { id: `${id}-A1`, type: 'agent', text: 'I am checking this for you.', at: atAgo(59), agentId: 'EMP-FIRST' },
    { id: `${id}-C2`, type: 'customer', text: 'Please provide an update.', at: atAgo(customerAgo) }
  ];
  if (responseAgo !== null) rows.push({
    id: `${id}-A2`, type: 'agent', text: 'Here is the update.', at: atAgo(responseAgo), agentId: responseAgent
  });
  return rows;
}

test('completed follow-up cycles are attributed to the responding agent, not a later contact owner', () => {
  const item = contact({
    id: 'ATTRIB',
    assignedTo: 'EMP-CURRENT',
    messages: cycleMessages('ATTRIB', { customerAgo: 15, responseAgo: 2, responseAgent: 'EMP-REPLY' })
  });
  const board = digitalFollowUpPerformanceBoard([item], NOW);
  assert.equal(board.totalCycles, 1);
  assert.equal(board.completed, 1);
  assert.equal(board.met, 0);
  assert.equal(board.late, 1);
  assert.equal(board.responseTargetRate, 0);
  assert.equal(board.agents.length, 1);
  assert.equal(board.agents[0].agentId, 'EMP-REPLY');
  assert.equal(board.agents[0].late, 1);
});

test('open follow-up cycles use the currently assigned agent and separate overdue from completed-late', () => {
  const item = contact({
    id: 'OPEN',
    status: 'active',
    assignedTo: 'EMP-OWNER',
    messages: cycleMessages('OPEN', { customerAgo: 14 })
  });
  const board = digitalFollowUpPerformanceBoard([item], NOW);
  assert.equal(board.open, 1);
  assert.equal(board.overdue, 1);
  assert.equal(board.late, 0);
  assert.equal(board.agents[0].agentId, 'EMP-OWNER');
  assert.equal(board.agents[0].overdue, 1);
});

test('multiple agents and channels are aggregated without combining first-response SLA', () => {
  const email = contact({
    id: 'EMAIL', channel: 'email', targetMinutes: 240,
    messages: cycleMessages('EMAIL', { customerAgo: 12, responseAgo: 8, responseAgent: 'EMP-A' })
  });
  const social = contact({
    id: 'SOCIAL', channel: 'social', targetMinutes: 20,
    messages: cycleMessages('SOCIAL', { customerAgo: 8, responseAgo: 2, responseAgent: 'EMP-B' })
  });
  const board = digitalFollowUpPerformanceBoard([email, social], NOW);
  assert.equal(board.totalCycles, 2);
  assert.equal(board.completed, 2);
  assert.equal(board.met, 2);
  assert.equal(board.responseTargetRate, 100);
  assert.deepEqual(board.agents.map(row => row.agentId).sort(), ['EMP-A', 'EMP-B']);
  assert.equal(board.byChannel.email.met, 1);
  assert.equal(board.byChannel.social.met, 1);
  assert.equal(board.byChannel.live_chat.total, 0);
});

test('unassigned and invalid records are handled safely and calculations do not mutate source history', () => {
  const item = contact({ id: 'UNOWNED', assignedTo: null, messages: cycleMessages('UNOWNED', { customerAgo: 4 }) });
  item.messages[item.messages.length - 1].at = 'not-a-date';
  const before = JSON.stringify(item);
  const board = digitalFollowUpPerformanceBoard([null, {}, item, [], 'bad'], NOW);
  assert.equal(board.totalCycles, 0);
  assert.equal(board.agents.length, 0);
  assert.equal(JSON.stringify(item), before);
  assert.equal(digitalFollowUpPerformanceDisplay(null), '—');
  assert.equal(digitalFollowUpPerformanceDisplay(87.6), '88%');
  assert.equal(digitalFollowUpPerformanceBoard(null, NOW).totalCycles, 0);
});

test('agent scorecard response rate is based only on completed follow-up cycles', () => {
  const completed = contact({
    id: 'DONE',
    messages: cycleMessages('DONE', { customerAgo: 5, responseAgo: 2, responseAgent: 'EMP-X' })
  });
  const open = contact({
    id: 'PENDING',
    status: 'active',
    assignedTo: 'EMP-X',
    messages: cycleMessages('PENDING', { customerAgo: 9 })
  });
  const board = digitalFollowUpPerformanceBoard([completed, open], NOW);
  assert.equal(board.completed, 1);
  assert.equal(board.open, 1);
  assert.equal(board.responseTargetRate, 100);
  assert.equal(board.agents.find(row => row.agentId === 'EMP-X').responseTargetRate, 100);
});

test('v7.24 transforms only a v7.23 supervisor source and is idempotent', () => {
  const plugin = calloriaDigitalFollowUpPerformancePluginV724();
  const source = [
    "import { digitalFollowUpSupervisorBoard, findDigitalFollowUpSupervisorAlert } from './digital-followup-supervisor-engine-v723.js';",
    '/* CALLORIA_V723_DIGITAL_FOLLOWUP_SUPERVISOR */',
    'function renderSupervisor(){',
    '  const digitalFollowUpSupervisorPanel = renderDigitalFollowUpSupervisorPanelV723(state.digitalQueue, state.supervisorRequests, nowVoice);',
    '  viewRoot.innerHTML=`',
    '    ${digitalFollowUpSupervisorPanel}',
    '  `;',
    '}'
  ].join('\n');
  const result = plugin.transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(result?.code);
  for (const fragment of [
    "from './digital-followup-performance-engine-v724.js';",
    'renderDigitalFollowUpPerformancePanelV724',
    'Digital follow-up performance',
    '${digitalFollowUpPerformancePanel}',
    'digitalFollowUpPerformanceBoard',
    'digital-followup-channel-grid',
    'board.byChannel'
  ]) assert.ok(result.code.includes(fragment), `missing ${fragment}`);
  assert.equal(plugin.transform.call({ warn() {} }, result.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call({ warn() {} }, source, '/repo/js/other.js'), null);
});

test('v7.24 skips safely when v7.23 anchors have drifted', () => {
  const plugin = calloriaDigitalFollowUpPerformancePluginV724();
  const warnings = [];
  const source = "/* CALLORIA_V723_DIGITAL_FOLLOWUP_SUPERVISOR */\nfunction renderSupervisor(){\n  const renamedPanel = true;\n}";
  const result = plugin.transform.call({ warn(message) { warnings.push(message); } }, source, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
  assert.ok(!source.includes('digital-followup-performance-engine-v724.js'));
});

test('v7.23 supervisor transform feeds the v7.24 analytics transform in sequence', () => {
  const supervisorPlugin = calloriaDigitalFollowUpSupervisorPluginV723();
  const performancePlugin = calloriaDigitalFollowUpPerformancePluginV724();
  const source = [
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
  const first = supervisorPlugin.transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(first?.code);
  const second = performancePlugin.transform.call({ warn(message) { throw new Error(message); } }, first.code, '/repo/js/main.js');
  assert.ok(second?.code);
  assert.ok(second.code.includes('${digitalFollowUpSupervisorPanel}'));
  assert.ok(second.code.includes('${digitalFollowUpPerformancePanel}'));
  assert.ok(second.code.indexOf('${digitalFollowUpPerformancePanel}') < second.code.indexOf('${digitalFollowUpSupervisorPanel}'));
});
