import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { __calloriaV35Test as t } from '../build/calloria-first-working-shift-v3-5-plugin.mjs';

const failFast = { error(message) { throw new Error(message); } };

function staffFixture() {
  return [
    "import * as THREE from 'three';",
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",
    "import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';",
    'async function fixture(){',
    '  const candidates = [];',
    '  const maxCandidates = 3;',
    t.STAFF_LOADER_ANCHOR,
    '  const loadedModels = new Map();',
    '  const rejected = [];',
    '  const staff = [];',
    '  const staffTargets = staff.filter(Boolean);',
    '  if (!candidates.length || !staffTargets.length) { return { status: { loaded: 0 } }; }',
    t.STAFF_LOOP_START,
    '    try {',
    '      const gltf = await loader.loadAsync(asset.url);',
    '      const requiredExtensions = gltf.parser?.json?.extensionsRequired || [];',
    t.STAFF_EXTENSION_GUARD,
    '      if (!extensionsValid) continue;',
    '      loadedModels.set(asset.id, gltf);',
    t.STAFF_LOOP_END,
    '    return { status: { loaded: 0 }, rejected };',
    '  }',
    '  return { status: { loaded: loadedModels.size }, rejected };',
    '}'
  ].join('\n');
}

function avatarFixture() {
  return [
    "import * as THREE from 'three';",
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';",
    'export async function createCalloriaPlayerAvatar({ scene, tier = \'balanced\', onStatus } = {}) {',
    "  if (!scene?.add || typeof scene.traverse !== 'function') { throw new TypeError('CALLORIA player avatar requires the active Three.js scene.'); }",
    t.AVATAR_LOADER_ANCHOR,
    '  const failures = [];',
    '  let selected = null;',
    '  let gltf = null;',
    '  let metrics = null;',
    '  for (const asset of getCandidates()) {',
    '    try {',
    '      const candidate = await loader.loadAsync(asset.url);',
    t.AVATAR_METRICS_ANCHOR,
    '      const humanDimensions = candidateMetrics.size.y > 0.8;',
    '      selected = asset;',
    '      gltf = candidate;',
    '      metrics = candidateMetrics;',
    '      break;',
    '    } catch (error) { failures.push({ assetId: asset.id, reason: String(error) }); }',
    '  }',
    t.AVATAR_LOOP_END,
    '    return { status: { ready: false }, active: false };',
    '  }',
    '  return { status: { ready: true }, active: true };',
    '}'
  ].join('\n');
}

function mainFixture() {
  return [
    t.SIMULATION_DATE_ANCHOR,
    'function startShift(){',
    "  if(!state.hired){toast('Complete recruitment and accept the employment offer before starting a shift.','warning');return;}",
    '  if (state.shiftActive) { toast(\'Your shift is already active.\'); return; }',
    '  const simulatedMinute=simulationMinuteNow();',
    "  if(simulatedMinute<8*60){toast('The scheduled shift begins at 08:00. Attend the morning briefing before starting.','warning');return;}",
    t.START_SHIFT_TIME_ANCHOR,
    '  state.shiftElapsedMinutes=simulatedMinute-(8*60);',
    '  state.shiftRecord=createShiftRecord({day:state.day,startedAt:Date.now()});',
    '  state.shiftActive=true;',
    t.START_SHIFT_VIEW_ANCHOR,
    "  window.dispatchEvent(new CustomEvent('calloria:game-shift-started',{detail:{day:state.day}}));",
    '}',
    'function open3dWorkView(view){',
    t.OPEN_WORK_VIEW_ANCHOR,
    '  state.currentView=view;',
    '  saveState();',
    "  window.dispatchEvent(new CustomEvent('calloria:game-operation-selected',{detail:{view,shiftActive:Boolean(state.shiftActive),agentStatus:state.agentStatus}}));",
    '  exit3dFloor();',
    '  renderView();',
    '}',
    t.PAGEHIDE_ANCHOR,
    // These lines are produced by the existing v2.3.1 first-shift bridge.
    "const staffCount=Math.max(0,Number(result?.staffLoaded??result?.loaded??0));",
    "const officeCount=Math.max(0,Number(result?.officePlaced??0));",
    "const failureCount=(Array.isArray(result?.officeErrors)?result.officeErrors.length:0)+(Array.isArray(result?.rejected)?result.rejected.length:0);",
    "const tier=String(result?.tier||'unknown');",
    t.MAIN_ASSET_STATUS_ANCHOR,
    "window.dispatchEvent(new CustomEvent('calloria:glb-assets-ready',{detail:{staff:staffCount,office:officeCount,failures:failureCount,loading:false,tier}}));"
  ].join('\n');
}

function stripModuleSyntax(source) {
  return source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
}

test('staff loader adds Draco after the existing Meshopt transform and before compressed GLB loads', () => {
  const result = t.transformStaff(failFast, staffFixture()).code;
  assert.match(result, /import \{ MeshoptDecoder \} from 'three\/addons\/libs\/meshopt_decoder\.module\.js';/);
  assert.match(result, /import \{ DRACOLoader \} from 'three\/addons\/loaders\/DRACOLoader\.js';/);
  assert.match(result, /const loader = new GLTFLoader\(\)\.setMeshoptDecoder\(MeshoptDecoder\);/);
  assert.match(result, /const dracoLoader = new DRACOLoader\(\);\s+dracoLoader\.setDecoderPath\('\/draco\/'\);\s+loader\.setDRACOLoader\(dracoLoader\);/);
  assert.match(result, /const extensionsValid = true;/);
  assert.match(result, /dracoLoader\.dispose\(\);\s+if \(!loadedModels\.size\)/);
  assert.doesNotThrow(() => new Function(stripModuleSyntax(result)));
});

test('staff loader fails closed if the real post-Meshopt source anchors drift', () => {
  assert.throws(() => t.transformStaff(failFast, 'export const changed = true;'), /staff GLTFLoader import anchor; found 0/);
});

test('touch devices bypass the unanimated third-person avatar and retain first-person control', () => {
  const result = t.transformAvatar(failFast, avatarFixture()).code;
  assert.match(result, /touchFirstPerson/);
  assert.match(result, /First-person touch mode/);
  assert.match(result, /firstPersonOnly: true/);
  assert.match(result, /active: false/);
  assert.match(result, /loader\.setDRACOLoader\(dracoLoader\)/);
  assert.match(result, /dracoLoader\.dispose\(\);\s+if \(!selected \|\| !gltf\)/);
});

test('desktop avatar rejects a static or default-pose mesh', () => {
  const result = t.transformAvatar(failFast, avatarFixture()).code;
  assert.match(result, /candidateMetrics\.skinned > 0/);
  assert.match(result, /candidateMetrics\.bones >= 12/);
  assert.match(result, /hasIdleMotion && hasWalkMotion/);
  assert.match(result, /disposeGLTFResources\(candidate\);\s+continue;/);
  assert.doesNotThrow(() => new Function(stripModuleSyntax(result)));
});

test('shift readiness requires same-day briefing attendance and sends blocked agents to Workforce', () => {
  const result = t.transformMain(failFast, mainFixture()).code;
  assert.match(result, /function hasBriefingAttendanceForToday\(\)/);
  assert.match(result, /briefingFor\(morningDate\)/);
  assert.match(result, /briefingFor\(afternoonDate\)/);
  assert.match(result, /Attend today’s 07:30 morning or 14:00 afternoon operations briefing/);
  assert.match(result, /view='workforce'/);
  assert.match(result, /state.currentView='inbound'/);
  assert.doesNotThrow(() => new Function(result));
});

test('direct work-desk route reuses recruitment and existing inbound operations', () => {
  const result = t.transformMain(failFast, mainFixture()).code;
  assert.match(result, /calloria:guided-open-inbound/);
  assert.match(result, /if\(!state\.hired\)\{open3dWorkView\('recruitment'\);return;\}/);
  assert.match(result, /open3dWorkView\('inbound'\)/);
});

test('GLB status exposes rejected model details for diagnosis', () => {
  const result = t.transformMain(failFast, mainFixture()).code;
  assert.match(result, /rejectionDetails=Array\.isArray\(result\?\.rejected\)/);
  assert.match(result, /status\.title=rejectionDetails/);
});

test('HTML gets compact mission guidance and one direct work-desk action', () => {
  const html = '<html><body><section id="immersiveHud"></section></body></html>';
  const result = t.transformHtml(html);
  assert.match(result, /calloriaQuickWorkDock/);
  assert.match(result, /OPEN WORK DESK/);
  assert.match(result, /max-height:min\(16dvh,122px\)/);
  assert.match(result, /calloria-tutorial-card-compact/);
  assert.equal(t.transformHtml(result), result, 'HTML injection must be idempotent');
});

test('HTML transform leaves non-game pages untouched', () => {
  const html = '<html><body><main>Operations Desk</main></body></html>';
  assert.equal(t.transformHtml(html), html);
});

test('third-person plugin reports intentional touch-first-person mode', () => {
  const source = readFileSync(new URL('../build/calloria-third-person-player-plugin.mjs', import.meta.url), 'utf8');
  assert.match(source, /PLAYER VIEW: FIRST-PERSON TOUCH/);
  assert.match(source, /status\?\.firstPersonOnly/);
  assert.match(source, /calloria:game-call-connected/);
});
