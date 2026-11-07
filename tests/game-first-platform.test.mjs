import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('the default entry is a full-screen game launch screen and permits guest play', async () => {
  const html = await read('index.html');
  const cloud = await read('js/cloud-platform.js');
  assert.match(html, /<body class="calloria-game-launch">/);
  assert.match(html, /id="gameLaunchScreen"/);
  assert.match(html, /id="launchPlayButton"/);
  assert.match(html, /No registration required/);
  assert.match(cloud, /state\.mode = 'guest'; state\.ready = true/);
  assert.match(cloud, /data-cloud-action="continue-guest"/);
  assert.match(cloud, /Guest mode/);
});

test('account and workspace are optional paths and game progress remains device-local for guests', async () => {
  const html = await read('index.html');
  const main = await read('js/main.js');
  assert.match(html, /data-cloud-open-account/);
  assert.match(html, /id="launchDeskButton"/);
  assert.match(main, /const STORAGE_KEY = 'calloria\.save\.v1'/);
  assert.match(main, /startPublicGameServices\(\)/);
  assert.match(main, /localStorage\.getItem\(activeStorageKey\)/);
});

test('game launch has a direct route into first-person 3D play and return route from the operations desk', async () => {
  const html = await read('index.html');
  const main = await read('js/main.js');
  const css = await read('styles.css');
  assert.match(html, /id="launchPlayButton"/);
  assert.match(html, /id="exitFloorButton"/);
  assert.match(main, /launchPlayButton.*enter3dFloor/s);
  assert.match(main, /return-to-game/);
  assert.match(css, /body\.calloria-game-launch \.world-panel\{position:fixed;inset:0/);
  assert.match(css, /body\.calloria-game-launch \.topbar,body\.calloria-game-launch \.sidebar,body\.calloria-game-launch \.content-wrap\{display:none/);
});

test('player sessions begin only after a player starts gameplay, while launch stats can load before play', async () => {
  const main = await read('js/main.js');
  const platform = await read('js/game-platform.js');
  assert.match(main, /void refreshPublicGameStats\(\)/);
  assert.match(main, /function enter3dFloor\(\)\{ if\(productionWorld\)\{startPublicGameServices\(\)/);
  assert.match(platform, /export function refreshPublicGameStats\(\)/);
  assert.match(platform, /const sessionId = uuid\(\)/);
  assert.match(platform, /const visitorId = storedId\(safeLocalStorage, VISITOR_KEY\)/);
});

test('live player and total-player counters are server-derived and never use hardcoded sample counts', async () => {
  const platform = await read('js/game-platform.js');
  const edge = await read('supabase/functions/calloria-game-telemetry/index.ts');
  const sql = await read('supabase/migrations/202611070004_calloria_game_platform.sql');
  assert.match(platform, /functions\/v1\/calloria-game-telemetry/);
  assert.match(platform, /action: 'stats'/);
  assert.match(edge, /calloria_get_public_game_stats/);
  assert.match(sql, /count\(distinct s\.visitor_hash\)/i);
  assert.match(sql, /calloria_game_visitors/);
  assert.match(platform, /LIVE STATISTICS UNAVAILABLE/);
  assert.match(platform, /—/);
  assert.match(platform, /Unique anonymous browser profiles/);
});

test('sponsor creative is limited to active game-launch campaigns and uses safe external links', async () => {
  const edge = await read('supabase/functions/calloria-game-telemetry/index.ts');
  const platform = await read('js/game-platform.js');
  const sql = await read('supabase/migrations/202611070004_calloria_game_platform.sql');
  assert.match(edge, /eq\('placement', 'game_launch'\)/);
  assert.match(sql, /placement in \('game_launch','in_world_billboard','sponsored_scenario'\)/);
  assert.match(sql, /status in \('draft','pending','active','paused','ended'\)/);
  assert.match(platform, /noopener noreferrer sponsored nofollow/);
  assert.match(platform, /recordSponsorEvent\('impression'\)/);
  assert.match(platform, /recordSponsorEvent\('click'\)/);
});
