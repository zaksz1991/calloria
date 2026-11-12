/**
 * CALLORIA v6.17 — complete reception-lobby GLB integration.
 *
 * Loads the publisher's static CC0 lobby scene through the already configured
 * office GLTFLoader. It validates and batches compatible meshes before adding
 * the lobby. Existing reception objects are hidden only after placement; all
 * original visibility is restored when the world is disposed. On any failure,
 * the procedural reception and the existing reception-desk GLB fallback stay
 * available.
 */
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeGLTFResources } from './glb-asset-loader.js';
import { addCalloriaLobbyGreenery } from './cc0-lobby-greenery-integration.js';
import { integrateCalloriaGlazedDepartmentPartitions } from './cc0-glazed-department-partitions.js';
import { applyCalloriaLobbyLightingPolicy } from './calloria-lobby-lighting-policy.js';
import {
  CC0_OFFICE_LOBBY_ASSET,
  CC0_OFFICE_LOBBY_LIMITS,
  CC0_OFFICE_LOBBY_FALLBACK_OBJECTS,
  validateCC0OfficeLobby
} from './cc0-office-lobby-policy.js';

function getTextureMetrics(root) {
  const textures = new Set();
  const slots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) for (const slot of slots) {
      if (material?.[slot]?.isTexture) textures.add(material[slot]);
    }
  });
  let maxTextureEdge = 0;
  for (const texture of textures) {
    const image = texture.source?.data || texture.image;
    maxTextureEdge = Math.max(maxTextureEdge, Number(image?.width || 0), Number(image?.height || 0));
  }
  return { textures, maxTextureEdge };
}

export function inspectCC0OfficeLobby(gltf, THREE) {
  const root = gltf?.scene;
  if (!root) throw new Error('Lobby GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const materials = new Set();
  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    meshes += 1;
    const positions = object.geometry?.getAttribute?.('position');
    const count = object.geometry?.index?.count ?? positions?.count ?? 0;
    const instanceFactor = object.isInstancedMesh ? Math.max(1, object.count) : 1;
    triangles += Math.floor(count / 3) * instanceFactor;
    vertices += (positions?.count || 0) * instanceFactor;
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) materials.add(material);
  });
  const textureMetrics = getTextureMetrics(root);
  return {
    bounds,
    size: { x: size.x, y: size.y, z: size.z },
    meshes,
    triangles,
    vertices,
    materials: materials.size,
    textures: textureMetrics.textures.size,
    maxTextureEdge: textureMetrics.maxTextureEdge
  };
}

function geometryAttributeSignature(geometry) {
  return Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}:${attribute.array?.constructor?.name || 'unknown'}`)
    .join('|');
}

function disposeGeometryBuckets(buckets) {
  for (const bySignature of buckets.values()) {
    for (const geometries of bySignature.values()) for (const geometry of geometries) geometry.dispose();
  }
}

/**
 * Batch the static source meshes by shared material and matching attributes.
 * If any mesh cannot safely be merged, preserve the complete authored scene.
 */
export function createCC0OfficeLobbyRenderRoot(gltf, THREE) {
  const sourceRoot = gltf.scene;
  sourceRoot.updateMatrixWorld(true);
  const buckets = new Map();
  let sourceMeshes = 0;
  let unsupportedMeshes = 0;

  sourceRoot.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    sourceMeshes += 1;
    if (
      !object.isMesh || object.isSkinnedMesh || object.isInstancedMesh
      || Array.isArray(object.material) || object.morphTargetInfluences?.length
      || !object.geometry || !object.material
    ) {
      unsupportedMeshes += 1;
      return;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const signature = geometryAttributeSignature(geometry);
    let bySignature = buckets.get(object.material);
    if (!bySignature) { bySignature = new Map(); buckets.set(object.material, bySignature); }
    const geometries = bySignature.get(signature) || [];
    geometries.push(geometry);
    bySignature.set(signature, geometries);
  });

  if (unsupportedMeshes || !buckets.size) {
    disposeGeometryBuckets(buckets);
    return {
      root: sourceRoot.clone(true), merged: false, drawCalls: sourceMeshes,
      mergeReason: unsupportedMeshes ? 'source includes unsupported mesh types or material layouts' : 'no mergeable meshes'
    };
  }

  const mergedRoot = new THREE.Group();
  mergedRoot.name = 'calloria-cc0-office-lobby-batches';
  const generatedGeometries = [];
  let drawCalls = 0;
  try {
    for (const [material, bySignature] of buckets) {
      for (const [signature, geometries] of bySignature) {
        const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
        if (!merged) throw new Error(`Could not merge lobby vertex attributes: ${signature}`);
        if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = `calloria-lobby-batch-${drawCalls + 1}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mergedRoot.add(mesh);
        generatedGeometries.push(merged);
        drawCalls += 1;
      }
    }
    return { root: mergedRoot, merged: true, drawCalls, generatedGeometries, mergeReason: null };
  } catch (error) {
    for (const geometry of generatedGeometries) geometry.dispose();
    disposeGeometryBuckets(buckets);
    return {
      root: sourceRoot.clone(true), merged: false, drawCalls: sourceMeshes,
      generatedGeometries: [], mergeReason: String(error?.message || error)
    };
  }
}

function hideReceptionFallbacks(scene) {
  const changed = [];
  for (const name of CC0_OFFICE_LOBBY_FALLBACK_OBJECTS) {
    const object = scene.getObjectByName(name);
    if (!object || !object.visible) continue;
    changed.push({ object, visible: object.visible });
    object.visible = false;
  }
  return changed;
}

function restoreReceptionFallbacks(changed) {
  for (const entry of changed) entry.object.visible = entry.visible;
}

export async function integrateCalloriaCC0OfficeLobby({
  THREE,
  scene,
  loader,
  tier = 'balanced',
  isActive = () => true
} = {}) {
  if (!THREE?.Group || !scene?.add || !scene?.getObjectByName || !loader?.loadAsync) {
    throw new TypeError('CALLORIA reception lobby requires the active Three.js scene and configured GLTFLoader.');
  }

  let disposed = false;
  let gltf = null;
  let placedRoot = null;
  let generatedGeometries = [];
  let hiddenFallbacks = [];
  let greeneryLease = null;
  let partitionLease = null;
  let partitionLoad = null;
  const partitionStatus = { loaded: false, attempted: true, reason: 'department glass integration pending' };
  const emitPartitionStatus = () => {
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calloria:glazed-partitions-ready', { detail: partitionStatus }));
    }
  };
  const startPartitionIntegration = () => {
    if (partitionLoad) return partitionLoad;
    partitionLoad = integrateCalloriaGlazedDepartmentPartitions(scene, {
      tier,
      isActive: () => !disposed && isActive()
    }).then((lease) => {
      if (disposed || !isActive()) {
        lease?.dispose?.();
        return null;
      }
      partitionLease = lease || null;
      Object.assign(partitionStatus, lease?.status || {
        loaded: false,
        attempted: true,
        reason: 'department glass integration returned no status'
      });
      emitPartitionStatus();
      return partitionLease;
    }).catch((error) => {
      if (disposed || !isActive()) return null;
      Object.assign(partitionStatus, {
        loaded: false,
        attempted: true,
        reason: String(error?.message || error)
      });
      emitPartitionStatus();
      return null;
    });
    return partitionLoad;
  };
  const release = () => {
    if (disposed) return;
    disposed = true;
    partitionLease?.dispose?.();
    partitionLease = null;
    greeneryLease?.dispose?.();
    greeneryLease = null;
    if (placedRoot) scene.remove(placedRoot);
    for (const geometry of generatedGeometries) geometry.dispose();
    restoreReceptionFallbacks(hiddenFallbacks);
    if (gltf) disposeGLTFResources(gltf);
    gltf = null;
    generatedGeometries = [];
    hiddenFallbacks = [];
    placedRoot = null;
  };

  try {
    // Start department glass independently of the reception GLB request. This
    // uses the active production scene and waits briefly for its named panes.
    void startPartitionIntegration();
    gltf = await loader.loadAsync(CC0_OFFICE_LOBBY_ASSET.url);
    if (disposed || !isActive()) {
      disposeGLTFResources(gltf);
      gltf = null;
      return {
        status: { loaded: false, attempted: true, reason: 'world disposed while lobby was loading' },
        update() {}, dispose: release
      };
    }

    const metrics = inspectCC0OfficeLobby(gltf, THREE);
    const validation = validateCC0OfficeLobby(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    // Populate only planter anchors authored in the lobby GLB. The integration
    // returns a no-op lease when no safe, named anchors are present.
    greeneryLease = await addCalloriaLobbyGreenery(gltf, { isActive: () => !disposed && isActive() });
    if (disposed || !isActive()) {
      greeneryLease?.dispose?.();
      greeneryLease = null;
      if (gltf) disposeGLTFResources(gltf);
      gltf = null;
      return {
        status: { loaded: false, attempted: true, reason: 'world disposed during lobby greenery integration' },
        update() {}, dispose: release
      };
    }

    const rendered = createCC0OfficeLobbyRenderRoot(gltf, THREE);
    const lighting = applyCalloriaLobbyLightingPolicy(rendered.root, { tier });
    placedRoot = new THREE.Group();
    placedRoot.name = 'calloria-cc0-office-lobby';
    placedRoot.scale.setScalar(CC0_OFFICE_LOBBY_LIMITS.placedScale);
    placedRoot.position.set(
      CC0_OFFICE_LOBBY_LIMITS.position.x,
      CC0_OFFICE_LOBBY_LIMITS.position.y,
      CC0_OFFICE_LOBBY_LIMITS.position.z
    );
    const center = metrics.bounds.getCenter(new THREE.Vector3());
    rendered.root.position.add(new THREE.Vector3(-center.x, -metrics.bounds.min.y, -center.z));
    rendered.root.updateMatrixWorld(true);
    placedRoot.add(rendered.root);

    // The replacement must be in the scene before any existing reception mesh
    // is hidden. This order guarantees a visible fallback on all failure paths.
    generatedGeometries = rendered.generatedGeometries || [];
    scene.add(placedRoot);
    hiddenFallbacks = hideReceptionFallbacks(scene);

    const status = Object.freeze({
      loaded: true,
      attempted: true,
      id: CC0_OFFICE_LOBBY_ASSET.id,
      name: CC0_OFFICE_LOBBY_ASSET.name,
      url: CC0_OFFICE_LOBBY_ASSET.url,
      sourceUrl: CC0_OFFICE_LOBBY_ASSET.sourceUrl,
      license: CC0_OFFICE_LOBBY_ASSET.license,
      licenseUrl: CC0_OFFICE_LOBBY_ASSET.licenseUrl,
      triangles: metrics.triangles,
      meshes: metrics.meshes,
      vertices: metrics.vertices,
      materials: metrics.materials,
      textures: metrics.textures,
      maxTextureEdge: metrics.maxTextureEdge,
      merged: rendered.merged,
      drawCalls: rendered.drawCalls,
      mergeReason: rendered.mergeReason,
      lighting,
      fallbacksHidden: hiddenFallbacks.length,
      greenery: greeneryLease?.status || { loaded: false, reason: 'greenery integration returned no status' },
      partitions: partitionStatus,
      tier,
      scale: CC0_OFFICE_LOBBY_LIMITS.placedScale,
      placement: { ...CC0_OFFICE_LOBBY_LIMITS.position }
    });
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calloria:glb-lobby-ready', { detail: status }));
      window.dispatchEvent(new CustomEvent('calloria:glb-greenery-ready', { detail: status.greenery }));
    }
    return { status, update() {}, dispose: release };
  } catch (error) {
    const greeneryFailureStatus = { ...(greeneryLease?.status || {}), loaded: false, reason: String(error?.message || error) };
    greeneryLease?.dispose?.();
    greeneryLease = null;
    if (placedRoot) scene.remove(placedRoot);
    for (const geometry of generatedGeometries) geometry.dispose();
    restoreReceptionFallbacks(hiddenFallbacks);
    if (gltf) disposeGLTFResources(gltf);
    gltf = null;
    generatedGeometries = [];
    hiddenFallbacks = [];
    placedRoot = null;
    const reason = String(error?.message || error);
    const status = {
      loaded: false,
      attempted: true,
      id: CC0_OFFICE_LOBBY_ASSET.id,
      name: CC0_OFFICE_LOBBY_ASSET.name,
      url: CC0_OFFICE_LOBBY_ASSET.url,
      sourceUrl: CC0_OFFICE_LOBBY_ASSET.sourceUrl,
      license: CC0_OFFICE_LOBBY_ASSET.license,
      errorCategory: /HTTP|fetch|network|CORS|Load failed/i.test(reason) ? 'http-or-network' : /triangle|dimension|mesh count|material count|texture/i.test(reason) ? 'validation' : 'load-or-placement',
      reason,
      tier
    };
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent('calloria:glb-lobby-ready', { detail: status }));
      window.dispatchEvent(new CustomEvent('calloria:glb-greenery-ready', { detail: greeneryFailureStatus }));
    }
    return { status, update() {}, dispose: release };
  }
}

export const __calloriaCC0OfficeLobbyInternals = Object.freeze({
  geometryAttributeSignature,
  hideReceptionFallbacks,
  restoreReceptionFallbacks
});

// Compatibility export required by js/production-world.js.
// Keep both names bound to the same lifecycle implementation.
export const integrateCalloriaCC0Lobby = integrateCalloriaCC0OfficeLobby;
