/**
 * CALLORIA v6.16 — runtime activation of CC0 workstation task chairs.
 * The local instanced chairs remain visible unless this replacement loads,
 * passes geometry validation, is batched and is placed successfully.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeGLTFResources } from './glb-asset-loader.js';
import {
  CC0_OFFICE_CHAIR_ASSET,
  CC0_OFFICE_CHAIR_LIMITS,
  getCC0ChairStationIds,
  validateCC0OfficeChair,
  getCC0ChairPlacedTriangleCount,
  isCC0ChairPlacementWithinBudget
} from './office-chair-policy.js';

const LEGACY_CHAIR_NAMES = Object.freeze([
  'chair-seats',
  'chair-backs',
  'chair-posts',
  'chair-bases'
]);
const CHAIR_SCALE = 1.08;
const CHAIR_YAW = Math.PI;
const CHAIR_Z_OFFSET = 1.36;

export function inspectCC0OfficeChair(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('The CC0 office-chair GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const materials = new Set();
  const textures = new Set();
  let meshes = 0;
  let triangles = 0;
  let unsupportedMeshes = 0;
  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];

  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshes += 1;
    const geometry = object.geometry;
    const count = geometry?.index?.count ?? geometry?.getAttribute?.('position')?.count ?? 0;
    triangles += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(object.material) || object.morphTargetInfluences?.length || !object.geometry || !object.material) {
      unsupportedMeshes += 1;
    }
  });

  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);

  return {
    bounds,
    size: { x: size.x, y: size.y, z: size.z },
    minY: bounds.min.y,
    meshes,
    triangles,
    materials: materials.size,
    textures: textures.size,
    maxTextureEdge,
    unsupportedMeshes
  };
}

function attributeSignature(geometry) {
  return Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}:${attribute.array?.constructor?.name || 'unknown'}`)
    .join('|');
}

function disposeGeometryBuckets(buckets) {
  for (const bySignature of buckets.values()) {
    for (const geometries of bySignature.values()) {
      for (const geometry of geometries) geometry.dispose();
    }
  }
}

function buildChairBatches(gltf, placements) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const buckets = new Map();
  let sourceMeshes = 0;
  let unsupportedMeshes = 0;

  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    sourceMeshes += 1;
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(object.material) || object.morphTargetInfluences?.length || !object.geometry || !object.material) {
      unsupportedMeshes += 1;
      return;
    }

    const sourceGeometry = object.geometry.clone();
    sourceGeometry.applyMatrix4(object.matrixWorld);
    const signature = attributeSignature(sourceGeometry);
    let bySignature = buckets.get(object.material);
    if (!bySignature) {
      bySignature = new Map();
      buckets.set(object.material, bySignature);
    }
    const geometries = bySignature.get(signature) || [];

    for (const placement of placements) {
      const geometry = sourceGeometry.clone();
      const pose = new THREE.Matrix4().compose(
        new THREE.Vector3(placement.x, 0, placement.z + CHAIR_Z_OFFSET),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), CHAIR_YAW),
        new THREE.Vector3(CHAIR_SCALE, CHAIR_SCALE, CHAIR_SCALE)
      );
      geometry.applyMatrix4(pose);
      geometries.push(geometry);
    }
    sourceGeometry.dispose();
    bySignature.set(signature, geometries);
  });

  if (unsupportedMeshes > 0 || !buckets.size) {
    disposeGeometryBuckets(buckets);
    throw new Error(`chair GLB contains ${unsupportedMeshes} mesh(es) that cannot be safely batched`);
  }

  const mergedRoot = new THREE.Group();
  mergedRoot.name = 'calloria-cc0-ergonomic-chair-batches';
  const generatedGeometries = [];
  let drawCalls = 0;
  try {
    for (const [material, bySignature] of buckets) {
      for (const [signature, geometries] of bySignature) {
        const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
        if (!merged) throw new Error(`Could not merge chair geometry attributes: ${signature}`);
        if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = `calloria-cc0-chair-batch-${drawCalls + 1}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mergedRoot.add(mesh);
        generatedGeometries.push(merged);
        drawCalls += 1;
      }
    }
    return { root: mergedRoot, merged: true, drawCalls, sourceMeshes, generatedGeometries };
  } catch (error) {
    for (const geometry of generatedGeometries) geometry.dispose();
    disposeGeometryBuckets(buckets);
    throw error;
  }
}

function hideLegacyChairInstances(scene, stationIds) {
  const hidden = [];
  const targetIndexes = stationIds.map((id) => id - 1);
  for (const name of LEGACY_CHAIR_NAMES) {
    const object = scene.getObjectByName(name);
    if (!object?.isInstancedMesh) continue;
    const saved = [];
    const matrix = new THREE.Matrix4();
    for (const index of targetIndexes) {
      if (index < 0 || index >= object.count) continue;
      object.getMatrixAt(index, matrix);
      saved.push({ index, matrix: matrix.clone() });
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      scale.set(0, 0, 0);
      object.setMatrixAt(index, new THREE.Matrix4().compose(position, quaternion, scale));
    }
    if (saved.length) {
      object.instanceMatrix.needsUpdate = true;
      object.computeBoundingSphere?.();
      hidden.push({ object, saved });
    }
  }
  return hidden;
}

function restoreLegacyChairInstances(hidden) {
  for (const { object, saved } of hidden) {
    for (const entry of saved) object.setMatrixAt(entry.index, entry.matrix);
    object.instanceMatrix.needsUpdate = true;
    object.computeBoundingSphere?.();
  }
}

function inactiveResult(reason, tier, extra = {}) {
  return {
    status: { loaded: false, attempted: false, chairsPlaced: 0, tier, reason, ...extra },
    update() {},
    dispose() {}
  };
}

export async function integrateCalloriaCC0OfficeChairs({ scene, stations, tier = 'balanced', isActive = () => true } = {}) {
  if (!scene?.add || !scene?.getObjectByName) {
    throw new TypeError('CALLORIA CC0 chair integration requires the active Three.js scene.');
  }
  if (!Array.isArray(stations) || stations.length === 0) {
    return inactiveResult('Station list unavailable; original chairs retained.', tier);
  }

  const stationIds = getCC0ChairStationIds(tier, stations);
  const stationById = new Map(stations.map((station, index) => [
    Number.isFinite(Number(station?.id)) ? Number(station.id) : index + 1,
    station
  ]));
  const placements = stationIds.map((id) => {
    const station = stationById.get(id);
    return station && Number.isFinite(Number(station.x)) && Number.isFinite(Number(station.z))
      ? { id, x: Number(station.x), z: Number(station.z) }
      : null;
  }).filter(Boolean);

  if (!placements.length) return inactiveResult('No workstation rows matched this graphics tier; original chairs retained.', tier);
  if (!isCC0ChairPlacementWithinBudget(CC0_OFFICE_CHAIR_ASSET.expected.triangles, placements.length)) {
    return inactiveResult('Placed-chair triangle budget exceeded; original chairs retained.', tier, { attempted: true });
  }

  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  let disposed = false;
  let gltf = null;
  let placedRoot = null;
  let generatedGeometries = [];
  let hiddenLegacy = [];

  try {
    gltf = await loader.loadAsync(CC0_OFFICE_CHAIR_ASSET.url);
    if (disposed || !isActive()) {
      disposeGLTFResources(gltf);
      gltf = null;
      return inactiveResult('World disposed during chair model loading; original chairs retained.', tier, { attempted: true });
    }

    const metrics = inspectCC0OfficeChair(gltf);
    const validation = validateCC0OfficeChair(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const placedTriangles = getCC0ChairPlacedTriangleCount(metrics.triangles, placements.length);
    if (placedTriangles > CC0_OFFICE_CHAIR_LIMITS.maxPlacedTriangles) throw new Error('Placed-chair triangle budget exceeded.');

    const render = buildChairBatches(gltf, placements);
    placedRoot = render.root;
    scene.add(placedRoot);
    generatedGeometries = render.generatedGeometries;
    hiddenLegacy = hideLegacyChairInstances(scene, placements.map((placement) => placement.id));

    return {
      status: {
        loaded: true,
        attempted: true,
        source: CC0_OFFICE_CHAIR_ASSET.name,
        sourceUrl: CC0_OFFICE_CHAIR_ASSET.source,
        assetUrl: CC0_OFFICE_CHAIR_ASSET.url,
        assetId: CC0_OFFICE_CHAIR_ASSET.id,
        license: CC0_OFFICE_CHAIR_ASSET.license,
        licenseUrl: CC0_OFFICE_CHAIR_ASSET.licenseUrl,
        tier,
        stationIds: placements.map((placement) => placement.id),
        chairsPlaced: placements.length,
        trianglesPerChair: metrics.triangles,
        placedTriangles,
        sourceMeshes: metrics.meshes,
        sourceMaterials: metrics.materials,
        textures: metrics.textures,
        mergedDrawCalls: render.drawCalls,
        merged: render.merged,
        dimensionsMeters: metrics.size,
        floorOrigin: metrics.minY,
        fallbackInstancesHidden: hiddenLegacy.reduce((sum, entry) => sum + entry.saved.length, 0)
      },
      update() {},
      dispose() {
        if (disposed) return;
        disposed = true;
        if (placedRoot) scene.remove(placedRoot);
        for (const geometry of generatedGeometries) geometry.dispose();
        restoreLegacyChairInstances(hiddenLegacy);
        if (gltf) disposeGLTFResources(gltf);
        generatedGeometries = [];
        hiddenLegacy = [];
        placedRoot = null;
        gltf = null;
      }
    };
  } catch (error) {
    if (placedRoot) scene.remove(placedRoot);
    for (const geometry of generatedGeometries) geometry.dispose();
    restoreLegacyChairInstances(hiddenLegacy);
    if (gltf) disposeGLTFResources(gltf);
    const message = String(error?.message || error);
    return {
      status: {
        loaded: false,
        attempted: true,
        assetId: CC0_OFFICE_CHAIR_ASSET.id,
        source: CC0_OFFICE_CHAIR_ASSET.name,
        sourceUrl: CC0_OFFICE_CHAIR_ASSET.source,
        assetUrl: CC0_OFFICE_CHAIR_ASSET.url,
        license: CC0_OFFICE_CHAIR_ASSET.license,
        tier,
        chairsPlaced: 0,
        reason: message,
        errorCategory: /HTTP|fetch|network|CORS/i.test(message) ? 'http-or-network'
          : /mesh|material|texture|triangle|dimension|geometry|origin|floor/i.test(message) ? 'validation-or-geometry'
            : 'load-or-placement'
      },
      update() {},
      dispose() { disposed = true; }
    };
  }
}

export const __calloriaCC0ChairRuntimeV616 = Object.freeze({
  LEGACY_CHAIR_NAMES,
  CHAIR_SCALE,
  CHAIR_YAW,
  CHAIR_Z_OFFSET,
  buildChairBatches,
  hideLegacyChairInstances,
  restoreLegacyChairInstances
});
