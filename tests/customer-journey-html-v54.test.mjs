import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const html = readFileSync(resolve(root, 'customer-journey.html'), 'utf8');
const js = readFileSync(resolve(root, 'customer-journey.js'), 'utf8');
const css = readFileSync(resolve(root, 'customer-journey.css'), 'utf8');

test('page loads the local engine and application scripts', () => {
  assert.match(html, /src="\/customer-journey-engine\.js"/);
  assert.match(html, /src="\/customer-journey\.js"/);
  assert.match(html, /href="\/customer-journey\.css"/);
});

test('static HTML identifiers are unique', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size);
});

test('application fixed selectors exist in the page markup', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const refs = new Set([...js.matchAll(/\$\('#([A-Za-z0-9_-]+)'/g)].map((match) => match[1]));
  const dynamic = new Set(['add-interaction', 'add-task-form', 'apply-status', 'assign-case', 'case-status', 'customer-note-form', 'interaction-channel', 'interaction-direction', 'interaction-summary', 'interaction-visibility', 'kb-results', 'kb-search', 'new-owner', 'new-team', 'open-customer-from-case', 'resolution-note']);
  const unresolved = [...refs].filter((ref) => !ids.has(ref) && !dynamic.has(ref));
  assert.deepEqual(unresolved, []);
  for (const id of dynamic) assert.ok(js.includes(`id="${id}"`), `dynamic control ${id} must be rendered by the case/customer detail template`);
});

test('responsive layout breakpoints and reduced-size navigation are present', () => {
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /@media\(max-width:560px\)/);
  assert.match(html, /name="viewport"/);
});

test('the page is self-contained and does not load remote scripts', () => {
  assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href="https?:\/\//i);
});
