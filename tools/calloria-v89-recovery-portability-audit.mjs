#!/usr/bin/env node
/** CALLORIA v8.9 release gate for checklist backup portability. */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'build/calloria-workforce-cloud-recovery-portability-v809.mjs',
  'js/workforce-trend-cloud-recovery-portability-engine-v809.js',
  'styles/calloria-workforce-cloud-recovery-portability-v809.css',
  'tests/workforce-trend-cloud-recovery-portability-v809.test.mjs',
  'tests/calloria-v89-recovery-portability-integration.test.mjs'
];
const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required v8.9 file: ${file}`);
}
function read(file) {
  try { return fs.readFileSync(path.join(root, file), 'utf8'); }
  catch { return ''; }
}
const vite = read('vite.config.js');
const plugin = read('build/calloria-workforce-cloud-recovery-portability-v809.mjs');
const engine = read('js/workforce-trend-cloud-recovery-portability-engine-v809.js');
const pkg = JSON.parse(read('package.json') || '{}');
if (!vite.includes("calloriaWorkforceCloudRecoveryPortabilityPluginV809")) failures.push('Vite configuration does not register the v8.9 portability plugin.');
if (!vite.includes("...calloriaWorkforceDevelopmentSuitePluginsV8()") || !vite.includes('calloriaProductionIntegrationGatePluginV8()')) failures.push('The existing workforce suite or production integration gate registration is missing.');
if (!plugin.includes("enforce: 'post'")) failures.push('The v8.9 plugin must run after the v8.8 recovery checklist transform.');
if (!plugin.includes('CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS') || !plugin.includes('WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809')) failures.push('The v8.9 plugin marker or engine integration is missing.');
if (!engine.includes("WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809 = '8.9.0'")) failures.push('The v8.9 engine version guard is missing.');
if (!engine.includes('SHA-256') || !engine.includes('organisationScopeKey')) failures.push('The organisation-scoped integrity contract is missing.');
if (pkg.scripts?.['verify:workforce-cloud-recovery-portability'] !== 'node --test tests/workforce-trend-cloud-recovery-portability-v809.test.mjs tests/calloria-v89-recovery-portability-integration.test.mjs') failures.push('The focused v8.9 verification command is missing.');
if (!String(pkg.scripts?.test || '').includes('tests/*.test.mjs')) failures.push('The full test glob was not preserved.');
if (!String(pkg.scripts?.prebuild || '').includes('calloria-v89-recovery-portability-audit.mjs')) failures.push('The v8.9 audit is not part of the Vercel prebuild gate.');
if (failures.length) {
  console.error('CALLORIA v8.9 recovery portability audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`CALLORIA v8.9 recovery portability audit passed (${required.length} required files checked).`);
}
