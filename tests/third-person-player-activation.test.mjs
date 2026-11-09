import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

const [vite, playerPlugin, glbPlugin, world, avatar] = await Promise.all([
  read('vite.config.js'),
  read('build/calloria-third-person-player-plugin.mjs'),
  read('build/calloria-glb-world-plugin.js'),
  read('js/production-world.js'),
  read('js/world-player-avatar.js')
]);

test('Vite imports and registers third-person plugin once, after GLB-first integration', () => {
  assert.match(vite, /import \{ calloriaThirdPersonPlayerPlugin \} from '\.\/build\/calloria-third-person-player-plugin\.mjs';/);
  assert.equal((vite.match(/calloriaThirdPersonPlayerPlugin\(\)/g) || []).length, 1);
  assert.ok(vite.indexOf('calloriaThirdPersonPlayerPlugin()') > vite.indexOf('calloriaGLBWorldPlugin()'));
  assert.ok(vite.indexOf('calloriaThirdPersonPlayerPlugin()') > vite.indexOf('calloriaFirstShiftGameplayPlugin()'));
});

test('plugin runs post-transform and targets production-world', () => {
  assert.match(playerPlugin, /const TARGET = '\/js\/production-world\.js';/);
  assert.match(playerPlugin, /enforce:\s*'post'/);
  assert.match(playerPlugin, /createCalloriaPlayerAvatar/);
});

test('GLB-first integration supplies the player plugin readiness, disposal and immersive anchors', () => {
  assert.match(glbPlugin, /callbacks\.onAssetsReady\?\.\(combinedAssetStatus\)/);
  assert.match(glbPlugin, /worldMissionLayer\?\.dispose\?\.\(\)/);
  assert.match(glbPlugin, /calloria:world-immersive/);
  assert.match(world, /updatePlayer\(delta\);/);
  assert.match(world, /callbacks\.onAssetsReady\?\.\(/);
  assert.match(world, /callbacks\.onImmersiveChange\?\.\(immersive\);/);
});

test('player avatar uses the actual male and female GLB candidates and Meshopt decoding', () => {
  assert.match(avatar, /\['male-agent', 'female-agent'\]/);
  assert.match(avatar, /loader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(avatar, /GLB_ASSET_REGISTRY/);
  assert.match(avatar, /loadAsync\(asset\.url\)/);
});

test('player avatar is updated through the existing world loop, not a second renderer', () => {
  assert.match(playerPlugin, /playerAvatarLayer\?\.update\?\./);
  assert.match(playerPlugin, /camera\.position\.set\(player\.x/);
  assert.match(world, /renderer\.render\(scene, camera\)/);
  assert.equal((world.match(/new THREE\.WebGLRenderer\(/g) || []).length, 1);
  assert.doesNotMatch(avatar, /new THREE\.WebGLRenderer\(/);
});

test('avatar cleanup is attached to world disposal and immersive visibility', () => {
  assert.match(playerPlugin, /playerAvatarLayer\?\.dispose\?\.\(\)/);
  assert.match(playerPlugin, /playerAvatarLayer\?\.setVisible\?\.\(immersive\)/);
  assert.match(avatar, /dispose\(\)\s*\{/);
});
