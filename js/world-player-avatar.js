/* CALLORIA v6.10 first-person adapter; keep player geometry hidden until it passes visual scale and rig QA. */
export async function createCalloriaPlayerAvatar({ onStatus } = {}) {
  const status = {
    ready: false,
    active: false,
    firstPersonOnly: true,
    assetId: null,
    reason: 'First-person view is active. The unverified player mesh is hidden to prevent camera occlusion.'
  };
  try { onStatus?.(status); } catch { /* Optional diagnostic callback. */ }
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));
  }
  return { status, active: false, setVisible() {}, update() {}, dispose() {} };
}
