import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calloriaWorkforceCloudRecoveryPortabilityPluginV809 } from '../build/calloria-workforce-cloud-recovery-portability-v809.mjs';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const plugin = calloriaWorkforceCloudRecoveryPortabilityPluginV809();
const fixture = `/* CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS */\nexport const calloriaFixture = true;`;

test('v8.10 plugin adds handover export without replacing checklist portability controls', () => {
  const result = plugin.transform(fixture, '/repo/js/main.js');
  assert.equal(typeof result, 'string');
  assert.match(result, /workforce-trend-cloud-recovery-handover-engine-v810\.js/);
  assert.match(result, /data-workforce-cloud-recovery-handover/);
  assert.match(result, /data-workforce-cloud-progress-export/);
  assert.match(result, /data-workforce-cloud-progress-import/);
  assert.match(result, /not proof that repairs succeeded/i);
});

test('v8.10 plugin is path-scoped and idempotent', () => {
  assert.equal(plugin.transform(fixture, '/repo/js/other.js'), null);
  assert.equal(plugin.transform('export const unrelated = true;', '/repo/js/main.js'), null);
  const first = plugin.transform(fixture, '/repo/js/main.js');
  assert.equal(plugin.transform(first, '/repo/js/main.js'), null);
});

test('v8.9.2 cloud-health recovery and exact Vercel hooks remain preserved', () => {
  assert.equal(pkg.scripts?.['verify:workforce-cloud-health'], 'node --test tests/workforce-trend-cloud-health-v806.test.mjs');
  assert.equal(pkg.scripts?.prebuild, 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(pkg.scripts?.check, 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs');
  assert.equal(pkg.scripts?.['verify:workforce-cloud-handover'], 'node --test tests/workforce-trend-cloud-recovery-handover-v810.test.mjs tests/calloria-v810-recovery-handover-integration.test.mjs');
  assert.equal(pkg.engines?.node, '22.x');
  assert.equal(pkg.dependencies?.['@supabase/supabase-js'], '2.119.0');
  assert.equal(pkg.dependencies?.three, '0.170.0');
  assert.equal(pkg.devDependencies?.vite, '6.4.5');
  assert.equal(pkg.devDependencies?.esbuild, '0.25.12');
});
