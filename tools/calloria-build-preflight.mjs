#!/usr/bin/env node
/**
 * CALLORIA production build preflight.
 * Node built-ins only: safe to run from npm's preinstall lifecycle.
 * v7.04 also requires strict npm lifecycle-script policy and the resilient
 * third-person world transform used by the current Vite configuration.
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
    build: 'vite build',
    postbuild: 'node tools/calloria-build-artifact-audit.mjs',
    'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest',
    'verify:build-artifacts': 'node tools/calloria-build-artifact-audit.mjs',
    'verify:navigation': 'node tools/calloria-navigation-integrity-audit.mjs',
    check: 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs',
    prebuild: 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs'
  };
  for (const [name, expected] of Object.entries(expectedScripts)) {
    if (pkg.scripts?.[name] !== expected) {
      failures.push(`package.json script "${name}" must be exactly: ${expected}`);
    }
  }

  for (const name of ['dev', 'preview', 'check', 'test']) {
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

  // npm 11 blocks unapproved dependency lifecycle scripts. esbuild's postinstall
  // prepares its platform binary and was explicitly reported as skipped by Vercel.
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

  // Every relative import in vite.config.js must resolve before Vite is launched.
  const importPattern = /\bfrom\s*['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const match of viteConfig.matchAll(importPattern)) {
    const specifier = match[1];
    const relativePath = path.resolve(path.dirname(viteConfigPath), specifier);
    if (!fs.existsSync(relativePath)) {
      failures.push(`vite.config.js imports missing local module: ${path.relative(root, relativePath).replaceAll('\\', '/')}`);
    }
  }

  // The current Vite config declares its HTML/JS entries through process.cwd().
  const entryPattern = /resolve\(process\.cwd\(\),\s*['"]([^'"]+)['"]\)/g;
  const entries = [...viteConfig.matchAll(entryPattern)].map((match) => match[1]);
  if (entries.length === 0) {
    failures.push('vite.config.js contains no recognised Rollup entry points; inspect the build configuration.');
  }
  for (const entry of entries) requireFile(entry, 'Vite/Rollup build entry point');
}

requireFile('tools/calloria-build-artifact-audit.mjs', 'post-build artifact audit');
requireFile('tools/calloria-navigation-integrity-audit.mjs', 'pre-build route and application-view audit');
requireFile('build/calloria-third-person-player-plugin.mjs', 'resilient optional player-avatar transform');
requireFile('.github/workflows/calloria-production-build.yml', 'GitHub Actions production build gate');
requireFile('.npmrc', 'strict dependency install-script policy');
requireFile('vercel.json', 'Vercel build/output contract');
const vercelConfig = readJson('vercel.json');
if (vercelConfig) {
  const expectedVercel = {
    installCommand: 'npm install',
    buildCommand: 'npm run build',
    outputDirectory: 'dist'
  };
  for (const [key, expected] of Object.entries(expectedVercel)) {
    if (vercelConfig[key] !== expected) {
      failures.push(`vercel.json ${key} must be "${expected}"; found ${vercelConfig[key] ?? 'missing'}.`);
    }
  }
}

const npmrcPath = path.join(root, '.npmrc');
if (fs.existsSync(npmrcPath)) {
  const npmrc = fs.readFileSync(npmrcPath, 'utf8');
  if (!/^\s*strict-allow-scripts\s*=\s*true\s*$/m.test(npmrc)) {
    failures.push('.npmrc must set strict-allow-scripts=true so unreviewed dependency lifecycle scripts cannot run silently.');
  }
}

const thirdPersonPluginPath = path.join(root, 'build/calloria-third-person-player-plugin.mjs');
if (fs.existsSync(thirdPersonPluginPath)) {
  const thirdPersonPlugin = fs.readFileSync(thirdPersonPluginPath, 'utf8');
  if (!thirdPersonPlugin.includes('__CALLORIA_THIRD_PERSON_PLAYER_V26__')
      || !thirdPersonPlugin.includes('context.warn?.(')
      || !thirdPersonPlugin.includes("enforce: 'post'")
      || thirdPersonPlugin.includes('context.error(')) {
    failures.push('Third-person player plugin must preserve its post-transform ordering and use the v7.04 safe-skip contract; source drift must not abort the Vite build.');
  }
}

if (mode === 'build') {
  const installedPackages = [
    ['vite', '6.4.5'],
    ['three', '0.170.0'],
    ['@supabase/supabase-js', '2.119.0'],
    ['esbuild', '0.25.12']
  ];
  for (const [name, expectedVersion] of installedPackages) {
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
  if (runtimeMajor !== 22) {
    failures.push(`Install is running on Node ${process.versions.node}; CALLORIA is pinned to Node 22.x.`);
  }
  if (String(process.env.npm_config_ignore_scripts || '').toLowerCase() === 'true') {
    failures.push('npm_config_ignore_scripts=true prevents CALLORIA install safeguards and the approved esbuild setup from running.');
  }
}

if (failures.length) {
  console.error(`CALLORIA ${mode} preflight failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('Apply the complete v7.04 package/build repair and restore missing repository source files before retrying.');
  process.exitCode = 1;
} else {
  console.log(`CALLORIA ${mode} preflight passed: manifest, Node 22 pin, Vite plugin imports, Rollup entries${mode === 'build' ? ', and installed package versions' : ''}, npm esbuild approval, strict install-script policy and resilient world transform are consistent.`);
  for (const warning of warnings) console.warn(`CALLORIA ${mode} preflight warning: ${warning}`);
}
