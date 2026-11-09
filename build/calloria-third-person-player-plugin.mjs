/**
 * Adds a real GLB player character and an optional third-person follow camera
 * to CALLORIA's existing production-world. This is a post-transform so it runs
 * after the existing GLB world adapter has connected the office/staff layers.
 */
const TARGET = '/js/production-world.js';
const IMPORT = "import { createCalloriaPlayerAvatar } from './world-player-avatar.js';";
const MARKER = '__CALLORIA_THIRD_PERSON_PLAYER_V24__';
const READY = '  callbacks.onAssetsReady?.(combinedAssetStatus);';
const UPDATE = '    updatePlayer(delta);';
const DISPOSE = '      worldMissionLayer?.dispose?.();';
const IMMERSIVE = "    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));";
function count(source, needle) { return source.split(needle).length - 1; }
function requireOnce(context, source, needle, label) {
  const occurrences = count(source, needle);
  if (occurrences !== 1) context.error(`CALLORIA third-person player expected exactly one ${label} anchor (${occurrences} found). Refusing partial integration.`);
}
function transformWorld(context, source) {
  if (source.includes(MARKER)) return null;
  const normalized = String(source).replace(/\r\n?/g, '\n');
  for (const [anchor, label] of [
    [READY, 'combined GLB-ready callback'],
    [UPDATE, 'player update loop'],
    [DISPOSE, 'GLB world disposal'],
    [IMMERSIVE, 'immersive-state event']
  ]) requireOnce(context, normalized, anchor, label);

  let code = `${IMPORT}\nconst ${MARKER} = true;\n${normalized}`;
  code = code.replace(READY, `${READY}
  let playerAvatarLayer = null;
  try {
    playerAvatarLayer = await createCalloriaPlayerAvatar({ scene, tier, onStatus: (status) => {
      const node = document.getElementById('assetStatus');
      if (node) node.textContent += status?.ready ? '  ·  PLAYER GLB: ' + status.assetName : '  ·  PLAYER GLB: unavailable';
    }});
    playerAvatarLayer?.setVisible?.(immersive);
  } catch (error) {
    console.warn('CALLORIA player GLB unavailable; retaining the original controller.', error);
  }`);
  code = code.replace(UPDATE, `${UPDATE}
    const playerMoving = touchMove.x !== 0 || touchMove.y !== 0 || ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key));
    playerAvatarLayer?.update?.({ x: player.x, z: player.z, yaw: player.yaw, moving: playerMoving, sprinting: touchMove.sprinting || keys.has('ShiftLeft') || keys.has('ShiftRight'), delta });
    if (immersive && playerAvatarLayer?.active) {
      const followDistance = mobile ? 3.9 : 4.8;
      const followHeight = mobile ? 2.35 : 2.65;
      camera.position.set(player.x + Math.sin(player.yaw) * followDistance, followHeight, player.z + Math.cos(player.yaw) * followDistance);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(clamp(player.pitch - 0.12, -0.78, 0.30), player.yaw, 0);
    }`);
  code = code.replace(DISPOSE, `${DISPOSE}
      playerAvatarLayer?.dispose?.();`);
  code = code.replace(IMMERSIVE, `${IMMERSIVE}
    playerAvatarLayer?.setVisible?.(immersive);`);
  return { code, map: null };
}
export function calloriaThirdPersonPlayerPlugin() {
  return {
    name: 'calloria-third-person-player-v2-4',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      return transformWorld(this, source);
    }
  };
}
export const __thirdPersonPlayerPluginTest = Object.freeze({ TARGET, MARKER, READY, UPDATE, DISPOSE, IMMERSIVE, transformWorld });
