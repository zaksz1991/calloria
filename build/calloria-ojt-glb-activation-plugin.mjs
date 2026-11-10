/**
 * CALLORIA v3.8.2 — GLB runtime visibility + first-person player
 * + real GLB/Draco activation. Built against the current repository main.js and its active v2.9 GLB-first + v3.7.2 OJT/workstation Vite transform chain.
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
    const message = `CALLORIA v3.8.2 expected one ${label} anchor; found ${found}.`;
    if (strict && context?.error) context.error(message);
    return false;
  }
  return true;
}
function normalise(source) { return String(source).replace(/\r\n?/g, '\n'); }

function ensureImport(context, code, statement, anchor, label) {
  if (code.includes(statement)) return code;
  if (!one(context, code, anchor, `${label} import anchor`)) return null;
  return code.replace(anchor, `${anchor}\n${statement}`);
}

function rewriteLoaderSetup(context, source, {
  label,
  declarationPattern,
  receiver = 'loader',
  manager = false
}) {
  let code = normalise(source);
  const gltfImport = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
  const meshoptImport = "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';";
  const dracoImport = "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';";
  code = ensureImport(context, code, meshoptImport, gltfImport, `${label} MeshoptDecoder`);
  if (code === null) return null;
  code = ensureImport(context, code, dracoImport, gltfImport, `${label} DRACOLoader`);
  if (code === null) return null;
  const matches = [...code.matchAll(declarationPattern)];
  if (matches.length !== 1) {
    context.error(`CALLORIA v3.8.2 expected one ${label} GLTFLoader construction; found ${matches.length}.`);
    return null;
  }
  if (!code.includes(`${receiver}.setMeshoptDecoder(MeshoptDecoder)`)) {
    const match = matches[0];
    const indent = match[1] || '';
    const original = match[0].trim();
    const constructor = original
      .replace(/^const\s+\w+\s*=\s*/, '')
      .replace(/^this\.loader\s*=\s*/, '')
      .replace(/\.setMeshoptDecoder\(MeshoptDecoder\)/g, '')
      .replace(/;$/, '');
    const declaration = receiver === 'this.loader'
      ? `${indent}this.loader = ${constructor};`
      : `${indent}const ${receiver} = ${constructor};`;
    const setup = `${indent}${receiver}.setMeshoptDecoder(MeshoptDecoder);`;
    code = code.replace(match[0], `${declaration}\n${setup}`);
  }
  if (!code.includes(`${receiver}.setDRACOLoader(`)) {
    const match = [...code.matchAll(declarationPattern)][0];
    const indent = match?.[1] || '';
    const setup = `${indent}const dracoLoader = new DRACOLoader();\n${indent}dracoLoader.setDecoderPath('/draco/');\n${indent}${receiver}.setDRACOLoader(dracoLoader);`;
    const meshoptLine = new RegExp(`^([\\t ]*)${receiver.replaceAll('.', '\\.') }\\.setMeshoptDecoder\\(MeshoptDecoder\\);[\\t ]*$`, 'm');
    if (meshoptLine.test(code)) code = code.replace(meshoptLine, `$&\n${setup}`);
    else {
      const declarationLine = receiver === 'this.loader'
        ? /^([\t ]*)this\.loader\s*=\s*[^;]+;[\t ]*$/m
        : new RegExp(`^([\\t ]*)const ${receiver.replaceAll('.', '\\.') }\\s*=\\s*[^;]+;[\\t ]*$`, 'm');
      if (!declarationLine.test(code)) {
        context.error(`CALLORIA v3.8.2 could not locate ${label} loader setup for Draco registration.`);
        return null;
      }
      code = code.replace(declarationLine, `$&\n${setup}`);
    }
  }
  return code;
}

function transformStaff(context, source) {
  if (source.includes(MARKERS.staff)) return null;
  let code = rewriteLoaderSetup(context, source, {
    label: 'staff',
    declarationPattern: /^([\t ]*)const loader = new GLTFLoader\([^;\n]*\);[\t ]*$/gm,
    receiver: 'loader'
  });
  if (code === null) return null;
  const extensionPattern = /^([\t ]*)const extensionsValid = .*;[\t ]*$/gm;
  const extensionMatches = [...code.matchAll(extensionPattern)];
  if (extensionMatches.length === 1) {
    const indent = extensionMatches[0][1];
    code = code.replace(extensionPattern,
      `${indent}const supportedRequiredExtensions = new Set(['KHR_draco_mesh_compression', 'EXT_meshopt_compression']);\n${indent}const extensionsValid = requiredExtensions.every((extension) => supportedRequiredExtensions.has(extension));`);
  } else if (!code.includes('supportedRequiredExtensions')) {
    context.error(`CALLORIA v3.8.2 expected one staff required-extension validation; found ${extensionMatches.length}.`);
    return null;
  }
  return { code: `/* ${MARKERS.staff} */\n${code}`, map: null };
}

function transformOffice(context, source) {
  if (source.includes(MARKERS.office)) return null;
  let code = normalise(source);
  const preferredPlanPattern = /const preferred = safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*safeTier === 'high'\s*\?\s*\[[^\]]*\]\s*:\s*\[[^\]]*\];/g;
  const headsetPlanPattern = /headsetStationIndexes:\s*safeTier === 'low'\s*\?\s*\[[^\]]*\]\s*:\s*\[\.\.\.deskStationIndexes\],?/g;
  const receptionPlanPattern = /includeReceptionDesk:\s*[^,\n]+,/g;
  const preferredMatches = code.match(preferredPlanPattern) || [];
  const headsetMatches = code.match(headsetPlanPattern) || [];
  const receptionMatches = code.match(receptionPlanPattern) || [];
  if (preferredMatches.length !== 1 || headsetMatches.length !== 1 || receptionMatches.length !== 1) {
    context.error(`CALLORIA v3.8.2 expected one office workstation/headset/reception plan (found ${preferredMatches.length}, ${headsetMatches.length}, ${receptionMatches.length}).`);
    return null;
  }
  const gltfImport = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
  const dracoImport = "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';";
  code = ensureImport(context, code, dracoImport, gltfImport, 'office DRACOLoader');
  if (code === null) return null;
  if (!code.includes('loader.setDRACOLoader(')) {
    const meshoptLine = /^([\t ]*)loader\.setMeshoptDecoder\(MeshoptDecoder\);[\t ]*$/m;
    if (meshoptLine.test(code)) {
      // Use a callback replacement rather than a replacement-string template.
      // A literal \n in a replacement string is emitted into the transformed JS,
      // where Rollup interprets it as an invalid Unicode escape. Building the
      // inserted lines as an array guarantees real source newlines.
      code = code.replace(meshoptLine, (match, indent) => [
        match,
        `${indent}const dracoLoader = new DRACOLoader();`,
        `${indent}dracoLoader.setDecoderPath('/draco/');`,
        `${indent}loader.setDRACOLoader(dracoLoader);`
      ].join('\n'));
    } else {
      const declarationLine = /^([\t ]*)const loader = new GLTFLoader\(\);[\t ]*$/m;
      if (!declarationLine.test(code)) {
        context.error('CALLORIA v3.8.2 could not locate office GLTFLoader setup for Draco registration.');
        return null;
      }
      code = code.replace(declarationLine, (match, indent) => [
        match,
        `${indent}loader.setMeshoptDecoder(MeshoptDecoder);`,
        `${indent}const dracoLoader = new DRACOLoader();`,
        `${indent}dracoLoader.setDecoderPath('/draco/');`,
        `${indent}loader.setDRACOLoader(dracoLoader);`
      ].join('\n'));
    }
  }
  return { code: `/* ${MARKERS.office} */\n${code}`, map: null };
}

function transformAssetLoader(context, source) {
  if (source.includes(MARKERS.assetLoader)) return null;
  const code = rewriteLoaderSetup(context, source, {
    label: 'shared asset',
    declarationPattern: /^([\t ]*)this\.loader = new GLTFLoader\([^;\n]*\);[\t ]*$/gm,
    receiver: 'this.loader'
  });
  if (code === null) return null;
  return { code: `/* ${MARKERS.assetLoader} */\n${code}`, map: null };
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
const OFFER_ACCEPT_PREFIX = "function acceptOffer(){state.stage='employee';state.hired=true;";
const OPEN_WORK_VIEW_ANCHOR = "if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();";

function transformMain(context, source) {
  if (source.includes(MARKERS.main)) return null;
  let code = normalise(source);
  const required = [
    ['function renderOverview() {','renderOverview declaration'],
    ['function renderView() {','renderView declaration'],
    [OFFER_ACCEPT_PREFIX,'employment offer acceptance prefix'],
    ['function startShift(){\n  if(!state.hired){toast(\'Complete recruitment and accept the employment offer before starting a shift.\',\'warning\');return;}','shift-start function'],
    ['function open3dWorkView(view){','3D workstation routing'],
    [SIMULATION_DATE_ANCHOR,'simulated date helper'],
    [START_SHIFT_TIME_ANCHOR,'scheduled shift time guard'],
    [START_SHIFT_VIEW_ANCHOR,'shift completion route'],

  ];
  for (const [anchor,label] of required) if (!one(context, code, anchor, label)) return null;

  // A general-service career track is the new-candidate default. Banking remains
  // available as an explicit specialist industry track in the application.
  code = code.replace("  selectedTrack: 'banking',", "  selectedTrack: 'service',");
  code = code.replace("  department: 'Banking Operations',", "  department: 'Customer Experience',");
  code = code.replace('function renderOverview() {', `function renderOverview() {\n  calloriaEnsureOJTProfile();\n  if (calloriaOJTRequired()) return calloriaRenderOJT();`);
  code = code.replace('function renderView() {', `function renderView() {\n  calloriaEnsureOJTProfile();\n  if (calloriaOJTRequired() && state.currentView !== 'overview') state.currentView = 'overview';`);
  // The earlier first-shift plugin inserts a gameplay event inside acceptOffer.
  // Anchor only the stable opening prefix and preserve every upstream event.
  code = code.replace(OFFER_ACCEPT_PREFIX, `${OFFER_ACCEPT_PREFIX}state.onboarding=calloriaCreateOJTProfile();`);
  // Put onboarding functions before the first renderOverview invocation site.
  const overviewAnchor = 'function renderOverview() {';
  code = code.replace(overviewAnchor, `${OJT_CODE}\n${overviewAnchor}`);
  // The OJT check in renderOverview was added before the function body injection.
  // Its earlier replacement is now present in the copied OJT source boundary.
  const startGuard = "  if(!state.hired){toast('Complete recruitment and accept the employment offer before starting a shift.','warning');return;}";
  code = code.replace(startGuard, `${startGuard}\n  calloriaEnsureOJTProfile();\n  if(calloriaOJTRequired()){toast('Complete on-the-job knowledge, systems, shadowing and supervised practice before receiving a desk.','warning');state.currentView='overview';renderView();return;}`);
  code = code.replace(START_SHIFT_TIME_ANCHOR, `if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  if(!hasBriefingAttendanceForToday()){toast('Attend the 07:30 morning or 14:00 afternoon operations briefing before starting your shift.','warning');state.currentView='workforce';saveState();renderView();return;}\n  state.day=state.day||1;`);
  code = code.replace(START_SHIFT_VIEW_ANCHOR, START_SHIFT_VIEW_ANCHOR.replace("state.currentView='overview'", "state.currentView='inbound'"));
  // All workstation operations pass through this guard. Earlier v2.3/v2.5
  // plugins can move the original startShift() tail into an event bridge, so
  // the gate attaches to the stable open3dWorkView function boundary.
  const workOpenStart = 'function open3dWorkView(view){';
  const workOpenGuard = `${workOpenStart}
  calloriaEnsureOJTProfile();
  if(calloriaOJTRequired() && view !== 'recruitment'){toast('You are still in on-the-job onboarding. Complete the four training modules before using an operating desk.','warning');state.currentView='overview';saveState();exit3dFloor();renderView();return;}
  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive){
    const minute=simulationMinuteNow();
    if(minute<8*60||!hasBriefingAttendanceForToday()){
      state.currentView='workforce';
      saveState();
      toast(minute<8*60?'The shift opens at 08:00. Attend the scheduled operations briefing.':'Attend today’s operations briefing before opening customer queues.','warning');
      renderView();
      return;
    }
    startShift();
    if(!state.shiftActive){state.currentView='workforce';saveState();renderView();return;}
  }`;
  code = code.replace(workOpenStart, workOpenGuard);
  // Remove the legacy inline startShift call if an upstream version retained it.
  const legacyWorkStartCount = count(code, OPEN_WORK_VIEW_ANCHOR);
  if (legacyWorkStartCount === 1) code = code.replace(OPEN_WORK_VIEW_ANCHOR, '/* shift start handled by the v3.7.2 function-entry guard */');
  else if (legacyWorkStartCount > 1) context.error('CALLORIA v3.8.2 found multiple legacy 3D shift-start anchors.');
  // Retain the established 07:30 and 14:00 briefings as prerequisites.
  const dateHelper = `${SIMULATION_DATE_ANCHOR}\nfunction hasBriefingAttendanceForToday(){\n  const simulatedDate=simulationDateNow();\n  const morningDate=new Date(simulatedDate);morningDate.setHours(7,45,0,0);\n  const afternoonDate=new Date(simulatedDate);afternoonDate.setHours(14,15,0,0);\n  const briefingIds=[briefingFor(morningDate),briefingFor(afternoonDate)].filter(Boolean).map(item=>item.id);\n  return (state.briefingAttendance||[]).some(item=>briefingIds.includes(item.briefingId));\n}`;
  code = code.replace(SIMULATION_DATE_ANCHOR, dateHelper);
  // The current main.js still labels a zero-load result as an optimised local
  // model mode. Replace that exact callback with truthful counts and a complete
  // event payload for the in-world GLB audit panel. This is deliberately a
  // warning-only optional transform so a harmless callback formatting change
  // cannot break the production build.
  const legacyAssetStatus = "onAssetsReady:result=>{\n        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;\n      },";
  if (count(code, legacyAssetStatus) === 1) {
    const truthfulAssetStatus = `onAssetsReady:result=>{
        const safeCount=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
        const staffLoaded=safeCount(result?.staffLoaded ?? result?.loaded ?? 0);
        const officePlaced=safeCount(result?.officePlaced ?? 0);
        const failures=(Array.isArray(result?.rejected)?result.rejected.length:0)+(Array.isArray(result?.officeErrors)?result.officeErrors.length:0);
        const status=$('#assetStatus');
        if(status)status.textContent=staffLoaded||officePlaced ? 'GLB STAFF: '+staffLoaded+' · OFFICE GLB OBJECTS: '+officePlaced : 'NO GLB MODELS LOADED · FALLBACKS ONLY';
        window.dispatchEvent(new CustomEvent('calloria:glb-assets-ready',{detail:{...result,staffLoaded,officePlaced,failures}}));
      },`;
    code = code.replace(legacyAssetStatus, truthfulAssetStatus);
  } else {
    context.warn?.('CALLORIA v3.8 could not find the legacy asset-status callback; the runtime audit panel will remain available but may show no status event.');
  }
  return { code: `/* ${MARKERS.main} */\n${code}`, map: null };
}

const HUD_STYLE = `
/* CALLORIA v3.8.2: truthful GLB status without obscuring first-person gameplay. */
.calloria-world-mission-v23.calloria-tutorial-card-compact{width:min(220px,calc(100vw - 16px))!important;max-width:min(220px,calc(100vw - 16px))!important;max-height:112px!important;overflow:auto!important;box-sizing:border-box!important;padding:7px!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact h3{font-size:11px!important;line-height:1.2!important;margin:4px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact p{font-size:8px!important;line-height:1.25!important;margin:3px 0!important}
.calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__controls{display:none!important}
#calloriaQuickWorkDock{position:absolute;z-index:43;top:88px;right:10px;width:min(175px,calc(100vw - 20px));box-sizing:border-box;padding:8px;border:1px solid rgba(111,220,200,.5);border-radius:11px;background:rgba(5,22,33,.94);color:#eef8f8;pointer-events:auto}
#calloriaQuickWorkDock[hidden],#calloriaGlbAudit[hidden]{display:none!important}
#calloriaQuickWorkDock p{margin:4px 0 7px;color:#d1e0e4;font:500 9px/1.35 system-ui,sans-serif}
#calloriaQuickWorkButton{display:block;width:100%;min-height:40px;padding:8px;border:0;border-radius:8px;background:#087f7f;color:#fff;font:800 10px/1.2 system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
#calloriaGlbAudit{position:absolute;z-index:44;top:10px;left:10px;width:min(250px,calc(100vw - 24px));max-height:min(42vh,300px);overflow:auto;box-sizing:border-box;border:1px solid rgba(255,190,90,.55);border-radius:10px;background:rgba(5,18,29,.94);color:#eef6f8;font:10px/1.35 system-ui,sans-serif;pointer-events:auto}
#calloriaGlbAudit[open]{border-color:rgba(255,190,90,.8)}
#calloriaGlbAudit summary{padding:9px 10px;cursor:pointer;font-weight:850;letter-spacing:.04em;list-style-position:inside}
#calloriaGlbAudit .audit-body{padding:0 10px 10px}
#calloriaGlbAudit .audit-summary{margin:0 0 6px;color:#e5f6f0;font-weight:750}
#calloriaGlbAudit .audit-note{margin:4px 0;color:#d5e2e7}
#calloriaGlbAudit .audit-errors{margin:6px 0 8px;padding-left:17px;color:#ffd7ae;overflow-wrap:anywhere}
#calloriaGlbAudit .audit-assets{margin:6px 0;color:#a8e7d8;overflow-wrap:anywhere}
#calloriaGlbAudit a{display:inline-flex;min-height:34px;align-items:center;padding:6px 9px;border-radius:7px;background:#165b64;color:#fff;text-decoration:none;font-weight:800}
@media(max-width:760px){#calloriaQuickWorkDock{top:max(82px,calc(env(safe-area-inset-top) + 64px));right:7px;width:min(158px,calc(100vw - 14px));padding:7px}.calloria-world-mission-v23.calloria-tutorial-card-compact{max-height:94px!important;width:min(198px,calc(100vw - 14px))!important;max-width:min(198px,calc(100vw - 14px))!important}#calloriaGlbAudit{top:max(8px,env(safe-area-inset-top));left:7px;width:min(210px,calc(100vw - 14px));max-height:34vh}}
`;
const HUD_SCRIPT = `
<script id="${MARKERS.html}">
(()=>{
 const hud=document.getElementById('immersiveHud');if(!hud||document.getElementById('calloriaQuickWorkDock'))return;
 const dock=document.createElement('aside');dock.id='calloriaQuickWorkDock';dock.hidden=true;dock.setAttribute('aria-label','Open workplace operations');
 dock.innerHTML='<p>Onboarding first. After trainer sign-off, open your workforce briefing and assigned desk.</p><button id="calloriaQuickWorkButton" type="button">OPEN WORKPLACE DESK</button>';
 hud.append(dock);dock.querySelector('#calloriaQuickWorkButton').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('calloria:guided-open-inbound')));
 const audit=document.createElement('details');audit.id='calloriaGlbAudit';audit.hidden=true;audit.setAttribute('aria-live','polite');audit.innerHTML='<summary id="calloriaGlbAuditTitle">3D ASSET STATUS · WAITING</summary><div class="audit-body"><p id="calloriaGlbAuditSummary" class="audit-summary">Waiting for the real GLB loader result.</p><p id="calloriaGlbAuditNote" class="audit-note">This panel distinguishes loaded GLB models from local fallback geometry.</p><p id="calloriaGlbAuditAssets" class="audit-assets"></p><ul id="calloriaGlbAuditErrors" class="audit-errors"></ul><a href="/asset-inspector.html" target="_blank" rel="noopener">OPEN 3D ASSET INSPECTOR</a></div>';
 hud.append(audit);
 const title=audit.querySelector('#calloriaGlbAuditTitle');
 const summary=audit.querySelector('#calloriaGlbAuditSummary');
 const note=audit.querySelector('#calloriaGlbAuditNote');
 const assetsNode=audit.querySelector('#calloriaGlbAuditAssets');
 const errorsNode=audit.querySelector('#calloriaGlbAuditErrors');
 let received=false;
 const addLine=(label,message)=>{const li=document.createElement('li');li.textContent=label+': '+message;errorsNode.append(li);};
 const updateAudit=(detail)=>{
   received=true;
   const safeCount=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
   const staff=safeCount(detail?.staffLoaded??detail?.loaded??0);
   const office=safeCount(detail?.officePlaced??0);
   const fallback=safeCount(detail?.fallback??0);
   const tier=String(detail?.tier||'unknown').toUpperCase();
   const rejected=Array.isArray(detail?.rejected)?detail.rejected:[];
   const officeErrors=Array.isArray(detail?.officeErrors)?detail.officeErrors:[];
   const failures=rejected.length+officeErrors.length;
   const good=staff>0||office>0;
   title.textContent='GLB STAFF '+staff+' · OFFICE OBJECTS '+office+' · '+tier;
   summary.textContent=good?'REAL GLB MODELS PLACED: '+staff+' staff / '+office+' office objects.':'NO GLB MODELS PLACED — THE VISIBLE FALLBACKS ARE NOT GLB ASSETS.';
   note.textContent='Local staff/furniture fallbacks remaining: '+fallback+'. Failed or rejected model loads: '+failures+'.';
   const names=[...(Array.isArray(detail?.assetsInUse)?detail.assetsInUse:[]),...(Array.isArray(detail?.officeAssets)?detail.officeAssets:[])];
   assetsNode.textContent=names.length?'Models in use: '+[...new Set(names)].join(', '):'';
   errorsNode.replaceChildren();
   rejected.forEach(item=>addLine('Staff '+String(item?.id||'unknown'),Array.isArray(item?.reasons)?item.reasons.join('; '):'Rejected without a reason'));
   officeErrors.forEach(item=>addLine('Office '+String(item?.assetId||'unknown'),String(item?.message||'Load failed')));
   if(!good&&!failures){
     const reason=String(detail?.reason||'No compatible GLB placement was reported.');
     addLine('Diagnostic',reason);
   }
   audit.hidden=false;
   audit.open=!good||failures>0;
 };
 window.addEventListener('calloria:glb-assets-ready',event=>updateAudit(event.detail||{}));
 window.setTimeout(()=>{if(!received){updateAudit({staffLoaded:0,officePlaced:0,tier:'unknown',reason:'The 3D world did not publish a GLB readiness result. Check the browser console and asset paths.'});}},15000);
 const sync=()=>{const immersive=document.body.classList.contains('calloria-game-playing');const panel=document.getElementById('stationPanel');dock.hidden=!immersive||Boolean(panel&&!panel.classList.contains('hidden'));audit.hidden=!immersive||!received;};
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
    throw new Error(`CALLORIA v3.8.2 cannot find Three.js Draco decoder asset: ${path}`);
  }
  return readFileSync(path);
}

export function calloriaOJTGLBActivationPlugin() {
  let decoderRoot = null;
  return {
    name: 'calloria-glb-runtime-visibility-v3-8-2',
    enforce: 'post',
    configResolved() { decoderRoot = dracoDirectory(); },
    buildStart() {
      const assetRoot = resolve(process.cwd(), 'public/assets/models');
      for (const relativePath of GLB_REQUIRED_ASSETS) {
        const assetPath = resolve(assetRoot, relativePath);
        if (!assetPath.startsWith(assetRoot) || !existsSync(assetPath)) {
          this.warn(`CALLORIA v3.8.2 required GLB file is missing from public/assets/models: ${relativePath}. It will not be replaced by a procedural placeholder.`);
          continue;
        }
        const bytes = readFileSync(assetPath).byteLength;
        if (bytes < 1024) this.warn(`CALLORIA v3.8.2 GLB file is unexpectedly small (${bytes} bytes): ${relativePath}`);
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
  MARKERS, TARGETS, DRACO_FILES, GLB_REQUIRED_ASSETS, OFFER_ACCEPT_PREFIX, SIMULATION_DATE_ANCHOR,
  START_SHIFT_TIME_ANCHOR, START_SHIFT_VIEW_ANCHOR, OPEN_WORK_VIEW_ANCHOR,
  transformStaff, transformOffice, transformAssetLoader, transformWorld, transformMain, rewriteLoaderSetup, ensureImport,
  transformHtml, FIRST_PERSON_AVATAR, OJT_CODE
});
