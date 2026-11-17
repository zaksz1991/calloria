import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const main = fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const supervisor = fs.readFileSync(path.join(root, 'js/supervisor-queue-engine.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v6.63 SLA engine is imported by the main application', () => {
  assert.match(main, /from '\.\/digital-sla-engine\.js'/);
  assert.match(main, /digitalSlaMetrics\(state\.digitalQueue, digitalNow\)/);
});

test('digital SLA monitor runs from the accelerated active-shift clock', () => {
  assert.match(main, /advanceDigitalSlaMonitor\(state\.digitalQueue, queueSimulationNowMs\(\)\)/);
  assert.match(main, /recordDigitalSlaTransitions\(advanceDigitalSlaMonitor/);
});

test('first agent response is assessed immediately after reply recording', () => {
  const replyBlock = main.slice(main.indexOf('function submitDigitalReply'), main.indexOf('function finishDigitalContact'));
  assert.match(replyBlock, /recordDigitalReply\(/);
  assert.match(replyBlock, /advanceDigitalSlaMonitor\(/);
});

test('agent work tabs and active contact banner display SLA status', () => {
  assert.match(main, /digital-sla-pill \$\{sla\.status\}/);
  assert.match(main, /digital-sla-banner \$\{activeSlaClass\}/);
  assert.match(main, /FIRST-RESPONSE SERVICE LEVEL/);
});

test('both agent queue views show per-contact first-response status', () => {
  assert.ok((main.match(/digital-sla-pill \$\{assessDigitalSla\(item, digitalNow\)\.status\}/g) || []).length >= 2);
});

test('supervisor queue board exposes digital SLA status and breach totals', () => {
  assert.match(supervisor, /assessDigitalSla\(item, digitalNow\)/);
  assert.match(supervisor, /digitalSlaBreached/);
  assert.match(main, /DIGITAL SLA BREACHES/);
});

test('SLA transition events are written into the existing operations and digital timelines', () => {
  assert.match(main, /type: 'sla-at-risk'/);
  assert.match(main, /type: 'sla-breached'/);
  assert.match(main, /type: 'sla-met'/);
  assert.match(main, /pushOperationEvent\('digital-sla'/);
});

test('SLA styles include risk, breach and met states with phone layout handling', () => {
  for (const state of ['on_track', 'at_risk', 'breached', 'met']) assert.ok(styles.includes(`.digital-sla-pill.${state}`));
  assert.match(styles, /@media\(max-width:600px\)[\s\S]*digital-sla-banner/);
});

test('project syntax check includes the new digital SLA engine', () => {
  assert.match(pkg.scripts.check, /digital-sla-engine\.js/);
});


test('supervisor digital SLA totals cover open work and target labels remain explicit defaults', () => {
  assert.match(supervisor, /\[DIGITAL_STATUS\.QUEUED, DIGITAL_STATUS\.ACTIVE\]/);
  assert.match(main, /Open digital work beyond first-response target/);
  assert.match(main, /Email default first-response target/);
  assert.match(main, /Live chat default response target/);
  assert.match(main, /Social default acknowledgement target/);
});
