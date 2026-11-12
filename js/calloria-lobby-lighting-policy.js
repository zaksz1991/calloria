/**
 * CALLORIA v6.21 — device-tier-aware lobby and greenery shadow policy.
 * Static lobby batches remain non-casters; foliage batches cast shadows on
 * balanced/high tiers. Low tier disables both receiving and casting.
 */
function isDecorativeLobbyMesh(object) {
  if (object?.userData?.calloriaLobbyDecorative) return true;
  for (let current = object; current; current = current.parent) {
    if (current.userData?.calloriaDecorAsset) return true;
  }
  return false;
}

export function applyCalloriaLobbyLightingPolicy(root, { tier = 'balanced' } = {}) {
  const enabled = tier !== 'low';
  let meshCount = 0;
  let shadowReceivers = 0;
  let decorativeMeshes = 0;
  let decorativeShadowCasters = 0;
  if (!root?.traverse) {
    return { tier, enabled, meshCount, shadowReceivers, decorativeMeshes, decorativeShadowCasters };
  }

  root.traverse((object) => {
    if (!(object?.isMesh || object?.isSkinnedMesh || object?.isInstancedMesh)) return;
    meshCount += 1;
    const decorative = isDecorativeLobbyMesh(object);
    object.receiveShadow = enabled;
    object.castShadow = Boolean(enabled && decorative);
    if (enabled) shadowReceivers += 1;
    if (decorative) decorativeMeshes += 1;
    if (object.castShadow) decorativeShadowCasters += 1;
  });

  return { tier, enabled, meshCount, shadowReceivers, decorativeMeshes, decorativeShadowCasters };
}
