/**
 * Keeps the active Three.js workplace alive while existing CALLORIA operations
 * render in a compact in-world console. Recruitment remains a normal full-page
 * flow. No business rules or operational screens are reimplemented here.
 */
const MAIN_TARGET = '/js/main.js';
const MAIN_MARKER = '__CALLORIA_IN_WORLD_WORKSTATION_V25__';
const AVATAR_TARGET = '/js/world-player-avatar.js';
const AVATAR_MARKER = '__CALLORIA_PLAYER_WORK_TALK_CLIPS_V25__';
const OPERATION_EVENT = "window.dispatchEvent(new CustomEvent('calloria:game-operation-selected',{detail:{view,shiftActive:Boolean(state.shiftActive),agentStatus:state.agentStatus}}));";
const OPERATION_TAIL = `${OPERATION_EVENT}\n  exit3dFloor();\n  renderView();\n  document.querySelector('.content-wrap')?.scrollIntoView({behavior:'smooth',block:'start'});`;
const RETURN_ACTION = "case 'return-to-game': enter3dFloor(); break;";
const EXIT_FUNCTION = "function exit3dFloor(){ close3dStationPanel();productionWorld?.exit();document.body.classList.remove('calloria-game-playing'); }";
const CLIP_PATTERN_ANCHOR = "  run: /run|running|sprint/i\n});";
const RUN_CLIP_ANCHOR = '  const runClip = findClip(clips, CLIP_PATTERNS.run);';
const UPDATE_SIGNATURE = "    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, delta = 0 } = {}) {";
const UPDATE_DESIRED = "        const desired = moving ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip) : (idleClip || (walkClip ? null : clips[0]));";

function count(source, needle) { return source.split(needle).length - 1; }
function requireOnce(context, source, needle, label) {
  const occurrences = count(source, needle);
  if (occurrences !== 1) context.error(`CALLORIA in-world workstation v2.5 expected exactly one ${label} anchor (${occurrences} found). Refusing a partial transform.`);
}

function transformMain(context, source) {
  if (source.includes(MAIN_MARKER)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  for (const [anchor, label] of [
    [OPERATION_TAIL, 'operation-selection exit block'],
    [RETURN_ACTION, 'return-to-game action'],
    [EXIT_FUNCTION, 'exit-floor function']
  ]) requireOnce(context, code, anchor, label);
  code = `/* ${MAIN_MARKER} */\n${code}`;

  code = code.replace(OPERATION_TAIL, `${OPERATION_EVENT}
  // Keep the live Three.js workplace running behind the actual operational view.
  document.body.classList.add('calloria-game-launch', 'calloria-game-playing', 'calloria-game-operation');
  renderView();`);

  code = code.replace(RETURN_ACTION, `case 'return-to-game': {
      if (document.body.classList.contains('calloria-game-operation') && productionWorld?.immersive) {
        document.body.classList.remove('calloria-game-operation');
        window.dispatchEvent(new CustomEvent('calloria:workstation-resumed'));
      } else {
        enter3dFloor();
      }
      break;
    }`);

  code = code.replace(EXIT_FUNCTION,
    "function exit3dFloor(){ close3dStationPanel();productionWorld?.exit();document.body.classList.remove('calloria-game-playing','calloria-game-operation','calloria-game-launch'); }");

  return { code, map: null };
}

function transformAvatar(context, source) {
  if (source.includes(AVATAR_MARKER)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  for (const [anchor, label] of [
    [CLIP_PATTERN_ANCHOR, 'animation pattern map'],
    [RUN_CLIP_ANCHOR, 'run clip lookup'],
    [UPDATE_SIGNATURE, 'avatar update signature'],
    [UPDATE_DESIRED, 'animation selection expression']
  ]) requireOnce(context, code, anchor, label);
  code = `/* ${AVATAR_MARKER} */\n${code}`;
  code = code.replace(CLIP_PATTERN_ANCHOR, `  run: /run|running|sprint/i,
  work: /sit|sitting|seated|typing|type|computer|desk|work/i,
  talk: /talk|talking|speak|speaking|conversation|call|phone/i
});`);
  code = code.replace(RUN_CLIP_ANCHOR, `${RUN_CLIP_ANCHOR}
  const workClip = findClip(clips, CLIP_PATTERNS.work);
  const talkClip = findClip(clips, CLIP_PATTERNS.talk);`);
  code = code.replace(UPDATE_SIGNATURE,
    "    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, activity = 'idle', delta = 0 } = {}) {");
  code = code.replace(UPDATE_DESIRED, `        const mode = activity === 'talking' ? 'talking' : activity === 'working' ? 'working' : 'moving';
        const desired = mode === 'talking'
          ? (talkClip || idleClip)
          : mode === 'working'
            ? (workClip || idleClip)
            : moving
              ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip)
              : (idleClip || (walkClip ? null : clips[0]));`);
  code = code.replace('    hasRun: Boolean(runClip),',
    '    hasRun: Boolean(runClip),\n    hasWork: Boolean(workClip),\n    hasTalk: Boolean(talkClip),');
  return { code, map: null };
}

const WORKSTATION_CSS = `
/* CALLORIA v2.5: operational screens stay inside the running 3D workplace. */
body.calloria-game-launch.calloria-game-operation .content-wrap {
  display:flex!important; position:fixed!important; z-index:30!important;
  top:64px!important; right:16px!important; bottom:16px!important;
  width:min(560px,46vw)!important; min-width:340px!important; max-width:640px!important;
  max-height:calc(100dvh - 80px)!important; margin:0!important; padding:14px!important;
  box-sizing:border-box!important; flex-direction:column!important; gap:10px!important;
  overflow:hidden!important; border:1px solid rgba(153,205,214,.28)!important;
  border-radius:18px!important; background:rgba(7,19,30,.96)!important;
  color:#eef7fa!important; box-shadow:0 18px 60px rgba(0,0,0,.42)!important;
  backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
}
body.calloria-game-launch.calloria-game-operation .page-heading {
  display:flex!important; flex:0 0 auto!important; align-items:center!important;
  justify-content:space-between!important; gap:12px!important; margin:0!important;
  padding:4px 2px 10px!important; border-bottom:1px solid rgba(153,205,214,.18)!important;
}
body.calloria-game-launch.calloria-game-operation .page-heading h2,
body.calloria-game-launch.calloria-game-operation .page-heading .eyebrow,
body.calloria-game-launch.calloria-game-operation .page-heading p { color:#eef7fa!important; }
body.calloria-game-launch.calloria-game-operation .page-heading h2 { font-size:20px!important; margin:3px 0!important; }
body.calloria-game-launch.calloria-game-operation .page-heading p { opacity:.72; font-size:12px!important; margin:2px 0!important; }
body.calloria-game-launch.calloria-game-operation .page-actions { flex:0 0 auto!important; }
body.calloria-game-launch.calloria-game-operation .return-to-game-btn { white-space:nowrap!important; min-height:38px!important; }
body.calloria-game-launch.calloria-game-operation #viewRoot {
  display:block!important; flex:1 1 auto!important; min-height:0!important;
  overflow:auto!important; overscroll-behavior:contain!important; padding:0 2px 8px!important;
}
body.calloria-game-launch.calloria-game-operation .app-footer,
body.calloria-game-launch.calloria-game-operation #stationPanel,
body.calloria-game-launch.calloria-game-operation #stationHint,
body.calloria-game-launch.calloria-game-operation .immersive-bottomline,
body.calloria-game-launch.calloria-game-operation .touch-controls { display:none!important; }
body.calloria-game-launch.calloria-game-operation .page-heading .dark-eyebrow { color:#9dcbd2!important; }
body.calloria-game-launch.calloria-game-operation .page-heading .pill { white-space:nowrap; }
body.calloria-game-launch.calloria-game-operation #viewRoot .call-layout { grid-template-columns:minmax(0,1fr)!important; }
body.calloria-game-launch.calloria-game-operation #viewRoot .call-side-stack { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
@media (max-width:760px) {
  body.calloria-game-launch.calloria-game-operation .content-wrap {
    top:auto!important; left:8px!important; right:8px!important;
    bottom:max(8px,env(safe-area-inset-bottom))!important; width:auto!important;
    min-width:0!important; max-width:none!important; height:min(68dvh,690px)!important;
    max-height:calc(100dvh - 72px)!important; padding:10px!important; gap:7px!important;
    border-radius:16px!important;
  }
  body.calloria-game-launch.calloria-game-operation .page-heading { padding:2px 1px 8px!important; }
  body.calloria-game-launch.calloria-game-operation .page-heading h2 { font-size:16px!important; }
  body.calloria-game-launch.calloria-game-operation .page-heading p { display:none!important; }
  body.calloria-game-launch.calloria-game-operation .return-to-game-btn { min-height:34px!important; font-size:10px!important; padding:7px 9px!important; }
  body.calloria-game-launch.calloria-game-operation #viewRoot .call-layout { display:block!important; }
  body.calloria-game-launch.calloria-game-operation #viewRoot .call-side-stack { display:block!important; }
}
`;

export function calloriaWorkstationExperiencePlugin() {
  return {
    name: 'calloria-in-world-workstation-experience-v2-5',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(MAIN_TARGET)) return transformMain(this, source);
      if (normalizedId.endsWith(AVATAR_TARGET)) return transformAvatar(this, source);
      return null;
    },
    transformIndexHtml(html) {
      if (html.includes('CALLORIA_IN_WORLD_WORKSTATION_CSS_V25')) return html;
      return html.replace('</head>', `<style id="CALLORIA_IN_WORLD_WORKSTATION_CSS_V25">${WORKSTATION_CSS}</style>\n</head>`);
    }
  };
}

export const __workstationExperienceTest = Object.freeze({
  MAIN_TARGET, MAIN_MARKER, AVATAR_TARGET, AVATAR_MARKER,
  OPERATION_EVENT, OPERATION_TAIL, RETURN_ACTION, EXIT_FUNCTION,
  CLIP_PATTERN_ANCHOR, RUN_CLIP_ANCHOR, UPDATE_SIGNATURE, UPDATE_DESIRED,
  WORKSTATION_CSS, transformMain, transformAvatar
});
