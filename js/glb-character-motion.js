/**
 * Small, rig-aware idle motion for CALLORIA GLB staff that have a usable
 * skeleton but do not contain a suitable embedded idle animation.
 * This is intentionally restricted to standing support staff. Seated agents
 * still require a real seated/typing clip so they are never shown in a T-pose.
 */
const normalizeBoneName = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function sideOf(name) {
  if (name.includes('left') || name.endsWith('l')) return 'left';
  if (name.includes('right') || name.endsWith('r')) return 'right';
  return '';
}

function remember(bone) {
  if (!bone?.rotation) return null;
  return {
    bone,
    x: Number(bone.rotation.x) || 0,
    y: Number(bone.rotation.y) || 0,
    z: Number(bone.rotation.z) || 0
  };
}

/** Build a low-cost profile from common Mixamo, Rigify and generic bone names. */
export function createProceduralIdlePose(root) {
  if (!root?.traverse) return null;

  const found = { head: null, neck: null, spine: null, leftArm: null, rightArm: null };
  root.traverse((object) => {
    if (!object?.isBone) return;
    const name = normalizeBoneName(object.name);
    if (!found.head && /head/.test(name)) found.head = object;
    if (!found.neck && /neck/.test(name)) found.neck = object;
    if (!found.spine && /(upperchest|chest|spine2|spine1|spine)/.test(name)) found.spine = object;
    if (/(upperarm|arm)/.test(name)) {
      const side = sideOf(name);
      if (side === 'left' && !found.leftArm) found.leftArm = object;
      if (side === 'right' && !found.rightArm) found.rightArm = object;
    }
  });

  const profile = {
    head: remember(found.head),
    neck: remember(found.neck),
    spine: remember(found.spine),
    leftArm: remember(found.leftArm),
    rightArm: remember(found.rightArm)
  };
  return Object.values(profile).some(Boolean) ? profile : null;
}

/** Apply a restrained breathing / attention loop without accumulating drift. */
export function updateProceduralIdlePose(profile, elapsedSeconds, phase = 0) {
  if (!profile) return false;
  const t = (Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0) + (Number(phase) || 0);
  const breath = Math.sin(t * 1.45);
  const attention = Math.sin(t * 0.72 + 0.6);

  const apply = (entry, dx = 0, dy = 0, dz = 0) => {
    if (!entry?.bone?.rotation) return;
    entry.bone.rotation.x = entry.x + dx;
    entry.bone.rotation.y = entry.y + dy;
    entry.bone.rotation.z = entry.z + dz;
  };

  apply(profile.head, Math.sin(t * 1.1) * 0.009, attention * 0.022, 0);
  apply(profile.neck, 0, attention * 0.009, 0);
  apply(profile.spine, breath * 0.006, 0, breath * 0.004);
  apply(profile.leftArm, 0, 0, breath * 0.008);
  apply(profile.rightArm, 0, 0, -breath * 0.008);
  return true;
}
