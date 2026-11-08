import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectGlbBuffer } from '../tools/glb-audit.mjs';

function makeGlb(json) {
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPaddedLength = Math.ceil(jsonBytes.length / 4) * 4;
  const bin = Buffer.alloc(48);
  const jsonChunk = Buffer.alloc(jsonPaddedLength, 0x20);
  jsonBytes.copy(jsonChunk);
  const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
}

const fixture = {
  asset: { version: '2.0', generator: 'CALLORIA fixture' },
  buffers: [{ byteLength: 48 }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 12 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  nodes: [{ mesh: 0 }],
  scenes: [{ nodes: [0] }]
};

test('audits a valid GLB v2 container and estimates primitive triangles', () => {
  const result = inspectGlbBuffer(makeGlb(fixture), 'fixture.glb');
  assert.equal(result.validGlbContainer, true);
  assert.equal(result.glbVersion, 2);
  assert.equal(result.gltfVersion, '2.0');
  assert.equal(result.meshes, 1);
  assert.equal(result.primitives, 1);
  assert.equal(result.vertices, 4);
  assert.equal(result.triangles, 2);
});

test('rejects a non-GLB file', () => {
  assert.throws(() => inspectGlbBuffer(Buffer.from('not glb'), 'bad.glb'), /too small|invalid GLB magic/);
});

test('rejects an unsupported GLB version', () => {
  const bytes = makeGlb(fixture);
  bytes.writeUInt32LE(1, 4);
  assert.throws(() => inspectGlbBuffer(bytes, 'v1.glb'), /version 1 is unsupported/);
});

test('flags geometry/material/texture budgets without inventing compatibility', () => {
  const heavy = structuredClone(fixture);
  heavy.meshes[0].primitives[0].indices = undefined;
  heavy.accessors[0].count = 900003;
  const result = inspectGlbBuffer(makeGlb(heavy), 'heavy.glb');
  assert.equal(result.triangles, 300001);
  assert.ok(result.warnings.some((warning) => warning.includes('triangle count')));
});
