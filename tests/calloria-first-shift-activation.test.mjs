import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';

const anchors = [
  "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });",
  '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;',
  '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();',
  '      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);',
  '    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });',
  '    callbacks.onImmersiveChange?.(immersive);',
  '      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;'
];

function context() {
  return {
    error(message) { throw new Error(message); }
  };
}

function sourceFixture() {
  return [
    'const clamp = (value, min, max) => Math.max(min, Math.min(max, value));',
    'export async function initProductionWorld(THREE, host, callbacks = {}) {',
    '  const scene = new THREE.Scene();',
    '  const staff = [];',
    '  const stations = [{ id: 11, x: 2.9, z: 5.6 }];',
    '  const player = { x: 0, z: 15, yaw: 0, pitch: 0 };',
    anchors[0],
    '  function animate(timestamp) {',
    anchors[1],
    '  }',
    '  function dispose() {',
    anchors[2],
    '  }',
    '  function updatePlayer() {',
    anchors[3],
    '  }',
    '  function useNearestStation() {',
    '    if (!nearestStation) return;',
    anchors[4],
    '  }',
    '  function setImmersive(immersive) {',
    anchors[5],
    '  }',
    '  function enter() {',
    anchors[6],
    '  }',
    '}'
  ].join('\n');
}

test('transforms the current production-world source and adds all three GLB/game modules', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call(context(), sourceFixture(), '/repo/js/production-world.js');
  assert.ok(result?.code);
  assert.match(result.code, /integrateCalloriaGLBStaff/);
  assert.match(result.code, /integrateCalloriaGLBOfficeAssets/);
  assert.match(result.code, /createCalloriaWorldMission/);
  assert.match(result.code, /office GLB layer unavailable/);
  assert.match(result.code, /GLB STAFF:/);
});

test('spawns the player at Agent Station 11 and retains a safe fallback', () => {
  const plugin = calloriaGLBWorldPlugin();
  const { code } = plugin.transform.call(context(), sourceFixture(), '/repo/js/production-world.js');
  assert.match(code, /station\.id === 11/);
  assert.match(code, /player\.z = assignedStartStation\.z \+ 2\.05/);
  assert.match(code, /player\.z = 15\.0/);
});

test('dispatches objective events for nearest station, USE and immersive state', () => {
  const plugin = calloriaGLBWorldPlugin();
  const { code } = plugin.transform.call(context(), sourceFixture(), '/repo/js/production-world.js');
  assert.match(code, /calloria:world-nearest-station/);
  assert.match(code, /calloria:world-station-accessed/);
  assert.match(code, /calloria:world-immersive/);
});

test('updates and disposes staff, office and mission layers in the existing lifecycle', () => {
  const plugin = calloriaGLBWorldPlugin();
  const { code } = plugin.transform.call(context(), sourceFixture(), '/repo/js/production-world.js');
  assert.match(code, /glbWorldLayer\?\.update\?\.\(delta\)/);
  assert.match(code, /glbOfficeLayer\?\.update\?\.\(delta\)/);
  assert.match(code, /glbWorldLayer\?\.dispose\?\.\(\)/);
  assert.match(code, /glbOfficeLayer\?\.dispose\?\.\(\)/);
  assert.match(code, /worldMissionLayer\?\.dispose\?\.\(\)/);
});

test('does not transform unrelated modules and is idempotent', () => {
  const plugin = calloriaGLBWorldPlugin();
  assert.equal(plugin.transform.call(context(), sourceFixture(), '/repo/js/main.js'), null);
  const first = plugin.transform.call(context(), sourceFixture(), '/repo/js/production-world.js');
  assert.equal(plugin.transform.call(context(), first.code, '/repo/js/production-world.js'), null);
});

test('fails closed when the upstream source contract changes', () => {
  const plugin = calloriaGLBWorldPlugin();
  assert.throws(
    () => plugin.transform.call(context(), sourceFixture().replace(anchors[6], 'player.x = 5;'), '/repo/js/production-world.js'),
    /expected exactly one initial player spawn anchor/
  );
});

test('mission objective avoids claiming an operation was completed before it opens', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(here, '../js/world-gameplay-mission.js'), 'utf8');
  assert.match(source, /The inbound service workspace is opening/);
  assert.match(source, /FIRST SHIFT · STEP 1 OF 3/);
  assert.match(source, /FIRST SHIFT · STEP 2 OF 3/);
  assert.match(source, /FIRST SHIFT · STEP 3 OF 3/);
});
