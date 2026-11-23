#!/usr/bin/env node
/**
 * CALLORIA production build preflight.
 * Node built-ins only: safe to run from npm's preinstall lifecycle.
 * v8.0 adds the ordered integration audit to prebuild and preserves v7.03 npm 11 safeguards.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const mode = process.argv.includes('--install')
  ? 'install'
  : process.argv.includes('--build')
    ? 'build'
    : 'manifest';
const failures = [];
const warnings = [];
const EXPECTED_PREBUILD = 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs';
function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: could not be read as valid JSON (${error.message})`);
    return null;
  }
}
function requireFile(relativePath, reason) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    failures.push(`Missing ${relativePath}${reason ? ` (${reason})` : ''}`);
  }
}
const pkg = readJson('package.json');
if (pkg) {
  if (pkg.private !== true) failures.push('package.json must set "private": true.');
  if (pkg.type !== 'module') failures.push('package.json must set "type": "module".');
  const expectedScripts = {
    preinstall: 'node tools/calloria-build-preflight.mjs --install',
    prebuild: EXPECTED_PREBUILD,
    build: 'vite build',
    postbuild: 'node tools/calloria-build-artifact-audit.mjs',
    'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest',
    'verify:build-artifacts': 'node tools/calloria-build-artifact-audit.mjs',
    'verify:integration': 'node tools/calloria-v8-integration-audit.mjs',
    'verify:workforce-backup': 'node --test tests/workforce-trend-backup-v805.test.mjs',
    check: 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs'
  };
  for (const [name, expected] of Object.entries(expectedScripts)) {
    if (pkg.scripts?.[name] !== expected) {
      failures.push(`package.json script "${name}" must be exactly: ${expected}`);
    }
  }
  for (const name of ['dev', 'preview', 'test', 'verify:navigation']) {
    if (typeof pkg.scripts?.[name] !== 'string' || !pkg.scripts[name].trim()) {
      failures.push(`package.json is missing the "${name}" script.`);
    }
  }
  const requiredDependencies = [
    ['dependencies', '@supabase/supabase-js', '2.119.0'],
    ['dependencies', 'three', '0.170.0'],
    ['devDependencies', 'esbuild', '0.25.12'],
    ['devDependencies', 'vite', '6.4.5']
  ];
  for (const [section, name, version] of requiredDependencies) {
    const actual = pkg[section]?.[name];
    if (actual !== version) {
      failures.push(`package.json must declare ${section}.${name} as ${version}; found ${actual ?? 'missing'}.`);
    }
  }
  if (pkg.allowScripts?.['esbuild@0.25.12'] !== true) {
    failures.push('package.json allowScripts must explicitly approve "esbuild@0.25.12": true.');
  }
  if (pkg.allowScripts?.esbuild === true) {
    warnings.push('A broad esbuild script approval is present; retain the version-pinned esbuild@0.25.12 entry.');
  }
  if (pkg.engines?.node !== '22.x') {
    failures.push('package.json engines.node must be "22.x" to keep Vercel on Node 22.');
  }
  const nvmrcPath = path.join(root, '.nvmrc');
  if (!fs.existsSync(nvmrcPath)) {
    failures.push('Missing .nvmrc (expected the repository Node 22 version pin).');
  } else {
    const nvmrc = fs.readFileSync(nvmrcPath, 'utf8').trim();
    const engineMajor = String(pkg.engines?.node ?? '').match(/^(\d+)/)?.[1];
    const nvmMajor = nvmrc.match(/^(\d+)/)?.[1];
    if (!nvmMajor || nvmMajor !== engineMajor) {
      failures.push(`.nvmrc (${nvmrc || 'empty'}) must match package.json engines.node (${pkg.engines?.node}).`);
    }
  }
}
const viteConfigPath = path.join(root, 'vite.config.js');
requireFile('vite.config.js', 'Vite production build configuration');
if (fs.existsSync(viteConfigPath)) {
  const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
  const importPattern = /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const match of viteConfig.matchAll(importPattern)) {
    const relativePath = path.resolve(path.dirname(viteConfigPath), match[1]);
    if (!fs.existsSync(relativePath)) {
      failures.push(`vite.config.js imports missing local module: ${path.relative(root, relativePath).replaceAll('\\', '/')}`);
    }
  }
  const entryPattern = /resolve\(process\.cwd\(\),\s*['"]([^'"]+)['"]\)/g;
  const entries = [...viteConfig.matchAll(entryPattern)].map((match) => match[1]);
  if (entries.length === 0) failures.push('vite.config.js contains no recognised Rollup entry points; inspect the build configuration.');
  for (const entry of entries) requireFile(entry, 'Vite/Rollup build entry point');
}
for (const file of [
  'tools/calloria-build-artifact-audit.mjs',
  'tools/calloria-navigation-integrity-audit.mjs',
  'tools/calloria-v8-integration-audit.mjs',
  'build/calloria-workforce-development-suite-v8.mjs',
  'build/calloria-production-integration-gate-v8.mjs',
  'build/calloria-workforce-trend-cloud-sync-v801.mjs',
  'js/workforce-trend-cloud-sync-engine-v801.js',
  'styles/calloria-workforce-trend-cloud-sync-v801.css',
  'supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql',
  'js/workforce-trend-cloud-sync-engine-v802.js',
  'supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql',
  'tests/workforce-trend-cloud-sync-v802.test.mjs',
  'js/workforce-trend-cloud-sync-engine-v803.js',
  'supabase/migrations/202611220003_calloria_workforce_trend_conflict_archive.sql',
  'tests/workforce-trend-cloud-sync-v803.test.mjs',
  'js/workforce-trend-backup-engine-v805.js',
  'tests/workforce-trend-backup-v805.test.mjs',
  'js/workforce-trend-cloud-health-engine-v806.js',
  'tests/workforce-trend-cloud-health-v806.test.mjs'
]) requireFile(file, 'CALLORIA v8.6 read-only workforce cloud diagnostics requirement');
if (mode === 'build') {
  for (const [name, expectedVersion] of [
    ['vite', '6.4.5'], ['three', '0.170.0'],
    ['@supabase/supabase-js', '2.119.0'], ['esbuild', '0.25.12']
  ]) {
    const packagePath = `node_modules/${name}/package.json`;
    requireFile(packagePath, 'required installed package before production build');
    if (fs.existsSync(path.join(root, packagePath))) {
      const installed = readJson(packagePath);
      if (installed && installed.version !== expectedVersion) {
        failures.push(`${name} installed version must be ${expectedVersion}; found ${installed.version ?? 'unknown'}.`);
      }
    }
  }
}
if (mode === 'install') {
  const runtimeMajor = Number(process.versions.node.split('.')[0]);
  if (runtimeMajor !== 22) failures.push(`Install is running on Node ${process.versions.node}; CALLORIA is pinned to Node 22.x.`);
  if (String(process.env.npm_config_ignore_scripts || '').toLowerCase() === 'true') {
    failures.push('npm_config_ignore_scripts=true prevents CALLORIA install safeguards and the approved esbuild setup from running.');
  }
}
if (failures.length) {
  console.error(`CALLORIA ${mode} preflight failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('Restore the complete source tree and exact Node 22/dependency contract before retrying.');
  process.exitCode = 1;
} else {
  console.log(`CALLORIA ${mode} preflight passed: manifest, Node 22 pin, Vite imports, Rollup entries, npm esbuild approval${mode === 'build' ? ', and installed package versions' : ''}.`);
  for (const warning of warnings) console.warn(`CALLORIA ${mode} preflight warning: ${warning}`);
}
