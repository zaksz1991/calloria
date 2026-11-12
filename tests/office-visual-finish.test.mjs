import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyCalloriaGlassMaterialPolicy } from '../js/calloria-glass-material-policy.js';
import { applyCalloriaLobbyLightingPolicy } from '../js/calloria-lobby-lighting-policy.js';

function makeRoot(objects) {
  return { traverse(callback) { for (const object of objects) callback(object); } };
}

test('glass policy finishes named glazing but leaves structural frames unchanged', () => {
  const glass = { name: 'Interior_Glass_Pane', opacity: 1, transparent: false, roughness: 0.7, metalness: 0.5, side: 0 };
  const frame = { name: 'Aluminium_Frame', opacity: 1, transparent: false, roughness: 0.4, metalness: 0.8 };
  const root = makeRoot([{ isMesh: true, material: glass }, { isMesh: true, material: frame }]);
  const result = applyCalloriaGlassMaterialPolicy(root, { doubleSide: 2, maxOpacity: 0.34 });
  assert.deepEqual(result, { scannedMaterials: 2, glassMaterialsMatched: 1, glassMaterialsFinished: 1 });
  assert.equal(glass.transparent, true);
  assert.equal(glass.opacity, 0.34);
  assert.equal(glass.depthWrite, false);
  assert.equal(glass.side, 2);
  assert.equal(glass.roughness, 0.18);
  assert.equal(glass.metalness, 0.06);
  assert.equal(frame.transparent, false);
  assert.equal(frame.opacity, 1);
});

test('glass policy detects existing transparent PBR material and handles repeated references once', () => {
  const glass = { name: 'Material.04', transparent: true, opacity: 0.2, transmission: 0.15, ior: 1.2, thickness: 0 };
  const root = makeRoot([{ isMesh: true, material: glass }, { isMesh: true, material: glass }]);
  const result = applyCalloriaGlassMaterialPolicy(root, { doubleSide: 2 });
  assert.equal(result.scannedMaterials, 1);
  assert.equal(result.glassMaterialsFinished, 1);
  assert.equal(glass.opacity, 0.2);
  assert.equal(glass.transmission, 0.38);
  assert.equal(glass.ior, 1.45);
  assert.equal(glass.thickness, 0.02);
});

test('lobby lighting receives dynamic shadows on standard/high tiers and keeps low tier light', () => {
  const a = { isMesh: true, receiveShadow: false };
  const b = { isInstancedMesh: true, receiveShadow: false };
  const root = makeRoot([a, b]);
  const balanced = applyCalloriaLobbyLightingPolicy(root, { tier: 'balanced' });
  assert.deepEqual(balanced, { tier: 'balanced', enabled: true, meshCount: 2, shadowReceivers: 2, decorativeMeshes: 0, decorativeShadowCasters: 0 });
  assert.equal(a.receiveShadow, true);
  assert.equal(b.receiveShadow, true);
  const low = applyCalloriaLobbyLightingPolicy(root, { tier: 'low' });
  assert.equal(low.shadowReceivers, 0);
  assert.equal(a.receiveShadow, false);
  assert.equal(b.receiveShadow, false);
});

test('production lobby and partition lifecycle report the applied visual policies', async () => {
  const lobby = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
  const partitions = await readFile(new URL('../js/cc0-glazed-department-partitions.js', import.meta.url), 'utf8');
  assert.match(lobby, /applyCalloriaLobbyLightingPolicy\(rendered\.root, \{ tier \}\)/);
  assert.match(lobby, /lighting,/);
  assert.match(lobby, /export const integrateCalloriaCC0Lobby = integrateCalloriaCC0OfficeLobby/);
  assert.match(partitions, /applyCalloriaGlassMaterialPolicy\(gltf\.scene/);
  assert.match(partitions, /glassMaterialsFinished: glassFinish\.glassMaterialsFinished/);
  assert.match(lobby, /addCalloriaLobbyGreenery/);
  assert.match(lobby, /integrateCalloriaGlazedDepartmentPartitions/);
});


test('lobby greenery casts shadows on balanced/high while static lobby batches do not', () => {
  const foliageRoot = { userData: { calloriaDecorAsset: 'bird-of-paradise' } };
  const foliage = { isMesh: true, parent: foliageRoot, receiveShadow: false, castShadow: false };
  const lobbyBatch = { isMesh: true, userData: { calloriaLobbyDecorative: false }, receiveShadow: false, castShadow: true };
  const root = makeRoot([foliage, lobbyBatch]);
  const balanced = applyCalloriaLobbyLightingPolicy(root, { tier: 'balanced' });
  assert.deepEqual(balanced, {
    tier: 'balanced', enabled: true, meshCount: 2, shadowReceivers: 2,
    decorativeMeshes: 1, decorativeShadowCasters: 1
  });
  assert.equal(foliage.castShadow, true);
  assert.equal(lobbyBatch.castShadow, false);
  const high = applyCalloriaLobbyLightingPolicy(root, { tier: 'high' });
  assert.equal(high.decorativeShadowCasters, 1);
  const low = applyCalloriaLobbyLightingPolicy(root, { tier: 'low' });
  assert.equal(low.shadowReceivers, 0);
  assert.equal(low.decorativeShadowCasters, 0);
  assert.equal(foliage.castShadow, false);
  assert.equal(lobbyBatch.receiveShadow, false);
});

test('lobby batching separates foliage from static architecture by shared material', async () => {
  const lobby = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
  assert.match(lobby, /materialBuckets = \{ standard: new Map\(\), decorative: new Map\(\) \}/);
  assert.match(lobby, /hasLobbyDecorativeAncestor\(object\)/);
  assert.match(lobby, /mesh\.castShadow = decorative/);
  assert.match(lobby, /decorativeBatches/);
});
