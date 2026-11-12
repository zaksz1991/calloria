const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../public/live-floor.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../public/live-floor.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/live-floor.css'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '../public/digital-channel-engine.js'), 'utf8');

function ids(source) { return [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]); }

test('digital engine is loaded before the live floor controller', () => {
  assert.ok(html.indexOf('/digital-channel-engine.js') < html.indexOf('/live-floor.js'));
});

test('page identifies itself as CALLORIA v6.6', () => {
  assert.match(html, /BUILD 6\.6/);
  assert.match(html, /CALLORIA v6\.6/);
});

test('digital panel provides distinct email and chat workspaces', () => {
  for (const id of ['digital-channel-panel', 'digital-email-workspace', 'digital-chat-workspace', 'digital-email-body', 'digital-email-send', 'digital-chat-body', 'digital-chat-prepare']) assert.ok(ids(html).includes(id), `missing ${id}`);
});

test('page contains no duplicate static ids', () => {
  const all = ids(html);
  const duplicate = all.filter((id, index) => all.indexOf(id) !== index);
  assert.deepEqual(duplicate, []);
});

test('every static controller selector exists in the Live Floor HTML', () => {
  const htmlIds = new Set(ids(html));
  const selectors = [...js.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectors.filter((id) => !htmlIds.has(id)))];
  assert.deepEqual(missing, []);
});

test('controller requires the digital channel engine at startup', () => {
  assert.match(js, /const G = window\.CalloriaDigitalChannelEngine/);
  assert.match(js, /!G\)/);
});

test('email contacts create persistent email sessions and require a sent reply', () => {
  assert.match(js, /G\.createSession\(contact, state\.shift\.minutes/);
  assert.match(js, /digitalSession\.channel === 'Email' && digitalSession\.status !== 'SENT'/);
  assert.match(js, /Send the customer email reply before saving the wrap-up/);
});

test('live chat cannot select service decisions until a reply is prepared', () => {
  assert.match(js, /G\.hasPreparedChatReply\(digital, state\.active\.stageIndex\)/);
  assert.match(js, /Prepare a customer-facing chat response before selecting the service action/);
});

test('email triage steps suppress placeholder outbound and customer messages until the final email', () => {
  assert.match(js, /digital && digital\.channel === 'Email'/);
  assert.match(js, /activeContact\.messages\.splice\(messageStart, generatedMessages\.length\)/);
  assert.match(js, /activeContact\.simulatedReplies = simulatedRepliesBefore/);
});

test('chat transcript records the agent-authored reply rather than the scenario placeholder', () => {
  assert.match(js, /scriptedOutbound\.body = chatBody/);
  assert.match(js, /G\.commitChatReply\(digital, digitalStage/);
});

test('email send uses the quality gate and adds a transcript entry', () => {
  assert.match(js, /G\.sendEmail\(digital/);
  assert.match(js, /E\.sendReply\(agentState, contact\.id/);
  assert.match(js, /message\.digitalChannel = 'Email'/);
});

test('completed contact record stores digital channel metrics', () => {
  assert.match(js, /G\.finalise\(digitalSession/);
  assert.match(js, /result\.record\.digitalMetrics = digitalMetrics/);
});

test('shift report exposes email SLA and live chat response measures', () => {
  assert.match(js, /Email replies sent/);
  assert.match(js, /Email SLA misses/);
  assert.match(js, /Live chat replies/);
  assert.match(js, /Average chat reply time/);
});

test('mobile layout rules are included for the digital composer', () => {
  assert.match(css, /@media\(max-width:680px\).*digital-channel-panel/s);
  assert.match(css, /\.digital-email-actions/);
});

test('digital engine contains no live email, chat, telephony or external API connection', () => {
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|groq|api\.openai/i);
});
