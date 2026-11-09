import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaCC0OfficeLobbyPlugin, __cc0LobbyPluginTest } from '../build/calloria-cc0-office-lobby-plugin.mjs';

const syntheticWorld = `
const __CALLORIA_GLB_FIRST_WORKPLACE_V22__ = true;
  let glbWorldLayer = null;
  let glbOfficeLayer = null;
  let worldMissionLayer = null;
  try {
    glbOfficeLayer = await integrateCalloriaGLBOfficeAssets({ THREE, scene, stations, tier });
  } catch (error) {
    console.warn('CALLORIA office GLB layer unavailable; retaining original office objects.', error);
  }
  try {
    worldMissionLayer = createCalloriaWorldMission({ host });
  } catch (error) {
    console.warn('CALLORIA first-shift mission overlay unavailable.', error);
  }
  const officeAssetStatus = glbOfficeLayer?.status || { placed: 0, assets: [], errors: [] };
  const combinedAssetStatus = {
    officePlaced: Number(officeAssetStatus.placed) || 0,
    officeErrors: Array.isArray(officeAssetStatus.errors) ? officeAssetStatus.errors : [],
    tier
  };
  if (assetStatusNode) {
    const officeCount = combinedAssetStatus.officePlaced;
    assetStatusNode.textContent = \`GLB STAFF: 0 · OFFICE GLB OBJECTS: \${officeCount}\`
      + (failedCount ? \` · REVIEW: \${failedCount}\` : '')
      + \`  ·  \${String(tier).toUpperCase()}\`;
  }
      glbOfficeLayer?.update?.(delta);
      animate.lastStaffAt = timestamp;
      glbOfficeLayer?.dispose?.();
      worldMissionLayer?.dispose?.();
`;

function runTransform(source = syntheticWorld) {
  const plugin = calloriaCC0OfficeLobbyPlugin();
  const warnings = [];
  const context = { warn: (message) => warnings.push(String(message)) };
  const result = plugin.transform.call(context, source, '/repo/js/production-world.js');
  return { result, warnings };
}

test('injects CC0 lobby import and lifecycle into GLB-first world', () => {
  const { result, warnings } = runTransform();
  assert.equal(warnings.length, 0);
  assert.ok(result?.code.includes(__cc0LobbyPluginTest.MARKER));
  assert.ok(result.code.includes(__cc0LobbyPluginTest.IMPORT));
  assert.ok(result.code.includes('integrateCalloriaCC0Lobby({ scene, tier, isActive: () => !cc0LobbyDisposed })'));
  assert.ok(result.code.includes('.then((layer) => {'));
  assert.ok(!result.code.includes('cc0LobbyLayer = await integrateCalloriaCC0Lobby'));
  assert.ok(result.code.includes('cc0LobbyLayer?.update?.(delta)'));
  assert.ok(result.code.includes('cc0LobbyDisposed = true;'));
  assert.ok(result.code.includes('cc0LobbyLayer?.dispose?.()'));
});

test('adds a truthful lobby status indicator', () => {
  const { result } = runTransform();
  assert.ok(result.code.includes('LOBBY:'));
  assert.ok(result.code.includes('lobbyAssetStatus.loaded'));
  assert.ok(result.code.includes('LOBBY: LOADING'));
  assert.ok(result.code.includes('calloria:glb-lobby-ready'));
  assert.ok(result.code.includes('lobbyStatus: lobbyAssetStatus'));
});


test('generated production-world module remains syntactically valid', () => {
  const { result } = runTransform();
  const executableModule = result.code.replace(/^import [^\n]+\n/, '');
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  assert.doesNotThrow(() => new AsyncFunction(executableModule));
});

test('skips safely when the established GLB-first transform is absent', () => {
  const { result, warnings } = runTransform('export async function initProductionWorld() { return {}; }');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped/);
});

test('skips safely when a source anchor has changed', () => {
  const changed = syntheticWorld.replace('glbOfficeLayer?.update?.(delta);', 'glbOfficeLayer?.update?.(dt);');
  const { result, warnings } = runTransform(changed);
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /anchors changed/);
});

test('is idempotent after the lobby marker is injected', () => {
  const first = runTransform().result;
  const second = runTransform(first.code);
  assert.equal(second.result, null);
  assert.equal(second.warnings.length, 0);
});

test('keeps remote model, CC0 licence, budgets and fallback safety explicit', async () => {
  const source = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
  assert.match(source, /cdn\.3dassets\.dev\/assets\/26326\/v1\/model\.glb/);
  assert.match(source, /CC0 1\.0 Universal/);
  assert.match(source, /triangles:\s*42000/);
  assert.match(source, /mergeGeometries/);
  assert.match(source, /existing CALLORIA reception geometry remains/);
  assert.match(source, /isActive = \(\) => true/);
  assert.match(source, /placedRoot\.scale\.setScalar\(0\.8\)/);
  assert.match(source, /placedRoot\.position\.set\(-14\.0, 0, 10\.2\)/);
  assert.match(source, /reception-counter-top/);
  assert.match(source, /reception-waiting-seats/);
  assert.match(source, /reception-access-control-readers/);
});

test('Vite config preserves existing plugin chain and appends the lobby stage last', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloriaGLBWorldPlugin\(\)/);
  assert.match(config, /calloriaMeshoptRuntimePlugin\(\)/);
  assert.match(config, /calloriaCustomerWorldPlugin\(\)/);
  assert.match(config, /calloriaWorkstationExperiencePlugin\(\)/);
  assert.match(config, /calloriaCC0OfficeLobbyPlugin\(\)/);
  assert.ok(config.indexOf('calloriaWorkstationExperiencePlugin()') < config.indexOf('calloriaCC0OfficeLobbyPlugin()'));
});
