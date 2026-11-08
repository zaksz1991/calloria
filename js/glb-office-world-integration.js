/**
 * CALLORIA production office GLB layer.
 * Replaces a small, high-visibility subset of primitive workstations with the
 * user's real desk/computer/headset/reception GLBs. Unselected stations retain
 * their efficient instanced fallback geometry for mobile performance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

const LIMITS = Object.freeze({
  desk: { low: 450000, balanced: 650000, high: 850000 },
  computer: { low: 100000, balanced: 150000, high: 220000 },
  headset: { low: 30000, balanced: 45000, high: 65000 },
  reception: { low: 180000, balanced: 280000, high: 400000 }
});

export function getOfficeAssetPlan(tier = 'balanced', stationCount = 12) {
  const safeTier = ['low', 'balanced', 'high'].includes(tier) ? tier : 'balanced';
  const available = Math.max(0, Math.min(12, Number(stationCount) || 0));
  const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];
  const deskStationIndexes = preferred.filter((index) => index < available);
  return {
    deskStationIndexes,
    computerStationIndexes: [...deskStationIndexes],
    headsetStationIndexes: safeTier === 'low' ? [] : [...deskStationIndexes],
    includeReceptionDesk: safeTier !== 'low',
    tier: safeTier
  };
}

function getAsset(id) {
  const asset = GLB_ASSET_REGISTRY.find((entry) => entry.id === id);
  if (!asset) throw new Error(`CALLORIA office asset is missing from the registry: ${id}`);
  return asset;
}

function inspectModel(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  let meshCount = 0;
  let triangles = 0;
  const materials = new Set();
  const textures = new Set();
  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshCount += 1;
    const count = object.geometry?.index?.count ?? object.geometry?.getAttribute?.('position')?.count ?? 0;
    triangles += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const mats = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of mats) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
  });
  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);
  return { bounds, size, meshCount, triangles, materialCount: materials.size, textureCount: textures.size, maxTextureEdge };
}

function validateAsset(assetId, metrics, tier) {
  const role = assetId === 'office-desk' ? 'desk'
    : assetId === 'office-computer' ? 'computer'
      : assetId === 'headset-model' ? 'headset'
        : assetId === 'reception-desk' ? 'reception' : 'unknown';
  const maxTriangles = LIMITS[role]?.[tier] || 0;
  const validBounds = metrics.size.x > 0.01 && metrics.size.y > 0.01 && metrics.size.z > 0.01
    && metrics.size.x < 1000 && metrics.size.y < 1000 && metrics.size.z < 1000;
  const required = [];
  if (!validBounds) required.push('invalid or implausible dimensions');
  if (!metrics.meshCount || metrics.meshCount > 120) required.push('mesh count outside supported range');
  if (!metrics.triangles || metrics.triangles > maxTriangles) required.push(`triangle budget exceeded (${maxTriangles.toLocaleString()} for ${tier} tier)`);
  if (metrics.maxTextureEdge > 4096) required.push('texture exceeds 4096 pixels');
  return { valid: required.length === 0, reasons: required, role };
}

function cloneAndFit(loaded, target, { alignLongAxis = false, yaw = 0 } = {}) {
  const root = loaded.gltf.scene.clone(true);
  root.rotation.y = yaw;
  root.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(root);
  let size = bounds.getSize(new THREE.Vector3());
  if (alignLongAxis && size.z > size.x) {
    root.rotation.y += Math.PI / 2;
    root.updateMatrixWorld(true);
    bounds = new THREE.Box3().setFromObject(root);
    size = bounds.getSize(new THREE.Vector3());
  }
  const factor = Math.min(target.x / Math.max(size.x, 0.001), target.y / Math.max(size.y, 0.001), target.z / Math.max(size.z, 0.001));
  root.scale.multiplyScalar(factor);
  root.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(root);
  const center = bounds.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= bounds.min.y;
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh) {
      object.castShadow = false;
      object.receiveShadow = false;
      object.frustumCulled = true;
    }
  });
  return root;
}

function hideInstancedEntries(scene, name, indexes, stride = 1) {
  const mesh = scene.getObjectByName(name);
  if (!mesh?.isInstancedMesh || !indexes.length) return 0;
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  let changed = 0;
  for (const stationIndex of indexes) {
    for (let sub = 0; sub < stride; sub += 1) {
      const instanceIndex = stationIndex * stride + sub;
      if (instanceIndex >= mesh.count) continue;
      mesh.getMatrixAt(instanceIndex, matrix);
      matrix.decompose(position, quaternion, scale);
      scale.set(0, 0, 0);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(instanceIndex, matrix);
      changed += 1;
    }
  }
  if (changed) mesh.instanceMatrix.needsUpdate = true;
  return changed;
}

function hideNamedObjects(scene, names) {
  let hidden = 0;
  for (const name of names) {
    const object = scene.getObjectByName(name);
    if (object) { object.visible = false; hidden += 1; }
  }
  return hidden;
}

function addFittedInstance(scene, loaded, name, position, target, options = {}) {
  const wrapper = new THREE.Group();
  wrapper.name = name;
  wrapper.position.set(position.x, position.y || 0, position.z);
  const root = cloneAndFit(loaded, target, options);
  root.userData.calloriaSourceAsset = loaded.asset.id;
  wrapper.add(root);
  scene.add(wrapper);
  return wrapper;
}

export async function integrateCalloriaGLBOfficeAssets({ THREE: suppliedThree, scene, stations = [], tier = 'balanced' } = {}) {
  const T = suppliedThree || THREE;
  if (!T?.Scene || !scene?.add || !Array.isArray(stations)) {
    throw new TypeError('CALLORIA office GLB integration requires the active Three.js scene and station list.');
  }
  const plan = getOfficeAssetPlan(tier, stations.length);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loaded = new Map();
  const placed = [];
  const errors = [];
  let disposed = false;

  async function loadAsset(id) {
    if (loaded.has(id)) return loaded.get(id);
    const asset = getAsset(id);
    const gltf = await loader.loadAsync(asset.url);
    if (disposed) { disposeGLTFResources(gltf); throw new Error('Office GLB load completed after the world was disposed.'); }
    const metrics = inspectModel(gltf);
    const check = validateAsset(id, metrics, plan.tier);
    if (!check.valid) {
      disposeGLTFResources(gltf);
      throw new Error(`${asset.name}: ${check.reasons.join('; ')}`);
    }
    const record = { asset, gltf, metrics, role: check.role };
    loaded.set(id, record);
    return record;
  }

  async function attempt(id, fn) {
    try {
      const record = await loadAsset(id);
      if (disposed) return;
      const result = fn(record);
      if (Array.isArray(result)) placed.push(...result);
      else if (result) placed.push(result);
    } catch (error) {
      errors.push({ assetId: id, message: String(error?.message || error) });
    }
  }

  // Desks first: only the visible front row is replaced with actual GLBs.
  const desk = await (async () => {
    try { return await loadAsset('office-desk'); }
    catch (error) { errors.push({ assetId: 'office-desk', message: String(error?.message || error) }); return null; }
  })();
  if (!disposed && desk) {
    for (const index of plan.deskStationIndexes) {
      const station = stations[index];
      if (!station) continue;
      const wrapper = addFittedInstance(scene, desk, `calloria-glb-desk-station-${station.id}`, { x: station.x, z: station.z }, { x: 2.60, y: 0.98, z: 1.28 }, { alignLongAxis: true });
      placed.push(wrapper);
    }
    // Hide only the corresponding primitive desk pieces; the other stations
    // remain instanced and cheap to draw.
    hideInstancedEntries(scene, 'agent-desk-surfaces', plan.deskStationIndexes);
    hideInstancedEntries(scene, 'agent-desk-aprons', plan.deskStationIndexes);
    hideInstancedEntries(scene, 'agent-desk-legs', plan.deskStationIndexes, 4);
    hideInstancedEntries(scene, 'desk-acoustic-dividers', plan.deskStationIndexes);
  }

  if (!disposed && plan.computerStationIndexes.length) {
    await attempt('office-computer', (record) => plan.computerStationIndexes.flatMap((index) => {
      const station = stations[index];
      if (!station) return [];
      // The authored contact-centre workstation uses two screens. Place one
      // actual computer GLB at each original monitor position, not one unit
      // floating between the two hidden primitive monitors.
      const screens = [-0.52, 0.52].map((offset, screenIndex) =>
        addFittedInstance(
          scene,
          record,
          `calloria-glb-computer-station-${station.id}-${screenIndex + 1}`,
          { x: station.x + offset, y: 0.84, z: station.z - 0.44 },
          { x: 0.88, y: 0.78, z: 0.48 }
        )
      );
      hideInstancedEntries(scene, 'monitor-bezels', [index], 2);
      hideInstancedEntries(scene, 'monitor-active-screens', [index], 2);
      hideInstancedEntries(scene, 'monitor-stands', [index], 2);
      return screens;
    }));
  }

  if (!disposed && plan.headsetStationIndexes.length) {
    await attempt('headset-model', (record) => plan.headsetStationIndexes.map((index) => {
      const station = stations[index];
      if (!station) return null;
      return addFittedInstance(scene, record, `calloria-glb-headset-station-${station.id}`, { x: station.x + 1.0, y: 0.84, z: station.z + 0.18 }, { x: 0.30, y: 0.30, z: 0.30 });
    }).filter(Boolean));
  }

  if (!disposed && plan.includeReceptionDesk) {
    await attempt('reception-desk', (record) => {
      const wrapper = addFittedInstance(scene, record, 'calloria-glb-reception-desk', { x: -15.0, z: 11.85 }, { x: 5.05, y: 1.42, z: 1.45 }, { alignLongAxis: true });
      hideNamedObjects(scene, ['reception-counter-top', 'reception-counter-front', 'reception-counter-accent']);
      return wrapper;
    });
  }

  const assets = [...new Set(placed.map((entry) => entry.children?.[0]?.userData?.calloriaSourceAsset).filter(Boolean))];
  const status = {
    placed: placed.length,
    assets,
    tier: plan.tier,
    deskStations: desk ? plan.deskStationIndexes.map((index) => stations[index]?.id).filter(Boolean) : [],
    errors
  };

  return {
    status,
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const object of placed) scene.remove(object);
      placed.length = 0;
      for (const entry of loaded.values()) disposeGLTFResources(entry.gltf);
      loaded.clear();
    }
  };
}
