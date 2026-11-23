import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { calloriaWorkforceCloudRecoveryPortabilityPluginV809 } from '../build/calloria-workforce-cloud-recovery-portability-v809.mjs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the Vite build lifecycle runs the cumulative recovery integration gate', () => {
  const plugin = calloriaWorkforceCloudRecoveryPortabilityPluginV809();
  assert.equal(plugin.name, 'calloria-workforce-cloud-recovery-portability-v8-9');
  assert.equal(typeof plugin.configResolved, 'function');
  assert.equal(typeof plugin.buildStart, 'function');
  assert.match(read('build/calloria-workforce-cloud-recovery-portability-v809.mjs'), /config\.command === 'build'/);
  const source = read('build/calloria-workforce-cloud-recovery-portability-v809.mjs');
  assert.match(source, /spawnSync\(/);
  assert.match(source, /tools\/calloria-v812-recovery-integration-audit\.mjs/);
  assert.match(source, /timeout:\s*120000/);
});

test('the cumulative audit covers v8.9 through v8.12 and preserves protected build hooks', () => {
  const audit = read('tools/calloria-v812-recovery-integration-audit.mjs');
  for (const marker of [
    'workforce-trend-cloud-recovery-portability-v809.test.mjs',
    'workforce-trend-cloud-recovery-handover-v810.test.mjs',
    'workforce-trend-cloud-recovery-handover-v811.test.mjs',
    'workforce-trend-cloud-recovery-handover-comparison-v812.test.mjs',
    'expectedPrebuild',
    'expectedCheck'
  ]) assert.ok(audit.includes(marker), `missing integration audit marker: ${marker}`);
  assert.doesNotMatch(audit, /supabase\/migrations|GROQ_API_KEY|service_role/i);
});
