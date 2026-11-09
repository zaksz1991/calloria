/**
 * CALLORIA v3.0 — Real CC0 reception and office-lobby scene.
 *
 * Source asset: 3DAssets.dev, Office Lobby and Building Facilities starter scene.
 * Licence: CC0 1.0 Universal. Static GLB, metres, +Y up.
 * The asset is loaded lazily from its permanent CORS-enabled CDN URL. If the
 * network or validation fails, existing CALLORIA reception geometry remains.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

export const CC0_OFFICE_LOBBY_ASSET = Object.freeze({
  id: '3dassets-office-lobby-starter-scene',
  name: 'Office Lobby and Building Facilities — starter scene',
  url: 'https://cdn.3dassets.dev/assets/26326/v1/model.glb',
  source: 'https://3dassets.dev/packs/office-lobby-and-facilities',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  expected: Object.freeze({
    triangles: 32204,
    meshes: 99,
    materials: 7,
    vertices: 68648,
    sizeMeters: Object.freeze([12.707, 3.672, 8.895]),
    fileBytes: 1303620
  })
});

const LIMITS = Object.freeze({
  triangles: 42000,
  meshes: 125,
  materials: 12,
  maxDimension: 14.5,
  maxHeight: 4.25
});

const HIDDEN_LEGACY_OBJECTS = Object.freeze([
  'reception-counter-top',
  'reception-counter-front',
  'reception-counter-accent',
  'reception-checkin-screen',
  'reception-access-posts',
  'reception-waiting-seats',
  'reception-waiting-seat-backs',
  'reception-waiting-seat-legs',
  'reception-access-control-readers',
  'reception-access-reader-indicators',
  'calloria-glb-reception-desk'
]);

export function inspectCC0Lobby(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('The CC0 lobby GLB has no default scene.');
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const materials = new Set();
  const textures = new Set();
  let meshes = 0;
  let triangles = 0;
  let vertices = 0;
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
  });

  const maxTextureEdge = [...textures].reduce((max, texture) => {
    const image = texture.source?.data || texture.image;
    return Math.max(max, Number(image?.width || 0), Number(image?.height || 0));
  }, 0);

  return {
    bounds,
    size: { x: size.x, y: size.y, z: size.z },
    meshes,
    triangles,
    vertices,
    materials: materials.size,
    textures: textures.size,
    maxTextureEdge
  };
}

export function validateCC0Lobby(metrics) {
  const errors = [];
  if (!metrics || !metrics.size) return { valid: false, errors: ['missing geometry metrics'] };
  if (metrics.triangles <= 0 || metrics.triangles > LIMITS.triangles) {
    errors.push(`triangle budget exceeded (${LIMITS.triangles.toLocaleString()})`);
  }
  if (metrics.meshes <= 0 || metrics.meshes > LIMITS.meshes) {
    errors.push(`mesh count outside supported range (${LIMITS.meshes})`);
  }
  if (metrics.materials <= 0 || metrics.materials > LIMITS.materials) {
    errors.push(`material count outside supported range (${LIMITS.materials})`);
  }
  if (metrics.size.x > LIMITS.maxDimension || metrics.size.z > LIMITS.maxDimension || metrics.size.y > LIMITS.maxHeight) {
    errors.push('model dimensions exceed the CALLORIA lobby envelope');
  }
  if (metrics.size.x < 8 || metrics.size.z < 6 || metrics.size.y < 2) {
    errors.push('model dimensions are too small for the lobby envelope');
  }
  if (metrics.maxTextureEdge > 4096) errors.push('texture exceeds 4096 pixels');
  return { valid: errors.length === 0, errors };
}

function attributeSignature(geometry) {
  return Object.entries(geometry.attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized ? 1 : 0}:${attribute.array?.constructor?.name || 'unknown'}`)
    .join('|');
}

function disposeGeometryList(buckets) {
  for (const materialGroups of buckets.values()) {
    for (const geometries of materialGroups.values()) {
      for (const geometry of geometries) geometry.dispose();
    }
  }
}

/**
 * The starter scene contains 99 static meshes and 7 materials. Merge compatible
 * meshes by material/attribute layout to reduce mobile draw calls. If any mesh
 * cannot be safely merged, keep the original authored scene rather than
 * dropping geometry or materials.
 */
export function createLobbyRenderRoot(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const buckets = new Map();
  let unsupportedMeshes = 0;
  let sourceMeshes = 0;

  root.traverse((object) => {
    if (!(object.isMesh || object.isSkinnedMesh || object.isInstancedMesh)) return;
    sourceMeshes += 1;
    if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || Array.isArray(object.material) || object.morphTargetInfluences?.length) {
      unsupportedMeshes += 1;
      return;
    }
    if (!object.geometry || !object.material) {
      unsupportedMeshes += 1;
      return;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const signature = attributeSignature(geometry);
    let bySignature = buckets.get(object.material);
    if (!bySignature) {
      bySignature = new Map();
      buckets.set(object.material, bySignature);
    }
    const list = bySignature.get(signature) || [];
    list.push(geometry);
    bySignature.set(signature, list);
  });

  if (unsupportedMeshes > 0 || !buckets.size) {
    disposeGeometryList(buckets);
    return { root: root.clone(true), merged: false, drawCalls: sourceMeshes, mergeReason: 'asset contains meshes that are not safe to merge' };
  }

  const mergedRoot = new THREE.Group();
  mergedRoot.name = 'calloria-cc0-office-lobby-batched';
  let drawCalls = 0;
  const generated = [];
  try {
    for (const [material, bySignature] of buckets) {
      for (const [signature, geometries] of bySignature) {
        const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
        if (!merged) throw new Error(`Could not merge lobby geometry attributes: ${signature}`);
        if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
        merged.computeBoundingBox();
        merged.computeBoundingSphere();
        const mesh = new THREE.Mesh(merged, material);
        mesh.name = `calloria-lobby-batch-${drawCalls + 1}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = true;
        mergedRoot.add(mesh);
        generated.push(merged);
        drawCalls += 1;
      }
    }
    return { root: mergedRoot, merged: true, drawCalls, mergeReason: null };
  } catch (error) {
    for (const geometry of generated) geometry.dispose();
    disposeGeometryList(buckets);
    return {
      root: root.clone(true),
      merged: false,
      drawCalls: sourceMeshes,
      mergeReason: String(error?.message || error)
    };
  }
}

function hideLegacyReceptionObjects(scene) {
  const changed = [];
  for (const name of HIDDEN_LEGACY_OBJECTS) {
    const object = scene.getObjectByName(name);
    if (object && object.visible) {
      object.visible = false;
      changed.push(object);
    }
  }
  return changed;
}

export async function integrateCalloriaCC0Lobby({ scene, tier = 'balanced', isActive = () => true } = {}) {
  if (!scene?.add || !scene?.getObjectByName) {
    throw new TypeError('CALLORIA CC0 lobby integration requires the active Three.js scene.');
  }

  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  let disposed = false;
  let gltf = null;
  let placedRoot = null;
  let mergedGeometries = [];
  let hiddenLegacy = [];

  try {
    gltf = await loader.loadAsync(CC0_OFFICE_LOBBY_ASSET.url);
    if (disposed || !isActive()) {
      disposeGLTFResources(gltf);
      return { status: { loaded: false, reason: 'world disposed during model load' }, update() {}, dispose() {} };
    }

    const metrics = inspectCC0Lobby(gltf);
    const validation = validateCC0Lobby(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const renderRoot = createLobbyRenderRoot(gltf);
    placedRoot = new THREE.Group();
    placedRoot.name = 'calloria-cc0-office-lobby';
    // Authored size is approximately 12.7 × 3.67 × 8.9 metres. Scale to 80%
    // and place in the front-left reception footprint so the lobby stays clear
    // of the first agent row and perimeter columns.
    const centre = metrics.bounds.getCenter(new THREE.Vector3());
    placedRoot.scale.setScalar(0.8);
    placedRoot.position.set(-14.0, 0, 10.2);
    // Add the centring offset instead of overwriting any root transform authored
    // by the asset. The GLB currently has an identity root, but this remains safe
    // if the upstream source changes its scene root transform.
    renderRoot.root.position.add(new THREE.Vector3(-centre.x, -metrics.bounds.min.y, -centre.z));
    renderRoot.root.updateMatrixWorld(true);
    placedRoot.add(renderRoot.root);
    scene.add(placedRoot);

    if (renderRoot.merged) {
      renderRoot.root.traverse((object) => {
        if (object.isMesh && object.geometry) mergedGeometries.push(object.geometry);
      });
      // The source scene's geometries are no longer needed after static batching.
      gltf.scene.traverse((object) => {
        if (object.isMesh && object.geometry) object.geometry.dispose();
      });
    }

    hiddenLegacy = hideLegacyReceptionObjects(scene);

    return {
      status: {
        loaded: true,
        source: CC0_OFFICE_LOBBY_ASSET.name,
        sourceUrl: CC0_OFFICE_LOBBY_ASSET.source,
        license: CC0_OFFICE_LOBBY_ASSET.license,
        triangles: metrics.triangles,
        sourceMeshes: metrics.meshes,
        mergedDrawCalls: renderRoot.drawCalls,
        materials: metrics.materials,
        textures: metrics.textures,
        tier,
        merged: renderRoot.merged,
        mergeNote: renderRoot.mergeReason
      },
      update() {},
      dispose() {
        if (disposed) return;
        disposed = true;
        if (placedRoot) scene.remove(placedRoot);
        for (const geometry of mergedGeometries) geometry.dispose();
        for (const object of hiddenLegacy) object.visible = true;
        if (gltf) disposeGLTFResources(gltf);
        mergedGeometries = [];
        hiddenLegacy = [];
        placedRoot = null;
      }
    };
  } catch (error) {
    if (placedRoot) scene.remove(placedRoot);
    if (gltf) disposeGLTFResources(gltf);
    // No original reception geometry is hidden on failure; the existing floor
    // remains playable if the external CC0 CDN is unreachable or validation fails.
    return {
      status: {
        loaded: false,
        source: CC0_OFFICE_LOBBY_ASSET.name,
        license: CC0_OFFICE_LOBBY_ASSET.license,
        reason: String(error?.message || error)
      },
      update() {},
      dispose() { disposed = true; }
    };
  }
}
