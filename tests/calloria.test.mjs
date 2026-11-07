import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('CALLORIA branding is used across the player-facing application shell', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>CALLORIA/);
  assert.match(html, /content="CALLORIA/);
  assert.match(html, /brand-name">CALLORIA/);
  assert.match(html, /CALLORIA <b>·<\/b>/);
  assert.doesNotMatch(html, /FLOORSHIFT/i);
  assert.match(html, /calloria-mark\.svg/);
});

test('game shell retains core operations and immersive workplace anchors', async () => {
  const html = await read('index.html');
  for (const id of ['worldCanvas','enterFloorButton','immersiveHud','exitFloorButton','stationHint','stationPanel','viewRoot','touchJoystick','touchStick','touchSprintButton','touchInteractButton']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  for (const view of ['overview','inbound','outbound','crm','knowledge','performance','career']) {
    assert.match(html, new RegExp(`data-view=["']${view}["']`));
  }
});

test('touch controls provide joystick movement, look drag, run and workstation interaction', async () => {
  const source = await read('js/production-world.js');
  const css = await read('styles.css');
  assert.match(source, /const touchDevice/);
  assert.match(source, /function updateTouchJoystick/);
  assert.match(source, /touchMove\.y/);
  assert.match(source, /touchMove\.sprinting/);
  assert.match(source, /useNearestStation/);
  assert.match(source, /if \(touchDevice\)/);
  assert.match(css, /\.touch-joystick/);
  assert.match(css, /\.touch-game-button\.sprint/);
  assert.match(css, /orientation:landscape/);
});

test('Three.js and addons are npm-resolved and Vite production build is configured', async () => {
  const [html,world,main,packageJson,vercel,vite] = await Promise.all([
    read('index.html'), read('js/production-world.js'), read('js/main.js'), read('package.json'), read('vercel.json'), read('vite.config.js')
  ]);
  const pkg = JSON.parse(packageJson);
  assert.doesNotMatch(html, /importmap|cdn\.jsdelivr\.net\/npm\/three/);
  assert.match(world, /three\/addons\/loaders\/GLTFLoader\.js/);
  assert.match(world, /three\/addons\/utils\/SkeletonUtils\.js/);
  assert.match(main, /import\('three'\)/);
  assert.equal(pkg.dependencies.three, '0.170.0');
  assert.equal(pkg.devDependencies.vite, '8.3.6');
  assert.equal(pkg.scripts.build, 'vite build');
  assert.match(vercel, /"outputDirectory":\s*"dist"/);
  assert.match(vercel, /"installCommand":\s*"npm install"/);
  assert.match(vite, /outDir:\s*'dist'/);
});

test('previous local player progress is migrated to CALLORIA storage', async () => {
  const source = await read('js/main.js');
  assert.match(source, /const STORAGE_KEY = 'calloria\.save\.v1'/);
  assert.match(source, /const LEGACY_STORAGE_KEY = 'floorshift3d\.save\.v1'/);
  assert.match(source, /localStorage\.getItem\(LEGACY_STORAGE_KEY\)/);
  assert.match(source, /localStorage\.setItem\(STORAGE_KEY/);
});

test('recruitment gate and existing operational functions remain intact', async () => {
  const source = await read('js/main.js');
  for (const feature of ['function renderOverview','function startInbound','function startOutbound','function renderCRM','function renderKnowledge','function renderPerformance','function renderCareer','function open3dStationPanel']) {
    assert.ok(source.includes(feature), `missing retained feature: ${feature}`);
  }
  assert.match(source, /if\(!state\.hired\)/);
  assert.match(source, /data-station-action="inbound"/);
  assert.match(source, /data-station-action="outbound"/);
  assert.match(source, /data-station-action="crm"/);
  assert.match(source, /data-station-action="knowledge"/);
});

test('asset and roadmap documentation identifies remaining production boundaries', async () => {
  const [readme,roadmap,assets] = await Promise.all([read('README.md'),read('PRODUCT-ROADMAP.md'),read('ASSET-SOURCES.md')]);
  assert.match(readme, /not a finished commercial product/i);
  assert.match(readme, /physical-device QA/i);
  assert.match(roadmap, /0\.3\.0/);
  assert.match(assets, /CC0/);
  assert.match(assets, /first-party/);
});


test('operations engine integrates inbound and outbound after-contact callback completion safely', async () => {
  const [main, engine] = await Promise.all([read('js/main.js'), read('js/operations-engine.js')]);
  assert.match(main, /completeActiveCallback\(state\.callbacks,\{contactId:contact\.id\}/);
  assert.match(main, /completeActiveCallback\(state\.callbacks,\{callbackId:active\.callbackId\}/);
  assert.doesNotMatch(main, /item=>item\.contactId===contact\.id&&item\.status==='in_progress'\);\s*if\(priorCallback\)/);
  assert.match(engine, /export function completeActiveCallback/);
  assert.match(main, /Choose a permitted final disposition for this interaction/);
  assert.match(main, /const outboundCallbacks=state\.callbacks\.filter/);
  const saveWrapUp = main.slice(main.indexOf('function saveWrapUp(){'), main.indexOf('function toggleCallHold(){'));
  const outboundBranch = saveWrapUp.split('}else{\n    const active=state.activeOutbound;')[1]?.split('\n  }\n  state.totalACWSeconds')[0] || '';
  assert.ok(outboundBranch, 'outbound wrap-up branch must exist');
  assert.doesNotMatch(outboundBranch, /\bcontact\.id\b/, 'outbound wrap-up must not reference an inbound contact variable');
  assert.ok(saveWrapUp.indexOf('if(!Number.isFinite(dueMillis)||dueMillis<=Date.now())') < saveWrapUp.indexOf('completeActiveCallback(state.callbacks,{callbackId:active.callbackId}'), 'callback validation must happen before closing the active callback');
});

test('contact queue and supervisor tools are wired into navigation and workstation', async () => {
  const [html, main] = await Promise.all([read('index.html'), read('js/main.js')]);
  assert.match(html, /data-view=["']queue["']/);
  assert.match(html, /data-view=["']supervisor["']/);
  assert.match(main, /case 'queue': renderQueue\(\)/);
  assert.match(main, /case 'supervisor': renderSupervisor\(\)/);
  assert.match(main, /data-station-action="queue"/);
  assert.match(main, /data-station-action="supervisor"/);
  assert.match(main, /data-action="request-supervisor"/);
  assert.match(main, /data-action="transfer-call"/);
});


test('voice practice and shift operations are wired with explicit privacy controls', async () => {
  const [main, world, shift, voice, css] = await Promise.all([
    read('js/main.js'), read('js/production-world.js'), read('js/shift-engine.js'), read('js/voice-engine.js'), read('styles.css')
  ]);
  for (const feature of [
    'function renderVoicePractice', 'getUserMedia', 'SpeechRecognition', 'voiceFallbackForm',
    'data-action="start-voice-recording"', 'data-action="start-voice-transcription"',
    'data-action="advance-workday"', 'function startShift', 'function endShift',
    'briefingFor(simulationDateNow())', 'visibilitychange', 'pagehide'
  ]) assert.ok(main.includes(feature), `missing v0.6 behaviour: ${feature}`);
  assert.match(main, /if\s*\(!voiceConsent\)/);
  assert.match(main, /shiftElapsedMinutes\)<540/);
  assert.match(voice, /no_calloria_upload/);
  assert.match(voice, /REDACTED PAYMENT CARD/);
  assert.match(shift, /calculateShiftAdherence/);
  assert.match(world, /setAgentActivity/);
  assert.match(css, /\.voice-practice-panel/);
});
