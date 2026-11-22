#!/usr/bin/env node
/**
 * CALLORIA build manifest preflight.
 * Uses only Node.js built-ins so it can run during npm's preinstall lifecycle.
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
    prebuild: 'node tools/calloria-build-preflight.mjs --build',
    build: 'vite build',
    'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest'
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
    ['devDependencies', 'vite', '6.4.5']
  ];
  for (const [section, name, version] of requiredDependencies) {
    const actual = pkg[section]?.[name];
    if (actual !== version) {
      failures.push(`package.json must declare ${section}.${name} as ${version}; found ${actual ?? 'missing'}.`);
    }
  }

  if (pkg.engines?.node !== '22.x') {
    failures.push('package.json engines.node must be "22.x" to keep Vercel on the validated Node 22 major.');
  }

  const nvmrcPath = path.join(root, '.nvmrc');
  if (fs.existsSync(nvmrcPath)) {
    const nvmrc = fs.readFileSync(nvmrcPath, 'utf8').trim();
    const engineMajor = String(pkg.engines?.node ?? '').match(/^(\d+)/)?.[1];
    const nvmMajor = nvmrc.match(/^(\d+)/)?.[1];
    if (engineMajor && nvmMajor && engineMajor !== nvmMajor) {
      failures.push(`.nvmrc selects Node ${nvmrc}, but package.json engines.node selects ${pkg.engines.node}.`);
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

  // The current Vite config declares HTML/JS entries through resolve(process.cwd(), '...').
  const entryPattern = /resolve\(process\.cwd\(\),\s*['"]([^'"]+)['"]\)/g;
  const entries = [...viteConfig.matchAll(entryPattern)].map((match) => match[1]);
  if (entries.length === 0) {
    failures.push('vite.config.js contains no recognised Rollup entry points; inspect the build configuration.');
  }
  for (const entry of entries) requireFile(entry, 'Vite/Rollup build entry point');
}

if (mode === 'build') {
  for (const dependencyPath of [
    'node_modules/vite/package.json',
    'node_modules/three/package.json',
    'node_modules/@supabase/supabase-js/package.json'
  ]) {
    requireFile(dependencyPath, 'required installed package before production build');
  }
}

if (mode === 'install') {
  const runtimeMajor = Number(process.versions.node.split('.')[0]);
  if (runtimeMajor !== 22) {
    failures.push(`Install is running on Node ${process.versions.node}; CALLORIA is pinned to Node 22.x. Select Node 22.x in the deployment settings.`);
  }
}

if (failures.length) {
  console.error(`CALLORIA ${mode} preflight failed (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  console.error('Restore the complete CALLORIA package.json and the missing source files before retrying the deployment.');
  process.exitCode = 1;
} else {
  console.log(`CALLORIA ${mode} preflight passed: package scripts, runtime pin, direct dependencies, Vite plugin imports and ${mode === 'build' ? 'installed build dependencies' : 'build entry points'} are consistent.`);
}

