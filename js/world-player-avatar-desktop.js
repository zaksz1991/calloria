/* __CALLORIA_PLAYER_WORK_TALK_CLIPS_V25__ */
/**
 * CALLORIA third-person player avatar.
 * Loads one real agent GLB and follows the existing first-person controller.
 * If the asset is missing or invalid, it fails closed and leaves the original
 * camera/controller operational.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

const MODEL_IDS = Object.freeze(['male-agent', 'female-agent']);
const CLIP_PATTERNS = Object.freeze({
  idle: /idle|stand|standing|rest|breath|listen/i,
  walk: /walk|walking|locomotion|move/i,
  run: /run|running|sprint/i,
  work: /sit|sitting|seated|typing|type|computer|desk|work/i,
  talk: /talk|talking|speak|speaking|conversation|call|phone/i
});
const MAX_TRIANGLES = Object.freeze({ low: 90000, balanced: 140000, high: 200000 });

function inspectScene(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  let meshes = 0;
  let triangles = 0;
  let skinned = 0;
  const skeletons = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshes += 1;
    if (object.isSkinnedMesh) {
      skinned += 1;
      if (object.skeleton) skeletons.add(object.skeleton);
    }
    const count = object.geometry?.index?.count ?? object.geometry?.getAttribute?.('position')?.count ?? 0;
    triangles += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
        if (material[slot]?.isTexture) textures.add(material[slot]);
      }
    }
  });
  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);
  return { bounds, size, meshes, triangles, skinned, bones: [...skeletons].reduce((n, skeleton) => n + (skeleton.bones?.length || 0), 0), maxTextureEdge };
}

function findClip(clips, pattern) {
  return clips.find((clip) => pattern.test(String(clip.name || ''))) || null;
}

function getCandidates() {
  let preferred = [];
  try {
    const saved = localStorage.getItem('calloria.player-avatar-model.v1');
    if (MODEL_IDS.includes(saved)) preferred.push(saved);
  } catch { /* Storage is optional. */ }
  return [...new Set([...preferred, ...MODEL_IDS])]
    .map((id) => GLB_ASSET_REGISTRY.find((asset) => asset.id === id))
    .filter(Boolean);
}

export async function createCalloriaPlayerAvatar({ scene, tier = 'balanced', onStatus } = {}) {
  if (!scene?.add || typeof scene.traverse !== 'function') {
    throw new TypeError('CALLORIA player avatar requires the active Three.js scene.');
  }
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  loader.setDRACOLoader(dracoLoader);
  const failures = [];
  let selected = null;
  let gltf = null;
  let metrics = null;

  for (const asset of getCandidates()) {
    try {
      const candidate = await loader.loadAsync(asset.url);
      const candidateMetrics = inspectScene(candidate.scene);
      const humanDimensions = candidateMetrics.size.y >= 0.8 && candidateMetrics.size.y <= 3.5
        && candidateMetrics.size.x > 0.08 && candidateMetrics.size.x <= 2.0
        && candidateMetrics.size.z > 0.08 && candidateMetrics.size.z <= 2.0;
      const geometryValid = candidateMetrics.meshes > 0
        && candidateMetrics.triangles > 0
        && candidateMetrics.triangles <= (MAX_TRIANGLES[tier] || MAX_TRIANGLES.balanced);
      const textureValid = candidateMetrics.maxTextureEdge <= 4096;
      if (!humanDimensions || !geometryValid || !textureValid) {
        failures.push({ assetId: asset.id, reason: [
          !humanDimensions ? 'dimensions outside avatar range' : null,
          !geometryValid ? `geometry exceeds ${MAX_TRIANGLES[tier] || MAX_TRIANGLES.balanced} triangles or has no meshes` : null,
          !textureValid ? 'texture exceeds 4096 pixels' : null
        ].filter(Boolean).join('; ') });
        disposeGLTFResources(candidate);
        continue;
      }
      selected = asset;
      gltf = candidate;
      metrics = candidateMetrics;
      break;
    } catch (error) {
      failures.push({ assetId: asset.id, reason: String(error?.message || error) });
    }
  }

  if (!selected || !gltf) {
    const status = { ready: false, assetId: null, reason: failures.map((item) => `${item.assetId}: ${item.reason}`).join(' | ') || 'No agent GLB assets were found.', failures };
    onStatus?.(status);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));
    return { status, active: false, setVisible() {}, update() {}, dispose() {} };
  }

  const source = gltf.scene;
  const hasSkinnedMesh = Boolean(source.getObjectByProperty('isSkinnedMesh', true));
  const model = hasSkinnedMesh ? cloneSkeleton(source) : source.clone(true);
  model.updateMatrixWorld(true);
  const modelBounds = new THREE.Box3().setFromObject(model);
  const originalHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
  model.scale.multiplyScalar(1.72 / originalHeight);
  model.updateMatrixWorld(true);
  const fittedBounds = new THREE.Box3().setFromObject(model);
  const center = fittedBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= fittedBounds.min.y;
  model.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh) {
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = true;
    }
  });

  const pivot = new THREE.Group();
  pivot.name = 'calloria-player-avatar-pivot';
  pivot.add(model);
  pivot.visible = false;
  scene.add(pivot);

  const clips = Array.isArray(gltf.animations) ? gltf.animations : [];
  const idleClip = findClip(clips, CLIP_PATTERNS.idle);
  const walkClip = findClip(clips, CLIP_PATTERNS.walk);
  const runClip = findClip(clips, CLIP_PATTERNS.run);
  const workClip = findClip(clips, CLIP_PATTERNS.work);
  const talkClip = findClip(clips, CLIP_PATTERNS.talk);
  const mixer = clips.length ? new THREE.AnimationMixer(model) : null;
  let activeAction = null;
  let activeClipName = '';
  function setClip(clip) {
    if (!mixer || !clip) return;
    if (activeClipName === clip.name && activeAction) {
      if (!activeAction.isRunning()) activeAction.reset().play();
      return;
    }
    const nextAction = mixer.clipAction(clip);
    nextAction.reset().play();
    if (activeAction) activeAction.crossFadeTo(nextAction, 0.22, false);
    activeAction = nextAction;
    activeClipName = clip.name;
  }
  if (idleClip) setClip(idleClip);
  else if (clips.length && !walkClip && !runClip) setClip(clips[0]);

  let visible = false;
  let bobPhase = 0;
  const status = {
    ready: true,
    assetId: selected.id,
    assetName: selected.name,
    triangles: metrics.triangles,
    meshes: metrics.meshes,
    skinnedMeshes: metrics.skinned,
    bones: metrics.bones,
    animationClips: clips.map((clip) => clip.name),
    hasIdle: Boolean(idleClip),
    hasWalk: Boolean(walkClip),
    hasRun: Boolean(runClip),
    hasWork: Boolean(workClip),
    hasTalk: Boolean(talkClip),
    staticMotionFallback: clips.length === 0,
    failures
  };
  onStatus?.(status);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));

  return {
    status,
    active: true,
    setVisible(value) {
      visible = Boolean(value);
      pivot.visible = visible;
    },
    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, activity = 'idle', delta = 0 } = {}) {
      if (!visible) return;
      pivot.position.set(Number(x) || 0, 0, Number(z) || 0);
      // The downloaded agent models are authored facing their local forward axis;
      // the half-turn aligns them with CALLORIA's world-forward (-Z) convention.
      pivot.rotation.y = (Number(yaw) || 0) + Math.PI;
      if (mixer) {
        const mode = activity === 'talking' ? 'talking' : activity === 'working' ? 'working' : 'moving';
        const desired = mode === 'talking'
          ? (talkClip || idleClip)
          : mode === 'working'
            ? (workClip || idleClip)
            : moving
              ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip)
              : (idleClip || (walkClip ? null : clips[0]));
        if (desired) setClip(desired);
        if (!moving && !idleClip && activeAction && walkClip) activeAction.stop();
        mixer.update(Math.min(Math.max(Number(delta) || 0, 0), 0.05));
      } else {
        // Models without animation clips remain real GLBs; only a restrained
        // whole-body stride bob is applied, never a fabricated skeletal rig.
        bobPhase += (Number(delta) || 0) * (sprinting ? 13 : 8) * (moving ? 1 : 0.16);
        model.position.y = Math.sin(bobPhase) * (moving ? 0.035 : 0.008);
        model.rotation.z = moving ? Math.sin(bobPhase * 0.5) * 0.025 : 0;
      }
    },
    dispose() {
      pivot.removeFromParent();
      if (mixer) mixer.stopAllAction();
      disposeGLTFResources(gltf);
      dracoLoader.dispose();
    }
  };
}
