import test from 'node:test';
import assert from 'node:assert/strict';
import { calloriaOptimizedGLBRuntimePlugin } from '../build/calloria-optimized-glb-runtime-plugin.js';
import {
  loadCalloriaGLTFWithOptimizedFallback,
  resetCalloriaOptimizedManifestCache
} from '../js/glb-optimized-asset-runtime.js';

const importLine = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const loaderFixture = `${importLine}
export class Loader {
  constructor({ manager, crossOrigin = 'anonymous' } = {}) {
    this.loader = new GLTFLoader(manager);
    this.loader.setCrossOrigin(crossOrigin);
  }
  async load(asset) {
    const task = this.loader.loadAsync(asset.url, (event) => {
      return event.loaded;
    });
    return task;
  }
}`;
const worldFixture = `${importLine}
async function load(asset) {
  const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(asset.url);
  const requiredExtensions = gltf.parser?.json?.extensionsRequired || [];
      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));
  return { gltf, extensionsValid };
}`;
function transform(source, id) {
  return calloriaOptimizedGLBRuntimePlugin().transform.call({ error(message) { throw new Error(message); } }, source, id);
}

test('shared GLB loader registers Meshopt and uses manifest-aware optimized fallback', () => {
  const result = transform(loaderFixture, '/repo/js/glb-asset-loader.js');
  assert.match(result.code, /MeshoptDecoder/);
  assert.match(result.code, /setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(result.code, /loadCalloriaGLTFWithOptimizedFallback\(this\.loader, asset/);
});

test('workplace loader registers Meshopt and only rejects unsupported Draco', () => {
  const result = transform(worldFixture, '/repo/js/glb-world-integration.js');
  assert.match(result.code, /loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(result.code, /loadCalloriaGLTFWithOptimizedFallback\(loader, asset\)/);
  assert.match(result.code, /!requiredExtensions\.includes\('KHR_draco_mesh_compression'\)/);
  assert.doesNotMatch(result.code, /includes\('EXT_meshopt_compression'\)/);
});

test('unrelated modules are untouched', () => {
  assert.equal(transform('export const x = 1;', '/repo/js/main.js'), null);
});

test('stale source fails fast instead of applying a partial transformation', () => {
  assert.throws(() => transform('export class Loader {}', '/repo/js/glb-asset-loader.js'), /expected exactly one/);
});

test('optimized asset is preferred only when the manifest explicitly lists it', async () => {
  resetCalloriaOptimizedManifestCache();
  const calls = [];
  const loader = { async loadAsync(url) { calls.push(url); return { url }; } };
  const fetchImpl = async () => ({ ok: true, async json() { return { schemaVersion: 1, files: { 'characters/agents/male-agent.glb': { available: true } } }; } });
  const loaded = await loadCalloriaGLTFWithOptimizedFallback(loader, { path: 'characters/agents/male-agent.glb', url: '/assets/models/characters/agents/male-agent.glb' }, undefined, { fetchImpl });
  assert.equal(loaded.url, '/assets/models-optimized/characters/agents/male-agent.glb');
  assert.deepEqual(calls, ['/assets/models-optimized/characters/agents/male-agent.glb']);
});

test('optimized decoding failure falls back to original model', async () => {
  resetCalloriaOptimizedManifestCache();
  const calls = [];
  const loader = { async loadAsync(url) { calls.push(url); if (url.includes('models-optimized')) throw new Error('decoder failure'); return { url }; } };
  const fetchImpl = async () => ({ ok: true, async json() { return { schemaVersion: 1, files: { 'agents/male.glb': { available: true } } }; } });
  const result = await loadCalloriaGLTFWithOptimizedFallback(loader, { path: 'agents/male.glb', url: '/assets/models/agents/male.glb' }, undefined, { fetchImpl, logger: { warn() {} } });
  assert.equal(result.url, '/assets/models/agents/male.glb');
  assert.deepEqual(calls, ['/assets/models-optimized/agents/male.glb', '/assets/models/agents/male.glb']);
});

test('absent manifest and unsafe paths use original without requesting an optimized URL', async () => {
  resetCalloriaOptimizedManifestCache();
  const calls = [];
  const loader = { async loadAsync(url) { calls.push(url); return { url }; } };
  const fetchImpl = async () => ({ ok: false });
  const result = await loadCalloriaGLTFWithOptimizedFallback(loader, { path: '../private/secret.glb', url: '/assets/models/safe.glb' }, undefined, { fetchImpl });
  assert.equal(result.url, '/assets/models/safe.glb');
  assert.deepEqual(calls, ['/assets/models/safe.glb']);
});
