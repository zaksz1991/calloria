import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getOfficeAssetPlan as getPureOfficeAssetPlan,
  validateOfficeAssetMetrics,
  OFFICE_ASSET_IDS
} from '../js/glb-office-asset-policy.js';

const runtime = await readFile(new URL('../js/glb-office-world-integration.js', import.meta.url), 'utf8');

const count = (source, expression) => [...source.matchAll(expression)].length;

test('low, balanced and high graphics tiers retain the assigned Agent Station 11', () => {
  const low = getPureOfficeAssetPlan('low', 12);
  const balanced = getPureOfficeAssetPlan('balanced', 12);
  const high = getPureOfficeAssetPlan('high', 12);
  assert.deepEqual(low.deskStationIndexes, [10]);
  assert.deepEqual(low.computerStationIndexes, [10]);
  assert.deepEqual(low.headsetStationIndexes, []);
  assert.equal(low.includeReceptionDesk, false);
  assert.deepEqual(balanced.deskStationIndexes, [9, 10]);
  assert.deepEqual(high.deskStationIndexes, [8, 9, 10, 11]);
  assert.deepEqual(high.headsetStationIndexes, [8, 9, 10, 11]);
  assert.equal(high.includeReceptionDesk, true);
});

test('station counts are clamped and cannot create invalid workstation indexes', () => {
  assert.deepEqual(getPureOfficeAssetPlan('high', 1).deskStationIndexes, []);
  assert.deepEqual(getPureOfficeAssetPlan('high', 10).deskStationIndexes, [8, 9]);
  assert.deepEqual(getPureOfficeAssetPlan('high', 99).deskStationIndexes, [8, 9, 10, 11]);
  assert.equal(getPureOfficeAssetPlan('bad-tier', Number.NaN).tier, 'balanced');
});

test('office assets accept realistic static mesh GLBs without requiring skeletons or animations', () => {
  for (const id of OFFICE_ASSET_IDS) {
    const result = validateOfficeAssetMetrics(id, {
      size: { x: 1.2, y: 0.9, z: 0.8 },
      meshCount: 34,
      triangles: 42000,
      maxTextureEdge: 2048
    }, 'high');
    assert.equal(result.valid, true, `${id} should be accepted: ${result.reasons.join('; ')}`);
  }
});

test('office asset validation rejects malformed, oversized or unregistered models with a reason', () => {
  assert.match(validateOfficeAssetMetrics('office-desk', {
    size: { x: 0, y: 1, z: 1 }, meshCount: 2, triangles: 20, maxTextureEdge: 512
  }, 'high').reasons.join(' '), /dimensions/);
  assert.match(validateOfficeAssetMetrics('office-computer', {
    size: { x: 1, y: 1, z: 1 }, meshCount: 250, triangles: 20, maxTextureEdge: 512
  }, 'low').reasons.join(' '), /mesh count/);
  assert.match(validateOfficeAssetMetrics('office-desk', {
    size: { x: 1, y: 1, z: 1 }, meshCount: 2, triangles: 900000, maxTextureEdge: 512
  }, 'low').reasons.join(' '), /triangle count/);
  assert.match(validateOfficeAssetMetrics('unknown-object', {
    size: { x: 1, y: 1, z: 1 }, meshCount: 2, triangles: 10, maxTextureEdge: 512
  }, 'high').reasons.join(' '), /not an approved/);
});

test('v2.9 and v3.8 Vite office transforms retain their expected source anchors', () => {
  assert.equal(count(runtime, /import \{ GLTFLoader \} from 'three\/addons\/loaders\/GLTFLoader\.js';/g), 1);
  assert.equal(count(runtime, /loader\.setMeshoptDecoder\(MeshoptDecoder\);/g), 1);
  assert.equal(count(runtime, /const preferred = safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*safeTier === 'high'\s*\?\s*\[[^\]]*\]\s*:\s*\[[^\]]*\];/g), 1);
  assert.equal(count(runtime, /headsetStationIndexes:\s*safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*\[\.\.\.deskStationIndexes\],?/g), 1);
  assert.equal(count(runtime, /includeReceptionDesk:\s*[^,\n]+,/g), 1);
});

test('runtime reports real placements, exact asset failures and emits an office GLB status event', () => {
  assert.match(runtime, /officeObjectsPlaced:\s*placed\.length/);
  assert.match(runtime, /failedAssetIds:/);
  assert.match(runtime, /assetDetails:/);
  assert.match(runtime, /calloria:office-glb-status/);
  assert.match(runtime, /No office GLB was placed/);
});

test('primitive fallbacks are hidden only after the corresponding GLB has been placed', () => {
  assert.ok(runtime.indexOf('if (result?.length)') < runtime.indexOf("hideInstancedEntries(scene, 'agent-desk-surfaces'"));
  assert.ok(runtime.indexOf('if (result?.length)') < runtime.indexOf("hideNamedObjects(scene, ['reception-counter-top'"));
  assert.match(runtime, /Promise\.allSettled\(jobs\)/);
});

test('repeated initialization on the same scene reuses the active layer instead of duplicating models', () => {
  assert.match(runtime, /const ACTIVE_LAYERS = new WeakMap\(\)/);
  assert.match(runtime, /if \(existing && !existing\.disposed\) return existing/);
  assert.match(runtime, /ACTIVE_LAYERS\.delete\(scene\)/);
});

import {
  DEFAULT_DRACO_DECODER_PATH,
  getOfficeDracoDecoderPath,
  classifyOfficeLoadError
} from '../js/glb-office-draco-policy.js';

test('office GLB loader configures both Meshopt and Draco decoders', () => {
  assert.match(runtime, /import \{ DRACOLoader \} from 'three\/addons\/loaders\/DRACOLoader\.js';/);
  assert.match(runtime, /loader\.setMeshoptDecoder\(MeshoptDecoder\);/);
  assert.match(runtime, /dracoLoader\.setDecoderPath\(dracoDecoderPath\);/);
  assert.match(runtime, /dracoLoader\.setDecoderConfig\(\{ type: 'wasm' \}\);/);
  assert.match(runtime, /loader\.setDRACOLoader\(dracoLoader\);/);
});

test('pinned default Draco decoder path and configurable same-origin override are normalized', () => {
  assert.equal(DEFAULT_DRACO_DECODER_PATH, 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  assert.equal(getOfficeDracoDecoderPath(), DEFAULT_DRACO_DECODER_PATH);
  assert.equal(getOfficeDracoDecoderPath('/assets/draco'), '/assets/draco/');
  assert.equal(getOfficeDracoDecoderPath('https://cdn.example.test/draco/'), 'https://cdn.example.test/draco/');
});

test('office GLB failures are classified into actionable categories', () => {
  assert.equal(classifyOfficeLoadError(new Error('No DRACOLoader instance provided.')), 'draco-decoder');
  assert.equal(classifyOfficeLoadError(new Error('HTTP 404 while loading asset')), 'http-or-network');
  assert.equal(classifyOfficeLoadError(new Error('Invalid GLB JSON chunk')), 'glb-parse');
  assert.equal(classifyOfficeLoadError(new Error('Model rejected: triangle count exceeded')), 'validation');
  assert.equal(classifyOfficeLoadError(new Error('Could not fit object in station')), 'placement');
  assert.equal(classifyOfficeLoadError(new Error('unexpected failure')), 'unknown');
});

test('failed asset diagnostics preserve model path, URL and error category', () => {
  assert.match(runtime, /path: asset\?\.path \|\| null/);
  assert.match(runtime, /url: asset\?\.url \|\| null/);
  assert.match(runtime, /errorCategory: error\?\.errorCategory \|\| classifyOfficeLoadError\(error\)/);
});

test('DRACO worker resources are disposed with the same world layer', () => {
  assert.match(runtime, /dracoLoader\.dispose\(\);/);
  assert.ok(runtime.indexOf('dracoLoader.dispose();') > runtime.indexOf('disposeGLTFResources(entry.gltf)'));
});

test('office GLB plan and existing v2.9 transform anchors remain stable', () => {
  assert.match(runtime, /const preferred = safeTier === 'low' \? \[10\] : safeTier === 'high' \? \[8, 9, 10, 11\] : \[9, 10\];/);
  assert.match(runtime, /headsetStationIndexes: safeTier === 'low' \? \[\] : \[\.\.\.deskStationIndexes\]/);
  assert.match(runtime, /includeReceptionDesk: safeTier !== 'low'/);
});
