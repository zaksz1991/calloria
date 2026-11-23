import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('package manifest exposes the focused v8.6 diagnostic test and retains the whole test glob', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['verify:workforce-cloud-health'], 'node --test tests/workforce-trend-cloud-health-v806.test.mjs');
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  assert.equal(pkg.engines.node, '22.x');
});

test('preflight requires the new cloud-health engine and its regression test', () => {
  const source = read('tools/calloria-build-preflight.mjs');
  assert.match(source, /js\/workforce-trend-cloud-health-engine-v806\.js/);
  assert.match(source, /tests\/workforce-trend-cloud-health-v806\.test\.mjs/);
});

test('central v8 audit enforces cloud-health dependencies, UI, version and focused test command', () => {
  const source = read('tools/calloria-v8-integration-audit.mjs');
  assert.match(source, /js\/workforce-trend-cloud-health-engine-v806\.js/);
  assert.match(source, /tests\/workforce-trend-cloud-health-v806\.test\.mjs/);
  assert.match(source, /verify:workforce-cloud-health/);
  assert.match(source, /data-workforce-cloud-health-check/);
  assert.match(source, /WORKFORCE_TREND_CLOUD_HEALTH_VERSION_V806/);
});

test('v8.6 stylesheet includes responsive layouts and visible diagnostic states', () => {
  const css = read('styles/calloria-workforce-trend-cloud-sync-v801.css');
  assert.match(css, /\.wth-cloud-health-row/);
  assert.match(css, /\.wth-cloud-health-summary\.is-healthy/);
  assert.match(css, /@media \(max-width: 760px\)/);
});
