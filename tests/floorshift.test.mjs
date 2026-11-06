import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('application shell exposes the interactive 3D workplace controls', async () => {
  const html = await read('index.html');
  for (const id of ['worldCanvas', 'enterFloorButton', 'immersiveHud', 'exitFloorButton', 'stationHint', 'stationPanel']) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing ${id}`);
  }
  assert.match(html, /three@0\.170\.0\/build\/three\.module\.js/);
});

test('production 3D module exports the world initializer and first-person interactions', async () => {
  const source = await read('js/production-world.js');
  assert.match(source, /export async function initProductionWorld/);
  assert.match(source, /requestPointerLock/);
  assert.match(source, /KeyW/);
  assert.match(source, /KeyE/);
  assert.match(source, /function buildWorkstation/);
  assert.match(source, /for\(let r=0;r<zPositions\.length;r\+\+\)for\(let c=0;c<xPositions\.length;c\+\+\)buildWorkstation/);
  assert.match(source, /ASSET_URLS\.businessman/);
  assert.match(source, /ASSET_URLS\.woman/);
  assert.match(source, /ASSET_URLS\.reception/);
});

test('recruitment remains the entry gate and existing operations remain wired', async () => {
  const source = await read('js/main.js');
  assert.match(source, /function open3dStationPanel/);
  assert.match(source, /if\(!state\.hired\)/);
  assert.match(source, /data-station-action="inbound"/);
  assert.match(source, /data-station-action="outbound"/);
  assert.match(source, /data-station-action="crm"/);
  assert.match(source, /data-station-action="knowledge"/);
  assert.match(source, /function renderView/);
  assert.match(source, /function saveState/);
});

test('asset register documents remote models and first-party deployment requirement', async () => {
  const register = await read('ASSET-SOURCES.md');
  assert.match(register, /Businessman rigged/);
  assert.match(register, /Casual woman rigged/);
  assert.match(register, /Reception desk/);
  assert.match(register, /first-party/);
  assert.match(register, /CC0/);
});

test('roadmap and README do not misrepresent the vertical slice as a finished commercial release', async () => {
  const [readme, roadmap] = await Promise.all([read('README.md'), read('PRODUCT-ROADMAP.md')]);
  assert.match(readme, /not a finished commercial release/i);
  assert.match(readme, /voice/i);
  assert.match(roadmap, /commercial release/i);
});
