import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calloriaCC0LobbyGreeneryPlugin,
  __greeneryPluginTest
} from '../build/calloria-cc0-lobby-greenery-plugin.mjs';

const syntheticLobby = `
import * as THREE from 'three';
import { disposeGLTFResources } from './glb-asset-loader.js';
export async function integrateCalloriaCC0Lobby({ scene, tier = 'balanced', isActive = () => true } = {}) {
  let disposed = false;
  let gltf = null;
  let placedRoot = null;
  let mergedGeometries = [];
  let hiddenLegacy = [];
  try {
    const metrics = inspectCC0Lobby(gltf);
    const validation = validateCC0Lobby(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const renderRoot = createLobbyRenderRoot(gltf);
    return {
      status: {
        loaded: true,
        mergeNote: renderRoot.mergeReason
      },
      update() {},
      dispose() {
        if (disposed) return;
        disposed = true;
        if (placedRoot) scene.remove(placedRoot);
        for (const geometry of mergedGeometries) geometry.dispose();
        for (const object of hiddenLegacy) object.visible = true;
        if (gltf) disposeGLTFResources(gltf);
      }
    };
  } catch (error) {
    if (placedRoot) scene.remove(placedRoot);
    if (gltf) disposeGLTFResources(gltf);
    return { status: { loaded: false }, update() {}, dispose() {} };
  }
}
`;

const syntheticV31World = `
const __CALLORIA_CC0_OFFICE_LOBBY_V30__ = true;
const __CALLORIA_CC0_ERGONOMIC_CHAIRS_V31__ = true;
function boot() {
  let cc0LobbyLayer = null;
  let cc0ChairLayer = null;
  let chairAssetStatus = { loaded: false, reason: 'loading' };
  let cc0ChairDisposed = false;
  let lobbyAssetStatus = { loaded: false, reason: 'loading' };
  void integrateCalloriaCC0Lobby({ scene, tier, isActive: () => !cc0LobbyDisposed }).then((layer) => {
    if (cc0LobbyDisposed) { layer?.dispose?.(); return; }
    cc0LobbyLayer = layer;
    lobbyAssetStatus = layer?.status || { loaded: false, reason: 'lobby layer returned no status' };
    const lobbyLabel = lobbyAssetStatus.loaded ? 'LOBBY: CC0 GLB' : 'LOBBY: FALLBACK';
    const statusNode = document.getElementById('assetStatus');
    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, lobbyLabel);
    window.dispatchEvent(new CustomEvent('calloria:glb-lobby-ready', { detail: lobbyAssetStatus }));
  }).catch((error) => {
    lobbyAssetStatus = { loaded: false, reason: String(error?.message || error) };
    const statusNode = document.getElementById('assetStatus');
    if (statusNode) statusNode.textContent = statusNode.textContent.replace(/LOBBY: (?:LOADING|FALLBACK|CC0 GLB)/, 'LOBBY: FALLBACK');
  });
  const lobbyLabel = lobbyAssetStatus.loaded ? 'LOBBY: CC0 GLB' : 'LOBBY: FALLBACK';
  if (assetStatusNode) {
    assetStatusNode.textContent = \`GLB STAFF: 0\`
      + \`  ·  \${lobbyLabel}\`
      + \`  ·  \${chairAssetStatus.loaded ? 'CHAIRS: CC0 GLB' : chairAssetStatus.reason === 'loading' ? 'CHAIRS: LOADING' : 'CHAIRS: FALLBACK'}\`
      + \`  ·  \${String(tier).toUpperCase()}\`;
  }
}
`;


function runPlugin(source, id) {
  const warnings = [];
  const plugin = calloriaCC0LobbyGreeneryPlugin();
  const result = plugin.transform.call({ warn: (message) => warnings.push(String(message)) }, source, id);
  return { result, warnings };
}

test('lobby integration injects the green asset before static geometry batching', () => {
  const { result, warnings } = runPlugin(syntheticLobby, '/repo/js/cc0-office-lobby-integration.js');
  assert.equal(warnings.length, 0);
  assert.ok(result.code.includes(__greeneryPluginTest.LOBBY_MARKER));
  assert.ok(result.code.includes(__greeneryPluginTest.IMPORT));
  assert.ok(result.code.indexOf('addCalloriaLobbyGreenery(gltf') < result.code.indexOf('createLobbyRenderRoot(gltf)'));
  assert.ok(result.code.includes('greenery: greeneryLease?.status'));
});

test('lobby integration disposes greenery on success and failure paths', () => {
  const { result } = runPlugin(syntheticLobby, '/repo/js/cc0-office-lobby-integration.js');
  assert.equal(result.code.match(/greeneryLease\?\.dispose\?\.\(\)/g)?.length, 3);
  assert.ok(result.code.includes('greeneryLease = null;'));
});

test('lobby integration checks disposal after the asynchronous plant load', () => {
  const { result } = runPlugin(syntheticLobby, '/repo/js/cc0-office-lobby-integration.js');
  assert.ok(result.code.includes('world disposed during greenery integration'));
  assert.ok(result.code.includes('isActive: () => !disposed && isActive()'));
});

test('production-world exposes truthful greenery loading, loaded and fallback states', () => {
  const { result, warnings } = runPlugin(syntheticV31World, '/repo/js/production-world.js');
  assert.equal(warnings.length, 0, warnings.join('\n'));
  assert.ok(result.code.includes(__greeneryPluginTest.WORLD_MARKER));
  assert.ok(result.code.includes("let greeneryAssetStatus = { loaded: false, reason: 'loading' }"));
  assert.ok(result.code.includes('GREENERY: CC0 GLB'));
  assert.ok(result.code.includes('GREENERY: LOADING'));
  assert.ok(result.code.includes('GREENERY: FALLBACK'));
  assert.ok(result.code.includes('calloria:glb-greenery-ready'));
});

test('world transform refuses to run without the v3.0 and v3.1 baseline markers', () => {
  const { result, warnings } = runPlugin('export function start() {}', '/repo/js/production-world.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /v3\.0 lobby plus v3\.1 chair/);
});

test('lobby transform fails closed when a required source anchor changes', () => {
  const changed = syntheticLobby.replace('let hiddenLegacy = [];', 'let oldHiddenLegacy = [];');
  const { result, warnings } = runPlugin(changed, '/repo/js/cc0-office-lobby-integration.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /anchors changed/);
});

test('world transform fails closed when a status anchor changes', () => {
  const changed = syntheticV31World.replace('lobbyAssetStatus = layer?.status', 'lobbyAssetStatus = layer.status');
  const { result, warnings } = runPlugin(changed, '/repo/js/production-world.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /anchors changed/);
});

test('both transforms are idempotent', () => {
  const lobbyFirst = runPlugin(syntheticLobby, '/repo/js/cc0-office-lobby-integration.js').result;
  assert.equal(runPlugin(lobbyFirst.code, '/repo/js/cc0-office-lobby-integration.js').result, null);
  const worldFirst = runPlugin(syntheticV31World, '/repo/js/production-world.js').result;
  assert.ok(worldFirst);
  assert.equal(runPlugin(worldFirst.code, '/repo/js/production-world.js').result, null);
});

test('ignores unrelated files', () => {
  const { result, warnings } = runPlugin(syntheticLobby, '/repo/js/agent-desk-workbench.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 0);
});

test('greenery asset metadata identifies the real CC0 GLB and verified model budget', async () => {
  const source = await readFile(new URL('../js/cc0-lobby-greenery-integration.js', import.meta.url), 'utf8');
  assert.match(source, /cdn\.3dassets\.dev\/assets\/38580\/v1\/model\.glb/);
  assert.match(source, /CC0 1\.0 Universal/);
  assert.match(source, /triangles:\s*612/);
  assert.match(source, /materials:\s*4/);
  assert.match(source, /sizeMeters:\s*Object\.freeze\(\[1\.517, 1\.751, 1\.485\]\)/);
  assert.match(source, /no named lobby planter anchors passed geometry checks/);
  assert.match(source, /original lobby retained/);
});

test('greenery only fills named planter anchors and caps total placed geometry', async () => {
  const source = await readFile(new URL('../js/cc0-lobby-greenery-integration.js', import.meta.url), 'utf8');
  assert.match(source, /const PLANTER_NAME = \/\(\?:planter/);
  assert.match(source, /maxPlacedTriangles:\s*4000/);
  assert.match(source, /maxPlanterAnchors:\s*4/);
  assert.match(source, /findCC0LobbyPlanterAnchors\(lobbyGltf\.scene\)/);
  assert.doesNotMatch(source, /Math\.random\(/);
});

test('Vite config preserves prior plugin sequence and runs greenery after chairs', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  for (const name of [
    'calloriaGLBWorldPlugin()',
    'calloriaMeshoptRuntimePlugin()',
    'calloriaStaticGLBStaffPlugin()',
    'calloriaCustomerAvatarPlugin()',
    'calloriaCustomerWorldPlugin()',
    'calloriaSupervisorInterventionPlugin()',
    'calloriaFirstShiftGameplayPlugin()',
    'calloriaThirdPersonPlayerPlugin()',
    'calloriaWorkstationExperiencePlugin()',
    'calloriaCC0OfficeLobbyPlugin()',
    'calloriaErgonomicOfficeChairsPlugin()',
    'calloriaCC0LobbyGreeneryPlugin()'
  ]) assert.ok(config.includes(name), `Missing Vite plugin ${name}`);
  assert.ok(config.indexOf('calloriaErgonomicOfficeChairsPlugin()') < config.indexOf('calloriaCC0LobbyGreeneryPlugin()'));
});
