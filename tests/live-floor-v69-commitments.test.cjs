const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '../public');
const html = fs.readFileSync(path.join(base, 'live-floor.html'), 'utf8');
const js = fs.readFileSync(path.join(base, 'live-floor.js'), 'utf8');
const css = fs.readFileSync(path.join(base, 'live-floor.css'), 'utf8');
const engine = fs.readFileSync(path.join(base, 'commitment-engine.js'), 'utf8');
function ids(source) { return [...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]); }

test('commitment engine loads before the Live Floor controller', () => {
  assert.ok(html.indexOf('/commitment-engine.js') < html.indexOf('/live-floor.js'));
});

test('page header and footer identify build 6.9', () => {
  assert.match(html, /BUILD 6\.9/);
  assert.match(html, /CALLORIA v6\.9/);
});

test('wrap-up supports optional callback scheduling and descriptive promise text', () => {
  const all = new Set(ids(html));
  for (const id of ['followup-plan', 'followup-commitment', 'followup-commitment-field']) assert.ok(all.has(id), `missing ${id}`);
  assert.match(js, /B\.validateCreation/);
  assert.match(js, /B\.createCommitment/);
  assert.match(js, /disposition === 'Callback agreed' && !followUpPlan/);
  assert.match(js, /result\.record\.commitmentId/);
});

test('commitment desk exposes list, due indicators, outcome and supervisor review forms', () => {
  const all = new Set(ids(html));
  for (const id of ['commitment-panel', 'commitment-count', 'commitment-summary', 'commitment-list', 'commitment-outcome-form', 'commitment-outcome', 'commitment-outcome-summary', 'commitment-review-form', 'commitment-review-summary', 'commitment-reviewer']) assert.ok(all.has(id), `missing ${id}`);
  assert.match(js, /B\.listForAgent/);
  assert.match(js, /B\.recordOutcome/);
  assert.match(js, /B\.closeAfterReview/);
  assert.match(engine, /reviewing manager must be different/i);
});

test('callback outcomes write back to Customer 360 and linked case interactions', () => {
  assert.match(js, /C\.addCustomerNote/);
  assert.match(js, /C\.addInteraction/);
  assert.match(js, /C\.save\(customerState, realStorage\)/);
});

test('outstanding customer commitments are included in the shift report', () => {
  assert.match(js, /Open customer commitments/);
  assert.match(js, /Overdue customer commitments/);
  assert.match(js, /Commitments requiring review/);
});

test('commitment form requires work-shift readiness before action', () => {
  assert.match(js, /!F\.isOnShift\(state\) \|\| F\.dueEvent\(state\)/);
});

test('all direct Live Floor selectors exist and HTML IDs are unique', () => {
  const all = new Set(ids(html));
  const duplicates = ids(html).filter((id, index, list) => list.indexOf(id) !== index);
  const selectors = [...js.matchAll(/\$\('#([^']+)'\)/g)].map((match) => match[1]);
  assert.deepEqual(duplicates, []);
  assert.deepEqual([...new Set(selectors.filter((id) => !all.has(id)))], []);
});

test('callback panel has responsive layout and clear status classes', () => {
  for (const selector of ['.commitment-panel', '.commitment-item', '.commitment-status.overdue', '.commitment-action', '.followup-plan-panel', '@media(max-width:560px)']) assert.ok(css.includes(selector), `missing CSS ${selector}`);
});

test('engine caps retries and requires review rather than silently closing repeated misses', () => {
  assert.match(engine, /MAX_ATTEMPTS = 2/);
  assert.match(engine, /Needs review/);
  assert.match(engine, /closeAfterReview/);
});

test('commitments are browser-local and engine does not call external services', () => {
  assert.match(engine, /calloria\.customer-commitments\.v69/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|groq|api\.openai/i);
});
