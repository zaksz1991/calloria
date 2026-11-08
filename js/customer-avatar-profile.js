const PROFILES = Object.freeze({
  calm:       { headForward: 0.000, headTilt: 0.000, spine: 0.000, leftArm: 0.000, rightArm: 0.000, energy: 0.55 },
  happy:      { headForward: -0.012, headTilt: 0.015, spine: -0.008, leftArm: -0.025, rightArm: -0.025, energy: 0.72 },
  playful:    { headForward: -0.006, headTilt: 0.055, spine: -0.006, leftArm: -0.035, rightArm: -0.010, energy: 0.82 },
  angry:      { headForward: 0.055, headTilt: 0.000, spine: 0.025, leftArm: 0.065, rightArm: 0.065, energy: 0.78 },
  hostile:    { headForward: 0.065, headTilt: -0.012, spine: 0.035, leftArm: 0.075, rightArm: 0.075, energy: 0.88 },
  confused:   { headForward: 0.005, headTilt: 0.105, spine: 0.000, leftArm: -0.015, rightArm: -0.045, energy: 0.46 },
  uncertain:  { headForward: 0.018, headTilt: 0.012, spine: 0.020, leftArm: 0.008, rightArm: 0.008, energy: 0.35 },
  anxious:    { headForward: 0.028, headTilt: 0.012, spine: 0.024, leftArm: 0.018, rightArm: 0.018, energy: 0.58 },
  suspicious: { headForward: 0.000, headTilt: -0.030, spine: -0.025, leftArm: 0.045, rightArm: 0.045, energy: 0.38 },
  skeptical:  { headForward: 0.000, headTilt: -0.040, spine: -0.018, leftArm: 0.035, rightArm: 0.025, energy: 0.42 },
  sarcastic:  { headForward: 0.004, headTilt: 0.055, spine: -0.008, leftArm: -0.018, rightArm: 0.022, energy: 0.60 },
  distressed: { headForward: 0.035, headTilt: 0.018, spine: 0.035, leftArm: 0.015, rightArm: 0.015, energy: 0.30 },
  urgent:     { headForward: 0.040, headTilt: 0.000, spine: 0.015, leftArm: 0.035, rightArm: 0.035, energy: 0.86 },
  talkative:  { headForward: -0.002, headTilt: 0.025, spine: -0.004, leftArm: -0.028, rightArm: -0.045, energy: 0.76 }
});

const REACTION = Object.freeze({
  improving: { openness: 0.75, tension: 0.45, energy: 0.78 },
  steady: { openness: 0.50, tension: 0.62, energy: 0.55 },
  deteriorating: { openness: 0.18, tension: 1.0, energy: 0.88 }
});

export function getCustomerMotionProfile(emotion = 'calm', reaction = 'steady') {
  const base = PROFILES[String(emotion).toLowerCase()] || PROFILES.calm;
  const response = REACTION[String(reaction).toLowerCase()] || REACTION.steady;
  const tension = response.tension;
  const openness = response.openness;
  return Object.freeze({
    headForward: base.headForward * tension,
    headTilt: base.headTilt,
    spine: base.spine * tension,
    leftArm: base.leftArm * (0.55 + 0.45 * tension) - openness * 0.008,
    rightArm: base.rightArm * (0.55 + 0.45 * tension) - openness * 0.008,
    energy: Math.max(0.18, Math.min(1, base.energy * response.energy))
  });
}

export function chooseApprovedCustomerAssets(approvedAssetIds = [], seed = '') {
  const eligible = ['robbert-visitor', 'ribbert-customer'].filter((id) => approvedAssetIds.includes(id));
  if (!eligible.length) return [];
  const value = String(seed || 'calloria').split('').reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7);
  const offset = value % eligible.length;
  return [...eligible.slice(offset), ...eligible.slice(0, offset)];
}

export function chooseApprovedCustomerAsset(approvedAssetIds = [], seed = '') {
  return chooseApprovedCustomerAssets(approvedAssetIds, seed)[0] || null;
}

export function validateCustomerRigMetrics(metrics = {}) {
  const reasons = [];
  const size = metrics.size || {};
  if (!(size.y >= 1 && size.y <= 2.6 && size.x >= 0.2 && size.x <= 1.35 && size.z >= 0.12 && size.z <= 1.35)) reasons.push('model dimensions are outside the configured human scale range');
  if (!(metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15 && metrics.boneCount <= 180)) reasons.push('a usable character skeleton was not detected');
  if (!(metrics.triangleCount > 0 && metrics.triangleCount <= 120000 && metrics.meshCount <= 100)) reasons.push('geometry exceeds the customer avatar budget');
  if (metrics.maxTextureEdge > 4096) reasons.push('a texture exceeds 4096 pixels');
  return { compatible: reasons.length === 0, reasons };
}
