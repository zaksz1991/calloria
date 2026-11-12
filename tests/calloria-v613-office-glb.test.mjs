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
