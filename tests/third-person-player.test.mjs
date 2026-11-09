import test from 'node:test';
import assert from 'node:assert/strict';
import { __thirdPersonPlayerPluginTest as plugin } from '../build/calloria-third-person-player-plugin.mjs';

function context() {
  return { error(message) { throw new Error(message); } };
}
function fixture() {
  return [
    "  callbacks.onAssetsReady?.(combinedAssetStatus);",
    '    updatePlayer(delta);',
    '      worldMissionLayer?.dispose?.();',
    "    window.dispatchEvent(new CustomEvent('calloria:world-immersive', { detail: { active: immersive } }));"
  ].join('\n');
}

test('adds player avatar loader import and creates the avatar after GLB world readiness', () => {
  const result = plugin.transformWorld(context(), fixture());
  assert.ok(result.code.includes("import { createCalloriaPlayerAvatar } from './world-player-avatar.js';"));
  assert.ok(result.code.includes('playerAvatarLayer = await createCalloriaPlayerAvatar({ scene, tier'));
  assert.ok(result.code.includes('playerAvatarLayer?.setVisible?.(immersive)'));
});

test('updates the avatar and follow camera inside the existing animation frame', () => {
  const result = plugin.transformWorld(context(), fixture());
  assert.ok(result.code.includes('playerAvatarLayer?.update?.({ x: player.x'));
  assert.ok(result.code.includes('const followDistance = mobile ? 3.9 : 4.8;'));
  assert.equal(result.code.match(/requestAnimationFrame/g)?.length || 0, 0);
});

test('disposes avatar resources with the existing world lifecycle', () => {
  const result = plugin.transformWorld(context(), fixture());
  assert.ok(result.code.includes('playerAvatarLayer?.dispose?.();'));
});

test('fails closed when the source controller contract changes', () => {
  assert.throws(() => plugin.transformWorld(context(), fixture().replace('updatePlayer(delta);', 'updatePlayer(frameDelta);')), /player update loop anchor \(0 found\)/);
});

test('is idempotent when the build transform has already run', () => {
  const once = plugin.transformWorld(context(), fixture());
  const twice = plugin.transformWorld(context(), once.code);
  assert.equal(twice, null);
});
