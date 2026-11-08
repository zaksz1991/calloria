import test from 'node:test';
import assert from 'node:assert/strict';
import { calloriaMeshoptRuntimePlugin } from '../build/calloria-meshopt-runtime-plugin.js';

const loaderFixture = `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export class Loader {
  constructor({ manager } = {}) {
    this.loader = new GLTFLoader(manager);
  }
}`;

const worldFixture = `import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
async function load() {
  const loader = new GLTFLoader();
  const requiredExtensions = [];
  const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));
  return { loader, extensionsValid };
}`.replace(
  "  const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));",
  "      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));"
);

function runTransform(source, id) {
  const plugin = calloriaMeshoptRuntimePlugin();
  return plugin.transform.call({ error(message) { throw new Error(message); } }, source, id);
}

test('shared GLB loader registers MeshoptDecoder before loading', () => {
  const result = runTransform(loaderFixture, '/repo/js/glb-asset-loader.js');
  assert.match(result.code, /MeshoptDecoder/);
  assert.match(result.code, /this\.loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(result.code, /__CALLORIA_MESHOPT_LOADER_RUNTIME_V1__/);
});

test('production staff integration decodes Meshopt and no longer rejects it', () => {
  const result = runTransform(worldFixture, '/repo/js/glb-world-integration.js');
  assert.match(result.code, /new GLTFLoader\(\)\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(result.code, /!requiredExtensions\.includes\('KHR_draco_mesh_compression'\)/);
  assert.doesNotMatch(result.code, /includes\('EXT_meshopt_compression'\)/);
});

test('unrelated source modules are untouched', () => {
  assert.equal(runTransform('export const value = 1;', '/repo/js/main.js'), null);
});

test('stale loader source fails the build rather than partially patching', () => {
  assert.throws(
    () => runTransform('export class Loader {}', '/repo/js/glb-asset-loader.js'),
    /expected exactly one source anchor/
  );
});
