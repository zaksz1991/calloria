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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-npm-script-policy-'));
  for (const dir of ['tools', 'build', '.github/workflows', 'widgets', 'node_modules/vite', 'node_modules/three', 'node_modules/@supabase/supabase-js', 'node_modules/esbuild']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  const pkg = {
    private: true,
    type: 'module',
    engines: { node: '22.x' },
    scripts: {
      preinstall: 'node tools/calloria-build-preflight.mjs --install',
      prebuild: 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs',
      build: 'vite build',
      postbuild: 'node tools/calloria-build-artifact-audit.mjs',
      dev: 'vite --host 0.0.0.0',
      preview: 'vite preview --host 0.0.0.0',
      check: 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs',
      test: 'node --test tests/*.test.mjs tests/commitment-engine-v69.test.cjs',
      'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest',
      'verify:build-artifacts': 'node tools/calloria-build-artifact-audit.mjs',
      'verify:navigation': 'node tools/calloria-navigation-integrity-audit.mjs'
    },
    dependencies: { '@supabase/supabase-js': '2.119.0', three: '0.170.0' },
    devDependencies: { esbuild: '0.25.12', vite: '6.4.5' },
    allowScripts: { 'esbuild@0.25.12': true }
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg, null, 2));
  fs.writeFileSync(path.join(root, '.nvmrc'), '22.16.0\n');
  fs.writeFileSync(path.join(root, 'tools/calloria-build-preflight.mjs'), fs.readFileSync(guardSource));
  fs.writeFileSync(path.join(root, 'tools/calloria-build-artifact-audit.mjs'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'tools/calloria-navigation-integrity-audit.mjs'), 'export {};\n');
  fs.writeFileSync(path.join(root, '.npmrc'), 'strict-allow-scripts=true\n');
  fs.writeFileSync(path.join(root, '.github/workflows/calloria-production-build.yml'), 'name: CALLORIA production build\n');
  fs.writeFileSync(path.join(root, 'build/calloria-third-person-player-plugin.mjs'), "const marker = '__CALLORIA_THIRD_PERSON_PLAYER_V26__';\nconst plugin = { enforce: 'post' };\nconst warn = context.warn?.('safe skip');\nexport { marker, plugin, warn };\n");
  fs.writeFileSync(path.join(root, 'build/plugin.js'), 'export default {};\n');
  fs.writeFileSync(path.join(root, 'widgets/calloria-chat.js'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html>');
  fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify({ installCommand: 'npm install', buildCommand: 'npm run build', outputDirectory: 'dist' }));
  for (const [dependency, version] of [['vite', '6.4.5'], ['three', '0.170.0'], ['@supabase/supabase-js', '2.119.0'], ['esbuild', '0.25.12']]) {
    fs.writeFileSync(path.join(root, `node_modules/${dependency}/package.json`), JSON.stringify({ name: dependency, version }));
  }
  fs.writeFileSync(path.join(root, 'vite.config.js'), [
    "import { defineConfig } from 'vite';",
    "import plugin from './build/plugin.js';",
    "export default defineConfig({ plugins: [plugin], build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), widget: resolve(process.cwd(), 'widgets/calloria-chat.js') } } } });"
  ].join('\n'));
  return { root, pkg };
}

function run(root, mode = '--manifest', env = {}) {
  return spawnSync(node, [guardSource, mode], { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } });
}
function cleanup(root) { fs.rmSync(root, { recursive: true, force: true }); }

test('accepts the version-pinned esbuild lifecycle approval', () => {
  const { root } = fixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /npm esbuild approval, strict install-script policy and resilient world transform are consistent/);
  } finally { cleanup(root); }
});

test('rejects an omitted esbuild lifecycle approval', () => {
  const { root, pkg } = fixture();
  try {
    delete pkg.allowScripts['esbuild@0.25.12'];
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must explicitly approve "esbuild@0.25.12"/);
  } finally { cleanup(root); }
});

test('rejects a stale esbuild version approval', () => {
  const { root, pkg } = fixture();
  try {
    pkg.allowScripts['esbuild@0.25.11'] = true;
    delete pkg.allowScripts['esbuild@0.25.12'];
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /esbuild@0.25.12/);
  } finally { cleanup(root); }
});

test('rejects removal of the direct esbuild dependency pin', () => {
  const { root, pkg } = fixture();
  try {
    delete pkg.devDependencies.esbuild;
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
    const result = run(root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /devDependencies\.esbuild as 0\.25\.12/);
  } finally { cleanup(root); }
});

test('install mode rejects npm installs that explicitly ignore lifecycle scripts', () => {
  const { root } = fixture();
  try {
    const result = run(root, '--install', { npm_config_ignore_scripts: 'true' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /prevents CALLORIA install safeguards/);
  } finally { cleanup(root); }
});


test('build mode accepts the exact installed dependency versions', () => {
  const { root } = fixture();
  try {
    const result = run(root, '--build');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /installed package versions/);
  } finally { cleanup(root); }
});

test('build mode rejects an esbuild binary version that differs from the package pin', () => {
  const { root } = fixture();
  try {
    fs.writeFileSync(path.join(root, 'node_modules/esbuild/package.json'), JSON.stringify({ name: 'esbuild', version: '0.25.11' }));
    const result = run(root, '--build');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /esbuild installed version must be 0\.25\.12/);
  } finally { cleanup(root); }
});
