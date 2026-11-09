/**
 * Allows compatible static GLB characters to replace standing staff without
 * requiring a skeleton or embedded animation. Seated employees still require
 * a real seated/typing clip, preventing a T-pose at workstations.
 */
const TARGET = '/js/glb-world-integration.js';
const MARKER = '__CALLORIA_STATIC_STANDING_GLB_STAFF_V27__';
const RIG_LINE = '      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;';
const REJECT_LINE = '      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {';
const RIG_REASON = "        if (!rigValid) reasons.push('usable character skeleton not detected');";
const IDLE_FLAG = '    let useProceduralIdle = false;';
const CANDIDATE_CLIP_GUARD = '      if (candidateClip) {';
const STATIC_BRANCH = `      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
      }`;
const IDLE_PROFILE = '    const idleProfile = useProceduralIdle ? createProceduralIdlePose(clonedRoot) : null;';
const FINAL_GUARD = '    if (!clip && !idleProfile) {';
const REPLACEMENT_RECORD = "      clipName: clip?.name || 'CALLORIA procedural skeletal idle'";
const STATUS_ANIMATIONS = '      animationsInUse: replacements.map((item) => ({ assetId: item.assetId, clip: item.clipName })),';

function count(source, needle) { return source.split(needle).length - 1; }
function requireOnce(context, source, needle, label) {
  const occurrences = count(source, needle);
  if (occurrences !== 1) {
    context.error(`CALLORIA static GLB staff v2.7 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
  }
}

function transformStaff(context, source) {
  if (source.includes(MARKER)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  for (const [anchor, label] of [
    [RIG_LINE, 'rig validation declaration'],
    [REJECT_LINE, 'candidate rejection guard'],
    [RIG_REASON, 'rig rejection message'],
    [IDLE_FLAG, 'procedural idle flag'],
    [CANDIDATE_CLIP_GUARD, 'embedded animation preference'],
    [STATIC_BRANCH, 'standing-character animation branch'],
    [IDLE_PROFILE, 'procedural idle profile creation'],
    [FINAL_GUARD, 'final animation safety guard'],
    [REPLACEMENT_RECORD, 'replacement motion record'],
    [STATUS_ANIMATIONS, 'animation usage status']
  ]) requireOnce(context, code, anchor, label);

  code = `/* ${MARKER} */\n${code}`;
  code = code.replace(IDLE_FLAG, `${IDLE_FLAG}\n    let useStaticDisplay = false;`);
  code = code.replace(REJECT_LINE,
    '      if (!humanScale || !geometryValid || !texturesValid || !extensionsValid) {');
  code = code.replace(RIG_REASON, '        // Static, dimensionally valid GLBs are permitted for standing staff.');
  code = code.replace(STATIC_BRANCH, `      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
        // A standing model can be shown as a static GLB even without a rig.
        // Never use this path for a seated agent: seated staff need a real
        // sitting/typing clip or compatible skeletal idle profile.
        selected = candidate;
        useStaticDisplay = true;
        break;
      }`);
  code = code.replace(IDLE_PROFILE, `${IDLE_PROFILE}\n    const staticDisplay = useStaticDisplay && !person.seated;`);
  code = code.replace(FINAL_GUARD, '    if (!clip && !idleProfile && !staticDisplay) {');
  code = code.replace(REPLACEMENT_RECORD,
    `${REPLACEMENT_RECORD},\n      renderMode: clip ? 'embedded-animation' : idleProfile ? 'procedural-skeletal-idle' : 'static-glb-display',\n      staticDisplay`);
  code = code.replace(STATUS_ANIMATIONS,
    "      animationsInUse: replacements.map((item) => ({ assetId: item.assetId, clip: item.clipName, renderMode: item.renderMode })),\n      staticModelsInUse: replacements.filter((item) => item.staticDisplay).length,\n      skeletalIdleModelsInUse: replacements.filter((item) => Boolean(item.idleProfile)).length,");
  return { code, map: null };
}

export function calloriaStaticGLBStaffPlugin() {
  return {
    name: 'calloria-static-standing-glb-staff-v2-7',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(TARGET)) return null;
      return transformStaff(this, source);
    }
  };
}

export const __staticGLBStaffTest = Object.freeze({
  TARGET, MARKER, RIG_LINE, REJECT_LINE, RIG_REASON, IDLE_FLAG,
  CANDIDATE_CLIP_GUARD, STATIC_BRANCH, IDLE_PROFILE, FINAL_GUARD, REPLACEMENT_RECORD, STATUS_ANIMATIONS,
  transformStaff
});
