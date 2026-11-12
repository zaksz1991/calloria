/**
 * CALLORIA v6.16 — pure CC0 workstation chair policy.
 * No Three.js import: station coverage and model budgets can be tested offline.
 */
export const CC0_OFFICE_CHAIR_ASSET = Object.freeze({
  id: '3dassets-office-task-chair',
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

export const CC0_OFFICE_CHAIR_LIMITS = Object.freeze({
  trianglesPerChair: 4000,
  meshes: 40,
  materials: 8,
  maxDimension: 1.5,
  minWidth: 0.4,
  minDepth: 0.4,
  minHeight: 0.75,
  maxTextureEdge: 4096,
  maxPlacedTriangles: 32000,
  minFloorOrigin: -0.08,
  maxFloorOrigin: 0.12
});

const STATION_IDS_BY_TIER = Object.freeze({
  low: Object.freeze([10, 11]),
  balanced: Object.freeze([9, 10, 11, 12]),
  high: Object.freeze([5, 6, 7, 8, 9, 10, 11, 12])
});

const positiveFinite = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export function getCC0ChairStationIds(tier = 'balanced', stations = []) {
  const safeTier = ['low', 'balanced', 'high'].includes(String(tier).toLowerCase())
    ? String(tier).toLowerCase()
    : 'balanced';
  const allowed = new Set(STATION_IDS_BY_TIER[safeTier]);
  const seen = new Set();
  const result = [];
  (Array.isArray(stations) ? stations : []).forEach((station, index) => {
    const id = Number.isFinite(Number(station?.id)) ? Number(station.id) : index + 1;
    if (allowed.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  });
  return result;
}

export function validateCC0OfficeChair(metrics) {
  const errors = [];
  if (!metrics?.size) return Object.freeze({ valid: false, errors: Object.freeze(['missing chair geometry metrics']) });

  const size = metrics.size;
  if (![size.x, size.y, size.z].every(positiveFinite)) errors.push('chair dimensions are missing or invalid');
  if (Number(size.x) < CC0_OFFICE_CHAIR_LIMITS.minWidth || Number(size.z) < CC0_OFFICE_CHAIR_LIMITS.minDepth || Number(size.y) < CC0_OFFICE_CHAIR_LIMITS.minHeight) {
    errors.push('chair dimensions are too small for a workstation seat');
  }
  if (Number(size.x) > CC0_OFFICE_CHAIR_LIMITS.maxDimension || Number(size.y) > CC0_OFFICE_CHAIR_LIMITS.maxDimension || Number(size.z) > CC0_OFFICE_CHAIR_LIMITS.maxDimension) {
    errors.push('chair dimensions exceed the workstation envelope');
  }
  const triangles = Math.floor(Number(metrics.triangles) || 0);
  const meshes = Math.floor(Number(metrics.meshes) || 0);
  const materials = Math.floor(Number(metrics.materials) || 0);
  if (triangles < 1 || triangles > CC0_OFFICE_CHAIR_LIMITS.trianglesPerChair) errors.push('per-chair triangle budget exceeded');
  if (meshes < 1 || meshes > CC0_OFFICE_CHAIR_LIMITS.meshes) errors.push('chair mesh count outside supported range');
  if (materials < 1 || materials > CC0_OFFICE_CHAIR_LIMITS.materials) errors.push('chair material count outside supported range');
  if (Number(metrics.maxTextureEdge) > CC0_OFFICE_CHAIR_LIMITS.maxTextureEdge) errors.push('chair texture exceeds 4096 pixels');
  if (!Number.isFinite(Number(metrics.minY)) || Number(metrics.minY) < CC0_OFFICE_CHAIR_LIMITS.minFloorOrigin || Number(metrics.minY) > CC0_OFFICE_CHAIR_LIMITS.maxFloorOrigin) {
    errors.push('chair base is not close to the authored floor origin');
  }
  if (Number(metrics.unsupportedMeshes) > 0) errors.push('chair contains meshes that cannot be safely batched');

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

export function getCC0ChairPlacedTriangleCount(trianglesPerChair, placementCount) {
  const triangles = Math.floor(Number(trianglesPerChair) || 0);
  const count = Math.max(0, Math.floor(Number(placementCount) || 0));
  return triangles * count;
}

export function isCC0ChairPlacementWithinBudget(trianglesPerChair, placementCount) {
  return getCC0ChairPlacedTriangleCount(trianglesPerChair, placementCount) <= CC0_OFFICE_CHAIR_LIMITS.maxPlacedTriangles;
}
