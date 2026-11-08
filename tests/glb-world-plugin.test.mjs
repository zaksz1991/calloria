import test from 'node:test';
import assert from 'node:assert/strict';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';

const ready = "  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });";
const update = '      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;';
const dispose = '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();';
const fixture = `export async function initProductionWorld(THREE, host, callbacks = {}) {\n  const scene = new THREE.Scene();\n  const staff = [];\n  function animate(delta, timestamp) {\n${update}\n  }\n  ${ready}\n  return { dispose() {\n      ${dispose}\n  } };\n}`;

test('production-world adapter injects approved GLB loading, animation updates and disposal', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, fixture, '/repo/js/production-world.js');
  assert.ok(result?.code);
  assert.match(result.code, /from '\.\/glb-world-integration\.js'/);
  assert.match(result.code, /await integrateCalloriaGLBStaff/);
  assert.match(result.code, /glbWorldLayer\?\.update\?\./);
  assert.match(result.code, /glbWorldLayer\?\.dispose\?\./);
});

test('adapter ignores unrelated modules', () => {
  const plugin = calloriaGLBWorldPlugin();
  assert.equal(plugin.transform.call({}, fixture, '/repo/js/main.js'), null);
});

test('adapter refuses stale production-world source instead of applying a partial patch', () => {
  const plugin = calloriaGLBWorldPlugin();
  assert.throws(
    () => plugin.transform.call({ error(message) { throw new Error(message); } }, 'export async function initProductionWorld() {}', '/repo/js/production-world.js'),
    /expected exactly one production-world anchor/
  );
});
