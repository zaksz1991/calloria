import test from 'node:test';
import assert from 'node:assert/strict';
import { createProceduralIdlePose, updateProceduralIdlePose } from '../js/glb-character-motion.js';

function bone(name) {
  return { name, isBone: true, rotation: { x: 0.1, y: 0.2, z: 0.3 } };
}
function rig(names) {
  const objects = names.map(bone);
  return { objects, traverse(fn) { for (const object of objects) fn(object); } };
}

test('discovers common Mixamo and generic bone names', () => {
  const profile = createProceduralIdlePose(rig([
    'mixamorig:Head', 'mixamorig:Neck', 'mixamorig:Spine2',
    'mixamorig:LeftArm', 'mixamorig:RightArm'
  ]));
  assert.ok(profile);
  assert.ok(profile.head);
  assert.ok(profile.neck);
  assert.ok(profile.spine);
  assert.ok(profile.leftArm);
  assert.ok(profile.rightArm);
});

test('returns null for rigs without recognised bones', () => {
  assert.equal(createProceduralIdlePose(rig(['Root', 'Hips', 'Bone.001'])), null);
});

test('idle motion changes bone rotations without accumulating drift', () => {
  const root = rig(['Head', 'Neck', 'Spine', 'LeftArm', 'RightArm']);
  const profile = createProceduralIdlePose(root);
  assert.equal(updateProceduralIdlePose(profile, 1.25, 0.3), true);
  const first = root.objects.map((item) => ({ ...item.rotation }));
  assert.equal(updateProceduralIdlePose(profile, 1.25, 0.3), true);
  const second = root.objects.map((item) => ({ ...item.rotation }));
  assert.deepEqual(second, first);
});

test('gracefully ignores an empty profile', () => {
  assert.equal(updateProceduralIdlePose(null, 1), false);
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

test('preserves the exact Vite Meshopt transform anchors', async () => {
  const source = await readFile(path.join(here, '../js/glb-world-integration.js'), 'utf8');
  assert.ok(source.includes("import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';"));
  assert.ok(source.includes('  const loader = new GLTFLoader();'));
  assert.ok(source.includes("      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));"));
});

test('retains seated-animation safety and the primary asset shortlist', async () => {
  const source = await readFile(path.join(here, '../js/glb-world-integration.js'), 'utf8');
  assert.ok(source.includes("const PRIMARY_CANDIDATES = ['male-agent', 'female-agent'];"));
  assert.ok(source.includes('if (!person.seated)'));
  assert.ok(source.includes('if (!clip && !idleProfile)'));
  assert.ok(source.includes('disposeGLTFResources(loaded.gltf)'));
});
