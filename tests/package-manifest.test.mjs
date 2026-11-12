import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('manifest identifies the CALLORIA 0.3.0 application', () => {
  assert.equal(manifest.name, 'calloria-contact-centre-simulator');
  assert.equal(manifest.version, '0.3.0');
  assert.equal(manifest.type, 'module');
});

test('Vercel production build script is present and invokes Vite', () => {
  assert.equal(manifest.scripts.build, 'vite build');
});

test('development and preview scripts are preserved', () => {
  assert.equal(manifest.scripts.dev, 'vite --host 0.0.0.0');
  assert.equal(manifest.scripts.preview, 'vite preview --host 0.0.0.0');
});

test('check and test scripts are present', () => {
  assert.equal(manifest.scripts.check, 'node --check js/main.js && node --check js/production-world.js');
  assert.equal(manifest.scripts.test, 'node --test tests/*.test.mjs');
});

test('toolchain matches the current CALLORIA build log', () => {
  assert.equal(manifest.engines.node, '>=22.12.0');
  assert.equal(manifest.devDependencies.vite, '6.4.5');
  assert.equal(manifest.dependencies.three, '0.170.0');
});
