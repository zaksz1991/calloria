import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = resolve('public');
const html = readFileSync(resolve(base, 'live-floor.html'), 'utf8');
const js = readFileSync(resolve(base, 'live-floor.js'), 'utf8');
const css = readFileSync(resolve(base, 'live-floor.css'), 'utf8');

test('live floor HTML contains unique IDs', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'Duplicate HTML IDs found');
});

test('all literal DOM selectors in the controller exist in the page', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const selectors = [...js.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)].map((match) => match[1]);
  const missing = [...new Set(selectors)].filter((id) => !ids.has(id));
  assert.deepEqual(missing, []);
});

test('all required local engine scripts load in dependency order', () => {
  const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ['/agent-workbench-engine.js', '/customer-journey-engine.js', '/live-floor-engine.js', '/live-floor.js']);
});

test('the page includes the required shift, queue, decision and wrap-up controls', () => {
  for (const id of ['start-form', 'queue-list', 'decision-options', 'wrapup-form', 'event-panel', 'completed-table', 'shift-report']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
});

test('responsive layouts exist for tablet and mobile screens', () => {
  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
});
