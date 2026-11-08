const MOTION_KEYS = Object.freeze([
  'headForward',
  'headTilt',
  'spine',
  'leftArm',
  'rightArm',
  'energy'
]);

/**
 * A stage can reuse its WebGL renderer/model when the newly selected primary
 * asset is identical. This avoids creating a fresh WebGL context on each
 * Customer Intelligence Lab re-render (for example, after every agent turn).
 */
export function canReuseCustomerAvatarStage(stage, candidateIds = []) {
  return Boolean(
    stage &&
    !stage.disposed &&
    stage.renderer &&
    stage.model &&
    stage.assetId &&
    Array.isArray(candidateIds) &&
    candidateIds[0] === stage.assetId
  );
}

export function readCustomerAvatarState(dataset = {}) {
  return Object.freeze({
    emotion: String(dataset.emotion || 'calm').trim().toLowerCase(),
    reaction: String(dataset.reaction || 'steady').trim().toLowerCase(),
    persona: String(dataset.persona || 'calm').trim().toLowerCase(),
    customer: String(dataset.customer || 'Simulated customer').trim(),
    session: String(dataset.session || '').trim()
  });
}

/** Smoothly transitions body-language offsets instead of snapping on each turn. */
export function interpolateCustomerMotion(current = {}, target = {}, delta = 1 / 30) {
  const safeDelta = Math.max(0, Math.min(Number(delta) || 0, 0.1));
  const alpha = 1 - Math.exp(-safeDelta * 5.5);
  const next = {};
  for (const key of MOTION_KEYS) {
    const from = Number(current[key] ?? target[key] ?? 0);
    const to = Number(target[key] ?? from);
    next[key] = from + (to - from) * alpha;
  }
  return next;
}
