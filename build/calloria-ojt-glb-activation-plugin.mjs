/**
 * CALLORIA v3.7 — cross-industry on-the-job onboarding + first-person player
 * + real GLB/Draco activation. Built against repository main commit 96649f9.
 *
 * This replaces the brittle v3.5 plugin. It does not patch candidate-load loop
 * endings. It registers the real Three.js Draco and Meshopt decoders, adds
 * stationary support positions on low-tier devices, and preserves the
 * existing local procedural staff as an explicit fallback.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const MARKERS = Object.freeze({
  staff: '__CALLORIA_DRACO_STAFF_V37__',
  office: '__CALLORIA_DRACO_OFFICE_V37__',
  assetLoader: '__CALLORIA_DRACO_SHARED_ASSET_LOADER_V37__',
  world: '__CALLORIA_LOW_TIER_GLB_STAFF_V37__',
  avatar: '__CALLORIA_FIRST_PERSON_ONLY_V37__',
  main: '__CALLORIA_OJT_CROSS_INDUSTRY_V37__',
  html: 'CALLORIA_V37_WORKPLACE_HUD'
});
const TARGETS = Object.freeze({
  staff: '/js/glb-world-integration.js',
  office: '/js/glb-office-world-integration.js',
  assetLoader: '/js/glb-asset-loader.js',
  world: '/js/production-world.js',
  avatar: '/js/world-player-avatar.js',
  main: '/js/main.js'
});
const DRACO_FILES = Object.freeze(['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']);
const GLB_REQUIRED_ASSETS = Object.freeze([
  'characters/agents/female-agent.glb',
  'characters/agents/male-agent.glb',
  'office/desks/office_desk.glb',
  'office/equipment/office_computer.glb',
  'accessories/headsets/model.glb',
  'office/reception/reception-desk.glb'
]);

function count(source, needle) { return source.split(needle).length - 1; }
function one(context, source, needle, label, { strict = true } = {}) {
  const found = count(source, needle);
  if (found !== 1) {
    const message = `CALLORIA v3.7 expected one ${label} anchor; found ${found}.`;
    if (strict && context?.error) context.error(message);
    return false;
  }
  return true;
}
function normalise(source) { return String(source).replace(/\r\n?/g, '\n'); }

function transformStaff(context, source) {
  if (source.includes(MARKERS.staff)) return null;
  let code = normalise(source);
  const importAnchor = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
  const loaderAnchor = '  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);';
  const extensionAnchor = "      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');";
  if (!one(context, code, importAnchor, 'staff GLTFLoader import') ||
      !one(context, code, loaderAnchor, 'staff Meshopt loader setup') ||
      !one(context, code, extensionAnchor, 'staff Draco extension guard')) return null;
  code = code.replace(importAnchor, `${importAnchor}\nimport { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';\nconst ${MARKERS.staff} = true;`);
  code = code.replace(loaderAnchor, `${loaderAnchor}\n  const dracoLoader = new DRACOLoader();\n  dracoLoader.setDecoderPath('/draco/');\n  loader.setDRACOLoader(dracoLoader);`);
  // A required compression extension is now valid because both decoders are
  // attached to this GLTFLoader. No candidate-loop or loop-end text is touched.
  code = code.replace(extensionAnchor, "      const supportedRequiredExtensions = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);\n      const extensionsValid = requiredExtensions.every((extension) => supportedRequiredExtensions.has(extension)); // Meshopt + Draco decoders are registered.");
  return { code, map: null };
}

function transformOffice(context, source) {
  if (source.includes(MARKERS.office)) return null;
  let code = normalise(source);
  const importAnchor = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
  const setupAnchor = '  loader.setMeshoptDecoder(MeshoptDecoder);';
  const preferredPlan = "const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];";
  const headsetPlan = "headsetStationIndexes: safeTier === 'low' ? [] : [...deskStationIndexes],";
  const receptionPlan = "    includeReceptionDesk: safeTier !== 'low',";
  if (!one(context, code, importAnchor, 'office GLTFLoader import') ||
      !one(context, code, setupAnchor, 'office Meshopt decoder setup') ||
      !one(context, code, preferredPlan, 'device-tier workstation asset plan') ||
      !one(context, code, headsetPlan, 'low-tier headset asset plan') ||
      !one(context, code, receptionPlan, 'reception GLB asset plan')) return null;
  code = code.replace(importAnchor, `${importAnchor}\nimport { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';\nconst ${MARKERS.office} = true;`);
  code = code.replace(setupAnchor, `${setupAnchor}\n  const dracoLoader = new DRACOLoader();\n  dracoLoader.setDecoderPath('/draco/');\n  loader.setDRACOLoader(dracoLoader);`);
  // The current 96649f9 plan already selects one low-tier desk and the
  // original balanced/high subsets. Keep that validated index plan unchanged.
  code = code.replace(preferredPlan, preferredPlan);
  code = code.replace(headsetPlan, "headsetStationIndexes: safeTier === 'low' ? [10] : [...deskStationIndexes],");
  code = code.replace(receptionPlan, '    includeReceptionDesk: true,');
  return { code, map: null };
}

function transformAssetLoader(context, source) {
  if (source.includes(MARKERS.assetLoader)) return null;
  let code = normalise(source);
  const importAnchor = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
  const meshoptAnchor = '    this.loader.setMeshoptDecoder(MeshoptDecoder);';
  if (!one(context, code, importAnchor, 'shared asset-loader GLTFLoader import') ||
      !one(context, code, meshoptAnchor, 'shared asset-loader Meshopt setup')) return null;
  code = code.replace(importAnchor, `${importAnchor}\nimport { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';\nconst ${MARKERS.assetLoader} = true;`);
  code = code.replace(meshoptAnchor, `${meshoptAnchor}\n    this.dracoLoader = new DRACOLoader();\n    this.dracoLoader.setDecoderPath('/draco/');\n    this.loader.setDRACOLoader(this.dracoLoader);`);
  return { code, map: null };
}

function transformWorld(context, source) {
  if (source.includes(MARKERS.world)) return null;
  let code = normalise(source);
  // Add two non-walking support staff to the constrained tier. The static-GLB
  // compatibility plugin then has valid standing targets even on phones.
  const supportStart = '  const supportPosts = tier === \'high\'';
  const startAt = code.indexOf(supportStart);
  if (startAt < 0 || code.indexOf(supportStart, startAt + 1) >= 0) {
    context.warn?.('CALLORIA v3.7 could not identify the low-tier support-post block; existing world layout retained.');
    return null;
  }
  const endAt = code.indexOf('  supportPosts.forEach((post, index) => buildStaff', startAt);
  if (endAt < 0) {
    context.warn?.('CALLORIA v3.7 could not identify the support-post block end; existing world layout retained.');
    return null;
  }
  let block = code.slice(startAt, endAt);
  const lowEmpty = /:\s*\[\];\s*$/;
  if (!lowEmpty.test(block)) {
    context.warn?.('CALLORIA v3.7 found a changed low-tier support-post fallback; existing layout retained.');
    return null;
  }
  block = block.replace(lowEmpty, ": [{ x: 12.6, z: -1.0 }, { x: -12.4, z: -9.0 }]; // low-tier standing targets for real staff GLBs.\n");
  code = `${code.slice(0, startAt)}/* ${MARKERS.world} */\n${block}${code.slice(endAt)}`;
  return { code, map: null };
}

const FIRST_PERSON_AVATAR = `/* ${MARKERS.avatar}\n * Deliberately disable the oversized third-person worker until a valid,
 * proportionally fitted and fully animated player rig passes visual QA.
 * NPC staff and office GLBs are still loaded by their separate world layers.
 */
export async function createCalloriaPlayerAvatar({ onStatus } = {}) {
  const status = {
    ready: false,
    active: false,
    firstPersonOnly: true,
    assetId: null,
    reason: 'First-person workplace view is active. The unverified player mesh is intentionally hidden so it cannot cover the workstation.'
  };
  onStatus?.(status);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('calloria:player-avatar-ready', { detail: status }));
  }
  return { status, active: false, setVisible() {}, update() {}, dispose() {} };
}
`;

const OJT_CODE = readFileSync(new URL('./calloria-ojt-runtime.js', import.meta.url), 'utf8');

const SIMULATION_DATE_ANCHOR = 'function simulationDateNow(){const date=new Date();date.setDate(date.getDate()+Math.max(0,(Number(state.day)||1)-1));const seconds=simulationSecondsNow();date.setHours(Math.floor(seconds/3600),Math.floor((seconds%3600)/60),seconds%60,0);return date;}';
const START_SHIFT_TIME_ANCHOR = "if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  state.day=state.day||1;";
const START_SHIFT_VIEW_ANCHOR = "  state.currentView='overview';\n  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');";
const OPEN_WORK_VIEW_ANCHOR = "if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();";
const MAIN_ASSET_STATUS_ANCHOR = "        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;";

function transformMain(context, source) {
  if (source.includes(MARKERS.main)) return null;
  let code = normalise(source);
  const required = [
    ['function renderOverview() {','renderOverview declaration'],
    ['function renderView() {','renderView declaration'],
    ["function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;state.experience=0;state.agentStatus='offline';state.currentView='overview';saveState();toast('Employment accepted. Welcome to the operations floor.','success');renderView();}",'employment offer acceptance'],
    ['function startShift(){\n  if(!state.hired){toast(\'Complete recruitment and accept the employment offer before starting a shift.\',\'warning\');return;}','shift-start function'],
    ['function open3dWorkView(view){','3D workstation routing'],
    [SIMULATION_DATE_ANCHOR,'simulated date helper'],
    [START_SHIFT_TIME_ANCHOR,'scheduled shift time guard'],
    [START_SHIFT_VIEW_ANCHOR,'shift completion route'],
    [OPEN_WORK_VIEW_ANCHOR,'3D work-view shift route'],
    [MAIN_ASSET_STATUS_ANCHOR,'GLB runtime asset diagnostics']
  ];
  for (const [anchor,label] of required) if (!one(context, code, anchor, label)) return null;

  // A general-service career track is the new-candidate default. Banking remains
  // available as an explicit specialist industry track in the application.
  code = code.replace("  selectedTrack: 'banking',", "  selectedTrack: 'service',");
  code = code.replace("  department: 'Banking Operations',", "  department: 'Customer Experience',");
  code = code.replace('function renderOverview() {', `function renderOverview() {\n  calloriaEnsureOJTProfile();\n  if (calloriaOJTRequired()) return calloriaRenderOJT();`);
  code = code.replace('function renderView() {', `function renderView() {\n  calloriaEnsureOJTProfile();\n  if (calloriaOJTRequired() && state.currentView !== 'overview') state.currentView = 'overview';`);
  code = code.replace(
    "function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;state.experience=0;state.agentStatus='offline';state.currentView='overview';saveState();toast('Employment accepted. Welcome to the operations floor.','success');renderView();}",
    "function acceptOffer(){state.stage='employee';state.hired=true;state.onboarding=calloriaCreateOJTProfile();state.shiftActive=false;state.level=1;state.experience=0;state.agentStatus='offline';state.currentView='overview';saveState();toast('Employment accepted. Your on-the-job product, systems and shadowing programme starts now.','success');renderView();}"
  );
  // Put onboarding functions before the first renderOverview invocation site.
  const overviewAnchor = 'function renderOverview() {';
  code = code.replace(overviewAnchor, `${OJT_CODE}\n${overviewAnchor}`);
  // The OJT check in renderOverview was added before the function body injection.
  // Its earlier replacement is now present in the copied OJT source boundary.
  const startGuard = "  if(!state.hired){toast('Complete recruitment and accept the employment offer before starting a shift.','warning');return;}";
  code = code.replace(startGuard, `${startGuard}\n  calloriaEnsureOJTProfile();\n  if(calloriaOJTRequired()){toast('Complete on-the-job knowledge, systems, shadowing and supervised practice before receiving a desk.','warning');state.currentView='overview';renderView();return;}`);
  code = code.replace(START_SHIFT_TIME_ANCHOR, `if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  if(!hasBriefingAttendanceForToday()){toast('Attend the 07:30 morning or 14:00 afternoon operations briefing before starting your shift.','warning');state.currentView='workforce';saveState();renderView();return;}\n  state.day=state.day||1;`);
  code = code.replace(START_SHIFT_VIEW_ANCHOR, START_SHIFT_VIEW_ANCHOR.replace("state.currentView='overview'", "state.currentView='inbound'"));
  code = code.replace(OPEN_WORK_VIEW_ANCHOR, `if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive){\n    calloriaEnsureOJTProfile();\n    if(calloriaOJTRequired()){view='overview';toast('Complete employee onboarding before opening a live operations desk.','warning');}\n    else {\n      const minute=simulationMinuteNow();\n      if(minute<8*60||!hasBriefingAttendanceForToday()){view='workforce';toast(minute<8*60?'The shift opens at 08:00. Attend the scheduled operations briefing.':'Attend today’s operations briefing before opening customer queues.','warning');}\n      else {startShift();if(!state.shiftActive)view='workforce';}\n    }\n  }`);
  // The player may still explore the office during onboarding, but workstation
  // actions cannot unlock production operations before trainer sign-off.
  const workOpenStart = 'function open3dWorkView(view){';
  code = code.replace(workOpenStart, `${workOpenStart}\n  calloriaEnsureOJTProfile();\n  if(calloriaOJTRequired() && view !== 'recruitment'){toast('You are still in on-the-job onboarding. Complete the four training modules before using an operating desk.','warning');state.currentView='overview';saveState();exit3dFloor();renderView();return;}`);
  // Retain the established 07:30 and 14:00 briefings as prerequisites.
  const dateHelper = `${SIMULATION_DATE_ANCHOR}\nfunction hasBriefingAttendanceForToday(){\n  const simulatedDate=simulationDateNow();\n  const morningDate=new Date(simulatedDate);morningDate.setHours(7,45,0,0);\n  const afternoonDate=new Date(simulatedDate);afternoonDate.setHours(14,15,0,0);\n  const briefingIds=[briefingFor(morningDate),briefingFor(afternoonDate)].filter(Boolean).map(item=>item.id);\n  return (state.briefingAttendance||[]).some(item=>briefingIds.includes(item.briefingId));\n}`;
  code = code.replace(SIMULATION_DATE_ANCHOR, dateHelper);
  code = code.replace(MAIN_ASSET_STATUS_ANCHOR, `        const staffCount=Number(result.staffLoaded ?? result.loaded)||0;\n        const officeCount=Number(result.officePlaced)||0;\n        const staffFailures=Array.isArray(result.rejected)?result.rejected:[];\n        const officeFailures=Array.isArray(result.officeErrors)?result.officeErrors:[];\n        const status=$('#assetStatus');\n        if(status){status.textContent=\`GLB STAFF: \${staffCount} · OFFICE GLB OBJECTS: \${officeCount}\`+(staffFailures.length+officeFailures.length?\` · REVIEW: \${staffFailures.length+officeFailures.length}\`:'');status.title=[...staffFailures,...officeFailures].map(item=>\`\${item.id||item.assetId||'asset'}: \${(item.reasons||[]).join('; ')||item.message||item.reason||'rejected'}\`).join(' | ')||'GLB asset loading diagnostics';}`);
  return { code: `/* ${MARKERS.main} */\n${code}`, map: null };
}

const HUD_STYLE = `
/* CALLORIA v3.7: prevent tutorial cards and player meshes from obscuring the floor. */
.calloria-world-mission-v23.calloria-tutorial-card-compact{width:min(220px,calc(100vw - 16px))!important;max-width:min(220px,calc(100vw - 16px))!important;max-height:112px!important;overflow:auto!important;box-sizing:border-box!important;padding:7px!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact h3{font-size:11px!important;line-height:1.2!important;margin:4px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact p{font-size:8px!important;line-height:1.25!important;margin:3px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__controls{display:none!important}
#calloriaQuickWorkDock{position:absolute;z-index:43;top:88px;right:10px;width:min(175px,calc(100vw - 20px));box-sizing:border-box;padding:8px;border:1px solid rgba(111,220,200,.5);border-radius:11px;background:rgba(5,22,33,.94);color:#eef8f8;pointer-events:auto}
#calloriaQuickWorkDock[hidden]{display:none!important}
#calloriaQuickWorkDock p{margin:4px 0 7px;color:#d1e0e4;font:500 9px/1.35 system-ui,sans-serif}
#calloriaQuickWorkButton{display:block;width:100%;min-height:40px;padding:8px;border:0;border-radius:8px;background:#087f7f;color:#fff;font:800 10px/1.2 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
@media(max-width:760px){#calloriaQuickWorkDock{top:max(82px,calc(env(safe-area-inset-top) + 64px));right:7px;width:min(158px,calc(100vw - 14px));padding:7px}.calloria-world-mission-v23.calloria-tutorial-card-compact{max-height:94px!important;width:min(198px,calc(100vw - 14px))!important;max-width:min(198px,calc(100vw - 14px))!important}}
`;
const HUD_SCRIPT = `
<script id="${MARKERS.html}">
(()=>{
 const hud=document.getElementById('immersiveHud');if(!hud||document.getElementById('calloriaQuickWorkDock'))return;
 const dock=document.createElement('aside');dock.id='calloriaQuickWorkDock';dock.hidden=true;dock.setAttribute('aria-label','Open workplace operations');
 dock.innerHTML='<p>Onboarding first. After trainer sign-off, open your workforce briefing and assigned desk.</p><button id="calloriaQuickWorkButton" type="button">OPEN WORKPLACE DESK</button>';
 hud.append(dock);dock.querySelector('#calloriaQuickWorkButton').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('calloria:guided-open-inbound')));
 const sync=()=>{const immersive=document.body.classList.contains('calloria-game-playing');const panel=document.getElementById('stationPanel');dock.hidden=!immersive||Boolean(panel&&!panel.classList.contains('hidden'));};
 ['calloria:world-immersive','calloria:game-station-panel-opened','calloria:workstation-resumed'].forEach(type=>window.addEventListener(type,sync));
 new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
 const compact=()=>{const card=document.querySelector('.calloria-world-mission-v23');if(card)card.classList.add('calloria-tutorial-card-compact');};
 compact();const world=document.querySelector('.world-panel')||document.body;new MutationObserver(compact).observe(world,{childList:true,subtree:true});sync();
})();
</script>`;
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
  if (!DRACO_FILES.includes(basename(path)) || !path.startsWith(root) || !existsSync(path)) {
    throw new Error(`CALLORIA v3.7 cannot find Three.js Draco decoder asset: ${path}`);
  }
  return readFileSync(path);
}

export function calloriaOJTGLBActivationPlugin() {
  let decoderRoot = null;
  return {
    name: 'calloria-ojt-glb-activation-v3-7',
    enforce: 'post',
    configResolved() { decoderRoot = dracoDirectory(); },
    buildStart() {
      const assetRoot = resolve(process.cwd(), 'public/assets/models');
      for (const relativePath of GLB_REQUIRED_ASSETS) {
        const assetPath = resolve(assetRoot, relativePath);
        if (!assetPath.startsWith(assetRoot) || !existsSync(assetPath)) {
          this.warn(`CALLORIA v3.7 required GLB file is missing from public/assets/models: ${relativePath}. It will not be replaced by a procedural placeholder.`);
          continue;
        }
        const bytes = readFileSync(assetPath).byteLength;
        if (bytes < 1024) this.warn(`CALLORIA v3.7 GLB file is unexpectedly small (${bytes} bytes): ${relativePath}`);
      }
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = String(request.url || '').split('?')[0];
        if (!requestPath.startsWith('/draco/')) return next();
        const fileName = basename(requestPath);
        if (!DRACO_FILES.includes(fileName)) return next();
        try {
          const root = resolve(decoderRoot || dracoDirectory());
          const filePath = resolve(root, fileName);
          if (!filePath.startsWith(root) || !existsSync(filePath)) return next();
          response.statusCode = 200;
          response.setHeader('Content-Type', fileName.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8');
          response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
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
      if (target.endsWith(TARGETS.office)) return transformOffice(this, source);
      if (target.endsWith(TARGETS.assetLoader)) return transformAssetLoader(this, source);
      if (target.endsWith(TARGETS.world)) return transformWorld(this, source);
      if (target.endsWith(TARGETS.avatar)) return { code: FIRST_PERSON_AVATAR, map: null };
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

export const __calloriaV37Test = Object.freeze({
  MARKERS, TARGETS, DRACO_FILES, GLB_REQUIRED_ASSETS, SIMULATION_DATE_ANCHOR,
  START_SHIFT_TIME_ANCHOR, START_SHIFT_VIEW_ANCHOR, OPEN_WORK_VIEW_ANCHOR,
  transformStaff, transformOffice, transformAssetLoader, transformWorld, transformMain,
  transformHtml, FIRST_PERSON_AVATAR, OJT_CODE
});
