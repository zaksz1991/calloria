import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { supervisorQueueBoard } from '../js/supervisor-queue-engine.js';
import { DIGITAL_STATUS } from '../js/multichannel-engine.js';

const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('v6.62 workload rules are imported by the main application', () => {
  assert.match(main, /from '\.\/agent-workload-engine\.js'/);
  assert.match(main, /canAcceptDigitalContact/);
  assert.match(main, /canResumeDigitalFollowUp/);
});

test('legacy single selected digital contact migrates into the multi-contact worklist', () => {
  assert.match(main, /migrated\.digitalActiveIds = migratedIds/);
  assert.match(main, /for \(const id of migratedIds\).*migrated\.digitalActiveIds\.push\(id\)/s);
  assert.match(main, /migrated\.digitalActiveId = migratedIds\[0\] \|\| null/);
});

test('digital workspace renders assigned-thread tabs and a separate waiting queue', () => {
  assert.match(main, /data-action=\\?"select-digital/);
  assert.match(main, /My assigned digital work/);
  assert.match(main, /Waiting digital queue/);
  assert.match(main, /Accept additional work while response capacity remains available/);
});

test('digital assignment action evaluates workload capacity before accepting a contact', () => {
  assert.match(main, /const decision = digitalWorkloadDecision\(contactId\)/);
  assert.match(main, /if \(!decision\.allowed\) \{ toast\(decision\.reason, 'warning'\); return; \}/);
  assert.match(main, /state\.digitalActiveIds = work\.map\(item => item\.id\)/);
});

test('digital reply and follow-up transitions recalculate the active agent workload', () => {
  assert.match(main, /syncAgentStateWithDigitalWork\('Digital reply sent/);
  assert.match(main, /syncAgentStateWithDigitalWork\('Customer reply received/);
  assert.match(main, /state\.digitalActiveIds = \(state\.digitalActiveIds \|\| \[\]\)\.filter/);
});

test('after-contact work blocks unsafe channel overlap with active voice or outbound work', () => {
  assert.match(main, /Finish the active voice or outbound interaction before replying to a digital thread/);
  assert.match(main, /Finish the active voice or outbound interaction before completing digital after-contact work/);
});

test('package syntax check includes the workload engine', () => {
  assert.match(packageJson.scripts.check, /js\/agent-workload-engine\.js/);
});

test('supervisor board counts concurrent assigned digital response work', () => {
  const digitalQueue = [
    { id: 'D1', status: DIGITAL_STATUS.ACTIVE, channel: 'email' },
    { id: 'D2', status: DIGITAL_STATUS.ACTIVE, channel: 'live_chat' },
    { id: 'D3', status: DIGITAL_STATUS.AWAITING_CUSTOMER, channel: 'social' },
    { id: 'D4', status: DIGITAL_STATUS.QUEUED, channel: 'email' }
  ];
  const board = supervisorQueueBoard({ digitalQueue, currentCall: { id: 'CALL-1' } });
  assert.equal(board.activeDigital, 2);
  assert.equal(board.awaitingCustomer, 1);
  assert.equal(board.activeDigitalByChannel.email, 1);
  assert.equal(board.activeDigitalByChannel.live_chat, 1);
  assert.equal(board.activeWork, 3);
});

