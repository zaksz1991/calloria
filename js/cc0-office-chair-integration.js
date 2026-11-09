/**
 * CALLORIA v3.1 — production workstation task chairs.
 * Asset: 3DAssets.dev, Office task chair (Police Station and Detective Office).
 * Licence: CC0 1.0 Universal. Static GLB, metres, +Y up, front toward +Z.
 * The asset loads asynchronously. Original chair instances remain visible
 * unless the GLB loads, passes its geometry budget and is placed successfully.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

export const CC0_OFFICE_CHAIR_ASSET = Object.freeze({
  id: '3dassets-office-task-chair-police-station',
  name: 'Office task chair (Police Station and Detective Office)',
  url: 'https://cdn.3dassets.dev/assets/29956/v1/model.glb',
  source: 'https://3dassets.dev/assets/police-station-and-detective-office-office-chair-task-fea6fec9',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  expected: Object.freeze({
    triangles: 2408,
    vertices: 5415,
    meshes: null,
    materials: 5,
    sizeMeters: Object.freeze([0.657, 1.083, 0.693]),
    seatHeightMeters: 0.46,
    fileBytes: 103100
  })
});

const LIMITS = Object.freeze({
  trianglesPerChair: 4000,
  meshes: 40,
  materials: 8,
  maxDimension: 1.5,
  minWidth: 0.4,
  minDepth: 0.4,
  minHeight: 0.75,
  maxTextureEdge: 4096,
  maxPlacedTriangles: 32000
});

const LEGACY_CHAIR_NAMES = Object.freeze([
  'chair-seats',
  'chair-backs',
  'chair-posts',
  'chair-bases'
]);

const STATION_IDS_BY_TIER = Object.freeze({
  low: Object.freeze([10, 11]),
  balanced: Object.freeze([9, 10, 11, 12]),
  high: Object.freeze([5, 6, 7, 8, 9, 10, 11, 12])
});

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
  let vertices = 0;
  let unsupportedMeshes = 0;
  const textureSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];

  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshes += 1;
    const geometry = object.geometry;
    const positions = geometry?.getAttribute?.('position');
    const count = geometry?.index?.count ?? positions?.count ?? 0;
    triangles += Math.floor(count / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    vertices += (positions?.count || 0) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(object.material) || object.morphTargetInfluences?.length) {
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
    vertices,
    materials: materials.size,
    textures: textures.size,
    maxTextureEdge,
    unsupportedMeshes
  };
}

export function validateCC0OfficeChair(metrics) {
  const errors = [];
  if (!metrics?.size) return { valid: false, errors: ['missing chair geometry metrics'] };
  if (metrics.triangles <= 0 || metrics.triangles > LIMITS.trianglesPerChair) errors.push('per-chair triangle budget exceeded');
  if (metrics.meshes <= 0 || metrics.meshes > LIMITS.meshes) errors.push('chair mesh count outside supported range');
  if (metrics.materials <= 0 || metrics.materials > LIMITS.materials) errors.push('chair material count outside supported range');
  if (metrics.size.x < LIMITS.minWidth || metrics.size.z < LIMITS.minDepth || metrics.size.y < LIMITS.minHeight) errors.push('chair dimensions are too small for a workstation seat');
  if (metrics.size.x > LIMITS.maxDimension || metrics.size.y > LIMITS.maxDimension || metrics.size.z > LIMITS.maxDimension) errors.push('chair dimensions exceed the workstation envelope');
  if (metrics.maxTextureEdge > LIMITS.maxTextureEdge) errors.push('chair texture exceeds 4096 pixels');
  if (metrics.minY < -0.08 || metrics.minY > 0.12) errors.push('chair base is not close to the authored floor origin');
  return { valid: errors.length === 0, errors };
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

export function getCC0ChairStationIds(tier = 'balanced', stations = []) {
  const safeTier = ['low', 'balanced', 'high'].includes(String(tier).toLowerCase())
    ? String(tier).toLowerCase()
    : 'balanced';
  const allowed = new Set(STATION_IDS_BY_TIER[safeTier]);
  return (Array.isArray(stations) ? stations : [])
    .map((station, index) => ({ station, id: Number.isFinite(Number(station?.id)) ? Number(station.id) : index + 1 }))
    .filter(({ id }) => allowed.has(id))
    .map(({ id }) => id);
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
        mesh.castShadow = true;
        mesh.receiveShadow = true;
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

export async function integrateCalloriaCC0OfficeChairs({ scene, stations, tier = 'balanced', isActive = () => true } = {}) {
  if (!scene?.add || !scene?.getObjectByName) {
    throw new TypeError('CALLORIA CC0 chair integration requires the active Three.js scene.');
  }
  if (!Array.isArray(stations) || stations.length === 0) {
    return { status: { loaded: false, reason: 'station list unavailable; original chairs retained' }, update() {}, dispose() {} };
  }

  const stationIds = getCC0ChairStationIds(tier, stations);
  const stationById = new Map(stations.map((station, index) => [Number.isFinite(Number(station?.id)) ? Number(station.id) : index + 1, station]));
  const placements = stationIds.map((id) => {
    const station = stationById.get(id);
    return station && Number.isFinite(Number(station.x)) && Number.isFinite(Number(station.z))
      ? { id, x: Number(station.x), z: Number(station.z) }
      : null;
  }).filter(Boolean);

  if (!placements.length) {
    return { status: { loaded: false, reason: 'no workstation rows matched this device tier; original chairs retained', tier }, update() {}, dispose() {} };
  }
  if (placements.length * CC0_OFFICE_CHAIR_ASSET.expected.triangles > LIMITS.maxPlacedTriangles) {
    return { status: { loaded: false, reason: 'placed-chair triangle budget exceeded; original chairs retained', tier }, update() {}, dispose() {} };
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
      return { status: { loaded: false, reason: 'world disposed during chair model load' }, update() {}, dispose() {} };
    }

    const metrics = inspectCC0OfficeChair(gltf);
    const validation = validateCC0OfficeChair(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    const placedTriangles = metrics.triangles * placements.length;
    if (placedTriangles > LIMITS.maxPlacedTriangles) throw new Error('placed-chair triangle budget exceeded');

    const render = buildChairBatches(gltf, placements);
    placedRoot = render.root;
    scene.add(placedRoot);
    generatedGeometries = render.generatedGeometries;
    hiddenLegacy = hideLegacyChairInstances(scene, placements.map((placement) => placement.id));

    return {
      status: {
        loaded: true,
        source: CC0_OFFICE_CHAIR_ASSET.name,
        sourceUrl: CC0_OFFICE_CHAIR_ASSET.source,
        license: CC0_OFFICE_CHAIR_ASSET.license,
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
        mergeNote: render.mergeReason || null,
        dimensionsMeters: metrics.size,
        floorOrigin: metrics.minY
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
      }
    };
  } catch (error) {
    if (placedRoot) scene.remove(placedRoot);
    for (const geometry of generatedGeometries) geometry.dispose();
    if (gltf) disposeGLTFResources(gltf);
    // Fallback remains the original chair geometry. Nothing is hidden until the
    // replacement model validates and its render root is placed successfully.
    return {
      status: {
        loaded: false,
        source: CC0_OFFICE_CHAIR_ASSET.name,
        license: CC0_OFFICE_CHAIR_ASSET.license,
        tier,
        reason: String(error?.message || error)
      },
      update() {},
      dispose() { disposed = true; }
    };
  }
}
