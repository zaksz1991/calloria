import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { calloriaWorkforceCloudRecoveryPortabilityPluginV809 } from '../build/calloria-workforce-cloud-recovery-portability-v809.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const plugin = calloriaWorkforceCloudRecoveryPortabilityPluginV809();
const fixture = `/* CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS */\nexport const calloriaFixture = true;`;

test('v8.11 injects local report verification while preserving earlier recovery controls', () => {
  const result = plugin.transform(fixture, '/repo/js/main.js');
  assert.equal(typeof result, 'string');
  assert.match(result, /workforce-trend-cloud-recovery-handover-engine-v810\.js/);
  assert.match(result, /workforce-trend-cloud-recovery-handover-verification-engine-v811\.js/);
  assert.match(result, /data-workforce-cloud-recovery-handover-verify/);
  assert.match(result, /data-workforce-cloud-recovery-handover-file/);
  assert.match(result, /data-workforce-cloud-progress-export/);
  assert.match(result, /data-workforce-cloud-progress-import/);
  assert.match(result, /No data was imported, uploaded or changed/);
});

test('v8.11 transformed module parses and plugin remains path-scoped and idempotent', () => {
  const result = plugin.transform(fixture, '/repo/js/main.js');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', '--input-type=module'], { input: result, stdio: ['pipe', 'pipe', 'pipe'] }));
  assert.equal(plugin.transform(fixture, '/repo/js/other.js'), null);
  assert.equal(plugin.transform('export const unrelated = true;', '/repo/js/main.js'), null);
  assert.equal(plugin.transform(result, '/repo/js/main.js'), null);
});

test('v8.9.2 Vercel hooks, v8.6 health check, v8.10 handover and dependency pins remain intact', () => {
  assert.equal(packageJson.scripts.prebuild, 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(packageJson.scripts.check, 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-health'], 'node --test tests/workforce-trend-cloud-health-v806.test.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-handover'], 'node --test tests/workforce-trend-cloud-recovery-handover-v810.test.mjs tests/calloria-v810-recovery-handover-integration.test.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-handover-verification'], 'node --test tests/workforce-trend-cloud-recovery-handover-v811.test.mjs tests/calloria-v811-recovery-handover-verification-integration.test.mjs');
  assert.equal(packageJson.engines.node, '22.x');
  assert.equal(packageJson.dependencies['@supabase/supabase-js'], '2.119.0');
  assert.equal(packageJson.dependencies.three, '0.170.0');
  assert.equal(packageJson.devDependencies.vite, '6.4.5');
  assert.equal(packageJson.devDependencies.esbuild, '0.25.12');
});

test('verifier is local-only, bounded and does not add migrations or secrets', () => {
  const engine = fs.readFileSync(new URL('../js/workforce-trend-cloud-recovery-handover-verification-engine-v811.js', import.meta.url), 'utf8');
  const pluginSource = fs.readFileSync(new URL('../build/calloria-workforce-cloud-recovery-portability-v809.mjs', import.meta.url), 'utf8');
  assert.match(engine, /256 \* 1024/);
  assert.match(engine, /subtle\.digest\('SHA-256'/);
  assert.match(pluginSource, /verifyWorkforceTrendCloudRecoveryHandoverV811/);
  assert.doesNotMatch(pluginSource, /fetch\s*\(/);
  assert.equal(fs.existsSync(new URL('../supabase/migrations', import.meta.url)), false);
});
