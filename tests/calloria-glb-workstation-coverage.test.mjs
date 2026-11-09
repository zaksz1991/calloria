import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';

const pluginSource = await readFile(new URL('../build/calloria-glb-world-plugin.js', import.meta.url), 'utf8');
const officeSource = `
export function getOfficeAssetPlan(tier = 'balanced', stationCount = 12) {
  const safeTier = ['low', 'balanced', 'high'].includes(tier) ? tier : 'balanced';
  const available = Math.max(0, Math.min(12, Number(stationCount) || 0));
  const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];
  const deskStationIndexes = preferred.filter((index) => index < available);
  return {
    deskStationIndexes,
    computerStationIndexes: [...deskStationIndexes],
    headsetStationIndexes: safeTier === 'low' ? [] : [...deskStationIndexes],
    includeReceptionDesk: safeTier !== 'low',
    tier: safeTier
  };
}
`;

test('v2.9 coverage transform is included in the existing GLB world plugin', () => {
  assert.match(pluginSource, /OFFICE_TARGET = '\/js\/glb-office-world-integration\.js'/);
  assert.match(pluginSource, /transformOfficeCoverage/);
});

test('low tier receives two front-row GLB desk stations and one headset', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, officeSource, '/repo/js/glb-office-world-integration.js');
  assert.ok(result?.code);
  assert.match(result.code, /safeTier === 'low' \? \[9, 10\]/);
  assert.match(result.code, /headsetStationIndexes: safeTier === 'low' \? \[10\]/);
});

test('balanced tier receives the complete front row of four workstations', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, officeSource, '/repo/js/glb-office-world-integration.js');
  assert.match(result.code, /safeTier === 'high' \? \[4, 5, 6, 7, 8, 9, 10, 11\] : \[8, 9, 10, 11\]/);
});

test('high tier receives eight workstations while preserving station-count safety filtering', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, officeSource, '/repo/js/glb-office-world-integration.js');
  assert.match(result.code, /preferred\.filter\(\(index\) => index < available\)/);
  assert.match(result.code, /\[4, 5, 6, 7, 8, 9, 10, 11\]/);
});

test('office transform is idempotent', () => {
  const plugin = calloriaGLBWorldPlugin();
  const context = { error(message) { throw new Error(message); } };
  const first = plugin.transform.call(context, officeSource, '/repo/js/glb-office-world-integration.js');
  const second = plugin.transform.call(context, first.code, '/repo/js/glb-office-world-integration.js');
  assert.equal(second, null);
});

test('unrelated application modules are untouched', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, 'export const untouched = true;', '/repo/js/main.js');
  assert.equal(result, null);
});

test('existing production-world integration transform remains registered and intact', () => {
  const plugin = calloriaGLBWorldPlugin();
  const productionSource = [
    "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });",
    '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;',
    '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();',
    '      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);',
    '    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });',
    '    callbacks.onImmersiveChange?.(immersive);',
    '      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;'
  ].join('\n');
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, productionSource, '/repo/js/production-world.js');
  assert.ok(result?.code);
  assert.match(result.code, /integrateCalloriaGLBOfficeAssets/);
  assert.match(result.code, /createCalloriaWorldMission/);
  assert.match(result.code, /calloria:world-station-accessed/);
});

test('office transform fails closed when the upstream plan changes unexpectedly', () => {
  const plugin = calloriaGLBWorldPlugin();
  const altered = officeSource.replace("const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];", 'const preferred = [];');
  assert.throws(
    () => plugin.transform.call({ error(message) { throw new Error(message); } }, altered, '/repo/js/glb-office-world-integration.js'),
    /expected one device-tier plan and one headset plan/
  );
});
