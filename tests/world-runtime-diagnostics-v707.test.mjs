import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectCalloriaWorldRuntimeSnapshot,
  formatCalloriaWorldRuntimeSnapshot
} from '../js/calloria-world-runtime-diagnostics-v707.js';
import { calloriaWorldRuntimeDiagnosticsPluginV707 } from '../build/calloria-world-runtime-diagnostics-v707.mjs';

function makeMesh({ name = 'mesh', visible = true, triangles = 12 } = {}) {
  return {
    name,
    visible,
    isMesh: true,
    geometry: { index: { count: triangles * 3 } },
    parent: null,
    traverse(visitor) { visitor(this); }
  };
}
function makeGroup(name, children = [], visible = true, userData = {}) {
  const group = {
    name, visible, children, userData, parent: null,
    traverse(visitor) {
      visitor(this);
      for (const child of this.children) {
        child.parent = this;
        child.traverse ? child.traverse(visitor) : visitor(child);
      }
    }
  };
  return group;
}
function makeScene(children = []) {
  const scene = makeGroup('scene', children);
  scene.updateMatrixWorld = () => {};
  return scene;
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
}
class Box3 {
  setFromObject(object) {
    this.min = object.bounds?.min || new Vector3(-1, 0, -1);
    this.max = object.bounds?.max || new Vector3(1, 2, 1);
    return this;
  }
  isEmpty() { return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z; }
  getSize(target) {
    target.x = this.max.x - this.min.x; target.y = this.max.y - this.min.y; target.z = this.max.z - this.min.z; return target;
  }
  getCenter(target) {
    target.x = (this.max.x + this.min.x) / 2; target.y = (this.max.y + this.min.y) / 2; target.z = (this.max.z + this.min.z) / 2; return target;
  }
}
class Matrix4 { multiplyMatrices() { return this; } }
class Frustum { setFromProjectionMatrix() { return this; } intersectsBox(box) { return box.max.x >= -5 && box.min.x <= 5; } }
const THREE = { Vector3, Box3, Matrix4, Frustum };

const sourceFixture = `
const __CALLORIA_GLB_FIRST_WORKPLACE_V22__ = true;
function init() {
  let glbHealthPanel = null;
  const scene = {}; const camera = {}; const renderer = {};
  glbHealthPanel = createCalloriaGLBHealthPanel({ host, tier });
  glbHealthPanel?.dispose?.();
}
`;

test('plugin transforms the current GLB-first world exactly once', () => {
  const plugin = calloriaWorldRuntimeDiagnosticsPluginV707();
  const result = plugin.transform.call({ warn: assert.fail }, sourceFixture, '/repo/js/production-world.js');
  assert.ok(result?.code.includes('__CALLORIA_WORLD_RUNTIME_DIAGNOSTICS_V707__'));
  assert.ok(result.code.includes("from './calloria-world-runtime-diagnostics-v707.js'"));
  assert.ok(result.code.includes('THREE, scene, camera, renderer, tier'));
  assert.ok(result.code.includes('worldRuntimeDiagnostics?.dispose?.();'));
  assert.equal(plugin.transform.call({ warn: assert.fail }, result.code, '/repo/js/production-world.js'), null);
});

test('plugin ignores unrelated files', () => {
  const plugin = calloriaWorldRuntimeDiagnosticsPluginV707();
  assert.equal(plugin.transform.call({ warn: assert.fail }, sourceFixture, '/repo/js/main.js'), null);
});

test('plugin skips safely when the world base transform is absent', () => {
  const plugin = calloriaWorldRuntimeDiagnosticsPluginV707();
  let warning = '';
  const result = plugin.transform.call({ warn: (message) => { warning = message; } }, 'export const x = 1;', '/repo/js/production-world.js');
  assert.equal(result, null);
  assert.match(warning, /GLB-first workplace transform is not present/);
});

test('plugin skips safely when any insertion anchor is ambiguous', () => {
  const plugin = calloriaWorldRuntimeDiagnosticsPluginV707();
  let warning = '';
  const result = plugin.transform.call({ warn: (message) => { warning = message; } }, `${sourceFixture}\nlet glbHealthPanel = null;`, '/repo/js/production-world.js');
  assert.equal(result, null);
  assert.match(warning, /expected exactly one GLB health panel state anchor/);
});

test('snapshot counts scene meshes, visible meshes and triangles', () => {
  const visibleMesh = makeMesh({ triangles: 20 });
  const hiddenMesh = makeMesh({ visible: false, triangles: 8 });
  const scene = makeScene([visibleMesh, hiddenMesh]);
  const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene, tier: 'balanced' });
  assert.equal(snapshot.scene.meshes, 2);
  assert.equal(snapshot.scene.visibleMeshes, 1);
  assert.equal(snapshot.scene.triangles, 28);
});

test('snapshot separates staff and office GLB roots and reports actual mesh visibility', () => {
  const staffMesh = makeMesh({ triangles: 100 });
  const staff = makeGroup('calloria-glb-staff-female-agent-1', [staffMesh]);
  const officeMesh = makeMesh({ triangles: 40 });
  const office = makeGroup('calloria-glb-desk-station-12', [officeMesh]);
  const scene = makeScene([staff, office]);
  const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene, tier: 'high' });
  assert.equal(snapshot.glb.totalRoots, 2);
  assert.equal(snapshot.glb.staffRoots, 1);
  assert.equal(snapshot.glb.officeRoots, 1);
  assert.equal(snapshot.glb.staffVisible, 1);
  assert.equal(snapshot.glb.officeVisible, 1);
  assert.equal(snapshot.glb.placements[0].sourceAsset, 'female-agent');
  assert.equal(snapshot.glb.placements[1].sourceAsset, 'not-labelled');
});

test('snapshot respects hidden ancestors when reporting visible GLB placements', () => {
  const mesh = makeMesh();
  const root = makeGroup('calloria-glb-staff-male-agent-2', [mesh]);
  const hiddenParent = makeGroup('hidden-parent', [root], false);
  const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene: makeScene([hiddenParent]) });
  assert.equal(snapshot.glb.totalRoots, 1);
  assert.equal(snapshot.glb.visibleRoots, 0);
  assert.equal(snapshot.glb.placements[0].visible, false);
});

test('snapshot reports camera-frustum intersection without claiming occlusion visibility', () => {
  const inside = makeGroup('calloria-glb-desk-station-1', [makeMesh()]);
  inside.bounds = { min: new Vector3(-1, 0, -1), max: new Vector3(1, 2, 1) };
  const outside = makeGroup('calloria-glb-computer-station-2', [makeMesh()]);
  outside.bounds = { min: new Vector3(20, 0, 20), max: new Vector3(22, 2, 22) };
  const camera = { projectionMatrix: {}, matrixWorldInverse: {}, updateMatrixWorld() {} };
  const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene: makeScene([inside, outside]), camera });
  assert.equal(snapshot.glb.placements[0].inCameraFrustum, true);
  assert.equal(snapshot.glb.placements[1].inCameraFrustum, false);
});

test('snapshot reports canvas, renderer memory and WebGL context state', () => {
  const renderer = {
    domElement: { clientWidth: 420, clientHeight: 280, width: 840, height: 560 },
    info: { render: { calls: 22, triangles: 3400 }, memory: { geometries: 18, textures: 9 } },
    getPixelRatio: () => 2,
    getContext: () => ({ isContextLost: () => false })
  };
  const snapshot = collectCalloriaWorldRuntimeSnapshot({
    THREE, scene: makeScene(), renderer, environment: { innerWidth: 420, innerHeight: 280, devicePixelRatio: 2 }
  });
  assert.equal(snapshot.canvas.backingWidth, 840);
  assert.equal(snapshot.renderer.drawCalls, 22);
  assert.equal(snapshot.renderer.geometries, 18);
  assert.equal(snapshot.webgl.contextLost, false);
});

test('formatter produces a human-readable report for empty GLB scenes', () => {
  const snapshot = collectCalloriaWorldRuntimeSnapshot({ THREE, scene: makeScene(), tier: 'low' });
  const report = formatCalloriaWorldRuntimeSnapshot(snapshot);
  assert.match(report, /GRAPHICS TIER: low/);
  assert.match(report, /no named calloria-glb-\* roots/);
  assert.match(report, /does not modify or force model visibility/);
});

test('missing scene returns a safe diagnostic instead of throwing', () => {
  assert.deepEqual(collectCalloriaWorldRuntimeSnapshot({}), {
    ready: false,
    error: 'The active Three.js scene is unavailable.'
  });
});
