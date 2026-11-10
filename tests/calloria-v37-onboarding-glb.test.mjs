import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __calloriaV37Test as v37,
  calloriaOJTGLBActivationPlugin
} from '../build/calloria-ojt-glb-activation-plugin.mjs';

function transform(fn, source) {
  const context = { error(message) { throw new Error(message); }, warn() {} };
  return fn.call(context, context, source)?.code ?? null;
}

test('staff GLB loader receives Draco alongside the pre-existing Meshopt decoder without a loop-end anchor', () => {
  const source = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    '  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);',
    "      const extensionsValid = !requiredExtensions.includes('KHR_draco_mesh_compression');"
  ].join('\n');
  const output = transform(v37.transformStaff, source);
  assert.match(output, /DRACOLoader/);
  assert.match(output, /setDecoderPath\('\/draco\/'\)/);
  assert.match(output, /setDRACOLoader\(dracoLoader\)/);
  assert.match(output, /supportedRequiredExtensions/);
  assert.doesNotMatch(output, /STAFF_LOOP_END/);
});

test('office GLB loader receives Draco and a first-party low-tier workstation plus reception assets', () => {
  const source = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    "const preferred = safeTier === 'low' ? [10] : safeTier === 'high' ? [8, 9, 10, 11] : [9, 10];",
    "headsetStationIndexes: safeTier === 'low' ? [] : [...deskStationIndexes],",
    "    includeReceptionDesk: safeTier !== 'low',",
    '  loader.setMeshoptDecoder(MeshoptDecoder);'
  ].join('\n');
  const output = transform(v37.transformOffice, source);
  assert.match(output, /setDRACOLoader\(dracoLoader\)/);
  assert.match(output, /const preferred = safeTier === 'low' \? \[10\]/);
  assert.match(output, /headsetStationIndexes: safeTier === 'low' \? \[10\]/);
  assert.match(output, /includeReceptionDesk: true/);
});

test('shared asset catalogue loader activates both Meshopt and Draco for every registered customer/office GLB', () => {
  const source = [
    "import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';",
    '    this.loader = new GLTFLoader(manager);',
    '    this.loader.setMeshoptDecoder(MeshoptDecoder);'
  ].join('\n');
  const output = transform(v37.transformAssetLoader, source);
  assert.match(output, /DRACOLoader/);
  assert.match(output, /this\.loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(output, /this\.loader\.setDRACOLoader\(this\.dracoLoader\)/);
  assert.match(output, /setDecoderPath\('\/draco\/'\)/);
});

test('low-tier world receives standing static-GLB targets without moving staff', () => {
  const source = [
    "  const supportPosts = tier === 'high'",
    "    ? [{ x: 12.6, z: -1.0 }, { x: 13.2, z: 8.0 }, { x: -12.4, z: -9.0 }, { x: 12.7, z: -8.9 }]",
    "    : tier === 'balanced'",
    "      ? [{ x: 12.6, z: -1.0 }, { x: 13.2, z: 8.0 }]",
    '      : [];',
    '  supportPosts.forEach((post, index) => buildStaff(post, index, false, false));'
  ].join('\n');
  const output = transform(v37.transformWorld, source);
  assert.match(output, /low-tier standing targets for real staff GLBs/);
  assert.match(output, /x: 12\.6, z: -1\.0/);
  assert.match(output, /x: -12\.4, z: -9\.0/);
  assert.match(output, /buildStaff\(post, index, false, false\)/);
});

test('player avatar module is replaced with an invisible first-person-only adapter', () => {
  assert.match(v37.FIRST_PERSON_AVATAR, /firstPersonOnly: true/);
  assert.match(v37.FIRST_PERSON_AVATAR, /active: false/);
  assert.doesNotMatch(v37.FIRST_PERSON_AVATAR, /GLTFLoader|MeshoptDecoder|scene\.add/);
});

test('main application transform defaults new applicants to general customer experience and adds employee OJT gates', () => {
  const source = [
    "  selectedTrack: 'banking',",
    "  department: 'Banking Operations',",
    'function renderOverview() {',
    'function renderView() {',
    "function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;state.experience=0;state.agentStatus='offline';state.currentView='overview';saveState();toast('Employment accepted. Welcome to the operations floor.','success');renderView();}",
    "function startShift(){\n  if(!state.hired){toast('Complete recruitment and accept the employment offer before starting a shift.','warning');return;}\n  if (state.shiftActive) { toast('Your shift is already active.'); return; }",
    'function simulationDateNow(){const date=new Date();date.setDate(date.getDate()+Math.max(0,(Number(state.day)||1)-1));const seconds=simulationSecondsNow();date.setHours(Math.floor(seconds/3600),Math.floor((seconds%3600)/60),seconds%60,0);return date;}',
    "if(simulatedMinute>=17*60){toast('The scheduled shift has ended for today. Start the next simulated workday.','warning');return;}\n  state.day=state.day||1;",
    "  state.currentView='overview';\n  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');",
    "function open3dWorkView(view){\n  close3dStationPanel();\n  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();\n}",
    "        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;"
  ].join('\n');
  const output = transform(v37.transformMain, source);
  assert.match(output, /selectedTrack: 'service'/);
  assert.match(output, /department: 'Customer Experience'/);
  assert.match(output, /state\.onboarding=calloriaCreateOJTProfile\(\)/);
  assert.match(output, /Product & service knowledge/);
  assert.match(output, /Agent shadowing/);
  assert.match(output, /Supervised practice/);
  assert.match(output, /GLB STAFF:.*OFFICE GLB OBJECTS/);
  assert.match(output, /asset loading diagnostics/);
  assert.match(output, /Attend the 07:30 morning or 14:00 afternoon operations briefing/);
  assert.match(output, /Complete product and service knowledge first/);
  assert.match(output, /calloriaOJTRequired\(\)/);
  assert.match(output, /Trainer sign-off & allocate my workstation/);
});

test('on-the-job training sequences product/service knowledge, CRM logging, five live shadow stages, then supervised practice', () => {
  assert.match(v37.OJT_CODE, /Product & service knowledge/);
  assert.match(v37.OJT_CODE, /Systems & interaction logging/);
  assert.match(v37.OJT_CODE, /A customer call enters the queue/);
  assert.match(v37.OJT_CODE, /The agent picks and greets the call/);
  assert.match(v37.OJT_CODE, /The agent logs and investigates/);
  assert.match(v37.OJT_CODE, /The agent completes wrap-up/);
  assert.match(v37.OJT_CODE, /Complete product\/service knowledge and CRM logging practice before shadowing an agent/);
  assert.match(v37.OJT_CODE, /Complete the modules in sequence/);
  assert.match(v37.OJT_CODE, /Unsuccessful transfer enquiry/);
  assert.match(v37.OJT_CODE, /Mobile service interruption/);
  assert.match(v37.OJT_CODE, /Online order not received/);
  assert.match(v37.OJT_CODE, /Trainer sign-off & allocate my workstation/);
});

test('HTML HUD compacting is injected only once and retains a direct route to the workforce desk', () => {
  const html = '<html><body><div id="immersiveHud"></div></body></html>';
  const plugin = calloriaOJTGLBActivationPlugin();
  const output = plugin.transformIndexHtml(html);
  assert.match(output, /calloriaQuickWorkDock/);
  assert.match(output, /calloria:guided-open-inbound/);
  assert.equal(plugin.transformIndexHtml(output), output);
});

test('Draco decoder package contains exactly the three supported decoder runtime files', () => {
  assert.deepEqual(v37.DRACO_FILES, ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js']);
  assert.equal(v37.TARGETS.assetLoader, '/js/glb-asset-loader.js');
  assert.deepEqual(v37.GLB_REQUIRED_ASSETS, [
    'characters/agents/female-agent.glb','characters/agents/male-agent.glb',
    'office/desks/office_desk.glb','office/equipment/office_computer.glb',
    'accessories/headsets/model.glb','office/reception/reception-desk.glb'
  ]);
});
