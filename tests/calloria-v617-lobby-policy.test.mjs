import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CC0_OFFICE_LOBBY_ASSET,
  CC0_OFFICE_LOBBY_LIMITS,
  CC0_OFFICE_LOBBY_FALLBACK_OBJECTS,
  shouldLoadCC0OfficeLobby,
  validateCC0OfficeLobby
} from '../js/cc0-office-lobby-policy.js';

const validMetrics = () => ({
  size: { x: 12.707, y: 3.672, z: 8.895 },
  meshes: 99,
  triangles: 32204,
  vertices: 68648,
  materials: 7,
  textures: 0,
  maxTextureEdge: 0
});

test('lobby asset declares its CC0 source and stable runtime URL', () => {
  assert.equal(CC0_OFFICE_LOBBY_ASSET.id, '3dassets-office-lobby');
  assert.equal(CC0_OFFICE_LOBBY_ASSET.license, 'CC0 1.0 Universal');
  assert.match(CC0_OFFICE_LOBBY_ASSET.url, /cdn\.3dassets\.dev\/assets\/26326\/v1\/model\.glb/);
  assert.match(CC0_OFFICE_LOBBY_ASSET.licenseUrl, /creativecommons\.org\/publicdomain\/zero\/1\.0/);
});

test('low graphics skips the full lobby while balanced and high graphics can load it', () => {
  assert.equal(shouldLoadCC0OfficeLobby('low'), false);
  assert.equal(shouldLoadCC0OfficeLobby('balanced'), true);
  assert.equal(shouldLoadCC0OfficeLobby('high'), true);
  assert.equal(shouldLoadCC0OfficeLobby('unknown'), false);
});

test('published lobby geometry envelope is accepted', () => {
  const result = validateCC0OfficeLobby(validMetrics());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('missing and non-finite lobby metrics fail validation', () => {
  assert.equal(validateCC0OfficeLobby(null).valid, false);
  const bad = validMetrics();
  bad.size.x = Number.NaN;
  assert.match(validateCC0OfficeLobby(bad).errors.join(' '), /non-finite/);
});

test('oversized dimensions and geometry budgets are rejected', () => {
  const bad = validMetrics();
  bad.size.x = 30;
  bad.triangles = 100000;
  bad.meshes = 200;
  bad.materials = 20;
  const errors = validateCC0OfficeLobby(bad).errors.join(' ');
  assert.match(errors, /dimensions exceed/);
  assert.match(errors, /triangle budget/);
  assert.match(errors, /mesh count/);
  assert.match(errors, /material count/);
});

test('undersized and high-resolution texture assets are rejected', () => {
  const bad = validMetrics();
  bad.size.z = 1;
  bad.size.y = 0.4;
  bad.maxTextureEdge = 8192;
  const errors = validateCC0OfficeLobby(bad).errors.join(' ');
  assert.match(errors, /too small/);
  assert.match(errors, /texture exceeds/);
});

test('policy retains all known procedural reception fallbacks until successful placement', () => {
  assert.ok(CC0_OFFICE_LOBBY_FALLBACK_OBJECTS.includes('reception-counter-top'));
  assert.ok(CC0_OFFICE_LOBBY_FALLBACK_OBJECTS.includes('reception-waiting-seats'));
  assert.ok(CC0_OFFICE_LOBBY_FALLBACK_OBJECTS.includes('reception-access-posts'));
  assert.ok(CC0_OFFICE_LOBBY_FALLBACK_OBJECTS.includes('calloria-glb-reception-desk'));
  assert.equal(CC0_OFFICE_LOBBY_LIMITS.placedScale, 0.8);
});
