/**
 * CALLORIA v3.5 — first working shift, mobile first-person view and real GLB decoders.
 *
 * Built against the public zaksz1991/calloria main branch inspected 10 Nov 2026
 * (v3.3 base). This runs after the existing Meshopt and static-staff Vite transforms.
 * It replaces the unmerged v3.4 draft; install this patch alone, not v3.4 plus v3.5.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const TARGETS = Object.freeze({
  staff: '/js/glb-world-integration.js',
  avatar: '/js/world-player-avatar.js',
  main: '/js/main.js',
});

const MARKERS = Object.freeze({
  staff: '__CALLORIA_STAFF_DRACO_MESHOPT_V35__',
  avatar: '__CALLORIA_PLAYER_POSE_AND_TOUCH_VIEW_V35__',
  main: '__CALLORIA_FIRST_WORKING_SHIFT_V35__',
  html: 'CALLORIA_V35_WORK_FIRST_HUD'
});

const DRACO_FILES = Object.freeze([
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_wasm_wrapper.js'
]);

const STAFF_GLTF_IMPORT = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const STAFF_LOADER_ANCHOR = '  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);';
const STAFF_EXTENSION_GUARD = "      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');";
const STAFF_LOOP_START = '  for (const asset of candidates.slice(0, maxCandidates)) {';
const STAFF_LOOP_END = "    } catch (error) {\n      rejected.push({ id: asset.id, reasons: [String(error?.message || error)] });\n    }\n  }\n  if (!loadedModels.size) {";
const AVATAR_LOOP_END = '  if (!selected || !gltf) {';

const AVATAR_LOADER_ANCHOR = '  const loader = new GLTFLoader();\n  loader.setMeshoptDecoder(MeshoptDecoder);';
const AVATAR_METRICS_ANCHOR = '      const candidateMetrics = inspectScene(candidate.scene);';
const PAGEHIDE_ANCHOR = "window.addEventListener('pagehide',()=>{ void flushCloudEmploymentSave(); });";
const SIMULATION_DATE_ANCHOR = 'function simulationDateNow(){const date=new Date();date.setDate(date.getDate()+Math.max(0,(Number(state.day)||1)-1));const seconds=simulationSecondsNow();date.setHours(Math.floor(seconds/3600),Math.floor((seconds%3600)/60),seconds%60,0);return date;}';
const START_SHIFT_TIME_ANCHOR = "if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  state.day=state.day||1;";
const START_SHIFT_VIEW_ANCHOR = "  state.currentView='overview';\n  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');";
const OPEN_WORK_VIEW_ANCHOR = "if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();";
const MAIN_ASSET_STATUS_ANCHOR = "        const status=$('#assetStatus');\n        if(status)status.textContent=`GLB STAFF: ${staffCount} · OFFICE GLB OBJECTS: ${officeCount}`+(failureCount?` · REVIEW: ${failureCount}`:'')+` · ${tier.toUpperCase()}`;";

function count(source, needle) {
  return source.split(needle).length - 1;
}

function requireOnce(context, source, needle, label) {
  const found = count(source, needle);
  if (found !== 1) {
    const message = `CALLORIA v3.5 expected exactly one ${label} anchor; found ${found}. Refusing a partial transform.`;
    if (context && typeof context.error === 'function') context.error(message);
    throw new Error(message);
  }
}

function insertImport(source, importLine, additionalImport) {
  requireOnce(null, source, importLine, 'Three.js loader import');
  return source.replace(importLine, `${importLine}\n${additionalImport}`);
}

function transformStaff(context, source) {
  if (source.includes(MARKERS.staff)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireOnce(context, code, STAFF_GLTF_IMPORT, 'staff GLTFLoader import');
  requireOnce(context, code, STAFF_LOADER_ANCHOR, 'actual staff GLTFLoader construction');
  requireOnce(context, code, STAFF_EXTENSION_GUARD, 'staff compression extension guard');
  requireOnce(context, code, STAFF_LOOP_START, 'staff candidate-load loop start');
  requireOnce(context, code, STAFF_LOOP_END, 'staff candidate-load loop end');

  code = insertImport(code, STAFF_GLTF_IMPORT,
    "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';");
  code = `/* ${MARKERS.staff} */\n${code}`;
  code = code.replace(STAFF_LOOP_START, `  const dracoLoader = new DRACOLoader();\n  dracoLoader.setDecoderPath('/draco/');\n  loader.setDRACOLoader(dracoLoader);\n${STAFF_LOOP_START}`);
  code = code.replace(STAFF_EXTENSION_GUARD,
    '      // Meshopt and Draco decoders are registered on this loader.\n      const extensionsValid = true;');
  code = code.replace(STAFF_LOOP_END, STAFF_LOOP_END.replace('  if (!loadedModels.size) {', '  dracoLoader.dispose();\n  if (!loadedModels.size) {'));
  return { code, map: null };
}

function transformAvatar(context, source) {
  if (source.includes(MARKERS.avatar)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireOnce(context, code, AVATAR_LOADER_ANCHOR, 'player avatar loader and Meshopt setup');
  requireOnce(context, code, AVATAR_METRICS_ANCHOR, 'player avatar candidate metrics');
  requireOnce(context, code, AVATAR_LOOP_END, 'player avatar candidate-loop completion');
  code = insertImport(code, "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';");
  code = `/* ${MARKERS.avatar} */\n${code}`;

  const loaderSetup = `  // Touch devices use first-person framing: it keeps the desk, screens and prompts visible.\n  const touchFirstPerson = typeof window !== 'undefined' && (\n    Boolean(window.matchMedia?.('(pointer: coarse)').matches) ||\n    Number(navigator.maxTouchPoints || 0) > 0 || window.innerWidth <= 760\n  );\n  if (touchFirstPerson) {\n    const status = { ready: false, firstPersonOnly: true, assetId: null, assetName: null, reason: 'First-person touch mode keeps workstations visible and avoids an unanimated player mesh.' };\n    onStatus?.(status);\n    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));\n    return { status, active: false, setVisible() {}, update() {}, dispose() {} };\n  }\n  const loader = new GLTFLoader();\n  loader.setMeshoptDecoder(MeshoptDecoder);\n  const dracoLoader = new DRACOLoader();\n  dracoLoader.setDecoderPath('/draco/');\n  loader.setDRACOLoader(dracoLoader);`;
  code = code.replace(AVATAR_LOADER_ANCHOR, loaderSetup);

  code = code.replace(AVATAR_METRICS_ANCHOR, `${AVATAR_METRICS_ANCHOR}\n      const candidateAnimations = Array.isArray(candidate.animations) ? candidate.animations : [];\n      const hasIdleMotion = candidateAnimations.some((clip) => /idle|stand|standing|rest|breath|listen/i.test(String(clip.name || '')));\n      const hasWalkMotion = candidateAnimations.some((clip) => /walk|walking|locomotion|move/i.test(String(clip.name || '')));\n      const animatedHumanRig = candidateMetrics.skinned > 0 && candidateMetrics.bones >= 12 && hasIdleMotion && hasWalkMotion;\n      if (!animatedHumanRig) {\n        const missing = [\n          candidateMetrics.skinned <= 0 ? 'skinned human rig' : null,\n          candidateMetrics.bones < 12 ? 'at least 12 rig bones' : null,\n          !hasIdleMotion ? 'named idle animation' : null,\n          !hasWalkMotion ? 'named walk animation' : null\n        ].filter(Boolean).join(', ');\n        failures.push({ assetId: asset.id, reason: 'player avatar rejected: missing ' + missing });\n        disposeGLTFResources(candidate);\n        continue;\n      }`);
  code = code.replace(AVATAR_LOOP_END, `  dracoLoader.dispose();\n${AVATAR_LOOP_END}`);
  return { code, map: null };
}

function transformMain(context, source) {
  if (source.includes(MARKERS.main)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireOnce(context, code, SIMULATION_DATE_ANCHOR, 'simulated-date helper');
  requireOnce(context, code, START_SHIFT_TIME_ANCHOR, 'shift-start time guard');
  requireOnce(context, code, START_SHIFT_VIEW_ANCHOR, 'shift completion view');
  requireOnce(context, code, OPEN_WORK_VIEW_ANCHOR, 'work-view shift activation');
  requireOnce(context, code, PAGEHIDE_ANCHOR, 'employment-save lifecycle listener');
  code = `/* ${MARKERS.main} */\n${code}`;

  const briefingHelper = `${SIMULATION_DATE_ANCHOR}\nfunction hasBriefingAttendanceForToday(){\n  const simulatedDate=simulationDateNow();\n  const morningDate=new Date(simulatedDate);morningDate.setHours(7,45,0,0);\n  const afternoonDate=new Date(simulatedDate);afternoonDate.setHours(14,15,0,0);\n  const briefingIds=[briefingFor(morningDate),briefingFor(afternoonDate)].filter(Boolean).map(item=>item.id);\n  return (state.briefingAttendance||[]).some(item=>briefingIds.includes(item.briefingId));\n}`;
  code = code.replace(SIMULATION_DATE_ANCHOR, briefingHelper);

  code = code.replace(START_SHIFT_TIME_ANCHOR, `if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  if(!hasBriefingAttendanceForToday()){toast('Attend today’s 07:30 morning or 14:00 afternoon operations briefing before starting your shift.','warning');state.currentView='workforce';saveState();renderView();return;}\n  state.day=state.day||1;`);
  code = code.replace(START_SHIFT_VIEW_ANCHOR, START_SHIFT_VIEW_ANCHOR.replace("state.currentView='overview'", "state.currentView='inbound'"));

  code = code.replace(OPEN_WORK_VIEW_ANCHOR, `if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive){\n    const minute=simulationMinuteNow();\n    if(minute<8*60||!hasBriefingAttendanceForToday()){\n      view='workforce';\n      toast(minute<8*60?'The shift opens at 08:00. Review the workforce desk and attend the scheduled briefing.':'Attend today’s operations briefing before opening customer queues.','warning');\n    }else{\n      startShift();\n      if(!state.shiftActive)view='workforce';\n    }\n  }`);

  const guidedListener = `\nwindow.addEventListener('calloria:guided-open-inbound',()=>{\n  if(!state.hired){open3dWorkView('recruitment');return;}\n  open3dWorkView('inbound');\n});\n`;
  code = code.replace(PAGEHIDE_ANCHOR, `${guidedListener}${PAGEHIDE_ANCHOR}`);

  // Improve the actual current asset-status callback produced by the v2.3.1 bridge.
  if (code.includes(MAIN_ASSET_STATUS_ANCHOR)) {
    const diagnosticStatus = `        const rejectionDetails=Array.isArray(result?.rejected)?result.rejected.map(item=>[String(item.id||item.assetId||'asset'),(Array.isArray(item.reasons)?item.reasons:[item.reason||'']).join('; ')].join(': ')).join(' | '):'';
        if(status){
          status.textContent=staffCount?\`GLB STAFF: \${staffCount} · OFFICE GLB OBJECTS: \${officeCount} · \${tier.toUpperCase()}\`:\`STAFF GLB: 0 · LOCAL STAFF FALLBACK · \${failureCount} LOAD ISSUES\`;
          status.title=rejectionDetails||'No rejected staff GLB details reported.';
        }`;
    code = code.replace(MAIN_ASSET_STATUS_ANCHOR, `        const status=$('#assetStatus');\n${diagnosticStatus}`);
  }
  return { code, map: null };
}

const HUD_STYLE = `
/* CALLORIA v3.5 — compact mission guidance and a direct route into real agent work. */
#calloriaQuickWorkDock{position:absolute;z-index:43;top:94px;right:12px;width:min(190px,calc(100vw - 24px));box-sizing:border-box;padding:9px;border:1px solid rgba(111,220,200,.5);border-radius:12px;background:rgba(5,22,33,.94);color:#eef8f8;box-shadow:0 9px 24px rgba(0,0,0,.26);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:auto}
#calloriaQuickWorkDock[hidden]{display:none!important}
#calloriaQuickWorkDock .cq-kicker{display:block;color:#79d8c8;font:800 8px/1.3 system-ui,sans-serif;letter-spacing:.14em}
#calloriaQuickWorkDock p{margin:4px 0 7px;color:#d1e0e4;font:500 10px/1.35 system-ui,sans-serif}
#calloriaQuickWorkButton{display:block;width:100%;min-height:38px;padding:8px;border:0;border-radius:8px;background:linear-gradient(135deg,#27b6a5,#087f7f);color:#fff;font:800 10px/1.2 system-ui,sans-serif;letter-spacing:.035em;cursor:pointer;touch-action:manipulation}
#calloriaQuickWorkDock .cq-flow{display:block;margin-top:6px;color:#9db7c1;font:600 8px/1.35 system-ui,sans-serif}
.calloria-world-mission-v23.calloria-tutorial-card-compact{width:min(245px,calc(100vw - 20px))!important;max-width:min(245px,calc(100vw - 20px))!important;max-height:min(18dvh,145px)!important;overflow:auto!important;box-sizing:border-box!important;padding:8px!important;border-radius:11px!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__top{font-size:8px!important;letter-spacing:.1em!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact h3{font-size:12px!important;line-height:1.2!important;margin:5px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact p{font-size:9px!important;line-height:1.3!important;margin:4px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__controls{display:none!important}
.calloria-tutorial-card-compact{width:min(245px,calc(100vw - 20px))!important;max-width:min(245px,calc(100vw - 20px))!important;max-height:min(18dvh,145px)!important;overflow:auto!important;box-sizing:border-box!important;padding:8px!important}
@media(max-width:760px){#calloriaQuickWorkDock{top:max(88px,calc(env(safe-area-inset-top) + 68px));right:8px;width:min(168px,calc(100vw - 16px));padding:8px}#calloriaQuickWorkDock p{font-size:9px;margin:4px 0 6px}#calloriaQuickWorkButton{min-height:36px;font-size:9px}.calloria-world-mission-v23.calloria-tutorial-card-compact{width:min(220px,calc(100vw - 16px))!important;max-width:min(220px,calc(100vw - 16px))!important;max-height:min(16dvh,122px)!important;padding:7px!important}.calloria-world-mission-v23.calloria-tutorial-card-compact h3{font-size:10px!important}.calloria-world-mission-v23.calloria-tutorial-card-compact p{font-size:8px!important}}
body.calloria-game-launch.calloria-game-operation #calloriaQuickWorkDock{display:none!important}
`;

const HUD_SCRIPT = `
<script id="${MARKERS.html}">
(()=>{
 const hud=document.getElementById('immersiveHud');
 if(!hud||document.getElementById('calloriaQuickWorkDock'))return;
 const dock=document.createElement('aside');dock.id='calloriaQuickWorkDock';dock.setAttribute('aria-label','Open contact-centre work');dock.hidden=true;
 dock.innerHTML='<span class="cq-kicker">YOUR SHIFT · CUSTOMER OPERATIONS</span><p>Open your workforce briefing or inbound queue.</p><button id="calloriaQuickWorkButton" type="button">OPEN WORK DESK →</button><small class="cq-flow">BRIEFING · SHIFT · CUSTOMER · CRM · QA</small>';
 hud.append(dock);
 dock.querySelector('#calloriaQuickWorkButton').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('calloria:guided-open-inbound')));
 const sync=()=>{const immersive=document.body.classList.contains('calloria-immersive')||document.body.classList.contains('calloria-game-playing');const operating=document.body.classList.contains('calloria-game-operation');const panel=document.getElementById('stationPanel');const panelOpen=Boolean(panel&&!panel.classList.contains('hidden'));dock.hidden=!immersive||operating||panelOpen;};
 ['calloria:world-immersive','calloria:game-station-panel-opened','calloria:game-operation-selected','calloria:workstation-resumed'].forEach(type=>window.addEventListener(type,sync));
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 const panel=document.getElementById('stationPanel');if(panel)new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['class']});
 const compact=()=>{const card=document.querySelector('.calloria-world-mission-v23');if(card)card.classList.add('calloria-tutorial-card-compact');const nodes=[...document.querySelectorAll('#immersiveHud div,#immersiveHud section,#immersiveHud aside,#immersiveHud article')].filter(node=>{const value=String(node.innerText||node.textContent||'').replace(/\\s+/g,' ').trim().toLowerCase();return value.includes('access your workstation')&&value.length<900&&node.childElementCount>=2;}).sort((a,b)=>String(a.innerText||a.textContent||'').length-String(b.innerText||b.textContent||'').length);if(nodes[0])nodes[0].classList.add('calloria-tutorial-card-compact');};
 compact();const world=document.querySelector('.world-panel')||document.body;new MutationObserver(compact).observe(world,{childList:true,subtree:true,characterData:true});sync();
})();
</script>
`;

function transformHtml(html) {
  if (!html.includes('id="immersiveHud"') || html.includes(MARKERS.html)) return html;
  const injection = `<style id="${MARKERS.html}-STYLE">${HUD_STYLE}</style>${HUD_SCRIPT}`;
  return html.replace('</body>', `${injection}\n</body>`);
}

function dracoDirectory() {
  const threeEntry = require.resolve('three');
  const packageRoot = resolve(dirname(threeEntry), '..');
  return resolve(packageRoot, 'examples/jsm/libs/draco/gltf');
}

function readDracoFile(fileName) {
  const root = dracoDirectory();
  const path = resolve(root, fileName);
  if (!DRACO_FILES.includes(basename(path)) || !existsSync(path)) {
    throw new Error(`CALLORIA v3.5 cannot find Three.js Draco decoder asset: ${path}`);
  }
  return readFileSync(path);
}

export function calloriaFirstWorkingShiftV35Plugin() {
  let decoderRoot = null;
  return {
    name: 'calloria-first-working-shift-v3-5',
    enforce: 'post',
    configResolved() { decoderRoot = dracoDirectory(); },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = String(request.url || '').split('?')[0];
        if (!requestPath.startsWith('/draco/')) return next();
        const fileName = basename(requestPath);
        if (!DRACO_FILES.includes(fileName)) return next();
        try {
          const root = resolve(decoderRoot || dracoDirectory());
          const filePath = resolve(root, fileName);
          if (!filePath.startsWith(root)) return next();
          response.statusCode = 200;
          response.setHeader('Content-Type', fileName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'public, max-age=3600');
          response.end(readFileSync(filePath));
        } catch (error) {
          response.statusCode = 500;
          response.end(`CALLORIA Draco decoder unavailable: ${String(error?.message || error)}`);
        }
      });
    },
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGETS.staff)) return transformStaff(this, source);
      if (target.endsWith(TARGETS.avatar)) return transformAvatar(this, source);
      if (target.endsWith(TARGETS.main)) return transformMain(this, source);
      return null;
    },
    transformIndexHtml: transformHtml,
    generateBundle() {
      for (const fileName of DRACO_FILES) {
        let bytes;
        try { bytes = readDracoFile(fileName); }
        catch (error) { this.error(error.message); }
        this.emitFile({ type: 'asset', fileName: `draco/${fileName}`, source: bytes });
      }
    }
  };
}

export const __calloriaV35Test = Object.freeze({
  TARGETS, MARKERS, DRACO_FILES,
  STAFF_GLTF_IMPORT, STAFF_LOADER_ANCHOR, STAFF_EXTENSION_GUARD, STAFF_LOOP_START, STAFF_LOOP_END,
  AVATAR_LOADER_ANCHOR, AVATAR_METRICS_ANCHOR, AVATAR_LOOP_END, MAIN_ASSET_STATUS_ANCHOR,
  PAGEHIDE_ANCHOR, SIMULATION_DATE_ANCHOR, START_SHIFT_TIME_ANCHOR,
  START_SHIFT_VIEW_ANCHOR, OPEN_WORK_VIEW_ANCHOR,
  HUD_STYLE, HUD_SCRIPT, transformStaff, transformAvatar, transformMain, transformHtml
});
