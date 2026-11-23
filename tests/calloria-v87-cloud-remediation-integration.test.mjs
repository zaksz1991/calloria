import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('v8.7 package command preserves complete regression glob and adds focused remediation check', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  assert.equal(pkg.scripts['verify:workforce-cloud-remediation'], 'node --test tests/workforce-trend-cloud-remediation-v807.test.mjs');
  assert.equal(pkg.engines.node, '22.x');
  assert.equal(pkg.scripts.build, 'vite build');
});

test('build preflight requires the v8.7 remediation engine and regression test', () => {
  const source = read('tools/calloria-build-preflight.mjs');
  assert.match(source, /verify:workforce-cloud-remediation/);
  assert.match(source, /js\/workforce-trend-cloud-remediation-engine-v807\.js/);
  assert.match(source, /tests\/workforce-trend-cloud-remediation-v807\.test\.mjs/);
});

test('central v8 integration audit enforces the v8.7 module, version guard and recovery controls', () => {
  const source = read('tools/calloria-v8-integration-audit.mjs');
  assert.match(source, /verify:workforce-cloud-remediation/);
  assert.match(source, /workforce-trend-cloud-remediation-engine-v807\.js/);
  assert.match(source, /data-workforce-cloud-remediation-copy/);
  assert.match(source, /data-workforce-cloud-refresh-session/);
  assert.match(source, /WORKFORCE_TREND_CLOUD_REMEDIATION_VERSION_V807/);
});

test('v8.7 plugin renders deterministic recovery guidance and only refreshes sessions on explicit user action', () => {
  const source = read('build/calloria-workforce-trend-cloud-sync-v801.mjs');
  assert.match(source, /from '..\/js\/workforce-trend-cloud-remediation-engine-v807\.js'/);
  assert.match(source, /renderWorkforceTrendCloudRemediationV807\(report\)/);
  assert.match(source, /data-workforce-cloud-remediation/);
  assert.match(source, /data-workforce-cloud-remediation-copy/);
  assert.match(source, /data-workforce-cloud-refresh-session/);
  assert.match(source, /client\.auth\.refreshSession\(\)/);
  assert.match(source, /does not have workforce report access\|reports:read/);
  assert.match(source, /No database, employee or customer history records are changed automatically|no repair, database write, synchronisation or restore is performed automatically/i);
});

test('cloud recovery stylesheet supports compact phone layouts and keyboard focus through inherited button rules', () => {
  const css = read('styles/calloria-workforce-trend-cloud-sync-v801.css');
  assert.match(css, /\.wth-cloud-remediation-card\.is-blocked/);
  assert.match(css, /\.wth-cloud-remediation-steps/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(css, /\.wth-cloud-remediation-actions button \{ width: 100%; min-height: 46px; \}/);
});
