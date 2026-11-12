const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pub = path.join(__dirname, '..', 'public');
const html = fs.readFileSync(path.join(pub, 'live-floor.html'), 'utf8');
const js = fs.readFileSync(path.join(pub, 'live-floor.js'), 'utf8');
const css = fs.readFileSync(path.join(pub, 'live-floor.css'), 'utf8');

test('voice-call engine loads before live-floor controller', () => {
  const voiceIndex = html.indexOf('<script defer src="/voice-call-engine.js"></script>');
  const controllerIndex = html.indexOf('<script defer src="/live-floor.js"></script>');
  assert.ok(voiceIndex >= 0);
  assert.ok(controllerIndex > voiceIndex);
});

test('voice control panel contains all required controls and accessible status outputs', () => {
  for (const id of ['voice-call-panel', 'voice-call-state', 'voice-call-duration', 'voice-hold-duration', 'voice-hold-button', 'voice-resume-button', 'voice-mute-button', 'voice-consult-start', 'voice-consult-complete', 'voice-transfer-button', 'voice-transfer-handover', 'voice-consult-guidance']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  assert.match(html, /aria-label="Simulated voice call controls"/);
  assert.match(html, /role="status"/);
});

test('every live-floor controller ID selector exists in the page', () => {
  const selectors = [...js.matchAll(/\$\(['"]#([a-zA-Z0-9_-]+)['"]\)/g)].map((match) => match[1]);
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
  const missing = [...new Set(selectors)].filter((id) => !ids.has(id));
  assert.deepEqual(missing, []);
});

test('HTML IDs are unique', () => {
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('voice state persists with the active contact and blocks decisions while not connected', () => {
  assert.match(js, /state\.active\.voiceSession\s*=\s*V\.createSession/);
  assert.match(js, /V\.normaliseSession\(state\.active\.voiceSession, restoredContact\)/);
  assert.match(js, /voice\.status !== V\.STATES\.CONNECTED/);
  assert.match(js, /Resume the customer call before selecting the next service response/);
});

test('warm transfer is locked until triage completion and requires specialist wrap-up', () => {
  assert.match(js, /!state\.active\.readyToWrap/);
  assert.match(js, /Complete the three customer-care decisions before transferring the call/);
  assert.match(js, /voiceSession\.status !== V\.STATES\.TRANSFERRED/);
  assert.match(js, /Use Escalated to specialist as the wrap-up disposition/);
});

test('call controls write consultation and transfer notes into the active interaction', () => {
  assert.match(js, /Simulated supervisor consultation started/);
  assert.match(js, /Simulated supervisor guidance/);
  assert.match(js, /Simulated warm transfer completed/);
  assert.match(js, /result\.record\.voiceMetrics = voiceMetrics/);
});

test('voice timer updates without rebuilding the full agent workstation', () => {
  assert.match(js, /setInterval\(updateVoiceClock, 1000\)/);
  assert.match(js, /function updateVoiceClock\(\)/);
  assert.match(js, /V\.formatSeconds\(snap\.durationSeconds\)/);
});

test('voice controls have responsive mobile layouts and explicit simulation disclaimer', () => {
  assert.match(css, /\.voice-call-panel/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /\.voice-call-toolbar/);
  assert.match(html, /SIMULATED TELEPHONY/);
  assert.match(html, /No real microphone, telephone network/);
});

test('completed contact table includes a channel handling evidence column', () => {
  assert.match(html, /<th>Channel handling<\/th>/);
  assert.match(js, /item\.voiceMetrics\.durationSeconds/);
  assert.match(js, /item\.voiceMetrics\.holdSeconds/);
});
