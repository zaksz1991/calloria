import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const base = resolve('public');
const html = readFileSync(resolve(base, 'live-floor.html'), 'utf8');
const js = readFileSync(resolve(base, 'live-floor.js'), 'utf8');
const css = readFileSync(resolve(base, 'live-floor.css'), 'utf8');
const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

test('v6.1 live floor HTML has unique IDs', () => {
  const list = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(list.length, ids.size);
});

test('all literal controller selectors exist in the live-floor page', () => {
  const selectors = [...js.matchAll(/\$\('#([a-zA-Z0-9_-]+)'\)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(selectors)].filter((id) => !ids.has(id)), []);
});

test('career progression engine is loaded after the live-floor engine and before the controller', () => {
  const scripts = [...html.matchAll(/<script defer src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(scripts, ['/agent-workbench-engine.js', '/customer-journey-engine.js', '/live-floor-engine.js', '/career-progression-engine.js', '/live-floor.js']);
});

test('career dashboard includes rank, XP, progress, objectives and achievements', () => {
  for (const id of ['career-rank', 'career-xp', 'career-next-rank', 'career-xp-to-next', 'career-progress-bar', 'career-objectives-list', 'career-badges-list', 'career-badge-count']) {
    assert.ok(ids.has(id), `Missing ${id}`);
  }
});

test('end-of-shift report contains the career reward panel', () => {
  assert.ok(ids.has('career-award'));
  assert.match(js, /Career reward:/);
});

test('game progression is described separately from formal promotion', () => {
  assert.match(html, /Real job grades and promotions remain subject to formal performance reviews/);
});

test('the page remains responsive on tablet and mobile screens', () => {
  assert.match(css, /@media\(max-width:850px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(css, /\.career-detail-grid\{grid-template-columns:1fr\}/);
});
