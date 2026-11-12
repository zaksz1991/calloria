import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const runtime = await readFile(new URL('../js/glb-office-world-integration.js', import.meta.url), 'utf8');
const lobby = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
const policy = await readFile(new URL('../js/cc0-office-lobby-policy.js', import.meta.url), 'utf8');

const occurrences = (source, token) => source.split(token).length - 1;

test('office runtime wires the reception GLB into its existing loader and scene', () => {
  assert.match(runtime, /integrateCalloriaCC0OfficeLobby/);
  assert.match(runtime, /loader,\s*tier: plan\.tier/);
  assert.match(runtime, /isActive: \(\) => !disposed/);
  assert.equal(occurrences(runtime, 'integrateCalloriaCC0OfficeLobby({'), 1);
});

test('complete lobby is attempted only on balanced and high tiers', () => {
  assert.match(runtime, /includeReceptionDesk && shouldLoadCC0OfficeLobby\(plan\.tier\)/);
  assert.match(policy, /tier === 'balanced' \|\| tier === 'high'/);
});

test('standalone reception desk GLB is attempted only after full-lobby failure', () => {
  const lobbyCall = runtime.indexOf('integrateCalloriaCC0OfficeLobby({');
  const fallbackCondition = runtime.indexOf('if (!disposed && !lobbyStatus.loaded)', lobbyCall);
  const fallbackCall = runtime.indexOf("placeAsset('reception-desk'", fallbackCondition);
  assert.ok(lobbyCall >= 0 && fallbackCondition > lobbyCall && fallbackCall > fallbackCondition);
});

test('replacement lobby is added before reception fallback objects are hidden', () => {
  assert.ok(lobby.indexOf('scene.add(placedRoot)') < lobby.indexOf('hiddenFallbacks = hideReceptionFallbacks(scene)'));
  assert.match(lobby, /function restoreReceptionFallbacks/);
});

test('lobby disposal restores old reception visibility and releases generated resources', () => {
  assert.match(lobby, /restoreReceptionFallbacks\(hiddenFallbacks\)/);
  assert.match(lobby, /for \(const geometry of generatedGeometries\) geometry\.dispose\(\)/);
  assert.match(lobby, /disposeGLTFResources\(gltf\)/);
  assert.match(runtime, /lobbyLayer\?\.dispose\?\.\(\)/);
});

test('lobby runtime uses existing Three.js loader and does not create a renderer or second loop', () => {
  assert.match(lobby, /loader\.loadAsync\(CC0_OFFICE_LOBBY_ASSET\.url\)/);
  assert.doesNotMatch(lobby, /new THREE\.WebGLRenderer|requestAnimationFrame|renderer\.render/);
  assert.match(lobby, /mergeGeometries\(geometries, false\)/);
});

test('status distinguishes a validated placed lobby from failure and low-tier skip', () => {
  assert.match(runtime, /receptionLobby: \{ \.\.\.lobbyStatus \}/);
  assert.match(runtime, /placementStatus: lobbyStatus\.loaded \? 'placed'/);
  assert.match(runtime, /failedIds\.push\(CC0_OFFICE_LOBBY_ASSET\.id\)/);
  assert.match(runtime, /const lobbyCount = lobbyStatus\.loaded \? 1 : 0/);
  assert.match(runtime, /officePlacedCount = placed\.length \+ chairCount \+ lobbyCount/);
});

test('old office desk, computer, headset, chair and decoder paths remain wired', () => {
  assert.match(runtime, /office-desk/);
  assert.match(runtime, /office-computer/);
  assert.match(runtime, /headset-model/);
  assert.match(runtime, /integrateCalloriaCC0OfficeChairs/);
  assert.match(runtime, /loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(runtime, /loader\.setDRACOLoader\(dracoLoader\)/);
});

test('existing public office runtime plan and Vite transform compatibility marker remain unchanged', () => {
  assert.match(runtime, /export function getOfficeAssetPlan/);
  assert.match(runtime, /export async function integrateCalloriaGLBOfficeAssets/);
  assert.match(runtime, /__calloriaOfficeGLBRuntimeV616/);
});

test('office loader sets anonymous CORS and lobby success appears in loaded asset IDs', () => {
  assert.match(runtime, /loader\.setCrossOrigin\('anonymous'\)/);
  assert.match(runtime, /lobbyStatus\.loaded \? \[CC0_OFFICE_LOBBY_ASSET\.id\]/);
});
