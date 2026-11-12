import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaCC0LobbyGreeneryPlugin } from '../build/calloria-cc0-lobby-greenery-plugin.mjs';

const lobby = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
const greenery = await readFile(new URL('../js/cc0-lobby-greenery-integration.js', import.meta.url), 'utf8');

test('v6.17.1 compatibility export remains available to production-world', () => {
  assert.match(lobby, /export const integrateCalloriaCC0Lobby = integrateCalloriaCC0OfficeLobby;/);
});

test('greenery is imported and awaited inside the current lobby lifecycle', () => {
  assert.match(lobby, /import \{ addCalloriaLobbyGreenery \} from '\.\/cc0-lobby-greenery-integration\.js';/);
  assert.match(lobby, /greeneryLease = await addCalloriaLobbyGreenery\(gltf, \{ isActive: \(\) => !disposed && isActive\(\) \}\);/);
  assert.ok(lobby.indexOf('await addCalloriaLobbyGreenery(gltf') < lobby.indexOf('const rendered = createCC0OfficeLobbyRenderRoot(gltf, THREE)'));
});

test('greenery reports truthful loaded or fallback state', () => {
  assert.match(lobby, /greenery: greeneryLease\?\.status/);
  assert.match(lobby, /calloria:glb-greenery-ready/);
  assert.match(greenery, /no named lobby planter anchors passed geometry checks/);
  assert.match(greenery, /original lobby retained/);
});

test('greenery resources are released on world disposal and lobby failure', () => {
  assert.ok((lobby.match(/greeneryLease\?\.dispose\?\.\(\)/g) || []).length >= 3);
  assert.match(lobby, /greeneryLease = null;/);
  assert.match(lobby, /if \(gltf\) disposeGLTFResources\(gltf\);/);
});

test('greenery still uses the documented real CC0 asset with conservative geometry limits', () => {
  assert.match(greenery, /https:\/\/cdn\.3dassets\.dev\/assets\/38580\/v1\/model\.glb/);
  assert.match(greenery, /CC0 1\.0 Universal/);
  assert.match(greenery, /maxPlacedTriangles: 4000/);
  assert.match(greenery, /maxPlanterAnchors: 4/);
  assert.doesNotMatch(greenery, /Math\.random\(/);
});

test('obsolete source-anchor Vite transform is disabled without changing vite.config.js', () => {
  const plugin = calloriaCC0LobbyGreeneryPlugin();
  assert.equal(plugin.name, 'calloria-cc0-lobby-greenery-v6-18-runtime');
  assert.equal(plugin.transform('export function anything() {}', '/repo/js/production-world.js'), null);
  assert.equal(plugin.transform('export function anything() {}', '/repo/js/cc0-office-lobby-integration.js'), null);
});
