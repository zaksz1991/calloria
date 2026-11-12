/**
 * CALLORIA v6.13 — production office GLB runtime.
 *
 * Keeps the v2.1 public API used by production-world.js and the exact v2.9/v3.8
 * Vite transform anchors. Real GLBs replace only the corresponding visible
 * fallback objects after a successful load, validation and placement.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLB_ASSET_REGISTRY } from './glb-asset-registry.js';
import { disposeGLTFResources } from './glb-asset-loader.js';
import { validateOfficeAssetMetrics } from './glb-office-asset-policy.js';

const TARGETS = Object.freeze({
  desk: Object.freeze({ x: 2.60, y: 0.98, z: 1.28 }),
  computer: Object.freeze({ x: 0.88, y: 0.78, z: 0.48 }),
  headset: Object.freeze({ x: 0.30, y: 0.30, z: 0.30 }),
  reception: Object.freeze({ x: 5.05, y: 1.42, z: 1.45 })
});

const ACTIVE_LAYERS = new WeakMap();

// Preserve the public plan function and exact Vite transform anchors from v2.9/v3.8.
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
  if (!asset) throw new Error(`Asset registry does not contain '${id}'.`);
  return asset;
}

function inspectModel(gltf, T = THREE) {
  const root = gltf?.scene;
  if (!root) throw new Error('GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new T.Box3().setFromObject(root);
  const size = bounds.getSize(new T.Vector3());
  let meshCount = 0;
  let triangles = 0;
  const materials = new Set();
  const textures = new Set();
  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshCount += 1;
    const vertexCount = object.geometry?.index?.count
      ?? object.geometry?.getAttribute?.('position')?.count
      ?? 0;
    triangles += Math.floor(vertexCount / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : object.material ? [object.material] : [];
    for (const material of objectMaterials) {
      materials.add(material);
      for (const slot of textureSlots) {
        if (material[slot]?.isTexture) textures.add(material[slot]);
      }
    }
  });
  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);
  return {
    bounds,
    size: { x: size.x, y: size.y, z: size.z },
    meshCount,
    triangles,
    materialCount: materials.size,
    textureCount: textures.size,
    maxTextureEdge
  };
}

function cloneAndFit(loaded, target, { alignLongAxis = false, yaw = 0 } = {}, T = THREE) {
  const root = loaded.gltf.scene.clone(true);
  root.rotation.y = yaw;
  root.updateMatrixWorld(true);
  let bounds = new T.Box3().setFromObject(root);
  let size = bounds.getSize(new T.Vector3());
  if (alignLongAxis && size.z > size.x) {
    root.rotation.y += Math.PI / 2;
    root.updateMatrixWorld(true);
    bounds = new T.Box3().setFromObject(root);
    size = bounds.getSize(new T.Vector3());
  }
  const factor = Math.min(
    target.x / Math.max(size.x, 0.001),
    target.y / Math.max(size.y, 0.001),
    target.z / Math.max(size.z, 0.001)
  );
  if (!Number.isFinite(factor) || factor <= 0) throw new Error('Model could not be fitted into its workstation dimensions.');
  root.scale.multiplyScalar(factor);
  root.updateMatrixWorld(true);
  bounds = new T.Box3().setFromObject(root);
  const center = bounds.getCenter(new T.Vector3());
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

function hideInstancedEntries(scene, name, indexes, stride = 1, T = THREE) {
  const mesh = scene.getObjectByName(name);
  if (!mesh?.isInstancedMesh || !indexes.length) return 0;
  const position = new T.Vector3();
  const quaternion = new T.Quaternion();
  const scale = new T.Vector3();
  const matrix = new T.Matrix4();
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
    if (object) {
      object.visible = false;
      hidden += 1;
    }
  }
  return hidden;
}

function addFittedInstance(scene, loaded, name, position, target, options = {}, T = THREE) {
  const wrapper = new T.Group();
  wrapper.name = name;
  wrapper.position.set(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
  const root = cloneAndFit(loaded, target, options, T);
  root.userData.calloriaSourceAsset = loaded.asset.id;
  root.userData.calloriaPlacement = name;
  wrapper.add(root);
  scene.add(wrapper);
  return wrapper;
}

function dispatchStatus(status) {
  if (typeof window === 'undefined' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent('calloria:office-glb-status', { detail: status }));
}

export async function integrateCalloriaGLBOfficeAssets({ THREE: suppliedThree, scene, stations = [], tier = 'balanced' } = {}) {
  const T = suppliedThree || THREE;
  if (!T?.Scene || !scene?.add || !Array.isArray(stations)) {
    throw new TypeError('CALLORIA office GLB integration requires the active Three.js scene and station list.');
  }
  const existing = ACTIVE_LAYERS.get(scene);
  if (existing && !existing.disposed) return existing;

  const plan = getOfficeAssetPlan(tier, stations.length);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const loaded = new Map();
  const loadPromises = new Map();
  const placed = [];
  const errors = [];
  const assetDetails = [];
  let disposed = false;

  async function loadAsset(id) {
    if (loaded.has(id)) return loaded.get(id);
    if (loadPromises.has(id)) return loadPromises.get(id);
    const promise = (async () => {
      const asset = getAsset(id);
      const gltf = await loader.loadAsync(asset.url);
      if (disposed) {
        disposeGLTFResources(gltf);
        throw new Error('World was disposed while the GLB was loading.');
      }
      const metrics = inspectModel(gltf, T);
      const check = validateOfficeAssetMetrics(id, metrics, plan.tier);
      const detail = {
        id,
        name: asset.name,
        path: asset.path,
        url: asset.url,
        status: check.valid ? 'validated' : 'rejected',
        renderMode: 'static-office-mesh',
        size: metrics.size,
        meshCount: metrics.meshCount,
        triangles: metrics.triangles,
        materialCount: metrics.materialCount,
        textureCount: metrics.textureCount,
        maxTextureEdge: metrics.maxTextureEdge,
        reasons: [...check.reasons]
      };
      assetDetails.push(detail);
      if (!check.valid) {
        disposeGLTFResources(gltf);
        throw new Error(`${asset.name} rejected: ${check.reasons.join('; ')}.`);
      }
      const record = { asset, gltf, metrics, role: check.role };
      loaded.set(id, record);
      return record;
    })();
    loadPromises.set(id, promise);
    try {
      return await promise;
    } catch (error) {
      loadPromises.delete(id);
      const message = String(error?.message || error);
      if (!assetDetails.some((entry) => entry.id === id && entry.status === 'load-failed')) {
        assetDetails.push({ id, name: id, path: null, status: 'load-failed', reasons: [message] });
      }
      throw error;
    }
  }

  function recordError(id, error) {
    const message = String(error?.message || error);
    errors.push({ assetId: id, message });
    const existingDetail = assetDetails.find((entry) => entry.id === id);
    if (existingDetail) {
      existingDetail.placementStatus = 'failed';
      existingDetail.placementError = message;
    }
  }

  async function placeAsset(id, placementFactory) {
    try {
      const record = await loadAsset(id);
      if (disposed) return;
      const result = placementFactory(record);
      const additions = Array.isArray(result) ? result.filter(Boolean) : result ? [result] : [];
      placed.push(...additions);
      const detail = assetDetails.find((entry) => entry.id === id);
      if (detail) {
        detail.placementStatus = additions.length ? 'placed' : 'validated-not-selected';
        detail.placementCount = additions.length;
      }
      return additions;
    } catch (error) {
      recordError(id, error);
      return [];
    }
  }

  const deskStationIndexes = plan.deskStationIndexes;
  const headsetStationIndexes = plan.headsetStationIndexes;
  const includeReceptionDesk = plan.includeReceptionDesk;

  // Place independent asset families concurrently; one failed GLB never blocks
  // another valid desk, computer, headset or reception model from appearing.
  const jobs = [];

  if (deskStationIndexes.length) {
    jobs.push((async () => {
      const result = await placeAsset('office-desk', (record) => deskStationIndexes.flatMap((index) => {
        const station = stations[index];
        if (!station) return [];
        return [addFittedInstance(
          scene, record, `calloria-glb-desk-station-${station.id}`,
          { x: station.x, z: station.z }, TARGETS.desk, { alignLongAxis: true }, T
        )];
      }));
      if (result?.length) {
        hideInstancedEntries(scene, 'agent-desk-surfaces', deskStationIndexes, 1, T);
        hideInstancedEntries(scene, 'agent-desk-aprons', deskStationIndexes, 1, T);
        hideInstancedEntries(scene, 'agent-desk-legs', deskStationIndexes, 4, T);
        hideInstancedEntries(scene, 'desk-acoustic-dividers', deskStationIndexes, 1, T);
      }
    })());
  }

  if (plan.computerStationIndexes.length) {
    jobs.push((async () => {
      const result = await placeAsset('office-computer', (record) => plan.computerStationIndexes.flatMap((index) => {
        const station = stations[index];
        if (!station) return [];
        return [-0.52, 0.52].map((offset, screenIndex) => addFittedInstance(
          scene,
          record,
          `calloria-glb-computer-station-${station.id}-${screenIndex + 1}`,
          { x: station.x + offset, y: 0.84, z: station.z - 0.44 },
          TARGETS.computer,
          {},
          T
        ));
      }));
      if (result?.length) {
        hideInstancedEntries(scene, 'monitor-bezels', plan.computerStationIndexes, 2, T);
        hideInstancedEntries(scene, 'monitor-active-screens', plan.computerStationIndexes, 2, T);
        hideInstancedEntries(scene, 'monitor-stands', plan.computerStationIndexes, 2, T);
      }
    })());
  }

  if (headsetStationIndexes.length) {
    jobs.push(placeAsset('headset-model', (record) => headsetStationIndexes.map((index) => {
      const station = stations[index];
      if (!station) return null;
      return addFittedInstance(
        scene, record, `calloria-glb-headset-station-${station.id}`,
        { x: station.x + 1.0, y: 0.84, z: station.z + 0.18 },
        TARGETS.headset, {}, T
      );
    }).filter(Boolean)));
  }

  if (includeReceptionDesk) {
    jobs.push((async () => {
      const result = await placeAsset('reception-desk', (record) => [addFittedInstance(
        scene, record, 'calloria-glb-reception-desk',
        { x: -15.0, z: 11.85 }, TARGETS.reception, { alignLongAxis: true }, T
      )]);
      if (result?.length) hideNamedObjects(scene, ['reception-counter-top', 'reception-counter-front', 'reception-counter-accent']);
    })());
  }

  await Promise.allSettled(jobs);

  const placedIds = [...new Set(placed.map((entry) => entry.children?.[0]?.userData?.calloriaSourceAsset).filter(Boolean))];
  const status = Object.freeze({
    placed: placed.length,
    officeObjectsPlaced: placed.length,
    assets: placedIds,
    loadedAssetIds: [...loaded.keys()],
    failedAssetIds: [...new Set(errors.map((entry) => entry.assetId))],
    tier: plan.tier,
    stationCount: stations.length,
    deskStations: loaded.has('office-desk') ? deskStationIndexes.map((index) => stations[index]?.id).filter(Boolean) : [],
    planned: {
      deskStations: [...deskStationIndexes],
      computerStations: [...plan.computerStationIndexes],
      headsetStations: [...headsetStationIndexes],
      includeReceptionDesk
    },
    assetDetails: assetDetails.map((entry) => ({ ...entry, reasons: [...(entry.reasons || [])] })),
    errors: errors.map((entry) => ({ ...entry })),
    reason: placed.length
      ? `${placed.length} real office GLB placement(s) are visible.`
      : jobs.length
        ? 'No office GLB was placed. Review the per-asset HTTP, geometry and placement diagnostics.'
        : 'No office placements were planned for the current device tier or station count.'
  });

  const layer = {
    status,
    disposed: false,
    update() {},
    dispose() {
      if (disposed) return;
      disposed = true;
      this.disposed = true;
      for (const object of placed) {
        scene.remove(object);
        object.clear?.();
      }
      placed.length = 0;
      for (const entry of loaded.values()) disposeGLTFResources(entry.gltf);
      loaded.clear();
      loadPromises.clear();
      if (ACTIVE_LAYERS.get(scene) === layer) ACTIVE_LAYERS.delete(scene);
    }
  };
  ACTIVE_LAYERS.set(scene, layer);
  dispatchStatus(status);
  return layer;
}

export const __calloriaOfficeGLBRuntimeV613 = Object.freeze({
  inspectModel,
  cloneAndFit,
  hideInstancedEntries,
  TARGETS
});
