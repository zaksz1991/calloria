import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const guardSource = path.resolve(here, '../tools/calloria-build-preflight.mjs');
const node = process.execPath;

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-preflight-'));
  const dirs = ['tools', 'build', 'widgets', 'node_modules/vite', 'node_modules/three', 'node_modules/@supabase/supabase-js', 'node_modules/esbuild'];
  for (const dir of dirs) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const pkg = {
    private: true,
    type: 'module',
    engines: { node: '22.x' },
    scripts: {
      preinstall: 'node tools/calloria-build-preflight.mjs --install',
      prebuild: 'node tools/calloria-build-preflight.mjs --build',
      build: 'vite build',
      postbuild: 'node tools/calloria-build-artifact-audit.mjs',
      dev: 'vite --host 0.0.0.0',
      preview: 'vite preview --host 0.0.0.0',
      check: 'node tools/calloria-build-preflight.mjs --manifest',
      test: 'node --test tests/*.test.mjs tests/commitment-engine-v69.test.cjs',
      'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest',
      'verify:build-artifacts': 'node tools/calloria-build-artifact-audit.mjs'
    },
    dependencies: { '@supabase/supabase-js': '2.119.0', three: '0.170.0' },
    devDependencies: { esbuild: '0.25.12', vite: '6.4.5' },
    allowScripts: { 'esbuild@0.25.12': true }
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(root, '.nvmrc'), '22\n');
  fs.writeFileSync(path.join(root, 'tools/calloria-build-preflight.mjs'), fs.readFileSync(guardSource));
  fs.writeFileSync(path.join(root, 'tools/calloria-build-artifact-audit.mjs'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify({ installCommand: 'npm install', buildCommand: 'npm run build', outputDirectory: 'dist' }));
  fs.writeFileSync(path.join(root, 'build/plugin.js'), 'export default {};\n');
  fs.writeFileSync(path.join(root, 'widgets/chat.js'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(root, 'vite.config.js'), [
    "import { defineConfig } from 'vite';",
    "import plugin from './build/plugin.js';",
    "export default defineConfig({ plugins: [plugin], build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), widget: resolve(process.cwd(), 'widgets/chat.js') } } } });"
  ].join('\n'));
  for (const [dependency, version] of [['vite', '6.4.5'], ['three', '0.170.0'], ['@supabase/supabase-js', '2.119.0'], ['esbuild', '0.25.12']]) {
    const target = path.join(root, `node_modules/${dependency}/package.json`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify({ name: dependency, version }));
  }
  return { root, pkg };
}

function run(root, mode = '--manifest') {
  return spawnSync(node, [guardSource, mode], { cwd: root, encoding: 'utf8' });
}

function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

test('accepts a complete manifest, Vite imports and all build entries', () => {
  const { root } = fixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /preflight passed/);
  } finally { cleanup(root); }
});

test('rejects a manifest that has lost the Vite build script', () => {
  const { root, pkg } = fixture();
  try {
    delete pkg.scripts.build;
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /script "build"/);
  } finally { cleanup(root); }
});

test('rejects missing Three.js or Supabase dependency declarations', () => {
  const { root, pkg } = fixture();
  try {
    delete pkg.dependencies.three;
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /dependencies\.three/);
  } finally { cleanup(root); }
});

test('rejects a missing local Vite plugin import', () => {
  const { root } = fixture();
  try {
    fs.writeFileSync(path.join(root, 'vite.config.js'), "import plugin from './build/missing-plugin.js';\nexport default {};\n");
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /imports missing local module/);
  } finally { cleanup(root); }
});

test('rejects a missing multi-page build entry', () => {
  const { root } = fixture();
  try {
    fs.writeFileSync(path.join(root, 'vite.config.js'), "export default { build: { rollupOptions: { input: resolve(process.cwd(), 'missing.html') } } };\n");
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Missing missing\.html/);
  } finally { cleanup(root); }
});

test('build-mode additionally requires the installed production dependencies', () => {
  const { root } = fixture();
  try {
    fs.rmSync(path.join(root, 'node_modules/three/package.json'));
    const result = run(root, '--build');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /node_modules\/three\/package\.json/);
  } finally { cleanup(root); }
});
