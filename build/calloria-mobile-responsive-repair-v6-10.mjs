/**
 * CALLORIA v6.11 — build-safe mobile interaction hardening.
 * Kept at the v6.10 module path/export so the already-installed Vite config
 * does not need a second fragile edit. The module is intentionally additive.
 */
const TARGETS = Object.freeze({
  avatar: '/js/world-player-avatar.js',
  world: '/js/production-world.js'
});

export const MOBILE_REPAIR_MARKERS = Object.freeze({
  avatar: '__CALLORIA_V610_FIRST_PERSON_MOBILE_ADAPTER__',
  world: '__CALLORIA_V611_FIRST_PERSON_CAMERA_GUARD__',
  html: 'CALLORIA_V611_MOBILE_INTERACTION_HARDENING'
});

export const FIRST_PERSON_AVATAR_MODULE = `/* ${MOBILE_REPAIR_MARKERS.avatar}
 * Mobile devices use a first-person camera and do not load a full-size player
 * body. Desktop devices retain the validated GLB avatar and workstation motions.
 */
export async function createCalloriaPlayerAvatar(options = {}) {
  const mobile = Boolean(
    typeof window !== 'undefined' && (
      window.matchMedia?.('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia?.('(max-width: 760px)').matches ||
      window.innerWidth <= 760
    )
  );
  if (!mobile) {
    const desktopAvatar = await import('./world-player-avatar-desktop.js');
    return desktopAvatar.createCalloriaPlayerAvatar(options);
  }

  const status = {
    ready: false,
    active: false,
    firstPersonOnly: true,
    assetId: null,
    reason: 'Mobile first-person view is active. The player body is intentionally not loaded, preventing the character mesh from covering the camera.'
  };
  try { options.onStatus?.(status); } catch { /* Optional diagnostic callback. */ }
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

function normaliseId(id) {
  return String(id || '').split('?')[0].replaceAll('\\', '/');
}

function transformWorld(context, source) {
  if (source.includes(MOBILE_REPAIR_MARKERS.world)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  const branchPattern = /if\s*\(\s*immersive\s*&&\s*playerAvatarLayer\?\.active\s*\)\s*\{/g;
  const branches = [...code.matchAll(branchPattern)];
  let changed = false;

  // v2.5 owns the third-person follow branch. Do not change its desktop path;
  // add an explicit first-person path for phones and coarse-pointer devices.
  if (branches.length === 1) {
    const match = branches[0][0];
    const guarded = `/* ${MOBILE_REPAIR_MARKERS.world} */\n    if (immersive && (touchDevice || window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 760)) {\n      playerAvatarLayer?.setVisible?.(false);\n      camera.position.set(player.x, 1.68, player.z);\n      camera.rotation.order = 'YXZ';\n      camera.rotation.set(player.pitch, player.yaw, 0);\n    } else if (immersive && playerAvatarLayer?.active) {`;
    code = code.replace(match, guarded);
    changed = true;
  } else if (branches.length === 0 && code.includes('playerAvatarLayer')) {
    context.warn?.('CALLORIA v6.11: the v2.5 camera branch was not found; the inactive player-avatar adapter still prevents the player mesh from rendering.');
  } else if (branches.length > 1) {
    context.warn?.(`CALLORIA v6.11: found ${branches.length} possible player camera branches; left world camera source unchanged to avoid a partial transform.`);
  }

  // Some upstream versions expose the visibility transition separately.
  const visibilityPattern = /playerAvatarLayer\?\.setVisible\?\.\(immersive\);/g;
  const visibilityMatches = [...code.matchAll(visibilityPattern)];
  if (visibilityMatches.length === 1) {
    code = code.replace(visibilityPattern, "playerAvatarLayer?.setVisible?.(immersive && !(touchDevice || window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 760));");
    changed = true;
  } else if (visibilityMatches.length > 1) {
    context.warn?.(`CALLORIA v6.11: found ${visibilityMatches.length} avatar visibility transitions; left them unchanged.`);
  }

  return changed ? { code, map: null } : null;
}

function injectHtml(html) {
  const source = String(html);
  if (!source.includes('id="viewRoot"') || !source.includes('id="worldCanvas"')) return html;
  if (source.includes(MOBILE_REPAIR_MARKERS.html)) return html;
  const styleTag = '<link rel="stylesheet" href="/calloria-mobile-responsive-v6-10.css" data-calloria-mobile-v611>';
  const scriptTag = '<script type="module" src="/js/calloria-mobile-ui-guard-v6-10.js" data-calloria-mobile-v611></script>';
  let result = source;
  if (/<\/head>/i.test(result)) result = result.replace(/<\/head>/i, `${styleTag}\n<!-- ${MOBILE_REPAIR_MARKERS.html} -->\n</head>`);
  else result = `${styleTag}\n${result}`;
  if (/<\/body>/i.test(result)) result = result.replace(/<\/body>/i, `${scriptTag}\n</body>`);
  else result = `${result}\n${scriptTag}`;
  return result;
}

export function calloriaMobileResponsiveRepairPlugin() {
  return {
    name: 'calloria-mobile-responsive-repair-v6-11',
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

export const __calloriaV611Test = Object.freeze({
  TARGETS,
  transformWorld,
  injectHtml,
  normaliseId,
  MOBILE_REPAIR_MARKERS,
  FIRST_PERSON_AVATAR_MODULE
});
