#!/usr/bin/env node
/**
 * CALLORIA v8.12.3 — cumulative recovery-chain integration gate.
 * Runs the v8.9–v8.12 regression suite and verifies the protected Vercel contract.
 * It is deliberately separate from prebuild/check so those protected scripts stay exact.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const expectedPrebuild = 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs';
const expectedCheck = 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs';
const tests = [
  'tests/workforce-trend-cloud-recovery-portability-v809.test.mjs',
  'tests/calloria-v89-recovery-portability-integration.test.mjs',
  'tests/workforce-trend-cloud-recovery-handover-v810.test.mjs',
  'tests/calloria-v810-recovery-handover-integration.test.mjs',
  'tests/workforce-trend-cloud-recovery-handover-v811.test.mjs',
  'tests/calloria-v811-recovery-handover-verification-integration.test.mjs',
  'tests/calloria-v8123-migration-neutrality.test.mjs',
  'tests/workforce-trend-cloud-recovery-handover-comparison-v812.test.mjs',
  'tests/calloria-v812-recovery-handover-comparison-integration.test.mjs',
  'tests/calloria-v812-recovery-integration.test.mjs'
];
const requiredFiles = [
  'build/calloria-workforce-cloud-recovery-portability-v809.mjs',
  'js/workforce-trend-cloud-recovery-portability-engine-v809.js',
  'js/workforce-trend-cloud-recovery-handover-engine-v810.js',
  'js/workforce-trend-cloud-recovery-handover-verification-engine-v811.js',
  'js/workforce-trend-cloud-recovery-handover-comparison-engine-v812.js',
  'styles/calloria-workforce-cloud-recovery-portability-v809.css',
  'tools/calloria-v89-recovery-portability-audit.mjs',
  'tools/calloria-v812-recovery-integration-audit.mjs',
  ...tests
];

const read = (relative) => {
  try { return fs.readFileSync(path.join(root, relative), 'utf8'); }
  catch { return ''; }
};
let pkg;
try { pkg = JSON.parse(read('package.json')); }
catch (error) { failures.push(`package.json cannot be parsed: ${error.message}`); }

for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`Required integrated file is missing: ${relative}`);
}
if (pkg) {
  if (pkg.private !== true || pkg.type !== 'module') failures.push('Package privacy or ES module contract changed.');
  if (pkg.engines?.node !== '22.x') failures.push('Node engine must remain 22.x.');
  if (pkg.scripts?.prebuild !== expectedPrebuild) failures.push('Protected prebuild command is not exact.');
  if (pkg.scripts?.check !== expectedCheck) failures.push('Protected check command is not exact.');
  if (pkg.scripts?.build !== 'vite build') failures.push('Build command must remain vite build.');
  if (pkg.scripts?.postbuild !== 'node tools/calloria-build-artifact-audit.mjs') failures.push('Postbuild artifact audit hook changed.');
  const exactScripts = {
    'verify:workforce-cloud-health': 'node --test tests/workforce-trend-cloud-health-v806.test.mjs',
    'verify:workforce-cloud-remediation': 'node --test tests/workforce-trend-cloud-remediation-v807.test.mjs',
    'verify:workforce-cloud-recovery-progress': 'node --test tests/workforce-trend-cloud-recovery-progress-v808.test.mjs',
    'verify:workforce-cloud-handover': 'node --test tests/workforce-trend-cloud-recovery-handover-v810.test.mjs tests/calloria-v810-recovery-handover-integration.test.mjs',
    'verify:workforce-cloud-handover-verification': 'node --test tests/workforce-trend-cloud-recovery-handover-v811.test.mjs tests/calloria-v811-recovery-handover-verification-integration.test.mjs',
    'verify:workforce-cloud-handover-comparison': 'node --test tests/workforce-trend-cloud-recovery-handover-comparison-v812.test.mjs tests/calloria-v812-recovery-handover-comparison-integration.test.mjs'
  };
  for (const [name, expected] of Object.entries(exactScripts)) {
    if (pkg.scripts?.[name] !== expected) failures.push(`Required npm script ${name} is missing or has changed.`);
  }
  if (!String(pkg.scripts?.['verify:workforce-cloud-recovery-portability'] || '').includes('node tools/calloria-v89-recovery-portability-audit.mjs')) {
    failures.push('The v8.9 audit must be attached to the dedicated portability verification script.');
  }
  if (!String(pkg.scripts?.test || '').includes('tests/*.test.mjs')) failures.push('The broad regression test glob was removed.');
  const pins = [
    ['dependencies', '@supabase/supabase-js', '2.119.0'],
    ['dependencies', 'three', '0.170.0'],
    ['devDependencies', 'esbuild', '0.25.12'],
    ['devDependencies', 'vite', '6.4.5']
  ];
  for (const [section, name, version] of pins) {
    if (pkg[section]?.[name] !== version) failures.push(`${section}.${name} must remain pinned to ${version}.`);
  }
  if (!String(pkg.scripts?.['verify:workforce-cloud-recovery-bundle'] || '').includes('calloria-v812-recovery-integration-audit.mjs')) {
    failures.push('The cumulative recovery-chain verification command is missing.');
  }
}

const vite = read('vite.config.js');
const pluginSource = read('build/calloria-workforce-cloud-recovery-portability-v809.mjs');
if (!vite.includes('calloriaWorkforceCloudRecoveryPortabilityPluginV809()')) failures.push('The v8.9–v8.12 shared UI plugin is not registered in Vite.');
if (vite.indexOf('calloriaWorkforceCloudRecoveryPortabilityPluginV809()') > vite.indexOf('calloriaProductionIntegrationGatePluginV8()')) failures.push('The recovery UI plugin must be registered before the production integration gate.');
if (!pluginSource.includes("name: 'calloria-workforce-cloud-recovery-portability-v8-9'")) failures.push('The shared Vite plugin name must remain stable across v8.9–v8.12.');
if (!pluginSource.includes("['tools/calloria-v812-recovery-integration-audit.mjs']") || !pluginSource.includes('buildStart()') || !pluginSource.includes("config.command === 'build'")) failures.push('Production Vite buildStart must execute the cumulative recovery-chain integration gate without running it in dev mode.')
for (const marker of [
  'CALLORIA_V809_WORKFORCE_CLOUD_RECOVERY_PORTABILITY',
  'CALLORIA_V810_WORKFORCE_CLOUD_RECOVERY_HANDOVER',
  'CALLORIA_V811_WORKFORCE_CLOUD_RECOVERY_HANDOVER_VERIFICATION',
  'CALLORIA_V812_WORKFORCE_CLOUD_RECOVERY_HANDOVER_COMPARISON'
]) if (!pluginSource.includes(marker)) failures.push(`The integrated plugin is missing marker ${marker}.`);

if (failures.length) {
  console.error(`CALLORIA v8.12.3 recovery integration audit failed (${failures.length} issue(s)):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('CALLORIA v8.12.3 static integration contract passed.');
  console.log('Running the cumulative v8.9–v8.12 regression suite…');
  const run = spawnSync(process.execPath, ['--test', ...tests], { cwd: root, encoding: 'utf8' });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error) {
    console.error(`Could not start regression suite: ${run.error.message}`);
    process.exitCode = 1;
  } else if (run.status !== 0) {
    console.error(`Cumulative regression suite exited with status ${run.status}.`);
    process.exitCode = run.status || 1;
  } else {
    console.log('Running the dedicated v8.9 portability audit…');
    const legacyAudit = spawnSync(process.execPath, ['tools/calloria-v89-recovery-portability-audit.mjs'], { cwd: root, encoding: 'utf8' });
    if (legacyAudit.stdout) process.stdout.write(legacyAudit.stdout);
    if (legacyAudit.stderr) process.stderr.write(legacyAudit.stderr);
    if (legacyAudit.error || legacyAudit.status !== 0) process.exitCode = legacyAudit.status || 1;
    else console.log('CALLORIA v8.12.3 cumulative recovery integration passed.');
  }
}
