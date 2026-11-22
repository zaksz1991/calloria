import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calloriaThirdPersonPlayerPlugin, __calloriaThirdPersonV704Test as internals } from '../build/calloria-third-person-player-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginPath = path.resolve(here, '../build/calloria-third-person-player-plugin.mjs');
const workflowPath = path.resolve(here, '../.github/workflows/calloria-production-build.yml');
const packagePath = path.resolve(here, '../package.json');
const npmrcPath = path.resolve(here, '../.npmrc');

function worldFixture({ disposal = 'current', immersive = 'callback' } = {}) {
  const disposeBlock = disposal === 'v684' ? internals.V684_DISPOSE : internals.CURRENT_DISPOSE;
  const immersiveBlock = immersive === 'event' ? internals.IMMERSIVE_EVENT : internals.IMMERSIVE_CALLBACK;
  return `export async function initProductionWorld(THREE, host, callbacks = {}) {
  const mobile = false;
  const coarsePointer = false;
  const scene = {};
  const camera = { position: { set() {} }, rotation: { order: 'YXZ', set() {} } };
  const tier = 'balanced';
  const keys = new Set();
  const touchMove = { x: 0, y: 0, sprinting: false, pointerId: null };
  const player = { x: 0, z: 0, yaw: 0, pitch: 0 };
  let immersive = false;
  let disposed = false;
  const visibilityObserver = { disconnect() {} };
  const resizeObserver = { disconnect() {} };
  function stopLoop() {}
  function renderStill() {}
  function updatePlayer(delta) {}
${internals.RENDER_READY}
  function animate(delta) {
${internals.UPDATE}
  }
  function setImmersive() {
${immersiveBlock}
  }
  function dispose() {
${disposeBlock}
  }
  return { animate, setImmersive, dispose };
}
`;
}

function transform(source, id = '/repo/js/production-world.js', warnings = []) {
  const plugin = calloriaThirdPersonPlayerPlugin();
  const context = { warn(message) { warnings.push(String(message)); } };
  return plugin.transform.call(context, source, id);
}

function syntaxCheck(source) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v704-syntax-'));
  try {
    const file = path.join(temp, 'transformed-world.mjs');
    fs.writeFileSync(file, source);
    return spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

test('transforms the stable render-ready callback without depending on combinedAssetStatus', () => {
  const source = worldFixture();
  const result = transform(source);
  assert.ok(result?.code);
  assert.match(result.code, /__CALLORIA_THIRD_PERSON_PLAYER_V26__/);
  assert.match(result.code, /requestIdleCallback/);
  assert.match(result.code, /playerAvatarLayer\?\.update/);
  assert.doesNotMatch(result.code, /combinedAssetStatus/);
  assert.match(result.code, /createCalloriaPlayerAvatar\(\{ scene, tier/);
  assert.match(result.code, /const followDistance = 4\.8/);
  assert.match(result.code, /camera\.position\.set\(player\.x \+ Math\.sin\(player\.yaw\)/);
  assert.match(result.code, /operationMode = calloriaWorkstationBusy/);
  assert.doesNotMatch(result.code, /await calloriaStartPlayerAvatar/);
  const syntax = syntaxCheck(result.code);
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});

test('keeps coarse-pointer and mobile devices on the original first-person controller', () => {
  const result = transform(worldFixture());
  assert.ok(result?.code);
  assert.match(result.code, /if \(mobile\)/);
  assert.match(result.code, /Boolean\(immersive && !mobile\)/);
  assert.match(result.code, /PLAYER VIEW: FIRST-PERSON TOUCH/);
});

test('avatar loading is scheduled after the first render and does not block world initialisation', () => {
  const result = transform(worldFixture());
  assert.ok(result?.code);
  const readyIndex = result.code.indexOf(internals.RENDER_READY);
  const scheduleIndex = result.code.indexOf('calloriaStartPlayerAvatar');
  assert.ok(readyIndex >= 0);
  assert.ok(scheduleIndex > readyIndex);
  assert.match(result.code, /setTimeout\(calloriaStartPlayerAvatar, 240\)/);
  assert.equal(calloriaThirdPersonPlayerPlugin().enforce, 'post');
});

test('world disposal cancels pending avatar work and releases a late-loaded model', () => {
  const result = transform(worldFixture());
  assert.ok(result?.code);
  assert.match(result.code, /calloriaCancelPlayerAvatarStart\(\)/);
  assert.match(result.code, /playerAvatarLayer\?\.dispose\?\.\(\)/);
  assert.match(result.code, /removeEventListener\('calloria:game-operation-selected'/);
  assert.match(result.code, /removeEventListener\('calloria:world-immersive'/);
  assert.match(result.code, /playerAvatarLayer = null/);
});


test('supports the GLB v6.84 post-transform disposal and immersive event contract', () => {
  const result = transform(worldFixture({ disposal: 'v684', immersive: 'event' }));
  assert.ok(result?.code);
  assert.match(result.code, /worldMissionLayer\?\.dispose\?\.\(\);[\s\S]*calloriaCancelPlayerAvatarStart/);
  assert.match(result.code, /calloria:world-immersive/);
  assert.match(result.code, /playerAvatarLayer\?\.setVisible/);
  const syntax = syntaxCheck(result.code);
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
});

test('a second transform is idempotent', () => {
  const first = transform(worldFixture());
  assert.ok(first?.code);
  assert.equal(transform(first.code), null);
});

test('source drift warns and skips instead of aborting the Vite build', () => {
  const warnings = [];
  const source = worldFixture().replace(internals.RENDER_READY, '  callbacks.onSomethingElse?.();');
  const plugin = calloriaThirdPersonPlayerPlugin();
  const context = {
    warn(message) { warnings.push(String(message)); },
    error(message) { throw new Error(`unexpected fatal build error: ${message}`); }
  };
  const result = plugin.transform.call(context, source, '/repo/js/production-world.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
  assert.match(warnings[0], /first-person controls are preserved/);
});

test('plugin ignores non-world modules', () => {
  const warnings = [];
  assert.equal(transform(worldFixture(), '/repo/js/main.js', warnings), null);
  assert.equal(warnings.length, 0);
});

test('npm lifecycle policy is strict and the only approved script is pinned esbuild', () => {
  const npmrc = fs.readFileSync(npmrcPath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.match(npmrc, /^strict-allow-scripts=true\s*$/m);
  assert.deepEqual(pkg.allowScripts, { 'esbuild@0.25.12': true });
});

test('GitHub Actions mirrors install, test, preflight and Vercel build stages', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /node-version-file: \.nvmrc/);
  assert.match(workflow, /npm install --global npm@11/);
  assert.match(workflow, /npm install --no-audit --no-fund/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run check/);
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /branches: \[main\]/);
});
