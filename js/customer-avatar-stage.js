import * as THREE from 'three';
import { CalloriaGLBAssetLoader } from './glb-asset-loader.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';
import { getCustomerMotionProfile, chooseApprovedCustomerAssets, validateCustomerRigMetrics } from './customer-avatar-profile.js';
import '../styles/calloria-customer-avatar.css';

const APPROVAL_KEY = 'calloria.glb-inspector.v1';
const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap'];
const sharedLoader = new CalloriaGLBAssetLoader();
let activeStage = null;
let stageSequence = 0;

function approvedCustomerIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPROVAL_KEY) || '{}');
    return Array.isArray(saved.approvedAssetIds) ? saved.approvedAssetIds : [];
  } catch {
    return [];
  }
}

function inspect(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('The GLB does not contain a default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const metrics = { size: { x: size.x, y: size.y, z: size.z }, meshCount: 0, skinnedMeshCount: 0, skeletonCount: 0, boneCount: 0, triangleCount: 0, maxTextureEdge: 0 };
  const skeletons = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    metrics.meshCount += 1;
    if (object.isSkinnedMesh) {
      metrics.skinnedMeshCount += 1;
      if (object.skeleton) skeletons.add(object.skeleton);
    }
    const position = object.geometry?.getAttribute?.('position');
    const count = object.geometry?.index?.count ?? position?.count ?? 0;
    metrics.triangleCount += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
  });
  metrics.skeletonCount = skeletons.size;
  metrics.boneCount = [...skeletons].reduce((sum, skeleton) => sum + (skeleton.bones?.length || 0), 0);
  metrics.maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);
  return { bounds, metrics };
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function boneSide(name) {
  if (name.includes('left') || name.startsWith('l') || name.endsWith('l')) return 'left';
  if (name.includes('right') || name.startsWith('r') || name.endsWith('r')) return 'right';
  return '';
}
function makeRig(root) {
  const bones = { head: null, neck: null, spine: null, leftArm: null, rightArm: null };
  root.traverse((object) => {
    if (!object.isBone) return;
    const name = normalizeName(object.name);
    if (!bones.head && name.includes('head')) bones.head = object;
    if (!bones.neck && name.includes('neck')) bones.neck = object;
    if (!bones.spine && /(upperchest|chest|spine2|spine1|spine)/.test(name)) bones.spine = object;
    if (/(upperarm|shoulder|arm)/.test(name)) {
      const side = boneSide(name);
      if (side === 'left' && !bones.leftArm) bones.leftArm = object;
      if (side === 'right' && !bones.rightArm) bones.rightArm = object;
    }
  });
  return Object.fromEntries(Object.entries(bones).map(([key, bone]) => [key, bone ? {
    bone,
    x: bone.rotation.x,
    y: bone.rotation.y,
    z: bone.rotation.z
  } : null]));
}

function chooseClip(animations, emotion) {
  const moodPattern = {
    angry: /angry|frustrat|complain|argue/i,
    hostile: /angry|frustrat|complain|argue/i,
    happy: /happy|smile|joy/i,
    playful: /happy|wave|talk|gesture/i,
    confused: /confus|think|question/i,
    anxious: /nervous|worried|anxious/i,
    distressed: /sad|cry|distress|worried/i,
    suspicious: /guard|skeptic|question/i,
    skeptical: /guard|skeptic|question/i,
    urgent: /urgent|impatient|talk|speak/i,
    talkative: /talk|speak|conversation/i
  }[emotion] || /talk|speak|conversation/i;
  return (animations || []).find((clip) => moodPattern.test(String(clip.name || '')))
    || (animations || []).find((clip) => /talk|speak|conversation|idle|stand|listen/i.test(String(clip.name || '')))
    || null;
}

function escapeHTML(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\"', '&quot;').replaceAll("'", '&#39;');
}

function setMessage(host, title, detail) {
  host.innerHTML = `<div class="calloria-customer-stage-message"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(detail)}</span><a href="/asset-inspector.html">Open GLB Asset Inspector</a></div>`;
}

function disposeStage(stage) {
  if (!stage || stage.disposed) return;
  stage.disposed = true;
  if (stage.frame) cancelAnimationFrame(stage.frame);
  stage.resizeObserver?.disconnect();
  stage.listeners.forEach((remove) => remove());
  stage.mixer?.stopAllAction();
  stage.scene?.remove(stage.model);
  stage.scene?.remove(stage.floor);
  stage.floor?.geometry?.dispose?.();
  stage.floor?.material?.dispose?.();
  stage.renderer?.dispose();
  stage.host?.classList.remove('is-ready', 'is-loading', 'is-unavailable');
}

function attachDrag(stage) {
  const canvas = stage.renderer.domElement;
  let pointer = null;
  let lastX = 0;
  const down = (event) => { pointer = event.pointerId; lastX = event.clientX; canvas.setPointerCapture?.(pointer); };
  const move = (event) => {
    if (pointer !== event.pointerId) return;
    stage.model.rotation.y += (event.clientX - lastX) * 0.008;
    lastX = event.clientX;
  };
  const up = (event) => { if (pointer === event.pointerId) pointer = null; };
  const wheel = (event) => {
    event.preventDefault();
    stage.camera.position.z = THREE.MathUtils.clamp(stage.camera.position.z + Math.sign(event.deltaY) * 0.18, 2.5, 5.2);
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  stage.listeners.push(
    () => canvas.removeEventListener('pointerdown', down),
    () => canvas.removeEventListener('pointermove', move),
    () => canvas.removeEventListener('pointerup', up),
    () => canvas.removeEventListener('pointercancel', up),
    () => canvas.removeEventListener('wheel', wheel)
  );
}

export async function mountCalloriaCustomerAvatar(host) {
  if (activeStage) {
    disposeStage(activeStage);
    activeStage = null;
  }
  if (!host) return null;

  const token = ++stageSequence;
  const emotion = String(host.dataset.emotion || 'calm').toLowerCase();
  const reaction = String(host.dataset.reaction || 'steady').toLowerCase();
  const persona = String(host.dataset.persona || 'calm').toLowerCase();
  const approved = approvedCustomerIds();
  const candidateIds = chooseApprovedCustomerAssets(approved, host.dataset.session || host.dataset.customer || 'customer');
  if (!candidateIds.length) {
    host.classList.add('is-unavailable');
    setMessage(host, 'Customer 3D model not approved', 'Open the GLB Inspector, visually review Robbert or Ribbert, and approve a suitable rigged human model. No unreviewed character is displayed.');
    return { status: 'approval-required' };
  }

  host.classList.add('is-loading');
  host.innerHTML = '<div class="calloria-customer-stage-loading">Loading approved customer model…</div><div class="calloria-customer-stage-caption"><span>3D CUSTOMER VIEW · SYNTHETIC PRACTICE</span><b></b></div>';
  const caption = host.querySelector('.calloria-customer-stage-caption b');
  if (caption) caption.textContent = host.dataset.customer || 'Simulated customer';

  let loaded = null;
  let asset = null;
  let assetId = null;
  let metrics = null;
  const rejected = [];
  for (const candidateId of candidateIds) {
    const candidateAsset = GLB_ASSET_REGISTRY.find((item) => item.id === candidateId);
    if (!candidateAsset) {
      rejected.push(`${candidateId}: missing from the CALLORIA model registry`);
      continue;
    }
    try {
      const candidateLoaded = await sharedLoader.load(candidateId);
      if (token !== stageSequence || !host.isConnected) return null;
      const candidateMetrics = inspect(candidateLoaded.gltf).metrics;
      const validation = validateCustomerRigMetrics(candidateMetrics);
      if (!validation.compatible) {
        rejected.push(`${candidateId}: ${validation.reasons.join('; ')}`);
        continue;
      }
      loaded = candidateLoaded;
      metrics = candidateMetrics;
      asset = candidateAsset;
      assetId = candidateId;
      break;
    } catch (error) {
      rejected.push(`${candidateId}: ${String(error?.message || error).slice(0, 160)}`);
    }
  }
  if (token !== stageSequence || !host.isConnected) return null;
  if (!loaded || !asset || !assetId || !metrics) {
    host.classList.remove('is-loading');
    host.classList.add('is-unavailable');
    setMessage(host, 'No approved customer model passed runtime checks', rejected.join(' · ') || 'Approve a compatible rigged customer or visitor model in the GLB Inspector.');
    return { status: 'rejected', reasons: rejected };
  }

  const model = sharedLoader.clone(assetId);
  model.updateMatrixWorld(true);
  const modelBounds = new THREE.Box3().setFromObject(model);
  const originalHeight = Math.max(0.001, modelBounds.max.y - modelBounds.min.y);
  model.scale.multiplyScalar(1.62 / originalHeight);
  model.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(model);
  const center = scaledBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= scaledBounds.min.y;
  model.rotation.y = Math.PI;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111d2b');
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 1.02, 3.75);
  camera.lookAt(0, 0.82, 0);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
  } catch (error) {
    host.classList.remove('is-loading');
    host.classList.add('is-unavailable');
    setMessage(host, '3D customer preview unavailable', 'This browser or device could not initialise WebGL. The customer simulation remains available.');
    return { status: 'webgl-unavailable', error: String(error?.message || error) };
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  renderer.domElement.setAttribute('aria-label', `Animated 3D representation of synthetic ${host.dataset.customer || 'customer'} profile`);
  renderer.domElement.className = 'calloria-customer-stage-canvas';
  host.querySelector('.calloria-customer-stage-loading')?.remove();
  host.prepend(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xe5f2ff, 0x38434d, 1.65));
  const key = new THREE.DirectionalLight(0xffead6, 2.1);
  key.position.set(2.8, 4.5, 3.8);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8bc7db, 0.72);
  fill.position.set(-3.2, 2.4, -2.4);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(0.82, 36),
    new THREE.MeshStandardMaterial({ color: '#253b49', roughness: 0.92, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  scene.add(floor, model);

  const mixer = loaded.animations.length ? new THREE.AnimationMixer(model) : null;
  const clip = chooseClip(loaded.animations, emotion);
  if (mixer && clip) mixer.clipAction(clip).reset().play();
  const rig = makeRig(model);
  const profile = getCustomerMotionProfile(emotion, reaction);
  const stage = { host, scene, camera, renderer, model, floor, mixer, rig, profile, listeners: [], resizeObserver: null, frame: 0, disposed: false, lastFrame: 0 };
  activeStage = stage;
  attachDrag(stage);

  const resize = () => {
    if (stage.disposed || !host.isConnected) return;
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(180, host.clientHeight - 36);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };
  stage.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  stage.resizeObserver?.observe(host);
  if (!stage.resizeObserver) window.addEventListener('resize', resize);
  stage.listeners.push(() => window.removeEventListener('resize', resize));
  resize();
  host.classList.remove('is-loading', 'is-unavailable');
  host.classList.add('is-ready');
  if (caption) caption.textContent = `${host.dataset.customer || 'Simulated customer'} · ${asset.name}`;

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const tick = (time) => {
    if (stage.disposed || token !== stageSequence || !host.isConnected) return;
    stage.frame = requestAnimationFrame(tick);
    if (document.hidden || (time - stage.lastFrame < 32)) return;
    const delta = stage.lastFrame ? Math.min((time - stage.lastFrame) / 1000, 0.05) : 1 / 30;
    stage.lastFrame = time;
    if (mixer && clip) mixer.update(delta);
    const t = reducedMotion ? 0 : time / 1000;
    const breath = Math.sin(t * 1.35) * 0.006 * profile.energy;
    const gesture = reducedMotion ? 0 : Math.sin(t * (2.1 + profile.energy * 1.4)) * 0.008 * profile.energy;
    const apply = (entry, x, y, z) => {
      if (!entry?.bone) return;
      entry.bone.rotation.set(entry.x + x, entry.y + y, entry.z + z);
    };
    apply(rig.head, profile.headForward + breath, profile.headTilt + gesture * 0.35, gesture * 0.45);
    apply(rig.neck, profile.headForward * 0.22, profile.headTilt * 0.15, 0);
    apply(rig.spine, profile.spine + breath, 0, breath * 0.35);
    apply(rig.leftArm, 0, 0, profile.leftArm + gesture);
    apply(rig.rightArm, 0, 0, profile.rightArm - gesture);
    if (!reducedMotion) model.position.y = Math.sin(t * 1.2) * 0.004;
    renderer.render(scene, camera);
  };
  stage.frame = requestAnimationFrame(tick);
  return { status: 'ready', assetId, metrics, animation: clip?.name || 'procedural mood gesture' };
}

window.addEventListener('pagehide', (event) => {
  if (event.persisted) return;
  if (activeStage) disposeStage(activeStage);
  activeStage = null;
  sharedLoader.disposeAll();
});
