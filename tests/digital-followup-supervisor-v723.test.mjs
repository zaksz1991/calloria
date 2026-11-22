import test from 'node:test';
import assert from 'node:assert/strict';
import { digitalFollowUpSupervisorBoard, findDigitalFollowUpSupervisorAlert } from '../js/digital-followup-supervisor-engine-v723.js';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from '../build/calloria-digital-followup-supervisor-v723.mjs';

const NOW = Date.parse('2026-11-22T12:00:00.000Z');
function contact({ id = 'DIG-1', channel = 'live_chat', status = 'active', ageMinutes = 12, targetMinutes = 10, assignedTo = 'EMP-TEST' } = {}) {
  const customerAt = new Date(NOW - ageMinutes * 60_000).toISOString();
  const agentAt = new Date(NOW - (ageMinutes + 1) * 60_000).toISOString();
  return {
    id, channel, channelLabel: channel === 'live_chat' ? 'Live chat' : channel,
    status, customer: `Customer ${id}`, subject: `Subject ${id}`, assignedTo,
    slaMinutes: targetMinutes,
    messages: [
      { id: `${id}-C1`, type: 'customer', text: 'Initial customer request', at: agentAt },
      { id: `${id}-A1`, type: 'agent', text: 'Acknowledged and checking the issue.', at: agentAt },
      { id: `${id}-C2`, type: 'customer', text: 'I am still waiting for the promised update.', at: customerAt }
    ]
  };
}

test('supervisor board identifies overdue and at-risk follow-up cycles only', () => {
  const overdue = contact({ id: 'OVERDUE', ageMinutes: 15 });
  const atRisk = contact({ id: 'RISK', ageMinutes: 8 });
  const noRisk = contact({ id: 'SAFE', ageMinutes: 3 });
  const closed = contact({ id: 'CLOSED', ageMinutes: 15, status: 'resolved' });
  const board = digitalFollowUpSupervisorBoard([overdue, atRisk, noRisk, closed], [], NOW);
  assert.equal(board.total, 2);
  assert.equal(board.overdue, 1);
  assert.equal(board.dueSoon, 1);
  assert.equal(board.unraised, 2);
  assert.deepEqual(board.rows.map(row => row.contactId), ['OVERDUE', 'RISK']);
  assert.equal(board.rows[0].status, 'breached');
  assert.equal(board.rows[1].status, 'at_risk');
});

test('customer follow-up bursts group repeated customer messages until an agent replies', () => {
  const item = contact({ id: 'BURST', ageMinutes: 15 });
  item.messages.splice(3, 0, { id: 'BURST-C3', type: 'customer', text: 'One more detail', at: new Date(NOW - 14 * 60_000).toISOString() });
  const board = digitalFollowUpSupervisorBoard([item], [], NOW);
  assert.equal(board.total, 1);
  assert.equal(board.rows[0].customerMessageCount, 2);
  assert.equal(board.rows[0].sequence, 1);
});

test('open supervisor requests are detected and do not create duplicate intervention prompts', () => {
  const item = contact({ id: 'HAS-REQUEST', ageMinutes: 15 });
  const requests = [{ id: 'SUP-1', contactId: item.id, status: 'open' }];
  const board = digitalFollowUpSupervisorBoard([item], requests, NOW);
  assert.equal(board.alreadyEscalated, 1);
  assert.equal(board.unraised, 0);
  assert.equal(board.rows[0].hasOpenRequest, true);
});

test('alert revalidation rejects stale, responded, closed and mismatched cycles', () => {
  const item = contact({ id: 'REVALIDATE', ageMinutes: 15 });
  const [row] = digitalFollowUpSupervisorBoard([item], [], NOW).rows;
  assert.ok(findDigitalFollowUpSupervisorAlert([item], [], item.id, row.cycleId, NOW));
  assert.equal(findDigitalFollowUpSupervisorAlert([item], [], item.id, 'wrong-cycle', NOW), null);
  item.status = 'resolved';
  assert.equal(findDigitalFollowUpSupervisorAlert([item], [], item.id, row.cycleId, NOW), null);
});

test('non-main modules are not transformed', () => {
  const plugin = calloriaDigitalFollowUpSupervisorPluginV723();
  assert.equal(plugin.transform.call({ warn() {} }, 'const x = 1;', '/repo/js/digital.js'), null);
});

test('main transform adds the supervisor panel, navigation and guarded escalation action once', () => {
  const plugin = calloriaDigitalFollowUpSupervisorPluginV723();
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
  const result = plugin.transform.call({ warn(message) { throw new Error(message); } }, source, '/repo/js/main.js');
  assert.ok(result?.code);
  for (const fragment of [
    "from './digital-followup-supervisor-engine-v723.js';",
    'digitalFollowUpSupervisorPanel',
    'Digital follow-up SLA watch',
    "case 'open-digital-followup'",
    "case 'raise-digital-followup-escalation'",
    'findDigitalFollowUpSupervisorAlert'
  ]) assert.ok(result.code.includes(fragment), `missing ${fragment}`);
  const second = plugin.transform.call({ warn() {} }, result.code, '/repo/js/main.js');
  assert.equal(second, null);
});

test('source drift causes a safe skip with no partial edits', () => {
  const plugin = calloriaDigitalFollowUpSupervisorPluginV723();
  const warnings = [];
  const source = "import { assessDigitalResponseCycles, digitalResponseCycleDisplay } from './digital-response-cycle-engine-v721.js';\n/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */\nfunction renderSupervisor(){\n  const changedAnchor = true;\n}";
  const result = plugin.transform.call({ warn(message) { warnings.push(message); } }, source, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
  assert.ok(!source.includes('digital-followup-supervisor-engine-v723.js'));
});
