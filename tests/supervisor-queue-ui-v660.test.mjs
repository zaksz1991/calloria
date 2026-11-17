import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const liveQueue = fs.readFileSync(path.join(root, 'js/live-queue-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('supervisor queue engine is connected to the primary CALLORIA application', () => {
  assert.match(main, /from '\.\/supervisor-queue-engine\.js'/);
  assert.match(main, /function renderSupervisor\(\)/);
  assert.match(main, /supervisorQueueBoard\(/);
  assert.match(main, /liveQueue\.paused \? 'Paused'/);
});

test('supervisor view renders real voice and digital queue triage forms', () => {
  assert.match(main, /data-supervisor-triage="voice"/);
  assert.match(main, /data-supervisor-triage="digital"/);
  assert.match(main, /name="priority"/);
  assert.match(main, /name="routeGroup"/);
  assert.match(main, /name="reason"/);
});

test('intake pause/resume and mode controls are wired to persisted live queue state', () => {
  assert.match(main, /supervisor-toggle-intake/);
  assert.match(main, /supervisor-intake-mode/);
  assert.match(main, /state\.liveQueueSimulation\.paused=result\.control\.paused/);
  assert.match(main, /state\.liveQueueSimulation\.arrivalIntervalMultiplier=SUPERVISOR_INTAKE_MODES\[result\.control\.mode\]\.multiplier/);
  assert.match(liveQueue, /while \(!state\.paused && minute >= state\.nextArrivalAtMinute/);
});

test('supervisor changes and triage decisions enter the operation timeline and audit history', () => {
  assert.match(main, /pushOperationEvent\('supervisor-queue'/);
  assert.match(main, /pushOperationEvent\('supervisor-triage'/);
  assert.match(main, /state\.supervisorQueueAudit\.push\(event\)/);
});

test('legacy saved profiles migrate control state without losing their existing queue records', () => {
  assert.match(main, /normalizeSupervisorQueueControl\(migrated\.supervisorQueueControl\)/);
  assert.match(main, /normalizeLiveQueueState\(migrated\.liveQueueSimulation/);
  assert.match(main, /migrated\.liveQueueSimulation\.paused = migrated\.supervisorQueueControl\.paused/);
});

test('new shift resets intake controls to standard open mode while preserving previous audit entries', () => {
  assert.match(main, /state\.supervisorQueueControl\.paused = false/);
  assert.match(main, /state\.supervisorQueueControl\.mode = 'normal'/);
  assert.match(main, /state\.liveQueueSimulation\.arrivalIntervalMultiplier = SUPERVISOR_INTAKE_MODES\.normal\.multiplier/);
});

test('supervisor command centre has desktop and phone responsive layout rules', () => {
  assert.match(styles, /\.supervisor-control-grid/);
  assert.match(styles, /\.supervisor-triage-row/);
  assert.match(styles, /@media\(max-width:680px\)[\s\S]*supervisor-triage-row/);
});

test('package check includes new supervisor and live queue engine syntax checks', () => {
  assert.match(packageJson.scripts.check, /supervisor-queue-engine\.js/);
  assert.match(packageJson.scripts.check, /live-queue-engine\.js/);
});
