import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calloriaMobileResponsiveRepairPlugin,
  FIRST_PERSON_AVATAR_MODULE,
  MOBILE_REPAIR_MARKERS,
  __calloriaV610Test
} from '../build/calloria-mobile-responsive-repair-v6-10.mjs';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');

test('player avatar module is replaced by a safe first-person adapter', () => {
  const plugin = calloriaMobileResponsiveRepairPlugin();
  const result = plugin.transform('export async function createCalloriaPlayerAvatar() { return { active: true }; }', '/repo/js/world-player-avatar.js');
  assert.ok(result?.code.includes(MOBILE_REPAIR_MARKERS.avatar));
  assert.match(result.code, /active:\s*false/);
  assert.match(result.code, /firstPersonOnly:\s*true/);
  assert.match(result.code, /setVisible\(\)\s*\{\}/);
  assert.equal(FIRST_PERSON_AVATAR_MODULE, result.code);
});

test('mobile camera guard restores eye-level first-person camera', () => {
  const input = `function loop(){\n    playerAvatarLayer?.update?.({});\n    if (immersive && playerAvatarLayer?.active) {\n      const followDistance = mobile ? 3.9 : 4.8;\n      camera.position.set(player.x + followDistance, 2.35, player.z);\n    }\n  }\n  function setImmersive(){\n    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));\n    playerAvatarLayer?.setVisible?.(immersive);\n  }`;
  const context = { warn(message) { throw new Error(message); } };
  const result = __calloriaV610Test.transformWorld(context, input);
  assert.ok(result?.code.includes(MOBILE_REPAIR_MARKERS.world));
  assert.match(result.code, /if \(immersive && touchDevice\)/);
  assert.match(result.code, /camera\.position\.set\(player\.x, 1\.68, player\.z\)/);
  assert.match(result.code, /camera\.rotation\.set\(player\.pitch, player\.yaw, 0\)/);
  assert.match(result.code, /setVisible\?\.\(immersive && !touchDevice\)/);
  assert.match(result.code, /else if \(immersive && playerAvatarLayer\?\.active\)/);
});

test('world camera transform is idempotent', () => {
  const input = `    if (immersive && playerAvatarLayer?.active) { camera.position.set(0, 2.35, 4); }`;
  const first = __calloriaV610Test.transformWorld({}, input);
  assert.ok(first);
  assert.equal(__calloriaV610Test.transformWorld({}, first.code), null);
});

test('index HTML receives one mobile stylesheet and UI guard only on the game root', () => {
  const plugin = calloriaMobileResponsiveRepairPlugin();
  const html = '<html><head></head><body><div id="worldCanvas"></div><section id="viewRoot"></section></body></html>';
  const transformed = plugin.transformIndexHtml(html);
  assert.match(transformed, /calloria-mobile-responsive-v6-10\.css/);
  assert.match(transformed, /calloria-mobile-ui-guard-v6-10\.js/);
  assert.equal((transformed.match(/data-calloria-mobile-v610/g) || []).length, 2);
  assert.equal(plugin.transformIndexHtml(transformed), transformed);
  const unrelated = '<html><head></head><body><main id="dashboard"></main></body></html>';
  assert.equal(plugin.transformIndexHtml(unrelated), unrelated);
});

test('assessment CTA guard preserves the existing delegated action handlers', () => {
  const runtime = read('public/js/calloria-mobile-ui-guard-v6-10.js');
  assert.match(runtime, /assessment-next/);
  assert.match(runtime, /practical-next/);
  assert.match(runtime, /scrollIntoView/);
  assert.match(runtime, /MutationObserver/);
  assert.doesNotMatch(runtime, /stopImmediatePropagation|preventDefault\(\)/);
});

test('mobile stylesheet keeps Continue above the dock and enlarges answer hit targets', () => {
  const css = read('public/calloria-mobile-responsive-v6-10.css');
  assert.match(css, /\.assessment-footer\s*\{[\s\S]*?position:\s*sticky/);
  assert.match(css, /bottom:\s*calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /min-height:\s*68px/);
  assert.match(css, /min-height:\s*54px/);
  assert.match(css, /--calloria-visible-height-v610/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test('Vite config registers this as the last post-transform plugin', () => {
  const config = read('vite.config.js');
  assert.match(config, /import \{ calloriaMobileResponsiveRepairPlugin \} from '\.\/build\/calloria-mobile-responsive-repair-v6-10\.mjs';/);
  const last = config.indexOf('calloriaMobileResponsiveRepairPlugin()');
  const close = config.indexOf('  ],', last);
  assert.ok(last > -1 && close > last);
  assert.ok(config.indexOf('calloriaOutboundCampaignV45Plugin()') < last);
});
