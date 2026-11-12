import test from 'node:test';
import assert from 'node:assert/strict';
import { __calloriaCC0StaffGLBBundleTest as internals } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

function makeGlbJson({ dimensions = [0.55, 1.72, 0.42], rootNode = null, extraNodes = [], extraMeshes = [], extraAccessors = [] } = {}) {
  const [width, height, depth] = dimensions;
  const positionCount = 90;
  const nodes = rootNode ? [rootNode] : [{ mesh: 0 }];
  nodes.push(...extraNodes);
  const json = {
    asset: { version: '2.0', generator: 'CALLORIA v6.22 transform-aware bounds fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }, ...extraMeshes],
    accessors: [{ count: positionCount, type: 'VEC3', min: [-width / 2, 0, -depth / 2], max: [width / 2, height, depth / 2] }, ...extraAccessors],
    buffers: [{ byteLength: 4 }]
  };
  return json;
}

function packGlbJson(json) {
  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const padding = (4 - (jsonBytes.length % 4)) % 4;
  if (padding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(padding, 0x20)]);
  const bin = Buffer.alloc(4);
  const out = Buffer.alloc(12 + 8 + jsonBytes.length + 8 + bin.length);
  out.write('glTF', 0, 'ascii'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBytes.length, 12); out.writeUInt32LE(0x4E4F534A, 16);
  jsonBytes.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jsonBytes.length); out.writeUInt32LE(0x004E4942, 24 + jsonBytes.length);
  bin.copy(out, 28 + jsonBytes.length);
  return out;
}

function makeStaticGlb(options) {
  const json = makeGlbJson(options);
  return packGlbJson(json);
}

test('measures world dimensions after a giant local mesh is scaled by its scene node', () => {
  const json = makeGlbJson({ dimensions: [209.05, 179.96, 42.45], rootNode: { mesh: 0, scale: [0.01, 0.01, 0.01] } });
  const result = internals.parseGlb(packGlbJson(json));
  assert.ok(Math.abs(result.dimensions.x - 2.0905) < 1e-4);
  assert.ok(Math.abs(result.dimensions.y - 1.7996) < 1e-4);
  assert.ok(Math.abs(result.dimensions.z - 0.4245) < 1e-4);
  assert.equal(result.boundsSource, 'active-scene-node-transforms');
});

test('applies parent scale to a small child model through the scene hierarchy', () => {
  const json = makeGlbJson({
    dimensions: [0.18, 0.13, 0.09],
    rootNode: { scale: [10, 13.2, 4.8], children: [1] },
    extraNodes: [{ mesh: 0 }]
  });
  const result = internals.parseGlb(packGlbJson(json));
  assert.ok(Math.abs(result.dimensions.x - 1.8) < 1e-6);
  assert.ok(Math.abs(result.dimensions.y - 1.716) < 1e-6);
  assert.ok(Math.abs(result.dimensions.z - 0.432) < 1e-6);
});

test('supports glTF matrix transforms and ignores unreachable mesh geometry for character bounds', () => {
  const json = makeGlbJson({ dimensions: [0.55, 1.72, 0.42] });
  // Matrix with uniform 1.5 scale and translation (4, 2, -3).
  json.nodes[0].matrix = [1.5, 0, 0, 0, 0, 1.5, 0, 0, 0, 0, 1.5, 0, 4, 2, -3, 1];
  json.meshes.push({ primitives: [{ attributes: { POSITION: 1 } }] });
  json.accessors.push({ count: 3, type: 'VEC3', min: [-100, -100, -100], max: [100, 100, 100] });
  const result = internals.parseGlb(packGlbJson(json));
  assert.ok(Math.abs(result.dimensions.x - 0.825) < 1e-6);
  assert.ok(Math.abs(result.dimensions.y - 2.58) < 1e-6);
  assert.ok(Math.abs(result.dimensions.z - 0.63) < 1e-6);
});

test('rejects cyclic scene hierarchies instead of looping during validation', () => {
  const json = makeGlbJson({ rootNode: { children: [1] }, extraNodes: [{ mesh: 0, children: [0] }] });
  assert.throws(() => internals.parseGlb(packGlbJson(json)), /cycle/);
});

test('does not loosen the final world-space human proportion limits', () => {
  const oversized = makeStaticGlb({ dimensions: [12, 18, 8] });
  assert.throws(() => internals.parseGlb(oversized), /staff-character range/);
});

test('applies quaternion rotation when computing scene-space extents', () => {
  const half = Math.SQRT1_2;
  const json = makeGlbJson({ dimensions: [0.55, 1.72, 0.42], rootNode: { mesh: 0, rotation: [0, half, 0, half] } });
  const result = internals.parseGlb(packGlbJson(json));
  assert.ok(Math.abs(result.dimensions.x - 0.42) < 1e-6);
  assert.ok(Math.abs(result.dimensions.y - 1.72) < 1e-6);
  assert.ok(Math.abs(result.dimensions.z - 0.55) < 1e-6);
});
