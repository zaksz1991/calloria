import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../public/agent-workbench.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/agent-workbench.js', import.meta.url), 'utf8');

test('page loads customer journey engine before agent workbench', () => {
  assert.ok(html.indexOf('customer-journey-engine.js') < html.indexOf('agent-workbench-engine.js'));
  assert.ok(html.includes('agent-workbench.js'));
});

test('responsive viewport and stylesheet are included', () => {
  assert.match(html, /name="viewport"/);
  assert.match(html, /agent-workbench\.css/);
});

test('agent desk includes primary queue, interaction, customer and knowledge panels', () => {
  for (const id of ['queue-list', 'contact-detail', 'customer-context', 'knowledge-results', 'incident-context', 'completed-rows']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('wrap-up form contains required outcome and case controls', () => {
  for (const id of ['wrap-form', 'wrap-disposition', 'wrap-summary', 'case-action', 'existing-case', 'case-category', 'case-priority']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('page has no duplicate static ids', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});

test('agent workbench script binds static interface selectors', () => {
  const required = ['start-shift', 'end-shift', 'presence-select', 'queue-search', 'queue-channel', 'knowledge-search', 'export-csv', 'wrap-dialog', 'wrap-form', 'toast'];
  for (const id of required) {
    assert.match(html, new RegExp(`id="${id}"`));
    assert.ok(js.includes(`#${id}`));
  }
});

test('scripts do not embed network transport or remote telephony endpoints', () => {
  assert.doesNotMatch(js, /fetch\s*\(|XMLHttpRequest|WebSocket/);
});
