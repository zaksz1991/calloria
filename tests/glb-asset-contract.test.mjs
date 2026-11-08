import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { GLB_ASSET_REGISTRY, GLB_ASSET_BASE, getGLBAssetById } from '../js/glb-asset-registry.js';

const root = new URL('../', import.meta.url);

test('catalogue contains the 16 committed CALLORIA GLB assets', () => {
  assert.equal(GLB_ASSET_REGISTRY.length, 16);
  assert.equal(new Set(GLB_ASSET_REGISTRY.map((asset) => asset.id)).size, GLB_ASSET_REGISTRY.length);
  assert.ok(GLB_ASSET_REGISTRY.every((asset) => asset.url.startsWith(GLB_ASSET_BASE) && asset.path.endsWith('.glb')));
});

test('primary staff and workplace assets are present', () => {
  for (const id of ['male-agent', 'female-agent', 'office-desk', 'office-computer', 'reception-desk', 'headset-model']) {
    assert.ok(getGLBAssetById(id), `missing expected asset ${id}`);
  }
});

test('catalogue maps models to the repository paths supplied for CALLORIA', () => {
  const expected = {
    'female-agent': 'characters/agents/female-agent.glb',
    'male-agent': 'characters/agents/male-agent.glb',
    'office-computer': 'office/equipment/office_computer.glb',
    'reception-desk': 'office/reception/reception-desk.glb',
    'headset-model': 'accessories/headsets/model.glb'
  };
  for (const [id, path] of Object.entries(expected)) assert.equal(getGLBAssetById(id).path, path);
});

test('Vite serves the public asset directory and builds the inspector as a page', async () => {
  const config = await readFile(new URL('vite.config.js', root), 'utf8');
  assert.match(config, /publicDir:\s*'public'/);
  assert.match(config, /assetInspector:\s*resolve\(process\.cwd\(\),\s*'asset-inspector\.html'\)/);
});

test('production loader uses Three GLTFLoader and skinned-safe cloning', async () => {
  const source = await readFile(new URL('js/glb-asset-loader.js', root), 'utf8');
  assert.match(source, /GLTFLoader/);
  assert.match(source, /SkeletonUtils\.js/);
  assert.match(source, /export class CalloriaGLBAssetLoader/);
  assert.match(source, /export function inspectGLTFAsset/);
});
