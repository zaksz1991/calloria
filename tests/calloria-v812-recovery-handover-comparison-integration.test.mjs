import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { calloriaWorkforceCloudRecoveryPortabilityPluginV809 } from '../build/calloria-workforce-cloud-recovery-portability-v809.mjs';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const pluginSource = fs.readFileSync(new URL('../build/calloria-workforce-cloud-recovery-portability-v809.mjs', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../js/workforce-trend-cloud-recovery-handover-comparison-engine-v812.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../styles/calloria-workforce-cloud-recovery-portability-v809.css', import.meta.url), 'utf8');
const fixture = `/* CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS */\nexport const calloriaFixture = true;`;

test('v8.12 plugin integrates the two-file comparison control and v8.12 engine', () => {
  const transformed = calloriaWorkforceCloudRecoveryPortabilityPluginV809().transform(fixture, '/repo/js/main.js');
  assert.equal(typeof transformed, 'string');
  assert.match(transformed, /workforce-trend-cloud-recovery-handover-comparison-engine-v812\.js/);
  assert.match(transformed, /data-workforce-cloud-recovery-handover-compare/);
  assert.match(transformed, /data-workforce-cloud-recovery-handover-compare-file/);
  assert.match(transformed, /multiple = true/);
  assert.match(transformed, /Both handover checksums passed/);
  assert.match(transformed, /Confirm both reports belong to the same organisation/);
  assert.match(transformed, /No data was imported, uploaded or changed/);
});

test('transformed main module parses and the plugin is path-scoped and idempotent', () => {
  const plugin = calloriaWorkforceCloudRecoveryPortabilityPluginV809();
  const transformed = plugin.transform(fixture, '/repo/js/main.js');
  assert.doesNotThrow(() => execFileSync(process.execPath, ['--check', '--input-type=module'], { input: transformed, stdio: ['pipe', 'pipe', 'pipe'] }));
  assert.equal(plugin.transform(fixture, '/repo/js/other.js'), null);
  assert.equal(plugin.transform('export const unrelated = true;', '/repo/js/main.js'), null);
  assert.equal(plugin.transform(transformed, '/repo/js/main.js'), null);
});

test('protected Vercel hooks, previous cloud verification scripts and dependency pins remain unchanged', () => {
  assert.equal(packageJson.scripts.prebuild, 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(packageJson.scripts.check, 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-health'], 'node --test tests/workforce-trend-cloud-health-v806.test.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-handover'], 'node --test tests/workforce-trend-cloud-recovery-handover-v810.test.mjs tests/calloria-v810-recovery-handover-integration.test.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-handover-verification'], 'node --test tests/workforce-trend-cloud-recovery-handover-v811.test.mjs tests/calloria-v811-recovery-handover-verification-integration.test.mjs');
  assert.equal(packageJson.scripts['verify:workforce-cloud-handover-comparison'], 'node --test tests/workforce-trend-cloud-recovery-handover-comparison-v812.test.mjs tests/calloria-v812-recovery-handover-comparison-integration.test.mjs');
  assert.equal(packageJson.engines.node, '22.x');
  assert.equal(packageJson.dependencies['@supabase/supabase-js'], '2.119.0');
  assert.equal(packageJson.dependencies.three, '0.170.0');
  assert.equal(packageJson.devDependencies.vite, '6.4.5');
  assert.equal(packageJson.devDependencies.esbuild, '0.25.12');
});

test('comparison is checksum-gated and contains no network or persistence path', () => {
  assert.match(engine, /verifyWorkforceTrendCloudRecoveryHandoverV811/);
  assert.match(engine, /Both checksums passed/);
  assert.match(engine, /do not identify an organisation/);
  assert.doesNotMatch(engine, /\bfetch\s*\(|localStorage|sessionStorage|document\.cookie/);
  assert.doesNotMatch(pluginSource, /\bfetch\s*\(/);
  assert.match(css, /@media \(max-width: 560px\)/);
});
