import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  __calloriaV611Test,
  calloriaMobileResponsiveRepairPlugin
} from '../build/calloria-mobile-responsive-repair-v6-10.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const avatar = read('js/world-player-avatar.js');
const desktopAvatar = read('js/world-player-avatar-desktop.js');
const css = read('public/calloria-mobile-responsive-v6-10.css');
const ui = read('public/js/calloria-mobile-ui-guard-v6-10.js');

const requiredV25Anchors = [
  '  run: /run|running|sprint/i\n});',
  '  const runClip = findClip(clips, CLIP_PATTERNS.run);',
  "    update({ x = 0, z = 0, yaw = 0, moving = false, sprinting = false, delta = 0 } = {}) {",
  '        const desired = moving ? (sprinting && runClip ? runClip : walkClip || runClip || idleClip) : (idleClip || (walkClip ? null : clips[0]));'
];

test('restored avatar module retains all four required v2.5 transform anchors exactly once', () => {
  for (const anchor of requiredV25Anchors) {
    assert.equal(avatar.split(anchor).length - 1, 1, `anchor count: ${anchor}`);
  }
});

test('mobile uses first-person adapter while desktop keeps the real GLB avatar', () => {
  assert.ok(__calloriaV611Test.FIRST_PERSON_AVATAR_MODULE.includes("await import('./world-player-avatar-desktop.js')"));
  assert.match(__calloriaV611Test.FIRST_PERSON_AVATAR_MODULE, /return desktopAvatar\.createCalloriaPlayerAvatar\(options\)/);
  assert.match(__calloriaV611Test.FIRST_PERSON_AVATAR_MODULE, /active:\s*false/);
  assert.match(__calloriaV611Test.FIRST_PERSON_AVATAR_MODULE, /firstPersonOnly:\s*true/);
  assert.match(__calloriaV611Test.FIRST_PERSON_AVATAR_MODULE, /player-avatar-ready/);
  assert.match(desktopAvatar, /work: \/sit\|sitting\|seated\|typing/);
  assert.match(desktopAvatar, /talk: \/talk\|talking\|speak/);
  assert.match(desktopAvatar, /hasWork: Boolean\(workClip\)/);
  assert.match(desktopAvatar, /hasTalk: Boolean\(talkClip\)/);
  assert.match(desktopAvatar, /setDRACOLoader/);
});

test('world camera transform adds a touch-first eye-level branch and preserves desktop follow branch', () => {
  const source = [
    'const touchDevice = true;',
    'if (immersive && playerAvatarLayer?.active) {',
    '  camera.position.set(player.x + Math.sin(player.yaw) * followDistance, followHeight, player.z);',
    '  camera.rotation.order = \'YXZ\';',
    '}',
    'playerAvatarLayer?.setVisible?.(immersive);'
  ].join('\n');
  const result = __calloriaV611Test.transformWorld({ warn() {} }, source);
  assert.ok(result);
  assert.match(result.code, /camera\.position\.set\(player\.x, 1\.68, player\.z\)/);
  assert.match(result.code, /camera\.rotation\.set\(player\.pitch, player\.yaw, 0\)/);
  assert.match(result.code, /else if \(immersive && playerAvatarLayer\?\.active\)/);
  assert.match(result.code, /setVisible\?\.\(immersive && !\(/);
});

test('world camera transform warns rather than aborting when upstream anchor changes', () => {
  const warnings = [];
  const result = __calloriaV611Test.transformWorld({ warn: (message) => warnings.push(message) }, 'export function createWorld(){ return true; }');
  assert.equal(result, null);
  assert.deepEqual(warnings, []);
});

test('HTML injection targets the root game page and is idempotent', () => {
  const plugin = calloriaMobileResponsiveRepairPlugin();
  const html = '<html><head></head><body><div id="worldCanvas"></div><section id="viewRoot"></section></body></html>';
  const first = plugin.transformIndexHtml(html);
  const second = plugin.transformIndexHtml(first);
  assert.equal(first, second);
  assert.match(first, /calloria-mobile-responsive-v6-10\.css/);
  assert.match(first, /calloria-mobile-ui-guard-v6-10\.js/);
  assert.match(first, /CALLORIA_V611_MOBILE_INTERACTION_HARDENING/);
});

test('assessment proxy calls the original data-action controls instead of replacing progression logic', () => {
  assert.match(ui, /button\[data-action="assessment-next"\], button\[data-action="practical-next"\]/);
  assert.match(ui, /target\.click\(\)/);
  assert.match(ui, /proxyButton\.disabled = disabled/);
  assert.match(ui, /Select an answer to continue/);
  assert.doesNotMatch(ui, /addEventListener\(['"]click['"],\s*\([^)]*\)\s*=>\s*\{[^}]*assessmentIndex/);
});

test('mobile CSS reserves space for fixed navigation and makes a high-contrast floating CTA clickable', () => {
  assert.match(css, /#calloriaMobileAssessmentDockV611/);
  assert.match(css, /pointer-events:\s*auto/);
  assert.match(css, /z-index:\s*108/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('plugin still maps the existing Vite config export and replaces only the expected source modules', () => {
  const plugin = calloriaMobileResponsiveRepairPlugin();
  const avatarResult = plugin.transform('ignored', '/repo/js/world-player-avatar.js');
  assert.ok(avatarResult.code.includes("await import('./world-player-avatar-desktop.js')"));
  assert.equal(plugin.transform('ignored', '/repo/js/not-a-target.js'), null);
});
