/**
 * Shared CALLORIA GLB loading infrastructure.
 * Loads GLB files from the same-origin public asset catalogue.
 * Cached source scenes remain immutable; use clone() for each placed instance.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getGLBAssetById } from './glb-asset-registry.js';

export class CalloriaGLBAssetLoader {
  constructor({ manager, crossOrigin = 'anonymous' } = {}) {
    this.loader = new GLTFLoader(manager);
    this.loader.setCrossOrigin(crossOrigin);
    this.cache = new Map();
    this.inflight = new Map();
  }

  resolveAsset(assetOrId) {
    const asset = typeof assetOrId === 'string' ? getGLBAssetById(assetOrId) : assetOrId;
    if (!asset?.id || !asset?.url) throw new TypeError(`Unknown CALLORIA GLB asset: ${String(assetOrId)}`);
    return asset;
  }

  async load(assetOrId, { cache = true, onProgress } = {}) {
    const asset = this.resolveAsset(assetOrId);
    if (cache && this.cache.has(asset.id)) return this.cache.get(asset.id);
    if (cache && this.inflight.has(asset.id)) return this.inflight.get(asset.id);

    const task = this.loader.loadAsync(asset.url, (event) => {
      if (typeof onProgress === 'function') {
        onProgress({
          loaded: Number(event.loaded || 0),
          total: Number(event.total || 0),
          lengthComputable: Boolean(event.total)
        });
      }
    }).then((gltf) => {
      gltf.scene?.updateMatrixWorld(true);
      const loaded = {
        id: asset.id,
        asset,
        gltf,
        scene: gltf.scene,
        animations: Array.isArray(gltf.animations) ? gltf.animations : [],
        parser: gltf.parser || null,
        loadedAt: new Date().toISOString()
      };
      if (cache) this.cache.set(asset.id, loaded);
      return loaded;
    }).finally(() => {
      if (cache) this.inflight.delete(asset.id);
    });

    if (cache) this.inflight.set(asset.id, task);
    return task;
  }

  clone(assetOrId) {
    const asset = this.resolveAsset(assetOrId);
    const loaded = this.cache.get(asset.id);
    if (!loaded) throw new Error(`Asset ${asset.id} must be loaded before it can be cloned.`);
    const hasSkinnedMesh = loaded.scene?.getObjectByProperty('isSkinnedMesh', true);
    return hasSkinnedMesh ? cloneSkeleton(loaded.scene) : loaded.scene.clone(true);
  }

  createMixer(assetOrId, root = null) {
    const asset = this.resolveAsset(assetOrId);
    const loaded = this.cache.get(asset.id);
    if (!loaded) throw new Error(`Asset ${asset.id} must be loaded before creating an animation mixer.`);
    if (!root) throw new TypeError('Pass a cloned scene as the animation root.');
    return new THREE.AnimationMixer(root);
  }

  dispose(assetOrId) {
    const asset = this.resolveAsset(assetOrId);
    const loaded = this.cache.get(asset.id);
    if (!loaded) return false;
    disposeGLTFResources(loaded.gltf);
    this.cache.delete(asset.id);
    return true;
  }

  disposeAll() {
    for (const loaded of this.cache.values()) disposeGLTFResources(loaded.gltf);
    this.cache.clear();
    this.inflight.clear();
  }
}

export function disposeGLTFResources(gltfOrScene) {
  const root = gltfOrScene?.scene || gltfOrScene;
  if (!root?.traverse) return;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const textureSlots = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap',
    'alphaMap', 'bumpMap', 'displacementMap', 'specularMap', 'lightMap',
    'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'iridescenceMap',
    'iridescenceThicknessMap', 'transmissionMap', 'thicknessMap', 'sheenColorMap',
    'sheenRoughnessMap', 'envMap'
  ];

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of list) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
    if (object.skeleton?.boneTexture) textures.add(object.skeleton.boneTexture);
  });

  for (const texture of textures) texture.dispose?.();
  for (const material of materials) material.dispose?.();
  for (const geometry of geometries) geometry.dispose?.();
}

export function inspectGLTFAsset(loaded, fileBytes = 0) {
  const root = loaded?.scene;
  if (!root) throw new TypeError('A loaded GLTF scene is required for inspection.');

  let meshCount = 0;
  let skinnedMeshCount = 0;
  let instancedMeshCount = 0;
  let triangles = 0;
  let vertices = 0;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  const extensions = new Set(loaded.parser?.json?.extensionsUsed || []);
  const requiredExtensions = new Set(loaded.parser?.json?.extensionsRequired || []);
  const textureSlots = [
    'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap',
    'alphaMap', 'bumpMap', 'displacementMap', 'specularMap', 'lightMap', 'envMap',
    'clearcoatMap', 'clearcoatNormalMap', 'clearcoatRoughnessMap', 'transmissionMap',
    'thicknessMap', 'sheenColorMap', 'sheenRoughnessMap', 'iridescenceMap',
    'iridescenceThicknessMap'
  ];

  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh || object.isInstancedMesh) {
      meshCount += 1;
      if (object.isSkinnedMesh) {
        skinnedMeshCount += 1;
        if (object.skeleton) skeletons.add(object.skeleton);
      }
      if (object.isInstancedMesh) instancedMeshCount += 1;
      const geometry = object.geometry;
      if (geometry) {
        geometries.add(geometry);
        const position = geometry.getAttribute?.('position');
        vertices += position?.count || 0;
        const rawTriangles = geometry.index
          ? Math.floor(geometry.index.count / 3)
          : Math.floor((position?.count || 0) / 3);
        triangles += rawTriangles * (object.isInstancedMesh ? Math.max(1, object.count) : 1);
      }
      const list = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of list) {
        materials.add(material);
        for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
      }
    }
  });

  // Compute world-space dimensions without relying on a global THREE namespace.
  let dimensions = null;
  try {
    const nodes = [];
    root.traverse((object) => { if (object.isMesh && object.geometry) nodes.push(object); });
    if (nodes.length) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (const object of nodes) {
        object.geometry.computeBoundingBox?.();
        const localBox = object.geometry.boundingBox;
        if (!localBox) continue;
        const points = [
          [localBox.min.x, localBox.min.y, localBox.min.z], [localBox.max.x, localBox.min.y, localBox.min.z],
          [localBox.min.x, localBox.max.y, localBox.min.z], [localBox.min.x, localBox.min.y, localBox.max.z],
          [localBox.max.x, localBox.max.y, localBox.min.z], [localBox.max.x, localBox.min.y, localBox.max.z],
          [localBox.min.x, localBox.max.y, localBox.max.z], [localBox.max.x, localBox.max.y, localBox.max.z]
        ];
        for (const point of points) {
          const vector = new object.position.constructor(...point);
          vector.applyMatrix4(object.matrixWorld);
          min[0] = Math.min(min[0], vector.x); min[1] = Math.min(min[1], vector.y); min[2] = Math.min(min[2], vector.z);
          max[0] = Math.max(max[0], vector.x); max[1] = Math.max(max[1], vector.y); max[2] = Math.max(max[2], vector.z);
        }
      }
      if (Number.isFinite(min[0])) dimensions = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
    }
  } catch { dimensions = null; }

  const animationClips = (loaded.animations || []).map((clip) => ({ name: clip.name || 'Unnamed animation', durationSeconds: Number(clip.duration || 0), tracks: clip.tracks?.length || 0 }));
  const textureDetails = [...textures].map((texture) => {
    const image = texture.source?.data || texture.image || null;
    return {
      name: texture.name || texture.source?.data?.src || 'Embedded texture',
      width: Number(image?.width || image?.videoWidth || 0),
      height: Number(image?.height || image?.videoHeight || 0),
      format: texture.format,
      colorSpace: texture.colorSpace || 'unspecified'
    };
  });

  return {
    id: loaded.id,
    name: loaded.asset?.name || loaded.id,
    url: loaded.asset?.url || '',
    group: loaded.asset?.group || '',
    category: loaded.asset?.category || '',
    fileBytes: Number(fileBytes || 0),
    fileMB: Number(fileBytes || 0) / (1024 * 1024),
    meshCount,
    skinnedMeshCount,
    instancedMeshCount,
    geometryCount: geometries.size,
    vertexCount: vertices,
    triangleCount: triangles,
    materialCount: materials.size,
    textureCount: textures.size,
    textures: textureDetails,
    skeletonCount: skeletons.size,
    boneCount: [...skeletons].reduce((sum, skeleton) => sum + (skeleton.bones?.length || 0), 0),
    hasRig: skinnedMeshCount > 0 && skeletons.size > 0,
    animationCount: animationClips.length,
    animations: animationClips,
    dimensions,
    extensions: [...extensions],
    requiredExtensions: [...requiredExtensions],
    inspectedAt: new Date().toISOString()
  };
}
