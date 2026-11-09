import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaGLBStaffRuntimePlugin, __calloriaGLBStaffRuntimeTest as contract } from '../build/calloria-glb-staff-runtime-plugin.mjs';

const fixture = `import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
export async function integrateCalloriaGLBStaff({ staff }) {
  const loader = new GLTFLoader();
  const loadedModels = new Map();
  for (const asset of candidates.slice(0, maxCandidates)) {
    try {
      const gltf = await loader.loadAsync(asset.url);
      const metrics = inspectRuntimeModel(gltf);
      const humanScale = metrics.size.y >= 1.0 && metrics.size.y <= 2.6;
      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;
      const geometryValid = metrics.triangleCount > 0 && metrics.triangleCount <= maxTriangles && metrics.meshCount <= 90;
      const texturesValid = metrics.maxTextureEdge <= 4096;
      const requiredExtensions = gltf.parser?.json?.extensionsRequired || [];
      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));
      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {
        rejected.push({ id: asset.id });
        continue;
      }
      loadedModels.set(asset.id, { gltf, asset, metrics });
    } catch (error) {}
  }
  for (const person of staffTargets) {
    let selected = null;
    let clip = null;
    let useProceduralIdle = false;
    for (let offset = 0; offset < usable.length; offset += 1) {
      const candidate = usable[offset];
      const candidateClip = chooseClip(candidate.gltf.animations, Boolean(person.seated));
      if (candidateClip) { selected = candidate; clip = candidateClip; break; }
      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
      }
    }
    const idleProfile = useProceduralIdle ? createProceduralIdlePose(clonedRoot) : null;
    if (!clip && !idleProfile) {
      scene.remove(wrapper);
      continue;
    }
    replacements.push({
      wrapper, mixer, person, idleProfile, phase: 0, assetId: selected.asset.id,
      clipName: clip?.name || 'CALLORIA procedural skeletal idle'
    });
  }
  return { status: {
      loaded: replacements.length,
      fallback: Math.max(0, staff.length - replacements.length)
  } };
}`;

function runTransform(source = fixture) {
  const plugin = calloriaGLBStaffRuntimePlugin();
  const context = { error(message) { throw new Error(message); } };
  return plugin.transform.call(context, source, '/repo/js/glb-world-integration.js');
}

test('registers the Meshopt decoder in the staff GLB loader', () => {
  const result = runTransform();
  assert.match(result.code, /import \{ MeshoptDecoder \} from 'three\/addons\/libs\/meshopt_decoder\.module\.js';/);
  assert.match(result.code, /loader\.setMeshoptDecoder\(MeshoptDecoder\);/);
});

test('removes the arbitrary minimum bone-count rejection', () => {
  const result = runTransform();
  assert.doesNotMatch(result.code, /metrics\.boneCount >= 15/);
  assert.match(result.code, /const hasUsableRig = metrics\.skinnedMeshCount > 0 && metrics\.skeletonCount > 0;/);
});

test('allows Meshopt while continuing to reject unsupported Draco compression', () => {
  const result = runTransform();
  assert.match(result.code, /requiredExtensions\.includes\('KHR_draco_mesh_compression'\)/);
  assert.doesNotMatch(result.code, /extensions\.includes\('EXT_meshopt_compression'\)/);
});

test('permits mesh-only GLBs at standing positions but protects seated positions', () => {
  const result = runTransform();
  assert.match(result.code, /if \(!person\.seated\) \{[\s\S]*?if \(!candidate\.hasUsableRig\) \{[\s\S]*?useStaticModel = true;/);
  assert.match(result.code, /if \(!clip && !idleProfile && !useStaticModel\)/);
});

test('reports animated and static replacements separately', () => {
  const result = runTransform();
  assert.match(result.code, /animatedLoaded: replacements\.filter/);
  assert.match(result.code, /staticLoaded: replacements\.filter/);
  assert.match(result.code, /Static GLB — no embedded animation/);
});

test('is idempotent and ignores unrelated files', () => {
  const plugin = calloriaGLBStaffRuntimePlugin();
  const ctx = { error(message) { throw new Error(message); } };
  const first = plugin.transform.call(ctx, fixture, '/repo/js/glb-world-integration.js');
  const second = plugin.transform.call(ctx, first.code, '/repo/js/glb-world-integration.js');
  const unrelated = plugin.transform.call(ctx, fixture, '/repo/js/main.js');
  assert.equal(second, null);
  assert.equal(unrelated, null);
});

test('fails closed if the upstream source contract changes', () => {
  const source = fixture.replace(contract.RIG_CHECK, 'const rigValid = true;');
  assert.throws(() => runTransform(source), /expected exactly one legacy 15-bone restriction anchor/);
});

test('current Vite configuration retains prior plugins and registers this runtime patch last', async () => {
  const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /calloriaGLBWorldPlugin\(\)/);
  assert.match(vite, /calloriaThirdPersonPlayerPlugin\(\)/);
  assert.match(vite, /calloriaWorkstationExperiencePlugin\(\)/);
  assert.match(vite, /calloriaGLBStaffRuntimePlugin\(\)/);
  assert.ok(vite.indexOf('calloriaGLBStaffRuntimePlugin()') > vite.indexOf('calloriaWorkstationExperiencePlugin()'));
});
