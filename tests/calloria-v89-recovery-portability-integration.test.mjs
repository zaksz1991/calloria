import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calloriaWorkforceCloudRecoveryPortabilityPluginV809 } from '../build/calloria-workforce-cloud-recovery-portability-v809.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('v8.9 plugin runs after the v8.8 transform and skips unrelated modules', () => {
  const plugin = calloriaWorkforceCloudRecoveryPortabilityPluginV809();
  assert.equal(plugin.name, 'calloria-workforce-cloud-recovery-portability-v8-9');
  assert.equal(plugin.enforce, 'post');
  assert.equal(typeof plugin.buildStart, 'function', 'Vite build must invoke the cumulative recovery integration gate.');
  assert.equal(plugin.transform('export const untouched = true;', '/repo/js/other.js'), null);
  assert.equal(plugin.transform('/* no cloud marker */', '/repo/js/main.js'), null);
  const transformed = plugin.transform('/* CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS */\nexport const app = true;', '/repo/js/main.js?v=9');
  assert.match(transformed, /workforce-trend-cloud-recovery-portability-engine-v809\.js/);
  assert.match(transformed, /calloria-workforce-cloud-recovery-portability-v809\.css/);
  assert.match(transformed, /CALLORIA_V809_WORKFORCE_CLOUD_RECOVERY_PORTABILITY/);
  assert.match(transformed, /data-workforce-cloud-progress-export/);
  assert.match(transformed, /data-workforce-cloud-progress-import/);
  assert.match(transformed, /SHA-256/);
});

test('Vite preserves the existing suite and registers v8.9 before the production integration gate', () => {
  const source = read('vite.config.js');
  const portability = source.indexOf('calloriaWorkforceCloudRecoveryPortabilityPluginV809()');
  const gate = source.indexOf('calloriaProductionIntegrationGatePluginV8()');
  assert.ok(source.includes("...calloriaWorkforceDevelopmentSuitePluginsV8()"));
  assert.ok(portability > -1 && gate > portability);
});

test('package retains protected Vercel hooks, Node 22, pinned dependencies and the focused v8.9 audit command', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.engines.node, '22.x');
  assert.equal(pkg.dependencies.three, '0.170.0');
  assert.equal(pkg.dependencies['@supabase/supabase-js'], '2.119.0');
  assert.match(pkg.scripts.test, /tests\/\*\.test\.mjs/);
  assert.equal(pkg.scripts.prebuild, 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.match(pkg.scripts['verify:workforce-cloud-recovery-portability'], /calloria-v89-recovery-portability-audit\.mjs/);
  assert.match(pkg.scripts['verify:workforce-cloud-recovery-portability'], /workforce-trend-cloud-recovery-portability-v809\.test\.mjs/);
});
