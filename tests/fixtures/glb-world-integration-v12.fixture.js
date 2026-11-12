/**
 * CALLORIA approved GLB staff integration.
 * Only assets explicitly approved in the inspector are considered. The first
 * rollout replaces seated/standing staff only when a matching named animation
 * clip exists; all other characters retain the existing local implementation.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

const INSPECTOR_STORAGE_KEY = 'calloria.glb-inspector.v1';
const CANDIDATE_IDS = [
  'male-agent',
  'female-agent',
  'gp5-woman',
  'mr-r',
  'office-lady-character',
  'archeologist-girl'
];
const IDLE_CLIP = /idle|stand|standing|rest|breath|listen|talk|conversation/i;
const SEATED_CLIP = /sit|sitting|seated|typing|type|computer|desk|work/i;

function readApprovedIds() {
  try {
    const data = JSON.parse(localStorage.getItem(INSPECTOR_STORAGE_KEY) || '{}');
    return new Set(Array.isArray(data.approvedAssetIds) ? data.approvedAssetIds : []);
  } catch {
    return new Set();
  }
}

function inspectRuntimeModel(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const metrics = { meshes: 0, skinnedMeshes: 0, triangles: 0, materials: new Set(), textures: new Set(), bones: new Set() };
  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'];

  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    metrics.meshes += 1;
    if (object.isSkinnedMesh) {
      metrics.skinnedMeshes += 1;
      if (object.skeleton) metrics.bones.add(object.skeleton);
    }
    const position = object.geometry?.getAttribute?.('position');
    const count = object.geometry?.index?.count ?? position?.count ?? 0;
    metrics.triangles += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      metrics.materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) metrics.textures.add(material[slot]);
    }
  });

  const textureEdge = [...metrics.textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);

  return {
    bounds,
    size: { x: size.x, y: size.y, z: size.z },
    meshCount: metrics.meshes,
    skinnedMeshCount: metrics.skinnedMeshes,
    skeletonCount: metrics.bones.size,
    boneCount: [...metrics.bones].reduce((sum, skeleton) => sum + (skeleton.bones?.length || 0), 0),
    triangleCount: metrics.triangles,
    materialCount: metrics.materials.size,
    textureCount: metrics.textures.size,
    maxTextureEdge: textureEdge
  };
}

function chooseClip(clips, seated) {
  const pattern = seated ? SEATED_CLIP : IDLE_CLIP;
  return (clips || []).find((clip) => pattern.test(String(clip.name || '')))
    || null;
}

function disposeSourceModels(models) {
  for (const loaded of models.values()) disposeGLTFResources(loaded);
  models.clear();
}

export async function integrateCalloriaGLBStaff({ THREE: suppliedThree, scene, staff, tier = 'balanced' } = {}) {
  const T = suppliedThree || THREE;
  if (!T?.Scene || !scene?.add || !Array.isArray(staff)) {
    throw new TypeError('CALLORIA GLB integration requires the active Three.js scene and staff list.');
  }

  const approvedIds = readApprovedIds();
  const candidates = CANDIDATE_IDS
    .filter((id) => approvedIds.has(id))
    .map((id) => GLB_ASSET_REGISTRY.find((asset) => asset.id === id))
    .filter(Boolean);

  const maxCandidates = tier === 'low' ? 2 : tier === 'high' ? 4 : 3;
  const maxReplacements = tier === 'low' ? 2 : tier === 'high' ? 6 : 4;
  const maxTriangles = tier === 'low' ? 45000 : tier === 'high' ? 150000 : 90000;
  const loader = new GLTFLoader();
  const loadedModels = new Map();
  const mixers = [];
  const replacements = [];
  const rejected = [];
  const staffTargets = staff.filter((person) => person && person.root && !person.walking);

  if (!candidates.length || !staffTargets.length) {
    return {
      status: {
        loaded: 0,
        fallback: staff.length,
        mode: 'merged-articulated-local-staff',
        approvedCandidates: candidates.length,
        reason: candidates.length ? 'No compatible staff positions were available.' : 'No character models have been approved in the GLB inspector.'
      },
      update() {},
      dispose() {}
    };
  }

  for (const asset of candidates.slice(0, maxCandidates)) {
    try {
      const gltf = await loader.loadAsync(asset.url);
      const metrics = inspectRuntimeModel(gltf);
      const humanScale = metrics.size.y >= 1.0 && metrics.size.y <= 2.6
        && metrics.size.x >= 0.2 && metrics.size.x <= 1.35
        && metrics.size.z >= 0.12 && metrics.size.z <= 1.35;
      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;
      const geometryValid = metrics.triangleCount > 0 && metrics.triangleCount <= maxTriangles && metrics.meshCount <= 90;
      const texturesValid = metrics.maxTextureEdge <= 4096;
      const requiredExtensions = gltf.parser?.json?.extensionsRequired || [];
      const extensionsValid = !requiredExtensions.some((extension) => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension));

      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {
        const reasons = [];
        if (!humanScale) reasons.push('dimensions outside human scale range');
        if (!rigValid) reasons.push('usable character skeleton not detected');
        if (!geometryValid) reasons.push(`geometry exceeds ${maxTriangles.toLocaleString()} triangles or 90 meshes`);
        if (!texturesValid) reasons.push('texture exceeds 4096 pixels');
        if (!extensionsValid) reasons.push('required compression decoder is not configured');
        rejected.push({ id: asset.id, reasons });
        disposeGLTFResources(gltf);
        continue;
      }
      loadedModels.set(asset.id, { gltf, asset, metrics });
    } catch (error) {
      rejected.push({ id: asset.id, reasons: [String(error?.message || error)] });
    }
  }

  if (!loadedModels.size) {
    return {
      status: {
        loaded: 0,
        fallback: staff.length,
        mode: 'merged-articulated-local-staff',
        approvedCandidates: candidates.length,
        rejected
      },
      update() {},
      dispose() { disposeSourceModels(loadedModels); }
    };
  }

  const usable = [...loadedModels.values()];
  for (const person of staffTargets) {
    if (replacements.length >= maxReplacements) break;
    let selected = null;
    let clip = null;
    for (let offset = 0; offset < usable.length; offset += 1) {
      const candidate = usable[(replacements.length + offset) % usable.length];
      const candidateClip = chooseClip(candidate.gltf.animations, Boolean(person.seated));
      if (candidateClip) {
        selected = candidate;
        clip = candidateClip;
        break;
      }
    }
    if (!selected || !clip) continue;

    const sourceRoot = selected.gltf.scene;
    const clonedRoot = sourceRoot.getObjectByProperty('isSkinnedMesh', true)
      ? cloneSkeleton(sourceRoot)
      : sourceRoot.clone(true);
    clonedRoot.updateMatrixWorld(true);
    const originalBounds = new T.Box3().setFromObject(clonedRoot);
    const originalHeight = Math.max(0.001, originalBounds.max.y - originalBounds.min.y);
    const targetHeight = person.seated ? 1.28 : 1.72;
    clonedRoot.scale.multiplyScalar(targetHeight / originalHeight);
    clonedRoot.updateMatrixWorld(true);
    const scaledBounds = new T.Box3().setFromObject(clonedRoot);
    const scaledCenter = scaledBounds.getCenter(new T.Vector3());
    clonedRoot.position.x -= scaledCenter.x;
    clonedRoot.position.z -= scaledCenter.z;
    clonedRoot.position.y -= scaledBounds.min.y;

    const wrapper = new T.Group();
    wrapper.name = `calloria-glb-staff-${selected.asset.id}-${replacements.length + 1}`;
    wrapper.position.copy(person.root.position);
    wrapper.rotation.y = person.root.rotation.y;
    wrapper.add(clonedRoot);
    scene.add(wrapper);

    const mixer = new T.AnimationMixer(clonedRoot);
    mixer.clipAction(clip).reset().play();
    mixers.push(mixer);

    person.root.visible = false;
    if (person.shadow) person.shadow.visible = false;
    replacements.push({ wrapper, mixer, person, assetId: selected.asset.id, clipName: clip.name });
  }

  return {
    status: {
      loaded: replacements.length,
      fallback: Math.max(0, staff.length - replacements.length),
      mode: replacements.length ? 'approved-glb-staff-with-local-fallback' : 'merged-articulated-local-staff',
      approvedCandidates: candidates.length,
      compatibleModels: loadedModels.size,
      rejected
    },
    update(delta) {
      const step = Math.max(0, Math.min(Number(delta) || 0, 0.05));
      for (const mixer of mixers) mixer.update(step);
    },
    dispose() {
      for (const entry of replacements) {
        entry.mixer.stopAllAction();
        scene.remove(entry.wrapper);
        entry.person.root.visible = true;
        if (entry.person.shadow) entry.person.shadow.visible = true;
      }
      replacements.length = 0;
      mixers.length = 0;
      disposeSourceModels(loadedModels);
    }
  };
}
