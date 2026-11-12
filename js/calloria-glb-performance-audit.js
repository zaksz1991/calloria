/**
 * CALLORIA v6.25 GLB performance measurements.
 * Estimates decoded asset costs without depending on renderer internals.
 */
export const CALLORIA_GLB_BUDGETS = Object.freeze({
  mobile: Object.freeze({ maxFileBytes: 4 * 1024 * 1024, maxGeometryBytes: 12 * 1024 * 1024, maxTextureBytes: 32 * 1024 * 1024, maxTriangles: 80000, maxDrawCalls: 80 }),
  balanced: Object.freeze({ maxFileBytes: 12 * 1024 * 1024, maxGeometryBytes: 40 * 1024 * 1024, maxTextureBytes: 96 * 1024 * 1024, maxTriangles: 250000, maxDrawCalls: 220 }),
  high: Object.freeze({ maxFileBytes: 32 * 1024 * 1024, maxGeometryBytes: 128 * 1024 * 1024, maxTextureBytes: 256 * 1024 * 1024, maxTriangles: 900000, maxDrawCalls: 700 })
});

function valuesOfMaterial(material) {
  if (!material || typeof material !== 'object') return [];
  return Object.values(material).filter(value => value && (value.isTexture || value.isCubeTexture));
}
function imageDimensions(image) {
  if (!image) return [];
  if (Array.isArray(image)) return image.flatMap(imageDimensions);
  const width = Number(image.width || image.videoWidth || image.naturalWidth || 0);
  const height = Number(image.height || image.videoHeight || image.naturalHeight || 0);
  return width > 0 && height > 0 ? [{ width, height }] : [];
}

export function measureCalloriaGlb(gltf, fileBytes, dimensions = null) {
  if (!gltf?.scene || typeof gltf.scene.traverse !== 'function') throw new TypeError('A decoded GLTF scene is required.');
  const geometries = new Set();
  const buffers = new Set();
  const materials = new Set();
  const textures = new Set();
  const imageSources = new Set();
  const skeletons = new Set();
  let meshCount = 0;
  let skinnedMeshCount = 0;
  let triangleCount = 0;
  let drawCalls = 0;
  let vertexCount = 0;

  gltf.scene.traverse(node => {
    if (!(node?.isMesh || node?.isSkinnedMesh || node?.isInstancedMesh)) return;
    meshCount += 1;
    const geometry = node.geometry;
    if (!geometry) return;
    const position = geometry.getAttribute?.('position') || geometry.attributes?.position;
    const vertexTotal = Number(position?.count || position?.array?.length / (position?.itemSize || 3) || 0);
    vertexCount += vertexTotal * (node.isInstancedMesh ? Math.max(1, Number(node.count || 1)) : 1);
    const index = geometry.index;
    const elementCount = Number(index?.count || index?.array?.length || vertexTotal);
    const groups = Array.isArray(geometry.groups) ? geometry.groups : [];
    const material = node.material;
    const materialCount = Array.isArray(material) ? material.length : material ? 1 : 0;
    drawCalls += groups.length ? groups.length : materialCount;
    const groupedElements = groups.length ? groups.reduce((sum, group) => sum + Number(group.count || 0), 0) : elementCount;
    triangleCount += Math.floor(groupedElements / 3) * (node.isInstancedMesh ? Math.max(1, Number(node.count || 1)) : 1);
    geometries.add(geometry);
    if (node.isSkinnedMesh) {
      skinnedMeshCount += 1;
      if (node.skeleton) skeletons.add(node.skeleton);
    }
    for (const item of (Array.isArray(material) ? material : material ? [material] : [])) {
      materials.add(item);
      for (const texture of valuesOfMaterial(item)) textures.add(texture);
    }
  });

  let geometryBytes = 0;
  for (const geometry of geometries) {
    const attributes = Object.values(geometry.attributes || {});
    if (geometry.index) attributes.push(geometry.index);
    for (const attribute of attributes) {
      const array = attribute?.data?.array || attribute?.array;
      if (!array) continue;
      const buffer = array.buffer || array;
      if (!buffers.has(buffer)) {
        buffers.add(buffer);
        geometryBytes += Number(buffer.byteLength || array.byteLength || 0);
      }
    }
  }

  let estimatedTextureBytes = 0;
  const textureImages = [];
  for (const texture of textures) {
    const source = texture.source || texture.image || texture;
    if (imageSources.has(source)) continue;
    imageSources.add(source);
    const images = imageDimensions(texture.image || texture.source?.data || source?.data);
    for (const image of images) {
      estimatedTextureBytes += image.width * image.height * 4 * 1.33;
      textureImages.push(image);
    }
  }
  const boneCount = [...skeletons].reduce((sum, skeleton) => sum + (Array.isArray(skeleton.bones) ? skeleton.bones.length : 0), 0);
  const scenes = Array.isArray(gltf.scenes) ? gltf.scenes.length : 1;
  return Object.freeze({
    fileBytes: Math.max(0, Number(fileBytes) || 0), meshCount, vertexCount, triangleCount, drawCalls,
    geometryCount: geometries.size, geometryBytes: Math.round(geometryBytes),
    materialCount: materials.size, textureCount: textures.size, textureImages: textureImages.length,
    estimatedTextureBytes: Math.round(estimatedTextureBytes),
    estimatedDecodedBytes: Math.round(geometryBytes + estimatedTextureBytes),
    skinnedMeshCount, skeletonCount: skeletons.size, boneCount,
    animationCount: Array.isArray(gltf.animations) ? gltf.animations.length : 0,
    sceneCount: scenes,
    dimensions: dimensions && [dimensions.x, dimensions.y, dimensions.z].every(Number.isFinite) ? { x: dimensions.x, y: dimensions.y, z: dimensions.z } : null
  });
}

export function evaluateCalloriaGlbBudget(metrics, options = {}) {
  const profile = CALLORIA_GLB_BUDGETS[options.profile || 'mobile'] ? (options.profile || 'mobile') : 'mobile';
  const budget = CALLORIA_GLB_BUDGETS[profile];
  const checks = [
    ['file size', metrics.fileBytes, budget.maxFileBytes],
    ['geometry memory', metrics.geometryBytes, budget.maxGeometryBytes],
    ['texture memory', metrics.estimatedTextureBytes, budget.maxTextureBytes],
    ['triangles', metrics.triangleCount, budget.maxTriangles],
    ['draw calls', metrics.drawCalls, budget.maxDrawCalls]
  ];
  const issues = [];
  let over = false;
  for (const [label, actual, maximum] of checks) {
    const value = Number(actual) || 0;
    if (value > maximum * 1.5) { over = true; issues.push(`${label} critically exceeds budget`); }
    else if (value > maximum) issues.push(`${label} exceeds budget`);
  }
  const status = over ? 'OVER BUDGET' : issues.length ? 'WATCH' : 'PASS';
  const recommendations = [];
  if (metrics.fileBytes > budget.maxFileBytes) recommendations.push('Reduce download size; inspect unused meshes and embedded textures.');
  if (metrics.triangleCount > budget.maxTriangles) recommendations.push('Create a lower-poly LOD for mobile devices.');
  if (metrics.drawCalls > budget.maxDrawCalls) recommendations.push('Reduce material slots and merge compatible static geometry.');
  if (metrics.estimatedTextureBytes > budget.maxTextureBytes) recommendations.push('Resize large textures and use GPU-compressed texture formats where supported.');
  if (metrics.geometryBytes > budget.maxGeometryBytes) recommendations.push('Reduce vertex attributes and geometry buffers.');
  return Object.freeze({ profile, status, issues: Object.freeze(issues), recommendations: Object.freeze(recommendations), budget });
}
