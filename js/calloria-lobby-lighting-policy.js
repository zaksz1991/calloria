/**
 * CALLORIA v6.20 — device-tier-aware interior shadow receiving policy.
 * The lobby receives shadows from existing dynamic staff/props on balanced/high
 * tiers. Low tier keeps the previous inexpensive no-receive-shadow behavior.
 */
export function applyCalloriaLobbyLightingPolicy(root, { tier = 'balanced' } = {}) {
  const enabled = tier !== 'low';
  let meshCount = 0;
  let shadowReceivers = 0;
  if (!root?.traverse) return { tier, enabled, meshCount, shadowReceivers };

  root.traverse((object) => {
    if (!(object?.isMesh || object?.isSkinnedMesh || object?.isInstancedMesh)) return;
    meshCount += 1;
    object.receiveShadow = enabled;
    if (enabled) shadowReceivers += 1;
  });

  return { tier, enabled, meshCount, shadowReceivers };
}
