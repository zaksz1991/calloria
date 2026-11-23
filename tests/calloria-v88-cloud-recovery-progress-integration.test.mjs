import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('v8.8 package command preserves the full test glob and exposes focused progress tests', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  assert.equal(pkg.scripts['verify:workforce-cloud-recovery-progress'], 'node --test tests/workforce-trend-cloud-recovery-progress-v808.test.mjs');
  assert.equal(pkg.engines.node, '22.x');
  assert.equal(pkg.scripts.build, 'vite build');
});

test('build preflight requires the v8.8 progress engine and test file', () => {
  const source = read('tools/calloria-build-preflight.mjs');
  assert.match(source, /verify:workforce-cloud-recovery-progress/);
  assert.match(source, /js\/workforce-trend-cloud-recovery-progress-engine-v808\.js/);
  assert.match(source, /tests\/workforce-trend-cloud-recovery-progress-v808\.test\.mjs/);
});

test('central integration audit enforces v8.8 engine, version guard and checklist interactions', () => {
  const source = read('tools/calloria-v8-integration-audit.mjs');
  assert.match(source, /verify:workforce-cloud-recovery-progress/);
  assert.match(source, /workforce-trend-cloud-recovery-progress-engine-v808\.js/);
  assert.match(source, /WORKFORCE_TREND_CLOUD_RECOVERY_PROGRESS_VERSION_V808/);
  assert.match(source, /data-workforce-cloud-recovery-step/);
  assert.match(source, /data-workforce-cloud-recovery-reset/);
});

test('cloud plugin scopes local progress by an opaque organisation namespace and uses explicit checklist controls', () => {
  const source = read('build/calloria-workforce-trend-cloud-sync-v801.mjs');
  assert.match(source, /buildWorkforceTrendRecoveryStorageKeyV808\(organizationId\)/);
  assert.match(source, /loadWorkforceTrendRecoveryProgressV808\(window\.localStorage/);
  assert.match(source, /saveWorkforceTrendRecoveryProgressV808\(window\.localStorage/);
  assert.match(source, /data-workforce-cloud-recovery-step/);
  assert.match(source, /data-workforce-cloud-recovery-reset/);
  assert.match(source, /verification is still pending/);
  assert.match(source, /rerun the read-only health check to verify recovery/i);
});

test('recovery stylesheet has phone layouts and visible keyboard focus for checklist controls', () => {
  const css = read('styles/calloria-workforce-trend-cloud-sync-v801.css');
  assert.match(css, /\.wth-cloud-remediation-step-label/);
  assert.match(css, /\.wth-cloud-remediation-step-label:focus-within/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test('checklist retains in-memory state when local storage is unavailable and resets only on organisation change', () => {
  const source = read('build/calloria-workforce-trend-cloud-sync-v801.mjs');
  assert.match(source, /__CALLORIA_V808_CLOUD_RECOVERY_ACTIVE_KEY__ !== storageKey/);
  assert.match(source, /normaliseWorkforceTrendRecoveryProgressV808\(window\.__CALLORIA_V808_CLOUD_RECOVERY_PROGRESS__/);
  assert.match(source, /Checklist progress is active for this session, but browser storage is unavailable/);
});
