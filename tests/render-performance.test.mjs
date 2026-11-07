import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('renderer selects a lower-cost device profile for touch, low memory, low CPU or save-data', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /navigator\.deviceMemory/);
  assert.match(world, /navigator\.hardwareConcurrency/);
  assert.match(world, /navigator\.connection\?\.saveData/);
  assert.match(world, /const lowEndDevice = touchDevice/);
  assert.match(world, /pixelRatioCap = lowEndDevice \? 0\.9/);
  assert.match(world, /renderer\.shadowMap\.enabled = !lowEndDevice/);
});

test('remote character assets are deferred until entering the floor and skipped on low-end devices', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /function ensureAssetsLoaded\(\)/);
  assert.match(world, /if\(!loader \|\| lowEndDevice\)/);
  assert.match(world, /ensureAssetsLoaded\(\);/);
  assert.match(world, /assetLoadPromise=loadExternalAssets\(\)\.then\(result=>/);
  assert.equal((world.match(/assetLoadPromise=loadExternalAssets\(\)\.then/g) || []).length, 1, 'external staff loading is only invoked once by the lazy ensureAssetsLoaded path');
  assert.doesNotMatch(world, /loader\.loadAsync\(ASSET_URLS\.reception\)/);
});

test('renderer pauses outside visibility and throttles preview/gameplay frame rates', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /IntersectionObserver/);
  assert.match(world, /document\.addEventListener\('visibilitychange'/);
  assert.match(world, /document\.hidden/);
  assert.match(world, /1000\/14/);
  assert.match(world, /1000\/20/);
  assert.match(world, /1000\/30/);
  assert.match(world, /1000\/40/);
});

test('procedural texture generation is reduced on low-end devices', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /lowEndDevice \? 2500 : 7000/);
  assert.match(world, /lowEndDevice \? 2500 : 6500/);
  assert.match(world, /lowEndDevice \? 1800 : 4500/);
});

test('active first-person gameplay hides the launch overlay and adapts render resolution under load', async () => {
  const [styles, world] = await Promise.all([read('styles.css'), read('js/production-world.js')]);
  assert.match(styles, /body\.calloria-game-playing #gameLaunchScreen\{display:none!important\}/);
  assert.match(world, /function adaptResolution\(renderCostMs, timestamp\)/);
  assert.match(world, /renderer\.setPixelRatio\(currentPixelRatio\)/);
  assert.match(world, /renderCostAverageMs > \(lowEndDevice \? 17 : 21\)/);
});

test('lower-cost rendering removes ceiling point lights and shadows on low-end device profiles', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /if \(!lowEndDevice && lightPanelIndex % 2 === 0\)/);
  assert.match(world, /renderer\.shadowMap\.enabled = !lowEndDevice/);
});

test('low-end mode skips unused remote 3D loader modules and reduces texture memory', async () => {
  const world = await read('js/production-world.js');
  assert.match(world, /lowEndDevice \? Promise\.resolve\(null\) : import\('three\/addons\/loaders\/GLTFLoader\.js'\)/);
  assert.match(world, /lowEndDevice \? Promise\.resolve\(null\) : import\('three\/addons\/utils\/SkeletonUtils\.js'\)/);
  assert.match(world, /const textureAnisotropy = lowEndDevice \? Math\.min\(2, maxAnisotropy\)/);
  assert.match(world, /lowEndDevice \? 512 : 1024/);
  assert.match(world, /lowEndDevice \? 256 : 512/);
});
