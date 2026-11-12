const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(base, 'live-floor.html'), 'utf8');
const js = fs.readFileSync(path.join(base, 'live-floor.js'), 'utf8');
const css = fs.readFileSync(path.join(base, 'live-floor.css'), 'utf8');
const engine = fs.readFileSync(path.join(base, 'social-messaging-engine.js'), 'utf8');
function ids(source) { return [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]); }

test('Social messaging engine loads before the Live Floor controller', () => {
  assert.ok(html.indexOf('/social-messaging-engine.js') < html.indexOf('/live-floor.js'));
});

test('page version and footer identify v6.7', () => {
  assert.match(html, /BUILD 6\.7/);
  assert.match(html, /CALLORIA v6\.7/);
});

test('all three channel workspace controls exist in HTML', () => {
  const all = new Set(ids(html));
  for (const id of ['social-messaging-workspace', 'social-message-stage', 'social-message-visibility', 'social-message-sent', 'social-message-guidance', 'social-message-label', 'social-message-body', 'social-message-character-count', 'social-message-prepare', 'social-message-quality']) assert.ok(all.has(id), `missing ${id}`);
});

test('HTML has no duplicate IDs', () => {
  const all = ids(html);
  assert.deepEqual(all.filter((id, index) => all.indexOf(id) !== index), []);
});

test('all direct Live Floor selectors have matching HTML IDs', () => {
  const all = new Set(ids(html));
  const selectors = [...js.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(selectors.filter((id) => !all.has(id)))], []);
});

test('controller requires and exposes the v6.7 engine', () => {
  assert.match(js, /const S = window\.CalloriaSocialMessagingEngine/);
  assert.match(js, /\|\| !S\)/);
  assert.match(js, /socialMessagingEngine: S/);
});

test('Social, SMS and In-app contacts create and restore their own sessions', () => {
  assert.match(js, /S\.createSession\(contact, new Date\(\)\)/);
  assert.match(js, /S\.normaliseSession\(state\.active\.socialMessagingSession, restoredContact/);
});

test('customer decision selection is blocked until the reply is prepared', () => {
  assert.match(js, /S\.hasPreparedReply\(messaging, state\.active\.stageIndex\)/);
  assert.match(js, /Prepare a safe .* response before selecting the service action/);
});

test('prepared channel response replaces generic placeholder transcript text', () => {
  assert.match(js, /scriptedOutbound\.body = messagingBody/);
  assert.match(js, /scriptedOutbound\.messagingVisibility = committed\.visibility/);
  assert.match(js, /S\.commitReply\(messaging, digitalStage/);
});

test('channel responses are mandatory before contact wrap-up and saved as metrics', () => {
  assert.match(js, /All three .* customer responses must be recorded before wrap-up/);
  assert.match(js, /S\.finalise\(messagingSession/);
  assert.match(js, /result\.record\.messagingMetrics = messagingMetrics/);
});

test('shift report includes Social, SMS and In-app channel measures', () => {
  for (const label of ['Social contacts handled', 'SMS contacts handled', 'In-app contacts handled', 'SMS segments used']) assert.match(js, new RegExp(label));
});

test('mobile layout rules cover the new channel workspace', () => {
  assert.match(css, /\.social-messaging-workspace/);
  assert.match(css, /@media\(max-width:680px\).*social-message-topline/s);
});

test('v6.6 Email and Live Chat workspaces remain present', () => {
  const all = new Set(ids(html));
  for (const id of ['digital-email-workspace', 'digital-chat-workspace', 'digital-email-send', 'digital-chat-prepare']) assert.ok(all.has(id));
  assert.match(js, /G\.sendEmail\(digital/);
  assert.match(js, /G\.commitChatReply\(digital, digitalStage/);
});

test('Social messaging engine does not invoke external services or AI endpoints', () => {
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|groq|api\.openai/i);
});
