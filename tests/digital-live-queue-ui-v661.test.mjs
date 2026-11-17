import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'js/digital-live-queue-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('digital live arrival engine is imported into the primary application', () => {
  assert.match(main, /from '\.\/digital-live-queue-engine\.js'/);
  assert.match(main, /createDigitalLiveQueueState\(/);
  assert.match(main, /normalizeDigitalLiveQueueState\(/);
});

test('digital live arrivals advance from the same accelerated in-game shift clock', () => {
  assert.match(main, /advanceDigitalLiveQueue\(/);
  assert.match(main, /elapsedMinute:state\.shiftElapsedMinutes/);
  assert.match(main, /now:queueSimulationNowMs\(\)/);
  assert.match(main, /source:'automatic_shift_arrival'/);
});

test('automatic digital events are recorded in the digital and operations timelines', () => {
  assert.match(main, /type:'automatic-arrival'/);
  assert.match(main, /type:'demand-overflow'/);
  assert.match(main, /pushOperationEvent\('digital-queue'/);
});

test('supervisor demand profiles affect future digital arrivals while voice pause remains separate', () => {
  assert.match(main, /setDigitalQueueDemandMultiplier\(state\.digitalLiveQueueSimulation/);
  assert.match(main, /digitalLive\.arrivals/);
  assert.match(main, /digitalLive\.overflowed/);
  assert.match(main, /digital email, live-chat and social arrivals continue independently/i);
});

test('digital queue timestamps and SLA snapshots use the simulation clock consistently', () => {
  assert.match(main, /digitalQueueMetrics\(state\.digitalQueue, digitalNow\)/);
  assert.match(main, /digitalNow:nowVoice/);
  assert.match(main, /acceptDigitalContact\(state\.digitalQueue, contactId,[^\n]+queueSimulationNowMs\(\)\)/);
});

test('the opening digital batch is seeded only once per shift and then automatic demand takes over', () => {
  assert.match(engine, /openingBatchSeeded/);
  assert.match(main, /!state\.digitalLiveQueueSimulation\.openingBatchSeeded/);
  assert.match(main, /state\.digitalLiveQueueSimulation\.active = false/);
});

test('digital live demand is visible in the agent desk and supervisor command centre', () => {
  assert.match(main, /Live digital demand/);
  assert.match(main, /Digital arrivals/);
  assert.match(main, /digitalLive\.arrivalsByChannel/);
  assert.match(main, /Queue overflow/);
});

test('mobile styling is supplied for the digital live demand panel', () => {
  assert.match(styles, /\.digital-live-summary/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\.digital-live-summary/);
});

test('package syntax checks include the digital live queue engine', () => {
  assert.match(packageJson.scripts.check, /digital-live-queue-engine\.js/);
});
