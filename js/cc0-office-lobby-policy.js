/**
 * CALLORIA v6.17 — independent policy for the static reception-lobby GLB.
 * Kept free of Three.js imports so limits and tier decisions are testable.
 */
export const CC0_OFFICE_LOBBY_ASSET = Object.freeze({
  id: '3dassets-office-lobby',
  name: 'Office Lobby and Building Facilities — starter scene',
  url: 'https://cdn.3dassets.dev/assets/26326/v1/model.glb',
  sourceUrl: 'https://3dassets.dev/packs/office-lobby-and-facilities',
  license: 'CC0 1.0 Universal',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  expected: Object.freeze({
    triangles: 32204,
    meshes: 99,
    materials: 7,
    sizeMeters: Object.freeze([12.707, 3.672, 8.895]),
    fileBytes: 1303620
  })
});

export const CC0_OFFICE_LOBBY_LIMITS = Object.freeze({
  maxTriangles: 42000,
  maxMeshes: 125,
  maxMaterials: 12,
  maxDimension: 14.5,
  minWidth: 8,
  minDepth: 6,
  minHeight: 2,
  maxHeight: 4.25,
  maxTextureEdge: 4096,
  placedScale: 0.8,
  position: Object.freeze({ x: -14, y: 0, z: 10.2 })
});

export const CC0_OFFICE_LOBBY_FALLBACK_OBJECTS = Object.freeze([
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

export function shouldLoadCC0OfficeLobby(tier = 'balanced') {
  return tier === 'balanced' || tier === 'high';
}

export function validateCC0OfficeLobby(metrics) {
  const errors = [];
  if (!metrics || !metrics.size) return { valid: false, errors: ['missing geometry metrics'] };
  const numeric = [
    metrics.triangles, metrics.meshes, metrics.materials,
    metrics.size.x, metrics.size.y, metrics.size.z,
    metrics.maxTextureEdge ?? 0
  ];
  if (!numeric.every(Number.isFinite)) errors.push('model metrics contain non-finite values');
  if (metrics.triangles <= 0 || metrics.triangles > CC0_OFFICE_LOBBY_LIMITS.maxTriangles) {
    errors.push(`triangle budget exceeded (${CC0_OFFICE_LOBBY_LIMITS.maxTriangles.toLocaleString()})`);
  }
  if (metrics.meshes <= 0 || metrics.meshes > CC0_OFFICE_LOBBY_LIMITS.maxMeshes) {
    errors.push(`mesh count outside supported range (${CC0_OFFICE_LOBBY_LIMITS.maxMeshes})`);
  }
  if (metrics.materials <= 0 || metrics.materials > CC0_OFFICE_LOBBY_LIMITS.maxMaterials) {
    errors.push(`material count outside supported range (${CC0_OFFICE_LOBBY_LIMITS.maxMaterials})`);
  }
  if (
    metrics.size.x > CC0_OFFICE_LOBBY_LIMITS.maxDimension
    || metrics.size.z > CC0_OFFICE_LOBBY_LIMITS.maxDimension
    || metrics.size.y > CC0_OFFICE_LOBBY_LIMITS.maxHeight
  ) errors.push('model dimensions exceed the CALLORIA lobby envelope');
  if (
    metrics.size.x < CC0_OFFICE_LOBBY_LIMITS.minWidth
    || metrics.size.z < CC0_OFFICE_LOBBY_LIMITS.minDepth
    || metrics.size.y < CC0_OFFICE_LOBBY_LIMITS.minHeight
  ) errors.push('model dimensions are too small for the lobby envelope');
  if ((metrics.maxTextureEdge ?? 0) > CC0_OFFICE_LOBBY_LIMITS.maxTextureEdge) {
    errors.push(`texture exceeds ${CC0_OFFICE_LOBBY_LIMITS.maxTextureEdge} pixels`);
  }
  return { valid: errors.length === 0, errors };
}
