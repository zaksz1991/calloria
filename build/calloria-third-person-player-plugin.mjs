/**
 * CALLORIA third-person GLB player integration.
 * Runs after the GLB-world transform so the real GLB-ready and lifecycle
 * anchors are available. Reuses the existing renderer and frame loop.
 */
const TARGET = '/js/production-world.js';
const IMPORT = "import { createCalloriaPlayerAvatar } from './world-player-avatar.js';";
const MARKER = '__CALLORIA_THIRD_PERSON_PLAYER_V25__';
const READY = '  callbacks.onAssetsReady?.(combinedAssetStatus);';
const UPDATE = '    updatePlayer(delta);';
const DISPOSE = '      worldMissionLayer?.dispose?.();';
const IMMERSIVE = "    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));";

function count(source, needle) { return source.split(needle).length - 1; }
function requireOnce(context, source, needle, label) {
  const occurrences = count(source, needle);
  if (occurrences !== 1) {
    context.error(`CALLORIA third-person/workstation integration expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
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
  let calloriaWorkstationBusy = false;
  let calloriaPlayerActivity = 'idle';
  const calloriaClearMovement = () => {
    keys.clear();
    touchMove.x = 0;
    touchMove.y = 0;
    touchMove.sprinting = false;
    touchMove.pointerId = null;
    const stick = document.getElementById('touchStick');
    if (stick) stick.style.transform = 'translate(0px, 0px)';
  };
  const calloriaOnOperationSelected = () => {
    calloriaWorkstationBusy = true;
    calloriaPlayerActivity = 'working';
    calloriaClearMovement();
  };
  const calloriaOnCallConnected = () => {
    if (calloriaWorkstationBusy) calloriaPlayerActivity = 'talking';
  };
  const calloriaOnCaseSaved = () => {
    if (calloriaWorkstationBusy) calloriaPlayerActivity = 'working';
  };
  const calloriaOnWorkstationResumed = () => {
    calloriaWorkstationBusy = false;
    calloriaPlayerActivity = 'idle';
  };
  const calloriaOnImmersiveState = (event) => {
    if (!event?.detail?.active) {
      calloriaWorkstationBusy = false;
      calloriaPlayerActivity = 'idle';
      calloriaClearMovement();
    }
  };
  window.addEventListener('calloria:game-operation-selected', calloriaOnOperationSelected);
  window.addEventListener('calloria:game-call-connected', calloriaOnCallConnected);
  window.addEventListener('calloria:game-case-saved', calloriaOnCaseSaved);
  window.addEventListener('calloria:workstation-resumed', calloriaOnWorkstationResumed);
  window.addEventListener('calloria:world-immersive', calloriaOnImmersiveState);
  try {
    playerAvatarLayer = await createCalloriaPlayerAvatar({ scene, tier, onStatus: (status) => {
      const node = document.getElementById('assetStatus');
      if (node) {
        const motion = status?.ready ? [status.hasIdle ? 'idle' : null, status.hasWalk ? 'walk' : null, status.hasRun ? 'run' : null, status.hasWork ? 'work' : null, status.hasTalk ? 'talk' : null].filter(Boolean).join('/') : '';
        node.textContent += status?.ready ? '  ·  PLAYER GLB: ' + status.assetName + (motion ? ' · ' + motion : ' · no embedded clips') : '  ·  PLAYER GLB: unavailable';
      }
    }});
    playerAvatarLayer?.setVisible?.(immersive);
  } catch (error) {
    console.warn('CALLORIA player GLB unavailable; retaining the original controller.', error);
  }`);

  code = code.replace(UPDATE, `    const operationMode = calloriaWorkstationBusy || document.body.classList.contains('calloria-game-operation');
    if (operationMode) calloriaClearMovement();
    else updatePlayer(delta);
    const playerMoving = !operationMode && (touchMove.x !== 0 || touchMove.y !== 0 || ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key)));
    playerAvatarLayer?.update?.({ x: player.x, z: player.z, yaw: player.yaw, moving: playerMoving, sprinting: !operationMode && (touchMove.sprinting || keys.has('ShiftLeft') || keys.has('ShiftRight')), activity: operationMode ? calloriaPlayerActivity : 'idle', delta });
    if (immersive && playerAvatarLayer?.active) {
      const followDistance = mobile ? 3.9 : 4.8;
      const followHeight = mobile ? 2.35 : 2.65;
      camera.position.set(player.x + Math.sin(player.yaw) * followDistance, followHeight, player.z + Math.cos(player.yaw) * followDistance);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(player.pitch - 0.12, player.yaw, 0);
    }`);

  code = code.replace(DISPOSE, `${DISPOSE}
      window.removeEventListener('calloria:game-operation-selected', calloriaOnOperationSelected);
      window.removeEventListener('calloria:game-call-connected', calloriaOnCallConnected);
      window.removeEventListener('calloria:game-case-saved', calloriaOnCaseSaved);
      window.removeEventListener('calloria:workstation-resumed', calloriaOnWorkstationResumed);
      window.removeEventListener('calloria:world-immersive', calloriaOnImmersiveState);
      playerAvatarLayer?.dispose?.();`);
  code = code.replace(IMMERSIVE, `${IMMERSIVE}
    playerAvatarLayer?.setVisible?.(immersive);`);
  return { code, map: null };
}

export function calloriaThirdPersonPlayerPlugin() {
  return {
    name: 'calloria-third-person-player-v2-5-workstation-aware',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      return transformWorld(this, source);
    }
  };
}

export const __thirdPersonPlayerPluginTest = Object.freeze({
  TARGET, MARKER, READY, UPDATE, DISPOSE, IMMERSIVE, transformWorld
});
