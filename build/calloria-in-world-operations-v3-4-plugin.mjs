/**
 * CALLORIA v3.4 — work-first in-world entry, compressed GLB support and pose guard.
 *
 * This is an additive Vite plugin for the current v3.3 main branch. It preserves
 * the existing operational engines and 3D frame loop. It does not invent staff
 * assets: it enables the Three.js Draco decoder for existing local GLBs, keeps
 * invalid player poses out of the third-person camera, and puts a direct route
 * to the existing inbound workstation into the immersive HUD.
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

const STAFF_TARGET = '/js/glb-world-integration.js';
const AVATAR_TARGET = '/js/world-player-avatar.js';
const MAIN_TARGET = '/js/main.js';

const MARKERS = Object.freeze({
  staff: '__CALLORIA_DRACO_STAFF_RUNTIME_V34__',
  avatar: '__CALLORIA_ANIMATED_PLAYER_POSE_GUARD_V34__',
  main: '__CALLORIA_GUIDED_INBOUND_ENTRY_V34__',
  html: 'CALLORIA_V34_WORK_FIRST_HUD'
});

const GLTF_IMPORT = "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';";
const DRACO_IMPORT = "import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';";
const STAFF_LOADER = '  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);';
const STAFF_EXTENSION_GUARD = "      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');";
const AVATAR_MESHOPT_SETUP = '  loader.setMeshoptDecoder(MeshoptDecoder);';
const AVATAR_METRICS = '      const candidateMetrics = inspectScene(candidate.scene);';
const PAGEHIDE_ANCHOR = "window.addEventListener('pagehide',()=>{ void flushCloudEmploymentSave(); });";

const DRACO_FILES = Object.freeze([
  'draco_decoder.js',
  'draco_decoder.wasm',
  'draco_wasm_wrapper.js'
]);

function occurrenceCount(source, anchor) {
  return source.split(anchor).length - 1;
}

function requireExactlyOnce(context, source, anchor, label) {
  const found = occurrenceCount(source, anchor);
  if (found !== 1) {
    const message = `CALLORIA v3.4 expected exactly one ${label} anchor; found ${found}. Refusing a partial transform.`;
    if (context && typeof context.error === 'function') context.error(message);
    throw new Error(message);
  }
}

function addDracoImport(source, context, label) {
  requireExactlyOnce(context, source, GLTF_IMPORT, `${label} GLTFLoader import`);
  return source.replace(GLTF_IMPORT, `${GLTF_IMPORT}\n${DRACO_IMPORT}`);
}

function transformStaff(context, source) {
  if (source.includes(MARKERS.staff)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireExactlyOnce(context, code, STAFF_LOADER, 'staff Meshopt loader');
  requireExactlyOnce(context, code, STAFF_EXTENSION_GUARD, 'staff required-extension guard');
  code = addDracoImport(code, context, 'staff runtime');
  code = `/* ${MARKERS.staff} */\n${code}`;
  code = code.replace(
    STAFF_LOADER,
    `  const dracoLoader = new DRACOLoader().setDecoderPath('/draco/');\n${STAFF_LOADER.replace(');', ').setDRACOLoader(dracoLoader);')}`
  );
  code = code.replace(
    STAFF_EXTENSION_GUARD,
    "      // Meshopt and Draco decoders are registered on this GLTFLoader. GLTFLoader itself rejects unsupported required extensions.\n      const extensionsValid = true;"
  );
  return { code, map: null };
}

function transformAvatar(context, source) {
  if (source.includes(MARKERS.avatar)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireExactlyOnce(context, code, AVATAR_MESHOPT_SETUP, 'player Meshopt decoder setup');
  requireExactlyOnce(context, code, AVATAR_METRICS, 'player candidate metrics');
  code = addDracoImport(code, context, 'player avatar');
  code = `/* ${MARKERS.avatar} */\n${code}`;
  code = code.replace(
    AVATAR_MESHOPT_SETUP,
    `${AVATAR_MESHOPT_SETUP}\n  loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));`
  );
  code = code.replace(
    AVATAR_METRICS,
    `${AVATAR_METRICS}
      // Do not put an unanimated/default-pose mesh in the third-person camera.
      // A visible player model must be skinned and provide named idle + walk clips.
      const candidateAnimations = Array.isArray(candidate.animations) ? candidate.animations : [];
      const hasIdleMotion = candidateAnimations.some((clip) => /idle|stand|standing|rest|breath|listen/i.test(String(clip.name || '')));
      const hasWalkMotion = candidateAnimations.some((clip) => /walk|walking|locomotion|move/i.test(String(clip.name || '')));
      const animatedHumanRig = candidateMetrics.skinned > 0 && candidateMetrics.bones >= 12 && hasIdleMotion && hasWalkMotion;
      if (!animatedHumanRig) {
        const missing = [
          candidateMetrics.skinned <= 0 ? 'skinned human rig' : null,
          candidateMetrics.bones < 12 ? 'at least 12 rig bones' : null,
          !hasIdleMotion ? 'named idle animation' : null,
          !hasWalkMotion ? 'named walk animation' : null
        ].filter(Boolean).join(', ');
        failures.push({ assetId: asset.id, reason: \`player avatar rejected: missing \${missing}\` });
        disposeGLTFResources(candidate);
        continue;
      }`
  );
  return { code, map: null };
}

function transformMain(context, source) {
  if (source.includes(MARKERS.main)) return null;
  let code = String(source).replace(/\r\n?/g, '\n');
  requireExactlyOnce(context, code, PAGEHIDE_ANCHOR, 'main lifecycle listener');
  code = `/* ${MARKERS.main} */\n${code}`;
  code = code.replace(
    PAGEHIDE_ANCHOR,
    `// The quick-work HUD uses the real inbound desk and its existing service rules.\nwindow.addEventListener('calloria:guided-open-inbound', () => {
  if (!state.hired) {
    toast('Complete recruitment and accept your employment offer before handling customer interactions.', 'warning');
    open3dWorkView('recruitment');
    return;
  }
  open3dWorkView('inbound');
});
${PAGEHIDE_ANCHOR}`
  );
  return { code, map: null };
}

function dracoDirectory() {
  const threeEntry = require.resolve('three');
  const threePackageRoot = resolve(dirname(threeEntry), '..');
  return resolve(threePackageRoot, 'examples/jsm/libs/draco/gltf');
}

function readDracoFile(fileName) {
  const path = resolve(dracoDirectory(), fileName);
  if (!DRACO_FILES.includes(basename(path)) || !existsSync(path)) {
    throw new Error(`CALLORIA v3.4 cannot find Three.js Draco decoder asset: ${path}`);
  }
  return readFileSync(path);
}

const WORK_FIRST_STYLE = `
/* CALLORIA v3.4 — compact in-world customer-work entry. */
#calloriaQuickWorkDock {
  position:absolute; z-index:42; top:142px; right:14px; width:min(226px,calc(100vw - 28px));
  box-sizing:border-box; padding:12px; border:1px solid rgba(111,220,200,.44);
  border-radius:14px; background:rgba(5,22,33,.94); color:#eef8f8;
  box-shadow:0 12px 32px rgba(0,0,0,.30); backdrop-filter:blur(12px);
  -webkit-backdrop-filter:blur(12px); pointer-events:auto;
}
#calloriaQuickWorkDock[hidden] { display:none!important; }
#calloriaQuickWorkDock .cq-kicker { display:block; color:#79d8c8; font:800 9px/1.3 system-ui,sans-serif; letter-spacing:.16em; }
#calloriaQuickWorkDock p { margin:6px 0 9px; color:#d1e0e4; font:500 11px/1.42 system-ui,sans-serif; }
#calloriaQuickWorkButton {
  display:block; width:100%; min-height:42px; padding:9px 10px; border:0; border-radius:9px;
  background:linear-gradient(135deg,#27b6a5,#087f7f); color:#fff;
  font:800 11px/1.2 system-ui,sans-serif; letter-spacing:.045em; cursor:pointer;
  touch-action:manipulation; box-shadow:0 5px 16px rgba(0,150,135,.22);
}
#calloriaQuickWorkDock .cq-flow { display:block; margin-top:8px; color:#9db7c1; font:600 9px/1.4 system-ui,sans-serif; }
.calloria-tutorial-card-compact {
  width:min(450px,calc(100vw - 28px))!important; max-width:min(450px,calc(100vw - 28px))!important;
  max-height:min(23dvh,215px)!important; overflow:auto!important; box-sizing:border-box!important;
  padding:13px!important; border-radius:14px!important;
}
.calloria-world-mission-v23.calloria-tutorial-card-compact {
  width:min(280px,calc(100vw - 22px))!important; max-width:min(280px,calc(100vw - 22px))!important;
  max-height:min(20dvh,150px)!important; overflow:auto!important; box-sizing:border-box!important;
  padding:9px!important; border-radius:10px!important;
}
@media(max-width:760px) {
  #calloriaQuickWorkDock { top:142px; right:10px; width:min(206px,calc(100vw - 20px)); padding:10px; }
  #calloriaQuickWorkDock p { font-size:10px; margin:5px 0 7px; }
  #calloriaQuickWorkButton { min-height:40px; font-size:10px; }
  .calloria-tutorial-card-compact {
    width:min(430px,calc(100vw - 24px))!important; max-width:min(430px,calc(100vw - 24px))!important;
    max-height:min(22dvh,205px)!important; padding:11px!important;
  }
  .calloria-world-mission-v23.calloria-tutorial-card-compact {
    width:min(210px,calc(100vw - 20px))!important; max-width:min(210px,calc(100vw - 20px))!important;
    max-height:min(17dvh,124px)!important; padding:8px!important;
  }
  .calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__controls { display:none!important; }
  .calloria-world-mission-v23.calloria-tutorial-card-compact .calloria-world-mission-v23__top { font-size:7px!important; }
  .calloria-world-mission-v23.calloria-tutorial-card-compact h3 { font-size:10px!important; }
  .calloria-world-mission-v23.calloria-tutorial-card-compact p { font-size:8px!important; line-height:1.3!important; }
}
body.calloria-game-launch.calloria-game-operation #calloriaQuickWorkDock { display:none!important; }
`;

const WORK_FIRST_SCRIPT = `
<script id="CALLORIA_V34_WORK_FIRST_HUD">
(() => {
  const hud = document.getElementById('immersiveHud');
  if (!hud || document.getElementById('calloriaQuickWorkDock')) return;

  const dock = document.createElement('aside');
  dock.id = 'calloriaQuickWorkDock';
  dock.setAttribute('aria-label', 'Quick access to contact-centre work');
  dock.hidden = true;
  dock.innerHTML = '<span class="cq-kicker">YOUR SHIFT · CUSTOMER OPERATIONS</span>' +
    '<p>Go straight to the simulated inbound queue. Briefing and shift-time rules still apply.</p>' +
    '<button id="calloriaQuickWorkButton" type="button">START INBOUND WORK →</button>' +
    '<small class="cq-flow">ACCEPT CONTACT · CRM · RESOLVE · SAVE CASE · QA</small>';
  hud.append(dock);

  const button = dock.querySelector('#calloriaQuickWorkButton');
  button.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('calloria:guided-open-inbound'));
  });

  const syncVisibility = () => {
    const immersive = document.body.classList.contains('calloria-immersive') ||
      document.body.classList.contains('calloria-game-playing');
    const operating = document.body.classList.contains('calloria-game-operation');
    const station = document.getElementById('stationPanel');
    const stationOpen = station && !station.classList.contains('hidden');
    dock.hidden = !immersive || operating || Boolean(stationOpen);
  };

  window.addEventListener('calloria:world-immersive', syncVisibility);
  window.addEventListener('calloria:game-station-panel-opened', syncVisibility);
  window.addEventListener('calloria:game-operation-selected', syncVisibility);
  window.addEventListener('calloria:workstation-resumed', syncVisibility);
  const bodyObserver = new MutationObserver(syncVisibility);
  bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const stationPanel = document.getElementById('stationPanel');
  if (stationPanel) new MutationObserver(syncVisibility).observe(stationPanel, { attributes: true, attributeFilter: ['class'] });

  const compactTutorial = () => {
    // The first-shift mission card is mounted inside the 3D world host, not the HUD.
    const missionCard = document.querySelector('.calloria-world-mission-v23');
    if (missionCard) missionCard.classList.add('calloria-tutorial-card-compact');
    // Keep a small compatibility path for an older tutorial card implementation.
    const candidates = [...document.querySelectorAll('#immersiveHud div,#immersiveHud section,#immersiveHud aside,#immersiveHud article')]
      .filter((node) => {
        const text = String(node.innerText || node.textContent || '').replace(/\\s+/g, ' ').trim();
        return text.toLowerCase().includes('access your workstation') && text.length < 850 && node.childElementCount >= 2;
      })
      .sort((a, b) => String(a.innerText || a.textContent || '').length - String(b.innerText || b.textContent || '').length);
    if (candidates[0]) candidates[0].classList.add('calloria-tutorial-card-compact');
  };
  compactTutorial();
  const worldHost = document.querySelector('.world-panel') || document.body;
  const hudObserver = new MutationObserver(compactTutorial);
  hudObserver.observe(worldHost, { childList: true, subtree: true, characterData: true });
})();
</script>
`;

function transformHtml(html) {
  if (!html.includes('id="immersiveHud"') || html.includes(MARKERS.html)) return html;
  const markedStyle = `<style id="${MARKERS.html}-STYLE">${WORK_FIRST_STYLE}</style>`;
  const injection = `${markedStyle}\n${WORK_FIRST_SCRIPT}`;
  return html.replace('</body>', `${injection}\n</body>`);
}

export function calloriaInWorldOperationsV34Plugin() {
  let decoderRoot = null;
  return {
    name: 'calloria-in-world-operations-v3-4',
    enforce: 'post',
    configResolved() {
      decoderRoot = dracoDirectory();
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestPath = String(request.url || '').split('?')[0];
        if (!requestPath.startsWith('/draco/')) return next();
        const fileName = basename(requestPath);
        if (!DRACO_FILES.includes(fileName)) return next();
        try {
          const filePath = resolve(decoderRoot || dracoDirectory(), fileName);
          if (!filePath.startsWith(resolve(decoderRoot || dracoDirectory()))) return next();
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
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (normalizedId.endsWith(STAFF_TARGET)) return transformStaff(this, source);
      if (normalizedId.endsWith(AVATAR_TARGET)) return transformAvatar(this, source);
      if (normalizedId.endsWith(MAIN_TARGET)) return transformMain(this, source);
      return null;
    },
    transformIndexHtml(html) {
      return transformHtml(html);
    },
    generateBundle() {
      for (const fileName of DRACO_FILES) {
        let source;
        try { source = readDracoFile(fileName); }
        catch (error) { this.error(error.message); }
        this.emitFile({ type: 'asset', fileName: `draco/${fileName}`, source });
      }
    }
  };
}

export const __calloriaV34Test = Object.freeze({
  STAFF_TARGET,
  AVATAR_TARGET,
  MAIN_TARGET,
  MARKERS,
  GLTF_IMPORT,
  DRACO_IMPORT,
  STAFF_LOADER,
  STAFF_EXTENSION_GUARD,
  AVATAR_MESHOPT_SETUP,
  AVATAR_METRICS,
  PAGEHIDE_ANCHOR,
  DRACO_FILES,
  WORK_FIRST_STYLE,
  WORK_FIRST_SCRIPT,
  transformStaff,
  transformAvatar,
  transformMain,
  transformHtml,
  dracoDirectory
});
