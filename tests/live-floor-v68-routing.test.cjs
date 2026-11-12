const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(base, 'live-floor.html'), 'utf8');
const js = fs.readFileSync(path.join(base, 'live-floor.js'), 'utf8');
const css = fs.readFileSync(path.join(base, 'live-floor.css'), 'utf8');
const engine = fs.readFileSync(path.join(base, 'queue-routing-engine.js'), 'utf8');
function ids(source) { return [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]); }

test('queue routing engine loads before the Live Floor controller', () => {
  assert.ok(html.indexOf('/queue-routing-engine.js') < html.indexOf('/live-floor.js'));
});

test('page header and footer identify the v6.8 build', () => {
  assert.match(html, /BUILD 6\.9/);
  assert.match(html, /CALLORIA v6\.9/);
});

test('queue panel exposes channel filter, sort mode, next-best-contact and profile editor', () => {
  const all = new Set(ids(html));
  for (const id of ['queue-channel', 'queue-sort', 'routing-overview', 'routing-mode-badge', 'routing-next-title', 'routing-next-reason', 'routing-sla-count', 'routing-skill-count', 'routing-profile-panel', 'routing-profile-controls', 'routing-profile-reset', 'routing-profile-saved', 'queue-list']) assert.ok(all.has(id), `missing ${id}`);
});

test('all Live Floor direct selectors exist and HTML IDs remain unique', () => {
  const all = new Set(ids(html));
  const duplicates = ids(html).filter((id, index, list) => list.indexOf(id) !== index);
  const selectors = [...js.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(duplicates, []);
  assert.deepEqual([...new Set(selectors.filter((id) => !all.has(id)))], []);
});

test('controller requires, exposes and persists the v6.8 routing engine', () => {
  assert.match(js, /const Q = window\.CalloriaQueueRoutingEngine/);
  assert.match(js, /\|\| !Q(?: \|\| !B)?\)/);
  assert.match(js, /Q\.loadProfile\(realStorage, routingIdentity\)/);
  assert.match(js, /Q\.saveProfile\(realStorage, routingIdentity, routingProfile/);
  assert.match(js, /queueRoutingEngine: Q/);
});

test('queue rows are rendered with SLA state, skill fit and routing explanation', () => {
  assert.match(js, /Q\.routeQueue\(contacts, routingProfile/);
  assert.match(js, /route\.slaState/);
  assert.match(js, /route\.skillFitPct/);
  assert.match(js, /route\.reason/);
  assert.match(html, /NEXT BEST CONTACT/);
});

test('route recommendation snapshots are recorded when a contact is accepted', () => {
  assert.match(js, /Q\.findRoute\(E\.queuedContacts\(agentState\), routingProfile/);
  assert.match(js, /contact\.routingSnapshot = \{/);
  assert.match(js, /assignedTeam: state\.shift\.team/);
});

test('completed contacts and shift report retain queue-routing evidence', () => {
  assert.match(js, /result\.record\.routingMetrics =/);
  assert.match(js, /slaStateAtAcceptance: routingSnapshot\.slaState/);
  assert.match(js, /Contacts routed with skills profile/);
  assert.match(js, /Average queue waiting time/);
});

test('routing settings are isolated by employee and assigned team', () => {
  assert.match(js, /Q\.identityKey\(identity\)/);
  assert.match(engine, /function identityKey\(identity\)/);
  assert.match(engine, /profiles\[identityKey\(identity\)\]/);
});

test('routing remains advisory and agents can still choose any queued contact', () => {
  assert.match(html, /agent retains contact choice/);
  assert.match(js, /list\.querySelectorAll\('\[data-contact-id\]'\)/);
  assert.doesNotMatch(js, /throw new Error\([^\n]*skill mismatch/i);
});

test('mobile layout includes the queue profile editor and sorting controls', () => {
  assert.match(css, /\.queue-filters-v68/);
  assert.match(css, /\.routing-profile-controls/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*routing-profile-controls/);
});

test('routing engine does not make network or AI requests', () => {
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|groq|api\.openai/i);
});
