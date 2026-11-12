/**
 * CALLORIA v6.13 — pure office GLB placement policy.
 * Kept separate from Three.js so the policy can be tested without a WebGL runtime.
 */
export const OFFICE_ASSET_LIMITS = Object.freeze({
  desk: Object.freeze({ low: 450000, balanced: 650000, high: 850000 }),
  computer: Object.freeze({ low: 100000, balanced: 150000, high: 220000 }),
  headset: Object.freeze({ low: 30000, balanced: 45000, high: 65000 }),
  reception: Object.freeze({ low: 180000, balanced: 280000, high: 400000 })
});

export const OFFICE_ASSET_IDS = Object.freeze([
  'office-desk', 'office-computer', 'headset-model', 'reception-desk'
]);

export function getOfficeAssetPlan(tier = 'balanced', stationCount = 12) {
  const safeTier = ['low', 'balanced', 'high'].includes(tier) ? tier : 'balanced';
  const parsedCount = Number(stationCount);
  const available = Number.isFinite(parsedCount)
    ? Math.max(0, Math.min(12, Math.floor(parsedCount)))
    : 0;
  // Keep workstation index 10 available at every graphics tier; this is the
  // employee's default Agent Station 11. High tier adds the other visible row.
  const preferred = safeTier === 'low'
    ? [10]
    : safeTier === 'high'
      ? [8, 9, 10, 11]
      : [9, 10];
  const deskStationIndexes = preferred.filter((index) => index < available);
  return Object.freeze({
    deskStationIndexes: Object.freeze(deskStationIndexes),
    computerStationIndexes: Object.freeze([...deskStationIndexes]),
    headsetStationIndexes: Object.freeze(safeTier === 'low' ? [] : [...deskStationIndexes]),
    includeReceptionDesk: safeTier !== 'low',
    tier: safeTier,
    stationCount: available
  });
}

function positiveFinite(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

export function validateOfficeAssetMetrics(assetId, metrics, tier = 'balanced') {
  const safeTier = ['low', 'balanced', 'high'].includes(tier) ? tier : 'balanced';
  const role = assetId === 'office-desk' ? 'desk'
    : assetId === 'office-computer' ? 'computer'
      : assetId === 'headset-model' ? 'headset'
        : assetId === 'reception-desk' ? 'reception'
          : 'unknown';
  const reasons = [];
  const size = metrics?.size || {};
  const validBounds = positiveFinite(size.x) && positiveFinite(size.y) && positiveFinite(size.z)
    && Number(size.x) < 1000 && Number(size.y) < 1000 && Number(size.z) < 1000;
  const meshCount = Math.max(0, Math.floor(Number(metrics?.meshCount) || 0));
  const triangles = Math.max(0, Math.floor(Number(metrics?.triangles) || 0));
  const maxTriangles = OFFICE_ASSET_LIMITS[role]?.[safeTier] || 0;
  const meshBudget = safeTier === 'low' ? 120 : safeTier === 'balanced' ? 180 : 240;
  if (!validBounds) reasons.push('invalid, missing or implausible model dimensions');
  if (!meshCount || meshCount > meshBudget) reasons.push(`mesh count ${meshCount} is outside the ${meshBudget}-mesh ${safeTier} tier budget`);
  if (!maxTriangles) reasons.push(`asset ID '${assetId}' is not an approved office asset`);
  else if (!triangles || triangles > maxTriangles) reasons.push(`triangle count ${triangles.toLocaleString()} exceeds the ${maxTriangles.toLocaleString()} ${safeTier} tier budget`);
  if (Number(metrics?.maxTextureEdge) > 4096) reasons.push('texture exceeds 4096 pixels');
  return Object.freeze({
    valid: reasons.length === 0,
    reasons: Object.freeze(reasons),
    role,
    tier: safeTier,
    meshBudget,
    triangleBudget: maxTriangles
  });
}
