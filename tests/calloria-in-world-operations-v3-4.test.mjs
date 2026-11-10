import test from 'node:test';
import assert from 'node:assert/strict';
import { __calloriaV34Test as t } from '../build/calloria-in-world-operations-v3-4-plugin.mjs';

const quietContext = { error(message) { throw new Error(message); } };

test('staff GLB transform registers Draco and no longer rejects Draco-compressed files', () => {
  const source = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",
    'const __CALLORIA_MESHOPT_WORLD_RUNTIME_V1__ = true;',
    t.STAFF_LOADER,
    t.STAFF_EXTENSION_GUARD
  ].join('\n');
  const result = t.transformStaff(quietContext, source);
  assert.match(result.code, /import \{ DRACOLoader \} from 'three\/addons\/loaders\/DRACOLoader\.js';/);
  assert.match(result.code, /new DRACOLoader\(\)\.setDecoderPath\('\/draco\/'\)/);
  assert.match(result.code, /new GLTFLoader\(\)\.setMeshoptDecoder\(MeshoptDecoder\)\.setDRACOLoader\(dracoLoader\);/);
  assert.match(result.code, /const extensionsValid = true;/);
  assert.ok(!result.code.includes("!requiredExtensions.includes('KHR_draco_mesh_compression')"));
});

test('player avatar transform refuses unrigged or unanimated default-pose GLBs', () => {
  const source = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",
    '  const loader = new GLTFLoader();',
    t.AVATAR_MESHOPT_SETUP,
    '      const candidate = await loader.loadAsync(asset.url);',
    t.AVATAR_METRICS,
    '      const humanDimensions = candidateMetrics.size.y > 0.8;',
    '      selected = asset;'
  ].join('\n');
  const result = t.transformAvatar(quietContext, source);
  assert.match(result.code, /loader\.setDRACOLoader\(new DRACOLoader\(\)\.setDecoderPath\('\/draco\/'\)\)/);
  assert.match(result.code, /candidateMetrics\.skinned > 0/);
  assert.match(result.code, /candidateMetrics\.bones >= 12/);
  assert.match(result.code, /hasIdleMotion && hasWalkMotion/);
  assert.match(result.code, /disposeGLTFResources\(candidate\);\s+continue;/);
});

test('player avatar transform fails closed when source anchors drift', () => {
  assert.throws(
    () => t.transformAvatar(quietContext, 'export const sourceChanged = true;'),
    /expected exactly one player Meshopt decoder setup anchor; found 0/
  );
});

test('direct inbound entry calls the existing shift-gated operations view', () => {
  const source = [
    'const state = { hired: true };',
    'function toast() {}',
    'function open3dWorkView() {}',
    t.PAGEHIDE_ANCHOR
  ].join('\n');
  const result = t.transformMain(quietContext, source);
  assert.match(result.code, /calloria:guided-open-inbound/);
  assert.match(result.code, /if \(!state\.hired\)/);
  assert.match(result.code, /open3dWorkView\('inbound'\)/);
  assert.match(result.code, /open3dWorkView\('recruitment'\)/);
});

test('immersive HUD gets a compact direct-to-work control and compressed tutorial card', () => {
  const html = '<html><head></head><body><div id="immersiveHud"></div></body></html>';
  const result = t.transformHtml(html);
  assert.match(result, /calloriaQuickWorkDock/);
  assert.match(result, /START INBOUND WORK/);
  assert.match(result, /calloria-tutorial-card-compact/);
  assert.match(result, /max-height:min\(17dvh,124px\)/);
  assert.match(result, /calloria-world-mission-v23__controls \{ display:none!important; \}/);
  assert.equal(t.transformHtml(result), result, 'HTML transform must be idempotent');
});

test('HTML transform leaves non-game pages untouched', () => {
  const html = '<html><body><main>Operations page</main></body></html>';
  assert.equal(t.transformHtml(html), html);
});
