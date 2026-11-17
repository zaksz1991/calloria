import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [main, changelog, readme, viteConfig, packageManifest] = await Promise.all([
  readFile(new URL('../js/main.js', import.meta.url), 'utf8'),
  readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../vite.config.js', import.meta.url), 'utf8'),
  readFile(new URL('../package.json', import.meta.url), 'utf8')
]);

test('v6.59 runtime is connected to the existing agent application entry point', () => {
  assert.match(main, /from '\.\/live-queue-engine\.js'/);
  assert.match(main, /createLiveQueueState/);
  assert.match(main, /advanceLiveQueue/);
  assert.match(main, /normalizeLiveQueueState/);
});

test('shift start and persisted active-shift migration initialise the live queue clock', () => {
  assert.match(main, /shiftSimulationEpochMs = Date\.now\(\) - state\.shiftElapsedMinutes \* 60_000/);
  assert.match(main, /liveQueueSimulation = createLiveQueueState/);
  assert.match(main, /migrated\.liveQueueSimulation = normalizeLiveQueueState/);
});

test('one accelerated shift-clock tick advances arrivals, abandonment and queue audit events', () => {
  assert.match(main, /state\.shiftElapsedMinutes=Math\.min\(540,state\.shiftElapsedMinutes\+\.5\)/);
  assert.match(main, /const result=advanceLiveQueue\(/);
  assert.match(main, /New inbound contact arrived:/);
  assert.match(main, /Customer abandoned after waiting/);
  assert.match(main, /queue reached its capacity/);
});

test('agent and supervisor queue screens use the accelerated queue timestamp', () => {
  assert.match(main, /sortQueuedContacts\(state\.inboundQueueItems, queueNow\)/);
  assert.match(main, /queueMetrics\(state\.inboundQueueItems, queueNow\)/);
  assert.match(main, /CUSTOMERS ABANDONED/);
  assert.match(main, /Simulate demand surge \(\+6\)/);
  assert.match(main, /Next expected arrival/);
  assert.match(main, /Opening queue contacts/);
  assert.match(main, /Manual surge contacts/);
  assert.match(main, /addManualDemandSurge/);
  assert.match(main, /queue capacity/);
});

test('agent call acceptance computes queue waiting time on the same accelerated clock', () => {
  assert.match(main, /nextQueuedContact\(state\.inboundQueueItems, queueNow\)/);
  assert.match(main, /const queueAcceptedAt = queueSimulationNowMs\(\)/);
  assert.match(main, /queueAcceptedAt - Date\.parse\(contact\.queuedAt\)/);
});

test('the shift stops generating contacts after closure and resets cleanly on a new workday', () => {
  assert.match(main, /state\.liveQueueSimulation\.active = false/);
  assert.match(main, /state\.liveQueueSimulation=null/);
  assert.match(main, /state\.inboundQueueItems=\[\]/);
});

test('existing recruitment, customer handling, wrap-up and career progression remain in the main app', () => {
  assert.match(main, /function startInboundCall\(/);
  assert.match(main, /function saveWrapUp\(/);
  assert.match(main, /recordPromotionExam/);
  assert.match(main, /function renderAssessment\(/);
  assert.match(main, /function renderOverview\(/);
});

test('v6.58 Try-It Studio remains registered as the prior release', () => {
  assert.match(viteConfig, /calloria-try-it-studio-v6-58\.mjs/);
  assert.match(viteConfig, /calloriaTryItStudioPlugin\(\)/);
  assert.match(readme, /v6\.58/);
  assert.match(changelog, /v6\.58/);
});

test('v6.59 is documented as a synthetic operational queue, not real telephony', () => {
  assert.match(changelog, /v6\.59/);
  assert.match(readme, /v6\.59/);
  assert.match(packageManifest, /"type": "module"/);
  assert.match(main, /Live queue simulation/);
});
