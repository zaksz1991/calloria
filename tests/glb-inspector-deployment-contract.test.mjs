import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const viteConfig = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const registry = await readFile(new URL('../js/glb-asset-registry.js', import.meta.url), 'utf8');

test('Vite copies CALLORIA public GLB assets into dist', () => {
  assert.match(viteConfig, /publicDir:\s*['"]public['"]/);
  assert.doesNotMatch(viteConfig, /publicDir:\s*false/);
});

test('Vite builds the standalone asset inspector page', () => {
  assert.match(viteConfig, /assetInspector:\s*resolve\(process\.cwd\(\),\s*['"]asset-inspector\.html['"]\)/);
});

test('asset registry contains the 16 repository models', () => {
  const modelPaths = [...registry.matchAll(/path:\s*['"]([^'"]+\.glb)['"]/g)].map((match) => match[1]);
  assert.equal(modelPaths.length, 16, `Expected 16 GLB paths, found ${modelPaths.length}`);
  assert.equal(new Set(modelPaths).size, 16, 'GLB asset paths must be unique');
});

test('asset URLs use the same-origin public asset root', () => {
  assert.match(registry, /GLB_ASSET_BASE\s*=\s*['"]\/assets\/models\/['"]/);
});
