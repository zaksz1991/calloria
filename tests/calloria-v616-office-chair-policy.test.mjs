import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CC0_OFFICE_CHAIR_ASSET,
  CC0_OFFICE_CHAIR_LIMITS,
  getCC0ChairStationIds,
  validateCC0OfficeChair,
  getCC0ChairPlacedTriangleCount,
  isCC0ChairPlacementWithinBudget
} from '../js/office-chair-policy.js';

const stations = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, x: index * 2, z: index * -1 }));
const validMetrics = () => ({
  size: { x: 0.657, y: 1.083, z: 0.693 },
  minY: 0,
  meshes: 5,
  triangles: 2408,
  materials: 5,
  textures: 3,
  maxTextureEdge: 2048,
  unsupportedMeshes: 0
});

test('CC0 chair asset identifies its source and commercial-use licence', () => {
  assert.equal(CC0_OFFICE_CHAIR_ASSET.id, '3dassets-office-task-chair');
  assert.equal(CC0_OFFICE_CHAIR_ASSET.license, 'CC0 1.0 Universal');
  assert.match(CC0_OFFICE_CHAIR_ASSET.licenseUrl, /creativecommons\.org\/publicdomain\/zero\/1\.0/);
  assert.match(CC0_OFFICE_CHAIR_ASSET.url, /cdn\.3dassets\.dev\/assets\/29956\/v1\/model\.glb/);
});

test('low, balanced and high tiers keep chairs concentrated at active workstations', () => {
  assert.deepEqual(getCC0ChairStationIds('low', stations), [10, 11]);
  assert.deepEqual(getCC0ChairStationIds('balanced', stations), [9, 10, 11, 12]);
  assert.deepEqual(getCC0ChairStationIds('high', stations), [5, 6, 7, 8, 9, 10, 11, 12]);
});

test('station selection tolerates missing IDs and filters duplicate/out-of-range records', () => {
  const irregular = [
    { id: 9, x: 1, z: 1 }, { id: 9, x: 2, z: 2 }, { id: 12, x: 3, z: 3 },
    { id: 30, x: 4, z: 4 }, { x: 5, z: 5 }
  ];
  assert.deepEqual(getCC0ChairStationIds('balanced', irregular), [9, 12]);
  assert.deepEqual(getCC0ChairStationIds('invalid-tier', stations), [9, 10, 11, 12]);
  assert.deepEqual(getCC0ChairStationIds('low', null), []);
});

test('validated chair geometry matches the documented asset envelope', () => {
  const result = validateCC0OfficeChair(validMetrics());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('missing, non-finite and undersized dimensions are rejected', () => {
  assert.equal(validateCC0OfficeChair(null).valid, false);
  const bad = validMetrics();
  bad.size.x = Number.NaN;
  assert.match(validateCC0OfficeChair(bad).errors.join(' '), /dimensions/);
  const tiny = validMetrics();
  tiny.size.y = 0.2;
  assert.match(validateCC0OfficeChair(tiny).errors.join(' '), /too small/);
});

test('oversized model geometry and budgets are rejected', () => {
  const large = validMetrics();
  large.size.y = 2.8;
  large.triangles = 80000;
  large.meshes = 100;
  large.materials = 20;
  const result = validateCC0OfficeChair(large);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' '), /envelope/);
  assert.match(result.errors.join(' '), /triangle/);
  assert.match(result.errors.join(' '), /mesh count/);
  assert.match(result.errors.join(' '), /material count/);
});

test('large textures, invalid floor origin and unbatchable meshes are rejected', () => {
  const metrics = validMetrics();
  metrics.maxTextureEdge = 8192;
  metrics.minY = 0.5;
  metrics.unsupportedMeshes = 1;
  const result = validateCC0OfficeChair(metrics);
  assert.match(result.errors.join(' '), /texture/);
  assert.match(result.errors.join(' '), /floor origin/);
  assert.match(result.errors.join(' '), /safely batched/);
});

test('placed triangle budget is deterministic and bounded', () => {
  assert.equal(getCC0ChairPlacedTriangleCount(2408, 8), 19264);
  assert.equal(isCC0ChairPlacementWithinBudget(2408, 8), true);
  assert.equal(isCC0ChairPlacementWithinBudget(2408, 14), false);
  assert.equal(CC0_OFFICE_CHAIR_LIMITS.maxPlacedTriangles, 32000);
});
