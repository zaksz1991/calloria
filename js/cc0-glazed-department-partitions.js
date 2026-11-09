/**
 * CALLORIA v3.3 — real CC0 glazed partition modules for the QA and supervisor rooms.
 * Replaces only the three named, measured placeholder glass panels after the
 * external model passes geometry validation. Existing panes remain the fallback.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeGLTFResources } from './glb-asset-loader.js';

export const CC0_GLAZED_PARTITION_ASSET = Object.freeze({
  id: '3dassets-downtown-office-glazed-partition-17051',
  name: 'Glazed partition module, 1.2 m (Downtown Office Interiors)',
  url: 'https://cdn.3dassets.dev/assets/17051/v1/model.glb',
  source: 'https://3dassets.dev/assets/downtown-office-interiors-glazed-partition-module-0a8e7f14',
  pack: 'https://3dassets.dev/packs/downtown-office-interiors',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  expected: Object.freeze({
    triangles: 564,
    materials: 4,
    sizeMeters: Object.freeze([1.2, 2.6, 0.08]),
    fileBytes: 29600
  })
});

const LIMITS = Object.freeze({
  maxTriangles: 900,
  maxMeshes: 20,
  maxMaterials: 6,
  maxTextures: 4,
  maxDimensionDrift: 0.035,
  maxPartitionsLow: 6,
  maxPartitionsStandard: 16
});

const PANEL_SPECS = Object.freeze({
  qa: Object.freeze({
    name: 'qa-glass-front',
    size: Object.freeze([7.15, 2.5, 0.055]),
    positions: Object.freeze(Array.from({ length: 6 }, (_, index) => Object.freeze({
      x: 10.1 + index * 1.2,
      y: 0,
      z: -7.98,
      rotationY: 0,
      scaleX: 1
    })))
  }),
  supervisorLeft: Object.freeze({
    name: 'supervisor-left-glass',
    size: Object.freeze([0.06, 2.55, 6.3]),
    positions: Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({
      x: 9.45,
      y: 0,
      z: -4.32 + index * 1.26,
      rotationY: Math.PI / 2,
      scaleX: 1.05
    })))
  }),
  supervisorRight: Object.freeze({
    name: 'supervisor-right-glass',
    size: Object.freeze([0.06, 2.55, 6.3]),
    positions: Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({
      x: 16.75,
      y: 0,
      z: -4.32 + index * 1.26,
      rotationY: -Math.PI / 2,
      scaleX: 1.05
    })))
  })
});

function getMaterialList(material) {
  return Array.isArray(material) ? material : material ? [material] : [];
}

export function inspectCC0GlazedPartition(gltf) {
  const root = gltf?.scene;
  if (!root) throw new Error('The CC0 glazed partition GLB has no default scene.');
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
    for (const material of getMaterialList(object.material)) {
      materials.add(material);
      for (const slot of textureSlots) if (material[slot]?.isTexture) textures.add(material[slot]);
    }
    if (
      !object.isMesh || object.isSkinnedMesh || object.isInstancedMesh ||
      Array.isArray(object.material) || object.morphTargetInfluences?.length ||
      !geometry || !object.material || !positions
    ) unsupportedMeshes += 1;
  });

  return {
    size: { x: size.x, y: size.y, z: size.z },
    minY: bounds.min.y,
    meshes,
    triangles,
    materials: materials.size,
    textures: textures.size,
    unsupportedMeshes,
    animations: Array.isArray(gltf.animations) ? gltf.animations.length : 0
  };
}

export function validateCC0GlazedPartition(metrics) {
  const errors = [];
  if (!metrics?.size) return { valid: false, errors: ['missing partition geometry metrics'] };
  if (metrics.triangles <= 0 || metrics.triangles > LIMITS.maxTriangles) errors.push('partition triangle budget exceeded');
  if (metrics.meshes <= 0 || metrics.meshes > LIMITS.maxMeshes) errors.push('partition mesh count outside supported range');
  if (metrics.materials <= 0 || metrics.materials > LIMITS.maxMaterials) errors.push('partition material count outside supported range');
  if (metrics.textures > LIMITS.maxTextures) errors.push('partition texture count outside supported range');
  if (metrics.unsupportedMeshes > 0) errors.push('partition contains unsupported animated, instanced or multi-material meshes');
  if (metrics.animations > 0) errors.push('partition asset is expected to be static');
  const expected = CC0_GLAZED_PARTITION_ASSET.expected.sizeMeters;
  for (const axis of ['x', 'y', 'z']) {
    if (Math.abs(metrics.size[axis] - expected[['x', 'y', 'z'].indexOf(axis)]) > LIMITS.maxDimensionDrift) {
      errors.push(`partition ${axis.toUpperCase()} dimension does not match the published model envelope`);
    }
  }
  if (metrics.minY < -0.04 || metrics.minY > 0.04) errors.push('partition origin is not close to its authored floor');
  return { valid: errors.length === 0, errors };
}

function validateAnchor(anchor, spec) {
  if (!anchor?.isMesh || !anchor.geometry) return 'named placeholder pane is not a mesh';
  anchor.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(anchor);
  const size = bounds.getSize(new THREE.Vector3());
  const expected = spec.size;
  const tolerances = [0.16, 0.18, 0.08];
  for (let axis = 0; axis < 3; axis += 1) {
    if (Math.abs(size.getComponent(axis) - expected[axis]) > tolerances[axis]) {
      return `named placeholder pane dimensions drifted on axis ${axis}`;
    }
  }
  return null;
}

function createPanelInstances(template, specs) {
  const group = new THREE.Group();
  group.name = 'calloria-cc0-glazed-department-partitions-v3-3';
  const panels = [];
  for (const spec of specs) {
    for (let index = 0; index < spec.positions.length; index += 1) {
      const placement = spec.positions[index];
      const panel = template.clone(true);
      panel.name = `${spec.name}-cc0-module-${index + 1}`;
      panel.position.set(placement.x, placement.y, placement.z);
      panel.rotation.set(0, placement.rotationY, 0);
      panel.scale.set(placement.scaleX, 1, 1);
      panel.userData.calloriaAssetId = CC0_GLAZED_PARTITION_ASSET.id;
      panel.userData.calloriaSourceAnchor = spec.name;
      group.add(panel);
      panels.push(panel);
    }
  }
  return { group, panels };
}

function selectedPanelSpecs(tier) {
  if (tier === 'low') return [PANEL_SPECS.qa];
  return [PANEL_SPECS.qa, PANEL_SPECS.supervisorLeft, PANEL_SPECS.supervisorRight];
}

/**
 * Replaces the existing flat QA/supervisor room glass only after the GLB has
 * loaded, validated, and all clone placements have been prepared. No new
 * openings, collision rules, room boundaries or guessed coordinates are added.
 */
export async function integrateCalloriaGlazedDepartmentPartitions(scene, { tier = 'balanced', isActive = () => true } = {}) {
  const noOp = (reason, extra = {}) => ({
    status: {
      loaded: false,
      source: CC0_GLAZED_PARTITION_ASSET.name,
      license: CC0_GLAZED_PARTITION_ASSET.license,
      reason,
      ...extra
    },
    dispose() {}
  });

  let gltf = null;
  let group = null;
  let hiddenAnchors = [];
  try {
    if (!scene?.getObjectByName || !scene?.add) return noOp('production scene unavailable; original glass retained');
    if (!isActive()) return noOp('world disposed before partition integration');

    const specs = selectedPanelSpecs(tier);
    const anchors = specs.map((spec) => {
      const anchor = scene.getObjectByName(spec.name);
      if (!anchor) throw new Error(`required authored panel anchor is missing: ${spec.name}`);
      const error = validateAnchor(anchor, spec);
      if (error) throw new Error(`${spec.name}: ${error}`);
      return { spec, anchor };
    });

    const loader = new GLTFLoader();
    loader.setCrossOrigin('anonymous');
    gltf = await loader.loadAsync(CC0_GLAZED_PARTITION_ASSET.url);
    if (!isActive()) {
      disposeGLTFResources(gltf);
      gltf = null;
      return noOp('world disposed while partition model was loading');
    }

    const metrics = inspectCC0GlazedPartition(gltf);
    const validation = validateCC0GlazedPartition(metrics);
    if (!validation.valid) throw new Error(validation.errors.join('; '));

    const partitionCount = anchors.reduce((sum, entry) => sum + entry.spec.positions.length, 0);
    const triangleBudget = partitionCount * metrics.triangles;
    const maxCount = tier === 'low' ? LIMITS.maxPartitionsLow : LIMITS.maxPartitionsStandard;
    if (partitionCount > maxCount) throw new Error('partition module count exceeds the selected device-tier budget');
    if (triangleBudget > 10000) throw new Error('department partition triangle budget exceeded');

    const prepared = createPanelInstances(gltf.scene, anchors.map((entry) => entry.spec));
    group = prepared.group;
    if (!isActive()) throw new Error('world disposed before department partition placement');

    // Commit only after the complete replacement is ready.
    scene.add(group);
    for (const { anchor } of anchors) {
      anchor.visible = false;
      hiddenAnchors.push(anchor);
    }

    return {
      status: {
        loaded: true,
        source: CC0_GLAZED_PARTITION_ASSET.name,
        sourceUrl: CC0_GLAZED_PARTITION_ASSET.source,
        packUrl: CC0_GLAZED_PARTITION_ASSET.pack,
        license: CC0_GLAZED_PARTITION_ASSET.license,
        tier,
        partitionsPlaced: prepared.panels.length,
        replacedAnchors: hiddenAnchors.map((anchor) => anchor.name),
        trianglesPerPartition: metrics.triangles,
        trianglesAdded: triangleBudget,
        sourceMeshes: metrics.meshes,
        materials: metrics.materials,
        textures: metrics.textures,
        dimensionsMeters: metrics.size
      },
      dispose() {
        group?.parent?.remove(group);
        group = null;
        for (const anchor of hiddenAnchors) anchor.visible = true;
        hiddenAnchors = [];
        if (gltf) disposeGLTFResources(gltf);
        gltf = null;
      }
    };
  } catch (error) {
    group?.parent?.remove(group);
    group = null;
    for (const anchor of hiddenAnchors) anchor.visible = true;
    hiddenAnchors = [];
    if (gltf) disposeGLTFResources(gltf);
    gltf = null;
    return noOp(String(error?.message || error), { tier });
  }
}

export const __departmentPartitionTest = Object.freeze({ LIMITS, PANEL_SPECS, selectedPanelSpecs });
