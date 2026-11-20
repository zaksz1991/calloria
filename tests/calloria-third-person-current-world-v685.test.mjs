import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { __thirdPersonPlayerPluginTest as api } from '../build/calloria-third-person-player-plugin.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const rawSource = readFileSync(resolve(here, 'fixtures/production-world-current-snapshot.js'), 'utf8');
const v684Source = readFileSync(resolve(here, 'fixtures/production-world-after-v684.js'), 'utf8');
function context() {
  return {
    error(message) { throw new Error(message); }
  };
}
function transform(source) {
  return api.transformWorld.call(context(), context(), source).code;
}
function syntaxCheck(source, label) {
  const dir = mkdtempSync(join(tmpdir(), 'calloria-v685-'));
  const path = join(dir, `${label}.mjs`);
  try {
    writeFileSync(path, source);
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('current production-world source exposes all v2.6 anchors once', () => {
  assert.equal(rawSource.split(api.RENDER_READY).length - 1, 1);
  assert.equal(rawSource.split(api.UPDATE).length - 1, 1);
  assert.equal(rawSource.split(api.CURRENT_DISPOSE).length - 1, 1);
  assert.equal(rawSource.split(api.IMMERSIVE_CALLBACK).length - 1, 1);
});

test('current local-world source transforms without the obsolete combined GLB-ready callback', () => {
  const output = transform(rawSource);
  assert.ok(output.includes(api.MARKER));
  assert.ok(output.includes("import { createCalloriaPlayerAvatar } from './world-player-avatar.js';"));
  assert.ok(output.includes('const calloriaStartPlayerAvatar = () => {'));
  assert.ok(output.includes('window.requestIdleCallback(calloriaStartPlayerAvatar, { timeout: 1400 })'));
  assert.ok(output.includes("if (mobile) {"));
  assert.ok(output.includes('PLAYER VIEW: FIRST-PERSON TOUCH'));
  assert.ok(output.includes('const operationMode = calloriaWorkstationBusy'));
  assert.ok(output.includes('playerAvatarLayer?.dispose?.();'));
  assert.ok(output.includes("window.dispatchEvent(new CustomEvent('calloria:world-immersive'"));
  assert.ok(!output.includes('await createCalloriaPlayerAvatar('));
});

test('current-world avatar startup is appended after the first render and remains asynchronous', () => {
  const output = transform(rawSource);
  const firstRender = output.indexOf('  renderStill();');
  const avatarStart = output.indexOf('const calloriaStartPlayerAvatar = () => {');
  assert.ok(firstRender >= 0);
  assert.ok(avatarStart > firstRender);
  assert.ok(output.includes('void createCalloriaPlayerAvatar('));
  assert.ok(output.includes('if (disposed) {\n        layer?.dispose?.();'));
});

test('v6.84-transformed world uses the GLB disposal and immersive-event anchors', () => {
  assert.equal(v684Source.split(api.V684_DISPOSE).length - 1, 1);
  assert.equal(v684Source.split(api.IMMERSIVE_EVENT).length - 1, 1);
  const output = transform(v684Source);
  assert.ok(output.includes(api.MARKER));
  assert.ok(output.includes('worldMissionLayer?.dispose?.();\n      calloriaCancelPlayerAvatarStart();'));
  assert.ok(output.includes(`${api.IMMERSIVE_EVENT}\n    playerAvatarLayer?.setVisible?.(Boolean(immersive && !mobile));`));
  assert.ok(output.includes('glbStartIdleHandle = window.requestIdleCallback(startBackgroundGLBLoads'));
});

test('both current and v6.84-transformed world outputs pass JavaScript syntax checking', () => {
  syntaxCheck(transform(rawSource), 'current-world');
  syntaxCheck(transform(v684Source), 'v684-world');
});

test('transformation is idempotent and does not insert duplicate imports or listeners', () => {
  const output = transform(rawSource);
  assert.equal(api.transformWorld.call(context(), context(), output), null);
  assert.equal(output.split("import { createCalloriaPlayerAvatar } from './world-player-avatar.js';").length - 1, 1);
  assert.equal(output.split("window.addEventListener('calloria:world-immersive'").length - 1, 1);
});

test('a missing current-world update anchor fails safely before returning partial code', () => {
  const broken = rawSource.replace(api.UPDATE, '    // changed controller update');
  assert.throws(() => transform(broken), /player update loop anchor \(0 found\)/);
});
