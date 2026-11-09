/**
 * CALLORIA v3.2 — fills the authored reception-lobby planter anchors with a
 * real CC0 bird-of-paradise GLB. The original lobby scene remains untouched
 * when the asset, planter anchors, or geometry validation is unavailable.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

export const CC0_LOBBY_GREENERY_ASSET = Object.freeze({
  id: '3dassets-botanical-bird-of-paradise-clump',
  name: 'Bird of paradise clump, 1.7 m (Botanical Glasshouse and Palm House)',
  url: 'https://cdn.3dassets.dev/assets/38580/v1/model.glb',
  source: 'https://3dassets.dev/assets/botanical-glasshouse-and-palm-house-botanical-glasshou-c9003ec1',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  expected: Object.freeze({
    triangles: 612,
    materials: 4,
    sizeMeters: Object.freeze([1.517, 1.751, 1.485]),
    fileBytes: 27400
  })
});

const CC0_LOBBY_LICENSE = 'CC0 1.0 Universal';

const LIMITS = Object.freeze({
  maxTrianglesPerPlant: 1200,
  maxPlacedTriangles: 4000,
  maxPlantMeshes: 32,
  maxMaterials: 8,
  maxTextureEdge: 4096,
  maxDimension: 2.2,
  minHeight: 1.1,
  maxPlanterAnchors: 4
});

const PLANTER_NAME = /(?:planter|plant[-_\s]?(?:box|trough|pot))/i;

function getNodeLabel(node) {
  const extras = node?.userData || {};
  const parts = [node?.name, extras.name, extras.assetName, extras.assetTitle, extras.title];
  return parts.filter((part) => typeof part === 'string').join(' ').trim();
}

function getNodeDepth(node) {
  let depth = 0;
  for (let current = node; current?.parent; current = current.parent) depth += 1;
  return depth;
}

function isAncestor(ancestor, node) {
  for (let current = node?.parent; current; current = current.parent) {
    if (current === ancestor) return true;
  }
  return false;
}

/**
 * Find authored planters only. Dimensions reject the much larger "plant room"
 * and unrelated lobby geometry. Parent groups are preferred over their child
 * meshes so a pot is filled once, not once per component.
 */
export function findCC0LobbyPlanterAnchors(scene) {
  if (!scene?.traverse) return [];
  scene.updateMatrixWorld?.(true);
  const candidates = [];

  scene.traverse((node) => {
    if (!PLANTER_NAME.test(getNodeLabel(node))) return;
    if (!(node.isMesh || node.isGroup || node.children?.length)) return;

    const bounds = new THREE.Box3().setFromObject(node);
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    if (
      size.x < 0.25 || size.x > 2.4 ||
      size.z < 0.25 || size.z > 2.4 ||
      size.y < 0.28 || size.y > 1.4
    ) return;

    candidates.push({ node, bounds, size, depth: getNodeDepth(node), label: getNodeLabel(node) });
  });

  candidates.sort((a, b) => a.depth - b.depth || (b.size.x * b.size.z) - (a.size.x * a.size.z));
  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((chosen) => isAncestor(chosen.node, candidate.node))) continue;
    selected.push(candidate);
  }

  return selected
    .sort((a, b) => (b.size.x * b.size.z) - (a.size.x * a.size.z))
    .slice(0, LIMITS.maxPlanterAnchors);
}

export function inspectCC0LobbyPlant(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('The CC0 lobby plant GLB has no default scene.');
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
    const positions = geometry?.getAttribute?.('position');
    const vertexCount = geometry?.index?.count ?? positions?.count ?? 0;
    triangles += Math.floor(vertexCount / 3) * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
    const materialList = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materialList) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
    if (
      !object.isMesh || object.isSkinnedMesh || object.isInstancedMesh ||
      Array.isArray(object.material) || object.morphTargetInfluences?.length ||
      !geometry || !object.material || !positions
    ) unsupportedMeshes += 1;
  });

  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);

  return {
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

export function validateCC0LobbyPlant(metrics) {
  const errors = [];
  if (!metrics?.size) return { valid: false, errors: ['missing plant geometry metrics'] };
  if (metrics.triangles <= 0 || metrics.triangles > LIMITS.maxTrianglesPerPlant) errors.push('plant triangle budget exceeded');
  if (metrics.meshes <= 0 || metrics.meshes > LIMITS.maxPlantMeshes) errors.push('plant mesh count outside supported range');
  if (metrics.materials <= 0 || metrics.materials > LIMITS.maxMaterials) errors.push('plant material count outside supported range');
  if (metrics.unsupportedMeshes > 0) errors.push('plant contains unsupported animated or multi-material meshes');
  if (metrics.size.x <= 0 || metrics.size.z <= 0 || metrics.size.y < LIMITS.minHeight) errors.push('plant dimensions are too small');
  if (metrics.size.x > LIMITS.maxDimension || metrics.size.z > LIMITS.maxDimension || metrics.size.y > LIMITS.maxDimension) errors.push('plant dimensions exceed the lobby envelope');
  if (metrics.maxTextureEdge > LIMITS.maxTextureEdge) errors.push('plant texture exceeds 4096 pixels');
  if (metrics.minY < -0.08 || metrics.minY > 0.12) errors.push('plant origin is not close to its authored floor');
  return { valid: errors.length === 0, errors };
}

function createPlantPlacement(scene, anchor, plantRoot) {
  const bounds = anchor.bounds;
  const footprint = Math.max(anchor.size.x, anchor.size.z);
  const scale = Math.max(0.72, Math.min(0.94, footprint / 1.5));
  const soilInset = Math.min(0.15, anchor.size.y * 0.22);
  const worldPosition = new THREE.Vector3(
    (bounds.min.x + bounds.max.x) * 0.5,
    bounds.max.y - soilInset,
    (bounds.min.z + bounds.max.z) * 0.5
  );
  scene.worldToLocal(worldPosition);

  const worldQuaternion = anchor.node.getWorldQuaternion(new THREE.Quaternion());
  const sceneWorldQuaternion = scene.getWorldQuaternion(new THREE.Quaternion());
  const localQuaternion = sceneWorldQuaternion.invert().multiply(worldQuaternion);
  const plant = plantRoot.clone(true);
  plant.name = `calloria-cc0-lobby-bird-of-paradise-${anchor.node.id}`;
  plant.position.copy(worldPosition);
  plant.quaternion.copy(localQuaternion);
  plant.scale.multiplyScalar(scale);
  plant.userData.calloriaDecorAsset = CC0_LOBBY_GREENERY_ASSET.id;
  return plant;
}

/**
 * Adds foliage to the authored planter nodes before the lobby's existing
 * static geometry batching pass. It never invents planter positions. When no
 * stable planter node is found, the empty authored planters remain visible.
 */
export async function addCalloriaLobbyGreenery(lobbyGltf, { isActive = () => true } = {}) {
  const noOp = (reason, extra = {}) => ({
    status: { loaded: false, source: CC0_LOBBY_GREENERY_ASSET.name, license: CC0_LOBBY_LICENSE, reason, ...extra },
    dispose() {}
  });

  let plantGltf = null;
  const addedPlants = [];
  try {
    if (!lobbyGltf?.scene) return noOp('lobby GLB scene unavailable; original lobby retained');
    if (!isActive()) return noOp('world disposed before greenery integration');

    const anchors = findCC0LobbyPlanterAnchors(lobbyGltf.scene);
    if (!anchors.length) return noOp('no named lobby planter anchors passed geometry checks; original lobby retained');

    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    plantGltf = await loader.loadAsync(CC0_LOBBY_GREENERY_ASSET.url);
    if (!isActive()) {
      disposeGLTFResources(plantGltf);
      plantGltf = null;
      return noOp('world disposed while plant model was loading');
    }

    const metrics = inspectCC0LobbyPlant(plantGltf);
    const validation = validateCC0LobbyPlant(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const placements = anchors.slice(0, Math.floor(LIMITS.maxPlacedTriangles / metrics.triangles));
    if (!placements.length) throw new Error('placed lobby greenery triangle budget exceeded');

    // Validate every placement before mutating the lobby scene.
    const plants = placements.map((anchor) => createPlantPlacement(lobbyGltf.scene, anchor, plantGltf.scene));
    if (!isActive()) throw new Error('world disposed before greenery placement');
    for (const plant of plants) {
      lobbyGltf.scene.add(plant);
      addedPlants.push(plant);
    }

    return {
      status: {
        loaded: true,
        source: CC0_LOBBY_GREENERY_ASSET.name,
        sourceUrl: CC0_LOBBY_GREENERY_ASSET.source,
        license: CC0_LOBBY_GREENERY_ASSET.license,
        plantsPlaced: addedPlants.length,
        planterAnchors: placements.map((anchor) => anchor.label),
        trianglesPerPlant: metrics.triangles,
        trianglesAdded: metrics.triangles * addedPlants.length,
        sourceMeshes: metrics.meshes,
        materials: metrics.materials,
        dimensionsMeters: metrics.size,
        maxTextureEdge: metrics.maxTextureEdge
      },
      dispose() {
        for (const plant of addedPlants) plant.parent?.remove(plant);
        addedPlants.length = 0;
        if (plantGltf) disposeGLTFResources(plantGltf);
        plantGltf = null;
      }
    };
  } catch (error) {
    for (const plant of addedPlants) plant.parent?.remove(plant);
    addedPlants.length = 0;
    if (plantGltf) disposeGLTFResources(plantGltf);
    plantGltf = null;
    return noOp(String(error?.message || error));
  }
}

