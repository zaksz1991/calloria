import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CC0_STAFF_MODELS,
  createCalloriaCC0StaffGLBBundlePlugin,
  __calloriaCC0StaffGLBBundleTest as internals
} from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

function makeGlb({ animations = ['Idle', 'Walk'], joints = 18, triangles = 30 } = {}) {
  const nodes = [{ mesh: 0, skin: 0 }, ...Array.from({ length: joints }, () => ({}))];
  const json = {
    asset: { version: '2.0', generator: 'CALLORIA v3.9 regression fixture' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ joints: Array.from({ length: joints }, (_, index) => index + 1) }],
    accessors: [
      { count: triangles * 3, type: 'VEC3', min: [-0.3, 0, -0.2], max: [0.3, 1.75, 0.2] },
      { count: triangles * 3, type: 'VEC4' },
      { count: triangles * 3, type: 'VEC4' }
    ],
    animations: animations.map((name) => ({
      name,
      samplers: [{ input: 0, output: 1, interpolation: 'LINEAR' }],
      channels: [{ sampler: 0, target: { node: 1, path: 'rotation' } }]
    })),
    buffers: [{ byteLength: 4 }]
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

const fixture = makeGlb();

test('pinned model catalogue contains five existing CALLORIA staff registry IDs and approved Gobkit URLs', () => {
  assert.equal(CC0_STAFF_MODELS.length, 5);
  assert.deepEqual(CC0_STAFF_MODELS.map((item) => item.id), [
    'female-agent', 'male-agent', 'gp5-woman', 'mr-r', 'office-lady-character'
  ]);
  for (const asset of CC0_STAFF_MODELS) {
    const url = new URL(asset.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.hostname, 'gobkit.com');
    assert.ok(asset.url.endsWith('.glb'));
    assert.ok(asset.path.startsWith('characters/agents/'));
  }
});

test('validates GLB v2 container, skinning, usable skeleton and Idle/Walk clips', () => {
  const result = internals.parseGlb(fixture);
  assert.equal(result.version, 2);
  assert.equal(result.boneCount, 18);
  assert.equal(result.triangleCount, 30);
  assert.deepEqual(result.animationNames, ['idle', 'walk']);
  assert.equal(result.bytes, fixture.length);
});

test('rejects malformed headers, truncated lengths, missing skeletons and missing clips', () => {
  const badMagic = Buffer.from(fixture);
  badMagic.write('nope', 0, 'ascii');
  assert.throws(() => internals.parseGlb(badMagic), /magic/);
  const badLength = Buffer.from(fixture);
  badLength.writeUInt32LE(fixture.length + 1, 8);
  assert.throws(() => internals.parseGlb(badLength), /length mismatch/);
  assert.throws(() => internals.parseGlb(makeGlb({ joints: 10 })), /at least 15/);
  assert.throws(() => internals.parseGlb(makeGlb({ animations: ['Walk'] })), /idle/);
  assert.throws(() => internals.parseGlb(makeGlb({ triangles: 50000 })), /runtime budget/);
});

test('rejects external buffer and image dependencies', () => {
  const sourceJson = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, skin: 0 }, ...Array.from({ length: 18 }, () => ({}))],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 } }] }],
    skins: [{ joints: Array.from({ length: 18 }, (_, index) => index + 1) }],
    accessors: [{ count: 90 }, { count: 90 }, { count: 90 }],
    animations: ['Idle', 'Walk'].map((name) => ({ name, channels: [{}] })),
    buffers: [{ byteLength: 4, uri: 'external.bin' }]
  };
  let jsonBytes = Buffer.from(JSON.stringify(sourceJson));
  const padding = (4 - jsonBytes.length % 4) % 4;
  if (padding) jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(padding, 0x20)]);
  const bin = Buffer.alloc(4);
  const out = Buffer.alloc(20 + jsonBytes.length + 8 + bin.length);
  out.write('glTF', 0, 'ascii'); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonBytes.length, 12); out.writeUInt32LE(0x4E4F534A, 16);
  jsonBytes.copy(out, 20);
  out.writeUInt32LE(bin.length, 20 + jsonBytes.length); out.writeUInt32LE(0x004E4942, 24 + jsonBytes.length);
  bin.copy(out, 28 + jsonBytes.length);
  assert.throws(() => internals.parseGlb(out), /external buffer/);
});

test('buildStart downloads, validates and writes five local staff GLBs plus a provenance manifest', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v39-'));
  try {
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async (url) => {
        assert.ok(CC0_STAFF_MODELS.some((asset) => asset.url === url));
        return mockResponse(fixture);
      },
      wait: async () => {},
      attempts: 1,
      timeoutMs: 1000
    });
    const messages = [];
    await plugin.buildStart.call({ info: (message) => messages.push(message), warn: (message) => messages.push(message) });
    assert.deepEqual(plugin.api.getAvailableStaffIds(), CC0_STAFF_MODELS.map((asset) => asset.id));
    for (const asset of CC0_STAFF_MODELS) {
      const path = join(rootDir, 'public', 'assets', 'models', asset.path);
      assert.equal((await stat(path)).size, fixture.length);
      assert.deepEqual(await readFile(path), fixture);
    }
    const manifestPath = join(rootDir, 'public', 'assets', 'models', 'calloria-cc0-staff-manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.status, 'complete');
    assert.equal(manifest.validatedStaffModels, 5);
    assert.equal(manifest.failedStaffModels, 0);
    assert.match(manifest.license, /CC0 1\.0/);
    assert.ok(messages.some((message) => message.includes('5/5 validated')));

    const source = "const PRIMARY_CANDIDATES = ['male-agent', 'female-agent'];\nfunction readApprovedIds(){ return new Set(explicit.length ? explicit : PRIMARY_CANDIDATES); }";
    const transformed = plugin.transform(source, '/repo/js/glb-world-integration.js');
    assert.match(transformed.code, /__CALLORIA_CC0_STAFF_GLB_BUNDLE_V39__/);
    assert.match(transformed.code, /const PRIMARY_CANDIDATES = \["female-agent","male-agent","gp5-woman","mr-r","office-lady-character"\];/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('partial upstream failure activates only models that passed validation and records unavailable assets', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v39-partial-'));
  try {
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async (url) => url === CC0_STAFF_MODELS[0].url ? mockResponse(fixture) : mockResponse(Buffer.alloc(0), 404),
      wait: async () => {},
      attempts: 1,
      timeoutMs: 1000
    });
    const warnings = [];
    await plugin.buildStart.call({ info() {}, warn: (message) => warnings.push(message) });
    assert.deepEqual(plugin.api.getAvailableStaffIds(), ['female-agent']);
    const manifest = JSON.parse(await readFile(join(rootDir, 'public/assets/models/calloria-cc0-staff-manifest.json'), 'utf8'));
    assert.equal(manifest.status, 'partial');
    assert.equal(manifest.validatedStaffModels, 1);
    assert.equal(manifest.failedStaffModels, 4);
    assert.equal(warnings.length, 4);
    const transformed = plugin.transform("const PRIMARY_CANDIDATES = ['male-agent', 'female-agent'];", '/repo/js/glb-world-integration.js');
    assert.match(transformed.code, /const PRIMARY_CANDIDATES = \["female-agent"\];/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('network failure is non-fatal and leaves the old runtime candidate array intact', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v39-offline-'));
  try {
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async () => { throw new Error('network unavailable'); },
      wait: async () => {},
      attempts: 1,
      timeoutMs: 1000
    });
    const warnings = [];
    await plugin.buildStart.call({ info() {}, warn: (message) => warnings.push(message) });
    assert.deepEqual(plugin.api.getAvailableStaffIds(), []);
    const manifest = JSON.parse(await readFile(join(rootDir, 'public/assets/models/calloria-cc0-staff-manifest.json'), 'utf8'));
    assert.equal(manifest.status, 'unavailable');
    assert.equal(manifest.failedStaffModels, 5);
    assert.equal(warnings.length, 5);
    const source = "const PRIMARY_CANDIDATES = ['male-agent', 'female-agent'];";
    assert.equal(plugin.transform(source, '/repo/js/glb-world-integration.js'), null);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('leaves an existing valid local GLB untouched and does not require a download', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'calloria-v39-existing-'));
  try {
    const first = CC0_STAFF_MODELS[0];
    const output = join(rootDir, 'public', 'assets', 'models', first.path);
    const { mkdir, writeFile } = await import('node:fs/promises');
    await mkdir(join(rootDir, 'public', 'assets', 'models', 'characters', 'agents'), { recursive: true });
    await writeFile(output, fixture);
    const plugin = createCalloriaCC0StaffGLBBundlePlugin({
      rootDir,
      fetchImpl: async (url) => url === first.url ? mockResponse(fixture) : mockResponse(fixture),
      wait: async () => {}, attempts: 1, timeoutMs: 1000
    });
    await plugin.buildStart.call({ info() {}, warn() {} });
    const manifest = JSON.parse(await readFile(join(rootDir, 'public/assets/models/calloria-cc0-staff-manifest.json'), 'utf8'));
    assert.equal(manifest.models[0].status, 'validated-existing');
    assert.deepEqual(await readFile(output), fixture);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});


test('merged Vite configuration runs the asset bundle after static-staff compatibility and before OJT validation', async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const config = await readFile(join(here, '..', 'vite.config.js'), 'utf8');
  const staticIndex = config.indexOf('calloriaStaticGLBStaffPlugin()');
  const bundleIndex = config.indexOf('calloriaCC0StaffGLBBundlePlugin()');
  const ojtIndex = config.indexOf('calloriaOJTGLBActivationPlugin()');
  assert.ok(staticIndex >= 0 && bundleIndex > staticIndex && ojtIndex > bundleIndex);
  assert.match(config, /from '\.\/build\/calloria-cc0-staff-glb-bundle-plugin\.mjs';/);
  assert.match(config, /calloriaOJTGLBActivationPlugin\(\)\s*\n\s*\],/);
});
