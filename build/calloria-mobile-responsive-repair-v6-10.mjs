/**
 * CALLORIA v6.10 — mobile layout, assessment interaction and first-person guard.
 * Runs after the existing world/OJT transforms. Does not create a render loop,
 * alter contact logic, or replace the production-world module.
 */
const TARGETS = Object.freeze({
  avatar: '/js/world-player-avatar.js',
  world: '/js/production-world.js'
});

export const MOBILE_REPAIR_MARKERS = Object.freeze({
  avatar: '__CALLORIA_V610_FIRST_PERSON_MOBILE_ADAPTER__',
  world: '__CALLORIA_V610_FIRST_PERSON_CAMERA_GUARD__',
  html: 'CALLORIA_V610_MOBILE_RESPONSIVE_REPAIR'
});

export const FIRST_PERSON_AVATAR_MODULE = `/* ${MOBILE_REPAIR_MARKERS.avatar}
 * The player body is intentionally hidden until a validated, correctly scaled
 * and fully reviewed player rig is available. NPC and office GLBs are separate.
 */
export async function createCalloriaPlayerAvatar({ onStatus } = {}) {
  const status = {
    ready: false,
    active: false,
    firstPersonOnly: true,
    assetId: null,
    reason: 'First-person mobile-safe camera is active; unverified player geometry is disabled.'
  };
  try { onStatus?.(status); } catch { /* Optional diagnostic callback. */ }
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));
  }
  return Object.freeze({
    status,
    active: false,
    setVisible() {},
    update() {},
    dispose() {}
  });
}
`;

const CAMERA_ANCHOR = '    if (immersive && playerAvatarLayer?.active) {';
const VISIBILITY_ANCHOR = '    playerAvatarLayer?.setVisible?.(immersive);';
const WORLD_MARKER = `/* ${MOBILE_REPAIR_MARKERS.world} */`;

function normaliseId(id) {
  return String(id || '').split('?')[0].replaceAll('\\', '/');
}

function transformWorld(context, source) {
  if (source.includes(MOBILE_REPAIR_MARKERS.world)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  let changed = false;

  // Third-person v2.5 moved the camera behind the player model. On touch
  // devices, explicitly restore the original eye-level camera every frame.
  if (code.includes(CAMERA_ANCHOR)) {
    const branch = `${WORLD_MARKER}\n    if (immersive && touchDevice) {\n      // Hide the entire player pivot as well as returning the camera to eye level.\n      playerAvatarLayer?.setVisible?.(false);\n      camera.position.set(player.x, 1.68, player.z);\n      camera.rotation.order = 'YXZ';\n      camera.rotation.set(player.pitch, player.yaw, 0);\n    } else if (immersive && playerAvatarLayer?.active) {`;
    code = code.replace(CAMERA_ANCHOR, branch);
    changed = true;
  } else if (code.includes('playerAvatarLayer?.active')) {
    context.warn?.('CALLORIA v6.10: the third-person camera anchor changed; first-person adapter remains active, but the camera-frame guard was not injected.');
  }

  // Prevent a flash of the model on the transition into immersive mode.
  if (code.includes(VISIBILITY_ANCHOR)) {
    code = code.replace(VISIBILITY_ANCHOR, '    playerAvatarLayer?.setVisible?.(immersive && !touchDevice);');
    changed = true;
  }

  return changed ? { code, map: null } : null;
}

function injectHtml(html) {
  const source = String(html);
  if (!source.includes('id="viewRoot"') || !source.includes('id="worldCanvas"')) return html;
  if (source.includes(MOBILE_REPAIR_MARKERS.html)) return html;
  const styleTag = '<link rel="stylesheet" href="/calloria-mobile-responsive-v6-10.css" data-calloria-mobile-v610>';
  const scriptTag = '<script type="module" src="/js/calloria-mobile-ui-guard-v6-10.js" data-calloria-mobile-v610></script>';
  let result = source;
  if (/<\/head>/i.test(result)) result = result.replace(/<\/head>/i, `${styleTag}\n<!-- ${MOBILE_REPAIR_MARKERS.html} -->\n</head>`);
  else result = `${styleTag}\n${result}`;
  if (/<\/body>/i.test(result)) result = result.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  else result = `${result}\n${scriptTag}`;
  return result;
}

export function calloriaMobileResponsiveRepairPlugin() {
  return {
    name: 'calloria-mobile-responsive-repair-v6-10',
    enforce: 'post',
    transform(source, id) {
      const target = normaliseId(id);
      if (target.endsWith(TARGETS.avatar)) return { code: FIRST_PERSON_AVATAR_MODULE, map: null };
      if (target.endsWith(TARGETS.world)) return transformWorld(this, source);
      return null;
    },
    transformIndexHtml(html) {
      return injectHtml(html);
    }
  };
}

export const __calloriaV610Test = Object.freeze({
  TARGETS, CAMERA_ANCHOR, VISIBILITY_ANCHOR, transformWorld, injectHtml, normaliseId
});
