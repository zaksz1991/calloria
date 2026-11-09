import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calloriaErgonomicOfficeChairsPlugin,
  __ergonomicChairPluginTest
} from '../build/calloria-ergonomic-office-chairs-plugin.mjs';

const syntheticV30World = `
const __CALLORIA_CC0_OFFICE_LOBBY_V30__ = true;
import { integrateCalloriaCC0Lobby } from './cc0-office-lobby-integration.js';
  let glbOfficeLayer = null;
  let cc0LobbyLayer = null;
  let lobbyAssetStatus = { loaded: false, reason: 'loading' };
  let cc0LobbyDisposed = false;
  let worldMissionLayer = null;
  void integrateCalloriaCC0Lobby({ scene, tier, isActive: () => !cc0LobbyDisposed }).then((layer) => {
    cc0LobbyLayer = layer;
  });
  try {
    worldMissionLayer = createCalloriaWorldMission({ host });
  } catch (error) {}
  const lobbyLabel = lobbyAssetStatus.loaded ? 'LOBBY: CC0 GLB' : 'LOBBY: FALLBACK';
  if (assetStatusNode) {
    const officeCount = combinedAssetStatus.officePlaced;
    assetStatusNode.textContent = \`GLB STAFF: 0\`
      + \`  ·  \${lobbyLabel}\`
      + \`  ·  \${String(tier).toUpperCase()}\`;
  }
      cc0LobbyLayer?.update?.(delta);
      cc0LobbyLayer?.dispose?.();
`;

function runTransform(source = syntheticV30World) {
  const warnings = [];
  const plugin = calloriaErgonomicOfficeChairsPlugin();
  const result = plugin.transform.call({ warn: (message) => warnings.push(String(message)) }, source, '/repo/js/production-world.js');
  return { result, warnings };
}

test('injects chair module import, asynchronous activation and disposal after v3.0', () => {
  const { result, warnings } = runTransform();
  assert.equal(warnings.length, 0);
  assert.ok(result?.code.includes(__ergonomicChairPluginTest.MARKER));
  assert.ok(result.code.includes(__ergonomicChairPluginTest.IMPORT));
  assert.ok(result.code.includes('integrateCalloriaCC0OfficeChairs({ scene, stations, tier, isActive: () => !cc0ChairDisposed })'));
  assert.ok(result.code.includes('cc0ChairLayer?.update?.(delta)'));
  assert.ok(result.code.includes('cc0ChairDisposed = true;'));
  assert.ok(result.code.includes('cc0ChairLayer?.dispose?.()'));
});

test('adds a truthful workstation-chair loading and fallback status', () => {
  const { result } = runTransform();
  assert.ok(result.code.includes('CHAIRS: LOADING'));
  assert.ok(result.code.includes('CHAIRS: CC0 GLB'));
  assert.ok(result.code.includes('CHAIRS: FALLBACK'));
  assert.ok(result.code.includes('calloria:glb-chairs-ready'));
  assert.ok(result.code.includes('chairAssetStatus'));
});

test('transformed production-world remains syntactically valid', () => {
  const { result } = runTransform();
  const executableModule = result.code.replace(/^import [^\n]+\n/gm, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(executableModule));
});

test('skips safely without the v3.0 lobby transform', () => {
  const { result, warnings } = runTransform('export async function initProductionWorld() { return {}; }');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped/);
});

test('skips safely if a production-world source anchor has changed', () => {
  const changed = syntheticV30World.replace('cc0LobbyLayer?.update?.(delta);', 'cc0LobbyLayer?.update?.(dt);');
  const { result, warnings } = runTransform(changed);
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /anchors changed/);
});

test('is idempotent after the v3.1 marker is added', () => {
  const first = runTransform().result;
  const second = runTransform(first.code);
  assert.equal(second.result, null);
  assert.equal(second.warnings.length, 0);
});

test('asset integration declares CC0 source, conservative budgets and fail-safe chair restoration', async () => {
  const source = await readFile(new URL('../js/cc0-office-chair-integration.js', import.meta.url), 'utf8');
  assert.match(source, /cdn\.3dassets\.dev\/assets\/29956\/v1\/model\.glb/);
  assert.match(source, /CC0 1\.0 Universal/);
  assert.match(source, /trianglesPerChair:\s*4000/);
  assert.match(source, /maxPlacedTriangles:\s*32000/);
  assert.match(source, /chair-seats/);
  assert.match(source, /chair-backs/);
  assert.match(source, /restoreLegacyChairInstances/);
  assert.match(source, /original chairs retained/);
});

test('tier coverage is aligned with the existing 12-station GLB workstation ranges', async () => {
  const source = await readFile(new URL('../js/cc0-office-chair-integration.js', import.meta.url), 'utf8');
  assert.match(source, /low: Object\.freeze\(\[10, 11\]\)/);
  assert.match(source, /balanced: Object\.freeze\(\[9, 10, 11, 12\]\)/);
  assert.match(source, /high: Object\.freeze\(\[5, 6, 7, 8, 9, 10, 11, 12\]\)/);
  assert.match(source, /placement\.z \+ CHAIR_Z_OFFSET/);
});

test('Vite config preserves all earlier plugins and runs chairs after the real lobby stage', async () => {
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
    'calloriaErgonomicOfficeChairsPlugin()'
  ]) assert.ok(config.includes(name), `Missing existing Vite plugin ${name}`);
  assert.ok(config.indexOf('calloriaCC0OfficeLobbyPlugin()') < config.indexOf('calloriaErgonomicOfficeChairsPlugin()'));
});
