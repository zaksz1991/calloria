import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CC0_STAFF_MODELS,
  createCalloriaCC0StaffGLBBundlePlugin,
  __calloriaCC0StaffGLBBundleTest as internals
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

function makeGlb({ animations = [], joints = 13, skinned = true, triangles = 30, dimensions = [0.55, 1.72, 0.42] } = {}) {
  const [width, height, depth] = dimensions;
  const positionCount = triangles * 3;
  const nodes = skinned
    ? [{ mesh: 0, skin: 0 }, ...Array.from({ length: joints }, () => ({}))]
    : [{ mesh: 0 }];
  const primitiveAttributes = { POSITION: 0 };
  const accessors = [{ count: positionCount, type: 'VEC3', min: [-width / 2, 0, -depth / 2], max: [width / 2, height, depth / 2] }];
  const skins = [];
  if (skinned) {
    primitiveAttributes.JOINTS_0 = 1;
    primitiveAttributes.WEIGHTS_0 = 2;
    accessors.push({ count: positionCount, type: 'VEC4' }, { count: positionCount, type: 'VEC4' });
    skins.push({ joints: Array.from({ length: joints }, (_, index) => index + 1) });
  }
  const json = {
    asset: { version: '2.0', generator: 'CALLORIA v6.12 compatibility fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [{ primitives: [{ attributes: primitiveAttributes }] }],
    accessors,
    buffers: [{ byteLength: 4 }],
    ...(skins.length ? { skins } : {}),
    ...(animations.length ? {
      animations: animations.map((name) => ({
        name,
        samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }],
        channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }]
      }))
    } : {})
  };
  let jsonBytes = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPadding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const binBytes = Buffer.alloc(4);
  const totalLength = 12 + 8 + jsonBytes.length + 8 + binBytes.length;
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBytes.length, 0);
  jsonHeader.writeUInt32LE(0x4E4F534A, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBytes.length, 0);
  binHeader.writeUInt32LE(0x004E4942, 4);
  return Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binBytes]);
}

function mockResponse(bytes, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Not Found',
    headers: { get: () => String(bytes?.length || 0) },
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

const fullyAnimated = makeGlb({ animations: ['Idle', 'Walk'], joints: 18, skinned: true });
const thirteenJointStatic = makeGlb({ animations: [], joints: 13, skinned: true });
const unskinnedStatic = makeGlb({ animations: [], skinned: false });

 test('catalogue retains the five existing registry IDs, pinned URLs and destinations', () => {
  assert.deepEqual(CC0_STAFF_MODELS.map((entry) => entry.id), [
    'female-agent', 'male-agent', 'gp5-woman', 'mr-r', 'office-lady-character'
  ]);
  for (const entry of CC0_STAFF_MODELS) {
    const url = new URL(entry.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'gobkit.com');
    assert.ok(entry.path.startsWith('characters/agents/'));
  }
});

test('accepts fully animated, 18-joint skinned staff GLBs', () => {
  const result = internals.parseGlb(fullyAnimated);
  assert.equal(result.version, 2);
  assert.equal(result.boneCount, 18);
  assert.equal(result.triangleCount, 30);
  assert.equal(result.renderMode, 'animated-skinned');
  assert.equal(result.hasIdle, true);
  assert.equal(result.hasWalk, true);
  assert.equal(result.motionMode, 'embedded-animation');
});

test('accepts the 13-joint skinned static-pose models seen in the Vercel build log', () => {
  const result = internals.parseGlb(thirteenJointStatic);
  assert.equal(result.boneCount, 13);
  assert.equal(result.hasSkin, true);
  assert.equal(result.hasSkinnedPrimitive, true);
  assert.equal(result.animationCount, 0);
  assert.equal(result.renderMode, 'skinned-static-pose');
  assert.equal(result.motionMode, 'static-pose-only');
});

test('accepts an unskinned posed staff mesh as a static-mesh GLB', () => {
  const result = internals.parseGlb(unskinnedStatic);
  assert.equal(result.hasSkin, false);
  assert.equal(result.hasSkinnedPrimitive, false);
  assert.equal(result.boneCount, 0);
  assert.equal(result.renderMode, 'static-mesh');
  assert.deepEqual(result.dimensions, { x: 0.55, y: 1.72, z: 0.42 });
});

test('rejects malformed containers, external dependencies, excessive geometry and invalid character bounds', () => {
  const badMagic = Buffer.from(fullyAnimated); badMagic.write('nope', 0, 'ascii');
  assert.throws(() => internals.parseGlb(badMagic), /magic/);
  const badLength = Buffer.from(fullyAnimated); badLength.writeUInt32LE(fullyAnimated.length + 1, 8);
  assert.throws(() => internals.parseGlb(badLength), /length mismatch/);
  assert.throws(() => internals.parseGlb(makeGlb({ triangles: 50000 })), /asset budget/);
  assert.throws(() => internals.parseGlb(makeGlb({ dimensions: [12, 18, 8] })), /staff-character range/);

  const json = JSON.parse(fullyAnimated.toString('utf8', 20, 20 + fullyAnimated.readUInt32LE(12)).replace(/[\u0000\u0020]+$/g, ''));
  json.buffers[0].uri = 'external.bin';
  const bad = packGlbJson(json);
  assert.throws(() => internals.parseGlb(bad), /external buffer/);
});

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

test('reuses valid existing 13-joint files without redownloading or overwriting them', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v612-existing-'));
  try {
    for (const asset of CC0_STAFF_MODELS) {
      const output = join(rootDir, 'public', 'assets', 'models', asset.path);
      await mkdir(join(output, '..'), { recursive: true });
      await writeFile(output, thirteenJointStatic);
    }
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async () => { throw new Error('Should not fetch valid local assets.'); }
    });
    const messages = [];
    await plugin.buildStart.call({ info: (message) => messages.push(message), warn: (message) => messages.push(message) });
    assert.deepEqual(plugin.api.getAvailableStaffIds(), CC0_STAFF_MODELS.map((entry) => entry.id));
    assert.equal(Object.keys(plugin.api.getStaffRenderModes()).length, 5);
    for (const asset of CC0_STAFF_MODELS) {
      const output = join(rootDir, 'public', 'assets', 'models', asset.path);
      assert.equal((await stat(output)).size, thirteenJointStatic.length);
      assert.deepEqual(await readFile(output), thirteenJointStatic);
    }
    const manifestPath = join(rootDir, 'public', 'assets', 'models', 'calloria-cc0-staff-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.schemaVersion, 2);
    assert.equal(manifest.status, 'complete');
    assert.equal(manifest.validatedStaffModels, 5);
    assert.equal(manifest.animatedStaffModels, 0);
    assert.equal(manifest.staticPoseStaffModels, 5);
    assert.equal(manifest.renderModeCounts['skinned-static-pose'], 5);
    assert.ok(messages.some((message) => message.includes('5/5 structurally compatible')));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('candidate rewrite only advertises accepted IDs and filters saved approvals to those IDs', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v612-transform-'));
  try {
    const first = CC0_STAFF_MODELS[0];
    const output = join(rootDir, 'public', 'assets', 'models', first.path);
    await mkdir(join(output, '..'), { recursive: true });
    await writeFile(output, unskinnedStatic);
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({ rootDir, fetchImpl: async () => { throw new Error('offline'); }, attempts: 1 });
    await plugin.buildStart.call({ info() {}, warn() {} });
    const fixture = await readFile(new URL('./fixtures/glb-world-integration-v12.fixture.js', import.meta.url), 'utf8');
    const source = fixture.replace('const CANDIDATE_IDS = [', 'const PRIMARY_CANDIDATES = [');
    const transformed = plugin.transform(source, '/repo/js/glb-world-integration.js');
    assert.match(transformed.code, /__CALLORIA_CC0_STAFF_GLB_RUNTIME_V614__/);
    assert.match(transformed.code, /const PRIMARY_CANDIDATES = \[\"female-agent\"\];/);
    assert.match(transformed.code, /CALLORIA_STAFF_RENDER_MODES/);
    assert.match(transformed.code, /CALLORIA_STAFF_DEFAULT_CANDIDATES/);
    assert.match(transformed.code, /staticPosePlaced/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('offline download failure remains non-fatal and does not activate unavailable models', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v612-offline-'));
  try {
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async () => { throw new Error('network unavailable'); },
      attempts: 1,
      wait: async () => {}
    });
    const warnings = [];
    await plugin.buildStart.call({ info() {}, warn: (message) => warnings.push(message) });
    assert.deepEqual(plugin.api.getAvailableStaffIds(), []);
    const manifest = JSON.parse(await readFile(join(rootDir, 'public/assets/models/calloria-cc0-staff-manifest.json'), 'utf8'));
    assert.equal(manifest.status, 'unavailable');
    assert.equal(manifest.failedStaffModels, 5);
    assert.equal(warnings.length, 5);
    assert.equal(plugin.transform("const PRIMARY_CANDIDATES = ['male-agent', 'female-agent'];", '/repo/js/glb-world-integration.js'), null);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('preserves v3.9 Vite factory API and public manifest path', () => {
  const plugin = createCalloriaCC0StaffGLBBundlePlugin();
  assert.equal(plugin.name, 'calloria-cc0-staff-glb-bundle-v3-9');
  assert.equal(internals.MANIFEST_RELATIVE, 'assets/models/calloria-cc0-staff-manifest.json');
  assert.equal(typeof plugin.buildStart, 'function');
  assert.equal(typeof plugin.transform, 'function');
  assert.deepEqual(internals.PREFERRED_ANIMATIONS, ['idle', 'walk', 'run']);
});
