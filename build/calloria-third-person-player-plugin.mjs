/**
 * CALLORIA v2.6 — third-person player integration compatible with the current
 * locally-generated production world and the v6.84 GLB-world post-transform.
 *
 * The player GLB is optional and starts after the initial world render. Touch
 * devices deliberately retain the first-person camera and do not download a
 * separate player avatar.
 */
const TARGET = '/js/production-world.js';
const IMPORT = "import { createCalloriaPlayerAvatar } from './world-player-avatar.js';";
const MARKER = '__CALLORIA_THIRD_PERSON_PLAYER_V26__';
const LEGACY_MARKER = '__CALLORIA_THIRD_PERSON_PLAYER_V25__';
const RENDER_READY = "  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });\n  renderStill();";
const UPDATE = '    updatePlayer(delta);';
const CURRENT_DISPOSE = '      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();';
const V684_DISPOSE = '      worldMissionLayer?.dispose?.();';
const IMMERSIVE_CALLBACK = '    callbacks.onImmersiveChange?.(immersive);';
const IMMERSIVE_EVENT = "    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));";

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireExactlyOnce(context, source, anchor, label) {
  const occurrences = count(source, anchor);
  if (occurrences !== 1) {
    context.error(`CALLORIA third-person v2.6 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
}

function transformWorld(context, source) {
  if (source.includes(MARKER) || source.includes(LEGACY_MARKER)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');

  // Both supported source shapes retain the same first-render and player-update
  // anchors. v6.84 changes the disposal and immersive callback blocks, so those
  // are selected independently below instead of assuming one old implementation.
  requireExactlyOnce(context, code, RENDER_READY, 'initial render-ready');
  requireExactlyOnce(context, code, UPDATE, 'player update loop');

  const hasV684Dispose = count(code, V684_DISPOSE) === 1;
  const hasCurrentDispose = count(code, CURRENT_DISPOSE) === 1;
  if (Number(hasV684Dispose) + Number(hasCurrentDispose) !== 1) {
    context.error(`CALLORIA third-person v2.6 expected one supported world-disposal anchor (v6.84=${count(code, V684_DISPOSE)}, current=${count(code, CURRENT_DISPOSE)}). Refusing a partial transform.`);
  }

  const hasImmersiveEvent = count(code, IMMERSIVE_EVENT) === 1;
  const hasImmersiveCallback = count(code, IMMERSIVE_CALLBACK) === 1;
  // v6.84 preserves callbacks.onImmersiveChange and adds the public event after it.
  // Prefer the event when it exists; the untransformed current world needs the
  // callback branch to publish that event itself.
  if (!hasImmersiveEvent && !hasImmersiveCallback) {
    context.error(`CALLORIA third-person v2.6 expected an immersive-state anchor (event=${count(code, IMMERSIVE_EVENT)}, callback=${count(code, IMMERSIVE_CALLBACK)}). Refusing a partial transform.`);
  }

  code = `${IMPORT}\nconst ${MARKER} = true;\n${code}`;

  const runtime = `
  // Player-avatar loading is deliberately detached from world initialisation.
  // On touch devices the first-person controller is retained and no extra GLB
  // download or decode is started.
  let playerAvatarLayer = null;
  let calloriaPlayerAvatarIdleHandle = null;
  let calloriaPlayerAvatarTimer = null;
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

  const calloriaCancelPlayerAvatarStart = () => {
    if (calloriaPlayerAvatarIdleHandle !== null && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(calloriaPlayerAvatarIdleHandle);
    }
    if (calloriaPlayerAvatarTimer !== null) window.clearTimeout(calloriaPlayerAvatarTimer);
    calloriaPlayerAvatarIdleHandle = null;
    calloriaPlayerAvatarTimer = null;
  };
  const calloriaStartPlayerAvatar = () => {
    calloriaPlayerAvatarIdleHandle = null;
    calloriaPlayerAvatarTimer = null;
    if (disposed || mobile) return;
    void createCalloriaPlayerAvatar({ scene, tier, onStatus: (status) => {
      const node = document.getElementById('assetStatus');
      if (!node) return;
      const message = status?.ready
        ? '  ·  PLAYER GLB: ' + (status.assetName || status.assetId || 'agent')
          + ((status.hasIdle || status.hasWalk || status.hasRun)
            ? ' · ' + [status.hasIdle ? 'idle' : null, status.hasWalk ? 'walk' : null, status.hasRun ? 'run' : null].filter(Boolean).join('/')
            : ' · static-pose fallback')
        : '  ·  PLAYER GLB: unavailable';
      node.textContent = String(node.textContent || '') + message;
    }}).then((layer) => {
      if (disposed) {
        layer?.dispose?.();
        return;
      }
      playerAvatarLayer = layer || null;
      playerAvatarLayer?.setVisible?.(Boolean(immersive && !mobile));
    }).catch((error) => {
      console.warn('CALLORIA player GLB unavailable; retaining the original first-person controller.', error);
      const node = document.getElementById('assetStatus');
      if (node) node.textContent = String(node.textContent || '') + '  ·  PLAYER GLB: unavailable';
    });
  };
  if (mobile) {
    const node = document.getElementById('assetStatus');
    if (node) node.textContent = String(node.textContent || '') + '  ·  PLAYER VIEW: FIRST-PERSON TOUCH';
  } else if (typeof window.requestIdleCallback === 'function') {
    calloriaPlayerAvatarIdleHandle = window.requestIdleCallback(calloriaStartPlayerAvatar, { timeout: 1400 });
  } else {
    calloriaPlayerAvatarTimer = window.setTimeout(calloriaStartPlayerAvatar, 240);
  }
`;

  code = code.replace(RENDER_READY, `${RENDER_READY}\n${runtime}`);

  code = code.replace(UPDATE, `    const operationMode = calloriaWorkstationBusy || document.body.classList.contains('calloria-game-operation');
    if (operationMode) calloriaClearMovement();
    else updatePlayer(delta);
    const playerMoving = !operationMode && (touchMove.x !== 0 || touchMove.y !== 0 || ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].some((key) => keys.has(key)));
    playerAvatarLayer?.update?.({
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      moving: playerMoving,
      sprinting: !operationMode && (touchMove.sprinting || keys.has('ShiftLeft') || keys.has('ShiftRight')),
      activity: operationMode ? calloriaPlayerActivity : 'idle',
      delta
    });
    if (immersive && !mobile && playerAvatarLayer?.active) {
      const followDistance = 4.8;
      const followHeight = 2.65;
      camera.position.set(player.x + Math.sin(player.yaw) * followDistance, followHeight, player.z + Math.cos(player.yaw) * followDistance);
      camera.rotation.order = 'YXZ';
      camera.rotation.set(player.pitch - 0.12, player.yaw, 0);
    }`);

  if (hasV684Dispose) {
    code = code.replace(V684_DISPOSE, `${V684_DISPOSE}
      calloriaCancelPlayerAvatarStart();
      window.removeEventListener('calloria:game-operation-selected', calloriaOnOperationSelected);
      window.removeEventListener('calloria:game-call-connected', calloriaOnCallConnected);
      window.removeEventListener('calloria:game-case-saved', calloriaOnCaseSaved);
      window.removeEventListener('calloria:workstation-resumed', calloriaOnWorkstationResumed);
      window.removeEventListener('calloria:world-immersive', calloriaOnImmersiveState);
      playerAvatarLayer?.dispose?.();`);
  } else {
    code = code.replace(CURRENT_DISPOSE, `${CURRENT_DISPOSE}
      calloriaCancelPlayerAvatarStart();
      window.removeEventListener('calloria:game-operation-selected', calloriaOnOperationSelected);
      window.removeEventListener('calloria:game-call-connected', calloriaOnCallConnected);
      window.removeEventListener('calloria:game-case-saved', calloriaOnCaseSaved);
      window.removeEventListener('calloria:workstation-resumed', calloriaOnWorkstationResumed);
      window.removeEventListener('calloria:world-immersive', calloriaOnImmersiveState);
      playerAvatarLayer?.dispose?.();`);
  }

  if (hasImmersiveEvent) {
    code = code.replace(IMMERSIVE_EVENT, `${IMMERSIVE_EVENT}
    playerAvatarLayer?.setVisible?.(Boolean(immersive && !mobile));`);
  } else {
    code = code.replace(IMMERSIVE_CALLBACK, `${IMMERSIVE_CALLBACK}
    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));
    playerAvatarLayer?.setVisible?.(Boolean(immersive && !mobile));`);
  }

  return { code, map: null };
}

export function calloriaThirdPersonPlayerPlugin() {
  return {
    name: 'calloria-third-person-player-v2-6-current-world-compatible',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      return transformWorld(this, source);
    }
  };
}

export const __thirdPersonPlayerPluginTest = Object.freeze({
  TARGET,
  MARKER,
  RENDER_READY,
  UPDATE,
  CURRENT_DISPOSE,
  V684_DISPOSE,
  IMMERSIVE_CALLBACK,
  IMMERSIVE_EVENT,
  transformWorld
});
